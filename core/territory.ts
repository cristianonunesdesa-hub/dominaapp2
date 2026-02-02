// Arquivo: core/territory.ts

import { Point } from '../types';
import { SNAP_TOLERANCE } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * detectClosedLoop
 * Analisa o rastro para detectar se o usuário fechou uma área.
 * ✅ OTIMIZADO: Adicionado Bounding Box check para evitar cálculos pesados em segmentos distantes.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  if (path.length < 12) return null;

  const pCurrent = newLocation;
  const pLast = path[path.length - 1];
  
  // Bounding box do movimento atual para poda (pruning)
  const currentMinLat = Math.min(pLast.lat, pCurrent.lat);
  const currentMaxLat = Math.max(pLast.lat, pCurrent.lat);
  const currentMinLng = Math.min(pLast.lng, pCurrent.lng);
  const currentMaxLng = Math.max(pLast.lng, pCurrent.lng);

  const safetyBuffer = 18; 
  if (path.length <= safetyBuffer) return null;
  
  const searchablePath = path.slice(0, path.length - safetyBuffer);

  /**
   * MODO 1: CRUZAMENTO DE LINHAS
   */
  for (let i = 0; i < searchablePath.length - 1; i++) {
    const pA = searchablePath[i];
    const pB = searchablePath[i + 1];

    // ✅ OTIMIZAÇÃO: Checagem rápida de Bounding Box antes do cálculo de interseção
    const segMinLat = Math.min(pA.lat, pB.lat);
    const segMaxLat = Math.max(pA.lat, pB.lat);
    const segMinLng = Math.min(pA.lng, pB.lng);
    const segMaxLng = Math.max(pA.lng, pB.lng);

    if (currentMaxLat < segMinLat || currentMinLat > segMaxLat || 
        currentMaxLng < segMinLng || currentMinLng > segMaxLng) {
      continue; 
    }

    const intersection = getIntersection(pLast, pCurrent, pA, pB);
    
    if (intersection) {
      const polygon = [intersection, ...path.slice(i + 1), intersection];
      const enclosed = getEnclosedCellIds(polygon);

      if (enclosed.length > 0) {
        return {
          polygon,
          enclosedCellIds: enclosed,
          closurePoint: intersection
        };
      }
    }
  }

  /**
   * MODO 2: SNAP POR PROXIMIDADE
   */
  // No Snap, podemos limitar a busca apenas aos pontos que estão dentro da SNAP_TOLERANCE aproximada
  // para evitar percorrer o path inteiro em atividades gigantescas.
  const latTolerance = SNAP_TOLERANCE / 111320; // Aproximação grosseira de graus

  for (let i = 0; i < searchablePath.length; i++) {
    const pTarget = searchablePath[i];
    
    // ✅ OTIMIZAÇÃO: Filtro rápido por latitude antes do cálculo de Haversine
    if (Math.abs(pCurrent.lat - pTarget.lat) > latTolerance) continue;

    const dist = calculateDistance(pCurrent, pTarget);
    if (dist <= SNAP_TOLERANCE) {
      const polygon = [...path.slice(i), pCurrent, pTarget];
      const enclosed = getEnclosedCellIds(polygon);

      if (enclosed.length > 0) {
        return {
          polygon,
          enclosedCellIds: enclosed,
          closurePoint: pTarget
        };
      }
    }
  }

  return null;
};