import { env } from "../config/env";

const TILEQUERY_LIMIT = 50;
const MISSING_ELEVATION_THRESHOLD = 0;

export interface ElevationPoint {
  lng: number;
  lat: number;
  elevation: number;
}

interface MapboxTilequeryFeature {
  properties?: {
    ele?: number | string;
  };
}

export interface MapboxTilequeryResponse {
  features?: MapboxTilequeryFeature[];
}

interface ElevationLookupResult {
  lng: number;
  lat: number;
  elevation: number | null;
  raw: MapboxTilequeryResponse;
}

function getElevationQueryUrl(lng: number, lat: number): string {
  const searchParams = new URLSearchParams({
    layers: "contour",
    limit: String(TILEQUERY_LIMIT),
    access_token: env.MAPBOX_TOKEN ?? ""
  });

  return `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?${searchParams.toString()}`;
}

function extractElevationCandidates(data: MapboxTilequeryResponse): number[] {
  return (data.features ?? [])
    .map((feature) => Number(feature.properties?.ele))
    .filter((value) => Number.isFinite(value));
}

function chooseBestElevation(candidates: number[]): number | null {
  const positiveCandidates = candidates.filter((value) => value > MISSING_ELEVATION_THRESHOLD);

  if (positiveCandidates.length > 0) {
    return Math.max(...positiveCandidates);
  }

  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  return null;
}

function fillMissingElevations(results: ElevationLookupResult[]): ElevationPoint[] {
  const repaired = results.map((result) => ({ ...result }));

  for (let index = 0; index < repaired.length; index += 1) {
    if (repaired[index].elevation != null) {
      continue;
    }

    const previous = repaired
      .slice(0, index)
      .reverse()
      .find((item) => item.elevation != null);
    const next = repaired.slice(index + 1).find((item) => item.elevation != null);

    if (previous && next) {
      repaired[index].elevation = Number((((previous.elevation ?? 0) + (next.elevation ?? 0)) / 2).toFixed(2));
      console.log("[elevation] Filled missing point by interpolation:", {
        index,
        lng: repaired[index].lng,
        lat: repaired[index].lat,
        elevation: repaired[index].elevation
      });
      continue;
    }

    if (previous) {
      repaired[index].elevation = previous.elevation;
      console.log("[elevation] Filled missing point from previous elevation:", {
        index,
        lng: repaired[index].lng,
        lat: repaired[index].lat,
        elevation: repaired[index].elevation
      });
      continue;
    }

    if (next) {
      repaired[index].elevation = next.elevation;
      console.log("[elevation] Filled missing point from next elevation:", {
        index,
        lng: repaired[index].lng,
        lat: repaired[index].lat,
        elevation: repaired[index].elevation
      });
      continue;
    }

    repaired[index].elevation = 0;
    console.log("[elevation] No nearby valid elevation found, falling back to 0:", {
      index,
      lng: repaired[index].lng,
      lat: repaired[index].lat
    });
  }

  return repaired.map((result) => ({
    lng: result.lng,
    lat: result.lat,
    elevation: Number((result.elevation ?? 0).toFixed(2))
  }));
}

async function fetchElevationRaw(lng: number, lat: number): Promise<MapboxTilequeryResponse> {
  if (!env.MAPBOX_TOKEN) {
    throw new Error("MAPBOX_TOKEN is not configured.");
  }

  console.log("[elevation] Fetching elevation for point:", { lng, lat });
  const response = await fetch(getElevationQueryUrl(lng, lat));

  if (!response.ok) {
    throw new Error(`Mapbox elevation request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as MapboxTilequeryResponse;
  console.log("[elevation] Raw Mapbox response:", JSON.stringify(data));
  return data;
}

async function getElevationForPoint(lng: number, lat: number): Promise<ElevationLookupResult> {
  try {
    const data = await fetchElevationRaw(lng, lat);
    const candidates = extractElevationCandidates(data);
    console.log("[elevation] Extracted elevation candidates:", { lng, lat, candidates });

    const elevation = chooseBestElevation(candidates);
    console.log("[elevation] Selected elevation:", { lng, lat, elevation });

    return {
      lng,
      lat,
      elevation,
      raw: data
    };
  } catch (error) {
    console.error("[elevation] Failed to fetch elevation for point:", {
      lng,
      lat,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      lng,
      lat,
      elevation: null,
      raw: { features: [] }
    };
  }
}

export async function getRawElevationResponse(lng: number, lat: number): Promise<MapboxTilequeryResponse> {
  return fetchElevationRaw(lng, lat);
}

export async function getElevationForPoints(coordinates: [number, number][]): Promise<ElevationPoint[]> {
  const lookupResults = await Promise.all(
    coordinates.map(([lng, lat]) => getElevationForPoint(lng, lat))
  );

  const points = fillMissingElevations(lookupResults);
  console.log("[elevation] Final elevation points:", points);
  return points;
}

export function calculateElevationGain(points: Array<{ elevation?: number | null }>): number {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const currentElevation = points[index].elevation ?? 0;
    const previousElevation = points[index - 1].elevation ?? 0;
    const delta = currentElevation - previousElevation;

    console.log("[elevation] Elevation delta:", {
      index,
      previousElevation,
      currentElevation,
      delta
    });

    if (delta > 0) {
      total += delta;
    }
  }

  const roundedTotal = Number(total.toFixed(2));
  console.log("[elevation] Total elevation gain:", roundedTotal);
  return roundedTotal;
}
