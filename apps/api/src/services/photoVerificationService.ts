import { pool } from "../db/pool";
import { classifyPhoto, type PhotoClassification } from "./photoClassifier";

export type PhotoType = "media" | "trail_photo" | "review_photo" | "activity_media";

interface PhotoTableConfig {
  table: "media" | "trail_photos" | "review_photos" | "activity_media";
}

interface PhotoStatus {
  photo_id: string;
  photo_type: PhotoType;
  approved_for_trail_page: boolean;
  manual_review_required: boolean;
  helpful_score: number;
  flag_count: number;
  ai_classification: PhotoClassification | null;
}

const photoTableByType: Record<PhotoType, PhotoTableConfig> = {
  media: { table: "media" },
  trail_photo: { table: "trail_photos" },
  review_photo: { table: "review_photos" },
  activity_media: { table: "activity_media" },
};

function getPhotoTable(photoType: string): PhotoTableConfig {
  const config = photoTableByType[photoType as PhotoType];

  if (!config) {
    throw new Error(`Unsupported photo_type: ${photoType}`);
  }

  return config;
}

function isPhotoType(photoType: string): photoType is PhotoType {
  return Object.prototype.hasOwnProperty.call(photoTableByType, photoType);
}

async function recalculateHelpfulScore(photoId: string, photoType: PhotoType): Promise<number> {
  console.log("[photoVerification.recalculateHelpfulScore] Recalculating score:", { photoId, photoType });
  const { table } = getPhotoTable(photoType);
  const scoreResult = await pool.query<{ helpful_score: string }>(
    `SELECT COALESCE(SUM(vote), 0)::text AS helpful_score
     FROM photo_votes
     WHERE photo_id = $1::uuid
       AND photo_type = $2`,
    [photoId, photoType]
  );
  const helpfulScore = Number(scoreResult.rows[0]?.helpful_score ?? 0);

  await pool.query(
    `UPDATE ${table}
     SET helpful_score = $2
     WHERE id = $1::uuid`,
    [photoId, helpfulScore]
  );

  console.log("[photoVerification.recalculateHelpfulScore] Updated score:", helpfulScore);
  return helpfulScore;
}

export async function verifyPhoto(photoId: string, photoType: string, imageBuffer: Buffer): Promise<void> {
  console.log("[photoVerification.verifyPhoto] ========== START ==========");
  console.log("[photoVerification.verifyPhoto] Params:", { photoId, photoType, bufferSize: imageBuffer.length });

  const { table } = getPhotoTable(photoType);
  const classification = await classifyPhoto(imageBuffer);
  const approvedForTrailPage = classification.recommended_for_trail_page && classification.quality_score >= 60;
  const manualReviewRequired = classification.quality === "blurry" || classification.quality === "dark";

  console.log("[photoVerification.verifyPhoto] Classification complete:", {
    approvedForTrailPage,
    manualReviewRequired,
    category: classification.category,
    quality: classification.quality,
    quality_score: classification.quality_score,
  });

  console.log("[photoVerification.verifyPhoto] Updating table:", table);
  await pool.query(
    `UPDATE ${table}
     SET ai_classification = $2::jsonb,
         approved_for_trail_page = $3,
         manual_review_required = $4,
         quality_score = $5,
         ai_verified_at = NOW()
     WHERE id = $1::uuid`,
    [photoId, JSON.stringify(classification), approvedForTrailPage, manualReviewRequired, classification.quality_score]
  );

  console.log("[photoVerification.verifyPhoto] Photo verification update complete:", { photoId, photoType });
}

export async function voteOnPhoto(photoId: string, photoType: string, userId: string, vote: number): Promise<void> {
  console.log("[photoVerification.voteOnPhoto] ========== START ==========");
  console.log("[photoVerification.voteOnPhoto] Params:", { photoId, photoType, userId, vote });

  if (!isPhotoType(photoType)) {
    throw new Error(`Unsupported photo_type: ${photoType}`);
  }

  if (![1, -1, 0].includes(vote)) {
    throw new Error("vote must be 1, -1, or 0");
  }

  const { table } = getPhotoTable(photoType);
  const client = await pool.connect();

  try {
    console.log("[photoVerification.voteOnPhoto] Beginning transaction");
    await client.query("BEGIN");

    console.log("[photoVerification.voteOnPhoto] Checking photo exists in:", table);
    const photoResult = await client.query(`SELECT id FROM ${table} WHERE id = $1::uuid LIMIT 1`, [photoId]);
    if (photoResult.rows.length === 0) {
      throw new Error("Photo not found");
    }

    if (vote === 0) {
      console.log("[photoVerification.voteOnPhoto] Removing vote");
      await client.query(
        `DELETE FROM photo_votes
         WHERE photo_id = $1::uuid
           AND photo_type = $2
           AND user_id = $3::uuid`,
        [photoId, photoType, userId]
      );
    } else {
      console.log("[photoVerification.voteOnPhoto] Upserting vote");
      await client.query(
        `INSERT INTO photo_votes (photo_id, photo_type, user_id, vote)
         VALUES ($1::uuid, $2, $3::uuid, $4)
         ON CONFLICT (photo_id, photo_type, user_id)
         DO UPDATE SET vote = EXCLUDED.vote`,
        [photoId, photoType, userId, vote]
      );
    }

    console.log("[photoVerification.voteOnPhoto] Recalculating helpful_score");
    const scoreResult = await client.query<{ helpful_score: string }>(
      `SELECT COALESCE(SUM(vote), 0)::text AS helpful_score
       FROM photo_votes
       WHERE photo_id = $1::uuid
         AND photo_type = $2`,
      [photoId, photoType]
    );
    const helpfulScore = Number(scoreResult.rows[0]?.helpful_score ?? 0);

    await client.query(
      `UPDATE ${table}
       SET helpful_score = $2
       WHERE id = $1::uuid`,
      [photoId, helpfulScore]
    );

    console.log("[photoVerification.voteOnPhoto] Committing transaction", { helpfulScore });
    await client.query("COMMIT");
  } catch (error) {
    console.error("[photoVerification.voteOnPhoto] Rolling back transaction due to error:", error);
    await client.query("ROLLBACK");
    throw error;
  } finally {
    console.log("[photoVerification.voteOnPhoto] Releasing client");
    client.release();
  }
}

