
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import { Radio, Zap, ShieldCheck } from 'lucide-react';
import { generateBattleReport } from './services/gemini';
import { playVictorySound } from './utils/audio';

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

  // Ref para evitar loops infinitos no useEffect de movimentação
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

  // Gerenciamento de Localização (GPS vs Teste)
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

  // Processamento de Movimento e Captura de Território
  useEffect(() => {
    const activity = activityRef.current;
    if (view === AppState.ACTIVE && userLocation && activity && user) {
      const points = activity.points;
      const lastPoint = points[points.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, userLocation) : 0;
      
      const threshold = isTestMode ? 0.1 : 1.5; // Modo teste é muito mais sensível
      
      if (d > threshold) {
        const newPoints = [...points, userLocation];
        const newFullPath = [...(activity.fullPath || []), userLocation];

        // Verificar intersecção para fechar polígono (mínimo 4 pontos para formar área)
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

                // Reinicia o rastro após captura bem-sucedida
                setCurrentActivity(prev => prev ? { 
                  ...prev, 
                  points: [userLocation], 
                  fullPath: newFullPath,
                  capturedCellIds: new Set([...prev.capturedCellIds, ...enclosedIds]) 
                } : null);
                return;
              }
            }
          }
        }

        // Apenas atualiza a trilha se não houve captura
        setCurrentActivity(prev => prev ? { 
          ...prev, 
          points: newPoints, 
          fullPath: newFullPath,
          distanceMeters: prev.distanceMeters + d 
        } : null);
      }
    }
  }, [userLocation, view, isTestMode, user, syncGlobalState]);

  const stopActivity = async () => {
    const activity = activityRef.current;
    if (!activity || !user) return;
    setView(AppState.SUMMARY);
    setBattleReport("Sincronizando dados com a Rede...");
    try {
      const report = await generateBattleReport(activity, user.nickname);
      setBattleReport(report);
    } catch { setBattleReport("Operação concluída com sucesso."); }
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
      
      {/* CAMADA 0: MAPA */}
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
      
      {/* CAMADA 2000+: UI */}
      <button 
        onClick={() => setIsTestMode(!isTestMode)} 
        className={`absolute top-14 right-6 z-[2500] p-4 rounded-2xl border transition-all shadow-2xl active:scale-90 ${isTestMode ? 'bg-orange-600 border-white' : 'bg-black/60 border-white/10 text-white/40'}`}
        title="Modo de Teste (Clique no Mapa)"
      >
        <Zap size={20} className={isTestMode ? 'fill-white' : ''} />
      </button>

      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-black z-[3000] flex flex-col items-center justify-center p-8">
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

      {view === AppState.HOME && (
        <div className="absolute bottom-0 inset-x-0 p-10 z-[1500]">
          <div className="mb-6 animate-in slide-in-from-bottom duration-500">
            <p className="text-blue-500 font-black text-[10px] tracking-[0.3em] uppercase mb-1">Status de Rede Online</p>
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
          <button onClick={() => setView(AppState.HOME)} className="w-full bg-white text-black py-7 rounded-[2.5rem] font-black italic uppercase text-xl shadow-2xl active:scale-95 transition-all">FINALIZAR RELATÓRIO</button>
        </div>
      )}
    </div>
  );
};

export default App;
