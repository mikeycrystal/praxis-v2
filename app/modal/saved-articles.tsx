import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function SavedArticlesModal() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_articles')
      .select('article_id, saved_at, article(id, title, lede, ts_pub, image_url, publisher(name))')
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
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Saved Articles</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.done, { color: c.tint }]}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>🔖</Text>
              <Text style={[s.emptyText, { color: c.textSecondary }]}>No saved articles yet.</Text>
              <Text style={[s.emptyHint, { color: c.textMuted }]}>
                Tap the bookmark icon on any card to save it here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.row, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push(`/article/${item.id}`)}
            >
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="cover" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.publisher, { color: c.textMuted }]}>
                  {item.publisher?.name ?? 'Unknown'}
                </Text>
                <Text style={[s.articleTitle, { color: c.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[s.date, { color: c.textMuted }]}>
                  {new Date(item.ts_pub).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => unsave(item.id)} style={s.unsaveBtn}>
                <Text style={[{ fontSize: 20 }, { color: c.bookmarkActive }]}>🔖</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  done: { fontSize: 16 },
  list: { paddingHorizontal: 16, gap: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  publisher: { fontSize: 11, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 },
  articleTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  date: { fontSize: 11, marginTop: 4 },
  unsaveBtn: { padding: 6 },
});
