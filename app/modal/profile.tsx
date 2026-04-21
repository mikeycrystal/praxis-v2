import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function ProfileModal() {
  const { profile } = useAuth();
  const { c } = useTheme();

  if (!profile) return null;

  const initial = (profile.full_name ?? profile.username ?? '?')[0]?.toUpperCase();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.done, { color: c.tint }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: c.secondary }]}>
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
            : <Text style={[s.avatarInitial, { color: c.text }]}>{initial}</Text>
          }
        </View>

        <Text style={[s.name, { color: c.text }]}>
          {profile.full_name ?? profile.username ?? 'You'}
        </Text>
        {profile.bio && (
          <Text style={[s.bio, { color: c.textSecondary }]}>{profile.bio}</Text>
        )}

        {/* Stats */}
        <View style={[s.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
          {[
            { label: 'Read', value: profile.articles_read ?? 0 },
            { label: 'Streak', value: `${profile.reading_streak ?? 0}🔥` },
            { label: 'Followers', value: profile.followers_count ?? 0 },
          ].map((stat, i, arr) => (
            <View
              key={stat.label}
              style={[
                s.stat,
                i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: c.border },
              ]}
            >
              <Text style={[s.statNum, { color: c.tint }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <View style={s.actions}>
          {[
            { icon: '👤', label: 'Full Profile', route: '/(tabs)/profile' as const },
            { icon: '📊', label: 'Reading Activity', route: '/modal/reading-activity' as const },
            { icon: '🔖', label: 'Saved Articles', route: '/modal/saved-articles' as const },
            { icon: '🏆', label: 'Leaderboard', route: '/modal/leaderboard' as const },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[s.actionRow, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => { router.back(); router.push(item.route as any); }}
            >
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <Text style={[s.actionLabel, { color: c.text }]}>{item.label}</Text>
              <Text style={{ color: c.textMuted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 14 },
  done: { fontSize: 16 },
  content: { alignItems: 'center', paddingHorizontal: 24, gap: 14, paddingBottom: 32 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 88, height: 88 },
  avatarInitial: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700' },
  bio: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  statsCard: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', width: '100%',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  actions: { width: '100%', gap: 8 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
});
