import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Vibration,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useLanguage, TranslationKey } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMyAchievements, type UserAchievement } from '../api/achievementsApi';
import { getMyActivities, type Activity } from '../api/activitiesApi';
import { getProfile, getProfilePhotos, getProfileReviews, type Profile, type ProfilePhoto, type ProfileReview } from '../api/profilesApi';
import { getFollowers, getFollowing, getMyFriends, type SocialProfile } from '../api/socialApi';

const PROFILE_FONT = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' }) as string;
const PROFILE_FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: PROFILE_FONT }) as string;

type SettingItem = {
  id: string;
  icon: string;
  labelKey: TranslationKey;
  subtitleKey?: TranslationKey;
  badge?: number;
};

type ProfileLinkItem = {
  id: 'myTrails' | 'trailDrafts' | 'offlineDownloads' | 'ongoingActivities' | 'history' | 'journal';
  icon: string;
  labelKey?: TranslationKey;
  labelEn?: string;
  labelAr?: string;
  subtitleEn: string;
  subtitleAr: string;
  route: 'MyTrails' | 'TrailDrafts' | 'OfflineDownloads' | 'OngoingActivities' | 'History' | 'Journal';
};

const settings: SettingItem[] = [
  { id: 's5', icon: 'settings-outline', labelKey: 'settingGeneral' },
];

const profileLinks: ProfileLinkItem[] = [
  {
    id: 'myTrails',
    icon: 'trail-sign-outline',
    labelEn: 'My trails',
    labelAr: 'مساراتي',
    subtitleEn: 'Manage public and private trails you created',
    subtitleAr: 'إدارة المسارات المنشورة التي أنشأتها',
    route: 'MyTrails',
  },
  {
    id: 'trailDrafts',
    icon: 'create-outline',
    labelEn: 'Trail drafts',
    labelAr: 'مسودات المسارات',
    subtitleEn: 'Finish, publish, or delete draft trails',
    subtitleAr: 'أكمل المسودات أو انشرها أو احذفها',
    route: 'TrailDrafts',
  },
  {
    id: 'offlineDownloads',
    icon: 'cloud-download-outline',
    labelEn: 'Offline downloads',
    labelAr: 'تنزيلات بلا إنترنت',
    subtitleEn: 'Maps and sync tools for low-signal hikes',
    subtitleAr: 'خرائط ومزامنة للرحلات دون اتصال قوي',
    route: 'OfflineDownloads',
  },
  {
    id: 'ongoingActivities',
    icon: 'radio-outline',
    labelEn: 'Ongoing activities',
    labelAr: 'الأنشطة الجارية',
    subtitleEn: 'Resume or close active trail recordings',
    subtitleAr: 'تابع أو أغلق تسجيلات المسارات المفتوحة',
    route: 'OngoingActivities',
  },
  {
    id: 'history',
    icon: 'time-outline',
    labelKey: 'activityHistory',
    subtitleEn: 'Review completed hikes and monthly stats',
    subtitleAr: 'راجع الرحلات المكتملة وإحصاءات الشهر',
    route: 'History',
  },
  {
    id: 'journal',
    icon: 'journal-outline',
    labelKey: 'activityJournal',
    subtitleEn: 'Open your saved trail notes',
    subtitleAr: 'افتح ملاحظات الرحلات المحفوظة',
    route: 'Journal',
  },
];

const achievementIconsByCategory = {
  beginner: 'flag-outline',
  distance: 'walk-outline',
  elevation: 'triangle-outline',
  exploration: 'compass-outline',
  heritage: 'library-outline',
  regional: 'map-outline',
  nature: 'leaf-outline',
  social: 'people-outline',
} as const;

type AchievementCategory = keyof typeof achievementIconsByCategory;

type AchievementDefinition = {
  key: string;
  codeHints: string[];
  name: string;
  nameAr: string;
  requirement: string;
  requirementAr: string;
  points: number;
  category: AchievementCategory;
};

