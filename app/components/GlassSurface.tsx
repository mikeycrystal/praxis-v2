import { Platform, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// One switch for the whole app: real Liquid Glass on iOS 26+, and the
// pre-glass cream look everywhere else. Never hand-rolled blur — the native
// material handles Reduce Transparency / Increase Contrast for free.
export const hasLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

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
  if (hasLiquidGlass && enabled) {
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
