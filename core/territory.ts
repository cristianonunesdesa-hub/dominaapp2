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
 * Refeito do zero para máxima precisão.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  // Precisamos de rastro suficiente para um polígono (mínimo ~10-15 metros de rastro)
  if (path.length < 8) return null;

  const pLast = path[path.length - 1];
  const pCurrent = newLocation;

  // Evitamos checar os últimos ~6 pontos para não detectar interseção com o rastro imediato
  const safetyBuffer = 6; 
  const searchablePath = path.slice(0, path.length - safetyBuffer);

  /**
   * FASE 1: Interseção Física
   * Checa se o segmento atual (pLast -> pCurrent) corta o rastro em algum lugar.
   */
  for (let i = searchablePath.length - 2; i >= 0; i--) {
    const pA = searchablePath[i];
    const pB = searchablePath[i + 1];

    const intersection = getIntersection(pLast, pCurrent, pA, pB);
    
    if (intersection) {
      // O polígono começa na interseção, segue o rastro até o fim e fecha na interseção
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
   * FASE 2: Proximidade (Snap)
   * Se o usuário chegar muito perto de um ponto anterior, fechamos o loop automaticamente.
   */
  for (let i = searchablePath.length - 1; i >= 0; i--) {
    const pTarget = searchablePath[i];
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