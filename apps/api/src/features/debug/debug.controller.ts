import type { Request, Response } from "express";
import { getRawElevationResponse } from "../../services/elevationService";

export async function getElevationDebug(req: Request, res: Response): Promise<void> {
  const lat = Number(req.params.lat);
  const lng = Number(req.params.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "Invalid lat/lng parameters" });
    return;
  }

  try {
    const data = await getRawElevationResponse(lng, lat);
    res.json({
      data: {
        lat,
        lng,
        mapbox: data
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch elevation debug data"
    });
  }
}
