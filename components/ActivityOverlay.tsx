
import React from 'react';
import { Activity, User } from '../types';
import { CELL_AREA_M2 } from '../constants';

interface ActivityOverlayProps {
  activity: Activity;
  onStop: () => void;
  user: User | null;
}

const ActivityOverlay: React.FC<ActivityOverlayProps> = ({ activity, onStop, user }) => {
  const area = activity.capturedCellIds.size * CELL_AREA_M2;
  const userColor = user?.color || '#3B82F6';

  return (
    <div className="absolute inset-0 p-6 flex flex-col pointer-events-none z-[1500]">
      <div className="mt-16 text-center animate-in fade-in slide-in-from-top duration-500">
        <div className="text-[64px] font-[900] tracking-tighter leading-none italic" style={{ color: userColor }}>
          {area.toLocaleString()}<span className="text-xl ml-1 opacity-50 not-italic">m²</span>
        </div>
        <div className="text-[8px] font-black uppercase tracking-[0.4em] text-white/40 mt-2">Sincronização em Tempo Real</div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pointer-events-auto pb-8">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/60 backdrop-blur-lg border border-white/10 p-4 rounded-3xl text-center">
            <div className="text-[8px] font-black text-white/30 uppercase mb-0.5 tracking-widest">Distância</div>
            <div className="text-xl font-black italic">{(activity.distanceMeters/1000).toFixed(2)}km</div>
          </div>
          <div className="bg-black/60 backdrop-blur-lg border border-white/10 p-4 rounded-3xl text-center">
            <div className="text-[8px] font-black text-white/30 uppercase mb-0.5 tracking-widest">Sinal</div>
            <div className="text-xl font-black italic text-green-500 animate-pulse">OK</div>
          </div>
        </div>
        
        <button 
          onClick={onStop}
          className="w-full bg-red-600 py-5 rounded-3xl font-black text-lg uppercase italic shadow-lg active:scale-95 transition-all border-b-4 border-red-800"
        >
          ENCERRAR MISSÃO
        </button>
      </div>
    </div>
  );
};

export default ActivityOverlay;
