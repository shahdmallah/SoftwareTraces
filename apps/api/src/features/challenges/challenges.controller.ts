import type { Request, Response } from "express";
import { z } from "zod";
import { trackUserActivity } from "../analytics/analytics.service";
import { requireAuth } from "../../middleware/auth";
import {
  archiveChallenge,
  createChallenge,
  getChallenge,
  getMyChallenges,
  joinChallenge,
  listAdminChallenges,
  listPublicChallenges,
  publishChallenge,
  recalculateChallenge,
  updateChallenge,
} from "./challenges.service";

const uuidSchema = z.string().uuid();
const goalTypeSchema = z.enum([
  "complete_trails",
  "total_distance_km",
  "complete_difficulty",
  "join_meetups",
  "submit_safety_reports",
  "checkpoint_reports",
]);
const goalMetadataSchema = z.record(z.unknown()).refine((value) => !Array.isArray(value), {
  message: "goal_metadata must be an object",
});

const challengeBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  goal_type: goalTypeSchema,
  goal_value: z.coerce.number().positive(),
  goal_metadata: goalMetadataSchema.optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  reward_badge_id: z.string().uuid().nullable().optional(),
  reward_points: z.coerce.number().int().min(0).max(100000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const challengeSchema = challengeBaseSchema.refine((value) => Date.parse(value.end_at) > Date.parse(value.start_at), {
  message: "end_at must be after start_at",
  path: ["end_at"],
});

const updateChallengeSchema = challengeBaseSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
}).refine((value) => {
  if (!value.start_at || !value.end_at) return true;
  return Date.parse(value.end_at) > Date.parse(value.start_at);
}, {
  message: "end_at must be after start_at",
  path: ["end_at"],
});

function sendChallengeError(action: string, res: Response, error: unknown): void {
  console.error(`[challenges.${action}] ERROR:`, error);

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof Error && error.message === "CHALLENGE_NOT_FOUND") {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  if (error instanceof Error && error.message === "CHALLENGE_ALREADY_JOINED") {
    res.status(409).json({ error: "Challenge already joined" });
    return;
  }

  if (error instanceof Error && error.message === "REWARD_BADGE_NOT_FOUND") {
    res.status(400).json({ error: "Reward badge not found" });
    return;
  }

  res.status(500).json({ error: "Challenge action failed", details: error instanceof Error ? error.message : String(error) });
}

export async function adminListChallenges(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listAdminChallenges() });
  } catch (error) {
    sendChallengeError("adminListChallenges", res, error);
  }
}

export async function adminCreateChallenge(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const body = challengeSchema.parse(req.body);
    res.status(201).json({ data: await createChallenge(auth.sub, body) });
  } catch (error) {
    sendChallengeError("adminCreateChallenge", res, error);
  }
}

export async function adminGetChallenge(req: Request, res: Response): Promise<void> {
  try {
    const challenge = await getChallenge(uuidSchema.parse(req.params.id), null, true);
    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }
    res.json({ data: challenge });
  } catch (error) {
    sendChallengeError("adminGetChallenge", res, error);
  }
}

export async function adminPatchChallenge(req: Request, res: Response): Promise<void> {
  try {
    const challenge = await updateChallenge(uuidSchema.parse(req.params.id), updateChallengeSchema.parse(req.body));
    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }
    res.json({ data: challenge });
  } catch (error) {
    sendChallengeError("adminPatchChallenge", res, error);
  }
}

export async function adminArchiveChallenge(req: Request, res: Response): Promise<void> {
  try {
    const challenge = await archiveChallenge(uuidSchema.parse(req.params.id));
    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }
    res.json({ data: challenge });
  } catch (error) {
    sendChallengeError("adminArchiveChallenge", res, error);
  }
}

export async function adminPublishChallenge(req: Request, res: Response): Promise<void> {
  try {
    const challenge = await publishChallenge(uuidSchema.parse(req.params.id));
    if (!challenge) {
      res.status(404).json({ error: "Challenge not found or archived" });
      return;
    }
    res.json({ data: challenge });
  } catch (error) {
    sendChallengeError("adminPublishChallenge", res, error);
  }
}

export async function adminRecalculateChallenge(req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await recalculateChallenge(uuidSchema.parse(req.params.id)) });
  } catch (error) {
    sendChallengeError("adminRecalculateChallenge", res, error);
  }
}

export async function listChallenges(req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listPublicChallenges(req.auth?.sub ?? null) });
  } catch (error) {
    sendChallengeError("listChallenges", res, error);
  }
}

export async function getPublicChallenge(req: Request, res: Response): Promise<void> {
  try {
    const challenge = await getChallenge(uuidSchema.parse(req.params.id), req.auth?.sub ?? null);
    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" });
      return;
    }
    res.json({ data: challenge });
  } catch (error) {
    sendChallengeError("getPublicChallenge", res, error);
  }
}

export async function postJoinChallenge(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const challengeId = uuidSchema.parse(req.params.id);
    const data = await joinChallenge(challengeId, auth.sub);
    await trackUserActivity({
      userId: auth.sub,
      eventType: "challenge_joined",
      metadata: { challenge_id: challengeId },
    });
    res.status(201).json({ data });
  } catch (error) {
    sendChallengeError("postJoinChallenge", res, error);
  }
}

export async function getMyChallengeList(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    res.json({ data: await getMyChallenges(auth.sub) });
  } catch (error) {
    sendChallengeError("getMyChallengeList", res, error);
  }
}
