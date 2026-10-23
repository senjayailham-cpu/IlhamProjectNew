import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  format,
  parseISO,
  isValid,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday as isDateToday,
  isBefore,
  isAfter
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';

export interface DatePickerProps {
  value?: string | null; // ISO YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string; // ISO YYYY-MM-DD
  maxDate?: string; // ISO YYYY-MM-DD
  className?: string; // Outer wrapper class
  inputClassName?: string; // Trigger input box class
  showPresets?: boolean;
  allowClear?: boolean;
  align?: 'left' | 'right';
  id?: string;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Pilih Tanggal...',
  label,
  helperText,
  error,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  className = '',
  inputClassName = '',
  showPresets = true,
  allowClear = true,
  align = 'left',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse valid Date object from ISO string
  const selectedDate = useMemo(() => {
    if (!value || typeof value !== 'string') return null;
    const clean = value.trim().slice(0, 10);
    const parsed = parseISO(clean);
    return isValid(parsed) ? parsed : null;
  }, [value]);

  // View state for month & year currently displayed in the calendar
  const today = useMemo(() => new Date(), []);
  const initialViewDate = selectedDate || today;
  const [viewYear, setViewYear] = useState<number>(initialViewDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialViewDate.getMonth() + 1); // 1 - 12

  // Sync calendar view month/year when selected date changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth() + 1);
    }
  }, [selectedDate]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Generate matrix for current view month
  const calendarCells = useMemo(() => {
    const currentMonthDate = new Date(viewYear, viewMonth - 1, 1);
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // getDay returns 0 for Sunday, 1 for Monday... We want Monday = 0
    const startDayIndex = (getDay(monthStart) + 6) % 7;

    const cells: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isDisabled: boolean;
    }> = [];

    // Preceding filler days from previous month
    for (let i = startDayIndex; i > 0; i--) {
      const d = addDays(monthStart, -i);
      const str = format(d, 'yyyy-MM-dd');
      cells.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isDisabled: false
      });
    }

    // Days of current month
    daysInMonth.forEach((d) => {
      const str = format(d, 'yyyy-MM-dd');
      let isDisabled = false;
      if (minDate && str < minDate) isDisabled = true;
      if (maxDate && str > maxDate) isDisabled = true;
      cells.push({
        date: d,
        dateStr: str,
        isCurrentMonth: true,
        isDisabled
      });
    });

    // Following filler days to complete grid (multiples of 7)
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remaining = totalSlots - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = addDays(monthEnd, i);
      const str = format(d, 'yyyy-MM-dd');
      cells.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isDisabled: false
      });
    }

    return cells;
  }, [viewYear, viewMonth, minDate, maxDate]);

  // Navigation steps
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

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Quick Preset Actions
  const applyPreset = (d: Date) => {
    const str = format(d, 'yyyy-MM-dd');
    onChange(str);
    setIsOpen(false);
  };

  // Human readable formatted label
  const formattedText = useMemo(() => {
    if (!selectedDate) return '';
    try {
      return format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale });
    } catch {
      return value || '';
    }
  }, [selectedDate, value]);

  const shortFormattedText = useMemo(() => {
    if (!selectedDate) return '';
    try {
      return format(selectedDate, 'd MMM yyyy', { locale: idLocale });
    } catch {
      return value || '';
    }
  }, [selectedDate, value]);

  // Generate Year options
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    const base = new Date().getFullYear();
    for (let y = base - 5; y <= base + 10; y++) {
      list.push(y);
    }
    return list;
  }, []);

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block select-none"
        >
          {label}
          {required && <span className="text-red-500 ml-1 font-bold">*</span>}
        </label>
      )}

      {/* Trigger Box */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`group relative flex items-center justify-between gap-2 px-3 py-2 bg-base-surface border rounded-xl transition-all select-none ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-base-surface2 border-base-border'
            : isOpen
            ? 'border-base-accent ring-2 ring-base-accent/20 cursor-pointer shadow-sm'
            : 'border-base-border hover:border-base-accent/60 cursor-pointer hover:shadow-xs'
        } ${error ? 'border-red-500 ring-1 ring-red-500/20' : ''} ${inputClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Calendar
            className={`h-4 w-4 shrink-0 transition-colors ${
              selectedDate ? 'text-base-accent' : 'text-base-muted'
            }`}
          />
          {selectedDate ? (
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-base-text truncate capitalize">
                {shortFormattedText}
              </span>
              <span className="hidden sm:inline-block font-mono text-[10px] text-base-muted bg-base-surface2 border border-base-border px-1.5 py-0.2 rounded font-bold">
                {value}
              </span>
            </div>
          ) : (
            <span className="text-xs sm:text-sm text-base-muted italic truncate">
              {placeholder}
            </span>
          )}
        </div>

        {/* Clear & Arrow Icons */}
        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedDate && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-base-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Kosongkan tanggal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {helperText && !error && (
        <span className="text-[10px] text-base-muted">{helperText}</span>
      )}
      {error && <span className="text-[10px] text-red-500 font-bold">{error}</span>}

      {/* Floating Calendar Overlay */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute top-full mt-1.5 z-[100] ${
            align === 'right' ? 'right-0' : 'left-0'
          } w-[310px] sm:w-[330px] bg-base-surface border-2 border-base-accent/70 dark:border-base-accent rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 text-left animate-in fade-in zoom-in-95 duration-100 select-none text-base-text`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Calendar Header with Navigation & Dropdowns */}
          <div className="flex items-center justify-between gap-1 border-b border-base-border/60 pb-2">
            <button
              type="button"
              onClick={() => navMonth(-1)}
              className="p-1 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1 justify-center min-w-0">
              {/* Bulan Select */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-base-surface2 hover:bg-base-surface3 border border-base-border focus:border-base-accent rounded-lg px-2 py-1 text-xs font-bold text-base-text outline-none cursor-pointer transition-colors"
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
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-base-surface2 hover:bg-base-surface3 border border-base-border focus:border-base-accent rounded-lg px-2 py-1 text-xs font-mono font-bold text-base-text outline-none cursor-pointer transition-colors"
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
              className="p-1 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
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
              const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
              const isToday = isDateToday(cell.date);

              let cellStyle = 'hover:bg-base-surface2 text-base-text';
              if (cell.isDisabled) {
                cellStyle = 'opacity-30 cursor-not-allowed text-base-muted';
              } else if (isSelected) {
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
                  disabled={cell.isDisabled}
                  onClick={() => handleSelectDate(cell.dateStr)}
                  className={`h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${cellStyle}`}
                  title={`${cell.date.getDate()} ${MONTH_NAMES_ID[cell.date.getMonth()]} ${cell.date.getFullYear()}${
                    isToday ? ' (Hari Ini)' : ''
                  }`}
                >
                  <span>{cell.date.getDate()}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Presets Bar */}
          {showPresets && (
            <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-base-border/50">
              <button
                type="button"
                onClick={() => applyPreset(today)}
                className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset(addDays(today, 1))}
                className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
              >
                Besok
              </button>
              <button
                type="button"
                onClick={() => applyPreset(addDays(today, 7))}
                className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
              >
                +1 Mgg
              </button>
              <button
                type="button"
                onClick={() => applyPreset(addDays(today, 14))}
                className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
              >
                +2 Mgg
              </button>
              <button
                type="button"
                onClick={() => applyPreset(addDays(today, 30))}
                className="px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border transition-all cursor-pointer"
              >
                +1 Bln
              </button>
              {allowClear && selectedDate && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="ml-auto px-2 py-0.5 text-[10px] font-condensed font-bold uppercase rounded-lg text-red-500 hover:bg-red-500/10 hover:underline transition-all cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatePicker;
