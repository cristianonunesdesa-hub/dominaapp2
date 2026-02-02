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
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  // Mínimo de pontos significativos para evitar micro-loops por ruído
  if (path.length < 12) return null;

  const pCurrent = newLocation;
  const pLast = path[path.length - 1];
  
  // Buffer de segurança: Não podemos cruzar com os pontos "frescos" (últimos ~100 metros)
  // Isso evita que o GPS detecte fechamento enquanto o usuário apenas corre em linha reta.
  const safetyBuffer = 18; 
  if (path.length <= safetyBuffer) return null;
  
  const searchablePath = path.slice(0, path.length - safetyBuffer);

  /**
   * MODO 1: CRUZAMENTO DE LINHAS (Interseção exata)
   * O usuário cortou o próprio rastro.
   */
  for (let i = 0; i < searchablePath.length - 1; i++) {
    const pA = searchablePath[i];
    const pB = searchablePath[i + 1];

    const intersection = getIntersection(pLast, pCurrent, pA, pB);
    
    if (intersection) {
      // O polígono começa na interseção, segue o rastro até o fim, e fecha na interseção
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
   * MODO 2: SNAP POR PROXIMIDADE (Fechamento Magnético)
   * O usuário chegou muito perto do início/rastro sem cruzar a linha.
   */
  for (let i = 0; i < searchablePath.length; i++) {
    const dist = calculateDistance(pCurrent, searchablePath[i]);
    if (dist <= SNAP_TOLERANCE) {
      // Cria um polígono fechando do ponto atual para o ponto do rastro detectado
      const polygon = [...path.slice(i), pCurrent, searchablePath[i]];
      const enclosed = getEnclosedCellIds(polygon);

      if (enclosed.length > 0) {
        return {
          polygon,
          enclosedCellIds: enclosed,
          closurePoint: searchablePath[i]
        };
      }
    }
  }

  return null;
};