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
  
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

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
    }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 17);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 22,
      className: 'map-tiles'
    }).addTo(mapRef.current);

    canvasLayerRef.current = L.canvas({ padding: 0.5 });

    // Polígono que mostra a área sendo fechada
    activeAreaLayerRef.current = L.polygon([], {
      fillColor: activeUser?.color || '#3B82F6',
      fillOpacity: 0.2,
      stroke: false,
      interactive: false,
      renderer: canvasLayerRef.current
    }).addTo(mapRef.current);

    // Linha do rastro (Glow)
    activeTrailLayerRef.current = L.polyline([], {
      color: activeUser?.color || '#3B82F6',
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      renderer: canvasLayerRef.current
    }).addTo(mapRef.current);

    mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });
  }, []);

  // ✅ TERRITÓRIO SÓLIDO
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

        // stroke: true com weight pequeno remove o "flicker" entre blocos
        const newRect = L.rectangle(bounds, {
          stroke: true,
          color: fillColor,
          weight: 0.2,
          fillColor,
          fillOpacity: 0.7,
          renderer: canvasLayerRef.current!,
          interactive: false
        }).addTo(mapRef.current!);

        (newRect as any)._lastColor = fillColor;
        shapes.set(id, newRect);
      } else {
        if ((rectangle as any)._lastColor !== fillColor) {
          rectangle.setStyle({ fillColor, color: fillColor });
          (rectangle as any)._lastColor = fillColor;
        }
      }
    }

    shapes.forEach((rect, id) => {
      if (!visitedIds.has(id)) {
        rect.remove();
        shapes.delete(id);
      }
    });
  }, [cells]);

  // ✅ Player marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'player-marker',
          html: `<div class="relative w-10 h-10 flex items-center justify-center">
                  <div class="absolute inset-0 bg-white/20 blur-xl rounded-full"></div>
                  <div class="w-5 h-5 rounded-full bg-white border-[3px] border-blue-600 shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
                </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        }),
        zIndexOffset: 2000
      }).addTo(mapRef.current);
    } else {
      playerMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }

    if (!introMode) {
      mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 0.5 });
    }
  }, [userLocation?.lat, userLocation?.lng, introMode]);

  // ✅ Trail e Polígono de Captura Ativa
  useEffect(() => {
    if (!activeTrailLayerRef.current || !activeAreaLayerRef.current) return;
    
    const latLngs = activeTrail.map(p => [p.lat, p.lng] as [number, number]);
    activeTrailLayerRef.current.setLatLngs(latLngs);
    
    // Se temos pontos suficientes, mostra a "sombra" da área sendo capturada
    if (latLngs.length > 2) {
      activeAreaLayerRef.current.setLatLngs(latLngs);
      activeAreaLayerRef.current.setStyle({ fillColor: activeUser?.color || '#3B82F6' });
    } else {
      activeAreaLayerRef.current.setLatLngs([]);
    }
    
    activeTrailLayerRef.current.setStyle({ color: activeUser?.color || '#3B82F6' });
  }, [activeTrail, activeUser?.color]);

  // ✅ Outros agentes
  useEffect(() => {
    if (!mapRef.current) return;

    const ids = new Set(Object.keys(users || {}));
    const others = otherPlayersRef.current;

    others.forEach((m, id) => {
      if (!ids.has(id) || id === activeUserId) {
        m.remove();
        others.delete(id);
      }
    });

    for (const id in users) {
      const u = users[id];
      if (id === activeUserId || !u.lat || !u.lng) continue;

      const marker = others.get(id);
      const html = `<div class="relative w-8 h-8 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full blur-md" style="background:${u.color}55"></div>
          <div class="w-3 h-3 rounded-full border-2 border-black" style="background:${u.color}"></div>
        </div>`;

      if (!marker) {
        const newM = L.marker([u.lat, u.lng], {
          icon: L.divIcon({ className: 'other-player-marker', html, iconSize: [32, 32], iconAnchor: [16, 16] }),
          zIndexOffset: 1500
        }).addTo(mapRef.current!);
        others.set(id, newM);
      } else {
        marker.setLatLng([u.lat, u.lng]);
      }
    }
  }, [users, activeUserId]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #0a0a0a !important; }
        .map-tiles { filter: brightness(0.5) contrast(1.1) grayscale(0.2); }
        .player-marker { transition: all 0.2s linear; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full" />
    </>
  );
};

export default memo(GameMap);