const achievementDefinitions: AchievementDefinition[] = [
  {
    key: 'footprints-on-the-land',
    codeHints: ['footprints_on_the_land', 'footprints-on-the-land', 'complete_1_trail', 'first_trail'],
    name: 'Footprints on the Land',
    nameAr: 'أثر على الأرض',
    requirement: 'Complete 1 trail',
    requirementAr: 'أكمل مسارا واحدا',
    points: 10,
    category: 'beginner',
  },
  {
    key: 'between-the-olive-trees',
    codeHints: ['between_the_olive_trees', 'between-the-olive-trees', 'walk_100_km', 'distance_100'],
    name: 'Between the Olive Trees',
    nameAr: 'بين الزيتون',
    requirement: 'Walk 100 km',
    requirementAr: 'امش 100 كم',
    points: 100,
    category: 'distance',
  },
  {
    key: 'across-palestine',
    codeHints: ['across_palestine', 'across-palestine', 'walk_500_km', 'distance_500'],
    name: 'Across Palestine',
    nameAr: 'عبر فلسطين',
    requirement: 'Walk 500 km',
    requirementAr: 'امش 500 كم',
    points: 250,
    category: 'distance',
  },
  {
    key: 'sumud',
    codeHints: ['sumud', 'walk_1000_km', 'distance_1000'],
    name: 'Sumud',
    nameAr: 'صمود',
    requirement: 'Walk 1000 km',
    requirementAr: 'امش 1000 كم',
    points: 500,
    category: 'distance',
  },
  {
    key: 'friend-of-the-mountain',
    codeHints: ['friend_of_the_mountain', 'friend-of-the-mountain', 'mountain_25'],
    name: 'Friend of the Mountain',
    nameAr: 'صديق الجبل',
    requirement: 'Complete 25 mountain trails',
    requirementAr: 'أكمل 25 مسارا جبليا',
    points: 125,
    category: 'elevation',
  },
  {
    key: 'peak-seeker',
    codeHints: ['peak_seeker', 'peak-seeker', 'summits_10'],
    name: 'Peak Seeker',
    nameAr: 'صائد القمم',
    requirement: 'Reach 10 summits',
    requirementAr: 'اصعد 10 قمم',
    points: 150,
    category: 'elevation',
  },
  {
    key: 'pathfinder',
    codeHints: ['pathfinder', 'unique_trails_50', 'trails_50'],
    name: 'Pathfinder',
    nameAr: 'دليل الدروب',
    requirement: 'Complete 50 unique trails',
    requirementAr: 'أكمل 50 مسارا مختلفا',
    points: 200,
    category: 'exploration',
  },
  {
    key: 'child-of-the-land',
    codeHints: ['child_of_the_land', 'child-of-the-land', 'all_governorates', 'regions_visited'],
    name: 'Child of the Land',
    nameAr: 'ابن الأرض',
    requirement: 'Visit every governorate',
    requirementAr: 'زر كل المحافظات',
    points: 300,
    category: 'exploration',
  },
  {
    key: 'guardian-of-stories',
    codeHints: ['guardian_of_stories', 'guardian-of-stories', 'heritage_1'],
    name: 'Guardian of Stories',
    nameAr: 'حارس الحكايات',
    requirement: 'Complete 1 heritage trail',
    requirementAr: 'أكمل مسارا تراثيا واحدا',
    points: 100,
    category: 'heritage',
  },
  {
    key: 'walker-of-ancient-paths',
    codeHints: ['walker_of_ancient_paths', 'walker-of-ancient-paths', 'heritage_5'],
    name: 'Walker of Ancient Paths',
    nameAr: 'سالك الدروب القديمة',
    requirement: 'Complete 5 heritage trails',
    requirementAr: 'أكمل 5 مسارات تراثية',
    points: 150,
    category: 'heritage',
  },
  ...[
    ['path-of-the-shepherds', 'Path of the Shepherds', 'درب الرعاة', 'Tubas'],
    ['walker-of-the-valley', 'Walker of the Valley', 'سالك الأغوار', 'Jericho'],
    ['keeper-of-the-vineyards', 'Keeper of the Vineyards', 'حارس الكروم', 'Hebron'],
    ['star-of-bethlehem', 'Star of Bethlehem', 'نجمة بيت لحم', 'Bethlehem'],
    ['plains-wanderer', 'Plains Wanderer', 'رحالة السهول', 'Jenin'],
    ['citrus-trailblazer', 'Citrus Trailblazer', 'رائد دروب الحمضيات', 'Tulkarm'],
    ['orchard-explorer', 'Orchard Explorer', 'مستكشف البساتين', 'Qalqilya'],
    ['olive-highlands', 'Olive Highlands', 'مرتفعات الزيتون', 'Salfit'],
    ['hills-of-ramallah', 'Hills of Ramallah', 'تلال رام الله', 'Ramallah'],
    ['between-gerizim-and-ebal', 'Between Gerizim and Ebal', 'بين جرزيم وعيبال', 'Nablus'],
  ].map(([key, name, nameAr, governorate]) => ({
    key,
    codeHints: [key, key.replace(/-/g, '_'), `5_trails_${governorate.toLowerCase()}`, governorate.toLowerCase()],
    name,
    nameAr,
    requirement: `5 trails in ${governorate}`,
    requirementAr: `5 مسارات في ${governorate}`,
    points: 50,
    category: 'regional' as const,
  })),
  {
    key: 'keeper-of-the-springs',
    codeHints: ['keeper_of_the_springs', 'keeper-of-the-springs', 'springs_5'],
    name: 'Keeper of the Springs',
    nameAr: 'حارس الينابيع',
    requirement: 'Visit 5 springs',
    requirementAr: 'زر 5 ينابيع',
    points: 75,
    category: 'nature',
  },
  {
    key: 'valley-wanderer',
    codeHints: ['valley_wanderer', 'valley-wanderer', 'valleys_10'],
    name: 'Valley Wanderer',
    nameAr: 'رحالة الأودية',
    requirement: 'Visit 10 valleys',
    requirementAr: 'زر 10 أودية',
    points: 100,
    category: 'nature',
  },
  {
    key: 'anemone-seeker',
    codeHints: ['anemone_seeker', 'anemone-seeker', 'wildflower_season'],
    name: 'Anemone Seeker',
    nameAr: 'باحث شقائق النعمان',
    requirement: 'Visit trails during wildflower season',
    requirementAr: 'زر المسارات في موسم شقائق النعمان',
    points: 100,
    category: 'nature',
  },
  {
    key: 'voice-of-the-trail',
    codeHints: ['voice_of_the_trail', 'voice-of-the-trail', 'first_review', 'reviews_1'],
    name: 'Voice of the Trail',
    nameAr: 'صوت الدرب',
    requirement: 'Write first review',
    requirementAr: 'اكتب أول مراجعة',
    points: 15,
    category: 'social',
  },
  {
    key: 'memory-collector',
    codeHints: ['memory_collector', 'memory-collector', 'first_photo', 'photos_1'],
    name: 'Memory Collector',
    nameAr: 'جامع الذكريات',
    requirement: 'Upload first trail photo',
    requirementAr: 'ارفع أول صورة لمسار',
    points: 15,
    category: 'social',
  },
  {
    key: 'companion-of-the-trail',
    codeHints: ['companion_of_the_trail', 'companion-of-the-trail', 'first_meetup', 'meetups_joined_1'],
    name: 'Companion of the Trail',
    nameAr: 'رفيق الدرب',
    requirement: 'Join first meetup',
    requirementAr: 'انضم إلى أول لقاء',
    points: 25,
    category: 'social',
  },
  {
    key: 'community-builder',
    codeHints: ['community_builder', 'community-builder', 'host_5_meetups', 'meetups_hosted_5'],
    name: 'Community Builder',
    nameAr: 'باني المجتمع',
    requirement: 'Host 5 meetups',
    requirementAr: 'استضف 5 لقاءات',
    points: 150,
    category: 'social',
  },
];

type ProfileAchievement = {
  id: string;
  name: string;
  nameAr: string;
  requirement: string;
  requirementAr: string;
  earned: boolean;
  progress?: number;
  progressCurrent?: number;
  progressTarget?: number;
  points: number;
  icon: string;
  category: AchievementCategory;
};

function normalizeAchievementKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getAchievementTarget(achievement: UserAchievement): number {
  const criteria = achievement.criteria_value ?? {};
  const target = Number(
    achievement.progress_target ??
      criteria.target ??
      criteria.value ??
      criteria.count ??
      criteria.kilometers ??
      criteria.distance_km ??
      criteria.total ??
      0,
  );
  return Number.isFinite(target) ? target : 0;
}

function getAchievementProgress(achievement: UserAchievement): { percent: number; current: number; target: number } {
  const target = getAchievementTarget(achievement);
  const current = Number(achievement.progress_current ?? 0);
  if (typeof achievement.progress === 'number') {
    return {
      percent: Math.max(0, Math.min(100, achievement.progress)),
      current: Number.isFinite(current) ? current : 0,
      target,
    };
  }

  const safeCurrent = Number.isFinite(current) ? current : 0;
  const percent = target > 0 ? (safeCurrent / target) * 100 : achievement.earned || achievement.earned_at ? 100 : 0;
  return {
    percent: Math.max(0, Math.min(100, percent)),
    current: safeCurrent,
    target,
  };
}

function formatProfileCount(value: number | null | undefined): string {
  const safeValue = Math.max(0, Number(value ?? 0));
  if (!Number.isFinite(safeValue)) return '0';
  if (safeValue >= 1000000) return `${(safeValue / 1000000).toFixed(safeValue >= 10000000 ? 0 : 1)}M`;
  if (safeValue >= 1000) return `${(safeValue / 1000).toFixed(safeValue >= 10000 ? 0 : 1)}K`;
  return String(Math.round(safeValue));
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
}

