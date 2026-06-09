import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { pool } from "../../db/pool";

type TrailImageTarget = {
  id: string;
  image?: string;
  images?: string[];
};

type ApprovedTrailPhotoRow = {
  trail_id: string;
  storage_path: string | null;
  url: string | null;
  source: "review" | "direct" | "media" | "activity_media";
};

function getSupabaseStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function pushUniqueUrl(urlsByTrail: Map<string, string[]>, trailId: string, url: string): void {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return;
  }

  const urls = urlsByTrail.get(trailId) ?? [];
  if (!urls.includes(trimmedUrl)) {
    urls.push(trimmedUrl);
  }
  urlsByTrail.set(trailId, urls);
}

export async function attachApprovedTrailImages<T extends TrailImageTarget>(
  trails: T[]
): Promise<Array<T & { image: string; images: string[] }>> {
  const trailIds = trails.map((trail) => trail.id).filter(Boolean);
  if (trailIds.length === 0) {
    return trails.map((trail) => ({ ...trail, image: "", images: [] }));
  }

  const result = await pool.query<ApprovedTrailPhotoRow>(
    `WITH approved_photos AS (
       SELECT
         tr.trail_id,
         rp.photo_storage_path AS storage_path,
         NULL::text AS url,
         'review' AS source,
         false AS is_primary,
         COALESCE(rp.helpful_score, 0) AS helpful_score,
         rp.created_at
       FROM review_photos rp
       JOIN trail_reviews tr ON tr.id = rp.review_id
       WHERE tr.trail_id = ANY($1::uuid[])
         AND rp.approved_for_trail_page = true
         AND COALESCE(rp.manual_review_required, false) = false

       UNION ALL

       SELECT
         tp.trail_id,
         tp.storage_path,
         NULL::text AS url,
         'direct' AS source,
         tp.is_primary,
         COALESCE(tp.helpful_score, 0) AS helpful_score,
         tp.created_at
       FROM trail_photos tp
       WHERE tp.trail_id = ANY($1::uuid[])
         AND tp.approved_for_trail_page = true
         AND COALESCE(tp.manual_review_required, false) = false

       UNION ALL

       SELECT
         m.trip_id AS trail_id,
         NULL::text AS storage_path,
         m.url,
         'media' AS source,
         false AS is_primary,
         COALESCE(m.helpful_score, 0) AS helpful_score,
         m.created_at
       FROM media m
       WHERE m.trip_id = ANY($1::uuid[])
         AND m.is_public = true
         AND m.approved_for_trail_page = true
         AND COALESCE(m.manual_review_required, false) = false

       UNION ALL

       SELECT
         a.trail_id,
         NULL::text AS storage_path,
         am.public_url AS url,
         'activity_media' AS source,
         false AS is_primary,
         COALESCE(am.helpful_score, 0) AS helpful_score,
         COALESCE(am.captured_at, am.created_at) AS created_at
       FROM activity_media am
       JOIN activities a ON a.id = am.activity_id
       WHERE a.trail_id = ANY($1::uuid[])
         AND a.is_public = true
         AND am.approved_for_trail_page = true
         AND COALESCE(am.manual_review_required, false) = false
     )
     SELECT trail_id, storage_path, url, source
     FROM approved_photos
     ORDER BY trail_id, is_primary DESC, helpful_score DESC, created_at DESC`,
    [trailIds]
  );

  const urlsByTrail = new Map<string, string[]>();
  const storageClient = result.rows.some((photo) => photo.storage_path) ? getSupabaseStorageClient() : null;

  for (const photo of result.rows) {
    if (photo.storage_path && storageClient) {
      const bucket = photo.source === "review" ? "review-photos" : "trail-photos";
      const { data } = storageClient.storage.from(bucket).getPublicUrl(photo.storage_path);
      pushUniqueUrl(urlsByTrail, photo.trail_id, data?.publicUrl ?? "");
      continue;
    }

    pushUniqueUrl(urlsByTrail, photo.trail_id, photo.url ?? "");
  }

  return trails.map((trail) => {
    const approvedImages = urlsByTrail.get(trail.id) ?? [];
    return {
      ...trail,
      image: approvedImages[0] ?? "",
      images: approvedImages
    };
  });
}
