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

export type ConversationType = 'direct' | 'meetup' | 'trail' | 'activity' | 'safety';
export type ConversationContextType = ConversationType | 'profile' | 'photo' | 'review';

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
  sender?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
  body: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
};

export type Conversation = {
  id: string;
  type: ConversationType;
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

export type TypingStatePayload = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
};

export type MessagesSocketHandlers = {
  onMessage?: (message: Message) => void;
  onConversation?: (conversation: Conversation) => void;
  onTyping?: (payload: TypingStatePayload) => void;
  onError?: (error: unknown) => void;
  onOpen?: () => void;
};

function normalizeArrayResponse<T>(response: Envelope<T[]> | T[] | { conversations?: T[]; messages?: T[]; data?: T[] }) {
  if (Array.isArray(response)) return response;
  const objectResponse = response as { conversations?: T[]; messages?: T[]; data?: T[] };
  if (Array.isArray(objectResponse.data)) return objectResponse.data;
  if (Array.isArray(objectResponse.conversations)) return objectResponse.conversations;
  if (Array.isArray(objectResponse.messages)) return objectResponse.messages;
  return [];
}

function normalizeMessage<T extends Record<string, unknown>>(payload: T): Message {
  const sender = payload.sender && typeof payload.sender === 'object'
    ? payload.sender as Record<string, unknown>
    : null;

  return {
    id: String(payload.id ?? ''),
    conversation_id: String(payload.conversation_id ?? payload.conversationId ?? ''),
    sender_id: String(payload.sender_id ?? payload.senderId ?? ''),
    sender: sender
      ? {
          id: String(sender.id ?? payload.sender_id ?? payload.senderId ?? ''),
          full_name: (sender.full_name ?? null) as string | null,
          avatar_url: (sender.avatar_url ?? null) as string | null,
        }
      : null,
    body: String(payload.body ?? payload.content ?? ''),
    metadata: payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata as Record<string, unknown>
      : null,
    created_at: String(payload.created_at ?? payload.createdAt ?? new Date().toISOString()),
    pending: payload.pending as boolean | undefined,
    failed: payload.failed as boolean | undefined,
  };
}

function isConversationType(value: unknown): value is ConversationType {
  return value === 'direct' || value === 'meetup' || value === 'trail' || value === 'activity' || value === 'safety';
}

function normalizeParticipant<T extends Record<string, unknown>>(payload: T): ConversationParticipant {
  return {
    id: String(payload.id ?? payload.user_id ?? ''),
    full_name: String(payload.full_name ?? ''),
    avatar_url: (payload.avatar_url ?? null) as string | null,
  };
}

function normalizeConversation<T extends Record<string, unknown>>(payload: T): Conversation {
  const latestMessage = payload.latest_message ?? payload.last_message;
  const sourceContext = payload.context && typeof payload.context === 'object' ? (payload.context as ConversationContext) : null;
  const contextType = payload.context_type ?? sourceContext?.type;

  const normalized = {
    ...payload,
    id: String(payload.id ?? ''),
    type: isConversationType(payload.type) ? payload.type : 'direct',
    title: (payload.title ?? null) as string | null,
    participants: Array.isArray(payload.participants)
      ? payload.participants.map((participant) => normalizeParticipant(participant as Record<string, unknown>))
      : [],
    latest_message: latestMessage && typeof latestMessage === 'object'
      ? normalizeMessage(latestMessage as Record<string, unknown>)
      : null,
    latest_message_at: String(payload.latest_message_at ?? payload.updated_at ?? ''),
    unread_count: Number(payload.unread_count ?? 0),
    context: contextType
      ? {
          type: String(contextType) as ConversationContextType,
          id: (payload.context_id ?? null) as string | null,
          title: (payload.title ?? null) as string | null,
          subtitle: null,
        }
      : null,
  } as Conversation;

  if (sourceContext) {
    normalized.context = {
      ...(normalized.context ?? {}),
      ...sourceContext,
    };
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
  const type = isConversationType(input.type) ? input.type : 'direct';
  const contextType = input.context?.type ?? (input.type && !isConversationType(input.type) ? input.type : undefined);
  const response = await apiRequest<Envelope<Conversation> | Conversation>('/api/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({
      type,
      participant_ids: participantIds,
      context_type: contextType,
      context_id: input.context?.id,
      title: input.context?.title,
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

  socket.on('typing:start', (payload: TypingStatePayload) => {
    handlers.onTyping?.({ ...payload, is_typing: true });
  });

  socket.on('typing:stop', (payload: TypingStatePayload) => {
    handlers.onTyping?.({ ...payload, is_typing: false });
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

export function emitTypingState(socket: Socket, conversationId: string, isTyping: boolean) {
  socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
}
