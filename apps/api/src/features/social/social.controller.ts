import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../lib/httpError";
import {
  getFriendCount as countFriends,
  getFriends as listFriends,
} from "../../services/friendService";
import { createNotification } from "../notifications/notifications.service";
import type { CreateNotificationInput } from "../notifications/notifications.types";

type FeedPhotoRow = {
  id: string;
  url: string;
  created_at: string;
  nature_sighting?: Record<string, unknown> | null;
};

interface FeedReviewRow {
  id: string;
  type: "review" | "activity" | "media";
  rating: number | null;
  title: string | null;
  content: string | null;
  caption: string | null;
  visibility: string | null;
  photo_url: string | null;
  photos: FeedPhotoRow[] | null;
  created_at: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  trail_id: string | null;
  trail_name: string | null;
  trail_image: string | null;
  activity_id: string | null;
  distance_meters: number | null;
  elapsed_time_seconds: number | null;
  elevation_gain_meters: number | null;
  elevation_loss_meters: number | null;
  max_elevation_meters: number | null;
  min_elevation_meters: number | null;
  likes_count: string;
  is_liked_by_user: boolean;
  comments_count: string;
}

type SocialFeedResponseItem = {
  id: string;
  type: "review" | "activity" | "media";
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  trail: {
    id: string | null;
    name: string | null;
    image: string | null;
  };
  rating: number | null;
  title: string | null;
  content: string | null;
  caption: string | null;
  visibility: string | null;
  photo_url: string | null;
  photos: FeedPhotoRow[];
  activity: {
    id: string | null;
    distance_meters: number | null;
    elapsed_time_seconds: number | null;
    elevation_gain_meters: number | null;
    elevation_loss_meters: number | null;
    max_elevation_meters: number | null;
    min_elevation_meters: number | null;
    elevation_summary: {
      gain_meters: number | null;
      loss_meters: number | null;
      max_meters: number | null;
      min_meters: number | null;
    };
  } | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
};

interface FollowProfileRow {
  id: string;
  user_id?: string;
  full_name: string;
  avatar_url: string | null;
}

interface FriendSuggestionRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  mutual_following_count: string;
}

interface ReviewCommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ActivityCommentRow {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at: string;
  full_name: string;
  avatar_url: string | null;
}

interface ActivityPostAccessRow {
  activity_id: string;
  owner_id: string;
  visibility: string;
  trail_id: string | null;
  trail_name: string | null;
  actor_full_name: string | null;
}

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getPagination(query: Request["query"]) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

const mediaFeedGroupKeySql = `
  CASE
    WHEN (
      m.trip_id IS NOT NULL
      OR NULLIF(BTRIM(m.location_name), '') IS NOT NULL
      OR (m.latitude IS NOT NULL AND m.longitude IS NOT NULL)
    )
    THEN CONCAT_WS(
      '|',
      m.uploader_id::text,
      COALESCE(m.trip_id::text, 'no-trip'),
      COALESCE(
        NULLIF(LOWER(BTRIM(m.location_name)), ''),
        CASE
          WHEN m.latitude IS NOT NULL AND m.longitude IS NOT NULL
          THEN CONCAT(ROUND(m.latitude::numeric, 5)::text, ',', ROUND(m.longitude::numeric, 5)::text)
          ELSE NULL
        END,
        'no-location'
      ),
      FLOOR(EXTRACT(EPOCH FROM m.created_at) / 300)::bigint::text
    )
    ELSE m.id::text
  END
`;

function formatFeedItem(row: FeedReviewRow): SocialFeedResponseItem {
  return {
    id: row.id,
    type: row.type,
    user: {
      id: row.user_id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
    },
    trail: {
      id: row.trail_id,
      name: row.trail_name,
      image: row.trail_image,
    },
    rating: row.rating,
    title: row.title,
    content: row.content,
    caption: row.caption,
    visibility: row.visibility,
    photo_url: row.photo_url,
    photos: Array.isArray(row.photos) ? row.photos : [],
    activity:
      row.type === "activity"
        ? {
            id: row.activity_id,
            distance_meters: row.distance_meters,
            elapsed_time_seconds: row.elapsed_time_seconds,
            elevation_gain_meters: row.elevation_gain_meters,
            elevation_loss_meters: row.elevation_loss_meters,
            max_elevation_meters: row.max_elevation_meters,
            min_elevation_meters: row.min_elevation_meters,
            elevation_summary: {
              gain_meters: row.elevation_gain_meters,
              loss_meters: row.elevation_loss_meters,
              max_meters: row.max_elevation_meters,
              min_meters: row.min_elevation_meters,
            },
          }
        : null,
    created_at: row.created_at,
    likes_count: Number(row.likes_count),
    comments_count: Number(row.comments_count),
    is_liked_by_user: row.is_liked_by_user,
  };
}

function logSocialError(functionName: string, error: unknown): void {
  console.error(`[${functionName}] ERROR CAUGHT:`, error);
  console.error(`[${functionName}] Error message:`, error instanceof Error ? error.message : String(error));
  console.error(`[${functionName}] Error stack:`, error instanceof Error ? error.stack : "No stack");
}

function sendSocialError(functionName: string, res: Response, error: unknown): void {
  logSocialError(functionName, error);

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: `${functionName} failed: ${error.message}`,
    });
    return;
  }

  res.status(500).json({
    error: `${functionName} failed`,
    details: error instanceof Error ? error.message : String(error),
  });
}

async function ensureProfileExists(userId: string): Promise<void> {
  console.log("[ensureProfileExists] Checking userId:", userId);
  const result = await pool.query("SELECT user_id FROM profiles WHERE user_id::text = $1 OR id::text = $1", [userId]);
  console.log("[ensureProfileExists] Rows found:", result.rows.length);

  if (result.rows.length === 0) {
    throw new HttpError(404, "User not found");
  }
}

async function ensureReviewExists(reviewId: string): Promise<void> {
  console.log("[ensureReviewExists] Checking reviewId:", reviewId);
  const result = await pool.query("SELECT id FROM trail_reviews WHERE id = $1::uuid", [reviewId]);
  console.log("[ensureReviewExists] Rows found:", result.rows.length);

  if (result.rows.length === 0) {
    throw new HttpError(404, "Review not found");
  }
}

