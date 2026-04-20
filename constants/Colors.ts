/**
 * Design tokens matching the flow-news web app's dark premium theme.
 *
 * Web CSS variable → React Native hex conversion:
 *   --background:        220 13%  9%  → #14161B
 *   --foreground:        210 40% 98%  → #F5F9FC
 *   --card:              220 13% 12%  → #1B1D23
 *   --primary:           214 84% 56%  → #3B82F6
 *   --secondary:         220 13% 16%  → #24272D
 *   --muted-foreground:  215 20%  65%  → #94A3B8
 *   --border:            220 13% 20%  → #2D303B
 *   --destructive:       0   84% 60%  → #EF4444
 */

export const Colors = {
  // Dark is the primary theme (matches web). Light is a lighter variant.
  dark: {
    background: '#14161B',
    card: '#1B1D23',
    surface: '#22252D',

    text: '#F5F9FC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',

    tint: '#3B82F6',
    tintForeground: '#FFFFFF',

    secondary: '#24272D',
    secondaryForeground: '#E2E8F0',
    muted: '#24272D',

    border: '#2D303B',
    inputBorder: '#2D303B',

    destructive: '#EF4444',
    bookmarkActive: '#F59E0B',

    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#3B82F6',

    overlay: 'rgba(20, 22, 27, 0.85)',
    overlayGradient: 'rgba(20, 22, 27, 0.0)',
    overlayGradientEnd: 'rgba(20, 22, 27, 0.92)',

    // Sentiment colors (from web AIArticle)
    sentimentPositive: '#22C55E',
    sentimentNeutral: '#3B82F6',
    sentimentNegative: '#EF4444',
    sentimentExcited: '#F59E0B',

    // Credibility score colors
    credHigh: '#22C55E',
    credMed: '#3B82F6',
    credLow: '#F59E0B',
    credPoor: '#EF4444',
  },
  light: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    surface: '#F1F5F9',

    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',

    tint: '#3B82F6',
    tintForeground: '#FFFFFF',

    secondary: '#F1F5F9',
    secondaryForeground: '#0F172A',
    muted: '#F1F5F9',

    border: '#E2E8F0',
    inputBorder: '#E2E8F0',

    destructive: '#EF4444',
    bookmarkActive: '#F59E0B',

    icon: '#475569',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#3B82F6',

    overlay: 'rgba(15, 23, 42, 0.7)',
    overlayGradient: 'rgba(15, 23, 42, 0.0)',
    overlayGradientEnd: 'rgba(15, 23, 42, 0.85)',

    sentimentPositive: '#16A34A',
    sentimentNeutral: '#2563EB',
    sentimentNegative: '#DC2626',
    sentimentExcited: '#D97706',

    credHigh: '#16A34A',
    credMed: '#2563EB',
    credLow: '#D97706',
    credPoor: '#DC2626',
  },
};
