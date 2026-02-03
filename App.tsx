
// Arquivo: App.tsx

import React, { useState, useEffect, useCallback } from 'react';
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

// Componentes
import GameMap from './components/GameMap';
import Login from './components/Login';
import ActivityOverlay from './components/ActivityOverlay';
import MissionSummary from './components/MissionSummary';
import TestSimulator from './components/TestSimulator';

const App: React.FC = () => {
  // Estado Global
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [users, setUsers] = useState<Record<string, PublicUser>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);

  // Sincronização Periódica de Estado (Outros usuários e células globais)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const payload: SyncPayload = {
          userId: user.id,
          location: userLocation,
          stats: {
            nickname: user.nickname,
            color: user.color,
            xp: user.xp,
            level: user.level,
            totalAreaM2: user.totalAreaM2,
            cellsOwned: user.cellsOwned
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
      } catch (e) {
        console.error("Erro na sincronização:", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, userLocation]);

  // Lógica de Captura de Território
  const handleCapture = useCallback(async (enclosedIds: string[], loc: Point) => {
    if (!user) return;

    // 1. Atualização Visual Imediata (Otimista)
    const newCellsDict: Record<string, Cell> = {};
    enclosedIds.forEach(id => {
      newCellsDict[id] = {
        id, ownerId: user.id, ownerNickname: user.nickname, ownerColor: user.color,
        updatedAt: Date.now(), defense: 1
      };
    });

    setCells(prev => ({ ...prev, ...newCellsDict }));
    playVictorySound();

    // 2. Sincronização com Servidor
    const syncCellsPayload = enclosedIds.map(id => ({ id, ownerId: user.id, ownerNickname: user.nickname }));
    const gainedArea = enclosedIds.length * CELL_AREA_M2;
    const newStats: User = {
      ...user,
      cellsOwned: (user.cellsOwned || 0) + enclosedIds.length,
      totalAreaM2: (user.totalAreaM2 || 0) + gainedArea
    };

    const payload: SyncPayload = {
      userId: user.id,
      location: loc,
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
      if (res.ok) setUser(newStats);
    } catch (err) {
      console.error("Erro no sync de captura:", err);
    }

    // 3. Reset do Rastro: Começamos um novo rastro a partir de onde o anterior fechou
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

  // Hook de processamento de localização
  useEffect(() => {
    if (view !== AppState.ACTIVE || !userLocation || !currentActivity || isProcessing) return;
    
    const path = currentActivity.fullPath;
    const lastPoint = path.length > 0 ? path[path.length - 1] : null;
    
    // Distância mínima para registrar um novo ponto
    const dist = lastPoint ? calculateDistance(lastPoint, userLocation) : Infinity;
    const triggerDist = isTestMode ? 0.5 : MIN_MOVE_DISTANCE;

    if (dist >= triggerDist || path.length === 0) {
      setIsProcessing(true);
      
      // Checagem de Circuito Fechado
      const loop = detectClosedLoop(path, userLocation);
      
      if (loop) {
        handleCapture(loop.enclosedCellIds, loop.closurePoint);
      } else {
        // Apenas adiciona ao rastro
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
      
      // Debounce para não sobrecarregar o processador
      setTimeout(() => setIsProcessing(false), 50);
    }
  }, [userLocation, view, isProcessing, isTestMode, currentActivity, handleCapture]);

  // Handlers de UI
  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setView(AppState.HOME);
  };

  const startMission = () => {
    if (!userLocation) {
        // Tenta obter localização se não tiver no modo teste
        navigator.geolocation.getCurrentPosition((pos) => {
            setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                timestamp: Date.now(),
                accuracy: pos.coords.accuracy
            });
        });
    }
    setCurrentActivity({
      id: `act_${Date.now()}`,
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
  };

  const stopMission = () => {
    if (currentActivity) {
      setCurrentActivity(prev => prev ? { ...prev, endTime: Date.now() } : null);
      setView(AppState.SUMMARY);
    }
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
             setUserLocation({ lat, lng, timestamp: Date.now(), accuracy: 5 });
           }
        }}
      />

      <TestSimulator 
        isEnabled={isTestMode}
        onToggle={setIsTestMode}
        userLocation={userLocation}
        onLocationUpdate={(p) => setUserLocation(p)}
        showOverlay={true}
        autopilotEnabled={autopilotEnabled}
        onAutopilotToggle={setAutopilotEnabled}
      />

      {view === AppState.ACTIVE && currentActivity && user && (
        <ActivityOverlay 
          activity={currentActivity} 
          onStop={stopMission} 
          user={user} 
        />
      )}

      {view === AppState.SUMMARY && currentActivity && user && (
        <MissionSummary 
          activity={currentActivity} 
          user={user} 
          onFinish={() => {
            setCurrentActivity(null);
            setView(AppState.HOME);
          }} 
        />
      )}

      {view === AppState.HOME && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-4">
          <div className="bg-black/60 backdrop-blur-md p-4 rounded-3xl border border-white/10 text-center min-w-[200px]">
            <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">Status do Agente</p>
            <p className="font-black italic text-sm">{user?.nickname}</p>
            <div className="flex gap-4 mt-2 justify-center opacity-60 text-[10px] font-bold">
                <span>LVL {user?.level}</span>
                <span>{user?.totalAreaM2.toLocaleString()} m²</span>
            </div>
          </div>
          
          <button 
            onClick={startMission}
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all px-12 py-5 rounded-[2rem] font-black italic uppercase tracking-tighter text-2xl shadow-[0_20px_50px_rgba(37,99,235,0.4)] border-b-4 border-blue-800"
          >
            INICIAR MISSÃO
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
