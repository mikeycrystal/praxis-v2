import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert,
  TextInput, Image, InteractionManager, type GestureResponderEvent,
} from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { buildHref } from '../lib/buildHref';
import { fetchLiveArticleById } from '../hooks/useFeedArticles';
import {
  mergeSavedArticles,
  readSavedArticles,
  removeSavedArticle,
  subscribeSavedArticles,
  type SavedArticleSnapshot,
} from '../lib/savedArticles';
export default function SavedArticlesModal() {
  const { isGuestMode, user } = useAuth();
  const segments = useSegments();
  const [articles, setArticles] = useState<SavedArticleSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const isSavedPage = segments[0] === '(tabs)';
  const c = {
    background: '#F7F3EA',
    card: '#FBF7F0',
    surface: '#FFFDFC',
    text: '#2E2A25',
    textSecondary: '#5D554C',
    textMuted: '#8E857A',
    tint: '#D9802E',
    border: '#E7DEC9',
    icon: '#736A61',
    bookmarkActive: '#D9802E',
  };

  const loadSavedArticles = useCallback(async () => {
    setLoading(true);
    const localSaved = await readSavedArticles(user?.id);
    setArticles(localSaved);

    if (!user) {
      setLoading(false);
      return;
    }

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

      setArticles(merged);
    } catch (error) {
      console.warn('[SavedArticlesModal] Failed to refresh remote saved articles', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isGuestMode || !user) {
      router.replace(buildHref('/login', { returnTo: '/saved' }));
    }
  }, [isGuestMode, user]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void loadSavedArticles();
    });

    return () => task.cancel();
  }, [loadSavedArticles]);

  useEffect(() => {
    const unsubscribe = subscribeSavedArticles(user?.id, (nextArticles) => {
      setArticles(nextArticles);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.id]);

  const unsave = async (articleId: number) => {
    await removeSavedArticle(user?.id, articleId);

    if (!user) return;

    const { error } = await supabase
      .from('saved_articles')
      .delete()
      .eq('user_id', user.id)
      .eq('article_id', articleId);

    if (error) {
      console.warn('[SavedArticlesModal] Failed to remove remote bookmark', error);
      Alert.alert(
        'Saved on this device',
        'We removed the bookmark locally, but the cloud copy could not be updated right now.',
      );
    }
  };

  const openSavedArticle = (article: SavedArticleSnapshot) => {
    const openArticle = () => {
      router.push({
        pathname: '/article/[id]',
        params: {
          id: String(article.id),
          title: article.title,
          lede: article.lede,
          image_url: article.image_url ?? '',
          url: article.url,
          publisher_name: article.publisher?.name ?? '',
          ts_pub: article.ts_pub,
          source_context: 'saved',
          x: article.x == null ? '' : String(article.x),
          y: article.y == null ? '' : String(article.y),
          category: article.category ?? '',
          topics: JSON.stringify(article.topics),
          x_explanation: article.meta?.x_explanation ?? '',
          y_explanation: article.meta?.y_explanation ?? '',
        },
      });
    };

    if (isSavedPage) {
      openArticle();
      return;
    }

    router.back();
    setTimeout(openArticle, 0);
  };

  const stopRowPress = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
  };

  const filteredArticles = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return articles;

    return articles.filter((article) => {
      const searchable = [
        article.title,
        article.lede,
        article.publisher?.name ?? '',
      ].join(' ').toLowerCase();

      return searchable.includes(trimmed);
    });
  }, [articles, searchQuery]);

  const countLabel = `${filteredArticles.length} ${filteredArticles.length === 1 ? 'article' : 'articles'}${searchQuery.trim() ? ' found' : ''}`;

  const formatSavedDate = (savedAt: string) => (
    new Date(savedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );

  if (isGuestMode || !user) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <View style={s.headerTitleRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="arrow-back" size={20} color={c.text} />
          </TouchableOpacity>
          <View style={[s.headerIconWrap, { backgroundColor: `${c.tint}18` }]}>
            <Ionicons name="bookmark" size={16} color={c.tint} />
          </View>
          <Text style={[s.title, { color: c.text }]}>Saved Articles</Text>
        </View>
        {!isSavedPage ? (
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.done, { color: c.tint }]}>Done</Text>
          </TouchableOpacity>
        ) : <View style={s.doneSpacer} />}
      </View>

      <View style={s.searchSection}>
        <View style={[s.searchShell, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search your collection..."
            placeholderTextColor={c.textMuted}
            style={[s.searchInput, { color: c.text }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={s.clearButton}>
              <Text style={[s.clearText, { color: c.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!loading ? (
        <View style={s.countRow}>
          <Text style={[s.countText, { color: c.textMuted }]}>{countLabel}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : filteredArticles.length === 0 ? (
        <View style={s.empty}>
          <View style={[s.emptyIconWrap, { backgroundColor: `${c.tint}12` }]}>
            <Ionicons
              name={searchQuery.trim() ? 'search-outline' : 'bookmark'}
              size={34}
              color={c.tint}
            />
          </View>
          <Text style={[s.emptyText, { color: c.textSecondary }]}>
            {searchQuery.trim() ? 'No results found' : 'No saved articles yet'}
          </Text>
          <Text style={[s.emptyHint, { color: c.textMuted }]}>
            {searchQuery.trim()
              ? `We couldn't find any articles matching "${searchQuery.trim()}".`
              : 'Articles you save will appear here for easy access later.'}
          </Text>
          {searchQuery.trim() ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={[s.emptyAction, { borderColor: c.border, backgroundColor: c.card }]}
            >
              <Text style={[s.emptyActionText, { color: c.text }]}>Clear search</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filteredArticles}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.row, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => openSavedArticle(item)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
            >
              {item.image_url && !failedImages[item.id] ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={[s.thumbnail, { backgroundColor: c.background }]}
                  resizeMode="cover"
                  onError={() => {
                    setFailedImages((previous) => ({ ...previous, [item.id]: true }));
                  }}
                />
              ) : (
                <View style={[s.thumbnailFallback, { backgroundColor: c.background }]}>
                  <Ionicons name="newspaper-outline" size={25} color={c.textMuted} />
                </View>
              )}
              <View style={s.copy}>
                <View style={s.metaRow}>
                  <Text style={[s.publisher, { color: c.tint }]}>
                    {item.publisher?.name ?? 'Unknown'}
                  </Text>
                  <Text style={[s.metaDot, { color: c.textMuted }]}>·</Text>
                  <Text style={[s.date, { color: c.textMuted }]}>
                    {formatSavedDate(item.saved_at)}
                  </Text>
                </View>
                <Text style={[s.articleTitle, { color: c.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.lede ? (
                  <Text style={[s.lede, { color: c.textMuted }]} numberOfLines={1}>
                    {item.lede}
                  </Text>
                ) : null}
                <View style={s.rowFooter}>
                  <View style={[s.contextCue, { backgroundColor: `${c.tint}10` }]}>
                    <Ionicons name="eye-outline" size={12} color={c.tint} />
                    <Text style={[s.contextCueText, { color: c.textSecondary }]}>
                      Praxis context
                    </Text>
                  </View>
                  <View style={s.rowFooterActions}>
                    <TouchableOpacity
                      onPress={(event) => {
                        stopRowPress(event);
                        void unsave(item.id);
                      }}
                      style={s.unsaveButton}
                      accessibilityLabel={`Remove ${item.title} from saved stories`}
                    >
                      <Ionicons name="bookmark" size={16} color={c.bookmarkActive} />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={17} color={c.textMuted} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {!loading && !searchQuery.trim() ? (
        <View style={s.footerNote}>
          <Text style={[s.footerText, { color: c.textMuted }]}>
            {isGuestMode || !user
              ? 'Bookmarks are being saved on this device in guest mode.'
              : 'Bookmarks stay available locally and will sync to your account when possible.'}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  done: { fontSize: 16 },
  doneSpacer: { width: 44 },
  searchSection: { paddingHorizontal: 20, paddingBottom: 8 },
  searchShell: {
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  clearButton: { paddingHorizontal: 4, paddingVertical: 2 },
  clearText: { fontSize: 12, fontWeight: '600' },
  countRow: { paddingHorizontal: 20, paddingBottom: 10 },
  countText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 96, paddingHorizontal: 28, gap: 12 },
  emptyIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 22, fontWeight: '700' },
  emptyHint: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 290 },
  emptyAction: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyActionText: { fontSize: 14, fontWeight: '600' },
  footerNote: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  footerText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  row: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 13,
    minHeight: 126,
    shadowColor: '#2E2A25',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },
  thumbnail: {
    width: 108,
    borderRadius: 14,
  },
  thumbnailFallback: {
    width: 108,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 7, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  publisher: { flexShrink: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.35 },
  metaDot: { fontSize: 14, lineHeight: 14 },
  articleTitle: { fontSize: 16.5, fontWeight: '800', lineHeight: 21, letterSpacing: -0.25 },
  lede: { fontSize: 12.5, lineHeight: 18 },
  date: { fontSize: 11, fontWeight: '500' },
  rowFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contextCue: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  contextCueText: { fontSize: 10.5, fontWeight: '700' },
  rowFooterActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  unsaveButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
