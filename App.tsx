
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import { Radio, Zap, ShieldCheck, Target, Globe, Activity as ActivityIcon, Bell } from 'lucide-react';
import { generateBattleReport } from './services/gemini';
import { playVictorySound } from './utils/audio';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // Type globalUsers as Record<string, User> to avoid 'unknown' issues in Object.values
  const [globalUsers, setGlobalUsers] = useState<Record<string, User>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [battleReport, setBattleReport] = useState<string>('');
  const [loginNickname, setLoginNickname] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const activityRef = useRef<Activity | null>(null);
  useEffect(() => { activityRef.current = currentActivity; }, [currentActivity]);

  const syncGlobalState = useCallback(async (newCells: Cell[] = []) => {
    if (!user) return;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, location: userLocation, newCells, stats: user })
      });
      const data = await res.json();
      if (data.users) setGlobalUsers(data.users.reduce((acc: any, u: any) => ({ ...acc, [u.id]: u }), {}));
      if (data.cells) setCells(prev => ({ ...prev, ...data.cells }));
    } catch (e) { console.error("Sync failed"); }
  }, [user, userLocation]);

  useEffect(() => {
    if (isTestMode) {
      if (!userLocation) setUserLocation({ lat: -23.5505, lng: -46.6333, timestamp: Date.now() });
      return; 
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTestMode]);

  useEffect(() => {
    const activity = activityRef.current;
    if (view === AppState.ACTIVE && userLocation && activity && user) {
      const points = activity.points;
      const lastPoint = points[points.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, userLocation) : 0;
      const threshold = isTestMode ? 0.1 : 1.5;
      
      if (d > threshold) {
        const newPoints = [...points, userLocation];
        const newFullPath = [...(activity.fullPath || []), userLocation];
        if (newPoints.length > 3) {
          const pA = newPoints[newPoints.length - 2];
          const pB = newPoints[newPoints.length - 1];
          for (let i = 0; i < newPoints.length - 3; i++) {
            if (segmentsIntersect(pA, pB, newPoints[i], newPoints[i + 1])) {
              const polygon = [...newPoints.slice(i), userLocation];
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
                  ...prev, points: [userLocation], fullPath: newFullPath,
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

  const stopActivity = async () => {
    const activity = activityRef.current;
    if (!activity || !user) return;
    setView(AppState.SUMMARY);
    setBattleReport("Compilando relatório tático...");
    try {
      const report = await generateBattleReport(activity, user.nickname);
      setBattleReport(report);
    } catch { setBattleReport("Operação concluída. Solo neutralizado."); }
  };

  const handleAuth = async (action: 'login' | 'register') => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: loginNickname, password: loginPassword, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data); setView(AppState.HOME);
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
          onMapClick={(lat, lng) => isTestMode && setUserLocation({ lat, lng, timestamp: Date.now() })} 
        />
      </div>
      
      {/* MODO DE TESTE - SEMPRE ACESSÍVEL */}
      <button 
        onClick={() => setIsTestMode(!isTestMode)} 
        className={`absolute top-16 right-6 z-[2500] p-4 rounded-2xl border transition-all shadow-2xl active:scale-90 ${isTestMode ? 'bg-orange-600 border-white animate-pulse' : 'bg-black/60 border-white/10 text-white/40'}`}
      >
        <Zap size={20} className={isTestMode ? 'fill-white' : ''} />
      </button>

      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-black z-[3000] flex flex-col items-center justify-center p-8">
           <Radio size={48} className="text-blue-600 mb-6 animate-pulse" />
           <h1 className="text-5xl font-black italic mb-10 tracking-tighter uppercase">DmN</h1>
           <div className="w-full max-xs space-y-4">
              <input type="text" placeholder="CODENAME" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all uppercase font-black text-center" value={loginNickname} onChange={e => setLoginNickname(e.target.value)} />
              <input type="password" placeholder="CHAVE" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all uppercase font-black text-center" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center mt-2">{loginError}</p>}
              <div className="flex gap-3 w-full pt-4">
                <button onClick={() => handleAuth('login')} className="flex-1 bg-white text-black p-5 rounded-2xl font-black italic uppercase text-sm">LOGIN</button>
                <button onClick={() => handleAuth('register')} className="flex-1 bg-blue-600 p-5 rounded-2xl font-black italic uppercase text-sm">REGISTRAR</button>
              </div>
           </div>
        </div>
      )}

      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-0 z-[1500] flex flex-col p-6 pointer-events-none">
          {/* HEADER DE STATUS (QG) */}
          <div className="flex justify-between items-start mb-4 pointer-events-auto bg-black/40 backdrop-blur-md p-4 rounded-3xl border border-white/10">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-white/10 overflow-hidden">
                <img src={user.avatarUrl} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-black italic uppercase text-lg leading-none">{user.nickname}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black bg-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">LVL {user.level}</span>
                  <div className="h-1 w-20 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '65%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => setView(AppState.LEADERBOARD)} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
              <Globe size={20} className="text-blue-400" />
            </button>
          </div>

          {/* INTEL FEED (CONCORRENTE VIBES) */}
          <div className="mb-6 space-y-2 pointer-events-auto">
            <div className="bg-blue-600/10 border-l-4 border-blue-600 p-3 rounded-r-xl flex items-center gap-3 animate-in slide-in-from-left duration-700">
               <Bell size={14} className="text-blue-500" />
               <p className="text-[10px] font-bold uppercase tracking-tight text-blue-200">Setor vizinho neutralizado por <span className="text-white">Agente_Null</span></p>
            </div>
            <div className="bg-white/5 border-l-4 border-white/20 p-3 rounded-r-xl flex items-center gap-3 opacity-60">
               <Target size={14} />
               <p className="text-[10px] font-bold uppercase tracking-tight">3 zonas neutras detectadas a 200m</p>
            </div>
          </div>

          {/* BOTÃO START */}
          <div className="pointer-events-auto relative">
            <div className="absolute -inset-4 bg-blue-600/20 blur-3xl rounded-full animate-pulse"></div>
            <button 
              onClick={() => { 
                setView(AppState.ACTIVE); 
                setCurrentActivity({ id: `act_${Date.now()}`, startTime: Date.now(), points: [userLocation!], fullPath: [userLocation!], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); 
              }} 
              className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-[0_25px_60px_rgba(37,99,235,0.45)] active:scale-95 transition-all relative z-10 border-b-4 border-blue-800 flex items-center justify-center gap-4"
            >
              <ActivityIcon size={28} /> INICIAR CONQUISTA
            </button>
          </div>
          
          <div className="mt-6 flex justify-around opacity-30 pointer-events-auto pb-4">
             <div className="flex flex-col items-center gap-1"><ShieldCheck size={20} /><span className="text-[8px] font-black uppercase">Segurança</span></div>
             <div className="flex flex-col items-center gap-1"><Target size={20} /><span className="text-[8px] font-black uppercase">Objetivos</span></div>
             <div className="flex flex-col items-center gap-1"><Globe size={20} /><span className="text-[8px] font-black uppercase">Rede</span></div>
          </div>
        </div>
      )}

      {view === AppState.LEADERBOARD && (
        <Leaderboard 
          // Cast 'u' as 'User' to ensure properties like id, nickname, etc. are recognized by TypeScript
          entries={Object.values(globalUsers).map((u: User) => ({ id: u.id, nickname: u.nickname, totalAreaM2: u.totalAreaM2 || 0, level: u.level || 1, color: u.color }))}
          currentUserId={user?.id || ''}
          onBack={() => setView(AppState.HOME)}
        />
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <div className="absolute inset-0 z-[1500] pointer-events-none">
          <ActivityOverlay activity={currentActivity} user={user} onStop={stopActivity} />
        </div>
      )}
      
      {view === AppState.SUMMARY && (
        <div className="absolute inset-0 bg-black z-[3000] p-10 flex flex-col">
          <h2 className="text-5xl font-black italic mb-10 pt-16 tracking-tighter leading-none">SUMÁRIO DE<br/>OPERATIVO</h2>
          <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex-1 mb-10 overflow-y-auto shadow-inner relative">
            <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck size={120} /></div>
            <p className="text-blue-500 text-[10px] font-black mb-4 uppercase tracking-[0.4em]">Canal Seguro DmN:</p>
            <p className="text-2xl italic font-bold leading-snug">"{battleReport}"</p>
          </div>
          <button onClick={() => setView(AppState.HOME)} className="w-full bg-white text-black py-7 rounded-[2.5rem] font-black italic uppercase text-xl shadow-2xl active:scale-95 transition-all">RETORNAR AO QG</button>
        </div>
      )}
    </div>
  );
};

export default App;
