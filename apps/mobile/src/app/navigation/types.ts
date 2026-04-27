import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: { mode?: 'signin' | 'signup' } | undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  TrailDetail: { trailId: string };
  TrailMedia: { trailId: string };
  ActivityMessages: undefined;
  ActivityShare:
    | {
        draft?: {
          trailName: string;
          rating: number;
          review: string;
          photoUris: string[];
        };
      }
    | undefined;
  CreateTrail: undefined;
  Recording: { trailId: string };
  TrailReview: undefined;
};

export type AppTabParamList = {
  Explore: undefined;
  Saved: undefined;
  Map: { selectedTrailId?: string } | undefined;
  Activity: undefined;
  Profile: undefined;
};
