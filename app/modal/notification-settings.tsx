import { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const PAGE = {
  background: '#F7F3EA',
  card: '#FBF7F0',
  surface: '#FFFDFC',
  text: '#2E2A25',
  textMuted: '#8E857A',
  border: '#E7DEC9',
  tint: '#8DAE73',
  trackOff: '#D8CEBE',
};

// Copy from the notifications spec §5. Server-enforced: the push functions
// check these columns before sending — the switch is real, not cosmetic.
const SWITCHES = [
  {
    key: 'notify_digest' as const,
    label: 'Daily digest',
    hint: 'Your 5 stories, once a day, around the time you usually read.',
  },
  {
    key: 'notify_streak' as const,
    label: 'Streak reminder',
    hint: 'One evening nudge, only when your streak is at risk.',
  },
  {
    key: 'notify_social' as const,
    label: 'Follows & messages',
    hint: 'When someone follows or messages you.',
  },
];

type PrefKey = (typeof SWITCHES)[number]['key'];

export default function NotificationSettingsModal() {
  const { isGuestMode, loading, profile, updateProfile, user } = useAuth();
  // Optimistic values; the profile refresh confirms them.
  const [overrides, setOverrides] = useState<Partial<Record<PrefKey, boolean>>>({});

  useEffect(() => {
    if (loading) return;
    if (isGuestMode || !user) {
      router.replace({ pathname: '/login', params: { returnTo: '/profile' } });
    }
  }, [isGuestMode, loading, user]);

  if (loading || isGuestMode || !user) return null;

  const valueOf = (key: PrefKey) => overrides[key] ?? (profile?.[key] !== false);

  const toggle = (key: PrefKey, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
    void updateProfile({ [key]: value }).catch(() => {
      setOverrides((prev) => ({ ...prev, [key]: !value }));
      Alert.alert('Could not save', 'That switch did not save. Try again.');
    });
  };

  return (
    <SafeAreaView style={s.overlay}>
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.header}>
          <TouchableOpacity style={s.backButton} onPress={() => router.back()} accessibilityLabel="Back to settings">
            <Ionicons name="chevron-back" size={22} color={PAGE.text} />
          </TouchableOpacity>
          <View style={s.headerCopy}>
            <Text style={s.title}>Notifications</Text>
            <Text style={s.subtitle}>Every switch is enforced on our servers, not just hidden.</Text>
          </View>
        </View>

        <View style={s.list}>
          {SWITCHES.map((item, index) => (
            <View key={item.key} style={[s.row, index > 0 && s.rowBorder]}>
              <View style={s.rowCopy}>
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowHint}>{item.hint}</Text>
              </View>
              <Switch
                value={valueOf(item.key)}
                onValueChange={(value) => toggle(item.key, value)}
                trackColor={{ false: PAGE.trackOff, true: PAGE.tint }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={PAGE.trackOff}
                accessibilityLabel={item.label}
              />
            </View>
          ))}
        </View>
        <Text style={s.footnote}>Praxis never notifies you between 10 pm and 7 am.</Text>
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
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: PAGE.border,
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D6CDBE', alignSelf: 'center', marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
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
  headerCopy: { flex: 1 },
  title: { color: PAGE.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: PAGE.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  list: { borderRadius: 20, borderWidth: 1, borderColor: PAGE.border, backgroundColor: PAGE.card, overflow: 'hidden' },
  row: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: PAGE.border },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: PAGE.text, fontSize: 16, fontWeight: '600' },
  rowHint: { color: PAGE.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  footnote: {
    color: PAGE.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
    marginHorizontal: 8,
  },
});
