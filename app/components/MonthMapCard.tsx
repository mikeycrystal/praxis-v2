import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
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
// articles becomes faint ember terrain (one Path, no touch targets), the
// fresh reads stay crisp and tappable on top. Ink only, no color coding:
// position already encodes lean, color would say it twice. The single
// newest read is the green "you are here" pin (his ask, msg 1714).
//
// Zoom is a viewBox window, NOT a view transform: scaling the rendered
// view magnifies a cached raster, so a merged blob stays the same blob,
// bigger and blurrier (review finding, 2026-09-19). Shrinking the viewBox
// re-renders the vectors each frame, and on gesture end the dot radii are
// re-rendered divided by the zoom so dots hold their screen size while
// positions spread — that separation is the point of zooming. Pinch also
// pans (the window follows the focal point), so there is no one-finger
// pan to fight the profile ScrollView; taps run through RNGH, not svg
// onPress, so double-tap can win over a dot tap.

const PANEL = 326;
const HALF = PANEL / 2;
const SPAN = 123; // dot field radius in px; coords are -1..1
const FRESH_COUNT = 150;
const ZOOM_MAX = 3;
const MIN_WIN = PANEL / ZOOM_MAX;
const TAP_TOLERANCE = 18; // screen px around a fresh dot that counts as a hit
// Slim rows (~5 small fields) make this ceiling cheap; at ~1.3k reads/month
// it leaves 3x headroom before the count clips again.
const EVENT_ROW_CAP = 4000;

