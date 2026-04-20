import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';

interface AIAnalysis {
  summary: string;
  keyPoints: string[];
  sentiment: string;
  entities: string[];
  relatedTopics: string[];
  credibilityScore: number;
}

export default function AIAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, Radius } = useTheme();
  const [article, setArticle] = useState<any>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('article')
        .select('*, publisher(name, domain)')
        .eq('id', id)
        .single();
      setArticle(data);
      setLoading(false);
      // Auto-trigger analysis
      fetchAnalysis(data);
    };
    fetch();
  }, [id]);

  const fetchAnalysis = async (art?: any) => {
    setAnalyzing(true);
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: { article_id: Number(id), article: art ?? article },
    });
    if (!error && data) setAnalysis(data);
    setAnalyzing(false);
  };

  const getSentimentColor = (sentiment: string) => {
    const s = sentiment?.toLowerCase() ?? '';
    if (s.includes('positive') || s.includes('great')) return c.sentimentPositive;
    if (s.includes('negative') || s.includes('concern')) return c.sentimentNegative;
    if (s.includes('excited') || s.includes('neutral')) return c.sentimentExcited;
    return c.sentimentNeutral;
  };

  const getCredColor = (score: number) => {
    if (score >= 90) return c.credHigh;
    if (score >= 80) return c.credMed;
    if (score >= 70) return c.credLow;
    return c.credPoor;
  };

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
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={[s.backText, { color: c.tint }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>AI Analysis</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Article image */}
        {article?.image_url && (
          <Image
            source={{ uri: article.image_url }}
            style={[s.heroImage, { borderRadius: Radius.xxl }]}
            resizeMode="cover"
          />
        )}

        {/* Article meta */}
        <View style={s.articleMeta}>
          {article?.topics?.[0] && (
            <View style={[s.catBadge, { backgroundColor: c.tint + '20', borderColor: c.tint + '40' }]}>
              <Text style={[s.catText, { color: c.tint }]}>{article.topics[0]}</Text>
            </View>
          )}
          <Text style={[s.articleTitle, { color: c.text }]}>{article?.title}</Text>
          {article?.lede && (
            <Text style={[s.articleSubtitle, { color: c.textSecondary }]}>{article.lede}</Text>
          )}
          <View style={s.bylineRow}>
            <Text style={[s.byline, { color: c.textMuted }]}>
              {article?.publisher?.name ?? 'Unknown'} · {article?.byline ? `By ${article.byline} · ` : ''}
              {new Date(article?.ts_pub).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Analysis loading */}
        {analyzing && (
          <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <ActivityIndicator color={c.tint} />
            <Text style={[s.cardLabel, { color: c.textMuted, textAlign: 'center', marginTop: 8 }]}>
              Analyzing article…
            </Text>
          </View>
        )}

        {analysis && (
          <>
            {/* Summary */}
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.cardLabel, { color: c.textMuted }]}>AI SUMMARY</Text>
              <Text style={[s.summaryText, { color: c.text }]}>{analysis.summary}</Text>
            </View>

            {/* Key points */}
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.cardLabel, { color: c.textMuted }]}>KEY POINTS</Text>
              <View style={s.pointsList}>
                {analysis.keyPoints.map((point, i) => (
                  <View key={i} style={s.pointRow}>
                    <View style={[s.pointDot, { backgroundColor: c.tint }]} />
                    <Text style={[s.pointText, { color: c.textSecondary }]}>{point}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Sentiment + Credibility row */}
            <View style={s.metricsRow}>
              <View style={[s.metricCard, { backgroundColor: c.card, borderColor: c.border, flex: 1 }]}>
                <Text style={[s.cardLabel, { color: c.textMuted }]}>SENTIMENT</Text>
                <View style={[s.sentimentBadge, {
                  backgroundColor: getSentimentColor(analysis.sentiment) + '20',
                  borderColor: getSentimentColor(analysis.sentiment) + '40',
                }]}>
                  <Text style={[s.sentimentText, { color: getSentimentColor(analysis.sentiment) }]}>
                    {analysis.sentiment}
                  </Text>
                </View>
              </View>
              <View style={[s.metricCard, { backgroundColor: c.card, borderColor: c.border, flex: 1 }]}>
                <Text style={[s.cardLabel, { color: c.textMuted }]}>CREDIBILITY</Text>
                <Text style={[s.credScore, { color: getCredColor(analysis.credibilityScore) }]}>
                  {analysis.credibilityScore}%
                </Text>
              </View>
            </View>

            {/* Entities */}
            {analysis.entities?.length > 0 && (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[s.cardLabel, { color: c.textMuted }]}>KEY ENTITIES</Text>
                <View style={s.tagsWrap}>
                  {analysis.entities.map((e, i) => (
                    <View key={i} style={[s.entityTag, { borderColor: c.border }]}>
                      <Text style={[s.tagText, { color: c.textSecondary }]}>{e}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Related topics */}
            {analysis.relatedTopics?.length > 0 && (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[s.cardLabel, { color: c.textMuted }]}>RELATED TOPICS</Text>
                <View style={s.tagsWrap}>
                  {analysis.relatedTopics.map((t, i) => (
                    <View key={i} style={[s.topicTag, { backgroundColor: c.secondary }]}>
                      <Text style={[s.tagText, { color: c.tint }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {!analyzing && !analysis && (
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
            onPress={() => fetchAnalysis()}
          >
            <Text style={{ fontSize: 20 }}>🧠</Text>
            <Text style={[s.retryText, { color: c.tint }]}>Generate AI Analysis</Text>
          </TouchableOpacity>
        )}

        {/* Spacer for sticky CTA */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Sticky read CTA */}
      <View style={[s.ctaBar, { backgroundColor: c.background, borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: c.tint }]}
          onPress={() => Linking.openURL(article?.url)}
        >
          <Text style={[s.ctaBtnText, { color: c.tintForeground }]}>Read Full Article ↗</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 17 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  scroll: { padding: 16, gap: 12 },
  heroImage: { width: '100%', aspectRatio: 16 / 9 },
  articleMeta: { gap: 10, paddingVertical: 4 },
  catBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  catText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  articleTitle: { fontSize: 22, fontWeight: '700', lineHeight: 29 },
  articleSubtitle: { fontSize: 15, lineHeight: 22 },
  bylineRow: { flexDirection: 'row', alignItems: 'center' },
  byline: { fontSize: 12 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  summaryText: { fontSize: 15, lineHeight: 24 },
  pointsList: { gap: 10 },
  pointRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 7, flexShrink: 0 },
  pointText: { flex: 1, fontSize: 14, lineHeight: 21 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  sentimentBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  sentimentText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  credScore: { fontSize: 28, fontWeight: '800' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entityTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  topicTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { fontSize: 13, fontWeight: '500' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 18, borderRadius: 16, borderWidth: 1,
  },
  retryText: { fontSize: 16, fontWeight: '600' },
  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, borderTopWidth: 1,
  },
  ctaBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 16, fontWeight: '700' },
});
