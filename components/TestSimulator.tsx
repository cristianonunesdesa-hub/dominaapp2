// Arquivo: components/TestSimulator.tsx

import React, { useState } from 'react';
import { Zap, Navigation2 } from 'lucide-react';
import { Point } from '../types';

interface TestSimulatorProps {
  onLocationUpdate: (point: Point, force: boolean) => void;
  userLocation: Point | null;
  isEnabled: boolean;
  onToggle: (active: boolean) => void;
  showOverlay: boolean;

  // ✅ NOVO: Autopilot
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
    <div className="fixed top-safe left-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {/* Botão Flutuante de Toggle */}
      <button
        onClick={() => onToggle(!isEnabled)}
        className={`pointer-events-auto p-3 rounded-2xl border flex items-center gap-2 transition-all shadow-2xl active:scale-95 ${
          isEnabled
            ? 'bg-orange-600 border-white text-white'
            : 'bg-black/80 border-white/10 text-white/40'
        }`}
      >
        <Zap size={16} className={isEnabled ? 'fill-white animate-pulse' : ''} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isEnabled ? 'DEBUG ACTIVE' : 'TEST MODE'}
        </span>
      </button>

      {/* Painel de Ferramentas */}
      {isEnabled && (
        <div className="pointer-events-auto bg-black/90 backdrop-blur-xl border border-orange-500/30 p-4 rounded-3xl w-48 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
            <Navigation2 size={12} className="text-orange-500" />
            <span className="text-[9px] font-black text-white/50 uppercase">Console de Campo</span>
          </div>

          <div className="space-y-2">
            {!userLocation && (
              <button
                onClick={handleStartSim}
                className="w-full py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter"
              >
                Spawn inicial (Sé)
              </button>
            )}

            <button
              onClick={handleWipeDatabase}
              disabled={isWiping}
              className="w-full py-2 bg-red-600/20 border border-red-500/30 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-tighter disabled:opacity-50"
            >
              {isWiping ? 'WIPING...' : 'WIPE SERVER DATA'}
            </button>

            {/* ✅ AUTO WALK */}
            <button
              onClick={() => onAutopilotToggle(!autopilotEnabled)}
              className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${
                autopilotEnabled
                  ? 'bg-emerald-600 text-white border-white/10'
                  : 'bg-white/5 text-white/60 border-white/10'
              }`}
            >
              {autopilotEnabled ? 'AUTO WALK: ON' : 'AUTO WALK: OFF'}
            </button>

            <div className="p-2 bg-white/5 rounded-lg">
              <p className="text-[8px] leading-tight text-orange-400 font-bold uppercase italic">
                Instrução: Clique no mapa para definir o destino. O AUTO WALK caminha até lá.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSimulator;
