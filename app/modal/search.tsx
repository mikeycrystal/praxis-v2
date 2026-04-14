import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, useColorScheme, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius } from '@/constants/Theme';

type SearchResult = { type: 'article'; id: number; title: string; publisher: string }
  | { type: 'user'; id: string; full_name: string; username: string; avatar_url: string | null };

export default function SearchModal() {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

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
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TextInput
          style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          placeholder="Search articles, people..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={search}
          autoFocus
        />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancel, { color: c.tint }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={c.tint} style={{ marginTop: Spacing.xl }} />}

      <FlatList
        data={results}
        keyExtractor={item => `${item.type}-${item.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === 'article') {
            return (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => { router.back(); router.push(`/article/${item.id}`); }}
              >
                <Text style={{ fontSize: 16 }}>📰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSub, { color: c.textSecondary }]}>{item.publisher}</Text>
                </View>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => { router.back(); router.push({ pathname: '/modal/user-profile', params: { userId: item.id } }); }}
            >
              <View style={[styles.avatar, { backgroundColor: c.secondary }]}>
                {item.avatar_url
                  ? <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                  : <Text style={{ color: c.textSecondary, fontWeight: '600' }}>
                      {(item.full_name ?? item.username ?? '?')[0].toUpperCase()}
                    </Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: c.text }]}>{item.full_name}</Text>
                <Text style={[styles.rowSub, { color: c.textSecondary }]}>@{item.username}</Text>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, { backgroundColor: c.tint }]}
                onPress={() => follow(item.id)}
              >
                <Text style={{ color: c.tintForeground, fontSize: Typography.size.xs, fontWeight: '600' }}>Follow</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.size.base,
  },
  cancel: { fontSize: Typography.size.base },
  list: { paddingHorizontal: Spacing['2xl'], gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  rowTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.medium },
  rowSub: { fontSize: Typography.size.xs, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 36, height: 36 },
  followBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
});
