import { colors } from './colors';
import { sizes } from './sizes';
import { spacing } from './spacing';
import { typography } from './typography';
import { radii } from './radii';

export const theme = {
  colors,
  sizes,
  spacing,
  typography,
  radii,
} as const;

export { colors, sizes, spacing, typography, radii };
export { commonShadows } from './commonStyles';
