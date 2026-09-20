import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { GlassTabBar, GraphTabIcon } from '../components/GlassTabBar';
import { fetchBlockedIds } from '../lib/moderation';

function useSocialBadge() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const fetchUnread = async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    // Keep the exact head count (a row fetch silently caps at PostgREST's
    // 1000-row default) and exclude blocked senders server-side.
    const blockedIds = await fetchBlockedIds(user.id);
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (blockedIds.size > 0) {
      query = query.not('sender_id', 'in', `(${[...blockedIds].map((id) => `"${id}"`).join(',')})`);
    }
    const { count } = await query;
    setUnread(count ?? 0);
  };

  useEffect(() => {
    void fetchUnread();
    if (!user?.id) return;

    const channel = supabase
      .channel(`tab-badge:${user.id}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, () => setUnread(n => n + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, fetchUnread);

    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  return unread;
}

export default function TabsLayout() {
  const c = {
    tint: '#8DAE73',
    tabIconDefault: '#73706A',
  };
  const socialBadge = useSocialBadge();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      // Graph's `lazy: false` pre-ran its JS mount, but react-native-screens
      // still DETACHED the inactive tab's native subtree, so its first tap
      // paid the native side anyway: attaching ~13 logo images + the SVG +
      // dozens of Text nodes, decoding the PNGs, and the first real
      // onLayout — the "glitchy, takes a bit to load" first open (Ayuka,
      // 2026-09-20, msg 1736). Keeping inactive tabs attached moves all of
      // that to launch, off-screen. Only the three lazy:false tabs exist at
      // launch, so the memory cost is bounded; hidden utility tabs stay lazy.
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.tint,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarShowLabel: false,
        // Instant swap, the way Apple's own tab bars switch: the content
        // changes on the tap and only the lens glides. The 130ms cross-fade
        // that was here read as "delayed and laggy" on device (Ayuka,
        // 2026-09-17). A CDP profile of the web export put the switch at
        // 17-19ms of JS with no long task, so the cost was not JS: it was
        // two full screens fading under a liquid-glass bar that re-samples
        // its backdrop every frame, which the web fallback never shows.
        // freezeOnBlur stays off (2026-09-15): unfreezing the Graph tree at
        // tap time was its own lag.
        animation: 'none',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Feed',
          title: 'News',
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          // Mount Graph at startup — the first visit was paying the whole
          // page's build cost right at tap time. Hidden utility tabs stay lazy.
          lazy: false,
          tabBarAccessibilityLabel: 'Preferences',
          title: 'Preferences',
          tabBarIcon: ({ color }) => <GraphTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          href: null,
          tabBarAccessibilityLabel: 'Saved Articles',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          href: null,
          tabBarAccessibilityLabel: 'Social',
          tabBarBadge: socialBadge > 0 ? socialBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: c.tint, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="topics"
        options={{
          href: null,
          tabBarAccessibilityLabel: 'Topics',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
