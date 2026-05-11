import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ListRenderItem, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { getSocialFeed } from '../api/socialApi';
import { type FeedItem } from '../data/activitySocial';
import { getLocalFeedItems } from '../data/localSocial';
import { mapSocialFeedItemToFeedItem } from '../utils/socialFeedMap';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ActivityNavigationProp = StackNavigationProp<RootStackParamList>;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesQuery(item: FeedItem, query: string): boolean {
  if (!query) return true;

  const values =
    item.kind === 'recap'
      ? [
          item.user,
          item.handle,
          item.trailNameEn,
          item.trailNameAr,
          item.regionEn,
          item.regionAr,
          item.captionEn,
          item.captionAr,
          item.distance,
        ]
      : [item.user, item.handle, item.destinationEn, item.destinationAr, item.vibeEn, item.vibeAr, item.noteEn, item.noteAr];

  return values.some((value) => normalize(value).includes(query));
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

// ─── Shared card header ───────────────────────────────────────────────────────
type CardHeaderProps = {
  avatar: string;
  user: string;
  handle: string;
  timeEn?: string;
  timeAr?: string;
  isArabic: boolean;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  badgeLabelEn: string;
  badgeLabelAr: string;
  badgeStyle: 'hike' | 'meetup';
};

const CardHeader = memo(function CardHeader({
  avatar,
  user,
  handle,
  timeEn,
  timeAr,
  isArabic,
  badgeIcon,
  badgeLabelEn,
  badgeLabelAr,
  badgeStyle,
}: CardHeaderProps) {
  const meta = [handle, timeEn || timeAr ? (isArabic ? timeAr : timeEn) : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.cardHeader, isArabic ? rtlRow : ltrRow]}>
      <View style={[styles.userRow, isArabic ? rtlRow : ltrRow]}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {user}
          </Text>
          <Text style={[styles.userMeta, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      <View style={[styles.badge, badgeStyle === 'hike' ? styles.badgeHike : styles.badgeMeetup]}>
        <Ionicons name={badgeIcon} size={13} color={badgeStyle === 'hike' ? '#630E13' : '#fff'} />
        <Text style={[styles.badgeText, badgeStyle === 'hike' ? styles.badgeTextHike : styles.badgeTextMeetup]}>
          {isArabic ? badgeLabelAr : badgeLabelEn}
        </Text>
      </View>
    </View>
  );
});

// ─── Recap card ──────────────────────────────────────────────────────────────
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
    <View style={styles.card}>
      <CardHeader
        avatar={item.avatar}
        user={item.user}
        handle={item.handle}
        timeEn={item.timeEn}
        timeAr={item.timeAr}
        isArabic={isArabic}
        badgeIcon="walk-outline"
        badgeLabelEn="Hike"
        badgeLabelAr="رحلة"
        badgeStyle="hike"
      />

      <Pressable style={styles.mediaWrap} onPress={() => onOpenTrail(item.trailId)}>
        <Image source={{ uri: item.image }} style={styles.media} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.62)']} style={styles.mediaOverlay}>
          <View style={styles.mediaTags}>
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

      <View style={[styles.actions, isArabic && styles.actionsRtl]}>
        <View style={[styles.actionGroup, isArabic && styles.actionGroupRtl]}>
          <Ionicons name="heart" size={20} color="#C5333A" />
          <Ionicons name="chatbubble-outline" size={19} color="#2C2418" />
          <Ionicons name="navigate-outline" size={19} color="#2C2418" />
        </View>
        <Pressable onPress={() => onOpenTrail(item.trailId)}>
          <Ionicons name="map-outline" size={19} color="#2C2418" />
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.likeCount, isArabic ? rtlText : ltrText]}>
          {isArabic ? `${item.likes} إعجاب` : `${item.likes} likes`}
        </Text>
        <Text style={[styles.caption, isArabic ? rtlText : ltrText]} numberOfLines={3}>
          <Text style={styles.captionUser}>{item.user} </Text>
          {isArabic ? item.captionAr : item.captionEn}
        </Text>
        <View style={[styles.cardFooter, isArabic ? rtlRow : ltrRow]}>
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

