import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

const ALL_TOPICS = [
  'Politics', 'Technology', 'Business', 'Science', 'Health',
  'Climate', 'World', 'Culture', 'Sports', 'Finance',
  'AI', 'Education', 'Justice', 'Defense', 'Energy',
  'Immigration', 'Housing', 'Media', 'Foreign Policy', 'Economy',
];

export default function TopicsScreen() {
  const { profile, updateProfile } = useAuth();
  const { c, Radius, Typography } = useTheme();
  const [selected, setSelected] = useState<string[]>(profile?.topics ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (topic: string) => {
    setSelected(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await updateProfile({ topics: selected });
    setSaving(false);
    setSaved(true);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Your Topics</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          {selected.length} selected — choose what powers your feed
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {ALL_TOPICS.map(topic => {
          const active = selected.includes(topic);
          return (
            <TouchableOpacity
              key={topic}
              style={[
                s.chip,
                { borderColor: active ? c.tint : c.border, backgroundColor: active ? c.tint + '20' : c.card },
              ]}
              onPress={() => toggle(topic)}
            >
              {active && <Text style={s.checkmark}>✓ </Text>}
              <Text style={[s.chipText, { color: active ? c.tint : c.textSecondary }]}>{topic}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: saved ? c.secondary : c.tint }]}
          onPress={save}
          disabled={saving || saved}
        >
          {saving
            ? <ActivityIndicator color={c.tintForeground} />
            : <Text style={[s.saveBtnText, { color: saved ? c.textMuted : c.tintForeground }]}>
                {saved ? '✓ Saved' : 'Save Topics'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8, paddingBottom: 24,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5,
  },
  checkmark: { color: '#3B82F6', fontSize: 13, fontWeight: '700' },
  chipText: { fontSize: 14, fontWeight: '500' },
  footer: { padding: 20 },
  saveBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600' },
});
