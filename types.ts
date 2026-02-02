/**
 * types.ts - Central de Definições de Tipos "Domina"
 * Garante que a estrutura de dados seja idêntica entre Cliente (App), API (Vercel) e Banco (Postgres).
 */

export interface Point {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

/**
 * Representa o usuário logado com dados sensíveis (sessionToken).
 */
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
  sessionToken?: string; // Token gerado no servidor para autenticar syncs
}

/**
 * Representa outros agentes visíveis no mapa (dados públicos).
 */
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

/**
 * Representa uma célula de território (setor).
 */
export interface Cell {
  id: string;
  ownerId: string | null;
  ownerNickname?: string;
  ownerColor?: string;
  updatedAt: number;
  defense: number;
}

/**
 * Estrutura de uma atividade/missão em andamento ou finalizada.
 */
export interface Activity {
  id: string;
  startTime: number;
  endTime?: number;
  points: Point[];      // Pontos simplificados para renderização da linha
  fullPath: Point[];    // Todos os pontos brutos para detecção de ciclos
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

// --- PAYLOADS E RESPOSTAS DE API ---

/**
 * Payload enviado para /api/sync
 */
export interface SyncPayload {
  userId: string;
  location?: Point | null;
  newCells?: { 
    id: string; 
    ownerId: string; 
    ownerNickname: string 
  }[];
  stats?: {
    nickname: string;
    color: string;
    xp: number;
    level: number;
    totalAreaM2: number;
    cellsOwned: number;
  };
  wipe?: boolean; // Apenas para debug/dev
}

/**
 * Resposta retornada por /api/sync
 */
export interface SyncResponse {
  users: PublicUser[];
  cells: Record<string, Cell>;
  error?: string;
}

/**
 * Payload enviado para /api/auth
 */
export interface AuthPayload {
  nickname: string;
  password?: string;
  action: 'login' | 'register';
  avatarUrl?: string;
}

/**
 * Resposta retornada por /api/auth (Sucesso)
 */
export type AuthResponse = User;

/**
 * Erro genérico de API
 */
export interface ApiError {
  error: string;
}
