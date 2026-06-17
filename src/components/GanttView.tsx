import React, { useState, useRef, useEffect } from 'react';
import { Project, Assembly, Dependency } from '../types';
import { calcPct, esc } from '../utils/projectUtils';
import { Maximize2, Minimize2, Link2, Calendar, LayoutGrid, CheckCircle } from 'lucide-react';

interface GanttViewProps {
  projects: Project[];
  selectedMonth: string;
  setSelectedMonth: (val: string) => void;
  openDepModal: (rowKey: string) => void;
}

const BAR_COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c'];
const DEP_COLORS = {
  FS: '#6ab0f5',
  SS: '#47b87a',
  FF: '#e07060',
  SF: '#f0a832'
};

interface RowMeta {
  key: string;
  type: 'project' | 'assembly' | 'task';
  name: string;
  pct: number;
  start?: string;
  due?: string;
  color: string;
  height: number;
  midY: number;
  barStartX?: number;
  barEndX?: number;
}

export default function GanttView({
  projects,
  selectedMonth,
  setSelectedMonth,
  openDepModal
}: GanttViewProps) {
  const [ganttCat, setGanttCat] = useState<'all' | 'tray' | 'nontray'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [showDeps, setShowDeps] = useState<boolean>(true);
  const [ganttLabelW, setGanttLabelW] = useState<number>(240);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [ganttCollapsed, setGanttCollapsed] = useState<Record<string, boolean>>({});

  // Scoped project and month list configurations
  const [ganttMonthFilter, setGanttMonthFilter] = useState<string>('');
  const [ganttProjFilter, setGanttProjFilter] = useState<string>('');

  const [isResizing, setIsResizing] = useState<boolean>(false);
  const resizeStartW = useRef<number>(240);
  const resizeStartX = useRef<number>(0);

  const toggleCollapse = (pid: string) => {
    setGanttCollapsed(prev => ({ ...prev, [pid]: !prev[pid] }));
  };

  const shiftGanttMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const jumpGanttToday = () => {
    const today = new Date();
    setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  };

  // Date constants based on current selectedMonth
  const [yr, mo] = selectedMonth.split('-').map(Number);
  const mStart = new Date(yr, mo - 1, 1);
  const mEnd = new Date(yr, mo, 0);
  const totalDays = mEnd.getDate();

  const isCurrentMonth = () => {
    const today = new Date();
    return selectedMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleGanttMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setSelectedMonth(`${yr}-${String(val + 1).padStart(2, '0')}`);
  };

  const handleGanttYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setSelectedMonth(`${val}-${String(mo).padStart(2, '0')}`);
  };

  const MONTHS_LIST = [
    { value: 0, label: 'Jan' },
    { value: 1, label: 'Feb' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Apr' },
    { value: 4, label: 'May' },
    { value: 5, label: 'Jun' },
    { value: 6, label: 'Jul' },
    { value: 7, label: 'Aug' },
    { value: 8, label: 'Sep' },
    { value: 9, label: 'Oct' },
    { value: 10, label: 'Nov' },
    { value: 11, label: 'Dec' }
  ];

  const yearsArray = Array.from({ length: 11 }, (_, i) => 2024 + i); // 2024 to 2034

  const todayNum = isCurrentMonth() ? new Date().getDate() : -1;

  // Build filters dropdown options
  const monthOptionsMap: Record<string, string> = {};
  projects.filter(p => (p.status !== 'completed' || p.completedDate) && !p.isArchived).forEach(p => {
    if (p.due) {
      const d = new Date(p.due + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthOptionsMap[k] = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      }
    }
  });

  const sortedMonthFilterKeys = Object.keys(monthOptionsMap).sort();
  const sortedProjectsFilterList = [...projects].filter(p => (p.status !== 'completed' || p.completedDate) && !p.isArchived).sort((a, b) => a.name.localeCompare(b.name));

  // Core filter logic
  const filteredGanttProjects = projects.filter(p => !p.isArchived).filter(p => {
    if (ganttCat !== 'all' && p.category !== ganttCat) return false;
    if (statusFilter === 'active' && p.status !== 'active') return false;
    if (statusFilter === 'pending' && p.status !== 'pending') return false;
    if (ganttProjFilter && p.id !== ganttProjFilter) return false;

    if (ganttMonthFilter && p.due) {
      const d = new Date(p.due + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (k !== ganttMonthFilter) return false;
      } else return false;
    } else if (ganttMonthFilter && !p.due) return false;

    // Boundary check
    const pS = p.start ? new Date(p.start + 'T00:00:00') : mStart;
    const pE = p.due ? new Date(p.due + 'T00:00:00') : mEnd;
    return pS <= mEnd && pE >= mStart;
  });

  // Calculate geometric columns based on window boundary sizes
  const cellW = Math.max(24, Math.floor((Math.max(900, window.innerWidth - 64) - ganttLabelW) / totalDays));
  const dayNums = Array.from({ length: totalDays }, (_, i) => i + 1);

  const getDayX = (d: number) => ganttLabelW + (d - 1) * cellW;
  const getDayXRight = (d: number) => ganttLabelW + d * cellW;
  const getDayXMid = (d: number) => ganttLabelW + (d - 0.5) * cellW;

  // Flatten row structures and assign geometrical offsets during rendering calculation
  const rowList: RowMeta[] = [];
  let currentY = 36; // Account for header size

  filteredGanttProjects.forEach((p, pi) => {
    const pColor = BAR_COLORS[pi % BAR_COLORS.length];
    const pct = calcPct(p);

    const pRowH = 44;
    const pMidY = currentY + pRowH / 2;
    const pKey = `p:${p.id}`;

    const pStart = p.start ? new Date(p.start + 'T00:00:00') : mStart;
    const pEnd = p.due ? new Date(p.due + 'T00:00:00') : mEnd;
    const isMilestone = p.start && p.due && p.start === p.due;

    let barLeft: number | undefined;
    let barWidth = 0;
    let barStartX: number | undefined;
    let barEndX: number | undefined;

    if (isMilestone) {
      if (pStart >= mStart && pStart <= mEnd) {
        barLeft = getDayXMid(pStart.getDate());
        barStartX = barLeft;
        barEndX = barLeft;
      }
    } else {
      const visS = pStart < mStart ? mStart : (pStart > mEnd ? null : pStart);
      const visE = pEnd > mEnd ? mEnd : (pEnd < mStart ? null : pEnd);
      if (visS && visE) {
        barLeft = getDayX(visS.getDate());
        barWidth = getDayXRight(visE.getDate()) - barLeft;
        barStartX = barLeft;
        barEndX = barLeft + barWidth;
      } else if (pStart <= mEnd && pEnd >= mStart) {
        barLeft = getDayX(1);
        barWidth = getDayXRight(totalDays) - barLeft;
        barStartX = barLeft;
        barEndX = barLeft + barWidth;
      }
    }

    rowList.push({
      key: pKey,
      type: 'project',
      name: p.name,
      pct,
      start: p.start,
      due: p.due,
      color: pColor,
      height: pRowH,
      midY: pMidY,
      barStartX,
      barEndX
    });
    currentY += pRowH;

    if (!ganttCollapsed[p.id]) {
      (p.assemblies || []).forEach(a => {
        const aStart = a.start ? new Date(a.start + 'T00:00:00') : pStart;
        const aEnd = a.finish ? new Date(a.finish + 'T00:00:00') : pEnd;
        const aTotalWeight = (a.tasks || []).reduce((sum, t) => sum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
        const aWeightedScale = (a.tasks || []).reduce((sum, t) => sum + (t.pct || 0) * (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
        const aPct = aTotalWeight > 0 ? Math.round(aWeightedScale / aTotalWeight) : 0;

        const aRowH = 36;
        const aMidY = currentY + aRowH / 2;
        const aKey = `a:${p.id}:${a.id}`;

        let aBarLeft: number | undefined;
        let aBarWidth = 0;
        let aBarStartX: number | undefined;
        let aBarEndX: number | undefined;

        const visAS = aStart < mStart ? mStart : (aStart > mEnd ? null : aStart);
        const visAE = aEnd > mEnd ? mEnd : (aEnd < mStart ? null : aEnd);

        if (visAS && visAE) {
          aBarLeft = getDayX(visAS.getDate());
          aBarWidth = getDayXRight(visAE.getDate()) - aBarLeft;
          aBarStartX = aBarLeft;
          aBarEndX = aBarLeft + aBarWidth;
        } else if (aStart <= mEnd && aEnd >= mStart) {
          aBarLeft = getDayX(1);
          aBarWidth = getDayXRight(totalDays) - aBarLeft;
          aBarStartX = aBarLeft;
          aBarEndX = aBarLeft + aBarWidth;
        }

        rowList.push({
          key: aKey,
          type: 'assembly',
          name: a.name,
          pct: aPct,
          start: a.start,
          due: a.finish,
          color: pColor,
          height: aRowH,
          midY: aMidY,
          barStartX: aBarStartX,
          barEndX: aBarEndX
        });
        currentY += aRowH;

        // If the sub-assembly is NOT collapsed, push its tasks into the Gantt chart row list
        if (!ganttCollapsed[aKey]) {
          (a.tasks || []).forEach(t => {
            const tRowH = 28;
            const tKey = `t:${p.id}:${a.id}:${t.id}`;
            const tStart = t.date ? new Date(t.date + 'T00:00:00') : aStart;
            const tEnd = t.finishDate ? new Date(t.finishDate + 'T00:00:00') : aEnd;

            let tBarLeft: number | undefined;
            let tBarWidth = 0;
            let tBarStartX: number | undefined;
            let tBarEndX: number | undefined;

            const visTS = tStart < mStart ? mStart : (tStart > mEnd ? null : tStart);
            const visTE = tEnd > mEnd ? mEnd : (tEnd < mStart ? null : tEnd);

            if (visTS && visTE) {
              tBarLeft = getDayX(visTS.getDate());
              tBarWidth = getDayXRight(visTE.getDate()) - tBarLeft;
              tBarStartX = tBarLeft;
              tBarEndX = tBarLeft + tBarWidth;
            } else if (tStart <= mEnd && tEnd >= mStart) {
              tBarLeft = getDayX(1);
              tBarWidth = getDayXRight(totalDays) - tBarLeft;
              tBarStartX = tBarLeft;
              tBarEndX = tBarLeft + tBarWidth;
            }

            rowList.push({
              key: tKey,
              type: 'task',
              name: t.name,
              pct: t.pct || 0,
              start: t.date,
              due: t.finishDate,
              color: pColor,
              height: tRowH,
              midY: currentY + tRowH / 2,
              barStartX: tBarStartX,
              barEndX: tBarEndX
            });
            currentY += tRowH;
          });
        }
      });
    }
  });

  // Calculate dependency links positioning and create SVG shapes
  const linkPaths: React.ReactNode[] = [];

  if (showDeps) {
    const rowMetaMap = rowList.reduce((acc, row) => {
      acc[row.key] = row;
      return acc;
    }, {} as Record<string, RowMeta>);

    const getRowDependencies = (rowKey: string): Dependency[] => {
      if (rowKey.startsWith('p:')) {
        const p = projects.find(x => x.id === rowKey.slice(2));
        return (p && p.predecessors) || [];
      } else if (rowKey.startsWith('a:')) {
        const [, pid, aid] = rowKey.split(':');
        const p = projects.find(x => x.id === pid);
        const a = p && p.assemblies.find(x => x.id === aid);
        return (a && a.predecessors) || [];
      } else if (rowKey.startsWith('t:')) {
        const [, pid, aid, tid] = rowKey.split(':');
        const p = projects.find(x => x.id === pid);
        const a = p && p.assemblies.find(x => x.id === aid);
        const t = a && a.tasks.find(x => x.id === tid);
        return (t && t.predecessors) || [];
      }
      return [];
    };

    rowList.forEach(row => {
      const preds = getRowDependencies(row.key);
      preds.forEach(dep => {
        const fromMeta = rowMetaMap[dep.key];
        const toMeta = rowMetaMap[row.key];
        if (!fromMeta || !toMeta) return;

        const { barStartX: x1Start, barEndX: x1End, midY: y1 } = fromMeta;
        const { barStartX: x2Start, barEndX: x2End, midY: y2 } = toMeta;

        if (x1Start === undefined || x1End === undefined || x2Start === undefined || x2End === undefined) return;

        const dType = dep.type || 'FS';
        const color = DEP_COLORS[dType] || '#aaa';

        let startPtX = dType === 'FS' || dType === 'FF' ? x1End : x1Start;
        let endPtX = dType === 'FS' || dType === 'SS' ? x2Start : x2End;

        const runOut = 12; // horizontal lead distance outer limits
        const leadPtX = startPtX + runOut;
        const subPtX = endPtX - runOut;

        let pathStr = '';
        if (leadPtX <= subPtX) {
          pathStr = `M ${startPtX} ${y1} L ${leadPtX} ${y1} L ${leadPtX} ${y2} L ${endPtX} ${y2}`;
        } else {
          const midY = (y1 + y2) / 2;
          pathStr = `M ${startPtX} ${y1} L ${leadPtX} ${y1} L ${leadPtX} ${midY} L ${subPtX} ${midY} L ${subPtX} ${y2} L ${endPtX} ${y2}`;
        }

        // Draw arrowheads
        const arrowSz = 6;
        const arrowPath = `M ${endPtX - arrowSz} ${y2 - arrowSz / 2} L ${endPtX} ${y2} L ${endPtX - arrowSz} ${y2 + arrowSz / 2} Z`;

        linkPaths.push(
          <g key={`${row.key}-from-${dep.key}`}>
            <path d={pathStr} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.65" />
            <path d={arrowPath} fill={color} stroke={color} strokeWidth="1.5" />
            {dep.lag ? (
              <g transform={`translate(${(startPtX + endPtX) / 2}, ${(y1 + y2) / 2})`}>
                <rect x="-14" y="-7" width="28" height="14" rx="3" fill="var(--surface)" stroke="var(--border)" strokeWidth="0.5" />
                <text x="0" y="3" textAnchor="middle" fill={color} className="font-condensed font-extrabold text-[9px]">
                  {dep.lag > 0 ? `+${dep.lag}` : dep.lag}d
                </text>
              </g>
            ) : null}
          </g>
        );
      });
    });
  }

  // Handle resizing of the left label column
  const startResizeDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartW.current = ganttLabelW;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current;
      setGanttLabelW(Math.max(120, Math.min(500, resizeStartW.current + deltaX)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Render badges helper
  const renderDepsBadges = (rowKey: string) => {
    let predsCount = 0;
    let succsCount = 0;

    if (rowKey.startsWith('p:')) {
      const p = projects.find(x => x.id === rowKey.slice(2));
      predsCount = (p?.predecessors || []).length;
      succsCount = (p?.successors || []).length;
    } else if (rowKey.startsWith('a:')) {
      const [, pid, aid] = rowKey.split(':');
      const p = projects.find(x => x.id === pid);
      const a = p?.assemblies.find(x => x.id === aid);
      predsCount = (a?.predecessors || []).length;
      succsCount = (a?.successors || []).length;
    } else if (rowKey.startsWith('t:')) {
      const [, pid, aid, tid] = rowKey.split(':');
      const p = projects.find(x => x.id === pid);
      const a = p?.assemblies.find(x => x.id === aid);
      const t = a?.tasks.find(x => x.id === tid);
      predsCount = (t?.predecessors || []).length;
      succsCount = (t?.successors || []).length;
    }

    return (
      <div className="flex gap-1 items-center flex-shrink-0">
        {predsCount > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); openDepModal(rowKey); }}
            className="px-1.5 py-0.5 text-[9px] rounded font-condensed font-bold bg-[#6ab0f5]/15 text-[#1e4e88] border border-[#6ab0f5]/20 hover:bg-[#6ab0f5]/25 cursor-pointer leading-none"
            title="Predecessors"
          >
            ←{predsCount}
          </span>
        )}
        {succsCount > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); openDepModal(rowKey); }}
            className="px-1.5 py-0.5 text-[9px] rounded font-condensed font-bold bg-base-green-dim text-base-green border border-base-green/20 hover:bg-base-green/20 cursor-pointer leading-none"
            title="Successors"
          >
            {succsCount}→
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); openDepModal(rowKey); }}
          className="px-1.5 py-0.5 rounded font-condensed font-bold text-[9px] border border-base-border opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-base-surface3 text-base-muted hover:text-base-text transition-all flex items-center gap-0.5 cursor-pointer leading-none"
        >
          <Link2 className="h-2.5 w-2.5" /> Link
        </button>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${isFullscreen ? 'gantt-fullscreen fixed inset-0 z-50 bg-base-bg p-6 flex flex-col' : ''}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
            Gantt <span className="text-base-accent">Schedule</span>
          </h2>

          {/* Month selector */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 gap-1">
            <button
              onClick={() => shiftGanttMonth(-1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            
            <div className="flex items-center gap-0.5 font-condensed font-bold text-xs">
              {/* Month Dropdown */}
              <select
                value={mo - 1}
                onChange={handleGanttMonthChange}
                className="bg-transparent text-base-text py-0.5 px-1.5 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors uppercase text-center font-bold"
              >
                {MONTHS_LIST.map(m => (
                  <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans normal-case">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Year Dropdown */}
              <select
                value={yr}
                onChange={handleGanttYearChange}
                className="bg-transparent text-base-text py-0.5 px-1.5 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center font-bold"
              >
                {yearsArray.map(y => (
                  <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => shiftGanttMonth(1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button
            onClick={jumpGanttToday}
            className="px-2.5 py-1.5 border border-base-accent/25 hover:bg-base-accent-dim text-base-accent rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
          >
            Today
          </button>

          {/* Collapse/Expand Controls */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 gap-1">
            <button
              onClick={() => {
                const newCollapsed: Record<string, boolean> = {};
                projects.forEach(p => {
                  newCollapsed[p.id] = true;
                  (p.assemblies || []).forEach(a => {
                    newCollapsed[`a:${p.id}:${a.id}`] = true;
                  });
                });
                setGanttCollapsed(newCollapsed);
              }}
              className="px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded text-base-muted hover:text-base-text hover:bg-base-surface3 transition-colors cursor-pointer"
              title="Collapse all rows (projects and assemblies)"
            >
              Collapse All
            </button>
            <div className="w-[1px] h-3 bg-base-border" />
            <button
              onClick={() => {
                setGanttCollapsed({});
              }}
              className="px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded text-base-muted hover:text-base-text hover:bg-base-surface3 transition-colors cursor-pointer"
              title="Expand all rows (projects and assemblies)"
            >
              Expand All
            </button>
          </div>

          {/* Category tags */}
          <div className="flex items-center gap-1 bg-base-surface2 border border-base-border rounded-lg p-1.5">
            <button
              onClick={() => setGanttCat('all')}
              className={`px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded transition-colors cursor-pointer ${
                ganttCat === 'all' ? 'bg-base-accent text-white' : 'text-base-muted hover:text-base-text'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setGanttCat('tray')}
              className={`px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded transition-colors cursor-pointer ${
                ganttCat === 'tray' ? 'bg-base-blue text-white' : 'text-base-muted hover:text-base-text'
              }`}
            >
              Tray
            </button>
            <button
              onClick={() => setGanttCat('nontray')}
              className={`px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded transition-colors cursor-pointer ${
                ganttCat === 'nontray' ? 'bg-base-accent2 text-white' : 'text-base-muted hover:text-base-text'
              }`}
            >
              Non-Tray
            </button>
          </div>

          {/* Month query options drops */}
          <select
            value={ganttMonthFilter}
            onChange={(e) => setGanttMonthFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded bg-base-surface border border-base-border text-base-muted2 font-condensed font-semibold cursor-pointer outline-none"
          >
            <option value="">All months</option>
            {sortedMonthFilterKeys.map(k => (
              <option key={k} value={k}>{monthOptionsMap[k]}</option>
            ))}
          </select>

          {/* Status filter selection */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1 text-xs rounded bg-base-surface border border-base-border text-base-muted2 font-condensed font-semibold cursor-pointer outline-none"
          >
            <option value="all">All status</option>
            <option value="active">Active only</option>
            <option value="pending">Pending only</option>
          </select>

          {/* Connection drawing checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-base-muted2 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDeps}
              onChange={(e) => setShowDeps(e.target.checked)}
              className="h-3.5 w-3.5 accent-base-accent rounded border-base-border"
            />
            Show links
          </label>

          {(ganttMonthFilter || ganttProjFilter) && (
            <button
              onClick={() => { setGanttMonthFilter(''); setGanttProjFilter(''); }}
              className="text-[10px] uppercase font-condensed font-extrabold text-base-accent hover:text-base-accent/80 transition-colors"
            >
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Fullscreen controller */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 bg-base-surface font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer sm:ml-auto"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
        </button>
      </div>

      {/* Grid container viewport */}
      <div className={`shadow-card bg-base-surface border border-base-border rounded-xl relative overflow-hidden flex flex-col ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
        <div className="overflow-x-auto overflow-y-auto flex-1 relative min-h-[300px]" style={{ maxHeight: isFullscreen ? 'none' : '550px' }}>
          <div className="min-w-[1000px] relative" style={{ width: `${ganttLabelW + totalDays * cellW}px` }}>
            <table className="w-full border-collapse select-none" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: `${ganttLabelW}px` }} />
                {dayNums.map(d => (
                  <col key={d} style={{ width: `${cellW}px` }} />
                ))}
              </colgroup>

              {/* Grid Header */}
              <thead>
                <tr className="bg-base-surface2 border-b-2 border-base-border h-9">
                  <th className="font-condensed font-bold text-xs uppercase text-base-muted text-left pl-4 border-r border-base-border/50 relative">
                    Project / Sub-Assembly
                    <div
                      onMouseDown={startResizeDrag}
                      className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-base-accent/30 transition-colors z-20 ${
                        isResizing ? 'bg-base-accent/50 dragging' : ''
                      }`}
                    />
                  </th>
                  {dayNums.map(d => {
                    const isWE = new Date(yr, mo - 1, d).getDay() % 6 === 0;
                    return (
                      <th
                        key={d}
                        className={`font-condensed font-extrabold text-[10px] text-center border-r border-base-border/30 ${
                          d === todayNum ? 'bg-base-accent/15 text-base-accent' : isWE ? 'bg-base-surface3/40 text-base-muted/40 font-normal' : 'text-base-muted'
                        }`}
                      >
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Grid Body rows */}
              <tbody>
                {filteredGanttProjects.map((p, pi) => {
                  const pColor = BAR_COLORS[pi % BAR_COLORS.length];
                  const pKey = `p:${p.id}`;
                  const isColl = !!ganttCollapsed[p.id];
                  const pct = calcPct(p);

                  return (
                    <React.Fragment key={p.id}>
                      {/* Project Head row */}
                      <tr className="h-11 border-b border-base-border hover:bg-base-surface2/30 group">
                        <td className="sticky left-0 bg-base-surface border-r-2 border-base-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] z-10 pl-3 pr-2">
                          <div className="flex items-center gap-1.5 w-full h-full justify-between">
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              <button
                                onClick={() => toggleCollapse(p.id)}
                                className="p-1 rounded hover:bg-base-surface3 text-base-muted cursor-pointer"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className={`h-3 w-3 transition-transform ${isColl ? '' : 'rotate-90'}`}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </button>
                              <span className="font-condensed font-extrabold text-sm text-base-text overflow-hidden text-ellipsis whitespace-nowrap block" title={p.name}>
                                {p.name}
                              </span>
                            </div>
                            <span className="font-condensed font-extrabold text-xs text-base-muted pr-2">{pct}%</span>
                            {renderDepsBadges(pKey)}
                          </div>
                        </td>
                        {dayNums.map(d => {
                          const isWE = new Date(yr, mo - 1, d).getDay() % 6 === 0;
                          return (
                            <td
                              key={d}
                              className={`border-r border-base-border/30 border-b border-base-border/40 relative ${
                                d === todayNum ? 'bg-base-accent/5' : isWE ? 'bg-base-surface3/15' : ''
                              }`}
                            >
                              {d === todayNum && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-accent/60 z-10 pointer-events-none" />}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Assemblies list rows */}
                      {!isColl &&
                        (p.assemblies || []).map(a => {
                          const aKey = `a:${p.id}:${a.id}`;
                          const isAssemblyColl = !!ganttCollapsed[aKey];
                          const aTotalWeight = (a.tasks || []).reduce((sum, t) => sum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
                          const aWeightedScale = (a.tasks || []).reduce((sum, t) => sum + (t.pct || 0) * (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
                          const aPct = aTotalWeight > 0 ? Math.round(aWeightedScale / aTotalWeight) : 0;

                          return (
                            <React.Fragment key={a.id}>
                              <tr className="h-9 border-b border-base-border/50 hover:bg-base-surface2/30 group">
                                <td className="sticky left-0 bg-base-surface border-r-2 border-base-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] z-10 pl-6 pr-2">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="text-base-muted font-bold text-xs select-none">↳</span>
                                      
                                      <button
                                        onClick={() => toggleCollapse(aKey)}
                                        className="p-0.5 rounded hover:bg-base-surface3 text-base-muted2 cursor-pointer flex items-center justify-center shrink-0"
                                        title={isAssemblyColl ? "Expand tasks" : "Collapse tasks"}
                                      >
                                        <svg
                                          viewBox="0 0 24 24"
                                          className={`h-2.5 w-2.5 transition-transform ${isAssemblyColl ? '' : 'rotate-90'}`}
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="3.5"
                                        >
                                          <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                      </button>

                                      <span className="text-xs font-semibold text-base-muted2 overflow-hidden text-ellipsis whitespace-nowrap block" title={a.name}>
                                        {a.name}
                                      </span>
                                    </div>
                                    <span className="font-condensed font-bold text-xs text-base-muted2 pr-2">{aPct}%</span>
                                    {renderDepsBadges(aKey)}
                                  </div>
                                </td>
                                {dayNums.map(d => {
                                  const isWE = new Date(yr, mo - 1, d).getDay() % 6 === 0;
                                  return (
                                    <td
                                      key={d}
                                      className={`border-r border-base-border/20 border-b border-base-border/20 relative ${
                                        d === todayNum ? 'bg-base-accent/5' : isWE ? 'bg-base-surface3/15' : ''
                                      }`}
                                    >
                                      {d === todayNum && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-accent/60 z-10 pointer-events-none" />}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* Task list rows under assembly */}
                              {!isAssemblyColl &&
                                (a.tasks || []).map(t => {
                                  return (
                                    <tr key={t.id} className="h-7 border-b border-base-border/30 hover:bg-base-surface2/30 group bg-base-surface2/5">
                                      <td className="sticky left-0 bg-base-surface border-r-2 border-base-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] z-10 pl-10 pr-2">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <div className="flex items-center gap-1 min-w-0 flex-1">
                                            <span className="text-base-muted2/50 font-bold text-[10px] select-none">↳</span>
                                            <span className="text-[11px] text-base-muted overflow-hidden text-ellipsis whitespace-nowrap block" title={t.name}>
                                              {t.name}
                                            </span>
                                            <span 
                                              className="text-[9px] px-1 bg-base-accent/10 text-base-accent rounded font-mono font-bold shrink-0 select-none"
                                              title="Task Difficulty Level"
                                            >
                                              D:{typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="font-condensed font-bold text-[10px] text-base-muted2 pr-1">{t.pct}%</span>
                                            {renderDepsBadges(`t:${p.id}:${a.id}:${t.id}`)}
                                          </div>
                                        </div>
                                      </td>
                                      {dayNums.map(d => {
                                        const isWE = new Date(yr, mo - 1, d).getDay() % 6 === 0;
                                        return (
                                          <td
                                            key={d}
                                            className={`border-r border-base-border/15 border-b border-base-border/15 relative ${
                                              d === todayNum ? 'bg-base-accent/3' : isWE ? 'bg-base-surface3/10' : ''
                                            }`}
                                          >
                                            {d === todayNum && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-accent/60 z-10 pointer-events-none" />}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Absolute Bars Graphic Overlay Container */}
            <div className="absolute inset-0 pointer-events-none z-20">
              {rowList.map(row => {
                const { key, type, color, pct, start, due, midY, barStartX, barEndX } = row;
                if (barStartX === undefined || barEndX === undefined) return null;

                const isProject = type === 'project';
                const isMilestone = start && due && start === due;
                const barWidth = barEndX - barStartX;

                if (isMilestone) {
                  const diamondSz = 12;
                  return (
                    <div
                      key={key}
                      onClick={() => openDepModal(key)}
                      className="absolute rounded shadow-elevated border border-black/20 hover:brightness-110 cursor-pointer pointer-events-auto"
                      style={{
                        left: `${barStartX - diamondSz / 2}px`,
                        top: `${midY - diamondSz / 2}px`,
                        width: `${diamondSz}px`,
                        height: `${diamondSz}px`,
                        backgroundColor: color,
                        transform: 'rotate(45deg)',
                        transition: 'left 0.4s ease'
                      }}
                      title={`${row.name} (Milestone)`}
                    />
                  );
                }

                if (barWidth <= 0) return null;

                // Standard progress indicator bars
                const barH = type === 'project' ? 20 : (type === 'assembly' ? 12 : 7);
                const completedW = Math.max(pct > 0 ? 5 : 0, Math.round((pct / 100) * barWidth));
                const barOpacity = type === 'project' ? 0.95 : (type === 'assembly' ? 0.75 : 0.85);
                const barRadius = type === 'project' ? '4px' : '2px';

                return (
                  <div key={key} className="absolute overflow-hidden" style={{ left: `${barStartX}px`, top: `${midY - barH / 2}px`, width: `${barWidth}px`, height: `${barH}px` }}>
                    {/* Shadow Dotted placeholder */}
                    <div
                      className="absolute inset-0 rounded-md border border-dashed opacity-25"
                      style={{ borderColor: color, height: `${barH}px` }}
                    />
                    {/* Filling completed track */}
                    {completedW > 0 && (
                      <div
                        onClick={() => openDepModal(key)}
                        className="absolute left-0 top-0 bottom-0 hover:brightness-110 transition-all cursor-pointer pointer-events-auto relative shadow-card"
                        style={{
                          width: `${completedW}px`,
                          backgroundColor: color,
                          borderRadius: barRadius,
                          opacity: barOpacity
                        }}
                        title={`${row.name} — ${pct}% completion`}
                      >
                        {/* Upper gloss highlights */}
                        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/12 rounded-t pointer-events-none" />
                        {/* Inner text values */}
                        {isProject && barWidth > 60 && (
                          <div className="absolute inset-0 flex items-center px-2 select-none pointer-events-none font-condensed font-extrabold text-[10px] text-black/75">
                            {pct}%
                          </div>
                        )}
                      </div>
                    )}
                    {/* Right side due month labels */}
                    {type !== 'project' && pct > 0 && (
                      <span
                        className="absolute text-[9px] font-condensed font-bold text-base-muted2 select-none pointer-events-none"
                        style={{ left: `${completedW + 5}px`, top: '50%', transform: 'translateY(-50%)' }}
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Vectors overlay line elements */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 19 }}>
                {linkPaths}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Legend Block */}
      <div className="flex flex-wrap items-center bg-base-surface2 border border-base-border p-3.5 rounded-xl gap-4 text-xs">
        <span className="font-condensed font-bold text-xs uppercase tracking-wider text-base-muted">Dependencies index:</span>
        <div className="flex items-center gap-2 text-base-muted2">
          <span className="h-1 w-5 rounded bg-[#6ab0f5]" />
          <span>FS — Finish-to-Start</span>
        </div>
        <div className="flex items-center gap-2 text-base-muted2">
          <span className="h-1 w-5 rounded bg-[#47b87a]" />
          <span>SS — Start-to-Start</span>
        </div>
        <div className="flex items-center gap-2 text-base-muted2">
          <span className="h-1 w-5 rounded bg-[#e07060]" />
          <span>FF — Finish-to-Finish</span>
        </div>
        <div className="flex items-center gap-2 text-base-muted2">
          <span className="h-1 w-5 rounded bg-[#f0a832]" />
          <span>SF — Start-to-Finish</span>
        </div>
        <span className="text-[10px] text-base-muted ml-auto hidden md:inline">
          Hover standard table rows and click <b className="text-base-accent">Link</b> to configure predecessors and lag constraints
        </span>
      </div>
    </div>
  );
}
