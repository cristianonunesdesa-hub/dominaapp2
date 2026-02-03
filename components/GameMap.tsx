// Arquivo: components/GameMap.tsx

import React, { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import { Cell, User, Point, PublicUser } from '../types';
import { GRID_SIZE } from '../constants';

interface GameMapProps {
  userLocation: Point | null;
  cells: Record<string, Cell>;
  users: Record<string, PublicUser>;
  activeUserId: string;
  activeUser: User | null;
  currentPath: Point[];
  activeTrail?: Point[];
  onMapClick?: (lat: number, lng: number) => void;
  introMode?: boolean;
}

const GameMap: React.FC<GameMapProps> = ({
  userLocation,
  cells,
  users,
  activeUserId,
  activeUser,
  currentPath = [],
  activeTrail = [],
  onMapClick,
  introMode = false
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const canvasLayerRef = useRef<L.Canvas | null>(null);
  const territoryShapesRef = useRef<Map<string, L.Rectangle>>(new Map());
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const activeAreaLayerRef = useRef<L.Polygon | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const otherPlayersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = L.map('dmn-tactical-map', {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      fadeAnimation: false,
      zoomSnap: 0.1,
    }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 17.5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 22,
      className: 'map-tiles'
    }).addTo(mapRef.current);

    canvasLayerRef.current = L.canvas({ padding: 0.5 });

    activeAreaLayerRef.current = L.polygon([], {
      fillColor: activeUser?.color || '#3B82F6',
      fillOpacity: 0.15,
      stroke: false,
      interactive: false,
      renderer: canvasLayerRef.current
    }).addTo(mapRef.current);

    activeTrailLayerRef.current = L.polyline([], {
      color: activeUser?.color || '#3B82F6',
      weight: 5,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      renderer: canvasLayerRef.current
    }).addTo(mapRef.current);

    mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    });
  }, []);

  // Renderização do Território (Blocos Sólidos)
  useEffect(() => {
    if (!mapRef.current || !canvasLayerRef.current) return;

    const cellIds = Object.keys(cells);
    const visitedIds = new Set<string>();
    const shapes = territoryShapesRef.current;

    for (const id of cellIds) {
      const cell = cells[id];
      visitedIds.add(id);
      
      const rectangle = shapes.get(id);
      const fillColor = cell.ownerColor || '#4B5563';

      if (!rectangle) {
        const [lat, lng] = id.split('_').map(parseFloat);
        const bounds: L.LatLngBoundsExpression = [
          [lat, lng],
          [lat + GRID_SIZE, lng + GRID_SIZE]
        ];

        const newRect = L.rectangle(bounds, {
          stroke: true,
          color: fillColor,
          weight: 0.1,
          fillColor,
          fillOpacity: 0.75,
          renderer: canvasLayerRef.current!,
          interactive: false
        }).addTo(mapRef.current!);

        (newRect as any)._lastColor = fillColor;
        shapes.set(id, newRect);
      } else if ((rectangle as any)._lastColor !== fillColor) {
        rectangle.setStyle({ fillColor, color: fillColor });
        (rectangle as any)._lastColor = fillColor;
      }
    }

    shapes.forEach((rect, id) => {
      if (!visitedIds.has(id)) {
        rect.remove();
        shapes.delete(id);
      }
    });
  }, [cells]);

  // Atualização do Rastro e Área Ativa
  useEffect(() => {
    if (!activeTrailLayerRef.current || !activeAreaLayerRef.current) return;
    
    const latLngs = currentPath.map(p => [p.lat, p.lng] as [number, number]);
    activeTrailLayerRef.current.setLatLngs(latLngs);
    activeAreaLayerRef.current.setLatLngs(latLngs);
    
    activeTrailLayerRef.current.setStyle({ color: activeUser?.color || '#3B82F6' });
    activeAreaLayerRef.current.setStyle({ fillColor: activeUser?.color || '#3B82F6' });
  }, [currentPath, activeUser?.color]);

  // Atualização do Player
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'player-marker',
          html: `<div class="relative w-12 h-12 flex items-center justify-center">
                  <div class="absolute inset-0 bg-blue-500/30 blur-xl rounded-full animate-pulse"></div>
                  <div class="w-5 h-5 rounded-full bg-white border-[4px] border-blue-600 shadow-[0_0_20px_white]"></div>
                </div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        }),
        zIndexOffset: 2000
      }).addTo(mapRef.current);
    } else {
      playerMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }
    if (!introMode) {
      mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 0.6 });
    }
  }, [userLocation, introMode]);

  return (
    <div className="h-full w-full bg-[#0a0a0a]">
      <style>{`
        .map-tiles { filter: brightness(0.4) contrast(1.2) grayscale(0.1); }
        .player-marker { transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1); }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full" />
    </div>
  );
};

export default memo(GameMap);