async function getAccessibleActivityPost(activityId: string, userId: string): Promise<ActivityPostAccessRow> {
  if (!isUuid(activityId)) {
    throw new HttpError(400, "Activity id must be a valid UUID");
  }

  const result = await pool.query<ActivityPostAccessRow>(
    `SELECT
       a.id AS activity_id,
       ap.user_id AS owner_id,
       ap.visibility,
       a.trail_id,
       t.name AS trail_name,
       actor.full_name AS actor_full_name
     FROM activities a
     JOIN activity_posts ap ON ap.activity_id = a.id
     LEFT JOIN trails t ON t.id = a.trail_id
     LEFT JOIN profiles actor ON actor.id = $2::uuid
     WHERE a.id = $1::uuid
     ORDER BY ap.created_at DESC
     LIMIT 1`,
    [activityId, userId]
  );
  const activityPost = result.rows[0];

  if (!activityPost) {
    throw new HttpError(404, "Activity post not found");
  }

  if (activityPost.visibility === "private" && activityPost.owner_id !== userId) {
    throw new HttpError(403, "Not authorized to interact with this activity post");
  }

  if (activityPost.visibility === "friends" && activityPost.owner_id !== userId) {
    const friendshipResult = await pool.query(
      `SELECT 1
       FROM user_follows owner_follow
       JOIN user_follows viewer_follow
         ON viewer_follow.follower_id = $2::uuid
        AND viewer_follow.following_id = $1::uuid
       WHERE owner_follow.follower_id = $1::uuid
         AND owner_follow.following_id = $2::uuid
       LIMIT 1`,
      [activityPost.owner_id, userId]
    );

    if (friendshipResult.rows.length === 0) {
      throw new HttpError(403, "Not authorized to interact with this activity post");
    }
  }

  return activityPost;
}

async function createNotificationBestEffort(input: CreateNotificationInput): Promise<void> {
  if (input.actor_id && input.actor_id === input.user_id) {
    console.log("[social.createNotificationBestEffort] Skipping self-notification:", {
      type: input.type,
      user_id: input.user_id,
    });
    return;
  }

  try {
    console.log("[social.createNotificationBestEffort] Creating notification:", {
      type: input.type,
      user_id: input.user_id,
      actor_id: input.actor_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
    });
    await createNotification(input);
  } catch (error) {
    console.error("[social.createNotificationBestEffort] Failed to create notification:", error);
  }
}

