
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
  simTarget?: Point | null;
}

const GameMap: React.FC<GameMapProps> = ({ 
  userLocation, cells, users, activeUserId, activeUser, currentPath = [], activeTrail = [], onMapClick, simTarget
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const fullPathLayerRef = useRef<L.Polyline | null>(null);
  const territoryCanvasRef = useRef<L.Canvas | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkersRef = useRef<Record<string, L.Marker>>({});
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const simLineRef = useRef<L.Polyline | null>(null);
  
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
        padding: 0.1, 
        className: 'territory-canvas-layer' 
      }).addTo(mapRef.current);
      
      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      fullPathLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 3, opacity: 0.1, dashArray: '5, 10'
      }).addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 6, opacity: 0.7, lineCap: 'round', lineJoin: 'round'
      }).addTo(mapRef.current);

      simLineRef.current = L.polyline([], {
        color: '#f97316', weight: 2, opacity: 0.5, dashArray: '4, 8'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        if (onMapClickRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });
    }
  }, []);

  // Sincronização de Alvo e Linha de Simulação
  useEffect(() => {
    if (!mapRef.current) return;
    if (targetMarkerRef.current) targetMarkerRef.current.remove();
    
    if (simTarget) {
      targetMarkerRef.current = L.marker([simTarget.lat, simTarget.lng], {
        icon: L.divIcon({
          className: 'target-marker',
          html: `<div class="relative w-10 h-10 flex items-center justify-center">
                  <div class="absolute inset-0 border-2 border-orange-500 rounded-full animate-ping opacity-30"></div>
                  <div class="w-2.5 h-2.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"></div>
                </div>`,
          iconSize: [40, 40], iconAnchor: [20, 20]
        })
      }).addTo(mapRef.current);

      if (userLocation && simLineRef.current) {
        simLineRef.current.setLatLngs([[userLocation.lat, userLocation.lng], [simTarget.lat, simTarget.lng]]);
      }
    } else {
      if (simLineRef.current) simLineRef.current.setLatLngs([]);
    }
  }, [simTarget, userLocation]);

  // Marcadores de Jogadores
  useEffect(() => {
    if (!mapRef.current) return;

    Object.values(users).forEach((u: User) => {
      if (!u.lat || !u.lng) return;
      if (!playerMarkersRef.current[u.id]) {
        playerMarkersRef.current[u.id] = L.marker([u.lat, u.lng], {
          icon: L.divIcon({
            className: 'player-marker',
            html: `<div class="relative w-8 h-8 flex items-center justify-center">
                    <div class="absolute inset-0 bg-white/10 blur-md rounded-full"></div>
                    <div class="w-5 h-5 rounded-full bg-black border-2 border-white flex items-center justify-center relative z-10 shadow-lg">
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

  // Renderização de Territórios (Sem "Manchas")
  useEffect(() => {
    if (!territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();
    Object.values(cells).forEach((cell: Cell) => {
      const isHostile = cell.ownerId !== activeUserId && cell.ownerId !== null;
      const color = isHostile ? '#EF4444' : (cell.ownerColor || '#3B82F6');
      const [lat, lng] = cell.id.split('_').map(parseFloat);
      
      // Círculo com bordas táticas em vez de desfoque global
      L.circle([lat, lng], {
        radius: 24,
        renderer: territoryCanvasRef.current!, 
        stroke: true,
        color: color,
        weight: 1,
        opacity: 0.3,
        fillColor: color, 
        fillOpacity: 0.4 
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
        /* Melhoria Tática: Efeito de Pulsação de Setor */
        .leaflet-pane.leaflet-overlay-pane {
          mix-blend-mode: screen;
          opacity: 0.9;
          filter: contrast(1.2);
        }
        .map-tiles { opacity: 0.3; filter: grayscale(1) invert(1) brightness(0.5); }
        .player-marker { transition: all 0.1s linear; z-index: 1000 !important; }
        .target-marker { z-index: 2000 !important; pointer-events: none; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
