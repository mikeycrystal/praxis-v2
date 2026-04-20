import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';

export default function ForgotPasswordScreen() {
  const { c, Radius } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'praxis://auth/reset-password',
    });
    // Always show success for security — don't reveal if email exists
    setLoading(false);
    setSent(true);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.inner}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={[s.backText, { color: c.tint }]}>‹ Back</Text>
        </TouchableOpacity>

        {sent ? (
          <View style={s.sentWrap}>
            <Text style={s.sentEmoji}>📬</Text>
            <Text style={[s.title, { color: c.text }]}>Check your email</Text>
            <Text style={[s.body, { color: c.textSecondary }]}>
              We sent a password reset link to {email}. Check your inbox and follow the link.
            </Text>
            <TouchableOpacity
              style={[s.button, { backgroundColor: c.tint }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={[s.buttonText, { color: c.tintForeground }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.form}>
            <Text style={[s.title, { color: c.text }]}>Reset password</Text>
            <Text style={[s.body, { color: c.textSecondary }]}>
              Enter your email and we'll send you a reset link.
            </Text>
            <TextInput
              style={[s.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.card }]}
              placeholder="you@example.com"
              placeholderTextColor={c.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            <TouchableOpacity
              style={[s.button, { backgroundColor: c.tint }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={c.tintForeground} />
                : <Text style={[s.buttonText, { color: c.tintForeground }]}>Send Reset Link</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  back: { position: 'absolute', top: 20, left: 28 },
  backText: { fontSize: 17 },
  sentWrap: { alignItems: 'center', gap: 16 },
  sentEmoji: { fontSize: 56, marginBottom: 8 },
  form: { gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