export async function getFollowers(req: Request, res: Response): Promise<void> {
  const functionName = "getFollowers";
  const targetUserId = getRequestId(req.params.id);
  const { page, limit, offset } = getPagination(req.query);
  console.log(`[social] getFollowers START - userId: ${targetUserId}`);
  console.log("[getFollowers] Params:", { targetUserId, page, limit, offset, query: req.query });

  try {
    console.log("[getFollowers] Step 1: Checking profile exists...");
    await ensureProfileExists(targetUserId);

    console.log("[getFollowers] Step 2: Counting followers...");
    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM user_follows WHERE following_id = $1::uuid",
      [targetUserId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    console.log("[getFollowers] Step 3: Followers count:", total);

    console.log("[getFollowers] Step 4: Querying followers page...");
    const result = await pool.query<FollowProfileRow>(
      `SELECT
         p.user_id AS id,
         p.full_name,
         p.avatar_url
       FROM user_follows uf
       JOIN profiles p ON p.id = uf.follower_id
       WHERE uf.following_id = $1::uuid
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset]
    );
    console.log("[getFollowers] Step 5: Followers rows returned:", result.rows.length);

    res.json({
      count: result.rows.length,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function followUser(req: Request, res: Response): Promise<void> {
  const functionName = "followUser";
  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = getRequestId(req.params.id);
    console.log(`[social] followUser START - targetUserId: ${targetUserId}, authUserId: ${currentUserId}`);
    console.log("[followUser] Params:", { currentUserId, targetUserId, body: req.body });

    if (currentUserId === targetUserId) {
      console.warn("[followUser] User attempted to follow themselves:", currentUserId);
      res.status(400).json({ error: "Users cannot follow themselves" });
      return;
    }

    console.log("[followUser] Step 1: Checking target profile exists...");
    await ensureProfileExists(targetUserId);

    console.log("[followUser] Step 2: Inserting follow row...");
    const result = await pool.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT DO NOTHING
       RETURNING follower_id`,
      [currentUserId, targetUserId]
    );
    console.log("[followUser] Step 3: Insert rows returned:", result.rows.length);

    if (result.rows.length === 0) {
      console.warn("[followUser] Already following:", { currentUserId, targetUserId });
      res.status(409).json({ error: "Already following this user" });
      return;
    }

    console.log("[followUser] Step 4: Fetching follower profile for notification...");
    const followerProfileResult = await pool.query<{ full_name: string | null }>(
      "SELECT full_name FROM profiles WHERE id = $1::uuid LIMIT 1",
      [currentUserId]
    );
    const currentUserFullName = followerProfileResult.rows[0]?.full_name ?? "Someone";

    await createNotificationBestEffort({
      user_id: targetUserId,
      actor_id: currentUserId,
      type: "follow",
      title: "New follower",
      body: `${currentUserFullName} started following you`,
      entity_type: "user",
      entity_id: currentUserId,
      data: { follower_id: currentUserId },
    });

    res.status(201).json({ message: "User followed successfully", data: { follower_id: currentUserId, following_id: targetUserId } });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function unfollowUser(req: Request, res: Response): Promise<void> {
  const functionName = "unfollowUser";
  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = getRequestId(req.params.id);
    console.log(`[social] unfollowUser START - targetUserId: ${targetUserId}, authUserId: ${currentUserId}`);
    console.log("[unfollowUser] Params:", { currentUserId, targetUserId });

    console.log("[unfollowUser] Step 1: Deleting follow row...");
    const result = await pool.query(
      "DELETE FROM user_follows WHERE follower_id = $1::uuid AND following_id = $2::uuid",
      [currentUserId, targetUserId]
    );
    console.log("[unfollowUser] Step 2: Rows deleted:", result.rowCount);

    res.json({ message: "User unfollowed successfully", deleted: result.rowCount ?? 0 });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getFollowing(req: Request, res: Response): Promise<void> {
  const functionName = "getFollowing";
  const targetUserId = getRequestId(req.params.id);
  const { page, limit, offset } = getPagination(req.query);
  console.log(`[social] getFollowing START - userId: ${targetUserId}`);
  console.log("[getFollowing] Params:", { targetUserId, page, limit, offset, query: req.query });

  try {
    console.log("[getFollowing] Step 1: Checking profile exists...");
    await ensureProfileExists(targetUserId);

    console.log("[getFollowing] Step 2: Counting following rows...");
    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = $1::uuid",
      [targetUserId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    console.log("[getFollowing] Step 3: Following count:", total);

    console.log("[getFollowing] Step 4: Querying following page...");
    const result = await pool.query<FollowProfileRow>(
      `SELECT
         p.user_id AS id,
         p.full_name,
         p.avatar_url
       FROM user_follows uf
       JOIN profiles p ON p.id = uf.following_id
       WHERE uf.follower_id = $1::uuid
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset]
    );
    console.log("[getFollowing] Step 5: Following rows returned:", result.rows.length);

    res.json({
      count: result.rows.length,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getFriends(req: Request, res: Response): Promise<void> {
  const functionName = "getFriends";
  const targetUserId = getRequestId(req.params.id);
  const { page, limit, offset } = getPagination(req.query);
  console.log(`[social] getFriends START - userId: ${targetUserId}`);

  try {
    await ensureProfileExists(targetUserId);

    const [friends, total] = await Promise.all([
      listFriends(targetUserId, limit, offset),
      countFriends(targetUserId),
    ]);

    res.json({
      count: friends.length,
      data: friends,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getMyFriends(req: Request, res: Response): Promise<void> {
  const functionName = "getMyFriends";

  try {
    const auth = requireAuth(req);
    const { page, limit, offset } = getPagination(req.query);
    const [friends, total] = await Promise.all([
      listFriends(auth.sub, limit, offset),
      countFriends(auth.sub),
    ]);

    res.json({
      count: friends.length,
      data: friends,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getFriendCount(req: Request, res: Response): Promise<void> {
  const functionName = "getFriendCount";
  const targetUserId = getRequestId(req.params.id);

  try {
    await ensureProfileExists(targetUserId);
    const total = await countFriends(targetUserId);

    res.json({ count: total });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getFriendSuggestions(req: Request, res: Response): Promise<void> {
  const functionName = "getFriendSuggestions";

  try {
    const auth = requireAuth(req);
    const { page, limit, offset } = getPagination(req.query);
    console.log(`[social] getFriendSuggestions START - userId: ${auth.sub}`);

    const result = await pool.query<FriendSuggestionRow>(
      `SELECT
         COALESCE(candidate.user_id, candidate.id) AS id,
         candidate.full_name,
         candidate.avatar_url,
         COUNT(DISTINCT mine.following_id)::text AS mutual_following_count
       FROM user_follows mine
       JOIN user_follows followed ON followed.follower_id = mine.following_id
       JOIN profiles candidate ON candidate.id = followed.following_id
       WHERE mine.follower_id = $1::uuid
         AND followed.following_id <> $1::uuid
         AND NOT EXISTS (
           SELECT 1
           FROM user_follows already_following
           WHERE already_following.follower_id = $1::uuid
             AND already_following.following_id = followed.following_id
         )
       GROUP BY candidate.id, candidate.user_id, candidate.full_name, candidate.avatar_url
       ORDER BY COUNT(DISTINCT followed.following_id) DESC, candidate.full_name ASC
       LIMIT $2 OFFSET $3`,
      [auth.sub, limit, offset]
    );

    res.json({
      count: result.rows.length,
      data: result.rows.map((row) => ({
        id: row.id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        mutual_following_count: Number(row.mutual_following_count),
      })),
      pagination: {
        page,
        limit,
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function removeFriend(req: Request, res: Response): Promise<void> {
  const functionName = "removeFriend";

  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = getRequestId(req.params.id);
    console.log(`[social] removeFriend START - targetUserId: ${targetUserId}, authUserId: ${currentUserId}`);

    if (currentUserId === targetUserId) {
      res.status(400).json({ error: "Users cannot remove themselves as a friend" });
      return;
    }

    await ensureProfileExists(targetUserId);

    const result = await pool.query(
      `DELETE FROM user_follows
       WHERE (follower_id = $1::uuid AND following_id = $2::uuid)
          OR (follower_id = $2::uuid AND following_id = $1::uuid)`,
      [currentUserId, targetUserId]
    );

    res.json({
      message: "Friend removed successfully",
      deleted: result.rowCount ?? 0,
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getFeed(req: Request, res: Response): Promise<void> {
  const functionName = "getFeed";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const { page, limit, offset } = getPagination(req.query);
    const filter = req.query.filter === "friends" ? "friends" : "all";
    console.log(`[social] getFeed START - userId: ${userId}, page: ${page}, limit: ${limit}, filter: ${filter}`);
    console.log("[getFeed] Params:", { userId, page, limit, offset, filter, query: req.query });

    console.log("[getFeed] Step 1: Counting combined feed rows...");
    const countResult = await pool.query<{ count: string }>(
      `
      WITH feed_rows AS (
        SELECT tr.id::text
        FROM trail_reviews tr
        LEFT JOIN user_follows uf
          ON uf.following_id = tr.user_id
         AND uf.follower_id = $1::uuid
        WHERE (tr.user_id = $1::uuid OR uf.follower_id IS NOT NULL)
          AND (
            tr.user_id = $1::uuid
            OR
            $2::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = tr.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
        UNION ALL
        SELECT ap.id::text
        FROM activity_posts ap
        LEFT JOIN user_follows uf
          ON uf.following_id = ap.user_id
         AND uf.follower_id = $1::uuid
        WHERE (ap.user_id = $1::uuid OR uf.follower_id IS NOT NULL)
          AND ap.visibility <> 'private'
          AND (
            ap.user_id = $1::uuid
            OR
            $2::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = ap.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
          AND (
            ap.user_id = $1::uuid
            OR
            ap.visibility = 'public'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_visibility_follow
              WHERE reverse_visibility_follow.follower_id = ap.user_id
                AND reverse_visibility_follow.following_id = $1::uuid
            )
          )
        UNION ALL
        SELECT ${mediaFeedGroupKeySql}
        FROM media m
        LEFT JOIN user_follows uf
          ON uf.following_id = m.uploader_id
         AND uf.follower_id = $1::uuid
        WHERE m.is_public = true
          AND (m.uploader_id = $1::uuid OR uf.follower_id IS NOT NULL)
          AND (
            m.uploader_id = $1::uuid
            OR
            $2::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = m.uploader_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
        GROUP BY ${mediaFeedGroupKeySql}
      )
      SELECT COUNT(*) AS count
      FROM feed_rows
      `,
      [userId, filter]
    );

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    console.log("[getFeed] Step 2: Combined feed total count:", total);

    console.log("[getFeed] Step 3: Querying combined feed rows...");
    const result = await pool.query<FeedReviewRow>(
      `
      WITH feed_rows AS (
        SELECT
          tr.id,
          tr.created_at,
          'review'::text AS type,
          tr.rating,
          tr.title,
          tr.content,
          NULL::text AS caption,
          NULL::text AS visibility,
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
                  'created_at', review_photo_list.created_at,
                  'nature_sighting',
                  (
                    SELECT row_to_json(sighting)
                    FROM (
                      SELECT
                        ns.id,
                        ns.trail_id,
                        ns.activity_id,
                        ns.user_id,
                        ns.latitude,
                        ns.longitude,
                        ns.category,
                        ns.species,
                        ns.common_name,
                        ns.confidence,
                        ns.photo_url,
                        ns.photo_id,
                        ns.photo_type,
                        ns.media_id,
                        ns.activity_media_id,
                        ns.classification,
                        ns.language,
                        ns.source,
                        ns.created_at,
                        ns.updated_at
                      FROM nature_sightings ns
                      WHERE ns.photo_id = review_photo_list.id
                        AND ns.photo_type = 'review_photo'
                      ORDER BY ns.created_at DESC
                      LIMIT 1
                    ) sighting
                  )
                )
                ORDER BY review_photo_list.created_at ASC
              )
              FROM review_photos review_photo_list
              WHERE review_photo_list.review_id = tr.id
            ),
            '[]'::json
          ) AS photos,
          p.user_id,
          p.full_name,
          p.avatar_url,
          t.id AS trail_id,
          t.name AS trail_name,
          t.image AS trail_image,
          NULL::uuid AS activity_id,
          NULL::numeric AS distance_meters,
          NULL::integer AS elapsed_time_seconds,
          NULL::numeric AS elevation_gain_meters,
          NULL::numeric AS elevation_loss_meters,
          NULL::numeric AS max_elevation_meters,
          NULL::numeric AS min_elevation_meters,
          COUNT(DISTINCT rl.id)::text AS likes_count,
          COUNT(DISTINCT rc.id)::text AS comments_count,
          EXISTS(
            SELECT 1
            FROM review_likes review_like_lookup
            WHERE review_like_lookup.review_id = tr.id
              AND review_like_lookup.user_id = $1::uuid
          ) AS is_liked_by_user
        FROM trail_reviews tr
        LEFT JOIN user_follows uf
          ON uf.following_id = tr.user_id
         AND uf.follower_id = $1::uuid
        JOIN profiles p ON p.id = tr.user_id
        JOIN trails t ON t.id = tr.trail_id
        LEFT JOIN review_likes rl ON rl.review_id = tr.id
        LEFT JOIN review_comments rc ON rc.review_id = tr.id
        WHERE (tr.user_id = $1::uuid OR uf.follower_id IS NOT NULL)
          AND (
            tr.user_id = $1::uuid
            OR
            $4::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = tr.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
        GROUP BY tr.id, p.user_id, p.full_name, p.avatar_url, t.id, t.name, t.image

        UNION ALL

        SELECT
          ap.id,
          ap.created_at,
          'activity'::text AS type,
          NULL::integer AS rating,
          NULL::text AS title,
          NULL::text AS content,
          ap.caption,
          ap.visibility,
          (
            SELECT am.public_url
            FROM activity_media am
            WHERE am.activity_id = a.id
            ORDER BY am.captured_at ASC, am.created_at ASC
            LIMIT 1
          ) AS photo_url,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', activity_media_list.id,
                  'url', activity_media_list.public_url,
                  'created_at', activity_media_list.created_at,
                  'nature_sighting',
                  (
                    SELECT row_to_json(sighting)
                    FROM (
                      SELECT
                        ns.id,
                        ns.trail_id,
                        ns.activity_id,
                        ns.user_id,
                        ns.latitude,
                        ns.longitude,
                        ns.category,
                        ns.species,
                        ns.common_name,
                        ns.confidence,
                        ns.photo_url,
                        ns.photo_id,
                        ns.photo_type,
                        ns.media_id,
                        ns.activity_media_id,
                        ns.classification,
                        ns.language,
                        ns.source,
                        ns.created_at,
                        ns.updated_at
                      FROM nature_sightings ns
                      WHERE ns.photo_id = activity_media_list.id
                        AND ns.photo_type = 'activity_media'
                      ORDER BY ns.created_at DESC
                      LIMIT 1
                    ) sighting
                  )
                )
                ORDER BY activity_media_list.captured_at ASC, activity_media_list.created_at ASC
              )
              FROM activity_media activity_media_list
              WHERE activity_media_list.activity_id = a.id
            ),
            '[]'::json
          ) AS photos,
          p.user_id,
          p.full_name,
          p.avatar_url,
          a.trail_id,
          t.name AS trail_name,
          t.image AS trail_image,
          a.id AS activity_id,
          a.distance_meters,
          a.elapsed_time_seconds,
          a.elevation_gain_meters,
          a.elevation_loss_meters,
          a.max_elevation_meters,
          a.min_elevation_meters,
          (
            SELECT COUNT(*)::text
            FROM activity_likes activity_like_count
            WHERE activity_like_count.activity_id = a.id
          ) AS likes_count,
          (
            SELECT COUNT(*)::text
            FROM activity_comments activity_comment_count
            WHERE activity_comment_count.activity_id = a.id
          ) AS comments_count,
          EXISTS(
            SELECT 1
            FROM activity_likes activity_like_lookup
            WHERE activity_like_lookup.activity_id = a.id
              AND activity_like_lookup.user_id = $1::uuid
          ) AS is_liked_by_user
        FROM activity_posts ap
        LEFT JOIN user_follows uf
          ON uf.following_id = ap.user_id
         AND uf.follower_id = $1::uuid
        JOIN activities a ON a.id = ap.activity_id
        JOIN profiles p ON p.id = ap.user_id
        LEFT JOIN trails t ON t.id = a.trail_id
        WHERE (ap.user_id = $1::uuid OR uf.follower_id IS NOT NULL)
          AND ap.visibility <> 'private'
          AND (
            ap.user_id = $1::uuid
            OR
            $4::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = ap.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
          AND (
            ap.user_id = $1::uuid
            OR
            ap.visibility = 'public'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_visibility_follow
              WHERE reverse_visibility_follow.follower_id = ap.user_id
                AND reverse_visibility_follow.following_id = $1::uuid
            )
          )

        UNION ALL

        SELECT
          media_group.id,
          media_group.created_at,
          'media'::text AS type,
          NULL::integer AS rating,
          NULL::text AS title,
          NULL::text AS content,
          media_group.caption,
          CASE WHEN media_group.is_public THEN 'public' ELSE 'private' END AS visibility,
          media_group.photo_url,
          media_group.photos,
          media_group.user_id,
          COALESCE(p.full_name, 'Trail friend') AS full_name,
          p.avatar_url,
          t.id AS trail_id,
          COALESCE(t.name, media_group.location_name) AS trail_name,
          t.image AS trail_image,
          NULL::uuid AS activity_id,
          NULL::numeric AS distance_meters,
          NULL::integer AS elapsed_time_seconds,
          NULL::numeric AS elevation_gain_meters,
          NULL::numeric AS elevation_loss_meters,
          NULL::numeric AS max_elevation_meters,
          NULL::numeric AS min_elevation_meters,
          '0'::text AS likes_count,
          '0'::text AS comments_count,
          false AS is_liked_by_user
        FROM (
          SELECT
            (ARRAY_AGG(m.id ORDER BY m.created_at ASC, m.id ASC))[1] AS id,
            MAX(m.created_at) AS created_at,
            ${mediaFeedGroupKeySql} AS group_key,
            MAX(m.caption) AS caption,
            BOOL_OR(m.is_public) AS is_public,
            (json_agg(
              json_build_object(
                'id', m.id,
                'url', m.url,
                'created_at', m.created_at,
                'nature_sighting',
                (
                  SELECT row_to_json(sighting)
                  FROM (
                    SELECT
                      ns.id,
                      ns.trail_id,
                      ns.activity_id,
                      ns.user_id,
                      ns.latitude,
                      ns.longitude,
                      ns.category,
                      ns.species,
                      ns.common_name,
                      ns.confidence,
                      ns.photo_url,
                      ns.photo_id,
                      ns.photo_type,
                      ns.media_id,
                      ns.activity_media_id,
                      ns.classification,
                      ns.language,
                      ns.source,
                      ns.created_at,
                      ns.updated_at
                    FROM nature_sightings ns
                    WHERE ns.photo_id = m.id
                      AND ns.photo_type = 'media'
                    ORDER BY ns.created_at DESC
                    LIMIT 1
                  ) sighting
                )
              )
              ORDER BY m.created_at ASC
            )->0->>'url') AS photo_url,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', m.id,
                  'url', m.url,
                  'created_at', m.created_at,
                  'nature_sighting',
                  (
                    SELECT row_to_json(sighting)
                    FROM (
                      SELECT
                        ns.id,
                        ns.trail_id,
                        ns.activity_id,
                        ns.user_id,
                        ns.latitude,
                        ns.longitude,
                        ns.category,
                        ns.species,
                        ns.common_name,
                        ns.confidence,
                        ns.photo_url,
                        ns.photo_id,
                        ns.photo_type,
                        ns.media_id,
                        ns.activity_media_id,
                        ns.classification,
                        ns.language,
                        ns.source,
                        ns.created_at,
                        ns.updated_at
                      FROM nature_sightings ns
                      WHERE ns.photo_id = m.id
                        AND ns.photo_type = 'media'
                      ORDER BY ns.created_at DESC
                      LIMIT 1
                    ) sighting
                  )
                )
                ORDER BY m.created_at ASC
              ),
              '[]'::json
            ) AS photos,
            m.uploader_id AS user_id,
            m.trip_id,
            MAX(m.location_name) AS location_name
          FROM media m
          LEFT JOIN user_follows uf
            ON uf.following_id = m.uploader_id
           AND uf.follower_id = $1::uuid
          WHERE m.is_public = true
            AND (m.uploader_id = $1::uuid OR uf.follower_id IS NOT NULL)
            AND (
              m.uploader_id = $1::uuid
              OR
              $4::text = 'all'
              OR EXISTS (
                SELECT 1
                FROM user_follows reverse_follow
                WHERE reverse_follow.follower_id = m.uploader_id
                  AND reverse_follow.following_id = $1::uuid
              )
            )
          GROUP BY ${mediaFeedGroupKeySql}, m.uploader_id, m.trip_id
        ) media_group
        LEFT JOIN profiles p ON p.id = media_group.user_id
        LEFT JOIN trails t ON t.id = media_group.trip_id
      )
      SELECT *
      FROM feed_rows
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset, filter]
    );
    console.log("[getFeed] Step 4: Feed rows returned:", result.rows.length);

    console.log("[getFeed] Step 5: Formatting feed response...");
    res.json({
      data: result.rows.map(formatFeedItem),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
    console.log("[getFeed] Step 6: Response sent");
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getFeedItemByEntity(req: Request, res: Response): Promise<void> {
  const functionName = "getFeedItemByEntity";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const entityType = getRequestId(req.params.type);
    const entityId = getRequestId(req.params.id);
    console.log(`[social] getFeedItemByEntity START - type: ${entityType}, id: ${entityId}, userId: ${userId}`);

    if ((entityType !== "review" && entityType !== "activity" && entityType !== "media") || !isUuid(entityId)) {
      throw new HttpError(400, "Feed item target must be a review, activity, or media UUID");
    }

    const result = await pool.query<FeedReviewRow>(
      `
      WITH target_review AS (
        SELECT
          tr.id,
          tr.created_at,
          'review'::text AS type,
          tr.rating,
          tr.title,
          tr.content,
          NULL::text AS caption,
          NULL::text AS visibility,
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
                  'created_at', review_photo_list.created_at,
                  'nature_sighting',
                  (
                    SELECT row_to_json(sighting)
                    FROM (
                      SELECT
                        ns.id,
                        ns.trail_id,
                        ns.activity_id,
                        ns.user_id,
                        ns.latitude,
                        ns.longitude,
                        ns.category,
                        ns.species,
                        ns.common_name,
                        ns.confidence,
                        ns.photo_url,
                        ns.photo_id,
                        ns.photo_type,
                        ns.media_id,
                        ns.activity_media_id,
                        ns.classification,
                        ns.language,
                        ns.source,
                        ns.created_at,
                        ns.updated_at
                      FROM nature_sightings ns
                      WHERE ns.photo_id = review_photo_list.id
                        AND ns.photo_type = 'review_photo'
                      ORDER BY ns.created_at DESC
                      LIMIT 1
                    ) sighting
                  )
                )
                ORDER BY review_photo_list.created_at ASC
              )
              FROM review_photos review_photo_list
              WHERE review_photo_list.review_id = tr.id
            ),
            '[]'::json
          ) AS photos,
          p.user_id,
          p.full_name,
          p.avatar_url,
          t.id AS trail_id,
          t.name AS trail_name,
          t.image AS trail_image,
          NULL::uuid AS activity_id,
          NULL::numeric AS distance_meters,
          NULL::integer AS elapsed_time_seconds,
          NULL::numeric AS elevation_gain_meters,
          NULL::numeric AS elevation_loss_meters,
          NULL::numeric AS max_elevation_meters,
          NULL::numeric AS min_elevation_meters,
          COUNT(DISTINCT rl.id)::text AS likes_count,
          COUNT(DISTINCT rc.id)::text AS comments_count,
          EXISTS(
            SELECT 1
            FROM review_likes review_like_lookup
            WHERE review_like_lookup.review_id = tr.id
              AND review_like_lookup.user_id = $1::uuid
          ) AS is_liked_by_user
        FROM trail_reviews tr
        JOIN profiles p ON p.id = tr.user_id
        JOIN trails t ON t.id = tr.trail_id
        LEFT JOIN review_likes rl ON rl.review_id = tr.id
        LEFT JOIN review_comments rc ON rc.review_id = tr.id
        WHERE $2::text = 'review'
          AND tr.id = $3::uuid
        GROUP BY tr.id, p.user_id, p.full_name, p.avatar_url, t.id, t.name, t.image
      ),
      target_activity AS (
        SELECT
          ap.id,
          ap.created_at,
          'activity'::text AS type,
          NULL::integer AS rating,
          NULL::text AS title,
          NULL::text AS content,
          ap.caption,
          ap.visibility,
          (
            SELECT am.public_url
            FROM activity_media am
            WHERE am.activity_id = a.id
            ORDER BY am.captured_at ASC, am.created_at ASC
            LIMIT 1
          ) AS photo_url,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', activity_media_list.id,
                  'url', activity_media_list.public_url,
                  'created_at', activity_media_list.created_at
                )
                ORDER BY activity_media_list.captured_at ASC, activity_media_list.created_at ASC
              )
              FROM activity_media activity_media_list
              WHERE activity_media_list.activity_id = a.id
            ),
            '[]'::json
          ) AS photos,
          p.user_id,
          p.full_name,
          p.avatar_url,
          a.trail_id,
          t.name AS trail_name,
          t.image AS trail_image,
          a.id AS activity_id,
          a.distance_meters,
          a.elapsed_time_seconds,
          a.elevation_gain_meters,
          a.elevation_loss_meters,
          a.max_elevation_meters,
          a.min_elevation_meters,
          (
            SELECT COUNT(*)::text
            FROM activity_likes activity_like_count
            WHERE activity_like_count.activity_id = a.id
          ) AS likes_count,
          (
            SELECT COUNT(*)::text
            FROM activity_comments activity_comment_count
            WHERE activity_comment_count.activity_id = a.id
          ) AS comments_count,
          EXISTS(
            SELECT 1
            FROM activity_likes activity_like_lookup
            WHERE activity_like_lookup.activity_id = a.id
              AND activity_like_lookup.user_id = $1::uuid
          ) AS is_liked_by_user
        FROM activity_posts ap
        JOIN activities a ON a.id = ap.activity_id
        JOIN profiles p ON p.id = ap.user_id
        LEFT JOIN trails t ON t.id = a.trail_id
        WHERE $2::text = 'activity'
          AND a.id = $3::uuid
          AND (
            ap.user_id = $1::uuid
            OR ap.visibility = 'public'
            OR (
              ap.visibility = 'friends'
              AND EXISTS (
                SELECT 1
                FROM user_follows owner_follow
                JOIN user_follows viewer_follow
                  ON viewer_follow.follower_id = $1::uuid
                 AND viewer_follow.following_id = ap.user_id
                WHERE owner_follow.follower_id = ap.user_id
                  AND owner_follow.following_id = $1::uuid
              )
            )
          )
        ORDER BY ap.created_at DESC
        LIMIT 1
      ),
      target_media_seed AS (
        SELECT ${mediaFeedGroupKeySql} AS group_key
        FROM media m
        WHERE $2::text = 'media'
          AND m.id = $3::uuid
          AND (m.is_public = true OR m.uploader_id = $1::uuid)
        LIMIT 1
      ),
      target_media AS (
        SELECT
          media_group.id,
          media_group.created_at,
          'media'::text AS type,
          NULL::integer AS rating,
          NULL::text AS title,
          NULL::text AS content,
          media_group.caption,
          CASE WHEN media_group.is_public THEN 'public' ELSE 'private' END AS visibility,
          media_group.photo_url,
          media_group.photos,
          media_group.user_id,
          COALESCE(p.full_name, 'Trail friend') AS full_name,
          p.avatar_url,
          t.id AS trail_id,
          COALESCE(t.name, media_group.location_name) AS trail_name,
          t.image AS trail_image,
          NULL::uuid AS activity_id,
          NULL::numeric AS distance_meters,
          NULL::integer AS elapsed_time_seconds,
          NULL::numeric AS elevation_gain_meters,
          NULL::numeric AS elevation_loss_meters,
          NULL::numeric AS max_elevation_meters,
          NULL::numeric AS min_elevation_meters,
          '0'::text AS likes_count,
          '0'::text AS comments_count,
          false AS is_liked_by_user
        FROM (
          SELECT
            (ARRAY_AGG(m.id ORDER BY m.created_at ASC, m.id ASC))[1] AS id,
            MAX(m.created_at) AS created_at,
            ${mediaFeedGroupKeySql} AS group_key,
            MAX(m.caption) AS caption,
            BOOL_OR(m.is_public) AS is_public,
            (json_agg(
              json_build_object(
                'id', m.id,
                'url', m.url,
                'created_at', m.created_at,
                'nature_sighting',
                (
                  SELECT row_to_json(sighting)
                  FROM (
                    SELECT
                      ns.id,
                      ns.trail_id,
                      ns.activity_id,
                      ns.user_id,
                      ns.latitude,
                      ns.longitude,
                      ns.category,
                      ns.species,
                      ns.common_name,
                      ns.confidence,
                      ns.photo_url,
                      ns.photo_id,
                      ns.photo_type,
                      ns.media_id,
                      ns.activity_media_id,
                      ns.classification,
                      ns.language,
                      ns.source,
                      ns.created_at,
                      ns.updated_at
                    FROM nature_sightings ns
                    WHERE ns.photo_id = m.id
                      AND ns.photo_type = 'media'
                    ORDER BY ns.created_at DESC
                    LIMIT 1
                  ) sighting
                )
              )
              ORDER BY m.created_at ASC
            )->0->>'url') AS photo_url,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', m.id,
                  'url', m.url,
                  'created_at', m.created_at,
                  'nature_sighting',
                  (
                    SELECT row_to_json(sighting)
                    FROM (
                      SELECT
                        ns.id,
                        ns.trail_id,
                        ns.activity_id,
                        ns.user_id,
                        ns.latitude,
                        ns.longitude,
                        ns.category,
                        ns.species,
                        ns.common_name,
                        ns.confidence,
                        ns.photo_url,
                        ns.photo_id,
                        ns.photo_type,
                        ns.media_id,
                        ns.activity_media_id,
                        ns.classification,
                        ns.language,
                        ns.source,
                        ns.created_at,
                        ns.updated_at
                      FROM nature_sightings ns
                      WHERE ns.photo_id = m.id
                        AND ns.photo_type = 'media'
                      ORDER BY ns.created_at DESC
                      LIMIT 1
                    ) sighting
                  )
                )
                ORDER BY m.created_at ASC
              ),
              '[]'::json
            ) AS photos,
            m.uploader_id AS user_id,
            m.trip_id,
            MAX(m.location_name) AS location_name
          FROM media m
          JOIN target_media_seed seed
            ON seed.group_key = ${mediaFeedGroupKeySql}
          GROUP BY ${mediaFeedGroupKeySql}, m.uploader_id, m.trip_id
        ) media_group
        LEFT JOIN profiles p ON p.id = media_group.user_id
        LEFT JOIN trails t ON t.id = media_group.trip_id
      )
      SELECT *
      FROM target_review
      UNION ALL
      SELECT *
      FROM target_activity
      UNION ALL
      SELECT *
      FROM target_media
      LIMIT 1
      `,
      [userId, entityType, entityId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new HttpError(404, "Feed item not found");
    }

    res.json({ data: formatFeedItem(row) });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function addReviewComment(req: Request, res: Response): Promise<void> {
  const functionName = "addReviewComment";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = getRequestId(req.params.id);
    const content = String(req.body.content ?? "").trim();
    console.log(`[social] addReviewComment START - reviewId: ${reviewId}, userId: ${userId}, content: ${content}`);
    console.log("[addReviewComment] Params:", { reviewId, userId, contentLength: content.length, body: req.body });

    if (content.length < 1 || content.length > 1000) {
      console.warn("[addReviewComment] Invalid content length:", content.length);
      res.status(400).json({ error: "Content must be between 1 and 1000 characters" });
      return;
    }

    console.log("[addReviewComment] Step 1: Checking review exists...");
    await ensureReviewExists(reviewId);

    console.log("[addReviewComment] Step 2: Inserting comment and fetching profile...");
    const [commentResult, profileResult, reviewOwnerResult] = await Promise.all([
      pool.query<{ id: string; content: string; created_at: string }>(
        `INSERT INTO review_comments (review_id, user_id, content)
         VALUES ($1::uuid, $2::uuid, $3)
         RETURNING id, content, created_at`,
        [reviewId, userId, content]
      ),
      pool.query<FollowProfileRow>(
        `SELECT
           user_id AS id,
           full_name,
           avatar_url
         FROM profiles
         WHERE id = $1::uuid`,
        [userId]
      ),
      pool.query<{ user_id: string; trail_id: string | null }>(
        "SELECT user_id, trail_id FROM trail_reviews WHERE id = $1::uuid LIMIT 1",
        [reviewId]
      ),
    ]);
    console.log("[addReviewComment] Step 3: Insert rows:", commentResult.rows.length, "Profile rows:", profileResult.rows.length);

    if (profileResult.rows.length === 0) {
      throw new HttpError(404, "User not found");
    }

    const comment = commentResult.rows[0];
    const reviewOwnerId = reviewOwnerResult.rows[0]?.user_id;
    if (reviewOwnerId) {
      await createNotificationBestEffort({
        user_id: reviewOwnerId,
        actor_id: userId,
        type: "review_comment",
        title: "New comment on your review",
        body: `${profileResult.rows[0].full_name} commented on your review`,
        entity_type: "review",
        entity_id: reviewId,
        data: {
          comment_id: comment.id,
          review_id: reviewId,
          trail_id: reviewOwnerResult.rows[0]?.trail_id,
          content_preview: content.substring(0, 100),
        },
      });
    }

    res.status(201).json({
      data: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user: {
          id: profileResult.rows[0].id,
          full_name: profileResult.rows[0].full_name,
          avatar_url: profileResult.rows[0].avatar_url,
        },
      },
    });
    console.log("[addReviewComment] Step 4: Response sent for comment:", comment.id);
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getReviewComments(req: Request, res: Response): Promise<void> {
  const functionName = "getReviewComments";
  const reviewId = getRequestId(req.params.id);
  const { page, limit, offset } = getPagination(req.query);
  console.log(`[social] getReviewComments START - reviewId: ${reviewId}`);
  console.log("[getReviewComments] Params:", { reviewId, page, limit, offset, query: req.query });

  try {
    console.log("[getReviewComments] Step 1: Checking review exists...");
    await ensureReviewExists(reviewId);

    console.log("[getReviewComments] Step 2: Counting and querying comments...");
    const [countResult, result] = await Promise.all([
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM review_comments WHERE review_id = $1::uuid",
        [reviewId]
      ),
      pool.query<ReviewCommentRow>(
        `SELECT
           rc.id,
           rc.content,
           rc.created_at,
           p.user_id,
           p.full_name,
           p.avatar_url
         FROM review_comments rc
         JOIN profiles p ON p.id = rc.user_id
         WHERE rc.review_id = $1::uuid
         ORDER BY rc.created_at ASC
         LIMIT $2 OFFSET $3`,
        [reviewId, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    console.log("[getReviewComments] Step 3: Total:", total, "Rows returned:", result.rows.length);

    res.json({
      count: result.rows.length,
      data: result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        user: {
          id: row.user_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function deleteReviewComment(req: Request, res: Response): Promise<void> {
  const functionName = "deleteReviewComment";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const commentId = getRequestId(req.params.id);
    console.log(`[social] deleteReviewComment START - commentId: ${commentId}, userId: ${userId}`);
    console.log("[deleteReviewComment] Params:", { commentId, userId });

    console.log("[deleteReviewComment] Step 1: Deleting comment owned by user...");
    const deleteResult = await pool.query<{ id: string }>(
      "DELETE FROM review_comments WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id",
      [commentId, userId]
    );
    console.log("[deleteReviewComment] Step 2: Rows deleted:", deleteResult.rowCount);

    if ((deleteResult.rowCount ?? 0) > 0) {
      res.json({ message: "Comment deleted successfully", deleted: deleteResult.rowCount });
      return;
    }

    console.log("[deleteReviewComment] Step 3: Delete returned no rows, checking if comment exists...");
    const existsResult = await pool.query("SELECT id, user_id FROM review_comments WHERE id = $1::uuid", [commentId]);
    console.log("[deleteReviewComment] Step 4: Existing comment rows:", existsResult.rows.length);

    if (existsResult.rows.length === 0) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    console.warn("[deleteReviewComment] User is not comment owner:", {
      commentId,
      authUserId: userId,
      commentUserId: existsResult.rows[0].user_id,
    });
    res.status(403).json({ error: "Not authorized to delete this comment", details: "Only the comment author can delete this comment." });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function likeReview(req: Request, res: Response): Promise<void> {
  const functionName = "likeReview";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = getRequestId(req.params.id);
    console.log(`[social] likeReview START - reviewId: ${reviewId}, userId: ${userId}`);
    console.log("[likeReview] Params:", { reviewId, userId });

    console.log("[likeReview] Step 1: Checking review exists...");
    await ensureReviewExists(reviewId);

    console.log("[likeReview] Step 2: Inserting like...");
    const result = await pool.query(
      `INSERT INTO review_likes (review_id, user_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [reviewId, userId]
    );
    console.log("[likeReview] Step 3: Insert rows returned:", result.rows.length);

    if (result.rows.length === 0) {
      console.warn("[likeReview] Review already liked:", { reviewId, userId });
      res.status(409).json({ error: "Review already liked" });
      return;
    }

    console.log("[likeReview] Step 4: Fetching review owner and actor for notification...");
    const notificationContextResult = await pool.query<{
      review_owner_id: string;
      trail_id: string | null;
      trail_name: string | null;
      user_full_name: string | null;
    }>(
      `SELECT
         tr.user_id AS review_owner_id,
         tr.trail_id,
         t.name AS trail_name,
         p.full_name AS user_full_name
       FROM trail_reviews tr
       LEFT JOIN trails t ON t.id = tr.trail_id
       LEFT JOIN profiles p ON p.id = $2::uuid
       WHERE tr.id = $1::uuid
       LIMIT 1`,
      [reviewId, userId]
    );
    const notificationContext = notificationContextResult.rows[0];
    if (notificationContext) {
      const userFullName = notificationContext.user_full_name ?? "Someone";
      const trailName = notificationContext.trail_name ?? "a trail";

      await createNotificationBestEffort({
        user_id: notificationContext.review_owner_id,
        actor_id: userId,
        type: "review_like",
        title: "Someone liked your review",
        body: `${userFullName} liked your review of ${trailName}`,
        entity_type: "review",
        entity_id: reviewId,
        data: {
          review_id: reviewId,
          trail_id: notificationContext.trail_id,
        },
      });
    }

    res.status(201).json({ message: "Review liked successfully", data: { review_id: reviewId, user_id: userId } });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function unlikeReview(req: Request, res: Response): Promise<void> {
  const functionName = "unlikeReview";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = getRequestId(req.params.id);
    console.log(`[social] unlikeReview START - reviewId: ${reviewId}, userId: ${userId}`);
    console.log("[unlikeReview] Params:", { reviewId, userId });

    console.log("[unlikeReview] Step 1: Deleting like...");
    const result = await pool.query(
      "DELETE FROM review_likes WHERE review_id = $1::uuid AND user_id = $2::uuid",
      [reviewId, userId]
    );
    console.log("[unlikeReview] Step 2: Rows deleted:", result.rowCount);

    res.json({ message: "Review unliked successfully", deleted: result.rowCount ?? 0 });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function getReviewLikes(req: Request, res: Response): Promise<void> {
  const functionName = "getReviewLikes";
  const reviewId = getRequestId(req.params.id);
  const { page, limit, offset } = getPagination(req.query);
  console.log(`[social] getReviewLikes START - reviewId: ${reviewId}`);
  console.log("[getReviewLikes] Params:", { reviewId, page, limit, offset, query: req.query });

  try {
    console.log("[getReviewLikes] Step 1: Checking review exists...");
    await ensureReviewExists(reviewId);

    console.log("[getReviewLikes] Step 2: Counting and querying likes...");
    const [countResult, result] = await Promise.all([
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM review_likes WHERE review_id = $1::uuid",
        [reviewId]
      ),
      pool.query<FollowProfileRow>(
        `SELECT
           p.user_id AS id,
           p.full_name,
           p.avatar_url
         FROM review_likes rl
         JOIN profiles p ON p.id = rl.user_id
         WHERE rl.review_id = $1::uuid
         ORDER BY rl.created_at DESC
         LIMIT $2 OFFSET $3`,
        [reviewId, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    console.log("[getReviewLikes] Step 3: Total:", total, "Rows returned:", result.rows.length);

    res.json({
      count: result.rows.length,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function likeActivity(req: Request, res: Response): Promise<void> {
  const functionName = "likeActivity";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const activityId = getRequestId(req.params.id);
    console.log(`[social] likeActivity START - activityId: ${activityId}, userId: ${userId}`);

    const activityPost = await getAccessibleActivityPost(activityId, userId);
    const result = await pool.query(
      `INSERT INTO activity_likes (activity_id, user_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT DO NOTHING
       RETURNING activity_id`,
      [activityId, userId]
    );

    if (result.rows.length === 0) {
      res.status(409).json({ error: "Activity already liked" });
      return;
    }

    const actorName = activityPost.actor_full_name ?? "Someone";
    const trailName = activityPost.trail_name ?? "your activity";
    await createNotificationBestEffort({
      user_id: activityPost.owner_id,
      actor_id: userId,
      type: "activity_like",
      title: "Someone liked your activity",
      body: `${actorName} liked ${trailName}`,
      entity_type: "activity",
      entity_id: activityId,
      data: {
        activity_id: activityId,
        trail_id: activityPost.trail_id,
      },
    });

    res.status(201).json({ message: "Activity liked successfully", data: { activity_id: activityId, user_id: userId } });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function unlikeActivity(req: Request, res: Response): Promise<void> {
  const functionName = "unlikeActivity";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const activityId = getRequestId(req.params.id);
    console.log(`[social] unlikeActivity START - activityId: ${activityId}, userId: ${userId}`);

    await getAccessibleActivityPost(activityId, userId);
    const result = await pool.query(
      "DELETE FROM activity_likes WHERE activity_id = $1::uuid AND user_id = $2::uuid",
      [activityId, userId]
    );

    res.json({ message: "Activity unliked successfully", deleted: result.rowCount ?? 0 });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}

export async function commentOnActivity(req: Request, res: Response): Promise<void> {
  const functionName = "commentOnActivity";
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const activityId = getRequestId(req.params.id);
    const body = String(req.body.body ?? "").trim();
    console.log(`[social] commentOnActivity START - activityId: ${activityId}, userId: ${userId}, bodyLength: ${body.length}`);

    if (body.length < 1 || body.length > 1000) {
      res.status(400).json({ error: "Comment must be between 1 and 1000 characters" });
      return;
    }

    const activityPost = await getAccessibleActivityPost(activityId, userId);
    const result = await pool.query<ActivityCommentRow>(
      `WITH inserted_comment AS (
         INSERT INTO activity_comments (activity_id, user_id, content)
         VALUES ($1::uuid, $2::uuid, $3)
         RETURNING id, activity_id, user_id, content, created_at
       )
       SELECT
         inserted_comment.id,
         inserted_comment.activity_id,
         inserted_comment.user_id,
         inserted_comment.content AS body,
         inserted_comment.created_at,
         p.full_name,
         p.avatar_url
       FROM inserted_comment
       JOIN profiles p ON p.id = inserted_comment.user_id`,
      [activityId, userId, body]
    );
    const comment = result.rows[0];

    if (!comment) {
      throw new HttpError(500, "Unable to create activity comment");
    }

    const actorName = activityPost.actor_full_name ?? comment.full_name ?? "Someone";
    const trailName = activityPost.trail_name ?? "your activity";
    await createNotificationBestEffort({
      user_id: activityPost.owner_id,
      actor_id: userId,
      type: "activity_comment",
      title: "New comment on your activity",
      body: `${actorName} commented on ${trailName}`,
      entity_type: "activity",
      entity_id: activityId,
      data: {
        comment_id: comment.id,
        activity_id: activityId,
        trail_id: activityPost.trail_id,
        content_preview: body.substring(0, 100),
      },
    });

    res.status(201).json({
      data: {
        id: comment.id,
        activity_id: comment.activity_id,
        user_id: comment.user_id,
        body: comment.body,
        created_at: comment.created_at,
        user: {
          id: comment.user_id,
          full_name: comment.full_name,
          avatar_url: comment.avatar_url,
        },
      },
    });
  } catch (error) {
    sendSocialError(functionName, res, error);
  }
}