// ─── Plan / meetup card ───────────────────────────────────────────────────────
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
    <Pressable style={styles.card} onPress={() => onOpenTrail(item.trailId)}>
      <CardHeader
        avatar={item.avatar}
        user={item.user}
        handle={item.handle}
        isArabic={isArabic}
        badgeIcon="calendar"
        badgeLabelEn="Meetup"
        badgeLabelAr="لقاء"
        badgeStyle="meetup"
      />

      {/* Full-bleed cover with event details overlaid */}
      <View style={styles.meetupCover}>
        <Image source={{ uri: item.cover }} style={styles.meetupImage} resizeMode="cover" />
        <LinearGradient colors={['rgba(15,10,7,0.05)', 'rgba(15,10,7,0.78)']} style={styles.meetupOverlay}>
          <View style={styles.meetupBody}>
            <Text style={[styles.meetupTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
              {isArabic ? item.destinationAr : item.destinationEn}
            </Text>
            <Text style={[styles.meetupDate, isArabic ? rtlText : ltrText]} numberOfLines={1}>
              {isArabic ? item.dateAr : item.dateEn}
            </Text>
            <Text style={[styles.meetupVibe, isArabic ? rtlText : ltrText]} numberOfLines={1}>
              {isArabic ? item.vibeAr : item.vibeEn}
            </Text>
            <Text style={[styles.meetupNote, isArabic ? rtlText : ltrText]} numberOfLines={2}>
              {isArabic ? item.noteAr : item.noteEn}
            </Text>
            <View style={[styles.meetupPills, isArabic ? rtlRow : ltrRow]}>
              <View style={styles.pill}>
                <Ionicons name="people-outline" size={14} color="#fff" />
                <Text style={styles.pillText}>{isArabic ? `${item.peopleJoined} منضمون` : `${item.peopleJoined} joined`}</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="sparkles-outline" size={14} color="#fff" />
                <Text style={styles.pillText}>{isArabic ? `${item.spotsLeft} أماكن` : `${item.spotsLeft} spots`}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export function ActivityScreen() {
  const navigation = useNavigation<ActivityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteRecaps, setRemoteRecaps] = useState<FeedItem[]>([]);
  const [localFeedItems, setLocalFeedItems] = useState<FeedItem[]>([]);
  const [hasLoadedRemoteFeed, setHasLoadedRemoteFeed] = useState(false);

  const normalizedQuery = useMemo(() => normalize(searchQuery), [searchQuery]);

  const feedData = useMemo(() => {
    if (!isAuthenticated) return localFeedItems;
    return [...localFeedItems, ...remoteRecaps];
  }, [hasLoadedRemoteFeed, isAuthenticated, localFeedItems, remoteRecaps]);

  useFocusEffect(
    useCallback(() => {
      setLocalFeedItems(getLocalFeedItems());
    }, []),
  );

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setRemoteRecaps([]);
      setHasLoadedRemoteFeed(false);
      return () => { cancelled = true; };
    }

    const loadFeed = async () => {
      try {
        const response = await getSocialFeed({ page: 1, limit: 30 });
        if (!cancelled) {
          setRemoteRecaps(response.data.map(mapSocialFeedItemToFeedItem));
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
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const filteredFeed = useMemo(
    () => feedData.filter((item) => matchesQuery(item, normalizedQuery)),
    [feedData, normalizedQuery],
  );

  const handleOpenTrail = useCallback(
    (trailId: string) => navigation.navigate('TrailDetail', { trailId }),
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<FeedItem>>(
    ({ item, index }) => <FeedCard item={item} index={index} isArabic={isArabic} onOpenTrail={handleOpenTrail} />,
    [handleOpenTrail, isArabic],
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
                {isArabic
                  ? 'رحلات الأصدقاء، اللقاءات القريبة، وإلهام المسار التالي.'
                  : 'Friend hikes, nearby meetups, and ideas for your next trail.'}
              </Text>
            </View>

            <View style={[styles.headerActions, isArabic && styles.headerActionsRtl]}>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('ActivityShare')}>
                <Ionicons name="add-circle-outline" size={20} color="#2C2418" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate('ActivityMessages')}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#2C2418" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => setSearchOpen((v) => !v)}>
                <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={20} color="#2C2418" />
              </Pressable>
            </View>
          </View>
        </AnimatedBlock>

        {searchOpen ? (
          <AnimatedBlock delay={60}>
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
                  autoFocus
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
      </View>
    ),
    [isArabic, navigation, searchOpen, searchQuery, t],
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
            <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'لا توجد نتائج' : 'No trail moments found'}
            </Text>
            <Text style={[styles.emptyCopy, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'جرّب بحثاً آخر.' : 'Try a different search.'}
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

  // ─── Header ────────────────────────────────────────────────────────────────
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

  // ─── Search ────────────────────────────────────────────────────────────────
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

  // ─── Unified card shell ────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 3,
  },

  // ─── Shared card header ────────────────────────────────────────────────────
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EAE0',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E7D8C3',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  userMeta: {
    fontSize: 11,
    color: '#8A7A6A',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  badgeHike: {
    backgroundColor: '#F6E9DE',
  },
  badgeMeetup: {
    backgroundColor: '#630E13',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTextHike: {
    color: '#630E13',
  },
  badgeTextMeetup: {
    color: '#fff',
  },

  // ─── Recap media ───────────────────────────────────────────────────────────
  mediaWrap: {
    height: 240,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 14,
  },
  mediaTags: {
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
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mediaTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },

  // ─── Recap actions + body ──────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  actionsRtl: {
    flexDirection: 'row-reverse',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionGroupRtl: {
    flexDirection: 'row-reverse',
  },
  cardBody: {
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
  cardFooter: {
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

  // ─── Meetup cover ──────────────────────────────────────────────────────────
  meetupCover: {
    height: 280,
    position: 'relative',
  },
  meetupImage: {
    width: '100%',
    height: '100%',
  },
  meetupOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  meetupBody: {},
  meetupTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    color: '#fff',
  },
  meetupDate: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '800',
    color: '#F0DCAA',
  },
  meetupVibe: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
  },
  meetupNote: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
  },
  meetupPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // ─── Empty state ───────────────────────────────────────────────────────────
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