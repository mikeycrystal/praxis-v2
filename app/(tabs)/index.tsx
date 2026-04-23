import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { ArticleCard, CARD_WIDTH, CARD_HEIGHT } from '../components/news-feed/ArticleCard';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface Article {
  id: number;
  title: string;
  lede: string | null;
  image_url: string | null;
  url: string;
  ts_pub: string;
  x: number;
  y: number;
  publisher: { name: string; domain: string } | null;
  topics: string[];
}

export default function FeedScreen() {
  const { profile, user } = useAuth();
  const { c, Radius, Typography, Spacing } = useTheme();

  const [articles, setArticles] = useState<Article[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const topics = profile?.topics?.length ? profile.topics : ['Technology'];
    const { data, error } = await supabase.functions.invoke('get-articles', {
      body: { topics, limit: 20 },
    });
    if (!error && data?.articles) {
      setArticles(data.articles);
      setIndex(0);
    }
    setLoading(false);
  }, [profile?.topics]);

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

  useEffect(() => { fetchArticles(); }, [fetchArticles]);
  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const markRead = useCallback(async (articleId: number) => {
    if (!user) return;
    // Upsert read record (idempotent)
    const { error } = await supabase.from('read_articles').upsert({
      user_id: user.id,
      article_id: articleId,
      read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,article_id' });
    // Only increment/update streak if this is a new read (not a duplicate)
    if (!error) {
      await Promise.allSettled([
        supabase.rpc('increment_articles_read', { uid: user.id }),
        supabase.rpc('update_reading_streak', { uid: user.id }),
      ]);
    }
    // Fire-and-forget analytics event
    supabase.from('analytics_events').insert({
      user_id: user.id,
      event_name: 'article_view',
      properties: { article_id: articleId },
    });
    // Check for newly earned badges (fire-and-forget)
    supabase.functions.invoke('award-badge', { body: { userId: user.id } }).catch(() => {});
  }, [user]);

  const toggleSave = useCallback(async (articleId: number) => {
    if (!user) return;
    const isSaved = savedIds.has(articleId);
    if (isSaved) {
      await supabase.from('saved_articles').delete()
        .eq('user_id', user.id).eq('article_id', articleId);
      setSavedIds(prev => { const s = new Set(prev); s.delete(articleId); return s; });
      setSavedCount(c => c - 1);
    } else {
      await supabase.from('saved_articles').insert({ user_id: user.id, article_id: articleId });
      setSavedIds(prev => new Set(prev).add(articleId));
      setSavedCount(c => c + 1);
    }
  }, [user, savedIds]);

  // Auto-load more articles when 3 cards away from the end
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const topics = profile?.topics?.length ? profile.topics : ['Technology'];
      const excludeIds = articles && Array.isArray(articles) ? articles.map(a => a?.id).filter(id => id != null) : [];
      const { data, error } = await supabase.functions.invoke('get-articles', {
        body: { topics, limit: 20, exclude_ids: excludeIds },
      });
      if (!error && data?.articles?.length) {
        setArticles(prev => [...prev, ...data.articles]);
      }
    } catch (e) {
      console.error('[FeedScreen] Error loading more articles:', e);
    }
    setLoadingMore(false);
  }, [loadingMore, loading, profile?.topics, articles]);

  const advance = useCallback((articleId: number) => {
    markRead(articleId);
    setIndex(i => {
      const next = i + 1;
      // Load more when 3 cards from the end
      if (next >= articles.length - 3 && articles.length > 0) loadMore();
      return next;
    });
  }, [markRead, articles.length, loadMore]);

  // Safely access articles with null checks
  let current: Article | undefined;
  let next: Article | undefined;
  let afterNext: Article | undefined;

  try {
    if (articles && Array.isArray(articles) && articles.length > 0) {
      current = articles[index] || undefined;
      next = articles[index + 1] || undefined;
      afterNext = articles[index + 2] || undefined;
    }
  } catch (e) {
    console.error('[FeedScreen] Error accessing articles array:', e, { index, articlesLength: articles?.length });
  }

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
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/modal/profile')} style={s.headerBtn}>
          <Text style={[s.headerIcon, { color: c.icon }]}>👤</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Praxis</Text>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => router.push('/modal/search')} style={s.headerBtn}>
            <Text style={[s.headerIcon, { color: c.icon }]}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/modal/saved-articles')} style={s.headerBtn}>
            <Text style={[s.headerIcon, { color: c.icon }]}>🔖</Text>
            {savedCount > 0 && (
              <View style={[s.badge, { backgroundColor: c.tint }]}>
                <Text style={s.badgeText}>{savedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {!current ? (
        <View style={s.empty}>
          <Text style={[s.emptyEmoji]}>✅</Text>
          <Text style={[s.emptyTitle, { color: c.text }]}>You're all caught up!</Text>
          <Text style={[s.emptyBody, { color: c.textSecondary }]}>
            Check your topics or come back later for more.
          </Text>
          <TouchableOpacity
            style={[s.refreshBtn, { backgroundColor: c.tint }]}
            onPress={fetchArticles}
          >
            <Text style={[s.refreshBtnText, { color: c.tintForeground }]}>Refresh Feed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.cardStack}>
          {/* Layer 3 — farthest back */}
          {afterNext && (
            <View style={[s.stackCard, s.stack3, {
              backgroundColor: c.card, borderRadius: 32,
              width: CARD_WIDTH - 32, height: CARD_HEIGHT,
            }]} />
          )}
          {/* Layer 2 */}
          {next && (
            <View style={[s.stackCard, s.stack2, {
              backgroundColor: c.card, borderRadius: 32,
              width: CARD_WIDTH - 16, height: CARD_HEIGHT,
            }]} />
          )}
          {/* Active card */}
          <View style={s.activeCard}>
            <ArticleCard
              article={current}
              isSaved={savedIds.has(current.id)}
              onSave={() => toggleSave(current.id)}
              onRead={() => router.push(`/article/${current.id}`)}
              onAIAnalysis={() => router.push({ pathname: '/article/ai-analysis', params: { id: current.id } })}
              onSwipeLeft={() => advance(current.id)}
              onSwipeRight={() => { toggleSave(current.id); advance(current.id); }}
              isFirst
            />
          </View>
        </View>
      )}

      {/* Progress dots */}
      {articles.length > 0 && current && (
        <View style={s.dotsRow}>
          {(() => {
            try {
              if (!Array.isArray(articles) || articles.length === 0) {
                console.warn('[FeedScreen] Articles array invalid for dots:', { isArray: Array.isArray(articles), length: articles?.length });
                return null;
              }
              const startIdx = Math.max(0, index - 2);
              const endIdx = Math.min(articles.length, index + 5);
              const dotArticles = articles.slice(startIdx, endIdx);

              if (!Array.isArray(dotArticles)) {
                console.error('[FeedScreen] Slice result is not an array');
                return null;
              }

              return dotArticles.map((article, i) => {
                if (!article) {
                  console.warn('[FeedScreen] Article at index is null:', { i, startIdx });
                  return null;
                }
                const isActive = startIdx + i === index;
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

      {/* Swipe hint on first card */}
      {index === 0 && current && (
        <Text style={[s.swipeHint, { color: c.textMuted }]}>← Swipe to explore · Swipe right to save →</Text>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerBtn: { padding: 8, position: 'relative' },
  headerIcon: { fontSize: 20 },
  headerRight: { flexDirection: 'row' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activeCard: { position: 'absolute' },
  stackCard: { position: 'absolute', opacity: 0.6 },
  stack2: { bottom: -8 },
  stack3: { bottom: -16 },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 5, paddingVertical: 10,
  },
  dot: { height: 6, borderRadius: 3 },
  swipeHint: { textAlign: 'center', fontSize: 12, paddingBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  refreshBtn: { height: 48, borderRadius: 12, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  refreshBtnText: { fontSize: 15, fontWeight: '600' },
});
