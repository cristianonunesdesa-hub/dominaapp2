
import { GRID_SIZE, RDP_EPSILON } from '../constants';
import { Point } from '../types';

export const getCellId = (lat: number, lng: number): string => {
  const iLat = Math.round(lat / GRID_SIZE);
  const iLng = Math.round(lng / GRID_SIZE);
  return `${(iLat * GRID_SIZE).toFixed(8)}_${(iLng * GRID_SIZE).toFixed(8)}`;
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

export const getIntersection = (
  p1: Point, p2: Point, 
  p3: Point, p4: Point
): Point | null => {
  const x1 = p1.lng, y1 = p1.lat;
  const x2 = p2.lng, y2 = p2.lat;
  const x3 = p3.lng, y3 = p3.lat;
  const x4 = p4.lng, y4 = p4.lat;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 0.0000000001) return null;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      lat: y1 + ua * (y2 - y1),
      lng: x1 + ua * (x2 - x1),
      timestamp: Date.now()
    };
  }
  return null;
};

export const isPointInPolygon = (point: {lat: number, lng: number}, polygon: {lat: number, lng: number}[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
                      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const simplifyPath = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 2) return points;
  
  const findPerpendicularDistance = (p: Point, p1: Point, p2: Point) => {
    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    if (dx === 0 && dy === 0) return Math.sqrt(Math.pow(p.lng - p1.lng, 2) + Math.pow(p.lat - p1.lat, 2));
    const t = ((p.lng - p1.lng) * dx + (p.lat - p1.lat) * dy) / (dx * dx + dy * dy);
    if (t < 0) return Math.sqrt(Math.pow(p.lng - p1.lng, 2) + Math.pow(p.lat - p1.lat, 2));
    if (t > 1) return Math.sqrt(Math.pow(p.lng - p2.lng, 2) + Math.pow(p.lat - p2.lat, 2));
    return Math.sqrt(Math.pow(p.lng - (p1.lng + t * dx), 2) + Math.pow(p.lat - (p1.lat + t * dy), 2));
  };

  let dmax = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = findPerpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const left = simplifyPath(points.slice(0, index + 1), epsilon);
    const right = simplifyPath(points.slice(index), epsilon);
    return [...left.slice(0, left.length - 1), ...right];
  } else {
    return [points[0], points[points.length - 1]];
  }
};

export const getEnclosedCellIds = (rawPath: Point[]): string[] => {
  if (rawPath.length < 3) return [];
  
  // Para preenchimento de área, usamos o rastro original sem simplificar muito
  // Isso garante que o preenchimento acompanhe as curvas reais do usuário
  const path = rawPath.length > 20 ? simplifyPath(rawPath, RDP_EPSILON * 0.5) : rawPath;
  
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  path.forEach(p => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  });

  // Margem de varredura (Sweep)
  const buffer = GRID_SIZE;
  const startI = Math.floor((minLat - buffer) / GRID_SIZE);
  const endI = Math.ceil((maxLat + buffer) / GRID_SIZE);
  const startJ = Math.floor((minLng - buffer) / GRID_SIZE);
  const endJ = Math.ceil((maxLng + buffer) / GRID_SIZE);

  const enclosed: string[] = [];
  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const cellLat = i * GRID_SIZE;
      const cellLng = j * GRID_SIZE;
      if (isPointInPolygon({ lat: cellLat, lng: cellLng }, path)) {
        enclosed.push(`${cellLat.toFixed(8)}_${cellLng.toFixed(8)}`);
      }
    }
  }
  return enclosed;
};
