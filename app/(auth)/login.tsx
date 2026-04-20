import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { c, Radius, Typography, Spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign in failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.inner}>
        {/* Logo */}
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
                activeTab === tab && { backgroundColor: c.card },
              ]}
              onPress={() => {
                if (tab === 'signup') router.replace('/(auth)/register');
                else setActiveTab(tab);
              }}
            >
              <Text style={[s.tabText, {
                color: activeTab === tab ? c.text : c.textMuted,
                fontWeight: activeTab === tab ? Typography.weight.semibold : Typography.weight.normal,
              }]}>
                {tab === 'signin' ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={s.form}>
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
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={[s.forgotText, { color: c.tint }]}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.button, { backgroundColor: c.tint }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.tintForeground} />
              : <Text style={[s.buttonText, { color: c.tintForeground }]}>Sign In</Text>
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
  input: {
    height: 52, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15,
  },
  passwordWrap: {
    height: 52, borderWidth: 1, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  forgotText: { fontSize: 13, textAlign: 'right', marginTop: -4 },
  button: {
    height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
