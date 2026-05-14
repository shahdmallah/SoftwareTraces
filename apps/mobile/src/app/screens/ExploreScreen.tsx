// Updated to restyle Explore around a pill-based header, quick filters, and client-side sorting while keeping live API data.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getBookmarks,
  getTrails,
  removeBookmark,
  saveBookmark,
  searchTrails,
  type Trail,
  type TrailDifficulty,
} from '../api/trailsApi';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { ExploreTrailCard } from '../components/ExploreTrailCard';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTrailPhotos } from '../api/mediaApi';
import { downloadOfflineMap } from '../api/offlineApi';
import { RootStackParamList } from '../navigation/types';
import { getOfflineMapPacks, saveOfflineMapPack } from '../state/offlineMaps';
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
  { id: 'short', key: 'lengthShort' as const, minLength: undefined, maxLength: 7 },
  { id: 'medium', key: 'lengthMedium' as const, minLength: 7, maxLength: 12 },
  { id: 'long', key: 'lengthLong' as const, minLength: 12, maxLength: undefined },
];

const reviewsFilters = [
  { id: 'all', key: 'reviewsAny' as const, minReviews: undefined },
  { id: 'proven', key: 'reviewsProven' as const, minReviews: 10 },
  { id: 'popular', key: 'reviewsPopular' as const, minReviews: 50 },
  { id: 'legendary', key: 'reviewsLegendary' as const, minReviews: 200 },
];

const featureFilters = [
  { id: 'all', key: 'all' as const, icon: 'apps-outline' as const },
  { id: 'water', key: 'featureWater' as const, icon: 'water-outline' as const },
  { id: 'historical', key: 'featureHistorical' as const, icon: 'library-outline' as const },
  { id: 'olive', key: 'featureOlive' as const, icon: 'leaf-outline' as const },
  { id: 'summit', key: 'featureSummit' as const, icon: 'flag-outline' as const },
];

const sortOptions = [
  { id: 'bestMatch', label: { ar: 'أفضل تطابق', en: 'Best match' } },
  { id: 'topRated', label: { ar: 'الأعلى تقييماً', en: 'Top rated' } },
  { id: 'shortest', label: { ar: 'الأقصر', en: 'Shortest' } },
  { id: 'longest', label: { ar: 'الأطول', en: 'Longest' } },
  { id: 'mostReviewed', label: { ar: 'الأكثر مراجعة', en: 'Most reviewed' } },
] as const;

type ExploreNavigationProp = StackNavigationProp<RootStackParamList>;
type SortOptionId = (typeof sortOptions)[number]['id'];

function matchesFeatureFilter(trail: Trail, feature: string) {
  if (feature === 'all') return true;
  if (trail.tags.includes(feature)) return true;
  if (feature === 'water') {
    return trail.features.some((item) => /spring|river|sea|water/i.test(item));
  }
  return false;
}

function matchesReviewsFilter(trail: Trail, reviewsFilterId: string) {
  const filter = reviewsFilters.find((f) => f.id === reviewsFilterId);
  if (!filter || filter.minReviews === undefined) return true;
  return trail.reviews >= filter.minReviews;
}

function sortTrails(trails: Trail[], sortBy: SortOptionId) {
  const sortedTrails = [...trails];

  switch (sortBy) {
    case 'topRated':
      return sortedTrails.sort((left, right) => {
        if (right.rating === left.rating) return right.reviews - left.reviews;
        return right.rating - left.rating;
      });
    case 'shortest':
      return sortedTrails.sort((left, right) => left.distance - right.distance);
    case 'longest':
      return sortedTrails.sort((left, right) => right.distance - left.distance);
    case 'mostReviewed':
      return sortedTrails.sort((left, right) => {
        if (right.reviews === left.reviews) return right.rating - left.rating;
        return right.reviews - left.reviews;
      });
    case 'bestMatch':
    default:
      return sortedTrails;
  }
}

