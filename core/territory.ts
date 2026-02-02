
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
  // Mínimo de pontos para um ciclo real (evita ruído inicial)
  if (path.length < 8) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];
  
  // Buffer de segurança para não fechar no rastro que acabamos de deixar
  const safetyBuffer = 15; 
  let snapIndex = -1;

  /**
   * 1. REGRA DOS 20 METROS (SNAP)
   * Prioridade máxima: se chegar perto do ponto inicial ou qualquer ponto antigo.
   */
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    if (dist <= SNAP_TOLERANCE) {
      snapIndex = i;
      break; 
    }
  }

  if (snapIndex !== -1) {
    const polygon = [...path.slice(snapIndex), pNew, path[snapIndex]];
    const enclosedCellIds = getEnclosedCellIds(polygon);

    if (enclosedCellIds.length > 0) {
      console.log(`[DOMINA] Ciclo fechado via SNAP (20m) no index ${snapIndex}`);
      return {
        polygon,
        enclosedCellIds,
        closurePoint: path[snapIndex]
      };
    }
  }

  /**
   * 2. FECHAMENTO POR INTERSEÇÃO (CRUZAMENTO)
   */
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      const polygon = [intersection, ...path.slice(i + 1), intersection];
      const enclosedCellIds = getEnclosedCellIds(polygon);
      
      if (enclosedCellIds.length > 0) {
        console.log(`[DOMINA] Ciclo fechado via CRUZAMENTO no segmento ${i}`);
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
