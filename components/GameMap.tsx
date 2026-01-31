
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Cell, User, Point } from '../types';
import { getCellBounds } from '../utils';

interface GameMapProps {
  userLocation: Point | null;
  cells: Record<string, Cell>;
  users: Record<string, User>;
  activeUserId: string;
  activeUser: User | null;
  currentPath: Point[]; 
  activeTrail?: Point[]; 
  showLoopPreview?: boolean;
  originalStartPoint?: Point;
  onMapClick?: (lat: number, lng: number) => void;
}

const GameMap: React.FC<GameMapProps> = ({ 
  userLocation, cells, users, activeUserId, activeUser, currentPath, activeTrail = [],
  showLoopPreview, originalStartPoint, onMapClick
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const canvasLayerRef = useRef<L.Canvas | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkersRef = useRef<Record<string, L.Marker>>({});
  const mapId = 'domina-tactical-map';

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current) {
      const initialLat = userLocation?.lat || -23.5505;
      const initialLng = userLocation?.lng || -46.6333;

      mapRef.current = L.map(mapId, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
      }).setView([initialLat, initialLng], 17);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22,
        subdomains: 'abcd',
        className: 'map-tiles'
      }).addTo(mapRef.current);

      // Renderer para o efeito "Liquid"
      canvasLayerRef.current = L.canvas({ 
        padding: 0.5,
        className: 'territory-liquid-layer' 
      }).addTo(mapRef.current);

      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', 
        weight: 6, 
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => { if (onMapClickRef.current) onMapClickRef.current(e.latlng.lat, e.latlng.lng); });
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();

    // Renderizamos cada célula como um círculo grande o suficiente para fundir com os vizinhos
    // Fix: Cast Object.values to Cell[] to ensure TypeScript correctly identifies properties on the 'cell' object
    (Object.values(cells) as Cell[]).forEach((cell) => {
      const activeOwner = users[cell.ownerId || ''];
      const ownerColor = cell.ownerColor || activeOwner?.color || '#444444';
      
      const [latStr, lngStr] = cell.id.split('_');
      const centerLat = parseFloat(latStr);
      const centerLng = parseFloat(lngStr);

      // Usamos círculos em vez de polígonos. 
      // O raio é ligeiramente maior que a distância entre células para garantir sobreposição total.
      L.circle([centerLat, centerLng], {
        radius: 8, // Metros (suficiente para cobrir a GRID_SIZE de 0.00006)
        renderer: canvasLayerRef.current,
        stroke: false,
        fillColor: ownerColor,
        fillOpacity: 1, // Opacidade total para o filtro contrast trabalhar
        interactive: false
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells, users]);

  useEffect(() => {
    if (!mapRef.current) return;
    const updateMarker = (uId: string, lat: number, lng: number, uData: Partial<User>) => {
      const pos: L.LatLngExpression = [lat, lng];
      const isMe = uId === activeUserId;
      const color = uData.color || '#3B82F6';
      const avatar = uData.avatarUrl || '';

      if (!playerMarkersRef.current[uId]) {
        playerMarkersRef.current[uId] = L.marker(pos, {
          icon: L.divIcon({
            className: 'player-marker',
            html: `<div class="w-10 h-10 rounded-full bg-black border-[3px] shadow-2xl flex items-center justify-center overflow-hidden" style="border-color: ${color}"><img src="${avatar}" class="w-full h-full object-cover" /></div>`,
            iconSize: [40, 40], iconAnchor: [20, 20]
          }),
          zIndexOffset: isMe ? 1000 : 900
        }).addTo(mapRef.current!);
      } else {
        playerMarkersRef.current[uId].setLatLng(pos);
      }
      if (isMe) mapRef.current?.panTo(pos, { animate: true, duration: 0.1 });
    };

    (Object.values(users) as User[]).forEach(u => { if (u.id !== activeUserId && u.lat && u.lng) updateMarker(u.id, u.lat, u.lng, u); });
    if (userLocation && activeUserId && activeUser) updateMarker(activeUserId, userLocation.lat, userLocation.lng, activeUser);
  }, [users, activeUserId, userLocation, activeUser]);

  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail.map(p => [p.lat, p.lng] as L.LatLngTuple));
      if (activeUser) activeTrailLayerRef.current.setStyle({ color: activeUser.color });
    } 
  }, [activeTrail, activeUser]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #0b0d11 !important; }
        
        /* O SEGREDO DA SUAVIDADE: Efeito Metaball */
        /* Blur funde as cores, Contrast endurece as bordas, Opacity traz a transparência do app de referência */
        .territory-liquid-layer {
          filter: blur(12px) contrast(350%) brightness(1.1);
          opacity: 0.6;
          mix-blend-mode: screen;
          pointer-events: none !important;
        }

        .player-marker { transition: transform 0.2s linear; }
      `}</style>
      <div id={mapId} className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
