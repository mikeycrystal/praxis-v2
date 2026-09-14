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
  // Praxis paper palette — the cream/green the feed, graph and settings
  // already use. Every useTheme screen now matches (Ayuka, 2026-09-14).
  light: {
    background: '#F7F3EA',
    card: '#FBF7F0',
    surface: '#FFFDFC',

    text: '#2E2A25',
    textSecondary: '#5D554C',
    textMuted: '#8E857A',

    tint: '#8DAE73',
    tintForeground: '#FFFFFF',

    secondary: '#F1ECE0',
    secondaryForeground: '#2E2A25',
    muted: '#F1ECE0',

    border: '#E7DEC9',
    inputBorder: '#E7DEC9',

    destructive: '#B8513A',
    bookmarkActive: '#DB8A2F',

    icon: '#5D554C',
    tabIconDefault: '#8E857A',
    tabIconSelected: '#8DAE73',

    overlay: 'rgba(46, 42, 37, 0.7)',
    overlayGradient: 'rgba(46, 42, 37, 0.0)',
    overlayGradientEnd: 'rgba(46, 42, 37, 0.85)',

    sentimentPositive: '#5F8F4E',
    sentimentNeutral: '#6E88A8',
    sentimentNegative: '#B8513A',
    sentimentExcited: '#DB8A2F',

    credHigh: '#5F8F4E',
    credMed: '#6E88A8',
    credLow: '#DB8A2F',
    credPoor: '#B8513A',
  },
};
