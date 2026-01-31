
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

  // Manter ref do callback atualizada para evitar stale closures no evento do Leaflet
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('dmn-tactical-map', {
        zoomControl: false, attributionControl: false, preferCanvas: true
      }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 17);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22, className: 'map-tiles'
      }).addTo(mapRef.current);

      territoryCanvasRef.current = L.canvas({ padding: 0.5, className: 'territory-layer' }).addTo(mapRef.current);
      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      fullPathLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 3, opacity: 0.2, dashArray: '5, 10'
      }).addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    }
  }, []);

  useEffect(() => {
    if (!territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();
    Object.values(cells).forEach((cell: any) => {
      const color = cell.ownerColor || '#444444';
      const [lat, lng] = cell.id.split('_').map(parseFloat);
      L.circle([lat, lng], {
        radius: 12, renderer: territoryCanvasRef.current!, stroke: false, 
        fillColor: color, fillOpacity: 1.0 
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells]);

  useEffect(() => {
    if (!mapRef.current) return;
    const updateMarker = (uId: string, lat: number, lng: number, color: string) => {
      if (!playerMarkersRef.current[uId]) {
        playerMarkersRef.current[uId] = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'player-marker',
            html: `<div class="relative w-6 h-6 flex items-center justify-center"><div class="absolute inset-0 bg-white/20 blur-md rounded-full animate-pulse"></div><div class="w-4 h-4 rounded-full bg-black border-2 border-white flex items-center justify-center relative z-10 shadow-2xl"><div class="w-2 h-2 rounded-full" style="background-color: ${color}"></div></div></div>`,
            iconSize: [24, 24], iconAnchor: [12, 12]
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
        .territory-layer { 
          opacity: 0.6 !important; 
          filter: blur(4px);
          pointer-events: none;
        }
        .map-tiles { opacity: 0.3; filter: invert(100%) brightness(0.6) saturate(0.1); }
        .leaflet-container { background: #050505 !important; }
        .player-marker { transition: all 0.3s ease-out; z-index: 1000 !important; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full outline-none" />
    </>
  );
};

export default GameMap;