const INK = '#2B2823';
const INK_LINE = '#454037';
const CREAM = '#EFE9DB';
const GREEN = '#7A9A62';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface MonthDot {
  articleId: string;
  x: number;
  y: number;
  order: number; // 0 = most recent; dots are stored newest-first
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

const dotCx = (dot: MonthDot) => HALF + dot.x * SPAN;
const dotCy = (dot: MonthDot) => HALF - dot.y * SPAN;

export function MonthMapCard() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [dots, setDots] = useState<MonthDot[]>([]);
  const [stats, setStats] = useState<MonthStats | null>(null);
  // Committed zoom, updated only at gesture end / reset — drives the radius
  // compensation re-render. The live window lives in shared values.
  const [renderScale, setRenderScale] = useState(1);

  // The visible window of the 0..PANEL svg space: top-left + size.
  const winX = useSharedValue(0);
  const winY = useSharedValue(0);
  const winW = useSharedValue(PANEL);

  // Gestures must not depend on React state (a dep teardown on pinch-end
  // was a review finding), so JS-side handlers read refs.
  const dotsRef = useRef<MonthDot[]>([]);
  useEffect(() => {
    dotsRef.current = dots;
  }, [dots]);

  const commitScale = useCallback((nextScale: number) => {
    setRenderScale(Math.min(ZOOM_MAX, Math.max(1, Math.round(nextScale * 100) / 100)));
  }, []);

  const openNearestDot = useCallback((svgX: number, svgY: number, tolerance: number) => {
    let best: MonthDot | null = null;
    let bestDist = tolerance;
    for (const dot of dotsRef.current) {
      if (dot.order >= FRESH_COUNT) break; // newest-first: embers start here
      const dist = Math.hypot(dotCx(dot) - svgX, dotCy(dot) - svgY);
      if (dist < bestDist) {
        best = dot;
        bestDist = dist;
      }
    }
    if (best) {
      router.push({ pathname: '/article/[id]', params: { id: best.articleId } });
    }
  }, []);

  const startWinX = useSharedValue(0);
  const startWinY = useSharedValue(0);
  const startWinW = useSharedValue(PANEL);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .onStart((event) => {
        startWinX.value = winX.value;
        startWinY.value = winY.value;
        startWinW.value = winW.value;
        startFocalX.value = event.focalX;
        startFocalY.value = event.focalY;
      })
      .onUpdate((event) => {
        const nextW = Math.min(PANEL, Math.max(MIN_WIN, startWinW.value / event.scale));
        // The svg point that sat under the starting focal stays under the
        // moving focal — zoom about the fingers, and focal drift pans.
        const anchorX = startWinX.value + (startFocalX.value / PANEL) * startWinW.value;
        const anchorY = startWinY.value + (startFocalY.value / PANEL) * startWinW.value;
        winW.value = nextW;
        winX.value = Math.min(PANEL - nextW, Math.max(0, anchorX - (event.focalX / PANEL) * nextW));
        winY.value = Math.min(PANEL - nextW, Math.max(0, anchorY - (event.focalY / PANEL) * nextW));
      })
      .onEnd(() => {
        runOnJS(commitScale)(PANEL / winW.value);
      }),
    [commitScale, startFocalX, startFocalY, startWinW, startWinX, startWinY, winW, winX, winY],
  );

  const doubleTapGesture = useMemo(
    () => Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(12)
      .onEnd((_event, success) => {
        if (!success) return;
        winW.value = withTiming(PANEL, { duration: 200 });
        winX.value = withTiming(0, { duration: 200 });
        winY.value = withTiming(0, { duration: 200 });
        runOnJS(commitScale)(1);
      }),
    [commitScale, winW, winX, winY],
  );

  const dotTapGesture = useMemo(
    () => Gesture.Tap()
      .maxDistance(12)
      .onEnd((event, success) => {
        if (!success) return;
        const svgX = winX.value + (event.x / PANEL) * winW.value;
        const svgY = winY.value + (event.y / PANEL) * winW.value;
        const tolerance = TAP_TOLERANCE * (winW.value / PANEL);
        runOnJS(openNearestDot)(svgX, svgY, tolerance);
      }),
    [openNearestDot, winW, winX, winY],
  );

  const panelGesture = useMemo(
    () => Gesture.Simultaneous(pinchGesture, Gesture.Exclusive(doubleTapGesture, dotTapGesture)),
    [dotTapGesture, doubleTapGesture, pinchGesture],
  );

  const animatedSvgProps = useAnimatedProps(() => ({
    viewBox: `${winX.value} ${winY.value} ${winW.value} ${winW.value}`,
  }));

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('analytics_events')
      .select(
        'aid:properties->>article_id, ax:properties->article_x, ay:properties->article_y, src:properties->>source, bias:properties->bias_score',
      )
      .eq('user_id', user.id)
      .eq('event_name', 'article_read_complete')
      .gte('created_at', monthStartIso())
      .order('created_at', { ascending: false })
      .limit(EVENT_ROW_CAP);
    if (error || !data) return;

    const byArticle = new Map<string, { x: number | null; y: number | null; source: string | null; bias: number | null }>();
    for (const row of data as Array<Record<string, unknown>>) {
      const id = typeof row.aid === 'string' ? row.aid : null;
      if (!id || byArticle.has(id)) continue; // rows are newest-first; keep latest
      byArticle.set(id, {
        x: typeof row.ax === 'number' ? row.ax : null,
        y: typeof row.ay === 'number' ? row.ay : null,
        source: typeof row.src === 'string' ? row.src : null,
        bias: typeof row.bias === 'number' ? row.bias : Number(row.bias) || null,
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
      return () => {
        // Leave the screen → leave the zoom; coming back to a zoomed,
        // scroll-fighting panel was a review finding.
        winW.value = PANEL;
        winX.value = 0;
        winY.value = 0;
        setRenderScale(1);
      };
    }, [load, winW, winX, winY]),
  );

  // order === index (dots are appended newest-first), so the layer split is
  // a plain slice. Embers collapse into ONE Path — ~1k identical circles as
  // separate SVG nodes was the card's dominant render cost.
  const freshDots = useMemo(() => dots.slice(0, FRESH_COUNT), [dots]);
  const emberPath = useMemo(() => {
    const r = 1.7 / renderScale;
    return dots
      .slice(FRESH_COUNT)
      .map((dot) => {
        const cx = dotCx(dot);
        const cy = dotCy(dot);
        return `M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
      })
      .join(' ');
  }, [dots, renderScale]);

  if (!user || !stats || stats.reads === 0) return null;

  const bothSides = stats.leftReads >= 2 && stats.rightReads >= 2;
  const headline = bothSides ? (
    <Text style={[s.insight, { color: c.text }]}>
      You read <Text style={{ color: GREEN }}>both sides</Text> this month.
    </Text>
  ) : (
    <Text style={[s.insight, { color: c.text }]}>Your month on the map.</Text>
  );

  const freshDenom = Math.max(freshDots.length - 1, 1);

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
            <AnimatedSvg width={PANEL} height={PANEL} animatedProps={animatedSvgProps}>
              <Rect x={0} y={0} width={PANEL} height={PANEL} rx={14} fill={INK} />
              <Line
                x1={HALF}
                y1={40}
                x2={HALF}
                y2={PANEL - 40}
                stroke={INK_LINE}
                strokeWidth={1 / renderScale}
              />
              <Line
                x1={40}
                y1={HALF}
                x2={PANEL - 40}
                y2={HALF}
                stroke={INK_LINE}
                strokeWidth={1 / renderScale}
              />
              <Circle cx={HALF} cy={HALF} r={2 / renderScale} fill="#5A5344" />
              {emberPath ? <Path d={emberPath} fill={CREAM} opacity={0.11} /> : null}
              {freshDots.map((dot) => (
                <Circle
                  key={dot.articleId}
                  cx={dotCx(dot)}
                  cy={dotCy(dot)}
                  r={(dot.order === 0 ? 3.4 : 2.6) / renderScale}
                  fill={dot.order === 0 ? GREEN : CREAM}
                  opacity={dot.order === 0 ? 1 : 0.95 - 0.6 * (dot.order / freshDenom)}
                />
              ))}
            </AnimatedSvg>
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
