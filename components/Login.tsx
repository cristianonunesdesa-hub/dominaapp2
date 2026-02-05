// Arquivo: components/Login.tsx

import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User as UserIcon,
  ChevronRight,
  Loader2,
  UserPlus,
  Key
} from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          password,
          action: mode
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha na autenticação');
      }

      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[8000] bg-black flex flex-col items-center justify-center p-8 overflow-hidden select-none">
      {/* Dynamic Tactical Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:40px_40px] animate-pulse"></div>
        {/* Scanning Line */}
        <div className="absolute w-full h-[2px] bg-emerald-500/20 shadow-[0_0_20px_#10b981] animate-scan top-0"></div>
        {/* Vignette */}
        <div className="absolute inset-0 bg-radial-vignette opacity-80"></div>
      </div>

      <div className="w-full max-w-sm animate-in fade-in zoom-in duration-500 relative z-10">
        {/* Status Bar */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[8px] font-black tracking-[0.3em] text-emerald-500/60 uppercase">System: Online</span>
          </div>
          <span className="text-[8px] font-black tracking-[0.3em] text-emerald-500/60 uppercase">Protocol: v4.2.0</span>
        </div>

        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/20 mb-6 shadow-[0_0_80px_rgba(16,185,129,0.1)] group relative overflow-hidden">
            <div className="absolute inset-0 bg-emerald-500/10 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Shield className="text-emerald-500 relative z-10" size={48} />
          </div>
          <h1 className="text-7xl font-black italic tracking-tighter uppercase leading-none text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            DOMINA
          </h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="h-[1px] w-8 bg-emerald-500/30"></div>
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.5em] italic">
              Military Infrastructure
            </p>
            <div className="h-[1px] w-8 bg-emerald-500/30"></div>
          </div>
        </div>

        {/* Tactical Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-xl">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${mode === 'login'
                ? 'bg-emerald-500 text-black shadow-lg'
                : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
          >
            <Key size={12} /> Autenticação
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${mode === 'register'
                ? 'bg-emerald-500 text-black shadow-lg'
                : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
          >
            <UserPlus size={12} /> Registro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 p-6 bg-black/40 border border-emerald-500/10 rounded-[2.5rem] backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500/40 rounded-tl-[2rem]"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500/40 rounded-br-[2rem]"></div>

            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/40" size={18} />
              <input
                type="text"
                placeholder="CODINOME"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toUpperCase())}
                className="w-full bg-emerald-500/5 border border-emerald-500/10 rounded-2xl py-4 pl-12 pr-4 font-black italic text-sm focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-emerald-500/20 text-emerald-400 capitalize"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/40" size={18} />
              <input
                type="password"
                placeholder="CHAVE DE ACESSO"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-emerald-500/5 border border-emerald-500/10 rounded-2xl py-4 pl-12 pr-4 font-black italic text-sm focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-emerald-500/20 text-emerald-400"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[9px] font-black uppercase tracking-wider text-center animate-shake backdrop-blur-md">
              <span className="opacity-60">[CRITICAL ERROR]:</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden group h-20 rounded-[2rem] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_10px_40px_rgba(16,185,129,0.3)]"
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-shimmer"></div>
            <div className="flex items-center justify-center gap-3 relative z-10 text-black font-black text-lg italic uppercase tracking-tighter">
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  {mode === 'login' ? 'EFETUAR SINCRONIZAÇÃO' : 'FINALIZAR RECRUTAMENTO'}
                  <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </form>

        <p className="mt-8 text-center text-[8px] font-black text-emerald-500/30 uppercase tracking-[0.4em] italic">
          Biometric Auth Encrypted // Terminal Active
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-scan { animation: scan 4s linear infinite; }
        .animate-shimmer { animation: shimmer 4s infinite linear; }
        .animate-shake { animation: shake 0.2s ease-in-out; animation-iteration-count: 2; }
        .bg-radial-vignette {
          background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 60%, #000 100%);
        }
      `}</style>
    </div>
  );
};

export default Login;
