
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
  targetLocation?: Point | null;
  plannedRoute?: Point[];
}

const GameMap: React.FC<GameMapProps> = ({ 
  userLocation, cells, users, activeUserId, activeUser, currentPath, activeTrail = [],
  showLoopPreview, originalStartPoint, onMapClick, targetLocation, plannedRoute
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const plannedRouteLayerRef = useRef<L.Polyline | null>(null);
  const previewPolygonRef = useRef<L.Polygon | null>(null);
  const canvasLayerRef = useRef<L.Canvas | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkersRef = useRef<Record<string, L.Marker>>({});
  const targetMarkerRef = useRef<L.CircleMarker | null>(null);
  const mapId = 'domina-tactical-map';
  
  const [zoomLevel, setZoomLevel] = useState(18);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current) {
      const initialLat = userLocation?.lat || -23.5505;
      const initialLng = userLocation?.lng || -46.6333;

      mapRef.current = L.map(mapId, {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        inertia: true,
        tap: false,
        preferCanvas: true
      }).setView([initialLat, initialLng], 18);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22,
        subdomains: 'abcd',
        className: 'map-tiles'
      }).addTo(mapRef.current);

      canvasLayerRef.current = L.canvas({ padding: 0.1 }).addTo(mapRef.current);
      territoryGroupRef.current = L.layerGroup().addTo(mapRef.current);
      
      previewPolygonRef.current = L.polygon([], {
        fillColor: 'white', fillOpacity: 0.1, weight: 1, color: 'white', dashArray: '4, 4', renderer: canvasLayerRef.current, interactive: false
      }).addTo(mapRef.current);

      pathLayerRef.current = L.polyline([], {
        color: 'rgba(255, 255, 255, 0.1)', weight: 2, opacity: 0.2, renderer: canvasLayerRef.current, interactive: false
      }).addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#FFFFFF', weight: 6, opacity: 0.9, renderer: canvasLayerRef.current, interactive: false
      }).addTo(mapRef.current);

      plannedRouteLayerRef.current = L.polyline([], {
        color: '#3B82F6', weight: 4, opacity: 0.6, dashArray: '8, 12', interactive: false
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => { if (onMapClickRef.current) onMapClickRef.current(e.latlng.lat, e.latlng.lng); });
      mapRef.current.on('zoomend', () => { if (mapRef.current) setZoomLevel(mapRef.current.getZoom()); });
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !territoryGroupRef.current) return;
    territoryGroupRef.current.clearLayers();

    (Object.values(cells) as any[]).forEach((cell) => {
      const activeOwner = users[cell.ownerId || ''];
      const ownerColor = cell.ownerColor || activeOwner?.color || '#444444';
      const isMe = cell.ownerId === activeUserId;

      const b = getCellBounds(cell.id);
      const leafletBounds: L.LatLngExpression[] = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
      
      L.polygon(leafletBounds, {
        renderer: canvasLayerRef.current,
        stroke: true,
        weight: isMe ? 2 : 1.2, // Borda mais grossa para o meu território
        color: ownerColor,
        opacity: isMe ? 0.6 : 0.4, // Mais opaco nas bordas se for meu
        fillColor: ownerColor,
        fillOpacity: cell.ownerId ? (isMe ? 0.55 : 0.4) : 0.1,
        interactive: false
      }).addTo(territoryGroupRef.current!);
    });
  }, [cells, users, zoomLevel, activeUserId]);

  useEffect(() => {
    if (!mapRef.current) return;

    Object.keys(playerMarkersRef.current).forEach(id => {
      if (!users[id] && id !== activeUserId) { 
        playerMarkersRef.current[id].remove(); 
        delete playerMarkersRef.current[id]; 
      }
    });

    const updateMarker = (uId: string, lat: number, lng: number, uData: Partial<User>) => {
      const pos: L.LatLngExpression = [lat, lng];
      const isMe = uId === activeUserId;
      const color = uData.color || '#3B82F6';
      const avatar = uData.avatarUrl || '';

      if (!playerMarkersRef.current[uId]) {
        playerMarkersRef.current[uId] = L.marker(pos, {
          icon: L.divIcon({
            className: 'player-marker',
            html: `
              <div class="relative">
                ${isMe ? `<div class="absolute -inset-6 rounded-full animate-ping" style="background-color: ${color}44"></div>` : ''}
                <div class="w-10 h-10 rounded-full bg-black border-[3px] shadow-[0_0_20px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden" style="border-color: ${color}">
                  <img src="${avatar}" class="w-full h-full object-cover" />
                </div>
              </div>
            `,
            iconSize: [40, 40], iconAnchor: [20, 20]
          }),
          zIndexOffset: isMe ? 1000 : 900
        }).addTo(mapRef.current!);
      } else {
        playerMarkersRef.current[uId].setLatLng(pos);
      }

      if (isMe) mapRef.current?.panTo(pos, { animate: true, duration: 0.1 });
    };

    (Object.values(users) as User[]).forEach(u => {
      if (u.id === activeUserId || !u.lat || !u.lng) return;
      updateMarker(u.id, u.lat, u.lng, u);
    });

    if (userLocation && activeUserId && activeUser) {
      updateMarker(activeUserId, userLocation.lat, userLocation.lng, activeUser);
    }
  }, [users, activeUserId, userLocation, activeUser]);

  useEffect(() => { if (pathLayerRef.current) pathLayerRef.current.setLatLngs(currentPath.map(p => [p.lat, p.lng] as L.LatLngTuple)); }, [currentPath]);
  
  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail.map(p => [p.lat, p.lng] as L.LatLngTuple));
      if (activeUser) activeTrailLayerRef.current.setStyle({ color: activeUser.color });
    } 
  }, [activeTrail, activeUser]);

  return (
    <>
      <style>{`
        .leaflet-container { cursor: crosshair !important; background: #000 !important; }
        .target-dest-marker { filter: drop-shadow(0 0 8px #3B82F6); animation: pulse-target 1.5s infinite; }
        @keyframes pulse-target { 0% { r: 6; opacity: 1; } 100% { r: 16; opacity: 0; } }
      `}</style>
      <div id={mapId} className="h-full w-full outline-none" style={{ minHeight: '100%' }} />
    </>
  );
};

export default GameMap;
