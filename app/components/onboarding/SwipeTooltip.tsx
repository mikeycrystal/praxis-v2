import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

// Port of the web SwipeTooltip, adjusted for the phone: the bubble sits
// below the card (never over the headline or the Read pill), nothing is
// laid over the deck so the first swipe goes straight to the card, and it
// only leaves on that swipe or on a tap. No timer.
interface SwipeTooltipProps {
  onDismiss: () => void;
}

export const SwipeTooltip = ({ onDismiss }: SwipeTooltipProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDismiss());
  };

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 300, delay: 50, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, s.root, { opacity }]} pointerEvents="box-none">
      <View style={s.anchor} pointerEvents="box-none">
        <Pressable style={s.bubble} onPress={dismiss}>
          <View style={s.body}>
            <Text style={s.lead}>Swipe left or right to explore coverage</Text>
            <Text style={s.sub}>Tap the card to flip and dive deeper</Text>
          </View>
          <View style={s.footer}>
            <Text style={s.footerText}>Swipe to start  ↗</Text>
          </View>
          <Text style={s.hand} accessibilityElementsHidden>👆🏻</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  root: { zIndex: 100 },
  anchor: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', paddingHorizontal: 16 },
  bubble: {
    width: 270,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E2DE',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  lead: { fontSize: 13, fontWeight: '600', color: '#3D3A37', lineHeight: 17 },
  sub: { marginTop: 4, fontSize: 12, color: '#6C6863', lineHeight: 16 },
  footer: { borderTopWidth: 1, borderTopColor: '#EFEDE8', paddingHorizontal: 16, paddingVertical: 10 },
  footerText: { fontSize: 12, color: '#8A8782' },
  hand: { position: 'absolute', right: -8, bottom: 3, fontSize: 28, lineHeight: 30 },
});
