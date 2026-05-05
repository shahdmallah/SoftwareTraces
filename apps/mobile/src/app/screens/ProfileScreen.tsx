import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useLanguage, TranslationKey } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserAchievements, type UserAchievement } from '../api/achievementsApi';
import { getUserActivities, type Activity } from '../api/activitiesApi';

type SettingItem = {
  id: string;
  icon: string;
  labelKey: TranslationKey;
  subtitleKey?: TranslationKey;
  badge?: number;
};

const settings: SettingItem[] = [
  { id: 's5', icon: 'settings-outline', labelKey: 'settingGeneral' },
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
  const displayName = user?.full_name?.trim() || user?.email || '';
  const avatarText = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

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

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setAchievements([]);
      setActivities([]);
      return () => {
        cancelled = true;
      };
    }

    const loadProfileData = async () => {
      try {
        const [userAchievements, userActivities] = await Promise.all([
          getUserAchievements(user.id).catch(() => [] as UserAchievement[]),
          getUserActivities(user.id).catch(() => [] as Activity[]),
        ]);

        if (!cancelled) {
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
        }
      } catch {
        if (!cancelled) {
          setAchievements([]);
          setActivities([]);
        }
      }
    };

    void loadProfileData();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const earnedCount = achievements.filter((a) => a.earned).length;
  const progress = achievements.length ? (earnedCount / achievements.length) * 100 : 0;
  const nextAchievement = achievements.find((a) => !a.earned);
  const totalDistance = activities.reduce((sum, activity) => sum + (activity.distance_km ?? 0), 0);
  const completedTrips = activities.filter((activity) => activity.status === 'completed').length;
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
      // Show achievement details modal
    } else {
      triggerFeedback(20);
    }
  };

  const handleSettingPress = (setting: SettingItem) => {
    triggerFeedback(10);
    navigation.navigate('ProfileSettings', { settingId: setting.id });
  };

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header with Gradient */}
        <AnimatedBlock delay={40} style={[styles.profileHeader, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <View style={styles.headerGradient} />
          <View style={[styles.profileTop, isArabic && styles.rowReverse]}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarGradient}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{avatarText}</Text>
                </View>
              </View>
              <View style={styles.statusDot} />
              <Pressable style={styles.changePhotoButton}>
                <Ionicons name="camera" size={12} color="white" />
              </Pressable>
            </View>
            <View style={[styles.profileInfo, isArabic && styles.profileInfoRtl]}>
              <Text style={[styles.profileEyebrow, isArabic && styles.textRight]}>{t('tabProfile')}</Text>
              <Text style={[styles.profileName, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                {displayName}
              </Text>
              <Text style={[styles.profileSub, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                {user.email}
              </Text>
              <View style={[styles.locationRow, isArabic && styles.rowReverse]}>
                <Ionicons name="location-outline" size={13} color="rgba(255,244,226,0.7)" />
                <Text style={[styles.profileLocation, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                  {t('profileLocation')}
                </Text>
              </View>
            </View>
            <Pressable style={[styles.editButton, isArabic && styles.editButtonRtl]} onPress={() => navigation.navigate('EditProfile')}>
              <Text style={styles.editButtonText}>{t('edit')}</Text>
            </Pressable>
          </View>
          
          {/* Enhanced Stats Cards */}
          <View style={[styles.profileStatsRow, isArabic && styles.rowReverse]}>
              {[
              { value: totalDistance.toFixed(1), unit: 'km', labelKey: 'profileTotalDistance', icon: 'map-outline' },
              { value: String(completedTrips), unit: '', labelKey: 'profileCompletedTrips', icon: 'checkmark-circle-outline' },
              { value: String(earnedCount), unit: '', labelKey: 'profileBadges', icon: 'ribbon-outline' },
            ].map((item, index) => (
              <Pressable
                key={item.labelKey}
                onPress={item.labelKey === 'profileCompletedTrips' ? () => navigation.navigate('History') : undefined}
                style={[
                  styles.statCard,
                  index < 2 && (isArabic ? styles.statCardBorderRtl : styles.statCardBorder),
                ]}
              >
                <View style={styles.statIconContainer}>
                  <Ionicons name={item.icon as any} size={20} color="#D4A843" />
                </View>
                <Text style={styles.statValue}>
                  {item.value}
                  {item.unit && <Text style={styles.statUnit}> {item.unit}</Text>}
                </Text>
                <Text style={[styles.statLabel, isArabic && styles.textRtl]}>
                  {t(item.labelKey as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </AnimatedBlock>

        {/* Enhanced Achievements Section */}
        <AnimatedBlock delay={120} style={styles.section}>
          <View style={[styles.sectionHeader, isArabic && styles.rowReverse]}>
            <View style={[styles.sectionTitleRow, isArabic && styles.rowReverse]}>
              <Ionicons name="trophy" size={20} color="#D4A843" />
              <Text style={[styles.sectionTitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                {t('achievementsTitle')}
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressCount}>{earnedCount}/{achievements.length}</Text>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsScrollContent}
          >
            {achievements.map((achievement, index) => (
              <Pressable
                key={achievement.id}
                onPress={() => handleAchievementPress(achievement)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={[styles.achievementCard, !achievement.earned && styles.achievementCardLocked]}>
                  <View
                    style={[
                      styles.achievementGradient,
                      achievement.earned ? styles.achievementGradientEarned : styles.achievementGradientLocked,
                    ]}
                  >
                    <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                    {achievement.earned && (
                      <View style={styles.checkmarkBadge}>
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      </View>
                    )}
                    {!achievement.earned && (
                      <View style={styles.lockedBadge}>
                        <Ionicons name="lock-closed" size={12} color="#8A7A6A" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.achievementName, isArabic && styles.textRtl]}>
                    {isArabic ? achievement.nameAr : achievement.nameEn}
                  </Text>
                  {!achievement.earned && achievement.progress && (
                    <View style={styles.achievementProgress}>
                      <View style={styles.achievementProgressBar}>
                        <View 
                          style={[
                            styles.achievementProgressFill, 
                            { width: `${(achievement.progress / achievement.target) * 100}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.achievementProgressText}>{Math.max(0, Math.min(100, Math.round(achievement.progress)))}%</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </AnimatedBlock>

        {/* Featured Next Achievement */}
        {nextAchievement && (
          <AnimatedBlock delay={160} style={styles.section}>
            <View style={styles.featuredCard}>
              <Text style={[styles.featuredTitle, isArabic && styles.textRtl]}>
                {t('nextMilestone')}
              </Text>
              <View style={[styles.featuredContent, isArabic && styles.rowReverse]}>
                <Text style={styles.featuredEmoji}>{nextAchievement.emoji}</Text>
                <View style={styles.featuredInfo}>
                  <Text style={[styles.featuredName, isArabic && styles.textRtl]}>
                    {nextAchievement.name}
                  </Text>
                  <View style={styles.featuredProgressContainer}>
                    <View style={styles.featuredProgressBar}>
                      <View
                        style={[
                          styles.featuredProgressFill,
                          { width: `${Math.max(0, Math.min(100, nextAchievement.progress || 0))}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.featuredProgressText}>
                      {Math.max(0, Math.min(100, Math.round(nextAchievement.progress || 0)))}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </AnimatedBlock>
        )}

        {/* Language Toggle */}
        <AnimatedBlock delay={180} style={styles.section}>
          <Text style={[styles.sectionTitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
            {t('languageTitle')}
          </Text>
          <View style={[styles.languageToggleRow, isArabic && styles.rowReverse]}>
            <Pressable
              style={[styles.languageButton, language === 'ar' && styles.languageButtonActive]}
              onPress={() => setLanguage('ar')}
            >
              <Text style={[styles.languageButtonText, language === 'ar' && styles.languageButtonTextActive]}>
                {t('languageArabic')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.languageButton, language === 'en' && styles.languageButtonActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.languageButtonText, language === 'en' && styles.languageButtonTextActive]}>
                {t('languageEnglish')}
              </Text>
            </Pressable>
          </View>
        </AnimatedBlock>

        {/* Settings */}
        <AnimatedBlock delay={220} style={styles.section}>
          {settings.map((item, index) => (
            <Pressable 
              key={item.id} 
              onPress={() => handleSettingPress(item)}
              style={({ pressed }) => [
                styles.settingRow,
                isArabic && styles.rowReverse,
                pressed && styles.settingRowPressed,
              ]}
            >
              <View style={styles.settingIconWrapper}>
                <View style={styles.settingIconGradient}>
                  <Ionicons name={item.icon as any} size={18} color="#630E13" />
                </View>
              </View>
              <View style={[styles.settingTextWrapper, isArabic && styles.settingTextWrapperRtl]}>
                <Text style={[styles.settingTitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                  {t(item.labelKey)}
                </Text>
                {item.subtitleKey ? (
                  <Text style={[styles.settingSubtitle, isArabic && styles.textRight, isArabic && styles.textRtl]}>
                    {item.subtitleKey === 'languageCurrent'
                      ? language === 'ar'
                        ? t('languageArabic')
                        : t('languageEnglish')
                      : item.subtitleKey === 'favoritesCount'
                      ? `${item.badge} ${t('items')}`
                      : t(item.subtitleKey)}
                  </Text>
                ) : null}
              </View>
              {item.badge && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={16} color="#C4BBA0" />
            </Pressable>
          ))}
        </AnimatedBlock>

        {/* Logout Button */}
        <AnimatedBlock delay={260}>
          <Pressable
            style={[styles.logoutButton, isArabic && styles.rowReverse]}
            onPress={() => {
              triggerFeedback([0, 20]);
              signOut();
              navigation.navigate('Auth');
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#BB2823" />
            <Text style={[styles.logoutText, isArabic && styles.textRtl]}>{t('logout')}</Text>
          </Pressable>
        </AnimatedBlock>

        {/* Version Info */}
        <Text style={styles.versionText}>Hike time: {totalDurationHours.toFixed(1)}h</Text>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  content: {
    paddingBottom: 32,
  },
  profileHeader: {
    marginBottom: 14,
    paddingHorizontal: 0,
    paddingBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#630E13',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#630E13',
  },
  profileTop: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  textRtl: {
    writingDirection: 'rtl',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    borderRadius: 45,
    padding: 2,
    backgroundColor: '#D4A843',
  },
  avatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#C89D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF8EA',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D4A843',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  statusDot: {
    position: 'absolute',
    bottom: 6,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7A9A3A',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileInfo: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 2,
  },
  profileInfoRtl: {
    paddingLeft: 0,
    paddingRight: 16,
  },
  profileEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: 'rgba(255,245,229,0.64)',
    marginBottom: 6,
  },
  profileName: {
    fontSize: 24,
    color: '#FFF8EA',
    fontWeight: '900',
    marginBottom: 4,
  },
  profileSub: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,244,226,0.82)',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileLocation: {
    fontSize: 12,
    color: 'rgba(255,244,226,0.7)',
  },
  editButton: {
    minWidth: 68,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,248,234,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,234,0.22)',
    alignItems: 'center',
  },
  editButtonRtl: {
    marginRight: 12,
    marginLeft: 0,
  },
  editButtonText: {
    color: '#FFF8EA',
    fontSize: 12,
    fontWeight: '700',
  },
  profileStatsRow: {
    marginTop: 2,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 0,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,248,234,0.08)',
  },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,234,0.06)',
  },
  statCardBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,248,234,0.1)',
  },
  statCardBorderRtl: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,248,234,0.1)',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212,168,67,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: '#FFF8EA',
    fontSize: 18,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '400',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 10,
    color: 'rgba(255,244,226,0.68)',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#630E13',
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressBarBackground: {
    width: 80,
    height: 4,
    backgroundColor: '#E8E0D0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D4A843',
    borderRadius: 2,
  },
  progressCount: {
    fontSize: 10,
    color: '#6B5D4E',
  },
  achievementsScrollContent: {
    paddingRight: 16,
    gap: 12,
  },
  achievementCard: {
    width: 90,
    alignItems: 'center',
    marginRight: 12,
  },
  achievementCardLocked: {
    opacity: 0.6,
  },
  achievementGradient: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  achievementGradientEarned: {
    backgroundColor: '#D4A843',
  },
  achievementGradientLocked: {
    backgroundColor: '#D4CBAF',
  },
  achievementEmoji: {
    fontSize: 28,
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  lockedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8A7A6A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  achievementName: {
    textAlign: 'center',
    fontSize: 11,
    color: '#4A4131',
    lineHeight: 14,
    fontWeight: '600',
  },
  achievementProgress: {
    width: '100%',
    marginTop: 6,
  },
  achievementProgressBar: {
    height: 2,
    backgroundColor: '#E8E0D0',
    borderRadius: 1,
    overflow: 'hidden',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#D4A843',
  },
  achievementProgressText: {
    fontSize: 8,
    color: '#8A7A6A',
    textAlign: 'center',
    marginTop: 2,
  },
  featuredCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.16)',
    backgroundColor: '#F6F0E0',
  },
  featuredTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#630E13',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featuredEmoji: {
    fontSize: 40,
  },
  featuredInfo: {
    flex: 1,
  },
  featuredName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#630E13',
    marginBottom: 8,
  },
  featuredProgressContainer: {
    gap: 4,
  },
  featuredProgressBar: {
    height: 6,
    backgroundColor: '#E8E0D0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  featuredProgressFill: {
    height: '100%',
    backgroundColor: '#D4A843',
    borderRadius: 3,
  },
  featuredProgressText: {
    fontSize: 10,
    color: '#8A7A6A',
  },
  languageToggleRow: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#FFFDF8',
    overflow: 'hidden',
    marginTop: 10,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  languageButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  languageButtonActive: {
    backgroundColor: '#630E13',
  },
  languageButtonText: {
    color: '#6B5D4E',
    fontWeight: '600',
  },
  languageButtonTextActive: {
    color: 'white',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFDF8',
    marginBottom: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  settingRowPressed: {
    backgroundColor: '#F1E7D2',
    transform: [{ scale: 0.98 }],
  },
  settingIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  settingIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,14,19,0.08)',
  },
  settingTextWrapper: {
    flex: 1,
    paddingHorizontal: 12,
  },
  settingTextWrapperRtl: {
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  settingTitle: {
    fontSize: 15,
    color: '#2C2418',
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 11,
    color: '#8A7A6A',
    marginTop: 2,
  },
  badgeContainer: {
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.24)',
    backgroundColor: 'rgba(99,14,19,0.08)',
    gap: 8,
  },
  logoutText: {
    color: '#630E13',
    fontSize: 15,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 10,
    color: '#8A7A6A',
    marginTop: 20,
    marginBottom: 10,
  },
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
