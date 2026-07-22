import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import {
  getMockTrendingTopics,
  searchMockArticles,
} from '../lib/mockPreviewData';
import {
  readSavedArticles,
  subscribeSavedArticles,
  type SavedArticleSnapshot,
} from '../lib/savedArticles';
import { useAuth } from '../context/AuthContext';

type LocalArticleResult = {
  type: 'article';
  id: number;
  title: string;
  publisher: string;
  lede: string;
  image_url: string | null;
  ts_pub: string;
  url: string;
  matchLabel: string;
};

const SEARCH_DEBOUNCE_MS = 140;

const humanizeMatchLabel = (matches: string[]) => {
  if (matches.includes('topics')) return 'Topic match';
  if (matches.includes('publisher') || matches.includes('source')) return 'Source match';
  if (matches.includes('lede')) return 'Summary match';
  return 'Headline match';
};

const formatPublishedLabel = (dateString: string) => {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) return 'Preview article';

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function SearchModal() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalArticleResult[]>([]);
  const [savedArticles, setSavedArticles] = useState<SavedArticleSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const trendingTopics = useMemo(
    () => getMockTrendingTopics().slice(0, 6).map((topic) => topic.name),
    [],
  );

  useEffect(() => {
    let isActive = true;

    void readSavedArticles(user?.id).then((articles) => {
      if (!isActive) return;
      setSavedArticles(articles);
    });

    const unsubscribe = subscribeSavedArticles(user?.id, (articles) => {
      setSavedArticles(articles);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timeout = setTimeout(() => {
      const mockMatches = searchMockArticles(trimmed, 12).map((result) => ({
        type: 'article' as const,
        id: result.article.id,
        title: result.article.title,
        publisher: result.article.publisher,
        lede: result.article.lede,
        image_url: result.article.image_url,
        ts_pub: result.article.ts_pub,
        url: result.article.url,
        matchLabel: humanizeMatchLabel(result.matches),
      }));

      const savedMatches = savedArticles
        .filter((article) => {
          const searchable = [
            article.title,
            article.lede,
            article.publisher?.name ?? '',
          ].join(' ').toLowerCase();
          return searchable.includes(trimmed.toLowerCase());
        })
        .map((article) => ({
          type: 'article' as const,
          id: article.id,
          title: article.title,
          publisher: article.publisher?.name ?? 'Saved article',
          lede: article.lede,
          image_url: article.image_url,
          ts_pub: article.ts_pub,
          url: article.url,
          matchLabel: 'Saved article',
        }));

      const merged = new Map<number, LocalArticleResult>();
      [...savedMatches, ...mockMatches].forEach((article) => {
        if (!merged.has(article.id)) {
          merged.set(article.id, article);
        }
      });

      setResults(Array.from(merged.values()));
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query, savedArticles]);

  const openArticle = (article: LocalArticleResult) => {
    router.back();
    router.push({
      pathname: '/article/[id]',
      params: {
        id: String(article.id),
        title: article.title,
        lede: article.lede,
        image_url: article.image_url ?? '',
        url: article.url,
        publisher_name: article.publisher,
        ts_pub: article.ts_pub,
      },
    });
  };

  const hasQuery = query.trim().length >= 2;
  const recentSaved = savedArticles.slice(0, 3);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <View style={[s.inputShell, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            style={[s.input, { color: c.text }]}
            placeholder="Search articles, topics, publishers..."
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} style={s.clearBtn}>
              <Ionicons name="close" size={14} color={c.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.cancel, { color: c.tint }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {!hasQuery ? (
        <ScrollView
          contentContainerStyle={s.discoveryContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Suggested topics</Text>
            <View style={s.topicWrap}>
              {trendingTopics.map((topic) => (
                <TouchableOpacity
                  key={topic}
                  style={[s.topicChip, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={() => setQuery(topic)}
                >
                  <Text style={[s.topicText, { color: c.text }]}>{topic}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Saved articles</Text>
            {recentSaved.length > 0 ? (
              recentSaved.map((article) => (
                <TouchableOpacity
                  key={article.id}
                  style={[s.savedRow, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={() =>
                    openArticle({
                      type: 'article',
                      id: article.id,
                      title: article.title,
                      publisher: article.publisher?.name ?? 'Saved article',
                      lede: article.lede,
                      image_url: article.image_url,
                      ts_pub: article.ts_pub,
                      url: article.url,
                      matchLabel: 'Saved article',
                    })
                  }
                >
                  <View style={s.savedCopy}>
                    <Text style={[s.savedTitle, { color: c.text }]} numberOfLines={2}>
                      {article.title}
                    </Text>
                    <Text style={[s.savedMeta, { color: c.textMuted }]} numberOfLines={1}>
                      {article.publisher?.name ?? 'Saved article'}
                    </Text>
                  </View>
                  <Ionicons name="bookmark" size={16} color={c.tint} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[s.helperText, { color: c.textMuted }]}>
                Your saved stories will show up here for quick access.
              </Text>
            )}
          </View>

          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Search mode</Text>
            <Text style={[s.helperText, { color: c.textMuted }]}>
              Search is currently using local preview and saved-article data so it stays useful in safe mode.
            </Text>
          </View>
        </ScrollView>
      ) : null}

      {loading ? (
        <ActivityIndicator color={c.tint} style={{ marginTop: 28 }} />
      ) : null}

      {!loading && hasQuery && results.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: c.text }]}>No local matches</Text>
          <Text style={[s.helperText, { color: c.textMuted }]}>
            Try a topic like “AI”, “Courts”, or a publisher name.
          </Text>
        </View>
      ) : null}

      {!loading && hasQuery ? (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.resultRow, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => openArticle(item)}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="cover" />
              ) : (
                <View style={[s.thumbFallback, { backgroundColor: c.secondary }]}>
                  <Ionicons name="newspaper-outline" size={18} color={c.textMuted} />
                </View>
              )}
              <View style={s.resultCopy}>
                <View style={s.resultMetaRow}>
                  <Text style={[s.resultPublisher, { color: c.textMuted }]} numberOfLines={1}>
                    {item.publisher}
                  </Text>
                  <Text style={[s.resultDivider, { color: c.textMuted }]}>•</Text>
                  <Text style={[s.resultMatch, { color: c.tint }]}>{item.matchLabel}</Text>
                </View>
                <Text style={[s.resultTitle, { color: c.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[s.resultLede, { color: c.textMuted }]} numberOfLines={2}>
                  {item.lede}
                </Text>
                <Text style={[s.resultDate, { color: c.textMuted }]}>
                  {formatPublishedLabel(item.ts_pub)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  inputShell: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { fontSize: 15 },
  discoveryContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topicWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicText: {
    fontSize: 13,
    fontWeight: '500',
  },
  savedRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedCopy: {
    flex: 1,
    gap: 3,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  savedMeta: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 42,
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
  },
  thumbFallback: {
    width: 76,
    height: 76,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCopy: {
    flex: 1,
    gap: 4,
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resultPublisher: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  resultDivider: {
    fontSize: 10,
  },
  resultMatch: {
    fontSize: 11,
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  resultLede: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  resultDate: {
    fontSize: 11,
    marginTop: 2,
  },
});
