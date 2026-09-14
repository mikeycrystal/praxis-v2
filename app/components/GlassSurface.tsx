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
};

export function GlassSurface({
  fallbackStyle,
  style,
  tintColor,
  isInteractive,
  children,
  ...rest
}: GlassSurfaceProps) {
  if (hasLiquidGlass) {
    return (
      <GlassView
        style={style}
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
