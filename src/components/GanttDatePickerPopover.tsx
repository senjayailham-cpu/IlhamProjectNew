import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles
} from 'lucide-react';
import { GanttRow } from './useGanttRows';

export interface GanttDatePickerPopoverProps {
  row: GanttRow;
  field: 'start' | 'finish';
  isBaseline?: boolean;
  onSave: (dateStr: string) => void;
  onClear: () => void;
  onClearBoth?: () => void;
  onClose: () => void;
}

export const GanttDatePickerPopover: React.FC<GanttDatePickerPopoverProps> = ({
  row,
  field,
  isBaseline = false,
  onSave,
  onClear,
  onClearBoth,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  const initialVal = isBaseline
    ? (field === 'start' ? (row.baselineStart || '') : (row.baselineFinish || ''))
    : (field === 'start' ? (row.start || '') : (row.finish || ''));

  const [dateValue, setDateValue] = useState<string>(initialVal);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [onClose]);

  // Adjust date by offset in days
  const stepDays = (delta: number) => {
    let base = dateValue ? new Date(dateValue) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    base.setDate(base.getDate() + delta);
    setDateValue(base.toISOString().slice(0, 10));
  };

  const setToday = () => {
    setDateValue(new Date().toISOString().slice(0, 10));
  };

  const setTomorrow = () => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    setDateValue(tm.toISOString().slice(0, 10));
  };

  const setPlusDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDateValue(d.toISOString().slice(0, 10));
  };

  const formatDisplay = (isoStr: string) => {
    if (!isoStr) return 'Tanggal belum diisi (Kosong)';
    try {
      const parts = isoStr.split('-').map(Number);
      if (parts.length !== 3) return isoStr;
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      if (isNaN(dt.getTime())) return isoStr;
      return dt.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const titleText = isBaseline
    ? (field === 'start' ? 'Baseline Start (Target Rencana)' : 'Baseline Finish (Target Rencana)')
    : (field === 'start' ? 'Tanggal Mulai Aktual (Actual Start)' : 'Tanggal Selesai Aktual (Actual Finish)');

  return (
    <div
      ref={popoverRef}
      className="absolute z-[100] left-1/2 -translate-x-1/2 top-0 mt-0.5 bg-base-surface border-2 border-base-accent/80 dark:border-base-accent rounded-2xl shadow-2xl p-3.5 flex flex-col gap-2.5 min-w-[280px] max-w-[320px] text-left animate-in fade-in zoom-in-95 duration-150 select-none text-base-text"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base-border/70 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`p-1 rounded-lg ${isBaseline ? 'bg-slate-500/20 text-slate-600 dark:text-slate-300' : 'bg-base-accent/15 text-base-accent'}`}>
            <Calendar className="h-4 w-4 shrink-0" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-condensed font-black uppercase tracking-wide text-base-text truncate">
              {titleText}
            </h4>
            <p className="text-[10.5px] text-base-muted truncate max-w-[190px]" title={row.name}>
              {row.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
          title="Tutup (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={setToday}
          className="px-2 py-1 text-[10.5px] font-condensed font-bold uppercase tracking-wider rounded-lg bg-base-accent/15 text-base-accent hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
        >
          Hari Ini
        </button>
        <button
          type="button"
          onClick={setTomorrow}
          className="px-2 py-1 text-[10.5px] font-condensed font-bold uppercase tracking-wider rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border/70 transition-colors cursor-pointer"
        >
          Besok
        </button>
        <button
          type="button"
          onClick={() => setPlusDays(7)}
          className="px-2 py-1 text-[10.5px] font-condensed font-bold uppercase tracking-wider rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border/70 transition-colors cursor-pointer"
        >
          +7 Hari
        </button>
        {field === 'finish' && row.start && (
          <button
            type="button"
            onClick={() => setDateValue(row.start!)}
            className="px-2 py-1 text-[10.5px] font-condensed font-bold uppercase tracking-wider rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
            title="Samakan dengan Tanggal Mulai"
          >
            = Start
          </button>
        )}
      </div>

      {/* Date Input with Stepper */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => stepDays(-1)}
            className="p-1.5 rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-colors cursor-pointer"
            title="Mundurkan 1 Hari"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            autoFocus
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="flex-1 text-sm font-mono font-bold bg-base-surface2 border-2 border-base-border focus:border-base-accent rounded-xl px-2.5 py-1.5 outline-none text-base-text shadow-xs text-center cursor-pointer"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave(dateValue);
              }
              if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <button
            type="button"
            onClick={() => stepDays(1)}
            className="p-1.5 rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-colors cursor-pointer"
            title="Majukan 1 Hari"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Formatted Readable Date */}
        <div className="text-center font-sans text-[11.5px] font-bold text-base-muted py-0.5">
          {formatDisplay(dateValue)}
        </div>
      </div>

      {/* Easy Delete Actions (Highlighted Red for fast 1-click removal) */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-base-border/70">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 px-2.5 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-red-500/30"
            title="Hapus / kosongkan tanggal ini"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span>Hapus Tanggal</span>
          </button>

          {onClearBoth && (
            <button
              type="button"
              onClick={onClearBoth}
              className="px-2.5 py-1.5 text-[11px] font-condensed font-bold uppercase tracking-wider rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-xs"
              title="Hapus Tanggal Start dan Tanggal Finish sekaligus"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              <span>Hapus Keduanya</span>
            </button>
          )}
        </div>

        {/* Save & Cancel Footer */}
        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-xl hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSave(dateValue)}
            className="px-4 py-1.5 text-xs font-condensed font-black uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Simpan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
