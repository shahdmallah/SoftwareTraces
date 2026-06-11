import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import {
  createConversation,
  getConversationMessages,
  listConversations,
  markConversationRead,
  ProfileResolutionError,
  sendConversationMessage,
} from "./messages.service";
import { emitMessageNew } from "./messages.socket";

const conversationSchema = z.object({
  type: z.enum(["direct", "meetup", "trail", "activity", "safety"]),
  participant_ids: z.array(z.string().uuid()).default([]),
  context_type: z.string().trim().optional(),
  context_id: z.string().uuid().optional(),
  title: z.string().trim().optional(),
});

const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

function handleMessagesError(res: Response, error: unknown): void {
  console.error("[messages.controller] Error:", error);

  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof ProfileResolutionError) {
    res.status(400).json({
      error: error.message,
      ...(process.env.NODE_ENV !== "production" ? { unresolved_ids: error.unresolvedIds } : {}),
    });
    return;
  }

  if (error instanceof Error && (error.message === "Conversation not found" || error.message === "Profile not found")) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof Error && error.message === "Meetup not found") {
    res.status(404).json({ error: error.message });
    return;
  }

  if (
    error instanceof Error &&
    (
      error.message.includes("Direct conversations require") ||
      error.message.includes("conversations require a context_id") ||
      error.message === "At least one participant is required"
    )
  ) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: "Failed to process messages request",
    details: error instanceof Error ? error.message : String(error),
  });
}

function getConversationIdParam(req: Request): string {
  const conversationId = req.params.conversationId;
  if (typeof conversationId !== "string") {
    throw new HttpError(400, "Invalid conversation id");
  }

  return conversationId;
}

export async function createConversationHandler(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const body = conversationSchema.parse(req.body ?? {});
    const conversation = await createConversation(auth.sub, {
      type: body.type,
      participant_ids: body.participant_ids,
      context_type: body.context_type ?? null,
      context_id: body.context_id ?? null,
      title: body.title ?? null,
    });
    res.status(201).json({ data: conversation });
  } catch (error) {
    handleMessagesError(res, error);
  }
}

export async function listConversationsHandler(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const conversations = await listConversations(auth.sub);
    res.json({ data: conversations });
  } catch (error) {
    handleMessagesError(res, error);
  }
}

export async function getConversationMessagesHandler(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const messages = await getConversationMessages(auth.sub, getConversationIdParam(req), limit);
    res.json({ data: messages });
  } catch (error) {
    handleMessagesError(res, error);
  }
}

export async function sendConversationMessageHandler(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const body = messageSchema.parse(req.body ?? {});
    const message = await sendConversationMessage(auth.sub, getConversationIdParam(req), body.content);
    emitMessageNew(message);
    res.status(201).json({ data: message });
  } catch (error) {
    handleMessagesError(res, error);
  }
}

export async function markConversationReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const result = await markConversationRead(auth.sub, getConversationIdParam(req));
    res.json({ data: result });
  } catch (error) {
    handleMessagesError(res, error);
  }
}
