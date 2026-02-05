import React, { useState } from 'react';
import { Zap, Navigation2, RefreshCcw, MapPin } from 'lucide-react';
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
      <button
        onClick={() => onToggle(!isEnabled)}
        className={`pointer-events-auto px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all shadow-md active:scale-90 ${isEnabled
            ? 'bg-[#f15a24] border-white text-white scale-100'
            : 'bg-black/90 border-white/20 text-white/50'
          }`}
      >
        <Zap size={10} className={isEnabled ? 'fill-white animate-pulse' : ''} />
        <span className="text-[9px] font-black uppercase tracking-wider">
          {isEnabled ? 'DEBUG' : 'MODO TESTE'}
        </span>
      </button>

      {isEnabled && (
        <div className="pointer-events-auto bg-black/95 backdrop-blur-3xl border border-orange-500/30 p-4 rounded-[1.5rem] w-[220px] shadow-2xl animate-in slide-in-from-left-4 duration-300">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Navigation2 size={12} className="text-[#f15a24]" />
              <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Controle</span>
            </div>
            {autopilotEnabled && (
              <div className="flex items-center gap-1 text-[8px] font-black text-green-500 animate-pulse">
                <MapPin size={8} /> AUTO WALK ATIVO
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onAutopilotToggle(!autopilotEnabled)}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${autopilotEnabled
                  ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] border-green-400'
                  : 'bg-white/5 text-white/30 border border-white/10'
                }`}
            >
              {autopilotEnabled ? 'AUTO WALK: ON' : 'AUTO WALK: OFF'}
            </button>

            <button
              onClick={handleWipeDatabase}
              disabled={isWiping}
              className="w-full py-3 bg-[#7f1d1d]/20 border border-red-500/20 text-red-500/80 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <RefreshCcw size={12} className={isWiping ? 'animate-spin' : ''} />
              {isWiping ? 'LIMPANDO...' : 'WIPE SERVER'}
            </button>

            <div className="p-3 bg-white/[0.02] rounded-2xl border border-white/5 mt-1">
              <p className="text-[8px] leading-tight text-white/40 font-black uppercase italic text-center tracking-tight">
                {userLocation
                  ? "CLIQUE NO MAPA PARA DEFINIR DESTINO."
                  : "CLIQUE PARA TELEPORTAR E INICIAR."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSimulator;