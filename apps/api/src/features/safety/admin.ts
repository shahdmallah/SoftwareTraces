import type { NextFunction, Request, Response } from "express";
import { pool } from "../../db/pool";

function parseAdminIds(): Set<string> {
  return new Set(
    String(process.env.SAFETY_ADMIN_USER_IDS ?? process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function profileLooksAdmin(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  return (
    profile.is_admin === true ||
    String(profile.role ?? "").toLowerCase() === "admin" ||
    String(profile.user_role ?? "").toLowerCase() === "admin"
  );
}

export async function isAdminUser(userId: string): Promise<boolean> {
  if (parseAdminIds().has(userId)) {
    return true;
  }

  try {
    const result = await pool.query<{ profile: Record<string, unknown> | null }>(
      `SELECT to_jsonb(p) AS profile
       FROM profiles p
       WHERE p.user_id = $1::uuid
       LIMIT 1`,
      [userId]
    );

    return profileLooksAdmin(result.rows[0]?.profile);
  } catch (error) {
    console.error("[safety.admin.isAdminUser] Admin lookup failed:", error);
    return false;
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth?.sub) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!(await isAdminUser(req.auth.sub))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
