import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { getBookmarks, getTrails, type Trail } from '../api/trailsApi';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type SavedNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDetail'>;
type SavedTab = 'favorites' | 'completed';
type CompletedTrailEntry = {
  trail: Trail;
  savedAt: string;
};

const bookmarkTabs: Array<{ id: SavedTab; label: string }> = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'completed', label: 'Completed' },
];

function formatCompletedDate(dateString: string, locale: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function SavedScreen() {
  const navigation = useNavigation<SavedNavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [activeTab, setActiveTab] = useState<SavedTab>('favorites');
  const [savedTrails, setSavedTrails] = useState<Trail[]>([]);
  const [completedTrails, setCompletedTrails] = useState<CompletedTrailEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedTrails([]);
      setCompletedTrails([]);
      return;
    }

    let cancelled = false;

    const loadSavedTrails = async () => {
      if (activeTab !== 'favorites') {
        setSavedTrails([]);
      } else {
        setCompletedTrails([]);
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [allTrails, bookmarks] = await Promise.all([
          getTrails(1, 100),
          getBookmarks({ type: activeTab === 'favorites' ? 'favorites' : 'completed', page: 1, limit: 100 }),
        ]);

        const savedMap = new Map(bookmarks.items.map((item) => [item.trailId, item]));

        if (!cancelled) {
          if (activeTab === 'favorites') {
            setSavedTrails(allTrails.filter((trail) => savedMap.has(trail.id)));
          } else {
            const merged = allTrails
              .filter((trail) => savedMap.has(trail.id))
              .map((trail) => ({ trail, savedAt: savedMap.get(trail.id)!.savedAt }))
              .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

            setCompletedTrails(merged);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setSavedTrails([]);
          setCompletedTrails([]);
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load saved trails.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSavedTrails();

    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthenticated, refreshKey]);

  const countLabel = useMemo(
    () => (activeTab === 'completed' ? completedTrails.length : savedTrails.length),
    [activeTab, completedTrails.length, savedTrails.length],
  );

  const completedTotals = useMemo(() => {
    const totalDistance = completedTrails.reduce((sum, item) => sum + item.trail.distance, 0);
    const totalElevation = completedTrails.reduce((sum, item) => sum + item.trail.elevationGain, 0);
    return {
      totalDistance,
      totalElevation,
      totalTrips: completedTrails.length,
    };
  }, [completedTrails]);

  if (!isAuthenticated) {
    return (
      <AnimatedScreen style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyStateBadge}>
            <Ionicons name="bookmark-outline" size={34} color="white" />
          </View>
          <Text style={[styles.emptyStateTitle, isArabic && rtlText]}>No user logged in</Text>
          <Text style={[styles.emptyStateText, isArabic && rtlText]}>
            Sign up to save your favorite trails and keep them ready for your next adventure.
          </Text>
          <Pressable
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Auth', { mode: 'signup' })}
          >
            <Text style={styles.emptyStateButtonText}>Go to Sign Up</Text>
          </Pressable>
        </View>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.hero, isArabic ? rtlRow : ltrRow]}>
            <View>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{t('savedTitle')}</Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>{t('savedSubtitle')}</Text>
            </View>
            <View style={styles.countPill}>
              <Ionicons name="bookmark" size={14} color="#fff" />
              <Text style={styles.countText}>{countLabel}</Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={80}>
          <View style={styles.tabRow}>
            {bookmarkTabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </AnimatedBlock>

        {activeTab === 'completed' ? (
          <>
            <AnimatedBlock delay={120}>
              <View style={[styles.summaryRow, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{completedTotals.totalDistance.toFixed(1)} km</Text>
                  <Text style={[styles.summaryLabel, isArabic ? rtlText : ltrText]}>Total distance</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{completedTotals.totalTrips}</Text>
                  <Text style={[styles.summaryLabel, isArabic ? rtlText : ltrText]}>Trips</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>+{completedTotals.totalElevation} m</Text>
                  <Text style={[styles.summaryLabel, isArabic ? rtlText : ltrText]}>Elevation</Text>
                </View>
              </View>
            </AnimatedBlock>

            {isLoading ? (
              <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>Loading completed trails...</Text>
            ) : errorMessage ? (
              <View style={styles.stateWrap}>
                <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
                <Pressable style={styles.emptyStateButton} onPress={() => setRefreshKey((value) => value + 1)}>
                  <Text style={styles.emptyStateButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : completedTrails.length === 0 ? (
              <View style={styles.stateWrap}>
                <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'لا توجد مسارات مكتملة بعد.' : 'No completed trails yet.'}
                </Text>
              </View>
            ) : (
              completedTrails.map((entry, index) => (
                <AnimatedBlock key={entry.trail.id} delay={160 + index * 40}>
                  <Pressable
                    style={[styles.historyCard, isArabic ? rtlRow : ltrRow]}
                    onPress={() => navigation.navigate('TrailDetail', { trailId: entry.trail.id })}
                  >
                    <Image source={{ uri: entry.trail.image }} style={styles.historyImage} />
                    <View style={styles.historyContent}>
                      <Text style={[styles.historyDate, isArabic ? rtlText : ltrText]}>
                        {formatCompletedDate(entry.savedAt, isArabic ? 'ar' : 'en-US')}
                      </Text>
                      <Text style={[styles.historyTitle, isArabic ? rtlText : ltrText]}>
                        {isArabic ? entry.trail.nameAr : entry.trail.name}
                      </Text>
                      <Text style={[styles.historyMeta, isArabic ? rtlText : ltrText]}>
                        {entry.trail.distance.toFixed(1)} km | {entry.trail.duration} | +{entry.trail.elevationGain} m
                      </Text>
                    </View>
                    <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#8A7A6A" />
                  </Pressable>
                </AnimatedBlock>
              ))
            )}
          </>
        ) : isLoading ? (
          <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>Loading saved trails...</Text>
        ) : errorMessage ? (
          <View style={styles.stateWrap}>
            <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
            <Pressable style={styles.emptyStateButton} onPress={() => setRefreshKey((value) => value + 1)}>
              <Text style={styles.emptyStateButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : savedTrails.length === 0 ? (
          <View style={styles.stateWrap}>
            <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>
              No trails are saved in `favorites` yet.
            </Text>
          </View>
        ) : (
          savedTrails.map((trail, index) => (
            <AnimatedBlock key={trail.id} delay={90 + index * 40}>
              <Pressable style={styles.card} onPress={() => navigation.navigate('TrailDetail', { trailId: trail.id })}>
                <Image source={{ uri: trail.image }} style={styles.image} />
                <View style={styles.overlay}>
                  <View style={[styles.cardTopRow, isArabic ? rtlRow : ltrRow]}>
                    <View style={styles.badge}>
                      <Ionicons name="heart" size={12} color="#fff" />
                      <Text style={styles.badgeText}>favorites</Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={[styles.name, isArabic ? rtlText : ltrText]}>{isArabic ? trail.nameAr : trail.name}</Text>
                    <Text style={[styles.region, isArabic ? rtlText : ltrText]}>{isArabic ? trail.regionAr : trail.region}</Text>
                    <View style={[styles.metaRow, isArabic && styles.metaRowRtl]}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaText}>{trail.distance.toFixed(1)} km</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaText}>{trail.duration}</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaText}>{trail.difficulty}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            </AnimatedBlock>
          ))
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  content: {
    padding: 16,
  },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2C2418',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#7B6D5A',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#630E13',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    color: '#630E13',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#fff',
  },
  card: {
    height: 232,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    backgroundColor: '#cbbfa4',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: 'rgba(14,7,5,0.34)',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  cardBottom: {
    marginTop: 'auto',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(99,14,19,0.92)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  name: {
    color: '#fff',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  region: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaRowRtl: {
    flexDirection: 'row-reverse',
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  metaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#630E13',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2418',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B5D4E',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  emptyStateButton: {
    width: '100%',
    maxWidth: 280,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#630E13',
    alignItems: 'center',
    alignSelf: 'center',
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  stateWrap: {
    paddingVertical: 28,
    gap: 14,
  },
  stateText: {
    fontSize: 14,
    color: '#4A4131',
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C2418',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#8A7A6A',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  historyImage: {
    width: 82,
    height: 82,
    borderRadius: 14,
  },
  historyContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyDate: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  historyTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    color: '#2C2418',
  },
  historyMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B5D4E',
  },
});
