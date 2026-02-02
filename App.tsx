
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, simplifyPath } from './core/geo';
import { detectClosedLoop } from './core/territory';
import { processLocation } from './core/gps';
import { MIN_MOVE_DISTANCE, RDP_EPSILON } from './constants';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import MissionSummary from './components/MissionSummary';
import Login from './components/Login';
import TestSimulator from './components/TestSimulator';
import { Globe, Activity as ActivityIcon, MapPinOff, RefreshCw, LogOut } from 'lucide-react';
import { playVictorySound } from './utils/audio';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<Record<string, User>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isIntroReady, setIsIntroReady] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const isTestModeRef = useRef(isTestMode);
  const syncIntervalRef = useRef<number | null>(null);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { isTestModeRef.current = isTestMode; }, [isTestMode]);

  const handleNewLocation = useCallback((rawPoint: Point, force: boolean = false) => {
    const processed = processLocation(rawPoint, userLocationRef.current, force || isTestModeRef.current);
    if (processed) {
      setUserLocation(processed);
      setGpsError(null);
    }
  }, []);

  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado");
      return;
    }
    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (isTestModeRef.current) return;
        handleNewLocation({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          accuracy: pos.coords.accuracy, 
          timestamp: pos.timestamp 
        });
      },
      (err) => console.debug("GPS Watch Error:", err.message),
      geoOptions
    );
    return watchId;
  }, [handleNewLocation]);

  useEffect(() => {
    const id = startGpsTracking();
    return () => { if (id) navigator.geolocation.clearWatch(id); };
  }, [startGpsTracking]);

  useEffect(() => {
    if (user && userLocation) {
      const syncData = async () => {
        try {
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id, location: userLocation,
              stats: { xp: user.xp, level: user.level, totalAreaM2: user.totalAreaM2, cellsOwned: user.cellsOwned }
            })
          });
          const data = await response.json();
          if (data.users) setGlobalUsers(data.users.reduce((acc: any, u: any) => ({ ...acc, [u.id]: u }), {}));
          if (data.cells) setCells(data.cells);
        } catch (e) { console.error("Sync error:", e); }
      };
      syncIntervalRef.current = window.setInterval(syncData, 5000);
      syncData();
    }
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [user, !!userLocation]);

  useEffect(() => {
    if (view === AppState.BOOT) {
      setTimeout(() => { 
        setView(AppState.HOME); 
        setTimeout(() => setIsIntroReady(true), 1500); 
      }, 2500);
    }
  }, [view]);

  const handleCapture = useCallback((enclosedIds: string[], loc: Point) => {
    if (!user) return;
    
    // Atualiza interface local IMEDIATAMENTE para dar feedback ao usuário
    const captured: Record<string, Cell> = enclosedIds.reduce((acc, id) => ({
      ...acc,
      [id]: { id, ownerId: user.id, ownerNickname: user.nickname, ownerColor: user.color, bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1 }
    }), {});
    
    setCells(prev => ({ ...prev, ...captured }));
    setShowConfetti(true);
    playVictorySound();
    setTimeout(() => setShowConfetti(false), 2000);

    // Sincroniza em background
    const newCellsForSync = enclosedIds.map(id => ({ id, ownerId: user.id, ownerNickname: user.nickname }));
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newCells: newCellsForSync })
    });

    // Limpa o rastro e adiciona os pontos de captura à estatística da atividade
    setCurrentActivity(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        points: [loc], 
        fullPath: [loc], 
        capturedCellIds: new Set([...prev.capturedCellIds, ...enclosedIds]) 
      };
    });
  }, [user]);

  // ENGINE DE ATIVIDADE - CORE LOOP
  useEffect(() => {
    const activity = activityRef.current;
    const loc = userLocation;
    
    if (view === AppState.ACTIVE && loc && activity && user) {
      const rawTrail = activity.fullPath;
      const lastPoint = rawTrail[rawTrail.length - 1];
      
      // Cálculo de distância simples para evitar processamento inútil
      const d = lastPoint ? calculateDistance(lastPoint, loc) : 0;
      const minDist = isTestMode ? 1.5 : MIN_MOVE_DISTANCE;

      if (d > minDist || rawTrail.length === 0) {
        // Detecção de Ciclo: Só roda se houver movimento real
        const loop = detectClosedLoop(rawTrail, loc);
        
        if (loop) {
          handleCapture(loop.enclosedCellIds, loop.closurePoint);
        } else {
          setCurrentActivity(prev => {
            if (!prev) return null;
            const newFullPath = [...prev.fullPath, loc];
            return { 
              ...prev, 
              points: simplifyPath(newFullPath, RDP_EPSILON), 
              fullPath: newFullPath, 
              distanceMeters: prev.distanceMeters + d 
            };
          });
        }
      }
    }
  }, [userLocation, view, user, handleCapture, isTestMode]);

  const handleLogout = () => {
    setUser(null);
    setView(AppState.LOGIN);
    setIsIntroReady(false);
    setCurrentActivity(null);
  };

  return (
    <div className="h-full w-full bg-black text-white relative overflow-hidden font-sans select-none">
      <div className="fixed inset-0 z-[5000] pointer-events-none vignette-overlay"></div>
      
      {view === AppState.LOGIN && <Login onLoginSuccess={(u) => { setUser(u); setView(AppState.BOOT); }} />}

      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} cells={cells} users={globalUsers} activeUserId={user?.id || ''} activeUser={user} 
          currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []}
          onMapClick={(lat, lng) => isTestMode && handleNewLocation({ lat, lng, timestamp: Date.now() }, true)}
          introMode={view !== AppState.HOME && view !== AppState.ACTIVE}
        />
      </div>

      <TestSimulator 
        isEnabled={isTestMode} 
        onToggle={setIsTestMode} 
        onLocationUpdate={handleNewLocation}
        userLocation={userLocation}
        showOverlay={view !== AppState.LOGIN && isIntroReady}
      />

      {view === AppState.HOME && user && userLocation && (
        <div className={`absolute inset-x-0 bottom-0 z-[1500] flex flex-col p-5 pointer-events-none transition-all duration-1000 transform ${isIntroReady ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <div className="flex justify-between items-center mb-4 pointer-events-auto bg-black/80 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-gray-900 border border-white/10 overflow-hidden relative group">
                <img src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.nickname}`} className="w-full h-full object-cover" />
                <button onClick={handleLogout} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><LogOut size={16} className="text-red-500" /></button>
              </div>
              <div>
                <h3 className="font-black italic uppercase text-sm leading-none flex items-center gap-2">{user.nickname}</h3>
                <span className="text-[8px] font-black bg-blue-600 px-1.5 py-0.5 rounded-full uppercase mt-1 inline-block">Nível {user.level}</span>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-2.5 bg-white/5 rounded-xl border border-white/10 active:scale-90 transition-all pointer-events-auto"><Globe size={20} className="text-blue-400" /></button>
          </div>
          <button onClick={() => { setView(AppState.ACTIVE); setCurrentActivity({ id: `act_${Date.now()}`, startTime: Date.now(), points: [userLocation], fullPath: [userLocation], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); }} className="w-full py-6 rounded-3xl font-black text-xl italic uppercase shadow-[0_0_40px_rgba(37,99,235,0.4)] pointer-events-auto active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 bg-blue-600 border-blue-800"><ActivityIcon size={24} className="animate-pulse" /> INICIAR INCURSÃO</button>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && <ActivityOverlay activity={currentActivity} user={user} onStop={() => setView(AppState.SUMMARY)} />}
      {view === AppState.SUMMARY && currentActivity && user && <MissionSummary activity={currentActivity} user={user} onFinish={() => setView(AppState.HOME)} />}
      {view === AppState.LEADERBOARD && <Leaderboard entries={Object.values(globalUsers)} currentUserId={user?.id || ''} onBack={() => setView(AppState.HOME)} />}
      
      <style>{` .vignette-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 5000; background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 120%); } `}</style>
    </div>
  );
};
export default App;
