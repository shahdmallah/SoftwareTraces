import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { areFriends, isFollowing } from "../../services/friendService";

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
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

async function getProfileByUserId(userId: string): Promise<ProfileRow> {
  const profileResult = await pool.query<ProfileRow>(
    `SELECT
       id,
       user_id,
       full_name,
       avatar_url,
       bio,
       location
     FROM profiles
     WHERE user_id = $1 OR id::text = $1
     LIMIT 1`,
    [userId]
  );

  if (profileResult.rows.length === 0) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return profileResult.rows[0];
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const requestedId = getRequestId(req.params.id);
    const profile = await getProfileByUserId(requestedId);
    const viewerId = req.auth?.sub ?? null;

    const [statsResult, recentReviewsResult, recentPhotosResult] = await Promise.all([
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
           ) AS total_friends`,
        [profile.id]
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
