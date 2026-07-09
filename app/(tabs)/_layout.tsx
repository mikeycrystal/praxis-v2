import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Platform, View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

function GraphTabIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Line x1="13" y1="5.3" x2="13" y2="20.7" stroke={color} strokeWidth="1.9" strokeLinecap="round" opacity="0.95" />
      <Line x1="5.3" y1="13" x2="20.7" y2="13" stroke={color} strokeWidth="1.9" strokeLinecap="round" opacity="0.95" />
      <Circle cx="13" cy="13" r="2.1" fill={color} opacity="0.96" />
      <Line x1="13" y1="3.4" x2="13" y2="4.8" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <Line x1="3.4" y1="13" x2="4.8" y2="13" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <Line x1="21.2" y1="13" x2="22.6" y2="13" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <Line x1="18.2" y1="6.9" x2="18.2" y2="9.1" stroke={color} strokeWidth="1.35" strokeLinecap="round" opacity="0.82" />
      <Line x1="17.1" y1="8" x2="19.3" y2="8" stroke={color} strokeWidth="1.35" strokeLinecap="round" opacity="0.82" />
    </Svg>
  );
}

function TabIconFrame({
  focused,
  children,
  tint,
}: {
  focused: boolean;
  children: React.ReactNode;
  tint: string;
}) {
  return (
    <View
      style={{
        width: 34,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 2,
      }}
    >
      {children}
      {focused ? (
        <View
          style={{
            position: 'absolute',
            bottom: -9,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: tint,
          }}
        />
      ) : null}
    </View>
  );
}

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
    ...Colors.light,
    background: '#F7F3EA',
    card: '#F7F3EA',
    border: '#E7DEC9',
    tint: '#8DAE73',
    tabIconDefault: '#73706A',
  };
  const socialBadge = useSocialBadge();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#F7F3EA',
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: Platform.select({ web: 78, default: 84 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ web: 12, default: 24 }),
        },
        tabBarActiveTintColor: c.tint,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Feed',
          title: 'News',
          tabBarIcon: ({ color, focused }) => (
            <TabIconFrame focused={focused} tint={c.tint}>
              <Ionicons name="newspaper-outline" size={22} color={color} />
            </TabIconFrame>
          ),
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          tabBarAccessibilityLabel: 'Preferences',
          title: 'Preferences',
          tabBarIcon: ({ color, focused }) => (
            <TabIconFrame focused={focused} tint={c.tint}>
              <GraphTabIcon color={color} />
            </TabIconFrame>
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
