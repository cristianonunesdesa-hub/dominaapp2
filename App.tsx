
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
    
    // Injeção rápida de células no estado para feedback instantâneo
    const newCells: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      newCells[id] = { id, ownerId: user.id, ownerNickname: user.nickname, ownerColor: user.color, bounds:[0,0,0,0], updatedAt: Date.now(), defense:1 };
    });

    setCells(prev => ({ ...prev, ...newCells }));
    playVictorySound();

    // Sincronização em segundo plano (batch)
    const syncData = enclosedIds.map(id => ({ id, ownerId: user.id, ownerNickname: user.nickname }));
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newCells: syncData })
    });

    // Reseta rastro para o ponto de fechamento
    setCurrentActivity(prev => prev ? ({
      ...prev,
      fullPath: [loc],
      points: [loc],
      capturedCellIds: new Set([...prev.capturedCellIds, ...enclosedIds])
    }) : null);
  }, [user]);

  // CORE ENGINE - DETECÇÃO DE MOVIMENTO E CICLO
  useEffect(() => {
    if (view !== AppState.ACTIVE || !userLocation || !currentActivity || isProcessing) return;

    const lastPoint = currentActivity.fullPath[currentActivity.fullPath.length - 1];
    const dist = lastPoint ? calculateDistance(lastPoint, userLocation) : 0;

    if (dist > (isTestMode ? 1 : MIN_MOVE_DISTANCE) || currentActivity.fullPath.length === 0) {
      setIsProcessing(true);
      
      // Tenta detectar fechamento de circuito
      const loop = detectClosedLoop(currentActivity.fullPath, userLocation);
      
      if (loop) {
        handleCapture(loop.enclosedCellIds, loop.closurePoint);
      } else {
        setCurrentActivity(prev => {
          if (!prev) return null;
          const newPath = [...prev.fullPath, userLocation];
          return {
            ...prev,
            fullPath: newPath,
            points: simplifyPath(newPath, RDP_EPSILON),
            distanceMeters: prev.distanceMeters + dist
          };
        });
      }
      
      // Libera o processador para a próxima atualização de GPS
      setTimeout(() => setIsProcessing(false), 50);
    }
  }, [userLocation, view]);

  const handleNewLocation = (pt: Point, force = false) => {
    const processed = processLocation(pt, userLocationRef.current, force || isTestMode);
    if (processed) setUserLocation(processed);
  };

  return (
    <div className="h-full w-full bg-black overflow-hidden relative">
      <GameMap 
        userLocation={userLocation} cells={cells} users={globalUsers}
        activeUserId={user?.id || ''} activeUser={user}
        currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []}
        onMapClick={(lat, lng) => isTestMode && handleNewLocation({lat, lng, timestamp: Date.now()}, true)}
      />

      {view === AppState.LOGIN && <Login onLoginSuccess={(u) => { setUser(u); setView(AppState.HOME); }} />}

      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-10 p-6 flex flex-col gap-4 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-xl p-4 rounded-3xl border border-white/10 flex justify-between items-center pointer-events-auto">
             <div className="flex gap-3 items-center">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center font-black italic border border-blue-500/30">
                  {user.nickname[0]}
                </div>
                <div>
                   <div className="text-xs font-black uppercase tracking-widest">{user.nickname}</div>
                   <div className="text-[10px] text-blue-500 font-bold">NÍVEL {user.level}</div>
                </div>
             </div>
          </div>
          <button 
            onClick={() => {
              setCurrentActivity({ id: `a_${Date.now()}`, startTime: Date.now(), points: [], fullPath: [], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 });
              setView(AppState.ACTIVE);
            }}
            className="w-full bg-blue-600 py-6 rounded-3xl font-black text-xl italic uppercase shadow-2xl pointer-events-auto active:scale-95 transition-all border-b-4 border-blue-800"
          >
            INICIAR INCURSÃO
          </button>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <ActivityOverlay activity={currentActivity} user={user} onStop={() => setView(AppState.SUMMARY)} />
      )}

      {view === AppState.SUMMARY && currentActivity && user && (
        <MissionSummary activity={currentActivity} user={user} onFinish={() => setView(AppState.HOME)} />
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
