
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, getEnclosedCellIds, simplifyPath, getIntersection } from './utils';
import { XP_PER_KM, XP_PER_SECTOR, MIN_MOVE_DISTANCE, RDP_EPSILON, SNAP_TOLERANCE } from './constants';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import MissionSummary from './components/MissionSummary';
import { Zap, Globe, Activity as ActivityIcon, MapPinOff, RefreshCw, Shield, Users, LogOut } from 'lucide-react';
import { playVictorySound } from './utils/audio';

const ACCURACY_THRESHOLD = 150; 
const JUMP_THRESHOLD = 80; 
const EMA_ALPHA = 0.25; 

const MOCK_USERS: User[] = [
  { id: 'u_alpha', nickname: 'ALPHA', color: '#3B82F6', level: 10, xp: 5000, cellsOwned: 120, totalAreaM2: 600, badges: [], dailyStreak: 5 },
  { id: 'u_beta', nickname: 'BETA', color: '#F59E0B', level: 15, xp: 8500, cellsOwned: 250, totalAreaM2: 1250, badges: [], dailyStreak: 12 },
  { id: 'u_gamma', nickname: 'GAMMA', color: '#10B981', level: 5, xp: 2000, cellsOwned: 45, totalAreaM2: 225, badges: [], dailyStreak: 2 }
];

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.USER_SELECT);
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
    const lastPoint = userLocationRef.current;
    if (!force && !isTestModeRef.current) {
        if (rawPoint.accuracy && rawPoint.accuracy > ACCURACY_THRESHOLD && lastPoint) return;
    }
    if (lastPoint && !force) {
      const dist = calculateDistance(lastPoint, rawPoint);
      const timeDiff = (rawPoint.timestamp - lastPoint.timestamp) / 1000;
      if (timeDiff > 0 && (dist / timeDiff) > (JUMP_THRESHOLD / 3.6) && !isTestModeRef.current) return;
      const smoothedLat = (rawPoint.lat * EMA_ALPHA) + (lastPoint.lat * (1 - EMA_ALPHA));
      const smoothedLng = (rawPoint.lng * EMA_ALPHA) + (lastPoint.lng * (1 - EMA_ALPHA));
      setUserLocation({ lat: smoothedLat, lng: smoothedLng, accuracy: rawPoint.accuracy, timestamp: rawPoint.timestamp });
    } else {
      setUserLocation(rawPoint);
      setGpsError(null);
    }
  }, []);

  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado");
      return;
    }
    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition(
      (pos) => handleNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp }),
      (err) => setGpsError(err.message),
      geoOptions
    );
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (isTestModeRef.current) return;
        handleNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp });
      },
      (err) => console.debug("GPS Watch:", err.message),
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
              userId: user.id, nickname: user.nickname, color: user.color,
              location: userLocation,
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

  const captureArea = useCallback((polygonPoints: Point[], loc: Point, enclosedIds: string[]) => {
    if (!user) return;
    const newCellsForSync = enclosedIds.map(id => ({ id, ownerId: user.id, ownerNickname: user.nickname }));
    const captured: Record<string, Cell> = enclosedIds.reduce((acc, id) => ({
      ...acc,
      [id]: { id, ownerId: user.id, ownerNickname: user.nickname, ownerColor: user.color, bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1 }
    }), {});
    setCells(prev => ({ ...prev, ...captured }));
    setShowConfetti(true);
    playVictorySound();
    setTimeout(() => setShowConfetti(false), 2000);
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, nickname: user.nickname, color: user.color, newCells: newCellsForSync })
    });
    // Reset da trilha para o ponto atual para permitir novo fechamento
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

  useEffect(() => {
    const activity = activityRef.current;
    const loc = userLocation;
    if (view === AppState.ACTIVE && loc && activity && user) {
      // Usar fullPath (trilha bruta) para maior precisão no fechamento
      const rawTrail = activity.fullPath;
      const lastPoint = rawTrail[rawTrail.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, loc) : 0;
      const minDist = isTestMode ? 2 : MIN_MOVE_DISTANCE;

      if (d > minDist || rawTrail.length === 0) {
        const nextRawTrail = [...rawTrail, loc];
        
        // GEOFLOW: Verificação de Interseção (Corte de caminho)
        // Usamos a trilha bruta para garantir que nenhum cruzamento escape
        if (nextRawTrail.length > 3) {
          const pNew = nextRawTrail[nextRawTrail.length - 1];
          const pLast = nextRawTrail[nextRawTrail.length - 2];
          
          for (let i = 0; i < nextRawTrail.length - 3; i++) {
            const intersection = getIntersection(pLast, pNew, nextRawTrail[i], nextRawTrail[i+1]);
            if (intersection) {
              const poly = [intersection, ...nextRawTrail.slice(i + 1, -1), intersection];
              const ids = getEnclosedCellIds(poly);
              if (ids.length > 0) { 
                captureArea(poly, loc, ids); 
                return; 
              }
            }
          }
        }

        // GEOFLOW: Verificação de Proximidade (Snap de 20 metros)
        // Ignoramos os últimos 10 pontos para evitar snap imediato no início
        if (nextRawTrail.length > 10) {
          for (let i = 0; i < nextRawTrail.length - 10; i++) {
            const distToPoint = calculateDistance(loc, nextRawTrail[i]);
            if (distToPoint < SNAP_TOLERANCE) {
              const poly = [...nextRawTrail.slice(i, -1), nextRawTrail[i]];
              const ids = getEnclosedCellIds(poly);
              if (ids.length > 0) { 
                captureArea(poly, loc, ids); 
                return; 
              }
            }
          }
        }

        // Se nenhum fechamento ocorreu, atualiza o estado normal
        setCurrentActivity(prev => {
          if (!prev) return null;
          const newFullPath = [...prev.fullPath, loc];
          return { 
            ...prev, 
            points: simplifyPath(newFullPath, RDP_EPSILON), // Mapa exibe versão leve
            fullPath: newFullPath, // Lógica usa versão bruta
            distanceMeters: prev.distanceMeters + d 
          };
        });
      }
    }
  }, [userLocation, view, user, captureArea, isTestMode]);

  const toggleSimulador = () => {
    const nextMode = !isTestMode;
    setIsTestMode(nextMode);
    if (nextMode && !userLocation) handleNewLocation({ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }, true);
  };

  const selectUser = (u: User) => { setUser(u); setView(AppState.BOOT); };
  const handleLogout = () => { setUser(null); setView(AppState.USER_SELECT); setIsIntroReady(false); setCurrentActivity(null); };

  return (
    <div className="h-full w-full bg-black text-white relative overflow-hidden font-sans select-none">
      <div className="fixed inset-0 z-[5000] pointer-events-none vignette-overlay"></div>
      <div className="fixed inset-0 z-[5001] pointer-events-none grain-overlay"></div>
      {view === AppState.USER_SELECT && (
        <div className="fixed inset-0 z-[8000] bg-black flex flex-col items-center justify-center p-8 overflow-y-auto">
          <div className="text-center mb-12 animate-in fade-in duration-700">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-600/10 border border-blue-500/30 mb-6 shadow-[0_0_50px_rgba(37,99,235,0.2)]">
              <Shield className="text-blue-500" size={40} />
            </div>
            <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">DOMINA</h1>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] mt-3">SELECIONE SEU AGENTE</p>
          </div>
          <div className="w-full max-w-sm space-y-4">
            {MOCK_USERS.map((u, idx) => (
              <button key={u.id} onClick={() => selectUser(u)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-center gap-4 hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98] animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: u.color }}><Users size={24} className="text-white" /></div>
                <div className="text-left flex-1">
                  <div className="text-lg font-black italic uppercase text-white leading-none mb-1">{u.nickname}</div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">NÍVEL {u.level} • {u.totalAreaM2}m²</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/40"><Zap size={14} /></div>
              </button>
            ))}
          </div>
          <p className="mt-12 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Ambiente de Testes Ativado</p>
        </div>
      )}
      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} cells={cells} users={globalUsers} activeUserId={user?.id || ''} activeUser={user} 
          currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []} onMapClick={(lat, lng) => isTestMode && handleNewLocation({ lat, lng, timestamp: Date.now() }, true)}
          introMode={view === AppState.BOOT || (view === AppState.HOME && !isIntroReady) || view === AppState.USER_SELECT}
        />
      </div>
      {!userLocation && view !== AppState.BOOT && view !== AppState.USER_SELECT && (
        <div className="absolute inset-0 z-[7000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="relative mb-12">
            <div className="w-20 h-20 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin"></div>
            <MapPinOff className="absolute inset-0 m-auto text-blue-500 animate-pulse" size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase italic mb-3 tracking-tighter">Sinal de GPS Ausente</h2>
          <div className="space-y-4 w-full max-w-xs">
            <button onClick={() => startGpsTracking()} className="w-full bg-blue-600/20 border border-blue-500/50 py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase italic tracking-widest active:scale-95 transition-all"><RefreshCw size={14} /> Tentar Reconectar GPS</button>
            <button onClick={toggleSimulador} className="w-full bg-orange-600 py-5 rounded-3xl font-black text-sm uppercase italic shadow-2xl active:scale-95 transition-all border-b-4 border-orange-800 flex items-center justify-center gap-3"><Zap size={18} className="fill-white" /> ATIVAR MODO SIMULADOR</button>
          </div>
        </div>
      )}
      {showConfetti && <ConfettiEffect />}
      {view !== AppState.USER_SELECT && (
        <div className={`absolute top-12 inset-x-5 z-[2500] flex justify-between items-start pointer-events-none transition-opacity duration-1000 ${isIntroReady && userLocation ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={toggleSimulador} className={`pointer-events-auto p-3 rounded-xl border flex items-center gap-2 transition-all ${isTestMode ? 'bg-orange-600 border-white shadow-[0_0_20px_rgba(234,88,12,0.5)]' : 'bg-black/60 border-white/10 text-white/40'}`}>
            <Zap size={14} className={isTestMode ? 'fill-white animate-pulse' : ''} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isTestMode ? 'SIMULADOR ON' : 'GPS REAL'}</span>
          </button>
        </div>
      )}
      {view === AppState.HOME && user && userLocation && (
        <div className={`absolute inset-x-0 bottom-0 z-[1500] flex flex-col p-5 pointer-events-none transition-all duration-1000 transform ${isIntroReady ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <div className="flex justify-between items-center mb-4 pointer-events-auto bg-black/80 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-gray-900 border border-white/10 overflow-hidden relative">
                <img src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.nickname}`} className="w-full h-full object-cover" />
                <button onClick={handleLogout} className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"><LogOut size={16} className="text-red-500" /></button>
              </div>
              <div>
                <h3 className="font-black italic uppercase text-sm leading-none flex items-center gap-2">{user.nickname}<button onClick={handleLogout} className="p-1 hover:text-red-500 transition-colors"><LogOut size={12}/></button></h3>
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
      <style>{` .vignette-overlay { background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 120%); } .grain-overlay { background-image: url("https://grainy-gradients.vercel.app/noise.svg"); opacity: 0.04; } `}</style>
    </div>
  );
};
export default App;
