import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useAuth } from '../contexts/AuthContext';
import { deleteActivity, getActivityById, getActivityGpx, getMyActivities, type Activity, type ActivityDetail } from '../api/activitiesApi';
import { getSavedTrails, getTrailById, type Trail } from '../api/trailsApi';
import { getProfilePhotos, getProfileReviews, type ProfilePhoto, type ProfileReview } from '../api/profilesApi';

const dayNamesAr = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const dayNamesEn = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type HistoryNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDetail'>;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavigationProp>();
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completedTrails, setCompletedTrails] = useState<Trail[]>([]);
  const [profileReviews, setProfileReviews] = useState<ProfileReview[]>([]);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [trailMap, setTrailMap] = useState<Record<string, Trail>>({});
  const [activityDetails, setActivityDetails] = useState<Record<string, ActivityDetail>>({});
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [loadingActivityId, setLoadingActivityId] = useState<string | null>(null);
  const [activityError, setActivityError] = useState('');
  const [exportingActivityId, setExportingActivityId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setActivities([]);
      setCompletedTrails([]);
      setProfileReviews([]);
      setProfilePhotos([]);
      setTrailMap({});
      setIsHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError('');
      try {
        const [userActivities, completedTrailResponse, userReviews, userPhotos] = await Promise.all([
          getMyActivities({ status: 'completed', limit: 100 }),
          getSavedTrails({ type: 'completed', page: 1, limit: 100 }).catch(() => ({ items: [] })),
          getProfileReviews(user.id, { page: 1, limit: 12 }).catch(() => [] as ProfileReview[]),
          getProfilePhotos(user.id, { page: 1, limit: 12 }).catch(() => [] as ProfilePhoto[]),
        ]);
        if (cancelled) return;
        setActivities(userActivities);
        setCompletedTrails(completedTrailResponse.items.map((item) => item.trail));
        setProfileReviews(userReviews);
        setProfilePhotos(userPhotos);

        const trailIds = Array.from(
          new Set(
            userActivities
              .map((item) => item.trail_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const trails = await Promise.all(
          trailIds.map(async (trailId) => {
            try {
              return await getTrailById(trailId);
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          const nextMap: Record<string, Trail> = {};
          trails.forEach((trail) => {
            if (trail) nextMap[trail.id] = trail;
          });
          setTrailMap(nextMap);
        }
      } catch (error) {
        if (!cancelled) {
          setActivities([]);
          setCompletedTrails([]);
          setProfileReviews([]);
          setProfilePhotos([]);
          setTrailMap({});
          setHistoryError(error instanceof Error ? error.message : 'Unable to load your activity history.');
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshKey]);

  const completedActivities = useMemo(
    () =>
      activities
        .filter((item) => item.status === 'completed')
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [activities],
  );

  const calendarDays = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const activeDays = new Set(
      completedActivities
        .map((activity) => new Date(activity.started_at))
        .filter((date) => date.getMonth() === month && date.getFullYear() === year)
        .map((date) => date.getDate()),
    );

    return { daysInMonth, firstDayOfWeek, activeDays };
  }, [completedActivities]);

  const totalDistance = completedTrails.reduce((sum, trail) => sum + trail.distance, 0);
  const totalHikes = completedActivities.length;
  const totalDurationHours = completedActivities.reduce((sum, hike) => {
    if (!hike.started_at || !hike.ended_at) return sum;
    const started = new Date(hike.started_at).getTime();
    const ended = new Date(hike.ended_at).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return sum;
    return sum + (ended - started) / 3600000;
  }, 0);

  const sharedHistoryItems = useMemo(() => {
    const reviewItems = profileReviews.map((review) => ({
      id: `review-${review.id}`,
      type: 'review' as const,
      trailId: review.trail.id,
      trailName: review.trail.name,
      title: isArabic ? 'مراجعة' : 'Review',
      body: review.content,
      image: review.photo_url || review.photos?.[0]?.url || review.trail.image || '',
      createdAt: review.created_at,
      meta: `${Number(review.rating || 0).toFixed(1)} ★`,
    }));

    const photoItems = profilePhotos.map((photo) => ({
      id: `photo-${photo.id}`,
      type: 'post' as const,
      trailId: photo.trail_id,
      trailName: photo.trail_name || (isArabic ? 'مسار' : 'Trail'),
      title: isArabic ? 'منشور وسائط' : 'Media post',
      body: photo.caption?.trim() || (isArabic ? 'صورة شاركتها من رحلتك.' : 'Photo you shared from your hike.'),
      image: photo.url,
      createdAt: photo.created_at || '',
      meta: photo.source === 'review' ? (isArabic ? 'من مراجعة' : 'From review') : (isArabic ? 'صورة مسار' : 'Trail photo'),
    }));

    return [...reviewItems, ...photoItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [isArabic, profilePhotos, profileReviews]);

  const handleToggleActivityDetail = async (activity: Activity) => {
    if (expandedActivityId === activity.id) {
      setExpandedActivityId(null);
      return;
    }

    setExpandedActivityId(activity.id);
    setActivityError('');

    if (activityDetails[activity.id]) {
      return;
    }

    setLoadingActivityId(activity.id);
    try {
      const detail = await getActivityById(activity.id);
      setActivityDetails((current) => ({ ...current, [activity.id]: detail }));
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'Unable to load activity details.');
    } finally {
      setLoadingActivityId(null);
    }
  };

  const handleDeleteActivity = (activity: Activity) => {
    Alert.alert('Delete activity?', 'This removes the recorded activity from your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActivity(activity.id);
            setActivities((current) => current.filter((item) => item.id !== activity.id));
            setActivityDetails((current) => {
              const next = { ...current };
              delete next[activity.id];
              return next;
            });
            if (expandedActivityId === activity.id) setExpandedActivityId(null);
          } catch (error) {
            Alert.alert('Unable to delete activity', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleShareGpx = async (activity: Activity) => {
    setExportingActivityId(activity.id);
    try {
      const gpx = await getActivityGpx(activity.id);
      const trailName = trailMap[activity.trail_id ?? '']?.name ?? activity.trail_name ?? 'Trail activity';
      await Share.share({
        title: `${trailName} GPX`,
        message: gpx,
      });
    } catch (error) {
      Alert.alert('Unable to export GPX', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExportingActivityId(null);
    }
  };

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat(isArabic ? 'ar' : 'en-US', { month: 'long', year: 'numeric' }).format(now);

  return (
    <AnimatedScreen style={styles.container}>
      {/* ── Header ── */}
      <AnimatedBlock delay={40} style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{t('historyTitle')}</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Ionicons name="refresh" size={18} color="#FFF8EA" />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Ionicons name="navigate-outline" size={18} color="#B8CB8A" />
            <Text style={styles.statValue}>{totalDistance.toFixed(1)}km</Text>
            <Text style={styles.statLabel}>{t('historyTotalDistance')}</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="trophy-outline" size={18} color="#D4A843" />
            <Text style={styles.statValue}>{totalHikes}</Text>
            <Text style={styles.statLabel}>{t('historyTripsCount')}</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="time-outline" size={18} color="#80DEEA" />
            <Text style={styles.statValue}>{totalDurationHours.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>{t('historyTotalTime')}</Text>
          </View>
        </View>
      </AnimatedBlock>

      {/* ── Tab bar ── */}
      <AnimatedBlock delay={120} style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === 'list' && styles.tabButtonActive]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons
            name="bar-chart-outline"
            size={14}
            color={activeTab === 'list' ? 'white' : '#6B5D4E'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
            {t('historyTabList')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'calendar' && styles.tabButtonActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={activeTab === 'calendar' ? 'white' : '#6B5D4E'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
            {t('historyTabCalendar')}
          </Text>
        </Pressable>
      </AnimatedBlock>

      {/* ── Content ── */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'list' ? (
          isHistoryLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#630E13" />
              <Text style={styles.emptyStateText}>Loading activity history...</Text>
            </View>
          ) : historyError ? (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={42} color="#BB2823" />
              <Text style={styles.activityErrorText}>{historyError}</Text>
              <Pressable style={styles.retryButton} onPress={() => setRefreshKey((value) => value + 1)}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : completedActivities.length === 0 && sharedHistoryItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trail-sign-outline" size={48} color="#C9B89A" />
              <Text style={styles.emptyStateText}>No completed hikes yet</Text>
            </View>
          ) : (
            <>
              {sharedHistoryItems.length ? (
                <AnimatedBlock delay={140}>
                  <View style={styles.sharedSection}>
                    <View style={styles.sharedHeader}>
                      <View>
                        <Text style={styles.sharedTitle}>{isArabic ? 'منشوراتك ومراجعاتك' : 'Posts & reviews'}</Text>
                        <Text style={styles.sharedSubtitle}>{isArabic ? 'أحدث ما شاركته من الرحلات' : 'Recent things you shared from hikes'}</Text>
                      </View>
                      <Ionicons name="albums-outline" size={19} color="#630E13" />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sharedRail}>
                      {sharedHistoryItems.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.sharedCard}
                          onPress={() => {
                            if (item.trailId) {
                              navigation.navigate('TrailDetail', { trailId: item.trailId });
                            }
                          }}
                        >
                          {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.sharedImage} />
                          ) : (
                            <View style={[styles.sharedImage, styles.sharedImageFallback]}>
                              <Ionicons name={item.type === 'review' ? 'star-outline' : 'image-outline'} size={22} color="#8A7A6A" />
                            </View>
                          )}
                          <View style={styles.sharedBody}>
                            <View style={styles.sharedTypeRow}>
                              <Ionicons name={item.type === 'review' ? 'chatbox-ellipses-outline' : 'images-outline'} size={13} color="#630E13" />
                              <Text style={styles.sharedType}>{item.title}</Text>
                            </View>
                            <Text style={styles.sharedTrail} numberOfLines={1}>{item.trailName}</Text>
                            <Text style={styles.sharedText} numberOfLines={2}>{item.body}</Text>
                            <Text style={styles.sharedMeta} numberOfLines={1}>{item.meta}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </AnimatedBlock>
              ) : null}

              {completedActivities.length === 0 ? (
                <View style={styles.emptyInlineState}>
                  <Ionicons name="trail-sign-outline" size={28} color="#C9B89A" />
                  <Text style={styles.emptyStateText}>No completed hikes yet</Text>
                </View>
              ) : null}

              {completedActivities.map((hike, index) => (
                <AnimatedBlock key={hike.id} delay={160 + index * 40}>
                {/* Outer card is now a column so the detail panel sits below the row */}
                <Pressable
                  style={styles.hikeCard}
                  onPress={() => void handleToggleActivityDetail(hike)}
                >
                  {/* ── Row: timeline + card content ── */}
                  <View style={styles.hikeRow}>
                    <View style={styles.timelineMarker}>
                      <View style={styles.timelineDot} />
                      {index < completedActivities.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>

                    <View style={styles.hikeContent}>
                      <Image
                        source={{ uri: trailMap[hike.trail_id ?? '']?.image ?? '' }}
                        style={styles.hikeImage}
                      />
                      <View style={styles.hikeInfo}>
                        <Text style={styles.hikeDate}>
                          {new Intl.DateTimeFormat(isArabic ? 'ar' : 'en-US', {
                            dateStyle: 'medium',
                          }).format(new Date(hike.started_at))}
                        </Text>
                        <Text style={styles.hikeName} numberOfLines={1}>
                          {trailMap[hike.trail_id ?? '']?.name ?? hike.trail_name ?? 'Trail'}
                        </Text>
                        <View style={styles.hikeMetaRow}>
                          <Text style={styles.hikeMetaText}>
                            {(hike.distance_km ?? 0).toFixed(1)}km
                          </Text>
                          <Text style={styles.hikeMetaDot}>·</Text>
                          <Text style={styles.hikeMetaText}>
                            {(hike.avg_speed_kph ?? 0).toFixed(1)} km/h
                          </Text>
                          <Text style={styles.hikeMetaDot}>·</Text>
                          <Text style={styles.hikeMetaText}>
                            ↑{Math.round(hike.elevation_gain_m ?? 0)}m
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={expandedActivityId === hike.id ? 'chevron-up' : 'chevron-forward'}
                        size={18}
                        color="#8A7A6A"
                        style={styles.hikeChevron}
                      />
                    </View>
                  </View>

                  {/* ── Detail panel: full width, below the row ── */}
                  {expandedActivityId === hike.id && (
                    <View style={styles.activityDetailPanel}>
                      {loadingActivityId === hike.id ? (
                        <ActivityIndicator color="#630E13" />
                      ) : activityError ? (
                        <Text style={styles.activityErrorText}>{activityError}</Text>
                      ) : (
                        <>
                          <Text style={styles.activityDetailTitle}>Activity details</Text>
                          <Text style={styles.activityDetailText}>
                            {activityDetails[hike.id]?.points?.length ?? 0} GPS points ·{' '}
                            {Math.round(
                              activityDetails[hike.id]?.elapsed_time_seconds ??
                                hike.elapsed_time_seconds ??
                                0,
                            )}{' '}
                            sec
                          </Text>
                          <View style={styles.activityActionRow}>
                            {hike.trail_id ? (
                              <Pressable
                                style={styles.activityActionButton}
                                onPress={() =>
                                  navigation.navigate('TrailDetail', { trailId: hike.trail_id! })
                                }
                              >
                                <Ionicons name="map-outline" size={14} color="#630E13" />
                                <Text style={styles.activityActionText}>Open trail</Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              style={styles.activityActionButton}
                              onPress={() => void handleShareGpx(hike)}
                              disabled={exportingActivityId === hike.id}
                            >
                              {exportingActivityId === hike.id ? (
                                <ActivityIndicator size="small" color="#630E13" />
                              ) : (
                                <Ionicons name="download-outline" size={14} color="#630E13" />
                              )}
                              <Text style={styles.activityActionText}>GPX</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.activityActionButton, styles.activityDeleteButton]}
                              onPress={() => handleDeleteActivity(hike)}
                            >
                              <Ionicons name="trash-outline" size={14} color="#8B1E1E" />
                              <Text style={[styles.activityActionText, styles.activityDeleteText]}>
                                Delete
                              </Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
                </AnimatedBlock>
              ))}
            </>
          )
        ) : (
          /* ── Calendar tab ── */
          <AnimatedBlock delay={180}>
            <View style={styles.calendarCard}>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>

              {/* Day-name header */}
              <View style={styles.weekHeader}>
                {(isArabic ? dayNamesAr : dayNamesEn).map((day, i) => (
                  <Text key={i} style={styles.weekDayText}>
                    {day}
                  </Text>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={styles.calendarGrid}>
                {/* Leading empty cells so day 1 lands on the right weekday */}
                {Array.from({ length: calendarDays.firstDayOfWeek }).map((_, i) => (
                  <View key={`empty-${i}`} style={styles.calendarCell} />
                ))}

                {Array.from({ length: calendarDays.daysInMonth }, (_, i) => i + 1).map((day) => {
                  const hasHike = calendarDays.activeDays.has(day);
                  return (
                    <View
                      key={day}
                      style={[styles.calendarCell, hasHike && styles.calendarCellActive]}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          hasHike && styles.calendarCellTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                      {hasHike && <View style={styles.calendarDot} />}
                    </View>
                  );
                })}
              </View>

              {/* Month summary */}
              <View style={styles.monthSummaryGrid}>
                {[
                  {
                    label: t('historyThisMonthHikes'),
                    value: String(calendarDays.activeDays.size),
                    color: '#630E13',
                  },
                  {
                    label: t('historyTotalKm'),
                    value: `${totalDistance.toFixed(1)}km`,
                    color: '#D4A843',
                  },
                  {
                    label: t('historyHighestElevation'),
                    value: `${Math.round(
                      Math.max(
                        ...completedActivities.map((item) => item.elevation_gain_m ?? 0),
                        0,
                      ),
                    )}m`,
                    color: '#7DB3CC',
                  },
                  {
                    label: t('historyAvgDuration'),
                    value: `${(totalDurationHours / Math.max(1, totalHikes)).toFixed(1)}h`,
                    color: '#BB2823',
                  },
                ].map((item) => (
                  <View key={item.label} style={styles.summaryCard}>
                    <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={styles.summaryLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </AnimatedBlock>
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const { width } = Dimensions.get('window');
const CELL_SIZE = Math.floor((width - 32 - 32 - 6 * 4) / 7); // calendar padding + gaps

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#630E13',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },
  statValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },

  // ── Tab bar ─────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F7F7F7',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    color: '#6B5D4E',
    fontWeight: '700',
    fontSize: 13,
  },
  tabTextActive: {
    color: 'white',
  },

  // ── Scroll content ───────────────────────────────────────
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 4,
  },

  // ── Empty state ──────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyStateText: {
    color: '#8A7A6A',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── List: hike card ──────────────────────────────────────
  emptyInlineState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  sharedSection: {
    marginBottom: 18,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE5DA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sharedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sharedTitle: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  sharedSubtitle: {
    marginTop: 3,
    color: '#8A7A6A',
    fontSize: 12,
    fontWeight: '600',
  },
  sharedRail: {
    gap: 10,
    paddingTop: 12,
    paddingRight: 4,
  },
  sharedCard: {
    width: 210,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#F6F0E0',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  sharedImage: {
    width: '100%',
    height: 112,
    backgroundColor: '#E7D8C3',
  },
  sharedImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedBody: {
    padding: 12,
  },
  sharedTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sharedType: {
    color: '#630E13',
    fontSize: 11,
    fontWeight: '900',
  },
  sharedTrail: {
    marginTop: 7,
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
  },
  sharedText: {
    marginTop: 5,
    color: '#4A4131',
    fontSize: 12,
    lineHeight: 17,
  },
  sharedMeta: {
    marginTop: 8,
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '800',
  },
  hikeCard: {
    flexDirection: 'column', // column so detail panel sits below the row
    marginBottom: 16,
  },
  hikeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineMarker: {
    width: 24,
    alignItems: 'center',
    paddingTop: 12, // vertically center dot with card content
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#630E13',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 32,
    backgroundColor: 'rgba(99,14,19,0.2)',
    marginTop: 4,
  },
  hikeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginLeft: 8,
  },
  hikeImage: {
    width: 88,
    height: 88,
  },
  hikeInfo: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  hikeDate: {
    fontSize: 11,
    color: '#8A7A6A',
    marginBottom: 3,
  },
  hikeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  hikeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  hikeMetaText: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  hikeMetaDot: {
    fontSize: 11,
    color: '#C9B89A',
  },
  hikeChevron: {
    paddingRight: 12,
  },

  // ── Activity detail panel ────────────────────────────────
  activityDetailPanel: {
    marginTop: 8,
    marginLeft: 32, // aligns with the card (timeline width + gap)
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  activityDetailTitle: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
  },
  activityDetailText: {
    marginTop: 5,
    color: '#6B5D4E',
    fontSize: 12,
  },
  activityErrorText: {
    color: '#8B1E1E',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 120,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  activityActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  activityActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F6F0E0',
  },
  activityActionText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  activityDeleteButton: {
    backgroundColor: '#F7EBE8',
  },
  activityDeleteText: {
    color: '#8B1E1E',
  },

  // ── Calendar card ────────────────────────────────────────
  calendarCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2418',
    marginBottom: 14,
    textAlign: 'center',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekDayText: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#8A7A6A',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 20,
  },
  calendarCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellActive: {
    backgroundColor: '#630E13',
  },
  calendarCellText: {
    fontSize: 12,
    color: '#2C2418',
  },
  calendarCellTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4A843',
    marginTop: 2,
  },

  // ── Month summary grid ───────────────────────────────────
  monthSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: '#EAE2CC',
    borderRadius: 14,
    padding: 12,
    // two cards per row with gap accounted for
    width: (width - 32 - 32 - 10) / 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#8A7A6A',
    lineHeight: 15,
  },
});
