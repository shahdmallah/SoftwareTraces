import React, { useMemo, useState } from 'react';
import { FlatList, ImageBackground, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { ExploreTrailCard } from '../components/ExploreTrailCard';
import { useLanguage } from '../contexts/LanguageContext';
import { trails, type Trail } from '../data/trails';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { exploreScreenStyles as styles } from './ExploreScreen.styles';

const difficultyFilters = [
  { id: 'all', key: 'all' as const },
  { id: 'Easy', key: 'difficultyEasy' as const },
  { id: 'Moderate', key: 'difficultyModerate' as const },
  { id: 'Hard', key: 'difficultyHard' as const },
];

const lengthFilters = [
  { id: 'all', key: 'lengthAny' as const },
  { id: 'short', key: 'lengthShort' as const },
  { id: 'medium', key: 'lengthMedium' as const },
  { id: 'long', key: 'lengthLong' as const },
];

const featureFilters = [
  { id: 'all', key: 'all' as const },
  { id: 'water', key: 'featureWater' as const },
  { id: 'historical', key: 'featureHistorical' as const },
  { id: 'olive', key: 'featureOlive' as const },
  { id: 'summit', key: 'featureSummit' as const },
];

type ExploreNavigationProp = StackNavigationProp<RootStackParamList>;

export function ExploreScreen() {
  const navigation = useNavigation<ExploreNavigationProp>();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [length, setLength] = useState('all');
  const [feature, setFeature] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const filteredTrails = useMemo(() => {
    return trails.filter((trail) => {
      const searchMatch =
        !search ||
        trail.nameAr.includes(search) ||
        trail.name.toLowerCase().includes(search.toLowerCase()) ||
        trail.regionAr.includes(search);

      const diffMatch = difficulty === 'all' || trail.difficulty === difficulty;
      const lenMatch =
        length === 'all' ||
        (length === 'short' && trail.distance < 7) ||
        (length === 'medium' && trail.distance >= 7 && trail.distance <= 12) ||
        (length === 'long' && trail.distance > 12);

      const featMatch =
        feature === 'all' ||
        trail.tags.includes(feature) ||
        (feature === 'water' && trail.features.some((f) => ['Spring', 'Dead Sea', 'River'].some((w) => f.includes(w)))) ||
        (feature === 'historical' && trail.tags.includes('historical')) ||
        (feature === 'olive' && trail.tags.includes('olive')) ||
        (feature === 'summit' && trail.tags.includes('summit'));

      return searchMatch && diffMatch && lenMatch && featMatch;
    });
  }, [search, difficulty, length, feature]);

  const renderTrail = ({ item, index }: { item: Trail; index: number }) => (
    <AnimatedBlock delay={160 + index * 35} fromY={22}>
      <ExploreTrailCard
        item={item}
        isArabic={isArabic}
        t={t}
        onOpen={() => navigation.navigate('TrailDetail', { trailId: item.id })}
      />
    </AnimatedBlock>
  );

  return (
    <AnimatedScreen style={styles.container}>
      <AnimatedBlock
        delay={40}
        style={[styles.header, { paddingTop: Math.max(theme.spacing.md, insets.top + theme.spacing.sm) }]}
      >
        <ImageBackground
          source={{ uri: trails[2]?.image ?? trails[0]?.image }}
          style={styles.heroBanner}
          imageStyle={styles.heroBannerImage}
        >
          <View style={styles.heroBannerOverlay}>
            <View style={[styles.headerTopRow, isArabic ? rtlRow : ltrRow]}>
              <View style={styles.headerCopy}>
                <Text style={[styles.headerEyebrow, isArabic ? rtlText : ltrText]}>{t('appName')}</Text>
                <Text style={[styles.headerTitle, isArabic ? rtlText : ltrText]}>{t('exploreTitle')}</Text>
                <Text style={[styles.headerSubtitle, isArabic ? rtlText : ltrText]}>{t('exploreSubtitle')}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.filterToggle, pressed && styles.filterTogglePressed]}
                onPress={() => setShowFilters((value) => !value)}
              >
                <Ionicons
                  name={showFilters ? 'options' : 'options-outline'}
                  size={theme.sizes.icon.md}
                  color={theme.colors.textInverse}
                />
                <Text style={styles.filterToggleText}>{showFilters ? t('filtersHide') : t('filtersShow')}</Text>
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={theme.sizes.icon.md} color={theme.colors.textMuted} />
              <TextInput
                style={[styles.searchInput, isArabic ? rtlText : ltrText]}
                placeholder={t('exploreSearchPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>
        </ImageBackground>
      </AnimatedBlock>

      {showFilters ? (
        <AnimatedBlock delay={110} style={styles.filtersCard}>
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>{t('filterDifficulty')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {difficultyFilters.map((filterItem) => (
                <Pressable
                  key={filterItem.id}
                  onPress={() => setDifficulty(filterItem.id)}
                  style={({ pressed }) => [
                    styles.filterButton,
                    difficulty === filterItem.id && styles.filterButtonActive,
                    pressed && styles.filterButtonPressed,
                  ]}
                >
                  <Text style={[styles.filterLabel, difficulty === filterItem.id && styles.filterLabelActive]}>
                    {t(filterItem.key)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>{t('filterLength')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {lengthFilters.map((filterItem) => (
                <Pressable
                  key={filterItem.id}
                  onPress={() => setLength(filterItem.id)}
                  style={({ pressed }) => [
                    styles.filterButton,
                    length === filterItem.id && styles.filterButtonActive,
                    pressed && styles.filterButtonPressed,
                  ]}
                >
                  <Text style={[styles.filterLabel, length === filterItem.id && styles.filterLabelActive]}>
                    {t(filterItem.key)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>{t('filterFeature')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {featureFilters.map((filterItem) => (
                <Pressable
                  key={filterItem.id}
                  onPress={() => setFeature(filterItem.id)}
                  style={({ pressed }) => [
                    styles.filterButton,
                    feature === filterItem.id && styles.filterButtonActive,
                    pressed && styles.filterButtonPressed,
                  ]}
                >
                  <Text style={[styles.filterLabel, feature === filterItem.id && styles.filterLabelActive]}>
                    {t(filterItem.key)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </AnimatedBlock>
      ) : null}

      <AnimatedBlock delay={220} style={styles.listWrapper}>
        <FlatList
          data={filteredTrails}
          keyExtractor={(item) => item.id}
          renderItem={renderTrail}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </AnimatedBlock>
    </AnimatedScreen>
  );
}
