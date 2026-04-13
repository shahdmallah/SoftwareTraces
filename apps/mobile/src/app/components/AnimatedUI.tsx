import React, { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';

type AnimatedBlockProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  fromY?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedBlock({
  children,
  delay = 0,
  duration = 420,
  fromY = 18,
  style,
}: AnimatedBlockProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: fromY, scale: 0.98 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration, delay }}
      style={style}
    >
      {children}
    </MotiView>
  );
}

type AnimatedScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedScreen({ children, style }: AnimatedScreenProps) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 260 }}
      style={style}
    >
      {children}
    </MotiView>
  );
}
