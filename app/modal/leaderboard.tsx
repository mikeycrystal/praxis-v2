import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, useColorScheme, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius } from '@/constants/Theme';

export default function LeaderboardModal() {
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, articles_read, reading_streak')
      .order('articles_read', { ascending: false })
      .limit(50)
      .then(({ data }) => { setUsers(data ?? []); setLoading(false); });
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Leaderboard</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.close, { color: c.tint }]}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push({ pathname: '/modal/user-profile', params: { userId: item.id } })}
            >
              <Text style={styles.rank}>
                {index < 3 ? medals[index] : `${index + 1}`}
              </Text>
              <View style={[styles.avatar, { backgroundColor: c.secondary }]}>
                {item.avatar_url
                  ? <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                  : <Text style={{ color: c.textSecondary, fontWeight: '600' }}>
                      {(item.full_name ?? item.username ?? '?')[0].toUpperCase()}
                    </Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]}>
                  {item.full_name ?? item.username ?? 'Anonymous'}
                </Text>
                <Text style={[styles.streak, { color: c.textSecondary }]}>
                  🔥 {item.reading_streak} day streak
                </Text>
              </View>
              <Text style={[styles.count, { color: c.tint }]}>{item.articles_read}</Text>
            </TouchableOpacity>
          )}
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
  close: { fontSize: Typography.size.base },
  list: { paddingHorizontal: Spacing['2xl'], gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  rank: { width: 28, textAlign: 'center', fontSize: Typography.size.lg },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 36, height: 36 },
  name: { fontSize: Typography.size.base, fontWeight: Typography.weight.medium },
  streak: { fontSize: Typography.size.xs, marginTop: 2 },
  count: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
});
