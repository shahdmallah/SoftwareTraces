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

function getPagination(query: Request["query"]) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

async function ensureProfileExists(userId: string): Promise<void> {
  const result = await pool.query("SELECT user_id FROM profiles WHERE user_id = $1", [userId]);

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
  console.log("[getFollowers] ========== START ==========");
  console.log("[getFollowers] Target user ID:", req.params.id);
  console.log("[getFollowers] Query params:", JSON.stringify(req.query, null, 2));

  try {
    const targetUserId = req.params.id;
    const { page, limit, offset } = getPagination(req.query);

    console.log("[getFollowers] 1. Pagination:", { page, limit, offset });

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

    console.log("[getFollowers] 2. Query returned rows:", result.rows.length);

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
    console.error("[getFollowers] ERROR CAUGHT:");
    console.error("[getFollowers] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getFollowers] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[followUser] ========== START ==========");
  console.log("[followUser] Target user ID:", req.params.id);
  console.log("[followUser] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);

  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = req.params.id;

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

    console.log("[followUser] Follow created successfully");
    res.status(201).json({ message: "User followed successfully" });
  } catch (error) {
    console.error("[followUser] ERROR CAUGHT:");
    console.error("[followUser] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[followUser] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[unfollowUser] ========== START ==========");
  console.log("[unfollowUser] Target user ID:", req.params.id);
  console.log("[unfollowUser] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);

  try {
    const auth = requireAuth(req);
    const currentUserId = auth.sub;
    const targetUserId = req.params.id;

    await pool.query(
      "DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2",
      [currentUserId, targetUserId]
    );

    console.log("[unfollowUser] Unfollow completed");
    res.json({ message: "User unfollowed successfully" });
  } catch (error) {
    console.error("[unfollowUser] ERROR CAUGHT:");
    console.error("[unfollowUser] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[unfollowUser] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[getFollowing] ========== START ==========");
  console.log("[getFollowing] Target user ID:", req.params.id);
  console.log("[getFollowing] Query params:", JSON.stringify(req.query, null, 2));

  try {
    const targetUserId = req.params.id;
    const { page, limit, offset } = getPagination(req.query);

    console.log("[getFollowing] 1. Pagination:", { page, limit, offset });

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

    console.log("[getFollowing] 2. Query returned rows:", result.rows.length);

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
    console.error("[getFollowing] ERROR CAUGHT:");
    console.error("[getFollowing] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getFollowing] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[getFeed] ========== START ==========");
  console.log("[getFeed] Query params:", JSON.stringify(req.query, null, 2));
  console.log("[getFeed] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);

  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    console.log("[getFeed] 1. Auth passed, userId:", userId);
    console.log("[getFeed] 2. Pagination:", { page, limit, offset });

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM trail_reviews tr
       JOIN user_follows uf ON uf.following_id = tr.user_id
       WHERE uf.follower_id = $1`,
      [userId]
    );

    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);
    console.log("[getFeed] 3. Total matching reviews:", total);

    const result = await pool.query<FeedReviewRow>(
      `SELECT
         tr.id,
         'review' AS type,
         tr.rating,
         tr.title,
         tr.content,
         tr.photo_url,
         tr.created_at,
         p.user_id AS user_id,
         p.full_name,
         p.avatar_url,
         t.id AS trail_id,
         t.name AS trail_name,
         t.image AS trail_image,
         COUNT(DISTINCT rl.id) AS likes_count,
         COUNT(DISTINCT rc.id) AS comments_count,
         EXISTS(
           SELECT 1
           FROM review_likes
           WHERE review_id = tr.id AND user_id = $4
         ) AS is_liked_by_user
       FROM trail_reviews tr
       JOIN profiles p ON p.user_id = tr.user_id
       JOIN trails t ON t.id = tr.trail_id
       JOIN user_follows uf ON uf.following_id = tr.user_id
       LEFT JOIN review_likes rl ON rl.review_id = tr.id
       LEFT JOIN review_comments rc ON rc.review_id = tr.id
       WHERE uf.follower_id = $1
       GROUP BY tr.id, p.user_id, p.full_name, p.avatar_url, t.id, t.name, t.image
       ORDER BY tr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset, userId]
    );

    console.log("[getFeed] 4. Feed query returned rows:", result.rows.length);

    const pages = total === 0 ? 0 : Math.ceil(total / limit);
    const data = result.rows.map((row) => ({
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
      is_liked_by_user: row.is_liked_by_user,
      comments_count: Number(row.comments_count),
    }));

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    console.error("[getFeed] ERROR CAUGHT:");
    console.error("[getFeed] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getFeed] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[addReviewComment] ========== START ==========");
  console.log("[addReviewComment] Review ID:", req.params.id);
  console.log("[addReviewComment] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);
  console.log("[addReviewComment] Request body:", JSON.stringify(req.body, null, 2));

  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = req.params.id;
    const content = String(req.body.content ?? "").trim();

    if (content.length < 1 || content.length > 1000) {
      res.status(400).json({ error: "Content must be between 1 and 1000 characters" });
      return;
    }

    await ensureReviewExists(reviewId);

    const result = await pool.query<ReviewCommentRow>(
      `INSERT INTO review_comments (review_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [reviewId, userId, content]
    );

    const profileResult = await pool.query<FollowProfileRow>(
      `SELECT
         user_id AS id,
         full_name,
         avatar_url
       FROM profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      throw new HttpError(404, "User not found");
    }

    console.log("[addReviewComment] Comment created successfully:", result.rows[0]?.id);

    res.status(201).json({
      data: {
        id: result.rows[0].id,
        content: result.rows[0].content,
        user: {
          id: profileResult.rows[0].id,
          full_name: profileResult.rows[0].full_name,
          avatar_url: profileResult.rows[0].avatar_url,
        },
        created_at: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error("[addReviewComment] ERROR CAUGHT:");
    console.error("[addReviewComment] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[addReviewComment] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[getReviewComments] ========== START ==========");
  console.log("[getReviewComments] Review ID:", req.params.id);
  console.log("[getReviewComments] Query params:", JSON.stringify(req.query, null, 2));

  try {
    const reviewId = req.params.id;
    const { page, limit, offset } = getPagination(req.query);

    await ensureReviewExists(reviewId);

    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM review_comments WHERE review_id = $1",
      [reviewId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const result = await pool.query<ReviewCommentRow>(
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
    );

    console.log("[getReviewComments] Query returned rows:", result.rows.length);

    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        user: {
          id: row.user_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
        },
        created_at: row.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[getReviewComments] ERROR CAUGHT:");
    console.error("[getReviewComments] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getReviewComments] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[deleteReviewComment] ========== START ==========");
  console.log("[deleteReviewComment] Comment ID:", req.params.id);
  console.log("[deleteReviewComment] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);

  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const commentId = req.params.id;

    const commentResult = await pool.query<{
      id: string;
      user_id: string;
      review_id: string;
      review_owner_id: string;
    }>(
      `SELECT
         rc.id,
         rc.user_id,
         rc.review_id,
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

    console.log("[deleteReviewComment] Comment deleted successfully");
    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("[deleteReviewComment] ERROR CAUGHT:");
    console.error("[deleteReviewComment] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[deleteReviewComment] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[likeReview] ========== START ==========");
  console.log("[likeReview] Review ID:", req.params.id);
  console.log("[likeReview] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);

  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = req.params.id;

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

    console.log("[likeReview] Review liked successfully");
    res.status(201).json({ message: "Review liked successfully" });
  } catch (error) {
    console.error("[likeReview] ERROR CAUGHT:");
    console.error("[likeReview] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[likeReview] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[unlikeReview] ========== START ==========");
  console.log("[unlikeReview] Review ID:", req.params.id);
  console.log("[unlikeReview] Auth user:", (req as { auth?: { sub?: string } }).auth?.sub);

  try {
    const auth = requireAuth(req);
    const userId = auth.sub;
    const reviewId = req.params.id;

    await pool.query(
      "DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2",
      [reviewId, userId]
    );

    console.log("[unlikeReview] Review unliked successfully");
    res.json({ message: "Review unliked successfully" });
  } catch (error) {
    console.error("[unlikeReview] ERROR CAUGHT:");
    console.error("[unlikeReview] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[unlikeReview] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  console.log("[getReviewLikes] ========== START ==========");
  console.log("[getReviewLikes] Review ID:", req.params.id);
  console.log("[getReviewLikes] Query params:", JSON.stringify(req.query, null, 2));

  try {
    const reviewId = req.params.id;
    const { page, limit, offset } = getPagination(req.query);

    await ensureReviewExists(reviewId);

    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM review_likes WHERE review_id = $1",
      [reviewId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    const result = await pool.query<FollowProfileRow>(
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
    );

    console.log("[getReviewLikes] Query returned rows:", result.rows.length);

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
    console.error("[getReviewLikes] ERROR CAUGHT:");
    console.error("[getReviewLikes] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[getReviewLikes] Error stack:", error instanceof Error ? error.stack : "No stack");

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
  const activityId = String(req.params.id);
  await pool.query("INSERT INTO activity_likes (activity_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    activityId,
    auth.sub
  ]);
  await sendSocialNotification(activityId, "Your activity received a new like.");
  res.status(204).send();
}

export async function commentOnActivity(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const activityId = String(req.params.id);
  const result = await pool.query(
    "INSERT INTO activity_comments (activity_id, user_id, body) VALUES ($1, $2, $3) RETURNING *",
    [activityId, auth.sub, req.body.body]
  );
  await sendSocialNotification(activityId, "Your activity received a new comment.");
  res.status(201).json({ data: result.rows[0] });
}
