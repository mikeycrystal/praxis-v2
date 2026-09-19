import { useCallback, useMemo, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';

// "Your month on the map" — the ink window (design locked 2026-09-19):
// white card chrome, the map itself a dark panel, cream dots, one dot per
// article read this month, opacity = recency, tap = open the article.
// Copy rule: the headline states what the reader DID; a lopsided month gets
// a neutral line, never a corrective one.
//
// Density ("embers + fresh", his pick 2026-09-19 msg 1710): at Ayuka's real
// volume (~1.3k reads/month) uniform dots merged into blobs. The month now
// renders as two layers — everything older than the newest FRESH_COUNT
// articles becomes faint ember terrain (small, near-transparent, no touch
// target), the fresh reads stay crisp and tappable on top. Ink only, no
// color coding: position already encodes lean, color would say it twice.

const PANEL = 326;
const HALF = PANEL / 2;
const SPAN = 123; // dot field radius in px; coords are -1..1
const FRESH_COUNT = 150;
const ZOOM_MAX = 3;

const INK = '#2B2823';
const INK_LINE = '#454037';
const CREAM = '#EFE9DB';
const GREEN = '#7A9A62';

interface MonthDot {
  articleId: string;
  x: number;
  y: number;
  order: number; // 0 = most recent
}

interface MonthStats {
  reads: number;
  sources: number;
  leftReads: number;
  rightReads: number;
}

const monthStartIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

export function MonthMapCard() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [dots, setDots] = useState<MonthDot[]>([]);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [zoomed, setZoomed] = useState(false);

  // Pinch-to-zoom on the panel (1x–ZOOM_MAX, double-tap resets) — same
  // gesture the Graph tab taught. One-finger pan only engages while zoomed
  // so the profile scroll keeps working at rest.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value;
      })
      .onUpdate((event) => {
        const next = Math.min(ZOOM_MAX, Math.max(1, savedScale.value * event.scale));
        scale.value = next;
        const limit = ((next - 1) * PANEL) / 2;
        tx.value = Math.min(limit, Math.max(-limit, tx.value));
        ty.value = Math.min(limit, Math.max(-limit, ty.value));
      })
      .onEnd(() => {
        runOnJS(setZoomed)(scale.value > 1.02);
      }),
    [savedScale, scale, tx, ty],
  );

  const panGesture = useMemo(
    () => Gesture.Pan()
      .enabled(zoomed)
      .maxPointers(1)
      .onStart(() => {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      })
      .onUpdate((event) => {
        const limit = ((scale.value - 1) * PANEL) / 2;
        tx.value = Math.min(limit, Math.max(-limit, savedTx.value + event.translationX));
        ty.value = Math.min(limit, Math.max(-limit, savedTy.value + event.translationY));
      }),
    [savedTx, savedTy, scale, tx, ty, zoomed],
  );

  const doubleTapGesture = useMemo(
    () => Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_event, success) => {
        if (!success) return;
        scale.value = withTiming(1, { duration: 200 });
        tx.value = withTiming(0, { duration: 200 });
        ty.value = withTiming(0, { duration: 200 });
        runOnJS(setZoomed)(false);
      }),
    [scale, tx, ty],
  );

  const panelGesture = useMemo(
    () => Gesture.Race(doubleTapGesture, Gesture.Simultaneous(pinchGesture, panGesture)),
    [doubleTapGesture, panGesture, pinchGesture],
  );

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ] as const,
  }));

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('analytics_events')
      .select('created_at, properties')
      .eq('user_id', user.id)
      .eq('event_name', 'article_read_complete')
      .gte('created_at', monthStartIso())
      .order('created_at', { ascending: false })
      .limit(1200);
    if (error || !data) return;

    const byArticle = new Map<string, { x: number | null; y: number | null; source: string | null; bias: number | null }>();
    for (const row of data) {
      const p = (row.properties ?? {}) as Record<string, unknown>;
      const id = typeof p.article_id === 'string' ? p.article_id : null;
      if (!id || byArticle.has(id)) continue; // rows are newest-first; keep latest
      byArticle.set(id, {
        x: typeof p.article_x === 'number' ? p.article_x : null,
        y: typeof p.article_y === 'number' ? p.article_y : null,
        source: typeof p.source === 'string' ? p.source : null,
        bias: typeof p.bias_score === 'number' ? p.bias_score : Number(p.bias_score) || null,
      });
    }

    const nextDots: MonthDot[] = [];
    let order = 0;
    const sources = new Set<string>();
    let leftReads = 0;
    let rightReads = 0;
    for (const [id, a] of byArticle) {
      if (a.source) sources.add(a.source.toLowerCase());
      if (typeof a.bias === 'number') {
        if (a.bias <= -15) leftReads += 1;
        if (a.bias >= 15) rightReads += 1;
      }
      if (a.x != null && a.y != null) {
        nextDots.push({ articleId: id, x: a.x, y: a.y, order: order++ });
      }
    }
    setDots(nextDots);
    setStats({ reads: byArticle.size, sources: sources.size, leftReads, rightReads });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!user || !stats || stats.reads === 0) return null;

  const bothSides = stats.leftReads >= 2 && stats.rightReads >= 2;
  const headline = bothSides ? (
    <Text style={[s.insight, { color: c.text }]}>
      You read <Text style={{ color: GREEN }}>both sides</Text> this month.
    </Text>
  ) : (
    <Text style={[s.insight, { color: c.text }]}>Your month on the map.</Text>
  );

  const freshDenom = Math.max(Math.min(dots.length, FRESH_COUNT) - 1, 1);

  const onShare = () => {
    void Share.share({
      message: `My month on Praxis: ${stats.reads} reads from ${stats.sources} sources${bothSides ? ' — both sides' : ''}. praxisnews.co`,
    });
  };

  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={s.head}>
        <Text style={[s.label, { color: c.text }]}>Your month</Text>
        <Text style={[s.lock, { color: c.textMuted }]}>ONLY YOU</Text>
      </View>

      <View style={s.panelWrap}>
        <GestureDetector gesture={panelGesture}>
          <View style={s.zoomClip} collapsable={false}>
            <Animated.View style={zoomStyle}>
              <Svg width={PANEL} height={PANEL}>
                <Rect x={0} y={0} width={PANEL} height={PANEL} rx={14} fill={INK} />
                <Line x1={HALF} y1={40} x2={HALF} y2={PANEL - 40} stroke={INK_LINE} strokeWidth={1} />
                <Line x1={40} y1={HALF} x2={PANEL - 40} y2={HALF} stroke={INK_LINE} strokeWidth={1} />
                <Circle cx={HALF} cy={HALF} r={2} fill="#5A5344" />
                {/* ember layer: the month's terrain, no touch targets */}
                {dots.map((dot) => (dot.order >= FRESH_COUNT ? (
                  <Circle
                    key={dot.articleId}
                    cx={HALF + dot.x * SPAN}
                    cy={HALF - dot.y * SPAN}
                    r={1.7}
                    fill={CREAM}
                    opacity={0.11}
                  />
                ) : null))}
                {/* fresh layer: newest FRESH_COUNT reads, crisp and tappable */}
                {dots.map((dot) => (dot.order < FRESH_COUNT ? (
                  <Circle
                    key={dot.articleId}
                    cx={HALF + dot.x * SPAN}
                    cy={HALF - dot.y * SPAN}
                    r={2.6}
                    fill={CREAM}
                    opacity={0.95 - 0.6 * (dot.order / freshDenom)}
                    onPress={() => router.push({ pathname: '/article/[id]', params: { id: dot.articleId } })}
                  />
                ) : null))}
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>
        <Text style={[s.quad, s.quadTop]}>HARD NEWS</Text>
        <Text style={[s.quad, s.quadBottom]}>OPINION</Text>
        <Text style={[s.quad, s.quadLeft]}>LEFT</Text>
        <Text style={[s.quad, s.quadRight]}>RIGHT</Text>
        {dots.length < 5 ? (
          <View style={s.emptyOverlay} pointerEvents="none">
            <Text style={s.emptyText}>Your map fills in as you read</Text>
          </View>
        ) : null}
      </View>

      {headline}
      <View style={s.foot}>
        <Text style={[s.stats, { color: c.textMuted }]}>
          <Text style={[s.statsStrong, { color: c.text }]}>{stats.reads}</Text> reads ·{' '}
          <Text style={[s.statsStrong, { color: c.text }]}>{stats.sources}</Text> sources
          {bothSides ? ' · both sides' : ''}
        </Text>
        <TouchableOpacity onPress={onShare} accessibilityLabel="Share your month">
          <Text style={s.share}>Share ↗</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  lock: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  panelWrap: { width: PANEL, height: PANEL, alignSelf: 'center', marginTop: 10 },
  zoomClip: { width: PANEL, height: PANEL, borderRadius: 14, overflow: 'hidden' },
  quad: {
    position: 'absolute', fontSize: 8, fontWeight: '800', letterSpacing: 1.6, color: '#8E8877',
  },
  quadTop: { top: 8, alignSelf: 'center' },
  quadBottom: { bottom: 8, alignSelf: 'center' },
  quadLeft: { left: 10, top: HALF - 5 },
  quadRight: { right: 10, top: HALF - 5 },
  emptyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#8E8877', fontSize: 12, fontWeight: '600' },
  insight: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 12 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  stats: { fontSize: 12 },
  statsStrong: { fontWeight: '800' },
  share: { fontSize: 12.5, fontWeight: '800', color: GREEN },
});
