
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

      // Tiles Dark Matter - Baixo contraste, foco no HUD
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, 
        className: 'map-tiles'
      }).addTo(mapRef.current);

      // Setup do Canvas para efeito de Plasma/Metaballs
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
        }
      });
    }
  }, []);

  // Renderização das Células com efeito Metaball
  useEffect(() => {
    if (!territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();
    
    Object.values(cells).forEach((cell: any) => {
      // Cores elétricas: Azul para aliado, Vermelho para hostil
      const isHostile = cell.ownerId !== activeUserId && cell.ownerId !== null;
      const color = isHostile ? '#EF4444' : (cell.ownerColor || '#3B82F6');
      
      const [lat, lng] = cell.id.split('_').map(parseFloat);
      
      // Círculos maiores que o grid para criar sobreposição (overlap)
      // O filtro CSS transformará esses círculos em "manchas orgânicas"
      L.circle([lat, lng], {
        radius: 24, // Maior para permitir fusão visual
        renderer: territoryCanvasRef.current!, 
        stroke: false, 
        fillColor: color, 
        fillOpacity: 1.0 
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells, activeUserId]);

  useEffect(() => {
    if (!mapRef.current) return;
    const updateMarker = (uId: string, lat: number, lng: number, color: string) => {
      if (!playerMarkersRef.current[uId]) {
        playerMarkersRef.current[uId] = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'player-marker',
            html: `<div class="relative w-8 h-8 flex items-center justify-center">
                    <div class="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse"></div>
                    <div class="w-5 h-5 rounded-full bg-black border-2 border-white flex items-center justify-center relative z-10 shadow-2xl">
                      <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></div>
                    </div>
                  </div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
          })
        }).addTo(mapRef.current!);
      } else {
        playerMarkersRef.current[uId].setLatLng([lat, lng]);
      }
      if (uId === activeUserId) mapRef.current?.panTo([lat, lng], { animate: true });
    };
    if (userLocation && activeUser) updateMarker(activeUserId, userLocation.lat, userLocation.lng, activeUser.color);
  }, [users, userLocation, activeUser]);

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
        /* O segredo do efeito Metaball/Plasma: Blur + Alto Contraste */
        .leaflet-pane.leaflet-overlay-pane {
          filter: blur(14px) contrast(35) brightness(1.1);
          mix-blend-mode: screen;
          opacity: 0.85;
          animation: territoryBreath 8s ease-in-out infinite;
        }

        .map-tiles { 
          opacity: 0.2; 
          filter: grayscale(1) invert(1) brightness(0.4) contrast(1.1); 
        }

        .leaflet-container { 
          background: #000000 !important; 
        }

        .player-marker { 
          transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1); 
          z-index: 1000 !important; 
          filter: none !important; /* Marcador de jogador não deve ter blur */
        }

        @keyframes territoryBreath {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.02); opacity: 0.9; }
        }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
