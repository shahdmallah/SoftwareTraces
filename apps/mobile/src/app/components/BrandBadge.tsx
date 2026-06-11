import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';

type BrandBadgeSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandBadgeProps {
  showText?: boolean;
  size?: BrandBadgeSize;
  backgroundColor?: string;
  borderColor?: string;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

const sizeMap: Record<BrandBadgeSize, { badge: number; logo: number }> = {
  sm: { badge: 52, logo: 34 },
  md: { badge: 68, logo: 46 },
  lg: { badge: 86, logo: 60 },
  xl: { badge: 108, logo: 78 },
};

export function BrandBadge({
  showText = true,
  size = 'lg',
  backgroundColor = 'rgba(255,255,255,0.16)',
  borderColor = 'rgba(255,255,255,0.22)',
  textStyle,
  containerStyle,
}: BrandBadgeProps) {
  const dims = sizeMap[size];

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.badge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.badge / 2,
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <Image
          source={require('../../../assets/logo.png')}
          accessibilityLabel="Traces logo"
          resizeMode="contain"
          style={{ width: dims.logo, height: dims.logo }}
        />
      </View>
      {showText ? <Text style={textStyle}>Traces</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
