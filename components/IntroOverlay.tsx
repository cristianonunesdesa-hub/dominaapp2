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
      className={`fixed inset-0 z-[9000] pointer-events-none transition-opacity duration-[2500ms] ease-in-out flex items-center justify-center ${isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      style={{
        background: 'radial-gradient(circle at center, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0.95) 70%, #000 100%)'
      }}
    >
      {/* Tactical Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      {/* Orbiting Scan Ring */}
      <div className="relative">
        <div className="w-[60vw] h-[60vw] rounded-full border border-emerald-500/10 shadow-[0_0_80px_rgba(16,185,129,0.05)] animate-spin-slow"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></div>
        </div>
      </div>

      <div className="absolute bottom-24 inset-x-0 text-center">
        <div className="inline-block px-4 py-1 border border-emerald-500/20 rounded-full mb-4">
          <p className="text-[7px] font-black uppercase tracking-[0.4em] text-emerald-500/40">
            Secure Handshake // Decrypting Mesh
          </p>
        </div>
        <h2 className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.8em] animate-pulse">
          INICIANDO OPERAÇÃO
        </h2>
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default IntroOverlay;
