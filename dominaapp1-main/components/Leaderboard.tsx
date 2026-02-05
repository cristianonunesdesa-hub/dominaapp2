
import React from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy, Shield, Map as MapIcon, ArrowLeft, User as UserIcon } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
  onBack: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, currentUserId, onBack }) => {
  const sortedEntries = [...entries].sort((a, b) => b.totalAreaM2 - a.totalAreaM2);

  return (
    <div className="absolute inset-0 bg-black z-[120] flex flex-col p-6 animate-in slide-in-from-right duration-500">
      <div className="flex items-center gap-4 mb-8 pt-8">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl border border-white/10 active:scale-90 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Quartel General</h2>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Ranking Global de Domínio</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {sortedEntries.map((entry, index) => {
          const isMe = entry.id === currentUserId;
          return (
            <div 
              key={entry.id}
              className={`relative overflow-hidden p-4 rounded-2xl border transition-all ${isMe ? 'bg-blue-600/20 border-blue-500' : 'bg-white/[0.03] border-white/5'}`}
            >
              {index < 3 && (
                <div className="absolute top-0 right-0 p-2 opacity-10">
                   <Trophy size={40} className={index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-600'} />
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center font-black text-sm italic text-white/20">
                  #{index + 1}
                </div>

                <div className="w-12 h-12 rounded-xl bg-gray-900 border border-white/10 overflow-hidden flex items-center justify-center">
                  {entry.avatarUrl ? <img src={entry.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-gray-600" />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-black uppercase italic text-xs tracking-tight ${isMe ? 'text-blue-400' : 'text-white'}`}>
                      {entry.nickname} {isMe && '(VOCÊ)'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 opacity-60">
                    <div className="flex items-center gap-1 text-[9px] font-bold">
                      <Shield size={9} /> LVL {entry.level}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold">
                      <MapIcon size={9} /> {entry.totalAreaM2.toLocaleString()} m²
                    </div>
                  </div>
                </div>

                <div className="text-right">
                   <div className="text-[8px] font-black text-gray-500 uppercase">Domínio</div>
                   <div className="text-sm font-black italic">
                      {((entry.totalAreaM2 / 100000) * 100).toFixed(2)}%
                   </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
