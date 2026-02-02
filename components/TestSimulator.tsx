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

  const handleStartSim = () => {
    onToggle(true);
    // Teletransporte padrão para teste (Praça da Sé, SP) se não houver local
    if (!userLocation) {
      onLocationUpdate({
        lat: -23.5505,
        lng: -46.6333,
        timestamp: Date.now(),
        accuracy: 5
      }, true);
    }
  };

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
        className={`pointer-events-auto p-4 rounded-3xl border-2 flex items-center gap-3 transition-all shadow-[0_10px_40px_rgba(0,0,0,0.5)] active:scale-90 ${
          isEnabled
            ? 'bg-orange-600 border-white text-white scale-105 shadow-[0_0_25px_rgba(234,88,12,0.6)]'
            : 'bg-black/90 border-white/20 text-white/50'
        }`}
      >
        <Zap size={18} className={isEnabled ? 'fill-white animate-pulse' : ''} />
        <span className="text-[11px] font-black uppercase tracking-[0.2em]">
          {isEnabled ? 'DEBUG ATIVO' : 'MODO TESTE'}
        </span>
      </button>

      {/* Painel de Ferramentas */}
      {isEnabled && (
        <div className="pointer-events-auto bg-black/95 backdrop-blur-2xl border border-orange-500/40 p-5 rounded-[2rem] w-56 shadow-2xl animate-in slide-in-from-left-4 duration-300">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
            <Navigation2 size={14} className="text-orange-500" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Controle de Campo</span>
          </div>

          <div className="space-y-3">
            {!userLocation && (
              <button
                onClick={handleStartSim}
                className="w-full py-3 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors"
              >
                SPAWN EM SP (SÉ)
              </button>
            )}

            {/* AUTO WALK */}
            <button
              onClick={() => onAutopilotToggle(!autopilotEnabled)}
              className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                autopilotEnabled
                  ? 'bg-emerald-600 text-white border-white/20 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-white/5 text-white/40 border-white/10'
              }`}
            >
              {autopilotEnabled ? 'PILOTO AUTO: ON' : 'PILOTO AUTO: OFF'}
            </button>

            <button
              onClick={handleWipeDatabase}
              disabled={isWiping}
              className="w-full py-3 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-red-600/20 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw size={12} className={isWiping ? 'animate-spin' : ''} />
              {isWiping ? 'LIMPANDO...' : 'WIPE SERVER DATA'}
            </button>

            <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/5">
              <p className="text-[9px] leading-relaxed text-orange-400/80 font-bold uppercase italic text-center">
                Clique no mapa para definir o destino e caminhar automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSimulator;