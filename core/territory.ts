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
 * Remove pontos duplicados consecutivos e garante fechamento estrito.
 */
const cleanPolygon = (poly: Point[]): Point[] => {
  if (poly.length < 3) return [];
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const prev = result[result.length - 1];
    if (!prev || (Math.abs(p.lat - prev.lat) > 1e-10 || Math.abs(p.lng - prev.lng) > 1e-10)) {
      result.push(p);
    }
  }
  if (result.length >= 3) {
    const first = result[0];
    const last = result[result.length - 1];
    if (Math.abs(first.lat - last.lat) > 1e-10 || Math.abs(first.lng - last.lng) > 1e-10) {
      result.push({ ...first, timestamp: Date.now() });
    }
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
  return width >= 5 && height >= 5;
};

const calculatePathPerimeter = (pts: Point[]): number => {
  let dist = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    dist += calculateDistance(pts[i], pts[i + 1]);
  }
  return dist;
};

export const detectClosedLoop = (
  path: Point[],
  newLocation: Point
): LoopResult | null => {
  if (!path || path.length < 3) return null;

  const pLast = path[path.length - 1];
  const pCurrent = newLocation;
  const start = path[0];

  // 1. Prioridade: SNAP AO INÍCIO DO SEGMENTO
  const distToStart = calculateDistance(pCurrent, start);
  if (distToStart <= 8.0) { // Tolerância de snap ao início
    const rawLoop = [...path, start];
    const loopPath = cleanPolygon(rawLoop);
    const perimeter = calculatePathPerimeter(loopPath);

    if (perimeter >= MIN_LOOP_PERIMETER_M) {
      const enclosed = getEnclosedCellIds(loopPath);
      if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
        return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: start };
      }
    }
  }

  // 2. INTERSEÇÃO REAL (Estilo INTVL)
  const safetyBuffer = Math.max(LOOP_SAFETY_BUFFER_PTS, 10);
  const searchablePath = path.slice(0, path.length - safetyBuffer);

  if (searchablePath.length >= 2) {
    for (let i = 0; i < searchablePath.length - 1; i++) {
      const pA = searchablePath[i];
      const pB = searchablePath[i + 1];
      const intersection = getIntersection(pLast, pCurrent, pA, pB);

      if (intersection) {
        const rawLoop = [
          intersection,
          ...path.slice(i + 1),
          intersection
        ];
        const loopPath = cleanPolygon(rawLoop);
        const perimeter = calculatePathPerimeter(loopPath);

        if (perimeter >= MIN_LOOP_PERIMETER_M) {
          const enclosed = getEnclosedCellIds(loopPath);
          if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
            console.log("[INTVL CAPTURE]", { type: "INTERSECTION", cells: enclosed.length });
            return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: intersection };
          }
        }
      }
    }
  }

  // 3. SNAP/PROXIMIDADE (Fallback robusto)
  for (let i = 0; i < searchablePath.length; i++) {
    const pTarget = searchablePath[i];
    const dist = calculateDistance(pCurrent, pTarget);
    if (dist <= 5.0) {
      const rawLoop = [
        pTarget,
        ...path.slice(i + 1),
        pTarget
      ];
      const loopPath = cleanPolygon(rawLoop);
      const perimeter = calculatePathPerimeter(loopPath);
      if (perimeter >= MIN_LOOP_PERIMETER_M) {
        const enclosed = getEnclosedCellIds(loopPath);
        if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
          return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: pTarget };
        }
      }
    }
  }

  return null;
};
