import mbxGeocoding from "@mapbox/mapbox-sdk/services/geocoding";
import type { Difficulty } from "@traces/shared-types";
import { env } from "../config/env";
import { classifyDifficulty } from "../utils/trailDifficulty";
import { totalDistance } from "../utils/distance";
import type { ParsedTrailDescription } from "./aiService";

export interface GeneratedTrail {
  coordinates: [number, number][];
  length_meters: number;
  elevation_gain_meters: number;
  estimated_duration_minutes: number;
  difficulty: Difficulty;
  name_suggestion: string | null;
  description_suggestion: string | null;
  labels: string[];
}

const fallbackRegionCenters: Record<string, [number, number]> = {
  ramallah: [35.2044, 31.9038],
  jerusalem: [35.2137, 31.7683],
  bethlehem: [35.2024, 31.7054],
  nablus: [35.2621, 32.2211],
  hebron: [35.0998, 31.5326],
  jericho: [35.4444, 31.8560],
};

function getRequestedLengthKm(criteria: ParsedTrailDescription): number {
  if (criteria.length_km && criteria.length_km > 0) {
    return criteria.length_km;
  }

  switch (criteria.difficulty) {
    case "expert":
      return 14;
    case "hard":
      return 10;
    case "moderate":
      return 6;
    case "easy":
    default:
      return 4;
  }
}

function getElevationGainMeters(lengthKm: number, difficulty: Difficulty): number {
  const gainByDifficulty: Record<Difficulty, number> = {
    easy: 25,
    moderate: 55,
    hard: 90,
    expert: 130,
  };

  return Math.round(lengthKm * gainByDifficulty[difficulty]);
}

function estimateDurationMinutes(lengthKm: number, elevationGainMeters: number): number {
  const distanceMinutes = (lengthKm / 5) * 60;
  const climbingMinutes = (elevationGainMeters / 600) * 60;
  return Math.round(distanceMinutes + climbingMinutes);
}

async function geocodeRegion(region: string | null): Promise<[number, number]> {
  const normalizedRegion = region?.trim().toLowerCase();

  if (normalizedRegion && fallbackRegionCenters[normalizedRegion]) {
    return fallbackRegionCenters[normalizedRegion];
  }

  if (!env.MAPBOX_TOKEN) {
    return fallbackRegionCenters.ramallah;
  }

  const geocodingClient = mbxGeocoding({ accessToken: env.MAPBOX_TOKEN });
  const response = await geocodingClient
    .forwardGeocode({
      query: region ? `${region}, Palestine` : "Ramallah, Palestine",
      limit: 1,
      types: ["place", "locality", "region"],
    })
    .send();

  const center = response.body.features?.[0]?.center;
  return center ?? fallbackRegionCenters.ramallah;
}

function offsetCoordinate(center: [number, number], eastMeters: number, northMeters: number): [number, number] {
  const [centerLng, centerLat] = center;
  const latOffset = northMeters / 111_320;
  const lngOffset = eastMeters / (111_320 * Math.cos((centerLat * Math.PI) / 180));

  return [centerLng + lngOffset, centerLat + latOffset];
}

function generateLoopCoordinates(center: [number, number], targetLengthMeters: number): [number, number][] {
  const pointCount = 18;
  const radiusMeters = targetLengthMeters / (2 * Math.PI);
  const coordinates: [number, number][] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * 2 * Math.PI;
    const variation = 1 + 0.18 * Math.sin(index * 1.7);
    const eastMeters = Math.cos(angle) * radiusMeters * variation;
    const northMeters = Math.sin(angle) * radiusMeters * variation;
    coordinates.push(offsetCoordinate(center, eastMeters, northMeters));
  }

  coordinates.push(coordinates[0]);
  return coordinates;
}

function scaleLoopToTargetLength(center: [number, number], coordinates: [number, number][], targetLengthMeters: number): [number, number][] {
  const currentLengthMeters = totalDistance(coordinates);

  if (currentLengthMeters <= 0) {
    return coordinates;
  }

  const scale = targetLengthMeters / currentLengthMeters;

  return coordinates.map(([lng, lat]) => {
    const eastMeters = (lng - center[0]) * 111_320 * Math.cos((center[1] * Math.PI) / 180);
    const northMeters = (lat - center[1]) * 111_320;
    return offsetCoordinate(center, eastMeters * scale, northMeters * scale);
  });
}

export async function generateTrailFromDescription(criteria: ParsedTrailDescription): Promise<GeneratedTrail> {
  const requestedLengthKm = getRequestedLengthKm(criteria);
  const targetLengthMeters = requestedLengthKm * 1000;
  const center = await geocodeRegion(criteria.region);
  const roughLoop = generateLoopCoordinates(center, targetLengthMeters);
  const coordinates = scaleLoopToTargetLength(center, roughLoop, targetLengthMeters);
  const lengthMeters = Math.round(totalDistance(coordinates));
  const lengthKm = lengthMeters / 1000;
  const inferredDifficulty = classifyDifficulty(lengthKm, 0);
  const terrainDifficulty = criteria.difficulty ?? inferredDifficulty;
  const elevationGainMeters = getElevationGainMeters(lengthKm, terrainDifficulty);
  const difficulty = criteria.difficulty ?? classifyDifficulty(lengthKm, elevationGainMeters);

  return {
    coordinates,
    length_meters: lengthMeters,
    elevation_gain_meters: elevationGainMeters,
    estimated_duration_minutes: estimateDurationMinutes(lengthKm, elevationGainMeters),
    difficulty,
    name_suggestion: criteria.name_suggestion,
    description_suggestion: criteria.description_suggestion,
    labels: criteria.labels,
  };
}
