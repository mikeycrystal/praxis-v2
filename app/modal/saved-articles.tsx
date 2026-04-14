import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, useColorScheme, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius } from '@/constants/Theme';

export default function SavedArticlesModal() {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_articles')
      .select('article_id, saved_at, article(id, title, lede, ts_pub, publisher(name))')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .then(({ data }) => {
        setArticles((data ?? []).map((r: any) => r.article).filter(Boolean));
        setLoading(false);
      });
  }, [user]);

  const unsave = async (articleId: number) => {
    if (!user) return;
    await supabase.from('saved_articles').delete().eq('user_id', user.id).eq('article_id', articleId);
    setArticles(prev => prev.filter(a => a.id !== articleId));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Saved Articles</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.close, { color: c.tint }]}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.textSecondary }]}>No saved articles yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push(`/article/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.publisher, { color: c.textSecondary }]}>
                  {item.publisher?.name ?? 'Unknown'}
                </Text>
                <Text style={[styles.articleTitle, { color: c.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <TouchableOpacity onPress={() => unsave(item.id)} style={styles.unsaveBtn}>
                <Text style={{ color: c.bookmarkActive, fontSize: 20 }}>🔖</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
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
    paddingVertical: Spacing.lg,
  },
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  close: { fontSize: Typography.size.base },
  list: { paddingHorizontal: Spacing['2xl'], gap: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing['4xl'], fontSize: Typography.size.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  publisher: { fontSize: Typography.size.xs, textTransform: 'uppercase', fontWeight: '600', marginBottom: 4 },
  articleTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.medium, lineHeight: 22 },
  unsaveBtn: { padding: Spacing.sm },
});
