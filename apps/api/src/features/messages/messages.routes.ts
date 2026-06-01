import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middleware/auth";
import {
  createConversationHandler,
  getConversationMessagesHandler,
  listConversationsHandler,
  markConversationReadHandler,
  sendConversationMessageHandler,
} from "./messages.controller";

const router = Router();

router.post("/conversations", authenticate, asyncHandler(createConversationHandler));
router.get("/conversations", authenticate, asyncHandler(listConversationsHandler));
router.get("/conversations/:conversationId/messages", authenticate, asyncHandler(getConversationMessagesHandler));
router.post("/conversations/:conversationId/messages", authenticate, asyncHandler(sendConversationMessageHandler));
router.patch("/conversations/:conversationId/read", authenticate, asyncHandler(markConversationReadHandler));

export default router;
