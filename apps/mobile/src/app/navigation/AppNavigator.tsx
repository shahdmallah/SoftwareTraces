import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef, getFocusedRouteNameFromRoute, useNavigation, useRoute } from '@react-navigation/native';
import {
  CardStyleInterpolators,
  createStackNavigator,
  StackNavigationProp,
  TransitionSpecs,
} from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, AppTabParamList } from './types';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreen } from '../screens/AuthScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { MapScreen } from '../screens/MapScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PublicProfileScreen } from '../screens/PublicProfileScreen';
import { TrailDetailScreen } from '../screens/TrailDetailScreen';
import { TrailAccessScreen } from '../screens/TrailAccessScreen';
import { AllReviewsScreen } from '../screens/AllReviewsScreen';
import { TrailMediaScreen } from '../screens/TrailMediaScreen';
import { RecordingScreen } from '../screens/RecordingScreen';
import { OngoingActivitiesScreen } from '../screens/OngoingActivitiesScreen';
import { CreateTrailScreen } from '../screens/CreateTrailScreen';
import { ActivityMessagesScreen } from '../screens/ActivityMessagesScreen';
import { ActivityThreadScreen } from '../screens/ActivityThreadScreen';
import { ActivityPlanJoinScreen } from '../screens/ActivityPlanJoinScreen';
import { ActivityShareScreen } from '../screens/ActivityShareScreen';
import { ActivityShareComposerScreen } from '../screens/ActivityShareComposerScreen';
import { TrailReviewScreen } from '../screens/TrailReviewScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { JournalScreen } from '../screens/JournalScreen';
import { ProfileSettingsScreen } from '../screens/ProfileSettingsScreen';
import { RecommendationPreferencesScreen } from '../screens/RecommendationPreferencesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SafetyCenterScreen } from '../screens/SafetyCenterScreen';
import { SearchResultsScreen } from '../screens/SearchResultsScreen';
import { AdvancedFiltersScreen } from '../screens/AdvancedFiltersScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { TrailDraftsScreen } from '../screens/TrailDraftsScreen';
import { MyTrailsScreen } from '../screens/MyTrailsScreen';
import { OfflineDownloadsScreen } from '../screens/OfflineDownloadsScreen';
import { SupportHelpScreen } from '../screens/SupportHelpScreen';
import { ReportIssueScreen } from '../screens/ReportIssueScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import {
  addNotificationResponseListener,
  getInitialNotificationData,
  registerDeviceForPushNotifications,
  type PushNotificationData,
} from '../services/pushNotifications';
import { getNotifications } from '../api/notificationsApi';
import { getSocialFeedItem } from '../api/socialApi';
import type { FeedItem } from '../data/activitySocial';
import type { TrailCompletionDraft } from '../features/trailCompletion/types';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const springScreenTransition = {
  open: TransitionSpecs.TransitionIOSSpec,
  close: TransitionSpecs.TransitionIOSSpec,
};

function getActiveRouteName(state: any): string {
  const route = state?.routes?.[state.index ?? 0];

  if (!route) {
    return 'Unknown';
  }

  if (route.state) {
    return getActiveRouteName(route.state);
  }

  return route.name;
}

