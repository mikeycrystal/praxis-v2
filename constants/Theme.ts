/**
 * Unified design token system matching the flow-news web app.
 * Web uses --radius: 1rem = 16px as the base.
 */

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,    // --radius (1rem)
  xl: 20,
  xxl: 24,
  xxxl: 32,
  full: 9999,
} as const;

export const Typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 22,
    '3xl': 26,
    '4xl': 30,
    '5xl': 36,
  },
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
} as const;

export const Shadows = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 16,
  },
} as const;
