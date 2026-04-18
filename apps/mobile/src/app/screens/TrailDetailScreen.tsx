import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, Pressable, ActivityIndicator, Platform } from 'react-native';
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

type HourlyWeatherHour = {
  timestamp: string;
  localDate: string;
  localTime: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  precipitationProbability: number | null;
  windSpeedKph: number | null;
  condition: string;
  isDaytime: boolean;
};

type ForecastDay = {
  date: string;
  dayLabel: string;
  summary: string;
  hours: HourlyWeatherHour[];
};

type TrailWeatherApiResponse = {
  data?: {
    weather?: {
      hourly?: HourlyWeatherHour[];
    } | null;
  };
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

function resolveApiBaseUrl() {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

function getWeatherVisual(summary: string, isDaytime = true) {
  if (/rain|shower|storm|drizzle/i.test(summary)) {
    return { emoji: '🌧️', accent: '#8C5A2B', tint: 'rgba(140,90,43,0.14)' };
  }
  if (/cloud|overcast|fog|mist|haze/i.test(summary)) {
    return { emoji: isDaytime ? '⛅' : '☁️', accent: '#7B6A58', tint: 'rgba(123,106,88,0.14)' };
  }
  if (/snow|sleet|hail/i.test(summary)) {
    return { emoji: '❄️', accent: '#A67C52', tint: 'rgba(166,124,82,0.14)' };
  }
  if (/clear|sun|fair|hot/i.test(summary)) {
    return isDaytime
      ? { emoji: '☀️', accent: '#D9892B', tint: 'rgba(217,137,43,0.14)' }
      : { emoji: '☀️', accent: '#A66C2D', tint: 'rgba(166,108,45,0.14)' };
  }
  return isDaytime
    ? { emoji: '🌤️', accent: '#D4A843', tint: 'rgba(212,168,67,0.14)' }
    : { emoji: '🌌', accent: '#8C6A3B', tint: 'rgba(140,106,59,0.14)' };
}

function formatDayLabel(date: string, language: 'ar' | 'en') {
  const dayDate = new Date(`${date}T12:00:00`);

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-US', {
    weekday: 'long',
  }).format(dayDate);
}

function groupForecastByDay(hours: HourlyWeatherHour[], language: 'ar' | 'en'): ForecastDay[] {
  const grouped = new Map<string, HourlyWeatherHour[]>();

  hours.forEach((hour) => {
    const dayHours = grouped.get(hour.localDate) ?? [];
    dayHours.push(hour);
    grouped.set(hour.localDate, dayHours);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayHours]) => {
      const sortedHours = [...dayHours].sort((left, right) => left.localTime.localeCompare(right.localTime));
      return {
        date,
        dayLabel: formatDayLabel(date, language),
        summary: sortedHours[0]?.condition ?? 'Unknown',
        hours: sortedHours,
      };
    });
}

function formatTemperature(value: number | null) {
  return value == null ? '--' : `${Math.round(value)}°`;
}

function formatPercent(value: number | null) {
  return value == null ? '--' : `${Math.round(value)}%`;
}

function formatWind(value: number | null) {
  return value == null ? '--' : `${Math.round(value)} km/h`;
}

function formatDisplayTime(timestamp: string, language: 'ar' | 'en') {
  const date = new Date(timestamp);

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatShortDayDate(dateValue: string, language: 'ar' | 'en') {
  const date = new Date(`${dateValue}T12:00:00`);

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
  }).format(date);
}

