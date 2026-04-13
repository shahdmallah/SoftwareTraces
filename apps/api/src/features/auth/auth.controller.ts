import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { createSupabaseAuthClient, supabaseAdmin } from "../../integrations/supabase";

interface SupabaseAuthPayload {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: {
    id: string;
    email?: string;
  };
}

async function getProfileSnapshot(userId: string) {
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
    [userId]
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "User profile not found");
  }

  const row = result.rows[0];
  return {
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
  };
}

async function buildAuthSession(payload: SupabaseAuthPayload) {
  const snapshot = await getProfileSnapshot(payload.user.id);

  return {
    ...snapshot,
    tokens: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: payload.expires_at ? new Date(payload.expires_at * 1000).toISOString() : new Date().toISOString()
    }
  };
}

/**
 * Registers a new user account.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, username, password, fullName, locale = "en" } = req.body;
  const client = await pool.connect();
  const authClient = createSupabaseAuthClient();
  let authUserId: string | null = null;
  let transactionStarted = false;
  let committed = false;

  try {
    const { data: createdAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        fullName,
        locale
      }
    });

    if (createError || !createdAuth.user) {
      throw new HttpError(400, createError?.message ?? "Unable to create Supabase user");
    }

    authUserId = createdAuth.user.id;

    await client.query("BEGIN");
    transactionStarted = true;
    const userResult = await client.query(
      "INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, '') RETURNING id, email, username, created_at, updated_at",
      [createdAuth.user.id, email, username]
    );
    const user = userResult.rows[0];
    const profileResult = await client.query(
      "INSERT INTO profiles (user_id, full_name, locale) VALUES ($1, $2, $3) RETURNING *",
      [user.id, fullName, locale]
    );
    const profile = profileResult.rows[0];
    await client.query("COMMIT");
    committed = true;

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    if (signInError || !signInData.session || !signInData.user) {
      throw new HttpError(400, signInError?.message ?? "Unable to create Supabase session");
    }

    res.status(201).json({
      data: await buildAuthSession({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
        user: {
          id: user.id,
          email: user.email
        }
      })
    });
  } catch (error) {
    if (transactionStarted && !committed) {
      await client.query("ROLLBACK").catch(() => undefined);
    }

    if (authUserId && !committed) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
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
  const authClient = createSupabaseAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    throw new HttpError(401, error?.message ?? "Invalid credentials");
  }

  res.json({
    data: await buildAuthSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    })
  });
}

/**
 * Returns the authenticated user profile.
 */
export async function me(req: Request, res: Response): Promise<void> {
  res.json({ data: await getProfileSnapshot(String(req.auth?.sub)) });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const authClient = createSupabaseAuthClient();
  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: req.body.refreshToken
  });

  if (error || !data.session || !data.user) {
    throw new HttpError(401, error?.message ?? "Unable to refresh session");
  }

  res.json({
    data: await buildAuthSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    })
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  void req;
  res.status(204).send();
}
