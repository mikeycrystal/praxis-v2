import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet, SafeAreaView, ActivityIndicator,
  TouchableOpacity, Dimensions, Share, Animated, PanResponder, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { useNewsPreferences } from '../context/NewsPreferencesContext';
import { useFeedArticles, type Article } from '../hooks/useFeedArticles';
import {
  buildFeedPreferenceSignature,
} from '../lib/newsPreferences';
import { supabase } from '../services/supabase';
import { ArticleCard, CARD_WIDTH, CARD_HEIGHT } from '../components/news-feed/ArticleCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTICLES_PER_PAGE = 20;
const STACK_RENDER_COUNT = 4;
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

function StackPreviewCard({
  article,
  width,
  height,
  offsetStyle,
  tint,
}: {
  article: Article;
  width: number;
  height: number;
  offsetStyle: object;
  tint: string;
}) {
  const previewImageUri = article.image_url || `https://picsum.photos/seed/stack-${article.id}/1200/900`;
  const previewSource = article.source || article.publisher?.name || 'Source';
  const previewTitle = article.title || 'Top story';
  const showMapPoint = typeof article.x === 'number' || typeof article.y === 'number';
  const mapLeft = (((article.x ?? 0) + 1) / 2) * 22;
  const mapTop = ((1 - (article.y ?? 0)) / 2) * 22;

  return (
    <View style={[s.stackPreview, { width, height }, offsetStyle]}>
      <Image source={{ uri: previewImageUri }} style={s.stackPreviewImage} resizeMode="cover" />
      <View style={[s.stackPreviewTint, { backgroundColor: tint }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(14,13,15,0.22)', 'rgba(7,7,9,0.74)']}
        locations={[0.06, 0.45, 1]}
        style={s.stackPreviewGradient}
      />
      <LinearGradient
        colors={['rgba(247,243,234,0.01)', 'rgba(247,243,234,0.04)', 'rgba(247,243,234,0.12)']}
        locations={[0, 0.24, 1]}
        style={s.stackPreviewFade}
      />
      <View style={s.stackPreviewActionRow}>
        <View style={s.stackPreviewActionBtn}>
          <Ionicons name="share-social-outline" size={12} color="rgba(245,249,252,0.92)" />
        </View>
        <View style={s.stackPreviewActionBtn}>
          <Ionicons name="bookmark-outline" size={12} color="rgba(245,249,252,0.92)" />
        </View>
      </View>
      <View style={s.stackPreviewReadPill}>
        <Text style={s.stackPreviewReadText}>Read</Text>
        <Ionicons name="open-outline" size={11} color="rgba(245,249,252,0.9)" />
      </View>
      <View style={s.stackPreviewContent}>
        <View style={s.stackPreviewMetaRow}>
          <Text style={s.stackPreviewSource} numberOfLines={1}>{previewSource}</Text>
          {showMapPoint ? (
            <>
              <View style={s.stackPreviewMetaDot} />
              <View style={s.stackPreviewMapBadge}>
                <View style={s.stackPreviewMapVertical} />
                <View style={s.stackPreviewMapHorizontal} />
                <View style={[s.stackPreviewMapPoint, { left: mapLeft, top: mapTop }]} />
              </View>
            </>
          ) : null}
        </View>
        <Text style={s.stackPreviewHeadline} numberOfLines={3}>{previewTitle}</Text>
      </View>
      <View style={s.stackPreviewBorderGlow} />
    </View>
  );
}

export default function FeedScreen() {
  const { profile, user } = useAuth();
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
    currentArticleIndex: index,
    setCurrentArticleIndex: setCurrentIndex,
    setFeedContext,
    loadFromPreferences,
    requestMoreArticles,
    clearStreamError,
  } = useFeedArticles();
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
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeY = useRef(new Animated.Value(0)).current;
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
    if (!user) return;
    const { data } = await supabase
      .from('saved_articles')
      .select('article_id')
      .eq('user_id', user.id);
    if (data) {
      const ids = new Set<number>(data.map((r: any) => r.article_id));
      setSavedIds(ids);
      setSavedCount(ids.size);
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

    swipeX.stopAnimation(() => {
      swipeX.setValue(0);
    });
    swipeY.stopAnimation(() => {
      swipeY.setValue(0);
    });

    setLoadedArticlesCount(ARTICLES_PER_PAGE);
    setFlippedArticleId(null);
  }, [preferences.requestNonce, swipeX, swipeY]);

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
      .slice(safeIndex, safeIndex + 6)
      .map((article) => article.image_url)
      .filter((value): value is string => Boolean(value));

    prefetched.forEach((uri) => {
      void Image.prefetch(uri).catch(() => {});
    });
  }, [articles, safeIndex]);

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
    router.navigate('/(tabs)/graph');
  }, []);

  const markRead = useCallback((articleId: number) => {
    if (!user) return;
    if (queuedReadIdsRef.current.has(articleId)) return;

    queuedReadIdsRef.current.add(articleId);

    void (async () => {
      try {
        const { error } = await supabase.from('read_articles').insert({
          user_id: user.id,
          article_id: articleId,
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
          properties: { article_id: articleId },
        }).then(({ error: analyticsError }) => {
          if (analyticsError) {
            console.warn('[FeedScreen] Failed to track article view', analyticsError);
          }
        });

        void supabase.functions.invoke('award-badge', { body: { userId: user.id } }).catch((badgeError) => {
          console.warn('[FeedScreen] Failed to check badges after read', badgeError);
        });
      } catch (error) {
        queuedReadIdsRef.current.delete(articleId);
        console.warn('[FeedScreen] Failed to mark article read', error);
      }
    })();
  }, [user]);

  const toggleSave = useCallback(async (articleId: number) => {
    if (!user) return;
    const isSaved = savedIds.has(articleId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
    setSavedCount((count) => Math.max(0, count + (isSaved ? -1 : 1)));

    try {
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
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) {
          next.add(articleId);
        } else {
          next.delete(articleId);
        }
        return next;
      });
      setSavedCount((count) => Math.max(0, count + (isSaved ? 1 : -1)));
      console.warn('[FeedScreen] Failed to update bookmark state', error);
    }
  }, [user, savedIds]);

  const shareArticle = useCallback(async (article: Article) => {
    if (!article.url) return;
    try {
      await Share.share({
        message: `${article.title}\n\n${article.url}`,
        url: article.url,
        title: article.title,
      });
    } catch (error) {
      console.warn('[FeedScreen] Share failed:', error);
    }
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

  const advance = useCallback((articleId: number) => {
    markRead(articleId);
    const nextIndex = index + 1;

    if (nextIndex >= loadedArticlesCount && articles.length > loadedArticlesCount) {
      setLoadedArticlesCount((prev) =>
        Math.min(prev + ARTICLES_PER_PAGE, articles.length),
      );
    }

    setCurrentIndex(nextIndex);
  }, [articles.length, index, loadedArticlesCount, markRead, setCurrentIndex]);

  const retreat = useCallback(() => {
    setCurrentIndex(Math.max(0, index - 1));
  }, [index, setCurrentIndex]);

  const resetSwipe = useCallback(() => {
    Animated.parallel([
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
      Animated.spring(swipeY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
    ]).start();
  }, [swipeX, swipeY]);

  const commitSwipeLeft = useCallback((articleId: number) => {
    Animated.timing(swipeX, {
      toValue: -SCREEN_WIDTH * 1.2,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      swipeX.setValue(0);
      swipeY.setValue(0);
      advance(articleId);
    });
  }, [advance, swipeX, swipeY]);

  const commitSwipeRight = useCallback(() => {
    Animated.timing(swipeX, {
      toValue: SCREEN_WIDTH * 1.2,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      swipeX.setValue(0);
      swipeY.setValue(0);
      retreat();
    });
  }, [retreat, swipeX, swipeY]);

  // Safely access articles with null checks
  let current: Article | undefined;
  let next: Article | undefined;
  let afterNext: Article | undefined;
  let fourth: Article | undefined;

  try {
    const visibleArticles = articles.slice(0, maxAvailableArticles);
    if (visibleArticles.length > 0) {
      current = visibleArticles[safeIndex] || undefined;
      next = visibleArticles[safeIndex + 1] || undefined;
      afterNext = visibleArticles[safeIndex + 2] || undefined;
      fourth = visibleArticles[safeIndex + 3] || undefined;
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
  const activeRotate = swipeX.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });
  const activeScale = swipeX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [0.95, 1, 0.95],
    extrapolate: 'clamp',
  });
  const nextCardOpacity = swipeX.interpolate({
    inputRange: [-140, 0, 140],
    outputRange: [0.96, 0.7, 0.7],
    extrapolate: 'clamp',
  });
  const nextCardTranslate = swipeX.interpolate({
    inputRange: [-140, 0, 140],
    outputRange: [-12, 0, 0],
    extrapolate: 'clamp',
  });
  const nextCardScale = swipeX.interpolate({
    inputRange: [-140, 0, 140],
    outputRange: [0.985, 0.95, 0.95],
    extrapolate: 'clamp',
  });
  const thirdCardOpacity = swipeX.interpolate({
    inputRange: [-150, 0, 150],
    outputRange: [0.58, 0.4, 0.4],
    extrapolate: 'clamp',
  });
  const thirdCardTranslate = swipeX.interpolate({
    inputRange: [-150, 0, 150],
    outputRange: [-10, 0, 0],
    extrapolate: 'clamp',
  });
  const thirdCardScale = swipeX.interpolate({
    inputRange: [-150, 0, 150],
    outputRange: [0.93, 0.9, 0.9],
    extrapolate: 'clamp',
  });
  const fourthCardOpacity = swipeX.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: [0.32, 0.2, 0.2],
    extrapolate: 'clamp',
  });
  const fourthCardTranslate = swipeX.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: [-8, 0, 0],
    extrapolate: 'clamp',
  });
  const fourthCardScale = swipeX.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: [0.87, 0.85, 0.85],
    extrapolate: 'clamp',
  });

  const stackPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        if (flippedArticleId === current?.id) {
          return false;
        }

        return Math.abs(dx) > Math.abs(dy) * 1.25 && Math.abs(dx) > 12;
      },
      onPanResponderMove: (_, { dx }) => {
        if (flippedArticleId === current?.id) {
          return;
        }

        if ((dx < 0 && !canSwipeLeft) || (dx > 0 && !canSwipeRight)) {
          swipeX.setValue(dx * 0.2);
          swipeY.setValue(0);
          return;
        }
        swipeX.setValue(dx);
        swipeY.setValue(0);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (flippedArticleId === current?.id) {
          resetSwipe();
          return;
        }

        const absX = Math.abs(dx);
        const shouldCommit = (Math.abs(vx) > 0.28 && absX > 38) || absX > 70;
        if (shouldCommit && dx < 0 && canSwipeLeft && current) {
          commitSwipeLeft(current.id);
          return;
        }
        if (shouldCommit && dx > 0 && canSwipeRight) {
          commitSwipeRight();
          return;
        }
        resetSwipe();
      },
      onPanResponderTerminate: resetSwipe,
    }),
    [
      canSwipeLeft,
      canSwipeRight,
      commitSwipeLeft,
      commitSwipeRight,
      current,
      flippedArticleId,
      resetSwipe,
      swipeX,
      swipeY,
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
          <TouchableOpacity
            onPress={() => router.push('/modal/profile')}
            style={s.headerBtn}
          >
            <Ionicons name="person-outline" size={20} color={c.icon} />
          </TouchableOpacity>
          <View style={[s.streakPill, { backgroundColor: '#E9EDD8', borderColor: '#D9DEC5' }]}>
            <Ionicons name="flame-outline" size={15} color="#8DAE73" />
            <Text style={s.streakText}>{profile?.reading_streak ?? 3}</Text>
          </View>
        </View>

        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>Praxis</Text>
        </View>

        <View style={s.headerRight}>
          <TouchableOpacity
            onPress={() => router.push('/modal/saved-articles')}
            style={s.headerBtn}
          >
            <Ionicons name="bookmark-outline" size={18} color={c.icon} />
            {savedCount > 0 && (
              <View style={[s.badge, { backgroundColor: c.tint }]}>
                <Text style={s.badgeText}>{savedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/modal/search')}
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
          <View style={s.deckFrame}>
            {fourth && (
              <Animated.View
                style={[
                  s.stack4,
                  {
                    opacity: fourthCardOpacity,
                    transform: [{ translateX: fourthCardTranslate }, { scale: fourthCardScale }],
                  },
                ]}
              >
                <StackPreviewCard
                  article={fourth}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  tint="rgba(226, 231, 236, 0.24)"
                  offsetStyle={s.stackInner}
                />
              </Animated.View>
            )}
            {afterNext && (
              <Animated.View
                style={[
                  s.stack3,
                  {
                    opacity: thirdCardOpacity,
                    transform: [{ translateX: thirdCardTranslate }, { scale: thirdCardScale }],
                  },
                ]}
              >
                <StackPreviewCard
                  article={afterNext}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  tint="rgba(210, 220, 230, 0.28)"
                  offsetStyle={s.stackInner}
                />
              </Animated.View>
            )}
            {next && (
              <Animated.View
                style={[
                  s.stack2,
                  {
                    opacity: nextCardOpacity,
                    transform: [{ translateX: nextCardTranslate }, { scale: nextCardScale }],
                  },
                ]}
              >
                <StackPreviewCard
                  article={next}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  tint="rgba(146, 192, 177, 0.24)"
                  offsetStyle={s.stackInner}
                />
              </Animated.View>
            )}
            <Animated.View
              style={[
                s.activeCard,
                {
                  transform: [{ translateX: swipeX }, { translateY: swipeY }, { rotate: activeRotate }, { scale: activeScale }],
                },
              ]}
              {...(flippedArticleId === current.id ? {} : stackPanResponder.panHandlers)}
            >
              <ArticleCard
                article={current}
                isActive
                isSaved={savedIds.has(current.id)}
                onSave={() => toggleSave(current.id)}
                onShare={() => shareArticle(current)}
                onRead={() => {
                  markRead(current.id);
                  router.push({
                    pathname: '/article/[id]',
                    params: {
                      id: String(current.id),
                      title: current.title,
                      lede: current.lede ?? '',
                      image_url: current.image_url ?? '',
                      url: current.url,
                      publisher_name: current.publisher?.name ?? '',
                      ts_pub: current.ts_pub,
                    },
                  });
                }}
                canSwipeRight={safeIndex > 0}
                onFlipChange={(isFlipped) => {
                  setFlippedArticleId(isFlipped ? current.id : null);
                }}
                showSwipeHints={flippedArticleId !== current.id}
                isDigestCard={false}
                swipeEnabled
                swipeX={swipeX}
              />
            </Animated.View>
          </View>
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
    width: CARD_WIDTH + 76,
    height: CARD_HEIGHT + 14,
    position: 'relative',
  },
  activeCard: { position: 'absolute', top: 0, left: 0, zIndex: 10 },
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
    left: 22,
    zIndex: 8,
  },
  stack3: {
    position: 'absolute',
    top: 6,
    left: 42,
    zIndex: 7,
  },
  stack4: {
    position: 'absolute',
    top: 10,
    left: 58,
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
