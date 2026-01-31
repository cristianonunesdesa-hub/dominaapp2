
import React from 'react';
import { Activity } from '../types';
import { Timer, Navigation, XCircle, Crosshair } from 'lucide-react';

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

  return (
    <div className="absolute top-0 left-0 w-full p-6 pointer-events-none flex flex-col gap-4 z-20 h-full">
      <div className="flex gap-3">
        <div className="bg-gray-950/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/5 shadow-2xl flex flex-col flex-1">
          <div className="flex items-center gap-2 text-gray-500 text-[9px] font-black uppercase tracking-widest">
            <Timer size={10} className="text-blue-500" /> Tempo
          </div>
          <div className="text-xl font-black font-mono text-white">{formatTime(seconds)}</div>
        </div>

        <div className="bg-gray-950/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/5 shadow-2xl flex flex-col flex-1">
          <div className="flex items-center gap-2 text-gray-500 text-[9px] font-black uppercase tracking-widest">
            <Navigation size={10} className="text-emerald-500" /> Distância
          </div>
          <div className="text-xl font-black font-mono text-white">{(activity.distanceMeters).toFixed(0)}<span className="text-xs ml-0.5 opacity-50">m</span></div>
        </div>
      </div>

      <div className={`fixed bottom-12 left-0 w-full flex flex-col items-center px-6 pointer-events-auto gap-4 transition-all duration-500 ${isFinishing ? 'translate-y-24 opacity-0 pointer-events-none' : ''}`}>
        <div className="bg-blue-600/20 backdrop-blur-md px-6 py-3 rounded-full border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 shadow-xl animate-pulse">
           <Crosshair size={14} /> Feche o circuito para conquistar
        </div>
        
        <button
          onClick={onStop}
          disabled={isFinishing}
          className={`w-full max-w-sm bg-red-600 hover:bg-red-700 active:scale-90 transition-all text-white font-black py-5 rounded-3xl shadow-2xl flex items-center justify-center gap-3 text-lg tracking-tight uppercase ${isFinishing ? 'brightness-75' : ''}`}
        >
          {isFinishing ? (
            <span className="flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              FINALIZANDO...
            </span>
          ) : (
            <>
              <XCircle size={22} /> Finalizar Missão
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ActivityOverlay;
