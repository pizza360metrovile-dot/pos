import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../store";
import { Lock, AlertCircle, ChefHat } from "lucide-react";

export default function AuthScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useStore((state) => state.login);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    const result = login(password);
    if (result.success) {
      setError("");
    } else {
      setError(result.error || "Incorrect password");
      setPassword("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4 selection:bg-blue-105 selection:text-blue-900">
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm flex flex-col space-y-6">
        {/* Top Header Card Accent */}
        <div className="border-b border-[#E5E7EB] pb-6 text-center relative">
          <div className="absolute -top-4 -right-4 flex items-center space-x-1 bg-[#1A1D23] text-white px-2 py-1 text-[9px] font-mono uppercase tracking-wider rounded-[4px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
            <span>SECURE GATEWAY</span>
          </div>
          {/* <div className="mx-auto w-12 h-12 bg-[#F7F8FA] text-[#3B82F6] border border-[#E5E7EB] rounded-lg flex items-center justify-center mb-3"> */}
            {/* <ChefHat className="w-6 h-6 text-[#3B82F6]" /> */}
          {/* </div> */}
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Xenzua POS</h1>
          <p className="text-[#6B7280] text-xs mt-1">Live Management & Audits Control Panel</p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="text-center">
            <span className="text-[#6B7280] text-[11px] uppercase tracking-wider font-semibold">Security Authorization</span>
            <p className="text-[#374151] text-xs mt-1.5 leading-relaxed">
              Please enter your management credentials to access live sales metrics and ingredient logs.
            </p>
          </div>

          {/* Input Wrapper */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#374151] block uppercase tracking-wide">
              Authorization Code
            </label>
            <div className="relative rounded-[8px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                <Lock className="h-4 w-4 text-[#6B7280]" />
              </div>
              <input
                ref={inputRef}
                id="admin-password-input"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="••••••••"
                className="block w-full pl-11 pr-3 py-2.5 border-[1.5px] border-[#E5E7EB] bg-white rounded-[8px] focus:outline-none focus:ring-3 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] text-[#111827] tracking-widest text-lg transition-all"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div id="auth-error-message" className="bg-[#DC2626] text-white p-3 rounded-[8px] flex items-start space-x-2 text-xs font-medium animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-white" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit btn */}
          <button
            id="auth-submit-btn"
            type="submit"
            className="w-full bg-[#3B82F6] hover:opacity-90 active:scale-[0.98] text-white py-[10px] px-4 rounded-[8px] font-semibold text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer border border-transparent shadow-xs"
          >
            <span>Verify & Proceed</span>
          </button>
        </form>

        {/* Footer */}
        
      </div>
      
      {/* Friendly note for convenience */}
      <div className="mt-4 text-center">
        
      </div>
    </div>
  );
}
