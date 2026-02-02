
import { Point } from '../types';
import { calculateDistance, getIntersection, getEnclosedCellIds } from '../utils';
import { SNAP_TOLERANCE } from '../constants';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * ENGINE DE CICLO - DOMINA
 * Responsável por detectar o fechamento de polígonos por cruzamento ou proximidade.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  // Precisamos de rastro mínimo para formar um triângulo (mínimo 3 + o novo ponto)
  if (path.length < 3) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];

  /**
   * 1. PRIORIDADE: FECHAMENTO POR PROXIMIDADE (SNAP 50M)
   * Varremos do início da trilha para o fim para encontrar o ponto MAIS ANTIGO
   * que satisfaça a tolerância de 50 metros. Isso maximiza a área capturada.
   */
  // Ignoramos apenas os últimos 5 pontos para permitir fechamentos rápidos/agressivos
  const safetyBuffer = 5; 
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    
    if (dist <= SNAP_TOLERANCE) {
      // Ponto de fechamento encontrado por proximidade!
      // Criamos um polígono que "puxa" o rastro até o ponto histórico i
      const polygon = [
        ...path.slice(i),
        pNew,
        path[i] // Fecha o elo
      ];

      const enclosedCellIds = getEnclosedCellIds(polygon);

      // Só validamos o fechamento se ele de fato capturar território
      if (enclosedCellIds.length > 0) {
        console.log(`[Cycle] Snap detectado no index ${i} (dist: ${dist.toFixed(1)}m)`);
        return {
          polygon,
          enclosedCellIds,
          closurePoint: path[i]
        };
      }
    }
  }

  /**
   * 2. FECHAMENTO POR INTERSEÇÃO (CRUZAMENTO)
   * Caso o usuário não passe perto do início, mas cruze o próprio rastro.
   */
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      const intersectionPoint: Point = {
        ...intersection,
        timestamp: Date.now()
      };

      const polygon = [
        intersectionPoint,
        ...path.slice(i + 1),
        intersectionPoint
      ];
      
      const enclosedCellIds = getEnclosedCellIds(polygon);
      
      if (enclosedCellIds.length > 0) {
        console.log(`[Cycle] Interseção detectada no segmento ${i}`);
        return {
          polygon,
          enclosedCellIds,
          closurePoint: intersectionPoint
        };
      }
    }
  }

  return null;
};
