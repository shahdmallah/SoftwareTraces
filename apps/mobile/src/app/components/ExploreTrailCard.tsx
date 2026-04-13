import React from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { TranslationKey } from '../contexts/LanguageContext';
import type { Trail } from '../data/trails';
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

type ExploreTrailCardProps = {
  item: Trail;
  isArabic: boolean;
  t: (key: TranslationKey) => string;
  onOpen: () => void;
};

export function ExploreTrailCard({ item, isArabic, t, onOpen }: ExploreTrailCardProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={onOpen} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.card}>
        <View style={styles.cardImageWrapper}>
          <Image source={{ uri: item.image }} style={styles.cardImage} />
          <View
            style={[
              styles.cardBadge,
              { backgroundColor: difficultyColors[item.difficulty] ?? theme.colors.surfaceAccent },
            ]}
          >
            <Text style={styles.cardBadgeText}>
              {isArabic ? (difficultyAr[item.difficulty] ?? item.difficulty) : item.difficulty}
            </Text>
          </View>
          <View style={styles.cardRating}>
            <Ionicons name="star" size={theme.sizes.icon.sm} color={theme.colors.iconAccent} />
            <Text style={styles.cardRatingText}>{item.rating}</Text>
          </View>
          <View style={styles.cardNameOverlay}>
            <Text style={styles.cardName}>{isArabic ? item.nameAr : item.name}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <View style={[styles.cardLocationRow, isArabic ? rtlRow : ltrRow]}>
            <Ionicons
              name="location-outline"
              size={theme.sizes.icon.sm}
              color={theme.colors.textMuted}
              style={styles.cardLocationIcon}
            />
            <Text style={[styles.cardLocationText, isArabic ? rtlText : ltrText]}>
              {isArabic ? item.regionAr : item.region}
            </Text>
            <Text style={styles.cardLocationDot}>{'\u2022'}</Text>
            <Text style={[styles.cardLocationText, isArabic ? rtlText : ltrText]}>{isArabic ? item.name : item.name}</Text>
          </View>
          <View style={styles.cardStatsRow}>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{item.distance} km</Text>
              <Text style={styles.cardStatLabel}>{t('statDistance')}</Text>
            </View>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{item.duration}</Text>
              <Text style={styles.cardStatLabel}>{t('statDuration')}</Text>
            </View>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{`\u2191${item.elevationGain}m`}</Text>
              <Text style={styles.cardStatLabel}>{t('statElevation')}</Text>
            </View>
          </View>
          <View style={styles.cardChipsRow}>
            {(isArabic ? item.featuresAr : item.features).slice(0, 2).map((featureText) => (
              <View key={featureText} style={styles.cardChip}>
                <Text style={[styles.cardChipText, isArabic ? rtlText : ltrText]}>{featureText}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
