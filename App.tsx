
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, simplifyPath } from './core/geo';
import { detectClosedLoop } from './core/territory';
import { processLocation } from './core/gps';
import { MIN_MOVE_DISTANCE, RDP_EPSILON } from './constants';
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

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  const handleCapture = useCallback((enclosedIds: string[], loc: Point) => {
    if (!user) return;
    
    // 1. Criar novo lote de células capturadas
    const newCells: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      newCells[id] = { 
        id, 
        ownerId: user.id, 
        ownerNickname: user.nickname, 
        ownerColor: user.color, 
        bounds: [0,0,0,0], 
        updatedAt: Date.now(), 
        defense: 1 
      };
    });

    // 2. Atualizar estado local para feedback visual instantâneo
    setCells(prev => ({ ...prev, ...newCells }));
    playVictorySound();

    // 3. Persistir no servidor (batch sync)
    const syncData = enclosedIds.map(id => ({ id, ownerId: user.id, ownerNickname: user.nickname }));
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newCells: syncData })
    }).catch(err => console.error("Sync error:", err));

    // 4. Limpar o rastro ativo e começar um novo a partir do ponto de fechamento
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

  // ENGINE DE CAMPO - DETECÇÃO DE MOVIMENTO E CICLOS
  useEffect(() => {
    if (view !== AppState.ACTIVE || !userLocation || !currentActivity || isProcessing) return;

    const path = currentActivity.fullPath;
    const lastPoint = path.length > 0 ? path[path.length - 1] : null;
    
    // Distância mínima para registrar um novo ponto (evita jitter do GPS)
    const dist = lastPoint ? calculateDistance(lastPoint, userLocation) : Infinity;
    const triggerDist = isTestMode ? 0.5 : MIN_MOVE_DISTANCE;

    if (dist >= triggerDist || path.length === 0) {
      setIsProcessing(true);
      
      // Tenta detectar o fechamento de um circuito
      const loop = detectClosedLoop(path, userLocation);
      
      if (loop) {
        handleCapture(loop.enclosedCellIds, loop.closurePoint);
      } else {
        // Se não fechou loop, apenas adiciona ao rastro
        setCurrentActivity(prev => {
          if (!prev) return null;
          const newFullPath = [...prev.fullPath, userLocation];
          return {
            ...prev,
            fullPath: newFullPath,
            // Points é a versão simplificada para o Canvas do Leaflet
            points: simplifyPath(newFullPath, RDP_EPSILON),
            distanceMeters: prev.distanceMeters + (lastPoint ? dist : 0)
          };
        });
      }
      
      // Throttle de processamento para poupar CPU
      setTimeout(() => setIsProcessing(false), 30);
    }
  }, [userLocation, view, isProcessing, currentActivity?.fullPath.length]);

  const handleNewLocation = (pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestMode);
    if (processed) setUserLocation(processed);
  };

  // Inicializador de dados global
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
        if (data.users) {
          const usersMap: Record<string, User> = {};
          data.users.forEach((u: any) => usersMap[u.id] = u);
          setGlobalUsers(usersMap);
        }
      });
    }
  }, [user, view]);

  return (
    <div className="h-full w-full bg-black overflow-hidden relative font-sans">
      <GameMap 
        userLocation={userLocation} cells={cells} users={globalUsers}
        activeUserId={user?.id || ''} activeUser={user}
        currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []}
        onMapClick={(lat, lng) => isTestMode && handleNewLocation({lat, lng, timestamp: Date.now()}, true)}
      />

      {view === AppState.LOGIN && <Login onLoginSuccess={(u) => { setUser(u); setView(AppState.HOME); }} />}

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
             <button onClick={() => setView(AppState.LEADERBOARD)} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
             </button>
          </div>
          <button 
            onClick={() => {
              setCurrentActivity({ 
                id: `a_${Date.now()}`, 
                startTime: Date.now(), 
                points: [], 
                fullPath: [], 
                capturedCellIds: new Set(), 
                stolenCellIds: new Set(), 
                distanceMeters: 0, 
                isValid: true, 
                strategicZonesEntered: 0 
              });
              setView(AppState.ACTIVE);
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-[0_20px_50px_rgba(37,99,235,0.3)] pointer-events-auto active:scale-95 transition-all border-b-[6px] border-blue-800 text-white"
          >
            INICIAR DOMÍNIO
          </button>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <ActivityOverlay activity={currentActivity} user={user} onStop={() => setView(AppState.SUMMARY)} />
      )}

      {view === AppState.SUMMARY && currentActivity && user && (
        <MissionSummary activity={currentActivity} user={user} onFinish={() => setView(AppState.HOME)} />
      )}

      {view === AppState.LEADERBOARD && (
        <Leaderboard 
          // FIX: Explicitly type 'u' as 'User' to resolve 'unknown' property access errors at line 197
          entries={Object.values(globalUsers).map((u: User) => ({
            id: u.id, nickname: u.nickname, totalAreaM2: u.totalAreaM2, level: u.level, color: u.color, avatarUrl: u.avatarUrl
          }))} 
          currentUserId={user?.id || ''} 
          onBack={() => setView(AppState.HOME)} 
        />
      )}

      <TestSimulator 
        isEnabled={isTestMode} onToggle={setIsTestMode} 
        onLocationUpdate={handleNewLocation} userLocation={userLocation}
        showOverlay={view !== AppState.LOGIN}
      />
    </div>
  );
};
export default App;
