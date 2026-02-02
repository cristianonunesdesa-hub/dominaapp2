
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
  // Necessário ao menos 3 pontos no rastro para formar uma área fechada
  if (path.length < 3) return null;

  const pNew = newLocation;
  const pLast = path[path.length - 1];
  
  /**
   * SAFETY BUFFER:
   * Evita que o rastro dê "snap" nele mesmo nos pontos imediatamente anteriores.
   * Reduzido para 5 para permitir fechamentos de ciclos menores e mais ágeis.
   */
  const safetyBuffer = 5; 

  /**
   * 1. BUSCA POR SNAP (PROXIMIDADE RÍGIDA)
   * Varremos o rastro do início para o fim.
   * O primeiro ponto encontrado que esteja a menos de SNAP_TOLERANCE (20m) fecha o ciclo.
   */
  let snapIndex = -1;
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const dist = calculateDistance(pNew, path[i]);
    
    // Verificação rigorosa do limite de distância (20m definidos em constantes)
    if (dist <= SNAP_TOLERANCE) {
      snapIndex = i;
      console.log(`[Territory] Alvo detectado para fechamento! Distância: ${dist.toFixed(2)}m (Limite: ${SNAP_TOLERANCE}m)`);
      break; 
    }
  }

  if (snapIndex !== -1) {
    // Construímos o polígono unindo o ponto atual ao ponto histórico do rastro
    const polygon = [...path.slice(snapIndex), pNew, path[snapIndex]];
    
    // Calculamos as células internas
    const enclosedCellIds = getEnclosedCellIds(polygon);

    /**
     * IMPORTANTE:
     * Mesmo que o rastro feche fisicamente, se a área for tão pequena que não contenha
     * o centro de nenhuma célula do grid (Grid de ~2.2m), não consideramos captura.
     * Isso evita polígonos inválidos (linhas sobrepostas).
     */
    if (enclosedCellIds.length > 0) {
      return {
        polygon,
        enclosedCellIds,
        closurePoint: path[snapIndex]
      };
    } else {
      console.warn("[Territory] Ciclo fechado, mas área muito pequena para capturar células.");
    }
  }

  /**
   * 2. BUSCA POR INTERSEÇÃO (CRUZAMENTO DE LINHA)
   * Caso o usuário não chegue a 20m de um ponto, mas cruze a própria linha.
   */
  for (let i = 0; i < path.length - safetyBuffer; i++) {
    const intersection = getIntersection(pLast, pNew, path[i], path[i + 1]);
    if (intersection) {
      const polygon = [intersection, ...path.slice(i + 1), intersection];
      const enclosedCellIds = getEnclosedCellIds(polygon);
      
      if (enclosedCellIds.length > 0) {
        console.log(`[Territory] Ciclo detectado por cruzamento no segmento ${i}`);
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
