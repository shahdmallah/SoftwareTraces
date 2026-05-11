import type { NavigatorScreenParams } from '@react-navigation/native';
import type { TrailCompletionDraft } from '../features/trailCompletion/types';

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
  ActivityShare: { draft?: TrailCompletionDraft } | undefined;
  ActivityShareComposer: {
    type: 'photo' | 'plan';
    trailId?: string;
    trailName?: string;
    initialMeetingLat?: number;
    initialMeetingLng?: number;
  };
  ProfileSettings: { settingId: string };
  CreateTrail: undefined;
  Recording: { trailId: string };
  TrailReview: undefined;
  History: undefined;
  Journal: undefined;
  Notifications: undefined;
  SearchResults: { query?: string } | undefined;
  AdvancedFilters: undefined;
  EditProfile: undefined;
  TrailDrafts: undefined;
  MyTrails: undefined;
  SupportHelp: undefined;
  ReportIssue: undefined;
  Legal: undefined;
  OfflineDownloads: undefined;
};

export type AppTabParamList = {
  Explore: undefined;
  Saved: undefined;
  Map: { selectedTrailId?: string } | undefined;
  Activity: undefined;
  Profile: undefined;
};
