import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkAchievements } from '../api/achievementsApi';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  CommunitySuggestions,
  CompletionHero,
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
} from '../features/trailCompletion/formatters';
import { useCompletionWeather } from '../features/trailCompletion/useCompletionWeather';
import { addLocalFeedItem, saveJournalEntry } from '../data/localSocial';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { useAuth } from '../contexts/AuthContext';

type ShareNavigationProp = StackNavigationProp<RootStackParamList>;
type ShareRouteProp = RouteProp<RootStackParamList, 'ActivityShare'>;

const fallbackShareOptions = [
  {
    id: 'photo' as const,
    icon: 'images-outline' as const,
    titleEn: 'Share a trail moment',
    titleAr: 'لحظة من المسار',
    descriptionEn: 'Photo recap with caption — ties to your completed trails and reviews.',
    descriptionAr: 'ملخص بالصور — مرتبط بمساراتك ومراجعاتك.',
    accent: ['#7A9A3A', '#D4A843'] as const,
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

export function ActivityShareScreen() {
  const navigation = useNavigation<ShareNavigationProp>();
  const route = useRoute<ShareRouteProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const draft = route.params?.draft;
  const isOwnDraft = !draft?.publisherId || draft.publisherId === user?.id;
  const publisherName = draft?.publisherName?.trim() || (isOwnDraft ? user?.full_name : '') || 'Trail friend';
  const { weather } = useCompletionWeather(draft, isArabic ? 'ar' : 'en');
  const [achievementHints, setAchievementHints] = useState<string[]>([]);

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
    const dist = formatDistanceKm(draft.trailDistanceKm, isArabic);
    const elev = formatElevation(draft.trailElevationGainM, isArabic);
    return [
      { icon: 'time-outline' as const, label: isArabic ? 'المدة' : 'Duration', value: dur },
      { icon: 'navigate-outline' as const, label: isArabic ? 'طول المسار' : 'Trail length', value: dist },
      { icon: 'trending-up-outline' as const, label: isArabic ? 'الصعود' : 'Elevation gain', value: elev },
      { icon: 'footsteps-outline' as const, label: isArabic ? 'الخطوات' : 'Steps', value: String(draft.stepCount) },
      {
        icon: 'radio-button-on-outline' as const,
        label: isArabic ? 'نقاط التتبع' : 'GPS checkpoints',
        value: String(Math.max(1, draft.routePointCount)),
      },
    ];
  }, [draft, isArabic]);

  const handleJournalSave = () => {
    if (!draft) return;

    saveJournalEntry({
      type: 'journal',
      trail: draft.trailName,
      note: draft.review,
      date: draft.completedAtIso,
    });

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
    const heroPhoto = draft.photoUris[0] ?? '';
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

          <ReviewSummary
            rating={draft.rating}
            reviewText={draft.review}
            isArabic={isArabic}
            isOwner={isOwnDraft}
            ownerName={publisherName}
          />

          <PhotoGalleryStrip
            photoUris={draft.photoUris}
            isArabic={isArabic}
            isOwner={isOwnDraft}
            ownerName={publisherName}
          />

          {isOwnDraft ? (
            <SharePreviewCard
              trailName={isArabic ? draft.trailNameAr ?? draft.trailName : draft.trailName}
              heroUri={heroPhoto || draft.trailImage || ''}
              rating={draft.rating}
              reviewExcerpt={draft.review}
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
