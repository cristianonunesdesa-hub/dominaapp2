
import { GRID_SIZE } from './constants';

/**
 * Retorna o ID da célula com base em índices inteiros do grid para evitar ruído de ponto flutuante.
 */
export const getCellId = (lat: number, lng: number): string => {
  const iLat = Math.round(lat / GRID_SIZE);
  const iLng = Math.round(lng / GRID_SIZE);
  return `${(iLat * GRID_SIZE).toFixed(7)}_${(iLng * GRID_SIZE).toFixed(7)}`;
};

/**
 * Retorna os limites exatos da célula para o Leaflet.
 */
export const getCellBounds = (cellId: string): [number, number, number, number] => {
  const [latStr, lngStr] = cellId.split('_');
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  return [lat - GRID_SIZE / 2, lng - GRID_SIZE / 2, lat + GRID_SIZE / 2, lng + GRID_SIZE / 2];
};

export const calculateDistance = (p1: { lat: number, lng: number }, p2: { lat: number, lng: number }): number => {
  const R = 6371e3;
  const φ1 = p1.lat * Math.PI / 180;
  const φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
  const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const segmentsIntersect = (
  p1: {lat: number, lng: number}, 
  p2: {lat: number, lng: number}, 
  p3: {lat: number, lng: number}, 
  p4: {lat: number, lng: number}
): boolean => {
  const det = (p2.lng - p1.lng) * (p4.lat - p3.lat) - (p2.lat - p1.lat) * (p4.lng - p3.lng);
  if (det === 0) return false;

  const _u = ((p3.lng - p1.lng) * (p4.lat - p3.lat) - (p3.lat - p1.lat) * (p4.lng - p3.lng)) / det;
  const _v = ((p3.lng - p1.lng) * (p2.lat - p1.lat) - (p3.lat - p1.lat) * (p2.lng - p1.lng)) / det;

  return (_u > 0.000000001 && _u < 0.999999999) && (_v > 0.000000001 && _v < 0.999999999);
};

export const isPointInPolygon = (point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[]) => {
  const x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const getEnclosedCellIds = (path: {lat: number, lng: number}[]): string[] => {
  if (path.length < 3) return [];

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  path.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });

  // Usando round para alinhar com o grid central das células
  const iStartLat = Math.floor(minLat / GRID_SIZE);
  const iEndLat = Math.ceil(maxLat / GRID_SIZE);
  const iStartLng = Math.floor(minLng / GRID_SIZE);
  const iEndLng = Math.ceil(maxLng / GRID_SIZE);

  const enclosedIds: string[] = [];
  for (let i = iStartLat; i <= iEndLat; i++) {
    for (let j = iStartLng; j <= iEndLng; j++) {
      const cellLat = i * GRID_SIZE;
      const cellLng = j * GRID_SIZE;
      if (isPointInPolygon({ lat: cellLat, lng: cellLng }, path)) {
        // GARANTIA: Usa a mesma função de ID do resto do app
        enclosedIds.push(getCellId(cellLat, cellLng));
      }
    }
  }

  return enclosedIds;
};
