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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Login failed', err.message);
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
          <Text style={[styles.title, { color: c.text }]}>Praxis</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Stay informed, stay grounded.
          </Text>
        </View>

        <View style={styles.form}>
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
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.tintForeground} />
              : <Text style={[styles.buttonText, { color: c.tintForeground }]}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.link, { color: c.tint }]}>
              Don't have an account? Sign up
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
  title: { fontSize: Typography.size['4xl'], fontWeight: Typography.weight.extrabold, letterSpacing: -0.5 },
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
