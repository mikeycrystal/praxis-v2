import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Typography, Spacing, Shadows } from '@/constants/Theme';

export function useTheme() {
  const scheme = useColorScheme();
  // Praxis is a single-theme app: the feed, graph and settings are always
  // the cream paper look, so themed screens follow the same palette
  // regardless of the device scheme (Ayuka, 2026-09-14).
  const c = Colors.light;
  return { c, scheme, Radius, Typography, Spacing, Shadows };
}
