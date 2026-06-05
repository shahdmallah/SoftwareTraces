import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import {
  createEmergencyContact,
  createSosEvent,
  deleteEmergencyContact,
  getSosEvent,
  listEmergencyContacts,
  listMySosEvents,
  type SosStatus,
  updateEmergencyContact,
  updateSosStatus,
} from "./sos.service";

const uuidSchema = z.string().uuid();
const isoTimestampSchema = z
  .string()
  .refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), {
    message: "Must be a valid ISO timestamp",
  });

const createSosSchema = z.object({
  activity_id: z.string().uuid().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  message: z.string().trim().max(1000).optional(),
  occurred_at: isoTimestampSchema,
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contact_user_id: z.string().uuid().nullable().optional(),
  phone: z.string().trim().min(3).max(40).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  relationship: z.string().trim().max(80).nullable().optional(),
  priority: z.coerce.number().int().min(1).max(20).optional(),
  notify_by_sms: z.boolean().optional(),
  notify_by_email: z.boolean().optional(),
  notify_by_push: z.boolean().optional(),
  notify_on_sos: z.boolean().optional(),
});

const updateContactSchema = contactSchema.partial().extend({
  is_active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

const statusSchema = z.object({
  status: z.enum(["created", "notifying", "notified", "acknowledged", "resolved", "cancelled", "failed"]),
  note: z.string().trim().max(1000).optional(),
});

function sendSosError(action: string, res: Response, error: unknown): void {
  console.error(`[sos.${action}] ERROR:`, error);

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
}

async function ensureActivityOwnership(activityId: string | undefined, userId: string): Promise<void> {
  if (!activityId) {
    return;
  }

  const result = await pool.query(
    `SELECT id
     FROM activities
     WHERE id = $1::uuid
       AND user_id = $2::uuid
     LIMIT 1`,
    [activityId, userId]
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "Activity not found");
  }
}

export async function createSos(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const body = createSosSchema.parse(req.body);
    await ensureActivityOwnership(body.activity_id, auth.sub);

    const sos = await createSosEvent({
      userId: auth.sub,
      activityId: body.activity_id ?? null,
      latitude: body.latitude,
      longitude: body.longitude,
      message: body.message ?? null,
      occurredAt: body.occurred_at,
    });

    res.status(201).json({ data: sos });
  } catch (error) {
    sendSosError("createSos", res, error);
  }
}

export async function getMySos(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    res.json({ data: await listMySosEvents(auth.sub) });
  } catch (error) {
    sendSosError("getMySos", res, error);
  }
}

export async function getSosById(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const sosId = uuidSchema.parse(req.params.id);
    res.json({ data: await getSosEvent(auth.sub, sosId) });
  } catch (error) {
    sendSosError("getSosById", res, error);
  }
}

export async function patchSosStatus(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const sosId = uuidSchema.parse(req.params.id);
    const body = statusSchema.parse(req.body);
    res.json({ data: await updateSosStatus(auth.sub, sosId, body.status as SosStatus, body.note ?? null) });
  } catch (error) {
    sendSosError("patchSosStatus", res, error);
  }
}

export async function getContacts(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    res.json({ data: await listEmergencyContacts(auth.sub) });
  } catch (error) {
    sendSosError("getContacts", res, error);
  }
}

export async function postContact(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const body = contactSchema.parse(req.body);
    res.status(201).json({ data: await createEmergencyContact(auth.sub, body) });
  } catch (error) {
    sendSosError("postContact", res, error);
  }
}

export async function patchContact(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const contactId = uuidSchema.parse(req.params.id);
    const body = updateContactSchema.parse(req.body);
    res.json({ data: await updateEmergencyContact(auth.sub, contactId, body) });
  } catch (error) {
    sendSosError("patchContact", res, error);
  }
}

export async function deleteContact(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const contactId = uuidSchema.parse(req.params.id);
    await deleteEmergencyContact(auth.sub, contactId);
    res.status(204).send();
  } catch (error) {
    sendSosError("deleteContact", res, error);
  }
}
