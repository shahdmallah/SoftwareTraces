import { io, type Socket } from 'socket.io-client';
import { apiRequest, getAccessToken, getApiBaseUrl } from './client';

type Envelope<T> = { data: T };

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { id: string; full_name?: string | null; avatar_url?: string | null } | null;
};

export type Conversation = {
  id: string;
  type: string;
  title?: string | null;
  participants: Array<{ id: string; full_name: string; avatar_url?: string | null }>;
  latest_message?: Message | null;
  unread_count?: number;
};

export type TypingStatePayload = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
};

export async function listConversations(params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Conversation[]> | { conversations: Conversation[] }>(
    '/api/messages/conversations',
    {},
    params,
  );
  if ('conversations' in response && Array.isArray(response.conversations)) return response.conversations;
  return 'data' in response ? response.data : [];
}

export async function getConversationMessages(conversationId: string, params: { page?: number; limit?: number } = {}) {
  const response = await apiRequest<Envelope<Message[]> | { messages: Message[] }>(
    `/api/messages/conversations/${conversationId}/messages`,
    {},
    params,
  );
  if ('messages' in response && Array.isArray(response.messages)) return response.messages;
  return 'data' in response ? response.data : [];
}

export async function sendConversationMessage(conversationId: string, body: string) {
  const response = await apiRequest<Envelope<Message>>(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: body }),
  });
  return response.data;
}

export async function markConversationRead(conversationId: string) {
  return apiRequest(`/api/messages/conversations/${conversationId}/read`, { method: 'PATCH' });
}

export function createMessagesSocket(
  handlers: {
    onMessage?: (message: Message) => void;
    onTyping?: (payload: TypingStatePayload) => void;
    onOpen?: () => void;
    onError?: (error: unknown) => void;
  },
  conversationId?: string,
) {
  const token = getAccessToken();
  const socket = io(getApiBaseUrl(), {
    auth: token ? { token: `Bearer ${token}` } : undefined,
    transports: ['websocket'],
  });

  socket.on('connect', () => handlers.onOpen?.());
  socket.on('connect_error', (error) => handlers.onError?.(error));
  socket.on('message:new', (payload: { data?: Message }) => {
    if (payload.data?.id) handlers.onMessage?.(payload.data);
  });
  socket.on('typing:start', (payload: TypingStatePayload) => handlers.onTyping?.({ ...payload, is_typing: true }));
  socket.on('typing:stop', (payload: TypingStatePayload) => handlers.onTyping?.({ ...payload, is_typing: false }));

  if (conversationId) {
    socket.emit('conversation:join', { conversationId });
  }

  return socket as Socket;
}

export function emitTypingState(socket: Socket, conversationId: string, isTyping: boolean) {
  socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
}
