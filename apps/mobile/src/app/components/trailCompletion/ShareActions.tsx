import React from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AnimatedEntrance } from '../AnimatedUI';
import { shareActivityPost } from '../../api/activitiesApi';
import { addLocalFeedItem } from '../../data/localSocial';
import { completionRadii } from '../../features/trailCompletion/theme';
import type { TrailCompletionDraft } from '../../features/trailCompletion/types';
import type { RootStackParamList } from '../../navigation/types';
import { formatCompletionDuration } from '../../features/trailCompletion/formatters';
import { ltrRow, ltrText, rtlRow, rtlText } from '../../utils/direction';

type Nav = StackNavigationProp<RootStackParamList>;

type Props = {
  draft: TrailCompletionDraft;
  isArabic: boolean;
  navigation: Nav;
  isOwner?: boolean;
  ownerName?: string;
  delay?: number;
  onSaveJournal?: () => void;
};

export function ShareActions({ draft, isArabic, navigation, isOwner = true, ownerName, delay = 400, onSaveJournal }: Props) {
  const displayName = ownerName?.trim() || draft.publisherName?.trim() || 'Trail friend';
  const saveJournal =
    onSaveJournal ??
    (() => {
      Alert.alert(
        isArabic ? 'اليوميات' : 'Journal',
        isArabic ? 'ستجد هذه الرحلة في السجل.' : 'This hike is kept in your History.',
        [{ text: 'OK' }],
      );
    });
  const shareRecap = async () => {
    if (!isOwner) {
      return;
    }

    const dur = formatCompletionDuration(draft.durationMs, isArabic);
    const postCaption = draft.postCaption?.trim() || draft.review.trim();
    const postPhotos = draft.postPhotoUris?.length ? draft.postPhotoUris : draft.photoUris;
    const postVisibility = draft.postVisibility === 'friends' ? 'friends' : 'public';
    const message = isArabic
      ? `أكملتُ «${draft.trailName}» على Traces — ${dur}\n${postCaption.slice(0, 280)}`
      : `Finished "${draft.trailName}" on Traces — ${dur}\n${postCaption.slice(0, 280)}`;

    const item = {
      id: `local-recap-${Date.now()}`,
      kind: 'recap' as const,
      activityId: draft.activityId,
      completionDraft: draft,
      trailId: draft.trailId ?? '0',
      user: 'You',
      handle: '@you',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
      image: postPhotos[0] ?? draft.trailImage ?? 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      trailNameEn: draft.trailName,
      trailNameAr: draft.trailName,
      regionEn: isArabic ? 'Your trail' : 'Your route',
      regionAr: isArabic ? 'رحلتك' : 'Your route',
      captionEn: postCaption || message,
      captionAr: postCaption || message,
      timeEn: 'Just now',
      timeAr: 'الآن',
      likes: 1,
      comments: 0,
      distance: `${(draft.trailDistanceKm ?? 0).toFixed(1)} km`,
    };

    if (draft.activityId) {
      try {
        await shareActivityPost(draft.activityId, {
          visibility: postVisibility,
          caption: postCaption || message,
        });
      } catch (error) {
        Alert.alert(
          isArabic ? 'طھط¹ط°ط± ط§ظ„ظ†ط´ط± ط¹ظ„ظ‰ ط§ظ„ط®ط§ط¯ظ…' : 'Backend post failed',
          error instanceof Error
            ? error.message
            : isArabic
              ? 'طھظ… ط­ظپط¸ ط§ظ„ظ…ظ„ط®طµ ظ…ط­ظ„ظٹط§ظ‹ ظپظ‚ط·.'
              : 'The recap will be kept locally for now.',
        );
      }
    }

    addLocalFeedItem(item);

    try {
      await Share.share({ message, title: draft.trailName });
    } catch {
      /* user cancelled */
    }

    navigation.navigate('AppTabs', { screen: 'Activity' });
  };

  return (
    <AnimatedEntrance
      fromY={12}
      duration={420}
      delay={delay}
      style={styles.wrap}
    >
      <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
        {isOwner ? (isArabic ? 'الخطوة التالية' : 'What’s next') : (isArabic ? 'استكشف هذه الرحلة' : 'Explore this hike')}
      </Text>
      <Text style={[styles.sectionSub, isArabic ? rtlText : ltrText]}>
        {isOwner
          ? (isArabic ? 'بعد احتفالك بالرحلة، شارك بلطف أو خطط للقادم.' : 'After the celebration — share lightly, or plan what’s ahead.')
          : (isArabic ? `هذه رحلة نشرها ${displayName}. يمكنك مشاهدة الملف أو تفاصيل المسار.` : `This is ${displayName}'s published hike. You can view their profile or open the trail details.`)}
      </Text>

      <View style={styles.grid}>
        {isOwner ? (
          <>
            <ActionChip
              icon="share-outline"
              label={isArabic ? 'مشاركة الملخص' : 'Share recap'}
              onPress={shareRecap}
              isArabic={isArabic}
            />
            <ActionChip
              icon="people-outline"
              label={isArabic ? 'ادعُ أصدقاءك لاحقاً' : 'Invite friends next time'}
              onPress={() => navigation.navigate('ActivityShareComposer', { type: 'plan' })}
              isArabic={isArabic}
            />
            <ActionChip
              icon="book-outline"
              label={isArabic ? 'حفظ في اليوميات' : 'Save to journal'}
              onPress={saveJournal}
              isArabic={isArabic}
            />
          </>
        ) : (
          <>
            {draft.publisherId ? (
              <ActionChip
                icon="person-circle-outline"
                label={isArabic ? `ملف ${displayName}` : `View ${displayName}'s profile`}
                onPress={() => navigation.navigate('PublicProfile', { profileId: draft.publisherId! })}
                isArabic={isArabic}
              />
            ) : null}
            <ActionChip
              icon="people-outline"
              label={isArabic ? 'خطط لرحلتك الخاصة' : 'Plan your own hike'}
              onPress={() => navigation.navigate('ActivityShareComposer', { type: 'plan', trailId: draft.trailId, trailName: draft.trailName })}
              isArabic={isArabic}
            />
          </>
        )}
        <ActionChip
          icon="map-outline"
          label={isArabic ? 'تفاصيل المسار' : 'View trail details'}
          onPress={() => navigation.navigate('TrailDetail', { trailId: draft.trailId })}
          isArabic={isArabic}
        />
      </View>
    </AnimatedEntrance>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  isArabic,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  isArabic: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, isArabic ? rtlRow : ltrRow]}
    >
      <View style={styles.chipIcon}>
        <Ionicons name={icon} size={18} color="#630E13" />
      </View>
      <Text style={[styles.chipLabel, isArabic ? rtlText : ltrText]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  sectionSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5D4E',
    fontWeight: '600',
    marginBottom: 14,
  },
  grid: {
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: completionRadii.card,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.08)',
  },
  chipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  chipIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(99,14,19,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
    lineHeight: 19,
  },
});
