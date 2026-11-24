import React, { useEffect } from 'react';
import {
  X,
  Layers,
  Calendar,
  Search,
  Maximize2,
  Minimize2,
  Scan,
  SlidersHorizontal,
  Download,
  FileSpreadsheet,
  Undo2,
  Redo2,
  Sparkles,
  Play,
  Link,
  BookmarkCheck,
  BookmarkPlus,
  Clock,
  Flame,
  Users,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Project } from '../types';

export interface GanttViewFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // View & Navigation
  activeTab: 'gantt' | 'lookahead';
  setActiveTab: (tab: 'gantt' | 'lookahead') => void;
  lookaheadWeeks: number;
  setLookaheadWeeks: (weeks: number) => void;
  scrollToToday: () => void;
  todayFormattedShort: string;
  expandAllAssemblies: () => void;
  collapseAllAssemblies: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onCloseGantt?: () => void;
  // Search & Filter
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: 'all' | 'on-track' | 'overdue' | 'done' | 'not-started';
  setStatusFilter: (s: 'all' | 'on-track' | 'overdue' | 'done' | 'not-started') => void;
  selectedMonth?: string;
  setSelectedMonth?: (m: string) => void;
  availableMonths?: string[];
  showCompleted: boolean;
  setShowCompleted: (v: boolean) => void;
  isFilterActive: boolean;
  // Zoom
  zoomMode: 'day' | 'week' | 'month' | 'quarter';
  customPixelsPerDay: number | null;
  onSelectZoom: (mode: 'day' | 'week' | 'month' | 'quarter') => void;
  onZoomToFit: () => void;
  // Layers
  showArrows: boolean;
  setShowArrows: (v: boolean) => void;
  showProgress: boolean;
  setShowProgress: (v: boolean) => void;
  showCriticalPath: boolean;
  setShowCriticalPath: (v: boolean) => void;
  criticalCount: number;
  showSCurve: boolean;
  onToggleSCurve: (v: boolean) => void;
  showResourceLoad: boolean;
  onToggleResourceLoad: (v: boolean) => void;
  overloadedEmployeesCount: number;
  showHoursTracking: boolean;
  onToggleHoursTracking: (v: boolean) => void;
  totalHoursStats: { actual: number; plan: number; burn: number };
  showBaseline: boolean;
  onToggleBaseline: (v: boolean) => void;
  baselineCount: number;
  totalDependencyConflictsCount: number;
  onJumpToFirstConflict: () => void;
  // Scheduling & Baseline Management
  canEditSchedule: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSmartSchedule: () => void;
  onRunP6Schedule: () => void;
  autoSchedule: boolean;
  onToggleAutoSchedule: (v: boolean) => void;
  connectMode: boolean;
  onToggleConnectMode: () => void;
  canSetBaseline: boolean;
  projectsList: Project[];
  onOpenBaselineManager: () => void;
  onQuickLockBaseline: () => void;
  // Export
  isExporting: boolean;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
}

