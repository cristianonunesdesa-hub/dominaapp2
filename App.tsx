// Arquivo: App.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
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
  const [globalUsers, setGlobalUsers] = useState<Record<string, User>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { userRef.current = user; }, [user]);

  // ==========================
  // TEST MODE: AUTO WALK
  // ==========================
  const [testAutopilot, setTestAutopilot] = useState(false);
  const testTargetRef = useRef<Point | null>(null);
  const testTimerRef = useRef<number | null>(null);

  const handleNewLocation = useCallback((pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestMode);
    if (processed) setUserLocation(processed);
  }, [isTestMode]);

  const startTestAutopilot = useCallback(() => {
    if (testTimerRef.current !== null) return;

    setTestAutopilot(true);

    testTimerRef.current = window.setInterval(() => {
      const cur = userLocationRef.current;
      const tgt = testTargetRef.current;
      if (!cur || !tgt) return;

      const dist = calculateDistance(cur, tgt);

      // Chegou
      if (dist < 2) {
        testTargetRef.current = null;
        return;
      }

      // Velocidade (m/s): 1.4 walk | 2.2 brisk | 3.5 run
      const speedMps = 2.2;

      // Tick do intervalo (ms)
      const dtMs = 250;

      // passo em metros
      const stepMeters = speedMps * (dtMs / 1000);

      // Aproximação metros/degree (ok para distâncias pequenas)
      const metersPerDegLat = 111_320;
      const metersPerDegLng = 111_320 * Math.cos((cur.lat * Math.PI) / 180);

      const dx = (tgt.lng - cur.lng) * metersPerDegLng; // metros
      const dy = (tgt.lat - cur.lat) * metersPerDegLat; // metros

      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      const ux = dx / len;
      const uy = dy / len;

      const moveX = ux * stepMeters;
      const moveY = uy * stepMeters;

      const next: Point = {
        lat: cur.lat + (moveY / metersPerDegLat),
        lng: cur.lng + (moveX / metersPerDegLng),
        timestamp: Date.now(),
        accuracy: 5
      };

      // força o update para ficar responsivo e bypass filtros
      handleNewLocation(next, true);
    }, 250);
  }, [handleNewLocation]);

  const stopTestAutopilot = useCallback(() => {
    setTestAutopilot(false);
    testTargetRef.current = null;

    if (testTimerRef.current !== null) {
      clearInterval(testTimerRef.current);
      testTimerRef.current = null;
    }
  }, []);

  // Cleanup do autopilot ao sair do modo teste / desmontar
  useEffect(() => {
    if (!isTestMode) stopTestAutopilot();
    return () => stopTestAutopilot();
  }, [isTestMode, stopTestAutopilot]);

  // ==========================
  // GPS REAL
  // ==========================
  useEffect(() => {
    if (!user) return;
    if (view === AppState.LOGIN) return;
    if (isTestMode) return;

    if (!('geolocation' in navigator)) {
      console.error("Geolocation não suportado neste dispositivo/navegador.");
      return;
    }

    let watchId: number | null = null;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleNewLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now()
        }, false);
      },
      (err) => {
        console.error("Erro ao obter localização inicial:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000
      }
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        handleNewLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now()
        }, false);
      },
      (err) => {
        console.error("Erro no watchPosition:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000
      }
    );

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, view, isTestMode, handleNewLocation]);

  // ==========================
  // Capture
  // ==========================
  const handleCapture = useCallback((enclosedIds: string[], loc: Point) => {
    const u = userRef.current;
    if (!u) return;

    const newCells: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      newCells[id] = {
        id,
        ownerId: u.id,
        ownerNickname: u.nickname,
        ownerColor: u.color,
        bounds: [0, 0, 0, 0],
        updatedAt: Date.now(),
        defense: 1
      };
    });

    setCells(prev => ({ ...prev, ...newCells }));
    playVictorySound();

    const syncData = enclosedIds.map(id => ({ id, ownerId: u.id, ownerNickname: u.nickname }));
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: u.id,
        location: userLocationRef.current,
        newCells: syncData
      })
    }).catch(err => console.error("Sync error:", err));

    setCurrentActivity(prev => {
      if (!prev) return null;
      return {
        ...prev,
        fullPath: [loc],
        points: [loc],
        capturedCellIds: new Set([...Array.from(prev.capturedCellIds), ...enclosedIds])
      };
    });
  }, []);

  // ==========================
  // Engine
  // ==========================
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

  // ==========================
  // Inicializador snapshot HOME
  // ==========================
  useEffect(() => {
    if (user && view === AppState.HOME) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
        .then(r => r.json())
        .then(data => {
          if (data.cells) setCells(data.cells);
          if (Array.isArray(data.users)) {
            const usersMap: Record<string, User> = {};
            data.users.forEach((u: any) => {
              usersMap[u.id] = {
                id: u.id,
                nickname: u.nickname,
                color: u.color,
                avatarUrl: u.avatarUrl,
                xp: u.xp ?? 0,
                level: u.level ?? 1,
                totalAreaM2: u.totalAreaM2 ?? 0,
                cellsOwned: u.cellsOwned ?? 0,
                badges: [],
                dailyStreak: 0,
                lat: u.lat,
                lng: u.lng
              };
            });
            setGlobalUsers(usersMap);
          }
        })
        .catch(err => console.error("Initial sync error:", err));
    }
  }, [user, view]);

  // ==========================
  // POLLING GLOBAL (tempo real)
  // ==========================
  useEffect(() => {
    if (!user) return;
    if (view === AppState.LOGIN) return;

    let stopped = false;

    const poll = async () => {
      try {
        const u = userRef.current;
        if (!u) return;

        const payload = {
          userId: u.id,
          location: userLocationRef.current,
          stats: {
            xp: u.xp ?? 0,
            level: u.level ?? 1,
            totalAreaM2: u.totalAreaM2 ?? 0,
            cellsOwned: u.cellsOwned ?? 0
          }
        };

        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) return;

        const data = await res.json();
        if (stopped) return;

        if (data.cells) setCells(data.cells);

        if (Array.isArray(data.users)) {
          const usersMap: Record<string, User> = {};
          data.users.forEach((srv: any) => {
            usersMap[srv.id] = {
              id: srv.id,
              nickname: srv.nickname,
              color: srv.color,
              avatarUrl: srv.avatarUrl,
              xp: srv.xp ?? 0,
              level: srv.level ?? 1,
              totalAreaM2: srv.totalAreaM2 ?? 0,
              cellsOwned: srv.cellsOwned ?? 0,
              badges: [],
              dailyStreak: 0,
              lat: srv.lat,
              lng: srv.lng
            };
          });
          setGlobalUsers(usersMap);
        }
      } catch {
        // silencioso
      }
    };

    poll();

    const interval = setInterval(() => {
      if (!stopped) poll();
    }, 2500);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [view, user]);

  // ==========================
  // Activity flow
  // ==========================
  const startActivity = () => {
    setCurrentActivity({
      id: `a_${Date.now()}`,
      startTime: Date.now(),
      endTime: undefined,
      points: [],
      fullPath: [],
      capturedCellIds: new Set(),
      stolenCellIds: new Set(),
      distanceMeters: 0,
      isValid: true,
      strategicZonesEntered: 0
    });
    setView(AppState.ACTIVE);
  };

  const stopActivity = () => {
    setCurrentActivity(prev => prev ? ({ ...prev, endTime: Date.now() }) : prev);
    setView(AppState.SUMMARY);
  };

  const finishMission = () => {
    const u = userRef.current;
    const a = activityRef.current;
    if (!u || !a) {
      setView(AppState.HOME);
      return;
    }

    const capturedCount = a.capturedCellIds.size;
    const gainedArea = capturedCount * CELL_AREA_M2;

    const gainedXp = calculateSessionXp(a.distanceMeters, capturedCount);
    const newXp = (u.xp ?? 0) + gainedXp;
    const newLevel = calculateLevelFromXp(newXp);

    const newTotalArea = (u.totalAreaM2 ?? 0) + gainedArea;
    const newCellsOwned = (u.cellsOwned ?? 0) + capturedCount;

    const updatedUser: User = {
      ...u,
      xp: newXp,
      level: newLevel,
      totalAreaM2: newTotalArea,
      cellsOwned: newCellsOwned
    };
    setUser(updatedUser);

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: u.id,
        location: userLocationRef.current,
        stats: {
          xp: newXp,
          level: newLevel,
          totalAreaM2: newTotalArea,
          cellsOwned: newCellsOwned
        }
      })
    }).catch(err => console.error("Final stats sync error:", err));

    setView(AppState.HOME);
  };

  return (
    <div className="h-full w-full bg-black overflow-hidden relative font-sans">
      <GameMap
        userLocation={userLocation}
        cells={cells}
        users={globalUsers}
        activeUserId={user?.id || ''}
        activeUser={user}
        currentPath={currentActivity?.fullPath || []}
        activeTrail={currentActivity?.points || []}
        onMapClick={(lat, lng) => {
          if (!isTestMode) return;

          // Se não existe posição ainda, faz spawn onde clicou
          if (!userLocationRef.current) {
            handleNewLocation({ lat, lng, timestamp: Date.now(), accuracy: 5 }, true);
            return;
          }

          // Define destino e liga autopilot
          testTargetRef.current = { lat, lng, timestamp: Date.now(), accuracy: 5 };
          startTestAutopilot();
        }}
      />

      {view === AppState.LOGIN && (
        <Login onLoginSuccess={(u) => { setUser(u); setView(AppState.HOME); }} />
      )}

      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-10 p-6 flex flex-col gap-4 pointer-events-none z-[1000]">
          <div className="bg-black/90 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 flex justify-between items-center pointer-events-auto shadow-2xl">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center font-black italic border border-blue-500/30 text-blue-500 text-xl shadow-inner">
                {user.nickname[0]}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/90">{user.nickname}</div>
                <div className="text-[10px] text-blue-500 font-bold tracking-widest mt-0.5">AGENTE NÍVEL {user.level}</div>
              </div>
            </div>

            <button
              onClick={() => setView(AppState.LEADERBOARD)}
              className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"
            >
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
            </button>
          </div>

          <button
            onClick={startActivity}
            className="w-full bg-blue-600 hover:bg-blue-500 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-[0_20px_50px_rgba(37,99,235,0.3)] pointer-events-auto active:scale-95 transition-all border-b-[6px] border-blue-800 text-white"
          >
            INICIAR DOMÍNIO
          </button>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <ActivityOverlay activity={currentActivity} user={user} onStop={stopActivity} />
      )}

      {view === AppState.SUMMARY && currentActivity && user && (
        <MissionSummary activity={currentActivity} user={user} onFinish={finishMission} />
      )}

      {view === AppState.LEADERBOARD && (
        <Leaderboard
          entries={Object.values(globalUsers).map((u: User) => ({
            id: u.id,
            nickname: u.nickname,
            totalAreaM2: u.totalAreaM2,
            level: u.level,
            color: u.color,
            avatarUrl: u.avatarUrl
          }))}
          currentUserId={user?.id || ''}
          onBack={() => setView(AppState.HOME)}
        />
      )}

      <TestSimulator
        isEnabled={isTestMode}
        onToggle={setIsTestMode}
        onLocationUpdate={handleNewLocation}
        userLocation={userLocation}
        showOverlay={view !== AppState.LOGIN}
        autopilotEnabled={testAutopilot}
        onAutopilotToggle={(active) => active ? startTestAutopilot() : stopTestAutopilot()}
      />
    </div>
  );
};

export default App;
