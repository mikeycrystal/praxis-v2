import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Typography, Spacing, Shadows } from '@/constants/Theme';

export function useTheme() {
  const scheme = useColorScheme();
  // Default to dark — matches the web app's primary theme
  const c = Colors[scheme === 'light' ? 'light' : 'dark'];
  return { c, scheme, Radius, Typography, Spacing, Shadows };
}
