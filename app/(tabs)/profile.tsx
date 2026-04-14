import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, useColorScheme, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius, Shadows } from '@/constants/Theme';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', profile.id)
      .then(({ data }) => { if (data) setBadges(data); });
  }, [profile]);

  if (!profile) return null;

  const streakPercent = Math.min((profile.articles_read % profile.daily_goal) / profile.daily_goal, 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: c.text }]}>Profile</Text>
          <TouchableOpacity onPress={() => router.push('/modal/saved-articles')}>
            <Text style={{ color: c.tint, fontSize: 22 }}>🔖</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar + Name */}
        <View style={styles.profileSection}>
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

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: c.text }]}>{profile.articles_read}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Read</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.border }]} />
            <TouchableOpacity style={styles.stat} onPress={() => router.push('/modal/leaderboard')}>
              <Text style={[styles.statNum, { color: c.text }]}>{profile.followers_count}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Followers</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: c.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: c.text }]}>{profile.following_count}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Following</Text>
            </View>
          </View>
        </View>

        {/* Streak */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, Shadows.subtle]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Reading Streak</Text>
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </View>
          <Text style={[styles.streakNum, { color: c.tint }]}>{profile.reading_streak} days</Text>
          <View style={[styles.progressBg, { backgroundColor: c.secondary }]}>
            <View style={[styles.progressFill, { backgroundColor: c.tint, width: `${streakPercent * 100}%` }]} />
          </View>
          <Text style={[styles.goalText, { color: c.textSecondary }]}>
            Daily goal: {profile.articles_read % profile.daily_goal}/{profile.daily_goal} articles
          </Text>
        </View>

        {/* Badges */}
        {badges.length > 0 && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, Shadows.subtle]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Badges</Text>
            <View style={styles.badgeGrid}>
              {badges.map(b => (
                <View key={b.id} style={[styles.badge, { backgroundColor: c.secondary }]}>
                  <Text style={{ fontSize: 24 }}>{b.badges?.icon ?? '🏅'}</Text>
                  <Text style={[styles.badgeName, { color: c.textSecondary }]} numberOfLines={1}>
                    {b.badges?.name ?? 'Badge'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Leaderboard link */}
        <TouchableOpacity
          style={[styles.leaderboardBtn, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push('/modal/leaderboard')}
        >
          <Text style={{ fontSize: 20 }}>🏆</Text>
          <Text style={[styles.leaderboardText, { color: c.text }]}>View Leaderboard</Text>
          <Text style={{ color: c.textMuted }}>›</Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: c.border }]}
          onPress={signOut}
        >
          <Text style={[styles.signOutText, { color: c.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  profileSection: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing['2xl'] },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: Spacing.md },
  avatarImg: { width: 80, height: 80 },
  avatarInitial: { fontSize: Typography.size['3xl'], fontWeight: Typography.weight.bold },
  name: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, marginBottom: Spacing.xs },
  bio: { fontSize: Typography.size.sm, textAlign: 'center', marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, marginTop: Spacing.md },
  stat: { alignItems: 'center' },
  statNum: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  statLabel: { fontSize: Typography.size.xs },
  statDivider: { width: 1, height: 30 },
  card: {
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  streakNum: { fontSize: Typography.size['3xl'], fontWeight: Typography.weight.extrabold },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  goalText: { fontSize: Typography.size.xs },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  badge: { alignItems: 'center', width: 64, padding: Spacing.sm, borderRadius: Radius.md, gap: 4 },
  badgeName: { fontSize: 10, textAlign: 'center' },
  leaderboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  leaderboardText: { flex: 1, fontSize: Typography.size.base, fontWeight: Typography.weight.medium },
  signOutBtn: {
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing['4xl'],
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  signOutText: { fontSize: Typography.size.base, fontWeight: Typography.weight.medium },
});
