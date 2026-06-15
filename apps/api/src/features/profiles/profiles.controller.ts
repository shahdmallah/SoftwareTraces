import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import { areFriends, isFollowing } from "../../services/friendService";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  role: string;       
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
}
interface ProfileStatsRow {
  total_reviews: string;
  total_photos: string;
  total_likes_received: string;
  total_followers: string;
  total_following: string;
  total_friends: string;
  total_points: string;
  achievements_count: string;
}

interface RecentAchievementRow {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  description: string;
  description_ar: string | null;
  category: string;
  badge_icon_url: string | null;
  points: number;
  earned_at: string;
}

interface ProfileReviewRow {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  photo_url: string | null;
  photos?: { id: string; url: string; created_at: string }[] | null;
  created_at: string;
  trail_id: string;
  trail_name: string;
  trail_image: string | null;
  likes_count?: string;
  comments_count?: string;
}

interface ProfilePhotoRow {
  id: string;
  url: string;
  caption: string | null;
  created_at: string;
  source: "trail_photo" | "review";
  trail_id: string;
  trail_name: string;
}

interface UploadedAvatarFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const avatarBucket = "media";
const validAvatarMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const avatarExtensionByMimeType: Record<(typeof validAvatarMimeTypes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function getPagination(query: Request["query"]) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function getSupabaseStorageClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizePhotoUrl(source: "trail_photo" | "review", rawUrl: string): string {
  if (source === "review" || rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  try {
    const supabase = getSupabaseStorageClient();
    const { data } = supabase.storage.from("trail-photos").getPublicUrl(rawUrl);
    return data?.publicUrl ?? rawUrl;
  } catch {
    return rawUrl;
  }
}

function parseOptionalProfileString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldName} must be ${maxLength} characters or fewer`);
  }

  return trimmed;
}

function parseOptionalAvatarUrl(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "avatar_url must be a string");
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new HttpError(400, "avatar_url must be a valid URL");
  }

  return trimmed;
}

async function uploadAvatar(userId: string, file: UploadedAvatarFile): Promise<string> {
  if (!validAvatarMimeTypes.includes(file.mimetype as (typeof validAvatarMimeTypes)[number])) {
    throw new HttpError(400, "Invalid avatar image type");
  }

  const extension = avatarExtensionByMimeType[file.mimetype as (typeof validAvatarMimeTypes)[number]];
  const storagePath = `avatars/${userId}/${randomUUID()}.${extension}`;
  const supabase = getSupabaseStorageClient();
  const { error: uploadError } = await supabase.storage.from(avatarBucket).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(avatarBucket).getPublicUrl(storagePath);
  const publicUrl = data?.publicUrl ?? "";

  if (!publicUrl) {
    throw new Error("Failed to resolve avatar URL");
  }

  return publicUrl;
}

async function getProfileByUserId(userId: string): Promise<ProfileRow> {
  const profileResult = await pool.query<ProfileRow>(
    `SELECT
       id,
       user_id,
       full_name,
       role,
       avatar_url,
       bio,
       location
     FROM profiles
     WHERE user_id::text = $1 OR id::text = $1
     LIMIT 1`,
    [userId]
  );


  if (profileResult.rows.length === 0) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return profileResult.rows[0];
}

interface ProfileSearchRow {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
}

export async function searchProfiles(req: Request, res: Response): Promise<void> {
  try {
    const q = String(req.query.q ?? "").trim();
    const { page, limit, offset } = getPagination(req.query);
    const searchTerm = `%${q}%`;

    const [countResult, profilesResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM profiles
         WHERE full_name ILIKE $1
            OR bio ILIKE $1
            OR location ILIKE $1`,
        [searchTerm]
      ),
      pool.query<ProfileSearchRow>(
        `SELECT
           id,
           user_id,
           full_name,
           role,
           avatar_url,
           bio,
           location
         FROM profiles
         WHERE full_name ILIKE $1
            OR bio ILIKE $1
            OR location ILIKE $1
         ORDER BY full_name ASC
         LIMIT $2 OFFSET $3`,
        [searchTerm, limit, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);

    res.json({
      data: profilesResult.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        full_name: row.full_name,
        role: row.role,
        avatar_url: row.avatar_url,
        bio: row.bio,
        location: row.location,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const requestedId = getRequestId(req.params.id);
    const profile = await getProfileByUserId(requestedId);
    const viewerId = req.auth?.sub ?? null;

    const [statsResult, recentReviewsResult, recentPhotosResult, recentAchievementsResult] = await Promise.all([
      pool.query<ProfileStatsRow>(
        `SELECT
           (SELECT COUNT(*) FROM trail_reviews tr WHERE tr.user_id = $1) AS total_reviews,
           (
             (SELECT COUNT(*) FROM trail_photos tp WHERE tp.user_id = $1)
             +
             (SELECT COUNT(*) FROM review_photos rp WHERE rp.user_id = $1)
           ) AS total_photos,
           (
             SELECT COUNT(*)
             FROM review_likes rl
             JOIN trail_reviews tr ON tr.id = rl.review_id
             WHERE tr.user_id = $1
           ) AS total_likes_received,
           (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = $1) AS total_followers,
           (SELECT COUNT(*) FROM user_follows uf WHERE uf.follower_id = $1) AS total_following,
           (
             SELECT COUNT(*)
             FROM user_follows f1
             JOIN user_follows f2
               ON f2.follower_id = f1.following_id
              AND f2.following_id = f1.follower_id
             WHERE f1.follower_id = $1
           ) AS total_friends,
           (SELECT COALESCE(SUM(a.points), 0)
            FROM user_achievements ua
            JOIN achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = $1::uuid
              AND ua.earned_at IS NOT NULL) AS total_points,
           (SELECT COUNT(*)
            FROM user_achievements ua
            WHERE ua.user_id = $1::uuid
              AND ua.earned_at IS NOT NULL) AS achievements_count`,
        [profile.user_id]
      ),
      pool.query<ProfileReviewRow>(
        `SELECT
           tr.id,
           tr.rating,
           tr.title,
           tr.content,
           (
             SELECT rp.photo_url
             FROM review_photos rp
             WHERE rp.review_id = tr.id
             ORDER BY rp.created_at ASC
             LIMIT 1
           ) AS photo_url,
           tr.created_at,
           t.id AS trail_id,
           t.name AS trail_name,
           t.image AS trail_image
         FROM trail_reviews tr
         JOIN trails t ON t.id = tr.trail_id
         WHERE tr.user_id = $1
         ORDER BY tr.created_at DESC
         LIMIT 5`,
        [profile.user_id]
      ),
      pool.query<ProfilePhotoRow>(
        `SELECT
           p.id,
           p.url,
           p.caption,
           p.created_at,
           p.source,
           p.trail_id,
           p.trail_name
         FROM (
           SELECT
             tp.id,
             tp.storage_path AS url,
             tp.caption,
             tp.created_at,
             'trail_photo'::text AS source,
             tp.trail_id,
             t.name AS trail_name
           FROM trail_photos tp
           JOIN trails t ON t.id = tp.trail_id
           WHERE tp.user_id = $1

            UNION ALL

            SELECT
              rp.id,
              rp.photo_url AS url,
              tr.title AS caption,
              rp.created_at,
              'review'::text AS source,
              tr.trail_id,
              t.name AS trail_name
            FROM review_photos rp
            JOIN trail_reviews tr ON tr.id = rp.review_id
            JOIN trails t ON t.id = tr.trail_id
            WHERE rp.user_id = $1
          ) AS p
         ORDER BY p.created_at DESC
         LIMIT 5`,
        [profile.user_id]
      ),
      pool.query<RecentAchievementRow>(
        `SELECT
           a.id,
           a.code,
           a.name,
           a.name_ar,
           a.description,
           a.description_ar,
           a.category,
           a.badge_icon_url,
           a.points,
           ua.earned_at
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = $1::uuid
           AND ua.earned_at IS NOT NULL
         ORDER BY ua.earned_at DESC
         LIMIT 5`,
        [profile.user_id]
      ),
    ]);

    const stats = statsResult.rows[0];
    const [isViewerFollowing, isViewerFollower, isViewerFriend] = viewerId
      ? await Promise.all([
          isFollowing(viewerId, profile.id),
          isFollowing(profile.id, viewerId),
          areFriends(viewerId, profile.id),
        ])
      : [false, false, false];

    res.json({
      data: {
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        role: profile.role,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        location: profile.location,
        stats: {
          total_reviews: Number(stats.total_reviews),
          total_photos: Number(stats.total_photos),
          total_likes_received: Number(stats.total_likes_received),
          total_followers: Number(stats.total_followers),
          total_following: Number(stats.total_following),
          total_friends: Number(stats.total_friends),
          friends_count: Number(stats.total_friends),
          total_points: Number(stats.total_points),
          achievements_count: Number(stats.achievements_count),
        },
        relationship: {
          is_following: isViewerFollowing,
          is_follower: isViewerFollower,
          is_friend: isViewerFriend,
        },
        recent_reviews: recentReviewsResult.rows.map((row) => ({
          id: row.id,
          rating: row.rating,
          title: row.title,
          content: row.content,
          photo_url: row.photo_url,
          created_at: row.created_at,
          trail: {
            id: row.trail_id,
            name: row.trail_name,
            image: row.trail_image,
          },
        })),
        recent_photos: recentPhotosResult.rows.map((row) => ({
          id: row.id,
          url: normalizePhotoUrl(row.source, row.url),
          caption: row.caption,
          created_at: row.created_at,
          source: row.source,
          trail_id: row.trail_id,
          trail_name: row.trail_name,
        })),
        recent_achievements: recentAchievementsResult.rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          name_ar: row.name_ar,
          description: row.description,
          description_ar: row.description_ar,
          category: row.category,
          badge_icon_url: row.badge_icon_url,
          points: Number(row.points),
          earned_at: row.earned_at,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateMyProfile(req: Request & { file?: UploadedAvatarFile }, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const currentProfile = await getProfileByUserId(auth.sub);

    const fullNameInput = parseOptionalProfileString(req.body.full_name, "full_name", 120);
    const bioInput = parseOptionalProfileString(req.body.bio, "bio", 500);
    const locationInput = parseOptionalProfileString(req.body.location, "location", 160);
    const avatarUrlInput = parseOptionalAvatarUrl(req.body.avatar_url);

    const avatarUrl = req.file
      ? await uploadAvatar(auth.sub, req.file)
      : avatarUrlInput;

    const nextFullName = fullNameInput === undefined ? currentProfile.full_name : fullNameInput;

    if (!nextFullName) {
      throw new HttpError(400, "full_name is required");
    }

    const result = await pool.query<ProfileRow>(
      `UPDATE profiles
       SET full_name = $1,
           bio = $2,
           location = $3,
           avatar_url = $4,
           updated_at = NOW()
       WHERE user_id = $5::uuid
       RETURNING id, user_id, full_name, role, avatar_url, bio, location`,
      [
        nextFullName,
        bioInput === undefined ? currentProfile.bio : bioInput,
        locationInput === undefined ? currentProfile.location : locationInput,
        avatarUrl === undefined ? currentProfile.avatar_url : avatarUrl,
        auth.sub,
      ],
    );

    if (!result.rows[0]) {
      throw new HttpError(404, "Profile not found");
    }

    const profile = result.rows[0];

    res.json({
      data: {
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        role: profile.role,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        location: profile.location,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getProfileReviews(req: Request, res: Response): Promise<void> {
  try {
    const requestedId = getRequestId(req.params.id);
    const { page, limit, offset } = getPagination(req.query);
    const profile = await getProfileByUserId(requestedId);

    const [countResult, reviewsResult] = await Promise.all([
      pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM trail_reviews WHERE user_id = $1", [profile.user_id]),
      pool.query<ProfileReviewRow>(
        `SELECT
           tr.id,
           tr.rating,
           tr.title,
           tr.content,
           (
             SELECT rp.photo_url
             FROM review_photos rp
             WHERE rp.review_id = tr.id
             ORDER BY rp.created_at ASC
             LIMIT 1
           ) AS photo_url,
           COALESCE(
             (
               SELECT json_agg(
                 json_build_object(
                   'id', review_photo_list.id,
                   'url', review_photo_list.photo_url,
                   'created_at', review_photo_list.created_at
                 )
                 ORDER BY review_photo_list.created_at ASC
               )
               FROM review_photos review_photo_list
               WHERE review_photo_list.review_id = tr.id
             ),
             '[]'::json
           ) AS photos,
           tr.created_at,
           t.id AS trail_id,
           t.name AS trail_name,
           t.image AS trail_image,
           COUNT(DISTINCT rl.id) AS likes_count,
           COUNT(DISTINCT rc.id) AS comments_count
         FROM trail_reviews tr
         JOIN trails t ON t.id = tr.trail_id
          LEFT JOIN review_likes rl ON rl.review_id = tr.id
          LEFT JOIN review_comments rc ON rc.review_id = tr.id
          WHERE tr.user_id = $1
          GROUP BY tr.id, t.id
         ORDER BY tr.created_at DESC
         LIMIT $2 OFFSET $3`,
        [profile.user_id, limit, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);

    res.json({
      data: reviewsResult.rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        title: row.title,
        content: row.content,
        photo_url: row.photo_url,
        photos: Array.isArray(row.photos) ? row.photos : [],
        created_at: row.created_at,
        trail: {
          id: row.trail_id,
          name: row.trail_name,
          image: row.trail_image,
        },
        likes_count: Number(row.likes_count ?? 0),
        comments_count: Number(row.comments_count ?? 0),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getProfilePhotos(req: Request, res: Response): Promise<void> {
  try {
    const requestedId = getRequestId(req.params.id);
    const { page, limit, offset } = getPagination(req.query);
    const profile = await getProfileByUserId(requestedId);

    const [countResult, photosResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM (
           SELECT id
           FROM trail_photos
           WHERE user_id = $1

           UNION ALL

           SELECT id
           FROM review_photos
           WHERE user_id = $1
         ) AS photos`,
        [profile.user_id]
      ),
      pool.query<ProfilePhotoRow>(
        `SELECT
           p.id,
           p.url,
           p.caption,
           p.created_at,
           p.source,
           p.trail_id,
           p.trail_name
         FROM (
           SELECT
             tp.id,
             tp.storage_path AS url,
             tp.caption,
             tp.created_at,
             'trail_photo'::text AS source,
             tp.trail_id,
             t.name AS trail_name
           FROM trail_photos tp
           JOIN trails t ON t.id = tp.trail_id
           WHERE tp.user_id = $1

            UNION ALL

            SELECT
              rp.id,
              rp.photo_url AS url,
              tr.title AS caption,
              rp.created_at,
              'review'::text AS source,
              tr.trail_id,
              t.name AS trail_name
            FROM review_photos rp
            JOIN trail_reviews tr ON tr.id = rp.review_id
            JOIN trails t ON t.id = tr.trail_id
            WHERE rp.user_id = $1
          ) AS p
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [profile.user_id, limit, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);

    res.json({
      data: photosResult.rows.map((row) => ({
        id: row.id,
        url: normalizePhotoUrl(row.source, row.url),
        caption: row.caption,
        created_at: row.created_at,
        source: row.source,
        trail_id: row.trail_id,
        trail_name: row.trail_name,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
