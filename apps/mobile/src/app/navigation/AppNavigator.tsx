import React, { useState } from 'react';
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
import { ActivityScreen } from '../screens/ActivityScreen';
import { MapScreen } from '../screens/MapScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TrailDetailScreen } from '../screens/TrailDetailScreen';
import { TrailMediaScreen } from '../screens/TrailMediaScreen';
import { RecordingScreen } from '../screens/RecordingScreen';
import { CreateTrailScreen } from '../screens/CreateTrailScreen';
import { ActivityMessagesScreen } from '../screens/ActivityMessagesScreen';
import { ActivityShareScreen } from '../screens/ActivityShareScreen';
import { TrailReviewScreen } from '../screens/TrailReviewScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTrailTracking } from '../contexts/TrailTrackingContext';

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

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [routeName, setRouteName] = useState('Unknown');

  if (isLoading) {
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
          <Stack.Screen name="AppTabs" component={AppTabs} />
          <Stack.Screen name="TrailDetail" component={TrailDetailScreen} />
          <Stack.Screen name="TrailMedia" component={TrailMediaScreen} />
          <Stack.Screen name="ActivityMessages" component={ActivityMessagesScreen} />
          <Stack.Screen name="ActivityShare" component={ActivityShareScreen} />
          <Stack.Screen name="CreateTrail" component={CreateTrailScreen} />
          <Stack.Screen name="Recording" component={RecordingScreen} />
          <Stack.Screen name="TrailReview" component={TrailReviewScreen} />
        </Stack.Navigator>

        <ActiveRecordingWidget routeName={routeName} />
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
});
