
import { GRID_SIZE } from './constants';

export const getCellId = (lat: number, lng: number): string => {
  const iLat = Math.round(lat / GRID_SIZE);
  const iLng = Math.round(lng / GRID_SIZE);
  return `${(iLat * GRID_SIZE).toFixed(7)}_${(iLng * GRID_SIZE).toFixed(7)}`;
};

export const calculateDistance = (p1: { lat: number, lng: number }, p2: { lat: number, lng: number }): number => {
  const R = 6371e3;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const segmentsIntersect = (
  p1: {lat: number, lng: number}, p2: {lat: number, lng: number}, 
  p3: {lat: number, lng: number}, p4: {lat: number, lng: number}
): boolean => {
  const det = (p2.lng - p1.lng) * (p4.lat - p3.lat) - (p2.lat - p1.lat) * (p4.lng - p3.lng);
  if (det === 0) return false;
  const lambda = ((p4.lat - p3.lat) * (p4.lng - p1.lng) + (p3.lng - p4.lng) * (p4.lat - p1.lat)) / det;
  const gamma = ((p1.lat - p2.lat) * (p4.lng - p1.lng) + (p2.lng - p1.lng) * (p4.lat - p1.lat)) / det;
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
};

export const isPointInPolygon = (point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const intersect = ((polygon[i].lng > point.lng) !== (polygon[j].lng > point.lng)) &&
                      (point.lat < (polygon[j].lat - polygon[i].lat) * (point.lng - polygon[i].lng) / (polygon[j].lng - polygon[i].lng) + polygon[i].lat);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const getEnclosedCellIds = (path: {lat: number, lng: number}[]): string[] => {
  if (path.length < 3) return [];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  path.forEach(p => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  });

  // Margem de segurança de 2 grids para garantir captura total
  const startI = Math.floor(minLat / GRID_SIZE) - 1;
  const endI = Math.ceil(maxLat / GRID_SIZE) + 1;
  const startJ = Math.floor(minLng / GRID_SIZE) - 1;
  const endJ = Math.ceil(maxLng / GRID_SIZE) + 1;

  const enclosed: string[] = [];
  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const lat = i * GRID_SIZE;
      const lng = j * GRID_SIZE;
      if (isPointInPolygon({ lat, lng }, path)) {
        enclosed.push(getCellId(lat, lng));
      }
    }
  }
  return enclosed;
};