function buildProfileAchievements(backendAchievements: UserAchievement[]): ProfileAchievement[] {
  const byKey = new Map<string, UserAchievement>();

  for (const achievement of backendAchievements) {
    [
      achievement.code,
      achievement.name,
      achievement.name_ar,
      achievement.title,
      achievement.id,
    ].forEach((candidate) => {
      const normalized = normalizeAchievementKey(candidate);
      if (normalized) byKey.set(normalized, achievement);
    });
  }

  const mapped = achievementDefinitions.map((definition) => {
    const backend = definition.codeHints
      .map(normalizeAchievementKey)
      .map((key) => byKey.get(key))
      .find(Boolean);
    const progress = backend ? getAchievementProgress(backend) : { percent: 0, current: 0, target: 0 };
    return {
      id: backend?.id ?? definition.key,
      name: backend?.name || backend?.title || definition.name,
      nameAr: backend?.name_ar || definition.nameAr,
      requirement: backend?.description || definition.requirement,
      requirementAr: backend?.description_ar || definition.requirementAr,
      earned: Boolean(backend?.earned || backend?.earned_at),
      progress: progress.percent,
      progressCurrent: progress.current,
      progressTarget: progress.target || undefined,
      points: backend?.points ?? definition.points,
      icon: achievementIconsByCategory[definition.category],
      category: definition.category,
    };
  });

  const knownIds = new Set(mapped.map((achievement) => achievement.id));
  const extras = backendAchievements
    .filter((achievement) => !knownIds.has(achievement.id))
    .map((achievement) => {
      const progress = getAchievementProgress(achievement);
      return {
        id: achievement.id,
        name: achievement.name || achievement.title || 'Achievement',
        nameAr: achievement.name_ar || achievement.name || achievement.title || 'Achievement',
        requirement: achievement.description || '',
        requirementAr: achievement.description_ar || achievement.description || '',
        earned: Boolean(achievement.earned || achievement.earned_at),
        progress: progress.percent,
        progressCurrent: progress.current,
        progressTarget: progress.target || undefined,
        points: achievement.points ?? 0,
        icon: 'ribbon-outline',
        category: 'social' as const,
      };
    });

  return [...mapped, ...extras];
}

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;
type SocialListType = 'friends' | 'followers' | 'following';

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, signOut, user } = useAuth();
  const isArabic = language === 'ar';
  const insets = useSafeAreaInsets();
  const heroTopPadding = Math.max(insets.top -8, 32);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReviews, setProfileReviews] = useState<ProfileReview[]>([]);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [socialListType, setSocialListType] = useState<SocialListType>('friends');
  const [friendsList, setFriendsList] = useState<SocialProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const displayName = profile?.full_name?.trim() || user?.full_name?.trim() || user?.email || '';
  const avatarText = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (!user?.id) {
        setProfile(null);
        setProfileReviews([]);
        setProfilePhotos([]);
        setAchievements([]);
        setActivities([]);
        setFriendsList([]);
        setFriendsVisible(false);
        setProfileError('');
        setIsProfileLoading(false);
        return () => { cancelled = true; };
      }

      const loadProfileData = async () => {
        setIsProfileLoading(true);
        setProfileError('');

        const fallbackStats = {
          total_reviews: 0,
          total_photos: 0,
          total_likes_received: 0,
          total_followers: 0,
          total_following: 0,
          total_friends: 0,
          friends_count: 0,
          total_points: 0,
          achievements_count: 0,
        };
        const fallbackProfile: Profile = {
          id: user.id,
          user_id: user.id,
          full_name: user.full_name || user.email,
          avatar_url: user.avatar_url ?? null,
          bio: user.bio ?? null,
          location: user.location ?? null,
          stats: fallbackStats,
        };

        try {
          const [userAchievements, userActivities, loadedProfile] = await Promise.all([
            getMyAchievements().catch(() => [] as UserAchievement[]),
            getMyActivities({ page: 1, limit: 50 }).catch(() => [] as Activity[]),
            getProfile(user.id),
          ]);

          const nextProfile: Profile = {
            ...fallbackProfile,
            ...(loadedProfile ?? {}),
            full_name: loadedProfile?.full_name || fallbackProfile.full_name,
            avatar_url: loadedProfile?.avatar_url ?? fallbackProfile.avatar_url,
            bio: loadedProfile?.bio ?? fallbackProfile.bio,
            location: loadedProfile?.location ?? fallbackProfile.location,
            stats: { ...fallbackStats, ...(loadedProfile?.stats ?? {}) },
          };
          const profileLookupId = nextProfile.user_id || nextProfile.id || user.id;
          const [loadedReviews, loadedPhotos] = await Promise.all([
            getProfileReviews(profileLookupId, { page: 1, limit: 20 }).catch(() => nextProfile.recent_reviews ?? []),
            getProfilePhotos(profileLookupId, { page: 1, limit: 20 }).catch(() => nextProfile.recent_photos ?? []),
          ]);
          const nextReviews = loadedReviews.length ? loadedReviews : nextProfile.recent_reviews ?? [];
          const nextPhotos = loadedPhotos.length ? loadedPhotos : nextProfile.recent_photos ?? [];

          if (!cancelled) {
            setProfile(nextProfile);
            setProfileReviews(nextReviews);
            setProfilePhotos(nextPhotos);
            setAchievements(buildProfileAchievements(userAchievements));
            setActivities(userActivities);
            setProfileError('');
          }
        } catch (error) {
          if (!cancelled) {
            setProfile(fallbackProfile);
            setProfileReviews([]);
            setProfilePhotos([]);
            setAchievements([]);
            setActivities([]);
            setProfileError(error instanceof Error ? error.message : 'Unable to load profile data.');
          }
        } finally {
          if (!cancelled) setIsProfileLoading(false);
        }
      };

      void loadProfileData();
      return () => { cancelled = true; };
    }, [user?.id, user?.full_name, user?.email, user?.avatar_url, user?.bio, user?.location]),
  );

  const earnedCount = achievements.filter((a) => a.earned).length;
  const progress = achievements.length ? (earnedCount / achievements.length) * 100 : 0;
  const nextAchievement = achievements.find((a) => !a.earned);
  const followerCount = profile?.stats?.total_followers ?? 0;
  const followingCount = profile?.stats?.total_following ?? 0;
  const friendCount = Math.max(profile?.stats?.total_friends ?? 0, profile?.stats?.friends_count ?? 0);
  const socialListTitle =
    socialListType === 'friends'
      ? isArabic ? '\u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621' : 'Friends'
      : socialListType === 'followers'
      ? isArabic ? '\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0648\u0646' : 'Followers'
      : isArabic ? '\u064a\u062a\u0627\u0628\u0639' : 'Following';
  const socialListCount =
    socialListType === 'friends' ? friendCount : socialListType === 'followers' ? followerCount : followingCount;
  const socialListEmpty =
    socialListType === 'friends'
      ? isArabic ? '\u0644\u0627 \u064a\u0648\u062c\u062f \u0623\u0635\u062f\u0642\u0627\u0621 \u0628\u0639\u062f.' : 'No friends yet.'
      : socialListType === 'followers'
      ? isArabic ? '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062a\u0627\u0628\u0639\u0648\u0646 \u0628\u0639\u062f.' : 'No followers yet.'
      : isArabic ? '\u0644\u0627 \u062a\u062a\u0627\u0628\u0639 \u0623\u062d\u062f\u0627 \u0628\u0639\u062f.' : 'Not following anyone yet.';
  const reviewCount = Math.max(profile?.stats?.total_reviews ?? 0, profileReviews.length);
  const photoCount = Math.max(profile?.stats?.total_photos ?? 0, profilePhotos.length);
  const likesCount = Math.max(
    profile?.stats?.total_likes_received ?? 0,
    profileReviews.reduce((sum, review) => sum + (review.likes_count ?? 0), 0),
  );
  const avatarUrl = profile?.avatar_url?.trim() || user?.avatar_url?.trim() || '';
  const bioText = profile?.bio?.trim() || user?.bio?.trim() || '';
  const locationText = profile?.location?.trim() || user?.location?.trim() || t('profileLocation');
  const totalDurationHours = useMemo(() => {
    return activities.reduce((sum, activity) => {
      if (!activity.started_at || !activity.ended_at) return sum;
      const started = new Date(activity.started_at).getTime();
      const ended = new Date(activity.ended_at).getTime();
      if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return sum;
      return sum + (ended - started) / 3600000;
    }, 0);
  }, [activities]);

  const triggerFeedback = (pattern?: number | number[]) => {
    Vibration.vibrate(pattern ?? 10);
  };

  const handleAchievementPress = (achievement: ProfileAchievement) => {
    triggerFeedback(achievement.earned ? 10 : 20);
  };

  const handleSettingPress = (setting: SettingItem) => {
    triggerFeedback(10);
    navigation.navigate('ProfileSettings', { settingId: setting.id });
  };

  const handleProfileLinkPress = (item: ProfileLinkItem) => {
    triggerFeedback(10);
    navigation.navigate(item.route);
  };

  const handleOpenSocialList = async (type: SocialListType) => {
    triggerFeedback(10);
    const targetProfileId = profile?.id || profile?.user_id || user?.id;
    if (!targetProfileId) return;
    setSocialListType(type);
    setFriendsVisible(true);
    setFriendsLoading(true);
    setFriendsError('');
    setFriendsList([]);
    try {
      const response =
        type === 'friends'
          ? await getMyFriends({ page: 1, limit: 80 })
          : type === 'followers'
          ? await getFollowers(targetProfileId, { page: 1, limit: 80 })
          : await getFollowing(targetProfileId, { page: 1, limit: 80 });
      setFriendsList(response.data);
    } catch (error) {
      setFriendsError(error instanceof Error ? error.message : 'Unable to load this list.');
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleOpenFriendProfile = (friend: SocialProfile) => {
    triggerFeedback(10);
    setFriendsVisible(false);
    navigation.navigate('PublicProfile', { profileId: friend.id });
  };

  if (!isAuthenticated || !user) {
    return (
      <AnimatedScreen style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyStateBadge}>
            <Ionicons name="person-outline" size={34} color="white" />
          </View>
          <Text style={[styles.emptyStateTitle, isArabic && styles.textRtl]}>No user logged in</Text>
          <Text style={[styles.emptyStateText, isArabic && styles.textRtl]}>
            Create an account to save trails, track achievements, and personalize your profile.
          </Text>
          <Pressable
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate('Auth', { mode: 'signup' })}
          >
            <Text style={styles.emptyStateButtonText}>Go to Sign Up</Text>
          </Pressable>
        </View>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Hero Header — single unified color card ── */}
        <AnimatedBlock delay={40}>
          <View style={[styles.heroHeader, { paddingTop: heroTopPadding + 42 }]}>
            <View style={[styles.heroCover, { height: heroTopPadding + 170 }]} />

            {/* Edit icon */}
            <Pressable
              style={[styles.editIconBtn, { top: heroTopPadding + 2 }, isArabic && styles.editIconBtnRtl]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="pencil" size={15} color="rgba(255,248,234,0.85)" />
            </Pressable>

            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarRing}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{avatarText}</Text>
                  </View>
                )}
              </View>
              <View style={styles.statusDot} />
              <Pressable style={styles.changePhotoButton} onPress={() => navigation.navigate('EditProfile')}>
                <Ionicons name="camera" size={15} color="white" />
              </Pressable>
            </View>

            {/* Identity */}
            <View style={styles.heroIdentity}>
              <Text style={[styles.heroName, isArabic && styles.textRtl]} numberOfLines={2}>
                {displayName}
              </Text>
              <View style={[styles.heroLocationRow, isArabic && styles.rowReverse]}>
                <Ionicons name="location-outline" size={12} color="#7B6D5A" />
                <Text style={[styles.heroLocation, isArabic && styles.textRtl]} numberOfLines={1}>
                  {locationText}
                </Text>
              </View>
              {bioText ? (
                <Text style={[styles.heroBio, isArabic && styles.textRtl]} numberOfLines={3}>
                  {bioText}
                </Text>
              ) : null}
            </View>

            <View style={[styles.socialStatsInline, isArabic && styles.rowReverse]}>
              {[
                { key: 'friends' as const, value: friendCount, label: isArabic ? '\u0623\u0635\u062f\u0642\u0627\u0621' : 'Friends', icon: 'people-circle-outline' },
                { key: 'followers' as const, value: followerCount, label: isArabic ? '\u0645\u062a\u0627\u0628\u0639\u0648\u0646' : 'Followers', icon: 'people-outline' },
                { key: 'following' as const, value: followingCount, label: isArabic ? '\u064a\u062a\u0627\u0628\u0639' : 'Following', icon: 'person-add-outline' },
              ].map((item, index, arr) => (
                <Pressable
                  key={item.key}
                  onPress={() => handleOpenSocialList(item.key)}
                  style={[
                    styles.socialStatInlineItem,
                    styles.socialStatInlinePressable,
                    index < arr.length - 1 && styles.socialStatInlineDivider,
                  ]}
                >
                  <Ionicons name={item.icon as any} size={17} color="#630E13" />
                  <Text style={styles.socialStatInlineValue} numberOfLines={1}>
                    {formatProfileCount(item.value)}
                  </Text>
                  <Text style={[styles.socialStatInlineLabel, isArabic && styles.textRtl]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </AnimatedBlock>

        {/* ── Main Body Card ── */}
        <View style={styles.bodyCard}>

          {/* Achievements */}
          <AnimatedBlock delay={120}>
            <View style={styles.bodySection}>
              <View style={[styles.bodyRowHeader, isArabic && styles.rowReverse]}>
                <View style={[styles.bodyRowHeaderLeft, isArabic && styles.rowReverse]}>
                  <View style={styles.sectionIconDot}>
                    <Ionicons name="trophy" size={14} color="#D4A843" />
                  </View>
                  <Text style={[styles.bodyTitle, isArabic && styles.textRtl]}>
                    {t('achievementsTitle')}
                  </Text>
                </View>
                <View style={styles.achievementCountPill}>
                  <View style={[styles.achievementCountBar, { width: `${progress}%` }]} />
                  <Text style={styles.achievementCountText}>{earnedCount}/{achievements.length}</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.achievementsRow}
              >
                {achievements.map((achievement) => (
                  <Pressable
                    key={achievement.id}
                    onPress={() => handleAchievementPress(achievement)}
                    style={({ pressed }) => [styles.achCard, !achievement.earned && styles.achCardLocked, pressed && { opacity: 0.8 }]}
                  >
                    <View style={[styles.achIconWrap, achievement.earned ? styles.achIconEarned : styles.achIconLocked]}>
                      <Ionicons
                        name={achievement.icon as any}
                        size={26}
                        color={achievement.earned ? '#FFF8EA' : '#8A7A6A'}
                      />
                      {achievement.earned ? (
                        <View style={styles.achCheck}>
                          <Ionicons name="checkmark" size={9} color="#FFF" />
                        </View>
                      ) : (
                        <View style={styles.achLock}>
                          <Ionicons name="lock-closed" size={10} color="#8A7A6A" />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.achName, isArabic && styles.textRtl]} numberOfLines={2}>
                      {isArabic ? achievement.nameAr : achievement.name}
                    </Text>
                    <Text style={[styles.achPoints, isArabic && styles.textRtl]} numberOfLines={1}>
                      {achievement.points} pts
                    </Text>
                    <View style={styles.achProgressSlot}>
                      {!achievement.earned && achievement.progress !== undefined ? (
                        <View style={styles.achProgressBg}>
                          <View style={[styles.achProgressFill, { width: `${Math.max(0, Math.min(100, achievement.progress))}%` }]} />
                        </View>
                      ) : (
                        <View style={styles.achProgressBgPlaceholder} />
                      )}
                      <Text style={styles.achProgressText}>
                        {!achievement.earned && achievement.progress !== undefined
                          ? `${Math.round(Math.max(0, Math.min(100, achievement.progress)))}%`
                          : ' '}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </AnimatedBlock>

          <View style={styles.bodySectionDivider} />

          {/* Next milestone */}
          {nextAchievement && (
            <AnimatedBlock delay={155}>
              <View style={styles.bodySection}>
                <View style={[styles.milestoneRow, isArabic && styles.rowReverse]}>
                  <View style={styles.milestoneIconWrap}>
                    <Ionicons name={nextAchievement.icon as any} size={28} color="#D4A843" />
                  </View>
                  <View style={styles.milestoneInfo}>
                    <Text style={[styles.milestoneEyebrow, isArabic && styles.textRtl]}>{t('nextMilestone')}</Text>
                    <Text style={[styles.milestoneName, isArabic && styles.textRtl]}>
                      {isArabic ? nextAchievement.nameAr : nextAchievement.name}
                    </Text>
                    <Text style={[styles.milestoneRequirement, isArabic && styles.textRtl]} numberOfLines={2}>
                      {isArabic ? nextAchievement.requirementAr : nextAchievement.requirement}
                    </Text>
                    <View style={styles.milestoneBarWrap}>
                      <View style={styles.milestoneBarBg}>
                        <View style={[styles.milestoneBarFill, { width: `${Math.max(0, Math.min(100, nextAchievement.progress || 0))}%` }]} />
                      </View>
                      <Text style={styles.milestoneBarText}>
                        {Math.round(Math.max(0, Math.min(100, nextAchievement.progress || 0)))}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </AnimatedBlock>
          )}

          <View style={styles.bodySectionDivider} />

          <AnimatedBlock delay={170}>
            <View style={styles.bodySection}>
              {isProfileLoading ? <ActivityIndicator color="#630E13" size="small" /> : null}

              {profileError ? (
                <Text style={[styles.profileErrorText, isArabic && styles.textRtl]}>{profileError}</Text>
              ) : (
                <>
                  <View style={[styles.miniStatsRow, isArabic && styles.rowReverse]}>
                    <Text style={styles.miniStat}>{reviewCount} {isArabic ? 'مراجعات' : 'reviews'}</Text>
                    <Text style={styles.miniStat}>{photoCount} {isArabic ? 'صور' : 'photos'}</Text>
                    <Text style={styles.miniStat}>{likesCount} {isArabic ? 'إعجابات' : 'likes'}</Text>
                  </View>
                  {profilePhotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                      {profilePhotos.slice(0, 8).map((photo) => (
                        <Pressable
                          key={photo.id}
                          style={styles.photoCard}
                          onPress={() => photo.trail_id && navigation.navigate('TrailDetail', { trailId: photo.trail_id })}
                        >
                          <Image source={{ uri: photo.url }} style={styles.photo} />
                          <Text numberOfLines={1} style={styles.photoCaption}>{photo.trail_name ?? photo.caption ?? 'Trail photo'}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                  {profileReviews.slice(0, 2).map((review) => (
                    <Pressable
                      key={review.id}
                      style={styles.reviewCard}
                      onPress={() => navigation.navigate('TrailDetail', { trailId: review.trail.id })}
                    >
                      <Text style={styles.reviewTrail}>{review.trail.name}</Text>
                      <Text numberOfLines={2} style={[styles.reviewText, isArabic && styles.textRtl]}>{review.content}</Text>
                      <Text style={styles.reviewMeta}>{review.rating}/5 · {review.likes_count ?? 0} likes · {review.comments_count ?? 0} comments</Text>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          </AnimatedBlock>

          <View style={styles.bodySectionDivider} />

          {/* Language */}
          <AnimatedBlock delay={180}>
            <View style={styles.bodySection}>
              <View style={[styles.bodyRowHeader, isArabic && styles.rowReverse]}>
                <View style={[styles.bodyRowHeaderLeft, isArabic && styles.rowReverse]}>
                  <View style={styles.sectionIconDot}>
                    <Ionicons name="language-outline" size={14} color="#630E13" />
                  </View>
                  <Text style={[styles.bodyTitle, isArabic && styles.textRtl]}>{t('languageTitle')}</Text>
                </View>
              </View>
              <View style={[styles.langToggle, isArabic && styles.rowReverse]}>
                <Pressable
                  style={[styles.langBtn, language === 'ar' && styles.langBtnActive]}
                  onPress={() => setLanguage('ar')}
                >
                  <Text style={[styles.langBtnText, language === 'ar' && styles.langBtnTextActive]}>
                    {t('languageArabic')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                    {t('languageEnglish')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </AnimatedBlock>

          <View style={styles.bodySectionDivider} />

          {/* Trail workspace */}
          <AnimatedBlock delay={200}>
            <View style={styles.bodySection}>
              <View style={[styles.bodyRowHeader, isArabic && styles.rowReverse]}>
                <View style={[styles.bodyRowHeaderLeft, isArabic && styles.rowReverse]}>
                  <View style={styles.sectionIconDot}>
                    <Ionicons name="trail-sign-outline" size={14} color="#630E13" />
                  </View>
                  <Text style={[styles.bodyTitle, isArabic && styles.textRtl]}>
                    {isArabic ? 'مساحة المسارات' : 'Trail workspace'}
                  </Text>
                </View>
              </View>

              {profileLinks.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleProfileLinkPress(item)}
                  style={({ pressed }) => [
                    styles.linkRow,
                    isArabic && styles.rowReverse,
                    index < profileLinks.length - 1 && styles.linkRowDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={styles.linkIconWrap}>
                    <Ionicons name={item.icon as any} size={17} color="#630E13" />
                  </View>
                  <View style={[styles.linkTextWrap, isArabic && styles.linkTextWrapRtl]}>
                    <Text style={[styles.linkTitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                      {item.labelKey ? t(item.labelKey) : isArabic ? item.labelAr : item.labelEn}
                    </Text>
                    <Text style={[styles.linkSubtitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                      {isArabic ? item.subtitleAr : item.subtitleEn}
                    </Text>
                  </View>
                  <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={15} color="#C4BBA0" />
                </Pressable>
              ))}
            </View>
          </AnimatedBlock>

          <View style={styles.bodySectionDivider} />

          {/* Settings */}
          <AnimatedBlock delay={230}>
            <View style={styles.bodySection}>
              {settings.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSettingPress(item)}
                  style={({ pressed }) => [
                    styles.linkRow,
                    isArabic && styles.rowReverse,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={styles.linkIconWrap}>
                    <Ionicons name={item.icon as any} size={17} color="#630E13" />
                  </View>
                  <View style={[styles.linkTextWrap, isArabic && styles.linkTextWrapRtl]}>
                    <Text style={[styles.linkTitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                      {t(item.labelKey)}
                    </Text>
                    {item.subtitleKey ? (
                      <Text style={[styles.linkSubtitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                        {item.subtitleKey === 'languageCurrent'
                          ? language === 'ar' ? t('languageArabic') : t('languageEnglish')
                          : item.subtitleKey === 'favoritesCount'
                          ? `${item.badge} ${t('items')}`
                          : t(item.subtitleKey)}
                      </Text>
                    ) : null}
                  </View>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={15} color="#C4BBA0" />
                </Pressable>
              ))}
            </View>
          </AnimatedBlock>
        </View>

        {/* ── Logout ── */}
        <AnimatedBlock delay={270}>
          <Pressable
            style={[styles.logoutBtn, isArabic && styles.rowReverse]}
            onPress={() => {
              triggerFeedback([0, 20]);
              signOut();
              navigation.navigate('Auth');
            }}
          >
            <Ionicons name="log-out-outline" size={17} color="#BB2823" />
            <Text style={[styles.logoutText, isArabic && styles.textRtl]}>{t('logout')}</Text>
          </Pressable>
        </AnimatedBlock>

        <Text style={styles.versionText}>Hike time: {totalDurationHours.toFixed(1)}h</Text>
      </ScrollView>

      <Modal
        visible={friendsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFriendsVisible(false)}
      >
        <View style={styles.friendsModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFriendsVisible(false)} />
          <View style={[styles.friendsSheet, { marginBottom: Math.max(insets.bottom, 12) }]}>
            <View style={[styles.friendsSheetHeader, isArabic && styles.rowReverse]}>
              <View style={[styles.friendsSheetTitleWrap, isArabic && styles.friendsSheetTitleWrapRtl]}>
                <Text style={[styles.friendsSheetTitle, isArabic && styles.textRtl]}>
                  {socialListTitle}
                </Text>
                <Text style={[styles.friendsSheetSubtitle, isArabic && styles.textRtl]}>
                  {formatProfileCount(socialListCount)} {socialListTitle.toLowerCase()}
                </Text>
              </View>
              <Pressable style={styles.friendsSheetClose} onPress={() => setFriendsVisible(false)}>
                <Ionicons name="close" size={18} color="#2C2418" />
              </Pressable>
            </View>

            {friendsLoading ? (
              <View style={styles.friendsState}>
                <ActivityIndicator color="#630E13" />
              </View>
            ) : friendsError ? (
              <Text style={[styles.friendsStateText, isArabic && styles.textRtl]}>{friendsError}</Text>
            ) : friendsList.length === 0 ? (
              <Text style={[styles.friendsStateText, isArabic && styles.textRtl]}>
                {socialListEmpty}
              </Text>
            ) : (
              <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
                {friendsList.map((friend, index) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => handleOpenFriendProfile(friend)}
                    style={({ pressed }) => [
                      styles.friendRow,
                      isArabic && styles.rowReverse,
                      index < friendsList.length - 1 && styles.friendRowDivider,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    {friend.avatar_url ? (
                      <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} />
                    ) : (
                      <View style={styles.friendAvatarFallback}>
                        <Text style={styles.friendAvatarText}>{getInitials(friend.full_name)}</Text>
                      </View>
                    )}
                    <Text style={[styles.friendName, isArabic && styles.textRtl]} numberOfLines={1}>
                      {friend.full_name}
                    </Text>
                    <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={15} color="#C4BBA0" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EBE1',
  },
  content: {
    paddingBottom: 40,
  },

  // ── Hero — single unified color ──
  heroHeader: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
    paddingHorizontal: 24,
    paddingBottom: 0,
    alignItems: 'center',
  },
  heroCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#3A070B',
  },
  editIconBtn: {
    position: 'absolute',
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,248,234,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconBtnRtl: {
    right: undefined,
    left: 16,
  },
  avatarWrapper: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 20,
  },
  avatarRing: {
    borderRadius: 999,
    padding: 5,
    backgroundColor: '#FFFDF8',
    borderWidth: 2,
    borderColor: 'rgba(58,7,11,0.18)',
    shadowColor: '#2C2418',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 12,
  },
  avatarCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#C89D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  avatarText: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#FFF8EA',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 1,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4A843',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFDF8',
  },
  statusDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7A9A3A',
    borderWidth: 3,
    borderColor: '#FFFDF8',
  },
  heroIdentity: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroName: {
    fontFamily: PROFILE_FONT_MEDIUM,
    fontSize: 25,
    color: '#2C2418',
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 5,
    textAlign: 'center',
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    maxWidth: '88%',
    marginBottom: 10,
  },
  heroLocation: {
    fontFamily: PROFILE_FONT,
    fontSize: 12,
    color: '#7B6D5A',
    textAlign: 'center',
    flexShrink: 1,
  },
  heroBio: {
    fontFamily: PROFILE_FONT,
    fontSize: 12,
    color: '#5A4F41',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: '90%',
    alignSelf: 'center',
  },

  // Stats strip — tinted on dark bg
  socialStatsInline: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4D8C2',
    backgroundColor: 'rgba(255,253,248,0.72)',
    overflow: 'hidden',
  },
  socialStatInlineItem: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  socialStatInlinePressable: {
    backgroundColor: 'rgba(99,14,19,0.025)',
  },
  socialStatInlineDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E2D8C5',
  },
  socialStatInlineValue: {
    fontFamily: PROFILE_FONT_MEDIUM,
    marginTop: 3,
    color: '#2C2418',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  socialStatInlineLabel: {
    fontFamily: PROFILE_FONT_MEDIUM,
    marginTop: 1,
    color: '#7B6D5A',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  // ── Unified body card ──
  bodyCard: {
    marginHorizontal: 14,
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: '#FFFDF8',
    overflow: 'hidden',
    shadowColor: '#2C2418',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  bodySection: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  bodySectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EDE5D6',
    marginHorizontal: 18,
  },
  bodyRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  bodyRowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconDot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(99,14,19,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyTitle: {
    fontFamily: PROFILE_FONT_MEDIUM,
    fontSize: 15,
    fontWeight: '800',
    color: '#2C2418',
    letterSpacing: 0.1,
  },

  // Achievements
  achievementCountPill: {
    position: 'relative',
    width: 72,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EDE5D6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementCountBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#D4A843',
    borderRadius: 10,
  },
  achievementCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2C2418',
    zIndex: 1,
  },
  achievementsRow: {
    paddingRight: 4,
    gap: 8,
  },
  achCard: {
    width: 86,
    minHeight: 154,
    alignItems: 'center',
    marginRight: 8,
  },
  achCardLocked: {
    opacity: 0.55,
  },
  achIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  achIconEarned: {
    backgroundColor: '#D4A843',
  },
  achIconLocked: {
    backgroundColor: '#D8D0BC',
  },
  achEmoji: {
    fontSize: 26,
  },
  achCheck: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFDF8',
  },
  achLock: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8A7A6A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFDF8',
  },
  achName: {
    textAlign: 'center',
    fontSize: 10,
    color: '#4A4131',
    lineHeight: 13,
    fontWeight: '600',
    height: 28,
    textAlignVertical: 'center',
  },
  achPoints: {
    marginTop: 3,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 11,
    color: '#946200',
    fontWeight: '800',
    height: 12,
  },
  achProgressSlot: {
    width: '100%',
    height: 22,
    marginTop: 5,
    justifyContent: 'flex-start',
  },
  achProgressBg: {
    height: 3,
    backgroundColor: '#EDE5D6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  achProgressBgPlaceholder: {
    height: 3,
  },
  achProgressFill: {
    height: '100%',
    backgroundColor: '#D4A843',
  },
  achProgressText: {
    fontSize: 8,
    color: '#8A7A6A',
    textAlign: 'center',
    marginTop: 2,
  },

  // Next milestone
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FBF5E8',
    borderRadius: 16,
    padding: 14,
  },
  milestoneIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7DDCB',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#630E13',
    marginBottom: 3,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2418',
    marginBottom: 3,
  },
  milestoneRequirement: {
    fontSize: 11,
    color: '#7B6D5A',
    lineHeight: 15,
    marginBottom: 8,
  },
  milestoneBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: '#E8E0D0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  milestoneBarFill: {
    height: '100%',
    backgroundColor: '#D4A843',
    borderRadius: 3,
  },
  milestoneBarText: {
    fontSize: 10,
    color: '#8A7A6A',
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'right',
  },

  profileErrorText: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#8B1E1E',
    fontSize: 13,
    fontWeight: '700',
  },
  miniStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 2,
  },
  miniStat: {
    fontFamily: PROFILE_FONT_MEDIUM,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0EBE1',
    color: '#630E13',
    fontSize: 11,
    fontWeight: '800',
  },
  photoRow: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 4,
  },
  photoCard: {
    width: 100,
  },
  photo: {
    width: 100,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E8E0D0',
  },
  photoCaption: {
    fontFamily: PROFILE_FONT_MEDIUM,
    marginTop: 5,
    color: '#6B5D4E',
    fontSize: 10,
    fontWeight: '700',
  },
  reviewCard: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F6F0E0',
  },
  reviewTrail: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#630E13',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewText: {
    fontFamily: PROFILE_FONT,
    marginTop: 4,
    color: '#4A4131',
    fontSize: 12,
    lineHeight: 18,
  },
  reviewMeta: {
    fontFamily: PROFILE_FONT,
    marginTop: 6,
    color: '#8A7A6A',
    fontSize: 10,
    fontWeight: '700',
  },

  // Language
  langToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: '#F0EBE1',
    padding: 3,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  langBtnActive: {
    backgroundColor: '#630E13',
  },
  langBtnText: {
    fontFamily: PROFILE_FONT,
    color: '#6B5D4E',
    fontWeight: '600',
    fontSize: 13,
  },
  langBtnTextActive: {
    color: 'white',
  },

  // Links / workspace rows
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDE5D6',
  },
  rowPressed: {
    opacity: 0.65,
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(99,14,19,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkTextWrap: {
    flex: 1,
  },
  linkTextWrapRtl: {
    alignItems: 'flex-end',
    marginRight: 12,
    marginLeft: 0,
  },
  linkTitle: {
    fontFamily: PROFILE_FONT_MEDIUM,
    fontSize: 14,
    color: '#2C2418',
    fontWeight: '600',
  },
  linkSubtitle: {
    fontFamily: PROFILE_FONT,
    fontSize: 11,
    color: '#8A7A6A',
    marginTop: 1,
  },
  badge: {
    backgroundColor: '#D4A843',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Social list sheet
  friendsModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(44,36,24,0.34)',
  },
  friendsSheet: {
    marginHorizontal: 12,
    maxHeight: '68%',
    borderRadius: 24,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: '#2C2418',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 20,
    elevation: 12,
  },
  friendsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  friendsSheetTitleWrap: {
    flex: 1,
  },
  friendsSheetTitleWrapRtl: {
    alignItems: 'flex-end',
  },
  friendsSheetTitle: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#2C2418',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  friendsSheetSubtitle: {
    fontFamily: PROFILE_FONT,
    marginTop: 2,
    color: '#7B6D5A',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  friendsSheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EBE1',
  },
  friendsState: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsStateText: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 28,
  },
  friendsList: {
    maxHeight: 420,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  friendRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDE5D6',
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8E0D0',
    marginRight: 10,
  },
  friendAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4A843',
    marginRight: 10,
  },
  friendAvatarText: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#FFF8EA',
    fontSize: 13,
    fontWeight: '900',
  },
  friendName: {
    flex: 1,
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '800',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 14,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.2)',
    backgroundColor: 'rgba(99,14,19,0.06)',
    gap: 8,
  },
  logoutText: {
    fontFamily: PROFILE_FONT_MEDIUM,
    color: '#630E13',
    fontSize: 14,
    fontWeight: '700',
  },

  versionText: {
    fontFamily: PROFILE_FONT,
    textAlign: 'center',
    fontSize: 10,
    color: '#8A7A6A',
    marginTop: 18,
    marginBottom: 8,
  },

  // RTL helpers
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  textRtl: {
    writingDirection: 'rtl',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#630E13',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2418',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B5D4E',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  emptyStateButton: {
    width: '100%',
    maxWidth: 280,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#630E13',
    alignItems: 'center',
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
});
