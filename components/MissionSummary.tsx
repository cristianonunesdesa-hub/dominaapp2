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
  const endTime = activity.endTime ?? Date.now();
  const area = useMemo(() => activity.capturedCellIds.size * CELL_AREA_M2, [activity.capturedCellIds.size]);
  const km = useMemo(() => activity.distanceMeters / 1000, [activity.distanceMeters]);
  const durationMin = useMemo(() => Math.max(1, Math.floor((endTime - activity.startTime) / 60000)), [endTime, activity.startTime]);
  const avgSpeed = useMemo(() => {
    const hours = Math.max(1, endTime - activity.startTime) / 3600000;
    return km > 0 ? (km / hours).toFixed(1) : '0.0';
  }, [km, endTime, activity.startTime]);

  const xpGained = useMemo(() => calculateSessionXp(activity.distanceMeters, activity.capturedCellIds.size), [activity.distanceMeters, activity.capturedCellIds.size]);
  const totalXpAfterMission = useMemo(() => (user.xp ?? 0) + xpGained, [user.xp, xpGained]);
  const progressPct = useMemo(() => getProgressToNextLevel(totalXpAfterMission), [totalXpAfterMission]);

  const [animatedXp, setAnimatedXp] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const animate = (ts: number) => {
      if (start === null) start = ts;
      const val = Math.min(Math.floor(((ts - start) / 900) * xpGained), xpGained);
      setAnimatedXp(val);
      if (ts - start < 900) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [xpGained]);

  return (
    <div className="absolute inset-0 bg-black z-[3000] flex flex-col p-6 overflow-y-auto pb-8 animate-in fade-in duration-500">
      {/* Background Effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_top_right,#064e3b,transparent_70%)]"></div>

      {/* Header */}
      <div className="pt-8 mb-6 relative">
        <div className="flex items-center gap-2 text-emerald-500 mb-1">
          <ActivityIcon size={10} className="animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em]">Operação Finalizada</span>
        </div>
        <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-[0.9] text-white">
          RESUMO<br />
          <span className="text-emerald-500">TÁTICO</span>
        </h2>
      </div>

      {/* Stats - Grid mais compacto */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <StatCard icon={<MapIcon size={12} />} label="Área" value={area.toLocaleString('pt-BR')} unit="m²" />
        <StatCard icon={<Zap size={12} />} label="Distância" value={km.toFixed(2)} unit="km" />
        <StatCard icon={<Timer size={12} />} label="Tempo" value={durationMin.toString()} unit="min" />
        <StatCard icon={<TrendingUp size={12} />} label="Velocidade" value={avgSpeed} unit="km/h" />
      </div>

      {/* XP Card - Redesenhado para ser mais clean */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-5 relative overflow-hidden backdrop-blur-md">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Sincronização Finalizada</p>
            <h3 className="text-3xl font-black italic text-white">+{animatedXp} XP</h3>
          </div>
          <div className="text-right">
            <span className="text-xs font-black italic text-white/60">LVL {user.level}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${progressPct}%` }}></div>
          </div>
          <div className="flex justify-between text-[8px] font-black text-white/30 uppercase tracking-widest">
            <span>{totalXpAfterMission.toLocaleString()} TOTAL</span>
            <span>{progressPct.toFixed(0)}% PROX. NÍVEL</span>
          </div>
        </div>
      </div>

      {/* Status Info */}
      <div className="bg-emerald-600/5 border border-emerald-500/10 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <Shield size={14} className="text-emerald-500/50" />
        <p className="text-[9px] font-bold text-white/40 italic leading-tight uppercase tracking-tight">
          Dados de território integrados à malha central com sucesso.
        </p>
      </div>

      <button
        onClick={onFinish}
        className="mt-auto w-full bg-emerald-500 text-black py-5 rounded-[2rem] font-black italic uppercase text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-emerald-700"
      >
        CONCLUIR MISSÃO <ChevronRight size={20} />
      </button>
    </div>
  );
};

const StatCard = ({ icon, label, value, unit }: any) => (
  <div className="bg-white/[0.03] border border-white/5 p-4 rounded-[1.5rem] flex flex-col items-start backdrop-blur-sm">
    <div className="text-blue-500 mb-2 opacity-60">{icon}</div>
    <div className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-0.5">{label}</div>
    <div className="text-lg font-black italic text-white leading-none">
      {value}<span className="text-[10px] ml-1 opacity-20 not-italic font-bold">{unit}</span>
    </div>
  </div>
);

export default MissionSummary;