import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface DayBucket {
  day: string;   // 'Mon' etc.
  date: string;  // ISO date
  count: number;
}

interface TopicCount {
  topic: string;
  count: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReadingActivityModal() {
  const { user, profile } = useAuth();
  const { c } = useTheme();
  const [weekData, setWeekData] = useState<DayBucket[]>([]);
  const [topTopics, setTopTopics] = useState<TopicCount[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Build last 7 days array
    const days: DayBucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        day: DAY_LABELS[d.getDay()],
        date: d.toISOString().split('T')[0],
        count: 0,
      });
    }

    const since = days[0].date + 'T00:00:00Z';

    Promise.all([
      supabase
        .from('read_articles')
        .select('read_at, article(topics)')
        .eq('user_id', user.id)
        .gte('read_at', since),
    ]).then(([{ data }]) => {
      const reads = data ?? [];

      // Fill day buckets
      for (const r of reads) {
        const dateStr = new Date(r.read_at).toISOString().split('T')[0];
        const bucket = days.find(d => d.date === dateStr);
        if (bucket) bucket.count++;
      }
      setWeekData(days);
      setTotalThisWeek(reads.length);

      // Count topics
      const topicMap = new Map<string, number>();
      for (const r of reads) {
        const topics: string[] = (r.article as any)?.topics ?? [];
        for (const t of topics) {
          topicMap.set(t, (topicMap.get(t) ?? 0) + 1);
        }
      }
      const sorted = Array.from(topicMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));
      setTopTopics(sorted);
      setLoading(false);
    });
  }, [user]);

  const maxCount = Math.max(...weekData.map(d => d.count), 1);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Reading Activity</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.done, { color: c.tint }]}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.tint} style={{ flex: 1 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {/* Stats summary */}
          <View style={[s.statsRow, { backgroundColor: c.card, borderColor: c.border }]}>
            {[
              { label: 'This Week', value: totalThisWeek },
              { label: 'Total Read', value: profile?.articles_read ?? 0 },
              { label: 'Day Streak', value: profile?.reading_streak ?? 0 },
            ].map((stat, i, arr) => (
              <View
                key={stat.label}
                style={[s.stat, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: c.border }]}
              >
                <Text style={[s.statNum, { color: c.tint }]}>{stat.value}</Text>
                <Text style={[s.statLabel, { color: c.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Bar chart */}
          <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.cardTitle, { color: c.text }]}>Last 7 Days</Text>
            <View style={s.chart}>
              {weekData.map((d) => {
                const heightPct = (d.count / maxCount) * 100;
                const isToday = d.date === new Date().toISOString().split('T')[0];
                return (
                  <View key={d.date} style={s.barCol}>
                    <Text style={[s.barCount, { color: d.count > 0 ? c.tint : c.textMuted }]}>
                      {d.count > 0 ? d.count : ''}
                    </Text>
                    <View style={[s.barTrack, { backgroundColor: c.secondary }]}>
                      <View
                        style={[
                          s.barFill,
                          { backgroundColor: isToday ? c.tint : c.tint + '80', height: `${heightPct}%` as any },
                        ]}
                      />
                    </View>
                    <Text style={[s.barLabel, { color: isToday ? c.tint : c.textMuted, fontWeight: isToday ? '700' : '400' }]}>
                      {d.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Top topics */}
          {topTopics.length > 0 && (
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>Top Topics This Week</Text>
              {topTopics.map((t, i) => (
                <View key={t.topic} style={s.topicRow}>
                  <Text style={[s.topicRank, { color: c.textMuted }]}>{i + 1}</Text>
                  <Text style={[s.topicName, { color: c.text }]}>{t.topic}</Text>
                  <View style={s.topicBarWrap}>
                    <View
                      style={[
                        s.topicBar,
                        { backgroundColor: c.tint, width: `${(t.count / topTopics[0].count) * 100}%` as any },
                      ]}
                    />
                  </View>
                  <Text style={[s.topicCount, { color: c.textMuted }]}>{t.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Goal progress */}
          {profile?.daily_goal && (
            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[s.cardTitle, { color: c.text }]}>Daily Goal</Text>
              <Text style={[s.goalSub, { color: c.textMuted }]}>
                {weekData[weekData.length - 1]?.count ?? 0} / {profile.daily_goal} articles today
              </Text>
              <View style={[s.goalTrack, { backgroundColor: c.secondary }]}>
                <View
                  style={[
                    s.goalFill,
                    {
                      backgroundColor: c.tint,
                      width: `${Math.min(((weekData[weekData.length - 1]?.count ?? 0) / profile.daily_goal) * 100, 100)}%` as any,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  done: { fontSize: 16 },
  content: { paddingHorizontal: 16, gap: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  statNum: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barCount: { fontSize: 10, fontWeight: '600' },
  barTrack: { flex: 1, width: '70%', borderRadius: 4, overflow: 'hidden', minHeight: 4, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 11 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicRank: { width: 16, fontSize: 12, textAlign: 'center' },
  topicName: { width: 90, fontSize: 13, fontWeight: '500' },
  topicBarWrap: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'transparent' },
  topicBar: { height: 8, borderRadius: 4 },
  topicCount: { fontSize: 12, width: 24, textAlign: 'right' },
  goalSub: { fontSize: 13 },
  goalTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  goalFill: { height: 8, borderRadius: 4 },
});
