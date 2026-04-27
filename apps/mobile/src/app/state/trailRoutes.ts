// Updated to cache created trail route coordinates on the mobile side so map previews can draw full paths when geometry is available.
type RouteCoordinate = [number, number];

const routeCache = new Map<string, RouteCoordinate[]>();

export function setTrailRouteCoordinates(trailId: string, coordinates: RouteCoordinate[]) {
  routeCache.set(trailId, coordinates);
}

export function getTrailRouteCoordinates(trailId: string) {
  return routeCache.get(trailId) ?? null;
}

