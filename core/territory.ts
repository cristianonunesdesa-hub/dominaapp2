
import { Point } from '../types';
import { SNAP_TOLERANCE } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  if (path.length < 3) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];
  const safetyBuffer = 5; 

  // 1. Prioridade: Snap por Proximidade (50m)
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    if (dist <= SNAP_TOLERANCE) {
      const polygon = [...path.slice(i), pNew, path[i]];
      const enclosedCellIds = getEnclosedCellIds(polygon);

      if (enclosedCellIds.length > 0) {
        return {
          polygon,
          enclosedCellIds,
          closurePoint: path[i]
        };
      }
    }
  }

  // 2. Fallback: Interseção Manual
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      const polygon = [intersection, ...path.slice(i + 1), intersection];
      const enclosedCellIds = getEnclosedCellIds(polygon);
      
      if (enclosedCellIds.length > 0) {
        return {
          polygon,
          enclosedCellIds,
          closurePoint: intersection
        };
      }
    }
  }

  return null;
};
