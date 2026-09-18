import { useEffect, useState } from 'react';
import { Platform, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// One switch for the whole app: real Liquid Glass on iOS 26+, and the
// pre-glass cream look everywhere else. Never hand-rolled blur — the native
// material handles Reduce Transparency / Increase Contrast for free.
export const hasLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

// Runtime override, so one build can answer "is the glass bar what makes
// the tab switch lag?" from Settings instead of a diagnosis build per guess
// (Ayuka, 2026-09-18: "still a bit laggy to switch to the graph page").
// Default on; persisted; applies live to every subscriber.
const GLASS_PREF_KEY = 'praxis.glassEnabled.v1';
let glassEnabled = true;
const glassListeners = new Set<(value: boolean) => void>();
void AsyncStorage.getItem(GLASS_PREF_KEY).then((stored) => {
  if (stored === 'off') {
    glassEnabled = false;
    glassListeners.forEach((listener) => listener(false));
  }
});

export function setGlassEnabled(value: boolean) {
  glassEnabled = value;
  glassListeners.forEach((listener) => listener(value));
  void AsyncStorage.setItem(GLASS_PREF_KEY, value ? 'on' : 'off');
}

export function useGlassEnabled() {
  const [value, setValue] = useState(glassEnabled);
  useEffect(() => {
    glassListeners.add(setValue);
    setValue(glassEnabled);
    return () => {
      glassListeners.delete(setValue);
    };
  }, []);
  return hasLiquidGlass && value;
}

type GlassSurfaceProps = ViewProps & {
  // Applied only when the native material is unavailable — the "today" look.
  fallbackStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  isInteractive?: boolean;
  glassEffectStyle?: 'clear' | 'regular' | 'none';
  // When false, always render the fallback — used to keep glass off
  // offscreen/stacked copies of a component (glass on moving layers is slow).
  enabled?: boolean;
};

export function GlassSurface({
  fallbackStyle,
  style,
  tintColor,
  isInteractive,
  glassEffectStyle,
  enabled = true,
  children,
  ...rest
}: GlassSurfaceProps) {
  const glassOn = useGlassEnabled();
  if (glassOn && enabled) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        colorScheme="light"
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, fallbackStyle]} {...rest}>
      {children}
    </View>
  );
}
