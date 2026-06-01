import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { listConversations, markConversationRead, type Conversation } from '../api/messagesApi';
import { getFriendSuggestions, getMyFriends, type FriendSuggestion, type SocialProfile } from '../api/socialApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type MessagesNavigationProp = StackNavigationProp<RootStackParamList>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
}

function formatConversationTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const ageMs = now - date.getTime();
  if (ageMs < 60_000) return 'Now';
  if (ageMs < 60 * 60_000) return `${Math.max(1, Math.floor(ageMs / 60_000))}m`;
  if (ageMs < 24 * 60 * 60_000) return `${Math.floor(ageMs / (60 * 60_000))}h`;

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function conversationTitle(conversation: Conversation, currentUserId?: string) {
  if (conversation.title?.trim()) return conversation.title.trim();
  if (conversation.context?.title?.trim()) return conversation.context.title.trim();

  const others = conversation.participants.filter((participant) => participant.id !== currentUserId);
  return others.map((participant) => participant.full_name).filter(Boolean).join(', ') || 'Conversation';
}

function conversationAvatar(conversation: Conversation, currentUserId?: string) {
  const other = conversation.participants.find((participant) => participant.id !== currentUserId);
  return other?.avatar_url ?? null;
}

function firstParticipant(conversation: Conversation, currentUserId?: string) {
  return conversation.participants.find((participant) => participant.id !== currentUserId);
}

