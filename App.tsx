
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { COLORS, TACTICAL_COLORS, CELL_AREA_M2, XP_PER_KM, XP_PER_SECTOR } from './constants';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import { playVictorySound } from './utils/audio';
import { generateBattleReport } from './services/gemini';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import AvatarCustomizer from './components/AvatarCustomizer';
import { Trophy, User as UserIcon, Zap, CheckCircle2, Radio, Lock, AlertCircle, RefreshCw, Cpu, UserPlus, LogIn } from 'lucide-react';

const CLOSE_LOOP_THRESHOLD_METERS = 35; 
const LEVEL_XP_STEP = 1000;

// Função simples para gerar um hash do nickname e escolher uma cor única
const getDeterministicColor = (nickname: string) => {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TACTICAL_COLORS.length;
  return TACTICAL_COLORS[index];
};

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [isAutoSimulating, setIsAutoSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(25); 
  const [targetLocation, setTargetLocation] = useState<Point | null>(null);
  const [plannedRoute, setPlannedRoute] = useState<Point[]>([]);
  const currentRouteIndexRef = useRef(0);

  const [user, setUser] = useState<User | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, any>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [summary, setSummary] = useState<{ report: string; activity: Activity; loopClosed: boolean; areaM2: number; areaNeutralizedM2: number; xpGained: number; newBadges: string[] } | null>(null);
  const [isLoopClosable, setIsLoopClosable] = useState(false);

  const [loginNickname, setLoginNickname] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const syncGlobalState = async (newCapturedCells: Cell[] = []) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          location: userLocation,
          newCells: newCapturedCells,
          stats: { xp: user.xp, level: user.level, totalAreaM2: user.totalAreaM2, cellsOwned: user.cellsOwned }
        })
      });
      const data = await res.json();
      if (data.users) {
        const userMap: Record<string, any> = {};
        data.users.forEach((u: any) => userMap[u.id] = u);
        setGlobalUsers(userMap);
      }
      if (data.cells) {
        setCells(prev => {
          const merged = { ...prev };
          Object.keys(data.cells).forEach(id => {
            if (merged[id]?.ownerId === user.id) return;
            merged[id] = data.cells[id];
          });
          return merged;
        });
      }
    } catch (e) {
      console.warn("Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const lastSession = localStorage.getItem('domina_current_session');
    if (lastSession) {
      try {
        const savedUser = JSON.parse(lastSession);
        setUser(savedUser);
        setView(AppState.HOME);
      } catch (e) {
        localStorage.removeItem('domina_current_session');
      }
    }
  }, []);

  useEffect(() => {
    if (!user || view === AppState.LOGIN) return;
    const interval = setInterval(() => syncGlobalState(), 10000);
    syncGlobalState();
    return () => clearInterval(interval);
  }, [user?.id, view]);

  useEffect(() => {
    if (isSimulating) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp }),
      (err) => console.error("GPS Signal Missing:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSimulating]);

  useEffect(() => {
    if (!isAutoSimulating || !isSimulating || plannedRoute.length === 0) return;
    const moveInterval = setInterval(() => {
      setUserLocation(current => {
        if (!current) return null;
        const target = plannedRoute[currentRouteIndexRef.current];
        if (!target) { setIsAutoSimulating(false); return current; }
        const dist = calculateDistance(current, target);
        if (dist < 1.5) {
          if (currentRouteIndexRef.current < plannedRoute.length - 1) currentRouteIndexRef.current++;
          else setIsAutoSimulating(false);
          return current;
        }
        const stepMeters = (simulationSpeed / 3.6) * 0.1;
        const ratio = Math.min(stepMeters / dist, 1);
        return { lat: current.lat + (target.lat - current.lat) * ratio, lng: current.lng + (target.lng - current.lng) * ratio, timestamp: Date.now() };
      });
    }, 100);
    return () => clearInterval(moveInterval);
  }, [isAutoSimulating, isSimulating, plannedRoute, simulationSpeed]);

  const handleMapClick = (lat: number, lng: number) => {
    if (!isSimulating) return;
    const point = { lat, lng, timestamp: Date.now() };
    setTargetLocation(point);
    if (!userLocation) setUserLocation(point);
    else {
      fetch(`https://router.project-osrm.org/route/v1/foot/${userLocation.lng},${userLocation.lat};${point.lng},${point.lat}?overview=full&geometries=geojson`)
        .then(r => r.json()).then(data => {
          if (data.routes?.[0]) {
            setPlannedRoute(data.routes[0].geometry.coordinates.map((c: any) => ({ lng: c[0], lat: c[1], timestamp: Date.now() })));
            currentRouteIndexRef.current = 0;
            setIsAutoSimulating(true);
          }
        }).catch(() => { setPlannedRoute([point]); currentRouteIndexRef.current = 0; setIsAutoSimulating(true); });
    }
  };

  useEffect(() => {
    if (view === AppState.ACTIVE && userLocation && currentActivity && !isFinishing && user) {
      const points = currentActivity.points;
      const lastPoint = points[points.length - 1];
      if (currentActivity.fullPath.length > 5) setIsLoopClosable(calculateDistance(userLocation, currentActivity.fullPath[0]) < CLOSE_LOOP_THRESHOLD_METERS);
      if (lastPoint) {
        const d = calculateDistance(lastPoint, userLocation);
        if (d > (isSimulating ? 0.2 : 0.8)) {
          const newPoints = [...points, userLocation];
          const newFullPath = [...currentActivity.fullPath, userLocation];
          if (newPoints.length > 5) {
            const pA = newPoints[newPoints.length - 2];
            const pB = newPoints[newPoints.length - 1];
            for (let i = 0; i < newPoints.length - 5; i++) {
              if (segmentsIntersect(pA, pB, newPoints[i], newPoints[i + 1])) {
                const enclosedIds = getEnclosedCellIds([...newPoints.slice(i), newPoints[i]]);
                if (enclosedIds.length > 0) {
                  const updatedCells: Record<string, Cell> = {};
                  const syncCells: Cell[] = [];
                  enclosedIds.forEach(id => {
                    if (cells[id] && cells[id].ownerId !== user.id) currentActivity.stolenCellIds.add(id);
                    const newCell: Cell = { id, ownerId: user.id, ownerNickname: user.nickname, bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1 };
                    updatedCells[id] = newCell;
                    syncCells.push(newCell);
                    currentActivity.capturedCellIds.add(id);
                  });
                  setCells(prev => ({ ...prev, ...updatedCells }));
                  syncGlobalState(syncCells); 
                  setCurrentActivity({ ...currentActivity, points: [...newPoints.slice(0, i + 1), userLocation], fullPath: newFullPath, distanceMeters: currentActivity.distanceMeters + d });
                  if ('vibrate' in navigator) navigator.vibrate([80, 50, 80]);
                  return;
                }
              }
            }
          }
          setCurrentActivity({ ...currentActivity, points: newPoints, fullPath: newFullPath, distanceMeters: currentActivity.distanceMeters + d });
        }
      }
    }
  }, [userLocation, view]);

  const finishRun = async () => {
    if (!currentActivity || !userLocation || isFinishing || !user) return;
    setIsFinishing(true);
    try {
      const originalStart = currentActivity.fullPath[0];
      const loopClosed = calculateDistance(originalStart, userLocation) <= CLOSE_LOOP_THRESHOLD_METERS;
      let xpGained = Math.floor((currentActivity.distanceMeters / 1000) * XP_PER_KM) + (currentActivity.capturedCellIds.size * XP_PER_SECTOR);
      const newCellsList: Cell[] = [];
      const localCapture: Record<string, Cell> = {};
      
      if (loopClosed) {
        getEnclosedCellIds([...currentActivity.points, userLocation, originalStart]).forEach(id => {
          const c: Cell = { id, ownerId: user.id, ownerNickname: user.nickname, bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1 };
          newCellsList.push(c);
          localCapture[id] = c;
        });
      }
      
      setCells(prev => ({ ...prev, ...localCapture }));
      
      const cellsOwnedCount = (Object.values(cells) as Cell[]).filter(c => c.ownerId === user.id).length + newCellsList.length;
      let newXp = user.xp + xpGained;
      let newLevel = user.level;
      while (newXp >= (newLevel * LEVEL_XP_STEP)) { newXp -= (newLevel * LEVEL_XP_STEP); newLevel++; }
      const updatedUser = { ...user, xp: newXp, level: newLevel, cellsOwned: cellsOwnedCount, totalAreaM2: cellsOwnedCount * CELL_AREA_M2 };
      setUser(updatedUser);
      localStorage.setItem('domina_current_session', JSON.stringify(updatedUser));
      await syncGlobalState(newCellsList);
      setSummary({ report: "Analizando incursion...", activity: currentActivity, loopClosed, areaM2: newCellsList.length * CELL_AREA_M2, areaNeutralizedM2: currentActivity.stolenCellIds.size * CELL_AREA_M2, xpGained, newBadges: [] });
      setView(AppState.SUMMARY);
      playVictorySound();
      setShowConfetti(true);
      generateBattleReport(currentActivity, user.nickname).then(t => setSummary(s => s ? { ...s, report: t } : null));
    } finally { setIsFinishing(false); setCurrentActivity(null); }
  };

  const handleAuth = async (action: 'login' | 'register') => {
    setLoginError(null);
    if (loginNickname.length < 3) return setLoginError("Nickname deve ter 3+ caracteres.");
    if (loginPassword.length < 4) return setLoginError("Senha deve ter 4+ caracteres.");
    setIsSyncing(true);
    
    // Cor única para cada nome de usuário
    const selectedColor = getDeterministicColor(loginNickname.toLowerCase().trim());

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: loginNickname, password: loginPassword, color: selectedColor, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro de rede.");
      const mappedUser: User = { id: data.id, nickname: data.nickname, password: data.password, color: data.color, avatarUrl: data.avatar_url, xp: data.xp || 0, level: data.level || 1, totalAreaM2: data.total_area_m2 || 0, cellsOwned: data.cells_owned || 0, badges: [], dailyStreak: 1 };
      setUser(mappedUser);
      localStorage.setItem('domina_current_session', JSON.stringify(mappedUser));
      setView(AppState.HOME);
    } catch (err: any) { setLoginError(err.message); } finally { setIsSyncing(false); }
  };

  if (view === AppState.LOGIN || !user) {
    return (
      <div className="absolute inset-0 bg-black z-[200] flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="mb-10 text-center animate-pulse">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)]">
            <Radio size={40} className="text-white" />
          </div>
          <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none text-white">DOMINA</h1>
          <p className="text-[10px] font-black text-blue-400 tracking-[0.4em] mt-3">SISTEMA DE DOMÍNIO TÁTICO</p>
        </div>
        <div className="w-full max-w-xs space-y-4">
          {loginError && <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-2xl text-[11px] text-red-200 uppercase font-black flex items-center gap-2 animate-bounce"> <AlertCircle size={14} /> {loginError} </div>}
          <div className="space-y-1">
            <input type="text" placeholder="CODINOME AGENTE" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black uppercase text-white outline-none focus:border-blue-500 italic placeholder:text-white/20" value={loginNickname} onChange={(e) => setLoginNickname(e.target.value)} />
            <input type="password" placeholder="CHAVE DE ACESSO" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-black uppercase text-white outline-none focus:border-blue-500 italic placeholder:text-white/20" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleAuth('login')} disabled={isSyncing} className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 active:scale-95 transition-all"> <LogIn size={18} /> ENTRAR </button>
            <button onClick={() => handleAuth('register')} disabled={isSyncing} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 active:scale-95 transition-all border border-blue-400 shadow-xl"> <UserPlus size={18} /> NOVO </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden font-sans select-none bg-black text-white">
      {showConfetti && <ConfettiEffect />}
      {view === AppState.LEADERBOARD && <Leaderboard entries={Object.values(globalUsers)} currentUserId={user.id} onBack={() => setView(AppState.HOME)} />}
      {view === AppState.PROFILE && (
        <AvatarCustomizer 
          currentAvatar={user.avatarUrl} 
          userColor={user.color} 
          onBack={() => setView(AppState.HOME)} 
          onSave={(url, color) => { 
            const u = { ...user, avatarUrl: url, color: color }; 
            setUser(u); 
            localStorage.setItem('domina_current_session', JSON.stringify(u)); 
            syncGlobalState();
            setView(AppState.HOME); 
          }} 
        />
      )}
      <div className={`absolute inset-0 z-0 transition-all duration-700 ${[AppState.SUMMARY, AppState.PROFILE, AppState.LEADERBOARD].includes(view) ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
        <GameMap 
          userLocation={userLocation} 
          cells={cells} 
          users={globalUsers} 
          activeUserId={user.id} 
          activeUser={user}
          currentPath={currentActivity?.fullPath || []} 
          activeTrail={currentActivity?.points || []} 
          showLoopPreview={isLoopClosable || isFinishing} 
          originalStartPoint={currentActivity?.fullPath[0]} 
          onMapClick={handleMapClick} 
          targetLocation={targetLocation} 
          plannedRoute={plannedRoute} 
        />
      </div>
      <div className="absolute top-12 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
        <button onClick={() => setIsSimulating(!isSimulating)} className={`p-3 rounded-2xl border flex items-center justify-center transition-all shadow-2xl pointer-events-auto ${isSimulating ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/60 border-white/10 text-white/40'}`}> <Cpu size={22} /> </button>
        <button onClick={() => { localStorage.removeItem('domina_current_session'); setUser(null); setView(AppState.LOGIN); }} className="p-3 rounded-2xl border bg-red-600/20 border-red-500/30 text-red-500 pointer-events-auto shadow-xl"> <Radio size={22} className="rotate-180" /> </button>
      </div>
      {view === AppState.HOME && (
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-6 pointer-events-none">
          <div className="flex justify-between items-start w-full pointer-events-auto mt-6">
            <button onClick={() => setView(AppState.PROFILE)} className="bg-gray-950/90 backdrop-blur-2xl px-4 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3 active:scale-95 transition-all">
              <div className="w-10 h-10 rounded-xl bg-gray-800 border border-white/10 overflow-hidden"> <img src={user.avatarUrl} className="w-full h-full object-cover" /> </div>
              <div className="text-left"> <div className="text-[9px] font-black text-blue-500 uppercase leading-none">{user.nickname}</div> <div className="text-[12px] font-black italic mt-1 text-white">LVL {user.level}</div> </div>
            </button>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="bg-gray-950/90 backdrop-blur-2xl px-4 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-2 active:scale-95 transition-all"> <Trophy size={16} className="text-yellow-500" /> <div className="text-[10px] font-black uppercase">Ranking</div> </button>
          </div>
          <div className="flex flex-col items-center gap-6 pointer-events-auto mb-12">
            <button onClick={() => { if (!userLocation) return alert("Sinal GPS insuficiente."); setCurrentActivity({ id: `act_${Date.now()}`, startTime: Date.now(), points: [userLocation], fullPath: [userLocation], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); setView(AppState.ACTIVE); }} className="px-12 h-20 bg-blue-600 rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.5)] active:scale-95 flex items-center justify-center gap-4 text-white"> <Zap size={28} className="fill-white" /> <span className="font-black text-2xl uppercase tracking-tighter italic">INICIAR CONQUISTA</span> </button>
          </div>
        </div>
      )}
      {view === AppState.ACTIVE && currentActivity && ( <ActivityOverlay activity={currentActivity} onStop={finishRun} isFinishing={isFinishing} /> )}
      {view === AppState.SUMMARY && summary && (
        <div className="absolute inset-0 bg-black/95 z-[150] flex flex-col items-center justify-center p-8 overflow-y-auto animate-in fade-in duration-500">
          <img src={user.avatarUrl} className="w-24 h-24 rounded-full border-2 border-blue-500 mb-6 shadow-2xl" />
          <h2 className="text-[40px] font-black uppercase italic leading-none tracking-tighter text-white text-center mb-6">INCURSÃO<br/>FINALIZADA</h2>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-10">
             <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/10 flex flex-col items-center"> <div className="text-[9px] font-bold text-gray-500 uppercase">Área</div> <div className="text-xl font-black italic">{summary.areaM2} m²</div> </div>
             <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/10 flex flex-col items-center"> <div className="text-[9px] font-bold text-gray-500 uppercase">XP</div> <div className="text-xl font-black italic text-emerald-400">+{summary.xpGained}</div> </div>
          </div>
          <p className="italic text-gray-400 text-sm text-center max-w-sm mb-12 leading-relaxed">"{summary.report}"</p>
          <button className="w-full max-w-sm bg-blue-600 py-5 rounded-3xl font-black text-lg uppercase italic shadow-xl active:scale-95 transition-all" onClick={() => { setView(AppState.HOME); setShowConfetti(false); }}> VOLTAR AO QG </button>
        </div>
      )}
    </div>
  );
};

export default App;
