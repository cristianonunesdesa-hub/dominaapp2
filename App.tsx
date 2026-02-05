// Arquivo: App.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState, PublicUser, SyncPayload, SyncResponse, TerritoryShape } from './types';
import { calculateDistance, simplifyPath } from './core/geo';
import { detectClosedLoop } from './core/territory';
import { processLocation } from './core/gps';
import { MIN_MOVE_DISTANCE, RDP_EPSILON, CELL_AREA_M2, TACTICAL_COLORS } from './constants';
import { calculateSessionXp, calculateLevelFromXp } from './core/xp';

import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import Leaderboard from './components/Leaderboard';
import MissionSummary from './components/MissionSummary';
import TestSimulator from './components/TestSimulator';
import IntroOverlay from './components/IntroOverlay';
import { playVictorySound } from './utils/audio';

const STORAGE_KEY = 'domina_user_profile';
const SIMULATION_TICK_MS = 250;
const SIMULATION_SPEED_MPS = 2.4; 

function moveTowards(from: Point, to: Point, distanceMeters: number): Point {
  const R = 6371e3;
  const lat1 = from.lat * Math.PI / 180;
  const lon1 = from.lng * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const lon2 = to.lng * Math.PI / 180;
  
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  if (d <= distanceMeters) return { ...to, timestamp: Date.now() };

  const bearing = Math.atan2(
    Math.sin(dLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  );

  const angDist = distanceMeters / R;
  const lat3 = Math.asin(Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing));
  const lon3 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1), Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat3));

  return {
    lat: lat3 * 180 / Math.PI,
    lng: lon3 * 180 / Math.PI,
    accuracy: 5,
    timestamp: Date.now()
  };
}

