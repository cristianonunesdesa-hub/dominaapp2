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
  captureFlashLoc?: Point | null;
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
  introMode = false,
  captureFlashLoc = null
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const polygonsRef = useRef<L.LayerGroup | null>(null);
  const flashRef = useRef<L.Marker | null>(null);
  const hasPerformedInitialFly = useRef(false);
  const isFlying = useRef(false);

  // ... (rest of the component)

  useEffect(() => {
    if (!mapRef.current || !captureFlashLoc) return;

    // Remove old flash if it exists
    if (flashRef.current) flashRef.current.remove();

    flashRef.current = L.marker([captureFlashLoc.lat, captureFlashLoc.lng], {
      icon: L.divIcon({
        className: 'capture-shockwave',
        html: `<div class="w-20 h-20 rounded-full border-4 border-emerald-500/60 animate-capture-pulse"></div>`,
        iconSize: [80, 80],
        iconAnchor: [40, 40]
      }),
      interactive: false
    }).addTo(mapRef.current);

    const timer = setTimeout(() => {
      if (flashRef.current) flashRef.current.remove();
      flashRef.current = null;
    }, 2000);

    return () => clearTimeout(timer);
  }, [captureFlashLoc]);

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">
      <style>{`
        .map-tiles { filter: brightness(0.2) contrast(1.1) grayscale(0.8) invert(0.05); }
        .leaflet-container { background: #000 !important; }
        .dmn-canvas-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .dmn-trail-layer { z-index: 450; }
        
        @keyframes capture-pulse {
          0% { transform: scale(0.1); opacity: 1; border-width: 8px; }
          100% { transform: scale(4); opacity: 0; border-width: 1px; }
        }
        .animate-capture-pulse {
          animation: capture-pulse 1.2s cubic-bezier(0, 0, 0.2, 1) forwards;
        }

        .player-marker { z-index: 1000 !important; }
        @keyframes player-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.5); opacity: 0.1; }
        }
        .player-pulse { animation: player-pulse 2s infinite ease-in-out; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full z-0" />
      <canvas ref={trailCanvasRef} className="dmn-canvas-layer dmn-trail-layer" />
    </div>
  );
};

export default memo(GameMap);