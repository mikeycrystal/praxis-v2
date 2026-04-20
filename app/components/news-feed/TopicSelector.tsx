import { useState, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const ALL_TOPICS = [
  'Technology', 'Business', 'Politics', 'Science', 'Health',
  'Sports', 'World News', 'Finance', 'Environment', 'Education',
  'Entertainment', 'Travel', 'AI', 'Justice', 'Defense',
];

export interface TopicSelectorRef {
  getConfig: () => { type: 'topics' | 'freetext'; topics: string[]; freeText: string };
}

interface Props {
  defaultTopics?: string[];
}

const TopicSelector = forwardRef<TopicSelectorRef, Props>(({ defaultTopics = ['Technology', 'Business'] }, ref) => {
  const { c, Radius } = useTheme();
  const [tab, setTab] = useState<'topics' | 'freetext'>('topics');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(defaultTopics);
  const [freeText, setFreeText] = useState('');
  const [expanded, setExpanded] = useState(false);

  useImperativeHandle(ref, () => ({
    getConfig: () => ({ type: tab, topics: selected, freeText }),
  }));

  const filtered = ALL_TOPICS.filter(t =>
    t.toLowerCase().includes(search.toLowerCase()) && !selected.includes(t)
  );

  const toggle = (topic: string) => {
    setSelected(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  return (
    <View style={s.container}>
      {/* Tab switcher */}
      <View style={[s.tabs, { backgroundColor: c.secondary, borderRadius: Radius.lg }]}>
        {(['topics', 'freetext'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, { borderRadius: Radius.md }, tab === t && { backgroundColor: c.card }]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, { color: tab === t ? c.text : c.textMuted, fontWeight: tab === t ? '600' : '400' }]}>
              {t === 'topics' ? 'Topics' : 'Free Text'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'topics' ? (
        <View style={s.topicsPane}>
          {/* Search */}
          <TextInput
            style={[s.searchInput, { backgroundColor: c.secondary, borderColor: c.border, color: c.text }]}
            placeholder="Search topics..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {/* Selected badges */}
          {selected.length > 0 && (
            <View style={s.selectedRow}>
              {selected.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.selectedBadge, { backgroundColor: c.tint + '20', borderColor: c.tint + '50' }]}
                  onPress={() => toggle(t)}
                >
                  <Text style={[s.selectedBadgeText, { color: c.tint }]}>✓ {t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Topic grid */}
          <View style={s.grid}>
            {(expanded ? filtered : filtered.slice(0, 6)).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.topicChip, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => toggle(t)}
              >
                <Text style={[s.topicChipText, { color: c.textSecondary }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {filtered.length > 6 && (
            <TouchableOpacity onPress={() => setExpanded(e => !e)}>
              <Text style={[s.expandText, { color: c.tint }]}>
                {expanded ? 'Show less ↑' : `Show ${filtered.length - 6} more ↓`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TextInput
          style={[s.freeTextInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          placeholder="Describe what you want to read about... e.g. 'AI regulation and its impact on startups'"
          placeholderTextColor={c.textMuted}
          value={freeText}
          onChangeText={setFreeText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      )}
    </View>
  );
});

TopicSelector.displayName = 'TopicSelector';
export default TopicSelector;

const s = StyleSheet.create({
  container: { gap: 12 },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabText: { fontSize: 14 },
  topicsPane: { gap: 10 },
  searchInput: {
    height: 40, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 14,
  },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  selectedBadgeText: { fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxHeight: 128, overflow: 'hidden' },
  topicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  topicChipText: { fontSize: 13 },
  expandText: { fontSize: 13, marginTop: 4 },
  freeTextInput: {
    minHeight: 120, borderRadius: 12, borderWidth: 1,
    padding: 12, fontSize: 14, lineHeight: 21,
  },
});
