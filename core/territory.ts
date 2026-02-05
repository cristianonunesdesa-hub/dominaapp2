// Arquivo: core/territory.ts

import { Point } from '../types';
import { SNAP_TOLERANCE, MIN_ENCLOSED_CELLS, MIN_LOOP_PERIMETER_M } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds, distanceSegmentToSegment } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * Remove pontos duplicados consecutivos e garante que o polígono seja "watertight".
 */
const cleanPolygon = (poly: Point[]): Point[] => {
  if (poly.length < 3) return [];

  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const prev = result[result.length - 1];

    // Evita duplicatas consecutivas exatas
    if (!prev || (Math.abs(p.lat - prev.lat) > 1e-10 || Math.abs(p.lng - prev.lng) > 1e-10)) {
      result.push(p);
    }
  }

  // Garante fechamento estrito (primeiro == último)
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
  // Mínimo relaxado para 1m para permitir qualquer captura visível
  return width >= 1 && height >= 1;
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

  // --- PRIORIDADE ZERO: SNAP NO PONTO INICIAL ---
  const distToStart = calculateDistance(pCurrent, start);
  if (distToStart <= SNAP_TOLERANCE) {
    const rawLoop = [...path, start];
    const loopPath = cleanPolygon(rawLoop);
    const perimeter = calculatePathPerimeter(loopPath);

    // No Start Snap, somos mais permissivos com o perímetro para garantir a jogabilidade
    if (perimeter >= MIN_LOOP_PERIMETER_M * 0.8) {
      const enclosed = getEnclosedCellIds(loopPath);
      if (enclosed.length > 0 && isValidBoundingBox(loopPath)) {
        console.log("[LOOP OK]", { type: "START_SNAP", cells: enclosed.length, dist: distToStart.toFixed(1) });
        return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: start };
      }
    }
  }

  // Safety buffer balanceado (12 pontos) para evitar capturas em curvas
  // Ignoramos o rastro mais recente para garantir que o loop seja real
  const LOOP_SAFETY_BUFFER_PTS = 12; // Defined here as it's not in constants.ts
  const safetyBuffer = Math.max(LOOP_SAFETY_BUFFER_PTS, Math.floor(path.length / 4));

  const searchablePath = path.slice(0, path.length - safetyBuffer);

  // Fallback para logs de debug se o rastro for mínimo
  if (searchablePath.length < 5) return null;

  // 1. Prioridade: INTERSEÇÃO (Cruzamento real ou proximidade crítica)
  let minSegDistFound = Infinity;
  for (let i = searchablePath.length - 2; i >= 0; i--) {
    const pA = searchablePath[i];
    const pB = searchablePath[i + 1];

    let intersection = getIntersection(pLast, pCurrent, pA, pB);

    if (!intersection) {
      const segDist = distanceSegmentToSegment(pLast, pCurrent, pA, pB);
      if (segDist < minSegDistFound) minSegDistFound = segDist;

      // Proximidade para fechar o loop (3 metros - mais rigoroso para evitar erros)
      if (segDist <= 3.0) {
        intersection = { ...pB, timestamp: Date.now() };
      }
    }

    if (intersection) {
      // O polígono do loop deve conter apenas os pontos entre a interseção e o ponto atual
      const rawLoop = [
        intersection,
        ...path.slice(i + 1),
        pCurrent,
        intersection
      ];

      const loopPath = cleanPolygon(rawLoop);
      const perimeter = calculatePathPerimeter(loopPath);

      // Verificação estrita de perímetro e área
      if (perimeter >= MIN_LOOP_PERIMETER_M) {
        const enclosed = getEnclosedCellIds(loopPath);
        if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
          console.log("[LOOP OK]", { type: "INTERSECTION", cells: enclosed.length, perimeter: perimeter.toFixed(1) });
          return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: intersection };
        }
      }
    }
  }

  // 2. Secundário: SNAP GERAL (Qualquer ponto antigo no rastro)
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
    const rawLoop = [
      bestSnapPoint,
      ...path.slice(bestSnapIndex + 1),
      pCurrent,
      bestSnapPoint
    ];

    const loopPath = cleanPolygon(rawLoop);
    const perimeter = calculatePathPerimeter(loopPath);

    if (perimeter >= MIN_LOOP_PERIMETER_M) {
      const enclosed = getEnclosedCellIds(loopPath);
      if (enclosed.length >= MIN_ENCLOSED_CELLS && isValidBoundingBox(loopPath)) {
        console.log("[LOOP OK]", { type: "SNAP", cells: enclosed.length, dist: minSnapDist.toFixed(1) });
        return { polygon: loopPath, enclosedCellIds: enclosed, closurePoint: bestSnapPoint };
      }
    }
  }

  // Log final se não houver captura em um rastro significativo
  if (path.length > 30 && path.length % 15 === 0) {
    console.log("[LOOP NO_MATCH]", {
      pathLen: path.length,
      safetyBuffer,
      distToStart: distToStart.toFixed(1),
      minSegDist: minSegDistFound.toFixed(1),
      snapTol: SNAP_TOLERANCE,
      reason: "No triggers met"
    });
  }

  return null;
};
