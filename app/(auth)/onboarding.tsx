import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

const TOPICS = [
  'Politics', 'Technology', 'Business', 'Science', 'Health',
  'Climate', 'World', 'Culture', 'Sports', 'Finance',
  'AI', 'Education', 'Justice', 'Defense', 'Energy',
];

export default function OnboardingScreen() {
  const { updateProfile } = useAuth();
  const { c, Radius } = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (topic: string) => {
    setSelected(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const finish = async () => {
    if (selected.length < 3) return;
    setLoading(true);
    try {
      await updateProfile({ topics: selected, onboarding_complete: true });
      router.replace('/(tabs)');
    } catch {
      setLoading(false);
    }
  };

  const ready = selected.length >= 3;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>What interests you?</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          Pick at least 3 topics to personalize your feed.
        </Text>
        <View style={[s.progress, { backgroundColor: c.secondary }]}>
          <View style={[s.progressFill, { backgroundColor: c.tint, width: `${Math.min(selected.length / 3 * 100, 100)}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {TOPICS.map(topic => {
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
              {active && <Text style={[s.check, { color: c.tint }]}>✓ </Text>}
              <Text style={[s.chipText, { color: active ? c.tint : c.textSecondary }]}>{topic}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <Text style={[s.countText, { color: c.textMuted }]}>
          {selected.length < 3
            ? `Select ${3 - selected.length} more to continue`
            : `${selected.length} topics selected`
          }
        </Text>
        <TouchableOpacity
          style={[s.button, { backgroundColor: ready ? c.tint : c.secondary }]}
          onPress={finish}
          disabled={!ready || loading}
        >
          {loading
            ? <ActivityIndicator color={c.tintForeground} />
            : <Text style={[s.buttonText, { color: ready ? c.tintForeground : c.textMuted }]}>
                Get Started →
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 16, gap: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  progress: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 4, borderRadius: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, paddingBottom: 24 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1.5,
  },
  check: { fontSize: 13, fontWeight: '700' },
  chipText: { fontSize: 14, fontWeight: '500' },
  footer: { padding: 20, gap: 10 },
  countText: { textAlign: 'center', fontSize: 13 },
  button: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
