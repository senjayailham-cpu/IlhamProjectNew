import React from 'react';
import { User, Project, TimesheetEntry } from '../../types';
import ThemeToggle from '../ThemeToggle';
import { Download } from 'lucide-react';

interface AppTopBarProps {
  activeTabLabel: string;
  currentUser: User | null;
  onLogout?: () => void;
  onDownload?: () => void;
  onChangePassword?: () => void;
  sidebarCollapsed?: boolean;
  isOffline: boolean;
  canExport: boolean;
  onExportCSV: () => void;
}

export function AppTopBar({
  activeTabLabel,
  currentUser,
  onLogout,
  onDownload,
  onChangePassword,
  sidebarCollapsed,
  isOffline,
  canExport,
  onExportCSV,
}: AppTopBarProps) {
  return (
    <header className="hidden md:flex h-14 bg-base-surface/80 backdrop-blur-md border-b border-base-border px-6 items-center justify-between sticky top-0 z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)] shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-condensed font-extrabold uppercase tracking-widest text-base-accent bg-base-accent-dim/15 px-3 py-1 rounded border border-base-accent/20">
          {activeTabLabel}
        </span>
        {isOffline && (
          <span className="px-2 py-0.5 rounded-full font-condensed font-extrabold text-[9px] uppercase bg-red-500/15 text-red-500 border border-red-500/30 tracking-wider animate-pulse">
            OFFLINE (CACHE ACTIVE)
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        
        {canExport && (
          <button 
            onClick={onExportCSV} 
            className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 transition-all font-condensed font-extrabold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            title="Download consolidated spreadsheets"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV data</span>
          </button>
        )}
      </div>
    </header>
  );
}
