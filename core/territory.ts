
// Arquivo: core/territory.ts

import { Point } from '../types';
import { SNAP_TOLERANCE, MIN_ENCLOSED_CELLS, MIN_LOOP_PERIMETER_M, LOOP_SAFETY_BUFFER_PTS } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * Remove pontos duplicados consecutivos e garante que o polígono seja fechado.
 */
const cleanPolygon = (poly: Point[]): Point[] => {
  if (poly.length < 3) return [];
  const result: Point[] = [poly[0]];
  
  for (let i = 1; i < poly.length; i++) {
    const p1 = poly[i - 1];
    const p2 = poly[i];
    if (p1.lat !== p2.lat || p1.lng !== p2.lng) {
      result.push(p2);
    }
  }

  const first = result[0];
  const last = result[result.length - 1];
  if (first.lat !== last.lat || first.lng !== last.lng) {
    result.push({ ...first, timestamp: Date.now() });
  }

  return result;
};

const isValidBoundingBox = (polygon: Point[]): boolean => {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const width = calculateDistance({ lat: minLat, lng: minLng }, { lat: minLat, lng: maxLng });
  const height = calculateDistance({ lat: minLat, lng: minLng }, { lat: maxLat, lng: minLng });
  return width >= 15 && height >= 15;
};

const calculatePathPerimeter = (pts: Point[]): number => {
  let dist = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    dist += calculateDistance(pts[i], pts[i+1]);
  }
  return dist;
};

export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  if (path.length < LOOP_SAFETY_BUFFER_PTS + 5) return null;

  const pLast = path[path.length - 1];
  const pCurrent = newLocation;
  const searchablePath = path.slice(0, path.length - LOOP_SAFETY_BUFFER_PTS);

  // 1. Interseção
  for (let i = searchablePath.length - 2; i >= 0; i--) {
    const pA = searchablePath[i];
    const pB = searchablePath[i + 1];
    const intersection = getIntersection(pLast, pCurrent, pA, pB);
    
    if (intersection) {
      const rawLoop = [intersection, ...path.slice(i + 1), pCurrent, intersection];
      const loopPath = cleanPolygon(rawLoop);
      const perimeter = calculatePathPerimeter(loopPath);

      if (perimeter < MIN_LOOP_PERIMETER_M) continue;

      const enclosed = getEnclosedCellIds(loopPath);
      if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
        console.log("[LOOP OK]", { reason: "INTERSECTION", polygonLen: loopPath.length, enclosedLen: enclosed.length });
        return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: intersection };
      }
    }
  }

  // 2. Snap
  let bestSnapPoint: Point | null = null;
  let minSnapDist = Infinity;
  let bestSnapIndex = -1;

  for (let i = 0; i < searchablePath.length; i++) {
    const pTarget = searchablePath[i];
    const dist = calculateDistance(pCurrent, pTarget);
    if (dist <= SNAP_TOLERANCE && dist < minSnapDist) {
      minSnapDist = dist;
      bestSnapPoint = pTarget;
      bestSnapIndex = i;
    }
  }

  if (bestSnapPoint && bestSnapIndex !== -1) {
    const rawLoop = [...path.slice(bestSnapIndex), pCurrent, bestSnapPoint];
    const loopPath = cleanPolygon(rawLoop);
    const perimeter = calculatePathPerimeter(loopPath);

    if (perimeter >= MIN_LOOP_PERIMETER_M) {
      const enclosed = getEnclosedCellIds(loopPath);
      if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
        console.log("[LOOP OK]", { reason: "SNAP", polygonLen: loopPath.length, enclosedLen: enclosed.length });
        return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: bestSnapPoint };
      }
    }
  }

  return null;
};
