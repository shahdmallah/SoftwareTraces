import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkAchievements } from '../api/achievementsApi';
import { getActivityById, getActivityMedia, shareActivityPost, type ActivityDetail, type ActivityMedia } from '../api/activitiesApi';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  CommunitySuggestions,
  CompletionHero,
  ElevationPhotoTour,
  JourneyTimeline,
  PhotoGalleryStrip,
  ReviewSummary,
  ShareActions,
  SharePreviewCard,
  TrailStatsCard,
} from '../components/trailCompletion';
import { useLanguage } from '../contexts/LanguageContext';
import {
  formatCompletionDate,
  formatCompletionDuration,
  formatDistanceKm,
  formatElevation,
  formatPaceMinPerKm,
  formatSpeedKph,
} from '../features/trailCompletion/formatters';
import type { TrailCompletionDraft } from '../features/trailCompletion/types';
import { useCompletionWeather } from '../features/trailCompletion/useCompletionWeather';
import { saveJournalEntry } from '../data/localSocial';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { useAuth } from '../contexts/AuthContext';

type ShareNavigationProp = StackNavigationProp<RootStackParamList>;
type ShareRouteProp = RouteProp<RootStackParamList, 'ActivityShare'>;

const fallbackShareOptions = [
  {
    id: 'photo' as const,
    icon: 'images-outline' as const,
    titleEn: 'Trail recap',
    titleAr: 'لحظة من المسار',
    descriptionEn: 'Choose a trail from Explore, then add photos and a caption.',
    descriptionAr: 'ملخص بالصور — مرتبط بمساراتك ومراجعاتك.',
    accent: ['#7A9A3A', '#D4A843'] as const,
  },
  {
    id: 'locationMedia' as const,
    icon: 'location-outline' as const,
    titleEn: 'Add media here',
    titleAr: 'أضف وسائط هنا',
    descriptionEn: 'Upload photos linked to your current location without choosing a trail.',
    descriptionAr: 'ارفع صوراً مرتبطة بموقعك الحالي بدون اختيار مسار.',
    accent: ['#2F6F73', '#78A083'] as const,
  },
  {
    id: 'plan' as const,
    icon: 'calendar-outline' as const,
    titleEn: 'Plan the next hike',
    titleAr: 'خطّط للرحلة القادمة',
    descriptionEn: 'Invite friends for a future outing — same flow as before.',
    descriptionAr: 'ادعُ الأصدقاء — نفس المسار السابق.',
    accent: ['#630E13', '#B34A2E'] as const,
  },
];

type CompletionSample = {
  coordinate: [number, number];
  recordedAt: number;
  distanceKm: number;
  elevationM?: number;
  speedKph?: number;
};

function toNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getDistanceMeters(from: [number, number], to: [number, number]) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to[1] - from[1]);
  const lngDelta = toRadians(to[0] - from[0]);
  const lat1 = toRadians(from[1]);
  const lat2 = toRadians(to[1]);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildCompletionSamples(points: ActivityDetail['points']): CompletionSample[] {
  let cumulativeDistanceMeters = 0;

  return points.reduce<CompletionSample[]>((samples, point) => {
    const latitude = toNumber(point.latitude);
    const longitude = toNumber(point.longitude);
    const recordedAt = new Date(point.recorded_at).getTime();

    if (latitude == null || longitude == null || !Number.isFinite(recordedAt)) {
      return samples;
    }

    const coordinate: [number, number] = [longitude, latitude];
    const previous = samples[samples.length - 1];
    if (previous) {
      cumulativeDistanceMeters += getDistanceMeters(previous.coordinate, coordinate);
    }

    samples.push({
      coordinate,
      recordedAt,
      distanceKm: cumulativeDistanceMeters / 1000,
      elevationM: toNumber(point.elevation),
      speedKph: toNumber(point.speed_mps) != null ? Number(toNumber(point.speed_mps)) * 3.6 : undefined,
    });

    return samples;
  }, []);
}

function downsampleProfile<T>(points: T[], maxPoints: number) {
  if (points.length <= maxPoints) {
    return points;
  }

  const lastIndex = points.length - 1;
  return Array.from({ length: maxPoints }, (_, index) => {
    if (index === maxPoints - 1) {
      return points[lastIndex];
    }
    const sourceIndex = Math.round((index / (maxPoints - 1)) * lastIndex);
    return points[sourceIndex];
  });
}

function buildElevationProfile(samples: CompletionSample[]) {
  const points = samples.filter((sample) => sample.elevationM != null);

  return downsampleProfile(
    points.map((sample) => ({
      distanceKm: sample.distanceKm,
      elevationM: sample.elevationM as number,
      capturedAt: sample.recordedAt,
      speedKph: sample.speedKph,
    })),
    48,
  );
}

function findNearestSample(samples: CompletionSample[], capturedAt: number) {
  if (!samples.length || !Number.isFinite(capturedAt)) {
    return null;
  }

  return samples.reduce<CompletionSample | null>((closest, sample) => {
    if (!closest) return sample;
    return Math.abs(sample.recordedAt - capturedAt) < Math.abs(closest.recordedAt - capturedAt) ? sample : closest;
  }, null);
}

function buildPhotoTags(media: ActivityMedia[], samples: CompletionSample[]) {
  return media
    .map((photo) => {
      const uri = photo.url?.trim();
      const latitude = toNumber(photo.latitude);
      const longitude = toNumber(photo.longitude);
      const capturedAt = photo.captured_at ? new Date(photo.captured_at).getTime() : NaN;

      if (!uri || latitude == null || longitude == null || !Number.isFinite(capturedAt)) {
        return null;
      }

      const matchedSample = findNearestSample(samples, capturedAt);

      return {
        uri,
        coordinate: [longitude, latitude] as [number, number],
        capturedAt,
        distanceKm: matchedSample?.distanceKm,
        elevationM: matchedSample?.elevationM,
      };
    })
    .filter((photo): photo is NonNullable<typeof photo> => photo != null);
}

function calculateAvgSpeedKph(distanceMeters: number | null | undefined, elapsedSeconds: number | null | undefined) {
  if (distanceMeters == null || elapsedSeconds == null || !Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds) || distanceMeters <= 0 || elapsedSeconds <= 0) {
    return undefined;
  }

  return (distanceMeters / 1000) / (elapsedSeconds / 3600);
}

function calculateAvgPaceMinPerKm(distanceMeters: number | null | undefined, elapsedSeconds: number | null | undefined) {
  if (distanceMeters == null || elapsedSeconds == null || !Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds) || distanceMeters <= 0 || elapsedSeconds <= 0) {
    return undefined;
  }

  return (elapsedSeconds / 60) / (distanceMeters / 1000);
}

function parseStepCountFromNotes(notes: string | null | undefined) {
  if (!notes) return undefined;

  try {
    const parsed = JSON.parse(notes) as { stepCount?: unknown };
    if (typeof parsed.stepCount === 'number' && Number.isFinite(parsed.stepCount) && parsed.stepCount > 0) {
      return Math.round(parsed.stepCount);
    }
  } catch {
    const match = notes.match(/"stepCount"\s*:\s*(\d+)/i) ?? notes.match(/\bsteps?\D+(\d{2,6})\b/i);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
  }

  return undefined;
}

function estimateStepCount(distanceKm: number | undefined) {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(distanceKm * 1312));
}

function mergeUniqueUris(...groups: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group ?? [])
        .map((uri) => uri?.trim())
        .filter((uri): uri is string => Boolean(uri)),
    ),
  );
}

function mergeNatureSightings(
  draft: TrailCompletionDraft,
  media: ActivityMedia[],
) {
  return Array.from(
    new Map(
      [...(draft.natureSightings ?? []), ...media.map((item) => item.nature_sighting).filter((item): item is NonNullable<typeof item> => Boolean(item))]
        .map((item) => [item.id, item]),
    ).values(),
  );
}

