import { useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  useColorScheme, Dimensions, PanResponder, Animated,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Typography, Spacing, Shadows } from '@/constants/Theme';
import type { Article } from '../../(tabs)/index';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  article: Article;
  isSaved: boolean;
  onSave: () => void;
  onRead: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export function ArticleCard({ article, isSaved, onSave, onRead, onSwipeLeft, onSwipeRight }: Props) {
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
    onPanResponderMove: (_, { dx }) => translateX.setValue(dx),
    onPanResponderRelease: (_, { dx }) => {
      if (dx < -80) {
        Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(onSwipeLeft);
      } else if (dx > 80) {
        Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(onSwipeRight);
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  const biasLabel = article.x < -0.3 ? 'Left' : article.x > 0.3 ? 'Right' : 'Center';
  const credColor = article.y > 0.6 ? c.tint : article.y > 0.3 ? '#E8B008' : c.destructive;

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: c.card, transform: [{ translateX }, { rotate }] }, Shadows.card]}
      {...panResponder.panHandlers}
    >
      {article.image_url ? (
        <Image source={{ uri: article.image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: c.secondary }]} />
      )}

      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={[styles.publisher, { color: c.textSecondary }]}>
            {article.publisher?.name ?? 'Unknown'}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: c.secondary }]}>
              <Text style={[styles.badgeText, { color: c.textSecondary }]}>{biasLabel}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: credColor + '20' }]}>
              <View style={[styles.dot, { backgroundColor: credColor }]} />
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={onRead}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={3}>{article.title}</Text>
        </TouchableOpacity>

        {article.lede ? (
          <Text style={[styles.lede, { color: c.textSecondary }]} numberOfLines={2}>
            {article.lede}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity onPress={onSave} style={styles.actionBtn}>
            <Text style={{ fontSize: 22, color: isSaved ? c.bookmarkActive : c.textMuted }}>
              {isSaved ? '🔖' : '🔗'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRead} style={[styles.readBtn, { backgroundColor: c.tint }]}>
            <Text style={[styles.readBtnText, { color: c.tintForeground }]}>Read</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '45%' },
  imagePlaceholder: { width: '100%', height: '45%' },
  body: { flex: 1, padding: Spacing.xl, gap: Spacing.sm },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  publisher: { fontSize: Typography.size.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  badges: { flexDirection: 'row', gap: Spacing.xs },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: Typography.size.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, lineHeight: 26 },
  lede: { fontSize: Typography.size.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  actionBtn: { padding: Spacing.sm },
  readBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  readBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
});
