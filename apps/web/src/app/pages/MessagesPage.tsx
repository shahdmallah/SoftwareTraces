import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';
import {
  createMessagesSocket,
  emitTypingState,
  getConversationMessages,
  listConversations,
  markConversationRead,
  sendConversationMessage,
  type Conversation,
  type Message,
} from '../api/messages';

function upsertMessage(messages: Message[], next: Message) {
  const withoutDuplicate = messages.filter((message) => message.id !== next.id);
  return [...withoutDuplicate, next].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
}

export function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) return;
    listConversations({ page: 1, limit: 30 })
      .then((rows) => {
        setConversations(rows);
        if (rows[0]?.id) setActiveId(rows[0].id);
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load conversations.'));
  }, [isGuest]);

  useEffect(() => {
    if (!activeId || isGuest) return;

    getConversationMessages(activeId, { page: 1, limit: 80 })
      .then(setMessages)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load messages.'));
    void markConversationRead(activeId).catch(() => undefined);

    let cancelled = false;
    void createMessagesSocket(
      {
        onMessage: (message) => {
          if (message.conversation_id === activeId) {
            setMessages((current) => upsertMessage(current, message));
            setTypingUserId(null);
            void markConversationRead(activeId).catch(() => undefined);
          }
        },
        onTyping: (payload) => {
          if (payload.conversation_id !== activeId) return;
          setTypingUserId(payload.is_typing ? payload.user_id : null);
        },
      },
      activeId,
    )
      .then((socket) => {
        if (cancelled) {
          socket.close();
        } else {
          socketRef.current = socket;
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, [activeId, isGuest]);

  const handleSend = async () => {
    if (!activeId || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    if (socketRef.current) emitTypingState(socketRef.current, activeId, false);
    const saved = await sendConversationMessage(activeId, body);
    setMessages((current) => upsertMessage(current, saved));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="mb-2">Messages</h1>
        <p className="text-secondary mb-6">Direct conversations with live updates over Socket.IO.</p>

        {isGuest && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <p className="text-secondary">Sign in to use messaging.</p>
          </div>
        )}

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[480px]">
          <aside className="bg-card rounded-xl border border-border p-3 space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveId(conversation.id)}
                className={`w-full text-left rounded-lg px-3 py-2 ${activeId === conversation.id ? 'bg-primary/10' : 'hover:bg-muted/20'}`}
              >
                <p className="font-medium text-sm">{conversation.title || conversation.participants.map((p) => p.full_name).join(', ')}</p>
                <p className="text-xs text-secondary truncate">{conversation.latest_message?.body || 'No messages yet'}</p>
              </button>
            ))}
            {!conversations.length && !isGuest && <p className="text-sm text-secondary px-2">No conversations yet.</p>}
          </aside>

          <section className="bg-card rounded-xl border border-border flex flex-col">
            <div className="border-b border-border px-4 py-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Conversation</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="rounded-lg bg-muted/20 px-3 py-2 max-w-[80%]">
                  <p className="text-sm">{message.body}</p>
                  <p className="text-[11px] text-secondary mt-1">{new Date(message.created_at).toLocaleString()}</p>
                </div>
              ))}
              {!messages.length && activeId && <p className="text-sm text-secondary">Start the conversation.</p>}
              {typingUserId && <p className="text-xs text-secondary italic">Typing...</p>}
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (!activeId || !socketRef.current) return;
                  emitTypingState(socketRef.current, activeId, event.target.value.trim().length > 0);
                  if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = window.setTimeout(() => {
                    if (socketRef.current && activeId) emitTypingState(socketRef.current, activeId, false);
                  }, 1500);
                }}
                placeholder="Write a message"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => void handleSend()} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
