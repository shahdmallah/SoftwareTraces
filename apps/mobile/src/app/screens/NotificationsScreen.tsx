import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { AnimatedScreen } from '../components/AnimatedUI';
import { getMeetup } from '../api/meetupsApi';
import { getSocialFeedItem } from '../api/socialApi';
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type AppNotification,
  type NotificationType,
} from '../api/notificationsApi';
import type { FeedItem } from '../data/activitySocial';
import type { TrailCompletionDraft } from '../features/trailCompletion/types';
import {
  getPushNotificationActivationStatus,
  registerDeviceForPushNotifications,
  type PushNotificationActivationStatus,
} from '../services/pushNotifications';
import { mapMeetupToFeedItem } from '../utils/meetupFeedMap';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';

type NotificationsNavigationProp = StackNavigationProp<RootStackParamList, 'Notifications'>;

const PAGE_LIMIT = 30;

const typeIcon: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  follow: 'person-add-outline',
  message: 'chatbubble-ellipses-outline',
  review_like: 'heart-outline',
  review_comment: 'chatbubble-outline',
  activity_like: 'heart-circle-outline',
  activity_comment: 'chatbubble-ellipses-outline',
  meetup_invite: 'calendar-outline',
  meetup_join: 'people-outline',
  meetup_update: 'calendar-number-outline',
  sos_alert: 'warning-outline',
  danger_alert: 'shield-outline',
  achievement: 'trophy-outline',
  system: 'notifications-outline',
};

