import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../features/auth/store/authStore";
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from "../types/navigation";
import LoginScreen from "../features/auth/screens/LoginScreen";
import SignUpScreen from "../features/auth/screens/SignUpScreen";
import MapScreen from "../features/trails/screens/MapScreen";
import ExploreScreen from "../features/trails/screens/ExploreScreen";
import OfflineMapsScreen from "../features/trails/screens/OfflineMapsScreen";
import RecordingScreen from "../features/recording/screens/RecordingScreen";
import HistoryScreen from "../features/activities/screens/HistoryScreen";
import ProfileScreen from "../features/profile/screens/ProfileScreen";
import TrailDetailScreen from "../features/trails/screens/TrailDetailScreen";
import ActivityDetailScreen from "../features/activities/screens/ActivityDetailScreen";
import { appTheme } from "../constants/theme";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator(): JSX.Element {
  return (
    <AuthStack.Navigator screenOptions={{ headerStyle: { backgroundColor: appTheme.colors.pine }, headerTintColor: "white" }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs(): JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: appTheme.colors.pine },
        headerTintColor: "white",
        tabBarActiveTintColor: appTheme.colors.pine,
        tabBarStyle: { backgroundColor: appTheme.colors.mist }
      }}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Offline" component={OfflineMapsScreen} />
      <Tab.Screen name="Record" component={RecordingScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator(): JSX.Element {
  const hydrate = useAuthStore((state) => state.hydrate);
  const session = useAuthStore((state) => state.session);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={appTheme.colors.pine} />
        <Text style={{ marginTop: 12 }}>Loading Traces...</Text>
      </View>
    );
  }

  return (
    <RootStack.Navigator>
      {!session ? (
        <RootStack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <RootStack.Screen name="TrailDetail" component={TrailDetailScreen} options={{ title: "Trail Details" }} />
          <RootStack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ title: "Activity Details" }} />
        </>
      )}
    </RootStack.Navigator>
  );
}
