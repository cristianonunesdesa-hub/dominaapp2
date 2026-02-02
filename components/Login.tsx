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
    <div className="fixed inset-0 z-[8000] bg-black flex flex-col items-center justify-center p-8 overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
      </div>

      <div className="w-full max-w-sm animate-in fade-in zoom-in duration-500 relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-600/10 border border-blue-500/30 mb-6 shadow-[0_0_50px_rgba(37,99,235,0.2)]">
            <Shield className="text-blue-500" size={40} />
          </div>
          <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none">
            DOMINA
          </h1>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] mt-3">
            SISTEMA DE INFRAESTRUTURA
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-2xl border border-white/10">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Key size={14} /> ACESSO
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserPlus size={14} /> RECRUTAMENTO
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 bg-white/5 border border-white/10 p-6 rounded-[2.5rem]">
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                placeholder="CODINOME"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toUpperCase())}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 font-black italic text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/10 text-white"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="password"
                placeholder="CHAVE DE ACESSO"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 font-black italic text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/10 text-white"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-wider text-center animate-shake">
              ALERTA: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-6 rounded-[2rem] font-black text-xl italic uppercase shadow-xl transition-all flex items-center justify-center gap-3 border-b-4 border-blue-800 active:translate-y-1 active:border-b-0 group"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                {mode === 'login' ? 'EFETUAR ACESSO' : 'FINALIZAR REGISTRO'}
                <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
          Criptografia de Ponta-a-Ponta Ativa
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out;
          animation-iteration-count: 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
