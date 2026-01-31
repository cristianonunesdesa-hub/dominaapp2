
import React, { useState, useEffect, useCallback } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { TACTICAL_COLORS } from './constants';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import { Radio, Zap, ChevronRight, ShieldCheck } from 'lucide-react';
import { generateBattleReport } from './services/gemini';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [globalUsers, setGlobalUsers] = useState<Record<string, any>>({});
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [battleReport, setBattleReport] = useState<string>('');
  const [loginNickname, setLoginNickname] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

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

  // GPS / Modo de Teste
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

  // Lógica de Movimentação e Captura
  useEffect(() => {
    if (view === AppState.ACTIVE && userLocation && currentActivity && user) {
      const points = currentActivity.points;
      const lastPoint = points[points.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, userLocation) : 0;
      
      // No modo de teste (clique), qualquer distância > 0.1m registra movimento
      const threshold = isTestMode ? 0.1 : 1.5;
      
      if (d > threshold) {
        const newPoints = [...points, userLocation];
        const newFullPath = [...(currentActivity.fullPath || []), userLocation];

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
                setTimeout(() => setShowConfetti(false), 2000);

                // Reset do rastro para novo polígono
                setCurrentActivity({ 
                  ...currentActivity, 
                  points: [userLocation], 
                  fullPath: newFullPath,
                  capturedCellIds: new Set([...currentActivity.capturedCellIds, ...enclosedIds]) 
                });
                return;
              }
            }
          }
        }
        setCurrentActivity({ 
          ...currentActivity, 
          points: newPoints, 
          fullPath: newFullPath,
          distanceMeters: currentActivity.distanceMeters + d 
        });
      }
    }
  }, [userLocation, view, isTestMode, currentActivity, user, syncGlobalState]);

  const stopActivity = async () => {
    if (!currentActivity || !user) return;
    setView(AppState.SUMMARY);
    setBattleReport("Compilando dados táticos...");
    try {
      const report = await generateBattleReport(currentActivity, user.nickname);
      setBattleReport(report);
    } catch { setBattleReport("Operação finalizada."); }
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
    <div className="h-full w-full bg-black text-white relative overflow-hidden font-sans">
      {showConfetti && <ConfettiEffect />}
      
      {/* MAPA NA CAMADA 0 */}
      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={userLocation} 
          cells={cells} 
          users={globalUsers} 
          activeUserId={user?.id || ''} 
          activeUser={user} 
          currentPath={currentActivity?.fullPath || []} 
          activeTrail={currentActivity?.points || []} 
          onMapClick={(lat, lng) => isTestMode && setUserLocation({ lat, lng, timestamp: Date.now() })} 
        />
      </div>
      
      {/* BOTÃO TESTE (Z-1100) */}
      <button 
        onClick={() => setIsTestMode(!isTestMode)} 
        className={`absolute top-14 right-6 z-[1100] p-4 rounded-2xl border transition-all shadow-2xl active:scale-90 ${isTestMode ? 'bg-orange-600 border-white' : 'bg-black/60 border-white/10 text-white/40'}`}
      >
        <Zap size={20} className={isTestMode ? 'fill-white' : ''} />
      </button>

      {/* LOGIN (Z-2000) */}
      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-8">
           <Radio size={48} className="text-blue-600 mb-6 animate-pulse" />
           <h1 className="text-5xl font-black italic mb-10 tracking-tighter uppercase">DmN</h1>
           <div className="w-full max-w-xs space-y-4">
              <input type="text" placeholder="AGENTE" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all uppercase font-black text-center" value={loginNickname} onChange={e => setLoginNickname(e.target.value)} />
              <input type="password" placeholder="SENHA" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all uppercase font-black text-center" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              {loginError && <p className="text-red-500 text-[10px] font-black uppercase text-center mt-2">{loginError}</p>}
              <div className="flex gap-3 w-full pt-4">
                <button onClick={() => handleAuth('login')} className="flex-1 bg-white text-black p-5 rounded-2xl font-black italic uppercase text-sm">LOGIN</button>
                <button onClick={() => handleAuth('register')} className="flex-1 bg-blue-600 p-5 rounded-2xl font-black italic uppercase text-sm">CRIAR</button>
              </div>
           </div>
        </div>
      )}

      {/* HOME (Z-1000) */}
      {view === AppState.HOME && (
        <div className="absolute bottom-0 inset-x-0 p-10 z-[1000]">
          <div className="mb-6">
            <p className="text-blue-500 font-black text-[10px] tracking-[0.3em] uppercase mb-1">Status de Rede</p>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">{user?.nickname}</h2>
          </div>
          <button 
            onClick={() => { 
              setView(AppState.ACTIVE); 
              setCurrentActivity({ id: `act_${Date.now()}`, startTime: Date.now(), points: [userLocation!], fullPath: [userLocation!], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); 
            }} 
            className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-2xl italic uppercase shadow-[0_25px_60px_rgba(37,99,235,0.45)] active:scale-95 transition-all"
          >
            INICIAR CONQUISTA
          </button>
        </div>
      )}

      {/* ATIVIDADE (Z-1500) */}
      {view === AppState.ACTIVE && currentActivity && (
        <div className="absolute inset-0 z-[1500] pointer-events-none">
          <ActivityOverlay activity={currentActivity} user={user} onStop={stopActivity} />
        </div>
      )}
      
      {/* SUMÁRIO (Z-2000) */}
      {view === AppState.SUMMARY && (
        <div className="absolute inset-0 bg-black z-[2000] p-10 flex flex-col">
          <h2 className="text-5xl font-black italic mb-10 pt-16 tracking-tighter leading-none">SUMÁRIO DE<br/>OPERATIVO</h2>
          <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex-1 mb-10 overflow-y-auto shadow-inner relative">
            <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck size={120} /></div>
            <p className="text-blue-500 text-[10px] font-black mb-4 uppercase tracking-[0.4em]">Canal Seguro DmN:</p>
            <p className="text-2xl italic font-bold leading-snug">"{battleReport}"</p>
          </div>
          <button onClick={() => setView(AppState.HOME)} className="w-full bg-white text-black py-7 rounded-[2.5rem] font-black italic uppercase text-xl shadow-2xl active:scale-95 transition-all">FINALIZAR RELATÓRIO</button>
        </div>
      )}
    </div>
  );
};

export default App;
