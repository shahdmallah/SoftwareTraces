import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');
const HERO_WIDTH = width ;

interface TrailHeroSectionProps {
  trailImages: string[];
  activeImageIndex: number;
  onImageScroll: (event: any) => void;
  onBackPress: () => void;
  onSavePress: () => void;
  onGalleryPress: () => void;
  onMapPress: () => void;
  isSaved: boolean;
  isSaving: boolean;
  miniRoutePath: string;
}

export function TrailHeroSection({
  trailImages,
  activeImageIndex,
  onImageScroll,
  onBackPress,
  onSavePress,
  onGalleryPress,
  onMapPress,
  isSaved,
  isSaving,
  miniRoutePath,
}: TrailHeroSectionProps) {
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        {trailImages.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={HERO_WIDTH}
            bounces={false}
            onMomentumScrollEnd={onImageScroll}
            scrollEnabled={trailImages.length > 1}
          >
            {trailImages.map((uri, index) => (
              <View key={`${uri}-${index}`} style={{ width: HERO_WIDTH }}>
                {!loadedImages[index] && <View style={styles.imagePlaceholder} />}

                <Image
                  source={{ uri }}
                  resizeMode="cover"
                  onLoad={() =>
                    setLoadedImages((prev) => ({ ...prev, [index]: true }))
                  }
                  style={styles.image}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Pressable style={styles.mapHero} onPress={onMapPress}>
            <RoutePreviewHero path={miniRoutePath} />
          </Pressable>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.35)',
            'transparent',
            'rgba(0,0,0,0.5)',
          ]}
          style={styles.overlay}
        />

        {/* Top Buttons */}
        <View style={styles.topRow} pointerEvents="box-none">
          <GlassButton onPress={onBackPress} icon="arrow-back" />

          <View style={styles.topRightButtons}>
            <GlassButton onPress={onGalleryPress} icon="images-outline" />
            <GlassButton
              onPress={onSavePress}
              disabled={isSaving}
              active={isSaved}
              icon={isSaved ? 'heart' : 'heart-outline'}
              loading={isSaving}
            />
          </View>
        </View>

        {/* Pagination */}
        {trailImages.length > 1 ? (
          <View style={styles.pagination}>
            {trailImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === activeImageIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RoutePreviewHero({ path }: { path: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 172 120" preserveAspectRatio="xMidYMid slice">
      <Rect width="172" height="120" rx="0" fill="#F7F1E4" />
      <Path d="M 0 0 C 34 16, 42 54, 26 120 L 0 120 Z" fill="#A9D5EB" />
      <Path d="M 48 8 L 58 112" stroke="rgba(60,53,40,0.15)" strokeWidth={4} strokeLinecap="round" />
      <Path d="M 78 6 L 88 114" stroke="rgba(60,53,40,0.12)" strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M 116 10 L 126 108" stroke="rgba(60,53,40,0.12)" strokeWidth={3.5} strokeLinecap="round" />
      <Path d="M 26 30 C 58 18, 104 20, 150 30" stroke="rgba(60,53,40,0.12)" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M 24 60 C 66 48, 96 66, 158 52" stroke="rgba(60,53,40,0.1)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M 22 90 C 70 78, 104 96, 160 84" stroke="rgba(60,53,40,0.12)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d={path} stroke="#34B94A" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Reusable Premium Button
function GlassButton({
  onPress,
  icon,
  active,
  loading,
  disabled,
}: {
  onPress: () => void;
  icon: any;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        active && styles.buttonActive,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={active ? '#fff' : '#111'} />
      ) : (
        <Ionicons
          name={icon}
          size={20}
          color={active ? '#fff' : '#111'}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 1,
  },

  hero: {
    width: '100%',
    height: 360,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E7E1D7',

    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 10,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5DED2',
  },

  mapHero: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F7F1E4',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  topRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  topRightButtons: {
    flexDirection: 'row',
    gap: 10,
  },

  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },

  buttonActive: {
    backgroundColor: '#6B0F1A',
  },

  buttonPressed: {
    transform: [{ scale: 0.94 }],
  },

  pagination: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
});
