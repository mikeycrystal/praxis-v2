import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Shown after a completed digest (timing rules in app/lib/notificationPrompt.ts).
// Copy is from the notifications spec §4 — change it there first.

type NotificationPermissionPromptProps = {
  visible: boolean;
  onYes: () => void;
  onNotNow: () => void;
};

export function NotificationPermissionPrompt({
  visible,
  onYes,
  onNotNow,
}: NotificationPermissionPromptProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onNotNow}>
      <View style={s.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onNotNow}
          accessibilityLabel="Close notification prompt"
        />
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons name="notifications-outline" size={24} color="#6B9456" />
          </View>
          <Text style={s.title}>Want tomorrow's 5 stories at this time?</Text>
          <Text style={s.body}>
            One notification a day, when you usually read. Turn it off any time.
          </Text>
          <TouchableOpacity style={s.primaryButton} onPress={onYes} accessibilityRole="button">
            <Text style={s.primaryText}>Yes, remind me</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.notNowButton} onPress={onNotNow} accessibilityRole="button">
            <Text style={s.notNowText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(28, 25, 20, 0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DED4C4',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: '#211E19',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 18,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4E6',
  },
  title: {
    marginTop: 14,
    color: '#2E2A25',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: { marginTop: 7, color: '#71695F', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: {
    width: '100%',
    height: 48,
    marginTop: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8DAE73',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  notNowButton: { paddingHorizontal: 16, paddingVertical: 11, marginTop: 4 },
  notNowText: { color: '#81786E', fontSize: 13, fontWeight: '600' },
});
