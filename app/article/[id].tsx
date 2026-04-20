import { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { c, Radius } = useTheme();
  const [article, setArticle] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('article').select('*, publisher(name, domain)').eq('id', id).single(),
      user ? supabase.from('saved_articles').select('id').eq('user_id', user.id).eq('article_id', id).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([{ data: art }, { data: saved }]) => {
      setArticle(art);
      setIsSaved(!!saved);
      setLoading(false);
    });
  }, [id, user]);

  const toggleSave = async () => {
    if (!user) return;
    if (isSaved) {
      await supabase.from('saved_articles').delete().eq('user_id', user.id).eq('article_id', id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_articles').insert({ user_id: user.id, article_id: Number(id) });
      setIsSaved(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!article) return null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={[s.backText, { color: c.tint }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.topActions}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/article/ai-analysis', params: { id } })}
            style={[s.topBtn, { backgroundColor: c.tint + '20' }]}
          >
            <Text style={{ fontSize: 16 }}>🧠</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleSave} style={[s.topBtn, { backgroundColor: c.card }]}>
            <Text style={{ fontSize: 16, color: isSaved ? c.bookmarkActive : c.textMuted }}>
              {isSaved ? '🔖' : '🔗'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {article.image_url && (
          <Image
            source={{ uri: article.image_url }}
            style={[s.heroImage, { borderRadius: Radius.xl }]}
            resizeMode="cover"
          />
        )}

        <View style={s.meta}>
          {article.topics?.[0] && (
            <View style={[s.catBadge, { backgroundColor: c.tint + '20', borderColor: c.tint + '40' }]}>
              <Text style={[s.catText, { color: c.tint }]}>{article.topics[0]}</Text>
            </View>
          )}
          <Text style={[s.title, { color: c.text }]}>{article.title}</Text>
          {article.lede && (
            <Text style={[s.lede, { color: c.textSecondary }]}>{article.lede}</Text>
          )}
          <Text style={[s.byline, { color: c.textMuted }]}>
            {article.publisher?.name ?? 'Unknown'}
            {article.byline ? ` · ${article.byline}` : ''}
            {' · '}
            {new Date(article.ts_pub).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {article.body ? (
          <Text style={[s.body, { color: c.text }]}>{article.body}</Text>
        ) : (
          <TouchableOpacity
            style={[s.readFullBtn, { backgroundColor: c.tint }]}
            onPress={() => Linking.openURL(article.url)}
          >
            <Text style={[s.readFullBtnText, { color: c.tintForeground }]}>Read Full Article ↗</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[s.ctaBar, { backgroundColor: c.background, borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: c.tint }]}
          onPress={() => Linking.openURL(article.url)}
        >
          <Text style={[s.ctaBtnText, { color: c.tintForeground }]}>Read Full Article ↗</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 17 },
  topActions: { flexDirection: 'row', gap: 8 },
  topBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 16, paddingBottom: 80 },
  heroImage: { width: '100%', aspectRatio: 16 / 9 },
  meta: { gap: 10 },
  catBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 31 },
  lede: { fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  byline: { fontSize: 12 },
  body: { fontSize: 16, lineHeight: 26 },
  readFullBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  readFullBtnText: { fontSize: 16, fontWeight: '600' },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  ctaBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 16, fontWeight: '700' },
});
