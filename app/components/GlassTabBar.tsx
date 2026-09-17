import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { hasLiquidGlass } from './GlassSurface';

// The floating glass tab pill (glass chrome build, Ayuka 2026-09-14).
// - Occupies the same layout height as the old full-width bar, so no screen
//   layout (card size included) changes underneath it.
// - A glass "lens" highlights the active tab and glides across on switch.
// - Non-iOS-26 devices fall back to a cream pill in today's palette.

const TINT = '#8DAE73';
const INACTIVE = '#4B463E';
const BAR_MARGIN = 16;

// Clearance for content that must not sit under the floating bar.
export const TAB_BAR_CLEARANCE = 102;
// 64 read as lost in the bottom zone, 80 read as a slab — 66 is the
// settled middle (Ayuka, 2026-09-15: "think we over corrected").
const BAR_HEIGHT = 66;
const LENS_INSET = 6;
const TAB_LABELS: Record<string, string> = { index: 'News', graph: 'Graph' };

// The Graph tab's crosshair icon (moved from (tabs)/_layout.tsx).
export function GraphTabIcon({ color }: { color: string }) {
  return (
    <Svg width={27} height={27} viewBox="0 0 26 26">
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
  const { width: windowWidth } = useWindowDimensions();
  // The strip measures itself: on web-static hydration useWindowDimensions
  // can be frozen at 0 (which once collapsed the bar to negative width), and
  // onLayout is the ground truth on every platform. The floor is the last net.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const barWidth = Math.min(
    Math.max((measuredWidth || windowWidth) - BAR_MARGIN * 2, 260),
    430, // tablet/wide screens: the bar stays hand-sized, centered
  );
  const segmentWidth = (barWidth - LENS_INSET * 2) / 2;
  // Sit low like Apple's floating pill, but clear of the home indicator. At
  // insets.bottom - 13 (~21pt) the indicator crowded the capsule's bottom edge
  // — the gap Ayuka pointed at (2026-09-16). -4 puts the bar 30pt off the edge:
  // ~17pt of clean air under the capsule before the indicator starts. Past ~32
  // it reads as a dead band again (he called 40 and 46 too big the same day).
  const bottomOffset = Math.max(insets.bottom - 4, Platform.OS === 'web' ? 8 : 10);

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
      { translateX: LENS_INSET + lensPosition.value * segmentWidth },
    ],
  }));

  const isFocusedVisible = (routeKey: string) =>
    state.routes[state.index]?.key === routeKey;

  return (
    <View
      style={[
        s.strip,
        {
          height: BAR_HEIGHT + bottomOffset + 10,
          paddingBottom: bottomOffset,
        },
      ]}
      pointerEvents="box-none"
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {/*
        The capsule and the selection lens are SIBLINGS inside a
        GlassContainer — the structure Apple's own tab bars use. Nesting one
        glass view inside another (what this was) gives the inner one nothing
        to refract, so the lens rendered as a flat white blob no matter how it
        was tinted. In a container they sample the same backdrop and merge at
        the rim, which is the Phone-app effect.
      */}
      {hasLiquidGlass ? (
        <GlassContainer spacing={14} style={[s.bar, { width: barWidth }]} pointerEvents="none">
          <GlassView
            style={[StyleSheet.absoluteFillObject, s.capsule]}
            glassEffectStyle="regular"
            // Darker again at his ask — but 0.16 with a working lens reads as
            // smoked glass, where 0.22 with a broken one read as a slab. The
            // hairline rim is what actually makes glass legible on a light
            // page; Apple's own capsule carries one.
            tintColor="rgba(58,52,42,0.16)"
            colorScheme="light"
          />
          <Animated.View style={[s.lensWrap, { width: segmentWidth }, lensStyle]}>
            <GlassView
              style={s.lensGlass}
              glassEffectStyle="clear"
              isInteractive
              tintColor="rgba(255,255,255,0.3)"
              colorScheme="light"
            />
          </Animated.View>
        </GlassContainer>
      ) : (
        <View style={[s.bar, s.barFallback, { width: barWidth }]} pointerEvents="none">
          <Animated.View style={[s.lensWrap, { width: segmentWidth }, lensStyle]}>
            <View style={[s.lensGlass, s.lensFallback]} />
          </Animated.View>
        </View>
      )}
      {/*
        Anchor the buttons to the CAPSULE, not the screen edge. tabRow is
        absolutely positioned, and absolute children ignore the strip's
        paddingBottom, so bottom:0 pinned the row to the screen while the
        capsule rode bottomOffset higher. On his build-126 phone that put the
        Graph icon at the capsule's floor and the label 12pt below it.
      */}
      <View style={[s.bar, s.tabRow, { width: barWidth, bottom: bottomOffset }]}>
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
                  <Ionicons name="newspaper-outline" size={23} color={color} />
                ) : (
                  <GraphTabIcon color={color} />
                )}
                <Text style={[s.tabLabel, { color }]}>{TAB_LABELS[route.name] ?? route.name}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    // Floating overlay: content scrolls (and swipes) underneath the glass —
    // the bar reserves no layout space (Ayuka's Substack reference, 2026-09-14).
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
  capsule: {
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(74,66,54,0.20)',
  },
  // The buttons ride ABOVE the glass rather than inside it, so the glass
  // layer has nothing in it to flatten the effect.
  tabRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  barFallback: {
    backgroundColor: '#FBF7F0',
    borderWidth: 1,
    borderColor: '#E7DEC9',
    shadowColor: '#28241C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  lensWrap: {
    position: 'absolute',
    left: 0,
    top: LENS_INSET,
    height: BAR_HEIGHT - LENS_INSET * 2,
  },
  // The lens is its own liquid-glass capsule (the Phone-app active tab):
  // real refraction on the rim, and isInteractive gives Apple's press
  // shimmer while it glides, before it settles.
  lensGlass: {
    flex: 1,
    borderRadius: (BAR_HEIGHT - LENS_INSET * 2) / 2,
    overflow: 'hidden',
  },
  lensFallback: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#28241C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