function AppTabs() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { t } = useLanguage();

  const tabBarHeight = 65;
  const tabBarBottomGap = 0;
  const focusedTab = getFocusedRouteNameFromRoute(route) ?? 'Explore';
  const hideFloatingNav = focusedTab === 'Map';

  return (
    <View style={styles.tabsRoot}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,

          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
            else if (route.name === 'Explore') iconName = focused ? 'compass' : 'compass-outline';
            else if (route.name === 'Saved') iconName = focused ? 'bookmark' : 'bookmark-outline';
            else if (route.name === 'Activity') iconName = focused ? 'sparkles' : 'sparkles-outline';
            else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
            else iconName = 'ellipse-outline';

            return (
              <View style={{ transform: [{ scale: focused ? 1.12 : 1 }] }}>
                <Ionicons name={iconName} size={focused ? size + 2 : size} color={color} />
              </View>
            );
          },

          tabBarLabel:
            route.name === 'Explore'
              ? t('tabExplore')
              : route.name === 'Saved'
              ? t('tabSaved')
              : route.name === 'Map'
              ? t('tabMap')
              : route.name === 'Activity'
              ? t('tabActivity')
              : t('tabProfile'),

          tabBarActiveTintColor: '#630E13',
          tabBarInactiveTintColor: 'rgba(138,122,106,0.7)',

          tabBarStyle: {
            display: route.name === 'Map' ? 'none' : 'flex',
            position: 'absolute',
            bottom: insets.bottom + tabBarBottomGap,
            left: 20,
            right: 20,
            height: tabBarHeight,
            borderRadius: 36,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },

          tabBarBackground: () => (
            <BlurView
              intensity={80}
              tint="light"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 32,
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.65)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.6)',
                },
              ]}
            />
          ),

          tabBarItemStyle: {
            paddingVertical: 6,
          },

          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
          },
        })}
      >
        <Tab.Screen name="Explore" component={ExploreScreen} />
        <Tab.Screen name="Saved" component={SavedScreen} />
        <Tab.Screen name="Map" component={MapScreen} />
        <Tab.Screen name="Activity" component={ActivityScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      <View
        pointerEvents="none"
        style={[
          styles.tabBarShadow,
          {
            display: hideFloatingNav ? 'none' : 'flex',
            bottom: insets.bottom + tabBarBottomGap - 26,
            height: tabBarHeight,
          },
        ]}
      />

      <Pressable
        onPress={() => navigation.navigate('CreateTrail')}
        style={[
          styles.fabButton,
          {
            display: hideFloatingNav ? 'none' : 'flex',
            bottom: insets.bottom + tabBarBottomGap + tabBarHeight - 10,
          },
        ]}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

function ActiveRecordingWidget({ routeName }: { routeName: string }) {
  const insets = useSafeAreaInsets();
  const { activeSession, activeSessionTrailId, finishedSession } = useTrailTracking();

  if (
    !activeSession ||
    !activeSessionTrailId ||
    finishedSession ||
    activeSession.trailId !== activeSessionTrailId ||
    routeName === 'Recording' ||
    routeName === 'TrailReview'
  ) {
    return null;
  }

  return (
    <Pressable
      style={[styles.activeSessionWidget, { top: Math.max(insets.top + 8, 18) }]}
      onPress={() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Recording', { trailId: activeSession.trailId });
        }
      }}
    >
      <View style={styles.activeSessionIcon}>
        <Ionicons name="radio" size={16} color="#fff" />
      </View>
      <View style={styles.activeSessionCopy}>
        <Text style={styles.activeSessionTitle}>{activeSession.trail?.name ?? 'Live hike in progress'}</Text>
        <Text style={styles.activeSessionSubtitle}>
          {activeSession.isTracking ? 'Tap to get back to the live trail' : 'Paused - tap to resume your hike'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </Pressable>
  );
}

function getPushString(data: PushNotificationData, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return null;
}

