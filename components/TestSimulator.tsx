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
      className="fixed left-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      {/* Botão Flutuante de Toggle - Menor */}
      <button
        onClick={() => onToggle(!isEnabled)}
        className={`pointer-events-auto px-4 py-2.5 rounded-full border-2 flex items-center gap-2 transition-all shadow-lg active:scale-90 ${
          isEnabled
            ? 'bg-[#f15a24] border-white text-white scale-100'
            : 'bg-black/90 border-white/20 text-white/50'
        }`}
      >
        <Zap size={14} className={isEnabled ? 'fill-white animate-pulse' : ''} />
        <span className="text-[10px] font-black uppercase tracking-wider">
          {isEnabled ? 'DEBUG ATIVO' : 'MODO TESTE'}
        </span>
      </button>

      {/* Painel de Ferramentas - Mais estreito e botões menores */}
      {isEnabled && (
        <div className="pointer-events-auto bg-black/95 backdrop-blur-3xl border border-orange-500/30 p-4 rounded-[1.5rem] w-[200px] shadow-2xl animate-in slide-in-from-left-4 duration-300">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
            <Navigation2 size={12} className="text-[#f15a24]" />
            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Controle de Campo</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onAutopilotToggle(!autopilotEnabled)}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                autopilotEnabled
                  ? 'bg-[#10b981] text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-white/5 text-white/30 border border-white/10'
              }`}
            >
              PILOTO AUTO: {autopilotEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={handleWipeDatabase}
              disabled={isWiping}
              className="w-full py-3 bg-[#7f1d1d]/20 border border-red-500/20 text-red-500/80 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <RefreshCcw size={12} className={isWiping ? 'animate-spin' : ''} />
              {isWiping ? 'LIMPANDO...' : 'WIPE DATA'}
            </button>

            <div className="p-3 bg-white/[0.02] rounded-2xl border border-white/5 mt-1">
              <p className="text-[8px] leading-tight text-white/40 font-black uppercase italic text-center tracking-tight">
                CLIQUE NO MAPA PARA DEFINIR O DESTINO E CAMINHAR.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSimulator;