import type { NavigatorScreenParams } from '@react-navigation/native';
import type { TrailCompletionDraft } from '../features/trailCompletion/types';
import type { FeedItem } from '../data/activitySocial';
import type { GeneratedTrailSuggestion } from '../api/trailsApi';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: { mode?: 'signin' | 'signup' } | undefined;
  ForgotPassword: { email?: string } | undefined;
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  TrailDetail: { trailId: string };
  TrailAccess: { trailId: string; trailName?: string; canEditTrailhead?: boolean };
  AllReviews: { trailId: string; trailName: string };
  TrailMedia: { trailId: string };
  ActivityMessages: undefined;
  ActivityThread: {
    conversationId?: string;
    threadId?: string;
    friendId?: string;
    participantId?: string;
    participantName?: string;
    participantAvatar?: string | null;
    contextType?: 'direct' | 'meetup' | 'trail' | 'activity' | 'safety' | 'profile' | 'photo' | 'review';
    contextId?: string;
    contextTitle?: string;
    contextSubtitle?: string;
    initialMessage?: string;
  };
  ActivityPlanJoin: { plan: Extract<FeedItem, { kind: 'plan' }> };
  ActivityShare: { draft?: TrailCompletionDraft } | undefined;
  ActivityShareComposer: {
    type: 'photo' | 'plan' | 'locationMedia';
    trailId?: string;
    trailName?: string;
    initialMeetingLat?: number;
    initialMeetingLng?: number;
  };
  ProfileSettings: { settingId: string };
  RecommendationPreferences: undefined;
  PublicProfile: { profileId: string };
  CreateTrail: { generatedTrail?: GeneratedTrailSuggestion } | undefined;
  Recording: { trailId: string; activityId?: string };
  OngoingActivities: undefined;
  TrailReview: undefined;
  History: undefined;
  Journal: undefined;
  Notifications: undefined;
  SafetyCenter: undefined;
  SearchResults: { query?: string; mode?: 'trail' | 'people' } | undefined;
  AdvancedFilters: undefined;
  EditProfile: undefined;
  TrailDrafts: undefined;
  MyTrails: undefined;
  SupportHelp: undefined;
  ReportIssue: { latitude?: number; longitude?: number; locationName?: string } | undefined;
  Legal: undefined;
  OfflineDownloads: undefined;
};

export type AppTabParamList = {
  Explore: undefined;
  Saved: undefined;
  Map: { selectedTrailId?: string; mode?: 'singleTrail' } | undefined;
  Activity: undefined;
  Profile: undefined;
};