function matchesQuery(conversation: Conversation, query: string, currentUserId?: string) {
  if (!query) return true;
  const haystack = [
    conversationTitle(conversation, currentUserId),
    conversation.context?.title,
    conversation.context?.subtitle,
    conversation.latest_message?.body,
    ...conversation.participants.map((participant) => participant.full_name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function ActivityMessagesScreen() {
  const navigation = useNavigation<MessagesNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<SocialProfile[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConversationApiReady, setIsConversationApiReady] = useState(true);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [nextConversations, friendsResponse, suggestionsResponse] = await Promise.all([
          listConversations({ page: 1, limit: 50 }).catch(() => {
            setIsConversationApiReady(false);
            return [] as Conversation[];
          }),
          getMyFriends({ page: 1, limit: 30 }).catch(() => ({ data: [] as SocialProfile[] })),
          getFriendSuggestions({ page: 1, limit: 10 }).catch(() => ({ data: [] as FriendSuggestion[] })),
        ]);

        if (!cancelled) {
          setConversations(nextConversations);
          setContacts(friendsResponse.data);
          setSuggestions(suggestionsResponse.data);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => matchesQuery(conversation, normalizedQuery, user?.id)),
    [conversations, normalizedQuery, user?.id],
  );

  const filteredContacts = useMemo(() => {
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) => contact.full_name.toLowerCase().includes(normalizedQuery));
  }, [contacts, normalizedQuery]);

  const filteredSuggestions = useMemo(() => {
    if (!normalizedQuery) return suggestions;
    return suggestions.filter((contact) => contact.full_name.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, suggestions]);

  const openConversation = (conversation: Conversation) => {
    void markConversationRead(conversation.id).catch(() => undefined);
    const participant = firstParticipant(conversation, user?.id);
    navigation.navigate('ActivityThread', {
      conversationId: conversation.id,
      participantId: participant?.id,
      participantName: conversationTitle(conversation, user?.id),
      participantAvatar: conversationAvatar(conversation, user?.id),
      contextType: conversation.context?.type ?? conversation.type,
      contextId: conversation.context?.id ?? undefined,
      contextTitle: conversation.context?.title ?? undefined,
      contextSubtitle: conversation.context?.subtitle ?? undefined,
    });
  };

  const openDirect = (contact: SocialProfile | FriendSuggestion) => {
    navigation.navigate('ActivityThread', {
      participantId: contact.id,
      friendId: contact.id,
      participantName: contact.full_name,
      participantAvatar: contact.avatar_url,
      contextType: 'direct',
    });
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
                <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'كل محادثات الرحلات واللقاءات' : 'Trail, meetup, and direct conversations'}
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
                placeholder={isArabic ? 'ابحث عن محادثة أو شخص' : 'Search conversations or people'}
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
          <View style={styles.messagesCard}>
            <View style={[styles.sectionRow, isArabic ? rtlRow : ltrRow]}>
              <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'المحادثات' : 'Inbox'}</Text>
              {!isConversationApiReady ? (
                <Text style={styles.apiHint}>{isArabic ? 'قيد التجهيز' : 'Backend pending'}</Text>
              ) : null}
            </View>

            {isLoading ? (
              <View style={styles.emptyThreadState}>
                <ActivityIndicator color="#630E13" />
                <Text style={[styles.inlineStateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'جاري تحميل المحادثات...' : 'Loading conversations...'}
                </Text>
              </View>
            ) : filteredConversations.length ? (
              filteredConversations.map((conversation, index) => {
                const title = conversationTitle(conversation, user?.id);
                const avatar = conversationAvatar(conversation, user?.id);
                const unread = Number(conversation.unread_count ?? 0);
                const contextLabel = conversation.context?.title || conversation.context?.subtitle || conversation.context?.type;

                return (
                  <Pressable
                    key={conversation.id}
                    style={[styles.threadRow, isArabic ? rtlRow : ltrRow, index === 0 && styles.threadRowFirst]}
                    onPress={() => openConversation(conversation)}
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.threadAvatar} />
                    ) : (
                      <View style={[styles.threadAvatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitials}>{initials(title)}</Text>
                      </View>
                    )}
                    <View style={styles.threadBody}>
                      <View style={[styles.threadTopRow, isArabic ? rtlRow : ltrRow]}>
                        <Text style={[styles.threadName, isArabic ? rtlText : ltrText]} numberOfLines={1}>{title}</Text>
                        <Text style={styles.threadTime}>{formatConversationTime(conversation.latest_message_at ?? conversation.latest_message?.created_at)}</Text>
                      </View>
                      {contextLabel ? (
                        <Text numberOfLines={1} style={[styles.threadContext, isArabic ? rtlText : ltrText]}>{contextLabel}</Text>
                      ) : null}
                      <Text numberOfLines={1} style={[styles.threadPreview, isArabic ? rtlText : ltrText]}>
                        {conversation.latest_message?.body || (isArabic ? 'ابدأ المحادثة' : 'Start the conversation')}
                      </Text>
                    </View>
                    {unread > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyThreadState}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#8A7A6A" />
                <Text style={[styles.inlineStateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'ستظهر محادثاتك هنا بعد إرسال أول رسالة.' : 'Your conversations will appear here after the first message.'}
                </Text>
              </View>
            )}
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={140}>
          <View style={[styles.sectionRow, isArabic ? rtlRow : ltrRow]}>
            <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'ابدأ محادثة مباشرة' : 'Start a direct chat'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.friendsRow, isArabic && styles.friendsRowRtl]}>
            {filteredContacts.map((friend) => (
              <ContactCard key={friend.id} contact={friend} isArabic={isArabic} onPress={() => openDirect(friend)} />
            ))}
            {filteredSuggestions.map((friend) => (
              <ContactCard key={`suggestion-${friend.id}`} contact={friend} isArabic={isArabic} suggested onPress={() => openDirect(friend)} />
            ))}
            {!filteredContacts.length && !filteredSuggestions.length ? (
              <View style={styles.inlineStateCard}>
                <Ionicons name="people-outline" size={24} color="#8A7A6A" />
                <Text style={[styles.inlineStateText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'لا يوجد أشخاص مطابقون.' : 'No matching people yet.'}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </AnimatedBlock>
      </ScrollView>
    </AnimatedScreen>
  );
}

function ContactCard({
  contact,
  isArabic,
  suggested,
  onPress,
}: {
  contact: SocialProfile | FriendSuggestion;
  isArabic: boolean;
  suggested?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.friendCard, suggested && styles.suggestionCard]} onPress={onPress}>
      {contact.avatar_url ? (
        <Image source={{ uri: contact.avatar_url }} style={styles.friendAvatar} />
      ) : (
        <View style={[styles.friendAvatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitials}>{initials(contact.full_name)}</Text>
        </View>
      )}
      <Text numberOfLines={1} style={[styles.friendName, isArabic ? rtlText : ltrText]}>{contact.full_name}</Text>
      <Text numberOfLines={2} style={[styles.friendStatus, isArabic ? rtlText : ltrText]}>
        {suggested ? (isArabic ? 'مقترح لشبكتك' : 'Suggested hiker') : (isArabic ? 'متاح للمراسلة' : 'Available to message')}
      </Text>
      <View style={styles.messageButton}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#fff" />
        <Text style={styles.messageButtonText}>{isArabic ? 'مراسلة' : 'Message'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerSide: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 25, fontWeight: '900', color: '#2C2418' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#7B6D5A', fontWeight: '700' },
  searchCard: { backgroundColor: '#FFF8F1', borderRadius: 22, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#E7D8C3' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minHeight: 24, fontSize: 14, color: '#2C2418', paddingVertical: 0 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#2C2418' },
  apiHint: { color: '#8A7A6A', fontSize: 11, fontWeight: '800' },
  friendsRow: { gap: 12, paddingBottom: 8, marginBottom: 16 },
  friendsRowRtl: { flexDirection: 'row-reverse' },
  friendCard: { width: 176, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 14 },
  suggestionCard: { backgroundColor: '#FFF8F1', borderWidth: 1, borderColor: '#E7D8C3' },
  friendAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E7D8C3' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  avatarInitials: { color: '#fff', fontSize: 14, fontWeight: '900' },
  friendName: { marginTop: 12, fontSize: 15, fontWeight: '800', color: '#2C2418' },
  friendStatus: { marginTop: 8, minHeight: 36, fontSize: 12, lineHeight: 18, color: '#5A4F41' },
  messageButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 11, backgroundColor: '#630E13' },
  messageButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  inlineStateCard: { width: 220, minHeight: 150, borderRadius: 22, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFFFFF' },
  inlineStateText: { color: '#6B5D4E', fontSize: 12, lineHeight: 18, fontWeight: '800', textAlign: 'center' },
  messagesCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 18 },
  emptyThreadState: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#F1E5D8' },
  threadRowFirst: { borderTopWidth: 0, paddingTop: 4 },
  threadAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E7D8C3' },
  threadBody: { flex: 1, minWidth: 0 },
  threadTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  threadName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#2C2418' },
  threadTime: { fontSize: 11, color: '#8A7A6A', fontWeight: '800' },
  threadContext: { marginTop: 2, color: '#630E13', fontSize: 11, fontWeight: '900' },
  threadPreview: { marginTop: 4, fontSize: 13, color: '#6B5D4E' },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
