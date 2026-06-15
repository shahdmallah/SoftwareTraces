import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { deleteActivity, getMyActivities, type Activity } from '../api/activitiesApi';
import { RootStackParamList } from '../navigation/types';
import { useLanguage } from '../contexts/LanguageContext';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import { ltrText, rtlText } from '../utils/direction';

type OngoingNavigationProp = StackNavigationProp<RootStackParamList>;

function formatElapsedMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatActivityElapsed(activity: Activity, isArabic: boolean) {
  if (typeof activity.elapsed_time_seconds === 'number' && Number.isFinite(activity.elapsed_time_seconds)) {
    return formatElapsedMinutes(Math.max(0, Math.floor(activity.elapsed_time_seconds / 60)));
  }

  if (activity.status === 'paused') {
    return statusCopy('paused', isArabic);
  }

  const started = new Date(activity.started_at).getTime();
  if (!Number.isFinite(started)) return '00:00';

  return formatElapsedMinutes(Math.max(0, Math.floor((Date.now() - started) / 60000)));
}

function formatStartTime(startedAt: string, isArabic: boolean) {
  const date = new Date(startedAt);
  if (!Number.isFinite(date.getTime())) return isArabic ? 'وقت غير معروف' : 'Unknown start';

  return new Intl.DateTimeFormat(isArabic ? 'ar' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusCopy(status: string, isArabic: boolean) {
  if (status === 'paused') {
    return isArabic ? 'متوقف مؤقتا' : 'Paused';
  }

  return isArabic ? 'يسجل الآن' : 'Recording';
}

export function OngoingActivitiesScreen() {
  const navigation = useNavigation<OngoingNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { activeSession } = useTrailTracking();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOngoing = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const [recordingActivities, pausedActivities] = await Promise.all([
        getMyActivities({ status: 'recording', limit: 50 }),
        getMyActivities({ status: 'paused', limit: 50 }),
      ]);

      const nextActivities = [...recordingActivities, ...pausedActivities]
        .filter((activity, index, list) => list.findIndex((item) => item.id === activity.id) === index)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      setActivities(nextActivities);
    } catch (loadError) {
      setActivities([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load ongoing activities.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOngoing(false);
    }, [loadOngoing]),
  );

  const activeBackendId = activeSession?.backendActivityId ?? null;
  const visibleActivities = useMemo(
    () => activities.filter((activity) => activity.id !== activeBackendId),
    [activeBackendId, activities],
  );
  const totalOngoing = visibleActivities.length + (activeSession ? 1 : 0);

  const handleCancelActivity = (activity: Activity) => {
    Alert.alert('Cancel activity?', 'This will close the ongoing activity on your account.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel activity',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActivity(activity.id);
            setActivities((current) => current.filter((item) => item.id !== activity.id));
          } catch (cancelError) {
            Alert.alert('Unable to cancel activity', cancelError instanceof Error ? cancelError.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const renderActivity = ({ item, index }: { item: Activity; index: number }) => (
    <AnimatedBlock delay={120 + index * 35}>
      <View style={styles.activityCard}>
        <View style={styles.cardTopRow}>
          <View style={[styles.statusPill, item.status === 'paused' && styles.statusPillPaused]}>
            <Ionicons name={item.status === 'paused' ? 'pause' : 'radio'} size={13} color="#fff" />
            <Text style={styles.statusPillText}>{statusCopy(item.status, isArabic)}</Text>
          </View>
          <Text style={styles.startedText}>{formatStartTime(item.started_at, isArabic)}</Text>
        </View>

        <Text style={[styles.activityTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
          {item.trail_name?.trim() || (isArabic ? 'نشاط مسار مباشر' : 'Live trail activity')}
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Ionicons name="time-outline" size={16} color="#630E13" />
            <Text style={styles.metricText}>{formatActivityElapsed(item, isArabic)}</Text>
          </View>
          <View style={styles.metric}>
            <Ionicons name="navigate-outline" size={16} color="#630E13" />
            <Text style={styles.metricText}>{(item.distance_km ?? 0).toFixed(1)} km</Text>
          </View>
          <View style={styles.metric}>
            <Ionicons name="trending-up-outline" size={16} color="#630E13" />
            <Text style={styles.metricText}>{Math.round(item.elevation_gain_m ?? 0)} m</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          {item.trail_id ? (
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Recording', { trailId: item.trail_id!, activityId: item.id })}>
              <Ionicons name={item.status === 'paused' ? 'play' : 'radio'} size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>{item.status === 'paused' ? 'Resume' : 'Return'}</Text>
            </Pressable>
          ) : null}
          {item.trail_id ? (
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('TrailDetail', { trailId: item.trail_id! })}>
              <Ionicons name="map-outline" size={16} color="#630E13" />
              <Text style={styles.secondaryButtonText}>{isArabic ? 'فتح المسار' : 'Open trail'}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.dangerButton} onPress={() => handleCancelActivity(item)}>
            <Ionicons name="close-outline" size={16} color="#8B1E1E" />
            <Text style={styles.dangerButtonText}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
          </Pressable>
        </View>
      </View>
    </AnimatedBlock>
  );

  return (
    <AnimatedScreen style={styles.container}>
      <FlatList
        data={visibleActivities}
        keyExtractor={(item) => item.id}
        renderItem={renderActivity}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadOngoing(true)} tintColor="#630E13" />}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }]}>
            <View style={styles.headerRow}>
              <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
                <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'الأنشطة الجارية' : 'Ongoing activities'}</Text>
              </View>
              <Pressable style={styles.iconButton} onPress={() => void loadOngoing(true)}>
                <Ionicons name="refresh" size={18} color="#630E13" />
              </Pressable>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name="radio-outline" size={22} color="#fff" />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryValue}>{totalOngoing}</Text>
                <Text style={styles.summaryLabel}>{isArabic ? 'نشاط مفتوح' : 'open activities'}</Text>
              </View>
            </View>

            {activeSession ? (
              <Pressable style={styles.liveCard} onPress={() => navigation.navigate('Recording', { trailId: activeSession.trailId })}>
                <View style={styles.livePulse}>
                  <Ionicons name={activeSession.isTracking ? 'radio' : 'pause'} size={18} color="#fff" />
                </View>
                <View style={styles.liveCopy}>
                  <Text style={styles.liveTitle} numberOfLines={1}>{activeSession.trail?.name ?? 'Live hike in progress'}</Text>
                  <Text style={styles.liveSubtitle}>
                    {activeSession.isTracking ? 'Tap to return to the recording screen' : 'Paused locally - tap to resume'}
                  </Text>
                </View>
                <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#fff" />
              </Pressable>
            ) : null}

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={16} color="#8B1E1E" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#630E13" />
              <Text style={styles.emptyText}>{isArabic ? 'جاري تحميل الأنشطة...' : 'Loading ongoing activities...'}</Text>
            </View>
          ) : activeSession ? null : (
            <View style={styles.emptyState}>
              <Ionicons name="trail-sign-outline" size={44} color="#C9B89A" />
              <Text style={styles.emptyTitle}>{isArabic ? 'لا توجد أنشطة جارية' : 'No ongoing activities'}</Text>
              <Text style={styles.emptyText}>
                {isArabic ? 'ابدأ تسجيلا من صفحة أي مسار وسيظهر هنا.' : 'Start recording from any trail and it will show up here.'}
              </Text>
            </View>
          )
        }
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(34, insets.bottom + 26) }]}
        showsVerticalScrollIndicator={false}
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    gap: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#2C2418',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    color: '#7B6D5A',
    fontSize: 13,
    lineHeight: 19,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#630E13',
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  summaryCopy: {
    flex: 1,
  },
  summaryValue: {
    color: '#FFF8EA',
    fontSize: 26,
    fontWeight: '900',
  },
  summaryLabel: {
    color: 'rgba(255,248,234,0.76)',
    fontSize: 12,
    fontWeight: '800',
  },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#2C2418',
  },
  livePulse: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E7A46',
  },
  liveCopy: {
    flex: 1,
  },
  liveTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  liveSubtitle: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F7EBE8',
  },
  errorText: {
    flex: 1,
    color: '#8B1E1E',
    fontSize: 12,
    fontWeight: '800',
  },
  activityCard: {
    marginBottom: 14,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE7D8',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#1E7A46',
  },
  statusPillPaused: {
    backgroundColor: '#8A6A13',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  startedText: {
    flexShrink: 1,
    color: '#8A7A6A',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  activityTitle: {
    marginTop: 14,
    color: '#2C2418',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F6F0E0',
  },
  metricText: {
    color: '#4A4131',
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#630E13',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F6F0E0',
  },
  secondaryButtonText: {
    color: '#630E13',
    fontSize: 13,
    fontWeight: '900',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F7EBE8',
  },
  dangerButtonText: {
    color: '#8B1E1E',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 58,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    color: '#2C2418',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 7,
    color: '#8A7A6A',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
});
