import { apiRequest } from './client';
import { getAccessToken, getApiBaseUrl } from '../lib/auth';
import { io, type Socket } from 'socket.io-client';

type Envelope<T> = {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type ConversationContextType = 'direct' | 'meetup' | 'trail' | 'activity' | 'profile' | 'photo' | 'review';

export type ConversationParticipant = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
};

export type ConversationContext = {
  type: ConversationContextType;
  id?: string | null;
  title?: string | null;
  subtitle?: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
};

export type Conversation = {
  id: string;
  type: ConversationContextType;
  title?: string | null;
  context?: ConversationContext | null;
  participants: ConversationParticipant[];
  latest_message?: Message | null;
  latest_message_at?: string | null;
  unread_count?: number;
  last_read_at?: string | null;
};

export type StartConversationInput = {
  participant_ids?: string[];
  recipient_id?: string;
  type?: ConversationContextType;
  context?: ConversationContext;
  initial_message?: string;
};

export type MessagesSocketHandlers = {
  onMessage?: (message: Message) => void;
  onConversation?: (conversation: Conversation) => void;
  onError?: (error: unknown) => void;
  onOpen?: () => void;
};

function normalizeArrayResponse<T>(response: Envelope<T[]> | T[] | { conversations?: T[]; messages?: T[]; data?: T[] }) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.conversations)) return response.conversations;
  if (Array.isArray(response.messages)) return response.messages;
  return [];
}

function normalizeMessage<T extends Record<string, unknown>>(payload: T): Message {
  return {
    id: String(payload.id ?? ''),
    conversation_id: String(payload.conversation_id ?? payload.conversationId ?? ''),
    sender_id: String(payload.sender_id ?? payload.senderId ?? ''),
    body: String(payload.body ?? payload.content ?? ''),
    created_at: String(payload.created_at ?? payload.createdAt ?? new Date().toISOString()),
    pending: payload.pending as boolean | undefined,
    failed: payload.failed as boolean | undefined,
  };
}

function normalizeConversation<T extends Record<string, unknown>>(payload: T): Conversation {
  const normalized = { ...payload } as Conversation;
  if (payload.latest_message && typeof payload.latest_message === 'object') {
    normalized.latest_message = normalizeMessage(payload.latest_message as Record<string, unknown>);
  }
  return normalized;
}

function normalizeObjectResponse<T>(response: Envelope<T> | T) {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as Envelope<T>).data;
  }

  return response as T;
}

export async function listConversations(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Conversation[]> | Conversation[] | { conversations?: Conversation[] }>(
    '/api/messages/conversations',
    {},
    params,
  );
  return normalizeArrayResponse(response).map((conversation) => normalizeConversation(conversation as Record<string, unknown>));
}

export async function startConversation(input: StartConversationInput) {
  const participantIds = input.participant_ids ?? (input.recipient_id ? [input.recipient_id] : []);
  const response = await apiRequest<Envelope<Conversation> | Conversation>('/api/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      participant_ids: participantIds,
      recipient_id: input.recipient_id ?? participantIds[0],
    }),
  });
  return normalizeConversation(normalizeObjectResponse(response) as Record<string, unknown>);
}

export async function getConversationMessages(conversationId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Message[]> | Message[] | { messages?: Message[] }>(
    `/api/messages/conversations/${conversationId}/messages`,
    {},
    params,
  );
  return normalizeArrayResponse(response).map((message) => normalizeMessage(message as Record<string, unknown>));
}

export async function sendConversationMessage(conversationId: string, body: string) {
  const response = await apiRequest<Envelope<Message> | Message>(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: body }),
  });
  return normalizeMessage(normalizeObjectResponse(response) as Record<string, unknown>);
}

export async function markConversationRead(conversationId: string) {
  return apiRequest<Envelope<{ conversation_id: string; last_read_at: string }> | { message?: string }>(
    `/api/messages/conversations/${conversationId}/read`,
    { method: 'PATCH' },
  );
}

export async function createMessagesSocket(
  handlers: MessagesSocketHandlers = {},
  conversationId?: string,
) {
  const token = await getAccessToken();
  const baseUrl = getApiBaseUrl();
  const socket = io(baseUrl, {
    auth: token ? { token: `Bearer ${token}` } : undefined,
    transports: ['websocket'],
  });

  socket.on('connect', () => handlers.onOpen?.());
  socket.on('connect_error', (error) => handlers.onError?.(error));
  socket.on('message:new', (payload: { data?: Message | Record<string, unknown>; message?: Message | Record<string, unknown>; conversation_id?: string }) => {
    const rawMessage = payload.data ?? payload.message ?? null;
    const message = rawMessage ? normalizeMessage(rawMessage as Record<string, unknown>) : null;
    if (message?.id) {
      handlers.onMessage?.(message);
    }
  });

  if (conversationId) {
    socket.emit('conversation:join', { conversationId }, (response: any) => {
      if (!response?.ok) {
        handlers.onError?.(new Error(response?.error || 'Failed to join conversation'));
      }
    });
  }

  return socket as Socket;
}
