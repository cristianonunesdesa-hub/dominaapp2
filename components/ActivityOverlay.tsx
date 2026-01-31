
import React from 'react';
import { Activity, User } from '../types';
import { Timer, Navigation, XCircle, Crosshair } from 'lucide-react';
import { CELL_AREA_M2 } from '../constants';

interface ActivityOverlayProps {
  activity: Activity;
  onStop: () => void;
  user: User | null;
  isFinishing?: boolean;
}

const ActivityOverlay: React.FC<ActivityOverlayProps> = ({ activity, onStop, user, isFinishing }) => {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - activity.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activity.startTime]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const areaCaptured = activity.capturedCellIds.size * CELL_AREA_M2;
  const userColor = user?.color || '#3B82F6';

  return (
    <div className="absolute inset-0 p-6 pointer-events-none flex flex-col items-center z-20">
      {/* Área em destaque no topo - Baseado nas imagens 3 e 4 */}
      <div className="mt-16 text-center animate-in fade-in zoom-in duration-500">
        <div 
          className="text-[72px] font-[900] tracking-tighter leading-none flex items-baseline justify-center gap-2"
          style={{ color: userColor }}
        >
          {areaCaptured.toLocaleString()}
          <span className="text-2xl opacity-40 uppercase italic font-black">m²</span>
        </div>
        <div className="text-[11px] font-black uppercase text-white/40 tracking-[0.4em] mt-1">Área Capturada</div>
      </div>

      <div className="mt-auto w-full flex flex-col gap-4 items-center mb-12 pointer-events-auto">
        <div className="flex gap-2 w-full max-w-sm">
          <div className="bg-black/80 backdrop-blur-3xl px-6 py-4 rounded-[24px] border border-white/10 flex-1 flex flex-col items-center shadow-2xl">
            <div className="text-[10px] font-black uppercase text-white/30 mb-1 tracking-widest">Tempo</div>
            <div className="text-2xl font-[900]">{formatTime(seconds)}</div>
          </div>
          <div className="bg-black/80 backdrop-blur-3xl px-6 py-4 rounded-[24px] border border-white/10 flex-1 flex flex-col items-center shadow-2xl">
            <div className="text-[10px] font-black uppercase text-white/30 mb-1 tracking-widest">KM</div>
            <div className="text-2xl font-[900]">{(activity.distanceMeters / 1000).toFixed(2)}</div>
          </div>
        </div>

        <div 
          className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl"
          style={{ borderColor: `${userColor}44`, color: userColor }}
        >
           <Crosshair size={14} className="animate-spin-slow" /> Feche o percurso para conquistar
        </div>
        
        <button
          onClick={onStop}
          disabled={isFinishing}
          className={`w-full max-w-sm bg-red-600 active:scale-95 transition-all text-white font-[900] py-6 rounded-[32px] shadow-[0_20px_40px_rgba(220,38,38,0.3)] flex items-center justify-center gap-3 text-xl uppercase italic ${isFinishing ? 'opacity-50' : ''}`}
        >
          {isFinishing ? "Processando..." : "FINALIZAR MISSÃO"}
        </button>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
      `}</style>
    </div>
  );
};

export default ActivityOverlay;
