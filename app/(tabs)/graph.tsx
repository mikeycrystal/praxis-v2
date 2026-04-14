import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Dimensions,
  TouchableOpacity, useColorScheme, ActivityIndicator, ScrollView,
  PanResponder, Animated,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Typography, Spacing, Radius, Shadows } from '@/constants/Theme';

const { width: W } = Dimensions.get('window');
const GRAPH_SIZE = W - Spacing['2xl'] * 2;
const CENTER = GRAPH_SIZE / 2;

// Map article coordinates (x: -1..1 bias, y: 0..1 credibility) to SVG coords
const toSvg = (x: number, y: number, size: number) => ({
  cx: (x + 1) / 2 * size,
  cy: (1 - y) * size,
});

interface GraphArticle {
  id: number;
  title: string;
  x: number;
  y: number;
  publisher_name: string;
}

export default function GraphScreen() {
  const { profile } = useAuth();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [radius, setRadius] = useState(0.4);
  const [centerX, setCenterX] = useState(0);
  const [centerY, setCenterY] = useState(0.6);
  const [articles, setArticles] = useState<GraphArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GraphArticle | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('recommend', {
      body: {
        topics: profile?.topics ?? [],
        center_x: centerX,
        center_y: centerY,
        radius,
      },
    });
    if (!error && data?.articles) setArticles(data.articles);
    setLoading(false);
  };

  const svgCenter = toSvg(centerX, centerY, GRAPH_SIZE);
  const svgRadius = (radius / 2) * GRAPH_SIZE;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Knowledge Graph</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Drag the circle to explore articles by bias &amp; credibility
        </Text>
      </View>

      <View style={[styles.graphWrap, Shadows.card]}>
        <Svg width={GRAPH_SIZE} height={GRAPH_SIZE}>
          {/* Axis labels */}
          <SvgText x={8} y={GRAPH_SIZE / 2} fill={c.textMuted} fontSize={10}>High cred</SvgText>
          <SvgText x={8} y={GRAPH_SIZE - 8} fill={c.textMuted} fontSize={10}>Low cred</SvgText>
          <SvgText x={8} y={20} fill={c.textMuted} fontSize={10}>Left</SvgText>
          <SvgText x={GRAPH_SIZE - 30} y={20} fill={c.textMuted} fontSize={10}>Right</SvgText>

          {/* Center crosshair */}
          <Line x1={CENTER} y1={0} x2={CENTER} y2={GRAPH_SIZE} stroke={c.border} strokeWidth={1} />
          <Line x1={0} y1={CENTER} x2={GRAPH_SIZE} y2={CENTER} stroke={c.border} strokeWidth={1} />

          {/* Articles */}
          {articles.map(a => {
            const pos = toSvg(a.x, a.y, GRAPH_SIZE);
            return (
              <Circle
                key={a.id}
                cx={pos.cx}
                cy={pos.cy}
                r={6}
                fill={c.tint}
                opacity={0.8}
                onPress={() => setSelected(a)}
              />
            );
          })}

          {/* Selection radius */}
          <Circle
            cx={svgCenter.cx}
            cy={svgCenter.cy}
            r={svgRadius}
            fill={c.tint}
            fillOpacity={0.08}
            stroke={c.tint}
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <Circle
            cx={svgCenter.cx}
            cy={svgCenter.cy}
            r={8}
            fill={c.tint}
          />
        </Svg>
      </View>

      <View style={styles.controls}>
        <Text style={[styles.controlLabel, { color: c.textSecondary }]}>
          Radius: {(radius * 100).toFixed(0)}%
        </Text>
        <View style={styles.radiusRow}>
          <TouchableOpacity
            style={[styles.radiusBtn, { borderColor: c.border }]}
            onPress={() => setRadius(r => Math.max(0.1, r - 0.1))}
          >
            <Text style={{ color: c.text, fontSize: 18 }}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radiusBtn, { borderColor: c.border }]}
            onPress={() => setRadius(r => Math.min(1, r + 0.1))}
          >
            <Text style={{ color: c.text, fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: c.tint }]}
          onPress={fetchRecommendations}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={c.tintForeground} />
            : <Text style={[styles.searchBtnText, { color: c.tintForeground }]}>
                Find Articles
              </Text>
          }
        </TouchableOpacity>
      </View>

      {selected && (
        <View style={[styles.selectedCard, { backgroundColor: c.card, borderColor: c.border }, Shadows.elevated]}>
          <Text style={[styles.selectedTitle, { color: c.text }]} numberOfLines={2}>
            {selected.title}
          </Text>
          <Text style={[styles.selectedPub, { color: c.textSecondary }]}>
            {selected.publisher_name}
          </Text>
          <View style={styles.selectedActions}>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={{ color: c.textMuted }}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.readBtn, { backgroundColor: c.tint }]}
              onPress={() => { setSelected(null); router.push(`/article/${selected.id}`); }}
            >
              <Text style={{ color: c.tintForeground, fontWeight: '600' }}>Read</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.lg },
  title: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  subtitle: { fontSize: Typography.size.sm, marginTop: 2 },
  graphWrap: {
    marginHorizontal: Spacing['2xl'],
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  controls: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  controlLabel: { fontSize: Typography.size.sm },
  radiusRow: { flexDirection: 'row', gap: Spacing.sm },
  radiusBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  searchBtnText: { fontWeight: Typography.weight.semibold },
  selectedCard: {
    position: 'absolute',
    bottom: 100,
    left: Spacing['2xl'],
    right: Spacing['2xl'],
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  selectedTitle: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold },
  selectedPub: { fontSize: Typography.size.sm },
  selectedActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  readBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
});
