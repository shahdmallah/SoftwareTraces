import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ListRenderItem, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { deleteActivityPost } from '../api/activitiesApi';
import { addReviewComment, commentOnActivity, followUser, getFollowing, getReviewComments, likeActivity, likeReview, unfollowUser, unlikeReview, getSocialFeed, type ActivityComment, type ReviewComment } from '../api/socialApi';
import { deleteTrailReview } from '../api/trailsApi';
import { listMeetups } from '../api/meetupsApi';
import { type FeedCommentPreview, type FeedItem } from '../data/activitySocial';
import { getLocalFeedItems } from '../data/localSocial';
import { mapMeetupToFeedItem } from '../utils/meetupFeedMap';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { colors } from '../theme/colors';

type ActivityNavigationProp = StackNavigationProp<RootStackParamList>;
type ActivityCalendarModalProps = {
  visible: boolean;
  isArabic: boolean;
  onClose: () => void;
  onApply: (date: Date) => void;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hasImageUri(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'T';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase();
}

function reviewCommentToPreview(comment: ReviewComment): FeedCommentPreview {
  return {
    id: comment.id,
    userId: comment.user.id,
    user: comment.user.full_name || 'Trail friend',
    avatar: comment.user.avatar_url || '',
    body: comment.content,
    createdAt: comment.created_at,
  };
}

function activityCommentToPreview(
  comment: ActivityComment,
  fallbackUser: { id: string; full_name: string } | null | undefined,
): FeedCommentPreview {
  return {
    id: comment.id,
    userId: comment.user?.id || comment.user_id || fallbackUser?.id,
    user: comment.user?.full_name || fallbackUser?.full_name || 'You',
    avatar: comment.user?.avatar_url || '',
    body: comment.body,
    createdAt: comment.created_at,
  };
}

function appendCommentPreview(existing: FeedCommentPreview[] | undefined, next: FeedCommentPreview): FeedCommentPreview[] {
  const comments = [...(existing ?? []).filter((comment) => comment.id !== next.id), next];
  return comments.slice(-3);
}

function ActivityCalendarModal({ visible, isArabic, onClose, onApply }: ActivityCalendarModalProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewDate, setViewDate] = useState(() => new Date(today));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today));

  useEffect(() => {
    if (visible) {
      const now = startOfDay(new Date());
      setViewDate(now);
      setSelectedDate(now);
    }
  }, [visible]);

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(monthStart);
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = monthStart.getDay();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const dayNames = isArabic
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const moveMonth = (direction: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.calendarBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <AnimatedBlock fromY={18} fromScale={0.97} style={styles.calendarModalCard}>
          <View style={styles.calendarBody}>
            <View style={[styles.calendarMonthRow, isArabic ? rtlRow : ltrRow]}>
              <Pressable style={styles.calendarNavButton} onPress={() => moveMonth(-1)}>
                <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={18} color="#630E13" />
              </Pressable>
              <Text style={styles.calendarMonthLabel}>{monthLabel}</Text>
              <Pressable style={styles.calendarNavButton} onPress={() => moveMonth(1)}>
                <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#630E13" />
              </Pressable>
            </View>

            <View style={styles.calendarWeekRow}>
              {dayNames.map((day) => (
                <Text key={day} style={styles.calendarWeekday}>{day.slice(0, 2)}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {cells.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
                }

                const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                const isToday = sameDay(cellDate, today);
                const isSelected = sameDay(cellDate, selectedDate);

                return (
                  <Pressable
                    key={`${viewDate.getFullYear()}-${viewDate.getMonth()}-${day}`}
                    style={styles.calendarDayCell}
                    onPress={() => setSelectedDate(cellDate)}
                  >
                    <View style={[
                      styles.calendarDayCircle,
                      isToday && styles.calendarDayToday,
                      isSelected && styles.calendarDaySelected,
                    ]}>
                      <Text style={[
                        styles.calendarDayText,
                        isToday && styles.calendarDayTextToday,
                        isSelected && styles.calendarDayTextSelected,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.calendarActions, isArabic ? rtlRow : ltrRow]}>
              <Pressable style={styles.calendarSecondaryButton} onPress={onClose}>
                <Text style={styles.calendarSecondaryText}>{isArabic ? 'Cancel' : 'Cancel'}</Text>
              </Pressable>
              <Pressable style={styles.calendarPrimaryButton} onPress={() => onApply(selectedDate)}>
                <Ionicons name="search-outline" size={16} color="#fff" />
                <Text style={styles.calendarPrimaryText}>{isArabic ? 'Apply' : 'Apply'}</Text>
              </Pressable>
            </View>
          </View>
        </AnimatedBlock>
      </View>
    </Modal>
  );
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeSearchValue(value: string): string {
  return normalize(value)
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\u00b7/g, ' ')
    .replace(/\s+/g, ' ');
}

function buildDateSearchValues(value: string): string[] {
  const normalizedValue = normalizeSearchValue(value);
  const values = [value, normalizedValue];
  const monthAliases: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  const monthPattern = Object.keys(monthAliases).join('|');
  const monthDayMatch = normalizedValue.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})\\b`));
  const dayMonthMatch = normalizedValue.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})\\b`));
  const match = monthDayMatch
    ? { month: monthAliases[monthDayMatch[1]], day: Number(monthDayMatch[2]) }
    : dayMonthMatch
      ? { month: monthAliases[dayMonthMatch[2]], day: Number(dayMonthMatch[1]) }
      : null;

  if (match && Number.isFinite(match.day)) {
    const month = String(match.month);
    const day = String(match.day);
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    values.push(
      `${month}/${day}`,
      `${paddedMonth}/${paddedDay}`,
      `${day}/${month}`,
      `${paddedDay}/${paddedMonth}`,
      `${month}-${day}`,
      `${paddedMonth}-${paddedDay}`,
    );
  }

  return values;
}

