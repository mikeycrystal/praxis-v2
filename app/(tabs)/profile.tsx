import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Image, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const { c, Radius, Shadows } = useTheme();
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', profile.id)
      .then(({ data }) => { if (data) setBadges(data); });
  }, [profile]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.rpc('delete_current_user');
            await signOut();
          },
        },
      ]
    );
  };

  if (!profile) return null;

  const joinDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.backText, { color: c.tint }]}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        {/* Profile header */}
        <View style={s.profileSection}>
          <TouchableOpacity onPress={() => router.push('/modal/edit-profile')}>
            <View style={[s.avatar, { backgroundColor: c.secondary }]}>
              {profile.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
                : <Text style={[s.avatarInitial, { color: c.text }]}>
                    {(profile.full_name ?? profile.username ?? '?')[0]?.toUpperCase()}
                  </Text>
              }
            </View>
          </TouchableOpacity>
          <Text style={[s.name, { color: c.text }]}>
            {profile.full_name ?? profile.username ?? 'Anonymous'}
          </Text>
          <Text style={[s.email, { color: c.textMuted }]}>
            Joined {joinDate}
          </Text>
          {profile.bio && (
            <Text style={[s.bio, { color: c.textSecondary }]}>{profile.bio}</Text>
          )}
        </View>

        {/* Reading stats */}
        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.cardLabel, { color: c.textMuted }]}>READING STATS</Text>
          <View style={s.statsGrid}>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: c.text }]}>{profile.articles_read ?? 0}</Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Articles Read</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: c.border }]} />
            <View style={s.stat}>
              <Text style={[s.statNum, { color: c.text }]}>{badges.length}</Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Bookmarked</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: c.border }]} />
            <View style={s.stat}>
              <Text style={[s.statNum, { color: c.text }]}>{profile.reading_streak ?? 0}</Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Day Streak</Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.cardLabel, { color: c.textMuted }]}>QUICK ACTIONS</Text>
          {[
            { icon: '🔔', label: 'Notifications', onPress: () => {} },
            { icon: '📚', label: 'Reading Preferences', onPress: () => router.push('/(tabs)/topics') },
            { icon: '🔒', label: 'Privacy Settings', onPress: () => {} },
            { icon: 'ℹ️', label: 'About Praxis', onPress: () => {} },
          ].map(({ icon, label, onPress }) => (
            <TouchableOpacity
              key={label}
              style={[s.actionRow, { borderTopColor: c.border }]}
              onPress={onPress}
            >
              <Text style={{ fontSize: 18 }}>{icon}</Text>
              <Text style={[s.actionLabel, { color: c.textSecondary }]}>{label}</Text>
              <Text style={[s.actionChevron, { color: c.textMuted }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Badges */}
        {badges.length > 0 && (
          <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.cardLabel, { color: c.textMuted }]}>BADGES</Text>
            <View style={s.badgeGrid}>
              {badges.map(b => (
                <View key={b.id} style={[s.badge, { backgroundColor: c.secondary }]}>
                  <Text style={{ fontSize: 22 }}>{b.badges?.icon ?? '🏅'}</Text>
                  <Text style={[s.badgeName, { color: c.textMuted }]} numberOfLines={1}>
                    {b.badges?.name ?? 'Badge'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Account actions */}
        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.cardLabel, { color: c.textMuted }]}>ACCOUNT</Text>
          <TouchableOpacity
            style={[s.actionRow, { borderTopColor: c.border }]}
            onPress={() => router.push('/modal/edit-profile')}
          >
            <Text style={{ fontSize: 18 }}>✏️</Text>
            <Text style={[s.actionLabel, { color: c.textSecondary }]}>Edit Profile</Text>
            <Text style={[s.actionChevron, { color: c.textMuted }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionRow, { borderTopColor: c.border }]}
            onPress={() => router.push('/modal/change-password')}
          >
            <Text style={{ fontSize: 18 }}>🔑</Text>
            <Text style={[s.actionLabel, { color: c.textSecondary }]}>Change Password</Text>
            <Text style={[s.actionChevron, { color: c.textMuted }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionRow, { borderTopColor: c.border }]}
            onPress={signOut}
          >
            <Text style={{ fontSize: 18 }}>🚪</Text>
            <Text style={[s.actionLabel, { color: c.textSecondary }]}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionRow, { borderTopColor: c.border }]}
            onPress={handleDeleteAccount}
          >
            <Text style={{ fontSize: 18 }}>🗑️</Text>
            <Text style={[s.actionLabel, { color: c.destructive }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  backText: { fontSize: 17 },
  profileSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 96, height: 96 },
  avatarInitial: { fontSize: 36, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 13 },
  bio: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  statsGrid: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 36 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  actionLabel: { flex: 1, fontSize: 15 },
  actionChevron: { fontSize: 18 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { alignItems: 'center', width: 68, padding: 10, borderRadius: 12, gap: 4 },
  badgeName: { fontSize: 10, textAlign: 'center' },
});
