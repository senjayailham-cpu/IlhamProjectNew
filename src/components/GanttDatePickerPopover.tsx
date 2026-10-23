import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays
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

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const pad2 = (n: number) => String(n).padStart(2, '0');

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

  const existingVal = isBaseline
    ? (field === 'start' ? (row.baselineStart || '') : (row.baselineFinish || ''))
    : (field === 'start' ? (row.start || '') : (row.finish || ''));

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // If existing date is empty, default candidate to start date (if setting finish) or today
  const defaultCandidate = useMemo(() => {
    if (existingVal) return existingVal;
    if (field === 'finish' && row.start) return row.start;
    if (field === 'start' && row.finish) return row.finish;
    return todayStr;
  }, [existingVal, field, row.start, row.finish, todayStr]);

  const [dateValue, setDateValue] = useState<string>(defaultCandidate);

  // Parse current dateValue
  const parsed = useMemo(() => {
    let y = new Date().getFullYear();
    let m = new Date().getMonth() + 1; // 1-12
    let d = new Date().getDate();

    if (dateValue && typeof dateValue === 'string') {
      const parts = dateValue.trim().slice(0, 10).split('-');
      if (parts.length === 3) {
        const py = parseInt(parts[0], 10);
        const pm = parseInt(parts[1], 10);
        const pd = parseInt(parts[2], 10);
        if (!isNaN(py) && !isNaN(pm) && !isNaN(pd)) {
          y = py;
          m = Math.max(1, Math.min(12, pm));
          d = Math.max(1, Math.min(31, pd));
        }
      }
    }
    return { year: y, month: m, day: d };
  }, [dateValue]);

  // Calendar view navigation (Year and Month shown in the grid)
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month); // 1-12

  // Sync calendar view month/year whenever parsed changes
  useEffect(() => {
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
  }, [parsed.year, parsed.month]);

  // Close on Escape or save on Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (dateValue) {
          onSave(dateValue);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dateValue, onClose, onSave]);

  // Prevent background scrolling while modal is active
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Days in selected view month
  const daysInViewMonth = useMemo(() => {
    return new Date(viewYear, viewMonth, 0).getDate();
  }, [viewYear, viewMonth]);

  // Build calendar matrix (Monday = 0 ... Sunday = 6)
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth - 1, 1).getDay();
    const startCol = (firstDayIndex + 6) % 7; // Monday index 0

    const prevMonthDays = new Date(viewYear, viewMonth - 1, 0).getDate();
    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
    }> = [];

    // Preceding filler days from previous month
    for (let i = startCol - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = viewMonth === 1 ? 12 : viewMonth - 1;
      const y = viewMonth === 1 ? viewYear - 1 : viewYear;
      cells.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr: `${y}-${pad2(m)}-${pad2(d)}`
      });
    }

    // Days of current view month
    for (let d = 1; d <= daysInViewMonth; d++) {
      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        dateStr: `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`
      });
    }

    // Following filler days to complete grid
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remaining = totalSlots - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 12 ? 1 : viewMonth + 1;
      const y = viewMonth === 12 ? viewYear + 1 : viewYear;
      cells.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr: `${y}-${pad2(m)}-${pad2(d)}`
      });
    }

    return cells;
  }, [viewYear, viewMonth, daysInViewMonth]);

  // Month navigation
  const navMonth = (delta: number) => {
    let nextM = viewMonth + delta;
    let nextY = viewYear;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    } else if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setViewMonth(nextM);
    setViewYear(nextY);
  };

  const handleMonthChange = (newMonth: number) => {
    setViewMonth(newMonth);
    const maxDays = new Date(viewYear, newMonth, 0).getDate();
    const clampedDay = Math.min(parsed.day, maxDays);
    setDateValue(`${viewYear}-${pad2(newMonth)}-${pad2(clampedDay)}`);
  };

  const handleYearChange = (newYear: number) => {
    setViewYear(newYear);
    const maxDays = new Date(newYear, viewMonth, 0).getDate();
    const clampedDay = Math.min(parsed.day, maxDays);
    setDateValue(`${newYear}-${pad2(viewMonth)}-${pad2(clampedDay)}`);
  };

  // Quick Presets
  const setToday = () => {
    setDateValue(todayStr);
  };

  const setTomorrow = () => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    const y = tm.getFullYear();
    const m = tm.getMonth() + 1;
    const d = tm.getDate();
    setDateValue(`${y}-${pad2(m)}-${pad2(d)}`);
  };

  const setPlusDays = (days: number) => {
    let base = dateValue ? new Date(dateValue) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    base.setDate(base.getDate() + days);
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    const d = base.getDate();
    setDateValue(`${y}-${pad2(m)}-${pad2(d)}`);
  };

  // Formatted display
  const formattedDisplay = useMemo(() => {
    if (!dateValue) return null;
    try {
      const parts = dateValue.split('-').map(Number);
      if (parts.length !== 3) return dateValue;
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      if (isNaN(dt.getTime())) return dateValue;
      return dt.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateValue;
    }
  }, [dateValue]);

  // Relative status
  const relativeBadge = useMemo(() => {
    if (!dateValue) return null;
    if (dateValue === todayStr) return { text: 'Hari Ini', color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' };
    try {
      const t1 = new Date(todayStr).getTime();
      const t2 = new Date(dateValue).getTime();
      const diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) return { text: 'Besok', color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' };
      if (diffDays === -1) return { text: 'Kemarin', color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' };
      if (diffDays > 1) return { text: `+${diffDays} hr`, color: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' };
      if (diffDays < -1) return { text: `${diffDays} hr`, color: 'bg-slate-500/20 text-slate-600 dark:text-slate-400' };
    } catch {}
    return null;
  }, [dateValue, todayStr]);

  // Year options list from 2022 to 2035
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = 2022; y <= 2035; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const titleText = isBaseline
    ? (field === 'start' ? 'Target Baseline Start' : 'Target Baseline Finish')
    : (field === 'start' ? 'Tanggal Mulai Aktual' : 'Tanggal Selesai Aktual');

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={popoverRef}
        className="w-full max-w-[360px] bg-base-surface border-2 border-base-accent/80 dark:border-base-accent rounded-2xl shadow-2xl p-3.5 flex flex-col gap-2.5 text-left animate-in zoom-in-95 duration-150 select-none text-base-text my-auto overflow-hidden ring-4 ring-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-border/70 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg ${isBaseline ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-base-accent/15 text-base-accent'}`}>
              <Calendar className="h-4 w-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-condensed font-black uppercase tracking-wider text-base-text truncate">
                {titleText}
              </h4>
              <p className="text-[10px] text-base-muted font-medium truncate max-w-[240px]" title={row.name}>
                {row.wbs ? `[WBS ${row.wbs}] ` : ''}{row.name}
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

        {/* Selected Date Preview Card */}
        <div className="bg-base-surface2/80 border border-base-border/80 rounded-xl p-2.5 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-[9px] font-condensed font-black uppercase tracking-widest text-base-muted">
              Tanggal Terpilih
            </span>
            <div className="text-sm font-black text-base-text capitalize tracking-tight flex items-center gap-1.5 mt-0.5">
              <span>{formattedDisplay}</span>
              {relativeBadge && (
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md ${relativeBadge.color}`}>
                  {relativeBadge.text}
                </span>
              )}
            </div>
          </div>

          <div className="font-mono text-xs font-bold text-base-accent px-2 py-1 bg-base-accent/10 border border-base-accent/30 rounded-lg shrink-0">
            {dateValue}
          </div>
        </div>

        {/* Calendar Navigation Bar (Month & Year Dropdowns + Arrows) */}
        <div className="bg-base-surface2/50 border border-base-border/80 rounded-xl p-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => navMonth(-1)}
              className="p-1 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
              {/* Bulan Select */}
              <select
                value={viewMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                className="bg-base-surface hover:bg-base-surface3 border border-base-border focus:border-base-accent rounded-lg px-2 py-1 text-xs font-bold text-base-text outline-none cursor-pointer transition-colors"
              >
                {MONTH_NAMES_ID.map((mName, idx) => (
                  <option key={`m-${idx + 1}`} value={idx + 1} className="bg-base-surface text-base-text font-bold">
                    {mName}
                  </option>
                ))}
              </select>

              {/* Tahun Select */}
              <select
                value={viewYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="bg-base-surface hover:bg-base-surface3 border border-base-border focus:border-base-accent rounded-lg px-2 py-1 text-xs font-mono font-bold text-base-text outline-none cursor-pointer transition-colors"
              >
                {yearOptions.map((y) => (
                  <option key={`y-${y}`} value={y} className="bg-base-surface text-base-text font-mono font-bold">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => navMonth(1)}
              className="p-1 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Labels (7 cols) */}
          <div className="grid grid-cols-7 text-center font-condensed font-bold text-[10px] text-base-muted uppercase border-b border-base-border/40 pb-0.5">
            {DAY_LABELS.map((lbl, idx) => (
              <span key={`day-${idx}`} className={idx >= 5 ? 'text-amber-500 font-extrabold' : ''}>
                {lbl}
              </span>
            ))}
          </div>

          {/* Day Grid (7 cols) */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
            {calendarCells.map((cell, idx) => {
              const isSelected = cell.dateStr === dateValue;
              const isToday = cell.dateStr === todayStr;

              let cellStyle = 'hover:bg-base-surface3 text-base-text';
              if (isSelected) {
                cellStyle = 'bg-base-accent text-white font-black shadow-xs ring-2 ring-base-accent/40';
              } else if (!cell.isCurrentMonth) {
                cellStyle = 'text-slate-400/40 dark:text-slate-600 hover:text-base-text';
              } else if (isToday) {
                cellStyle = 'border border-emerald-500 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
              }

              return (
                <button
                  key={`cell-${cell.dateStr}-${idx}`}
                  type="button"
                  onClick={() => {
                    setDateValue(cell.dateStr);
                    if (!cell.isCurrentMonth) {
                      setViewMonth(cell.month);
                      setViewYear(cell.year);
                    }
                  }}
                  onDoubleClick={() => {
                    setDateValue(cell.dateStr);
                    onSave(cell.dateStr);
                  }}
                  className={`h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${cellStyle}`}
                  title={`${cell.day} ${MONTH_NAMES_ID[cell.month - 1]} ${cell.year}${isToday ? ' (Hari Ini)' : ''}`}
                >
                  <span>{cell.day}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Presets Chips */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={setToday}
            className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={setTomorrow}
            className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
          >
            Besok
          </button>
          <button
            type="button"
            onClick={() => setPlusDays(3)}
            className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
          >
            +3 Hari
          </button>
          <button
            type="button"
            onClick={() => setPlusDays(7)}
            className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
          >
            +1 Mgg
          </button>
          <button
            type="button"
            onClick={() => setPlusDays(14)}
            className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
          >
            +2 Mgg
          </button>
          <button
            type="button"
            onClick={() => setPlusDays(30)}
            className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
          >
            +1 Bln
          </button>

          {field === 'finish' && row.start && (
            <button
              type="button"
              onClick={() => setDateValue(row.start!)}
              className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition-all cursor-pointer truncate max-w-[140px]"
              title={`Samakan dengan Tanggal Mulai (${row.start})`}
            >
              = Start ({row.start})
            </button>
          )}

          {field === 'start' && row.finish && (
            <button
              type="button"
              onClick={() => setDateValue(row.finish!)}
              className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition-all cursor-pointer truncate max-w-[140px]"
              title={`Samakan dengan Tanggal Selesai (${row.finish})`}
            >
              = Finish ({row.finish})
            </button>
          )}
        </div>

        {/* Footer (Clear action + Cancel & Save buttons) */}
        <div className="flex flex-col gap-2 pt-2 border-t border-base-border/70">
          {existingVal && (
            <div className="flex items-center justify-between text-[10.5px] text-base-muted px-0.5">
              <span className="truncate max-w-[170px]">
                Tersimpan: <strong className="font-mono text-base-text">{existingVal}</strong>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onClear}
                  className="text-red-500 hover:text-red-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer transition-colors"
                  title="Hapus tanggal task ini"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Hapus</span>
                </button>
                {onClearBoth && (
                  <>
                    <span className="text-base-border/60">|</span>
                    <button
                      type="button"
                      onClick={onClearBoth}
                      className="text-red-500 hover:text-red-600 hover:underline font-bold cursor-pointer transition-colors"
                      title="Hapus Start & Finish sekaligus"
                    >
                      Hapus Kedua
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {!existingVal && (
              <button
                type="button"
                onClick={onClear}
                className="mr-auto text-[10.5px] text-base-muted hover:text-red-500 hover:underline cursor-pointer transition-colors flex items-center gap-1 font-semibold"
              >
                <Trash2 className="h-3 w-3" />
                <span>Kosongkan</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-xl bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-colors cursor-pointer shrink-0"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={!dateValue}
              onClick={() => onSave(dateValue)}
              className="px-4 py-1.5 text-xs font-condensed font-black uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
            >
              <Check className="h-4 w-4" />
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
