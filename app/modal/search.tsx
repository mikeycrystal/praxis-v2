import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

type SearchResult =
  | { type: 'article'; id: number; title: string; publisher: string }
  | { type: 'user'; id: string; full_name: string; username: string; avatar_url: string | null };

export default function SearchModal() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);

    const [{ data: articles }, { data: users }] = await Promise.all([
      supabase
        .from('article')
        .select('id, title, publisher(name)')
        .textSearch('ts_lex', q, { type: 'websearch' })
        .limit(8),
      supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(5),
    ]);

    const articleResults: SearchResult[] = (articles ?? []).map((a: any) => ({
      type: 'article', id: a.id, title: a.title, publisher: a.publisher?.name ?? '',
    }));
    const userResults: SearchResult[] = (users ?? []).map((u: any) => ({
      type: 'user', id: u.id, full_name: u.full_name, username: u.username, avatar_url: u.avatar_url,
    }));

    setResults([...userResults, ...articleResults]);
    setLoading(false);
  };

  const follow = async (userId: string) => {
    if (!user) return;
    await supabase.from('follows').upsert({ follower_id: user.id, following_id: userId });
    setFollowedIds(prev => new Set(prev).add(userId));
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <TextInput
          style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          placeholder="Search articles, people..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={search}
          autoFocus
        />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.cancel, { color: c.tint }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={c.tint} style={{ marginTop: 24 }} />}

      {!loading && query.length >= 2 && results.length === 0 && (
        <Text style={[s.noResults, { color: c.textMuted }]}>No results for "{query}"</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={item => `${item.type}-${item.id}`}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          if (item.type === 'article') {
            return (
              <TouchableOpacity
                style={[s.row, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => { router.back(); router.push(`/article/${item.id}`); }}
              >
                <Text style={{ fontSize: 18 }}>📰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[s.rowSub, { color: c.textMuted }]}>{item.publisher}</Text>
                </View>
              </TouchableOpacity>
            );
          }
          const isFollowed = followedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[s.row, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => { router.back(); router.push({ pathname: '/modal/user-profile', params: { userId: item.id } }); }}
            >
              <View style={[s.avatar, { backgroundColor: c.secondary }]}>
                {item.avatar_url
                  ? <Image source={{ uri: item.avatar_url }} style={s.avatarImg} />
                  : <Text style={{ color: c.textMuted, fontWeight: '600', fontSize: 15 }}>
                      {(item.full_name ?? item.username ?? '?')[0].toUpperCase()}
                    </Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: c.text }]}>{item.full_name}</Text>
                <Text style={[s.rowSub, { color: c.textMuted }]}>@{item.username}</Text>
              </View>
              <TouchableOpacity
                style={[s.followBtn, { backgroundColor: isFollowed ? c.secondary : c.tint }]}
                onPress={() => follow(item.id)}
                disabled={isFollowed}
              >
                <Text style={{ color: isFollowed ? c.textMuted : c.tintForeground, fontSize: 12, fontWeight: '600' }}>
                  {isFollowed ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  input: {
    flex: 1, height: 44, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 16, fontSize: 15,
  },
  cancel: { fontSize: 15 },
  noResults: { textAlign: 'center', marginTop: 32, fontSize: 14 },
  list: { paddingHorizontal: 16, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  rowTitle: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 38, height: 38 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
});
