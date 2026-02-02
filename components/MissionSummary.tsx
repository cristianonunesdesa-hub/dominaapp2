// Arquivo: components/MissionSummary.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, User } from '../types';
import { CELL_AREA_M2 } from '../constants';
import { calculateSessionXp, getProgressToNextLevel } from '../core/xp';
import {
  Shield,
  Zap,
  Map as MapIcon,
  Timer,
  TrendingUp,
  ChevronRight,
  Activity as ActivityIcon
} from 'lucide-react';

interface MissionSummaryProps {
  activity: Activity;
  user: User;
  onFinish: () => void;
}

const MissionSummary: React.FC<MissionSummaryProps> = ({ activity, user, onFinish }) => {
  // Congela a missão: se endTime existir, usa ele; senão, usa "agora"
  const endTime = activity.endTime ?? Date.now();

  const area = useMemo(() => activity.capturedCellIds.size * CELL_AREA_M2, [activity.capturedCellIds.size]);
  const km = useMemo(() => activity.distanceMeters / 1000, [activity.distanceMeters]);

  const durationMin = useMemo(() => {
    const ms = Math.max(0, endTime - activity.startTime);
    return Math.max(1, Math.floor(ms / 60000));
  }, [endTime, activity.startTime]);

  const avgSpeed = useMemo(() => {
    const ms = Math.max(1, endTime - activity.startTime);
    const hours = ms / 3600000;
    return km > 0 ? (km / hours).toFixed(1) : '0.0';
  }, [km, endTime, activity.startTime]);

  // XP ganho na missão (distância + setores capturados)
  const xpGained = useMemo(() => {
    return calculateSessionXp(activity.distanceMeters, activity.capturedCellIds.size);
  }, [activity.distanceMeters, activity.capturedCellIds.size]);

  // XP total do usuário (após missão)
  const totalXpAfterMission = useMemo(() => {
    // O App.tsx já soma o XP no finishMission antes de voltar pra HOME,
    // mas aqui garantimos consistência visual (se ainda não somou, soma para exibir).
    return (user.xp ?? 0) + xpGained;
  }, [user.xp, xpGained]);

  // Progresso real pro próximo nível baseado no XP total
  const progressPct = useMemo(() => {
    return getProgressToNextLevel(totalXpAfterMission);
  }, [totalXpAfterMission]);

  // Anima só o número do XP ganho (efeito visual)
  const [animatedXp, setAnimatedXp] = useState(0);

  useEffect(() => {
    const duration = 900;
    const end = xpGained;
    let start: number | null = null;

    const animate = (ts: number) => {
      if (start === null) start = ts;
      const p = ts - start;
      const val = Math.min(Math.floor((p / duration) * end), end);
      setAnimatedXp(val);
      if (p < duration) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [xpGained]);

  return (
    <div className="absolute inset-0 bg-black z-[3000] flex flex-col p-5 overflow-y-auto pb-8">
      {/* Background Effect */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 2px, 2px 100%',
        }}
      ></div>

      {/* Header */}
      <div className="pt-10 mb-6 relative">
        <div className="flex items-center gap-2 text-blue-500 mb-1">
          <ActivityIcon size={12} className="animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em]">Operação Finalizada</span>
        </div>
        <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-[0.9] text-white">
          RESUMO<br />
          <span className="text-blue-600 text-3xl">TÁTICO</span>
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon={<MapIcon size={14} />} label="Área" value={area.toLocaleString('pt-BR')} unit="m²" />
        <StatCard icon={<Zap size={14} />} label="Distância" value={km.toFixed(2)} unit="km" />
        <StatCard icon={<Timer size={14} />} label="Tempo" value={durationMin.toString()} unit="min" />
        <StatCard icon={<TrendingUp size={14} />} label="Velocidade" value={avgSpeed} unit="km/h" />
      </div>

      {/* XP Card */}
      <div className="bg-gradient-to-br from-blue-600/10 to-blue-900/5 border border-blue-500/20 rounded-3xl p-5 mb-5 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Sincronização</p>
            <h3 className="text-2xl font-black italic text-white">+{animatedXp} XP</h3>
            <p className="text-[9px] font-bold text-white/40 mt-1">
              Total: <span className="text-white/70">{totalXpAfterMission.toLocaleString('pt-BR')} XP</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-black italic text-blue-400 bg-blue-600/10 px-3 py-1 rounded-lg border border-blue-500/20">
              LVL {user.level}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest">
            <span className="text-blue-300">Progresso</span>
            <span className="text-white/30">Next LVL</span>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
          <div className="flex justify-end">
            <span className="text-[9px] font-black text-white/30">{progressPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Status de Rede */}
      <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-4 mb-6 flex items-center gap-3">
        <Shield size={16} className="text-blue-500 opacity-50" />
        <div>
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Protocolo de Rede</p>
          <p className="text-xs font-bold text-white/60 italic">Solo neutralizado e área integrada à malha DmN.</p>
        </div>
      </div>

      <button
        onClick={onFinish}
        className="mt-auto w-full bg-white text-black py-5 rounded-3xl font-black italic uppercase text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        CONCLUIR MISSÃO <ChevronRight size={20} />
      </button>
    </div>
  );
};

const StatCard = ({ icon, label, value, unit }: any) => (
  <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col items-start">
    <div className="text-blue-500 mb-2 opacity-70">{icon}</div>
    <div className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-0.5">{label}</div>
    <div className="text-lg font-black italic text-white leading-none">
      {value}
      <span className="text-[10px] ml-1 opacity-30 not-italic font-bold">{unit}</span>
    </div>
  </div>
);

export default MissionSummary;
