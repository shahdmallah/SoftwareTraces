import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, Pressable, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { trails } from '../data/trails';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { Ionicons } from '@expo/vector-icons';
import { toggleTrailSaved, useTrailSaved } from '../state/savedTrails';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type TrailDetailScreenRouteProp = RouteProp<RootStackParamList, 'TrailDetail'>;
type TrailDetailNavigationProp = StackNavigationProp<RootStackParamList>;

type ForecastDay = {
  date: string;
  dayAr: string;
  summaryAr: string;
};

const PMD_FORECAST_URL = 'https://www.pmd.ps/';

const arabicDayToEnglishKey: Record<string, string> = {
  السبت: 'weekdaySaturday',
  الأحد: 'weekdaySunday',
  الاثنين: 'weekdayMonday',
  الإثنين: 'weekdayMonday',
  الثلاثاء: 'weekdayTuesday',
  الأربعاء: 'weekdayWednesday',
  الخميس: 'weekdayThursday',
  الجمعة: 'weekdayFriday',
};

const postsByTrail: Record<
  string,
  Array<{ id: string; user: string; timeKey: string; textEn: string; textAr: string }>
> = {
  '1': [
    {
      id: 'p1',
      user: 'Leila',
      timeKey: 'postTimeRecent',
      textEn: 'The canyon light right after sunrise was unreal. Bring extra water and start early.',
      textAr: 'كان ضوء الوادي بعد الشروق مذهلاً. أحضر ماء إضافياً وابدأ مبكراً.',
    },
    {
      id: 'p2',
      user: 'Yousef',
      timeKey: 'postTimeYesterday',
      textEn: 'The monastery view is worth every climb. Good shoes make a big difference here.',
      textAr: 'مشهد الدير يستحق كل صعود. الحذاء الجيد يصنع فرقاً كبيراً هنا.',
    },
  ],
  '3': [
    {
      id: 'p3',
      user: 'Mariam',
      timeKey: 'postTimeRecent',
      textEn: 'Battir is so peaceful in the late afternoon. The terraces look incredible in golden light.',
      textAr: 'بتير هادئة جداً في آخر النهار. تبدو المدرجات رائعة في الضوء الذهبي.',
    },
    {
      id: 'p4',
      user: 'Omar',
      timeKey: 'postTimeYesterday',
      textEn: 'Easy to enjoy at a slow pace. I would definitely bring a camera for this one.',
      textAr: 'من السهل الاستمتاع به على مهل. أنصح بإحضار كاميرا لهذا المسار.',
    },
  ],
};

function getDifficultyTone(difficulty: string) {
  if (difficulty === 'Easy') return '#7A9A3A';
  if (difficulty === 'Moderate') return '#D4A843';
  if (difficulty === 'Hard') return '#BB2823';
  return '#630E13';
}

