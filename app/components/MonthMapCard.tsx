import { useCallback, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { trackGestureDebug } from '../lib/analytics';
import { supabase } from '../services/supabase';

// "Your month on the map" — the ink window (design locked 2026-09-19):
// white card chrome, the map itself a dark panel, cream dots, one dot per
// article read this month, opacity = recency, tap = open the article.
// Copy rule: the headline states what the reader DID; a lopsided month gets
// a neutral line, never a corrective one.
//
// Density ("embers + fresh", his pick 2026-09-19 msg 1710): at Ayuka's real
// volume (~1.3k reads/month) uniform dots merged into blobs. The month
// renders as two layers — everything older than the newest FRESH_COUNT
// articles is faint ember terrain (three density-bucketed Paths, no touch
// targets), the fresh reads stay crisp and tappable on top. Ink only, no
// color coding: position already encodes lean, color would say it twice.
// The single newest read is the green "you are here" pin (msg 1714).
//
// Zoom architecture (third pass — the two review rounds of 2026-09-19
// killed the first two):
// - A view-transform zoom magnifies a cached raster: blobs stay merged,
//   just bigger and blurrier. Dead end.
// - Animating the Svg root's viewBox via Reanimated animatedProps is a
//   silent no-op on native (viewBox only becomes the native minX/vbWidth
//   props inside Svg's React render), so that zoom never happened on
//   device. Dead end.
// So: no Reanimated in the render path at all. Gestures run on the JS
// thread (.runOnJS(true)) and commit the visible window (viewBox) through
// React state, throttled to ~15Hz — the same throttled-JS-commit pattern
// the Graph tab uses for live pinch feedback. Every committed frame
// renders radii divided by the zoom in the same render as the window, so
// dots hold their screen size while positions spread: clusters separate,
// which is the point. The zoom is anchored on the pinch's START point (the
// drift-pans-with-the-centroid model slid the map away on device, 9/20);
// a one-finger drag pans while zoomed; the host page is frozen from
// touch-down so its ScrollView can't cancel the pinch; double-tap resets;
// single tap opens the nearest fresh dot, ignored while a pinch is live.

const PANEL = 326;
const HALF = PANEL / 2;
const SPAN = 123; // dot field radius in px; coords are -1..1
const FRESH_COUNT = 150;
const ZOOM_MAX = 3;
const MIN_WIN = PANEL / ZOOM_MAX;
const COMMIT_MS = 66; // ~15Hz live-preview commits while pinching
const TAP_TOLERANCE = 12; // screen px around a fresh dot that counts as a hit
// PostgREST caps any single response at max_rows — 1000 in
// supabase/config.toml; keep PAGE_ROWS equal to it, the <PAGE_ROWS
// termination below assumes they match. Keyset pages on a COMPOUND
// (created_at, id) cursor rather than offsets: a clamped response can't
// misalign later pages, and rows tying a boundary timestamp (bulk
// backfills share one transaction now()) can't be dropped.
const PAGE_ROWS = 1000;
const MAX_PAGES = 4;

const INK = '#2B2823';
const INK_LINE = '#454037';
const CREAM = '#EFE9DB';
const GREEN = '#7A9A62';

interface ArticleRead {
  articleId: string;
  createdAt: string;
  rowId: string; // analytics_events.id (bigint, verified on the live table) — keyset tiebreaker
  x: number | null;
  y: number | null;
  source: string | null;
  bucket: string | null;
  url: string | null;
}

interface MonthDot {
  articleId: string;
  x: number;
  y: number;
  order: number; // 0 = most recent; dots are stored newest-first
  source: string | null;
  url: string | null;
}

// Compound watermark: strictly-after filtering on (created_at, id) means an
// idle focus returns 0 rows (no watermark-row echo) and a tie can't hide.
interface Watermark {
  createdAt: string;
  rowId: string;
}

interface MonthStats {
  reads: number;
  sources: number;
  leftReads: number;
  rightReads: number;
}

interface MapWindow {
  x: number;
  y: number;
  w: number;
}

const FULL_WINDOW: MapWindow = { x: 0, y: 0, w: PANEL };

// One deduped reads list for the CURRENT user+month (older entries are
// dropped on write), so a tap-to-article round trip refetches a 0–2 row
// delta instead of the whole month every focus (standing cost rule).
const monthCache = new Map<string, { watermark: Watermark; reads: ArticleRead[] }>();

const monthStartIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

const dotCx = (dot: { x: number }) => HALF + dot.x * SPAN;
const dotCy = (dot: { y: number }) => HALF - dot.y * SPAN;

// bias_bucket, not bias_score: the stored bucket is the canonical ±10
// split (deriveBiasBucket) — a re-derived threshold here drifted to ±15
// and could disagree with every other consumer (review finding).
const SLIM_SELECT =
  'id, created_at, aid:properties->>article_id, ax:properties->article_x, ay:properties->article_y, src:properties->>source, bucket:properties->>bias_bucket, url:properties->>url';

const rowToRead = (row: Record<string, unknown>): ArticleRead | null => {
  const id = typeof row.aid === 'string' ? row.aid : null;
  const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
  if (!id || !createdAt || row.id == null) return null;
  return {
    articleId: id,
    createdAt,
    rowId: String(row.id),
    x: typeof row.ax === 'number' ? row.ax : null,
    y: typeof row.ay === 'number' ? row.ay : null,
    source: typeof row.src === 'string' ? row.src : null,
    bucket: typeof row.bucket === 'string' ? row.bucket : null,
    url: typeof row.url === 'string' ? row.url : null,
  };
};

// PostgREST or() filter for "strictly after the watermark" on the
// compound (created_at, id) order. postgrest-js percent-encodes values.
const afterWatermark = (wm: Watermark) =>
  `created_at.gt.${wm.createdAt},and(created_at.eq.${wm.createdAt},id.gt.${wm.rowId})`;

// Newest-first dedup by article — both load paths must uphold this
// invariant (a re-read emits a second event for the same article).
const dedupeReads = (rows: ArticleRead[]): ArticleRead[] => {
  const byArticle = new Map<string, ArticleRead>();
  for (const read of rows) {
    if (!byArticle.has(read.articleId)) byArticle.set(read.articleId, read);
  }
  return [...byArticle.values()];
};

interface MonthMapCardProps {
  // Fires true when a pinch goes live and false when it ends, so the host
  // ScrollView can freeze (scrollEnabled=false) for the pinch's lifetime.
  // Ayuka 9/20 (msg 1867/1868): the profile page scrolled under his
  // fingers mid-pinch, so the zoom "jumped away" from where he pinched.
  onPinchActiveChange?: (active: boolean) => void;
}

export function MonthMapCard({ onPinchActiveChange }: MonthMapCardProps = {}) {
  const { user } = useAuth();
  const { c } = useTheme();
  const [dots, setDots] = useState<MonthDot[]>([]);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [win, setWin] = useState<MapWindow>(FULL_WINDOW);

  const scale = PANEL / win.w;

  const freshRef = useRef<MonthDot[]>([]);
  const emberRef = useRef<MonthDot[]>([]);
  const winRef = useRef<MapWindow>(FULL_WINDOW);
  const startRef = useRef({ ...FULL_WINDOW, fx: 0, fy: 0, scale: 1 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastCommitRef = useRef(0);
  const pinchRef = useRef({ active: false, endedAt: 0, updates: 0 });
  const panRef = useRef({ active: false });
  // Whether the host page is currently told to hold still (see the prop).
  const lockRef = useRef(false);
  const isZoomed = win.w < PANEL;
  const monthKeyRef = useRef('');
  const loadPromiseRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  // Monotonic token: a newer load (other account, month rollover) bumps it,
  // and a stale run must stop writing the cache or the UI when it settles.
  const loadTokenRef = useRef(0);

  const commitWindow = useCallback((next: MapWindow, force: boolean) => {
    winRef.current = next;
    const now = Date.now();
    if (force || now - lastCommitRef.current >= COMMIT_MS) {
      lastCommitRef.current = now;
      setWin(next);
    }
  }, []);

  const applyReads = useCallback((reads: ArticleRead[]) => {
    const nextDots: MonthDot[] = [];
    let order = 0;
    const sources = new Set<string>();
    let leftReads = 0;
    let rightReads = 0;
    for (const read of reads) {
      if (read.source) sources.add(read.source.toLowerCase());
      if (read.bucket === 'left') leftReads += 1;
      if (read.bucket === 'right') rightReads += 1;
      if (read.x != null && read.y != null) {
        nextDots.push({
          articleId: read.articleId,
          x: read.x,
          y: read.y,
          order: order++,
          source: read.source,
          url: read.url,
        });
      }
    }
    freshRef.current = nextDots.slice(0, FRESH_COUNT);
    emberRef.current = nextDots.slice(FRESH_COUNT);
    setDots(nextDots);
    setStats({ reads: reads.length, sources: sources.size, leftReads, rightReads });
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const monthStart = monthStartIso();
    const cacheKey = `${user.id}:${monthStart}`;
    // A focus while a load is running joins it instead of doubling the
    // request sequence (cost rule) or racing last-writer-wins on the cache
    // — but only a load for the SAME user+month; joining another account's
    // in-flight load would render their map into this one's view.
    if (loadPromiseRef.current?.key === cacheKey) return loadPromiseRef.current.promise;

    const token = ++loadTokenRef.current;
    const stale = () => loadTokenRef.current !== token;

    const run = (async () => {
      if (monthKeyRef.current && monthKeyRef.current !== cacheKey) {
        // Month rolled over (or user switched): a 3x window into last
        // month's corner makes no sense over the new, near-empty map.
        commitWindow(FULL_WINDOW, true);
      }
      monthKeyRef.current = cacheKey;

      const cached = monthCache.get(cacheKey);
      if (cached) {
        applyReads(cached.reads);
        // Delta: strictly after the compound watermark, so an idle focus
        // returns 0 rows — no watermark echo, no per-focus payload.
        const { data, error } = await supabase
          .from('analytics_events')
          .select(SLIM_SELECT)
          .eq('user_id', user.id)
          .eq('event_name', 'article_read_complete')
          .or(afterWatermark(cached.watermark))
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PAGE_ROWS);
        if (error || !data || data.length === 0 || stale()) return;
        if (data.length === PAGE_ROWS) {
          // A full delta page means something bulk-landed (backfill);
          // an unpaged merge would advance the watermark past rows it
          // never saw. Rebuild from scratch instead.
          monthCache.delete(cacheKey);
          if (loadPromiseRef.current?.key === cacheKey) loadPromiseRef.current = null;
          return load();
        }
        const rawNewest = data[0] as Record<string, unknown>;
        const fresh = dedupeReads(
          (data as Array<Record<string, unknown>>)
            .map(rowToRead)
            .filter((r): r is ArticleRead => r !== null),
        );
        const freshIds = new Set(fresh.map((r) => r.articleId));
        const merged = [...fresh, ...cached.reads.filter((r) => !freshIds.has(r.articleId))];
        const entry = {
          // Watermark comes from the raw newest row, valid or not —
          // otherwise a malformed newest row gets re-downloaded forever.
          watermark:
            typeof rawNewest.created_at === 'string' && rawNewest.id != null
              ? { createdAt: rawNewest.created_at, rowId: String(rawNewest.id) }
              : cached.watermark,
          reads: merged,
        };
        monthCache.clear();
        monthCache.set(cacheKey, entry);
        applyReads(merged);
        return;
      }

      // First load of the month: keyset-page past the max_rows response cap.
      // The cursor is compound (created_at, id) — created_at alone drops
      // every row tying the boundary timestamp, and a single-transaction
      // backfill gives thousands of rows the same now().
      const rows: ArticleRead[] = [];
      let watermark: Watermark | null = null;
      let cursor: Watermark | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        let query = supabase
          .from('analytics_events')
          .select(SLIM_SELECT)
          .eq('user_id', user.id)
          .eq('event_name', 'article_read_complete')
          .gte('created_at', monthStart)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PAGE_ROWS);
        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.rowId})`,
          );
        }
        const { data, error } = await query;
        if (error || !data || stale()) return;
        for (const raw of data as Array<Record<string, unknown>>) {
          if (!watermark && typeof raw.created_at === 'string' && raw.id != null) {
            watermark = { createdAt: raw.created_at, rowId: String(raw.id) };
          }
          const read = rowToRead(raw);
          if (read) rows.push(read);
        }
        if (data.length < PAGE_ROWS) break;
        const last = data[data.length - 1] as Record<string, unknown>;
        if (typeof last.created_at !== 'string' || last.id == null) break;
        cursor = { createdAt: last.created_at, rowId: String(last.id) };
      }
      if (stale()) return;
      const reads = dedupeReads(rows);
      monthCache.clear();
      // Cache the empty month too (sentinel watermark at month start), or
      // every focus re-runs the cold query for a card that renders null.
      monthCache.set(cacheKey, {
        watermark: watermark ?? { createdAt: monthStart, rowId: '0' },
        reads,
      });
      applyReads(reads);
    })();

    loadPromiseRef.current = { key: cacheKey, promise: run };
    try {
      await run;
    } finally {
      if (loadPromiseRef.current?.promise === run) loadPromiseRef.current = null;
    }
  }, [applyReads, commitWindow, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // No zoom reset on blur: tap-dot → article blurs this screen, and
      // coming back to the zoomed spot is the workflow. Double-tap resets;
      // month rollover resets inside load().
    }, [load]),
  );

  const openNearestDot = useCallback((tapX: number, tapY: number) => {
    // Taps mid-pinch (or right at pinch release) are gesture spill, not aim.
    if (pinchRef.current.active || Date.now() - pinchRef.current.endedAt < 200) return;
    const view = winRef.current;
    const svgX = view.x + (tapX / PANEL) * view.w;
    const svgY = view.y + (tapY / PANEL) * view.w;
    const tolerance = TAP_TOLERANCE * (view.w / PANEL);
    let best: MonthDot | null = null;
    let bestDist = tolerance;
    for (const dot of freshRef.current) {
      const dist = Math.hypot(dotCx(dot) - svgX, dotCy(dot) - svgY);
      if (dist < bestDist) {
        best = dot;
        bestDist = dist;
      }
    }
    if (!best) return;
    // Swallow the tap only when an ember is MEANINGFULLY closer than the
    // fresh hit (fresh dots draw on top of ember terrain, and in a dense
    // cluster some ember center is almost always marginally nearer) —
    // "meaningfully" = by more than the fresh dot's own drawn radius.
    const freshRadius = 2.6 * (view.w / PANEL);
    for (const ember of emberRef.current) {
      if (Math.hypot(dotCx(ember) - svgX, dotCy(ember) - svgY) < bestDist - freshRadius) return;
    }
    // No title param ON PURPOSE: [id].tsx's hydration gate keys on
    // params.title alone — passing it suppresses hydration entirely and a
    // live article rendered with no lede/image and a fabricated ts_pub
    // that Save persisted (review finding). Without title, hydration runs
    // wherever the recommender is configured, and url/publisher/x/y keep
    // "Read Original Article" and the map badge working when it isn't
    // (dev/preview builds, aged-out articles). 1.1 item: make [id].tsx
    // treat params as a fallback so both can be passed.
    router.push({
      pathname: '/article/[id]',
      params: {
        id: best.articleId,
        url: best.url ?? '',
        publisher_name: best.source ?? '',
        x: String(best.x),
        y: String(best.y),
      },
    });
  }, []);

  // Tell the host page to hold still (scrollEnabled=false) for the life of a
  // map gesture. Flipped on TOUCH-DOWN, not activation: the profile ScrollView
  // begins its own pan after ~10pt of travel, and once it does iOS cancels
  // our pinch mid-gesture — the "can't zoom out" of build 131 (Ayuka, msg
  // 1897). Locking at touch-down wins that race.
  const setPageLock = useCallback((on: boolean) => {
    if (lockRef.current === on) return;
    lockRef.current = on;
    onPinchActiveChange?.(on);
  }, [onPinchActiveChange]);

  const releasePageLockIfIdle = useCallback(() => {
    if (!pinchRef.current.active && !panRef.current.active) setPageLock(false);
  }, [setPageLock]);

  const panelGesture = useMemo(() => {
    const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onTouchesDown((event) => {
        if (event.numberOfTouches >= 2) setPageLock(true);
      })
      .onTouchesUp(releasePageLockIfIdle)
      .onTouchesCancelled(releasePageLockIfIdle)
      .onStart((event) => {
        pinchRef.current.active = true;
        pinchRef.current.updates = 0;
        setPageLock(true);
        const view = winRef.current;
        // The recognizer's scale is already a touch above 1 by the time iOS
        // reports the first Changed frame; ratios against it, not against 1.
        startRef.current = {
          ...view,
          fx: clamp(event.focalX, 0, PANEL),
          fy: clamp(event.focalY, 0, PANEL),
          scale: event.scale > 0 ? event.scale : 1,
        };
        trackGestureDebug('month_map', 'pinch_start', {
          fx: event.focalX,
          fy: event.focalY,
          scale: event.scale,
          touches: event.numberOfPointers,
          wx: view.x,
          wy: view.y,
          ww: view.w,
        });
      })
      .onUpdate((event) => {
        const start = startRef.current;
        const nextW = clamp(start.w / (event.scale / start.scale), MIN_WIN, PANEL);
        // Fixed anchor (build 131 → next): the svg point under the fingers at
        // pinch START stays put on screen. The previous "focal drift pans"
        // model followed the moving centroid, and on device that slid the map
        // away from the spot being pinched (Ayuka, msgs 1868/1874, video 1899).
        // Panning is the one-finger drag below instead.
        const anchorX = start.x + (start.fx / PANEL) * start.w;
        const anchorY = start.y + (start.fy / PANEL) * start.w;
        commitWindow(
          {
            x: clamp(anchorX - (start.fx / PANEL) * nextW, 0, PANEL - nextW),
            y: clamp(anchorY - (start.fy / PANEL) * nextW, 0, PANEL - nextW),
            w: nextW,
          },
          false,
        );
        pinchRef.current.updates += 1;
        if (pinchRef.current.updates === 1) {
          trackGestureDebug('month_map', 'pinch_first_update', {
            fx: event.focalX,
            fy: event.focalY,
            scale: event.scale,
            touches: event.numberOfPointers,
          });
        }
      })
      .onFinalize((event, success) => {
        pinchRef.current.active = false;
        pinchRef.current.endedAt = Date.now();
        commitWindow(winRef.current, true);
        releasePageLockIfIdle();
        trackGestureDebug('month_map', 'pinch_end', {
          success,
          fx: event.focalX,
          fy: event.focalY,
          scale: event.scale,
          updates: pinchRef.current.updates,
          wx: winRef.current.x,
          wy: winRef.current.y,
          ww: winRef.current.w,
        });
      });

    // One-finger pan, only while zoomed in: at full view the page keeps its
    // scroll (the gesture is disabled, so the ScrollView never sees a rival).
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(isZoomed)
      .maxPointers(1)
      .minDistance(3)
      .onTouchesDown(() => {
        if (winRef.current.w < PANEL) setPageLock(true);
      })
      .onTouchesUp(releasePageLockIfIdle)
      .onTouchesCancelled(releasePageLockIfIdle)
      .onStart(() => {
        if (winRef.current.w >= PANEL) return;
        panRef.current.active = true;
        setPageLock(true);
        panStartRef.current = { x: winRef.current.x, y: winRef.current.y };
      })
      .onUpdate((event) => {
        if (!panRef.current.active) return;
        const w = winRef.current.w;
        const k = w / PANEL; // screen px → svg units at the current zoom
        commitWindow(
          {
            x: clamp(panStartRef.current.x - event.translationX * k, 0, PANEL - w),
            y: clamp(panStartRef.current.y - event.translationY * k, 0, PANEL - w),
            w,
          },
          false,
        );
      })
      .onFinalize(() => {
        if (panRef.current.active) commitWindow(winRef.current, true);
        panRef.current.active = false;
        releasePageLockIfIdle();
      });

    const doubleTap = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDistance(12)
      .onEnd((_event, success) => {
        if (success) commitWindow(FULL_WINDOW, true);
      });

    const dotTap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(12)
      .onEnd((event, success) => {
        if (success) openNearestDot(event.x, event.y);
      });

    return Gesture.Simultaneous(
      pinch,
      Gesture.Race(pan, Gesture.Exclusive(doubleTap, dotTap)),
    );
  }, [commitWindow, isZoomed, openNearestDot, releasePageLockIfIdle, setPageLock]);

  // order === index (dots are appended newest-first), so the layer split is
  // a plain slice. Embers render as THREE Paths bucketed by local density —
  // one flat path washed out the cluster glow (single-pass fill), and ~1k
  // Circle nodes were the card's dominant render cost. Zero-length round-cap
  // segments make the dot size a strokeWidth scalar, so the d strings memo
  // on dots alone and never rebuild on zoom commits.
  const freshDots = useMemo(() => dots.slice(0, FRESH_COUNT), [dots]);
  const emberBuckets = useMemo(() => {
    const cellCounts = new Map<string, number>();
    const embers = dots.slice(FRESH_COUNT);
    const cellOf = (dot: MonthDot) =>
      `${Math.round(dotCx(dot) / 12)}:${Math.round(dotCy(dot) / 12)}`;
    for (const dot of embers) {
      const cell = cellOf(dot);
      cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + 1);
    }
    const buckets = ['', '', ''];
    for (const dot of embers) {
      const count = cellCounts.get(cellOf(dot)) ?? 1;
      const bucket = count >= 4 ? 2 : count >= 2 ? 1 : 0;
      buckets[bucket] += `M ${dotCx(dot).toFixed(1)} ${dotCy(dot).toFixed(1)} l 0.01 0 `;
    }
    return buckets;
  }, [dots]);

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
  const emberOpacity = [0.1, 0.2, 0.32];

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
            <Svg width={PANEL} height={PANEL} viewBox={`${win.x} ${win.y} ${win.w} ${win.w}`}>
              <Rect x={0} y={0} width={PANEL} height={PANEL} rx={14} fill={INK} />
              <Line
                x1={HALF}
                y1={40}
                x2={HALF}
                y2={PANEL - 40}
                stroke={INK_LINE}
                strokeWidth={1 / scale}
              />
              <Line
                x1={40}
                y1={HALF}
                x2={PANEL - 40}
                y2={HALF}
                stroke={INK_LINE}
                strokeWidth={1 / scale}
              />
              <Circle cx={HALF} cy={HALF} r={2 / scale} fill="#5A5344" />
              {emberBuckets.map((d, bucket) => (d ? (
                <Path
                  key={`ember-${bucket}`}
                  d={d}
                  stroke={CREAM}
                  strokeWidth={3.4 / scale}
                  strokeLinecap="round"
                  opacity={emberOpacity[bucket]}
                  fill="none"
                />
              ) : null))}
              {freshDots.map((dot) => (
                <Circle
                  key={dot.articleId}
                  cx={dotCx(dot)}
                  cy={dotCy(dot)}
                  r={(dot.order === 0 ? 3.4 : 2.6) / scale}
                  fill={dot.order === 0 ? GREEN : CREAM}
                  opacity={dot.order === 0 ? 1 : 0.95 - 0.6 * (dot.order / freshDenom)}
                />
              ))}
            </Svg>
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
        </Text>
        {/* Solid pill (Ayuka's pick A, 9/20): reads as a button, one accent.
            "both sides" left the stats line since the headline already says it. */}
        <TouchableOpacity
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share your month"
          activeOpacity={0.85}
          style={s.share}
        >
          <Ionicons name="share-outline" size={13} color="#FFFFFF" />
          <Text style={s.shareText}>Share</Text>
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
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  stats: { fontSize: 12 },
  statsStrong: { fontWeight: '800' },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  shareText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' },
});
