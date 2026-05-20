import type { Trail, TrailDifficulty } from '../api/trails';

export type CardDifficulty = 'easy' | 'moderate' | 'hard';

export function cardDifficulty(difficulty: TrailDifficulty): CardDifficulty {
  const value = difficulty.toLowerCase();
  return value === 'hard' || value === 'expert' ? 'hard' : value === 'moderate' ? 'moderate' : 'easy';
}

export function formatDistance(distance: number) {
  return `${Number(distance || 0).toFixed(1)} km`;
}

export function formatElevation(elevation: number | undefined) {
  return `${Math.round(Number(elevation || 0))}m`;
}

export function toTrailCard(trail: Trail) {
  return {
    id: trail.id,
    name: trail.name || 'Untitled trail',
    nameAr: trail.nameAr,
    region: trail.region || 'Palestine',
    regionAr: trail.regionAr,
    distance: formatDistance(trail.distance),
    duration: trail.duration || 'Unknown',
    elevation: formatElevation(trail.elevationGain),
    difficulty: cardDifficulty(trail.difficulty),
    rating: Number(trail.rating || 0),
    reviewCount: Number(trail.reviews || 0),
    image: trail.image,
  };
}
