// Updated to restyle explore cards around a hero image, floating controls, and inline trail metadata.
import React from 'react';
import { ActivityIndicator, Animated, Image, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Svg, { Path, Rect } from 'react-native-svg';

import type { Trail } from '../api/trailsApi';
import type { TranslationKey } from '../contexts/LanguageContext';
import { theme } from '../theme';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { exploreTrailCardStyles as styles } from './ExploreTrailCard.styles';

const difficultyColors: Record<string, string> = {
  Easy: theme.colors.difficulty.easy,
  Moderate: theme.colors.difficulty.moderate,
  Hard: theme.colors.difficulty.hard,
  Expert: theme.colors.difficulty.expert,
};

const difficultyAr: Record<string, string> = {
  Easy: '\u0633\u0647\u0644',
  Moderate: '\u0645\u062a\u0648\u0633\u0637',
  Hard: '\u0635\u0639\u0628',
  Expert: '\u062e\u0628\u064a\u0631',
};

const difficultyLabelKeys: Partial<Record<Trail['difficulty'], TranslationKey>> = {
  Easy: 'difficultyEasy',
  Moderate: 'difficultyModerate',
  Hard: 'difficultyHard',
};

type ExploreTrailCardProps = {
  item: Trail;
  isArabic: boolean;
  isSaved: boolean;
  isSaving: boolean;
  t: (key: TranslationKey) => string;
  onOpen: () => void;
  onOpenMap: () => void;
  onToggleSaved: () => void;
};

const galleryFallbackImages = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200',
];

