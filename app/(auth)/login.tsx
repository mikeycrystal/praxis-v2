import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useNewsPreferences } from '../context/NewsPreferencesContext';
import { buildHref } from '../lib/buildHref';
import { resetDailyDigestForNewGuest } from '../lib/dailyDigest';
import { AuthColors } from '../../constants/AuthTheme';

export default function LoginScreen() {
  const { signIn, continueAsGuest } = useAuth();
  const { applyTopNewsPreferences } = useNewsPreferences();
  const c = AuthColors;
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : '/';

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace(returnTo as any);
    } catch (err: any) {
      Alert.alert('Sign in failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    await resetDailyDigestForNewGuest();
    applyTopNewsPreferences(null);
    continueAsGuest();
    router.replace('/');
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
                <Text style={[s.tagline, { color: c.textMuted }]}>Sign in to your account or create a new one</Text>
              </View>

        <View style={[s.tabs, { backgroundColor: c.secondary }]}>
          {(['signin', 'signup'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                s.tab,
                s.tabShape,
                activeTab === tab && { backgroundColor: c.card },
              ]}
              onPress={() => {
                if (tab === 'signup') router.replace(buildHref('/register', returnTo ? { returnTo } : undefined));
                else setActiveTab(tab);
              }}
            >
              <Text style={[s.tabText, {
                color: activeTab === tab ? c.text : c.textMuted,
                fontWeight: activeTab === tab ? '700' : '500',
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
          </View>

          <TouchableOpacity
            onPress={() => router.push(buildHref('/forgot-password', returnTo ? { returnTo } : undefined))}
          >
            <Text style={[s.forgotText, { color: c.primary }]}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.button, { backgroundColor: c.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.primaryForeground} />
              : <Text style={[s.buttonText, { color: c.primaryForeground }]}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.guestButton, { borderColor: c.border, backgroundColor: c.card }]}
            onPress={handleContinueAsGuest}
            disabled={loading}
          >
            <Text style={[s.guestButtonText, { color: c.textSecondary }]}>Continue as Guest</Text>
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
  input: {
    height: 52, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 15,
  },
  passwordWrap: {
    height: 52, borderWidth: 1, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  forgotText: { fontSize: 13, textAlign: 'right', marginTop: -4 },
  button: {
    height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  guestButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: { fontSize: 15, fontWeight: '600' },
});
