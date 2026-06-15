import { Platform, StyleSheet } from 'react-native';

export const completionRadii = {
  hero: 0,
  card: 22,
  pill: 14,
  chip: 12,
  thumb: 18,
} as const;

export const completionSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  section: 32,
} as const;

export const completionShadow = StyleSheet.create({
  card: {
    shadowColor: '#1A120C',
    shadowOpacity: Platform.OS === 'ios' ? 0.08 : 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  lifted: {
    shadowColor: '#1A120C',
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.16,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 32,
    elevation: 8,
  },
});

/** Glass surfaces — warm tint to match Traces palette */
export const glass = {
  light: 'rgba(255,252,248,0.72)',
  lightBorder: 'rgba(255,255,255,0.35)',
  dark: 'rgba(44,36,24,0.45)',
  tint: 'rgba(99,14,19,0.06)',
} as const;
