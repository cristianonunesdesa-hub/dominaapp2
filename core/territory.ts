
import { Point } from '../types';
import { SNAP_TOLERANCE } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * Detecção de ciclo de alta performance.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  // Mínimo de pontos para um ciclo real
  if (path.length < 6) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];
  
  /**
   * 1. CHECAGEM DE SNAP (20 METROS)
   * Buscamos se o ponto atual está perto do início ou de qualquer ponto antigo.
   * Ignoramos os últimos 15 pontos para evitar fechar no próprio rastro recente.
   */
  const safetyBuffer = 15;
  let snapIndex = -1;

  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    if (dist <= SNAP_TOLERANCE) {
      snapIndex = i;
      break; // Encontrou o fechamento mais antigo possível, para imediatamente.
    }
  }

  if (snapIndex !== -1) {
    const polygon = [...path.slice(snapIndex), pNew, path[snapIndex]];
    const enclosedCellIds = getEnclosedCellIds(polygon);

    // Só confirma se realmente capturou algo para evitar loops de 0m²
    if (enclosedCellIds.length > 0) {
      return {
        polygon,
        enclosedCellIds,
        closurePoint: path[snapIndex]
      };
    }
  }

  /**
   * 2. CHECAGEM DE INTERSEÇÃO (CRUZAMENTO DE LINHA)
   * Apenas se o snap de 20m não disparou.
   */
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
