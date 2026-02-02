
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Cell, User, Point } from '../types';
import { GRID_SIZE } from '../constants';

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
  userLocation, cells, activeUserId, activeUser, currentPath = [], activeTrail = [], onMapClick, introMode = false
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const fullPathLayerRef = useRef<L.Polyline | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('dmn-tactical-map', {
        zoomControl: false, 
        attributionControl: false, 
        preferCanvas: true, // Crucial para performance
        bounceAtZoomLimits: false
      }).setView([userLocation?.lat || -23.5505, userLocation?.lng || -46.6333], 18);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 21, className: 'map-tiles'
      }).addTo(mapRef.current);
      
      const territoryPane = mapRef.current.createPane('liquidTerritory');
      territoryPane.style.zIndex = '400';
      
      territoryGroupRef.current = L.layerGroup([], { pane: 'liquidTerritory' }).addTo(mapRef.current);

      fullPathLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#3B82F6', weight: 2, opacity: 0.15, smoothFactor: 5
      }).addTo(mapRef.current);

      activeTrailLayerRef.current = L.polyline([], {
        color: activeUser?.color || '#3B82F6', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round', smoothFactor: 1.5
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e) => {
        if (onMapClickRef.current) {
          onMapClickRef.current(e.latlng.lat, e.latlng.lng);
        }
      });
    }
  }, []);

  // Otimização de renderização de células: usa círculos simples no canvas
  useEffect(() => {
    if (!territoryGroupRef.current) return;
    const group = territoryGroupRef.current;
    group.clearLayers();

    // Renderiza apenas uma fração das células se houverem muitas, ou usa um sistema de clustering visual
    const cellEntries = Object.values(cells);
    cellEntries.forEach((cell: Cell) => {
      const [lat, lng] = cell.id.split('_').map(parseFloat);
      const color = cell.ownerColor || '#9CA3AF';
      
      L.circle([lat, lng], {
        radius: 4,
        stroke: false,
        fillColor: color,
        fillOpacity: 0.8,
        interactive: false,
        pane: 'liquidTerritory'
      }).addTo(group);
    });
  }, [cells]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'player-marker-local',
          html: `<div class="relative w-10 h-10 flex items-center justify-center">
                  <div class="absolute inset-0 bg-blue-500/40 blur-md rounded-full animate-pulse"></div>
                  <div class="w-4 h-4 rounded-full bg-white border-2 border-black shadow-lg shadow-blue-500/50"></div>
                </div>`,
          iconSize: [40, 40], iconAnchor: [20, 20]
        })
      }).addTo(mapRef.current);
    } else {
      playerMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }

    if (!introMode && mapRef.current.getZoom() > 10) {
       mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 0.3 });
    }
  }, [userLocation, introMode]);

  useEffect(() => { 
    if (activeTrailLayerRef.current) {
      activeTrailLayerRef.current.setLatLngs(activeTrail?.map(p => [p.lat, p.lng] as L.LatLngTuple) || []);
      activeTrailLayerRef.current.setStyle({ color: activeUser?.color || '#3B82F6' });
    }
    if (fullPathLayerRef.current) {
      fullPathLayerRef.current.setLatLngs(currentPath?.map(p => [p.lat, p.lng] as L.LatLngTuple) || []);
      fullPathLayerRef.current.setStyle({ color: activeUser?.color || '#3B82F6' });
    }
  }, [activeTrail, currentPath, activeUser?.color]);

  return (
    <>
      <style>{`
        .map-tiles { filter: brightness(0.6) contrast(1.2) saturate(0.2) invert(95%) hue-rotate(180deg); opacity: 0.9; }
        .liquid-territory-container {
          filter: blur(4px) contrast(20);
          mix-blend-mode: screen;
          opacity: 0.8;
          pointer-events: none;
        }
        .player-marker-local { transition: transform 0.1s linear; z-index: 1000 !important; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full outline-none bg-[#050505]" />
    </>
  );
};

export default GameMap;
