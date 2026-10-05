import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useUIStore } from '../store';

export interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ showLabel = true, className = '' }: ThemeToggleProps) {
  const isDark = useUIStore((s) => s.isDark);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      {/* Primary Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen((prev) => !prev);
        }}
        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-xs select-none ${
          isDark
            ? 'bg-base-surface2 hover:bg-base-surface3 border-base-border text-base-text hover:border-base-border2'
            : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-text hover:border-base-border2'
        }`}
        title={isDark ? 'Mode Gelap Aktif (Klik untuk Mode Terang, klik kanan untuk opsi)' : 'Mode Terang Aktif (Klik untuk Mode Gelap)'}
      >
        {/* Animated Icon Container */}
        <div className="relative w-4 h-4 flex items-center justify-center">
          {isDark ? (
            <Moon className="w-4 h-4 text-amber-400 transition-transform duration-300 transform group-hover:rotate-12" />
          ) : (
            <Sun className="w-4 h-4 text-amber-600 transition-transform duration-300 transform group-hover:rotate-45" />
          )}
        </div>

        {/* Dynamic Label */}
        {showLabel && (
          <span className="hidden sm:inline font-condensed font-bold text-xs uppercase tracking-wider text-base-text">
            {isDark ? 'Dark' : 'Light'}
          </span>
        )}

        {/* Small theme indicator dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            isDark ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]' : 'bg-amber-600'
          }`}
        />
      </button>

      {/* Dropdown Menu for Theme Selection (Auto / Light / Dark) */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-base-surface border border-base-border shadow-modal p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
          <div className="px-2.5 py-1.5 text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted border-b border-base-border/50">
            Pilihan Tema
          </div>
          
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-base-text hover:bg-base-surface2'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Mode Terang</span>
            </div>
            {theme === 'light' && <Check className="w-3.5 h-3.5 text-amber-500" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-base-text hover:bg-base-surface2'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span>Mode Gelap</span>
            </div>
            {theme === 'dark' && <Check className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('system');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
              theme === 'system'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-base-text hover:bg-base-surface2'
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5 text-base-muted" />
              <span>Sistem (Auto)</span>
            </div>
            {theme === 'system' && <Check className="w-3.5 h-3.5 text-base-accent" />}
          </button>
        </div>
      )}
    </div>
  );
}
