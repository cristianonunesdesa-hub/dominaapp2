
import { Point } from '../types';

const ACCURACY_THRESHOLD = 150; 
const EMA_ALPHA = 0.25; 

export const processLocation = (
  rawPoint: Point, 
  lastPoint: Point | null, 
  isTestMode: boolean
): Point | null => {
  // Em modo teste, ignoramos filtros para agilidade
  if (isTestMode) return rawPoint;

  // Rejeita pontos com baixa precisão satelital
  if (rawPoint.accuracy && rawPoint.accuracy > ACCURACY_THRESHOLD && lastPoint) {
    return null;
  }

  if (!lastPoint) return rawPoint;

  // Filtro EMA para suavizar o rastro e evitar "jitter" (pulos no mapa)
  return {
    lat: (rawPoint.lat * EMA_ALPHA) + (lastPoint.lat * (1 - EMA_ALPHA)),
    lng: (rawPoint.lng * EMA_ALPHA) + (lastPoint.lng * (1 - EMA_ALPHA)),
    accuracy: rawPoint.accuracy,
    timestamp: rawPoint.timestamp
  };
};
