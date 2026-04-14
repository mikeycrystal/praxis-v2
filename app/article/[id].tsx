import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, useColorScheme, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius, Shadows } from '@/constants/Theme';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [article, setArticle] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      const { data } = await supabase
        .from('article')
        .select('*, publisher(name, domain)')
        .eq('id', id)
        .single();
      setArticle(data);
      setLoading(false);
    };

    const fetchSaved = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('saved_articles')
        .select('id')
        .eq('user_id', user.id)
        .eq('article_id', id)
        .maybeSingle();
      setIsSaved(!!data);
    };

    fetchArticle();
    fetchSaved();
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

  const fetchInsights = async () => {
    setLoadingInsights(true);
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: { article_id: Number(id) },
    });
    if (!error && data?.insights) setInsights(data.insights);
    setLoadingInsights(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!article) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: c.tint, fontSize: Typography.size.lg }}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSave}>
          <Text style={{ fontSize: 22, color: isSaved ? c.bookmarkActive : c.textMuted }}>
            {isSaved ? '🔖' : '🔗'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.publisher, { color: c.textSecondary }]}>
          {article.publisher?.name ?? 'Unknown'} · {new Date(article.ts_pub).toLocaleDateString()}
        </Text>
        <Text style={[styles.title, { color: c.text }]}>{article.title}</Text>

        {article.lede && (
          <Text style={[styles.lede, { color: c.textSecondary }]}>{article.lede}</Text>
        )}

        {article.body ? (
          <Text style={[styles.body, { color: c.text }]}>{article.body}</Text>
        ) : (
          <TouchableOpacity
            style={[styles.readFullBtn, { backgroundColor: c.tint }]}
            onPress={() => Linking.openURL(article.url)}
          >
            <Text style={[styles.readFullBtnText, { color: c.tintForeground }]}>
              Read full article
            </Text>
          </TouchableOpacity>
        )}

        {/* AI Insights */}
        <View style={[styles.insightsCard, { backgroundColor: c.card, borderColor: c.border }, Shadows.subtle]}>
          <Text style={[styles.insightsTitle, { color: c.text }]}>AI Insights</Text>
          {insights ? (
            <Text style={[styles.insightsText, { color: c.textSecondary }]}>{insights}</Text>
          ) : (
            <TouchableOpacity
              style={[styles.insightsBtn, { backgroundColor: c.secondary }]}
              onPress={fetchInsights}
              disabled={loadingInsights}
            >
              {loadingInsights
                ? <ActivityIndicator color={c.tint} size="small" />
                : <Text style={[styles.insightsBtnText, { color: c.tint }]}>
                    Generate insights
                  </Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  backBtn: { padding: Spacing.sm },
  content: { paddingHorizontal: Spacing['2xl'], paddingBottom: Spacing['4xl'], gap: Spacing.lg },
  publisher: { fontSize: Typography.size.xs, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  title: { fontSize: Typography.size['2xl'], fontWeight: Typography.weight.extrabold, lineHeight: 32 },
  lede: { fontSize: Typography.size.lg, lineHeight: 26, fontStyle: 'italic' },
  body: { fontSize: Typography.size.base, lineHeight: 26 },
  readFullBtn: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readFullBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  insightsCard: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  insightsTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  insightsText: { fontSize: Typography.size.sm, lineHeight: 22 },
  insightsBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  insightsBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
});
