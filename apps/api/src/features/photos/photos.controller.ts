import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import {
  flagPhoto as flagPhotoService,
  getPhotoStatus as getPhotoStatusService,
  voteOnPhoto,
} from "../../services/photoVerificationService";

const photoTypeSchema = z.enum(["media", "trail_photo", "review_photo", "activity_media"]);

const votePhotoBodySchema = z.object({
  photo_type: z.enum(["trail_photo", "review_photo", "activity_media", "media"]),
  vote: z.number().int().min(-1).max(1),
});

const flagPhotoBodySchema = z.object({
  photo_type: photoTypeSchema,
  reason: z.enum(["irrelevant", "spam", "offensive", "copyright", "other"]),
  note: z.string().trim().max(1000).optional(),
});

const photoStatusQuerySchema = z.object({
  photo_type: photoTypeSchema,
});

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function sendPhotoControllerError(functionName: string, res: Response, error: unknown): void {
  console.error(`[photos.${functionName}] ERROR CAUGHT:`, error);
  console.error(`[photos.${functionName}] Error message:`, error instanceof Error ? error.message : String(error));
  console.error(`[photos.${functionName}] Error stack:`, error instanceof Error ? error.stack : "No stack");

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof Error && error.message === "Photo not found") {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  if (error instanceof Error && error.message.startsWith("Unsupported photo_type")) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: `${functionName} failed`,
    details: error instanceof Error ? error.message : String(error),
  });
}

export async function votePhoto(req: Request, res: Response): Promise<void> {
  const functionName = "votePhoto";
  console.log("[photos.votePhoto] ========== START ==========");
  console.log("[photos.votePhoto] Params:", req.params);
  console.log("[photos.votePhoto] Body:", req.body);

  try {
    console.log("[photos.votePhoto] 1. Requiring auth");
    const auth = requireAuth(req);
    const photoId = getRequestId(req.params.id);

    console.log("[photos.votePhoto] 2. Validating body");
    const body = votePhotoBodySchema.parse(req.body);
    const photoType = body.photo_type;

    let tableName: "trail_photos" | "review_photos" | "activity_media" | "media";
    switch (photoType) {
      case "trail_photo":
        tableName = "trail_photos";
        break;
      case "review_photo":
        tableName = "review_photos";
        break;
      case "activity_media":
        tableName = "activity_media";
        break;
      case "media":
        tableName = "media";
        break;
      default:
        throw new Error(`Invalid photo_type: ${photoType}`);
    }

    console.log("[photos.votePhoto] 3. Resolved table:", { photoType, tableName, photoId });
    const photoResult = await pool.query(`SELECT id FROM ${tableName} WHERE id = $1::uuid LIMIT 1`, [photoId]);
    console.log("[photos.votePhoto] 4. Photo lookup rows:", photoResult.rows.length);

    if (photoResult.rows.length === 0) {
      console.log("[photos.votePhoto] Photo not found in", tableName, "with id:", photoId);
      res.status(404).json({
        error: "Photo not found",
        details: `No photo found with id ${photoId} in ${tableName} table`,
      });
      return;
    }

    console.log("[photos.votePhoto] 5. Calling vote service");
    await voteOnPhoto(photoId, photoType, auth.sub, body.vote);

    console.log("[photos.votePhoto] 6. Fetching updated status");
    const status = await getPhotoStatusService(photoId, photoType);

    res.json({ message: "Photo vote updated", data: status });
  } catch (error) {
    sendPhotoControllerError(functionName, res, error);
  }
}

