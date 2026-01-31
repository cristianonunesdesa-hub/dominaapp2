
import React, { useState, useEffect } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { TACTICAL_COLORS } from './constants';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import { Radio, Settings, Zap, MapPin } from 'lucide-react';

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, any>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);

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
    const lastSession = localStorage.getItem('dmn_session');
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
    if (isTestMode) {
      if (!userLocation) {
        setUserLocation({ lat: -23.5505, lng: -46.6333, timestamp: Date.now() });
      }
      return; 
    }
    
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
      (err) => console.warn("GPS Error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTestMode]);

  const handleMapClick = (lat: number, lng: number) => {
    if (isTestMode) {
      const newPoint = { lat, lng, timestamp: Date.now() };
      setUserLocation(newPoint);
    }
  };

  useEffect(() => {
    if (view === AppState.ACTIVE && userLocation && currentActivity && user) {
      const points = [...currentActivity.points];
      const lastPoint = points[points.length - 1];
      
      if (lastPoint) {
        const d = calculateDistance(lastPoint, userLocation);
        const threshold = isTestMode ? 0.05 : 1.2; // Threshold ainda menor para cliques
        
        if (d > threshold) {
          const newPoints = [...points, userLocation];
          const newFullPath = [...currentActivity.fullPath, userLocation];
          
          if (newPoints.length > 3) {
            const pA = newPoints[newPoints.length - 2];
            const pB = newPoints[newPoints.length - 1];
            
            // Verificação de interseção para fechar o polígono
            for (let i = 0; i < newPoints.length - 3; i++) {
              if (segmentsIntersect(pA, pB, newPoints[i], newPoints[i + 1])) {
                const polygon = [...newPoints.slice(i), newPoints[i]];
                const enclosedIds = getEnclosedCellIds(polygon);
                
                if (enclosedIds.length > 0) {
                  const syncCells: Cell[] = [];
                  enclosedIds.forEach(id => {
                    if (!currentActivity.capturedCellIds.has(id)) {
                      const c: Cell = { id, ownerId: user.id, ownerNickname: user.nickname, bounds: [0,0,0,0], updatedAt: Date.now(), defense: 1 };
                      syncCells.push(c);
                      currentActivity.capturedCellIds.add(id);
                    }
                  });
                  syncGlobalState(syncCells); 
                  // Resetar a trilha de "desenho" mas manter o histórico total no fullPath
                  setCurrentActivity({ 
                    ...currentActivity, 
                    points: [userLocation], 
                    fullPath: newFullPath, 
                    distanceMeters: currentActivity.distanceMeters + d 
                  });
                  return;
                }
              }
            }
          }
          setCurrentActivity({ ...currentActivity, points: newPoints, fullPath: newFullPath, distanceMeters: currentActivity.distanceMeters + d });
        }
      }
    }
  }, [userLocation, view, isTestMode]);

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
      localStorage.setItem('dmn_session', JSON.stringify(data));
      setView(AppState.HOME);
    } catch (err: any) { setLoginError(err.message); }
  };

  const startRun = () => {
    if (!userLocation && !isTestMode) return alert("Buscando satélites...");
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
      
      <button 
        onClick={() => setIsTestMode(!isTestMode)}
        className={`absolute top-[60px] right-6 z-[1000] p-4 rounded-[22px] border shadow-2xl transition-all active:scale-90 ${isTestMode ? 'bg-orange-600 border-white text-white' : 'bg-black/60 border-white/10 text-white/40'}`}
      >
        <Zap size={22} className={isTestMode ? 'fill-white' : ''} />
      </button>

      {isTestMode && (
        <div className="absolute top-[60px] left-1/2 -translate-x-1/2 z-[1000] bg-orange-600/90 backdrop-blur-md px-6 py-2 rounded-2xl flex flex-col items-center shadow-2xl border border-white/20">
           <span className="text-[10px] font-black uppercase tracking-widest text-white">MODO SIMULAÇÃO</span>
           <div className="text-[8px] font-bold text-white/70 uppercase">Clique no mapa para mover o agente</div>
        </div>
      )}

      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} 
          cells={cells} 
          users={globalUsers} 
          activeUserId={user?.id || ''} 
          activeUser={user}
          currentPath={currentActivity?.fullPath || []} 
          activeTrail={currentActivity?.points || []}
          onMapClick={handleMapClick}
        />
      </div>

      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-[#080808] z-[500] flex flex-col items-center justify-center p-8">
           <div className="text-center mb-12">
              <div className="w-20 h-20 bg-blue-600 rounded-[28px] mx-auto mb-6 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.3)]">
                <Radio size={40} />
              </div>
              <h1 className="text-5xl font-black italic tracking-tighter uppercase">DmN</h1>
           </div>
           <div className="w-full max-w-xs space-y-4">
              <input type="text" placeholder="AGENTE" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 uppercase font-black text-center focus:border-blue-500 outline-none transition-all" value={loginNickname} onChange={e => setLoginNickname(e.target.value)} />
              <input type="password" placeholder="SENHA" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 uppercase font-black text-center focus:border-blue-500 outline-none transition-all" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              {loginError && <p className="text-red-500 text-[10px] font-bold uppercase text-center">{loginError}</p>}
              <div className="flex gap-2 pt-4">
                <button onClick={() => handleAuth('login')} className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase italic">Login</button>
                <button onClick={() => handleAuth('register')} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black uppercase italic">Criar</button>
              </div>
           </div>
        </div>
      )}

      {view === AppState.HOME && user && (
        <div className="absolute inset-x-0 bottom-0 p-8 z-50">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Protocolo Ativo</p>
              <h2 className="text-2xl font-black italic uppercase leading-none">{user.nickname}</h2>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${userLocation ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest">Rede: {userLocation ? 'ONLINE' : 'OFF'}</span>
            </div>
          </div>
          <button 
            onClick={startRun}
            className="w-full bg-blue-600 h-20 rounded-[32px] font-black text-2xl uppercase italic tracking-tighter shadow-[0_20px_60px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            INICIAR CONQUISTA
          </button>
        </div>
      )}

      {view === AppState.TUTORIAL && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xl z-[600] flex items-center justify-center p-8">
          <div className="w-full max-w-sm bg-[#121212] rounded-[48px] p-10 border border-white/10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-start gap-4 mb-8">
               <div className="w-14 h-14 bg-blue-600 rounded-[20px] flex-shrink-0 flex items-center justify-center font-black italic text-xl shadow-lg text-white">DmN</div>
               <p className="text-[14px] font-bold text-white/90 leading-tight pt-1 uppercase italic tracking-tight">
                 Cerque o território. O grid sincroniza quando você fecha o polígono tático.
               </p>
            </div>
            <button 
              onClick={confirmTutorial}
              className="w-full bg-white text-black py-5 rounded-[24px] font-black uppercase text-lg italic tracking-tighter shadow-xl active:scale-95 transition-all"
            >
              INICIAR PROTOCOLO
            </button>
          </div>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && (
        <ActivityOverlay 
          activity={currentActivity} 
          user={user} 
          onStop={() => setView(AppState.HOME)} 
        />
      )}
    </div>
  );
};

export default App;
