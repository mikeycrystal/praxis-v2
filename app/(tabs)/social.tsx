import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, useColorScheme, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius } from '@/constants/Theme';

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
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
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

  const renderUser = ({ item }: { item: FollowUser }) => (
    <TouchableOpacity
      style={[styles.userRow, { backgroundColor: c.card, borderColor: c.border }]}
      onPress={() => router.push({ pathname: '/modal/user-profile', params: { userId: item.id } })}
    >
      <View style={[styles.avatar, { backgroundColor: c.secondary }]}>
        {item.avatar_url
          ? <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
          : <Text style={[styles.avatarInitial, { color: c.textSecondary }]}>
              {(item.full_name ?? item.username ?? '?')[0].toUpperCase()}
            </Text>
        }
      </View>
      <View style={styles.userInfo}>
        <Text style={[styles.name, { color: c.text }]}>
          {item.full_name ?? item.username ?? 'Anonymous'}
        </Text>
        <Text style={[styles.stats, { color: c.textSecondary }]}>
          {item.articles_read} articles · {item.reading_streak} day streak
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Following</Text>
        <TouchableOpacity onPress={() => router.push('/modal/search')}>
          <Text style={[styles.findBtn, { color: c.tint }]}>Find people</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : following.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            You're not following anyone yet.
          </Text>
          <TouchableOpacity onPress={() => router.push('/modal/search')}>
            <Text style={[styles.emptyLink, { color: c.tint }]}>Find people to follow</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={item => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
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
  findBtn: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  list: { paddingHorizontal: Spacing['2xl'], gap: Spacing.sm },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 44, height: 44 },
  avatarInitial: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
  userInfo: { flex: 1 },
  name: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  stats: { fontSize: Typography.size.xs, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: Typography.size.base },
  emptyLink: { fontSize: Typography.size.base, fontWeight: Typography.weight.medium },
});
