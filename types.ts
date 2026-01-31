
export interface User {
  id: string;
  nickname: string;
  password?: string; // Armazenada localmente para o MVP
  color: string;
  avatarUrl?: string;
  cellsOwned: number;
  totalAreaM2: number;
  xp: number;
  level: number;
  badges: string[];
  dailyStreak: number;
  // Added to support real-time map positions
  lat?: number;
  lng?: number;
}

export interface Cell {
  id: string; // "lat_lng" key
  ownerId: string | null;
  ownerNickname?: string;
  bounds: [number, number, number, number];
  updatedAt: number;
  defense: number;
}

export interface Point {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface Activity {
  id: string;
  startTime: number;
  endTime?: number;
  points: Point[];
  fullPath: Point[];
  capturedCellIds: Set<string>;
  stolenCellIds: Set<string>;
  distanceMeters: number;
  isValid: boolean;
  strategicZonesEntered: number;
}

export enum AppState {
  LOGIN = 'LOGIN',
  HOME = 'HOME',
  ACTIVE = 'ACTIVE',
  SUMMARY = 'SUMMARY',
  LEADERBOARD = 'LEADERBOARD',
  PROFILE = 'PROFILE'
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  totalAreaM2: number;
  level: number;
  color: string;
  avatarUrl?: string;
}
