
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
}

const GameMap: React.FC<GameMapProps> = ({ 
  userLocation, cells, users, activeUserId, activeUser, currentPath = [], activeTrail = [], onMapClick
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const fullPathLayerRef = useRef<L.Polyline | null>(null);
  const territoryCanvasRef = useRef<L.Canvas | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkersRef = useRef<Record<string, L.Marker>>({});
  const targetMarkerRef = useRef<L.Marker | null>(null);
  
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('dmn-tactical-map', {
        zoomControl: false, 
        attributionControl: false, 
        preferCanvas: true,
        inertia: true
      }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 16);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, 
        className: 'map-tiles'
      }).addTo(mapRef.current);

      territoryCanvasRef.current = L.canvas({ 
        padding: 0.5, 
        className: 'territory-canvas-layer' 
      }).addTo(mapRef.current);
      
      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      fullPathLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 4, opacity: 0.15, dashArray: '10, 15'
      }).addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 8, opacity: 0.8, lineCap: 'round', lineJoin: 'round'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        if (onMapClickRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
          
          // Efeito visual de Alvo no Mapa
          if (targetMarkerRef.current) targetMarkerRef.current.remove();
          targetMarkerRef.current = L.marker(e.latlng, {
            icon: L.divIcon({
              className: 'target-marker',
              html: `<div class="relative w-10 h-10 flex items-center justify-center">
                      <div class="absolute inset-0 border-2 border-orange-500 rounded-full animate-ping opacity-30"></div>
                      <div class="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"></div>
                    </div>`,
              iconSize: [40, 40], iconAnchor: [20, 20]
            })
          }).addTo(mapRef.current!);
          
          setTimeout(() => {
            if (targetMarkerRef.current) {
              targetMarkerRef.current.remove();
              targetMarkerRef.current = null;
            }
          }, 2000);
        }
      });
    }
  }, []);

  // Sincronização de Marcadores (Criar, Mover, Remover)
  useEffect(() => {
    if (!mapRef.current) return;

    Object.values(users).forEach((u: User) => {
      if (!u.lat || !u.lng) return;
      if (!playerMarkersRef.current[u.id]) {
        playerMarkersRef.current[u.id] = L.marker([u.lat, u.lng], {
          icon: L.divIcon({
            className: 'player-marker',
            html: `<div class="relative w-8 h-8 flex items-center justify-center">
                    <div class="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse"></div>
                    <div class="w-5 h-5 rounded-full bg-black border-2 border-white flex items-center justify-center relative z-10 shadow-2xl">
                      <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${u.color}"></div>
                    </div>
                  </div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
          })
        }).addTo(mapRef.current!);
      } else {
        playerMarkersRef.current[u.id].setLatLng([u.lat, u.lng]);
      }
    });

    Object.keys(playerMarkersRef.current).forEach((id) => {
      if (!users[id] && id !== activeUserId) {
        playerMarkersRef.current[id].remove();
        delete playerMarkersRef.current[id];
      }
    });

    if (userLocation) {
      mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true });
    }
  }, [users, userLocation, activeUserId]);

  // Renderização das Células
  useEffect(() => {
    if (!territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();
    Object.values(cells).forEach((cell: Cell) => {
      const isHostile = cell.ownerId !== activeUserId && cell.ownerId !== null;
      const color = isHostile ? '#EF4444' : (cell.ownerColor || '#3B82F6');
      const [lat, lng] = cell.id.split('_').map(parseFloat);
      L.circle([lat, lng], {
        radius: 22, renderer: territoryCanvasRef.current!, 
        stroke: false, fillColor: color, fillOpacity: 1.0 
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells, activeUserId]);

  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail?.map(p => [p.lat, p.lng] as L.LatLngTuple) || []);
      if (activeUser) activeTrailLayerRef.current.setStyle({ color: activeUser.color });
    }
    if (fullPathLayerRef.current) {
      fullPathLayerRef.current.setLatLngs(currentPath?.map(p => [p.lat, p.lng] as L.LatLngTuple) || []);
      if (activeUser) fullPathLayerRef.current.setStyle({ color: activeUser.color });
    }
  }, [activeTrail, currentPath, activeUser]);

  return (
    <>
      <style>{`
        .leaflet-pane.leaflet-overlay-pane {
          filter: blur(14px) contrast(35) brightness(1.1);
          mix-blend-mode: screen;
          opacity: 0.85;
          animation: territoryBreath 8s ease-in-out infinite;
        }
        .map-tiles { opacity: 0.25; filter: grayscale(1) invert(1) brightness(0.4) contrast(1.1); }
        .player-marker { transition: all 0.5s ease-out; z-index: 1000 !important; filter: none !important; }
        .target-marker { z-index: 2000 !important; filter: none !important; pointer-events: none; }
        @keyframes territoryBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.01); } }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
