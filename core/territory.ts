
import { Point } from '../types';
import { SNAP_TOLERANCE } from '../constants';
import { calculateDistance, getIntersection, getEnclosedCellIds } from './geo';

export interface LoopResult {
  polygon: Point[];
  enclosedCellIds: string[];
  closurePoint: Point;
}

/**
 * detectClosedLoop - NOVA VERSÃO DO ZERO
 * Detecta se o movimento atual fechou um polígono.
 */
export const detectClosedLoop = (
  path: Point[], 
  newLocation: Point
): LoopResult | null => {
  // Mínimo de pontos para formar um polígono válido (triângulo + retorno = 4+)
  // Usamos 10 para evitar ruído de micro-movimentos
  if (path.length < 10) return null;

  const pCurrent = newLocation;
  const pLast = path[path.length - 1];
  
  // 1. DEFINIÇÃO DO BUFFER DE SEGURANÇA
  // Não podemos fechar o circuito nos pontos que acabamos de criar (últimos 30-50 metros)
  // Assumindo pontos a cada 2-5 metros, ignoramos os últimos 15 pontos.
  const safetyBuffer = 15;
  const searchablePath = path.slice(0, path.length - safetyBuffer);

  if (searchablePath.length < 3) return null;

  /**
   * MÉTODO A: SNAP POR PROXIMIDADE (20 Metros)
   * Ideal para quando o usuário chega perto do ponto inicial mas não cruza a linha.
   */
  for (let i = 0; i < searchablePath.length; i++) {
    const dist = calculateDistance(pCurrent, searchablePath[i]);
    if (dist <= SNAP_TOLERANCE) {
      // Fechamento detectado!
      const polygon = [...path.slice(i), pCurrent, searchablePath[i]];
      const enclosedCellIds = getEnclosedCellIds(polygon);

      if (enclosedCellIds.length > 0) {
        return {
          polygon,
          enclosedCellIds,
          closurePoint: searchablePath[i]
        };
      }
    }
  }

  /**
   * MÉTODO B: INTERSEÇÃO DE SEGMENTOS (CRUZAMENTO DE LINHA)
   * Ideal para quando o usuário corta o próprio rastro.
   */
  // O segmento atual é de pLast para pCurrent
  for (let i = 0; i < searchablePath.length - 1; i++) {
    const pA = searchablePath[i];
    const pB = searchablePath[i + 1];

    const intersection = getIntersection(pLast, pCurrent, pA, pB);
    
    if (intersection) {
      // O polígono é formado do ponto de interseção até o rastro atual
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
