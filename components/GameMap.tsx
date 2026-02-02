// Arquivo: components/GameMap.tsx

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Cell, User, Point } from '../types';

interface GameMapProps {
  userLocation: Point | null;
  cells: Record<string, Cell>;
  users: Record<string, User>;
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

  // Territory shapes
  const territoryShapesRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Trail + player marker
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);

  // Outros usuários (bolinhas)
  const otherPlayersRef = useRef<Map<string, L.Marker>>(new Map());

  // Init map
  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = L.map('dmn-tactical-map', {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      fadeAnimation: false
    }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 18);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 21,
      className: 'map-tiles'
    }).addTo(mapRef.current);

    canvasLayerRef.current = L.canvas({ padding: 0.5 });

    activeTrailLayerRef.current = L.polyline([], {
      color: activeUser?.color || '#3B82F6',
      weight: 6,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
      renderer: canvasLayerRef.current
    }).addTo(mapRef.current);

    mapRef.current.on('click', (e) => onMapClick?.(e.latlng.lat, e.latlng.lng));
  }, []);

  // ✅ TERRITÓRIO: cria markers novos E ATUALIZA A COR dos que já existem
  useEffect(() => {
    if (!mapRef.current || !canvasLayerRef.current) return;

    const currentCellIds = new Set(Object.keys(cells));

    // Remove markers que não existem mais
    territoryShapesRef.current.forEach((shape, id) => {
      if (!currentCellIds.has(id)) {
        shape.remove();
        territoryShapesRef.current.delete(id);
      }
    });

    // Cria ou atualiza markers
    Object.values(cells).forEach((cell: Cell) => {
      const marker = territoryShapesRef.current.get(cell.id);
      const fillColor = cell.ownerColor || '#4B5563';

      if (!marker) {
        const [lat, lng] = cell.id.split('_').map(parseFloat);

        const newMarker = L.circleMarker([lat, lng], {
          radius: 3,
          stroke: false,
          fillColor,
          fillOpacity: 0.8,
          renderer: canvasLayerRef.current!,
          interactive: false
        }).addTo(mapRef.current!);

        territoryShapesRef.current.set(cell.id, newMarker);
      } else {
        marker.setStyle({ fillColor, fillOpacity: 0.8 });
      }
    });
  }, [cells]);

  // ✅ Player marker (você)
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'player-marker',
          html: `<div class="relative w-10 h-10 flex items-center justify-center">
                  <div class="absolute inset-0 bg-blue-500/40 blur-md rounded-full"></div>
                  <div class="w-4 h-4 rounded-full bg-white border-2 border-black shadow-lg"></div>
                </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(mapRef.current);
    } else {
      playerMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }

    if (!introMode) {
      mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true });
    }
  }, [userLocation, introMode]);

  // ✅ Trail (linha do rastro)
  useEffect(() => {
    if (!activeTrailLayerRef.current) return;

    activeTrailLayerRef.current.setLatLngs(activeTrail.map(p => [p.lat, p.lng]));
    activeTrailLayerRef.current.setStyle({ color: activeUser?.color || '#3B82F6' });
  }, [activeTrail, activeUser?.color]);

  // ✅ Outros usuários: bolinhas coloridas (usa users[id].lat/lng)
  useEffect(() => {
    if (!mapRef.current) return;

    const ids = new Set(Object.keys(users || {}));

    // remove quem saiu / não tem posição / é você
    otherPlayersRef.current.forEach((m, id) => {
      const u = users[id];
      const invalid =
        !ids.has(id) ||
        id === activeUserId ||
        !u ||
        typeof u.lat !== 'number' ||
        typeof u.lng !== 'number';

      if (invalid) {
        m.remove();
        otherPlayersRef.current.delete(id);
      }
    });

    // cria/atualiza
    Object.values(users || {}).forEach((u: User) => {
      if (u.id === activeUserId) return;
      if (typeof u.lat !== 'number' || typeof u.lng !== 'number') return;

      const existing = otherPlayersRef.current.get(u.id);

      const html = `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full blur-md" style="background:${u.color}55"></div>
          <div class="w-3 h-3 rounded-full border-2 border-black shadow-lg" style="background:${u.color}"></div>
        </div>
      `;

      if (!existing) {
        const marker = L.marker([u.lat, u.lng], {
          icon: L.divIcon({
            className: 'other-player-marker',
            html,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(mapRef.current!);

        otherPlayersRef.current.set(u.id, marker);
      } else {
        existing.setLatLng([u.lat, u.lng]);
      }
    });
  }, [users, activeUserId]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #0a0a0a !important; }
        .map-tiles { filter: brightness(0.6) invert(90%) contrast(1.2); }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full" />
    </>
  );
};

export default GameMap;
