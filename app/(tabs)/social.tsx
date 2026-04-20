import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface FollowUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  articles_read: number;
  reading_streak: number;
}

export default function SocialScreen() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(id, full_name, username, avatar_url, articles_read, reading_streak)')
      .eq('follower_id', user.id);
    if (data) setFollowing(data.map((r: any) => r.profiles).filter(Boolean));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFollowing(); }, [fetchFollowing]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Following</Text>
        <TouchableOpacity onPress={() => router.push('/modal/search')}>
          <Text style={[s.findBtn, { color: c.tint }]}>Find people</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : following.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 44 }}>👥</Text>
          <Text style={[s.emptyTitle, { color: c.text }]}>No one here yet</Text>
          <Text style={[s.emptyBody, { color: c.textSecondary }]}>
            Find and follow people to see what they're reading.
          </Text>
          <TouchableOpacity
            style={[s.findBigBtn, { backgroundColor: c.tint }]}
            onPress={() => router.push('/modal/search')}
          >
            <Text style={{ color: c.tintForeground, fontWeight: '600', fontSize: 15 }}>Find People</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.userRow, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push({ pathname: '/modal/user-profile', params: { userId: item.id } })}
            >
              <View style={[s.avatar, { backgroundColor: c.secondary }]}>
                {item.avatar_url
                  ? <Image source={{ uri: item.avatar_url }} style={s.avatarImg} />
                  : <Text style={[s.avatarInitial, { color: c.textSecondary }]}>
                      {(item.full_name ?? item.username ?? '?')[0].toUpperCase()}
                    </Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.userName, { color: c.text }]}>
                  {item.full_name ?? item.username ?? 'Anonymous'}
                </Text>
                <Text style={[s.userStats, { color: c.textMuted }]}>
                  {item.articles_read} articles · 🔥 {item.reading_streak} day streak
                </Text>
              </View>
              <Text style={{ color: c.textMuted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={s.list}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700' },
  findBtn: { fontSize: 14, fontWeight: '500' },
  list: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 44, height: 44 },
  avatarInitial: { fontSize: 18, fontWeight: '600' },
  userName: { fontSize: 15, fontWeight: '600' },
  userStats: { fontSize: 12, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  findBigBtn: { height: 48, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
