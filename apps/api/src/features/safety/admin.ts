import type { NextFunction, Request, Response } from "express";
import { pool } from "../../db/pool";

function parseAdminIds(): Set<string> {
  return new Set(
    [process.env.ADMIN_USER_IDS, process.env.SAFETY_ADMIN_USER_IDS]
      .join(",")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function normalizeRole(value: unknown): string {
  return String(value ?? "user").trim().toLowerCase();
}

export async function isAdminUser(userId: string): Promise<boolean> {
  if (parseAdminIds().has(userId)) {
    return true;
  }

  try {
    const result = await pool.query<{ role: string | null }>(
      `SELECT COALESCE(p.role, 'user') AS role
       FROM profiles p
       WHERE p.user_id = $1::uuid
          OR p.id = $1::uuid
       LIMIT 1`,
      [userId]
    );

    return normalizeRole(result.rows[0]?.role) === "admin";
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
