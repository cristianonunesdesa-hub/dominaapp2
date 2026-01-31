
import React, { useState, useEffect, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { TACTICAL_COLORS, CELL_AREA_M2, XP_PER_KM, XP_PER_SECTOR } from './constants';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import { playVictorySound } from './utils/audio';
import { generateBattleReport } from './services/gemini';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import Leaderboard from './components/Leaderboard';
import AvatarCustomizer from './components/AvatarCustomizer';
import { Trophy, Zap, Radio, AlertCircle, Cpu, UserPlus, LogIn } from 'lucide-react';

const CLOSE_LOOP_THRESHOLD_METERS = 35; 
const LEVEL_XP_STEP = 1000;

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
  const [user, setUser] = useState<User | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, any>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const [loginNickname, setLoginNickname] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const syncGlobalState = async (newCapturedCells: Cell[] = []) => {
    if (!user) return;
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
      if (data.users) setGlobalUsers(data.users.reduce((acc: any, u: any) => ({ ...acc, [u.id]: u }), {}));
      if (data.cells) setCells(data.cells);
    } catch (e) { console.warn("Sync error", e); }
  };

  useEffect(() => {
    const lastSession = localStorage.getItem('domina_current_session');
    if (lastSession) {
      setUser(JSON.parse(lastSession));
      setView(AppState.HOME);
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
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
      null,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSimulating]);

  useEffect(() => {
    if (view === AppState.ACTIVE && userLocation && currentActivity && !isFinishing && user) {
      const points = currentActivity.points;
      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        const d = calculateDistance(lastPoint, userLocation);
        if (d > 0.8) {
          const newPoints = [...points, userLocation];
          const newFullPath = [...currentActivity.fullPath, userLocation];
          
          if (newPoints.length > 5) {
            const pA = newPoints[newPoints.length - 2];
            const pB = newPoints[newPoints.length - 1];
            for (let i = 0; i < newPoints.length - 5; i++) {
              if (segmentsIntersect(pA, pB, newPoints[i], newPoints[i + 1])) {
                const enclosedIds = getEnclosedCellIds([...newPoints.slice(i), newPoints[i]]);
                if (enclosedIds.length > 0) {
                  const syncCells: Cell[] = [];
                  enclosedIds.forEach(id => {
                    const c: Cell = { id, ownerId: user.id, ownerNickname: user.nickname, bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1 };
                    syncCells.push(c);
                    currentActivity.capturedCellIds.add(id);
                  });
                  syncGlobalState(syncCells); 
                  setCurrentActivity({ ...currentActivity, points: [...newPoints.slice(0, i + 1), userLocation], fullPath: newFullPath, distanceMeters: currentActivity.distanceMeters + d });
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

  const handleAuth = async (action: 'login' | 'register') => {
    const selectedColor = getDeterministicColor(loginNickname.toLowerCase());
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: loginNickname, password: loginPassword, color: selectedColor, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data);
      localStorage.setItem('domina_current_session', JSON.stringify(data));
      setView(AppState.HOME);
    } catch (err: any) { setLoginError(err.message); }
  };

  const startRun = () => {
    if (!userLocation) return alert("Buscando satélites...");
    setView(AppState.TUTORIAL);
  };

  const confirmTutorial = () => {
    setCurrentActivity({ 
      id: `act_${Date.now()}`, 
      startTime: Date.now(), 
      points: [userLocation!], 
      fullPath: [userLocation!], 
      capturedCellIds: new Set(), 
      stolenCellIds: new Set(), 
      distanceMeters: 0, 
      isValid: true, 
      strategicZonesEntered: 0 
    });
    setView(AppState.ACTIVE);
  };

  return (
    <div className="relative h-full w-full bg-black overflow-hidden font-sans">
      {showConfetti && <ConfettiEffect />}
      
      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} 
          cells={cells} 
          users={globalUsers} 
          activeUserId={user?.id || ''} 
          activeUser={user}
          currentPath={currentActivity?.fullPath || []} 
          activeTrail={currentActivity?.points || []} 
        />
      </div>

      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-[#0b0d11] z-[500] flex flex-col items-center justify-center p-8">
           <div className="text-center mb-12">
              <div className="w-20 h-20 bg-blue-600 rounded-[28px] mx-auto mb-6 flex items-center justify-center shadow-2xl">
                <Radio size={40} />
              </div>
              <h1 className="text-5xl font-black italic tracking-tighter uppercase">DOMINA</h1>
           </div>
           <div className="w-full max-w-xs space-y-4">
              <input type="text" placeholder="AGENTE" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 uppercase font-black" value={loginNickname} onChange={e => setLoginNickname(e.target.value)} />
              <input type="password" placeholder="SENHA" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 uppercase font-black" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => handleAuth('login')} className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase italic">Login</button>
                <button onClick={() => handleAuth('register')} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black uppercase italic">Criar</button>
              </div>
           </div>
        </div>
      )}

      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-0 p-8 z-50">
          <button 
            onClick={startRun}
            className="w-full bg-blue-600 h-20 rounded-[32px] font-black text-2xl uppercase italic tracking-tighter shadow-[0_20px_60px_rgba(37,99,235,0.4)] active:scale-95 transition-all"
          >
            INICIAR CONQUISTA
          </button>
        </div>
      )}

      {view === AppState.TUTORIAL && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xl z-[600] flex items-center justify-center p-8">
          <div className="w-full max-w-sm bg-[#151515] rounded-[48px] p-12 border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,1)] animate-in zoom-in duration-300">
            <div className="flex items-start gap-5 mb-10">
               <div className="w-16 h-16 bg-[#FF3B30] rounded-[22px] flex-shrink-0 flex items-center justify-center font-black italic text-xl shadow-lg shadow-red-500/20">DmN</div>
               <p className="text-[15px] font-bold text-white leading-snug pt-1">
                 Corra para conquistar o território, mas garanta que o ponto de início e fim estejam a menos de 200m para valer!
               </p>
            </div>
            <button 
              onClick={confirmTutorial}
              className="w-full bg-white text-black py-6 rounded-[28px] font-[900] uppercase text-xl tracking-wide shadow-xl active:scale-95 transition-all"
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <ActivityOverlay 
          activity={currentActivity} 
          user={user} 
          onStop={() => { setView(AppState.SUMMARY); setSummary({ report: "Missão Finalizada" }); }} 
        />
      )}
    </div>
  );
};

export default App;
