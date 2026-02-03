// Arquivo: core/geo.ts

import { GRID_SIZE } from '../constants';
import { Point } from '../types';

/**
 * Calcula o ID único da célula.
 */
export const getCellId = (lat: number, lng: number): string => {
  const iLat = Math.floor(lat / GRID_SIZE);
  const iLng = Math.floor(lng / GRID_SIZE);
  return `${(iLat * GRID_SIZE).toFixed(8)}_${(iLng * GRID_SIZE).toFixed(8)}`;
};

/**
 * Distância Haversine entre dois pontos em metros.
 */
export const calculateDistance = (p1: { lat: number, lng: number }, p2: { lat: number, lng: number }): number => {
  const R = 6371e3;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Verifica se dois segmentos (P1-P2 e P3-P4) se interceptam.
 * Retorna o ponto de interseção ou null.
 */
export const getIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point | null => {
  const x1 = p1.lng, y1 = p1.lat;
  const x2 = p2.lng, y2 = p2.lat;
  const x3 = p3.lng, y3 = p3.lat;
  const x4 = p4.lng, y4 = p4.lat;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return null;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  // Precisão flutuante para evitar erros de borda
  const eps = 0.0000001;
  if (ua >= 0 && ua <= 1 && ub >= eps && ub <= 1 - eps) {
    return {
      lat: y1 + ua * (y2 - y1),
      lng: x1 + ua * (x2 - x1),
      timestamp: Date.now()
    };
  }
  return null;
};

/**
 * Algoritmo Point-in-Polygon (Ray Casting) para determinar se uma célula está dentro do circuito.
 */
export const isPointInPolygon = (point: { lat: number, lng: number }, polygon: Point[]): boolean => {
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

/**
 * Retorna as células contidas dentro de um polígono fechado.
 * Varre o bounding box do polígono testando o centro de cada célula do grid.
 */
export const getEnclosedCellIds = (polygon: Point[]): string[] => {
  if (polygon.length < 3) return [];

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const startLat = Math.floor(minLat / GRID_SIZE) * GRID_SIZE;
  const endLat = Math.ceil(maxLat / GRID_SIZE) * GRID_SIZE;
  const startLng = Math.floor(minLng / GRID_SIZE) * GRID_SIZE;
  const endLng = Math.ceil(maxLng / GRID_SIZE) * GRID_SIZE;

  const enclosed: string[] = [];
  
  // Amostragem do Grid
  for (let lat = startLat; lat <= endLat; lat += GRID_SIZE) {
    for (let lng = startLng; lng <= endLng; lng += GRID_SIZE) {
      // Testamos o centro da célula
      const testPoint = { lat: lat + GRID_SIZE / 2, lng: lng + GRID_SIZE / 2 };
      if (isPointInPolygon(testPoint, polygon)) {
        enclosed.push(`${lat.toFixed(8)}_${lng.toFixed(8)}`);
      }
    }
  }

  return enclosed;
};

/**
 * Simplifica o caminho para renderização e cálculos sem perder a forma básica.
 */
export const simplifyPath = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 2) return points;
  
  const sqDist = (p1: Point, p2: Point) => Math.pow(p1.lng - p2.lng, 2) + Math.pow(p1.lat - p2.lat, 2);
  
  const findDist = (p: Point, p1: Point, p2: Point) => {
    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    if (dx === 0 && dy === 0) return sqDist(p, p1);
    const t = ((p.lng - p1.lng) * dx + (p.lat - p1.lat) * dy) / (dx * dx + dy * dy);
    if (t < 0) return sqDist(p, p1);
    if (t > 1) return sqDist(p, p2);
    return sqDist(p, { lat: p1.lat + t * dy, lng: p1.lng + t * dx, timestamp: 0 });
  };

  const simplify = (pts: Point[]): Point[] => {
    let dmax = 0;
    let index = 0;
    const end = pts.length - 1;
    for (let i = 1; i < end; i++) {
      const d = findDist(pts[i], pts[0], pts[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }
    if (dmax > epsilon * epsilon) {
      const res1 = simplify(pts.slice(0, index + 1));
      const res2 = simplify(pts.slice(index));
      return [...res1.slice(0, res1.length - 1), ...res2];
    } else {
      return [pts[0], pts[end]];
    }
  };

  return simplify(points);
};