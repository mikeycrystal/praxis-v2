import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { label: 'Uppercase letter', test: pw => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: pw => /[a-z]/.test(pw) },
  { label: 'Number', test: pw => /[0-9]/.test(pw) },
  { label: 'Special character (!@#$%^&*)', test: pw => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

export default function ChangePasswordModal() {
  const { c, Radius } = useTheme();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const meetsAll = REQUIREMENTS.every(r => r.test(newPw)) && newPw === confirm && newPw !== current;

  const handleSave = async () => {
    if (!meetsAll) return;
    setLoading(true);
    try {
      // Verify current password by attempting sign-in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not authenticated');

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email, password: current,
      });
      if (verifyError) throw new Error('Current password is incorrect.');

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.cancel, { color: c.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: c.text }]}>Change Password</Text>
        <TouchableOpacity onPress={handleSave} disabled={!meetsAll || loading}>
          {loading
            ? <ActivityIndicator color={c.tint} size="small" />
            : <Text style={[s.save, { color: meetsAll ? c.tint : c.textMuted }]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Current password */}
        <View>
          <Text style={[s.label, { color: c.textSecondary }]}>Current Password</Text>
          <View style={[s.pwWrap, { backgroundColor: c.card, borderColor: c.border }]}>
            <TextInput
              style={[s.pwInput, { color: c.text }]}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry={!showCurrent}
              placeholder="••••••••"
              placeholderTextColor={c.textMuted}
            />
            <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={s.eyeBtn}>
              <Text style={{ color: c.textMuted, fontSize: 16 }}>{showCurrent ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* New password */}
        <View>
          <Text style={[s.label, { color: c.textSecondary }]}>New Password</Text>
          <View style={[s.pwWrap, { backgroundColor: c.card, borderColor: c.border }]}>
            <TextInput
              style={[s.pwInput, { color: c.text }]}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry={!showNew}
              placeholder="••••••••"
              placeholderTextColor={c.textMuted}
            />
            <TouchableOpacity onPress={() => setShowNew(v => !v)} style={s.eyeBtn}>
              <Text style={{ color: c.textMuted, fontSize: 16 }}>{showNew ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm password */}
        <View>
          <Text style={[s.label, { color: c.textSecondary }]}>Confirm New Password</Text>
          <View style={[s.pwWrap, { backgroundColor: c.card, borderColor: c.border }]}>
            <TextInput
              style={[s.pwInput, { color: c.text }]}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              placeholder="••••••••"
              placeholderTextColor={c.textMuted}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
              <Text style={{ color: c.textMuted, fontSize: 16 }}>{showConfirm ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Requirements */}
        {newPw.length > 0 && (
          <View style={[s.requirements, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.reqTitle, { color: c.textMuted }]}>PASSWORD REQUIREMENTS</Text>
            {REQUIREMENTS.map(req => {
              const met = req.test(newPw);
              return (
                <View key={req.label} style={s.reqRow}>
                  <View style={[s.reqDot, { backgroundColor: met ? c.sentimentPositive : c.destructive }]} />
                  <Text style={[s.reqText, { color: met ? c.sentimentPositive : c.textMuted }]}>
                    {req.label}
                  </Text>
                </View>
              );
            })}
            {confirm.length > 0 && (
              <View style={s.reqRow}>
                <View style={[s.reqDot, { backgroundColor: newPw === confirm ? c.sentimentPositive : c.destructive }]} />
                <Text style={[s.reqText, { color: newPw === confirm ? c.sentimentPositive : c.textMuted }]}>
                  Passwords match
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cancel: { fontSize: 16 },
  title: { fontSize: 16, fontWeight: '600' },
  save: { fontSize: 16, fontWeight: '600' },
  content: { padding: 24, gap: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  pwWrap: { height: 52, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  pwInput: { flex: 1, paddingHorizontal: 14, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  requirements: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  reqTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqDot: { width: 8, height: 8, borderRadius: 4 },
  reqText: { fontSize: 13 },
});
