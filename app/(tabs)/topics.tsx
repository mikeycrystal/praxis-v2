import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, useColorScheme, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius } from '@/constants/Theme';

const ALL_TOPICS = [
  'Politics', 'Technology', 'Business', 'Science', 'Health',
  'Climate', 'World', 'Culture', 'Sports', 'Finance',
  'AI', 'Education', 'Justice', 'Defense', 'Energy',
  'Immigration', 'Housing', 'Media', 'Foreign Policy', 'Economy',
];

export default function TopicsScreen() {
  const { profile, updateProfile } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
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
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Your Topics</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          {selected.length} selected — choose what powers your feed
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {ALL_TOPICS.map(topic => {
          const active = selected.includes(topic);
          return (
            <TouchableOpacity
              key={topic}
              style={[
                styles.chip,
                { borderColor: active ? c.tint : c.border, backgroundColor: active ? c.tint : c.card },
              ]}
              onPress={() => toggle(topic)}
            >
              <Text style={[styles.chipText, { color: active ? c.tintForeground : c.text }]}>
                {topic}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? c.secondary : c.tint }]}
          onPress={save}
          disabled={saving || saved}
        >
          {saving
            ? <ActivityIndicator color={c.tintForeground} />
            : <Text style={[styles.saveBtnText, { color: saved ? c.textSecondary : c.tintForeground }]}>
                {saved ? 'Saved!' : 'Save Topics'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing['2xl'], paddingTop: Spacing['2xl'], paddingBottom: Spacing.lg },
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  subtitle: { fontSize: Typography.size.sm, marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: Spacing['3xl'],
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  chipText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  footer: { padding: Spacing['2xl'] },
  saveBtn: { height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
});
