import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

// Port of the web GraphOnboarding: a dimmed backdrop with a spotlight cutout,
// first on the topics control ("Choose a topic"), then on the graph ("Shape
// your news feed"). Tapping the backdrop or the button advances.
export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphOnboardingProps {
  topicsRect: SpotlightRect | null;
  graphRect: SpotlightRect | null;
  onComplete: () => void;
}

type Step = 'substep1' | 'substep2';

export const GraphOnboarding = ({ topicsRect, graphRect, onComplete }: GraphOnboardingProps) => {
  const [step, setStep] = useState<Step>('substep1');
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [opacity]);

  const target = step === 'substep1' ? topicsRect : graphRect;
  if (!target || target.width === 0 || target.height === 0) return null;

  const advance = () => {
    if (step === 'substep1') {
      setStep('substep2');
      return;
    }
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => onComplete());
  };

  // Both cards sit under their target so the spotlighted element stays
  // visible; if there is no room under the graph, the card goes above it.
  const cardWidth = Math.min(320, viewportWidth - 32);
  const cardHeight = 176;
  const left = Math.min(Math.max(16, target.x + target.width / 2 - cardWidth / 2), viewportWidth - cardWidth - 16);
  const below = target.y + target.height + 18;
  const fitsBelow = below + cardHeight <= viewportHeight - 16;
  const top = fitsBelow ? below : Math.max(16, target.y - 18 - cardHeight);
  const caretUp = fitsBelow;

  const pad = 8;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, s.root, { opacity }]}>
      <Svg width={viewportWidth} height={viewportHeight} style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Defs>
          <Mask id="spotlight">
            <Rect x={0} y={0} width={viewportWidth} height={viewportHeight} fill="#fff" />
            <Rect
              x={target.x - pad}
              y={target.y - pad}
              width={target.width + pad * 2}
              height={target.height + pad * 2}
              rx={12}
              ry={12}
              fill="#000"
            />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={viewportWidth} height={viewportHeight} fill="#000" opacity={0.55} mask="url(#spotlight)" />
      </Svg>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={advance} />

      <View style={[s.card, { width: cardWidth, left, top }]}>
        {caretUp ? <View style={s.caretUp} /> : <View style={s.caretDown} />}
        <Text style={s.title}>{step === 'substep1' ? 'Choose a topic' : 'Shape your news feed'}</Text>
        <Text style={s.body}>
          {step === 'substep1'
            ? 'Browse top stories or search for something specific'
            : 'Select the political perspective and reporting style you want to see'}
        </Text>
        <Pressable style={s.button} onPress={advance} accessibilityRole="button">
          <Text style={s.buttonText}>{step === 'substep1' ? 'Next' : 'Got it'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  root: { zIndex: 95 },
  card: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  caretUp: {
    position: 'absolute',
    top: -9,
    left: '50%',
    marginLeft: -9,
    width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFFFFF',
  },
  caretDown: {
    position: 'absolute',
    bottom: -9,
    left: '50%',
    marginLeft: -9,
    width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  body: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },
  button: { borderRadius: 8, backgroundColor: '#0F172A', paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
