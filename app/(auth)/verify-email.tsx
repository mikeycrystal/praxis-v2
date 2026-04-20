import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

export default function VerifyEmailScreen() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.inner}>
        <Text style={s.emoji}>📬</Text>
        <Text style={[s.title, { color: c.text }]}>Check your email</Text>
        <Text style={[s.body, { color: c.textSecondary }]}>
          We sent a verification link to your email address. Click it to activate your account, then sign in.
        </Text>
        <TouchableOpacity
          style={[s.button, { backgroundColor: c.tint }]}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={[s.buttonText, { color: c.tintForeground }]}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  emoji: { fontSize: 60, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