export async function flagPhoto(req: Request, res: Response): Promise<void> {
  const functionName = "flagPhoto";
  console.log("[photos.flagPhoto] ========== START ==========");
  console.log("[photos.flagPhoto] Params:", req.params);
  console.log("[photos.flagPhoto] Body:", req.body);

  try {
    console.log("[photos.flagPhoto] 1. Requiring auth");
    const auth = requireAuth(req);
    const photoId = getRequestId(req.params.id);

    console.log("[photos.flagPhoto] 2. Validating body");
    const body = flagPhotoBodySchema.parse(req.body);

    console.log("[photos.flagPhoto] 3. Calling flag service");
    await flagPhotoService(photoId, body.photo_type, auth.sub, body.reason, body.note);

    console.log("[photos.flagPhoto] 4. Fetching updated status");
    const status = await getPhotoStatusService(photoId, body.photo_type);

    res.status(201).json({ message: "Photo flagged", data: status });
  } catch (error) {
    sendPhotoControllerError(functionName, res, error);
  }
}

export async function getPhotoStatus(req: Request, res: Response): Promise<void> {
  console.log("[getPhotoStatus] ========== START ==========");
  console.log("[getPhotoStatus] photo_id param:", req.params.id);
  console.log("[getPhotoStatus] photo_type query:", req.query.photo_type);

  try {
    const photoId = getRequestId(req.params.id);
    const photoType = req.query.photo_type as string | undefined;

    if (!photoType) {
      console.log("[getPhotoStatus] Missing photo_type");
      res.status(400).json({ error: "photo_type query parameter is required" });
      return;
    }

    console.log("[getPhotoStatus] photoType:", photoType);

    let tableName: "media" | "trail_photos" | "review_photos" | "activity_media";
    switch (photoType) {
      case "media":
        tableName = "media";
        break;
      case "trail_photo":
        tableName = "trail_photos";
        break;
      case "review_photo":
        tableName = "review_photos";
        break;
      case "activity_media":
        tableName = "activity_media";
        break;
      default:
        console.log("[getPhotoStatus] Invalid photo_type:", photoType);
        res.status(400).json({
          error: "Invalid photo_type. Must be 'media', 'trail_photo', 'review_photo', or 'activity_media'",
        });
        return;
    }

    console.log("[getPhotoStatus] tableName:", tableName);
    console.log("[getPhotoStatus] Executing status query...");

    const result = await pool.query(
      `SELECT
         id,
         approved_for_trail_page,
         helpful_score,
         flag_count,
         quality_score,
         manual_review_required,
         ai_classification,
         ai_verified_at
       FROM ${tableName}
       WHERE id = $1::uuid`,
      [photoId]
    );

    console.log("[getPhotoStatus] Query result rows:", result.rows.length);

    if (result.rows.length === 0) {
      console.log("[getPhotoStatus] Photo not found in", tableName, "with id:", photoId);
      res.status(404).json({
        error: "Photo not found",
        details: `No photo found with id ${photoId} in ${tableName} table`,
      });
      return;
    }

    const photo = result.rows[0];
    console.log("[getPhotoStatus] Photo found:", {
      id: photo.id,
      approved_for_trail_page: photo.approved_for_trail_page,
      helpful_score: photo.helpful_score,
      flag_count: photo.flag_count,
      quality_score: photo.quality_score,
      manual_review_required: photo.manual_review_required,
      has_ai_classification: Boolean(photo.ai_classification),
      ai_verified_at: photo.ai_verified_at,
    });

    res.json({
      data: {
        photo_id: photo.id,
        photo_type: photoType,
        approved_for_trail_page: photo.approved_for_trail_page === true,
        helpful_score: Number(photo.helpful_score ?? 0),
        flag_count: Number(photo.flag_count ?? 0),
        quality_score: photo.quality_score === null || photo.quality_score === undefined ? null : Number(photo.quality_score),
        manual_review_required: photo.manual_review_required === true,
        ai_classification: photo.ai_classification ?? null,
        ai_verified_at: photo.ai_verified_at ?? null,
      },
    });
  } catch (error) {
    console.error("[getPhotoStatus] ERROR CAUGHT:", error);
    console.error("[getPhotoStatus] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getPhotoStatus] Error stack:", error instanceof Error ? error.stack : "No stack");
    res.status(500).json({
      error: "getPhotoStatus failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