const typeTone: Record<NotificationType, string> = {
  follow: '#315D8C',
  message: '#7A4B20',
  review_like: '#B94A63',
  review_comment: '#6A4A9A',
  activity_like: '#B94A63',
  activity_comment: '#6A4A9A',
  meetup_invite: '#7A5B1E',
  meetup_join: '#2F6B4F',
  meetup_update: '#7A5B1E',
  sos_alert: '#9B1C1C',
  danger_alert: '#9B1C1C',
  achievement: '#946200',
  system: '#5E646D',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTrailId(notification: AppNotification): string | null {
  return (
    asString(notification.data.trail_id) ||
    (notification.entity?.type === 'trail' ? asString(notification.entity.id) : null)
  );
}

function getActivityId(notification: AppNotification): string | null {
  return (
    asString(notification.data.activity_id) ||
    (notification.entity?.type === 'activity' ? asString(notification.entity.id) : null)
  );
}

function getNavigationSessionId(notification: AppNotification): string | null {
  return asString(notification.data.navigation_session_id);
}

function getConversationId(notification: AppNotification): string | null {
  return asString(notification.data.conversation_id);
}

function getContextType(notification: AppNotification): RootStackParamList['ActivityThread']['contextType'] | undefined {
  const value = asString(notification.data.context_type) || asString(notification.data.conversation_type);

  if (
    value === 'direct' ||
    value === 'meetup' ||
    value === 'trail' ||
    value === 'activity' ||
    value === 'safety' ||
    value === 'profile' ||
    value === 'photo' ||
    value === 'review'
  ) {
    return value;
  }

  return undefined;
}

function isNavigationAlert(notification: AppNotification): boolean {
  return asString(notification.data.notification_kind) === 'navigation_off_track' || Boolean(getNavigationSessionId(notification));
}

function getReviewId(notification: AppNotification): string | null {
  return (
    asString(notification.data.review_id) ||
    (notification.entity?.type === 'review' ? asString(notification.entity.id) : null)
  );
}

function getMeetupId(notification: AppNotification): string | null {
  return (
    asString(notification.data.meetup_id) ||
    (notification.entity?.type === 'meetup' ? asString(notification.entity.id) : null)
  );
}

function getUserId(notification: AppNotification): string | null {
  return (
    asString(notification.data.user_id) ||
    (notification.entity?.type === 'user' ? asString(notification.entity.id) : null) ||
    asString(notification.actor?.id)
  );
}

function recapToDraft(item: Extract<FeedItem, { kind: 'recap' }>): TrailCompletionDraft {
  return item.completionDraft ?? {
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
  };
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const ageMs = Date.now() - date.getTime();
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

function getDangerMeta(notification: AppNotification) {
  if (notification.type !== 'danger_alert') {
    return null;
  }

  const severity = asString(notification.data.severity);
  const dangerType = asString(notification.data.danger_type);
  const latitude = asNumber(notification.data.latitude);
  const longitude = asNumber(notification.data.longitude);

  return {
    severity,
    dangerType,
    latitude,
    longitude,
  };
}

export function NotificationsScreen() {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushNotificationActivationStatus>('disabled');
  const [isActivatingPush, setIsActivatingPush] = useState(false);

  const hasUnread = unreadCount > 0;

  const refreshPushStatus = useCallback(async () => {
    try {
      setPushStatus(await getPushNotificationActivationStatus());
    } catch {
      setPushStatus('unavailable');
    }
  }, []);

  const loadNotifications = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMessage('');

    try {
      const response = await getNotifications({ page: 1, limit: PAGE_LIMIT });
      setNotifications(response.data);
      setUnreadCount(response.unread_count);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    void refreshPushStatus();
  }, [loadNotifications, refreshPushStatus]);

  const updateNotificationReadState = useCallback((notification: AppNotification) => {
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? notification : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const openNotificationDestination = useCallback(async (notification: AppNotification) => {
    if (notification.type === 'message') {
      const conversationId = getConversationId(notification);
      if (conversationId) {
        navigation.navigate('ActivityThread', {
          conversationId,
          participantId: asString(notification.data.sender_profile_id) ?? notification.actor?.id ?? undefined,
          participantName: asString(notification.data.sender_name) ?? notification.actor?.full_name ?? notification.title,
          participantAvatar: asString(notification.data.sender_avatar_url) ?? notification.actor?.avatar_url ?? undefined,
          contextType: getContextType(notification) ?? 'direct',
          contextId: asString(notification.data.context_id) ?? undefined,
          contextTitle: asString(notification.data.context_title) ?? undefined,
        });
        return;
      }

      navigation.navigate('ActivityMessages');
      return;
    }

    if (notification.type === 'sos_alert') {
      const conversationId = getConversationId(notification);
      if (conversationId) {
        navigation.navigate('ActivityThread', {
          conversationId,
          contextType: 'safety',
          contextId: asString(notification.entity?.id) ?? asString(notification.data.sos_event_id) ?? undefined,
          contextTitle: notification.title,
          contextSubtitle: notification.body,
        });
        return;
      }

      navigation.navigate('AppTabs', { screen: 'Activity' });
      return;
    }

    if (notification.type === 'danger_alert') {
      const trailId = getTrailId(notification);
      const activityId = getActivityId(notification);
      const meta = getDangerMeta(notification);

      if (trailId && (activityId || isNavigationAlert(notification))) {
        navigation.navigate('Recording', activityId ? { trailId, activityId } : { trailId });
        return;
      }

      if (trailId) {
        navigation.navigate('TrailDetail', { trailId });
        return;
      }

      if (meta?.latitude != null && meta.longitude != null) {
        navigation.navigate('ReportIssue', {
          latitude: meta.latitude,
          longitude: meta.longitude,
          locationName: notification.title,
        });
        return;
      }

      navigation.navigate('AppTabs', { screen: 'Map' });
      return;
    }

    if (notification.type === 'follow') {
      const profileId = getUserId(notification);
      if (profileId) {
        navigation.navigate('PublicProfile', { profileId });
        return;
      }
    }

    if (notification.type === 'review_like' || notification.type === 'review_comment') {
      const reviewId = getReviewId(notification);
      if (reviewId) {
        try {
          const feedItem = mapSocialFeedItemToFeedItem(await getSocialFeedItem('review', reviewId));
          if (feedItem.kind === 'recap') {
            navigation.navigate('ActivityShare', { draft: recapToDraft(feedItem) });
            return;
          }
        } catch {
          // Fall through to the broader trail destination if the post is unavailable.
        }
      }

      const trailId = getTrailId(notification);
      if (trailId) {
        navigation.navigate('TrailDetail', { trailId });
        return;
      }
    }

    if (notification.type === 'activity_like' || notification.type === 'activity_comment') {
      const trailId = getTrailId(notification);
      const activityId = getActivityId(notification);
      if (activityId) {
        try {
          const feedItem = mapSocialFeedItemToFeedItem(await getSocialFeedItem('activity', activityId));
          if (feedItem.kind === 'recap') {
            navigation.navigate('ActivityShare', { draft: recapToDraft(feedItem) });
            return;
          }
        } catch {
          // Fall through to activity/trail destinations if the post is unavailable.
        }
      }

      if (trailId && activityId) {
        navigation.navigate('Recording', { trailId, activityId });
        return;
      }
      navigation.navigate('AppTabs', { screen: 'Activity' });
      return;
    }

    if (notification.type === 'meetup_invite' || notification.type === 'meetup_join' || notification.type === 'meetup_update') {
      const meetupId = getMeetupId(notification);
      if (meetupId) {
        try {
          const meetup = await getMeetup(meetupId);
          navigation.navigate('ActivityPlanJoin', { plan: mapMeetupToFeedItem(meetup) });
          return;
        } catch {
          // Fall through to the broader activity destination if the meetup is unavailable.
        }
      }

      navigation.navigate('AppTabs', { screen: 'Activity' });
      return;
    }

    if (notification.type === 'achievement') {
      navigation.navigate('AppTabs', { screen: 'Profile' });
      return;
    }
  }, [navigation]);

  const handleOpenNotification = useCallback(async (notification: AppNotification) => {
    setPendingAction(notification.id);

    try {
      const nextNotification = notification.read_at
        ? notification
        : await markNotificationAsRead(notification.id);
      if (!notification.read_at) {
        updateNotificationReadState(nextNotification);
      }
      await openNotificationDestination(nextNotification);
    } catch (error) {
      Alert.alert('Unable to open notification', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPendingAction(null);
    }
  }, [openNotificationDestination, updateNotificationReadState]);

  const handleMarkAllRead = useCallback(async () => {
    setPendingAction('read-all');

    try {
      await markAllNotificationsAsRead();
      const now = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
      setUnreadCount(0);
    } catch (error) {
      Alert.alert('Unable to mark all as read', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPendingAction(null);
    }
  }, []);

  const handleEnablePush = useCallback(async () => {
    setIsActivatingPush(true);

    try {
      const token = await registerDeviceForPushNotifications();
      await refreshPushStatus();

      if (!token) {
        Alert.alert('Notifications unavailable', 'Push notifications need a physical device and notification permission.');
      }
    } catch (error) {
      Alert.alert('Unable to enable notifications', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsActivatingPush(false);
    }
  }, [refreshPushStatus]);

  const handleDeleteNotification = useCallback((notification: AppNotification) => {
    Alert.alert('Delete notification?', 'This removes it from your inbox.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPendingAction(`delete-${notification.id}`);
          try {
            await deleteNotification(notification.id);
            setNotifications((current) => current.filter((item) => item.id !== notification.id));
            if (!notification.read_at) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }
          } catch (error) {
            Alert.alert('Unable to delete notification', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setPendingAction(null);
          }
        },
      },
    ]);
  }, []);

  const unreadLabel = useMemo(() => {
    if (unreadCount === 0) {
      return 'All caught up';
    }

    return `${unreadCount} unread`;
  }, [unreadCount]);

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const tone = typeTone[item.type] ?? '#5E646D';
    const dangerMeta = getDangerMeta(item);
    const isUnread = !item.read_at;

    return (
      <Pressable
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() => void handleOpenNotification(item)}
        disabled={pendingAction === item.id}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${tone}18` }]}>
          <Ionicons name={typeIcon[item.type] ?? 'notifications-outline'} size={21} color={tone} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardTime}>{formatNotificationDate(item.created_at)}</Text>
          </View>
          <Text style={styles.cardText} numberOfLines={3}>{item.body}</Text>

          {dangerMeta ? (
            <View style={styles.dangerMetaRow}>
              {dangerMeta.severity ? (
                <View style={styles.dangerPill}>
                  <Text style={styles.dangerPillText}>{dangerMeta.severity}</Text>
                </View>
              ) : null}
              {dangerMeta.dangerType ? (
                <Text style={styles.dangerType}>{dangerMeta.dangerType.replace(/_/g, ' ')}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          {pendingAction === item.id ? (
            <ActivityIndicator size="small" color="#630E13" />
          ) : isUnread ? (
            <View style={styles.unreadDot} />
          ) : null}
          <Pressable
            style={styles.deleteButton}
            disabled={pendingAction === `delete-${item.id}`}
            onPress={(event) => {
              event.stopPropagation();
              handleDeleteNotification(item);
            }}
          >
            {pendingAction === `delete-${item.id}` ? (
              <ActivityIndicator size="small" color="#8B1E1E" />
            ) : (
              <Ionicons name="trash-outline" size={16} color="#8B1E1E" />
            )}
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#2C2418" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{unreadLabel}</Text>
        </View>
        <Pressable
          style={[styles.markAllButton, (!hasUnread || pendingAction === 'read-all') && styles.markAllButtonDisabled]}
          disabled={!hasUnread || pendingAction === 'read-all'}
          onPress={() => void handleMarkAllRead()}
        >
          {pendingAction === 'read-all' ? (
            <ActivityIndicator size="small" color="#630E13" />
          ) : (
            <Ionicons name="checkmark-done-outline" size={18} color="#630E13" />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color="#630E13" />
          <Text style={styles.stateText}>Loading notifications...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateBlock}>
          <Ionicons name="alert-circle-outline" size={34} color="#8B1E1E" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadNotifications()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={notifications.length ? styles.listContent : styles.emptyContent}
          ListHeaderComponent={
            pushStatus === 'enabled' ? null : (
              <View style={styles.pushCard}>
                <View style={styles.pushCardIcon}>
                  <Ionicons name={pushStatus === 'unavailable' ? 'phone-portrait-outline' : 'notifications-outline'} size={20} color="#630E13" />
                </View>
                <View style={styles.pushCardCopy}>
                  <Text style={styles.pushCardTitle}>
                    {pushStatus === 'unavailable' ? 'Push needs a device' : 'Enable push alerts'}
                  </Text>
                  <Text style={styles.pushCardText}>
                    {pushStatus === 'unavailable'
                      ? 'Use a physical development build to receive navigation alerts.'
                      : 'Get message, navigation, and safety alerts even when Traces is in the background.'}
                  </Text>
                </View>
                {pushStatus === 'unavailable' ? null : (
                  <Pressable
                    style={[styles.pushButton, isActivatingPush && styles.pushButtonDisabled]}
                    disabled={isActivatingPush}
                    onPress={() => void handleEnablePush()}
                  >
                    {isActivatingPush ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={17} color="#fff" />
                    )}
                  </Pressable>
                )}
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadNotifications('refresh')}
              tintColor="#630E13"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={42} color="#8A7A6A" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>Messages, follows, reactions, and safety alerts will show up here.</Text>
            </View>
          }
        />
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 2,
    color: '#8A7A6A',
    fontSize: 12,
    fontWeight: '800',
  },
  markAllButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F7EBE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButtonDisabled: {
    opacity: 0.45,
  },
  listContent: {
    gap: 10,
    paddingBottom: 28,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    minHeight: 96,
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ECE3D7',
  },
  cardUnread: {
    borderColor: '#D7BDA7',
    backgroundColor: '#FFF9F2',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: '#2C2418',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  cardTime: {
    color: '#A18F7A',
    fontSize: 11,
    fontWeight: '800',
  },
  cardText: {
    color: '#5D5043',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  cardActions: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#630E13',
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9EDEA',
  },
  dangerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  dangerPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F7EBE8',
  },
  dangerPillText: {
    color: '#8B1E1E',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dangerType: {
    color: '#8B1E1E',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  stateBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 26,
  },
  stateText: {
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#8B1E1E',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#630E13',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  pushCard: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#D7BDA7',
  },
  pushCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  pushCardCopy: {
    flex: 1,
  },
  pushCardTitle: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  pushCardText: {
    marginTop: 3,
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  pushButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  pushButtonDisabled: {
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: '#6B5D4E',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
