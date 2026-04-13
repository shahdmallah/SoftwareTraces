import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  TrailDetail: { trailId: string };
  Recording: undefined;
};

export type AppTabParamList = {
  Explore: undefined;
  Saved: undefined;
  Map: { selectedTrailId?: string } | undefined;
  Activity: undefined;
  Profile: undefined;
};
