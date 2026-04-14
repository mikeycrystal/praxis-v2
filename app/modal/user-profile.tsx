import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, useColorScheme, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius, Shadows } from '@/constants/Theme';

export default function UserProfileModal() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        user ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', userId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setProfile(p);
      setIsFollowing(!!f);
      setLoading(false);
    };
    fetch();
  }, [userId, user]);

  const toggleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: c.tint, fontSize: Typography.size.lg }}>‹ Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.avatar, { backgroundColor: c.secondary }]}>
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            : <Text style={[styles.avatarInitial, { color: c.text }]}>
                {(profile.full_name ?? profile.username ?? '?')[0]?.toUpperCase()}
              </Text>
          }
        </View>
        <Text style={[styles.name, { color: c.text }]}>
          {profile.full_name ?? profile.username ?? 'Anonymous'}
        </Text>
        {profile.bio && (
          <Text style={[styles.bio, { color: c.textSecondary }]}>{profile.bio}</Text>
        )}

        {user?.id !== userId && (
          <TouchableOpacity
            style={[
              styles.followBtn,
              { backgroundColor: isFollowing ? c.secondary : c.tint, borderColor: c.border },
            ]}
            onPress={toggleFollow}
          >
            <Text style={[styles.followBtnText, { color: isFollowing ? c.textSecondary : c.tintForeground }]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: c.text }]}>{profile.articles_read}</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Articles Read</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: c.text }]}>{profile.reading_streak}</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Day Streak</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: c.text }]}>{profile.followers_count}</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Followers</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md },
  content: { alignItems: 'center', paddingHorizontal: Spacing['2xl'], paddingTop: Spacing.xl, gap: Spacing.md },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 88, height: 88 },
  avatarInitial: { fontSize: Typography.size['3xl'], fontWeight: Typography.weight.bold },
  name: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  bio: { fontSize: Typography.size.sm, textAlign: 'center' },
  followBtn: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  followBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
  },
  stat: { alignItems: 'center', flex: 1 },
  statNum: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  statLabel: { fontSize: Typography.size.xs, marginTop: 2 },
  divider: { width: 1, height: 30 },
});
