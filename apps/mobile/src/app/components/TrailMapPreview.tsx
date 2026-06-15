import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useLanguage } from '../contexts/LanguageContext';
import { buildMapImageUri } from '../config/mapConfig';

interface TrailMapPreviewProps {
  trail: any;
  miniRoutePoints: Array<{ x: number; y: number }>;
  miniRoutePath: string;
  mapImageUri: string;
  onPress: () => void;
}

export function TrailMapPreview({
  trail,
  miniRoutePoints,
  miniRoutePath,
  mapImageUri,
  onPress,
}: TrailMapPreviewProps) {
  const { t } = useLanguage();

  const mapStartPoint = miniRoutePoints[0] ?? { x: 28, y: 92 };
  const mapEndPoint = miniRoutePoints[miniRoutePoints.length - 1] ?? { x: 140, y: 34 };

  return (
    <Pressable
      style={({ pressed }) => [styles.heroMapWidget, pressed && styles.primaryButtonPressed]}
      onPress={onPress}
    >
      {mapImageUri ? (
        <Image
          source={{ uri: mapImageUri }}
          style={styles.heroMapImage}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.heroMapPreviewBadge}>
        <Ionicons name="map-outline" size={14} color="#1C1D18" />
        <Text style={styles.heroMapPreviewBadgeText}>{t('previewOnMap')}</Text>
      </View>
      <Svg width="100%" height="100%" viewBox="0 0 170 120" style={styles.heroMapOverlay}>
        <Defs>
          <LinearGradient id="mapTerrain" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F4EFE2" />
            <Stop offset="0.52" stopColor="#ECE3D1" />
            <Stop offset="1" stopColor="#E0D5BF" />
          </LinearGradient>
          <LinearGradient id="mapWater" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B8DCEC" />
            <Stop offset="1" stopColor="#8EC2DD" />
          </LinearGradient>
        </Defs>

        {!mapImageUri ? (
          <>
            <Rect width="170" height="170" fill="url(#mapTerrain)" />

            <Path
              d="M -8 102 C 18 84, 58 74, 95 82 C 122 88, 148 104, 178 101 L 178 130 L -8 130 Z"
              fill="rgba(114,156,106,0.22)"
            />
            <Path
              d="M 108 -8 C 92 12, 89 28, 102 52 C 114 75, 138 97, 182 108 L 182 -8 Z"
              fill="rgba(198,186,161,0.36)"
            />
            <Path
              d="M -8 28 C 24 18, 56 20, 89 30 C 118 38, 144 35, 178 18 L 178 48 C 143 57, 118 60, 90 52 C 59 44, 28 42, -8 52 Z"
              fill="url(#mapWater)"
              opacity={0.95}
            />

            <Path d="M -6 86 C 28 70, 56 68, 92 76 C 120 82, 147 76, 178 58" fill="none" stroke="#FAF8F2" strokeWidth={12} strokeLinecap="round" />
            <Path d="M -6 86 C 28 70, 56 68, 92 76 C 120 82, 147 76, 178 58" fill="none" stroke="#D5C7AE" strokeWidth={4.5} strokeLinecap="round" />
            <Path d="M 124 -8 C 112 14, 106 34, 106 60 C 108 84, 118 103, 140 128" fill="none" stroke="#FAF8F2" strokeWidth={10} strokeLinecap="round" />
            <Path d="M 124 -8 C 112 14, 106 34, 106 60 C 108 84, 118 103, 140 128" fill="none" stroke="#D5C7AE" strokeWidth={4} strokeLinecap="round" />
            <Path
              d="M 18 16 C 42 26, 74 20, 104 28 C 128 34, 146 52, 160 72"
              fill="none"
              stroke="rgba(110,101,79,0.16)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <Path
              d="M 8 44 C 34 50, 62 48, 94 56 C 120 63, 142 80, 164 100"
              fill="none"
              stroke="rgba(110,101,79,0.12)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <Path
              d="M 6 64 C 30 58, 54 60, 83 72 C 112 84, 132 90, 160 88"
              fill="none"
              stroke="rgba(110,101,79,0.10)"
              strokeWidth={1.2}
              strokeLinecap="round"
            />
            <Path
              d="M 36 10 C 52 28, 48 44, 62 60"
              fill="none"
              stroke="rgba(110,101,79,0.18)"
              strokeWidth={2}
              strokeDasharray="5 6"
              strokeLinecap="round"
            />

            <Rect x={18} y={72} width={16} height={10} rx={3} fill="rgba(255,255,255,0.74)" />
            <Rect x={136} y={66} width={14} height={9} rx={3} fill="rgba(255,255,255,0.72)" />
            <Rect x={118} y={86} width={20} height={10} rx={3} fill="rgba(255,255,255,0.72)" />
          </>
        ) : null}

        <Path
          d={miniRoutePath}
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={miniRoutePath}
          fill="none"
          stroke="#2FAF62"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={mapStartPoint.x} cy={mapStartPoint.y} r={5} fill="#FFFFFF" stroke="#1C1D18" strokeWidth={1.5} />
        <Circle cx={mapStartPoint.x} cy={mapStartPoint.y} r={2.5} fill="#2FAF62" />
        <Circle cx={mapEndPoint.x} cy={mapEndPoint.y} r={5} fill="#FFFFFF" stroke="#1C1D18" strokeWidth={1.5} />
        <Circle cx={mapEndPoint.x} cy={mapEndPoint.y} r={2.5} fill="#7A1E1E" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroMapWidget: {
    width: '100%',
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  heroMapPreviewBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroMapPreviewBadgeText: {
    color: '#1C1D18',
    fontSize: 10,
    fontWeight: '800',
  },
  heroMapImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroMapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});