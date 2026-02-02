
import { Point } from '../types';
import { calculateDistance, getIntersection, getEnclosedCellIds } from '../utils';
import { SNAP_TOLERANCE } from '../constants';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * Módulo de Validação de Ciclo:
 * Detecta se o rastro atual fechou um polígono por cruzamento ou proximidade.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  if (path.length < 3) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];

  // 1. Verificação por Interseção (Cruzamento do próprio rastro)
  // Ignora os últimos 3 pontos para evitar falsos positivos de adjacência
  for (let i = 0; i < path.length - 3; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      // Converte a interseção em um Point válido com timestamp para satisfazer a tipagem de LoopResult
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
        return {
          polygon,
          enclosedCellIds,
          closurePoint: intersectionPoint
        };
      }
    }
  }

  // 2. Verificação por Proximidade (Snap de 50 metros)
  // Verifica se o usuário chegou perto de qualquer ponto que já passou
  // Começamos do início da trilha para priorizar fechamentos maiores
  for (let i = 0; i < path.length - 10; i++) { // Garante que não está dando snap no próprio ponto recente
    const dist = calculateDistance(pNew, path[i]);
    if (dist < SNAP_TOLERANCE) {
      // Cria o polígono fechando do ponto de snap até o local atual e voltando ao snap
      const polygon = [
        ...path.slice(i),
        pNew,
        path[i]
      ];
      const enclosedCellIds = getEnclosedCellIds(polygon);

      if (enclosedCellIds.length > 0) {
        return {
          polygon,
          enclosedCellIds,
          closurePoint: path[i]
        };
      }
    }
  }

  return null;
};
