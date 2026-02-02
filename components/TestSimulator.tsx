
import React from 'react';
import { Zap } from 'lucide-react';
import { Point } from '../types';

interface TestSimulatorProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
  onManualLocation: (point: Point, force: boolean) => void;
  userLocation: Point | null;
  isVisible: boolean;
}

const TestSimulator: React.FC<TestSimulatorProps> = ({ 
  isActive, 
  onToggle, 
  onManualLocation, 
  userLocation,
  isVisible
}) => {
  if (!isVisible) return null;

  const handleToggle = () => {
    const nextState = !isActive;
    onToggle(nextState);
    
    // Se ativar e não tiver localização, teleporta para um ponto inicial padrão (São Paulo)
    if (nextState && !userLocation) {
      onManualLocation({ 
        lat: -23.5505, 
        lng: -46.6333, 
        timestamp: Date.now(),
        accuracy: 5 
      }, true);
    }
  };

  return (
    <div className="absolute top-12 left-5 z-[2500] pointer-events-none animate-in fade-in slide-in-from-left duration-1000">
      <button 
        onClick={handleToggle} 
        className={`pointer-events-auto p-3 rounded-xl border flex items-center gap-2 transition-all active:scale-90 ${
          isActive 
            ? 'bg-orange-600 border-white shadow-[0_0_20px_rgba(234,88,12,0.5)]' 
            : 'bg-black/60 border-white/10 text-white/40'
        }`}
      >
        <Zap size={14} className={isActive ? 'fill-white animate-pulse' : ''} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          {isActive ? 'SIMULADOR ON' : 'TESTE'}
        </span>
      </button>
      
      {isActive && (
        <div className="mt-2 bg-orange-600/20 border border-orange-500/30 px-3 py-1.5 rounded-lg backdrop-blur-md">
          <p className="text-[8px] font-black text-orange-400 uppercase tracking-tighter">
            Toque no mapa para mover
          </p>
        </div>
      )}
    </div>
  );
};

export default TestSimulator;
