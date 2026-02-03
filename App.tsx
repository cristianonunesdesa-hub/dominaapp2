
// Arquivo: App.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AppState, 
  User, 
  Cell, 
  Point, 
  SyncPayload, 
  PublicUser, 
  Activity 
} from './types';
import { 
  CELL_AREA_M2, 
  MIN_MOVE_DISTANCE, 
  RDP_EPSILON 
} from './constants';
import { playVictorySound } from './utils/audio';
import { calculateDistance, simplifyPath } from './core/geo';
import { detectClosedLoop } from './core/territory';
import { processLocation } from './core/gps';

// Componentes
import GameMap from './components/GameMap';
import Login from './components/Login';
import ActivityOverlay from './components/ActivityOverlay';
import MissionSummary from './components/MissionSummary';
import TestSimulator from './components/TestSimulator';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [users, setUsers] = useState<Record<string, PublicUser>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);

  // Refs para evitar closures obsoletas em timers e listeners
  const userLocationRef = useRef<Point | null>(null);
  const isTestModeRef = useRef(isTestMode);
  const autopilotRef = useRef(autopilotEnabled);
  const testTargetRef = useRef<Point | null>(null);
  const activityRef = useRef<Activity | null>(null);

  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { isTestModeRef.current = isTestMode; }, [isTestMode]);
  useEffect(() => { autopilotRef.current = autopilotEnabled; }, [autopilotEnabled]);
  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);

  const handleNewLocation = useCallback((pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestModeRef.current);
    if (processed) setUserLocation(processed);
  }, []);

  // ✅ GPS REAL: Rastreamento contínuo
  useEffect(() => {
    if (isTestMode || !user || view === AppState.LOGIN) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        handleNewLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now()
        });
      },
      (err) => console.error("Erro GPS:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, view, isTestMode, handleNewLocation]);

  // ✅ LÓGICA DE PILOTO AUTOMÁTICO (MODO TESTE)
  useEffect(() => {
    if (!isTestMode) return;

    const timer = setInterval(() => {
      const cur = userLocationRef.current;
      const tgt = testTargetRef.current;
      if (!cur || !tgt || !autopilotRef.current) return;

      const dist = calculateDistance(cur, tgt);
      if (dist < 1) {
        testTargetRef.current = null;
        return;
      }

      // Caminhada simulada (~12km/h)
      const stepMeters = 0.8; 
      const metersPerDegLat = 111320;
      const metersPerDegLng = 111320 * Math.cos(cur.lat * Math.PI / 180);
      
      const dx = (tgt.lng - cur.lng) * metersPerDegLng;
      const dy = (tgt.lat - cur.lat) * metersPerDegLat;
      const angle = Math.atan2(dy, dx);

      const next: Point = {
        lat: cur.lat + (Math.sin(angle) * stepMeters / metersPerDegLat),
        lng: cur.lng + (Math.cos(angle) * stepMeters / metersPerDegLng),
        timestamp: Date.now(),
        accuracy: 5
      };

      handleNewLocation(next, true);
    }, 150);

    return () => clearInterval(timer);
  }, [isTestMode, handleNewLocation]);

  // Sincronização Periódica
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const payload: SyncPayload = {
          userId: user.id,
          location: userLocationRef.current,
          stats: {
            nickname: user.nickname, color: user.color, xp: user.xp,
            level: user.level, totalAreaM2: user.totalAreaM2, cellsOwned: user.cellsOwned
          }
        };
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.sessionToken}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          setCells(data.cells);
          const usersMap = data.users.reduce((acc: any, u: any) => {
            acc[u.id] = u;
            return acc;
          }, {});
          setUsers(usersMap);
        }
      } catch (e) { console.error("Erro sync:", e); }
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

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
    const newStats: User = {
      ...user,
      cellsOwned: (user.cellsOwned || 0) + enclosedIds.length,
      totalAreaM2: (user.totalAreaM2 || 0) + gainedArea
    };

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.sessionToken}` 
        },
        body: JSON.stringify({
          userId: user.id, location: loc, newCells: syncCellsPayload,
          stats: {
            nickname: newStats.nickname, color: newStats.color, xp: newStats.xp,
            level: newStats.level, totalAreaM2: newStats.totalAreaM2, cellsOwned: newStats.cellsOwned
          }
        })
      });
      setUser(newStats);
    } catch (err) { console.error("Erro capture sync:", err); }

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
    const triggerDist = isTestMode ? 0.4 : MIN_MOVE_DISTANCE;

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
      setTimeout(() => setIsProcessing(false), 50);
    }
  }, [userLocation, view, isProcessing, isTestMode, currentActivity, handleCapture]);

  const handleLoginSuccess = (userData: User) => { setUser(userData); setView(AppState.HOME); };
  
  const startMission = () => {
    setCurrentActivity({
      id: `act_${Date.now()}`, startTime: Date.now(), points: [], fullPath: [],
      capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0,
      isValid: true, strategicZonesEntered: 0
    });
    setView(AppState.ACTIVE);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {view === AppState.LOGIN && <Login onLoginSuccess={handleLoginSuccess} />}
      
      <GameMap 
        userLocation={userLocation}
        cells={cells}
        users={users}
        activeUserId={user?.id || ''}
        activeUser={user}
        currentPath={currentActivity?.fullPath || []}
        onMapClick={(lat, lng) => {
           if (isTestMode) {
             if (autopilotEnabled) {
               testTargetRef.current = { lat, lng, timestamp: Date.now(), accuracy: 5 };
             } else {
               handleNewLocation({ lat, lng, timestamp: Date.now(), accuracy: 5 }, true);
             }
           }
        }}
      />

      <TestSimulator 
        isEnabled={isTestMode}
        onToggle={setIsTestMode}
        userLocation={userLocation}
        onLocationUpdate={(p) => handleNewLocation(p, true)}
        showOverlay={view !== AppState.LOGIN}
        autopilotEnabled={autopilotEnabled}
        onAutopilotToggle={setAutopilotEnabled}
      />

      {view === AppState.ACTIVE && currentActivity && user && (
        <ActivityOverlay activity={currentActivity} onStop={() => setView(AppState.SUMMARY)} user={user} />
      )}

      {view === AppState.SUMMARY && currentActivity && user && (
        <MissionSummary activity={currentActivity} user={user} onFinish={() => { setCurrentActivity(null); setView(AppState.HOME); }} />
      )}

      {view === AppState.HOME && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-4 w-full px-6 max-w-sm">
          <div className="bg-black/80 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/10 flex items-center justify-between w-full shadow-2xl">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center font-black italic border border-blue-500/30 text-blue-500 text-xl shadow-inner">
                 {user?.nickname[0]}
               </div>
               <div>
                 <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">Status do Agente</p>
                 <p className="font-black italic text-sm">{user?.nickname}</p>
                 <div className="flex gap-4 mt-1 opacity-60 text-[10px] font-bold">
                    <span>LVL {user?.level}</span>
                    <span>{user?.totalAreaM2.toLocaleString()} m²</span>
                 </div>
               </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
            </div>
          </div>
          
          <button 
            onClick={startMission}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all py-6 rounded-[2.5rem] font-black italic uppercase tracking-tighter text-2xl shadow-[0_20px_50px_rgba(37,99,235,0.4)] border-b-6 border-blue-800 text-white"
          >
            INICIAR DOMÍNIO
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
