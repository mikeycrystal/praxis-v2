import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, Image, SectionList,
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

interface Conversation {
  userId: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

type Tab = 'following' | 'messages';

export default function SocialScreen() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('following');
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const fetchFollowing = useCallback(async () => {
    if (!user) return;
    setLoadingFollowing(true);
    const { data } = await supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(id, full_name, username, avatar_url, articles_read, reading_streak)')
      .eq('follower_id', user.id);
    if (data) setFollowing(data.map((r: any) => r.profiles).filter(Boolean));
    setLoadingFollowing(false);
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvs(true);
    // Get latest message per conversation
    const { data } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, recipient_id, body, created_at, read_at')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!data) { setLoadingConvs(false); return; }

    // De-duplicate by conversation_id (keep latest)
    const seen = new Map<string, any>();
    for (const msg of data) {
      if (!seen.has(msg.conversation_id)) seen.set(msg.conversation_id, msg);
    }

    // Resolve the other participant's profile
    const convList: Conversation[] = [];
    let unread = 0;
    for (const msg of seen.values()) {
      const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', otherId)
        .single();
      if (!profile) continue;

      // Count unread in this conversation
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', msg.conversation_id)
        .eq('recipient_id', user.id)
        .is('read_at', null);
      const u = count ?? 0;
      unread += u;
      convList.push({
        userId: otherId,
        full_name: profile.full_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
        lastMessage: msg.body,
        lastAt: msg.created_at,
        unread: u,
      });
    }
    setConversations(convList);
    setUnreadTotal(unread);
    setLoadingConvs(false);
  }, [user]);

  useEffect(() => { fetchFollowing(); }, [fetchFollowing]);
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Realtime: refresh convs when new message arrives
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('social-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, () => { fetchConversations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderFollowUser = ({ item }: { item: FollowUser }) => (
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
      <TouchableOpacity
        style={[s.msgBtn, { backgroundColor: c.secondary }]}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { userId: item.id } })}
      >
        <Text style={{ fontSize: 16 }}>💬</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[s.userRow, { backgroundColor: c.card, borderColor: c.border }]}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { userId: item.userId } })}
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
        <Text style={[s.userStats, { color: item.unread > 0 ? c.text : c.textMuted }]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
      <View style={s.convMeta}>
        <Text style={[s.convTime, { color: c.textMuted }]}>{formatTime(item.lastAt)}</Text>
        {item.unread > 0 && (
          <View style={[s.badge, { backgroundColor: c.tint }]}>
            <Text style={[s.badgeText, { color: c.tintForeground }]}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Social</Text>
        <TouchableOpacity onPress={() => router.push('/modal/search')}>
          <Text style={[s.findBtn, { color: c.tint }]}>Find people</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[s.tabs, { borderBottomColor: c.border }]}>
        {(['following', 'messages'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)}>
            <Text style={[s.tabText, { color: tab === t ? c.tint : c.textMuted }]}>
              {t === 'following' ? 'Following' : 'Messages'}
              {t === 'messages' && unreadTotal > 0 ? ` (${unreadTotal})` : ''}
            </Text>
            {tab === t && <View style={[s.tabLine, { backgroundColor: c.tint }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'following' ? (
        loadingFollowing ? (
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
            renderItem={renderFollowUser}
            contentContainerStyle={s.list}
          />
        )
      ) : (
        loadingConvs ? (
          <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
        ) : conversations.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>💬</Text>
            <Text style={[s.emptyTitle, { color: c.text }]}>No messages yet</Text>
            <Text style={[s.emptyBody, { color: c.textSecondary }]}>
              Follow people and start a conversation.
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
            data={conversations}
            keyExtractor={item => item.userId}
            renderItem={renderConversation}
            contentContainerStyle={s.list}
          />
        )
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabLine: { position: 'absolute', bottom: 0, left: 20, right: 20, height: 2, borderRadius: 1 },
  list: { paddingHorizontal: 16, gap: 8, paddingTop: 12 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 44, height: 44 },
  avatarInitial: { fontSize: 18, fontWeight: '600' },
  userName: { fontSize: 15, fontWeight: '600' },
  userStats: { fontSize: 12, marginTop: 2 },
  msgBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  convMeta: { alignItems: 'flex-end', gap: 4 },
  convTime: { fontSize: 11 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  findBigBtn: { height: 48, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