function buildGalleryImages(images: string[], fallbackImage: string) {
  const mergedImages = [fallbackImage, ...images].filter(
    (imageUri, index, collection): imageUri is string =>
      Boolean(imageUri) && collection.indexOf(imageUri) === index,
  );

  const nextImages = mergedImages.length ? [...mergedImages] : [galleryFallbackImages[0]];

  // Pad with mock images so horizontal scrolling can still be tested with sparse trail data.
  for (const mockImage of galleryFallbackImages) {
    if (nextImages.length >= 3) {
      break;
    }

    if (!nextImages.includes(mockImage)) {
      nextImages.push(mockImage);
    }
  }

  while (nextImages.length < 3) {
    nextImages.push(galleryFallbackImages[nextImages.length % galleryFallbackImages.length]);
  }

  return nextImages;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y}`;
  }

  return points.reduce((path, point, index, collection) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = collection[index - 1];
    const controlX = (previous.x + point.x) / 2;

    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function buildMiniRoutePreviewPath(coordinates?: [number, number][]) {
  if (!coordinates || coordinates.length < 2) {
    return 'M 22 76 C 30 62, 24 46, 36 32 C 47 20, 62 24, 66 40 C 70 55, 58 66, 72 78';
  }

  const longitudes = coordinates.map((point) => point[0]);
  const latitudes = coordinates.map((point) => point[1]);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngRange = Math.max(0.0001, maxLng - minLng);
  const latRange = Math.max(0.0001, maxLat - minLat);

  const previewPoints = coordinates.map(([lng, lat]) => ({
    x: 16 + ((lng - minLng) / lngRange) * 64,
    y: 16 + (1 - (lat - minLat) / latRange) * 64,
  }));

  return buildSmoothPath(previewPoints);
}

function buildTrailLabels(item: Trail, isArabic: boolean) {
  const featureLabels = isArabic ? item.featuresAr : item.features;
  const labels = (featureLabels?.length ? featureLabels : item.tags).filter(Boolean).slice(0, 3);

  if (item.hasCheckpoint) {
    labels.unshift(isArabic ? 'نقطة عبور' : 'Access check');
  }

  return labels.slice(0, 4);
}

export function ExploreTrailCard({
  item,
  isArabic,
  isSaved,
  isSaving,
  t,
  onOpen,
  onOpenMap,
  onToggleSaved,
}: ExploreTrailCardProps) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const trailImages = React.useMemo(() => buildGalleryImages(item.images, item.image), [item.image, item.images]);
  const miniRoutePath = React.useMemo(() => buildMiniRoutePreviewPath(item.routeCoordinates), [item.routeCoordinates]);
  const [cardImageWidth, setCardImageWidth] = React.useState(0);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const locale = isArabic ? 'ar-PS' : 'en-US';
  const decimalFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const integerFormatter = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const difficultyLabelKey = difficultyLabelKeys[item.difficulty];
  const difficultyLabel = difficultyLabelKey
    ? t(difficultyLabelKey)
    : isArabic
      ? (difficultyAr[item.difficulty] ?? item.difficulty)
      : item.difficulty;
  const displayName = isArabic ? item.nameAr : item.name;
  const displayRegion = isArabic ? item.regionAr : item.region;
  const ratingLabel = `${decimalFormatter.format(item.rating)} (${integerFormatter.format(item.reviews)})`;
  const distanceLabel = `${decimalFormatter.format(item.distance)} ${t('unitKm')}`;
  const trailLabels = React.useMemo(() => buildTrailLabels(item, isArabic), [isArabic, item]);

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }).start();

  const onImageLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth && nextWidth !== cardImageWidth) {
      setCardImageWidth(nextWidth);
    }
  };

  const handleImageScrollEnd = (offsetX: number) => {
    if (!cardImageWidth) {
      return;
    }

    setActiveImageIndex(Math.round(offsetX / cardImageWidth));
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={styles.card}>
        <View style={styles.cardImageWrapper} onLayout={onImageLayout}>
          <GestureScrollView
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            pagingEnabled
            bounces={false}
            decelerationRate="fast"
            scrollEnabled={trailImages.length > 1}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              handleImageScrollEnd(event.nativeEvent.contentOffset.x);
            }}
          >
            {trailImages.map((imageUri, index) => (
              <Image
                key={`${item.id}-image-${index}-${imageUri}`}
                source={{ uri: imageUri }}
                style={[styles.cardImage, cardImageWidth ? { width: cardImageWidth } : null]}
              />
            ))}
          </GestureScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.favoriteButton,
              isSaved && styles.favoriteButtonActive,
              isArabic ? styles.favoriteButtonRtl : styles.favoriteButtonLtr,
              pressed && styles.favoriteButtonPressed,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onToggleSaved();
            }}
          >
            {isSaving ? (
              <ActivityIndicator color={isSaved ? '#FFFFFF' : '#1F211A'} />
            ) : (
              <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={26} color={isSaved ? '#FFFFFF' : '#1F211A'} />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.mapPreviewCard,
              isArabic ? styles.mapPreviewCardRtl : styles.mapPreviewCardLtr,
              pressed && styles.mapPreviewCardPressed,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onOpenMap();
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 96 96">
              <Rect width="96" height="96" rx="24" fill="#F7F1E4" />
              <Path d="M 0 0 C 18 10, 26 44, 18 96 L 0 96 Z" fill="#A9D5EB" />
              <Path d="M 34 6 L 42 94" stroke="rgba(60,53,40,0.15)" strokeWidth={3} strokeLinecap="round" />
              <Path d="M 50 4 L 60 92" stroke="rgba(60,53,40,0.12)" strokeWidth={2.5} strokeLinecap="round" />
              <Path
                d="M 18 24 C 34 14, 60 16, 84 22"
                stroke="rgba(60,53,40,0.12)"
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 16 48 C 38 40, 56 54, 88 44"
                stroke="rgba(60,53,40,0.1)"
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 14 72 C 40 66, 58 78, 88 70"
                stroke="rgba(60,53,40,0.12)"
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={miniRoutePath}
                stroke="#34B94A"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>

          <View style={styles.paginationDots}>
            {trailImages.map((imageUri, index) => (
              <View
                key={`${imageUri}-${index}`}
                style={[styles.paginationDot, index === activeImageIndex && styles.paginationDotActive]}
              />
            ))}
          </View>
        </View>

        <Pressable onPress={onOpen} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.cardInfo}>
          <View style={[styles.cardHeaderRow, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardName, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                {displayName}
              </Text>
              <Text style={[styles.cardLocationText, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                {displayRegion}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.cardMapAction, pressed && styles.cardActionIconPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onOpenMap();
              }}
            >
              <Ionicons name="cloud-download-sharp" size={36} color="#630E13" />
            </Pressable>
          </View>

          {trailLabels.length ? (
            <View style={[styles.labelRow, isArabic ? rtlRow : ltrRow]}>
              {trailLabels.map((label) => (
                <View key={label} style={[styles.trailLabel, label === (isArabic ? 'نقطة عبور' : 'Access check') && styles.accessLabel]}>
                  <Text style={[styles.trailLabelText, label === (isArabic ? 'نقطة عبور' : 'Access check') && styles.accessLabelText]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.cardMetaRow, isArabic ? rtlRow : ltrRow]}>
            <View style={[styles.metaItem, isArabic ? rtlRow : ltrRow]}>
              <Ionicons name="star" size={17} color="#7D8378" />
              <Text style={[styles.metaText, isArabic ? rtlText : ltrText]}>{ratingLabel}</Text>
            </View>
            <Text style={styles.metaDivider}>|</Text>
            <View style={[styles.metaItem, isArabic ? rtlRow : ltrRow]}>
              <View
                style={[
                  styles.difficultyMarker,
                  { backgroundColor: difficultyColors[item.difficulty] ?? theme.colors.surfaceAccent },
                ]}
              />
              <Text style={[styles.metaText, isArabic ? rtlText : ltrText]}>{difficultyLabel}</Text>
            </View>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={[styles.metaText, isArabic ? rtlText : ltrText]}>{distanceLabel}</Text>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={[styles.metaText, isArabic ? rtlText : ltrText]}>{item.duration}</Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}
