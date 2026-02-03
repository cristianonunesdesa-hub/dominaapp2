
/**
 * types.ts - Central de Definições de Tipos "Domina"
 */

export interface Point {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

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
  lat?: number | null;
  lng?: number | null;
}

export interface PublicUser {
  id: string;
  nickname: string;
  color: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  totalAreaM2: number;
  cellsOwned: number;
  lat: number | null;
  lng: number | null;
}

export interface Cell {
  id: string;
  ownerId: string | null;
  ownerNickname?: string;
  ownerColor?: string;
  updatedAt: number;
  defense: number;
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

export interface SyncPayload {
  userId: string;
  location?: Point | null;
  newCells?: { 
    id: string; 
    ownerId: string; 
    ownerNickname: string;
    ownerColor: string;
  }[];
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

export interface SyncResponse {
  users: PublicUser[];
  cells: Record<string, Cell>;
  error?: string;
}
