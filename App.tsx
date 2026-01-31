
import React, { useState, useEffect } from 'react';
import { User, Cell, Point, Activity, AppState } from './types';
import { TACTICAL_COLORS } from './constants';
import { calculateDistance, getEnclosedCellIds, segmentsIntersect } from './utils';
import GameMap from './components/GameMap';
import ActivityOverlay from './components/ActivityOverlay';
import ConfettiEffect from './components/ConfettiEffect';
import { Radio, Zap, ChevronRight, Share2, ShieldCheck } from 'lucide-react';
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

  const syncGlobalState = async (newCells: Cell[] = []) => {
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
    } catch (e) {}
  };

  useEffect(() => {
    if (isTestMode && !userLocation) setUserLocation({ lat: -23.5505, lng: -46.6333, timestamp: Date.now() });
    const watchId = navigator.geolocation.watchPosition(
      (pos) => !isTestMode && setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
      null, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTestMode]);

  useEffect(() => {
    if (view === AppState.ACTIVE && userLocation && currentActivity && user) {
      const points = currentActivity.points;
      const lastPoint = points[points.length - 1];
      const d = lastPoint ? calculateDistance(lastPoint, userLocation) : 0;
      
      if (d > (isTestMode ? 0.05 : 1.5)) {
        const newPoints = [...points, userLocation];
        if (newPoints.length > 3) {
          const pA = newPoints[newPoints.length - 2], pB = newPoints[newPoints.length - 1];
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
                setShowConfetti(true); setTimeout(() => setShowConfetti(false), 2000);
                setCurrentActivity({ ...currentActivity, points: [userLocation], capturedCellIds: new Set([...currentActivity.capturedCellIds, ...enclosedIds]) });
                return;
              }
            }
          }
        }
        setCurrentActivity({ ...currentActivity, points: newPoints, distanceMeters: currentActivity.distanceMeters + d });
      }
    }
  }, [userLocation]);

  const stopActivity = async () => {
    if (!currentActivity || !user) return;
    setView(AppState.SUMMARY);
    setBattleReport("Sincronizando...");
    try {
      const report = await generateBattleReport(currentActivity, user.nickname);
      setBattleReport(report);
    } catch { setBattleReport("Missão concluída."); }
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
    <div className="h-full w-full bg-black text-white relative overflow-hidden">
      {showConfetti && <ConfettiEffect />}
      <GameMap userLocation={userLocation} cells={cells} users={globalUsers} activeUserId={user?.id || ''} activeUser={user} currentPath={[]} activeTrail={currentActivity?.points} onMapClick={(lat, lng) => isTestMode && setUserLocation({ lat, lng, timestamp: Date.now() })} />
      
      <button onClick={() => setIsTestMode(!isTestMode)} className={`absolute top-14 right-6 z-[100] p-4 rounded-2xl border ${isTestMode ? 'bg-orange-600' : 'bg-black/50'}`}><Zap size={20} /></button>

      {view === AppState.LOGIN && (
        <div className="absolute inset-0 bg-black z-[500] flex flex-col items-center justify-center p-8">
           <Radio size={48} className="text-blue-600 mb-4" />
           <h1 className="text-4xl font-black italic mb-8">DmN</h1>
           <input type="text" placeholder="AGENTE" className="w-full bg-white/5 p-4 rounded-xl mb-2" value={loginNickname} onChange={e => setLoginNickname(e.target.value)} />
           <input type="password" placeholder="SENHA" className="w-full bg-white/5 p-4 rounded-xl mb-4" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
           {loginError && <p className="text-red-500 text-xs mb-4">{loginError}</p>}
           <div className="flex gap-2 w-full"><button onClick={() => handleAuth('login')} className="flex-1 bg-white text-black p-4 rounded-xl font-bold">LOGIN</button><button onClick={() => handleAuth('register')} className="flex-1 bg-blue-600 p-4 rounded-xl font-bold">CRIAR</button></div>
        </div>
      )}

      {view === AppState.HOME && (
        <div className="absolute bottom-0 inset-x-0 p-8 z-50">
          <p className="text-blue-500 font-bold text-xs">PROTOCOLO ATIVO</p>
          <h2 className="text-3xl font-black italic mb-6">{user?.nickname}</h2>
          <button onClick={() => { setView(AppState.ACTIVE); setCurrentActivity({ id: '1', startTime: Date.now(), points: [userLocation!], fullPath: [], capturedCellIds: new Set(), stolenCellIds: new Set(), distanceMeters: 0, isValid: true, strategicZonesEntered: 0 }); }} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black text-2xl italic shadow-2xl">INICIAR CONQUISTA</button>
        </div>
      )}

      {view === AppState.ACTIVE && currentActivity && <ActivityOverlay activity={currentActivity} user={user} onStop={stopActivity} />}
      
      {view === AppState.SUMMARY && (
        <div className="absolute inset-0 bg-black z-[600] p-8 flex flex-col">
          <h2 className="text-3xl font-black italic mb-8 pt-12">RELATÓRIO</h2>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex-1 mb-8 overflow-y-auto">
            <p className="text-blue-500 text-xs font-bold mb-2 uppercase">Comando DmN:</p>
            <p className="text-xl italic font-bold">"{battleReport}"</p>
          </div>
          <button onClick={() => setView(AppState.HOME)} className="w-full bg-white text-black py-6 rounded-3xl font-black italic">FINALIZAR</button>
        </div>
      )}
    </div>
  );
};

export default App;
