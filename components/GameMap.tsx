// Arquivo: components/GameMap.tsx

import React, { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import { Cell, User, Point, PublicUser } from '../types';
import { GRID_SIZE } from '../constants';

interface GameMapProps {
  userLocation: Point | null;
  cells: Record<string, Cell>;
  users: Record<string, PublicUser>;
  activeUserId: string;
  activeUser: User | null;
  currentPath: Point[];
  onMapClick?: (lat: number, lng: number) => void;
}

const GameMap: React.FC<GameMapProps> = ({
  userLocation,
  cells,
  users,
  activeUserId,
  activeUser,
  currentPath = [],
  onMapClick
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const activeTrailLayerRef = useRef<L.Polyline | null>(null);
  const activeTrailGlowLayerRef = useRef<L.Polyline | null>(null);
  const activeTrailOuterGlowLayerRef = useRef<L.Polyline | null>(null);
  const activeAreaLayerRef = useRef<L.Polygon | null>(null);
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const territoryCanvasRef = useRef<any>(null);
  
  const cellsRef = useRef(cells);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (territoryCanvasRef.current && territoryCanvasRef.current._map) {
      territoryCanvasRef.current.draw();
    }
  }, [cells]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map('dmn-tactical-map', {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      fadeAnimation: true
    }).setView([userLocation?.lat || -23.55, userLocation?.lng || -46.63], 18);

    map.createPane('territoryPane');
    const tPane = map.getPane('territoryPane');
    if (tPane) tPane.style.zIndex = '450';

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 22,
      className: 'map-tiles'
    }).addTo(map);

    const renderer = L.canvas({ padding: 0.5 });

    // Overlay de Captura Ativa (DNA Visual que queremos replicar no território fixo)
    activeAreaLayerRef.current = L.polygon([], {
      fillColor: activeUser?.color || '#3B82F6',
      fillOpacity: 0.2,
      stroke: false,
      renderer
    }).addTo(map);

    activeTrailOuterGlowLayerRef.current = L.polyline([], {
      color: activeUser?.color || '#3B82F6',
      weight: 32, opacity: 0.08, lineCap: 'round', renderer
    }).addTo(map);

    activeTrailGlowLayerRef.current = L.polyline([], {
      color: activeUser?.color || '#3B82F6',
      weight: 16, opacity: 0.25, lineCap: 'round', renderer
    }).addTo(map);

    activeTrailLayerRef.current = L.polyline([], {
      color: activeUser?.color || '#3B82F6',
      weight: 3, opacity: 0.9, lineCap: 'round', renderer
    }).addTo(map);

    const TerritoryLayer = L.Layer.extend({
      onAdd: function(m: L.Map) {
        this._canvas = L.DomUtil.create('canvas', 'leaflet-territory-layer');
        const pane = m.getPane('territoryPane');
        if (pane) pane.appendChild(this._canvas);
        else m.getPanes().overlayPane.appendChild(this._canvas);
        m.on('move zoom viewreset', this.draw, this);
        this.draw();
      },
      onRemove: function(m: L.Map) {
        L.DomUtil.remove(this._canvas);
        m.off('move zoom viewreset', this.draw, this);
      },
      draw: function() {
        const m = this._map;
        if (!m || !this._canvas) return;
        
        const size = m.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        L.DomUtil.setPosition(this._canvas, m.containerPointToLayerPoint([0, 0]));
        
        const ctx = this._canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size.x, size.y);
        
        const allCells = cellsRef.current;
        const currentCells = Object.values(allCells) as Cell[];
        if (currentCells.length === 0) return;

        // Agrupar por dono para processar silhuetas coloridas
        const groups: Record<string, Cell[]> = {};
        currentCells.forEach(c => {
          const color = c.ownerColor || '#3B82F6';
          if (!groups[color]) groups[color] = [];
          groups[color].push(c);
        });

        Object.entries(groups).forEach(([color, cellGroup]) => {
          ctx.save();
          
          const groupIds = new Set(cellGroup.map(c => c.id));
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          
          // --- PASSO 1: PREENCHIMENTO UNIFICADO (SEM LINHAS INTERNAS) ---
          ctx.beginPath();
          cellGroup.forEach(cell => {
            const [latStr, lngStr] = cell.id.split('_');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            const pTL = m.latLngToContainerPoint([lat + GRID_SIZE, lng]);
            const pBR = m.latLngToContainerPoint([lat, lng + GRID_SIZE]);
            
            // Overlap minúsculo (0.5px) para evitar linhas de alias no preenchimento
            ctx.rect(pTL.x, pTL.y, pBR.x - pTL.x + 0.6, pBR.y - pTL.y + 0.6);
          });
          
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.35; // Transparência tática como na referência
          ctx.fill();

          // --- PASSO 2: DETECÇÃO DE BORDAS EXTERNAS (SILHUETA) ---
          ctx.beginPath();
          cellGroup.forEach(cell => {
            const [latStr, lngStr] = cell.id.split('_');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            
            const pTL = m.latLngToContainerPoint([lat + GRID_SIZE, lng]);
            const pTR = m.latLngToContainerPoint([lat + GRID_SIZE, lng + GRID_SIZE]);
            const pBL = m.latLngToContainerPoint([lat, lng]);
            const pBR = m.latLngToContainerPoint([lat, lng + GRID_SIZE]);

            // IDs de vizinhos baseados no grid matemático
            const nID = `${(lat + GRID_SIZE).toFixed(8)}_${lng.toFixed(8)}`;
            const sID = `${(lat - GRID_SIZE).toFixed(8)}_${lng.toFixed(8)}`;
            const eID = `${lat.toFixed(8)}_${(lng + GRID_SIZE).toFixed(8)}`;
            const wID = `${lat.toFixed(8)}_${(lng - GRID_SIZE).toFixed(8)}`;

            // Desenhar linha apenas se não houver vizinho do mesmo dono naquela direção
            if (!groupIds.has(nID)) { ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y); }
            if (!groupIds.has(sID)) { ctx.moveTo(pBL.x, pBL.y); ctx.lineTo(pBR.x, pBR.y); }
            if (!groupIds.has(eID)) { ctx.moveTo(pTR.x, pTR.y); ctx.lineTo(pBR.x, pBR.y); }
            if (!groupIds.has(wID)) { ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pBL.x, pBL.y); }
          });

          // --- PASSO 3: RENDERIZAÇÃO DO GLOW NEON (MÚLTIPLAS CAMADAS) ---
          
          // Camada 1: Halo de radiação (Glow Longe)
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.12;
          ctx.lineWidth = 18;
          ctx.stroke();

          // Camada 2: Brilho de borda (Glow Médio)
          ctx.globalAlpha = 0.25;
          ctx.lineWidth = 8;
          ctx.stroke();

          // Camada 3: Fio Neon Central (Alta Definição)
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 3.5;
          ctx.stroke();

          ctx.restore();
        });
      }
    });

    territoryCanvasRef.current = new (TerritoryLayer as any)();
    territoryCanvasRef.current.addTo(map);
    
    map.on('click', (e) => onMapClickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layers = [activeTrailLayerRef.current, activeTrailGlowLayerRef.current, activeTrailOuterGlowLayerRef.current, activeAreaLayerRef.current];
    if (layers.some(l => !l)) return;
    const pts = currentPath.map(p => [p.lat, p.lng] as [number, number]);
    const color = activeUser?.color || '#3B82F6';
    layers.forEach(layer => {
      if (layer) {
        layer.setLatLngs(pts);
        if (layer instanceof L.Path) {
          if (layer instanceof L.Polygon) layer.setStyle({ fillColor: color });
          else layer.setStyle({ color });
        }
      }
    });
  }, [currentPath, activeUser]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    
    if (!playerMarkerRef.current) {
      playerMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'player-marker',
          html: `<div class="relative w-14 h-14 flex items-center justify-center"><div class="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full player-pulse"></div><div class="w-4 h-4 rounded-full bg-white border-4 border-blue-600 shadow-[0_0_25px_rgba(37,99,235,1)]"></div></div>`,
          iconSize: [56, 56], iconAnchor: [28, 28]
        }), zIndexOffset: 1000
      }).addTo(mapRef.current);
      mapRef.current.setView([userLocation.lat, userLocation.lng], 18);
    } else {
      playerMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      mapRef.current.panTo([userLocation.lat, userLocation.lng], { animate: true, duration: 0.8 });
    }
  }, [userLocation]);

  return (
    <div className="h-full w-full bg-black">
      <style>{`
        .map-tiles { filter: brightness(0.2) contrast(1.1) grayscale(0.8) invert(0.05); }
        .leaflet-territory-layer { pointer-events: none; }
        .leaflet-container { z-index: 0 !important; }
      `}</style>
      <div id="dmn-tactical-map" className="h-full w-full" />
    </div>
  );
};

export default memo(GameMap);