export function ExploreScreen() {
  const navigation = useNavigation<ExploreNavigationProp>();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<'all' | TrailDifficulty>('all');
  const [length, setLength] = useState('all');
  const [reviews, setReviews] = useState('all');
  const [feature, setFeature] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<SortOptionId>('bestMatch');
  const [fetchedTrails, setFetchedTrails] = useState<Trail[]>([]);
  const [trailMediaImages, setTrailMediaImages] = useState<Record<string, string[]>>({});
  const [savedTrailIds, setSavedTrailIds] = useState<Set<string>>(new Set());
  const [savingTrailIds, setSavingTrailIds] = useState<string[]>([]);
  const [downloadedTrailIds, setDownloadedTrailIds] = useState<Set<string>>(new Set());
  const [downloadingTrailIds, setDownloadingTrailIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-PS' : 'en-US';

  useEffect(() => {
    let cancelled = false;
    const selectedLengthFilter = lengthFilters.find((item) => item.id === length);

    const loadTrails = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const hasServerFilters = Boolean(search.trim()) || difficulty !== 'all' || length !== 'all';
        const nextTrails = hasServerFilters
          ? await searchTrails({
              q: search.trim() || undefined,
              difficulty,
              minLength: selectedLengthFilter?.minLength,
              maxLength: selectedLengthFilter?.maxLength,
            })
          : await getTrails(1, 50);

        if (!cancelled) setFetchedTrails(nextTrails);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load trails right now.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => { void loadTrails(); }, 250);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [difficulty, length, refreshKey, search]);

  useEffect(() => {
    let cancelled = false;

    const loadTrailMediaImages = async () => {
      if (!fetchedTrails.length) {
        setTrailMediaImages({});
        return;
      }

      const mediaEntries = await Promise.all(
        fetchedTrails.map(async (trail) => {
          try {
            const photos = await getTrailPhotos(trail.id);
            const urls = photos
              .map((photo) => photo.url)
              .filter((url, index, collection): url is string => Boolean(url) && collection.indexOf(url) === index);

            return [trail.id, urls] as const;
          } catch {
            return [trail.id, []] as const;
          }
        }),
      );

      if (!cancelled) {
        setTrailMediaImages(Object.fromEntries(mediaEntries));
      }
    };

    void loadTrailMediaImages();

    return () => {
      cancelled = true;
    };
  }, [fetchedTrails]);

  useEffect(() => {
    let cancelled = false;

    const loadSavedTrails = async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setSavedTrailIds(new Set());
        }
        return;
      }

      try {
        const bookmarks = await getBookmarks({ type: 'favorites', page: 1, limit: 200 });

        if (!cancelled) {
          setSavedTrailIds(new Set(bookmarks.items.map((item) => item.trailId)));
        }
      } catch {
        if (!cancelled) {
          setSavedTrailIds(new Set());
        }
      }
    };

    void loadSavedTrails();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    const loadOfflineMaps = async () => {
      const packs = await getOfflineMapPacks();

      if (!cancelled) {
        setDownloadedTrailIds(new Set(packs.map((pack) => pack.trailId)));
      }
    };

    void loadOfflineMaps();

    return () => {
      cancelled = true;
    };
  }, []);

  const trails = useMemo(
    () =>
      sortTrails(
        fetchedTrails
          .filter((trail) => matchesFeatureFilter(trail, feature))
          .filter((trail) => matchesReviewsFilter(trail, reviews)),
        sortBy,
      ),
    [fetchedTrails, feature, reviews, sortBy],
  );

  const activeSortOption = sortOptions.find((option) => option.id === sortBy) ?? sortOptions[0];
  const activeSortLabel = activeSortOption.label[language];
  const hasActiveAdvancedFilters = difficulty !== 'all' || length !== 'all' || reviews !== 'all';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const trailCountLabel = isArabic
    ? `${numberFormatter.format(trails.length)} مسار`
    : `${numberFormatter.format(trails.length)} ${trails.length === 1 ? 'trail' : 'trails'}`;
  const resultsCaption = isLoading
    ? isArabic ? 'يتم تحديث النتائج الآن' : 'Refreshing results'
    : isArabic ? 'نتائج مباشرة من بيانات المسارات' : 'Live results from trail data';

  const handleOpenMap = (trailId: string) => {
    navigation.navigate('AppTabs', {
      screen: 'Map',
      params: { selectedTrailId: trailId },
    });
  };

  const handleToggleSaved = async (trailId: string) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    const currentlySaved = savedTrailIds.has(trailId);

    setSavingTrailIds((current) => (current.includes(trailId) ? current : [...current, trailId]));
    setSavedTrailIds((current) => {
      const next = new Set(current);

      if (currentlySaved) {
        next.delete(trailId);
      } else {
        next.add(trailId);
      }

      return next;
    });

    try {
      if (currentlySaved) {
        await removeBookmark({ trailId, type: 'favorites' });
      } else {
        await saveBookmark({ trailId, type: 'favorites' });
      }
    } catch {
      setSavedTrailIds((current) => {
        const next = new Set(current);

        if (currentlySaved) {
          next.add(trailId);
        } else {
          next.delete(trailId);
        }

        return next;
      });
    } finally {
      setSavingTrailIds((current) => current.filter((item) => item !== trailId));
    }
  };

  const handleDownloadTrail = async (trail: Trail) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    if (downloadingTrailIds.includes(trail.id)) {
      return;
    }

    setDownloadingTrailIds((current) => (current.includes(trail.id) ? current : [...current, trail.id]));

    try {
      const map = await downloadOfflineMap(trail.id);
      await saveOfflineMapPack({
        trailId: map.trailId,
        trailName: trail.name,
        trailNameAr: trail.nameAr,
        region: trail.region,
        regionAr: trail.regionAr,
        coordinates: trail.coordinates,
        tileRegion: map.tileRegion,
        tileUrlTemplate: map.tileUrlTemplate,
        downloadedAt: new Date().toISOString(),
      });
      setDownloadedTrailIds((current) => new Set(current).add(trail.id));
      Alert.alert(
        isArabic ? '\u0627\u0644\u062e\u0631\u064a\u0637\u0629 \u062c\u0627\u0647\u0632\u0629' : 'Map ready offline',
        isArabic
          ? `\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u062e\u0631\u064a\u0637\u0629 ${trail.nameAr || trail.name} \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0628\u062f\u0648\u0646 \u0627\u062a\u0635\u0627\u0644.`
          : `${trail.name} is ready for offline use.`,
      );
    } catch (error) {
      Alert.alert(
        isArabic ? '\u062a\u0639\u0630\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644' : 'Unable to download',
        error instanceof Error ? error.message : isArabic ? '\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.' : 'Please try again.',
      );
    } finally {
      setDownloadingTrailIds((current) => current.filter((item) => item !== trail.id));
    }
  };

  const renderTrail = ({ item, index }: { item: Trail; index: number }) => (
    <AnimatedBlock delay={160 + index * 35} fromY={22} style={styles.cardBlock}>
      <ExploreTrailCard
        item={item}
        isArabic={isArabic}
        isSaved={savedTrailIds.has(item.id)}
        isSaving={savingTrailIds.includes(item.id)}
        isDownloaded={downloadedTrailIds.has(item.id)}
        isDownloading={downloadingTrailIds.includes(item.id)}
        mediaImages={trailMediaImages[item.id]}
        t={t}
        onOpen={() => navigation.navigate('TrailDetail', { trailId: item.id })}
        onOpenMap={() => handleOpenMap(item.id)}
        onToggleSaved={() => void handleToggleSaved(item.id)}
        onDownload={() => void handleDownloadTrail(item)}
      />
    </AnimatedBlock>
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateCard}>
          <Text style={[styles.emptyStateTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'تحميل المسارات...' : 'Loading trails...'}
          </Text>
          <Text style={[styles.emptyStateText, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'نجلب أحدث النتائج من الواجهة البرمجية.' : 'Fetching the latest results from the API.'}
          </Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.emptyStateCard}>
          <Text style={[styles.emptyStateTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'تعذر تحميل المسارات' : 'Unable to load trails'}
          </Text>
          <Text style={[styles.emptyStateText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
          <Pressable style={styles.emptyStateButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Text style={styles.emptyStateButtonText}>{isArabic ? 'إعادة المحاولة' : 'Retry'}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateCard}>
        <Text style={[styles.emptyStateTitle, isArabic ? rtlText : ltrText]}>
          {isArabic ? 'لا توجد مسارات مطابقة' : 'No matching trails'}
        </Text>
        <Text style={[styles.emptyStateText, isArabic ? rtlText : ltrText]}>
          {isArabic
            ? 'جرّب تعديل البحث أو الفلاتر لعرض المزيد من النتائج.'
            : 'Try adjusting your search or filters to see more results.'}
        </Text>
      </View>
    );
  };

  return (
    <AnimatedScreen style={styles.container}>
      <FlatList
        data={trails}
        keyExtractor={(item) => item.id}
        renderItem={renderTrail}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={
          <View style={[styles.headerContent, { paddingTop: Math.max(theme.spacing.md, insets.top + theme.spacing.sm) }]}>
            {/* ── Search row ── */}
            <AnimatedBlock delay={40}>
              <View style={[styles.searchRow, isArabic ? rtlRow : ltrRow]}>
                <View style={[styles.searchBox, isArabic ? rtlRow : ltrRow]}>
                  <Ionicons name="search" size={theme.sizes.icon.md + 2} color={theme.colors.textPrimary} />
                  <TextInput
                    style={[
                      styles.searchInput,
                      isArabic ? styles.searchInputRtl : styles.searchInputLtr,
                      isArabic ? rtlText : ltrText,
                    ]}
                    placeholder={t('exploreSearchPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={() => navigation.navigate('SearchResults', { query: search.trim() || undefined })}
                    returnKeyType="search"
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.headerActionButton,
                    showFilters && styles.headerActionButtonActive,
                    pressed && styles.headerActionPressed,
                  ]}
                  onPress={() => setShowFilters((value) => !value)}
                  onLongPress={() => navigation.navigate('AdvancedFilters')}
                >
                  <Ionicons
                    name={showFilters ? 'options' : 'options-outline'}
                    size={theme.sizes.icon.md + 2}
                    color={theme.colors.textPrimary}
                  />
                  {hasActiveAdvancedFilters ? (
                    <View
                      style={[
                        styles.headerActionIndicator,
                        isArabic ? styles.headerActionIndicatorRtl : styles.headerActionIndicatorLtr,
                      ]}
                    />
                  ) : null}
                </Pressable>
              </View>
            </AnimatedBlock>

            {/* ── Feature quick-filters ── */}
            <AnimatedBlock delay={90} style={styles.quickFiltersBlock}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.quickFiltersContent, isArabic && styles.filtersContentRtl]}
                keyboardShouldPersistTaps="handled"
              >
                {featureFilters.map((filterItem) => {
                  const active = feature === filterItem.id;
                  return (
                    <Pressable
                      key={filterItem.id}
                      onPress={() => setFeature(filterItem.id)}
                      style={({ pressed }) => [
                        styles.quickFilterChip,
                        active && styles.quickFilterChipActive,
                        pressed && styles.quickFilterChipPressed,
                      ]}
                    >
                      <View style={[styles.quickFilterInner, isArabic ? rtlRow : ltrRow]}>
                        <Ionicons
                          name={filterItem.icon}
                          size={20}
                          color={active ? theme.colors.surfaceAccent : theme.colors.textPrimary}
                        />
                        <Text style={[styles.quickFilterLabel, active && styles.quickFilterLabelActive]}>
                          {t(filterItem.key)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </AnimatedBlock>

            {/* ── Advanced filters panel ── */}
            {showFilters ? (
              <AnimatedBlock delay={130} style={styles.filtersCard}>
                {/* Difficulty */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, isArabic ? rtlText : ltrText]}>{t('filterDifficulty')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.compactFiltersContent, isArabic && styles.filtersContentRtl]}
                    keyboardShouldPersistTaps="handled"
                  >
                    {difficultyFilters.map((filterItem) => {
                      const active = difficulty === filterItem.id;
                      return (
                        <Pressable
                          key={filterItem.id}
                          onPress={() => setDifficulty(filterItem.id as 'all' | TrailDifficulty)}
                          style={({ pressed }) => [
                            styles.compactFilterChip,
                            active && styles.compactFilterChipActive,
                            pressed && styles.quickFilterChipPressed,
                          ]}
                        >
                          <Text style={[styles.compactFilterLabel, active && styles.compactFilterLabelActive]}>
                            {t(filterItem.key)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Length */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, isArabic ? rtlText : ltrText]}>{t('filterLength')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.compactFiltersContent, isArabic && styles.filtersContentRtl]}
                    keyboardShouldPersistTaps="handled"
                  >
                    {lengthFilters.map((filterItem) => {
                      const active = length === filterItem.id;
                      return (
                        <Pressable
                          key={filterItem.id}
                          onPress={() => setLength(filterItem.id)}
                          style={({ pressed }) => [
                            styles.compactFilterChip,
                            active && styles.compactFilterChipActive,
                            pressed && styles.quickFilterChipPressed,
                          ]}
                        >
                          <Text style={[styles.compactFilterLabel, active && styles.compactFilterLabelActive]}>
                            {t(filterItem.key)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Reviews */}
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, isArabic ? rtlText : ltrText]}>
                    {isArabic ? 'عدد المراجعات' : 'Reviews'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.compactFiltersContent, isArabic && styles.filtersContentRtl]}
                    keyboardShouldPersistTaps="handled"
                  >
                    {reviewsFilters.map((filterItem) => {
                      const active = reviews === filterItem.id;
                      return (
                        <Pressable
                          key={filterItem.id}
                          onPress={() => setReviews(filterItem.id)}
                          style={({ pressed }) => [
                            styles.compactFilterChip,
                            active && styles.compactFilterChipActive,
                            pressed && styles.quickFilterChipPressed,
                          ]}
                        >
                          <Text style={[styles.compactFilterLabel, active && styles.compactFilterLabelActive]}>
                            {t(filterItem.key)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </AnimatedBlock>
            ) : null}

            {/* ── Results row + sort ── */}
            <AnimatedBlock delay={170} style={[styles.resultsRow, isArabic ? rtlRow : ltrRow]}>
              <View style={styles.resultsTextBlock}>
                <Text style={[styles.resultsCount, isArabic ? rtlText : ltrText]}>{trailCountLabel}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.sortButton,
                  showSortMenu && styles.sortButtonActive,
                  pressed && styles.headerActionPressed,
                ]}
                onPress={() => setShowSortMenu((value) => !value)}
              >
                <View style={[styles.sortButtonInner, isArabic ? rtlRow : ltrRow]}>
                  <Text style={styles.sortButtonText}>{activeSortLabel}</Text>
                  <Ionicons
                    name={showSortMenu ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                </View>
              </Pressable>
            </AnimatedBlock>

            {/* ── Sort menu ── */}
            {showSortMenu ? (
              <AnimatedBlock delay={210} style={styles.sortMenu}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.compactFiltersContent, isArabic && styles.filtersContentRtl]}
                  keyboardShouldPersistTaps="handled"
                >
                  {sortOptions.map((option) => {
                    const active = option.id === sortBy;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => { setSortBy(option.id); setShowSortMenu(false); }}
                        style={({ pressed }) => [
                          styles.compactFilterChip,
                          active && styles.compactFilterChipActive,
                          pressed && styles.quickFilterChipPressed,
                        ]}
                      >
                        <Text style={[styles.compactFilterLabel, active && styles.compactFilterLabelActive]}>
                          {option.label[language]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </AnimatedBlock>
            ) : null}

            {/* ── Error banner (when we already have results) ── */}
            {errorMessage && trails.length > 0 ? (
              <AnimatedBlock delay={240}>
                <View style={[styles.statusBanner, isArabic ? rtlRow : ltrRow]}>
                  <Text style={[styles.statusBannerText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
                  <Pressable style={styles.statusBannerButton} onPress={() => setRefreshKey((value) => value + 1)}>
                    <Text style={styles.statusBannerButtonText}>{isArabic ? 'إعادة المحاولة' : 'Retry'}</Text>
                  </Pressable>
                </View>
              </AnimatedBlock>
            ) : null}
          </View>
        }
        ListEmptyComponent={renderEmptyState}
      />
    </AnimatedScreen>
  );
}
