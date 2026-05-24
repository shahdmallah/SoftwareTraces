import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../lib/httpError";
import { sendSocialNotification } from "../../services/notificationService";
import {
  getFriendCount as countFriends,
  getFriends as listFriends,
} from "../../services/friendService";

interface FeedReviewRow {
  id: string;
  type: "review" | "activity";
  rating: number | null;
  title: string | null;
  content: string | null;
  caption: string | null;
  visibility: string | null;
  photo_url: string | null;
  photos: { id: string; url: string; created_at: string }[] | null;
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
  likes_count: string;
  is_liked_by_user: boolean;
  comments_count: string;
}

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

function getRequestId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function getPagination(query: Request["query"]) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
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
        SELECT tr.id
        FROM trail_reviews tr
        JOIN user_follows uf ON uf.following_id = tr.user_id
        WHERE uf.follower_id = $1::uuid
          AND (
            $2::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = tr.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
        UNION ALL
        SELECT ap.id
        FROM activity_posts ap
        JOIN user_follows uf ON uf.following_id = ap.user_id
        WHERE uf.follower_id = $1::uuid
          AND ap.visibility <> 'private'
          AND (
            $2::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = ap.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
          AND (
            ap.visibility = 'public'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_visibility_follow
              WHERE reverse_visibility_follow.follower_id = ap.user_id
                AND reverse_visibility_follow.following_id = $1::uuid
            )
          )
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
                  'created_at', review_photo_list.created_at
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
          COUNT(DISTINCT rl.id)::text AS likes_count,
          COUNT(DISTINCT rc.id)::text AS comments_count,
          EXISTS(
            SELECT 1
            FROM review_likes review_like_lookup
            WHERE review_like_lookup.review_id = tr.id
              AND review_like_lookup.user_id = $1::uuid
          ) AS is_liked_by_user
        FROM trail_reviews tr
        JOIN user_follows uf ON uf.following_id = tr.user_id
        JOIN profiles p ON p.id = tr.user_id
        JOIN trails t ON t.id = tr.trail_id
        LEFT JOIN review_likes rl ON rl.review_id = tr.id
        LEFT JOIN review_comments rc ON rc.review_id = tr.id
        WHERE uf.follower_id = $1::uuid
          AND (
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
          NULL::text AS photo_url,
          '[]'::json AS photos,
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
          '0'::text AS likes_count,
          '0'::text AS comments_count,
          false AS is_liked_by_user
        FROM activity_posts ap
        JOIN user_follows uf ON uf.following_id = ap.user_id
        JOIN activities a ON a.id = ap.activity_id
        JOIN profiles p ON p.id = ap.user_id
        LEFT JOIN trails t ON t.id = a.trail_id
        WHERE uf.follower_id = $1::uuid
          AND ap.visibility <> 'private'
          AND (
            $4::text = 'all'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_follow
              WHERE reverse_follow.follower_id = ap.user_id
                AND reverse_follow.following_id = $1::uuid
            )
          )
          AND (
            ap.visibility = 'public'
            OR EXISTS (
              SELECT 1
              FROM user_follows reverse_visibility_follow
              WHERE reverse_visibility_follow.follower_id = ap.user_id
                AND reverse_visibility_follow.following_id = $1::uuid
            )
          )
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
      data: result.rows.map((row) => ({
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
              }
            : null,
        created_at: row.created_at,
        likes_count: Number(row.likes_count),
        comments_count: Number(row.comments_count),
        is_liked_by_user: row.is_liked_by_user,
      })),
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
    const [commentResult, profileResult] = await Promise.all([
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
    ]);
    console.log("[addReviewComment] Step 3: Insert rows:", commentResult.rows.length, "Profile rows:", profileResult.rows.length);

    if (profileResult.rows.length === 0) {
      throw new HttpError(404, "User not found");
    }

    res.status(201).json({
      data: {
        id: commentResult.rows[0].id,
        content: commentResult.rows[0].content,
        created_at: commentResult.rows[0].created_at,
        user: {
          id: profileResult.rows[0].id,
          full_name: profileResult.rows[0].full_name,
          avatar_url: profileResult.rows[0].avatar_url,
        },
      },
    });
    console.log("[addReviewComment] Step 4: Response sent for comment:", commentResult.rows[0].id);
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
  const auth = requireAuth(req);
  const activityId = getRequestId(req.params.id);
  await pool.query("INSERT INTO activity_likes (activity_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    activityId,
    auth.sub,
  ]);
  await sendSocialNotification(activityId, "Your activity received a new like.");
  res.status(204).send();
}

export async function commentOnActivity(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const activityId = getRequestId(req.params.id);
  const result = await pool.query(
    "INSERT INTO activity_comments (activity_id, user_id, body) VALUES ($1, $2, $3) RETURNING *",
    [activityId, auth.sub, req.body.body]
  );
  await sendSocialNotification(activityId, "Your activity received a new comment.");
  res.status(201).json({ data: result.rows[0] });
}
