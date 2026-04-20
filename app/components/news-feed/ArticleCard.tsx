import { useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, PanResponder, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import type { Article } from '../../(tabs)/index';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// 3:4 portrait aspect ratio matching the web card
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

interface Props {
  article: Article;
  isSaved: boolean;
  onSave: () => void;
  onRead: () => void;
  onAIAnalysis: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isFirst?: boolean;
}

export function ArticleCard({
  article, isSaved, onSave, onRead, onAIAnalysis,
  onSwipeLeft, onSwipeRight, isFirst,
}: Props) {
  const { c, Radius } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Rotation based on horizontal drag
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  // Opacity of swipe direction indicators
  const leftOpacity = translateX.interpolate({
    inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const rightOpacity = translateX.interpolate({
    inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp',
  });

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
    onPanResponderMove: (_, { dx, dy }) => {
      translateX.setValue(dx);
      translateY.setValue(dy * 0.2); // subtle vertical float
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      const threshold = Math.abs(dx) > 80 || Math.abs(vx) > 0.5;
      if (threshold && dx < 0) {
        Animated.timing(translateX, {
          toValue: -SCREEN_WIDTH * 1.5,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          translateX.setValue(0);
          translateY.setValue(0);
          onSwipeLeft();
        });
      } else if (threshold && dx > 0) {
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH * 1.5,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          translateX.setValue(0);
          translateY.setValue(0);
          onSwipeRight();
        });
      } else {
        // Snap back — cubic-bezier(0.23, 1, 0.32, 1) feel via spring
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 180 }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 180 }),
        ]).start();
      }
    },
  })).current;

  const biasLabel = article.x < -0.33 ? 'Left' : article.x > 0.33 ? 'Right' : 'Center';
  const biasColor = article.x < -0.33 ? '#3B82F6' : article.x > 0.33 ? '#EF4444' : '#22C55E';

  return (
    <Animated.View
      style={[
        s.card,
        { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: Radius.xxxl },
        { transform: [{ translateX }, { translateY }, { rotate }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Background image */}
      {article.image_url ? (
        <Image source={{ uri: article.image_url }} style={s.image} resizeMode="cover" />
      ) : (
        <View style={[s.imagePlaceholder, { backgroundColor: c.secondary }]} />
      )}

      {/* Dark gradient overlay over bottom portion */}
      <LinearGradient
        colors={['transparent', c.overlayGradientEnd]}
        locations={[0.35, 1]}
        style={s.gradient}
      />

      {/* Top row: category badge + action buttons */}
      <View style={s.topRow}>
        {article.topics?.[0] && (
          <View style={[s.categoryBadge, { backgroundColor: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.3)' }]}>
            <Text style={[s.categoryText, { color: '#3B82F6' }]}>{article.topics[0]}</Text>
          </View>
        )}
        <View style={s.actionBtns}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: 'rgba(59,130,246,0.2)' }]} onPress={onAIAnalysis}>
            <Text style={{ fontSize: 16 }}>🧠</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: 'rgba(0,0,0,0.35)' }]} onPress={onSave}>
            <Text style={{ fontSize: 16 }}>{isSaved ? '🔖' : '🔗'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom content */}
      <View style={s.content}>
        <TouchableOpacity onPress={onRead} activeOpacity={0.9}>
          <Text style={s.title} numberOfLines={3}>{article.title}</Text>
        </TouchableOpacity>
        {article.lede ? (
          <Text style={s.subtitle} numberOfLines={2}>{article.lede}</Text>
        ) : null}
        <View style={s.metaRow}>
          <View style={[s.biasBadge, { backgroundColor: biasColor + '30', borderColor: biasColor + '60' }]}>
            <Text style={[s.biasText, { color: biasColor }]}>{biasLabel}</Text>
          </View>
          <Text style={s.meta}>
            {article.publisher?.name ?? 'Unknown'} · {new Date(article.ts_pub).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Swipe indicators */}
      {isFirst && (
        <>
          <Animated.View style={[s.swipeIndicator, s.swipeLeft, { opacity: leftOpacity }]}>
            <Text style={s.swipeText}>SKIP</Text>
          </Animated.View>
          <Animated.View style={[s.swipeIndicator, s.swipeRight, { opacity: rightOpacity }]}>
            <Text style={s.swipeText}>SAVE</Text>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

export { CARD_WIDTH, CARD_HEIGHT };

const s = StyleSheet.create({
  card: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 16,
  },
  image: { ...StyleSheet.absoluteFillObject },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject },
  gradient: { ...StyleSheet.absoluteFillObject },
  topRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  biasBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1,
  },
  biasText: { fontSize: 11, fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  swipeIndicator: {
    position: 'absolute',
    top: '40%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
  },
  swipeLeft: {
    left: 20,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
    transform: [{ rotate: '-15deg' }],
  },
  swipeRight: {
    right: 20,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.15)',
    transform: [{ rotate: '15deg' }],
  },
  swipeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
});
