
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
    <div className="absolute inset-0 p-4 flex flex-col pointer-events-none z-[2000] font-sans safe-area-top safe-area-bottom">
      {/* HUD Central: Área Capturada */}
      <div className="mt-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div 
          className="text-[42px] font-[900] tracking-tighter leading-none italic flex items-baseline justify-center"
          style={{ 
            color: userColor,
            textShadow: `0 0 20px ${userColor}44` 
          }}
        >
          {area.toLocaleString('pt-BR')}<span className="text-sm ml-1 not-italic opacity-80 font-black">m²</span>
        </div>
        <div className="text-[7px] font-black uppercase tracking-[0.4em] text-white/30 mt-1">
          Sincronização Ativa
        </div>
      </div>

      {/* HUD Inferior: Stats e Ação - Ajustado para Safe Area */}
      <div className="mt-auto flex flex-col gap-2 pointer-events-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-sm mx-auto w-full">
        <div className="grid grid-cols-2 gap-2">
          {/* Card Distância */}
          <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/5 p-2.5 rounded-2xl text-center shadow-2xl">
            <div className="text-[8px] font-black text-white/20 uppercase mb-0.5 tracking-widest">Distância</div>
            <div className="text-base font-[900] italic text-white leading-none">
              {(activity.distanceMeters/1000).toFixed(2)}<span className="text-[10px] ml-0.5 opacity-40">km</span>
            </div>
          </div>
          
          {/* Card Sinal */}
          <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/5 p-2.5 rounded-2xl text-center shadow-2xl">
            <div className="text-[8px] font-black text-white/20 uppercase mb-0.5 tracking-widest">Sinal</div>
            <div className="text-base font-[900] italic text-[#10B981] animate-pulse leading-none uppercase">Conectado</div>
          </div>
        </div>
        
        {/* Botão Encerrar */}
        <button 
          onClick={onStop}
          className="w-full bg-[#b91c1c] hover:bg-red-700 py-4 rounded-2xl font-[900] text-base uppercase italic shadow-[0_8px_20px_rgba(185,28,28,0.3)] active:scale-[0.97] transition-all border-b-[3px] border-red-900 text-white"
        >
          ENCERRAR MISSÃO
        </button>
      </div>
    </div>
  );
};

export default ActivityOverlay;
