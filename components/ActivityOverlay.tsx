
import React from 'react';
import { Activity } from '../types';
import { Timer, Navigation, XCircle, Crosshair } from 'lucide-react';
import { CELL_AREA_M2 } from '../constants';

interface ActivityOverlayProps {
  activity: Activity;
  onStop: () => void;
  isFinishing?: boolean;
}

const ActivityOverlay: React.FC<ActivityOverlayProps> = ({ activity, onStop, isFinishing }) => {
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

  return (
    <div className="absolute inset-0 p-6 pointer-events-none flex flex-col items-center z-20">
      {/* Área em destaque no topo - Baseado nas imagens 3 e 4 */}
      <div className="mt-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="text-[64px] font-black italic tracking-tighter leading-none flex items-baseline gap-2">
          {areaCaptured}
          <span className="text-xl opacity-50 uppercase italic tracking-normal">m²</span>
        </div>
        <div className="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em] mt-1">Área Conquistada</div>
      </div>

      <div className="mt-auto w-full flex flex-col gap-4 items-center mb-8 pointer-events-auto">
        <div className="flex gap-2 w-full max-w-sm">
          <div className="bg-black/80 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 flex-1 flex flex-col items-center">
            <div className="text-[9px] font-black uppercase text-gray-500 mb-1">Tempo</div>
            <div className="text-lg font-black font-mono">{formatTime(seconds)}</div>
          </div>
          <div className="bg-black/80 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 flex-1 flex flex-col items-center">
            <div className="text-[9px] font-black uppercase text-gray-500 mb-1">Distância</div>
            <div className="text-lg font-black font-mono">{activity.distanceMeters.toFixed(0)}m</div>
          </div>
        </div>

        <div className="bg-blue-600/20 backdrop-blur-md px-6 py-3 rounded-full border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 shadow-xl">
           <Crosshair size={14} className="animate-spin-slow" /> Feche o loop para confirmar
        </div>
        
        <button
          onClick={onStop}
          disabled={isFinishing}
          className={`w-full max-w-sm bg-red-600 active:scale-95 transition-all text-white font-black py-5 rounded-3xl shadow-2xl flex items-center justify-center gap-3 text-lg uppercase italic ${isFinishing ? 'opacity-50' : ''}`}
        >
          {isFinishing ? "Processando..." : <><XCircle size={22} /> Finalizar Missão</>}
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
