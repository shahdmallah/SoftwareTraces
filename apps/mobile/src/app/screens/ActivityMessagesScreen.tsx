import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { friends, messageThreads } from '../data/activitySocial';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type MessagesNavigationProp = StackNavigationProp<RootStackParamList>;

export function ActivityMessagesScreen() {
  const navigation = useNavigation<MessagesNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFriends = useMemo(() => {
    if (!normalizedQuery) return friends;
    return friends.filter((friend) =>
      [friend.name, friend.handle, friend.statusEn, friend.statusAr].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery]);

  const filteredThreads = useMemo(() => {
    if (!normalizedQuery) return messageThreads;
    return messageThreads.filter((thread) =>
      [thread.name, thread.previewEn, thread.previewAr].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery]);

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
                <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'راسل أصدقاءك ورتب للرحلات القادمة' : 'Message friends and plan your next hikes'}
                </Text>
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
            {filteredFriends.map((friend) => (
              <View key={friend.id} style={styles.friendCard}>
                <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                <Text numberOfLines={1} style={[styles.friendName, isArabic ? rtlText : ltrText]}>{friend.name}</Text>
                <Text numberOfLines={1} style={[styles.friendHandle, isArabic ? rtlText : ltrText]}>{friend.handle}</Text>
                <Text numberOfLines={2} style={[styles.friendStatus, isArabic ? rtlText : ltrText]}>
                  {isArabic ? friend.statusAr : friend.statusEn}
                </Text>
                <Pressable style={styles.messageButton} onPress={() => navigation.navigate('ActivityThread', { friendId: friend.id })}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#fff" />
                  <Text style={styles.messageButtonText}>{isArabic ? 'مراسلة' : 'Message'}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </AnimatedBlock>

        <AnimatedBlock delay={140}>
          <View style={styles.messagesCard}>
            <View style={[styles.sectionRow, isArabic ? rtlRow : ltrRow]}>
              <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'آخر المحادثات' : 'Recent chats'}</Text>
            </View>
            {filteredThreads.map((thread, index) => (
              <Pressable
                key={thread.id}
                style={[styles.threadRow, isArabic ? rtlRow : ltrRow, index === 0 && styles.threadRowFirst]}
                onPress={() => navigation.navigate('ActivityThread', { threadId: thread.id, friendId: thread.friendId })}
              >
                <Image source={{ uri: thread.avatar }} style={styles.threadAvatar} />
                <View style={styles.threadBody}>
                  <View style={[styles.threadTopRow, isArabic ? rtlRow : ltrRow]}>
                    <Text style={[styles.threadName, isArabic ? rtlText : ltrText]}>{thread.name}</Text>
                    <Text style={styles.threadTime}>{thread.time}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.threadPreview, isArabic ? rtlText : ltrText]}>
                    {isArabic ? thread.previewAr : thread.previewEn}
                  </Text>
                </View>
                {thread.unread > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{thread.unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
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
  messagesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
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
