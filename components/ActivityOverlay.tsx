
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
    <div className="absolute inset-0 p-8 flex flex-col pointer-events-none z-50">
      <div className="mt-16 text-center animate-in fade-in duration-700">
        <div className="text-[84px] font-[900] tracking-tighter leading-none" style={{ color: userColor }}>
          {area.toLocaleString()}<span className="text-2xl ml-2 opacity-50">m²</span>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-2">Território Sincronizado</div>
      </div>

      <div className="mt-auto flex flex-col gap-4 pointer-events-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] text-center shadow-2xl">
            <div className="text-[10px] font-black text-white/30 uppercase mb-1">Distância</div>
            <div className="text-2xl font-black italic">{(activity.distanceMeters/1000).toFixed(2)}km</div>
          </div>
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] text-center shadow-2xl">
            <div className="text-[10px] font-black text-white/30 uppercase mb-1">Ritmo</div>
            <div className="text-2xl font-black italic">--:--</div>
          </div>
        </div>
        
        <button 
          onClick={onStop}
          className="w-full bg-red-600 py-6 rounded-[32px] font-black text-xl uppercase italic shadow-2xl active:scale-95 transition-all"
        >
          ENCERRAR MISSÃO
        </button>
      </div>
    </div>
  );
};

export default ActivityOverlay;
