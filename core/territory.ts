
import { Point } from '../types';
import { SNAP_TOLERANCE } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * ENGINE DE TERRITÓRIO - DOMINA
 * Verifica fechamento de ciclo por proximidade (20m) ou interseção.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  // Precisa de pelo menos 5 pontos para ser um ciclo minimamente viável
  if (path.length < 5) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];
  
  // O usuário deve ter percorrido pelo menos 50 metros totais antes de permitirmos fechar no início
  // Isso evita que o app tente fechar o ciclo enquanto você ainda está saindo do lugar.
  let totalDist = 0;
  for (let k = 1; k < path.length; k++) {
    totalDist += calculateDistance(path[k-1], path[k]);
  }
  if (totalDist < 40) return null;

  /**
   * 1. REGRA DOS 20 METROS (SNAP)
   * Ignoramos os últimos 10 pontos para evitar "fechar em si mesmo" instantaneamente.
   */
  const safetyBuffer = 10; 
  let snapIndex = -1;

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

    // Só validamos se houver captura real de área
    if (enclosedCellIds.length > 0) {
      console.log(`[Territory] Loop fechado por proximidade no index ${snapIndex}`);
      return {
        polygon,
        enclosedCellIds,
        closurePoint: path[snapIndex]
      };
    }
  }

  /**
   * 2. FECHAMENTO POR INTERSEÇÃO
   */
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      const polygon = [intersection, ...path.slice(i + 1), intersection];
      const enclosedCellIds = getEnclosedCellIds(polygon);
      
      if (enclosedCellIds.length > 0) {
        console.log(`[Territory] Loop fechado por cruzamento no segmento ${i}`);
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
