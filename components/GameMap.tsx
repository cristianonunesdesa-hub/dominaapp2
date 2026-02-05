// Arquivo: components/GameMap.tsx

import React, { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import { Cell, User, Point, PublicUser, TerritoryShape } from '../types';
import { simplifyPath, chaikinSmooth } from '../core/geo';

interface GameMapProps {
  userLocation: Point | null;
  cells: Record<string, Cell>;
  territoryShapes?: TerritoryShape[];
  users: Record<string, PublicUser>;
  activeUserId: string;
  activeUser: User | null;
  currentPath: Point[];
  onMapClick?: (lat: number, lng: number) => void;
  introMode?: boolean;
}

const GameMap: React.FC<GameMapProps> = ({
  userLocation,
  cells,
  territoryShapes = [],
  users,
  activeUserId,
  activeUser,
  currentPath = [],
  onMapClick,
  introMode = false
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const polygonsRef = useRef<L.LayerGroup | null>(null);
  const hasPerformedInitialFly = useRef(false);
  const isFlying = useRef(false);
  
  const pathRef = useRef<Point[]>(currentPath);
  const activeUserRef = useRef<User | null>(activeUser);

  useEffect(() => { pathRef.current = currentPath; }, [currentPath]);
  useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);

  const drawTrail = (map: L.Map, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = map.getSize();
    canvas.width = size.x * window.devicePixelRatio;
    canvas.height = size.y * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, size.x, size.y);

    const currentTrail = pathRef.current;
    if (currentTrail.length > 1) {
      const color = activeUserRef.current?.color || '#3B82F6';
      const points = currentTrail.map(p => map.latLngToContainerPoint([p.lat, p.lng]));
      
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.stroke();
      
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  const redraw = () => {
    if (!mapRef.current) return;
    if (trailCanvasRef.current) drawTrail(mapRef.current, trailCanvasRef.current);
  };

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('dmn-tactical-map', {
      zoomControl: false, 
      attributionControl: false, 
      preferCanvas: true,
      zoomSnap: 0.1
    }).setView([0, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 22, 
      className: 'map-tiles'
    }).addTo(map);

    polygonsRef.current = L.layerGroup().addTo(map);

    map.on('move zoom viewreset resize', redraw);
    map.on('click', (e) => onMapClick?.(e.latlng.lat, e.latlng.lng));
    
    mapRef.current = map;
    redraw();
    return () => { 
      if (map) map.remove(); 
      mapRef.current = null; 
    };
  }, []);

  // Lógica de Voo Inicial (Intro) - Ativada assim que introMode=false e userLocation existe
  useEffect(() => {
    if (!mapRef.current || introMode || !userLocation || hasPerformedInitialFly.current) return;
    
    // Pequeno delay para garantir que o mapa processou o setView(0,0,2) inicial e o container está estável
    const timer = setTimeout(() => {
      if (!mapRef.current || hasPerformedInitialFly.current) return;
      
      hasPerformedInitialFly.current = true;
      isFlying.current = true;
      
      mapRef.current.flyTo([userLocation.lat, userLocation.lng], 18, {
        duration: 3.5,
        easeLinearity: 0.25
      });

      // Libera o pan normal após o tempo da animação
      setTimeout(() => {
        isFlying.current = false;
      }, 4000);
    }, 500);

    return () => clearTimeout(timer);
  }, [introMode, userLocation]);

  // Renderização de Polígonos Suaves (Territórios)
  useEffect(() => {
    if (!mapRef.current || !polygonsRef.current) return;
    polygonsRef.current.clearLayers();

    territoryShapes.forEach(shape => {
      const simplified = simplifyPath(shape.polygon, 0.000005);
      const smoothed = chaikinSmooth(simplified, 2);
      const latLngs = smoothed.map(p => [p.lat, p.lng] as [number, number]);

      L.polygon(latLngs, {
        fill: false,
        stroke: true,
        weight: 15,
        color: shape.ownerColor,
        opacity: 0.08,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false
      }).addTo(polygonsRef.current!);

      L.polygon(latLngs, {
        fillColor: shape.ownerColor,
        fillOpacity: 0.16,
        stroke: true,
        weight: 2,
        color: shape.ownerColor,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false
      }).addTo(polygonsRef.current!);
    });
  }, [territoryShapes]);

  useEffect(() => {
    if (mapRef.current && trailCanvasRef.current) {
      drawTrail(mapRef.current, trailCanvasRef.current);
    }
  }, [currentPath, activeUser]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    
    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'player-marker',
          html: `<div class="relative w-14 h-14 flex items-center justify-center"><div class="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full player-pulse"></div><div class="w-4 h-4 rounded-full bg-white border-4 border-blue-600 shadow-[0_0_25px_rgba(37,99,235,1)]"></div></div>`,
          iconSize: [56, 56], 
          iconAnchor: [28, 28]
        }), 
        zIndexOffset: 1000
      }).addTo(mapRef.current);
    } else {
      playerMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      
      // Pan normal durante o jogo, se o voo inicial já terminou e não estamos em modo intro
      if (hasPerformedInitialFly.current && !introMode && !isFlying.current) {
        mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 0.8 });
      }
    }
  }, [userLocation, introMode]);

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">
      <style>{`
        .map-tiles { filter: brightness(0.2) contrast(1.1) grayscale(0.8) invert(0.05); }
        .leaflet-container { background: #000 !important; }
        .dmn-canvas-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .dmn-trail-layer { z-index: 450; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full z-0" />
      <canvas ref={trailCanvasRef} className="dmn-canvas-layer dmn-trail-layer" />
    </div>
  );
};

export default memo(GameMap);