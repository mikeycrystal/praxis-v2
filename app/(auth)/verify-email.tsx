import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Radius, Typography, Spacing } from '@/constants/Theme';

export default function VerifyEmailScreen() {
  const c = Colors.light;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.inner}>
        <Text style={[styles.emoji]}>📬</Text>
        <Text style={[styles.title, { color: c.text }]}>Check your email</Text>
        <Text style={[styles.body, { color: c.textSecondary }]}>
          We sent a verification link to your email address. Click it to activate your account.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: c.tint }]}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={[styles.buttonText, { color: c.tintForeground }]}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing['3xl'] },
  emoji: { fontSize: 64, marginBottom: Spacing['2xl'] },
  title: { fontSize: Typography.size['2xl'], fontWeight: Typography.weight.bold, marginBottom: Spacing.md },
  body: { fontSize: Typography.size.base, textAlign: 'center', lineHeight: 24, marginBottom: Spacing['3xl'] },
  button: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  buttonText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
});
