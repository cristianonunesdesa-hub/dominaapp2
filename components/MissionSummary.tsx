
import React from 'react';
import { Activity, User } from '../types';
import { CELL_AREA_M2, XP_PER_KM, XP_PER_SECTOR } from '../constants';
import { Shield, Zap, Map as MapIcon, Timer, TrendingUp, ChevronRight } from 'lucide-react';

interface MissionSummaryProps {
  activity: Activity;
  user: User;
  battleReport: string;
  onFinish: () => void;
}

const MissionSummary: React.FC<MissionSummaryProps> = ({ activity, user, battleReport, onFinish }) => {
  const area = activity.capturedCellIds.size * CELL_AREA_M2;
  const km = activity.distanceMeters / 1000;
  const durationMin = Math.floor((Date.now() - activity.startTime) / 60000);
  const avgSpeed = km > 0 ? (km / ((Date.now() - activity.startTime) / 3600000)).toFixed(1) : '0';
  
  const xpGained = Math.round((km * XP_PER_KM) + (activity.capturedCellIds.size * XP_PER_SECTOR));

  return (
    <div className="absolute inset-0 bg-black z-[3000] flex flex-col p-6 overflow-y-auto pb-10">
      {/* Header Estilizado */}
      <div className="pt-12 mb-8">
        <div className="flex items-center gap-2 text-blue-500 mb-1">
          <Shield size={16} />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Debriefing de Operação</span>
        </div>
        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Missão<br/>Cumprida</h2>
      </div>

      {/* Grid de Estatísticas Principais */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={<MapIcon size={16}/>} label="Área" value={`${area.toLocaleString()}`} unit="m²" color="text-white" />
        <StatCard icon={<Zap size={16}/>} label="Distância" value={km.toFixed(2)} unit="km" color="text-white" />
        <StatCard icon={<Timer size={16}/>} label="Tempo" value={durationMin.toString()} unit="min" color="text-white" />
        <StatCard icon={<TrendingUp size={16}/>} label="Vel. Média" value={avgSpeed} unit="km/h" color="text-white" />
      </div>

      {/* Card de XP e Nível */}
      <div className="bg-blue-600/10 border border-blue-500/30 rounded-[2.5rem] p-6 mb-6">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Ganho de Experiência</p>
            <h3 className="text-3xl font-black italic">+{xpGained} XP</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Nível Atual</p>
            <h3 className="text-2xl font-black italic">LVL {user.level}</h3>
          </div>
        </div>
        <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: '75%' }}></div>
        </div>
        <p className="text-[9px] font-bold text-blue-300/50 text-center uppercase tracking-widest">240 XP para o Nível {user.level + 1}</p>
      </div>

      {/* Intel Report (Gemini) */}
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
          <Shield size={100} />
        </div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Intel de Campo Transmitido
        </p>
        <p className="text-xl italic font-medium leading-tight text-gray-200">
          "{battleReport}"
        </p>
      </div>

      {/* Botão de Ação Final */}
      <button 
        onClick={onFinish}
        className="mt-auto w-full bg-white text-black py-7 rounded-[2.5rem] font-black italic uppercase text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        SINCRONIZAR E FINALIZAR <ChevronRight size={24} />
      </button>
    </div>
  );
};

const StatCard = ({ icon, label, value, unit, color }: any) => (
  <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem] flex flex-col items-center text-center">
    <div className="text-blue-500 mb-2">{icon}</div>
    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-xl font-black italic ${color}`}>{value}<span className="text-[10px] ml-1 opacity-40 not-italic">{unit}</span></div>
  </div>
);

export default MissionSummary;
