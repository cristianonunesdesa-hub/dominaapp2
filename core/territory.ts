
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
  const safetyBuffer = 10; // Aumentado para evitar snaps muito curtos acidentais

  /**
   * 1. BUSCA POR SNAP (PROXIMIDADE)
   * Encontramos o ponto MAIS ANTIGO que satisfaça a proximidade primeiro.
   * Não calculamos a área dentro do loop.
   */
  let snapIndex = -1;
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    if (dist <= SNAP_TOLERANCE) {
      snapIndex = i;
      break; // Encontrou o fechamento mais antigo, para a busca
    }
  }

  if (snapIndex !== -1) {
    const polygon = [...path.slice(snapIndex), pNew, path[snapIndex]];
    // Calcula a área apenas uma vez, fora do loop de busca
    const enclosedCellIds = getEnclosedCellIds(polygon);

    if (enclosedCellIds.length > 0) {
      console.log(`[Territory] Loop fechado por Snap no índice ${snapIndex}`);
      return {
        polygon,
        enclosedCellIds,
        closurePoint: path[snapIndex]
      };
    }
  }

  /**
   * 2. BUSCA POR INTERSEÇÃO (CRUZAMENTO)
   * Apenas se o snap não for detectado.
   */
  let intersectionPoint: Point | null = null;
  let intersectSegmentIndex = -1;

  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      intersectionPoint = intersection;
      intersectSegmentIndex = i;
      break;
    }
  }

  if (intersectionPoint && intersectSegmentIndex !== -1) {
    const polygon = [intersectionPoint, ...path.slice(intersectSegmentIndex + 1), intersectionPoint];
    const enclosedCellIds = getEnclosedCellIds(polygon);
    
    if (enclosedCellIds.length > 0) {
      console.log(`[Territory] Loop fechado por Interseção no segmento ${intersectSegmentIndex}`);
      return {
        polygon,
        enclosedCellIds,
        closurePoint: intersectionPoint
      };
    }
  }

  return null;
};
