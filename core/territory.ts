
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
  // Necessário um rastro mínimo para não fechar no próprio passo (mínimo 3 pontos)
  if (path.length < 3) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];
  
  /**
   * SAFETY BUFFER:
   * Evita que o rastro dê "snap" nos últimos 3 pontos (aprox. 15 metros atrás).
   */
  const safetyBuffer = 3; 

  /**
   * 1. REGRA DOS 20 METROS (PRIORIDADE)
   * Verifica se o usuário chegou perto de QUALQUER ponto anterior do rastro,
   * começando pelo ponto 0 (Início da corrida).
   */
  let snapIndex = -1;
  let minSnapDist = Infinity;

  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    
    if (dist <= SNAP_TOLERANCE) {
      // Se encontrou um ponto no raio de 20m, marcamos o fechamento
      snapIndex = i;
      minSnapDist = dist;
      break; // Fecha no ponto mais antigo possível para maximizar a área
    }
  }

  if (snapIndex !== -1) {
    console.log(`[DOMINA] Loop fechado por proximidade! Distância: ${minSnapDist.toFixed(1)}m`);
    
    // Construção do polígono de captura
    const polygon = [...path.slice(snapIndex), pNew, path[snapIndex]];
    
    // Cálculo de células internas para o preenchimento
    const enclosedCellIds = getEnclosedCellIds(polygon);

    // Se o ciclo fechou fisicamente mas a área é minúscula (< 1 célula), 
    // ainda assim retornamos para fechar o rastro visualmente
    return {
      polygon,
      enclosedCellIds,
      closurePoint: path[snapIndex]
    };
  }

  /**
   * 2. FECHAMENTO POR INTERSEÇÃO
   * Caso o usuário cruze o rastro sem entrar no raio de 20m de um ponto específico.
   */
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      const polygon = [intersection, ...path.slice(i + 1), intersection];
      const enclosedCellIds = getEnclosedCellIds(polygon);
      
      console.log(`[DOMINA] Loop fechado por cruzamento no segmento ${i}`);
      return {
        polygon,
        enclosedCellIds,
        closurePoint: intersection
      };
    }
  }

  return null;
};
