// Arquivo: components/TestSimulator.tsx

import React, { useState } from 'react';
import { Zap, Navigation2, RefreshCcw } from 'lucide-react';
import { Point } from '../types';

interface TestSimulatorProps {
  onLocationUpdate: (point: Point, force: boolean) => void;
  userLocation: Point | null;
  isEnabled: boolean;
  onToggle: (active: boolean) => void;
  showOverlay: boolean;
  autopilotEnabled: boolean;
  onAutopilotToggle: (active: boolean) => void;
}

const TestSimulator: React.FC<TestSimulatorProps> = ({
  onLocationUpdate,
  userLocation,
  isEnabled,
  onToggle,
  showOverlay,
  autopilotEnabled,
  onAutopilotToggle
}) => {
  const [isWiping, setIsWiping] = useState(false);

  if (!showOverlay) return null;

  const handleWipeDatabase = async () => {
    if (!confirm("⚠️ ALERTA: Deseja zerar TODAS as capturas e usuários do servidor agora?")) return;
    setIsWiping(true);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipe: true })
      });
      alert("BANCO DE DADOS ZERADO. Reinicie o app.");
      window.location.reload();
    } catch (e) {
      alert("Erro ao zerar: " + e);
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div 
      className="fixed left-5 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
    >
      {/* Botão Flutuante de Toggle */}
      <button
        onClick={() => onToggle(!isEnabled)}
        className={`pointer-events-auto px-6 py-4 rounded-[1.8rem] border-2 flex items-center gap-3 transition-all shadow-[0_10px_40px_rgba(0,0,0,0.5)] active:scale-90 ${
          isEnabled
            ? 'bg-[#f15a24] border-white text-white scale-105 shadow-[0_0_25px_rgba(241,90,36,0.6)]'
            : 'bg-black/90 border-white/20 text-white/50'
        }`}
      >
        <Zap size={18} className={isEnabled ? 'fill-white animate-pulse' : ''} />
        <span className="text-[12px] font-black uppercase tracking-[0.2em]">
          {isEnabled ? 'DEBUG ATIVO' : 'MODO TESTE'}
        </span>
      </button>

      {/* Painel de Ferramentas - Reformulado conforme o Print */}
      {isEnabled && (
        <div className="pointer-events-auto bg-[#0a0a0a] backdrop-blur-3xl border-2 border-orange-500/40 p-6 rounded-[2.5rem] w-[240px] shadow-2xl animate-in slide-in-from-left-4 duration-300">
          <div className="flex items-center gap-3 mb-6 pb-2 border-b border-white/5">
            <Navigation2 size={16} className="text-[#f15a24] fill-[#f15a24]/20" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Controle de Campo</span>
          </div>

          <div className="space-y-4">
            {/* Botão Piloto Auto - VERDE quando ON */}
            <button
              onClick={() => onAutopilotToggle(!autopilotEnabled)}
              className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                autopilotEnabled
                  ? 'bg-[#10b981] text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                  : 'bg-white/5 text-white/30 border border-white/10'
              }`}
            >
              {autopilotEnabled ? 'PILOTO AUTO: ON' : 'PILOTO AUTO: OFF'}
            </button>

            {/* Botão Wipe - Vermelho Escuro */}
            <button
              onClick={handleWipeDatabase}
              disabled={isWiping}
              className="w-full py-5 bg-[#7f1d1d]/30 border border-red-500/20 text-red-500 rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw size={14} className={isWiping ? 'animate-spin' : ''} />
              {isWiping ? 'LIMPANDO...' : 'WIPE SERVER DATA'}
            </button>

            {/* Texto Descritivo igual ao Print */}
            <div className="p-4 bg-white/[0.02] rounded-3xl border border-white/5 mt-2">
              <p className="text-[10px] leading-relaxed text-[#f15a24]/80 font-black uppercase italic text-center tracking-tight">
                CLIQUE NO MAPA PARA DEFINIR O DESTINO E CAMINHAR AUTOMATICAMENTE.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSimulator;