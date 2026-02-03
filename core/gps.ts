
import { Point } from '../types';

/**
 * ACCURACY_THRESHOLD: 150m conforme exigido para evitar perda de sinal em áreas urbanas.
 */
const ACCURACY_THRESHOLD = 150; 

/**
 * EMA_ALPHA: 0.25 para um movimento suave ("gliding") sem perder a precisão da curva.
 */
const EMA_ALPHA = 0.25; 

export const processLocation = (
  rawPoint: Point, 
  lastPoint: Point | null, 
  isTestMode: boolean
): Point | null => {
  // Bypassa filtros em modo teste (simulador)
  if (isTestMode) {
    return rawPoint;
  }

  // Rejeita pontos com erro muito alto se já tivermos uma posição anterior estável
  if (rawPoint.accuracy && rawPoint.accuracy > ACCURACY_THRESHOLD && lastPoint) {
    console.log(`[GPS DROP] Descartado: accuracy=${rawPoint.accuracy.toFixed(0)}m > threshold=${ACCURACY_THRESHOLD}m`);
    return null;
  }

  if (!lastPoint) {
    return rawPoint;
  }

  // Filtro EMA (Exponential Moving Average)
  const processed = {
    lat: (rawPoint.lat * EMA_ALPHA) + (lastPoint.lat * (1 - EMA_ALPHA)),
    lng: (rawPoint.lng * EMA_ALPHA) + (lastPoint.lng * (1 - EMA_ALPHA)),
    accuracy: rawPoint.accuracy,
    timestamp: rawPoint.timestamp
  };

  return processed;
};
