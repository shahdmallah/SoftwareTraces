import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
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
import { RecordingScreen } from '../screens/RecordingScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';


const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

const springScreenTransition = {
  open: TransitionSpecs.TransitionIOSSpec,
  close: TransitionSpecs.TransitionIOSSpec,
};

function AppTabs() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();

  return (
    <View style={styles.tabsRoot}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Map') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Explore') {
              iconName = focused ? 'compass' : 'compass-outline';
            } else if (route.name === 'Saved') {
              iconName = focused ? 'bookmark' : 'bookmark-outline';
            } else if (route.name === 'Activity') {
              iconName = focused ? 'sparkles' : 'sparkles-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            } else {
              iconName = 'ellipse-outline';
            }

            return (
              <View style={{ transform: [{ scale: focused ? 1.08 : 1 }] }}>
                <Ionicons name={iconName} size={focused ? size + 1 : size} color={color} />
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
          tabBarInactiveTintColor: '#8A7A6A',
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            height: 64 + insets.bottom,
            paddingBottom: Math.max(10, insets.bottom),
            paddingTop: 10,
            borderTopWidth: 0,
            backgroundColor: 'rgba(234,226,204,0.96)',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowOffset: { width: 0, height: -6 },
            shadowRadius: 18,
            elevation: 10,
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

      <Pressable
        style={[styles.fabButton, { bottom: Math.max(insets.bottom + 46, 54) }]}
        onPress={() => navigation.navigate('Recording')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Onboarding"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#EAE2CC' },
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
        <Stack.Screen name="Recording" component={RecordingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
  },
  fabButton: {
    position: 'absolute',
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 25,
    backgroundColor: '#630E13',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#EAE2CC',
  },
});
