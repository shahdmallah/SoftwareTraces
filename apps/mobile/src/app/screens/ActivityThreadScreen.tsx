import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { friends, messageThreads } from '../data/activitySocial';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ThreadRouteProp = RouteProp<RootStackParamList, 'ActivityThread'>;
type ThreadNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityThread'>;

export function ActivityThreadScreen() {
  const route = useRoute<ThreadRouteProp>();
  const navigation = useNavigation<ThreadNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [draft, setDraft] = useState('');

  const thread = messageThreads.find((item) => item.id === route.params.threadId);
  const friend = friends.find((item) => item.id === (route.params.friendId ?? thread?.friendId)) ?? friends[0];

  const messages = useMemo(
    () => [
      {
        id: 'm1',
        mine: false,
        bodyEn: thread?.previewEn ?? friend.statusEn,
        bodyAr: thread?.previewAr ?? friend.statusAr,
        time: thread?.time ?? 'Now',
      },
      {
        id: 'm2',
        mine: true,
        bodyEn: 'That sounds perfect. Send me the trail and best meeting point.',
        bodyAr: 'ممتاز. أرسل لي المسار وأفضل نقطة لقاء.',
        time: 'Now',
      },
    ],
    [friend.statusAr, friend.statusEn, thread?.previewAr, thread?.previewEn, thread?.time],
  );

  return (
    <AnimatedScreen style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }, isArabic ? rtlRow : ltrRow]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
        </Pressable>
        <Image source={{ uri: friend.avatar }} style={styles.avatar} />
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {friend.name}
          </Text>
          <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {friend.handle}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {messages.map((message, index) => (
          <AnimatedBlock key={message.id} delay={70 + index * 45}>
            <View style={[styles.bubble, message.mine ? styles.myBubble : styles.theirBubble]}>
              <Text style={[styles.bubbleText, message.mine && styles.myBubbleText, isArabic ? rtlText : ltrText]}>
                {isArabic ? message.bodyAr : message.bodyEn}
              </Text>
              <Text style={[styles.timeText, message.mine && styles.myTimeText]}>{message.time}</Text>
            </View>
          </AnimatedBlock>
        ))}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom + 8) }, isArabic ? rtlRow : ltrRow]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={isArabic ? 'اكتب رسالة...' : 'Write a message...'}
          placeholderTextColor="#A18F7A"
          style={[styles.input, isArabic ? rtlText : ltrText]}
        />
        <Pressable style={styles.sendButton} onPress={() => setDraft('')}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF8F1',
    borderBottomWidth: 1,
    borderBottomColor: '#E7D8C3',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  headerCopy: { flex: 1 },
  title: { color: '#2C2418', fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#8A7A6A', fontSize: 12 },
  messages: { padding: 16, gap: 12 },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#630E13',
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: '#2C2418', fontSize: 14, lineHeight: 20 },
  myBubbleText: { color: '#FFFFFF' },
  timeText: { marginTop: 5, color: '#8A7A6A', fontSize: 10, fontWeight: '700' },
  myTimeText: { color: 'rgba(255,255,255,0.65)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFF8F1',
    borderTopWidth: 1,
    borderTopColor: '#E7D8C3',
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    color: '#2C2418',
    fontSize: 14,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
});