function getWeatherVisual(summary: string) {
  if (/مطر|أمطار|زخات/.test(summary)) {
    return { icon: 'rainy-outline', accent: '#4E88C7', tint: 'rgba(78,136,199,0.14)' };
  }
  if (/غائم|غيوم|غبار/.test(summary)) {
    return { icon: 'cloud-outline', accent: '#7B8794', tint: 'rgba(123,135,148,0.14)' };
  }
  if (/حار|دافئ|جاف/.test(summary)) {
    return { icon: 'sunny-outline', accent: '#D9892B', tint: 'rgba(217,137,43,0.14)' };
  }
  return { icon: 'partly-sunny-outline', accent: '#D4A843', tint: 'rgba(212,168,67,0.14)' };
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWeeklyForecast(pageHtml: string): ForecastDay[] {
  const text = stripHtml(pageHtml);
  const sectionStart = text.indexOf('النشرة الجوية');
  if (sectionStart < 0) return [];

  const section = text.slice(sectionStart);
  const dayPattern = new RegExp(
    '(الجمعة|السبت|الأحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الخميس)\\s+(\\d{4}-\\d{2}-\\d{2})\\s+([\\s\\S]*?)(?=(الجمعة|السبت|الأحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الخميس)\\s+\\d{4}-\\d{2}-\\d{2}|$)',
    'g',
  );

  return Array.from(section.matchAll(dayPattern))
    .slice(0, 7)
    .map((match) => ({
      dayAr: match[1],
      date: match[2],
      summaryAr: match[3].trim(),
    }))
    .filter((item) => item.summaryAr.length > 0);
}

export function TrailDetailScreen() {
  const route = useRoute<TrailDetailScreenRouteProp>();
  const navigation = useNavigation<TrailDetailNavigationProp>();
  const { trailId } = route.params;
  const trail = trails.find((t) => t.id === trailId);
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const isSaved = useTrailSaved(trailId);
  const [weeklyForecast, setWeeklyForecast] = useState<ForecastDay[]>([]);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [selectedForecastDate, setSelectedForecastDate] = useState<string | null>(null);
  const forecastScrollRef = useRef<GestureScrollView | null>(null);
  const [forecastScrollX, setForecastScrollX] = useState(0);

  const fallbackForecast = useMemo<ForecastDay[]>(
    () => [
      {
        dayAr: 'السبت',
        date: '2026-04-11',
        summaryAr: 'يكون الجو غائما جزئيا مع أجواء لطيفة فوق المناطق الجبلية ومعتدلة في بقية المناطق.',
      },
      {
        dayAr: 'الأحد',
        date: '2026-04-12',
        summaryAr: 'لا يطرأ تغير كبير على درجات الحرارة مع استمرار الأجواء الربيعية وفرصة ضعيفة لأمطار محلية خفيفة.',
      },
      {
        dayAr: 'الإثنين',
        date: '2026-04-13',
        summaryAr: 'يميل الجو إلى الاستقرار مع ارتفاع طفيف على درجات الحرارة ورياح خفيفة إلى معتدلة.',
      },
      {
        dayAr: 'الثلاثاء',
        date: '2026-04-14',
        summaryAr: 'يصبح الجو أدفأ مع أجواء جافة نسبيا خاصة في الأغوار والمناطق المنخفضة.',
      },
      {
        dayAr: 'الأربعاء',
        date: '2026-04-15',
        summaryAr: 'أجواء دافئة إلى حارة نسبيا خلال النهار مع رياح خفيفة ووضوح جيد.',
      },
      {
        dayAr: 'الخميس',
        date: '2026-04-16',
        summaryAr: 'تستمر الأجواء الدافئة مع طقس جاف في معظم المناطق واحتمال غبار خفيف.',
      },
      {
        dayAr: 'الجمعة',
        date: '2026-04-17',
        summaryAr: 'يبقى الطقس مستقرا عموما مع درجات حرارة أعلى من المعدل الموسمي بقليل.',
      },
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadForecast = async () => {
      setIsWeatherLoading(true);
      setWeatherError(null);

      try {
        const response = await fetch(PMD_FORECAST_URL);
        if (!response.ok) {
          throw new Error(`PMD request failed (${response.status})`);
        }

        const html = await response.text();
        const parsed = parseWeeklyForecast(html);
        if (!parsed.length) {
          throw new Error('Unable to parse PMD weekly forecast.');
        }

        if (!cancelled) {
          setWeeklyForecast(parsed);
        }
      } catch (error) {
        if (!cancelled) {
          setWeeklyForecast(fallbackForecast);
          setWeatherError(error instanceof Error ? error.message : 'Unable to load weather.');
        }
      } finally {
        if (!cancelled) {
          setIsWeatherLoading(false);
        }
      }
    };

    void loadForecast();

    return () => {
      cancelled = true;
    };
  }, [fallbackForecast]);

  useEffect(() => {
    if (!weeklyForecast.length) {
      setSelectedForecastDate(null);
      return;
    }

    setSelectedForecastDate((current) => {
      if (current && weeklyForecast.some((day) => day.date === current)) {
        return current;
      }
      return weeklyForecast[0]?.date ?? null;
    });
  }, [weeklyForecast]);

  if (!trail) {
    return (
      <AnimatedScreen style={styles.container}>
        <Text style={styles.notFound}>{t('trailNotFound')}</Text>
      </AnimatedScreen>
    );
  }

  const posts = postsByTrail[trail.id] ?? postsByTrail['3'];
  const selectedForecast = weeklyForecast.find((day) => day.date === selectedForecastDate) ?? weeklyForecast[0] ?? null;

  const openMapPreview = () => {
    navigation.navigate('AppTabs', {
      screen: 'Map',
      params: { selectedTrailId: trail.id },
    });
  };

  const toggleSaved = () => {
    toggleTrailSaved(trail.id);
  };
  const nudgeForecast = (direction: 'left' | 'right') => {
    const nextX = Math.max(0, forecastScrollX + (direction === 'right' ? 180 : -180));
    forecastScrollRef.current?.scrollTo({ x: nextX, animated: true });
  };

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: Math.max(28, insets.bottom + 16) }}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <ImageBackground source={{ uri: trail.image }} style={styles.heroImage}>
            <View style={styles.heroOverlay}>
              <Pressable
                style={[styles.backButton, { top: Math.max(14, insets.top + 6) }]}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={18} color="#fff" />
                <Text style={styles.backButtonText}>{t('back')}</Text>
              </Pressable>

              <View style={styles.heroContent}>
                <View style={[styles.heroBadge, { backgroundColor: `${getDifficultyTone(trail.difficulty)}CC` }]}>
                  <Text style={styles.heroBadgeText}>{trail.difficulty}</Text>
                </View>
                <Text style={[styles.heroTitle, isArabic ? rtlText : ltrText]}>{isArabic ? trail.nameAr : trail.name}</Text>
                <Text style={[styles.heroRegion, isArabic ? rtlText : ltrText]}>{isArabic ? trail.regionAr : trail.region}</Text>
              </View>
            </View>
          </ImageBackground>
        </AnimatedBlock>

        <View style={styles.content}>
          <AnimatedBlock delay={110}>
            <Text style={[styles.description, isArabic ? rtlText : ltrText]}>{isArabic ? trail.descriptionAr : trail.description}</Text>
          </AnimatedBlock>

          <AnimatedBlock delay={150}>
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{trail.distance} km</Text>
                <Text style={styles.quickStatLabel}>{t('trailDetailDistance')}</Text>
              </View>
              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{trail.duration}</Text>
                <Text style={styles.quickStatLabel}>{t('trailDetailDuration')}</Text>
              </View>
              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{trail.elevationGain} m</Text>
                <Text style={styles.quickStatLabel}>{t('statElevation')}</Text>
              </View>
            </View>
          </AnimatedBlock>

          <AnimatedBlock delay={190}>
            <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('detailOverviewTitle')}</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{t('trailDetailDifficulty')}</Text>
              <Text style={styles.statValue}>{trail.difficulty}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{t('trailDetailRating')}</Text>
              <Text style={styles.statValue}>
                {trail.rating} ({trail.reviews} {t('reviews')})
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{t('detailElevationRange')}</Text>
              <Text style={styles.statValue}>
                {trail.elevationMin} m / {trail.elevationMax} m
              </Text>
            </View>
            {trail.checkpointNote ? (
              <View style={styles.alertBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#BB2823" />
                <Text style={styles.alertText}>{trail.checkpointNote}</Text>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.mapPreviewButton, pressed && styles.primaryButtonPressed]}
                onPress={openMapPreview}
              >
                <Ionicons name="map-outline" size={18} color="#FFFFFF" />
                <Text style={styles.mapPreviewButtonText}>{t('previewOnMap')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  isSaved && styles.saveButtonActive,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={toggleSaved}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={isSaved ? '#FFFFFF' : '#630E13'}
                />
                <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>
                  {isSaved ? t('savedTrail') : t('saveTrail')}
                </Text>
              </Pressable>
            </View>
            </View>
          </AnimatedBlock>

          <AnimatedBlock delay={230}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('detailWeatherTitle')}</Text>
                <Ionicons name="partly-sunny-outline" size={18} color="#D4A843" />
              </View>
              <Text style={styles.weatherSource}>{t('detailWeatherSource')}</Text>

              {isWeatherLoading ? (
                <View style={styles.weatherLoading}>
                  <ActivityIndicator color="#630E13" />
                </View>
              ) : (
                <>
                  {weatherError ? (
                    <Text style={styles.weatherError}>{t('detailWeatherFallback')}</Text>
                  ) : null}

                  {selectedForecast ? (
                    <View
                      style={[
                        styles.todayForecastCard,
                        { backgroundColor: getWeatherVisual(selectedForecast.summaryAr).tint },
                      ]}
                    >
                      <View style={[styles.todayForecastTopRow, isArabic ? rtlRow : ltrRow]}>
                        <View>
                          <Text style={[styles.todayDay, isArabic ? rtlText : ltrText]}>
                            {isArabic
                              ? selectedForecast.dayAr
                              : t((arabicDayToEnglishKey[selectedForecast.dayAr] ?? 'weekdaySaturday') as never)}
                          </Text>
                          <Text style={[styles.todayDate, isArabic ? rtlText : ltrText]}>{selectedForecast.date}</Text>
                        </View>
                        <View
                          style={[
                            styles.todayIconWrap,
                            { backgroundColor: `${getWeatherVisual(selectedForecast.summaryAr).accent}22` },
                          ]}
                        >
                          <Ionicons
                            name={getWeatherVisual(selectedForecast.summaryAr).icon as any}
                            size={26}
                            color={getWeatherVisual(selectedForecast.summaryAr).accent}
                          />
                        </View>
                      </View>
                      <Text style={[styles.todaySummary, isArabic ? rtlText : ltrText]}>{selectedForecast.summaryAr}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.forecastToolbar, isArabic ? rtlRow : ltrRow]}>
                    <Text style={[styles.forecastHint, isArabic ? rtlText : ltrText]}>{selectedForecast ? selectedForecast.date : ''}</Text>
                    <View style={[styles.forecastNav, isArabic ? rtlRow : ltrRow]}>
                      <Pressable
                        onPress={() => nudgeForecast('left')}
                        style={({ pressed }) => [styles.forecastNavButton, pressed && styles.secondaryButtonPressed]}
                      >
                        <Ionicons name="chevron-back" size={16} color="#2C2418" />
                      </Pressable>
                      <Pressable
                        onPress={() => nudgeForecast('right')}
                        style={({ pressed }) => [styles.forecastNavButton, pressed && styles.secondaryButtonPressed]}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#2C2418" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.forecastContainer}>
                    <GestureScrollView
                      ref={forecastScrollRef}
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.forecastStripContent}
                      onScroll={(event) => setForecastScrollX(event.nativeEvent.contentOffset.x)}
                      scrollEventThrottle={16}
                    >
                      {weeklyForecast.map((day) => {
                        const visual = getWeatherVisual(day.summaryAr);
                        const isSelected = day.date === selectedForecast?.date;

                        return (
                          <Pressable
                            key={`${day.date}-${day.dayAr}`}
                            onPress={() => setSelectedForecastDate(day.date)}
                            style={({ pressed }) => [
                              styles.forecastPill,
                              isSelected && styles.forecastPillActive,
                              pressed && styles.forecastPillPressed,
                              { borderColor: isSelected ? visual.accent : `${visual.accent}22` },
                            ]}
                          >
                            <Text style={[styles.forecastPillDay, isArabic ? rtlText : ltrText, isSelected && styles.forecastPillDayActive]}>
                              {isArabic
                                ? day.dayAr
                                : t((arabicDayToEnglishKey[day.dayAr] ?? 'weekdaySaturday') as never)}
                            </Text>
                            <Ionicons
                              name={visual.icon as any}
                              size={18}
                              color={isSelected ? '#FFFFFF' : visual.accent}
                              style={styles.forecastPillIcon}
                            />
                            <Text style={[styles.forecastPillDate, isArabic ? rtlText : ltrText, isSelected && styles.forecastPillDateActive]}>
                              {day.date.slice(5)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </GestureScrollView>
                  </View>
                </>
              )}
            </View>
          </AnimatedBlock>

          <AnimatedBlock delay={270}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('detailCommunityTitle')}</Text>
              {posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Text style={styles.postUser}>{post.user}</Text>
                    <Text style={styles.postTime}>{t(post.timeKey as never)}</Text>
                  </View>
                  <Text style={[styles.postText, isArabic ? rtlText : ltrText]}>{isArabic ? post.textAr : post.textEn}</Text>
                </View>
              ))}
            </View>
          </AnimatedBlock>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE2CC',
  },
  heroImage: {
    width: '100%',
    height: 320,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 10, 6, 0.34)',
    justifyContent: 'space-between',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(18,4,8,0.55)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    marginTop: 'auto',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
  },
  heroRegion: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.84)',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 14,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: '#4A4131',
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  quickStatLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#8A7A6A',
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
    marginBottom: 12,
  },
  weatherSource: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 12,
    color: '#7B6D5A',
  },
  todayForecastCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  todayForecastTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayDay: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2C2418',
  },
  todayDate: {
    marginTop: 4,
    fontSize: 12,
    color: '#7B6D5A',
  },
  todayIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaySummary: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: '#3F372E',
  },
  weatherLoading: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherError: {
    marginBottom: 10,
    fontSize: 12,
    color: '#8A7A6A',
    fontWeight: '700',
  },
  forecastToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  forecastHint: {
    color: '#7B6D5A',
    fontSize: 12,
    fontWeight: '700',
  },
  forecastNav: {
    flexDirection: 'row',
    gap: 8,
  },
  forecastNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3EBDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastContainer: {
    width: '100%',
  },
  forecastStripContent: {
    flexDirection: 'row',
    paddingRight: 24,
  },
  forecastPill: {
    width: 88,
    flexShrink: 0,
    marginRight: 10,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F7F3E7',
    borderWidth: 1,
    alignItems: 'center',
  },
  forecastPillActive: {
    backgroundColor: '#630E13',
    borderColor: '#630E13',
  },
  forecastPillPressed: {
    transform: [{ scale: 0.97 }],
  },
  forecastPillDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2C2418',
  },
  forecastPillDayActive: {
    color: '#FFFFFF',
  },
  forecastPillIcon: {
    marginVertical: 8,
  },
  forecastPillDate: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  forecastPillDateActive: {
    color: 'rgba(255,255,255,0.82)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99,14,19,0.08)',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B5D4E',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 13,
    color: '#2C2418',
    fontWeight: '700',
  },
  alertBox: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(187,40,35,0.08)',
  },
  alertText: {
    flex: 1,
    color: '#7A3431',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapPreviewButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#630E13',
  },
  mapPreviewButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(99,14,19,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.14)',
  },
  saveButtonActive: {
    backgroundColor: '#630E13',
    borderColor: '#630E13',
  },
  saveButtonText: {
    color: '#630E13',
    fontSize: 13,
    fontWeight: '800',
  },
  saveButtonTextActive: {
    color: '#FFFFFF',
  },
  secondaryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  postCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F6F0E0',
    marginTop: 10,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUser: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '800',
  },
  postTime: {
    color: '#8A7A6A',
    fontSize: 11,
  },
  postText: {
    color: '#4A4131',
    fontSize: 14,
    lineHeight: 20,
  },
  notFound: {
    padding: 16,
    color: '#2C2418',
  },
});
