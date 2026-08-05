import {
  memo,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View, Text, Image, StyleSheet, SafeAreaView, ActivityIndicator,
  TouchableOpacity, Dimensions, Alert, InteractionManager, ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useNewsPreferences } from '../context/NewsPreferencesContext';
import {
  fetchLiveArticleById,
  useFeedArticles,
  type Article,
} from '../hooks/useFeedArticles';
import {
  buildFeedPreferenceSignature,
} from '../lib/newsPreferences';
import {
  mergeSavedArticles,
  readSavedArticles,
  removeSavedArticle,
  subscribeSavedArticles,
  upsertSavedArticle,
} from '../lib/savedArticles';
import {
  logArticleRead,
  readReadingActivitySummary,
  subscribeReadingActivity,
} from '../lib/readingActivity';
import { buildHref } from '../lib/buildHref';
import { openPublisherArticle } from '../lib/openPublisherArticle';
import { shareArticle as shareArticleFromPraxis } from '../lib/shareArticle';
import { supabase } from '../services/supabase';
import { ArticleCard, CARD_WIDTH, CARD_HEIGHT } from '../components/news-feed/ArticleCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_EXIT_DISTANCE = SCREEN_WIDTH * 1.05;
const ARTICLES_PER_PAGE = 20;
const STACK_RENDER_COUNT = 4;
const SWIPE_DIAGNOSTICS =
  __DEV__ && process.env.EXPO_PUBLIC_SWIPE_DIAGNOSTICS === 'true';
const FEED_COLORS = {
  ...Colors.light,
  background: '#F7F3EA',
  card: '#F7F3EA',
  surface: '#F5EFE1',
  text: '#22201C',
  textSecondary: '#4D4942',
  textMuted: '#7A766F',
  tint: '#8DAE73',
  tintForeground: '#FFFFFF',
  secondary: '#F0E9D8',
  border: '#E3DACA',
  icon: '#302D28',
  tabIconDefault: '#73706A',
};

const humanizeTopicLabel = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

type DeckCardProps = {
  article: Article;
  articleIndex: number;
  isActive: boolean;
  isSaved: boolean;
  visualIndex: SharedValue<number>;
  onSaveArticle: (articleId: number) => void;
  onShareArticle: (article: Article) => void;
  onReadArticle: (article: Article) => void;
  onFlipArticle: (articleId: number, isFlipped: boolean) => void;
};

