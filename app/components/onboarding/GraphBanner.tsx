import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Port of the web GraphBanner: after the first swipe, a card above the tab
// bar points at the Graph tab. It leaves after 5 seconds or two more swipes.
interface GraphBannerProps {
  onDismiss: () => void;
  swipeCount?: number;
}

export const GraphBanner = ({ onDismiss, swipeCount = 0 }: GraphBannerProps) => {
  const progress = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.timing(progress, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDismiss());
  };

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 300, delay: 50, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (swipeCount >= 2) dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeCount]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const arrowY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  return (
    <Animated.View style={[s.anchor, { opacity: progress, transform: [{ translateY }] }]} pointerEvents="none">
      <View style={s.card}>
        {/* Pointer toward the Graph tab (right half of the tab bar) */}
        <Animated.View style={[s.pointer, { transform: [{ translateY: arrowY }] }]}>
          <View style={s.pointerStem} />
          <View style={s.pointerHead} />
        </Animated.View>
        <View style={s.row}>
          <View style={s.iconWrap}>
            <Ionicons name="trending-up" size={15} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.lead}>Tap the graph tab to customize your feed</Text>
            <Text style={s.sub}>Choose topics and adjust political range</Text>
          </View>
        </View>
        <View style={s.dots}>
          <View style={[s.dot, { backgroundColor: '#60A5FA' }]} />
          <View style={[s.dot, { backgroundColor: '#93C5FD' }]} />
          <View style={[s.dot, { backgroundColor: '#BFDBFE' }]} />
        </View>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, bottom: 64, alignItems: 'center', zIndex: 90 },
  card: {
    width: 300,
    maxWidth: '92%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 14,
    shadowColor: '#2563EB',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  pointer: { position: 'absolute', bottom: -24, right: '22%', alignItems: 'center' },
  pointerStem: { width: 2, height: 12, borderRadius: 1, backgroundColor: 'rgba(147,197,253,0.8)' },
  pointerHead: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#60A5FA',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { marginTop: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  lead: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 18 },
  sub: { marginTop: 4, fontSize: 12, color: '#4B5563', lineHeight: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
