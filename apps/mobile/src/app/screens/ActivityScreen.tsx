import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ListRenderItem, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { getSocialFeed, type SocialFeedReview } from '../api/socialApi';
import { feedItems, type FeedItem } from '../data/activitySocial';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ActivityNavigationProp = StackNavigationProp<RootStackParamList>;
type FeedTab = 'all' | 'recaps' | 'plans';

const tabLabels: Record<FeedTab, { en: string; ar: string; icon: keyof typeof Ionicons.glyphMap }> = {
  all: { en: 'Trail pulse', ar: 'نبض المسارات', icon: 'sparkles-outline' },
  recaps: { en: 'Hike recaps', ar: 'ملخصات الرحلات', icon: 'footsteps-outline' },
  plans: { en: 'Meetups', ar: 'لقاءات قادمة', icon: 'calendar-outline' },
};

type CommunityStat = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  labelEn: string;
  labelAr: string;
};

const fallbackAvatar = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240';
const fallbackTrailImage = 'https://images.unsplash.com/photo-1511497584788-876760111969?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1200';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesQuery(item: FeedItem, query: string): boolean {
  if (!query) return true;

  const values =
    item.kind === 'recap'
      ? [item.user, item.handle, item.trailNameEn, item.trailNameAr, item.regionEn, item.regionAr, item.captionEn, item.captionAr]
      : [item.user, item.handle, item.destinationEn, item.destinationAr, item.vibeEn, item.vibeAr, item.noteEn, item.noteAr];

  return values.some((value) => normalize(value).includes(query));
}

