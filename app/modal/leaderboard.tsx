import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

type LeaderboardTab = 'streaks' | 'readers' | 'friends';

interface LeaderboardProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  articles_read: number | null;
  reading_streak: number | null;
  current_streak?: number | null;
}

const PAGE = {
  background: '#F7F3EA',
  card: '#FBF7F0',
  surface: '#FFFDFC',
  secondary: '#EFE6D6',
  text: '#2E2A25',
  textMuted: '#8E857A',
  border: '#E7DEC9',
  tint: '#8EAF72',
};

const TAB_COPY: Record<LeaderboardTab, { label: string; icon: keyof typeof Ionicons.glyphMap; helper: string }> = {
  streaks: { label: 'Streaks', icon: 'flame-outline', helper: 'Top current streaks across Praxis' },
  readers: { label: 'Readers', icon: 'book-outline', helper: 'Top readers by total articles read' },
  friends: { label: 'Friends', icon: 'people-outline', helper: 'Reading streaks for people you follow' },
};

export default function LeaderboardModal() {
  const { isGuestMode, loading: authLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('streaks');
  const [profiles, setProfiles] = useState<LeaderboardProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (isGuestMode || !user) {
      router.replace({ pathname: '/login', params: { returnTo: '/profile' } });
    }
  }, [authLoading, isGuestMode, user]);

  const loadLeaderboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (isGuestMode || !user) {
        setProfiles([]);
        return;
      }

      if (activeTab === 'friends') {
        const { data: follows, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        if (followsError) throw followsError;

        const friendIds = (follows ?? []).map((entry: any) => entry.following_id).filter(Boolean);
        if (friendIds.length === 0) {
          setProfiles([]);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, articles_read, reading_streak, current_streak')
          .in('id', friendIds)
          .order('current_streak', { ascending: false })
          .limit(10);
        if (error) throw error;
        setProfiles((data ?? []) as LeaderboardProfile[]);
        return;
      }

      const orderColumn = activeTab === 'readers' ? 'articles_read' : 'current_streak';
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, articles_read, reading_streak, current_streak')
        .order(orderColumn, { ascending: false })
        .limit(10);
      if (error) throw error;
      setProfiles((data ?? []) as LeaderboardProfile[]);
    } catch (error) {
      console.warn('[Leaderboard] Failed to load leaderboard', error);
      setProfiles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, isGuestMode, user]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const statValue = (profile: LeaderboardProfile) => (
    activeTab === 'readers'
      ? profile.articles_read ?? 0
      : profile.current_streak ?? profile.reading_streak ?? 0
  );

  if (authLoading || isGuestMode || !user) return null;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color={PAGE.text} />
        </TouchableOpacity>
        <View style={s.headerTitleRow}>
          <Ionicons name="trophy-outline" size={28} color={PAGE.tint} />
          <View>
            <Text style={s.title}>Leaderboard</Text>
            <Text style={s.subtitle}>Global streaks, top readers, and friends</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.refreshButton}
          onPress={() => void loadLeaderboard(true)}
          disabled={refreshing}
          accessibilityLabel="Refresh leaderboard"
        >
          {refreshing
            ? <ActivityIndicator color={PAGE.text} size="small" />
            : <Ionicons name="refresh-outline" size={18} color={PAGE.text} />}
        </TouchableOpacity>
      </View>

      <View style={s.tabList}>
        {(Object.keys(TAB_COPY) as LeaderboardTab[]).map((tab) => {
          const selected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, selected && s.selectedTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons name={TAB_COPY[tab].icon} size={15} color={selected ? PAGE.text : PAGE.textMuted} />
              <Text style={[s.tabText, selected && s.selectedTabText]}>{TAB_COPY[tab].label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.helper}>{TAB_COPY[activeTab].helper}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={PAGE.tint} style={s.loader} />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.list, profiles.length === 0 && s.emptyList]}
          ListEmptyComponent={(
            <View style={s.emptyState}>
              <Ionicons
                name={activeTab === 'friends' ? 'people-outline' : 'trophy-outline'}
                size={34}
                color={PAGE.tint}
              />
              <Text style={s.emptyTitle}>
                {activeTab === 'friends' ? 'Follow a few readers' : 'No rankings yet'}
              </Text>
              <Text style={s.emptyText}>
                {activeTab === 'friends'
                  ? 'People you follow will appear in this leaderboard.'
                  : 'Reading activity will populate this leaderboard.'}
              </Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const isMe = item.id === user?.id;
            const displayName = item.full_name ?? item.username ?? 'Praxis reader';
            const value = statValue(item);
            return (
              <TouchableOpacity
                style={[s.row, isMe && s.meRow]}
                onPress={() => router.push({ pathname: '/modal/user-profile', params: { userId: item.id } })}
                activeOpacity={0.8}
              >
                <View style={[s.rankCircle, index < 3 && s.topRankCircle]}>
                  <Text style={[s.rank, index < 3 && s.topRank]}>{index + 1}</Text>
                </View>
                <View style={s.avatar}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={s.avatarImage} />
                  ) : (
                    <Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={s.profileCopy}>
                  <Text style={s.name} numberOfLines={1}>{displayName}{isMe ? ' (you)' : ''}</Text>
                  <Text style={s.username}>@{item.username ?? 'reader'}</Text>
                </View>
                <View style={s.statWrap}>
                  <Ionicons
                    name={activeTab === 'readers' ? 'book-outline' : 'flame-outline'}
                    size={15}
                    color={PAGE.tint}
                  />
                  <Text style={s.stat}>{value}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE.background },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PAGE.border,
    backgroundColor: PAGE.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: PAGE.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: PAGE.textMuted, fontSize: 10, marginTop: 3 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PAGE.border,
    backgroundColor: PAGE.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabList: { marginHorizontal: 18, padding: 5, borderRadius: 16, backgroundColor: '#DDD5C7', flexDirection: 'row', gap: 4 },
  tab: { flex: 1, borderRadius: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  selectedTab: { backgroundColor: PAGE.surface, borderWidth: 1, borderColor: PAGE.border },
  tabText: { color: PAGE.textMuted, fontSize: 12, fontWeight: '700' },
  selectedTabText: { color: PAGE.text },
  helper: { color: PAGE.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 18, marginBottom: 10 },
  loader: { flex: 1 },
  list: { paddingHorizontal: 18, paddingBottom: 30, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PAGE.border,
    backgroundColor: PAGE.card,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  meRow: { borderColor: '#B9CDA8', backgroundColor: '#F1F5E9' },
  rankCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: PAGE.secondary, alignItems: 'center', justifyContent: 'center' },
  topRankCircle: { backgroundColor: '#E4ECD8' },
  rank: { color: PAGE.textMuted, fontSize: 12, fontWeight: '800' },
  topRank: { color: '#688650' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E7E0D4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarInitial: { color: PAGE.tint, fontSize: 17, fontWeight: '800' },
  profileCopy: { flex: 1 },
  name: { color: PAGE.text, fontSize: 14, fontWeight: '700' },
  username: { color: PAGE.textMuted, fontSize: 11, marginTop: 3 },
  statWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { color: PAGE.tint, fontSize: 18, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingHorizontal: 42 },
  emptyTitle: { color: PAGE.text, fontSize: 20, fontWeight: '800', marginTop: 16 },
  emptyText: { color: PAGE.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
});
