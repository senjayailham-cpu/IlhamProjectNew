import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Lock, User, KeyRound } from 'lucide-react';

export function LoginPage() {
  const {
    loginId,
    setLoginId,
    loginPass,
    setLoginPass,
    loginError,
    handleLoginSubmit
  } = useAuth();

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-linear-to-b from-[#e8e8e8] to-[#f4f5f7] dark:from-[#0d1014] dark:to-[#151921] overflow-y-auto z-50 animate-fade-in">
      <div className="bg-base-surface shadow-modal border border-base-border2 p-8 rounded-2xl w-full max-w-md flex flex-col space-y-6 animate-in zoom-in-95 ease-out duration-150 relative overflow-hidden">
        
        {/* Corner Ornament */}
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none select-none overflow-hidden rounded-tr-2xl">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#9b1c2e]/6 dark:bg-[#9b1c2e]/10" />
        </div>

        {/* Logo & Identity banner */}
        <div className="flex flex-col items-center space-y-1.5 text-center">
          <h1 className="text-3xl font-extrabold font-condensed tracking-wider uppercase text-[#9b1c2e]">AUSTIN BATAM</h1>
          <p className="text-xs text-base-muted font-condensed tracking-widest font-bold">PROJECT & MANPOWER TRACKER</p>
        </div>

        {/* Thin Divider */}
        <div className="border-t border-base-border/40" />

        {/* Universal Error display */}
        {loginError && (
          <div className="p-3 text-xs bg-base-red-dim border border-base-red/25 rounded-lg text-base-red text-center font-semibold select-none">
            {loginError}
          </div>
        )}

        {/* Core Interactive Portal Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">User ID</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base-muted">
                <User className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter User ID..."
                className="w-full pl-9 pr-3 py-2.5 bg-base-bg border border-base-border rounded-lg text-xs select-text focus:border-base-accent outline-none text-base-text font-medium transition-colors"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base-muted">
                <KeyRound className="h-3.5 w-3.5" />
              </span>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Enter password..."
                className="w-full pl-9 pr-3 py-2.5 bg-base-bg border border-base-border rounded-lg text-xs select-text focus:border-base-accent outline-none text-base-text font-medium transition-colors"
              />
            </div>
          </div>
          <button
            id="login-submit-btn"
            type="submit"
            className="w-full py-2.5 bg-base-accent hover:bg-base-accent2 text-white font-condensed font-bold text-sm tracking-wider uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
          >
            <Lock className="h-4 w-4" />
            <span>Log in to portal</span>
          </button>
        </form>

      </div>
    </div>
  );
}

export default LoginPage;
