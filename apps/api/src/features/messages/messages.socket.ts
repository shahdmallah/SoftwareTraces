import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../../config/env";
import type { Message } from "./messages.service";
import { getProfileIdForAuthUser, isConversationParticipant } from "./messages.service";

let io: Server | null = null;

type ConversationSocketPayload = {
  conversationId?: string;
};

type SocketCallback = (response: unknown) => void;

function getTokenFromSocket(socket: Parameters<Parameters<Server["use"]>[0]>[0]): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim() !== "") {
    return authToken.replace(/^Bearer\s+/i, "");
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.replace("Bearer ", "");
  }

  return null;
}

export function initMessagesSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) {
        next(new Error("Authentication required"));
        return;
      }

      const payload = jwt.verify(token, env.JWT_SECRET);
      if (
        typeof payload !== "object" ||
        payload === null ||
        typeof payload.sub !== "string"
      ) {
        next(new Error("Invalid token"));
        return;
      }

      socket.data.authUserId = payload.sub;
      socket.data.profileId = await getProfileIdForAuthUser(payload.sub);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    async function emitTypingState(
      payload: ConversationSocketPayload,
      isTyping: boolean,
      callback?: SocketCallback
    ): Promise<void> {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !(await isConversationParticipant(conversationId, socket.data.profileId))) {
          callback?.({ ok: false, error: "Conversation not found" });
          return;
        }

        socket.to(`conversation:${conversationId}`).emit(isTyping ? "typing:start" : "typing:stop", {
          conversation_id: conversationId,
          user_id: socket.data.profileId,
          is_typing: isTyping,
        });
        callback?.({ ok: true, conversationId });
      } catch (error) {
        callback?.({ ok: false, error: error instanceof Error ? error.message : "Failed to update typing state" });
      }
    }

    socket.on("conversation:join", async (payload: ConversationSocketPayload, callback?: SocketCallback) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId || !(await isConversationParticipant(conversationId, socket.data.profileId))) {
          callback?.({ ok: false, error: "Conversation not found" });
          return;
        }

        await socket.join(`conversation:${conversationId}`);
        callback?.({ ok: true, conversationId });
      } catch (error) {
        callback?.({ ok: false, error: error instanceof Error ? error.message : "Failed to join conversation" });
      }
    });

    socket.on("conversation:leave", async (payload: ConversationSocketPayload, callback?: SocketCallback) => {
      const conversationId = payload?.conversationId;
      if (conversationId) {
        await socket.leave(`conversation:${conversationId}`);
      }
      callback?.({ ok: true, conversationId });
    });

    socket.on("typing:start", async (payload: ConversationSocketPayload, callback?: SocketCallback) => {
      await emitTypingState(payload, true, callback);
    });

    socket.on("typing:stop", async (payload: ConversationSocketPayload, callback?: SocketCallback) => {
      await emitTypingState(payload, false, callback);
    });
  });

  return io;
}

export function emitMessageNew(message: Message): void {
  io?.to(`conversation:${message.conversation_id}`).emit("message:new", {
    data: message,
    conversation_id: message.conversation_id,
    last_message: message,
  });
}
