export type Difficulty = 'Easy' | 'Moderate' | 'Hard' | 'Expert';

export interface Trail {
  id: string;
  name: string;
  nameAr: string;
  region: string;
  regionAr: string;
  description: string;
  descriptionAr: string;
  distance: number;
  duration: string;
  elevationGain: number;
  elevationMin: number;
  elevationMax: number;
  difficulty: Difficulty;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  features: string[];
  featuresAr: string[];
  hasCheckpoint: boolean;
  checkpointNote?: string;
  coordinates: [number, number];
  mapX: number;
  mapY: number;
  tags: string[];
}