async function hydrateActivityDraft(draft: TrailCompletionDraft): Promise<TrailCompletionDraft> {
  if (!draft.activityId) {
    return draft;
  }

  const [activity, media] = await Promise.all([
    getActivityById(draft.activityId),
    getActivityMedia(draft.activityId).catch(() => []),
  ]);

  const distanceMeters = toNumber(activity.distance_meters);
  const elapsedSeconds = toNumber(activity.elapsed_time_seconds);
  const avgSpeedFromApi = toNumber(activity.avg_speed_mps) != null ? Number(toNumber(activity.avg_speed_mps)) * 3.6 : undefined;
  const samples = buildCompletionSamples(activity.points ?? []);
  const remotePhotoUris = media.map((item) => item.url?.trim()).filter((uri): uri is string => Boolean(uri));
  const routePointCount = draft.routePointCount > 0 ? draft.routePointCount : activity.points?.length ?? 0;
  const activityDistanceKm =
    draft.activityDistanceKm && draft.activityDistanceKm > 0
      ? draft.activityDistanceKm
      : distanceMeters != null
      ? distanceMeters / 1000
      : samples[samples.length - 1]?.distanceKm;

  return {
    ...draft,
    completedAtIso: draft.completedAtIso || activity.end_time || activity.start_time || new Date().toISOString(),
    durationMs: draft.durationMs > 0 ? draft.durationMs : Math.max(0, (elapsedSeconds ?? 0) * 1000),
    photoUris: mergeUniqueUris(draft.photoUris, draft.postPhotoUris, remotePhotoUris),
    postPhotoUris: mergeUniqueUris(draft.postPhotoUris, remotePhotoUris),
    natureSightings: mergeNatureSightings(draft, media),
    stepCount:
      draft.stepCount > 0
        ? draft.stepCount
        : parseStepCountFromNotes(activity.notes) ?? estimateStepCount(activityDistanceKm),
    routePointCount,
    activityDistanceKm,
    avgSpeedKph:
      draft.avgSpeedKph && draft.avgSpeedKph > 0
        ? draft.avgSpeedKph
        : avgSpeedFromApi ?? calculateAvgSpeedKph(distanceMeters, elapsedSeconds),
    avgPaceMinPerKm:
      draft.avgPaceMinPerKm && draft.avgPaceMinPerKm > 0
        ? draft.avgPaceMinPerKm
        : calculateAvgPaceMinPerKm(distanceMeters, elapsedSeconds),
    elevationProfile: draft.elevationProfile?.length ? draft.elevationProfile : buildElevationProfile(samples),
    activityPhotoTags: draft.activityPhotoTags?.length ? draft.activityPhotoTags : buildPhotoTags(media, samples),
    trailElevationGainM: draft.trailElevationGainM ?? toNumber(activity.elevation_gain_meters),
  };
}