function getDistanceKm(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'recently';
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

function mapSocialReviewToFeedItem(item: SocialFeedReview): FeedItem {
  const photo = item.photo_url || item.photos[0]?.url || item.trail.image || fallbackTrailImage;
  const userName = item.user.full_name || 'Trail friend';

  return {
    id: item.id,
    kind: 'recap',
    trailId: item.trail.id,
    user: userName,
    handle: `@${userName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'traces'}`,
    avatar: item.user.avatar_url || fallbackAvatar,
    image: photo,
    trailNameEn: item.trail.name,
    trailNameAr: item.trail.name,
    regionEn: 'Trail review',
    regionAr: 'Trail review',
    captionEn: item.content,
    captionAr: item.content,
    timeEn: formatRelativeTime(item.created_at),
    timeAr: formatRelativeTime(item.created_at),
    likes: item.likes_count,
    comments: item.comments_count,
    distance: `${item.rating}/5`,
  };
}

type FeedCardProps = {
  item: FeedItem;
  index: number;
  isArabic: boolean;
  onOpenTrail: (trailId: string) => void;
};

const FeedCard = memo(function FeedCard({ item, index, isArabic, onOpenTrail }: FeedCardProps) {
  return (
    <AnimatedBlock delay={index < 4 ? 120 + index * 35 : 0}>
      {item.kind === 'recap' ? (
        <RecapCard item={item} isArabic={isArabic} onOpenTrail={onOpenTrail} />
      ) : (
        <PlanCard item={item} isArabic={isArabic} onOpenTrail={onOpenTrail} />
      )}
    </AnimatedBlock>
  );
});

type RecapItem = Extract<FeedItem, { kind: 'recap' }>;
type PlanItem = Extract<FeedItem, { kind: 'plan' }>;

const RecapCard = memo(function RecapCard({
  item,
  isArabic,
  onOpenTrail,
}: {
  item: RecapItem;
  isArabic: boolean;
  onOpenTrail: (trailId: string) => void;
}) {
  return (
    <View style={styles.postCard}>
      <View style={[styles.postHeader, isArabic ? rtlRow : ltrRow]}>
        <View style={[styles.postUserRow, isArabic ? rtlRow : ltrRow]}>
          <Image source={{ uri: item.avatar }} style={styles.postAvatar} />
          <View style={styles.postUserCopy}>
            <Text style={[styles.postUserName, isArabic ? rtlText : ltrText]} numberOfLines={1}>
              {item.user}
            </Text>
            <Text style={[styles.postHandle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
              {item.handle} · {isArabic ? item.timeAr : item.timeEn}
            </Text>
          </View>
        </View>
        <View style={styles.recapBadge}>
          <Ionicons name="walk-outline" size={13} color="#630E13" />
          <Text style={styles.recapBadgeText}>{isArabic ? 'رحلة' : 'Hike'}</Text>
        </View>
      </View>

      <Pressable style={styles.postMediaWrap} onPress={() => onOpenTrail(item.trailId)}>
        <Image source={{ uri: item.image }} style={styles.postMedia} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.62)']} style={styles.postMediaOverlay}>
          <View style={styles.postMediaMeta}>
            <View style={styles.mediaTag}>
              <Ionicons name="location-outline" size={13} color="#fff" />
              <Text style={styles.mediaTagText} numberOfLines={1}>
                {isArabic ? item.trailNameAr : item.trailNameEn}
              </Text>
            </View>
            <View style={styles.mediaTag}>
              <Ionicons name="footsteps-outline" size={13} color="#fff" />
              <Text style={styles.mediaTagText}>{item.distance}</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <View style={[styles.postActions, isArabic && styles.postActionsRtl]}>
        <View style={[styles.actionCluster, isArabic && styles.actionClusterRtl]}>
          <Ionicons name="heart" size={20} color="#C5333A" />
          <Ionicons name="chatbubble-outline" size={19} color="#2C2418" />
          <Ionicons name="navigate-outline" size={19} color="#2C2418" />
        </View>
        <Pressable onPress={() => onOpenTrail(item.trailId)}>
          <Ionicons name="map-outline" size={19} color="#2C2418" />
        </Pressable>
      </View>

      <View style={styles.postBody}>
        <Text style={[styles.likeCount, isArabic ? rtlText : ltrText]}>
          {isArabic ? `${item.likes} إعجاب` : `${item.likes} likes`}
        </Text>
        <Text style={[styles.caption, isArabic ? rtlText : ltrText]} numberOfLines={3}>
          <Text style={styles.captionUser}>{item.user} </Text>
          {isArabic ? item.captionAr : item.captionEn}
        </Text>
        <View style={[styles.postFooter, isArabic ? rtlRow : ltrRow]}>
          <Text style={[styles.commentHint, isArabic ? rtlText : ltrText]}>
            {isArabic ? `${item.comments} تعليق` : `${item.comments} comments`}
          </Text>
          <Text style={[styles.locationLine, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {isArabic ? item.regionAr : item.regionEn}
          </Text>
        </View>
      </View>
    </View>
  );
});

const PlanCard = memo(function PlanCard({
  item,
  isArabic,
  onOpenTrail,
}: {
  item: PlanItem;
  isArabic: boolean;
  onOpenTrail: (trailId: string) => void;
}) {
  return (
    <Pressable style={styles.planCard} onPress={() => onOpenTrail(item.trailId)}>
      <Image source={{ uri: item.cover }} style={styles.planImage} resizeMode="cover" />
      <LinearGradient colors={['rgba(15,10,7,0.05)', 'rgba(15,10,7,0.76)']} style={styles.planOverlay}>
        <View style={[styles.planTopRow, isArabic ? rtlRow : ltrRow]}>
          <View style={[styles.postUserRow, isArabic ? rtlRow : ltrRow]}>
            <Image source={{ uri: item.avatar }} style={styles.postAvatar} />
            <View style={styles.postUserCopy}>
              <Text style={[styles.planUserName, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                {item.user}
              </Text>
              <Text style={[styles.planHandle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                {item.handle}
              </Text>
            </View>
          </View>
          <View style={styles.planBadge}>
            <Ionicons name="calendar" size={13} color="#fff" />
            <Text style={styles.planBadgeText}>{isArabic ? 'لقاء' : 'Meetup'}</Text>
          </View>
        </View>

        <View style={styles.planBody}>
          <Text style={[styles.planTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
            {isArabic ? item.destinationAr : item.destinationEn}
          </Text>
          <Text style={[styles.planDate, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {isArabic ? item.dateAr : item.dateEn}
          </Text>
          <Text style={[styles.planVibe, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {isArabic ? item.vibeAr : item.vibeEn}
          </Text>
          <Text style={[styles.planNote, isArabic ? rtlText : ltrText]} numberOfLines={2}>
            {isArabic ? item.noteAr : item.noteEn}
          </Text>

          <View style={[styles.planFooter, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.planMetaPill}>
              <Ionicons name="people-outline" size={14} color="#fff" />
              <Text style={styles.planMetaText}>{isArabic ? `${item.peopleJoined} منضمون` : `${item.peopleJoined} joined`}</Text>
            </View>
            <View style={styles.planMetaPill}>
              <Ionicons name="sparkles-outline" size={14} color="#fff" />
              <Text style={styles.planMetaText}>{isArabic ? `${item.spotsLeft} أماكن` : `${item.spotsLeft} spots`}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

export function ActivityScreen() {
  const navigation = useNavigation<ActivityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteRecaps, setRemoteRecaps] = useState<FeedItem[]>([]);
  const [hasLoadedRemoteFeed, setHasLoadedRemoteFeed] = useState(false);

  const normalizedQuery = useMemo(() => normalize(searchQuery), [searchQuery]);
  const feedData = useMemo(() => {
    if (!isAuthenticated || !hasLoadedRemoteFeed) {
      return feedItems;
    }

    return [...remoteRecaps, ...feedItems.filter((item) => item.kind === 'plan')];
  }, [hasLoadedRemoteFeed, isAuthenticated, remoteRecaps]);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setRemoteRecaps([]);
      setHasLoadedRemoteFeed(false);
      return () => {
        cancelled = true;
      };
    }

    const loadFeed = async () => {
      try {
        const response = await getSocialFeed({ page: 1, limit: 30 });
        if (!cancelled) {
          setRemoteRecaps(response.data.map(mapSocialReviewToFeedItem));
          setHasLoadedRemoteFeed(true);
        }
      } catch {
        if (!cancelled) {
          setRemoteRecaps([]);
          setHasLoadedRemoteFeed(false);
        }
      }
    };

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const filteredFeed = useMemo(() => {
    const scopedItems = feedData.filter((item) => {
      if (activeTab === 'recaps') return item.kind === 'recap';
      if (activeTab === 'plans') return item.kind === 'plan';
      return true;
    });

    return scopedItems.filter((item) => matchesQuery(item, normalizedQuery));
  }, [activeTab, feedData, normalizedQuery]);

  const communityStats = useMemo<CommunityStat[]>(() => {
    const recaps = feedData.filter((item): item is RecapItem => item.kind === 'recap');
    const plans = feedData.filter((item): item is PlanItem => item.kind === 'plan');
    const distance = recaps.reduce((sum, item) => sum + getDistanceKm(item.distance), 0);
    const joined = plans.reduce((sum, item) => sum + item.peopleJoined, 0);

    return [
      { id: 'distance', icon: 'trail-sign-outline', value: `${distance.toFixed(1)} km`, labelEn: 'shared this week', labelAr: 'مشاركة هذا الأسبوع' },
      { id: 'meetups', icon: 'calendar-outline', value: String(plans.length), labelEn: 'open meetups', labelAr: 'لقاءات مفتوحة' },
      { id: 'joined', icon: 'people-outline', value: String(joined), labelEn: 'hikers joining', labelAr: 'متنزهون منضمون' },
    ];
  }, [feedData]);

  const handleOpenTrail = useCallback(
    (trailId: string) => {
      navigation.navigate('TrailDetail', { trailId });
    },
    [navigation]
  );

  const renderItem = useCallback<ListRenderItem<FeedItem>>(
    ({ item, index }) => <FeedCard item={item} index={index} isArabic={isArabic} onOpenTrail={handleOpenTrail} />,
    [handleOpenTrail, isArabic]
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View>
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.pageTitle, isArabic ? rtlText : ltrText]}>{t('tabActivity')}</Text>
              <Text style={[styles.pageSubtitle, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'رحلات الأصدقاء، اللقاءات القريبة، وإلهام المسار التالي.' : 'Friend hikes, nearby meetups, and ideas for your next trail.'}
              </Text>
            </View>

            <View style={[styles.headerActions, isArabic && styles.headerActionsRtl]}>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('ActivityShare')}>
                <Ionicons name="add-circle-outline" size={20} color="#2C2418" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('ActivityMessages')}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2C2418" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => setSearchOpen((value) => !value)}>
                <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={20} color="#2C2418" />
              </Pressable>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={70}>
          <View style={styles.pulsePanel}>
            <View style={[styles.pulseHeader, isArabic ? rtlRow : ltrRow]}>
              <View>
                <Text style={[styles.pulseTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'نبض المجتمع' : 'Community pulse'}</Text>
                <Text style={[styles.pulseSubtitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'ما يحدث الآن على مسارات Traces' : 'What is moving across Traces right now'}
                </Text>
              </View>
              <Ionicons name="compass-outline" size={22} color="#630E13" />
            </View>
            <View style={[styles.statRow, isArabic && styles.statRowRtl]}>
              {communityStats.map((stat) => (
                <View key={stat.id} style={styles.statPill}>
                  <Ionicons name={stat.icon} size={15} color="#630E13" />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={[styles.statLabel, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                    {isArabic ? stat.labelAr : stat.labelEn}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </AnimatedBlock>

        {searchOpen ? (
          <AnimatedBlock delay={90}>
            <View style={styles.searchCard}>
              <View style={[styles.searchRow, isArabic ? rtlRow : ltrRow]}>
                <Ionicons name="search-outline" size={18} color="#8A7A6A" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={isArabic ? 'ابحث عن صديق، مسار، رحلة، أو لقاء' : 'Search friends, trails, hikes, or meetups'}
                  placeholderTextColor="#A18F7A"
                  style={[styles.searchInput, isArabic ? rtlText : ltrText]}
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#A18F7A" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </AnimatedBlock>
        ) : null}

        <AnimatedBlock delay={110}>
          <View style={[styles.tabRow, isArabic && styles.tabRowRtl]}>
            {(Object.keys(tabLabels) as FeedTab[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable key={tab} style={[styles.tabButton, active && styles.tabButtonActive]} onPress={() => setActiveTab(tab)}>
                  <Ionicons name={tabLabels[tab].icon} size={15} color={active ? '#fff' : '#6B5D4E'} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                    {isArabic ? tabLabels[tab].ar : tabLabels[tab].en}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AnimatedBlock>
      </View>
    ),
    [activeTab, communityStats, isArabic, navigation, searchOpen, searchQuery, t]
  );

  return (
    <AnimatedScreen style={styles.container}>
      <FlatList
        data={filteredFeed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="trail-sign-outline" size={28} color="#8A7A6A" />
            <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'لا توجد نتائج' : 'No trail moments found'}</Text>
            <Text style={[styles.emptyCopy, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'جرّب بحثاً آخر أو بدّل نوع النشاط.' : 'Try a different search or switch the feed filter.'}
            </Text>
          </View>
        }
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2C2418',
  },
  pageSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#7B6D5A',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionsRtl: {
    flexDirection: 'row-reverse',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  pulsePanel: {
    backgroundColor: '#FFF8F1',
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E6D8C7',
  },
  pulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pulseTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2C2418',
  },
  pulseSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#8A7A6A',
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statRowRtl: {
    flexDirection: 'row-reverse',
  },
  statPill: {
    flex: 1,
    minHeight: 82,
    borderRadius: 16,
    padding: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  statValue: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: '900',
    color: '#2C2418',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    color: '#8A7A6A',
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 24,
    fontSize: 14,
    color: '#2C2418',
    paddingVertical: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabRowRtl: {
    flexDirection: 'row-reverse',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#6B5D4E',
  },
  tabTextActive: {
    color: '#fff',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  postUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7D8C3',
  },
  postUserCopy: {
    flexShrink: 1,
  },
  postUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  postHandle: {
    fontSize: 12,
    color: '#8A7A6A',
    marginTop: 2,
  },
  recapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F6E9DE',
  },
  recapBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#630E13',
  },
  postMediaWrap: {
    position: 'relative',
    height: 292,
  },
  postMedia: {
    width: '100%',
    height: '100%',
  },
  postMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 14,
  },
  postMediaMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mediaTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  postActionsRtl: {
    flexDirection: 'row-reverse',
  },
  actionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionClusterRtl: {
    flexDirection: 'row-reverse',
  },
  postBody: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 15,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C2418',
  },
  caption: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: '#43382C',
  },
  captionUser: {
    fontWeight: '800',
    color: '#2C2418',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 9,
  },
  commentHint: {
    fontSize: 13,
    color: '#8A7A6A',
  },
  locationLine: {
    flexShrink: 1,
    fontSize: 12,
    color: '#A18F7A',
  },
  planCard: {
    height: 330,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    backgroundColor: '#D4C6A4',
  },
  planImage: {
    width: '100%',
    height: '100%',
  },
  planOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
  },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  planUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  planHandle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: 'rgba(99,14,19,0.92)',
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  planBody: {
    marginTop: 'auto',
  },
  planTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    color: '#fff',
  },
  planDate: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#F0DCAA',
  },
  planVibe: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
  },
  planNote: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.9)',
  },
  planFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  planMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  planMetaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 52,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  emptyCopy: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#8A7A6A',
    textAlign: 'center',
  },
});
