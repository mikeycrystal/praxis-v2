import { useEffect, useState } from 'react';
import {
  ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

// The badge collection, moved off the profile onto its own page
// (Ayuka, 2026-09-19): the profile keeps the count tile, this page keeps
// the collection. Same cards as before, laid out as a vertical grid.

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  requirement_value: number;
}

interface EarnedBadge {
  badge_id: string;
  earned_at: string;
}

const CATEGORY_COLORS: Record<string, { background: string; text: string; border: string }> = {
  reading: { background: '#E8EEF9', text: '#3768B5', border: '#C7D6EE' },
  streak: { background: '#FBEADF', text: '#D97849', border: '#F0C7B2' },
  exploration: { background: '#F1E8FA', text: '#9863CB', border: '#DCC7EF' },
  engagement: { background: '#E5F1E3', text: '#668F55', border: '#C8DEC2' },
};

const BADGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  reading: 'book-outline',
  streak: 'flame-outline',
  exploration: 'compass-outline',
  engagement: 'people-outline',
};

export default function AchievementsModal() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [catalogResult, earnedResult] = await Promise.all([
          supabase
            .from('badges')
            .select('id, name, description, icon, category, tier, requirement_value')
            .order('requirement_value', { ascending: true }),
          user
            ? supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id)
            : Promise.resolve({ data: [] as EarnedBadge[] }),
        ]);
        if (!active) return;
        setAllBadges((catalogResult.data ?? []) as BadgeDefinition[]);
        setEarnedBadges((earnedResult.data ?? []) as EarnedBadge[]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const earnedMap = new Map(earnedBadges.map((badge) => [badge.badge_id, badge.earned_at]));
  const categories = ['All', ...Array.from(new Set(allBadges.map((badge) => badge.category)))];
  const filters = categories.map((label) => ({
    label: label === 'All' ? 'All' : label[0].toUpperCase() + label.slice(1),
    key: label,
    count: label === 'All'
      ? earnedBadges.length
      : earnedBadges.filter((earned) => allBadges.find((b) => b.id === earned.badge_id)?.category === label).length,
  }));
  const visible = allBadges.filter((badge) => filter === 'All' || badge.category === filter);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <View style={s.titleRow}>
          <Ionicons name="trophy-outline" size={26} color="#8EAF72" />
          <Text style={[s.title, { color: c.text }]}>Achievements</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Close achievements">
          <Ionicons name="close" size={26} color={c.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={[s.count, { color: c.textMuted }]}>
        {earnedBadges.length} / {allBadges.length} earned
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterStrip}
        contentContainerStyle={[s.filterRow, { backgroundColor: '#DDD5C7' }]}
      >
        {filters.map((item) => {
          const selected = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[s.filterPill, selected && { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[s.filterText, { color: selected ? c.text : c.textMuted }]}>
                {item.label} ({item.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#8EAF72" style={s.loader} />
      ) : (
        <ScrollView contentContainerStyle={s.grid}>
          {visible.map((badge) => {
            const earnedAt = earnedMap.get(badge.id);
            const earned = Boolean(earnedAt);
            const categoryColors = CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.reading;
            return (
              <View
                key={badge.id}
                style={[
                  s.badgeCard,
                  {
                    backgroundColor: earned ? '#F7ECE0' : c.card,
                    borderColor: earned ? '#D9A57B' : c.border,
                    borderStyle: earned ? 'solid' : 'dashed',
                    opacity: earned ? 1 : 0.54,
                  },
                ]}
              >
                <View style={[s.iconCircle, { backgroundColor: earned ? '#B95E12' : '#E5DED2' }]}>
                  <Ionicons
                    name={BADGE_ICONS[badge.category] ?? 'ribbon-outline'}
                    size={32}
                    color={earned ? '#FFFDF8' : '#AAA195'}
                  />
                </View>
                <Text style={[s.badgeName, { color: c.text }]} numberOfLines={2}>{badge.name}</Text>
                <Text style={[s.badgeDescription, { color: c.textMuted }]} numberOfLines={3}>
                  {badge.description}
                </Text>
                <View style={s.pillRow}>
                  <View style={[s.categoryPill, { backgroundColor: categoryColors.background, borderColor: categoryColors.border }]}>
                    <Text style={[s.categoryText, { color: categoryColors.text }]}>{badge.category}</Text>
                  </View>
                  <View style={[s.tierPill, { borderColor: '#D4C7B6', backgroundColor: c.surface }]}>
                    <Text style={[s.tierText, { color: c.textMuted }]}>{badge.tier}</Text>
                  </View>
                </View>
                {earnedAt ? (
                  <Text style={[s.earnedDate, { color: c.textMuted }]}>
                    Earned {new Date(earnedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {visible.length === 0 ? (
            <Text style={[s.empty, { color: c.textMuted }]}>No achievements in this category yet.</Text>
          ) : null}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  count: { fontSize: 13, paddingHorizontal: 20, marginTop: 4 },
  filterStrip: { flexGrow: 0, marginTop: 14 },
  filterRow: {
    flexDirection: 'row', gap: 6, marginHorizontal: 20, borderRadius: 12, padding: 4,
  },
  filterPill: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: '600' },
  loader: { marginTop: 40 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingTop: 16,
  },
  badgeCard: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  badgeName: { fontSize: 15, fontWeight: '800' },
  badgeDescription: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  categoryPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  tierPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tierText: { fontSize: 11, fontWeight: '600' },
  earnedDate: { fontSize: 11, marginTop: 8 },
  empty: { fontSize: 14, padding: 20 },
});
