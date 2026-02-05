import React, { useEffect, useState } from 'react';

interface IntroOverlayProps {
  isVisible: boolean;
}

const IntroOverlay: React.FC<IntroOverlayProps> = ({ isVisible }) => {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) setShouldRender(true);
    else {
      const timer = setTimeout(() => setShouldRender(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9000] pointer-events-none transition-opacity duration-[2500ms] ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 60%, #000 100%), #050a14'
      }}
    >
      {/* Estrelas Estáticas */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full opacity-40"
            style={{
              width: Math.random() * 2 + 'px',
              height: Math.random() * 2 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
            }}
          />
        ))}
      </div>
      
      {/* Glow do "Globo" */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[80vw] h-[80vw] rounded-full border border-blue-500/10 shadow-[0_0_100px_rgba(59,130,246,0.1)]"></div>
      </div>

      <div className="absolute bottom-20 inset-x-0 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-500/60 animate-pulse">
          Sincronizando Malha Tática
        </p>
      </div>
    </div>
  );
};

export default IntroOverlay;
