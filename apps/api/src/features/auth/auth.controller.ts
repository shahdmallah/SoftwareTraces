import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { signAccessToken } from "../../services/tokenService";

function buildRefreshToken(userId: string): string {
  return `refresh-${userId}`;
}

/**
 * Registers a new user account.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, username, password, fullName, locale = "en" } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, created_at, updated_at",
      [email, username, passwordHash]
    );
    const user = userResult.rows[0];
    const profileResult = await client.query(
      "INSERT INTO profiles (user_id, full_name, locale) VALUES ($1, $2, $3) RETURNING *",
      [user.id, fullName, locale]
    );
    const profile = profileResult.rows[0];
    await client.query("COMMIT");

    res.status(201).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        profile: {
          userId: profile.user_id,
          fullName: profile.full_name,
          bio: profile.bio,
          avatarUrl: profile.avatar_url,
          homeRegion: profile.home_region,
          locale: profile.locale,
          totalDistanceKm: Number(profile.total_distance_km),
          totalElevationGainM: Number(profile.total_elevation_gain_m),
          totalActivities: profile.total_activities,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        },
        tokens: {
          accessToken: signAccessToken(user.id, user.email),
          refreshToken: buildRefreshToken(user.id),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Authenticates a user with email and password.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await pool.query(
    `
    SELECT u.*, p.full_name, p.bio, p.avatar_url, p.home_region, p.locale,
      p.total_distance_km, p.total_elevation_gain_m, p.total_activities,
      p.created_at AS profile_created_at, p.updated_at AS profile_updated_at
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.email = $1
    `,
    [email]
  );

  if (result.rowCount === 0) {
    throw new HttpError(401, "Invalid credentials");
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new HttpError(401, "Invalid credentials");
  }

  res.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      profile: {
        userId: user.id,
        fullName: user.full_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        homeRegion: user.home_region,
        locale: user.locale,
        totalDistanceKm: Number(user.total_distance_km),
        totalElevationGainM: Number(user.total_elevation_gain_m),
        totalActivities: user.total_activities,
        createdAt: user.profile_created_at,
        updatedAt: user.profile_updated_at
      },
      tokens: {
        accessToken: signAccessToken(user.id, user.email),
        refreshToken: buildRefreshToken(user.id),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  });
}

/**
 * Returns the authenticated user profile.
 */
export async function me(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `
    SELECT u.id, u.email, u.username, u.created_at, u.updated_at,
      p.full_name, p.bio, p.avatar_url, p.home_region, p.locale,
      p.total_distance_km, p.total_elevation_gain_m, p.total_activities,
      p.created_at AS profile_created_at, p.updated_at AS profile_updated_at
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1
    `,
    [req.auth?.sub]
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "User not found");
  }

  const row = result.rows[0];
  res.json({
    data: {
      user: {
        id: row.id,
        email: row.email,
        username: row.username,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      profile: {
        userId: row.id,
        fullName: row.full_name,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        homeRegion: row.home_region,
        locale: row.locale,
        totalDistanceKm: Number(row.total_distance_km),
        totalElevationGainM: Number(row.total_elevation_gain_m),
        totalActivities: row.total_activities,
        createdAt: row.profile_created_at,
        updatedAt: row.profile_updated_at
      }
    }
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const userId = String(req.body.refreshToken).replace("refresh-", "");
  res.json({
    data: {
      accessToken: signAccessToken(userId, "refresh@traces.local"),
      refreshToken: buildRefreshToken(userId),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.status(204).send();
}
