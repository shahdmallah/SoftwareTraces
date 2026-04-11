export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusMeters = 6_371_000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

export function totalDistance(coordinates: [number, number][]): number {
  if (coordinates.length < 2) {
    return 0;
  }

  return coordinates.reduce((total, current, index) => {
    if (index === 0) {
      return 0;
    }

    const [prevLng, prevLat] = coordinates[index - 1];
    const [lng, lat] = current;

    return total + haversineDistance(prevLat, prevLng, lat, lng);
  }, 0);
}
