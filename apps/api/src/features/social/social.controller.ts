import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../lib/httpError";
import { sendSocialNotification } from "../../services/notificationService";

interface FeedReviewRow {
  id: string;
  type: "review";
  rating: number;
  title: string | null;
  content: string;
  photo_url: string | null;
  created_at: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  trail_id: string;
  trail_name: string;
  trail_image: string | null;
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

async function ensureProfileExists(userId: string): Promise<void> {
  const result = await pool.query("SELECT user_id FROM profiles WHERE user_id = $1 OR id::text = $1", [userId]);

  if (result.rows.length === 0) {
    throw new HttpError(404, "User not found");
  }
}

async function ensureReviewExists(reviewId: string): Promise<void> {
  const result = await pool.query("SELECT id FROM trail_reviews WHERE id = $1", [reviewId]);

  if (result.rows.length === 0) {
    throw new HttpError(404, "Review not found");
  }
}

export async function getFollowers(req: Request, res: Response): Promise<void> {
  try {
    const targetUserId = getRequestId(req.params.id);
    const { page, limit, offset } = getPagination(req.query);

    await ensureProfileExists(targetUserId);

    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM user_follows WHERE following_id = $1",
      [targetUserId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const result = await pool.query<FollowProfileRow>(
      `SELECT
         p.user_id AS id,
         p.full_name,
         p.avatar_url
       FROM user_follows uf
       JOIN profiles p ON p.user_id = uf.follower_id
       WHERE uf.following_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function followUser(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = getRequestId(req.params.id);

    if (currentUserId === targetUserId) {
      res.status(400).json({ error: "Users cannot follow themselves" });
      return;
    }

    await ensureProfileExists(targetUserId);

    const result = await pool.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING follower_id`,
      [currentUserId, targetUserId]
    );

    if (result.rows.length === 0) {
      res.status(409).json({ error: "Already following this user" });
      return;
    }

    res.status(201).json({ message: "User followed successfully" });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function unfollowUser(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = getRequestId(req.params.id);

    await pool.query(
      "DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2",
      [currentUserId, targetUserId]
    );

    res.json({ message: "User unfollowed successfully" });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getFollowing(req: Request, res: Response): Promise<void> {
  try {
    const targetUserId = getRequestId(req.params.id);
    const { page, limit, offset } = getPagination(req.query);

    await ensureProfileExists(targetUserId);

    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = $1",
      [targetUserId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const result = await pool.query<FollowProfileRow>(
      `SELECT
         p.user_id AS id,
         p.full_name,
         p.avatar_url
       FROM user_follows uf
       JOIN profiles p ON p.user_id = uf.following_id
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getFeed(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const { page, limit, offset } = getPagination(req.query);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM trail_reviews tr
       JOIN user_follows uf ON uf.following_id = tr.user_id
       WHERE uf.follower_id = $1`,
      [userId]
    );

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const result = await pool.query<FeedReviewRow>(
      `SELECT
         tr.id,
         'review'::text AS type,
         tr.rating,
         tr.title,
         tr.content,
         tr.photo_url,
         tr.created_at,
         p.user_id,
         p.full_name,
         p.avatar_url,
         t.id AS trail_id,
         t.name AS trail_name,
         t.image AS trail_image,
         COUNT(DISTINCT rl.id) AS likes_count,
         COUNT(DISTINCT rc.id) AS comments_count,
         EXISTS(
           SELECT 1
           FROM review_likes review_like_lookup
           WHERE review_like_lookup.review_id = tr.id
             AND review_like_lookup.user_id = $4
         ) AS is_liked_by_user
       FROM trail_reviews tr
       JOIN user_follows uf ON uf.following_id = tr.user_id
       JOIN profiles p ON p.user_id = tr.user_id
       JOIN trails t ON t.id = tr.trail_id
       LEFT JOIN review_likes rl ON rl.review_id = tr.id
       LEFT JOIN review_comments rc ON rc.review_id = tr.id
       WHERE uf.follower_id = $1
       GROUP BY tr.id, p.user_id, p.full_name, p.avatar_url, t.id, t.name, t.image
       ORDER BY tr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset, userId]
    );

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
        photo_url: row.photo_url,
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
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function addReviewComment(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = getRequestId(req.params.id);
    const content = String(req.body.content ?? "").trim();

    if (content.length < 1 || content.length > 1000) {
      res.status(400).json({ error: "Content must be between 1 and 1000 characters" });
      return;
    }

    await ensureReviewExists(reviewId);

    const [commentResult, profileResult] = await Promise.all([
      pool.query<{ id: string; content: string; created_at: string }>(
        `INSERT INTO review_comments (review_id, user_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, content, created_at`,
        [reviewId, userId, content]
      ),
      pool.query<FollowProfileRow>(
        `SELECT
           user_id AS id,
           full_name,
           avatar_url
         FROM profiles
         WHERE user_id = $1`,
        [userId]
      ),
    ]);

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
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getReviewComments(req: Request, res: Response): Promise<void> {
  try {
    const reviewId = getRequestId(req.params.id);
    const { page, limit, offset } = getPagination(req.query);

    await ensureReviewExists(reviewId);

    const [countResult, result] = await Promise.all([
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM review_comments WHERE review_id = $1",
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
         JOIN profiles p ON p.user_id = rc.user_id
         WHERE rc.review_id = $1
         ORDER BY rc.created_at ASC
         LIMIT $2 OFFSET $3`,
        [reviewId, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    res.json({
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
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deleteReviewComment(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const commentId = getRequestId(req.params.id);

    const commentResult = await pool.query<{
      id: string;
      user_id: string;
      review_owner_id: string;
    }>(
      `SELECT
         rc.id,
         rc.user_id,
         tr.user_id AS review_owner_id
       FROM review_comments rc
       JOIN trail_reviews tr ON tr.id = rc.review_id
       WHERE rc.id = $1`,
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const comment = commentResult.rows[0];

    if (comment.user_id !== userId && comment.review_owner_id !== userId) {
      res.status(403).json({ error: "Not authorized to delete this comment" });
      return;
    }

    await pool.query("DELETE FROM review_comments WHERE id = $1", [commentId]);

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function likeReview(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = getRequestId(req.params.id);

    await ensureReviewExists(reviewId);

    const result = await pool.query(
      `INSERT INTO review_likes (review_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [reviewId, userId]
    );

    if (result.rows.length === 0) {
      res.status(409).json({ error: "Review already liked" });
      return;
    }

    res.status(201).json({ message: "Review liked successfully" });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function unlikeReview(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = getRequestId(req.params.id);

    await pool.query(
      "DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2",
      [reviewId, userId]
    );

    res.json({ message: "Review unliked successfully" });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getReviewLikes(req: Request, res: Response): Promise<void> {
  try {
    const reviewId = getRequestId(req.params.id);
    const { page, limit, offset } = getPagination(req.query);

    await ensureReviewExists(reviewId);

    const [countResult, result] = await Promise.all([
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM review_likes WHERE review_id = $1",
        [reviewId]
      ),
      pool.query<FollowProfileRow>(
        `SELECT
           p.user_id AS id,
           p.full_name,
           p.avatar_url
         FROM review_likes rl
         JOIN profiles p ON p.user_id = rl.user_id
         WHERE rl.review_id = $1
         ORDER BY rl.created_at DESC
         LIMIT $2 OFFSET $3`,
        [reviewId, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
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