export function ActivityShareScreen() {
  const navigation = useNavigation<ShareNavigationProp>();
  const route = useRoute<ShareRouteProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const routeDraft = route.params?.draft;
  const [draft, setDraft] = useState(routeDraft);
  const isOwnDraft = !draft?.publisherId || draft.publisherId === user?.id;
  const publisherName = draft?.publisherName?.trim() || (isOwnDraft ? user?.full_name : '') || 'Trail friend';
  const { weather } = useCompletionWeather(draft, isArabic ? 'ar' : 'en');
  const [achievementHints, setAchievementHints] = useState<string[]>([]);

  useEffect(() => {
    setDraft(routeDraft);
  }, [routeDraft]);

  useEffect(() => {
    if (!routeDraft?.activityId) {
      return;
    }

    let cancelled = false;

    hydrateActivityDraft(routeDraft)
      .then((nextDraft) => {
        if (!cancelled) {
          setDraft(nextDraft);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [routeDraft]);

  useEffect(() => {
    if (!draft || !isOwnDraft) {
      setAchievementHints([]);
      return;
    }
    let cancelled = false;
    checkAchievements()
      .then((rows) => {
        if (cancelled) return;
        const titles = rows
          .filter((r) => r.earned_at)
          .slice(-4)
          .map((r) => (r.title || r.name || '').trim())
          .filter(Boolean);
        setAchievementHints(titles);
      })
      .catch(() => {
        if (!cancelled) setAchievementHints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [draft, isOwnDraft]);

  const weatherLine = useMemo(() => {
    if (!weather) return null;
    return `${weather.summary} · ${Math.round(weather.tempC)}°`;
  }, [weather]);

  const stats = useMemo(() => {
    if (!draft) return [];
    const dur = formatCompletionDuration(draft.durationMs, isArabic);
    const dist = formatDistanceKm(draft.activityDistanceKm ?? draft.trailDistanceKm, isArabic);
    const elev = formatElevation(draft.trailElevationGainM, isArabic);
    const speed = formatSpeedKph(draft.avgSpeedKph, isArabic);
    const pace = formatPaceMinPerKm(draft.avgPaceMinPerKm, isArabic);
    return [
      { icon: 'time-outline' as const, label: isArabic ? 'المدة' : 'Duration', value: dur },
      { icon: 'navigate-outline' as const, label: isArabic ? 'المسافة' : 'Distance', value: dist },
      { icon: 'trending-up-outline' as const, label: isArabic ? 'الصعود' : 'Elevation gain', value: elev },
      { icon: 'speedometer-outline' as const, label: isArabic ? 'متوسط السرعة' : 'Avg speed', value: speed },
      { icon: 'walk-outline' as const, label: isArabic ? 'الوتيرة' : 'Pace', value: pace },
      { icon: 'footsteps-outline' as const, label: isArabic ? 'الخطوات' : 'Steps', value: String(draft.stepCount) },
      {
        icon: 'radio-button-on-outline' as const,
        label: isArabic ? 'نقاط التتبع' : 'GPS checkpoints',
        value: String(Math.max(1, draft.routePointCount)),
      },
    ];
  }, [draft, isArabic]);

  const handleJournalSave = async () => {
    if (!draft) return;

    try {
      const note = draft.postCaption?.trim() || (draft.reviewSkipped ? '' : draft.review.trim()) || 'Private hike post';

      if (draft.activityId) {
        await shareActivityPost(draft.activityId, {
          visibility: 'private',
          caption: note,
          reviewId: draft.reviewId,
        });
      } else {
        saveJournalEntry({
          type: 'journal',
          trail: draft.trailName,
          note,
          date: draft.completedAtIso,
          photoUris: draft.postPhotoUris?.length ? draft.postPhotoUris : draft.photoUris,
        });
      }
    } catch (error) {
      Alert.alert(
        isArabic ? 'طھط¹ط°ط± ط­ظپط¸ ط§ظ„ظٹظˆظ…ظٹط§طھ' : 'Unable to save journal',
        error instanceof Error ? error.message : isArabic ? 'ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰.' : 'Please try again.',
      );
      return;
    }

    Alert.alert(
      isArabic ? 'حُفظ في اليوميات' : 'Saved to your journal',
      isArabic
        ? 'تم حفظ هذا المسار في يومياتك. يمكنك الاطلاع عليه من خلال صفحة اليوميات.'
        : 'This hike was saved to your journal. You can view it in Journal.',
      [
        { text: isArabic ? 'البقاء' : 'Stay', style: 'cancel' },
        { text: isArabic ? 'اليوميات' : 'Open Journal', onPress: () => navigation.navigate('Journal') },
      ],
    );
  };

  if (draft) {
    const reviewSkipped = draft.reviewSkipped || draft.rating <= 0;
    const postSkipped = draft.postSkipped === true;
    const reviewPhotos = reviewSkipped ? [] : draft.reviewPhotoUris ?? draft.photoUris;
    const postPhotos = postSkipped ? [] : draft.postPhotoUris?.length ? draft.postPhotoUris : draft.photoUris;
    const postCaption = draft.postCaption?.trim() || (reviewSkipped ? '' : draft.review);
    const heroPhoto = postPhotos[0] ?? reviewPhotos[0] ?? '';
    const region = isArabic ? draft.regionAr ?? draft.region : draft.region;
    const completedLabel = formatCompletionDate(draft.completedAtIso, isArabic);

    return (
      <AnimatedScreen style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: Math.max(32, insets.bottom + 28),
          }}
        >
          <CompletionHero
            heroUri={heroPhoto}
            fallbackUri={draft.trailImage}
            trailName={isArabic ? draft.trailNameAr ?? draft.trailName : draft.trailName}
            region={region}
            completedDateLabel={completedLabel}
            weatherLine={weatherLine}
            statusLabel={
              isOwnDraft
                ? undefined
                : (isArabic ? `أكمل ${publisherName} هذا المسار` : `${publisherName} completed this trail`)
            }
            isArabic={isArabic}
            onBack={() => navigation.goBack()}
          />

          <TrailStatsCard
            stats={stats}
            achievementHints={isOwnDraft ? achievementHints : []}
            isArabic={isArabic}
            isOwner={isOwnDraft}
            ownerName={publisherName}
          />

          {draft.routePointCount > 0 ? (
            <JourneyTimeline
              routePointCount={draft.routePointCount}
              durationMs={draft.durationMs}
              isArabic={isArabic}
            />
          ) : null}

          {draft.elevationProfile?.length ? (
            <ElevationPhotoTour
              profile={draft.elevationProfile}
              photoTags={draft.activityPhotoTags}
              photoUris={reviewPhotos.length ? reviewPhotos : postPhotos}
              isArabic={isArabic}
              isOwner={isOwnDraft}
              ownerName={publisherName}
            />
          ) : null}

          {reviewSkipped ? null : (
            <ReviewSummary
              rating={draft.rating}
              reviewText={draft.review}
              isArabic={isArabic}
              isOwner={isOwnDraft}
              ownerName={publisherName}
            />
          )}

          <PhotoGalleryStrip
            photoUris={reviewPhotos.length ? reviewPhotos : postPhotos}
            isArabic={isArabic}
            isOwner={isOwnDraft}
            ownerName={publisherName}
          />

          {isOwnDraft && !postSkipped ? (
            <SharePreviewCard
              trailName={isArabic ? draft.trailNameAr ?? draft.trailName : draft.trailName}
              heroUri={heroPhoto || draft.trailImage || ''}
              rating={reviewSkipped ? undefined : draft.rating}
              reviewExcerpt={postCaption}
              durationMs={draft.durationMs}
              isArabic={isArabic}
            />
          ) : null}

          <ShareActions
            draft={draft}
            isArabic={isArabic}
            navigation={navigation}
            isOwner={isOwnDraft}
            ownerName={publisherName}
            onSaveJournal={handleJournalSave}
          />

          <CommunitySuggestions draft={draft} isArabic={isArabic} navigation={navigation} />
        </ScrollView>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.fallbackContent,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.fallbackHeader, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
            </Pressable>
            <View style={styles.fallbackHeaderText}>
              <Text style={[styles.fallbackTitle, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'شارك لحظة' : 'Share a moment'}
              </Text>
              <Text style={[styles.fallbackSub, isArabic ? rtlText : ltrText]}>
                {isArabic
                  ? 'بعد إنهاء مسار، سيظهر هنا احتفال كامل بملخصك. يمكنك أيضاً بدء منشور يدوياً.'
                  : 'After you finish a trail, your full celebration recap appears here. You can still start a post manually.'}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        {fallbackShareOptions.map((option, index) => (
          <AnimatedBlock key={option.id} delay={80 + index * 40}>
            <Pressable
              style={styles.optionCard}
              onPress={() => navigation.navigate('ActivityShareComposer', { type: option.id })}
            >
              <LinearGradient colors={[...option.accent]} style={styles.optionIcon}>
                <Ionicons name={option.icon} size={22} color="#fff" />
              </LinearGradient>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? option.titleAr : option.titleEn}
                </Text>
                <Text style={[styles.optionDescription, isArabic ? rtlText : ltrText]}>
                  {isArabic ? option.descriptionAr : option.descriptionEn}
                </Text>
              </View>
              <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#8A7A6A" />
            </Pressable>
          </AnimatedBlock>
        ))}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDE9E2',
  },
  fallbackContent: {
    paddingHorizontal: 16,
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  fallbackHeaderText: {
    flex: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2C2418',
  },
  fallbackSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B5D4E',
    fontWeight: '600',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.06)',
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2418',
  },
  optionDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5D4E',
  },
});
