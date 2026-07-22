import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const PAGE = {
  background: '#F7F3EA',
  card: '#FBF7F0',
  surface: '#FFFDFC',
  text: '#2E2A25',
  textSecondary: '#5D554C',
  textMuted: '#8E857A',
  border: '#E7DEC9',
  destructive: '#B8513A',
};

export default function AccountSettingsModal() {
  const { isGuestMode, loading, signOut, user } = useAuth();
  const [busyAction, setBusyAction] = useState<'signout' | 'delete' | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isGuestMode || !user) {
      router.replace({ pathname: '/login', params: { returnTo: '/profile' } });
    }
  }, [isGuestMode, loading, user]);

  if (loading || isGuestMode || !user) return null;

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You will be signed out of Praxis on this device and returned to the sign-in screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: async () => {
            setBusyAction('signout');
            try {
              await signOut();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert('Sign out failed', error?.message ?? 'Could not sign out.');
            } finally {
              setBusyAction(null);
            }
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your Praxis account and associated profile data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setBusyAction('delete');
            try {
              const { error } = await supabase.functions.invoke('delete-account', { body: {} });
              if (error) throw error;
              await supabase.auth.signOut();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert('Delete failed', error?.message ?? 'Could not delete your account.');
            } finally {
              setBusyAction(null);
            }
          },
        },
      ],
    );
  };

  const items = [
    {
      id: 'edit',
      label: 'Edit Profile',
      icon: 'pencil-outline' as const,
      onPress: () => router.push('/modal/edit-profile'),
    },
    {
      id: 'password',
      label: 'Change Password',
      icon: 'key-outline' as const,
      onPress: () => router.push('/modal/change-password'),
    },
    {
      id: 'signout',
      label: 'Sign Out',
      icon: 'log-out-outline' as const,
      onPress: confirmSignOut,
    },
    {
      id: 'delete',
      label: 'Delete Account',
      icon: 'trash-outline' as const,
      destructive: true,
      onPress: confirmDelete,
    },
  ];

  return (
    <SafeAreaView style={s.overlay}>
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Text style={s.title}>Account</Text>
            <Text style={s.subtitle}>
              Manage your profile, password, and account settings.
              {user?.email ? ` Signed in as ${user.email}.` : ''}
            </Text>
          </View>
          <TouchableOpacity style={s.closeButton} onPress={() => router.back()} accessibilityLabel="Close account settings">
            <Ionicons name="close" size={22} color={PAGE.text} />
          </TouchableOpacity>
        </View>

        <View style={s.list}>
          {items.map((item, index) => {
            const destructive = Boolean(item.destructive);
            const busy = busyAction === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.row, index > 0 && s.rowBorder]}
                onPress={item.onPress}
                disabled={Boolean(busyAction)}
                activeOpacity={0.78}
              >
                <View style={[s.iconWrap, destructive && s.destructiveIconWrap]}>
                  {busy ? (
                    <ActivityIndicator color={destructive ? PAGE.destructive : PAGE.text} size="small" />
                  ) : (
                    <Ionicons name={item.icon} size={18} color={destructive ? PAGE.destructive : PAGE.text} />
                  )}
                </View>
                <Text style={[s.rowLabel, destructive && s.destructiveText]}>{item.label}</Text>
                {!destructive ? <Ionicons name="chevron-forward" size={20} color={PAGE.textMuted} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(46,42,37,0.22)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PAGE.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: PAGE.border,
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D6CDBE', alignSelf: 'center', marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 22 },
  headerCopy: { flex: 1 },
  title: { color: PAGE.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: PAGE.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PAGE.border,
    backgroundColor: PAGE.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { borderRadius: 24, borderWidth: 1, borderColor: PAGE.border, backgroundColor: PAGE.card, overflow: 'hidden' },
  row: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: PAGE.border },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PAGE.border,
    backgroundColor: PAGE.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveIconWrap: { backgroundColor: '#F7E5E0', borderColor: '#E3B9AE' },
  rowLabel: { flex: 1, color: PAGE.text, fontSize: 17, fontWeight: '600' },
  destructiveText: { color: PAGE.destructive },
});
