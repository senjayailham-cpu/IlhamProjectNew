import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Lock, User, KeyRound, Eye, EyeOff, Loader2, AlertTriangle, X } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';

export function LoginPage() {
  const {
    loginId,
    setLoginId,
    loginPass,
    setLoginPass,
    loginError,
    handleLoginSubmit
  } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await handleLoginSubmit(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCapsLockCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto z-50 animate-fade-in bg-base-bg">

      <div className="bg-base-surface/95 dark:bg-base-surface/90 backdrop-blur-xl shadow-2xl border border-white/20 dark:border-base-border2 p-8 rounded-2xl w-full max-w-md flex flex-col space-y-6 animate-in zoom-in-95 ease-out duration-150 relative overflow-hidden z-10">
        
        {/* Corner Ornament */}
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none select-none overflow-hidden rounded-tr-2xl">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#9b1c2e]/6 dark:bg-[#9b1c2e]/10" />
        </div>

        {/* Logo & Identity banner */}
        <BrandLogo variant="login" />

        {/* Thin Divider */}
        <div className="border-t border-base-border/40" />

        {/* Universal Error display */}
        {loginError && (
          <div role="alert" className="p-3 text-xs bg-base-red-dim border border-base-red/25 rounded-lg text-base-red text-center font-semibold select-none animate-in fade-in duration-150">
            {loginError}
          </div>
        )}

        {/* Core Interactive Portal Login Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="login-user-id" className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              User ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base-muted">
                <User className="h-3.5 w-3.5" />
              </span>
              <input
                id="login-user-id"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter User ID..."
                className="w-full pl-9 pr-8 py-2.5 bg-base-bg border border-base-border rounded-lg text-xs select-text focus:border-base-accent focus:ring-2 focus:ring-base-accent/15 outline-none text-base-text font-medium transition-all disabled:opacity-60"
              />
              {loginId && !isSubmitting && (
                <button
                  type="button"
                  onClick={() => setLoginId('')}
                  tabIndex={-1}
                  aria-label="Clear User ID"
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-base-muted hover:text-base-text cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Password
              </label>
              {capsLockOn && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  Caps Lock aktif
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base-muted">
                <KeyRound className="h-3.5 w-3.5" />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isSubmitting}
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                onKeyUp={handleCapsLockCheck}
                onKeyDown={handleCapsLockCheck}
                placeholder="Enter password..."
                className="w-full pl-9 pr-10 py-2.5 bg-base-bg border border-base-border rounded-lg text-xs select-text focus:border-base-accent focus:ring-2 focus:ring-base-accent/15 outline-none text-base-text font-medium transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-base-accent hover:bg-base-accent2 disabled:opacity-70 disabled:cursor-not-allowed text-white font-condensed font-bold text-sm tracking-wider uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Log in to portal</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
