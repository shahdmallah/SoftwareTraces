// Updated to restyle explore cards around a hero image, floating controls, and inline trail metadata.
import React from 'react';
import { ActivityIndicator, Animated, Image, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { Trail } from '../api/trailsApi';
import { getSafetyBand, type TrailSafety } from '../api/safetyApi';
import type { TranslationKey } from '../contexts/LanguageContext';
import { buildMapImageUri } from '../config/mapConfig';
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
  isDownloaded: boolean;
  isDownloading: boolean;
  mediaImages?: string[];
  safety?: TrailSafety;
  t: (key: TranslationKey) => string;
  onOpen: () => void;
  onOpenMap: () => void;
  onToggleSaved: () => void;
  onDownload: () => void;
};

function buildGalleryImages(mediaImages: string[] = []) {
  return mediaImages.filter(
    (imageUri, index, collection): imageUri is string =>
      Boolean(imageUri) && collection.indexOf(imageUri) === index,
  );
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y}`;
  }

  return points.reduce((path, point, index) =>
    index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`,
    ''
  );
}

function buildRoutePreviewPoints(coordinates?: [number, number][]) {
  if (!coordinates || coordinates.length < 2) {
    return [
      { x: 18, y: 96 },
      { x: 40, y: 78 },
      { x: 54, y: 40 },
      { x: 74, y: 30 },
      { x: 92, y: 22 },
      { x: 110, y: 42 },
      { x: 118, y: 58 },
      { x: 126, y: 76 },
      { x: 142, y: 88 },
      { x: 154, y: 94 },
    ];
  }

  const longitudes = coordinates.map((point) => point[0]);
  const latitudes = coordinates.map((point) => point[1]);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngRange = Math.max(0.0001, maxLng - minLng);
  const latRange = Math.max(0.0001, maxLat - minLat);
  const scale = Math.min(140 / lngRange, 88 / latRange);

  return coordinates.map(([lng, lat]) => ({
    x: 16 + (lng - minLng) * scale,
    y: 16 + (maxLat - lat) * scale,
  }));
}

