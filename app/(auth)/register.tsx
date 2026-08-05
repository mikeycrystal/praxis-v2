import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { buildHref } from '../lib/buildHref';
import { AuthColors } from '../../constants/AuthTheme';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const c = AuthColors;
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : '/';

  const handleRegister = async () => {
    if (!fullName || !email || !password) return;
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, fullName.trim());
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <LinearGradient colors={[c.background, c.secondary]} style={s.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.inner}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={s.logoWrap}>
                <View style={[s.logoMark, { backgroundColor: c.primary }]}>
                  <Ionicons name="newspaper-outline" size={25} color={c.primaryForeground} />
                </View>
                <Text style={[s.logo, { color: c.text }]}>Welcome to Praxis</Text>
                <Text style={[s.tagline, { color: c.textMuted }]}>Create an account to personalize your news</Text>
              </View>

        {/* Tabs */}
        <View style={[s.tabs, { backgroundColor: c.secondary }]}>
          {(['signin', 'signup'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                s.tab,
                s.tabShape,
                tab === 'signup' && { backgroundColor: c.card },
              ]}
              onPress={() => {
                if (tab === 'signin') {
                  router.replace(buildHref('/login', returnTo ? { returnTo } : undefined));
                }
              }}
            >
              <Text style={[s.tabText, {
                color: tab === 'signup' ? c.text : c.textMuted,
                fontWeight: tab === 'signup' ? '700' : '500',
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
              style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.input }]}
              placeholder="Jane Smith"
              placeholderTextColor={c.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
          <View>
            <Text style={[s.label, { color: c.textSecondary }]}>Email</Text>
            <TextInput
              style={[s.input, { borderColor: c.border, color: c.text, backgroundColor: c.input }]}
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
            <View style={[s.passwordWrap, { borderColor: c.border, backgroundColor: c.input }]}>
              <TextInput
                style={[s.passwordInput, { color: c.text }]}
                placeholder="••••••••"
                placeholderTextColor={c.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={c.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={[s.hint, { color: c.textMuted }]}>Minimum 6 characters</Text>
          </View>

          <TouchableOpacity
            style={[s.button, { backgroundColor: c.primary }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.primaryForeground} />
              : <Text style={[s.buttonText, { color: c.primaryForeground }]}>Create Account</Text>
            }
          </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 440, borderWidth: 1, borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 28,
    shadowColor: '#786C54', shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16, shadowRadius: 30, elevation: 8,
  },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoMark: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logo: { fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 14, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  tabs: { flexDirection: 'row', padding: 4, marginBottom: 24, borderRadius: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabShape: { borderRadius: 12 },
  tabText: { fontSize: 15 },
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 15 },
  passwordWrap: { height: 52, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, paddingHorizontal: 16, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  hint: { fontSize: 12, marginTop: 4 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
