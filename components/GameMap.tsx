
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

      territoryCanvasRef.current = L.canvas({ padding: 0.5, className: 'territory-liquid-engine' }).addTo(mapRef.current);
      trailCanvasRef.current = L.canvas({ padding: 0.1, className: 'tactical-trail-engine' }).addTo(mapRef.current);
      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      // Trilha persistente (missão total)
      fullPathLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', 
        weight: 3, opacity: 0.4, dashArray: '5, 10', renderer: trailCanvasRef.current
      }).addTo(mapRef.current);

      // Trilha ativa (ciclo de cerco atual)
      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', 
        weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', renderer: trailCanvasRef.current
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => { 
        if (onMapClickRef.current) onMapClickRef.current(e.latlng.lat, e.latlng.lng); 
      });
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();
    (Object.values(cells) as Cell[]).forEach((cell) => {
      const activeOwner = users[cell.ownerId || ''];
      const ownerColor = cell.ownerColor || activeOwner?.color || '#444444';
      const [latStr, lngStr] = cell.id.split('_');
      L.circle([parseFloat(latStr), parseFloat(lngStr)], {
        radius: 12, renderer: territoryCanvasRef.current!, stroke: false, fillColor: ownerColor, fillOpacity: 0.8, interactive: false
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells, users]);

  useEffect(() => {
    if (!mapRef.current) return;
    const updateMarker = (uId: string, lat: number, lng: number, uData: Partial<User>) => {
      const pos: L.LatLngExpression = [lat, lng];
      const isMe = uId === activeUserId;
      const color = uData.color || '#3B82F6';

      if (!playerMarkersRef.current[uId]) {
        playerMarkersRef.current[uId] = L.marker(pos, {
          icon: L.divIcon({
            className: 'player-marker',
            html: `<div class="relative flex items-center justify-center w-6 h-6"><div class="absolute inset-0 bg-white/30 blur-md rounded-full animate-pulse"></div><div class="w-4 h-4 rounded-full bg-black border-2 border-white flex items-center justify-center relative z-10 shadow-2xl"><div class="w-1.5 h-1.5 rounded-full" style="background-color: ${color}"></div></div></div>`,
            iconSize: [24, 24], iconAnchor: [12, 12]
          }),
          zIndexOffset: isMe ? 1000 : 900
        }).addTo(mapRef.current!);
      } else {
        playerMarkersRef.current[uId].setLatLng(pos);
      }
      if (isMe) mapRef.current?.panTo(pos, { animate: true, duration: 0.3 });
    };
    (Object.values(users) as User[]).forEach(u => { if (u.id !== activeUserId && u.lat && u.lng) updateMarker(u.id, u.lat, u.lng, u); });
    if (userLocation && activeUserId && activeUser) updateMarker(activeUserId, userLocation.lat, userLocation.lng, activeUser);
  }, [users, activeUserId, userLocation, activeUser]);

  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail.map(p => [p.lat, p.lng] as L.LatLngTuple));
      if (activeUser) activeTrailLayerRef.current.setStyle({ color: activeUser.color });
    }
    if (fullPathLayerRef.current) {
      fullPathLayerRef.current.setLatLngs(currentPath.map(p => [p.lat, p.lng] as L.LatLngTuple));
      if (activeUser) fullPathLayerRef.current.setStyle({ color: activeUser.color });
    }
  }, [activeTrail, currentPath, activeUser]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #080808 !important; }
        .territory-liquid-engine { 
          filter: blur(14px) contrast(400%) brightness(1.2); 
          opacity: 0.3; /* TRANSPARÊNCIA SOLICITADA */
          mix-blend-mode: screen; 
          z-index: 400; 
          pointer-events: none !important; 
        }
        .tactical-trail-engine { filter: drop-shadow(0 0 8px rgba(255,255,255,0.4)); z-index: 401; pointer-events: none !important; }
        .player-marker { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .map-tiles { opacity: 0.35; }
      `}</style>
      <div id={mapId} className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
