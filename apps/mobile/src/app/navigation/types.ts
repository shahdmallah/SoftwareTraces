import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: { mode?: 'signin' | 'signup' } | undefined;
  ForgotPassword: { email?: string } | undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  TrailDetail: { trailId: string };
  AllReviews: { trailId: string; trailName: string };
  TrailMedia: { trailId: string };
  ActivityMessages: undefined;
  ActivityThread: { threadId?: string; friendId?: string };
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
  ActivityShareComposer: { type: 'photo' | 'plan' };
  ProfileSettings: { settingId: string };
  CreateTrail: undefined;
  Recording: { trailId: string };
  TrailReview: undefined;
  History: undefined;
};

export type AppTabParamList = {
  Explore: undefined;
  Saved: undefined;
  Map: { selectedTrailId?: string } | undefined;
  Activity: undefined;
  Profile: undefined;
};
