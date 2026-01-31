
import React, { useState } from 'react';
import { RefreshCw, Check, ArrowLeft, User as UserIcon } from 'lucide-react';
import { TACTICAL_COLORS } from '../constants';

interface AvatarCustomizerProps {
  currentAvatar?: string;
  userColor: string;
  onSave: (url: string, color: string) => void;
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
  const [selectedColor, setSelectedColor] = useState(userColor);
  
  const generateUrl = (s: string, sd: string, color: string) => 
    `https://api.dicebear.com/7.x/${s}/svg?seed=${sd}&backgroundColor=${color.replace('#', '')}`;

  const currentUrl = generateUrl(style, seed, selectedColor);

  return (
    <div className="absolute inset-0 bg-black z-[130] flex flex-col p-8 animate-in slide-in-from-bottom duration-500 overflow-y-auto pb-12">
      <div className="flex items-center gap-4 mb-10 pt-4">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Terminal de Identidade</h2>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Sincronização de Avatar e Cores</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center">
        <div className="relative group mb-12">
          <div className="absolute inset-0 rounded-full blur-3xl transition-all" style={{ backgroundColor: `${selectedColor}33` }}></div>
          <div className="relative w-48 h-48 rounded-full border-4 p-2 overflow-hidden bg-gray-900 shadow-2xl" style={{ borderColor: `${selectedColor}88` }}>
             <img src={currentUrl} alt="Avatar Preview" className="w-full h-full object-cover scale-110" />
          </div>
          <button 
            onClick={() => setSeed(Math.random().toString(36).substring(7))}
            className="absolute bottom-1 right-1 p-3 bg-blue-600 rounded-full shadow-2xl active:rotate-180 transition-all duration-500 border-2 border-white/20"
          >
            <RefreshCw size={20} className="text-white" />
          </button>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <section>
            <p className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">Estilo de Avatar</p>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${style === s.id ? 'bg-white border-white text-black' : 'bg-white/5 border-white/10 text-gray-500'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">Cor do seu Território</p>
            <div className="grid grid-cols-4 gap-3">
              {TACTICAL_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`aspect-square rounded-xl border-4 transition-all ${selectedColor === color ? 'border-white scale-110 shadow-xl' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </section>

          <button 
            onClick={() => onSave(currentUrl, selectedColor)}
            className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase italic tracking-tighter text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"
          >
            CONFIRMAR <Check size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCustomizer;
