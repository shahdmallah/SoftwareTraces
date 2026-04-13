import type { ViewStyle } from 'react-native';

import { colors } from './colors';

export const commonShadows: Record<'soft' | 'medium', ViewStyle> = {
  soft: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
};