export async function flagPhoto(
  photoId: string,
  photoType: string,
  userId: string,
  reason: string,
  note?: string
): Promise<void> {
  console.log("[photoVerification.flagPhoto] ========== START ==========");
  console.log("[photoVerification.flagPhoto] Params:", { photoId, photoType, userId, reason, hasNote: Boolean(note) });

  if (!isPhotoType(photoType)) {
    throw new Error(`Unsupported photo_type: ${photoType}`);
  }

  const { table } = getPhotoTable(photoType);
  const client = await pool.connect();

  try {
    console.log("[photoVerification.flagPhoto] Beginning transaction");
    await client.query("BEGIN");

    console.log("[photoVerification.flagPhoto] Checking photo exists in:", table);
    const photoResult = await client.query(`SELECT id FROM ${table} WHERE id = $1::uuid LIMIT 1`, [photoId]);
    if (photoResult.rows.length === 0) {
      throw new Error("Photo not found");
    }

    console.log("[photoVerification.flagPhoto] Inserting flag");
    await client.query(
      `INSERT INTO photo_flags (photo_id, photo_type, user_id, reason, note)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5)`,
      [photoId, photoType, userId, reason, note ?? null]
    );

    console.log("[photoVerification.flagPhoto] Incrementing flag_count");
    await client.query(
      `UPDATE ${table}
       SET flag_count = COALESCE(flag_count, 0) + 1
       WHERE id = $1::uuid`,
      [photoId]
    );

    console.log("[photoVerification.flagPhoto] Committing transaction");
    await client.query("COMMIT");
  } catch (error) {
    console.error("[photoVerification.flagPhoto] Rolling back transaction due to error:", error);
    await client.query("ROLLBACK");
    throw error;
  } finally {
    console.log("[photoVerification.flagPhoto] Releasing client");
    client.release();
  }
}

export async function getPhotoStatus(photoId: string, photoType: string): Promise<PhotoStatus> {
  console.log("[photoVerification.getPhotoStatus] ========== START ==========");
  console.log("[photoVerification.getPhotoStatus] Params:", { photoId, photoType });

  if (!isPhotoType(photoType)) {
    throw new Error(`Unsupported photo_type: ${photoType}`);
  }

  const { table } = getPhotoTable(photoType);
  console.log("[photoVerification.getPhotoStatus] Querying table:", table);
  const result = await pool.query<{
    id: string;
    approved_for_trail_page: boolean | null;
    manual_review_required: boolean | null;
    helpful_score: number | string | null;
    flag_count: number | string | null;
    ai_classification: PhotoClassification | null;
  }>(
    `SELECT
       id,
       approved_for_trail_page,
       manual_review_required,
       helpful_score,
       flag_count,
       ai_classification
     FROM ${table}
     WHERE id = $1::uuid
     LIMIT 1`,
    [photoId]
  );

  const photo = result.rows[0];
  if (!photo) {
    throw new Error("Photo not found");
  }

  await recalculateHelpfulScore(photoId, photoType);

  const refreshedResult = await pool.query<{
    approved_for_trail_page: boolean | null;
    manual_review_required: boolean | null;
    helpful_score: number | string | null;
    flag_count: number | string | null;
    ai_classification: PhotoClassification | null;
  }>(
    `SELECT
       approved_for_trail_page,
       manual_review_required,
       helpful_score,
       flag_count,
       ai_classification
     FROM ${table}
     WHERE id = $1::uuid
     LIMIT 1`,
    [photoId]
  );
  const refreshed = refreshedResult.rows[0] ?? photo;

  console.log("[photoVerification.getPhotoStatus] Returning status");
  return {
    photo_id: photoId,
    photo_type: photoType,
    approved_for_trail_page: refreshed.approved_for_trail_page === true,
    manual_review_required: refreshed.manual_review_required === true,
    helpful_score: Number(refreshed.helpful_score ?? 0),
    flag_count: Number(refreshed.flag_count ?? 0),
    ai_classification: refreshed.ai_classification,
  };
}