function RoutePreview({ path, points, mapImageUri }: { path: string; points: Array<{ x: number; y: number }>; mapImageUri: string }) {
  const startPoint = points[0] ?? { x: 28, y: 92 };
  const endPoint = points[points.length - 1] ?? { x: 140, y: 34 };

  return (
    <View style={styles.routePreview}>
      {mapImageUri ? <Image source={{ uri: mapImageUri }} style={styles.routePreviewImage} resizeMode="cover" /> : null}
      <Svg width="100%" height="100%" viewBox="0 0 170 120" style={styles.routePreviewOverlay}>
        <Defs>
          <LinearGradient id="exploreMapTerrain" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F4EFE2" />
            <Stop offset="0.52" stopColor="#ECE3D1" />
            <Stop offset="1" stopColor="#E0D5BF" />
          </LinearGradient>
          <LinearGradient id="exploreMapWater" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B8DCEC" />
            <Stop offset="1" stopColor="#8EC2DD" />
          </LinearGradient>
        </Defs>

        {!mapImageUri ? (
          <>
            <Rect width="170" height="170" fill="url(#exploreMapTerrain)" />
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
              fill="url(#exploreMapWater)"
              opacity={0.95}
            />
            <Path d="M -6 86 C 28 70, 56 68, 92 76 C 120 82, 147 76, 178 58" fill="none" stroke="#FAF8F2" strokeWidth={12} strokeLinecap="round" />
            <Path d="M -6 86 C 28 70, 56 68, 92 76 C 120 82, 147 76, 178 58" fill="none" stroke="#D5C7AE" strokeWidth={4.5} strokeLinecap="round" />
            <Path d="M 124 -8 C 112 14, 106 34, 106 60 C 108 84, 118 103, 140 128" fill="none" stroke="#FAF8F2" strokeWidth={10} strokeLinecap="round" />
            <Path d="M 124 -8 C 112 14, 106 34, 106 60 C 108 84, 118 103, 140 128" fill="none" stroke="#D5C7AE" strokeWidth={4} strokeLinecap="round" />
            <Path d="M 18 16 C 42 26, 74 20, 104 28 C 128 34, 146 52, 160 72" fill="none" stroke="rgba(110,101,79,0.16)" strokeWidth={1.5} strokeLinecap="round" />
            <Path d="M 8 44 C 34 50, 62 48, 94 56 C 120 63, 142 80, 164 100" fill="none" stroke="rgba(110,101,79,0.12)" strokeWidth={1.5} strokeLinecap="round" />
            <Path d="M 6 64 C 30 58, 54 60, 83 72 C 112 84, 132 90, 160 88" fill="none" stroke="rgba(110,101,79,0.10)" strokeWidth={1.2} strokeLinecap="round" />
            <Path d="M 36 10 C 52 28, 48 44, 62 60" fill="none" stroke="rgba(110,101,79,0.18)" strokeWidth={2} strokeDasharray="5 6" strokeLinecap="round" />
            <Rect x={18} y={72} width={16} height={10} rx={3} fill="rgba(255,255,255,0.74)" />
            <Rect x={136} y={66} width={14} height={9} rx={3} fill="rgba(255,255,255,0.72)" />
            <Rect x={118} y={86} width={20} height={10} rx={3} fill="rgba(255,255,255,0.72)" />
          </>
        ) : null}

        <Path d={path} fill="none" stroke="rgba(255,255,255,0.96)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={path} fill="none" stroke="#2FAF62" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={startPoint.x} cy={startPoint.y} r={5} fill="#FFFFFF" stroke="#1C1D18" strokeWidth={1.5} />
        <Circle cx={startPoint.x} cy={startPoint.y} r={2.5} fill="#2FAF62" />
        <Circle cx={endPoint.x} cy={endPoint.y} r={5} fill="#FFFFFF" stroke="#1C1D18" strokeWidth={1.5} />
        <Circle cx={endPoint.x} cy={endPoint.y} r={2.5} fill="#7A1E1E" />
      </Svg>
    </View>
  );
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
  isDownloaded,
  isDownloading,
  mediaImages = [],
  safety,
  t,
  onOpen,
  onOpenMap,
  onToggleSaved,
  onDownload,
}: ExploreTrailCardProps) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const trailImages = React.useMemo(() => buildGalleryImages(mediaImages), [mediaImages]);
  const routePreviewPoints = React.useMemo(() => buildRoutePreviewPoints(item.routeCoordinates), [item.routeCoordinates]);
  const miniRoutePath = React.useMemo(() => buildLinePath(routePreviewPoints), [routePreviewPoints]);
  const mapImageUri = React.useMemo(() => {
    const [lat, lng] = item.coordinates;
    return buildMapImageUri(lng, lat);
  }, [item.coordinates]);
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
  const safetyBand = safety ? getSafetyBand(safety.safety_score) : null;

  React.useEffect(() => {
    setActiveImageIndex(0);
  }, [trailImages]);

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
          {trailImages.length ? (
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
          ) : (
            <Pressable
              style={({ pressed }) => [styles.mapHeroPreview, pressed && styles.mapPreviewCardPressed]}
              onPress={(e) => {
                e.stopPropagation();
                onOpenMap();
              }}
            >
              <RoutePreview path={miniRoutePath} points={routePreviewPoints} mapImageUri={mapImageUri} />
            </Pressable>
          )}

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

          {trailImages.length ? (
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
              <RoutePreview path={miniRoutePath} points={routePreviewPoints} mapImageUri={mapImageUri} />
            </Pressable>
          ) : null}

          {trailImages.length > 1 ? (
            <View style={styles.paginationDots}>
              {trailImages.map((imageUri, index) => (
                <View
                  key={`${imageUri}-${index}`}
                  style={[styles.paginationDot, index === activeImageIndex && styles.paginationDotActive]}
                />
              ))}
            </View>
          ) : null}

          {safety && safetyBand ? (
            <View style={[styles.safetyBadge, isArabic ? styles.safetyBadgeRtl : styles.safetyBadgeLtr, { backgroundColor: safetyBand.color }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#fff" />
              <Text style={styles.safetyBadgeText}>{safety.safety_score}</Text>
            </View>
          ) : null}
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
                style={({ pressed }) => [
                  styles.cardMapAction,
                  isDownloaded && styles.cardMapActionDownloaded,
                  pressed && styles.cardActionIconPressed,
                ]}
                disabled={isDownloading}
                onPress={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#630E13" />
                ) : (
                  <Ionicons
                    name={isDownloaded ? 'cloud-done' : 'cloud-download-sharp'}
                    size={36}
                    color={isDownloaded ? '#1E7A46' : '#630E13'}
                  />
                )}
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
