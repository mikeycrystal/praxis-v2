import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';

export default function LeaderboardModal() {
  const { c } = useTheme();
  const { user } = useAuth();
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
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Leaderboard</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.done, { color: c.tint }]}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item, index }) => {
            const isMe = item.id === user?.id;
            return (
              <TouchableOpacity
                style={[
                  s.row,
                  { backgroundColor: isMe ? c.tint + '15' : c.card, borderColor: isMe ? c.tint + '50' : c.border },
                ]}
                onPress={() => router.push({ pathname: '/modal/user-profile', params: { userId: item.id } })}
              >
                <Text style={[s.rank, { color: index < 3 ? c.text : c.textMuted }]}>
                  {index < 3 ? medals[index] : `${index + 1}`}
                </Text>
                <View style={[s.avatar, { backgroundColor: c.secondary }]}>
                  {item.avatar_url
                    ? <Image source={{ uri: item.avatar_url }} style={s.avatarImg} />
                    : <Text style={{ color: c.textMuted, fontWeight: '600' }}>
                        {(item.full_name ?? item.username ?? '?')[0].toUpperCase()}
                      </Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: c.text }]}>
                    {item.full_name ?? item.username ?? 'Anonymous'}{isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={[s.streak, { color: c.textMuted }]}>🔥 {item.reading_streak} day streak</Text>
                </View>
                <Text style={[s.count, { color: c.tint }]}>{item.articles_read}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  done: { fontSize: 16 },
  list: { paddingHorizontal: 16, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  rank: { width: 28, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 38, height: 38 },
  name: { fontSize: 15, fontWeight: '600' },
  streak: { fontSize: 12, marginTop: 2 },
  count: { fontSize: 20, fontWeight: '800' },
});
