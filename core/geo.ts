// Arquivo: core/geo.ts

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

export const getIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
  const x1 = p1.lng, y1 = p1.lat;
  const x2 = p2.lng, y2 = p2.lat;
  const x3 = p3.lng, y3 = p3.lat;
  const x4 = p4.lng, y4 = p4.lat;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 0.0000000001) return null;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  // Pequena margem para evitar problemas de arredondamento em floats
  const eps = 0.0000001;
  if (ua >= -eps && ua <= 1 + eps && ub >= -eps && ub <= 1 + eps) {
    return {
      lat: y1 + ua * (y2 - y1),
      lng: x1 + ua * (x2 - x1),
      timestamp: Date.now()
    };
  }
  return null;
};

export const simplifyPath = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 2) return points;
  
  const findDist = (p: Point, p1: Point, p2: Point) => {
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
    const d = findDist(points[i], points[0], points[points.length - 1]);
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

/**
 * ✅ OTIMIZADO: Preenchimento de polígono alinhado ao grid (Scanline por Centro)
 */
export const getEnclosedCellIds = (rawPath: Point[]): string[] => {
  if (rawPath.length < 3) return [];

  const polygon = simplifyPath(rawPath, RDP_EPSILON * 0.1);
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  polygon.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });

  // Calculamos os passos do grid para cobrir a bounding box
  const startILat = Math.floor(minLat / GRID_SIZE);
  const endILat = Math.ceil(maxLat / GRID_SIZE);
  
  if (endILat - startILat > 1000) return []; // Proteção contra saltos de GPS

  const enclosed: string[] = [];

  // Para cada "linha" de células no grid
  for (let i = startILat; i <= endILat; i++) {
    const scanLat = i * GRID_SIZE; // Latitude do centro da célula
    const intersections: number[] = [];

    // Encontrar interseções com os segmentos do polígono
    for (let j = 0; j < polygon.length; j++) {
      const p1 = polygon[j];
      const p2 = polygon[(j + 1) % polygon.length];

      if ((p1.lat <= scanLat && p2.lat > scanLat) || (p2.lat <= scanLat && p1.lat > scanLat)) {
        const intersectLng = p1.lng + (scanLat - p1.lat) * (p2.lng - p1.lng) / (p2.lat - p1.lat);
        intersections.push(intersectLng);
      }
    }

    intersections.sort((a, b) => a - b);

    // Preencher as células entre os pares de interseções (Even-Odd rule)
    for (let k = 0; k < intersections.length; k += 2) {
      if (k + 1 >= intersections.length) break;
      
      const startLng = intersections[k];
      const endLng = intersections[k+1];
      
      const jStart = Math.ceil(startLng / GRID_SIZE);
      const jEnd = Math.floor(endLng / GRID_SIZE);

      for (let j = jStart; j <= jEnd; j++) {
        enclosed.push(`${scanLat.toFixed(8)}_${(j * GRID_SIZE).toFixed(8)}`);
      }
    }
  }

  return enclosed;
};