
import React, { useState } from 'react';
import { RefreshCw, Check, ArrowLeft, User as UserIcon } from 'lucide-react';

interface AvatarCustomizerProps {
  currentAvatar?: string;
  userColor: string;
  onSave: (url: string) => void;
  onBack: () => void;
}

const AVATAR_STYLES = [
  { id: 'bottts', name: 'CYBER-BOT' },
  { id: 'adventurer', name: 'STRIKER' },
  { id: 'avataaars', name: 'AGENT' },
  { id: 'pixel-art', name: 'RETRO' }
];

const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({ currentAvatar, userColor, onSave, onBack }) => {
  const [style, setStyle] = useState('bottts');
  const [seed, setSeed] = useState(Math.random().toString(36).substring(7));
  
  const generateUrl = (s: string, sd: string) => 
    `https://api.dicebear.com/7.x/${s}/svg?seed=${sd}&backgroundColor=${userColor.replace('#', '')}`;

  const currentUrl = generateUrl(style, seed);

  return (
    <div className="absolute inset-0 bg-black z-[130] flex flex-col p-8 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center gap-4 mb-10 pt-4">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Terminal de Identidade</h2>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Sincronização de Avatar</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative group mb-12">
          <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-3xl group-hover:bg-blue-600/40 transition-all"></div>
          <div className="relative w-56 h-56 rounded-full border-4 border-blue-500/50 p-2 overflow-hidden bg-gray-900 shadow-[0_0_60px_rgba(59,130,246,0.3)]">
             <img src={currentUrl} alt="Avatar Preview" className="w-full h-full object-cover scale-110" />
          </div>
          <button 
            onClick={() => setSeed(Math.random().toString(36).substring(7))}
            className="absolute bottom-2 right-2 p-4 bg-blue-600 rounded-full shadow-2xl active:rotate-180 transition-all duration-500 border-2 border-white/20"
          >
            <RefreshCw size={24} className="text-white" />
          </button>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="grid grid-cols-2 gap-3">
            {AVATAR_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${style === s.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-500'}`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <button 
            onClick={() => onSave(currentUrl)}
            className="w-full bg-white text-black py-5 rounded-[2rem] font-black uppercase italic tracking-tighter text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            CONFIRMAR IDENTIDADE <Check size={24} />
          </button>
        </div>
      </div>

      <p className="text-[9px] text-center text-gray-600 font-bold uppercase tracking-widest mb-4">
        Base de dados fornecida por DiceBear Open Source Avatars
      </p>
    </div>
  );
};

export default AvatarCustomizer;
