import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from './GlassSurface';

// The floating glass tab pill (glass chrome build, Ayuka 2026-09-14).
// - Occupies the same layout height as the old full-width bar, so no screen
//   layout (card size included) changes underneath it.
// - A glass "lens" highlights the active tab and glides across on switch.
// - Non-iOS-26 devices fall back to a cream pill in today's palette.

const TINT = '#8DAE73';
const INACTIVE = '#73706A';
const PILL_WIDTH = 224;
const PILL_HEIGHT = 60;
const LENS_WIDTH = PILL_WIDTH / 2 - 10;

// The Graph tab's crosshair icon (moved from (tabs)/_layout.tsx).
export function GraphTabIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Line x1="13" y1="5.3" x2="13" y2="20.7" stroke={color} strokeWidth="1.9" strokeLinecap="round" opacity="0.95" />
      <Line x1="5.3" y1="13" x2="20.7" y2="13" stroke={color} strokeWidth="1.9" strokeLinecap="round" opacity="0.95" />
      <Circle cx="13" cy="13" r="2.1" fill={color} opacity="0.96" />
      <Line x1="13" y1="3.4" x2="13" y2="4.8" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <Line x1="3.4" y1="13" x2="4.8" y2="13" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <Line x1="21.2" y1="13" x2="22.6" y2="13" stroke={color} strokeWidth="1.45" strokeLinecap="round" opacity="0.78" />
      <Line x1="18.2" y1="6.9" x2="18.2" y2="9.1" stroke={color} strokeWidth="1.35" strokeLinecap="round" opacity="0.82" />
      <Line x1="17.1" y1="8" x2="19.3" y2="8" stroke={color} strokeWidth="1.35" strokeLinecap="round" opacity="0.82" />
    </Svg>
  );
}

const VISIBLE_TABS = ['index', 'graph'] as const;

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = VISIBLE_TABS
    .map((name) => state.routes.find((route) => route.name === name))
    .filter((route): route is (typeof state.routes)[number] => Boolean(route));

  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === state.routes[state.index]?.key),
  );

  const lensPosition = useSharedValue(activeVisibleIndex);
  useEffect(() => {
    // Crisp glide, no overshoot — the spring version wobbled before settling.
    lensPosition.value = withTiming(activeVisibleIndex, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeVisibleIndex, lensPosition]);

  const lensStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 6 + lensPosition.value * (PILL_WIDTH / 2 - 1) },
    ],
  }));

  const isFocusedVisible = (routeKey: string) =>
    state.routes[state.index]?.key === routeKey;

  return (
    <View
      style={[
        s.strip,
        {
          height: PILL_HEIGHT + 10 + Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 14),
          paddingBottom: Math.max(insets.bottom - 4, Platform.OS === 'web' ? 8 : 10),
        },
      ]}
      pointerEvents="box-none"
    >
      <GlassSurface
        style={s.pill}
        glassEffectStyle="clear"
        tintColor="rgba(252,250,244,0.14)"
        fallbackStyle={s.pillFallback}
      >
        <Animated.View style={[s.lens, lensStyle]} />
        {visibleRoutes.map((route) => {
          const focused = isFocusedVisible(route.key);
          const color = focused ? TINT : INACTIVE;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={s.tab}
            >
              <View style={s.iconFrame}>
                {route.name === 'index' ? (
                  <Ionicons name="newspaper-outline" size={22} color={color} />
                ) : (
                  <GraphTabIcon color={color} />
                )}
                {focused ? <View style={[s.dot, { backgroundColor: TINT }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  pillFallback: {
    backgroundColor: '#FBF7F0',
    borderWidth: 1,
    borderColor: '#E7DEC9',
    shadowColor: '#28241C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  lens: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: LENS_WIDTH,
    height: PILL_HEIGHT - 12,
    borderRadius: (PILL_HEIGHT - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  dot: {
    position: 'absolute',
    bottom: -9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