function matchesQuery(item: FeedItem, query: string): boolean {
  if (!query) return true;

  const values =
    item.kind === 'recap'
      ? [
          item.user,
          item.handle,
          item.trailNameEn,
          item.trailNameAr,
          item.regionEn,
          item.regionAr,
          item.captionEn,
          item.captionAr,
          item.distance,
        ]
      : [
          item.user,
          item.handle,
          item.destinationEn,
          item.destinationAr,
          item.dateEn,
          item.dateAr,
          ...buildDateSearchValues(item.dateEn),
          ...buildDateSearchValues(item.dateAr),
          item.vibeEn,
          item.vibeAr,
          item.noteEn,
          item.noteAr,
        ];

  const normalizedSearchQuery = normalizeSearchValue(query);
  return values.some((value) => {
    const normalizedValue = normalize(value);
    return normalizedValue.includes(query) || normalizeSearchValue(value).includes(normalizedSearchQuery);
  });
}

type FeedCardProps = {
  item: FeedItem;
  index: number;
  isArabic: boolean;
  currentUserId?: string;
  onOpenTrail: (trailId: string) => void;
  onOpenRecap: (item: RecapItem) => void;
  onOpenPlan: (item: PlanItem) => void;
  onOpenProfile: (userId: string) => void;
  onToggleLike: (item: RecapItem) => Promise<void>;
  onSendComment: (item: RecapItem, body: string) => Promise<void>;
  onToggleFollow: (item: RecapItem) => Promise<void>;
  onDeleteRecap: (item: RecapItem) => Promise<void>;
  followedUsers: Record<string, boolean>;
};

const FeedCard = memo(function FeedCard({
  item,
  index,
  isArabic,
  currentUserId,
  onOpenTrail,
  onOpenRecap,
  onOpenPlan,
  onOpenProfile,
  onToggleLike,
  onSendComment,
  onToggleFollow,
  onDeleteRecap,
  followedUsers,
}: FeedCardProps) {
  return (
    <AnimatedBlock delay={index < 4 ? 120 + index * 35 : 0}>
      {item.kind === 'recap' ? (
        <RecapCard
          item={item}
          isArabic={isArabic}
          currentUserId={currentUserId}
          onOpenTrail={onOpenTrail}
          onOpenRecap={onOpenRecap}
          onOpenProfile={onOpenProfile}
          onToggleLike={onToggleLike}
          onSendComment={onSendComment}
          onToggleFollow={onToggleFollow}
          onDeleteRecap={onDeleteRecap}
          isFollowed={Boolean(item.userId && followedUsers[item.userId])}
        />
      ) : (
        <PlanCard item={item} isArabic={isArabic} onOpenPlan={onOpenPlan} />
      )}
    </AnimatedBlock>
  );
});

type RecapItem = Extract<FeedItem, { kind: 'recap' }>;
type PlanItem = Extract<FeedItem, { kind: 'plan' }>;

// ─── Shared card header ───────────────────────────────────────────────────────
type CardHeaderProps = {
  avatar: string;
  user: string;
  handle: string;
  timeEn?: string;
  timeAr?: string;
  isArabic: boolean;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  badgeLabelEn: string;
  badgeLabelAr: string;
  badgeStyle: 'hike' | 'meetup';
  onOpenProfile?: () => void;
  rightAccessory?: React.ReactNode;
};

