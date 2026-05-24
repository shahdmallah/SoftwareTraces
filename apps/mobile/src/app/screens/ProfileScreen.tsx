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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useLanguage, TranslationKey } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserAchievements, type UserAchievement } from '../api/achievementsApi';
import { getMyActivities, type Activity } from '../api/activitiesApi';
import { getProfile, getProfilePhotos, getProfileReviews, type Profile, type ProfilePhoto, type ProfileReview } from '../api/profilesApi';
import { getSavedTrails, type Trail } from '../api/trailsApi';

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

const achievementEmojis = ['🏆', '🗺️', '🥾', '🌿', '⛰️', '⭐', '🔥', '🎯'];

type ProfileAchievement = {
  id: string;
  name: string;
  earned: boolean;
  progress?: number;
  points: number;
  emoji: string;
};

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { language, setLanguage, t } = useLanguage();
  const { isAuthenticated, signOut, user } = useAuth();
  const isArabic = language === 'ar';
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReviews, setProfileReviews] = useState<ProfileReview[]>([]);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const displayName = profile?.full_name?.trim() || user?.full_name?.trim() || user?.email || '';
  const avatarText = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completedTrails, setCompletedTrails] = useState<Trail[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (!user?.id) {
        setProfile(null);
        setProfileReviews([]);
        setProfilePhotos([]);
        setAchievements([]);
        setActivities([]);
        setCompletedTrails([]);
        setProfileError('');
        setIsProfileLoading(false);
        return () => {
          cancelled = true;
        };
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
          const [userAchievements, userActivities, completedTrailResponse, loadedProfile] = await Promise.all([
            getUserAchievements(user.id).catch(() => [] as UserAchievement[]),
            getMyActivities({ page: 1, limit: 50 }).catch(() => [] as Activity[]),
            getSavedTrails({ type: 'completed', page: 1, limit: 100 }).catch(() => ({ items: [] })),
            getProfile(user.id),
          ]);

          const nextProfile: Profile = {
            ...fallbackProfile,
            ...(loadedProfile ?? {}),
            full_name: loadedProfile?.full_name || fallbackProfile.full_name,
            avatar_url: loadedProfile?.avatar_url ?? fallbackProfile.avatar_url,
            bio: loadedProfile?.bio ?? fallbackProfile.bio,
            location: loadedProfile?.location ?? fallbackProfile.location,
            stats: {
              ...fallbackStats,
              ...(loadedProfile?.stats ?? {}),
            },
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
            setAchievements(
              userAchievements.map((achievement, index) => ({
                id: achievement.id,
                name: achievement.title || achievement.name || 'Achievement',
                earned: Boolean(achievement.earned_at),
                progress: typeof achievement.progress === 'number' ? achievement.progress : undefined,
                points: achievement.points ?? 0,
                emoji: achievementEmojis[index % achievementEmojis.length],
              })),
            );
            setActivities(userActivities);
            setCompletedTrails(completedTrailResponse.items.map((item) => item.trail));
            setProfileError('');
          }
        } catch (error) {
          if (!cancelled) {
            setProfile(fallbackProfile);
            setProfileReviews([]);
            setProfilePhotos([]);
            setAchievements([]);
            setActivities([]);
            setCompletedTrails([]);
            setProfileError(error instanceof Error ? error.message : 'Unable to load profile data.');
          }
        } finally {
          if (!cancelled) {
            setIsProfileLoading(false);
          }
        }
      };

      void loadProfileData();

      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.full_name, user?.email, user?.avatar_url, user?.bio, user?.location]),
  );

  const earnedCount = achievements.filter((a) => a.earned).length;
  const progress = achievements.length ? (earnedCount / achievements.length) * 100 : 0;
  const nextAchievement = achievements.find((a) => !a.earned);
  const totalDistance = completedTrails.reduce((sum, trail) => sum + trail.distance, 0);
  const completedTrips = activities.filter((activity) => activity.status === 'completed').length;
  const followerCount = profile?.stats?.total_followers ?? 0;
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
    if (achievement.earned) {
      triggerFeedback(10);
    } else {
      triggerFeedback(20);
    }
  };

  const handleSettingPress = (setting: SettingItem) => {
    triggerFeedback(10);
    navigation.navigate('ProfileSettings', { settingId: setting.id });
  };

  const handleProfileLinkPress = (item: ProfileLinkItem) => {
    triggerFeedback(10);
    navigation.navigate(item.route);
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Header ── */}
        <AnimatedBlock delay={40}>
          <View style={[styles.heroHeader, { paddingTop: Math.max(insets.top + 12, 24) }]}>

            {/* Avatar + identity */}
            <View style={[styles.heroTop, isArabic && styles.rowReverse]}>
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
                  <Ionicons name="camera" size={12} color="white" />
                </Pressable>
              </View>

              <View style={[styles.heroIdentity, isArabic && styles.heroIdentityRtl]}>
                <Text style={[styles.heroEyebrow, isArabic && styles.textRight]}>{t('tabProfile')}</Text>
                <Text style={[styles.heroName, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                  {displayName}
                </Text>
                <Text style={[styles.heroEmail, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                  {user.email}
                </Text>
                <View style={[styles.heroLocationRow, isArabic && styles.rowReverse]}>
                  <Ionicons name="location-outline" size={12} color="rgba(255,244,226,0.6)" />
                  <Text style={[styles.heroLocation, isArabic && styles.textRight]}>
                    {locationText}
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.editBtn, isArabic && styles.editBtnRtl]}
                onPress={() => navigation.navigate('EditProfile')}
              >
                <Ionicons name="pencil" size={13} color="#FFF8EA" />
                <Text style={styles.editBtnText}>{t('edit')}</Text>
              </Pressable>
            </View>

            {/* Stats — flush inside header, no gap */}
            <View style={[styles.statsStrip, isArabic && styles.rowReverse]}>
              {[
                { value: totalDistance.toFixed(1), unit: 'km', labelKey: 'profileTotalDistance', icon: 'map-outline', onPress: undefined },
                { value: String(completedTrips), unit: '', labelKey: 'profileCompletedTrips', icon: 'checkmark-circle-outline', onPress: () => navigation.navigate('History') },
                { value: String(followerCount), unit: '', labelKey: 'profileBadges', icon: 'people-outline', onPress: undefined },
              ].map((item, index, arr) => (
                <Pressable
                  key={item.labelKey}
                  onPress={item.onPress}
                  style={[
                    styles.statCell,
                    index < arr.length - 1 && (isArabic ? styles.statCellBorderRtl : styles.statCellBorder),
                  ]}
                >
                  <View style={styles.statIconWrap}>
                    <Ionicons name={item.icon as any} size={17} color="#D4A843" />
                  </View>
                  <Text style={styles.statValue}>
                    {item.value}
                    {item.unit ? <Text style={styles.statUnit}> {item.unit}</Text> : null}
                  </Text>
                  <Text style={[styles.statLabel, isArabic && styles.textRtl]}>
                    {t(item.labelKey as TranslationKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </AnimatedBlock>

        {/* ── Main Body Card — all sections flow inside one surface ── */}
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
                      <Text style={styles.achEmoji}>{achievement.emoji}</Text>
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
                      {achievement.name}
                    </Text>
                    {!achievement.earned && achievement.progress !== undefined && (
                      <View style={styles.achProgressWrap}>
                        <View style={styles.achProgressBg}>
                          <View style={[styles.achProgressFill, { width: `${Math.max(0, Math.min(100, achievement.progress))}%` }]} />
                        </View>
                        <Text style={styles.achProgressText}>{Math.round(Math.max(0, Math.min(100, achievement.progress)))}%</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </AnimatedBlock>

          <View style={styles.bodySectionDivider} />

          {/* Next milestone — inline, not a separate card */}
          {nextAchievement && (
            <AnimatedBlock delay={155}>
              <View style={styles.bodySection}>
                <View style={[styles.milestoneRow, isArabic && styles.rowReverse]}>
                  <Text style={styles.milestoneEmoji}>{nextAchievement.emoji}</Text>
                  <View style={styles.milestoneInfo}>
                    <Text style={[styles.milestoneEyebrow, isArabic && styles.textRtl]}>{t('nextMilestone')}</Text>
                    <Text style={[styles.milestoneName, isArabic && styles.textRtl]}>{nextAchievement.name}</Text>
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

          {/* Public profile */}
          <AnimatedBlock delay={170}>
            <View style={styles.bodySection}>
              <View style={[styles.bodyRowHeader, isArabic && styles.rowReverse]}>
                <View style={[styles.bodyRowHeaderLeft, isArabic && styles.rowReverse]}>
                  <View style={styles.sectionIconDot}>
                    <Ionicons name="person-circle-outline" size={14} color="#630E13" />
                  </View>
                  <Text style={[styles.bodyTitle, isArabic && styles.textRtl]}>
                    {isArabic ? 'الملف العام' : 'Public profile'}
                  </Text>
                </View>
                {isProfileLoading ? <ActivityIndicator color="#630E13" size="small" /> : null}
              </View>

              {profileError ? (
                <Text style={[styles.profileErrorText, isArabic && styles.textRtl]}>{profileError}</Text>
              ) : (
                <>
                  <Text style={[styles.bioText, isArabic && styles.textRtl]}>
                    {bioText || (isArabic ? 'أضف نبذة قصيرة ليعرفك المتنزهون.' : 'Add a short bio so hikers know your trail style.')}
                  </Text>
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

  // ── Hero ──
  heroHeader: {
    backgroundColor: '#630E13',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarRing: {
    borderRadius: 46,
    padding: 2.5,
    backgroundColor: '#D4A843',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C89D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    color: '#FFF8EA',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 1,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#D4A843',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#630E13',
  },
  statusDot: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7A9A3A',
    borderWidth: 2,
    borderColor: '#630E13',
  },
  heroIdentity: {
    flex: 1,
    paddingLeft: 14,
  },
  heroIdentityRtl: {
    paddingLeft: 0,
    paddingRight: 14,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(255,245,229,0.55)',
    marginBottom: 4,
  },
  heroName: {
    fontSize: 22,
    color: '#FFF8EA',
    fontWeight: '900',
    lineHeight: 27,
    marginBottom: 2,
  },
  heroEmail: {
    fontSize: 12,
    color: 'rgba(255,244,226,0.72)',
    marginBottom: 5,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroLocation: {
    fontSize: 11,
    color: 'rgba(255,244,226,0.6)',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,234,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,234,0.2)',
  },
  editBtnRtl: {
    marginRight: 0,
    marginLeft: 0,
  },
  editBtnText: {
    color: '#FFF8EA',
    fontSize: 12,
    fontWeight: '700',
  },

  // Stats strip — lives at the bottom of the header, seamlessly
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginHorizontal: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  statCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statCellBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,248,234,0.15)',
  },
  statCellBorderRtl: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,248,234,0.15)',
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212,168,67,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  statValue: {
    color: '#FFF8EA',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '400',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    color: 'rgba(255,244,226,0.6)',
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
    gap: 10,
  },
  achCard: {
    width: 82,
    alignItems: 'center',
    marginRight: 10,
  },
  achCardLocked: {
    opacity: 0.55,
  },
  achIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 18,
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
  },
  achProgressWrap: {
    width: '100%',
    marginTop: 5,
  },
  achProgressBg: {
    height: 3,
    backgroundColor: '#EDE5D6',
    borderRadius: 2,
    overflow: 'hidden',
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

  // Next milestone — inline strip
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FBF5E8',
    borderRadius: 16,
    padding: 14,
  },
  milestoneEmoji: {
    fontSize: 36,
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

  // Public profile
  profileErrorText: {
    color: '#8B1E1E',
    fontSize: 13,
    fontWeight: '700',
  },
  bioText: {
    color: '#5A4F41',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  miniStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 2,
  },
  miniStat: {
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
    color: '#630E13',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewText: {
    marginTop: 4,
    color: '#4A4131',
    fontSize: 12,
    lineHeight: 18,
  },
  reviewMeta: {
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
    width: 38,
    height: 38,
    borderRadius: 12,
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
    fontSize: 14,
    color: '#2C2418',
    fontWeight: '600',
  },
  linkSubtitle: {
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
    color: '#630E13',
    fontSize: 14,
    fontWeight: '700',
  },

  versionText: {
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
