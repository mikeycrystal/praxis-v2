import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { GlassTabBar, GraphTabIcon } from '../components/GlassTabBar';

function useSocialBadge() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const fetchUnread = async () => {
    if (!user) {
      setUnread(0);
      return;
    }
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.tint,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarShowLabel: false,
        // Smooth switching: cross-fade between tabs instead of a hard swap,
        // and freeze hidden tabs so their timers/subscriptions can't jank
        // the visible one.
        animation: 'fade',
        freezeOnBlur: true,
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
