import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { sendSocialNotification } from "../../services/notificationService";

export async function getFollowers(req: Request, res: Response): Promise<void> {
  const result = await pool.query("SELECT * FROM follows WHERE following_id = $1", [req.params.id]);
  res.json({ data: result.rows });
}

export async function followUser(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *",
    [req.auth?.sub, req.params.id]
  );
  res.status(201).json({ data: result.rows[0] ?? null });
}

export async function unfollowUser(req: Request, res: Response): Promise<void> {
  await pool.query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [req.auth?.sub, req.params.id]);
  res.status(204).send();
}

export async function getFeed(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `
    SELECT a.*, p.full_name
    FROM follows f
    JOIN activities a ON a.user_id = f.following_id
    JOIN profiles p ON p.user_id = a.user_id
    WHERE f.follower_id = $1
    ORDER BY a.started_at DESC
    LIMIT 50
    `,
    [req.auth?.sub]
  );
  res.json({ data: { items: result.rows } });
}

export async function likeActivity(req: Request, res: Response): Promise<void> {
  await pool.query("INSERT INTO activity_likes (activity_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    req.params.id,
    req.auth?.sub
  ]);
  await sendSocialNotification(req.params.id, "Your activity received a new like.");
  res.status(204).send();
}

export async function commentOnActivity(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    "INSERT INTO activity_comments (activity_id, user_id, body) VALUES ($1, $2, $3) RETURNING *",
    [req.params.id, req.auth?.sub, req.body.body]
  );
  await sendSocialNotification(req.params.id, "Your activity received a new comment.");
  res.status(201).json({ data: result.rows[0] });
}
