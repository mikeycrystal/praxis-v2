import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { REPORT_REASONS, type ReportReason, type ReportTarget, submitReport } from '../lib/moderation';

const labels: Record<ReportReason, string> = { spam: 'Spam', harassment: 'Harassment', hate: 'Hate', violence: 'Violence', impersonation: 'Impersonation', other: 'Other' };

export function ReportSheet({ visible, reporterId, target, onClose, offerBlock, onBlock }: { visible: boolean; reporterId: string; target: ReportTarget; onClose: () => void; offerBlock?: boolean; onBlock?: () => Promise<void> }) {
  const { c } = useTheme();
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    setSending(true);
    try {
      await submitReport(reporterId, target, reason, details);
      onClose();
      Alert.alert('Report sent', 'Thanks — we review reports within 24 hours.', offerBlock && onBlock ? [{ text: 'Done' }, { text: 'Block this user', style: 'destructive', onPress: () => void onBlock() }] : undefined);
    } catch { Alert.alert('Could not send report', 'Something went wrong. Try again.'); }
    finally { setSending(false); }
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.sheet, { backgroundColor: c.background, borderColor: c.border }]}>
    <View style={[s.handle, { backgroundColor: c.border }]} /><Text style={[s.title, { color: c.text }]}>Report {target.targetType === 'message' ? 'message' : 'user'}</Text><Text style={[s.subtitle, { color: c.textMuted }]}>What is the issue?</Text>
    <View style={s.reasons}>{REPORT_REASONS.map((item) => <TouchableOpacity key={item} onPress={() => setReason(item)} style={[s.reason, { borderColor: reason === item ? c.tint : c.border, backgroundColor: reason === item ? c.secondary : c.card }]}><Text style={{ color: c.text }}>{labels[item]}</Text></TouchableOpacity>)}</View>
    <TextInput value={details} onChangeText={setDetails} placeholder="Details (optional)" placeholderTextColor={c.textMuted} multiline maxLength={1000} style={[s.details, { color: c.text, borderColor: c.border, backgroundColor: c.card }]} />
    <TouchableOpacity disabled={sending} onPress={() => void submit()} style={[s.submit, { backgroundColor: c.tint }]}><Text style={{ color: c.tintForeground, fontWeight: '700' }}>{sending ? 'Sending…' : 'Submit report'}</Text></TouchableOpacity><TouchableOpacity disabled={sending} onPress={onClose} style={s.cancel}><Text style={{ color: c.textSecondary }}>Cancel</Text></TouchableOpacity>
  </View></View></Modal>;
}
const s = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,30,24,0.35)' }, sheet: { padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 }, title: { fontSize: 20, fontWeight: '700' }, subtitle: { fontSize: 14, marginTop: 5, marginBottom: 14 }, reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, reason: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 }, details: { height: 82, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 16, textAlignVertical: 'top' }, submit: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, cancel: { alignItems: 'center', paddingTop: 16, paddingBottom: 2 } });