function getPushNumber(data: PushNotificationData, keys: string[]): number | null {
  for (const key of keys) {
    const value = data[key];
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getPushEntity(data: PushNotificationData): { type: string | null; id: string | null } {
  const entity = data.entity;

  if (entity && typeof entity === 'object' && !Array.isArray(entity)) {
    const typedEntity = entity as { type?: unknown; id?: unknown };
    return {
      type: typeof typedEntity.type === 'string' ? typedEntity.type : null,
      id: typeof typedEntity.id === 'string' ? typedEntity.id : null,
    };
  }

  return {
    type: getPushString(data, ['entity_type']),
    id: getPushString(data, ['entity_id']),
  };
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

async function openPushNotificationDestination(data: PushNotificationData): Promise<void> {
  if (!navigationRef.isReady()) {
    return;
  }

  const type = getPushString(data, ['type', 'notification_type']);
  const entity = getPushEntity(data);
  const trailId = getPushString(data, ['trail_id']) || (entity.type === 'trail' ? entity.id : null);
  const activityId = getPushString(data, ['activity_id']) || (entity.type === 'activity' ? entity.id : null);
  const reviewId = getPushString(data, ['review_id']) || (entity.type === 'review' ? entity.id : null);
  const conversationId = getPushString(data, ['conversation_id']);
  const navigationSessionId = getPushString(data, ['navigation_session_id']);
  const isNavigationAlert = getPushString(data, ['notification_kind']) === 'navigation_off_track' || Boolean(navigationSessionId);

  if (type === 'sos_alert') {
    if (conversationId) {
      navigationRef.navigate('ActivityThread', {
        conversationId,
        contextType: 'safety',
        contextId: getPushString(data, ['sos_event_id']) ?? (entity.type === 'sos' ? entity.id ?? undefined : undefined),
        contextTitle: getPushString(data, ['title']) ?? 'Emergency SOS',
        contextSubtitle: getPushString(data, ['body']) ?? undefined,
      });
      return;
    }

    navigationRef.navigate('AppTabs', { screen: 'Activity' });
    return;
  }

  if (type === 'danger_alert') {
    if (trailId && (activityId || isNavigationAlert)) {
      navigationRef.navigate('Recording', activityId ? { trailId, activityId } : { trailId });
      return;
    }

    if (trailId) {
      navigationRef.navigate('TrailDetail', { trailId });
      return;
    }

    const latitude = getPushNumber(data, ['latitude', 'lat']);
    const longitude = getPushNumber(data, ['longitude', 'lng']);
    if (latitude != null && longitude != null) {
      navigationRef.navigate('ReportIssue', {
        latitude,
        longitude,
        locationName: getPushString(data, ['title', 'location_name']) ?? 'Danger reported nearby',
      });
      return;
    }

    navigationRef.navigate('AppTabs', { screen: 'Map' });
    return;
  }

  if (type === 'follow') {
    const profileId = getPushString(data, ['user_id', 'profile_id', 'follower_id', 'actor_id']) || (entity.type === 'user' ? entity.id : null);
    if (profileId) {
      navigationRef.navigate('PublicProfile', { profileId });
    }
    return;
  }

  if (type === 'review_like' || type === 'review_comment') {
    if (reviewId) {
      try {
        const feedItem = mapSocialFeedItemToFeedItem(await getSocialFeedItem('review', reviewId));
        if (feedItem.kind === 'recap') {
          navigationRef.navigate('ActivityShare', { draft: recapToDraft(feedItem) });
          return;
        }
      } catch {
        // Fall back to the trail page below.
      }
    }

    if (trailId) {
      navigationRef.navigate('TrailDetail', { trailId });
    }
    return;
  }

  if (type === 'activity_like' || type === 'activity_comment') {
    if (activityId) {
      try {
        const feedItem = mapSocialFeedItemToFeedItem(await getSocialFeedItem('activity', activityId));
        if (feedItem.kind === 'recap') {
          navigationRef.navigate('ActivityShare', { draft: recapToDraft(feedItem) });
          return;
        }
      } catch {
        // Fall back to the activity destination below.
      }
    }

    if (trailId && activityId) {
      navigationRef.navigate('Recording', { trailId, activityId });
      return;
    }

    navigationRef.navigate('AppTabs', { screen: 'Activity' });
    return;
  }

  if (type === 'meetup_invite' || type === 'meetup_join' || type === 'meetup_update') {
    navigationRef.navigate('AppTabs', { screen: 'Activity' });
    return;
  }

  if (type === 'achievement') {
    navigationRef.navigate('AppTabs', { screen: 'Profile' });
  }
}

function PushNotificationBridge({ enabled }: { enabled: boolean }) {
  const handledInitialNotification = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isMounted = true;

    void registerDeviceForPushNotifications().catch((error) => {
      console.warn('[pushNotifications] Failed to register push token:', error);
    });

    const subscription = addNotificationResponseListener((data) => {
      void openPushNotificationDestination(data);
    });

    if (!handledInitialNotification.current) {
      handledInitialNotification.current = true;
      void getInitialNotificationData()
        .then((data) => {
          if (isMounted && data) {
            void openPushNotificationDestination(data);
          }
        })
        .catch((error) => {
          console.warn('[pushNotifications] Failed to read launch notification:', error);
        });
    }

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [enabled]);

  return null;
}

function shouldShowActiveRecordingWidget(routeName: string): boolean {
  return routeName !== 'Recording' && routeName !== 'TrailReview';
}

function NotificationShortcut({ enabled, routeName }: { enabled: boolean; routeName: string }) {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  const visibleRoutes = new Set(['Explore', 'Saved', 'Activity', 'Profile']);
  const shouldRender = enabled && visibleRoutes.has(routeName);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    let isMounted = true;

    void getNotifications({ page: 1, limit: 1 })
      .then((response) => {
        if (isMounted) {
          setUnreadCount(response.unread_count);
        }
      })
      .catch((error) => {
        console.warn('[notifications] Failed to load unread count:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [routeName, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Pressable
      accessibilityLabel={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      accessibilityRole="button"
      onPress={() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Notifications');
        }
      }}
      style={[
        styles.notificationShortcut,
        {
          bottom: insets.bottom + 88,
        },
      ]}
    >
      <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={22} color="#2C2418" />
      {unreadCount > 0 ? (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function AppNavigator() {
  const {
    hasCompletedFirstLoginSetup,
    isAuthenticated,
    isFirstLoginSetupLoading,
    isLoading,
  } = useAuth();
  const [routeName, setRouteName] = useState('Unknown');

  useEffect(() => {
    if (!isAuthenticated || isFirstLoginSetupLoading || hasCompletedFirstLoginSetup || !navigationRef.isReady()) {
      return;
    }

    const activeRoute = getActiveRouteName(navigationRef.getRootState());

    if (activeRoute !== 'SafetyCenter' && activeRoute !== 'RecommendationPreferences') {
      navigationRef.navigate('SafetyCenter', { onboarding: true });
    }
  }, [hasCompletedFirstLoginSetup, isAuthenticated, isFirstLoginSetupLoading, routeName]);

  if (isLoading || (isAuthenticated && isFirstLoginSetupLoading)) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading your session...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setRouteName(getActiveRouteName(navigationRef.getRootState()))}
      onStateChange={() => setRouteName(getActiveRouteName(navigationRef.getRootState()))}
    >
      <View style={styles.navigatorShell}>
        <Stack.Navigator
          initialRouteName={isAuthenticated ? 'AppTabs' : 'Onboarding'}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#F7F7F7' },
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            transitionSpec: springScreenTransition,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="AppTabs" component={AppTabs} />
          <Stack.Screen name="TrailDetail" component={TrailDetailScreen} />
          <Stack.Screen name="TrailAccess" component={TrailAccessScreen} />
          <Stack.Screen name="AllReviews" component={AllReviewsScreen} />
          <Stack.Screen name="TrailMedia" component={TrailMediaScreen} />
          <Stack.Screen name="ActivityMessages" component={ActivityMessagesScreen} />
          <Stack.Screen name="ActivityThread" component={ActivityThreadScreen} />
          <Stack.Screen name="ActivityPlanJoin" component={ActivityPlanJoinScreen} />
          <Stack.Screen name="ActivityShare" component={ActivityShareScreen} />
          <Stack.Screen name="ActivityShareComposer" component={ActivityShareComposerScreen} />
          <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
          <Stack.Screen name="RecommendationPreferences" component={RecommendationPreferencesScreen} />
          <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
          <Stack.Screen name="CreateTrail" component={CreateTrailScreen} />
          <Stack.Screen name="Recording" component={RecordingScreen} />
          <Stack.Screen name="OngoingActivities" component={OngoingActivitiesScreen} />
          <Stack.Screen name="TrailReview" component={TrailReviewScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Journal" component={JournalScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="SafetyCenter" component={SafetyCenterScreen} />
          <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
          <Stack.Screen name="AdvancedFilters" component={AdvancedFiltersScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="TrailDrafts" component={TrailDraftsScreen} />
          <Stack.Screen name="MyTrails" component={MyTrailsScreen} />
          <Stack.Screen name="SupportHelp" component={SupportHelpScreen} />
          <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="OfflineDownloads" component={OfflineDownloadsScreen} />
        </Stack.Navigator>

        <ActiveRecordingWidget routeName={routeName} />
        <NotificationShortcut enabled={isAuthenticated} routeName={routeName} />
        <PushNotificationBridge enabled={isAuthenticated} />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
  },
  navigatorShell: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE2CC',
  },
  loadingText: {
    color: '#2C2418',
    fontSize: 16,
    fontWeight: '700',
  },
  tabBarShadow: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 32,
    backgroundColor: 'transparent',
    shadowColor: '#2C1A0E',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 25,
    elevation: 15,
  },
  fabButton: {
    position: 'absolute',
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 28,
    backgroundColor: '#630E13',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#f7f6f3',
  },
  activeSessionWidget: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(38,20,12,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  activeSessionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  activeSessionCopy: {
    flex: 1,
  },
  activeSessionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  activeSessionSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
  },
  notificationShortcut: {
    position: 'absolute',
    right: 16,
    zIndex: 60,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.12)',
    shadowColor: '#2C1A0E',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 9,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B1E1E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
