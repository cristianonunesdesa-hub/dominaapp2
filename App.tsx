
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import { XP_PER_KM, XP_PER_SECTOR } from './constants';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import MissionSummary from './components/MissionSummary';
import { Radio, Zap, Globe, Activity as ActivityIcon, Navigation, Crosshair, Terminal, Footprints } from 'lucide-react';
import { playVictorySound } from './utils/audio';

const App: React.FC = () => {
  // CONFIGURAÇÃO DE TESTE: Inicia direto no BOOT
  const [view, setView] = useState<AppState>(AppState.BOOT);
  const [user, setUser] = useState<User | null>({
    id: 'u_dev_agent',
    nickname: 'AGENTE_ALPHA',
    color: '#3B82F6',
    cellsOwned: 42,
    totalAreaM2: 1890,
    xp: 850,
    level: 2,
    badges: ['explorer'],
    dailyStreak: 3
  });

  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true); // Modo simulador ativo por padrão para testes
  const [simSpeed, setSimSpeed] = useState(15); 
  const [simTarget, setSimTarget] = useState<Point | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, User>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isIntroReady, setIsIntroReady] = useState(false);

  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number | null>(null);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  // Sequência de Intro Automática ao montar o componente (Pós-Login simulado)
  useEffect(() => {
    if (view === AppState.BOOT) {
      const bootTimer = setTimeout(() => {
        setView(AppState.HOME);
        const readyTimer = setTimeout(() => {
          setIsIntroReady(true);
        }, 1500); // UI entra em fade após o início do zoom
        return () => clearTimeout(readyTimer);
      }, 3000); // 3 segundos de BOOT cinematográfico
      return () => clearTimeout(bootTimer);
    }
  }, [view]);

  // Sincronização e GPS
  const syncGlobalState = useCallback(async (newCells: Cell[] = [], updatedUser?: User) => {
    const activeUser = updatedUser || user;
    if (!activeUser || !userLocationRef.current) return;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: activeUser.id, 
          location: userLocationRef.current, 
          newCells, 
          stats: {
            xp: activeUser.xp,
            level: activeUser.level,
            totalAreaM2: activeUser.totalAreaM2,
            cellsOwned: activeUser.cellsOwned
          } 
        })
      });
      const data = await res.json();
      if (data.users) {
        const usersMap = data.users.reduce((acc: Record<string, User>, u: any) => ({ ...acc, [u.id]: u }), {});
        setGlobalUsers(usersMap);
      }
      if (data.cells) setCells(prev => ({ ...prev, ...data.cells }));
    } catch (e) { console.error("Sync failed", e); }
  }, [user]);

  const animateSimulation = useCallback((time: number) => {
    if (lastUpdateRef.current !== null && simTarget && userLocationRef.current) {
      const deltaTime = (time - lastUpdateRef.current) / 1000;
      if (deltaTime > 0 && deltaTime < 0.1) {
        const currentPos = userLocationRef.current;
        const dist = calculateDistance(currentPos, simTarget);

        if (dist < 0.3) {
          setSimTarget(null);
          lastUpdateRef.current = null;
          return;
        } else {
          const speedMps = (simSpeed * 1000) / 3600;
          const moveDist = speedMps * deltaTime;
          const ratio = Math.min(moveDist / dist, 1);
          
          setUserLocation({
            lat: currentPos.lat + (simTarget.lat - currentPos.lat) * ratio,
            lng: currentPos.lng + (simTarget.lng - currentPos.lng) * ratio,
            timestamp: Date.now()
          });
        }
      }
    }
    lastUpdateRef.current = time;
    requestRef.current = requestAnimationFrame(animateSimulation);
  }, [simTarget, simSpeed]);

  useEffect(() => {
    if (isTestMode && simTarget) {
      lastUpdateRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animateSimulation);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastUpdateRef.current = null;
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isTestMode, simTarget, animateSimulation]);

  useEffect(() => {
    if (isTestMode) {
      if (!userLocation) setUserLocation({ lat: -23.5505, lng: -46.6333, timestamp: Date.now() });
      return; 
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTestMode]);

  // Lógica de Atividade
  useEffect(() => {
    const activity = activityRef.current;
    const loc = userLocation;
    if (view === AppState.ACTIVE && loc && activity && user) {
      const points = activity.points;
      const lastPoint = points[points.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, loc) : 0;
      const threshold = isTestMode ? 0.25 : 2.5; 
      
      if (d > threshold) {
        const newPoints = [...points, loc];
        const newFullPath = [...(activity.fullPath || []), loc];
        
        if (newPoints.length > 3) {
          const pA = newPoints[newPoints.length - 2];
          const pB = newPoints[newPoints.length - 1];
          for (let i = 0; i < newPoints.length - 3; i++) {
            if (segmentsIntersect(pA, pB, newPoints[i], newPoints[i + 1])) {
              const polygon = [...newPoints.slice(i), loc];
              const enclosedIds = getEnclosedCellIds(polygon);
              if (enclosedIds.length > 0) {
                const captured: Cell[] = enclosedIds.map(id => ({
                  id, ownerId: user.id, ownerNickname: user.nickname, ownerColor: user.color,
                  bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1
                }));
                setCells(prev => ({ ...prev, ...captured.reduce((a, c) => ({...a, [c.id]: c}), {}) }));
                syncGlobalState(captured);
                setShowConfetti(true);
                playVictorySound();
                setTimeout(() => setShowConfetti(false), 2000);
                setCurrentActivity(prev => prev ? { 
                  ...prev, points: [loc], fullPath: newFullPath,
                  capturedCellIds: new Set([...prev.capturedCellIds, ...enclosedIds]) 
                } : null);
                return;
              }
            }
          }
        }
        setCurrentActivity(prev => prev ? { ...prev, points: newPoints, fullPath: newFullPath, distanceMeters: prev.distanceMeters + d } : null);
      }
    }
  }, [userLocation, view, isTestMode, user, syncGlobalState]);

  const handleFinishMission = () => {
    if (!currentActivity || !user) return;
    const km = currentActivity.distanceMeters / 1000;
    const xpGained = Math.round((km * XP_PER_KM) + (currentActivity.capturedCellIds.size * XP_PER_SECTOR));
    const updatedUser = {
      ...user, xp: user.xp + xpGained,
      cellsOwned: user.cellsOwned + currentActivity.capturedCellIds.size,
      totalAreaM2: user.totalAreaM2 + (currentActivity.capturedCellIds.size * 45)
    };
    if (updatedUser.xp >= updatedUser.level * 1000) updatedUser.level += 1;
    setUser(updatedUser);
    syncGlobalState([], updatedUser);
    setView(AppState.HOME);
    setCurrentActivity(null);
  };

  return (
    <div className="h-full w-full bg-black text-white relative overflow-hidden font-sans select-none">
      <div className="fixed inset-0 z-[5000] pointer-events-none vignette-overlay"></div>
      <div className="fixed inset-0 z-[5001] pointer-events-none grain-overlay"></div>
      <div className="fixed inset-0 z-[5002] pointer-events-none scanlines"></div>

      {showConfetti && <ConfettiEffect />}
      
      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} cells={cells} users={globalUsers} 
          activeUserId={user?.id || ''} activeUser={user} 
          currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []} 
          onMapClick={(lat, lng) => isTestMode && setSimTarget({ lat, lng, timestamp: Date.now() })}
          simTarget={simTarget}
          introMode={view === AppState.BOOT || (view === AppState.HOME && !isIntroReady)}
        />
      </div>
      
      {/* HUD Superior (Fade-in) */}
      <div className={`absolute top-12 inset-x-5 z-[2500] flex flex-col gap-2 pointer-events-none transition-opacity duration-1000 ${isIntroReady ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex justify-between items-start">
          <button 
            onClick={() => { setIsTestMode(!isTestMode); setSimTarget(null); }} 
            className={`pointer-events-auto p-3 rounded-xl border transition-all shadow-xl active:scale-90 flex items-center gap-2 ${isTestMode ? 'bg-orange-600 border-white text-white' : 'bg-black/80 backdrop-blur-md border-white/10 text-white/40'}`}
          >
            <Zap size={18} className={isTestMode ? 'fill-white animate-pulse' : ''} />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">{isTestMode ? 'SIMULADOR ATIVO' : 'SINAL GPS REAL'}</span>
          </button>
        </div>
      </div>

      {/* BOOT Overlay (Sutil) */}
      {view === AppState.BOOT && (
        <div className="absolute inset-0 z-[2800] flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none animate-out fade-out duration-[2000] delay-[2000]">
           <div className="text-center">
             <div className="w-[1px] h-16 bg-blue-500 mx-auto mb-6 animate-[bounce_2s_infinite]"></div>
             <p className="text-[9px] font-black uppercase tracking-[1.5em] text-blue-400 animate-pulse translate-x-[0.75em]">Establishing Link</p>
           </div>
        </div>
      )}

      {/* HOME VIEW (UI Ready) */}
      {view === AppState.HOME && user && (
        <div className={`absolute inset-x-0 bottom-0 z-[1500] flex flex-col p-5 pointer-events-none transition-all duration-1000 ease-out transform ${isIntroReady ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <div className="flex justify-between items-center mb-4 pointer-events-auto bg-black/80 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-gray-900 border border-white/10 overflow-hidden shadow-inner">
                <img src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.nickname}`} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-black italic uppercase text-sm leading-none">{user.nickname}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[8px] font-black bg-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter shadow-[0_0_10px_rgba(37,99,235,0.5)]">AGENTE NÍVEL {user.level}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-2.5 bg-white/5 rounded-xl border border-white/10 active:scale-90 transition-all">
              <Globe size={20} className="text-blue-400" />
            </button>
          </div>
          <div className="pointer-events-auto relative">
            <button 
              onClick={() => { 
                if (!userLocation) return;
                setView(AppState.ACTIVE); 
                setCurrentActivity({ id: `act_${Date.now()}`, startTime: Date.now(), points: [userLocation!], fullPath: [userLocation!], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); 
              }} 
              className="w-full bg-blue-600 py-6 rounded-3xl font-black text-xl italic uppercase shadow-[0_0_40px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-blue-800"
            >
              <ActivityIcon size={24} className="animate-pulse" /> INICIAR INCURSÃO
            </button>
          </div>
        </div>
      )}

      {view === AppState.LEADERBOARD && (
        <Leaderboard 
          entries={Object.values(globalUsers).map((u: User) => ({ id: u.id, nickname: u.nickname, totalAreaM2: u.totalAreaM2 || 0, level: u.level || 1, color: u.color, avatarUrl: u.avatarUrl }))}
          currentUserId={user?.id || ''}
          onBack={() => setView(AppState.HOME)}
        />
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <div className="absolute inset-0 z-[1500] pointer-events-none">
          <ActivityOverlay activity={currentActivity} user={user} onStop={() => setView(AppState.SUMMARY)} />
        </div>
      )}
      
      {view === AppState.SUMMARY && currentActivity && user && (
        <MissionSummary 
          activity={currentActivity} 
          user={user} 
          onFinish={handleFinishMission} 
        />
      )}

      <style>{`
        .vignette-overlay {
          background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 120%);
        }
        .grain-overlay {
          background-image: url("https://grainy-gradients.vercel.app/noise.svg");
          opacity: 0.04;
          filter: contrast(150%) brightness(100%);
        }
        .scanlines {
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          background-size: 100% 2px, 3px 100%;
          opacity: 0.1;
        }
      `}</style>
    </div>
  );
};

export default App;
