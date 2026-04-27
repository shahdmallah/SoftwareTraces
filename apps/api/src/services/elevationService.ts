import { PNG } from "pngjs";
import { env } from "../config/env";

// Types
export interface ElevationPoint {
  lng: number;
  lat: number;
  elevation: number;
}

// Configuration
const MAX_SAMPLES = 50;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const SMOOTHING_WINDOW = 5;

// Cache storage
interface CacheEntry {
  elevations: Map<string, number>; // pixelKey -> elevation
  expiresAt: number;
}
const tileCache = new Map<string, CacheEntry>();

// Helper: Convert lon/lat to tile coordinates (z=12 is good balance)
function lngLatToTile(lng: number, lat: number, zoom: number = 12): { z: number; x: number; y: number } {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { z: zoom, x, y };
}

// Helper: Get pixel position within tile
function getPixelInTile(lng: number, lat: number, zoom: number, x: number, y: number): { px: number; py: number } {
  const tileSize = 256;
  const lngRad = lng * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const worldX = (lngRad + Math.PI) / (2 * Math.PI);
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  const px = Math.floor((worldX * Math.pow(2, zoom) - x) * tileSize);
  const py = Math.floor((worldY * Math.pow(2, zoom) - y) * tileSize);
  return { px, py };
}

// Decode RGB to elevation
function decodeElevation(r: number, g: number, b: number): number {
  return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
}

// Fetch and decode a tile
async function fetchTile(z: number, x: number, y: number): Promise<Map<string, number>> {
  try {
    return await fetchTileOrThrow(z, x, y);
  } catch (error) {
    console.error(`[elevation] Error fetching tile ${z}/${x}/${y}:`, error);
    return new Map();
  }
}

async function fetchTileOrThrow(z: number, x: number, y: number): Promise<Map<string, number>> {
  const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.png?access_token=${env.MAPBOX_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch tile ${z}/${x}/${y}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const png = PNG.sync.read(Buffer.from(buffer));
  const elevations = new Map<string, number>();

  for (let py = 0; py < png.height; py++) {
    for (let px = 0; px < png.width; px++) {
      const idx = (png.width * py + px) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const elevation = decodeElevation(r, g, b);
      elevations.set(`${px},${py}`, elevation);
    }
  }

  return elevations;
}

export async function getElevationForPoint(lng: number, lat: number): Promise<number> {
  const { z, x, y } = lngLatToTile(lng, lat);
  const cacheKey = `${z}/${x}/${y}`;

  let cacheEntry = tileCache.get(cacheKey);
  let isCacheHit = false;
  if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
    isCacheHit = true;
  } else {
    const elevations = await fetchTileOrThrow(z, x, y);
    cacheEntry = { elevations, expiresAt: Date.now() + CACHE_TTL_MS };
    tileCache.set(cacheKey, cacheEntry);
  }

  console.log(`[elevation] Cache ${isCacheHit ? 'hit' : 'miss'} for tile ${cacheKey}`);

  const { px, py } = getPixelInTile(lng, lat, z, x, y);
  const elevation = cacheEntry.elevations.get(`${px},${py}`);

  if (elevation === undefined) {
    throw new Error(`Missing elevation pixel ${px},${py} for tile ${cacheKey}`);
  }

  return elevation;
}

// Get elevation with caching
export async function getElevationCached(lng: number, lat: number): Promise<number> {
  try {
    return await getElevationForPoint(lng, lat);
  } catch (error) {
    console.error(`[elevation] Error resolving elevation for ${lng},${lat}:`, error);
    return 0;
  }
}

// Sample coordinates (max 50 points, keep first and last)
export function sampleCoordinates(coordinates: [number, number][], maxPoints: number = MAX_SAMPLES): [number, number][] {
  if (coordinates.length <= maxPoints) return [...coordinates];

  const result: [number, number][] = [coordinates[0]];
  const step = (coordinates.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.floor(i * step);
    result.push(coordinates[idx]);
  }

  result.push(coordinates[coordinates.length - 1]);
  return result;
}

// Smooth elevations with sliding window average
export function smoothElevations(elevations: number[], windowSize: number = SMOOTHING_WINDOW): number[] {
  const halfWindow = Math.floor(windowSize / 2);
  return elevations.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < elevations.length) {
        sum += elevations[idx];
        count++;
      }
    }
    return sum / count;
  });
}

// Calculate elevation gain from smoothed elevations
export function calculateElevationGain(points: ElevationPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].elevation - points[i - 1].elevation;
    if (delta > 0) total += delta;
  }
  return Math.round(total);
}

// Main function: get elevations for coordinates (with sampling + caching + smoothing)
export async function getElevationForPoints(coordinates: [number, number][]): Promise<ElevationPoint[]> {
  // Step 1: Sample coordinates (max 50)
  const sampled = sampleCoordinates(coordinates);
  console.log(`[elevation] Sampled ${coordinates.length} points down to ${sampled.length}`);

  // Step 2: Get elevation for each sampled point (with caching)
  const rawPoints = await Promise.all(
    sampled.map(async ([lng, lat]) => ({
      lng,
      lat,
      elevation: await getElevationCached(lng, lat)
    }))
  );

  // Step 3: Extract raw elevations array
  const rawElevations = rawPoints.map(p => p.elevation);

  // Step 4: Smooth elevations
  const smoothedElevations = smoothElevations(rawElevations);

  // Step 5: Apply smoothed elevations back to points
  const smoothedPoints = rawPoints.map((point, i) => ({
    ...point,
    elevation: smoothedElevations[i]
  }));

  console.log(`[elevation] Raw gain: ${calculateElevationGain(rawPoints)}m, Smoothed gain: ${calculateElevationGain(smoothedPoints)}m`);

  return smoothedPoints;
}
