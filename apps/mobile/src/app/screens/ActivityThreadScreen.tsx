import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  createMessagesSocket,
  getConversationMessages,
  markConversationRead,
  sendConversationMessage,
  startConversation,
  type Conversation,
  type ConversationContext,
  type Message,
} from '../api/messagesApi';
import { getMyFriends, type SocialProfile } from '../api/socialApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ThreadRouteProp = RouteProp<RootStackParamList, 'ActivityThread'>;
type ThreadNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityThread'>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TR';
}

function formatMessageTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function upsertMessage(messages: Message[], next: Message) {
  const withoutDuplicate = messages.filter((message) => message.id !== next.id);
  return [...withoutDuplicate, next].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

export function ActivityThreadScreen() {
  const route = useRoute<ThreadRouteProp>();
  const navigation = useNavigation<ThreadNavigationProp>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationId, setConversationId] = useState(route.params.conversationId ?? route.params.threadId ?? '');
  const [draft, setDraft] = useState(route.params.initialMessage ?? '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<SocialProfile[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(route.params.conversationId ?? route.params.threadId));
  const [isSending, setIsSending] = useState(false);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setContacts([]);
      return () => {
        cancelled = true;
      };
    }

    const loadContacts = async () => {
      const friendsResponse = await getMyFriends({ page: 1, limit: 60 }).catch(() => ({ data: [] as SocialProfile[] }));
      if (!cancelled) {
        setContacts(friendsResponse.data);
      }
    };

    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const nextMessages = await getConversationMessages(conversationId, { page: 1, limit: 80 });
        await markConversationRead(conversationId).catch(() => undefined);
        if (!cancelled) {
          setMessages(nextMessages);
          setApiMessage(null);
        }
      } catch {
        if (!cancelled) {
          setApiMessage(isArabic ? 'المحادثة جاهزة، لكن الخادم لم يرسل الرسائل بعد.' : 'Conversation is ready, but message history is not available yet.');
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [conversationId, isArabic]);

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    let socket: WebSocket | null = null;
    let cancelled = false;

    void createMessagesSocket(
      {
        onMessage: (message) => {
          if (message.conversation_id === conversationId) {
            setMessages((current) => upsertMessage(current, message));
            void markConversationRead(conversationId).catch(() => undefined);
          }
        },
        onConversation: (nextConversation) => {
          if (nextConversation.id === conversationId) {
            setConversation(nextConversation);
          }
        },
      },
      conversationId,
    )
      .then((nextSocket) => {
        if (cancelled) {
          nextSocket.close();
        } else {
          socket = nextSocket;
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [conversationId]);

  useEffect(() => {
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const routeParticipantId = route.params.participantId ?? route.params.friendId;
  const friend = useMemo(
    () => contacts.find((item) => item.id === routeParticipantId),
    [contacts, routeParticipantId],
  );
  const participantName = route.params.participantName || friend?.full_name || conversation?.title || (isArabic ? 'محادثة' : 'Conversation');
  const participantAvatar = route.params.participantAvatar ?? friend?.avatar_url ?? conversation?.participants.find((item) => item.id !== user?.id)?.avatar_url ?? null;
  const context = useMemo<ConversationContext | undefined>(() => {
    if (!route.params.contextType || route.params.contextType === 'direct') {
      return undefined;
    }

    return {
      type: route.params.contextType,
      id: route.params.contextId,
      title: route.params.contextTitle,
      subtitle: route.params.contextSubtitle,
    };
  }, [route.params.contextId, route.params.contextSubtitle, route.params.contextTitle, route.params.contextType]);
  const contextTitle = route.params.contextTitle || conversation?.context?.title;
  const contextSubtitle = route.params.contextSubtitle || conversation?.context?.subtitle;

  const ensureConversation = async () => {
    if (conversationId) {
      return conversationId;
    }

    const participantIds = routeParticipantId ? [routeParticipantId] : [];
    const nextConversation = await startConversation({
      participant_ids: participantIds,
      recipient_id: routeParticipantId,
      type: route.params.contextType ?? 'direct',
      context,
    });
    setConversation(nextConversation);
    setConversationId(nextConversation.id);
    return nextConversation.id;
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;

    setDraft('');
    setIsSending(true);
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      conversation_id: conversationId || 'pending',
      sender_id: user?.id ?? 'me',
      body,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => upsertMessage(current, optimistic));

    try {
      const nextConversationId = await ensureConversation();
      const saved = await sendConversationMessage(nextConversationId, body);
      setMessages((current) => upsertMessage(current.filter((message) => message.id !== optimistic.id), saved));
      setApiMessage(null);
    } catch {
      setApiMessage(isArabic ? 'تعذر حفظ الرسالة الآن. ستبقى محلياً حتى تحاول مرة أخرى.' : 'Unable to save this message yet. It is kept locally for now.');
      setMessages((current) =>
        current.map((message) => (message.id === optimistic.id ? { ...message, pending: false, failed: true } : message)),
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatedScreen style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }, isArabic ? rtlRow : ltrRow]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
        </Pressable>
        <Pressable
          onPress={() => routeParticipantId && navigation.navigate('PublicProfile', { profileId: routeParticipantId })}
          disabled={!routeParticipantId}
        >
          {participantAvatar ? (
            <Image source={{ uri: participantAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials(participantName)}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={styles.headerCopy}
          onPress={() => routeParticipantId && navigation.navigate('PublicProfile', { profileId: routeParticipantId })}
          disabled={!routeParticipantId}
        >
          <Text style={[styles.title, isArabic ? rtlText : ltrText]} numberOfLines={1}>{participantName}</Text>
          <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {contextTitle || (isArabic ? 'رسائل مباشرة' : 'Direct messages')}
          </Text>
        </Pressable>
      </View>

      {contextTitle || contextSubtitle ? (
        <View style={[styles.contextBar, isArabic ? rtlRow : ltrRow]}>
          <Ionicons name={route.params.contextType === 'meetup' ? 'calendar-outline' : 'trail-sign-outline'} size={16} color="#630E13" />
          <View style={styles.contextCopy}>
            <Text numberOfLines={1} style={[styles.contextTitle, isArabic ? rtlText : ltrText]}>{contextTitle}</Text>
            {contextSubtitle ? (
              <Text numberOfLines={1} style={[styles.contextSubtitle, isArabic ? rtlText : ltrText]}>{contextSubtitle}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#630E13" />
            <Text style={[styles.stateText, isArabic ? rtlText : ltrText]}>{isArabic ? 'جاري تحميل الرسائل...' : 'Loading messages...'}</Text>
          </View>
        ) : messages.length ? (
          messages.map((message, index) => {
            const mine = message.sender_id === user?.id || message.id.startsWith('local-');
            return (
              <AnimatedBlock key={message.id} delay={40 + index * 25}>
                <View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble]}>
                  <Text style={[styles.bubbleText, mine && styles.myBubbleText, isArabic ? rtlText : ltrText]}>{message.body}</Text>
                  <Text style={[styles.timeText, mine && styles.myTimeText]}>
                    {message.failed ? (isArabic ? 'لم ترسل' : 'Not sent') : message.pending ? (isArabic ? 'جار الإرسال' : 'Sending') : formatMessageTime(message.created_at)}
                  </Text>
                </View>
              </AnimatedBlock>
            );
          })
        ) : (
          <AnimatedBlock delay={80}>
            <View style={styles.theirBubble}>
              <Text style={[styles.bubbleText, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'لا توجد رسائل بعد. ابدأ المحادثة.' : 'No messages yet. Start the conversation.'}
              </Text>
            </View>
          </AnimatedBlock>
        )}
        {apiMessage ? (
          <Text style={[styles.apiMessage, isArabic ? rtlText : ltrText]}>{apiMessage}</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom + 8) }, isArabic ? rtlRow : ltrRow]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={isArabic ? 'اكتب رسالة...' : 'Write a message...'}
          placeholderTextColor="#A18F7A"
          style={[styles.input, isArabic ? rtlText : ltrText]}
          multiline
        />
        <Pressable style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!draft.trim() || isSending}>
          {isSending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </Pressable>
      </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFF8F1', borderBottomWidth: 1, borderBottomColor: '#E7D8C3' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E7D8C3' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  avatarInitials: { color: '#fff', fontSize: 12, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: '#2C2418', fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#8A7A6A', fontSize: 12, fontWeight: '700' },
  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 18, padding: 12, backgroundColor: '#FFF8F1', borderWidth: 1, borderColor: '#E7D8C3' },
  contextCopy: { flex: 1, minWidth: 0 },
  contextTitle: { color: '#2C2418', fontSize: 13, fontWeight: '900' },
  contextSubtitle: { marginTop: 2, color: '#7B6D5A', fontSize: 11, fontWeight: '700' },
  messages: { padding: 16, gap: 12 },
  stateCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: '#6B5D4E', fontSize: 12, fontWeight: '800' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#630E13', borderBottomRightRadius: 6 },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 6 },
  bubbleText: { color: '#2C2418', fontSize: 14, lineHeight: 20 },
  myBubbleText: { color: '#FFFFFF' },
  timeText: { marginTop: 5, color: '#8A7A6A', fontSize: 10, fontWeight: '700' },
  myTimeText: { color: 'rgba(255,255,255,0.65)' },
  apiMessage: { alignSelf: 'center', maxWidth: '90%', color: '#8A7A6A', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF8F1', borderTopWidth: 1, borderTopColor: '#E7D8C3' },
  input: { flex: 1, minHeight: 46, maxHeight: 116, borderRadius: 18, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: '#FFFFFF', color: '#2C2418', fontSize: 14 },
  sendButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  sendButtonDisabled: { opacity: 0.5 },
});
