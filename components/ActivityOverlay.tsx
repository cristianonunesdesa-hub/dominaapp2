
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
    <div className="absolute inset-0 p-6 flex flex-col pointer-events-none z-[1500] font-sans">
      {/* HUD Central: Área Capturada */}
      <div className="mt-20 text-center animate-in fade-in duration-700">
        <div 
          className="text-[82px] font-[900] tracking-tighter leading-none italic flex items-baseline justify-center"
          style={{ 
            color: userColor,
            textShadow: `0 0 40px ${userColor}44` 
          }}
        >
          {area.toLocaleString('pt-BR')}<span className="text-2xl ml-1 not-italic opacity-80 font-black">m²</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 mt-3">
          Sincronização em tempo real
        </div>
      </div>

      {/* HUD Inferior: Stats e Ação */}
      <div className="mt-auto flex flex-col gap-4 pointer-events-auto pb-10">
        <div className="grid grid-cols-2 gap-4">
          {/* Card Distância */}
          <div className="bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/5 p-5 rounded-[2.5rem] text-center shadow-2xl">
            <div className="text-[10px] font-black text-white/30 uppercase mb-1 tracking-[0.15em]">Distância</div>
            <div className="text-2xl font-[900] italic text-white leading-none">
              {(activity.distanceMeters/1000).toFixed(2)}<span className="text-sm ml-0.5">km</span>
            </div>
          </div>
          
          {/* Card Sinal */}
          <div className="bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/5 p-5 rounded-[2.5rem] text-center shadow-2xl">
            <div className="text-[10px] font-black text-white/30 uppercase mb-1 tracking-[0.15em]">Sinal</div>
            <div className="text-2xl font-[900] italic text-[#10B981] animate-pulse leading-none">OK</div>
          </div>
        </div>
        
        {/* Botão Encerrar */}
        <button 
          onClick={onStop}
          className="w-full bg-[#b91c1c] hover:bg-red-700 py-7 rounded-[2.5rem] font-[900] text-xl uppercase italic shadow-[0_10px_30px_rgba(185,28,28,0.4)] active:scale-[0.97] transition-all border-b-[6px] border-red-900 text-white"
        >
          ENCERRAR MISSÃO
        </button>
      </div>
    </div>
  );
};

export default ActivityOverlay;
