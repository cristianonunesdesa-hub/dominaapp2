
// Arquivo: App.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState, PublicUser, SyncPayload, SyncResponse } from './types';
import { calculateDistance, simplifyPath } from './core/geo';
import { detectClosedLoop } from './core/territory';
import { processLocation } from './core/gps';
import { MIN_MOVE_DISTANCE, RDP_EPSILON, CELL_AREA_M2 } from './constants';
import { calculateSessionXp, calculateLevelFromXp } from './core/xp';

import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import Leaderboard from './components/Leaderboard';
import MissionSummary from './components/MissionSummary';
import Login from './components/Login';
import TestSimulator from './components/TestSimulator';
import { playVictorySound } from './utils/audio';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, PublicUser>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const isTestModeRef = useRef(isTestMode);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { isTestModeRef.current = isTestMode; }, [isTestMode]);

  const [testAutopilot, setTestAutopilot] = useState(false);
  const testTargetRef = useRef<Point | null>(null);
  const testTimerRef = useRef<number | null>(null);

  const handleNewLocation = useCallback((pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestModeRef.current);
    if (processed) setUserLocation(processed);
  }, []);

  const startTestAutopilot = useCallback(() => {
    // Se já estiver rodando, apenas garante o estado visual
    setTestAutopilot(true);
    if (testTimerRef.current !== null) return;
    
    testTimerRef.current = window.setInterval(() => {
      const cur = userLocationRef.current;
      const tgt = testTargetRef.current;
      if (!cur || !tgt) return;
      
      const dist = calculateDistance(cur, tgt);
      // Se chegou muito perto, para o movimento desse alvo
      if (dist < 1.5) {
        testTargetRef.current = null;
        return;
      }

      const speedMps = 3.5; // Velocidade de teste levemente aumentada
      const dtMs = 200;
      const stepMeters = speedMps * (dtMs / 1000);
      const metersPerDegLat = 111_320;
      const metersPerDegLng = 111_320 * Math.cos((cur.lat * Math.PI) / 180);
      
      const dx = (tgt.lng - cur.lng) * metersPerDegLng;
      const dy = (tgt.lat - cur.lat) * metersPerDegLat;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const ux = dx / len;
      const uy = dy / len;
      
      const next: Point = {
        lat: cur.lat + (uy * stepMeters / metersPerDegLat),
        lng: cur.lng + (ux * stepMeters / metersPerDegLng),
        timestamp: Date.now(),
        accuracy: 5
      };
      
      handleNewLocation(next, true);
    }, 200);
  }, [handleNewLocation]);

  const stopTestAutopilot = useCallback(() => {
    setTestAutopilot(false);
    testTargetRef.current = null;
    if (testTimerRef.current !== null) {
      clearInterval(testTimerRef.current);
      testTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isTestMode) stopTestAutopilot();
    return () => stopTestAutopilot();
  }, [isTestMode, stopTestAutopilot]);

  useEffect(() => {
    if (!user || view === AppState.LOGIN || isTestMode) return;
    if (!('geolocation' in navigator)) return;

    let watchId: number | null = null;
    navigator.geolocation.getCurrentPosition(
      (pos) => handleNewLocation({
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, timestamp: pos.timestamp || Date.now()
      }),
      null, { enableHighAccuracy: true, timeout: 10000 }
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => handleNewLocation({
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, timestamp: pos.timestamp || Date.now()
      }),
      null, { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [user, view, isTestMode, handleNewLocation]);

  const handleCapture = useCallback(async (enclosedIds: string[], loc: Point) => {
    if (!user) return;

    const newCellsDict: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      newCellsDict[id] = {
        id, ownerId: user.id, ownerNickname: user.nickname, ownerColor: user.color,
        updatedAt: Date.now(), defense: 1
      };
    });

    setCells(prev => ({ ...prev, ...newCellsDict }));
    playVictorySound();

    const syncCellsPayload = enclosedIds.map(id => ({ id, ownerId: user.id, ownerNickname: user.nickname }));
    
    const gainedArea = enclosedIds.length * CELL_AREA_M2;
    const newStats = {
      ...user,
      cellsOwned: (user.cellsOwned || 0) + enclosedIds.length,
      totalAreaM2: (user.totalAreaM2 || 0) + gainedArea
    };

    const payload: SyncPayload = {
      userId: user.id,
      location: userLocationRef.current,
      newCells: syncCellsPayload,
      stats: {
        nickname: newStats.nickname,
        color: newStats.color,
        xp: newStats.xp,
        level: newStats.level,
        totalAreaM2: newStats.totalAreaM2,
        cellsOwned: newStats.cellsOwned
      }
    };

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.sessionToken}` 
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        if (res.status === 401) setView(AppState.LOGIN);
        throw new Error("Sync capture failed");
      }
      setUser(newStats);
    } catch (err) {
      console.error("Critical Sync error during capture:", err);
    }

    setCurrentActivity(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fullPath: [loc],
        points: [loc],
        capturedCellIds: new Set([...Array.from(prev.capturedCellIds), ...enclosedIds])
      };
    });
  }, [user]);

  useEffect(() => {
    if (view !== AppState.ACTIVE || !userLocation || !currentActivity || isProcessing) return;
    const path = currentActivity.fullPath;
    const lastPoint = path.length > 0 ? path[path.length - 1] : null;
    const dist = lastPoint ? calculateDistance(lastPoint, userLocation) : Infinity;
    const triggerDist = isTestMode ? 0.5 : MIN_MOVE_DISTANCE;

    if (dist >= triggerDist || path.length === 0) {
      setIsProcessing(true);
      const loop = detectClosedLoop(path, userLocation);
      if (loop) {
        handleCapture(loop.enclosedCellIds, loop.closurePoint);
      } else {
        setCurrentActivity(prev => {
          if (!prev) return null;
          const newFullPath = [...prev.fullPath, userLocation];
          return {
            ...prev,
            fullPath: newFullPath,
            points: simplifyPath(newFullPath, RDP_EPSILON),
            distanceMeters: prev.distanceMeters + (lastPoint ? dist : 0),
          };
        });
      }
      setTimeout(() => setIsProcessing(false), 30);
    }
  }, [userLocation, view, isProcessing, isTestMode, currentActivity, handleCapture]);

  useEffect(() => {
    if (!user || view === AppState.LOGIN) return;
    let stopped = false;
    
    const poll = async () => {
      try {
        if (!user || stopped) return;
        
        const payload: SyncPayload = {
          userId: user.id,
          location: userLocationRef.current,
        };

        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.sessionToken}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          if (res.status === 401) setView(AppState.LOGIN);
          return;
        }
        const data: SyncResponse = await res.json();
        
        if (stopped) return;
        
        if (data.cells) setCells(data.cells);
        
        if (Array.isArray(data.users)) {
          const usersMap: Record<string, PublicUser> = {};
          data.users.forEach((u) => {
            usersMap[u.id] = {
              id: u.id, nickname: u.nickname, color: u.color, avatarUrl: u.avatarUrl,
              xp: u.xp, level: u.level, totalAreaM2: u.totalAreaM2,
              cellsOwned: u.cellsOwned,
              lat: u.lat, lng: u.lng
            };
          });
          setGlobalUsers(usersMap);
        }
      } catch (err) {
        console.warn("Polling silent fail:", err);
      }
    };

    poll();
    const interval = setInterval(() => { if (!stopped) poll(); }, 2500);
    return () => { stopped = true; clearInterval(interval); };
  }, [view, user?.id, user?.sessionToken]);

  const startActivity = () => {
    setCurrentActivity({
      id: `a_${Date.now()}`, startTime: Date.now(), points: [], fullPath: [],
      capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0,
      isValid: true, strategicZonesEntered: 0
    });
    setView(AppState.ACTIVE);
  };

  const stopActivity = () => {
    setCurrentActivity(prev => prev ? ({ ...prev, endTime: Date.now() }) : prev);
    setView(AppState.SUMMARY);
  };

  const finishMission = async () => {
    if (!user || !currentActivity) { setView(AppState.HOME); return; }
    
    const capturedCount = currentActivity.capturedCellIds.size;
    const gainedArea = capturedCount * CELL_AREA_M2;
    const gainedXp = calculateSessionXp(currentActivity.distanceMeters, capturedCount);
    
    const newXp = (user.xp ?? 0) + gainedXp;
    const newLevel = calculateLevelFromXp(newXp);
    const newTotalArea = (user.totalAreaM2 ?? 0) + gainedArea;
    const newCellsOwned = (user.cellsOwned ?? 0) + capturedCount;

    const updatedUser: User = {
      ...user, xp: newXp, level: newLevel, totalAreaM2: newTotalArea, cellsOwned: newCellsOwned
    };

    const payload: SyncPayload = {
      userId: user.id,
      location: userLocationRef.current,
      stats: {
        nickname: user.nickname, color: user.color,
        xp: newXp, level: newLevel, totalAreaM2: newTotalArea, cellsOwned: newCellsOwned
      }
    };

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.sessionToken}`
        },
        body: JSON.stringify(payload)
      });
      setUser(updatedUser);
    } catch (err) {
      console.error("Final mission sync failed:", err);
    }
    
    setView(AppState.HOME);
  };

  return (
    <div className="h-full w-full bg-black overflow-hidden relative font-sans">
      <GameMap
        userLocation={userLocation} cells={cells} users={globalUsers}
        activeUserId={user?.id || ''} activeUser={user}
        currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []}
        onMapClick={(lat, lng) => {
          if (!isTestModeRef.current) return;
          
          if (!userLocationRef.current) {
            handleNewLocation({ lat, lng, timestamp: Date.now(), accuracy: 5 }, true);
          } else {
            testTargetRef.current = { lat, lng, timestamp: Date.now(), accuracy: 5 };
            // Inicia o piloto automático automaticamente ao clicar
            startTestAutopilot();
          }
        }}
      />
      {view === AppState.LOGIN && <Login onLoginSuccess={(u) => { setUser(u); setView(AppState.HOME); }} />}
      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-10 p-6 flex flex-col gap-4 pointer-events-none z-[1000]">
          <div className="bg-black/90 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 flex justify-between items-center pointer-events-auto shadow-2xl">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center font-black italic border border-blue-500/30 text-blue-500 text-xl shadow-inner">{user.nickname[0]}</div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/90">{user.nickname}</div>
                <div className="text-[10px] text-blue-500 font-bold tracking-widest mt-0.5">AGENTE NÍVEL {user.level}</div>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all pointer-events-auto">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
            </button>
          </div>
          <button onClick={startActivity} className="w-full bg-blue-600 hover:bg-blue-500 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-[0_20px_50px_rgba(37,99,235,0.3)] pointer-events-auto active:scale-95 transition-all border-b-[6px] border-blue-800 text-white">INICIAR DOMÍNIO</button>
        </div>
      )}
      {view === AppState.ACTIVE && currentActivity && <ActivityOverlay activity={currentActivity} user={user} onStop={stopActivity} />}
      {view === AppState.SUMMARY && currentActivity && user && <MissionSummary activity={currentActivity} user={user} onFinish={finishMission} />}
      {/* Explicitly cast each user to PublicUser to resolve 'unknown' type inference in the map callback */}
      {view === AppState.LEADERBOARD && <Leaderboard entries={Object.values(globalUsers).map((u: PublicUser) => ({ id: u.id, nickname: u.nickname, totalAreaM2: u.totalAreaM2, level: u.level, color: u.color, avatarUrl: u.avatarUrl }))} currentUserId={user?.id || ''} onBack={() => setView(AppState.HOME)} />}
      <TestSimulator isEnabled={isTestMode} onToggle={setIsTestMode} onLocationUpdate={handleNewLocation} userLocation={userLocation} showOverlay={view !== AppState.LOGIN} autopilotEnabled={testAutopilot} onAutopilotToggle={(active) => active ? startTestAutopilot() : stopTestAutopilot()} />
    </div>
  );
};

export default App;