const DeckCard = memo(function DeckCard({
  article,
  articleIndex,
  isActive,
  isSaved,
  visualIndex,
  onSaveArticle,
  onShareArticle,
  onReadArticle,
  onFlipArticle,
}: DeckCardProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const handleSave = useCallback(() => {
    onSaveArticle(article.id);
  }, [article.id, onSaveArticle]);

  const handleShare = useCallback(() => {
    onShareArticle(article);
  }, [article, onShareArticle]);

  const handleRead = useCallback(() => {
    onReadArticle(article);
  }, [article, onReadArticle]);

  const handleFlipChange = useCallback((isFlipped: boolean) => {
    if (isActiveRef.current) {
      onFlipArticle(article.id, isFlipped);
    }
  }, [article.id, onFlipArticle]);

  useEffect(() => {
    if (!SWIPE_DIAGNOSTICS) return;
    console.info('[SwipePerf] card mounted', {
      articleId: article.id,
      articleIndex,
      at: Date.now(),
    });

    return () => {
      console.info('[SwipePerf] card unmounted', {
        articleId: article.id,
        articleIndex,
        at: Date.now(),
      });
    };
  }, [article.id, articleIndex]);

  if (SWIPE_DIAGNOSTICS) {
    console.info('[SwipePerf] card render', {
      articleId: article.id,
      articleIndex,
      isActive,
      at: Date.now(),
    });
  }

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => {
    const diff = articleIndex - visualIndex.value;
    const stackX = interpolate(
      diff,
      [-1, 0, 1, 2, 3, 4],
      [-SWIPE_EXIT_DISTANCE, 0, 20, 40, 60, 80],
      Extrapolation.CLAMP,
    );
    const translateX = isActive && diff > 0
      ? interpolate(diff, [0, 1], [0, SWIPE_EXIT_DISTANCE], Extrapolation.CLAMP)
      : stackX;
    const rotate = isActive
      ? interpolate(
          translateX,
          [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          [-8, 0, 8],
          Extrapolation.CLAMP,
        )
      : 0;
    const scale = interpolate(
      diff,
      [-1, 0, 1, 2, 3, 4],
      [0.95, 1, 0.95, 0.9, 0.85, 0.8],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      diff,
      [-1, 0, 1, 2, 3, 4],
      [0, 1, 0.7, 0.4, 0.2, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [
        { translateX },
        { rotate: `${rotate}deg` as `${number}deg` },
        { scale },
      ],
    } as ViewStyle;
  });

  return (
    <Animated.View
      pointerEvents={isActive ? 'auto' : 'none'}
      // Older articles always stay above newer ones. This supports both swipe
      // directions without reordering native image/shadow layers at handoff.
      style={[s.deckCard, { zIndex: 10_000 - articleIndex }, animatedStyle]}
    >
      <ArticleCard
        article={article}
        // The wrapper exclusively owns pointer events. Keeping the heavy card
        // body active avoids rerendering its image/gradient tree at handoff.
        isActive
        isSaved={isSaved}
        onSave={handleSave}
        onShare={handleShare}
        onRead={handleRead}
        canSwipeRight={false}
        onFlipChange={handleFlipChange}
        isDigestCard={false}
      />
    </Animated.View>
  );
});

export default function FeedScreen() {
  const { isGuestMode, profile, user } = useAuth();
  const {
    preferences,
    applyTopNewsPreferences,
    syncQueryState,
    syncCustomizeState,
    syncTopNewsFallbackState,
    syncPersonalizedState,
  } = useNewsPreferences();
  const c = FEED_COLORS;
  const profileTopicsKey = profile?.topics?.join('|') ?? 'Technology';
  const profileTopics = useMemo(
    () => (profile?.topics?.length ? profile.topics : ['Technology']),
    [profileTopicsKey],
  );

  const {
    articles,
    isLoading: loading,
    isStreaming,
    isAllCaughtUp,
    feedMode,
    feedPreferenceSignature,
    streamError,
    hasCachedArticles,
    currentArticleIndex: externalIndex,
    setCurrentArticleIndex: setExternalIndex,
    setFeedContext,
    loadFromPreferences,
    requestMoreArticles,
    clearStreamError,
  } = useFeedArticles();
  const [displayIndex, setDisplayIndex] = useState(externalIndex);
  const displayIndexRef = useRef(externalIndex);
  const scheduledIndexRef = useRef<{
    from: number;
    to: number;
    scheduledAt: number;
  } | null>(null);
  const index = displayIndex;
  const setCurrentIndex = useCallback((nextIndex: number) => {
    const fromIndex = displayIndexRef.current;
    if (SWIPE_DIAGNOSTICS) {
      scheduledIndexRef.current = {
        from: fromIndex,
        to: nextIndex,
        scheduledAt: Date.now(),
      };
      console.info('[SwipePerf] React index scheduled', {
        from: fromIndex,
        to: nextIndex,
        at: Date.now(),
      });
    }
    displayIndexRef.current = nextIndex;
    setDisplayIndex(nextIndex);
    setExternalIndex(nextIndex);
  }, [setExternalIndex]);

  useLayoutEffect(() => {
    if (!SWIPE_DIAGNOSTICS) return;
    const scheduled = scheduledIndexRef.current;
    if (!scheduled || scheduled.to !== displayIndex) return;

    const committedAt = Date.now();
    console.info('[SwipePerf] React index committed', {
      from: scheduled.from,
      to: scheduled.to,
      scheduledAt: scheduled.scheduledAt,
      committedAt,
      commitDelayMs: committedAt - scheduled.scheduledAt,
    });
    scheduledIndexRef.current = null;
  }, [displayIndex]);
  const [loadedArticlesCount, setLoadedArticlesCount] = useState(() => {
    if (articles.length === 0) {
      return ARTICLES_PER_PAGE;
    }

    const targetVisibleCount = Math.max(
      ARTICLES_PER_PAGE,
      index + STACK_RENDER_COUNT + 1,
    );

    return Math.min(
      Math.ceil(targetVisibleCount / ARTICLES_PER_PAGE) * ARTICLES_PER_PAGE,
      articles.length,
    );
  });
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [flippedArticleId, setFlippedArticleId] = useState<number | null>(null);
  const [localStreakCount, setLocalStreakCount] = useState(0);
  const visualIndex = useSharedValue(externalIndex);
  const queuedReadIdsRef = useRef<Set<number>>(new Set());
  const lastHandledRequestNonceRef = useRef<number | null>(null);
  const activeQuery = preferences.activeQuery;
  const hasCustomQuery = Boolean(
    activeQuery && (activeQuery.topics.length > 0 || activeQuery.promptTerms.length > 0),
  );
  const expectedFeedMode = useMemo(() => {
    if (preferences.isTopNewsActive) return 'top-news';
    if (preferences.recommendationRequest) return 'query';
    return 'personalized';
  }, [preferences.isTopNewsActive, preferences.recommendationRequest]);
  const expectedPreferenceSignature = useMemo(() => buildFeedPreferenceSignature({
    activeQuery: preferences.activeQuery,
    recommendationRequest: preferences.recommendationRequest,
    topNewsGraphFilter: preferences.topNewsGraphFilter,
    isTopNewsActive: preferences.isTopNewsActive,
    profileTopics,
  }), [
    preferences.activeQuery,
    preferences.isTopNewsActive,
    preferences.recommendationRequest,
    preferences.topNewsGraphFilter,
    profileTopics,
  ]);

  useEffect(() => {
    if (externalIndex === displayIndexRef.current) return;
    displayIndexRef.current = externalIndex;
    setDisplayIndex(externalIndex);
    cancelAnimation(visualIndex);
    visualIndex.value = externalIndex;
  }, [externalIndex, visualIndex]);

  const getCustomQueryDisplay = useCallback(() => {
    if (!activeQuery) return '';
    const allTerms = [
      ...activeQuery.topics.map(humanizeTopicLabel),
      ...activeQuery.promptTerms,
    ];
    if (allTerms.length <= 2) {
      return allTerms.join(' · ');
    }
    return `${allTerms.slice(0, 2).join(' · ')} +${allTerms.length - 2}`;
  }, [activeQuery]);

  const fetchSaved = useCallback(async () => {
    const localSaved = await readSavedArticles(user?.id);
    const localIds = new Set<number>(localSaved.map((article) => article.id));
    setSavedIds(localIds);
    setSavedCount(localIds.size);

    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_articles')
        .select('article_id, saved_at')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      const localById = new Map(localSaved.map((article) => [article.id, article]));
      const hydratedRows = await Promise.all((data ?? []).map(async (row: any) => {
        const localArticle = localById.get(Number(row.article_id));
        if (localArticle?.url) {
          return { ...localArticle, saved_at: row.saved_at };
        }

        const liveArticle = await fetchLiveArticleById(Number(row.article_id));
        return liveArticle
          ? { ...liveArticle, saved_at: row.saved_at }
          : { id: row.article_id, saved_at: row.saved_at };
      }));

      const merged = await mergeSavedArticles(
        user.id,
        hydratedRows,
      );

      const nextIds = new Set<number>(merged.map((article) => article.id));
      setSavedIds(nextIds);
      setSavedCount(nextIds.size);
    } catch (error) {
      console.warn('[FeedScreen] Failed to refresh saved articles from remote', error);
    }
  }, [user]);

  useEffect(() => {
    const hasExplicitNewRequest =
      preferences.requestNonce > 0 &&
      preferences.requestNonce !== lastHandledRequestNonceRef.current;
    const shouldHydrateInitialFeed = !hasCachedArticles;
    const shouldReconcileCachedFeed =
      hasCachedArticles && (
        feedMode !== expectedFeedMode ||
        feedPreferenceSignature !== expectedPreferenceSignature
      );

    if (!hasExplicitNewRequest && !shouldHydrateInitialFeed && !shouldReconcileCachedFeed) {
      return;
    }

    if (hasExplicitNewRequest) {
      lastHandledRequestNonceRef.current = preferences.requestNonce;
    }

    void loadFromPreferences({
      activeQuery: preferences.activeQuery,
      recommendationRequest: preferences.recommendationRequest,
      prefetchedQueryArticles: preferences.prefetchedQueryArticles as Article[] | null,
      isTopNewsActive: preferences.isTopNewsActive,
      topNewsGraphFilter: preferences.topNewsGraphFilter,
      profileTopics,
    });
  }, [
    hasCachedArticles,
    loadFromPreferences,
    preferences.activeQuery,
    preferences.isTopNewsActive,
    preferences.prefetchedQueryArticles,
    preferences.recommendationRequest,
    preferences.requestNonce,
    preferences.topNewsGraphFilter,
    profileTopics,
    feedMode,
    feedPreferenceSignature,
    expectedFeedMode,
    expectedPreferenceSignature,
  ]);

  useEffect(() => {
    if (preferences.requestNonce <= 0) {
      return;
    }

    cancelAnimation(visualIndex);
    visualIndex.value = 0;
    displayIndexRef.current = 0;
    setDisplayIndex(0);

    setLoadedArticlesCount(ARTICLES_PER_PAGE);
    setFlippedArticleId(null);
  }, [preferences.requestNonce, visualIndex]);

  useEffect(() => {
    if (!streamError) return;

    if (feedMode === 'top-news' && !preferences.isTopNewsActive) {
      syncTopNewsFallbackState(null);
    }

    const fallbackMessage =
      feedMode === 'top-news'
        ? 'Showing Top News instead.'
        : 'Showing backup stories for now.';

    Alert.alert(
      'Recommendations unavailable',
      fallbackMessage,
      [{ text: 'OK', onPress: clearStreamError }],
    );
  }, [
    clearStreamError,
    feedMode,
    preferences.isTopNewsActive,
    streamError,
    syncTopNewsFallbackState,
  ]);

  useEffect(() => {
    if (
      feedMode === 'query' &&
      preferences.isTopNewsActive &&
      preferences.activeQuery &&
      preferences.recommendationRequest
    ) {
      syncQueryState({
        activeQuery: preferences.activeQuery,
        recommendationRequest: preferences.recommendationRequest,
        prefetchedArticles: preferences.prefetchedQueryArticles as Article[] | null,
      });
    }
  }, [
    feedMode,
    preferences.activeQuery,
    preferences.isTopNewsActive,
    preferences.prefetchedQueryArticles,
    preferences.recommendationRequest,
    syncQueryState,
  ]);

  useEffect(() => {
    if (
      feedMode === 'personalized' &&
      !preferences.isTopNewsActive &&
      preferences.activeQuery &&
      !preferences.recommendationRequest
    ) {
      syncPersonalizedState();
    }
  }, [
    feedMode,
    preferences.activeQuery,
    preferences.isTopNewsActive,
    preferences.recommendationRequest,
    syncPersonalizedState,
  ]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  useEffect(() => {
    const unsubscribe = subscribeSavedArticles(user?.id, (articles) => {
      const nextIds = new Set<number>(articles.map((article) => article.id));
      setSavedIds(nextIds);
      setSavedCount(nextIds.size);
    });

    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    let isActive = true;

    void readReadingActivitySummary(user?.id).then((summary) => {
      if (!isActive) return;
      setLocalStreakCount(summary.currentStreak);
    });

    const unsubscribe = subscribeReadingActivity(user?.id, (summary) => {
      setLocalStreakCount(summary.currentStreak);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    setLoadedArticlesCount((prev) => {
      let nextCount = prev;

      if (articles.length === 0) {
        nextCount = ARTICLES_PER_PAGE;
      } else if (articles.length < prev) {
        nextCount = Math.min(ARTICLES_PER_PAGE, articles.length);
      } else {
        nextCount = Math.min(prev, articles.length);
        if (nextCount === 0) {
          nextCount = Math.min(ARTICLES_PER_PAGE, articles.length);
        }
      }
      return nextCount;
    });
  }, [articles.length]);

  useEffect(() => {
    if (articles.length === 0) {
      setCurrentIndex(0);
      return;
    }

    if (index > articles.length - 1) {
      setCurrentIndex(articles.length - 1);
    }
  }, [articles.length, index, setCurrentIndex]);

  useEffect(() => {
    if (articles.length === 0) return;

    if (loadedArticlesCount > index) return;

    const targetVisibleCount = Math.max(
      ARTICLES_PER_PAGE,
      index + STACK_RENDER_COUNT + 1,
    );

    setLoadedArticlesCount(
      Math.min(
        Math.ceil(targetVisibleCount / ARTICLES_PER_PAGE) * ARTICLES_PER_PAGE,
        articles.length,
      ),
    );
  }, [articles.length, index, loadedArticlesCount]);

  const maxAvailableArticles = Math.min(loadedArticlesCount, articles.length);
  const safeIndex = maxAvailableArticles > 0
    ? Math.max(0, Math.min(index, maxAvailableArticles - 1))
    : 0;

  useEffect(() => {
    if (typeof Image.prefetch !== 'function') return;

    const prefetched = articles
      .slice(0, maxAvailableArticles)
      .map((article) => article.image_url)
      .filter((value): value is string => Boolean(value));

    if (SWIPE_DIAGNOSTICS) {
      console.info('[SwipePerf] prefetch window', {
        start: 0,
        end: maxAvailableArticles,
        count: prefetched.length,
        at: Date.now(),
      });
    }

    prefetched.forEach((uri) => {
      void Image.prefetch(uri).catch(() => {});
    });
  }, [articles, maxAvailableArticles]);

  const reloadFeed = useCallback(() => loadFromPreferences({
    activeQuery: preferences.activeQuery,
    recommendationRequest: preferences.recommendationRequest,
    prefetchedQueryArticles: preferences.prefetchedQueryArticles as Article[] | null,
    isTopNewsActive: preferences.isTopNewsActive,
    topNewsGraphFilter: preferences.topNewsGraphFilter,
    profileTopics,
  }), [
    loadFromPreferences,
    preferences.activeQuery,
    preferences.isTopNewsActive,
    preferences.prefetchedQueryArticles,
    preferences.recommendationRequest,
    preferences.topNewsGraphFilter,
    profileTopics,
  ]);

  const handleToggleTopNews = useCallback(() => {
    if (!preferences.isTopNewsActive) {
      applyTopNewsPreferences(null);
      return;
    }

    const personalizedSignature = buildFeedPreferenceSignature({
      activeQuery: null,
      recommendationRequest: null,
      topNewsGraphFilter: null,
      isTopNewsActive: false,
      profileTopics,
    });

    syncCustomizeState();
    setFeedContext('personalized', personalizedSignature);
  }, [
    applyTopNewsPreferences,
    preferences.isTopNewsActive,
    profileTopics,
    setFeedContext,
    syncCustomizeState,
  ]);

  const handleEditQuery = useCallback(() => {
    router.navigate('/graph');
  }, []);

  const markRead = useCallback((article: Article) => {
    void logArticleRead(user?.id, {
      id: article.id,
      topics: article.topics,
      title: article.title,
    });

    if (!user) return;
    if (queuedReadIdsRef.current.has(article.id)) return;

    queuedReadIdsRef.current.add(article.id);

    void (async () => {
      try {
        const { error } = await supabase.from('read_articles').insert({
          user_id: user.id,
          article_id: article.id,
          read_at: new Date().toISOString(),
        });

        if (error) {
          if ((error as { code?: string }).code === '23505') {
            return;
          }
          throw error;
        }

        void Promise.allSettled([
          supabase.rpc('increment_articles_read', { uid: user.id }),
          supabase.rpc('update_reading_streak', { uid: user.id }),
        ]);

        void supabase.from('analytics_events').insert({
          user_id: user.id,
          event_name: 'article_view',
          properties: { article_id: article.id },
        }).then(({ error: analyticsError }) => {
          if (analyticsError) {
            console.warn('[FeedScreen] Failed to track article view', analyticsError);
          }
        });

        void supabase.functions.invoke('award-badge', { body: { userId: user.id } }).catch((badgeError) => {
          console.warn('[FeedScreen] Failed to check badges after read', badgeError);
        });
      } catch (error) {
        queuedReadIdsRef.current.delete(article.id);
        console.warn('[FeedScreen] Failed to mark article read', error);
      }
    })();
  }, [user]);

  const toggleSave = useCallback(async (articleId: number) => {
    const isSaved = savedIds.has(articleId);
    const article = articles.find((item) => item.id === articleId);
    if (!article) return;

    if (isSaved) {
      await removeSavedArticle(user?.id, articleId);
    } else {
      await upsertSavedArticle(user?.id, {
        id: article.id,
        title: article.title,
        lede: article.lede,
        image_url: article.image_url,
        url: article.url,
        ts_pub: article.ts_pub,
        publisher: article.publisher ?? null,
        x: article.x,
        y: article.y,
        category: article.category,
        topics: article.topics,
        meta: article.meta,
      });
    }

    try {
      if (!user) return;

      if (isSaved) {
        const { error } = await supabase.from('saved_articles').delete()
          .eq('user_id', user.id)
          .eq('article_id', articleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_articles')
          .insert({ user_id: user.id, article_id: articleId });
        if (error && (error as { code?: string }).code !== '23505') {
          throw error;
        }
      }
    } catch (error) {
      console.warn('[FeedScreen] Remote bookmark sync failed; kept local bookmark state', error);
    }
  }, [articles, savedIds, user]);

  const shareArticle = useCallback(async (article: Article) => {
    await shareArticleFromPraxis({
      title: article.title,
      lede: article.meta?.summary || article.lede,
      url: article.url,
      publisher: article.publisher,
    });
  }, []);

  const loadingMore = isStreaming && !loading;

  useEffect(() => {
    const remainingInBatch = loadedArticlesCount - safeIndex;
    const hasMoreLoadedArticles = articles.length > loadedArticlesCount;
    const isNearVisibleEnd = remainingInBatch <= 5;

    if (isNearVisibleEnd && hasMoreLoadedArticles && !loadingMore) {
      setLoadedArticlesCount((prev) => {
        return Math.min(prev + ARTICLES_PER_PAGE, articles.length);
      });
    }

    const remainingTotal = articles.length - safeIndex;
    if (
      feedMode === 'query' &&
      remainingTotal <= 3 &&
      !loadingMore &&
      !loading &&
      !isAllCaughtUp
    ) {
      void requestMoreArticles();
    }
  }, [
    articles.length,
    feedMode,
    isAllCaughtUp,
    loadedArticlesCount,
    loading,
    loadingMore,
    requestMoreArticles,
    safeIndex,
  ]);

  const advance = useCallback((article: Article) => {
    const nextIndex = index + 1;

    if (nextIndex >= loadedArticlesCount && articles.length > loadedArticlesCount) {
      setLoadedArticlesCount((prev) =>
        Math.min(prev + ARTICLES_PER_PAGE, articles.length),
      );
    }

    setCurrentIndex(nextIndex);
    InteractionManager.runAfterInteractions(() => {
      markRead(article);
    });
  }, [articles.length, index, loadedArticlesCount, markRead, setCurrentIndex]);

  const retreat = useCallback(() => {
    setCurrentIndex(Math.max(0, index - 1));
  }, [index, setCurrentIndex]);

  // Safely access articles with null checks
  let current: Article | undefined;

  try {
    const visibleArticles = articles.slice(0, maxAvailableArticles);
    if (visibleArticles.length > 0) {
      current = visibleArticles[safeIndex] || undefined;
    }
  } catch (e) {
    console.error('[FeedScreen] Error accessing articles array:', e, { index, articlesLength: articles?.length });
  }

  useEffect(() => {
    setFlippedArticleId(null);
  }, [current?.id]);

  const canSwipeLeft = safeIndex < maxAvailableArticles - 1;
  const canSwipeRight = safeIndex > 0;
  const remainingVisibleCards = maxAvailableArticles - safeIndex - 1;
  const showLoadingMoreIndicator =
    Boolean(current) &&
    loadingMore &&
    maxAvailableArticles > 0 &&
    maxAvailableArticles - safeIndex <= 5;
  const showAllCaughtUpIndicator =
    Boolean(current) &&
    isAllCaughtUp &&
    safeIndex > 0 &&
    remainingVisibleCards === 0;
  const finishSwipeLeft = useCallback(() => {
    if (current) advance(current);
  }, [advance, current]);

  const finishSwipeRight = useCallback(() => {
    retreat();
  }, [retreat]);

  const handleReadArticle = useCallback((article: Article) => {
    markRead(article);
    void openPublisherArticle(article.url).catch(() => {
      Alert.alert(
        'Article unavailable',
        'We could not open the publisher article right now.',
      );
    });
  }, [markRead]);

  const handleFlipArticle = useCallback((articleId: number, isFlipped: boolean) => {
    setFlippedArticleId(isFlipped ? articleId : null);
  }, []);

  const logSwipeEvent = useCallback((
    phase: 'release' | 'animation-complete',
    fromIndex: number,
    toIndex: number,
  ) => {
    if (!SWIPE_DIAGNOSTICS) return;
    console.info(`[SwipePerf] ${phase}`, {
      from: fromIndex,
      to: toIndex,
      at: Date.now(),
    });
  }, []);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .enabled(flippedArticleId !== current?.id)
      .activeOffsetX([-12, 12])
      .failOffsetY([-22, 22])
      .onBegin(() => {
        cancelAnimation(visualIndex);
      })
      .onUpdate((event) => {
        const blocked =
          (event.translationX < 0 && !canSwipeLeft) ||
          (event.translationX > 0 && !canSwipeRight);
        const translation = blocked ? event.translationX * 0.2 : event.translationX;
        visualIndex.value = index - translation / SWIPE_EXIT_DISTANCE;
      })
      .onEnd((event) => {
        const distance = Math.abs(event.translationX);
        const velocityCommit = Math.abs(event.velocityX) > 380 && distance > 38;
        const shouldCommit = velocityCommit || distance > 76;
        const springConfig = {
          damping: 20,
          stiffness: 240,
          mass: 0.72,
          overshootClamping: true,
        };

        if (shouldCommit && event.translationX < 0 && canSwipeLeft) {
          const targetIndex = index + 1;
          const remaining = Math.abs(targetIndex - visualIndex.value);
          runOnJS(logSwipeEvent)('release', index, targetIndex);
          visualIndex.value = withTiming(
            targetIndex,
            {
              duration: Math.max(120, Math.round(280 * remaining)),
              easing: Easing.out(Easing.cubic),
            },
            (finished) => {
              if (finished) {
                runOnJS(logSwipeEvent)('animation-complete', index, targetIndex);
                runOnJS(finishSwipeLeft)();
              }
            },
          );
          return;
        }

        if (shouldCommit && event.translationX > 0 && canSwipeRight) {
          const targetIndex = index - 1;
          const remaining = Math.abs(targetIndex - visualIndex.value);
          runOnJS(logSwipeEvent)('release', index, targetIndex);
          visualIndex.value = withTiming(
            targetIndex,
            {
              duration: Math.max(120, Math.round(280 * remaining)),
              easing: Easing.out(Easing.cubic),
            },
            (finished) => {
              if (finished) {
                runOnJS(logSwipeEvent)('animation-complete', index, targetIndex);
                runOnJS(finishSwipeRight)();
              }
            },
          );
          return;
        }

        visualIndex.value = withSpring(index, springConfig);
      }),
    [
      canSwipeLeft,
      canSwipeRight,
      current?.id,
      finishSwipeLeft,
      finishSwipeRight,
      flippedArticleId,
      index,
      logSwipeEvent,
      visualIndex,
    ],
  );

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <View style={s.headerLeft}>
          {isGuestMode || !user ? (
            <Link href={buildHref('/login', { returnTo: '/' })} asChild>
              <TouchableOpacity style={s.signInBtn} accessibilityRole="link">
                <Text style={[s.signInText, { color: c.text }]}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => router.push('/profile')}
                style={s.headerBtn}
              >
                <Ionicons name="person-outline" size={20} color={c.icon} />
              </TouchableOpacity>
              <View style={[s.streakPill, { backgroundColor: '#E9EDD8', borderColor: '#D9DEC5' }]}>
                <Ionicons name="flame-outline" size={15} color="#8DAE73" />
                <Text style={s.streakText}>{Math.max(profile?.reading_streak ?? 0, localStreakCount)}</Text>
              </View>
            </>
          )}
        </View>

        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>Praxis</Text>
        </View>

        <View style={s.headerRight}>
          {isGuestMode || !user ? (
            <Link href={buildHref('/login', { returnTo: '/saved' })} asChild>
              <TouchableOpacity
                style={s.headerBtn}
                accessibilityRole="link"
                accessibilityLabel="Sign in to view saved articles"
              >
                <Ionicons name="bookmark-outline" size={18} color={c.icon} />
                {savedCount > 0 && (
                  <View style={[s.badge, { backgroundColor: c.tint }]}>
                    <Text style={s.badgeText}>{savedCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Link>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('saved' as any)}
              style={s.headerBtn}
            >
              <Ionicons name="bookmark-outline" size={18} color={c.icon} />
              {savedCount > 0 && (
                <View style={[s.badge, { backgroundColor: c.tint }]}>
                  <Text style={s.badgeText}>{savedCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/search')}
            style={s.headerBtn}
          >
            <Ionicons name="search-outline" size={18} color={c.icon} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.topNewsRow}>
        <TouchableOpacity
          onPress={handleToggleTopNews}
          accessibilityRole="button"
          accessibilityLabel="Toggle Top News"
          testID="feed-top-news-toggle"
          style={[
            s.headerPill,
            preferences.isTopNewsActive
              ? { backgroundColor: '#F9E6D6', borderColor: '#EDC9AE' }
              : { backgroundColor: c.secondary, borderColor: c.border },
          ]}
        >
          <Ionicons
            name={preferences.isTopNewsActive ? 'flame-outline' : 'sparkles-outline'}
            size={13}
            color={preferences.isTopNewsActive ? '#E48439' : c.textMuted}
          />
          <Text
            style={[
              s.headerPillText,
              { color: preferences.isTopNewsActive ? c.textSecondary : c.textMuted },
            ]}
          >
            Top News
          </Text>
        </TouchableOpacity>
        {!preferences.isTopNewsActive && hasCustomQuery ? (
          <TouchableOpacity
            onPress={handleEditQuery}
            accessibilityRole="button"
            accessibilityLabel="Edit custom query"
            testID="feed-query-pill"
            style={[s.queryPill, { backgroundColor: '#E8EFDB', borderColor: '#C8D8B0' }]}
          >
            <Ionicons name="sparkles-outline" size={13} color={c.tint} />
            <Text style={[s.queryPillText, { color: c.textSecondary }]} numberOfLines={1}>
              {getCustomQueryDisplay()}
            </Text>
            <Ionicons name="pencil-outline" size={12} color={c.textMuted} />
          </TouchableOpacity>
        ) : !preferences.isTopNewsActive ? (
          <TouchableOpacity
            onPress={handleEditQuery}
            accessibilityRole="button"
            accessibilityLabel="Customize feed"
            testID="feed-customize-pill"
            style={[s.queryPill, { backgroundColor: c.secondary, borderColor: c.border }]}
          >
            <Ionicons name="sparkles-outline" size={13} color={c.textMuted} />
            <Text style={[s.queryPillText, { color: c.textMuted }]} numberOfLines={1}>
              Customize
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!current && (loading || isStreaming) ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={c.tint} />
          <Text style={[s.emptyTitle, { color: c.text }]}>Finding articles</Text>
          <Text style={[s.emptyBody, { color: c.textSecondary }]}>
            Loading the next stories for this feed.
          </Text>
        </View>
      ) : !current ? (
        <View style={s.empty}>
          <View style={[s.emptyBadge, { backgroundColor: c.secondary, borderColor: c.border }]}>
            <Ionicons name="checkmark-done-outline" size={18} color={c.tint} />
            <Text style={[s.emptyBadgeText, { color: c.textSecondary }]}>
              {isAllCaughtUp ? 'Daily brief complete' : 'Feed paused'}
            </Text>
          </View>
          <Text style={[s.emptyTitle, { color: c.text }]}>
            {isAllCaughtUp ? "You're all caught up" : 'No story is ready right now'}
          </Text>
          <Text style={[s.emptyBody, { color: c.textSecondary }]}>
            {isAllCaughtUp
              ? 'Check your topics or come back later for more.'
              : 'Try refreshing the feed while we stabilize the next batch.'}
          </Text>
          <TouchableOpacity
            style={[s.refreshBtn, { backgroundColor: c.tint }]}
            onPress={reloadFeed}
          >
            <Text style={[s.refreshBtnText, { color: c.tintForeground }]}>Refresh Feed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.cardStack}>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View style={s.deckFrame}>
              {articles
                .slice(0, maxAvailableArticles)
                .map((article, articleIndex) => {
                  const isActive = articleIndex === safeIndex;

                  return (
                    <DeckCard
                      key={article.id}
                      article={article}
                      articleIndex={articleIndex}
                      isActive={isActive}
                      isSaved={savedIds.has(article.id)}
                      visualIndex={visualIndex}
                      onSaveArticle={toggleSave}
                      onShareArticle={shareArticle}
                      onReadArticle={handleReadArticle}
                      onFlipArticle={handleFlipArticle}
                    />
                  );
                })}
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      {/* Progress dots */}
      {maxAvailableArticles > 0 && current && (
        <View style={s.dotsRow}>
          {(() => {
            try {
              if (!Array.isArray(articles) || maxAvailableArticles === 0) {
                console.warn('[FeedScreen] Articles array invalid for dots:', { isArray: Array.isArray(articles), length: articles?.length });
                return null;
              }
              const visibleArticles = articles.slice(0, maxAvailableArticles);
              const startIdx = Math.max(0, safeIndex - 2);
              const endIdx = Math.min(visibleArticles.length, safeIndex + 5);
              const dotArticles = visibleArticles.slice(startIdx, endIdx);

              if (!Array.isArray(dotArticles)) {
                console.error('[FeedScreen] Slice result is not an array');
                return null;
              }

              return dotArticles.map((article, i) => {
                if (!article) {
                  console.warn('[FeedScreen] Article at index is null:', { i, startIdx });
                  return null;
                }
                const isActive = startIdx + i === safeIndex;
                return (
                  <View
                    key={`dot-${i}`}
                    style={[s.dot, {
                      backgroundColor: isActive ? c.tint : c.border,
                      width: isActive ? 20 : 6,
                    }]}
                  />
                );
              });
            } catch (e) {
              console.error('[FeedScreen] Error rendering progress dots:', e, { index, articlesLength: articles?.length });
              return null;
            }
          })()}
        </View>
      )}

      {showLoadingMoreIndicator ? (
        <View style={[s.feedStatusPill, { backgroundColor: 'rgba(247,243,234,0.96)', borderColor: c.border }]}>
          <ActivityIndicator size="small" color={c.tint} />
          <Text style={[s.feedStatusText, { color: c.textSecondary }]}>
            Loading more articles...
          </Text>
        </View>
      ) : null}

      {showAllCaughtUpIndicator ? (
        <View style={[s.feedStatusPill, { backgroundColor: 'rgba(247,243,234,0.96)', borderColor: c.border }]}>
          <Ionicons name="checkmark-done-outline" size={16} color={c.tint} />
          <Text style={[s.feedStatusText, { color: c.textSecondary }]}>
            You're all caught up
          </Text>
        </View>
      ) : null}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 92 },
  headerCenter: { alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  signInBtn: {
    minHeight: 38,
    justifyContent: 'center',
    paddingRight: 8,
  },
  signInText: {
    fontSize: 15,
    fontWeight: '500',
  },
  streakPill: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: { color: '#5F6A4F', fontSize: 14, fontWeight: '700' },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
  },
  headerPillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2, color: '#B7652F' },
  queryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
    minHeight: 34,
  },
  queryPillText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'capitalize',
  },
  headerRight: { flexDirection: 'row', gap: 8, minWidth: 92, justifyContent: 'flex-end' },
  topNewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  badge: {
    position: 'absolute', top: -1, right: -1,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 0, paddingBottom: 24 },
  deckFrame: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT + 14,
    position: 'relative',
  },
  deckCard: { position: 'absolute', top: 0, left: 0 },
  stackInner: { position: 'absolute' },
  stackPreview: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  stackPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.98,
  },
  stackPreviewTint: {
    ...StyleSheet.absoluteFillObject,
  },
  stackPreviewGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  stackPreviewFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,243,234,0.02)',
  },
  stackPreviewActionRow: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    opacity: 0.86,
  },
  stackPreviewActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  stackPreviewReadPill: {
    position: 'absolute',
    right: 16,
    bottom: 22,
    height: 42,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    opacity: 0.95,
  },
  stackPreviewReadText: {
    color: 'rgba(245,249,252,0.94)',
    fontSize: 13,
    fontWeight: '700',
  },
  stackPreviewContent: {
    position: 'absolute',
    left: 16,
    right: 92,
    bottom: 20,
    gap: 8,
  },
  stackPreviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stackPreviewSource: {
    color: 'rgba(245,249,252,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  stackPreviewMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  stackPreviewMapBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    position: 'relative',
  },
  stackPreviewMapVertical: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: '50%',
    width: 1,
    marginLeft: -0.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  stackPreviewMapHorizontal: {
    position: 'absolute',
    left: 3,
    right: 3,
    top: '50%',
    height: 1,
    marginTop: -0.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  stackPreviewMapPoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    marginLeft: -3,
    marginTop: -3,
    borderRadius: 3,
    backgroundColor: '#F5F9FC',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  stackPreviewHeadline: {
    color: 'rgba(245,249,252,0.88)',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stackPreviewBorderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  stack2: {
    position: 'absolute',
    top: 2,
    left: 14,
    zIndex: 8,
  },
  stack3: {
    position: 'absolute',
    top: 6,
    left: 26,
    zIndex: 7,
  },
  stack4: {
    position: 'absolute',
    top: 10,
    left: 36,
    zIndex: 6,
  },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 10,
  },
  feedStatusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 12,
  },
  feedStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dot: { height: 6, borderRadius: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  emptyBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  refreshBtn: { height: 48, borderRadius: 12, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  refreshBtnText: { fontSize: 15, fontWeight: '600' },
});
