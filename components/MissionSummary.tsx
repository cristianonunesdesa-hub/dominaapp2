
import React, { useEffect, useState } from 'react';
import { Activity, User } from '../types';
import { CELL_AREA_M2, XP_PER_KM, XP_PER_SECTOR } from '../constants';
import { Shield, Zap, Map as MapIcon, Timer, TrendingUp, ChevronRight, Activity as ActivityIcon } from 'lucide-react';

interface MissionSummaryProps {
  activity: Activity;
  user: User;
  battleReport: string;
  onFinish: () => void;
}

const MissionSummary: React.FC<MissionSummaryProps> = ({ activity, user, battleReport, onFinish }) => {
  const [animatedXp, setAnimatedXp] = useState(0);
  
  const area = activity.capturedCellIds.size * CELL_AREA_M2;
  const km = activity.distanceMeters / 1000;
  const durationMin = Math.floor((Date.now() - activity.startTime) / 60000);
  const avgSpeed = km > 0 ? (km / ((Date.now() - activity.startTime) / 3600000)).toFixed(1) : '0';
  
  const xpGained = Math.round((km * XP_PER_KM) + (activity.capturedCellIds.size * XP_PER_SECTOR));

  useEffect(() => {
    const duration = 1500;
    const start = 0;
    const end = xpGained;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const val = Math.min(Math.floor((progress / duration) * end), end);
      setAnimatedXp(val);
      if (progress < duration) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [xpGained]);

  return (
    <div className="absolute inset-0 bg-black z-[3000] flex flex-col p-6 overflow-y-auto pb-10">
      {/* Scanline / Grid Effect Background Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%' }}></div>

      {/* Header */}
      <div className="pt-12 mb-8 relative">
        <div className="flex items-center gap-2 text-blue-500 mb-1">
          <ActivityIcon size={14} className="animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Protocolo de Extração Concluído</span>
        </div>
        <h2 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.9] text-white">
          DEBRIEFING<br/><span className="text-blue-600">OPERACIONAL</span>
        </h2>
      </div>

      {/* Grid de Estatísticas Táticas */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard 
          icon={<MapIcon size={18}/>} 
          label="Área Conquistada" 
          value={area.toLocaleString()} 
          unit="m²" 
          sub="Domínio de Grade"
        />
        <StatCard 
          icon={<Zap size={18}/>} 
          label="Deslocamento" 
          value={km.toFixed(2)} 
          unit="km" 
          sub="Raio de Incursão"
        />
        <StatCard 
          icon={<Timer size={18}/>} 
          label="Tempo de Campo" 
          value={durationMin.toString()} 
          unit="min" 
          sub="Ciclo Ativo"
        />
        <StatCard 
          icon={<TrendingUp size={18}/>} 
          label="Velocidade" 
          value={avgSpeed} 
          unit="km/h" 
          sub="Ritmo Tático"
        />
      </div>

      {/* Card de Recompensas de Experiência */}
      <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/10 border border-blue-500/30 rounded-[2.5rem] p-8 mb-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50"></div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Dados Sincronizados</p>
            <h3 className="text-4xl font-black italic text-white">+{animatedXp} <span className="text-xl text-blue-500 opacity-50">XP</span></h3>
          </div>
          <div className="text-right">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
              <span className="text-lg font-black italic text-blue-400">{user.level}</span>
            </div>
            <p className="text-[8px] font-black text-white/30 uppercase tracking-tighter">Ranking</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
            <span className="text-blue-300">Nível {user.level}</span>
            <span className="text-white/40">Próximo: {user.level + 1}</span>
          </div>
          <div className="h-3 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden p-0.5">
            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all duration-1000" style={{ width: '68%' }}></div>
          </div>
        </div>
      </div>

      {/* Relatório de Inteligência Gemini */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 mb-8 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
            <Shield size={16} />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Criptografia de Rede DmN</p>
        </div>
        <p className="text-2xl italic font-bold leading-tight text-white/90 font-serif">
          "{battleReport}"
        </p>
        <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center opacity-40">
           <span className="text-[8px] font-mono">ID: {activity.id}</span>
           <span className="text-[8px] font-mono">SIG: OPS-774-ALPHA</span>
        </div>
      </div>

      {/* CTA Final */}
      <button 
        onClick={onFinish}
        className="mt-auto w-full bg-white text-black py-8 rounded-[3rem] font-black italic uppercase text-2xl shadow-[0_20px_50px_rgba(255,255,255,0.1)] active:scale-95 active:bg-gray-200 transition-all flex items-center justify-center gap-4 group"
      >
        VOLTAR AO QG <ChevronRight size={28} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
};

const StatCard = ({ icon, label, value, unit, sub }: any) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] flex flex-col items-start group hover:bg-white/[0.08] transition-colors">
    <div className="text-blue-500 mb-4 bg-blue-500/10 p-3 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
    <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</div>
    <div className="text-2xl font-black italic text-white leading-none">
      {value}<span className="text-xs ml-1 opacity-40 not-italic font-bold">{unit}</span>
    </div>
    <div className="text-[8px] font-bold text-blue-400/40 uppercase mt-2 tracking-tighter">{sub}</div>
  </div>
);

export default MissionSummary;
