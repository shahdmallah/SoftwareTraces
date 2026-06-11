import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { useLanguage } from '../contexts/LanguageContext';
import type { FeedItem } from '../data/activitySocial';

interface CommunityPostsSectionProps {
  posts: Array<Extract<FeedItem, { kind: 'recap' | 'plan' }>>;
  onOpenActivity?: () => void;
  onOpenProfile?: (profileId: string) => void;
}

function getRecapImages(post: Extract<FeedItem, { kind: 'recap' }>) {
  const candidates = post.photoUris?.length ? post.photoUris : post.image ? [post.image] : [];
  return candidates.filter((uri, index, collection) => Boolean(uri) && collection.indexOf(uri) === index);
}

export function CommunityPostsSection({ posts, onOpenActivity, onOpenProfile }: CommunityPostsSectionProps) {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <View style={styles.sectionCard}>
      <View style={[styles.sectionHeader, isArabic ? rtlRow : ltrRow]}>
        <View style={styles.sectionTitleGroup}>
          <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{t('detailCommunityTitle')}</Text>
          <Text style={[styles.sectionSubtitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? '\u0645\u0646\u0634\u0648\u0631\u0627\u062a \u0648\u062e\u0637\u0637 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631' : 'Posts and plans linked to this trail'}
          </Text>
        </View>
        {onOpenActivity ? (
          <Pressable style={styles.activityButton} onPress={onOpenActivity}>
            <Ionicons name="sparkles-outline" size={15} color="#630E13" />
          </Pressable>
        ) : null}
      </View>

      {posts.length ? (
        posts.map((post) =>
          post.kind === 'recap' ? (
            <View key={post.id} style={styles.recapCard}>
              <View style={[styles.postHeader, isArabic ? rtlRow : ltrRow]}>
                <Pressable
                  style={[styles.userRow, isArabic ? rtlRow : ltrRow]}
                  onPress={() => post.userId && onOpenProfile?.(post.userId)}
                  disabled={!post.userId}
                >
                  <Image source={{ uri: post.avatar }} style={styles.avatar} />
                  <View style={styles.userCopy}>
                    <Text style={[styles.userName, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                      {post.user}
                    </Text>
                    <Text style={[styles.handle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                      {post.handle} - {isArabic ? post.timeAr : post.timeEn}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.typeBadge}>
                  <Ionicons name="footsteps-outline" size={12} color="#630E13" />
                  <Text style={styles.typeBadgeText}>{isArabic ? '\u0631\u062d\u0644\u0629' : 'Recap'}</Text>
                </View>
              </View>

              {(() => {
                const recapImages = getRecapImages(post);

                if (!recapImages.length) {
                  return null;
                }

                return (
                  <View style={styles.mediaWrap}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.mediaCarouselContent}
                    >
                      {recapImages.map((imageUri, imageIndex) => (
                        <View
                          key={`${post.id}-${imageUri}-${imageIndex}`}
                          style={[styles.mediaCard, imageIndex === recapImages.length - 1 ? styles.mediaCardLast : null]}
                        >
                          <Image source={{ uri: imageUri }} style={styles.media} />
                          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.mediaOverlay}>
                            <View style={styles.mediaTags}>
                              <View style={styles.mediaTag}>
                                <Ionicons name="location-outline" size={12} color="#fff" />
                                <Text style={styles.mediaTagText} numberOfLines={1}>
                                  {isArabic ? post.trailNameAr : post.trailNameEn}
                                </Text>
                              </View>
                              <View style={styles.mediaTag}>
                                <Ionicons name="walk-outline" size={12} color="#fff" />
                                <Text style={styles.mediaTagText}>{post.distance}</Text>
                              </View>
                              {recapImages.length > 1 ? (
                                <View style={styles.mediaTag}>
                                  <Ionicons name="images-outline" size={12} color="#fff" />
                                  <Text style={styles.mediaTagText}>
                                    {imageIndex + 1}/{recapImages.length}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </LinearGradient>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              <View style={styles.postBody}>
                <Text style={[styles.caption, isArabic ? rtlText : ltrText]} numberOfLines={3}>
                  <Text style={styles.captionUser}>{post.user} </Text>
                  {isArabic ? post.captionAr : post.captionEn}
                </Text>
                <View style={[styles.actionRow, isArabic ? rtlRow : ltrRow]}>
                  <View style={[styles.actionCluster, isArabic ? rtlRow : ltrRow]}>
                    <Ionicons name="heart" size={17} color="#C5333A" />
                    <Text style={styles.actionText}>{post.likes}</Text>
                    <Ionicons name="chatbubble-outline" size={16} color="#2C2418" />
                    <Text style={styles.actionText}>{post.comments}</Text>
                  </View>
                  <Text style={[styles.regionText, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                    {isArabic ? post.regionAr : post.regionEn}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View key={post.id} style={styles.planCard}>
              <Image source={{ uri: post.cover }} style={styles.planImage} />
              <LinearGradient colors={['rgba(20,12,8,0.08)', 'rgba(20,12,8,0.76)']} style={styles.planOverlay}>
                <View style={[styles.postHeader, isArabic ? rtlRow : ltrRow]}>
                  <Pressable
                    style={[styles.userRow, isArabic ? rtlRow : ltrRow]}
                    onPress={() => post.userId && onOpenProfile?.(post.userId)}
                    disabled={!post.userId}
                  >
                    <Image source={{ uri: post.avatar }} style={styles.avatar} />
                    <View style={styles.userCopy}>
                      <Text style={[styles.planUser, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                        {post.user}
                      </Text>
                      <Text style={[styles.planHandle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                        {post.handle}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.planBadge}>
                    <Ionicons name="calendar" size={12} color="#fff" />
                    <Text style={styles.planBadgeText}>{isArabic ? '\u0644\u0642\u0627\u0621' : 'Meetup'}</Text>
                  </View>
                </View>

                <View style={styles.planBody}>
                  <Text style={[styles.planTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                    {isArabic ? post.destinationAr : post.destinationEn}
                  </Text>
                  <Text style={[styles.planDate, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                    {isArabic ? post.dateAr : post.dateEn}
                  </Text>
                  <Text style={[styles.planNote, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                    {isArabic ? post.noteAr : post.noteEn}
                  </Text>
                  <View style={[styles.planMetaRow, isArabic ? rtlRow : ltrRow]}>
                    <View style={styles.planMetaPill}>
                      <Ionicons name="people-outline" size={13} color="#fff" />
                      <Text style={styles.planMetaText}>{isArabic ? `${post.peopleJoined} \u0645\u0646\u0636\u0645\u0648\u0646` : `${post.peopleJoined} joined`}</Text>
                    </View>
                    <View style={styles.planMetaPill}>
                      <Ionicons name="sparkles-outline" size={13} color="#fff" />
                      <Text style={styles.planMetaText}>{isArabic ? `${post.spotsLeft} \u0623\u0645\u0627\u0643\u0646` : `${post.spotsLeft} spots`}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          ),
        )
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={24} color="#8A7A6A" />
          <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u0634\u0648\u0631\u0627\u062a \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 \u0628\u0639\u062f' : 'No posts for this trail yet'}
          </Text>
          <Text style={[styles.emptyCopy, isArabic ? rtlText : ltrText]}>
            {isArabic ? '\u0639\u0646\u062f \u0645\u0634\u0627\u0631\u0643\u0629 \u0631\u062d\u0644\u0629 \u0623\u0648 \u062e\u0637\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 \u0633\u062a\u0638\u0647\u0631 \u0647\u0646\u0627.' : 'Shared recaps and meetups for this trail will appear here.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitleGroup: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#8A7A6A',
  },
  activityButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  recapCard: {
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#F6F0E0',
    marginTop: 10,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  userRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E7D8C3',
  },
  userCopy: {
    flex: 1,
  },
  userName: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
  },
  handle: {
    marginTop: 2,
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '700',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#FFF8F1',
  },
  typeBadgeText: {
    color: '#630E13',
    fontSize: 11,
    fontWeight: '900',
  },
  mediaWrap: {
    height: 190,
    position: 'relative',
  },
  mediaCarouselContent: {
    paddingHorizontal: 12,
  },
  mediaCard: {
    width: 250,
    height: 190,
    marginRight: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E7D8C3',
  },
  mediaCardLast: {
    marginRight: 0,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  mediaTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  mediaTag: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mediaTagText: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  postBody: {
    padding: 12,
  },
  caption: {
    color: '#4A4131',
    fontSize: 14,
    lineHeight: 20,
  },
  captionUser: {
    color: '#2C2418',
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  actionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '900',
  },
  regionText: {
    flexShrink: 1,
    color: '#8A7A6A',
    fontSize: 12,
    fontWeight: '700',
  },
  planCard: {
    height: 250,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#D4C6A4',
    marginTop: 10,
  },
  planImage: {
    width: '100%',
    height: '100%',
  },
  planOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  planUser: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  planHandle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    fontWeight: '700',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: 'rgba(99,14,19,0.92)',
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  planBody: {
    padding: 14,
  },
  planTitle: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  planDate: {
    marginTop: 7,
    color: '#F0DCAA',
    fontSize: 12,
    fontWeight: '900',
  },
  planNote: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 19,
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  planMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  planMetaText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 14,
  },
  emptyTitle: {
    marginTop: 10,
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyCopy: {
    marginTop: 5,
    color: '#8A7A6A',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
