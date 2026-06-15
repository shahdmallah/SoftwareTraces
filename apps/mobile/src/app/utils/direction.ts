import type { TextStyle, ViewStyle } from 'react-native';

export const rtlText: TextStyle = {
  textAlign: 'right',
  writingDirection: 'rtl',
};

export const ltrText: TextStyle = {
  textAlign: 'left',
  writingDirection: 'ltr',
};

export const rtlRow: ViewStyle = {
  flexDirection: 'row-reverse',
};

export const ltrRow: ViewStyle = {
  flexDirection: 'row',
};

export const rtlAlignEnd: ViewStyle = {
  alignItems: 'flex-end',
};

export const ltrAlignStart: ViewStyle = {
  alignItems: 'flex-start',
};