const generateDefaultUser = (): User => {
  const randomColor = TACTICAL_COLORS[Math.floor(Math.random() * TACTICAL_COLORS.length)];
  const id = `u_${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    nickname: `AGENTE_${id.slice(-4).toUpperCase()}`,
    color: randomColor,
    cellsOwned: 0,
    totalAreaM2: 0,
    xp: 0,
    level: 1,
    badges: [],
    dailyStreak: 0
  };
};

const getInitialUser = (): User => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { console.error("Erro no perfil", e); }
  }
  const newUser = generateDefaultUser();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
};

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [user, setUser] = useState<User | null>(getInitialUser());
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [users, setUsers] = useState<Record<string, PublicUser>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [territoryShapes, setTerritoryShapes] = useState<TerritoryShape[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [introMode, setIntroMode] = useState(true);
  
  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const userRef = useRef<User | null>(user);
  const isProcessingRef = useRef(false);
  const autopilotTargetRef = useRef<Point | null>(null);
  const isTestModeRef = useRef(false);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { userRef.current = user; if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); }, [user]);
  useEffect(() => { isTestModeRef.current = isTestMode; }, [isTestMode]);

  const handleSync = useCallback(async (forced = false) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    try {
      const payload: SyncPayload = { 
        userId: currentUser.id, 
        location: userLocationRef.current, 
        stats: { 
          nickname: currentUser.nickname, color: currentUser.color, 
          xp: currentUser.xp, level: currentUser.level, 
          totalAreaM2: currentUser.totalAreaM2, cellsOwned: currentUser.cellsOwned 
        } 
      };
      const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data: SyncResponse = await res.json();
      if (res.ok) {
        setCells(data.cells);
        const usersMap: Record<string, PublicUser> = {};
        data.users.forEach(u => usersMap[u.id] = u);
        setUsers(usersMap);
      }
    } catch (e) { console.error("[SYNC ERROR]", e); }
  }, []);

  const handleCapture = useCallback((enclosedIds: string[], polygon: Point[], loc: Point) => {
    const u = userRef.current;
    if (!u || !enclosedIds.length) return;

    const newCellsMap: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      newCellsMap[id] = { id, ownerId: u.id, ownerNickname: u.nickname, ownerColor: u.color, updatedAt: Date.now(), defense: 1 };
    });

    setCells(prev => ({ ...prev, ...newCellsMap }));
    
    setTerritoryShapes(prev => [
      ...prev,
      { id: `t_${Date.now()}`, ownerId: u.id, ownerColor: u.color, polygon }
    ]);

    playVictorySound();
    
    setUser(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        cellsOwned: prev.cellsOwned + enclosedIds.length, 
        totalAreaM2: prev.totalAreaM2 + (enclosedIds.length * CELL_AREA_M2) 
      };
    });

    setCurrentActivity(prev => {
      if (!prev) return null;
      // Adiciona a localização atual ao rastro completo
      const nextFull = [...prev.fullPath, loc];
      // Reinicia o índice do segmento para o final do rastro atual
      return { 
        ...prev, 
        capturedCellIds: new Set([...Array.from(prev.capturedCellIds), ...enclosedIds]), 
        fullPath: nextFull, 
        segmentStartIndex: nextFull.length - 1, 
        points: [loc] // Reset do rastro simplificado para o novo segmento
      };
    });
    setTimeout(() => handleSync(true), 100);
  }, [handleSync]);

  const handleNewLocation = useCallback((pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestModeRef.current);
    if (!processed) return;
    
    setUserLocation(processed);

    if (introMode) {
      setTimeout(() => setIntroMode(false), 300);
    }
    
    const currentAct = activityRef.current;
    if (currentAct && !isProcessingRef.current) {
      const fullPath = currentAct.fullPath;
      const segmentPath = fullPath.slice(currentAct.segmentStartIndex);
      const lastPoint = fullPath.length > 0 ? fullPath[fullPath.length - 1] : null;
      const dist = lastPoint ? calculateDistance(lastPoint, processed) : 0;
      
      const threshold = (force || isTestModeRef.current) ? 0.01 : MIN_MOVE_DISTANCE;

      if (dist >= threshold || fullPath.length === 0) {
        isProcessingRef.current = true;
        
        // Detecção de loop baseada APENAS no segmento ativo desde a última captura
        const loop = detectClosedLoop(segmentPath, processed);
        
        if (loop && loop.enclosedCellIds.length > 0) {
          handleCapture(loop.enclosedCellIds, loop.polygon, loop.closurePoint);
        } else {
          setCurrentActivity(prev => {
            if (!prev) return null;
            const nextFull = [...prev.fullPath, processed];
            const nextSegment = nextFull.slice(prev.segmentStartIndex);
            const simplified = simplifyPath(nextSegment, RDP_EPSILON);
            return { 
              ...prev, 
              fullPath: nextFull, 
              points: simplified, 
              distanceMeters: prev.distanceMeters + dist 
            };
          });
        }
        isProcessingRef.current = false;
      }
    }
  }, [handleCapture, introMode]);

  const handleNewLocationRef = useRef(handleNewLocation);
  useEffect(() => { handleNewLocationRef.current = handleNewLocation; }, [handleNewLocation]);

  useEffect(() => {
    if (!isTestMode) return;
    const heartbeat = setInterval(() => {
      const target = autopilotTargetRef.current;
      const currentPos = userLocationRef.current;
      if (!target || !currentPos) return;

      const dist = calculateDistance(currentPos, target);
      if (dist < 2.0) {
        autopilotTargetRef.current = null;
        setAutopilotEnabled(false);
        return;
      }

      const metersPerTick = SIMULATION_SPEED_MPS * (SIMULATION_TICK_MS / 1000);
      const nextPoint = moveTowards(currentPos, target, metersPerTick);
      handleNewLocationRef.current(nextPoint, true);
    }, SIMULATION_TICK_MS);

    return () => clearInterval(heartbeat);
  }, [isTestMode]);

  useEffect(() => {
    if (!isTestMode && user) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => handleNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp }, false),
        null, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isTestMode, user, handleNewLocation]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!isTestModeRef.current) return;
    const clickPoint: Point = { lat, lng, accuracy: 5, timestamp: Date.now() };

    if (!userLocationRef.current) {
      handleNewLocationRef.current(clickPoint, true);
    } else {
      autopilotTargetRef.current = clickPoint;
      setAutopilotEnabled(true);
    }
  }, []);

  return (
    <div className="h-full w-full bg-black overflow-hidden relative">
      <IntroOverlay isVisible={introMode} />
      
      <GameMap 
        userLocation={userLocation} 
        cells={cells} 
        territoryShapes={territoryShapes}
        users={users} 
        activeUserId={user?.id || ''} 
        activeUser={user} 
        currentPath={currentActivity?.fullPath || []} 
        onMapClick={handleMapClick} 
        introMode={introMode}
      />
      
      {!introMode && view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-10 p-6 flex flex-col gap-4 pointer-events-none z-[1000] animate-in slide-in-from-bottom-10 duration-700">
          <div className="bg-black/90 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 flex justify-between items-center pointer-events-auto shadow-2xl">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center font-black italic border border-blue-500/30 text-blue-500 text-xl uppercase">{user.nickname[0]}</div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/90">{user.nickname}</div>
                <div className="text-[10px] text-blue-500 font-bold tracking-widest mt-0.5 uppercase">NÍVEL {user.level}</div>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"><div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div></button>
          </div>
          <button onClick={() => { if (!userLocationRef.current) return alert("Aguardando sinal..."); setCurrentActivity({ id: `a_${Date.now()}`, startTime: Date.now(), points: [userLocationRef.current], fullPath: [userLocationRef.current], segmentStartIndex: 0, capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); setView(AppState.ACTIVE); }} className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-xl pointer-events-auto active:scale-95 transition-all border-b-[6px] border-blue-800 text-white">INICIAR DOMÍNIO</button>
        </div>
      )}
      {view === AppState.ACTIVE && currentActivity && user && <ActivityOverlay activity={currentActivity} user={user} onStop={() => setView(AppState.SUMMARY)} />}
      {view === AppState.SUMMARY && currentActivity && user && <MissionSummary activity={currentActivity} user={user} onFinish={() => { const capturedCount = currentActivity.capturedCellIds.size; const xpGained = calculateSessionXp(currentActivity.distanceMeters, capturedCount); const updated = { ...user, xp: (user.xp || 0) + xpGained, level: calculateLevelFromXp((user.xp || 0) + xpGained), cellsOwned: (user.cellsOwned || 0) + capturedCount, totalAreaM2: (user.totalAreaM2 || 0) + (capturedCount * CELL_AREA_M2) }; setUser(updated); setCurrentActivity(null); handleSync(true); setView(AppState.HOME); }} />}
      {view === AppState.LEADERBOARD && <Leaderboard entries={(Object.values(users) as PublicUser[]).map(u => ({ id: u.id, nickname: u.nickname, totalAreaM2: u.totalAreaM2, level: u.level, color: u.color, avatarUrl: u.avatarUrl }))} currentUserId={user?.id || ''} onBack={() => setView(AppState.HOME)} />}
      
      <TestSimulator 
        isEnabled={isTestMode} 
        onToggle={(active) => { setIsTestMode(active); if(!active) { setAutopilotEnabled(false); autopilotTargetRef.current = null; } }} 
        onLocationUpdate={handleNewLocation} 
        userLocation={userLocation} 
        showOverlay={!introMode} 
        autopilotEnabled={autopilotEnabled} 
        onAutopilotToggle={(active) => { setAutopilotEnabled(active); if (!active) autopilotTargetRef.current = null; }} 
      />
    </div>
  );
};

export default App;