
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
  userLocation, cells, users, activeUserId, activeUser, activeTrail = [], onMapClick
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  
  // Dois renderizadores de Canvas independentes para performance máxima
  const territoryCanvasRef = useRef<L.Canvas | null>(null);
  const trailCanvasRef = useRef<L.Canvas | null>(null);
  
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkersRef = useRef<Record<string, L.Marker>>({});
  const mapId = 'dmn-tactical-map';

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current) {
      const initialLat = userLocation?.lat || -23.5505;
      const initialLng = userLocation?.lng || -46.6333;

      mapRef.current = L.map(mapId, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        fadeAnimation: true
      }).setView([initialLat, initialLng], 17);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22,
        subdomains: 'abcd',
        className: 'map-tiles'
      }).addTo(mapRef.current);

      // 1. Canvas para Território (Líquido/Plasma)
      territoryCanvasRef.current = L.canvas({ 
        padding: 0.5,
        className: 'territory-liquid-engine' 
      }).addTo(mapRef.current);

      // 2. Canvas para Trilha (Nítido/Performance)
      trailCanvasRef.current = L.canvas({
        padding: 0.1,
        className: 'tactical-trail-engine'
      }).addTo(mapRef.current);

      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', 
        weight: 5, 
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        renderer: trailCanvasRef.current // Usa o canvas nítido
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => { if (onMapClickRef.current) onMapClickRef.current(e.latlng.lat, e.latlng.lng); });
    }
  }, []);

  // Renderização de Territórios (Otimizada via Canvas Layer 1)
  useEffect(() => {
    if (!mapRef.current || !territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();

    (Object.values(cells) as Cell[]).forEach((cell) => {
      const activeOwner = users[cell.ownerId || ''];
      const ownerColor = cell.ownerColor || activeOwner?.color || '#444444';
      
      const [latStr, lngStr] = cell.id.split('_');
      const centerLat = parseFloat(latStr);
      const centerLng = parseFloat(lngStr);

      L.circle([centerLat, centerLng], {
        radius: 10,
        renderer: territoryCanvasRef.current!, // Usa o canvas com filtro líquido
        stroke: false,
        fillColor: ownerColor,
        fillOpacity: 1, 
        interactive: false
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells, users]);

  // Marcadores de Jogadores (Físico/DOM)
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
            html: `<div class="relative"><div class="absolute -inset-4 bg-white/10 blur-xl rounded-full"></div><div class="w-12 h-12 rounded-full bg-black border-[3px] shadow-2xl flex items-center justify-center overflow-hidden relative z-10" style="border-color: ${color}"><img src="${avatar}" class="w-full h-full object-cover" /></div></div>`,
            iconSize: [48, 48], iconAnchor: [24, 24]
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

  // Atualização da Trilha Ativa (Canvas Layer 2)
  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail.map(p => [p.lat, p.lng] as L.LatLngTuple));
      if (activeUser) activeTrailLayerRef.current.setStyle({ color: activeUser.color });
    } 
  }, [activeTrail, activeUser]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #080808 !important; }
        
        /* MOTOR 1: TERRITÓRIO LÍQUIDO */
        .territory-liquid-engine {
          filter: blur(14px) contrast(450%) brightness(1.1);
          opacity: 0.7;
          mix-blend-mode: screen;
          pointer-events: none !important;
          z-index: 400;
        }

        /* MOTOR 2: TRILHA TÁTICA NÍTIDA */
        .tactical-trail-engine {
          filter: drop-shadow(0 0 8px rgba(255,255,255,0.3));
          z-index: 401;
          pointer-events: none !important;
        }

        .player-marker { transition: transform 0.2s linear; }
        .map-tiles { opacity: 0.4; }
      `}</style>
      <div id={mapId} className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