export const GanttViewFilterDrawer: React.FC<GanttViewFilterDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  lookaheadWeeks,
  setLookaheadWeeks,
  scrollToToday,
  todayFormattedShort,
  expandAllAssemblies,
  collapseAllAssemblies,
  isFullscreen,
  onToggleFullscreen,
  onCloseGantt,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  selectedMonth,
  setSelectedMonth,
  availableMonths,
  showCompleted,
  setShowCompleted,
  isFilterActive,
  zoomMode,
  customPixelsPerDay,
  onSelectZoom,
  onZoomToFit,
  showArrows,
  setShowArrows,
  showProgress,
  setShowProgress,
  showCriticalPath,
  setShowCriticalPath,
  criticalCount,
  showSCurve,
  onToggleSCurve,
  showResourceLoad,
  onToggleResourceLoad,
  overloadedEmployeesCount,
  showHoursTracking,
  onToggleHoursTracking,
  totalHoursStats,
  showBaseline,
  onToggleBaseline,
  baselineCount,
  totalDependencyConflictsCount,
  onJumpToFirstConflict,
  canEditSchedule,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSmartSchedule,
  onRunP6Schedule,
  autoSchedule,
  onToggleAutoSchedule,
  connectMode,
  onToggleConnectMode,
  canSetBaseline,
  projectsList,
  onOpenBaselineManager,
  onQuickLockBaseline,
  isExporting,
  onExportPNG,
  onExportPDF,
  onExportCSV,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const statusOptions: Array<{ value: 'all' | 'on-track' | 'overdue' | 'done' | 'not-started'; label: string }> = [
    { value: 'all', label: 'Semua Status' },
    { value: 'on-track', label: 'On Track' },
    { value: 'overdue', label: 'Terlambat' },
    { value: 'done', label: 'Selesai' },
    { value: 'not-started', label: 'Belum Mulai' },
  ];

  return (
    <div
      className="fixed inset-0 z-[280] flex justify-end bg-black/50 backdrop-blur-[1px] animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="View & Filter Gantt"
    >
      <aside
        className="w-full max-w-[420px] h-full bg-base-surface border-l border-base-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-base-border bg-base-surface2/70 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-[#9b1c2e]/15 text-[#9b1c2e] dark:text-[#f87171] shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-condensed font-black text-sm uppercase tracking-wider text-base-text truncate">
                View & Filter Gantt
              </h3>
              <p className="text-[11px] text-base-muted truncate">
                Semua kontrol tampilan, filter, jadwal & export dalam satu panel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
            title="Tutup panel (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 1. Navigasi & Mode Tampilan */}
          <section className="space-y-2.5">
            <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">
              Mode & Navigasi Cepat
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-base-surface2 p-1 rounded-xl border border-base-border">
              <button
                type="button"
                onClick={() => setActiveTab('gantt')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all whitespace-nowrap ${
                  activeTab === 'gantt'
                    ? 'bg-base-accent text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text hover:bg-base-surface'
                }`}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>Gantt Chart</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lookahead')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all whitespace-nowrap ${
                  activeTab === 'lookahead'
                    ? 'bg-base-accent text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text hover:bg-base-surface'
                }`}
              >
                <Calendar className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'lookahead' ? 'text-white' : 'text-amber-500'}`} />
                <span>Lookahead</span>
              </button>
            </div>

            {activeTab === 'lookahead' && (
              <div className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                <span className="text-xs font-condensed font-bold uppercase text-amber-700 dark:text-amber-300">
                  Rentang Lookahead
                </span>
                <select
                  value={lookaheadWeeks}
                  onChange={(e) => setLookaheadWeeks(Number(e.target.value))}
                  className="bg-base-surface border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-base-text outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map((w) => (
                    <option key={w} value={w}>
                      {w} minggu ke depan
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  scrollToToday();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-base-border bg-base-surface2 hover:bg-base-surface3 text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer transition-colors whitespace-nowrap"
              >
                <Calendar className="h-3.5 w-3.5 text-base-red shrink-0" />
                <span>Hari Ini ({todayFormattedShort})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleFullscreen();
                  onClose();
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                  isFullscreen
                    ? 'bg-base-accent text-white border-base-accent'
                    : 'border-base-border bg-base-surface2 hover:bg-base-surface3 text-base-text'
                }`}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 shrink-0" /> : <Maximize2 className="h-3.5 w-3.5 shrink-0" />}
                <span>{isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}</span>
              </button>

              <button
                type="button"
                onClick={expandAllAssemblies}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface2 text-xs font-condensed font-bold uppercase tracking-wider text-base-muted2 hover:text-base-text cursor-pointer transition-colors whitespace-nowrap"
              >
                <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                <span>Expand Semua</span>
              </button>

              <button
                type="button"
                onClick={collapseAllAssemblies}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface2 text-xs font-condensed font-bold uppercase tracking-wider text-base-muted2 hover:text-base-text cursor-pointer transition-colors whitespace-nowrap"
              >
                <Minimize2 className="h-3.5 w-3.5 shrink-0" />
                <span>Collapse Semua</span>
              </button>
            </div>
          </section>

          {/* 2. Filter & Pencarian */}
          <section className="space-y-2.5 pt-3 border-t border-base-border/70">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">
                Filter Task & Proyek
              </span>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="flex items-center gap-1 text-[10px] font-condensed font-bold uppercase text-base-red hover:underline cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama task, assembly, atau WBS..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-base-surface2 border border-base-border rounded-xl outline-none focus:border-base-accent text-base-text font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-muted hover:text-base-text cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-condensed font-bold uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap ${
                    statusFilter === opt.value
                      ? 'bg-base-accent text-white border-base-accent shadow-2xs'
                      : 'bg-base-surface2 border-base-border text-base-muted2 hover:text-base-text hover:bg-base-surface3'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {setSelectedMonth && availableMonths && availableMonths.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted block">
                  Target Bulan Proyek
                </label>
                <select
                  value={selectedMonth || 'ALL'}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-base-surface2 border border-base-border rounded-xl outline-none focus:border-base-accent text-base-text font-semibold cursor-pointer"
                >
                  <option value="ALL">SEMUA PROYEK (ALL)</option>
                  {availableMonths.map((m) => {
                    const [yr, mo] = m.split('-').map(Number);
                    const date = new Date(yr, mo - 1, 1);
                    const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
                    return (
                      <option key={m} value={m}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-base-border bg-base-surface2/50 cursor-pointer">
              <span className="text-xs font-semibold text-base-text">Tampilkan Proyek Selesai</span>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="h-4 w-4 accent-base-accent rounded cursor-pointer"
              />
            </label>
          </section>

          {/* 3. Skala Zoom */}
          <section className="space-y-2.5 pt-3 border-t border-base-border/70">
            <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">
              Skala Waktu (Zoom Timeline)
            </div>
            <div className="grid grid-cols-5 gap-1.5 bg-base-surface2 p-1 rounded-xl border border-base-border">
              {(['day', 'week', 'month', 'quarter'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSelectZoom(mode)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all whitespace-nowrap ${
                    zoomMode === mode && customPixelsPerDay === null
                      ? 'bg-base-accent text-white shadow-xs'
                      : 'text-base-muted hover:text-base-text hover:bg-base-surface'
                  }`}
                >
                  {mode}
                </button>
              ))}
              <button
                type="button"
                onClick={onZoomToFit}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                  customPixelsPerDay !== null
                    ? 'bg-base-accent text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text hover:bg-base-surface'
                }`}
                title="Paskan seluruh durasi proyek ke layar"
              >
                <Scan className="h-3 w-3 shrink-0" />
                <span>Fit</span>
              </button>
            </div>
          </section>

          {/* 4. Lapisan Analisis & Monitoring */}
          <section className="space-y-2.5 pt-3 border-t border-base-border/70">
            <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">
              Lapisan Analisis & Monitoring
            </div>

            {totalDependencyConflictsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onJumpToFirstConflict();
                  onClose();
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/50 text-red-600 dark:text-red-400 text-xs font-bold cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{totalDependencyConflictsCount} Konflik Dependensi</span>
                </span>
                <span className="text-[10px] font-condensed uppercase tracking-wider underline">Lompat →</span>
              </button>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-base-border bg-base-surface2/40 hover:bg-base-surface2 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Flame className={`h-4 w-4 shrink-0 ${showCriticalPath ? 'text-red-500 fill-red-500' : 'text-base-muted'}`} />
                  <span className="text-xs font-semibold text-base-text">Critical Path</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-500/15 text-red-600 dark:text-red-400 tabular-nums">
                    {criticalCount}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showCriticalPath}
                  onChange={(e) => setShowCriticalPath(e.target.checked)}
                  className="h-4 w-4 accent-red-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-base-border bg-base-surface2/40 hover:bg-base-surface2 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <BookmarkCheck className={`h-4 w-4 shrink-0 ${showBaseline ? 'text-slate-600 dark:text-slate-300' : 'text-base-muted'}`} />
                  <span className="text-xs font-semibold text-base-text">Baseline Target</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-500/15 text-base-muted2 tabular-nums">
                    {baselineCount}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showBaseline}
                  onChange={(e) => onToggleBaseline(e.target.checked)}
                  className="h-4 w-4 accent-slate-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-base-border bg-base-surface2/40 hover:bg-base-surface2 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className={`h-4 w-4 shrink-0 ${showHoursTracking ? 'text-blue-500' : 'text-base-muted'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-base-text">Jam Kerja Plan vs Aktual</div>
                    <div className="text-[10px] font-mono text-base-muted tabular-nums">
                      {Math.round(totalHoursStats.actual)}h / {Math.round(totalHoursStats.plan)}h ({totalHoursStats.burn}%)
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showHoursTracking}
                  onChange={(e) => onToggleHoursTracking(e.target.checked)}
                  className="h-4 w-4 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between px-3 py-2 rounded-xl border border-base-border bg-base-surface2/40 hover:bg-base-surface2 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className={`h-4 w-4 shrink-0 ${showResourceLoad ? 'text-indigo-500' : 'text-base-muted'}`} />
                  <span className="text-xs font-semibold text-base-text">Beban Resource Harian</span>
                  {overloadedEmployeesCount > 0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-500 text-white tabular-nums">
                      {overloadedEmployeesCount} overload
                    </span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={showResourceLoad}
                  onChange={(e) => onToggleResourceLoad(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <label className="flex items-center justify-between px-2.5 py-2 rounded-xl border border-base-border bg-base-surface2/40 cursor-pointer text-[11px] font-semibold text-base-text">
                  <span>Panah</span>
                  <input
                    type="checkbox"
                    checked={showArrows}
                    onChange={(e) => setShowArrows(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between px-2.5 py-2 rounded-xl border border-base-border bg-base-surface2/40 cursor-pointer text-[11px] font-semibold text-base-text">
                  <span>Progres %</span>
                  <input
                    type="checkbox"
                    checked={showProgress}
                    onChange={(e) => setShowProgress(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between px-2.5 py-2 rounded-xl border border-base-border bg-base-surface2/40 cursor-pointer text-[11px] font-semibold text-base-text">
                  <span>Kurva-S</span>
                  <input
                    type="checkbox"
                    checked={showSCurve}
                    onChange={(e) => onToggleSCurve(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* 5. Alat Penjadwalan & Baseline */}
          {canEditSchedule && (
            <section className="space-y-2.5 pt-3 border-t border-base-border/70">
              <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">
                Alat Penjadwalan & Baseline
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-condensed font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    canUndo
                      ? 'border-base-border bg-base-surface2 hover:bg-base-surface3 text-base-text cursor-pointer'
                      : 'border-base-border/50 bg-base-surface text-base-muted/40 cursor-not-allowed'
                  }`}
                >
                  <Undo2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-condensed font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    canRedo
                      ? 'border-base-border bg-base-surface2 hover:bg-base-surface3 text-base-text cursor-pointer'
                      : 'border-base-border/50 bg-base-surface text-base-muted/40 cursor-not-allowed'
                  }`}
                >
                  <Redo2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Redo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSmartSchedule();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Smart Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onRunP6Schedule();
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 text-xs font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                  <span>Hitung CPM (F9)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleAutoSchedule(!autoSchedule)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                    autoSchedule
                      ? 'bg-base-accent text-white border-base-accent shadow-xs'
                      : 'bg-base-surface2 border-base-border text-base-muted2 hover:text-base-text'
                  }`}
                >
                  <span>Auto-Shift: {autoSchedule ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const turningOn = !connectMode;
                    onToggleConnectMode();
                    if (turningOn) onClose();
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                    connectMode
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-base-surface2 border-base-border text-base-muted2 hover:text-emerald-600'
                  }`}
                >
                  <Link className="h-3.5 w-3.5 shrink-0" />
                  <span>{connectMode ? 'Drawing Link...' : 'Draw Link'}</span>
                </button>
              </div>

              {canSetBaseline && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBaselineManager();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-base-border bg-base-surface2 hover:bg-base-surface3 text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5 text-base-accent shrink-0" />
                    <span>Pengelola Baseline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickLockBaseline();
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap"
                    title={projectsList.length === 1 ? `Kunci baseline ${projectsList[0]?.name}` : 'Kunci baseline semua proyek'}
                  >
                    <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Kunci Baseline</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 6. Export Jadwal */}
          <section className="space-y-2.5 pt-3 border-t border-base-border/70">
            <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">
              Export Jadwal
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  onClose();
                  onExportPNG();
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-base-border bg-base-surface2 hover:bg-base-accent hover:text-white hover:border-base-accent text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>PNG</span>
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  onClose();
                  onExportPDF();
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-base-border bg-base-surface2 hover:bg-base-accent hover:text-white hover:border-base-accent text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  onClose();
                  onExportCSV();
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                <span>CSV</span>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-base-border bg-base-surface2/60 flex items-center justify-between gap-2 shrink-0">
          {onCloseGantt ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCloseGantt();
              }}
              className="px-3 py-1.5 rounded-lg border border-base-border text-xs font-condensed font-bold uppercase tracking-wider text-base-red hover:bg-base-red/10 cursor-pointer"
            >
              Tutup Gantt
            </button>
          ) : (
            <span className="text-[11px] text-base-muted">Tekan Esc untuk menutup</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-base-accent hover:bg-base-accent/90 text-white text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </aside>
    </div>
  );
};
