
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
  const territoryCanvasRef = useRef<L.Canvas | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkersRef = useRef<Record<string, L.Marker>>({});
  const mapId = 'dmn-tactical-map';

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(mapId, {
        zoomControl: false, attributionControl: false, preferCanvas: true
      }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 17);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22, className: 'map-tiles'
      }).addTo(mapRef.current);

      territoryCanvasRef.current = L.canvas({ padding: 0.5, className: 'territory-layer' }).addTo(mapRef.current);
      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 5, opacity: 0.8, lineCap: 'round'
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => onMapClick?.(e.latlng.lat, e.latlng.lng));
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
        fillColor: color, fillOpacity: 1.0 // Sólido no canvas, opacidade controlada via CSS
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
            html: `<div class="w-4 h-4 rounded-full bg-black border-2 border-white flex items-center justify-center shadow-lg"><div class="w-1.5 h-1.5 rounded-full" style="background-color: ${color}"></div></div>`,
            iconSize: [16, 16], iconAnchor: [8, 8]
          })
        }).addTo(mapRef.current!);
      } else {
        playerMarkersRef.current[uId].setLatLng([lat, lng]);
      }
      if (uId === activeUserId) mapRef.current?.panTo([lat, lng]);
    };
    if (userLocation && activeUser) updateMarker(activeUserId, userLocation.lat, userLocation.lng, activeUser.color);
  }, [users, userLocation]);

  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail?.map(p => [p.lat, p.lng] as L.LatLngTuple) || []);
      if (activeUser) activeTrailLayerRef.current.setStyle({ color: activeUser.color });
    }
  }, [activeTrail, activeUser]);

  return (
    <>
      <style>{`
        .territory-layer { 
          opacity: 0.6 !important; /* OPACIDADE FIXA EM 60% */
          filter: blur(6px); /* Efeito suave sem estourar a cor */
          pointer-events: none;
        }
        .map-tiles { opacity: 0.4; filter: invert(100%) brightness(0.5); }
        .leaflet-container { background: #000 !important; }
      `}</style>
      <div id={mapId} className="h-full w-full" />
    </>
  );
};

export default GameMap;
