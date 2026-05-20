import type { Request, Response } from "express";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function assertUuid(value: unknown, fieldName: string, statusCode = 400): asserts value is string {
  if (!isUuid(value)) {
    throw new HttpError(statusCode, `${fieldName} must be a valid UUID`);
  }
}

function handleActivityJournalError(action: string, error: unknown): never {
  console.log(`[activities.${action}] failed`, error);

  if (error instanceof HttpError) {
    throw error;
  }

  throw new HttpError(500, "Internal server error");
}

export async function getMyActivityJournal(req: Request, res: Response): Promise<void> {
  try {
    console.log("[activities.getMyActivityJournal] requiring auth");
    const auth = requireAuth(req);

    console.log("[activities.getMyActivityJournal] validating auth subject");
    assertUuid(auth.sub, "Authenticated user", 401);

    const page = Math.max(Number.parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const requestedLimit = Number.parseInt(String(req.query.limit ?? "20"), 10) || 20;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const offset = (page - 1) * limit;

    console.log("[activities.getMyActivityJournal] querying private activity posts", { page, limit });
    const [entriesResult, countResult] = await Promise.all([
      pool.query(
        `
        SELECT
          ap.id,
          ap.activity_id,
          ap.caption,
          ap.created_at,
          a.trail_id,
          t.name AS trail_name,
          t.image AS trail_image,
          a.distance_meters,
          a.elapsed_time_seconds,
          a.elevation_gain_meters,
          a.start_time,
          a.end_time,
          (
            SELECT am.public_url
            FROM activity_media am
            WHERE am.activity_id = ap.activity_id
            ORDER BY am.captured_at ASC NULLS LAST, am.created_at ASC
            LIMIT 1
          ) AS photo_url
        FROM activity_posts ap
        INNER JOIN activities a ON a.id = ap.activity_id
        LEFT JOIN trails t ON t.id = a.trail_id
        WHERE ap.user_id = $1::uuid
          AND ap.visibility = 'private'
        ORDER BY ap.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [auth.sub, limit, offset]
      ),
      pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM activity_posts ap
        WHERE ap.user_id = $1::uuid
          AND ap.visibility = 'private'
        `,
        [auth.sub]
      )
    ]);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const pages = Math.ceil(total / limit);

    console.log("[activities.getMyActivityJournal] returning paginated response", { total, pages });
    res.json({
      data: entriesResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    handleActivityJournalError("getMyActivityJournal", error);
  }
}
