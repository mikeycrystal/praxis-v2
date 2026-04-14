import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Radius, Typography, Spacing } from '@/constants/Theme';

const TOPICS = [
  'Politics', 'Technology', 'Business', 'Science', 'Health',
  'Climate', 'World', 'Culture', 'Sports', 'Finance',
  'AI', 'Education', 'Justice', 'Defense', 'Energy',
];

export default function OnboardingScreen() {
  const { updateProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const c = Colors.light;

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>What interests you?</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Pick at least 3 topics to personalize your feed.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {TOPICS.map(topic => {
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
          style={[
            styles.button,
            { backgroundColor: selected.length >= 3 ? c.tint : c.secondary },
          ]}
          onPress={finish}
          disabled={selected.length < 3 || loading}
        >
          {loading
            ? <ActivityIndicator color={c.tintForeground} />
            : <Text style={[styles.buttonText, { color: selected.length >= 3 ? c.tintForeground : c.textMuted }]}>
                Get Started ({selected.length} selected)
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing['3xl'], paddingTop: Spacing['3xl'], paddingBottom: Spacing.xl },
  title: { fontSize: Typography.size['2xl'], fontWeight: Typography.weight.bold, marginBottom: Spacing.sm },
  subtitle: { fontSize: Typography.size.base, lineHeight: 22 },
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
  footer: { padding: Spacing['3xl'] },
  button: {
    height: 54,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
});
