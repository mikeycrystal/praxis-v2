import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Dimensions,
  TouchableOpacity, ActivityIndicator, ScrollView, PanResponder, Animated,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Rect, Defs, Pattern } from 'react-native-svg';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import TopicSelector, { TopicSelectorRef } from '../components/news-feed/TopicSelector';

const { width: W } = Dimensions.get('window');
const GRAPH_SIZE = W - 32;

// Map article x (-1..1 bias) and y (0..1 credibility) to SVG coords
const toSvg = (x: number, y: number) => ({
  cx: ((x + 1) / 2) * GRAPH_SIZE,
  cy: (1 - y) * GRAPH_SIZE,
});

interface GraphArticle {
  id: number;
  title: string;
  x: number;
  y: number;
  publisher_name?: string;
}

export default function ConfigScreen() {
  const { profile } = useAuth();
  const { c, Radius } = useTheme();
  const topicRef = useRef<TopicSelectorRef>(null);

  const [pinX, setPinX] = useState(0);
  const [pinY, setPinY] = useState(0.7);
  const [radius, setRadius] = useState(0.35);
  const [zoom, setZoom] = useState(1);
  const [articles, setArticles] = useState<GraphArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GraphArticle | null>(null);
  const [panning, setPanning] = useState(false);

  const pin = toSvg(pinX, pinY);
  const svgRadius = (radius / 2) * GRAPH_SIZE;

  const handleGraphPress = (evt: any) => {
    if (panning) return;
    const { locationX, locationY } = evt.nativeEvent;
    const nx = (locationX / GRAPH_SIZE) * 2 - 1;
    const ny = 1 - locationY / GRAPH_SIZE;
    setPinX(Math.max(-1, Math.min(1, nx)));
    setPinY(Math.max(0, Math.min(1, ny)));
  };

  const fetchArticles = async () => {
    setLoading(true);
    const config = topicRef.current?.getConfig();
    const topics = config?.type === 'topics' ? config.topics : (profile?.topics ?? []);
    const { data, error } = await supabase.functions.invoke('recommend', {
      body: { topics, center_x: pinX, center_y: pinY, radius, prompt: config?.freeText },
    });
    if (!error && data?.articles) {
      setArticles(data.articles);
    }
    setLoading(false);
  };

  const biasLabel = pinX < -0.33 ? 'Left' : pinX > 0.33 ? 'Right' : 'Center';
  const credLabel = pinY > 0.66 ? 'High' : pinY > 0.33 ? 'Medium' : 'Low';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={[s.title, { color: c.text }]}>Configure Feed</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>
            Select topics and tap the graph to set your bias/credibility preference.
          </Text>
        </View>

        {/* Topic selector */}
        <View style={s.section}>
          <TopicSelector ref={topicRef} defaultTopics={profile?.topics ?? ['Technology']} />
        </View>

        {/* Graph */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textSecondary }]}>PLACEMENT</Text>
          <Text style={[s.sectionSub, { color: c.textMuted }]}>
            Tap the graph to place your preference pin. X = bias, Y = credibility.
          </Text>

          <View style={[s.graphWrap, { borderColor: c.border }]}>
            <Svg
              width={GRAPH_SIZE}
              height={GRAPH_SIZE}
              onPress={handleGraphPress}
            >
              {/* Background */}
              <Rect x={0} y={0} width={GRAPH_SIZE} height={GRAPH_SIZE} fill={c.secondary} />

              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map(f => (
                <React.Fragment key={f}>
                  <Line
                    x1={f * GRAPH_SIZE} y1={0}
                    x2={f * GRAPH_SIZE} y2={GRAPH_SIZE}
                    stroke={c.border} strokeWidth={1}
                  />
                  <Line
                    x1={0} y1={f * GRAPH_SIZE}
                    x2={GRAPH_SIZE} y2={f * GRAPH_SIZE}
                    stroke={c.border} strokeWidth={1}
                  />
                </React.Fragment>
              ))}

              {/* Center axes */}
              <Line x1={GRAPH_SIZE / 2} y1={0} x2={GRAPH_SIZE / 2} y2={GRAPH_SIZE} stroke={c.border} strokeWidth={1.5} strokeDasharray="6,4" />
              <Line x1={0} y1={GRAPH_SIZE / 2} x2={GRAPH_SIZE} y2={GRAPH_SIZE / 2} stroke={c.border} strokeWidth={1.5} strokeDasharray="6,4" />

              {/* Axis labels */}
              <SvgText x={8} y={18} fill={c.textMuted} fontSize={10} fontWeight="600">HIGH CRED</SvgText>
              <SvgText x={8} y={GRAPH_SIZE - 6} fill={c.textMuted} fontSize={10} fontWeight="600">LOW CRED</SvgText>
              <SvgText x={8} y={GRAPH_SIZE / 2 + 4} fill={c.textMuted} fontSize={10}>LEFT</SvgText>
              <SvgText x={GRAPH_SIZE - 36} y={GRAPH_SIZE / 2 + 4} fill={c.textMuted} fontSize={10}>RIGHT</SvgText>

              {/* Result articles */}
              {articles.map(a => {
                const pos = toSvg(a.x, a.y);
                return (
                  <Circle
                    key={a.id}
                    cx={pos.cx} cy={pos.cy} r={5}
                    fill={c.tint} opacity={0.75}
                    onPress={() => setSelected(a)}
                  />
                );
              })}

              {/* Selection radius circle */}
              <Circle
                cx={pin.cx} cy={pin.cy}
                r={svgRadius}
                fill={c.tint} fillOpacity={0.08}
                stroke={c.tint} strokeWidth={1.5}
                strokeDasharray="6,4"
              />
              {/* Pin */}
              <Circle cx={pin.cx} cy={pin.cy} r={10} fill={c.tint} />
              <Circle cx={pin.cx} cy={pin.cy} r={5} fill="#fff" />
            </Svg>
          </View>

          {/* Pin info + radius controls */}
          <View style={s.pinInfo}>
            <Text style={[s.pinInfoText, { color: c.textSecondary }]}>
              Pin: {biasLabel} bias · {credLabel} credibility
            </Text>
          </View>

          <View style={s.radiusRow}>
            <Text style={[s.radiusLabel, { color: c.textMuted }]}>Radius: {Math.round(radius * 100)}%</Text>
            <View style={s.radiusBtns}>
              {[['−', -0.05], ['+', 0.05]].map(([label, delta]) => (
                <TouchableOpacity
                  key={label as string}
                  style={[s.radiusBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
                  onPress={() => setRadius(r => Math.max(0.1, Math.min(1, r + (delta as number))))}
                >
                  <Text style={[s.radiusBtnText, { color: c.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <View style={s.zoomBtns}>
                {[['−', -1], ['+', 1]].map(([label, delta]) => (
                  <TouchableOpacity
                    key={`z${label}`}
                    style={[s.radiusBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
                    onPress={() => setZoom(z => Math.max(1, Math.min(3, z + (delta as number))))}
                    disabled={(delta === -1 && zoom <= 1) || (delta === 1 && zoom >= 3)}
                  >
                    <Text style={[s.radiusBtnText, { color: c.text }]}>Zoom {label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Fetch button */}
        <View style={[s.section, { paddingBottom: 32 }]}>
          <TouchableOpacity
            style={[s.fetchBtn, { backgroundColor: c.tint }]}
            onPress={fetchArticles}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={c.tintForeground} />
              : <Text style={[s.fetchBtnText, { color: c.tintForeground }]}>Read →</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Selected article popup */}
      {selected && (
        <View style={[s.popup, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.popupTitle, { color: c.text }]} numberOfLines={2}>{selected.title}</Text>
          {selected.publisher_name && (
            <Text style={[s.popupPub, { color: c.textMuted }]}>{selected.publisher_name}</Text>
          )}
          <View style={s.popupActions}>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={[{ color: c.textMuted, fontSize: 14 }]}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.popupReadBtn, { backgroundColor: c.tint }]}
              onPress={() => { setSelected(null); router.push(`/article/${selected.id}`); }}
            >
              <Text style={{ color: c.tintForeground, fontWeight: '600', fontSize: 14 }}>Read</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// Need React import for JSX fragment inside SVG
import React from 'react';

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  section: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionSub: { fontSize: 13 },
  graphWrap: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  pinInfo: { alignItems: 'center' },
  pinInfoText: { fontSize: 13 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radiusLabel: { fontSize: 13 },
  radiusBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  zoomBtns: { flexDirection: 'row', gap: 8 },
  radiusBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  radiusBtnText: { fontSize: 14, fontWeight: '600' },
  fetchBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fetchBtnText: { fontSize: 16, fontWeight: '700' },
  popup: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    padding: 16, borderRadius: 16, borderWidth: 1, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  popupTitle: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  popupPub: { fontSize: 12 },
  popupActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  popupReadBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
});
