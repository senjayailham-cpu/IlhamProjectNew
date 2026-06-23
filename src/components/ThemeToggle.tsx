import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Check initial preference from localStorage or fallback to dark mode since it matches "Austin Batam" aesthetic perfectly
    const stored = localStorage.getItem('theme');
    if (stored) {
      return stored === 'dark';
    }
    return true; // Default to eye-safe dark theme
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="btn btn-sm btn-ghost flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-surface2 hover:bg-base-surface3 transition-colors text-base-text border border-base-border"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-base-accent animate-pulse" />
          <span className="hidden sm:inline font-condensed font-bold text-xs uppercase tracking-wider">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-base-blue" />
          <span className="hidden sm:inline font-condensed font-bold text-xs uppercase tracking-wider">Dark Mode</span>
        </>
      )}
    </button>
  );
}
