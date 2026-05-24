import { pool } from "../db/pool";

export interface FriendProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

async function resolveProfileId(userId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM profiles WHERE id::text = $1 OR user_id::text = $1 LIMIT 1",
    [userId]
  );

  return result.rows[0]?.id ?? userId;
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const [profileId1, profileId2] = await Promise.all([resolveProfileId(userId1), resolveProfileId(userId2)]);

  const result = await pool.query(
    `SELECT 1
     FROM user_follows f1
     JOIN user_follows f2
       ON f2.follower_id = f1.following_id
      AND f2.following_id = f1.follower_id
     WHERE f1.follower_id = $1::uuid
       AND f1.following_id = $2::uuid
     LIMIT 1`,
    [profileId1, profileId2]
  );

  return result.rows.length > 0;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const [resolvedFollowerId, resolvedFollowingId] = await Promise.all([
    resolveProfileId(followerId),
    resolveProfileId(followingId),
  ]);

  const result = await pool.query(
    `SELECT 1
     FROM user_follows
     WHERE follower_id = $1::uuid
       AND following_id = $2::uuid
     LIMIT 1`,
    [resolvedFollowerId, resolvedFollowingId]
  );

  return result.rows.length > 0;
}

export async function getFriends(userId: string, limit = 20, offset = 0): Promise<FriendProfile[]> {
  const profileId = await resolveProfileId(userId);

  const result = await pool.query<FriendProfile>(
    `SELECT
       COALESCE(p.user_id, p.id) AS id,
       p.full_name,
       p.avatar_url
     FROM user_follows f1
     JOIN user_follows f2
       ON f2.follower_id = f1.following_id
      AND f2.following_id = f1.follower_id
     JOIN profiles p ON p.id = f1.following_id
     WHERE f1.follower_id = $1::uuid
     ORDER BY p.full_name ASC
     LIMIT $2 OFFSET $3`,
    [profileId, limit, offset]
  );

  return result.rows;
}

export async function getFriendCount(userId: string): Promise<number> {
  const profileId = await resolveProfileId(userId);

  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM user_follows f1
     JOIN user_follows f2
       ON f2.follower_id = f1.following_id
      AND f2.following_id = f1.follower_id
     WHERE f1.follower_id = $1::uuid`,
    [profileId]
  );

  return Number(result.rows[0]?.count ?? 0);
}
