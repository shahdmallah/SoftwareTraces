import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { followUser, getFriendSuggestions, getMyFriends, type FriendSuggestion, type SocialProfile } from '../api/socialApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type MessagesNavigationProp = StackNavigationProp<RootStackParamList>;

export function ActivityMessagesScreen() {
  const navigation = useNavigation<MessagesNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<SocialProfile[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setContacts([]);
      setSuggestions([]);
      setIsLoadingContacts(false);
      return () => {
        cancelled = true;
      };
    }

    const loadContacts = async () => {
      setIsLoadingContacts(true);
      try {
        const [friendsResponse, suggestionsResponse] = await Promise.all([
          getMyFriends({ page: 1, limit: 40 }).catch(() => ({ data: [] as SocialProfile[] })),
          getFriendSuggestions({ page: 1, limit: 12 }).catch(() => ({ data: [] as FriendSuggestion[] })),
        ]);
        if (!cancelled) {
          setContacts(friendsResponse.data);
          setSuggestions(suggestionsResponse.data);
        }
      } catch {
        if (!cancelled) {
          setContacts([]);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingContacts(false);
        }
      }
    };

    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filteredFriends = useMemo(() => {
    if (!normalizedQuery) return contacts;
    return contacts.filter((friend) => [friend.full_name].some((value) => value.toLowerCase().includes(normalizedQuery)));
  }, [contacts, normalizedQuery]);

  const filteredSuggestions = useMemo(() => {
    if (!normalizedQuery) return suggestions;
    return suggestions.filter((friend) => friend.full_name.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, suggestions]);

  const filteredThreads = useMemo(() => {
    return filteredFriends;
  }, [filteredFriends]);

  const handleFollowSuggestion = async (friend: FriendSuggestion) => {
    if (pendingSuggestionId) {
      return;
    }

    setPendingSuggestionId(friend.id);
    try {
      await followUser(friend.id);
      setSuggestions((current) => current.filter((item) => item.id !== friend.id));
    } catch {
      // Keep the suggestion in place so the user can try again.
    } finally {
      setPendingSuggestionId(null);
    }
  };

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
            <View style={[styles.headerSide, isArabic ? rtlRow : ltrRow]}>
              <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
                <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
              </Pressable>
              <View>
                <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'الرسائل' : 'Messages'}</Text>
              </View>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={80}>
          <View style={styles.searchCard}>
            <View style={[styles.searchRow, isArabic ? rtlRow : ltrRow]}>
              <Ionicons name="search-outline" size={18} color="#8A7A6A" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={isArabic ? 'ابحث عن صديق أو رسالة' : 'Search friends or messages'}
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

        <AnimatedBlock delay={110}>
          <View style={[styles.sectionRow, isArabic ? rtlRow : ltrRow]}>
            <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'أصدقاء للمراسلة' : 'Friends to message'}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.friendsRow, isArabic && styles.friendsRowRtl]}
          >
            {isLoadingContacts ? (
              <View style={styles.inlineStateCard}>
                <ActivityIndicator color="#630E13" />
                <Text style={[styles.inlineStateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'Loading...' : 'Loading friends...'}
                </Text>
              </View>
            ) : filteredFriends.length ? filteredFriends.map((friend) => (
              <View key={friend.id} style={styles.friendCard}>
                <Image source={{ uri: friend.avatar_url ?? '' }} style={styles.friendAvatar} />
                <Text numberOfLines={1} style={[styles.friendName, isArabic ? rtlText : ltrText]}>{friend.full_name}</Text>
                <Text numberOfLines={1} style={[styles.friendHandle, isArabic ? rtlText : ltrText]}>@{friend.full_name.toLowerCase().replace(/\s+/g, '.')}</Text>
                <Text numberOfLines={2} style={[styles.friendStatus, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'متاح للمراسلة' : 'Available to message'}
                </Text>
                <Pressable style={styles.messageButton} onPress={() => navigation.navigate('ActivityThread', { friendId: friend.id })}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#fff" />
                  <Text style={styles.messageButtonText}>{isArabic ? 'مراسلة' : 'Message'}</Text>
                </Pressable>
              </View>
            )) : (
              <View style={styles.inlineStateCard}>
                <Ionicons name="people-outline" size={24} color="#8A7A6A" />
                <Text style={[styles.inlineStateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'No mutual friends yet.' : 'No mutual friends yet.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </AnimatedBlock>

        {filteredSuggestions.length ? (
          <AnimatedBlock delay={125}>
            <View style={[styles.sectionRow, isArabic ? rtlRow : ltrRow]}>
              <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'Suggestions' : 'Suggested hikers'}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.friendsRow, isArabic && styles.friendsRowRtl]}
            >
              {filteredSuggestions.map((friend) => (
                <View key={friend.id} style={styles.suggestionCard}>
                  <Image source={{ uri: friend.avatar_url ?? '' }} style={styles.friendAvatar} />
                  <Text numberOfLines={1} style={[styles.friendName, isArabic ? rtlText : ltrText]}>{friend.full_name}</Text>
                  <Text numberOfLines={2} style={[styles.friendStatus, isArabic ? rtlText : ltrText]}>
                    {friend.mutual_following_count > 0
                      ? `${friend.mutual_following_count} mutual follows`
                      : 'Recommended for your trail network'}
                  </Text>
                  <Pressable
                    style={styles.followSuggestionButton}
                    onPress={() => void handleFollowSuggestion(friend)}
                    disabled={pendingSuggestionId === friend.id}
                  >
                    {pendingSuggestionId === friend.id ? (
                      <ActivityIndicator size="small" color="#630E13" />
                    ) : (
                      <>
                        <Ionicons name="person-add-outline" size={14} color="#630E13" />
                        <Text style={styles.followSuggestionText}>{isArabic ? 'Follow' : 'Follow'}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </AnimatedBlock>
        ) : null}

        <AnimatedBlock delay={140}>
          <View style={styles.messagesCard}>
            <View style={[styles.sectionRow, isArabic ? rtlRow : ltrRow]}>
              <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'آخر المحادثات' : 'Recent chats'}</Text>
            </View>
            {filteredThreads.length ? filteredThreads.map((thread, index) => (
              <Pressable
                key={thread.id}
                style={[styles.threadRow, isArabic ? rtlRow : ltrRow, index === 0 && styles.threadRowFirst]}
                onPress={() => navigation.navigate('ActivityThread', { friendId: thread.id })}
              >
                <Image source={{ uri: thread.avatar_url ?? '' }} style={styles.threadAvatar} />
                <View style={styles.threadBody}>
                  <View style={[styles.threadTopRow, isArabic ? rtlRow : ltrRow]}>
                    <Text style={[styles.threadName, isArabic ? rtlText : ltrText]}>{thread.full_name}</Text>
                    <Text style={styles.threadTime}>{isArabic ? 'الآن' : 'Now'}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.threadPreview, isArabic ? rtlText : ltrText]}>
                    {isArabic ? 'ابدأ محادثة جديدة' : 'Start a new conversation'}
                  </Text>
                </View>
              </Pressable>
            )) : (
              <View style={styles.emptyThreadState}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#8A7A6A" />
                <Text style={[styles.inlineStateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'Mutual friends you message will appear here.' : 'Mutual friends you message will appear here.'}
                </Text>
              </View>
            )}
          </View>
        </AnimatedBlock>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: '#2C2418',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7B6D5A',
  },
  searchCard: {
    backgroundColor: '#FFF8F1',
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2418',
  },
  friendsRow: {
    gap: 12,
    paddingBottom: 8,
    marginBottom: 16,
  },
  friendsRowRtl: {
    flexDirection: 'row-reverse',
  },
  friendCard: {
    width: 176,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
  },
  suggestionCard: {
    width: 176,
    backgroundColor: '#FFF8F1',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  friendAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  friendName: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#2C2418',
  },
  friendHandle: {
    marginTop: 4,
    fontSize: 12,
    color: '#8A7A6A',
  },
  friendStatus: {
    marginTop: 8,
    minHeight: 36,
    fontSize: 12,
    lineHeight: 18,
    color: '#5A4F41',
  },
  messageButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 11,
    backgroundColor: '#630E13',
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  followSuggestionButton: {
    marginTop: 12,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: '#F7EBE8',
  },
  followSuggestionText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  inlineStateCard: {
    width: 220,
    minHeight: 150,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  inlineStateText: {
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  messagesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
  },
  emptyThreadState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1E5D8',
  },
  threadRowFirst: {
    borderTopWidth: 0,
    paddingTop: 4,
  },
  threadAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  threadBody: {
    flex: 1,
  },
  threadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  threadName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  threadTime: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  threadPreview: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B5D4E',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
});
