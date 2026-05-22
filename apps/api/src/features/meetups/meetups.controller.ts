import type { Request, Response } from "express";
import { ZodError, z } from "zod";
import { requireAuth } from "../../middleware/auth";
import {
  createMeetup,
  getMeetup,
  joinMeetup,
  leaveMeetup,
  listMeetups,
  MeetupServiceError,
} from "./meetups.service";

const uuidSchema = z.string().uuid();

const createMeetupSchema = z.object({
  trail_id: uuidSchema.nullish(),
  title: z.string().trim().min(1).max(120),
  title_ar: z.string().trim().max(120).nullish(),
  note: z.string().trim().max(2000).nullish(),
  note_ar: z.string().trim().max(2000).nullish(),
  vibe: z.string().trim().max(80).nullish(),
  vibe_ar: z.string().trim().max(80).nullish(),
  cover_url: z.string().trim().url().nullish(),
  starts_at: z.string().refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }, "starts_at must be a valid date"),
  meeting_place: z.string().trim().max(240).nullish(),
  meeting_latitude: z.number().min(31.2).max(32.6).nullish(),
  meeting_longitude: z.number().min(34.8).max(35.8).nullish(),
  visibility: z.enum(["public", "private", "friends"]),
  max_headcount: z.number().int().min(1).max(500),
  bring_items: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  invited_user_ids: z.array(uuidSchema).max(100).optional(),
});

const joinMeetupSchema = z.object({
  guest_count: z.number().int().min(0).max(10).default(1),
});

interface PostgresErrorLike {
  code?: string;
  detail?: string;
  table?: string;
  column?: string;
  constraint?: string;
}

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function getOptionalUserId(req: Request): string | null {
  return req.auth?.sub ?? null;
}

function shouldIncludeDetails(): boolean {
  return process.env.NODE_ENV !== "production";
}

function getPostgresError(error: unknown): PostgresErrorLike | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybePgError = error as PostgresErrorLike;
  return maybePgError.code ? maybePgError : null;
}

function sendControllerError(res: Response, functionName: string, error: unknown): void {
  console.error(`[meetups.controller] ${functionName} error:`, error);
  if (error instanceof Error && error.stack) {
    console.error(`[meetups.controller] ${functionName} stack:`, error.stack);
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof MeetupServiceError) {
    const statusByCode = {
      BAD_REQUEST: 400,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
    } as const;

    res.status(statusByCode[error.code]).json({
      error: error.message,
      ...(shouldIncludeDetails() ? { details: error.message } : {}),
    });
    return;
  }

  res.status(500).json({
    error: `${functionName} failed`,
    ...(shouldIncludeDetails() ? { details: error instanceof Error ? error.message : String(error) } : {}),
  });
}

export async function createMeetupHandler(req: Request, res: Response): Promise<void> {
  console.log("[meetups.createMeetupHandler] ========== START ==========");

  try {
    console.log("[meetups.createMeetupHandler] 1. Checking auth...");
    const auth = requireAuth(req);
    console.log("[meetups.createMeetupHandler] 2. Auth passed, userId:", auth.sub);

    console.log("[meetups.createMeetupHandler] 3. Parsing request body...");
    console.log("[meetups.createMeetupHandler] 4. Request body:", JSON.stringify(req.body, null, 2));

    const validated = createMeetupSchema.parse(req.body);
    console.log("[meetups.createMeetupHandler] 5. Validation passed:", JSON.stringify(validated, null, 2));

    console.log("[meetups.createMeetupHandler] 6. Calling service.createMeetup...");
    const meetup = await createMeetup(auth.sub, validated);
    console.log("[meetups.createMeetupHandler] 7. Meetup created:", meetup.id);

    res.status(201).json({ data: meetup });
  } catch (error) {
    const postgresError = getPostgresError(error);

    console.error("[meetups.createMeetupHandler] ERROR CAUGHT:");
    console.error("[meetups.createMeetupHandler] Error type:", typeof error);
    console.error("[meetups.createMeetupHandler] Error constructor:", error?.constructor?.name);
    console.error(
      "[meetups.createMeetupHandler] Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "[meetups.createMeetupHandler] Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );

    if (error instanceof ZodError) {
      console.error("[meetups.createMeetupHandler] Zod error details:", error.errors);
      res.status(400).json({ error: "Validation failed", details: error.errors });
      return;
    }

    if (error instanceof MeetupServiceError) {
      console.error("[meetups.createMeetupHandler] Meetup service code:", error.code);
      const statusByCode = {
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
      } as const;

      res.status(statusByCode[error.code]).json({
        error: error.message,
        ...(shouldIncludeDetails() ? { details: error.message } : {}),
      });
      return;
    }

    if (postgresError) {
      console.error("[meetups.createMeetupHandler] PostgreSQL error code:", postgresError.code);
      console.error("[meetups.createMeetupHandler] PostgreSQL error detail:", postgresError.detail);
      console.error("[meetups.createMeetupHandler] PostgreSQL error table:", postgresError.table);
      console.error("[meetups.createMeetupHandler] PostgreSQL error column:", postgresError.column);
      console.error("[meetups.createMeetupHandler] PostgreSQL error constraint:", postgresError.constraint);
    }

    res.status(500).json({
      error: "Failed to create meetup",
      details: error instanceof Error ? error.message : String(error),
      code: postgresError?.code,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function listMeetupsHandler(req: Request, res: Response): Promise<void> {
  console.log("[meetups.controller] listMeetupsHandler start");
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const trailId = req.query.trail_id ? String(req.query.trail_id) : null;

    if (trailId) {
      uuidSchema.parse(trailId);
    }

    console.log("[meetups.controller] Listing meetups:", { page, limit, trailId, userId: getOptionalUserId(req) });
    const result = await listMeetups({ page, limit, trail_id: trailId }, getOptionalUserId(req));

    res.json(result);
  } catch (error) {
    sendControllerError(res, "listMeetupsHandler", error);
  }
}

export async function getMeetupHandler(req: Request, res: Response): Promise<void> {
  console.log("[meetups.controller] getMeetupHandler start");
  try {
    const meetupId = uuidSchema.parse(getRequestId(req.params.id));
    console.log("[meetups.controller] Fetching meetup:", { meetupId, userId: getOptionalUserId(req) });
    const meetup = await getMeetup(meetupId, getOptionalUserId(req));

    res.json({ data: meetup });
  } catch (error) {
    sendControllerError(res, "getMeetupHandler", error);
  }
}

export async function joinMeetupHandler(req: Request, res: Response): Promise<void> {
  console.log("[meetups.controller] joinMeetupHandler start");
  try {
    const auth = requireAuth(req);
    const meetupId = uuidSchema.parse(getRequestId(req.params.id));
    console.log("[meetups.controller] Validating join body");
    const { guest_count } = joinMeetupSchema.parse(req.body ?? {});
    const result = await joinMeetup(meetupId, auth.sub, guest_count);

    res.json({ data: result });
  } catch (error) {
    sendControllerError(res, "joinMeetupHandler", error);
  }
}

export async function leaveMeetupHandler(req: Request, res: Response): Promise<void> {
  console.log("[meetups.controller] leaveMeetupHandler start");
  try {
    const auth = requireAuth(req);
    const meetupId = uuidSchema.parse(getRequestId(req.params.id));
    const result = await leaveMeetup(meetupId, auth.sub);

    res.json({ data: result });
  } catch (error) {
    sendControllerError(res, "leaveMeetupHandler", error);
  }
}
