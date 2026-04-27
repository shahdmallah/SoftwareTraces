import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { feedItems, type FeedItem } from '../data/activitySocial';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ActivityNavigationProp = StackNavigationProp<RootStackParamList>;
type FeedTab = 'all' | 'recaps' | 'plans';

const tabLabels: Record<FeedTab, { en: string; ar: string; icon: keyof typeof Ionicons.glyphMap }> = {
  all: { en: 'For you', ar: 'لك', icon: 'sparkles-outline' },
  recaps: { en: 'Trail posts', ar: 'منشورات المسارات', icon: 'images-outline' },
  plans: { en: 'Future plans', ar: 'خطط قادمة', icon: 'calendar-outline' },
};

export function ActivityScreen() {
  const navigation = useNavigation<ActivityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFeed = useMemo(() => {
    let items: FeedItem[] = feedItems;

    if (activeTab === 'recaps') {
      items = feedItems.filter((item) => item.kind === 'recap');
    } else if (activeTab === 'plans') {
      items = feedItems.filter((item) => item.kind === 'plan');
    }

    if (!normalizedQuery) return items;

    return items.filter((item) => {
      if (item.kind === 'recap') {
        return [
          item.user,
          item.handle,
          item.trailNameEn,
          item.trailNameAr,
          item.regionEn,
          item.regionAr,
          item.captionEn,
          item.captionAr,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }

      return [
        item.user,
        item.handle,
        item.destinationEn,
        item.destinationAr,
        item.vibeEn,
        item.vibeAr,
        item.noteEn,
        item.noteAr,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [activeTab, normalizedQuery]);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.pageTitle, isArabic ? rtlText : ltrText]}>{t('tabActivity')}</Text>
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

        {searchOpen ? (
          <AnimatedBlock delay={80}>
            <View style={styles.searchCard}>
              <View style={[styles.searchRow, isArabic ? rtlRow : ltrRow]}>
                <Ionicons name="search-outline" size={18} color="#8A7A6A" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={isArabic ? 'ابحث عن أصدقاء أو نشاطات أو خطط' : 'Search friends, activities, or plans'}
                  placeholderTextColor="#A18F7A"
                  style={[styles.searchInput, isArabic ? rtlText : ltrText]}
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

        <AnimatedBlock delay={120}>
          <View style={[styles.tabRow, isArabic && styles.tabRowRtl]}>
            {(Object.keys(tabLabels) as FeedTab[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable key={tab} style={[styles.tabButton, active && styles.tabButtonActive]} onPress={() => setActiveTab(tab)}>
                  <Ionicons name={tabLabels[tab].icon} size={15} color={active ? '#fff' : '#6B5D4E'} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{isArabic ? tabLabels[tab].ar : tabLabels[tab].en}</Text>
                </Pressable>
              );
            })}
          </View>
        </AnimatedBlock>

        {filteredFeed.map((item, index) => (
          <AnimatedBlock key={item.id} delay={150 + index * 45}>
            {item.kind === 'recap' ? (
              <View style={styles.postCard}>
                <View style={[styles.postHeader, isArabic ? rtlRow : ltrRow]}>
                  <View style={[styles.postUserRow, isArabic ? rtlRow : ltrRow]}>
                    <Image source={{ uri: item.avatar }} style={styles.postAvatar} />
                    <View style={styles.postUserCopy}>
                      <Text style={[styles.postUserName, isArabic ? rtlText : ltrText]}>{item.user}</Text>
                      <Text style={[styles.postHandle, isArabic ? rtlText : ltrText]}>
                        {item.handle} · {isArabic ? item.timeAr : item.timeEn}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => navigation.navigate('TrailDetail', { trailId: item.trailId })}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#7B6D5A" />
                  </Pressable>
                </View>

                <Pressable style={styles.postMediaWrap} onPress={() => navigation.navigate('TrailDetail', { trailId: item.trailId })}>
                  <Image source={{ uri: item.image }} style={styles.postMedia} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.postMediaOverlay}>
                    <View style={styles.postMediaMeta}>
                      <View style={styles.mediaTag}>
                        <Ionicons name="location-outline" size={13} color="#fff" />
                        <Text style={styles.mediaTagText}>{isArabic ? item.trailNameAr : item.trailNameEn}</Text>
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
                    <Ionicons name="paper-plane-outline" size={19} color="#2C2418" />
                  </View>
                  <Ionicons name="bookmark-outline" size={19} color="#2C2418" />
                </View>

                <View style={styles.postBody}>
                  <Text style={[styles.likeCount, isArabic ? rtlText : ltrText]}>
                    {isArabic ? `${item.likes} إعجاب` : `${item.likes} likes`}
                  </Text>
                  <Text style={[styles.caption, isArabic ? rtlText : ltrText]}>
                    <Text style={styles.captionUser}>{item.user} </Text>
                    {isArabic ? item.captionAr : item.captionEn}
                  </Text>
                  <Text style={[styles.commentHint, isArabic ? rtlText : ltrText]}>
                    {isArabic ? `عرض ${item.comments} تعليقاً` : `View all ${item.comments} comments`}
                  </Text>
                  <Text style={[styles.locationLine, isArabic ? rtlText : ltrText]}>
                    {isArabic ? item.regionAr : item.regionEn}
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable style={styles.planCard} onPress={() => navigation.navigate('TrailDetail', { trailId: item.trailId })}>
                <Image source={{ uri: item.cover }} style={styles.planImage} />
                <LinearGradient colors={['rgba(15,10,7,0.08)', 'rgba(15,10,7,0.72)']} style={styles.planOverlay}>
                  <View style={[styles.planTopRow, isArabic ? rtlRow : ltrRow]}>
                    <View style={[styles.postUserRow, isArabic ? rtlRow : ltrRow]}>
                      <Image source={{ uri: item.avatar }} style={styles.postAvatar} />
                      <View style={styles.postUserCopy}>
                        <Text style={[styles.planUserName, isArabic ? rtlText : ltrText]}>{item.user}</Text>
                        <Text style={[styles.planHandle, isArabic ? rtlText : ltrText]}>{item.handle}</Text>
                      </View>
                    </View>
                    <View style={styles.planBadge}>
                      <Ionicons name="calendar" size={13} color="#fff" />
                      <Text style={styles.planBadgeText}>{isArabic ? 'خطة' : 'Plan'}</Text>
                    </View>
                  </View>

                  <View style={styles.planBody}>
                    <Text style={[styles.planTitle, isArabic ? rtlText : ltrText]}>
                      {isArabic ? item.destinationAr : item.destinationEn}
                    </Text>
                    <Text style={[styles.planDate, isArabic ? rtlText : ltrText]}>
                      {isArabic ? item.dateAr : item.dateEn}
                    </Text>
                    <Text style={[styles.planVibe, isArabic ? rtlText : ltrText]}>
                      {isArabic ? item.vibeAr : item.vibeEn}
                    </Text>
                    <Text style={[styles.planNote, isArabic ? rtlText : ltrText]}>
                      {isArabic ? item.noteAr : item.noteEn}
                    </Text>

                    <View style={[styles.planFooter, isArabic ? rtlRow : ltrRow]}>
                      <View style={styles.planMetaPill}>
                        <Ionicons name="people-outline" size={14} color="#fff" />
                        <Text style={styles.planMetaText}>
                          {isArabic ? `${item.peopleJoined} منضمون` : `${item.peopleJoined} joined`}
                        </Text>
                      </View>
                      <View style={styles.planMetaPill}>
                        <Ionicons name="sparkles-outline" size={14} color="#fff" />
                        <Text style={styles.planMetaText}>
                          {isArabic ? `${item.spotsLeft} أماكن متبقية` : `${item.spotsLeft} spots left`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
          </AnimatedBlock>
        ))}
      </ScrollView>
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
    gap: 8,
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
  searchCard: {
    backgroundColor: '#FFF8F1',
    borderRadius: 22,
    padding: 14,
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
    gap: 10,
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
    gap: 6,
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B5D4E',
  },
  tabTextActive: {
    color: '#fff',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
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
  postMediaWrap: {
    position: 'relative',
    height: 330,
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mediaTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
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
    paddingBottom: 16,
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
  commentHint: {
    marginTop: 7,
    fontSize: 13,
    color: '#8A7A6A',
  },
  locationLine: {
    marginTop: 5,
    fontSize: 12,
    color: '#A18F7A',
  },
  planCard: {
    height: 360,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
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
    backgroundColor: 'rgba(99,14,19,0.9)',
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
    fontSize: 24,
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
});
