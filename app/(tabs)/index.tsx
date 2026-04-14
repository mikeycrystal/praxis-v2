import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  TouchableOpacity, useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { ArticleCard } from '../components/news-feed/ArticleCard';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius } from '@/constants/Theme';

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
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [articles, setArticles] = useState<Article[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

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
    if (data) setSavedIds(new Set(data.map((r: any) => r.article_id)));
  }, [user]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);
  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const markRead = async (articleId: number) => {
    if (!user) return;
    await supabase.from('read_articles').upsert({
      user_id: user.id,
      article_id: articleId,
      read_at: new Date().toISOString(),
    });
  };

  const toggleSave = async (articleId: number) => {
    if (!user) return;
    const isSaved = savedIds.has(articleId);
    if (isSaved) {
      await supabase.from('saved_articles').delete()
        .eq('user_id', user.id).eq('article_id', articleId);
      setSavedIds(prev => { const s = new Set(prev); s.delete(articleId); return s; });
    } else {
      await supabase.from('saved_articles').insert({ user_id: user.id, article_id: articleId });
      setSavedIds(prev => new Set(prev).add(articleId));
    }
  };

  const handleSwipeLeft = () => {
    if (index < articles.length - 1) {
      markRead(articles[index].id);
      setIndex(i => i + 1);
    }
  };

  const handleSwipeRight = () => {
    if (index < articles.length - 1) {
      markRead(articles[index].id);
      setIndex(i => i + 1);
    }
  };

  const current = articles[index];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            You're all caught up!
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: c.tint }]}
            onPress={fetchArticles}
          >
            <Text style={{ color: c.tintForeground, fontWeight: '600' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.logo, { color: c.text }]}>Praxis</Text>
        <TouchableOpacity onPress={() => router.push('/modal/search')}>
          <Text style={{ color: c.tint, fontSize: 22 }}>⌕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardArea}>
        {/* Stack layers behind */}
        {articles[index + 1] && (
          <View style={[styles.stackBack, { backgroundColor: c.card, borderColor: c.border }]} />
        )}
        <ArticleCard
          article={current}
          isSaved={savedIds.has(current.id)}
          onSave={() => toggleSave(current.id)}
          onRead={() => router.push(`/article/${current.id}`)}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
        />
      </View>

      <View style={styles.counter}>
        <Text style={[styles.counterText, { color: c.textMuted }]}>
          {index + 1} / {articles.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  logo: { fontSize: Typography.size.xl, fontWeight: '800' },
  cardArea: { flex: 1, marginHorizontal: Spacing.lg, position: 'relative' },
  stackBack: {
    position: 'absolute',
    bottom: -10,
    left: 12,
    right: 12,
    height: 60,
    borderRadius: 24,
    borderWidth: 1,
    opacity: 0.5,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { fontSize: Typography.size.lg },
  refreshBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  counter: { alignItems: 'center', paddingBottom: Spacing.lg },
  counterText: { fontSize: Typography.size.sm },
});
