
import { XP_PER_KM, XP_PER_SECTOR, LEVEL_XP_BASE } from '../constants';

export const calculateSessionXp = (distanceMeters: number, capturedCellsCount: number): number => {
  const km = distanceMeters / 1000;
  return Math.round((km * XP_PER_KM) + (capturedCellsCount * XP_PER_SECTOR));
};

export const calculateLevelFromXp = (totalXp: number): number => {
  return Math.floor(Math.sqrt(totalXp / LEVEL_XP_BASE)) + 1;
};

export const getProgressToNextLevel = (totalXp: number): number => {
  const currentLevel = calculateLevelFromXp(totalXp);
  const currentLevelStart = Math.pow(currentLevel - 1, 2) * LEVEL_XP_BASE;
  const nextLevelStart = Math.pow(currentLevel, 2) * LEVEL_XP_BASE;
  
  const progress = (totalXp - currentLevelStart) / (nextLevelStart - currentLevelStart);
  return Math.min(Math.max(progress * 100, 0), 100);
};
