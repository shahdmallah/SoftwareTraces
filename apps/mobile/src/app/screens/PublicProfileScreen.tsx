import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { followUser, unfollowUser } from '../api/socialApi';
import { getProfile, getProfilePhotos, getProfileReviews, type Profile, type ProfilePhoto, type ProfileReview } from '../api/profilesApi';
import { AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type PublicProfileRouteProp = RouteProp<RootStackParamList, 'PublicProfile'>;
type PublicProfileNavigationProp = StackNavigationProp<RootStackParamList>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
}

export function PublicProfileScreen() {
  const route = useRoute<PublicProfileRouteProp>();
  const navigation = useNavigation<PublicProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { profileId } = route.params;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [nextProfile, nextReviews, nextPhotos] = await Promise.all([
          getProfile(profileId),
          getProfileReviews(profileId).catch(() => [] as ProfileReview[]),
          getProfilePhotos(profileId).catch(() => [] as ProfilePhoto[]),
        ]);

        if (!cancelled) {
          setProfile(nextProfile);
          setReviews(nextReviews);
          setPhotos(nextPhotos);
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setReviews([]);
          setPhotos([]);
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load this profile.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const handleToggleFollow = async () => {
    setIsFollowPending(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      await (wasFollowing ? unfollowUser(profileId) : followUser(profileId));
    } catch (error) {
      setIsFollowing(wasFollowing);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update follow status.');
    } finally {
      setIsFollowPending(false);
    }
  };

  const displayName = profile?.full_name ?? 'Trail friend';

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(16, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, isArabic ? rtlRow : ltrRow]}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
          </Pressable>
          <Text style={[styles.screenTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'ملف المتنزه' : 'Hiker profile'}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#630E13" />
            <Text style={styles.stateText}>{isArabic ? 'جار تحميل الملف...' : 'Loading profile...'}</Text>
          </View>
        ) : errorMessage && !profile ? (
          <View style={styles.stateCard}>
            <Ionicons name="warning-outline" size={24} color="#8B1E1E" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : profile ? (
          <>
            <View style={styles.profileCard}>
              <View style={[styles.profileTop, isArabic ? rtlRow : ltrRow]}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials(displayName)}</Text>
                  </View>
                )}
                <View style={styles.profileCopy}>
                  <Text style={[styles.name, isArabic ? rtlText : ltrText]}>{displayName}</Text>
                  <Text style={[styles.location, isArabic ? rtlText : ltrText]}>{profile.location || (isArabic ? 'متنزه في المجتمع' : 'Community hiker')}</Text>
                </View>
              </View>

              <Text style={[styles.bio, isArabic ? rtlText : ltrText]}>
                {profile.bio || (isArabic ? 'لم يضف هذا المتنزه نبذة بعد.' : 'This hiker has not added a bio yet.')}
              </Text>

              <View style={[styles.statsRow, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{profile.stats?.total_followers ?? 0}</Text>
                  <Text style={styles.statLabel}>{isArabic ? 'متابعون' : 'followers'}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{profile.stats?.total_reviews ?? reviews.length}</Text>
                  <Text style={styles.statLabel}>{isArabic ? 'مراجعات' : 'reviews'}</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statValue}>{profile.stats?.total_photos ?? photos.length}</Text>
                  <Text style={styles.statLabel}>{isArabic ? 'صور' : 'photos'}</Text>
                </View>
              </View>

              <Pressable style={[styles.followButton, isFollowing && styles.followButtonActive]} onPress={handleToggleFollow} disabled={isFollowPending}>
                {isFollowPending ? (
                  <ActivityIndicator size="small" color={isFollowing ? '#fff' : '#630E13'} />
                ) : (
                  <>
                    <Ionicons name={isFollowing ? 'checkmark' : 'person-add-outline'} size={16} color={isFollowing ? '#fff' : '#630E13'} />
                    <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                      {isFollowing ? (isArabic ? 'تتابع' : 'Following') : isArabic ? 'متابعة' : 'Follow'}
                    </Text>
                  </>
                )}
              </Pressable>
              {errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null}
            </View>

            {photos.length ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'الصور' : 'Photos'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                  {photos.map((photo) => (
                    <Pressable key={photo.id} style={styles.photoCard} onPress={() => photo.trail_id && navigation.navigate('TrailDetail', { trailId: photo.trail_id })}>
                      <Image source={{ uri: photo.url }} style={styles.photo} />
                      <Text numberOfLines={1} style={styles.photoCaption}>{photo.trail_name ?? photo.caption ?? 'Trail photo'}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'المراجعات' : 'Reviews'}</Text>
              {reviews.length ? (
                reviews.map((review) => (
                  <Pressable key={review.id} style={styles.reviewCard} onPress={() => navigation.navigate('TrailDetail', { trailId: review.trail.id })}>
                    <Text style={styles.reviewTrail}>{review.trail.name}</Text>
                    <Text numberOfLines={3} style={[styles.reviewText, isArabic ? rtlText : ltrText]}>{review.content}</Text>
                    <Text style={styles.reviewMeta}>{review.rating}/5 · {review.likes_count ?? 0} likes · {review.comments_count ?? 0} comments</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>{isArabic ? 'لا توجد مراجعات بعد.' : 'No reviews yet.'}</Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  stateCard: { minHeight: 180, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  stateText: { color: '#6B5D4E', fontSize: 13, fontWeight: '800' },
  errorText: { color: '#8B1E1E', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  profileCard: { borderRadius: 24, padding: 16, backgroundColor: '#fff' },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#E7D8C3' },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  avatarInitials: { color: '#fff', fontSize: 24, fontWeight: '900' },
  profileCopy: { flex: 1 },
  name: { color: '#2C2418', fontSize: 22, fontWeight: '900' },
  location: { marginTop: 4, color: '#7B6D5A', fontSize: 13, fontWeight: '700' },
  bio: { marginTop: 14, color: '#4A4131', fontSize: 14, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statPill: { flex: 1, borderRadius: 16, padding: 10, alignItems: 'center', backgroundColor: '#F6F0E0' },
  statValue: { color: '#630E13', fontSize: 17, fontWeight: '900' },
  statLabel: { marginTop: 2, color: '#7B6D5A', fontSize: 11, fontWeight: '800' },
  followButton: { minHeight: 48, marginTop: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F7EBE8' },
  followButtonActive: { backgroundColor: '#630E13' },
  followText: { color: '#630E13', fontSize: 14, fontWeight: '900' },
  followTextActive: { color: '#fff' },
  inlineError: { marginTop: 10, color: '#8B1E1E', fontSize: 12, fontWeight: '800' },
  section: { marginTop: 18 },
  sectionTitle: { color: '#2C2418', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  photoRow: { gap: 10, paddingBottom: 4 },
  photoCard: { width: 124 },
  photo: { width: 124, height: 96, borderRadius: 16, backgroundColor: '#E7D8C3' },
  photoCaption: { marginTop: 6, color: '#6B5D4E', fontSize: 11, fontWeight: '800' },
  reviewCard: { borderRadius: 18, padding: 14, backgroundColor: '#fff', marginBottom: 10 },
  reviewTrail: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  reviewText: { marginTop: 6, color: '#4A4131', fontSize: 13, lineHeight: 20 },
  reviewMeta: { marginTop: 8, color: '#8A7A6A', fontSize: 11, fontWeight: '800' },
  emptyText: { color: '#6B5D4E', fontSize: 13, lineHeight: 20 },
});
