import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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

const TERMS_URL = 'https://praxisnews.co/terms.html';
const PRIVACY_URL = 'https://praxisnews.co/privacy.html';

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

type SettingsRow = {
  id: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  external?: boolean;
};

export default function AccountSettingsModal() {
  const { isGuestMode, loading, profile, signOut, user } = useAuth();
  const [busyAction, setBusyAction] = useState<'signout' | 'delete' | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isGuestMode || !user) {
      router.replace({ pathname: '/login', params: { returnTo: '/profile' } });
    }
  }, [isGuestMode, loading, user]);

  if (loading || isGuestMode || !user) return null;

  const performSignOut = async () => {
    setBusyAction('signout');
    try {
      await signOut();
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message ?? 'Could not sign out.');
    } finally {
      setBusyAction(null);
    }
  };

  const confirmSignOut = () => {
    // React Native's native alert confirmation is not reliably interactive in
    // the Expo web preview, so let the browser run the same sign-out action.
    if (Platform.OS === 'web') {
      void performSignOut();
      return;
    }

    Alert.alert(
      'Sign out?',
      'You will be signed out of Praxis on this device and returned to the sign-in screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: () => void performSignOut(),
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

  const notifSummary = [
    profile?.notify_digest !== false && 'digest',
    profile?.notify_streak !== false && 'streak',
    profile?.notify_social !== false && 'social',
  ].filter(Boolean);

  const sections: { title: string | null; rows: SettingsRow[] }[] = [
    {
      title: 'ACCOUNT',
      rows: [
        {
          id: 'edit',
          label: 'Edit Profile',
          icon: 'pencil-outline',
          onPress: () => router.push('/modal/edit-profile'),
        },
        {
          id: 'password',
          label: 'Change Password',
          icon: 'key-outline',
          onPress: () => router.push('/modal/change-password'),
        },
        {
          id: 'signout',
          label: 'Sign Out',
          icon: 'log-out-outline',
          onPress: confirmSignOut,
        },
      ],
    },
    {
      title: 'PREFERENCES',
      rows: [
        {
          id: 'notifications',
          label: 'Notifications',
          hint: notifSummary.length === 3
            ? 'Digest, streak, social — all on.'
            : notifSummary.length === 0
              ? 'All off.'
              : `On: ${notifSummary.join(', ')}.`,
          icon: 'notifications-outline',
          onPress: () => router.push('/modal/notification-settings'),
        },
      ],
    },
    {
      title: 'ABOUT',
      rows: [
        {
          id: 'terms',
          label: 'Terms of Service',
          icon: 'document-text-outline',
          external: true,
          onPress: () => void Linking.openURL(TERMS_URL),
        },
        {
          id: 'privacy',
          label: 'Privacy Policy',
          icon: 'shield-checkmark-outline',
          external: true,
          onPress: () => void Linking.openURL(PRIVACY_URL),
        },
      ],
    },
    {
      title: null,
      rows: [
        {
          id: 'delete',
          label: 'Delete Account',
          icon: 'trash-outline',
          destructive: true,
          onPress: confirmDelete,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={s.overlay}>
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Text style={s.title}>Settings</Text>
            <Text style={s.subtitle}>
              {user?.email ? `Signed in as ${user.email}.` : 'Manage your account.'}
            </Text>
          </View>
          <TouchableOpacity style={s.closeButton} onPress={() => router.back()} accessibilityLabel="Close settings">
            <Ionicons name="close" size={22} color={PAGE.text} />
          </TouchableOpacity>
        </View>

        {sections.map((section, sectionIndex) => (
          <View key={section.title ?? `section-${sectionIndex}`}>
            {section.title ? (
              <Text style={s.sectionLabel}>{section.title}</Text>
            ) : (
              <View style={s.sectionSpacer} />
            )}
            <View style={s.list}>
              {section.rows.map((item, index) => {
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
                    <View style={s.rowCopy}>
                      <Text style={[s.rowLabel, destructive && s.destructiveText]}>{item.label}</Text>
                      {item.hint ? <Text style={s.rowHint}>{item.hint}</Text> : null}
                    </View>
                    {destructive ? null : (
                      <Ionicons
                        name={item.external ? 'open-outline' : 'chevron-forward'}
                        size={item.external ? 17 : 20}
                        color={PAGE.textMuted}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 6 },
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
  sectionLabel: {
    color: PAGE.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  sectionSpacer: { height: 20 },
  list: { borderRadius: 20, borderWidth: 1, borderColor: PAGE.border, backgroundColor: PAGE.card, overflow: 'hidden' },
  row: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: PAGE.border },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PAGE.border,
    backgroundColor: PAGE.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveIconWrap: { backgroundColor: '#F7E5E0', borderColor: '#E3B9AE' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: PAGE.text, fontSize: 16, fontWeight: '600' },
  rowHint: { color: PAGE.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  destructiveText: { color: PAGE.destructive },
});