function getDayTemperatureRange(hours: HourlyWeatherHour[]) {
  const temperatures = hours
    .map((hour) => hour.temperatureC)
    .filter((value): value is number => value != null);

  if (!temperatures.length) {
    return { high: null, low: null };
  }

  return {
    high: Math.max(...temperatures),
    low: Math.min(...temperatures),
  };
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

  useEffect(() => {
    let cancelled = false;

    const loadForecast = async () => {
      setIsWeatherLoading(true);
      setWeatherError(null);

      try {
        if (!trail) {
          throw new Error('Trail not found.');
        }

        const [lat, lng] = trail.coordinates;
        const response = await fetch(
          `${resolveApiBaseUrl()}/api/trails/weather?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
        );

        if (!response.ok) {
          throw new Error(`Trail weather request failed (${response.status})`);
        }

        const payload = (await response.json()) as TrailWeatherApiResponse;
        const hourlyForecast = payload.data?.weather?.hourly ?? [];
        const groupedForecast = groupForecastByDay(hourlyForecast, language);

        if (!groupedForecast.length) {
          throw new Error('No hourly forecast available.');
        }

        if (!cancelled) {
          setWeeklyForecast(groupedForecast);
        }
      } catch (error) {
        if (!cancelled) {
          setWeeklyForecast([]);
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
  }, [language, trail]);

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

  const weatherSourceLabel = isArabic ? 'توقع ساعي مباشر من Google Weather عبر الخادم' : 'Hourly forecast from Google Weather via the API';
  const hourlyLabel = isArabic ? 'كل ساعة' : 'Hourly';
  const feelsLikeLabel = isArabic ? 'المحسوسة' : 'Feels like';
  const precipLabel = isArabic ? 'احتمال المطر' : 'Precip';
  const windLabel = isArabic ? 'الرياح' : 'Wind';
  const noWeatherLabel = isArabic ? 'لا توجد بيانات طقس متاحة الآن.' : 'No weather data is available right now.';

  if (!trail) {
    return (
      <AnimatedScreen style={styles.container}>
        <Text style={styles.notFound}>{t('trailNotFound')}</Text>
      </AnimatedScreen>
    );
  }

  const posts = postsByTrail[trail.id] ?? postsByTrail['3'];
  const selectedForecast = weeklyForecast.find((day) => day.date === selectedForecastDate) ?? weeklyForecast[0] ?? null;
  const selectedForecastHours = selectedForecast?.hours ?? [];
  const heroHour = selectedForecastHours[0] ?? null;
  const selectedRange = getDayTemperatureRange(selectedForecastHours);
  const chartTemperatures = selectedForecastHours
    .map((hour) => hour.temperatureC)
    .filter((value): value is number => value != null);
  const minChartTemp = chartTemperatures.length ? Math.min(...chartTemperatures) : 0;
  const maxChartTemp = chartTemperatures.length ? Math.max(...chartTemperatures) : 0;

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
            <View style={styles.weatherCard}>
              <View style={styles.weatherHeaderRow}>
                <Text style={styles.weatherTitle}>Weather</Text>
              </View>

              {isWeatherLoading ? (
                <View style={styles.weatherLoading}>
                  <ActivityIndicator color="#630E13" />
                </View>
              ) : selectedForecast ? (
                <>
                  <View style={styles.weatherTopSection}>
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
                        const visual = getWeatherVisual(day.summary, day.hours[0]?.isDaytime);
                        const isSelected = day.date === selectedForecast.date;

                        return (
                          <Pressable
                            key={`${day.date}-${day.dayLabel}`}
                            onPress={() => setSelectedForecastDate(day.date)}
                            style={({ pressed }) => [
                              styles.dailyForecastItem,
                              isSelected && styles.dailyForecastItemActive,
                              pressed && styles.forecastPillPressed,
                            ]}
                          >
                            <Text style={[styles.dailyForecastDay, isSelected && styles.dailyForecastDayActive]}>
                              {formatShortDayDate(day.date, language)}
                            </Text>
                            <Text style={styles.dailyForecastIcon}>{visual.emoji}</Text>
                          </Pressable>
                        );
                      })}
                    </GestureScrollView>
                  </View>

                  <View style={styles.weatherHeroCenter}>
                    <View style={styles.weatherConditionRow}>
                      <Text style={styles.weatherConditionEmoji}>
                        {getWeatherVisual(selectedForecast.summary, heroHour?.isDaytime).emoji}
                      </Text>
                      <Text style={styles.weatherHeroSummary}>{selectedForecast.summary}</Text>
                    </View>
                    <View style={styles.weatherTempRow}>
                      <Text style={styles.weatherHeroTemp}>{formatTemperature(selectedRange.high)}</Text>
                      <Text style={styles.weatherHeroTempMuted}>{formatTemperature(selectedRange.low)}</Text>
                    </View>
                    <Text style={styles.weatherUpdated}>
                      {trail.region} | {formatDisplayTime(heroHour?.timestamp ?? new Date().toISOString(), language)}
                    </Text>
                  </View>

                  <View style={styles.weatherMetaRow}>
                    <View style={styles.weatherMetaItem}>
                      <Ionicons name="rainy-outline" size={18} color="#2C2418" />
                      <Text style={styles.weatherMetaValue}>{formatPercent(heroHour?.precipitationProbability ?? null)}</Text>
                    </View>
                    <View style={styles.weatherMetaItem}>
                      <Ionicons name="sunny-outline" size={18} color="#2C2418" />
                      <Text style={styles.weatherMetaValue}>{formatDisplayTime(selectedForecastHours[0]?.timestamp ?? new Date().toISOString(), language)}</Text>
                    </View>
                    <View style={styles.weatherMetaItem}>
                      <Ionicons name="partly-sunny-outline" size={18} color="#2C2418" />
                      <Text style={styles.weatherMetaValue}>{formatDisplayTime(selectedForecastHours[selectedForecastHours.length - 1]?.timestamp ?? new Date().toISOString(), language)}</Text>
                    </View>
                  </View>

                  {weatherError ? <Text style={styles.weatherErrorInline}>{weatherError}</Text> : null}

                  <View style={styles.weatherChartCard}>
                    <View style={styles.chartMetricsRow}>
                      <View style={styles.chartMetric}>
                        <Text style={styles.chartMetricLabel}>{feelsLikeLabel}</Text>
                        <Text style={styles.chartMetricValue}>{formatTemperature(heroHour?.feelsLikeC ?? null)}</Text>
                      </View>
                      <View style={styles.chartMetric}>
                        <Text style={styles.chartMetricLabel}>{precipLabel}</Text>
                        <Text style={styles.chartMetricValue}>{formatPercent(heroHour?.precipitationProbability ?? null)}</Text>
                      </View>
                      <View style={styles.chartMetric}>
                        <Text style={styles.chartMetricLabel}>{windLabel}</Text>
                        <Text style={styles.chartMetricValue}>{formatWind(heroHour?.windSpeedKph ?? null)}</Text>
                      </View>
                    </View>

                    <View style={styles.hourlyHeader}>
                      <Text style={styles.hourlyTitle}>{hourlyLabel}</Text>
                      <Text style={styles.hourlySubtitle}>{selectedForecastHours.length} {isArabic ? 'ساعة' : 'hours'}</Text>
                    </View>

                    <View style={styles.chartArea}>
                      <View style={styles.chartGradient} />
                      <View style={styles.chartLineRow}>
                        {selectedForecastHours.slice(0, 8).map((hour, index) => {
                          const temperature = hour.temperatureC ?? minChartTemp;
                          const range = Math.max(1, maxChartTemp - minChartTemp);
                          const normalized = (temperature - minChartTemp) / range;

                          return (
                            <View key={hour.timestamp || `${hour.localTime}-${index}`} style={styles.chartPointColumn}>
                              <Text style={styles.chartTempLabel}>{formatTemperature(hour.temperatureC)}</Text>
                              <View style={[styles.chartPointWrap, { marginTop: 36 - normalized * 24 }]}>
                                <View style={[styles.chartPoint, index === 0 && styles.chartPointActive]} />
                              </View>
                              <Text style={styles.chartTimeLabel}>{hour.localTime}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.noWeatherState}>
                  <Ionicons name="cloud-offline-outline" size={22} color="#8A7A6A" />
                  <Text style={[styles.noWeatherText, isArabic ? rtlText : ltrText]}>{weatherError ?? noWeatherLabel}</Text>
                </View>
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
  weatherCard: {
    backgroundColor: '#FFFCF6',
    padding: 20,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(44,36,24,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  weatherHeaderRow: {
    marginBottom: 20,
  },
  weatherTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F211A',
    letterSpacing: -0.8,
  },
  weatherTopSection: {
    marginBottom: 24,
  },
  weatherHeroCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  weatherConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  weatherConditionEmoji: {
    fontSize: 22,
  },
  weatherUpdated: {
    marginTop: 6,
    fontSize: 12,
    color: '#7B6A58',
    textAlign: 'center',
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  weatherHeroTemp: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
    color: '#2C2418',
  },
  weatherHeroTempMuted: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '800',
    color: '#C6C1B4',
  },
  weatherHeroSummary: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2C2418',
    textAlign: 'center',
  },
  weatherMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 6,
  },
  weatherMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherMetaEmoji: {
    fontSize: 18,
  },
  weatherMetaValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  weatherErrorInline: {
    marginTop: 10,
    fontSize: 12,
    color: '#9A3E38',
    fontWeight: '700',
    textAlign: 'center',
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
  noWeatherState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  noWeatherText: {
    fontSize: 13,
    color: '#6B5D4E',
    lineHeight: 20,
  },
  forecastToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingRight: 10,
  },
  forecastHint: {
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  forecastNav: {
    flexDirection: 'row',
    gap: 6,
  },
  forecastNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99,14,19,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastStripContent: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  dailyForecastItem: {
    width: 76,
    flexShrink: 0,
    marginRight: 10,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyForecastItemActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1F211A',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  forecastPillPressed: {
    transform: [{ scale: 0.97 }],
  },
  dailyForecastDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B5D4E',
  },
  dailyForecastDayActive: {
    color: '#2C2418',
  },
  dailyForecastIcon: {
    marginTop: 10,
    fontSize: 28,
  },
  weatherChartCard: {
    marginTop: 18,
  },
  chartMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  chartMetric: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chartMetricLabel: {
    fontSize: 11,
    color: '#8A7A6A',
    fontWeight: '700',
  },
  chartMetricValue: {
    marginTop: 4,
    fontSize: 14,
    color: '#2C2418',
    fontWeight: '900',
  },
  hourlyHeader: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourlyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2C2418',
  },
  hourlySubtitle: {
    fontSize: 12,
    color: '#8A7A6A',
    fontWeight: '700',
  },
  chartArea: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.05)',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 6,
    minHeight: 150,
  },
  chartGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    height: 74,
    backgroundColor: '#F0E7CF',
    opacity: 0.85,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 60,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  chartLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 130,
    paddingHorizontal: 2,
  },
  chartPointColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartTempLabel: {
    fontSize: 12,
    color: '#6A6A6A',
    marginBottom: 4,
  },
  chartPointWrap: {
    height: 42,
    justifyContent: 'center',
  },
  chartPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B98D3D',
  },
  chartPointActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#630E13',
    borderWidth: 3,
    borderColor: '#F7EEDC',
  },
  chartTimeLabel: {
    marginTop: 18,
    fontSize: 11,
    color: '#8A7A6A',
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
