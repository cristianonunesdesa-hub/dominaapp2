// Arquivo: App.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState, PublicUser, SyncPayload, SyncResponse } from './types';
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
import { playVictorySound } from './utils/audio';

const AUTOPILOT_TICK_MS = 250;
const AUTOPILOT_SPEED_MPS = 2.2; 
const AUTOPILOT_STOP_DIST_M = 2.0;
const STORAGE_KEY = 'domina_user_profile';

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
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao carregar perfil salvo", e);
    }
  }
  const newUser = generateDefaultUser();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
};

function moveTowardsMeters(from: Point, to: Point, stepMeters: number): Point {
  const R = 6371e3;
  const lat1 = (from.lat * Math.PI) / 180;
  const lon1 = (from.lng * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const lon2 = (to.lng * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (dist === 0) return { ...from, timestamp: Date.now() };
  if (stepMeters >= dist) return { ...to, timestamp: Date.now() };
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  const angDist = stepMeters / R;
  const lat3 = Math.asin(Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng));
  const lon3 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1), Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat3));
  return { lat: (lat3 * 180) / Math.PI, lng: ((lon3 * 180) / Math.PI + 540) % 360 - 180, timestamp: Date.now(), accuracy: 5 };
}

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.HOME);
  const [user, setUser] = useState<User | null>(getInitialUser());
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [users, setUsers] = useState<Record<string, PublicUser>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autopilotTarget, setAutopilotTarget] = useState<Point | null>(null);

  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const userRef = useRef<User | null>(user);
  const isProcessingRef = useRef(false);
  const lastSyncRef = useRef<number>(0);
  const geoWatchIdRef = useRef<number | null>(null);

  const localCapturedCellsRef = useRef<Record<string, Cell>>({});
  const pendingSyncCellsRef = useRef<{id: string, ownerId: string, ownerNickname: string, ownerColor: string}[]>([]);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { 
    userRef.current = user;
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  const handleSync = useCallback(async (forced = false) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const now = Date.now();
    if (!forced && now - lastSyncRef.current < 2500) return;
    lastSyncRef.current = now;

    try {
      const currentLoc = userLocationRef.current;
      const newCellsPayload = [...pendingSyncCellsRef.current];
      
      const payload: SyncPayload = { 
        userId: currentUser.id, 
        location: currentLoc, 
        stats: { 
          nickname: currentUser.nickname, 
          color: currentUser.color, 
          xp: currentUser.xp, 
          level: currentUser.level, 
          totalAreaM2: currentUser.totalAreaM2, 
          cellsOwned: currentUser.cellsOwned 
        },
        newCells: newCellsPayload.length > 0 ? newCellsPayload : undefined
      };
      
      const res = await fetch('/api/sync', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      
      const data: SyncResponse = await res.json();

      if (res.ok) {
        if (newCellsPayload.length > 0) {
          newCellsPayload.forEach((pc) => {
            delete localCapturedCellsRef.current[pc.id];
            pendingSyncCellsRef.current = pendingSyncCellsRef.current.filter(item => item.id !== pc.id);
          });
        }

        setCells(prev => {
          const merged: Record<string, Cell> = { ...data.cells };
          (Object.values(localCapturedCellsRef.current) as Cell[]).forEach((cell) => {
            merged[cell.id] = cell;
          });
          return merged;
        });
        
        const usersMap: Record<string, PublicUser> = {};
        data.users.forEach((u: PublicUser) => usersMap[u.id] = u);
        setUsers(usersMap);
      }
    } catch (e) { console.error("[SYNC FATAL ERROR]", e); }
  }, []);

  const handleCapture = useCallback((enclosedIds: string[], loc: Point) => {
    const u = userRef.current;
    if (!u || !enclosedIds.length) return;

    console.log("[CAPTURE] enclosed=", enclosedIds.length);
    
    // 1. Criar novo dataset local
    const newCellsMap: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      const cellData: Cell = { 
        id, ownerId: u.id, ownerNickname: u.nickname, ownerColor: u.color, 
        updatedAt: Date.now(), defense: 1 
      };
      newCellsMap[id] = cellData;
      localCapturedCellsRef.current[id] = cellData;
      pendingSyncCellsRef.current.push({ 
        id, ownerId: u.id, ownerNickname: u.nickname, ownerColor: u.color 
      });
    });

    console.log("[CAPTURE] newCells created in memory:", Object.keys(newCellsMap).length);

    // 2. Pintura Instantânea (Update State)
    setCells(prev => {
      const merged = { ...prev, ...newCellsMap };
      console.log("[CELLS STATE AFTER CAPTURE]", Object.keys(merged).length);
      return merged;
    });

    // 3. Efeitos secundários
    playVictorySound();
    
    setUser(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        cellsOwned: prev.cellsOwned + enclosedIds.length, 
        totalAreaM2: prev.totalAreaM2 + (enclosedIds.length * CELL_AREA_M2) 
      };
    });

    // 4. Reset do rastro
    setCurrentActivity(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        capturedCellIds: new Set([...Array.from(prev.capturedCellIds), ...enclosedIds]), 
        fullPath: [loc], 
        points: [loc] 
      };
    });

    // 5. Persistência imediata
    setTimeout(() => handleSync(true), 100);
  }, [handleSync]);

  const handleNewLocation = useCallback((pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestMode);
    if (!processed) return;
    setUserLocation(processed);
    const currentActivityRef = activityRef.current;
    if (currentActivityRef && !isProcessingRef.current) {
      const path = currentActivityRef.fullPath;
      const lastPoint = path.length > 0 ? path[path.length - 1] : null;
      const dist = lastPoint ? calculateDistance(lastPoint, processed) : 0;
      const triggerDist = (force || isTestMode) ? 0.5 : MIN_MOVE_DISTANCE;
      if (dist >= triggerDist || path.length === 0) {
        isProcessingRef.current = true;
        const loop = detectClosedLoop(path, processed);
        if (loop && loop.enclosedCellIds.length > 0) {
          handleCapture(loop.enclosedCellIds, loop.closurePoint);
        } else {
          setCurrentActivity(prev => {
            if (!prev) return null;
            const nextFull = [...prev.fullPath, processed];
            return { ...prev, fullPath: nextFull, points: simplifyPath(nextFull, RDP_EPSILON), distanceMeters: prev.distanceMeters + dist };
          });
        }
        isProcessingRef.current = false;
      }
    }
  }, [isTestMode, handleCapture]);

  const stopGeolocation = useCallback(() => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  }, []);

  const startGeolocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => handleNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp }, false),
      null, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handleNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp }, false),
      null, { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  }, [handleNewLocation]);

  useEffect(() => {
    if (user && !isTestMode) startGeolocation();
    else stopGeolocation();
    return () => stopGeolocation();
  }, [user, isTestMode, startGeolocation, stopGeolocation]);

  useEffect(() => {
    const timer = setInterval(() => handleSync(), 3000);
    return () => clearInterval(timer);
  }, [handleSync]);

  useEffect(() => {
    if (!isTestMode || !autopilotEnabled || !autopilotTarget) return;
    const interval = setInterval(() => {
      const from = userLocationRef.current;
      if (!from) return;
      const dist = calculateDistance(from, autopilotTarget);
      if (dist <= AUTOPILOT_STOP_DIST_M) {
        setAutopilotEnabled(false); setAutopilotTarget(null); return;
      }
      handleNewLocation(moveTowardsMeters(from, autopilotTarget, AUTOPILOT_SPEED_MPS * (AUTOPILOT_TICK_MS / 1000)), true);
    }, AUTOPILOT_TICK_MS);
    return () => clearInterval(interval);
  }, [isTestMode, autopilotEnabled, autopilotTarget, handleNewLocation]);

  return (
    <div className="h-full w-full bg-black overflow-hidden relative">
      <GameMap userLocation={userLocation} cells={cells} users={users} activeUserId={user?.id || ''} activeUser={user} currentPath={currentActivity?.fullPath || []} onMapClick={(lat, lng) => { if (!isTestMode) return; const pt = { lat, lng, accuracy: 5, timestamp: Date.now() }; if (!userLocationRef.current) handleNewLocation(pt, true); else { setAutopilotTarget(pt); setAutopilotEnabled(true); } }} />
      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-10 p-6 flex flex-col gap-4 pointer-events-none z-[1000]">
          <div className="bg-black/90 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 flex justify-between items-center pointer-events-auto shadow-2xl">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center font-black italic border border-blue-500/30 text-blue-500 text-xl shadow-inner uppercase">{user.nickname[0]}</div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/90">{user.nickname}</div>
                <div className="text-[10px] text-blue-500 font-bold tracking-widest mt-0.5 uppercase">AGENTE NÍVEL {user.level}</div>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"><div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div></button>
          </div>
          <button onClick={() => { if (!userLocationRef.current) return alert("Aguardando sinal GPS..."); setCurrentActivity({ id: `a_${Date.now()}`, startTime: Date.now(), points: [userLocationRef.current], fullPath: [userLocationRef.current], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); setView(AppState.ACTIVE); }} className="w-full bg-blue-600 hover:bg-blue-500 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-[0_20px_50px_rgba(37,99,235,0.3)] pointer-events-auto active:scale-95 transition-all border-b-[6px] border-blue-800 text-white">INICIAR DOMÍNIO</button>
        </div>
      )}
      {view === AppState.ACTIVE && currentActivity && user && <ActivityOverlay activity={currentActivity} user={user} onStop={() => setView(AppState.SUMMARY)} />}
      {view === AppState.SUMMARY && currentActivity && user && <MissionSummary activity={currentActivity} user={user} onFinish={() => { const capturedCount = currentActivity.capturedCellIds.size; const xpGained = calculateSessionXp(currentActivity.distanceMeters, capturedCount); const updated = { ...user, xp: (user.xp || 0) + xpGained, level: calculateLevelFromXp((user.xp || 0) + xpGained), cellsOwned: (user.cellsOwned || 0) + capturedCount, totalAreaM2: (user.totalAreaM2 || 0) + (capturedCount * CELL_AREA_M2) }; setUser(updated); setCurrentActivity(null); handleSync(true); setView(AppState.HOME); }} />}
      {view === AppState.LEADERBOARD && <Leaderboard entries={(Object.values(users) as PublicUser[]).map(u => ({ id: u.id, nickname: u.nickname, totalAreaM2: u.totalAreaM2, level: u.level, color: u.color, avatarUrl: u.avatarUrl }))} currentUserId={user?.id || ''} onBack={() => setView(AppState.HOME)} />}
      <TestSimulator isEnabled={isTestMode} onToggle={setIsTestMode} onLocationUpdate={handleNewLocation} userLocation={userLocation} showOverlay={true} autopilotEnabled={autopilotEnabled} onAutopilotToggle={setAutopilotEnabled} />
    </div>
  );
};

export default App;
