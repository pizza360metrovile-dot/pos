/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useStore(state => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const email = `${username}@restaurant.app`;
      await login(email, password, remember);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-app p-6 overflow-hidden relative">
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "circOut" }}
        className="w-full max-w-md bg-bg-surface border border-border-light rounded-xl shadow-2xl p-8 lg:p-12 relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-accent/20 mb-6 transform -rotate-3 hover:rotate-0 transition-transform">
            LB
          </div>
          <h1 className="text-xl font-extrabold text-text-primary uppercase tracking-tight text-center">SYSTEM AUTH</h1>
          <div className="flex items-center gap-3 mt-3">
             <span className="w-8 h-px bg-border-light"></span>
             <p className="text-[11px] text-text-placeholder font-bold tracking-[0.2em] uppercase text-center">Lux Bistro RMS</p>
             <span className="w-8 h-px bg-border-light"></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="input-label ml-4">Username</label>
            <div className="relative group w-full">
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="input-field px-6 py-4 w-full"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="input-label ml-4">Password</label>
            <div className="relative group w-full">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="input-field pl-6 py-4 pr-12 w-full"
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-text-placeholder hover:text-text-primary transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-4">
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer w-6 h-6 rounded-md bg-bg-surface-2 border-border-light text-accent focus:ring-accent focus:ring-offset-white transition-all appearance-none border checked:bg-accent"
                />
                <svg className="w-4 h-4 text-white absolute left-1 top-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <span className="text-[11px] font-bold text-text-placeholder uppercase tracking-widest group-hover:text-text-primary transition-colors">Persistent Identity</span>
            </label>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-4 rounded-xl shadow-xl shadow-accent/20 transition-all transform active:scale-[0.98] group"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <span className="uppercase tracking-widest text-[11px]">Authorize System</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-border-light text-center">
          <p className="text-[10px] text-text-placeholder font-bold uppercase tracking-widest leading-relaxed">
            Proprietary Architecture v4.0.ALPHA<br/>
            <span className="opacity-40 font-mono">Secured_by_Firebase_Protocols</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
