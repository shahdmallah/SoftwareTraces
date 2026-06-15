import type { Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import {
  createAdminBadge,
  createDangerousLocation,
  disableAdminBadge,
  disableDangerousLocation,
  getAdminBadge,
  getDashboardStats,
  listAdminBadges,
  listCheckpointReports,
  listDangerousLocations,
  listIncidents,
  listOchaLogs,
  listSosEvents,
  moderateIncident,
  runOchaImport,
  updateAdminBadge,
  updateDangerousLocation,
} from "./admin.service";

const uuidSchema = z.string().uuid();
const moderationSchema = z.object({
  moderation_status: z.enum(["pending", "approved", "verified", "rejected", "hidden"]),
  moderation_note: z.string().trim().max(1000).nullable().optional(),
}).strict();

const badgeSchema = z.object({
  code: z.string().trim().min(1).max(80).regex(/^[A-Z0-9_:-]+$/).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  name_ar: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().min(1).max(1000).optional(),
  description_ar: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().min(1).max(80).optional(),
  icon: z.string().trim().max(500).optional(),
  badge_icon_url: z.string().trim().max(1000).nullable().optional(),
  criteria_type: z.string().trim().min(1).max(80).optional(),
  criteria: z.record(z.unknown()).optional(),
  criteria_value: z.record(z.unknown()).optional(),
  points: z.coerce.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional(),
});

const createBadgeSchema = badgeSchema.extend({
  code: badgeSchema.shape.code.unwrap(),
  name: badgeSchema.shape.name.unwrap(),
  description: badgeSchema.shape.description.unwrap(),
});

const dangerousLocationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name_ar: z.string().trim().max(200).nullable().optional(),
  location_type: z.enum([
    "settlement",
    "outpost",
    "military_checkpoint",
    "flying_checkpoint",
    "military_base",
    "bypass_road",
    "roadblock",
    "watchtower",
    "settler_road",
  ]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  danger_radius_meters: z.coerce.number().positive().max(100000).optional(),
  risk_level: z.enum(["critical", "high", "medium", "low"]).optional(),
  operating_hours: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  description_ar: z.string().trim().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

const updateDangerousLocationSchema = dangerousLocationSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

function sendAdminError(action: string, res: Response, error: unknown): void {
  console.error(`[admin.${action}] ERROR:`, error);

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  res.status(500).json({ error: "Admin action failed", details: error instanceof Error ? error.message : String(error) });
}

export async function dashboard(req: Request, res: Response): Promise<void> {
  try {
    requireAuth(req);
    res.json({ data: await getDashboardStats() });
  } catch (error) {
    sendAdminError("dashboard", res, error);
  }
}

export async function getBadges(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listAdminBadges() });
  } catch (error) {
    sendAdminError("getBadges", res, error);
  }
}

export async function getBadge(req: Request, res: Response): Promise<void> {
  try {
    const badge = await getAdminBadge(uuidSchema.parse(req.params.id));
    if (!badge) {
      res.status(404).json({ error: "Badge not found" });
      return;
    }
    res.json({ data: badge });
  } catch (error) {
    sendAdminError("getBadge", res, error);
  }
}

export async function postBadge(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json({ data: await createAdminBadge(createBadgeSchema.parse(req.body)) });
  } catch (error) {
    sendAdminError("postBadge", res, error);
  }
}

export async function patchBadge(req: Request, res: Response): Promise<void> {
  try {
    const badge = await updateAdminBadge(uuidSchema.parse(req.params.id), badgeSchema.parse(req.body));
    if (!badge) {
      res.status(404).json({ error: "Badge not found" });
      return;
    }
    res.json({ data: badge });
  } catch (error) {
    sendAdminError("patchBadge", res, error);
  }
}

export async function deleteBadge(req: Request, res: Response): Promise<void> {
  try {
    const badge = await disableAdminBadge(uuidSchema.parse(req.params.id));
    if (!badge) {
      res.status(404).json({ error: "Badge not found" });
      return;
    }
    res.json({ data: badge, disabled: true });
  } catch (error) {
    sendAdminError("deleteBadge", res, error);
  }
}

export async function getIncidents(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ data: await listIncidents(status) });
  } catch (error) {
    sendAdminError("getIncidents", res, error);
  }
}

export async function patchIncidentModeration(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const incidentId = uuidSchema.parse(req.params.id);
    const body = moderationSchema.parse(req.body);
    console.log("[admin.patchIncidentModeration] Request:", {
      incidentId,
      body,
      adminUserId: auth.sub,
    });
    const incident = await moderateIncident(incidentId, body.moderation_status, body.moderation_note ?? null, auth.sub);
    if (!incident) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    res.json({ data: incident });
  } catch (error) {
    console.error("[admin.patchIncidentModeration] ERROR:", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    res.status(500).json({
      error: "Admin action failed",
      ...(process.env.NODE_ENV !== "production"
        ? { details: error instanceof Error ? error.message : String(error) }
        : {}),
    });
  }
}

export async function getDangerousLocations(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listDangerousLocations() });
  } catch (error) {
    sendAdminError("getDangerousLocations", res, error);
  }
}

export async function postDangerousLocation(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json({ data: await createDangerousLocation(dangerousLocationSchema.parse(req.body)) });
  } catch (error) {
    console.error("[admin.createDangerousLocation]", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    res.status(500).json({
      error: "Admin action failed",
      ...(process.env.NODE_ENV !== "production"
        ? { details: error instanceof Error ? error.message : String(error) }
        : {}),
    });
  }
}

export async function patchDangerousLocation(req: Request, res: Response): Promise<void> {
  try {
    const location = await updateDangerousLocation(uuidSchema.parse(req.params.id), updateDangerousLocationSchema.parse(req.body));
    if (!location) {
      res.status(404).json({ error: "Dangerous location not found" });
      return;
    }
    res.json({ data: location });
  } catch (error) {
    sendAdminError("patchDangerousLocation", res, error);
  }
}

export async function deleteDangerousLocation(req: Request, res: Response): Promise<void> {
  try {
    const location = await disableDangerousLocation(uuidSchema.parse(req.params.id));
    if (!location) {
      res.status(404).json({ error: "Dangerous location not found" });
      return;
    }
    res.json({ data: location, disabled: true });
  } catch (error) {
    sendAdminError("deleteDangerousLocation", res, error);
  }
}

export async function getCheckpointReports(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listCheckpointReports() });
  } catch (error) {
    sendAdminError("getCheckpointReports", res, error);
  }
}

export async function getSosEvents(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listSosEvents() });
  } catch (error) {
    sendAdminError("getSosEvents", res, error);
  }
}

export async function getOchaLogs(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await listOchaLogs() });
  } catch (error) {
    console.error("[admin.getOchaLogs] ERROR:", error);
    res.status(500).json({
      error: "Failed to fetch OCHA logs",
      ...(process.env.NODE_ENV !== "production"
        ? { details: error instanceof Error ? error.message : String(error) }
        : {}),
    });
  }
}

export async function postOchaFetch(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await runOchaImport() });
  } catch (error) {
    console.error("[admin.postOchaFetch] ERROR:", error);
    res.status(500).json({
      error: "Failed to run OCHA import",
      ...(process.env.NODE_ENV !== "production"
        ? { details: error instanceof Error ? error.message : String(error) }
        : {}),
    });
  }
}
