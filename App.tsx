
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import { XP_PER_KM, XP_PER_SECTOR } from './constants';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import MissionSummary from './components/MissionSummary';
import { Radio, Zap, Globe, Activity as ActivityIcon, Bell, Navigation, Crosshair } from 'lucide-react';
import { playVictorySound } from './utils/audio';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [simSpeed, setSimSpeed] = useState(15); 
  const [simTarget, setSimTarget] = useState<Point | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, User>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [loginNickname, setLoginNickname] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const activityRef = useRef<Activity | null>(null);
  const userLocationRef = useRef<Point | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  // Login Persistência
  useEffect(() => {
    const saved = localStorage.getItem('dmn_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setView(AppState.HOME);
      } catch (e) { localStorage.removeItem('dmn_user_session'); }
    }
  }, []);

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

  // Motor de Simulação de Alta Performance (60 FPS)
  const animateSimulation = useCallback((time: number) => {
    if (lastUpdateRef.current !== undefined && simTarget && userLocationRef.current) {
      const deltaTime = (time - lastUpdateRef.current) / 1000; // segundos
      if (deltaTime > 0 && deltaTime < 0.1) { // Proteção contra saltos de frame
        const currentPos = userLocationRef.current;
        const dist = calculateDistance(currentPos, simTarget);

        if (dist < 0.5) {
          setSimTarget(null);
        } else {
          const speedMps = (simSpeed * 1000) / 3600;
          const moveDist = speedMps * deltaTime;
          const ratio = Math.min(moveDist / dist, 1);
          
          const nextPos = {
            lat: currentPos.lat + (simTarget.lat - currentPos.lat) * ratio,
            lng: currentPos.lng + (simTarget.lng - currentPos.lng) * ratio,
            timestamp: Date.now()
          };
          setUserLocation(nextPos);
        }
      }
    }
    lastUpdateRef.current = time;
    requestRef.current = requestAnimationFrame(animateSimulation);
  }, [simTarget, simSpeed]);

  useEffect(() => {
    if (isTestMode && simTarget) {
      requestRef.current = requestAnimationFrame(animateSimulation);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isTestMode, simTarget, animateSimulation]);

  // GPS Real
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

  // Game Loop: Processamento de Captura
  useEffect(() => {
    const activity = activityRef.current;
    const loc = userLocation;
    if (view === AppState.ACTIVE && loc && activity && user) {
      const points = activity.points;
      const lastPoint = points[points.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, loc) : 0;
      
      // No modo simulação o registro é mais frequente para curvas suaves
      const threshold = isTestMode ? 0.4 : 2.5; 
      
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
    localStorage.setItem('dmn_user_session', JSON.stringify(updatedUser));
    syncGlobalState([], updatedUser);
    setView(AppState.HOME);
    setCurrentActivity(null);
  };

  const handleAuth = async (action: 'login' | 'register') => {
    setLoginError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: loginNickname, password: loginPassword, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro de Conexão");
      const userWithDefaults = {
        ...data, xp: data.xp || 0, level: data.level || 1, totalAreaM2: data.total_area_m2 || 0,
        cells_owned: data.cells_owned || 0, color: data.color || '#3B82F6'
      };
      setUser(userWithDefaults);
      localStorage.setItem('dmn_user_session', JSON.stringify(userWithDefaults));
      setView(AppState.HOME);
    } catch (err: any) { setLoginError(err.message); }
  };

  return (
    <div className="h-full w-full bg-black text-white relative overflow-hidden font-sans select-none">
      {showConfetti && <ConfettiEffect />}
      
      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} cells={cells} users={globalUsers} 
          activeUserId={user?.id || ''} activeUser={user} 
          currentPath={currentActivity?.fullPath || []} activeTrail={currentActivity?.points || []} 
          onMapClick={(lat, lng) => isTestMode && setSimTarget({ lat, lng, timestamp: Date.now() })}
          simTarget={simTarget}
        />
      </div>
      
      {/* HUD DE SIMULAÇÃO REVISADO */}
      <div className="absolute top-12 inset-x-5 z-[2500] flex flex-col gap-2 pointer-events-none">
        <div className="flex justify-between items-start">
          <button 
            onClick={() => { setIsTestMode(!isTestMode); setSimTarget(null); }} 
            className={`pointer-events-auto p-3 rounded-xl border transition-all shadow-xl active:scale-90 flex items-center gap-2 ${isTestMode ? 'bg-orange-600 border-white text-white' : 'bg-black/60 border-white/10 text-white/40'}`}
          >
            <Zap size={18} className={isTestMode ? 'fill-white animate-pulse' : ''} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isTestMode ? 'SIMULADOR ATIVO' : 'MODO GPS REAL'}</span>
          </button>

          {isTestMode && (
            <div className="pointer-events-auto flex gap-1 bg-black/80 backdrop-blur-md border border-white/10 p-1 rounded-xl">
               {[10, 20, 40].map(s => (
                 <button 
                  key={s} 
                  onClick={() => setSimSpeed(s)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${simSpeed === s ? 'bg-orange-600 text-white' : 'text-white/30 hover:bg-white/5'}`}
                 >
                   {s === 40 ? 'RUN' : s === 20 ? 'JOG' : 'WALK'}
                 </button>
               ))}
            </div>
          )}
        </div>

        {isTestMode && simTarget && (
           <div className="bg-orange-600/20 backdrop-blur-md border border-orange-500/50 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2">
                <Navigation size={12} className="text-orange-500 animate-bounce" />
                <span className="text-[8px] font-black uppercase tracking-widest text-orange-200">A caminho do objetivo...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black italic text-white">{simSpeed} KM/H</span>
                <button onClick={() => setSimTarget(null)} className="pointer-events-auto p-1 hover:bg-white/10 rounded-md">
                   <Crosshair size={10} className="text-white/40" />
                </button>
              </div>
           </div>
        )}
      </div>

      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-black z-[3000] flex flex-col items-center justify-center p-8">
           <Radio size={40} className="text-blue-600 mb-4 animate-pulse" />
           <h1 className="text-4xl font-black italic mb-8 tracking-tighter uppercase">DmN</h1>
           <div className="w-full max-w-xs space-y-3">
              <input type="text" placeholder="CODENAME" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 transition-all uppercase font-black text-center text-sm" value={loginNickname} onChange={e => setLoginNickname(e.target.value)} />
              <input type="password" placeholder="KEY" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 transition-all uppercase font-black text-center text-sm" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              {loginError && <p className="text-red-500 text-[9px] font-black uppercase text-center mt-1">{loginError}</p>}
              <div className="flex gap-2 w-full pt-2">
                <button onClick={() => handleAuth('login')} className="flex-1 bg-white text-black p-4 rounded-xl font-black italic uppercase text-xs">LOGIN</button>
                <button onClick={() => handleAuth('register')} className="flex-1 bg-blue-600 p-4 rounded-xl font-black italic uppercase text-xs">JOIN</button>
              </div>
           </div>
        </div>
      )}

      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-0 z-[1500] flex flex-col p-5 pointer-events-none">
          <div className="flex justify-between items-center mb-3 pointer-events-auto bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <div className="flex gap-3 items-center" onClick={() => { localStorage.removeItem('dmn_user_session'); setUser(null); setView(AppState.LOGIN); }}>
              <div className="w-10 h-10 rounded-xl bg-gray-900 border border-white/10 overflow-hidden">
                <img src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.nickname}`} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-black italic uppercase text-sm leading-none">{user.nickname}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[8px] font-black bg-blue-600 px-1.5 py-0.5 rounded-full uppercase">LVL {user.level}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-2 bg-white/5 rounded-xl border border-white/10 active:scale-90 transition-all">
              <Globe size={18} className="text-blue-400" />
            </button>
          </div>
          <div className="pointer-events-auto relative">
            <button 
              onClick={() => { 
                setView(AppState.ACTIVE); 
                setCurrentActivity({ id: `act_${Date.now()}`, startTime: Date.now(), points: [userLocation!], fullPath: [userLocation!], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); 
              }} 
              className="w-full bg-blue-600 py-5 rounded-3xl font-black text-xl italic uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-blue-800"
            >
              <ActivityIcon size={22} /> INICIAR MISSÃO
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
    </div>
  );
};

export default App;
