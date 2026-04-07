export type Difficulty = "easy" | "moderate" | "hard" | "expert";
export type TrailConditionStatus = "excellent" | "good" | "fair" | "poor" | "closed";

export interface TrailPoint {
  lat: number;
  lng: number;
  elevation?: number;
  recordedAt?: string;
}

export interface Trail {
  id: string;
  slug: string;
  name: string;
  nameAr?: string;
  description: string;
  region: string;
  difficulty: Difficulty;
  lengthKm: number;
  estimatedDurationMin: number;
  elevationGainM: number;
  elevationLossM: number;
  startPoint: TrailPoint;
  endPoint: TrailPoint;
  geometry: TrailPoint[];
  tags: string[];
  heroImageUrl?: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  trailId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Condition {
  id: string;
  trailId: string;
  userId: string;
  status: TrailConditionStatus;
  note: string;
  reportedAt: string;
}
