/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Key, Copy, Check, AlertTriangle, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getRestaurantId, generateTestingKey } from '../services/licenseService';

export default function LicenseLockScreen() {
  const activateLicense = useStore(state => state.activateLicense);
  const logout = useStore(state => state.logout);
  const user = useStore(state => state.user);

  const [restaurantId, setRestaurantId] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  
  // Developer Testing Voucher Helpers
  const [generatedKey, setGeneratedKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    getRestaurantId().then(setRestaurantId);
  }, []);

  const handleCopyText = (text: string, setCopiedState: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => {
      setCopiedState(false);
    }, 2000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError('');
    setIsActivating(true);
    try {
      await activateLicense(licenseKeyInput.trim());
      setLicenseKeyInput('');
    } catch (err: any) {
      setActivationError(err.message || 'Verification failure');
    } finally {
      setIsActivating(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!restaurantId) return;
    const key = await generateTestingKey(restaurantId, Date.now());
    setGeneratedKey(key);
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a] text-[#f8fafc] flex items-center justify-center z-[9999] overflow-auto py-10 px-4">
      <div className="w-full max-w-md bg-[#1e293b] border border-slate-700/60 rounded-2xl p-8 shadow-2xl relative">
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-[#06b6d4]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#3b82f6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Key className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white uppercase sm:text-2xl">
              License Locked
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-semibold">
              POS SUBSCRIPTION REQUIRED
            </p>
          </div>
          
          <div className="p-3 bg-red-950/20 border border-red-800/30 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider leading-relaxed">
            All cashier register channels, local ticket print engines, and inventory metrics are locked. Please activate a valid licensing signature below.
          </div>
        </div>

        <div className="space-y-6">
          {/* Option B: Restaurant ID display with Copy */}
          <div className="bg-[#0f172a]/90 rounded-xl p-5 border border-slate-800 flex justify-between items-center transform transition duration-200 hover:border-slate-700">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">POS Unique Identifier</span>
              <p className="text-[14px] font-mono font-bold text-cyan-300 uppercase tracking-tight mt-1 truncate max-w-[240px]">
                {restaurantId || 'Generating...'}
              </p>
            </div>
            <button
              onClick={() => handleCopyText(restaurantId, setCopiedId)}
              className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl text-slate-300 hover:text-white transition duration-150 active:scale-95 flex items-center justify-center cursor-pointer pointer-events-auto"
              title="Copy Unique POS ID"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Option A: Activation Form */}
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cryptographic License Key</label>
              <textarea
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                placeholder="Paste your Base64 license key here..."
                rows={4}
                className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition resize-none pointer-events-auto"
                required
              />
            </div>

            {activationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{activationError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isActivating || !licenseKeyInput.trim()}
              className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-cyan-600/10 hover:shadow-cyan-500/20 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed pointer-events-auto"
            >
              {isActivating ? 'Verifying Cipher Signature...' : 'Activate POS System'}
            </button>
          </form>

          {/* Developer Testing Vouchers Panel */}
          {/* <div className="bg-[#1e293b] rounded-xl p-5 border border-dashed border-slate-700/80 space-y-3">
            <div>
              <h4 className="font-bold text-[11px] text-white uppercase tracking-wider">Verification Sandbox</h4>
              <p className="text-[9px] text-slate-400 uppercase tracking-tight mt-0.5">Generate a signature matching this POS instance.</p>
            </div>

            {!generatedKey ? (
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={!restaurantId}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-700 transition cursor-pointer disabled:opacity-50 pointer-events-auto"
              >
                Instantly manufacture valid key
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-[#0f172a] border border-slate-800 rounded-lg font-mono text-[9px] select-all break-all whitespace-pre-wrap text-cyan-200">
                  {generatedKey}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(generatedKey, setCopiedKey)}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition cursor-pointer pointer-events-auto"
                  >
                    {copiedKey ? 'Voucher Copied!' : 'Copy Key'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGeneratedKey(''); setCopiedKey(false); }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-black uppercase text-slate-400 cursor-pointer pointer-events-auto"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div> */}

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-tight">Active User: {user?.email}</span>
            <button
              onClick={() => logout()}
              className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest flex items-center gap-1 cursor-pointer pointer-events-auto"
            >
              <LogOut className="w-3 h-3" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