const CardHeader = memo(function CardHeader({
  avatar,
  user,
  handle,
  timeEn,
  timeAr,
  isArabic,
  badgeIcon,
  badgeLabelEn,
  badgeLabelAr,
  badgeStyle,
  onOpenProfile,
  rightAccessory,
}: CardHeaderProps) {
  const meta = [handle, timeEn || timeAr ? (isArabic ? timeAr : timeEn) : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.cardHeader, isArabic ? rtlRow : ltrRow]}>
      <Pressable style={[styles.userRow, isArabic ? rtlRow : ltrRow]} onPress={onOpenProfile}>
        {hasImageUri(avatar) ? (
          <Image source={{ uri: avatar.trim() }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{getInitials(user)}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {user}
          </Text>
          <Text style={[styles.userMeta, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      <View style={[styles.headerRightCluster, isArabic && styles.headerRightClusterRtl]}>
        <View style={[styles.badge, badgeStyle === 'hike' ? styles.badgeHike : styles.badgeMeetup]}>
          <Ionicons name={badgeIcon} size={13} color={badgeStyle === 'hike' ? '#630E13' : '#fff'} />
          <Text style={[styles.badgeText, badgeStyle === 'hike' ? styles.badgeTextHike : styles.badgeTextMeetup]}>
            {isArabic ? badgeLabelAr : badgeLabelEn}
          </Text>
        </View>
        {rightAccessory}
      </View>
    </View>
  );
});

// ─── Recap card ──────────────────────────────────────────────────────────────
const RecapCard = memo(function RecapCard({
  item,
  isArabic,
  currentUserId,
  onOpenTrail,
  onOpenRecap,
  onOpenProfile,
  onToggleLike,
  onSendComment,
  onToggleFollow,
  onDeleteRecap,
  isFollowed,
}: {
  item: RecapItem;
  isArabic: boolean;
  currentUserId?: string;
  onOpenTrail: (trailId: string) => void;
  onOpenRecap: (item: RecapItem) => void;
  onOpenProfile: (userId: string) => void;
  onToggleLike: (item: RecapItem) => Promise<void>;
  onSendComment: (item: RecapItem, body: string) => Promise<void>;
  onToggleFollow: (item: RecapItem) => Promise<void>;
  onDeleteRecap: (item: RecapItem) => Promise<void>;
  isFollowed: boolean;
}) {
  const [commentDraft, setCommentDraft] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'like' | 'comment' | 'follow' | 'delete' | null>(null);
  const imageUri = hasImageUri(item.image) ? item.image.trim() : null;
  const visibleComments = item.previewComments ?? [];

  const handleLike = async () => {
    setPendingAction('like');
    try {
      await onToggleLike(item);
    } finally {
      setPendingAction(null);
    }
  };

  const handleComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;

    setPendingAction('comment');
    try {
      await onSendComment(item, body);
      setCommentDraft('');
      setCommentOpen(false);
    } finally {
      setPendingAction(null);
    }
  };

  const handleFollow = async () => {
    if (!item.userId) return;
    setPendingAction('follow');
    try {
      await onToggleFollow(item);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      isArabic ? 'حذف المنشور؟' : 'Delete post?',
      isArabic ? 'سيتم حذف هذا المنشور من خلاصتك.' : 'This removes this post from your feed.',
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setPendingAction('delete');
            try {
              await onDeleteRecap(item);
            } finally {
              setPendingAction(null);
            }
          },
        },
      ],
    );
  };

  const showFollowButton = item.userId && item.userId !== currentUserId;
  const showDeleteButton = item.userId && item.userId === currentUserId;

  return (
    <Pressable style={styles.card} onPress={() => onOpenRecap(item)}>
      <CardHeader
        avatar={item.avatar}
        user={item.user}
        handle={item.handle}
        timeEn={item.timeEn}
        timeAr={item.timeAr}
        isArabic={isArabic}
        badgeIcon="walk-outline"
        badgeLabelEn="Hike"
        badgeLabelAr="رحلة"
        badgeStyle="hike"
        onOpenProfile={item.userId ? () => onOpenProfile(item.userId!) : undefined}
        rightAccessory={
          showDeleteButton ? (
            <Pressable
              style={styles.deletePostButton}
              onPress={(event) => {
                event.stopPropagation();
                handleDelete();
              }}
              disabled={pendingAction === 'delete'}
            >
              {pendingAction === 'delete' ? (
                <ActivityIndicator size="small" color="#8B1E1E" />
              ) : (
                <Ionicons name="trash-outline" size={15} color="#8B1E1E" />
              )}
            </Pressable>
          ) : showFollowButton ? (
            <Pressable
              style={[styles.followButton, isFollowed && styles.followButtonActive]}
              onPress={(event) => {
                event.stopPropagation();
                void handleFollow();
              }}
              disabled={pendingAction === 'follow'}
            >
              {pendingAction === 'follow' ? (
                <ActivityIndicator size="small" color={isFollowed ? '#fff' : '#630E13'} />
              ) : (
                <>
                  <Ionicons name={isFollowed ? 'checkmark' : 'person-add-outline'} size={13} color={isFollowed ? '#fff' : '#630E13'} />
                  <Text style={[styles.followButtonText, isFollowed && styles.followButtonTextActive]}>
                    {isFollowed ? (isArabic ? 'تتابع' : 'Following') : isArabic ? 'متابعة' : 'Follow'}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null
        }
      />

      <View style={styles.mediaWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.media} resizeMode="cover" />
        ) : (
          <View style={[styles.media, styles.mediaFallback]}>
            <Ionicons name="trail-sign-outline" size={30} color="#D7BDA7" />
            <Text style={styles.mediaFallbackText}>{isArabic ? 'Trail moment' : 'Trail moment'}</Text>
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.62)']} style={styles.mediaOverlay}>
          <View style={styles.mediaTags}>
            <View style={styles.mediaTag}>
              <Ionicons name="location-outline" size={13} color="#fff" />
              <Text style={styles.mediaTagText} numberOfLines={1}>
                {isArabic ? item.trailNameAr : item.trailNameEn}
              </Text>
            </View>
            <View style={styles.mediaTag}>
              <Ionicons name="footsteps-outline" size={13} color="#fff" />
              <Text style={styles.mediaTagText}>{item.distance}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={[styles.actions, isArabic && styles.actionsRtl]}>
        <View style={[styles.actionGroup, isArabic && styles.actionGroupRtl]}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              void handleLike();
            }}
            disabled={pendingAction === 'like'}
          >
            {pendingAction === 'like' ? (
              <ActivityIndicator size="small" color="#C5333A" />
            ) : (
              <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={20} color={item.isLiked ? '#C5333A' : '#2C2418'} />
            )}
          </Pressable>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              setCommentOpen((value) => !value);
            }}
          >
            <Ionicons name="chatbubble-outline" size={19} color="#2C2418" />
          </Pressable>
          <Ionicons name="navigate-outline" size={19} color="#2C2418" />
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onOpenTrail(item.trailId);
          }}
        >
          <Ionicons name="map-outline" size={19} color="#2C2418" />
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.likeCount, isArabic ? rtlText : ltrText]}>
          {isArabic ? `${item.likes} إعجاب` : `${item.likes} likes`}
        </Text>
        <Text style={[styles.caption, isArabic ? rtlText : ltrText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={3}>
          <Text style={styles.captionUser}>{item.user} </Text>
          {isArabic ? item.captionAr : item.captionEn}
        </Text>
        <View style={[styles.cardFooter, isArabic ? rtlRow : ltrRow]}>
          <Text style={[styles.commentHint, isArabic ? rtlText : ltrText]}>
            {isArabic ? `${item.comments} تعليق` : `${item.comments} comments`}
          </Text>
          <Text style={[styles.locationLine, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {isArabic ? item.regionAr : item.regionEn}
          </Text>
        </View>
        {visibleComments.length > 0 ? (
          <View style={styles.commentPreviewList}>
            {visibleComments.map((comment) => (
              <View key={comment.id} style={[styles.commentPreviewRow, isArabic ? rtlRow : ltrRow]}>
                {hasImageUri(comment.avatar) ? (
                  <Image source={{ uri: comment.avatar.trim() }} style={styles.commentPreviewAvatar} />
                ) : (
                  <View style={[styles.commentPreviewAvatar, styles.commentPreviewAvatarFallback]}>
                    <Text style={styles.commentPreviewAvatarText}>{getInitials(comment.user)}</Text>
                  </View>
                )}
                <View style={styles.commentPreviewBubble}>
                  <Text style={[styles.commentPreviewText, isArabic ? rtlText : ltrText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={2}>
                    <Text style={styles.commentPreviewUser}>{comment.user} </Text>
                    {comment.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {commentOpen ? (
          <View style={[styles.commentComposer, isArabic ? rtlRow : ltrRow]}>
            <TextInput
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder={isArabic ? 'اكتب تعليقاً...' : 'Write a comment...'}
              placeholderTextColor="#A18F7A"
              style={[
                styles.commentInput, 
                isArabic ? rtlText : ltrText,
                { textAlign: isArabic ? 'right' : 'left', writingDirection: isArabic ? 'rtl' : 'ltr' }
              ]}
              onPressIn={(event) => event.stopPropagation()}
            />
            <Pressable
              style={[styles.commentSendButton, (!commentDraft.trim() || pendingAction === 'comment') && styles.commentSendButtonDisabled]}
              disabled={!commentDraft.trim() || pendingAction === 'comment'}
              onPress={(event) => {
                event.stopPropagation();
                void handleComment();
              }}
            >
              {pendingAction === 'comment' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={15} color="#fff" />}
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});
// ─── Plan / meetup card ───────────────────────────────────────────────────────
const PlanCard = memo(function PlanCard({
  item,
  isArabic,
  onOpenPlan,
}: {
  item: PlanItem;
  isArabic: boolean;
  onOpenPlan: (item: PlanItem) => void;
}) {
  const coverUri = hasImageUri(item.cover) ? item.cover.trim() : null;

  return (
    <Pressable style={styles.card} onPress={() => onOpenPlan(item)}>
      <CardHeader
        avatar={item.avatar}
        user={item.user}
        handle={item.handle}
        isArabic={isArabic}
        badgeIcon="calendar"
        badgeLabelEn="Meetup"
        badgeLabelAr="لقاء"
        badgeStyle="meetup"
      />

      {/* Full-bleed cover with event details overlaid */}
      <View style={styles.meetupCover}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.meetupImage} resizeMode="cover" />
        ) : (
          <View style={[styles.meetupImage, styles.meetupImageFallback]} />
        )}
        <LinearGradient colors={['rgba(15,10,7,0.05)', 'rgba(15,10,7,0.78)']} style={styles.meetupOverlay}>
          <View style={styles.meetupBody}>
            <Text style={[styles.meetupTitle, isArabic ? rtlText : ltrText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={2}>
              {isArabic ? item.destinationAr : item.destinationEn}
            </Text>
            <Text style={[styles.meetupDate, isArabic ? rtlText : ltrText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={1}>
              {isArabic ? item.dateAr : item.dateEn}
            </Text>
            <Text style={[styles.meetupVibe, isArabic ? rtlText : ltrText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={1}>
              {isArabic ? item.vibeAr : item.vibeEn}
            </Text>
            <Text style={[styles.meetupNote, isArabic ? rtlText : ltrText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={2}>
              {isArabic ? item.noteAr : item.noteEn}
            </Text>
            <View style={[styles.meetupPills, isArabic ? rtlRow : ltrRow]}>
              <View style={styles.pill}>
                <Ionicons name="people-outline" size={14} color="#fff" />
                <Text style={styles.pillText}>{isArabic ? `${item.peopleJoined} منضمون` : `${item.peopleJoined} joined`}</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="sparkles-outline" size={14} color="#fff" />
                <Text style={styles.pillText}>{isArabic ? `${item.spotsLeft} أماكن` : `${item.spotsLeft} spots`}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function ActivityScreen() {
  const navigation = useNavigation<ActivityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteRecaps, setRemoteRecaps] = useState<FeedItem[]>([]);
  const [remoteMeetups, setRemoteMeetups] = useState<FeedItem[]>([]);
  const [localFeedItems, setLocalFeedItems] = useState<FeedItem[]>([]);
  const [feedError, setFeedError] = useState('');
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<Record<string, boolean>>({});
  const [calendarVisible, setCalendarVisible] = useState(false);

  const normalizedQuery = useMemo(() => normalize(searchQuery), [searchQuery]);

  const feedData = useMemo(() => {
    return [...localFeedItems, ...remoteMeetups, ...(isAuthenticated ? remoteRecaps : [])];
  }, [isAuthenticated, localFeedItems, remoteMeetups, remoteRecaps]);

  const refreshMeetups = useCallback(async () => {
    try {
      const response = await listMeetups({ page: 1, limit: 30 });
      setRemoteMeetups(response.data.map(mapMeetupToFeedItem));
    } catch {
      setRemoteMeetups([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLocalFeedItems(getLocalFeedItems());
      void refreshMeetups();
    }, [refreshMeetups]),
  );

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setRemoteRecaps([]);
      setIsFeedLoading(false);
      return () => { cancelled = true; };
    }

    const loadFeed = async () => {
      setIsFeedLoading(true);
      try {
        const response = await getSocialFeed({ page: 1, limit: 30 });
        const mappedItems = response.data.map(mapSocialFeedItemToFeedItem);
        if (!cancelled) {
          setRemoteRecaps(mappedItems);
          setFeedError('');
        }

        const reviewItems = mappedItems.filter(
          (item): item is RecapItem => item.kind === 'recap' && item.sourceType === 'review' && item.comments > 0,
        );

        if (reviewItems.length > 0) {
          const commentResults = await Promise.all(
            reviewItems.map(async (item) => {
              try {
                const comments = await getReviewComments(item.id, { page: 1, limit: 3 });
                return {
                  id: item.id,
                  previewComments: comments.data.map(reviewCommentToPreview),
                };
              } catch {
                return null;
              }
            }),
          );

          if (!cancelled) {
            const commentsByItemId = commentResults.reduce<Record<string, FeedCommentPreview[]>>((acc, result) => {
              if (result) {
                acc[result.id] = result.previewComments;
              }
              return acc;
            }, {});

            setRemoteRecaps((items) => items.map((item) => {
              if (item.kind !== 'recap' || !commentsByItemId[item.id]) {
                return item;
              }

              return {
                ...item,
                previewComments: commentsByItemId[item.id],
              };
            }));
          }
        }
      } catch {
        if (!cancelled) {
          setRemoteRecaps([]);
          setFeedError(isArabic ? 'تعذر تحميل نشاط الأصدقاء.' : 'Unable to load friend activity right now.');
        }
      } finally {
        if (!cancelled) {
          setIsFeedLoading(false);
        }
      }
    };

    void loadFeed();
    return () => { cancelled = true; };
  }, [isAuthenticated, isArabic]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setFollowedUsers({});
      return;
    }

    const loadFollowing = async () => {
      try {
        const response = await getFollowing(user.id);
        const followingMap = response.data.reduce((acc, profile) => {
          acc[profile.id] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setFollowedUsers(followingMap);
      } catch {
        // Handle error if needed
      }
    };

    void loadFollowing();
  }, [isAuthenticated, user?.id]);

  const updateRecap = useCallback((id: string, updater: (item: RecapItem) => RecapItem) => {
    const updateItems = (items: FeedItem[]) => items.map((item) => (item.kind === 'recap' && item.id === id ? updater(item) : item));
    setRemoteRecaps(updateItems);
  }, []);

  const handleToggleLike = useCallback(
    async (item: RecapItem) => {
      const wasLiked = Boolean(item.isLiked);
      if (item.sourceType === 'activity' && wasLiked) {
        return;
      }

      updateRecap(item.id, (current) => ({
        ...current,
        isLiked: !wasLiked,
        likes: Math.max(0, current.likes + (wasLiked ? -1 : 1)),
      }));

      try {
        if (item.sourceType === 'review') {
          await (wasLiked ? unlikeReview(item.id) : likeReview(item.id));
        } else if (item.sourceType === 'activity' && item.activityId) {
          await likeActivity(item.activityId);
        }
      } catch (error) {
        updateRecap(item.id, (current) => ({
          ...current,
          isLiked: wasLiked,
          likes: Math.max(0, current.likes + (wasLiked ? 1 : -1)),
        }));
        Alert.alert(isArabic ? 'تعذر الإعجاب' : 'Unable to like', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    [isArabic, updateRecap],
  );

  const handleSendComment = useCallback(
    async (item: RecapItem, body: string) => {
      try {
        let previewComment: FeedCommentPreview | null = null;

        if (item.activityId) {
          previewComment = activityCommentToPreview(await commentOnActivity(item.activityId, body), user ?? null);
        } else if (item.sourceType === 'review') {
          previewComment = reviewCommentToPreview(await addReviewComment(item.id, body));
        } else {
          throw new Error('Comment target is not available for this post.');
        }

        updateRecap(item.id, (current) => ({
          ...current,
          comments: current.comments + 1,
          previewComments: previewComment
            ? appendCommentPreview(current.previewComments, previewComment)
            : current.previewComments,
        }));
      } catch (error) {
        Alert.alert(isArabic ? 'تعذر إرسال التعليق' : 'Unable to comment', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    [isArabic, updateRecap, user],
  );

  const handleToggleFollow = useCallback(
    async (item: RecapItem) => {
      if (!item.userId) return;
      const wasFollowed = Boolean(followedUsers[item.userId]);
      setFollowedUsers((current) => ({ ...current, [item.userId!]: !wasFollowed }));
      try {
        await (wasFollowed ? unfollowUser(item.userId) : followUser(item.userId));
      } catch (error) {
        setFollowedUsers((current) => ({ ...current, [item.userId!]: wasFollowed }));
        Alert.alert(isArabic ? 'تعذر تحديث المتابعة' : 'Unable to update follow', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    [followedUsers, isArabic],
  );

  const handleDeleteRecap = useCallback(
    async (item: RecapItem) => {
      try {
        if (item.sourceType === 'review') {
          await deleteTrailReview(item.id);
        } else if (item.sourceType === 'activity') {
          await deleteActivityPost(item.id);
        } else {
          throw new Error('Delete target is not available for this post.');
        }

        setRemoteRecaps((current) => current.filter((feedItem) => feedItem.id !== item.id));
      } catch (error) {
        Alert.alert(isArabic ? 'تعذر حذف المنشور' : 'Unable to delete post', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    [isArabic],
  );

  const filteredFeed = useMemo(
    () => feedData.filter((item) => matchesQuery(item, normalizedQuery)),
    [feedData, normalizedQuery],
  );

  const handleOpenTrail = useCallback(
    (trailId: string) => navigation.navigate('TrailDetail', { trailId }),
    [navigation],
  );

  const handleOpenProfile = useCallback(
    (userId: string) => navigation.navigate('PublicProfile', { profileId: userId }),
    [navigation],
  );

  const handleOpenRecap = useCallback(
    (item: RecapItem) => {
      if (item.completionDraft) {
        navigation.navigate('ActivityShare', { draft: item.completionDraft });
        return;
      }

      navigation.navigate('ActivityShare', {
        draft: {
          activityId: item.activityId,
          trailId: item.trailId,
          publisherId: item.userId,
          publisherName: item.user,
          publisherHandle: item.handle,
          publisherAvatar: item.avatar,
          trailName: item.trailNameEn,
          trailNameAr: item.trailNameAr,
          trailImage: item.image,
          region: item.regionEn,
          regionAr: item.regionAr,
          rating: 0,
          review: item.captionEn,
          photoUris: item.image ? [item.image] : [],
          completedAtIso: new Date().toISOString(),
          durationMs: 0,
          stepCount: 0,
          routePointCount: 0,
        },
      });
    },
    [navigation],
  );

  const handleOpenPlan = useCallback(
    (item: PlanItem) => navigation.navigate('ActivityPlanJoin', { plan: item }),
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<FeedItem>>(
    ({ item, index }) => (
      <FeedCard
        item={item}
        index={index}
        isArabic={isArabic}
        currentUserId={user?.id}
        onOpenTrail={handleOpenTrail}
        onOpenRecap={handleOpenRecap}
        onOpenPlan={handleOpenPlan}
        onOpenProfile={handleOpenProfile}
        onToggleLike={handleToggleLike}
        onSendComment={handleSendComment}
        onToggleFollow={handleToggleFollow}
        onDeleteRecap={handleDeleteRecap}
        followedUsers={followedUsers}
      />
    ),
    [followedUsers, handleDeleteRecap, handleOpenPlan, handleOpenProfile, handleOpenRecap, handleOpenTrail, handleSendComment, handleToggleFollow, handleToggleLike, isArabic, user?.id],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View>
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.pageTitle, isArabic ? rtlText : ltrText]}>{t('tabActivity')}</Text>
            </View>

            <View style={[styles.headerActions, isArabic && styles.headerActionsRtl]}>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('ActivityShare')}>
                <Ionicons name="add-circle-outline" size={20} color="#2C2418" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('ActivityMessages')}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2C2418" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => setSearchOpen((v) => !v)}>
                <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={20} color="#2C2418" />
              </Pressable>
            </View>
          </View>
        </AnimatedBlock>

        {searchOpen ? (
          <AnimatedBlock delay={60}>
            <View style={styles.searchCard}>
              <View style={[styles.searchRow, isArabic ? rtlRow : ltrRow]}>
                <Ionicons name="search-outline" size={18} color="#8A7A6A" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={isArabic ? 'ابحث عن صديق، مسار، رحلة، أو لقاء' : 'Search friends, trails, dates, or meetups'}
                  placeholderTextColor="#A18F7A"
                  style={[
                    styles.searchInput,
                    isArabic ? rtlText : ltrText,
                    { textAlign: isArabic ? 'right' : 'left', writingDirection: isArabic ? 'rtl' : 'ltr' }
                  ]}
                  returnKeyType="search"
                  autoFocus
                />
                <Pressable
                  style={styles.searchIconButton}
                  onPress={() => setCalendarVisible(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color="#fff" />
                </Pressable>
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#A18F7A" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </AnimatedBlock>
        ) : null}
        
        <ActivityCalendarModal
          visible={calendarVisible}
          isArabic={isArabic}
          onClose={() => setCalendarVisible(false)}
          onApply={(date: Date) => {
            setCalendarVisible(false);
            setSearchQuery(`${date.getMonth() + 1}/${date.getDate()}`);
          }}
        />
        
        {feedError ? (
          <View style={styles.feedErrorBanner}>
            <Ionicons name="warning-outline" size={16} color="#8B1E1E" />
            <Text style={[styles.feedErrorText, isArabic ? rtlText : ltrText]}>{feedError}</Text>
          </View>
        ) : null}
        {isFeedLoading ? (
          <View style={styles.feedLoadingRow}>
            <ActivityIndicator size="small" color="#630E13" />
            <Text style={[styles.feedLoadingText, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'جارٍ تحميل نشاط الأصدقاء...' : 'Loading friend activity...'}
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [calendarVisible, feedError, isArabic, isFeedLoading, navigation, searchOpen, searchQuery, t],
  );

  return (
    <AnimatedScreen style={styles.container}>
      <FlatList
        data={filteredFeed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="trail-sign-outline" size={28} color="#8A7A6A" />
            <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'لا توجد نتائج' : 'No trail moments found'}
            </Text>
            <Text style={[styles.emptyCopy, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'جرّب بحثاً آخر.' : 'Try a different search.'}
            </Text>
          </View>
        }
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
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

  // ─── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2C2418',
  },
  pageSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#7B6D5A',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionsRtl: {
    flexDirection: 'row-reverse',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },

  // ─── Search ────────────────────────────────────────────────────────────────
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 24,
    fontSize: 14,
    color: '#2C2418',
    paddingVertical: 0,
  },
  searchIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  calendarBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(22, 18, 14, 0.58)',
  },
  calendarModalCard: {
    borderRadius: 28,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 241, 0.62)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 32,
    elevation: 12,
  },
  calendarBody: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: '#FFF8F1',
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNavButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  calendarMonthLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '900',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backgroundColor: 'transparent',
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: '#D7BDA7',
  },
  calendarDaySelected: {
    backgroundColor: '#630E13',
    borderColor: '#630E13',
  },
  calendarDayText: {
    color: '#2C2418',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  calendarDayTextToday: {
    color: '#630E13',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '900',
  },
  calendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  calendarSecondaryButton: {
    height: 42,
    minWidth: 96,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  calendarSecondaryText: {
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '900',
  },
  calendarPrimaryButton: {
    height: 42,
    minWidth: 112,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    backgroundColor: '#630E13',
  },
  calendarPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },

  // ─── Unified card shell ────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 3,
  },

  // ─── Shared card header ────────────────────────────────────────────────────
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EAE0',
  },
  followButton: {
    minWidth: 92,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  followButtonActive: {
    backgroundColor: '#630E13',
    borderColor: '#630E13',
  },
  followButtonText: {
    color: '#630E13',
    fontSize: 11,
    fontWeight: '900',
  },
  followButtonTextActive: {
    color: '#fff',
  },
  deletePostButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E7D8C3',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6E9DE',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  avatarFallbackText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  userMeta: {
    fontSize: 11,
    color: '#8A7A6A',
    marginTop: 2,
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  headerRightClusterRtl: {
    flexDirection: 'row-reverse',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  badgeHike: {
    backgroundColor: '#F6E9DE',
  },
  badgeMeetup: {
    backgroundColor: '#630E13',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTextHike: {
    color: '#630E13',
  },
  badgeTextMeetup: {
    color: '#fff',
  },

  // ─── Recap media ───────────────────────────────────────────────────────────
  mediaWrap: {
    height: 240,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3A2E22',
  },
  mediaFallbackText: {
    color: '#F6E9DE',
    fontSize: 12,
    fontWeight: '900',
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 14,
  },
  mediaTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mediaTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },

  // ─── Recap actions + body ──────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  actionsRtl: {
    flexDirection: 'row-reverse',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionGroupRtl: {
    flexDirection: 'row-reverse',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 15,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C2418',
  },
  caption: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: '#43382C',
  },
  captionUser: {
    fontWeight: '800',
    color: '#2C2418',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 9,
  },
  commentPreviewList: {
    gap: 8,
    marginTop: 12,
  },
  commentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentPreviewAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E7D8C3',
  },
  commentPreviewAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6E9DE',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  commentPreviewAvatarText: {
    color: '#630E13',
    fontSize: 9,
    fontWeight: '900',
  },
  commentPreviewBubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#F8F1E8',
  },
  commentPreviewText: {
    color: '#43382C',
    fontSize: 12,
    lineHeight: 17,
  },
  commentPreviewUser: {
    color: '#2C2418',
    fontWeight: '900',
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F6F0E0',
    color: '#2C2418',
    fontSize: 13,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  commentSendButtonDisabled: {
    opacity: 0.55,
  },
  feedErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#F7EBE8',
  },
  feedErrorText: {
    flex: 1,
    color: '#8B1E1E',
    fontSize: 12,
    fontWeight: '800',
  },
  feedLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  feedLoadingText: {
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '800',
  },
  commentHint: {
    fontSize: 13,
    color: '#8A7A6A',
  },
  locationLine: {
    flexShrink: 1,
    fontSize: 12,
    color: '#A18F7A',
  },

  // ─── Meetup cover ──────────────────────────────────────────────────────────
  meetupCover: {
    height: 280,
    position: 'relative',
  },
  meetupImage: {
    width: '100%',
    height: '100%',
  },
  meetupImageFallback: {
    backgroundColor: '#3A2E22',
  },
  meetupOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  meetupBody: {},
  meetupTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    color: '#fff',
  },
  meetupDate: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '800',
    color: '#F0DCAA',
  },
  meetupVibe: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
  },
  meetupNote: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
  },
  meetupPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // ─── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 52,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  emptyCopy: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#8A7A6A',
    textAlign: 'center',
  },
});
