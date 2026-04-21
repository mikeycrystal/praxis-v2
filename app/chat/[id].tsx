import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, SafeAreaView,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface OtherUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

function conversationId(a: string, b: string) {
  return [a, b].sort().join('_');
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const { c } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const convId = user ? conversationId(user.id, userId) : '';

  // Load other user profile
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data }) => setOtherUser(data));
  }, [userId]);

  // Load message history
  const loadMessages = useCallback(async () => {
    if (!convId) return;
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at, read_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
    setLoading(false);

    // Mark received messages as read
    if (user && data) {
      const unreadIds = data
        .filter((m: Message) => m.sender_id !== user.id && !m.read_at)
        .map((m: Message) => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
    }
  }, [convId, user]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`chat:${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
          // Mark as read if it's from the other user
          if (user && newMsg.sender_id !== user.id) {
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [convId, user]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const send = async () => {
    if (!user || !body.trim() || sending) return;
    const text = body.trim();
    setBody('');
    setSending(true);
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      recipient_id: userId,
      body: text,
    });
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const prev = index > 0 ? messages[index - 1] : null;
    const showDate = !prev || new Date(item.created_at).toDateString() !== new Date(prev.created_at).toDateString();

    return (
      <>
        {showDate && (
          <Text style={[s.dateSep, { color: c.textMuted }]}>
            {new Date(item.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        )}
        <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
          {!isMe && (
            <View style={[s.avatarSm, { backgroundColor: c.secondary }]}>
              {otherUser?.avatar_url
                ? <Image source={{ uri: otherUser.avatar_url }} style={s.avatarSmImg} />
                : <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {(otherUser?.full_name ?? otherUser?.username ?? '?')[0]?.toUpperCase()}
                  </Text>
              }
            </View>
          )}
          <View style={[
            s.bubble,
            isMe
              ? { backgroundColor: c.tint, borderBottomRightRadius: 4 }
              : { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          ]}>
            <Text style={[s.bubbleText, { color: isMe ? c.tintForeground : c.text }]}>{item.body}</Text>
            <Text style={[s.bubbleTime, { color: isMe ? c.tintForeground + 'AA' : c.textMuted }]}>
              {formatTime(item.created_at)}{isMe && item.read_at ? ' ✓✓' : isMe ? ' ✓' : ''}
            </Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={[s.backText, { color: c.tint }]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.headerUser}
          onPress={() => router.push({ pathname: '/modal/user-profile', params: { userId } })}
        >
          <View style={[s.avatarSm, { backgroundColor: c.secondary }]}>
            {otherUser?.avatar_url
              ? <Image source={{ uri: otherUser.avatar_url }} style={s.avatarSmImg} />
              : <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {(otherUser?.full_name ?? otherUser?.username ?? '?')[0]?.toUpperCase() ?? '?'}
                </Text>
            }
          </View>
          <Text style={[s.headerName, { color: c.text }]}>
            {otherUser?.full_name ?? otherUser?.username ?? 'User'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={s.messageList}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={[s.emptyText, { color: c.textMuted }]}>
                Say hello to {otherUser?.full_name ?? 'them'}!
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[s.inputRow, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <TextInput
            style={[s.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
            placeholder="Message..."
            placeholderTextColor={c.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            onSubmitEditing={send}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: body.trim() ? c.tint : c.secondary }]}
            onPress={send}
            disabled={!body.trim() || sending}
          >
            <Text style={{ color: body.trim() ? c.tintForeground : c.textMuted, fontSize: 18 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, lineHeight: 32 },
  headerUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerName: { fontSize: 16, fontWeight: '600' },
  avatarSm: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarSmImg: { width: 34, height: 34 },
  messageList: { padding: 16, gap: 4, flexGrow: 1 },
  dateSep: { textAlign: 'center', fontSize: 11, marginVertical: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, gap: 3 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTime: { fontSize: 10, alignSelf: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 14 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, gap: 10,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
