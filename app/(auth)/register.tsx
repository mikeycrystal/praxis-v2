import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Radius, Typography, Spacing } from '@/constants/Theme';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) return;
    setLoading(true);
    try {
      await signUp(email.trim(), password, fullName.trim());
      router.replace('/(auth)/verify-email');
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const c = Colors.light;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Join Praxis to start reading smarter.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.card }]}
            placeholder="Full name"
            placeholderTextColor={c.textMuted}
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={[styles.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.card }]}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.card }]}
            placeholder="Password"
            placeholderTextColor={c.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.tint }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.tintForeground} />
              : <Text style={[styles.buttonText, { color: c.tintForeground }]}>Create Account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.link, { color: c.tint }]}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing['3xl'] },
  header: { marginBottom: Spacing['4xl'], alignItems: 'center' },
  title: { fontSize: Typography.size['3xl'], fontWeight: Typography.weight.extrabold },
  subtitle: { fontSize: Typography.size.base, marginTop: Spacing.sm, textAlign: 'center' },
  form: { gap: Spacing.md },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.size.base,
  },
  button: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  link: { textAlign: 'center', fontSize: Typography.size.sm, marginTop: Spacing.md },
});
