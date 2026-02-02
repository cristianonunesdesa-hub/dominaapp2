export interface User {
  id: string;
  nickname: string;
  color: string;
  avatarUrl?: string;
  cellsOwned: number;
  totalAreaM2: number;
  xp: number;
  level: number;
  badges: string[];
  dailyStreak: number;
  lat?: number;
  lng?: number;
}

export interface PublicUser {
  id: string;
  nickname: string;
  color: string;
  avatarUrl?: string;
  cellsOwned: number;
  totalAreaM2: number;
  xp: number;
  level: number;
  lat?: number;
  lng?: number;
}

export interface Cell {
  id: string;
  ownerId: string | null;
  ownerNickname?: string;
  ownerColor?: string;
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
  USER_SELECT = 'USER_SELECT',
  LOGIN = 'LOGIN',
  BOOT = 'BOOT',
  TUTORIAL = 'TUTORIAL',
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

// Payloads de API para garantir segurança e validação
export interface SyncPayload {
  userId: string;
  location?: Point | null;
  newCells?: { id: string; ownerId: string; ownerNickname: string }[];
  stats?: {
    nickname: string;
    color: string;
    xp: number;
    level: number;
    totalAreaM2: number;
    cellsOwned: number;
  };
  wipe?: boolean;
}

export interface AuthPayload {
  nickname: string;
  password?: string;
  action: 'login' | 'register';
  avatarUrl?: string;
}
