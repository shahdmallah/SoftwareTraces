export type Locale = "en" | "ar";

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  userId: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  homeRegion?: string;
  locale: Locale;
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalActivities: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthSession {
  user: User;
  profile: Profile;
  tokens: AuthTokens;
}
