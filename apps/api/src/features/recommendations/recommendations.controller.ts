import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { HttpError } from "../../lib/httpError";
import { requireAuth } from "../../middleware/auth";
import {
  getRecommendationPreferences,
  getTrailRecommendations,
  updateRecommendationPreferences,
} from "./recommendations.service";

const preferencesSchema = z.object({
  preferred_regions: z.array(z.string().trim().min(1)).optional().default([]),
  preferred_difficulties: z.array(z.string().trim().min(1)).optional().default([]),
  preferred_features: z.array(z.string().trim().min(1)).optional().default([]),
  preferred_tags: z.array(z.string().trim().min(1)).optional().default([]),
  min_distance_km: z.number().nonnegative().nullable().optional(),
  max_distance_km: z.number().positive().nullable().optional(),
}).refine(
  (value) =>
    value.min_distance_km === undefined ||
    value.min_distance_km === null ||
    value.max_distance_km === undefined ||
    value.max_distance_km === null ||
    value.min_distance_km <= value.max_distance_km,
  {
    message: "min_distance_km must be less than or equal to max_distance_km",
    path: ["min_distance_km"],
  }
);

function handleRecommendationsError(res: Response, error: unknown): void {
  console.error("[recommendations.controller] Error:", error);

  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof Error && error.message === "Profile not found") {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.status(500).json({
    error: "Failed to process recommendation request",
    details: error instanceof Error ? error.message : String(error),
  });
}

export async function getRecommendedTrails(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const recommendations = await getTrailRecommendations(auth.sub);
    res.json({ data: recommendations });
  } catch (error) {
    handleRecommendationsError(res, error);
  }
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const preferences = await getRecommendationPreferences(auth.sub);
    res.json({ data: preferences });
  } catch (error) {
    handleRecommendationsError(res, error);
  }
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  try {
    const auth = requireAuth(req);
    const body = preferencesSchema.parse(req.body ?? {});
    const preferences = await updateRecommendationPreferences(auth.sub, body);
    res.json({ data: preferences });
  } catch (error) {
    handleRecommendationsError(res, error);
  }
}
