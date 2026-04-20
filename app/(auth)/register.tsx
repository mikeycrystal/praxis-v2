import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { c, Radius, Typography } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) return;
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
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

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.inner}>
        <View style={s.logoWrap}>
          <Text style={[s.logo, { color: c.text }]}>Praxis</Text>
          <Text style={[s.tagline, { color: c.textMuted }]}>Stay informed. Stay grounded.</Text>
        </View>

        {/* Tabs */}
        <View style={[s.tabs, { backgroundColor: c.secondary, borderRadius: Radius.lg }]}>
          {(['signin', 'signup'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                s.tab,
                { borderRadius: Radius.md },
                tab === 'signup' && { backgroundColor: c.card },
              ]}
              onPress={() => { if (tab === 'signin') router.replace('/(auth)/login'); }}
            >
              <Text style={[s.tabText, {
                color: tab === 'signup' ? c.text : c.textMuted,
                fontWeight: tab === 'signup' ? Typography.weight.semibold : Typography.weight.normal,
              }]}>
                {tab === 'signin' ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.form}>
          <View>
            <Text style={[s.label, { color: c.textSecondary }]}>Full name</Text>
            <TextInput
              style={[s.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.card }]}
              placeholder="Jane Smith"
              placeholderTextColor={c.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
          <View>
            <Text style={[s.label, { color: c.textSecondary }]}>Email</Text>
            <TextInput
              style={[s.input, { borderColor: c.inputBorder, color: c.text, backgroundColor: c.card }]}
              placeholder="you@example.com"
              placeholderTextColor={c.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View>
            <Text style={[s.label, { color: c.textSecondary }]}>Password</Text>
            <View style={[s.passwordWrap, { borderColor: c.inputBorder, backgroundColor: c.card }]}>
              <TextInput
                style={[s.passwordInput, { color: c.text }]}
                placeholder="••••••••"
                placeholderTextColor={c.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.hint, { color: c.textMuted }]}>Minimum 6 characters</Text>
          </View>

          <TouchableOpacity
            style={[s.button, { backgroundColor: c.tint }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.tintForeground} />
              : <Text style={[s.buttonText, { color: c.tintForeground }]}>Create Account</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginTop: 6 },
  tabs: { flexDirection: 'row', padding: 4, marginBottom: 28 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 15 },
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  passwordWrap: { height: 52, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, paddingHorizontal: 16, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  hint: { fontSize: 12, marginTop: 4 },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
