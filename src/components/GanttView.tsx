import React, { useState, useRef, useEffect } from 'react';
import { Project, Assembly, Dependency } from '../types';
import { calcPct, esc, getSequenceNumber } from '../utils/projectUtils';
import { Maximize2, Minimize2, Link2, Calendar, LayoutGrid, CheckCircle } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';

interface GanttViewProps {
  projects: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
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
  activityCode?: string;
  difficulty?: number;
  assignedResources?: string;
  isMilestone?: boolean;
}

export default function GanttView({
  projects,
  setProjects,
  selectedMonth,
  setSelectedMonth,
  openDepModal
}: GanttViewProps) {
  const [ganttCat, setGanttCat] = useState<'all' | 'tray' | 'nontray'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('active');
  const [showDeps, setShowDeps] = useState<boolean>(true);
  const [ganttLabelW, setGanttLabelW] = useState<number>(240);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.search.includes('fullscreen=gantt');
  });
  const [ganttCollapsed, setGanttCollapsed] = useState<Record<string, boolean>>({});

  const { saveItem } = useFirestore();

  interface DragState {
    rowKey: string;
    type: 'drag' | 'resize-left' | 'resize-right';
    startX: number;
    originalStart: string;
    originalDue: string;
    tempStart?: string;
    tempDue?: string;
  }

  const [dragState, setDragState] = useState<DragState | null>(null);

  // Scoped project and month list configurations
  const [ganttMonthFilter, setGanttMonthFilter] = useState<string>('');
  const [ganttProjFilter, setGanttProjFilter] = useState<string>('');
  const [ganttDuration, setGanttDuration] = useState<1 | 4>(1);

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
  const mEnd = ganttDuration === 1
    ? new Date(yr, mo, 0)
    : new Date(yr, mo - 1 + 4, 0);

  // Generate days array dynamically
  interface GanttDay {
    index: number;
    date: Date;
    isWeekend: boolean;
    isToday: boolean;
    dayOfMonth: number;
    monthLabel: string;
    formattedDate: string;
  }

  const ganttDays: GanttDay[] = [];
  const tempDate = new Date(mStart);
  const todayStr = new Date().toISOString().slice(0, 10);
  let indexIdx = 1;

  while (tempDate <= mEnd) {
    const currentDate = new Date(tempDate);
    const formattedDate = currentDate.toISOString().slice(0, 10);
    const isWeekend = currentDate.getDay() % 6 === 0;
    const isToday = formattedDate === todayStr;

    ganttDays.push({
      index: indexIdx,
      date: currentDate,
      isWeekend,
      isToday,
      dayOfMonth: currentDate.getDate(),
      monthLabel: currentDate.toLocaleDateString('en-US', { month: 'short' }),
      formattedDate
    });

    tempDate.setDate(tempDate.getDate() + 1);
    indexIdx++;
  }

  const totalDays = ganttDays.length;

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
    if (statusFilter === 'completed' && p.status !== 'completed') return false;
    if (ganttProjFilter && p.id !== ganttProjFilter) return false;

    // If target month is set, strictly use it
    if (p.targetMonth) {
      if (ganttMonthFilter && p.targetMonth !== ganttMonthFilter) return false;
      return p.targetMonth === selectedMonth;
    }

    if (ganttMonthFilter && p.due) {
      const d = new Date(p.due + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (k !== ganttMonthFilter) return false;
      } else return false;
    } else if (ganttMonthFilter && !p.due) return false;

    const pS = p.start ? new Date(p.start + 'T00:00:00') : mStart;
    const pE = p.due ? new Date(p.due + 'T00:00:00') : mEnd;
    return (pS <= mEnd && pE >= mStart);
  });

  // Calculate geometric columns based on window boundary sizes
  const cellW = Math.max(24, Math.floor((Math.max(900, window.innerWidth - 64) - ganttLabelW) / totalDays));

  const shiftDateStr = (dateStr: string, days: number): string => {
    if (!dateStr) return dateStr;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
  };

  const updateRowDates = (rowKey: string, newStart: string, newDue: string) => {
    const parts = rowKey.split(':');
    const typeLetter = parts[0]; // 'p', 'a', or 't'
    const pId = parts[1];
    
    const updatedProjects = projects.map(p => {
      if (p.id !== pId) return p;
      
      if (typeLetter === 'p') {
        return {
          ...p,
          start: newStart,
          due: newDue
        };
      } else if (typeLetter === 'a') {
        const aId = parts[2];
        const updatedAssemblies = (p.assemblies || []).map(asm => {
          if (asm.id !== aId) return asm;
          return {
            ...asm,
            start: newStart,
            finish: newDue
          };
        });
        return {
          ...p,
          assemblies: updatedAssemblies
        };
      } else if (typeLetter === 't') {
        const aId = parts[2];
        const tId = parts[3];
        const updatedAssemblies = (p.assemblies || []).map(asm => {
          if (asm.id !== aId) return asm;
          const updatedTasks = (asm.tasks || []).map(tsk => {
            if (tsk.id !== tId) return tsk;
            return {
              ...tsk,
              date: newStart,
              finishDate: newDue
            };
          });
          return {
            ...asm,
            tasks: updatedTasks
          };
        });
        return {
          ...p,
          assemblies: updatedAssemblies
        };
      }
      return p;
    });

    if (setProjects) {
      setProjects(updatedProjects);
    }
    const changedP = updatedProjects.find(p => p.id === pId);
    if (changedP) {
      saveItem('projects', changedP);
    }
  };

  const handleBarMouseDown = (e: React.MouseEvent, rowKey: string, type: 'drag' | 'resize-left' | 'resize-right', origStart: string, origDue: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startStr = origStart || selectedMonth + '-01';
    const dueStr = origDue || startStr;
    
    setDragState({
      rowKey,
      type,
      startX: e.clientX,
      originalStart: startStr,
      originalDue: dueStr,
      tempStart: startStr,
      tempDue: dueStr
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / cellW);
      
      let tempStart = dragState.originalStart;
      let tempDue = dragState.originalDue;
      
      if (dragState.type === 'drag') {
        tempStart = shiftDateStr(dragState.originalStart, deltaDays);
        tempDue = shiftDateStr(dragState.originalDue, deltaDays);
      } else if (dragState.type === 'resize-left') {
        tempStart = shiftDateStr(dragState.originalStart, deltaDays);
        if (tempStart > tempDue) tempStart = tempDue;
      } else if (dragState.type === 'resize-right') {
        tempDue = shiftDateStr(dragState.originalDue, deltaDays);
        if (tempDue < tempStart) tempDue = tempStart;
      }
      
      setDragState(prev => prev ? {
        ...prev,
        tempStart,
        tempDue
      } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const hasMoved = Math.abs(deltaX) > 3;
      
      if (hasMoved && dragState.tempStart && dragState.tempDue) {
        updateRowDates(dragState.rowKey, dragState.tempStart, dragState.tempDue);
      } else {
        openDepModal(dragState.rowKey);
      }
      
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, cellW, projects, setProjects]);

  const getDayX = (d: number) => ganttLabelW + (d - 1) * cellW;
  const getDayXRight = (d: number) => ganttLabelW + d * cellW;
  const getDayXMid = (d: number) => ganttLabelW + (d - 0.5) * cellW;

  const getDayIndexForDate = (date: Date): number => {
    const dStr = date.toISOString().slice(0, 10);
    const fIdx = ganttDays.findIndex(gd => gd.formattedDate === dStr);
    if (fIdx !== -1) return fIdx + 1;
    if (date < mStart) return 1;
    if (date > mEnd) return totalDays;
    return 1;
  };

  const getBarOffsets = (start: Date, end: Date, isMilestone: boolean) => {
    if (start > mEnd || end < mStart) {
      return { barLeft: undefined, barStartX: undefined, barEndX: undefined };
    }

    if (isMilestone) {
      const idx = getDayIndexForDate(start);
      const bM = getDayXMid(idx);
      return { barLeft: bM, barStartX: bM, barEndX: bM };
    }

    const visS = start < mStart ? mStart : start;
    const visE = end > mEnd ? mEnd : end;

    const idxS = getDayIndexForDate(visS);
    const idxE = getDayIndexForDate(visE);

    const bL = getDayX(idxS);
    const bW = getDayXRight(idxE) - bL;
    return {
      barLeft: bL,
      barStartX: bL,
      barEndX: bL + bW
    };
  };

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

    const { barStartX, barEndX } = getBarOffsets(pStart, pEnd, !!isMilestone);

    const pAssignedList = Array.from(new Set(
      (p.assemblies || []).flatMap(a => (a.tasks || []).map(t => t.assigned).filter(Boolean))
    ));
    const pAssigned = pAssignedList.length > 0 ? pAssignedList.join(', ') : '';

    const pSeq = `${pi + 1}`;
    const pNameWithSeq = `${pSeq}. ${p.name}`;

    rowList.push({
      key: pKey,
      type: 'project',
      name: pNameWithSeq,
      pct,
      start: p.start,
      due: p.due,
      color: pColor,
      height: pRowH,
      midY: pMidY,
      barStartX,
      barEndX,
      activityCode: p.client ? p.client.toUpperCase() : `PRJ-${p.id.slice(0, 4).toUpperCase()}`,
      assignedResources: pAssigned
    });
    currentY += pRowH;

    if (!ganttCollapsed[p.id]) {
      (p.assemblies || []).forEach((a, ai) => {
        let aStart = a.start ? new Date(a.start + 'T00:00:00') : null;
        let aEnd = a.finish ? new Date(a.finish + 'T00:00:00') : null;

        // Auto-calculate from tasks if not explicitly set on the assembly
        if (!aStart || !aEnd) {
          const taskDates = (a.tasks || []).map(t => ({
            start: t.date ? new Date(t.date + 'T00:00:00') : null,
            end: t.finishDate ? new Date(t.finishDate + 'T00:00:00') : null
          })).filter(d => d.start || d.end);

          if (taskDates.length > 0) {
            const minStart = new Date(Math.min(...taskDates.map(d => d.start?.getTime() || Infinity).filter(t => t !== Infinity)));
            const maxEnd = new Date(Math.max(...taskDates.map(d => d.end?.getTime() || -Infinity).filter(t => t !== -Infinity)));
            if (!aStart && minStart.getTime() !== Infinity) aStart = minStart;
            if (!aEnd && maxEnd.getTime() !== -Infinity) aEnd = maxEnd;
          }
        }

        if (!aStart) aStart = pStart;
        if (!aEnd) aEnd = pEnd;

        const aTotalWeight = (a.tasks || []).reduce((sum, t) => sum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
        const aWeightedScale = (a.tasks || []).reduce((sum, t) => sum + (t.pct || 0) * (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
        const aPct = aTotalWeight > 0 ? Math.round(aWeightedScale / aTotalWeight) : 0;

        const aRowH = 36;
        const aMidY = currentY + aRowH / 2;
        const aKey = `a:${p.id}:${a.id}`;

        const { barStartX: aBarStartX, barEndX: aBarEndX } = getBarOffsets(aStart, aEnd, false);

        const aAssignedList = Array.from(new Set(
          (a.tasks || []).map(t => t.assigned).filter(Boolean)
        ));
        const aAssigned = aAssignedList.length > 0 ? aAssignedList.join(', ') : '';

        const aSeq = `${pSeq}.${ai + 1}`;
        const aNameWithSeq = `${aSeq} ${a.name}`;

        rowList.push({
          key: aKey,
          type: 'assembly',
          name: aNameWithSeq,
          pct: aPct,
          start: a.start || (aStart ? aStart.toISOString().slice(0, 10) : undefined),
          due: a.finish || (aEnd ? aEnd.toISOString().slice(0, 10) : undefined),
          color: pColor,
          height: aRowH,
          midY: aMidY,
          barStartX: aBarStartX,
          barEndX: aBarEndX,
          activityCode: a.id ? `ASY-${a.id.slice(0, 4).toUpperCase()}` : 'ASY-100',
          assignedResources: aAssigned
        });
        currentY += aRowH;

        // If the sub-assembly is NOT collapsed, push its tasks into the Gantt chart row list
        if (!ganttCollapsed[aKey]) {
          (a.tasks || []).forEach((t, ti) => {
            const tRowH = 28;
            const tKey = `t:${p.id}:${a.id}:${t.id}`;
            const tStart = t.date ? new Date(t.date + 'T00:00:00') : aStart;
            const tEnd = t.finishDate ? new Date(t.finishDate + 'T00:00:00') : aEnd;

            const { barStartX: tBarStartX, barEndX: tBarEndX } = getBarOffsets(tStart, tEnd, !!t.isMilestone);

            const tSeq = `${aSeq}.${ti + 1}`;
            const tNameWithSeq = `${tSeq} ${t.name}`;

            rowList.push({
              key: tKey,
              type: 'task',
              name: tNameWithSeq,
              pct: t.pct || 0,
              start: t.date,
              due: t.finishDate,
              color: pColor,
              height: tRowH,
              midY: currentY + tRowH / 2,
              barStartX: tBarStartX,
              barEndX: tBarEndX,
              activityCode: t.id ? `ACT-${t.id.slice(0, 4).toUpperCase()}` : 'ACT-100',
              difficulty: typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1,
              assignedResources: t.assigned || '',
              isMilestone: !!t.isMilestone
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

          <div className="w-[1px] h-3 bg-base-border" />

          {/* Timescale Views */}
          <div className="flex items-center gap-1 bg-base-surface2 border border-base-border rounded-lg p-1.5" title="Gantt chart timeline timescale">
            <button
              onClick={() => setGanttDuration(1)}
              className={`px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded transition-colors cursor-pointer ${
                ganttDuration === 1 ? 'bg-base-accent text-white shadow-xs' : 'text-base-muted hover:text-base-text'
              }`}
            >
              1 Month
            </button>
            <button
              onClick={() => setGanttDuration(4)}
              className={`px-2 py-1 text-[10px] uppercase font-condensed font-bold tracking-wider rounded transition-colors cursor-pointer ${
                ganttDuration === 4 ? 'bg-base-accent text-white shadow-xs' : 'text-base-muted hover:text-base-text'
              }`}
            >
              4 Months
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

          {/* Project dropdown selection */}
          <select
            value={ganttProjFilter}
            onChange={(e) => setGanttProjFilter(e.target.value)}
            className="px-2.5 py-1 text-xs rounded bg-base-surface border border-base-border text-base-muted2 font-condensed font-semibold cursor-pointer outline-none"
          >
            <option value="">All projects</option>
            {sortedProjectsFilterList.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
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
            <option value="completed">Completed only</option>
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
                {ganttDays.map(gd => (
                  <col key={gd.index} style={{ width: `${cellW}px` }} />
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
                  {ganttDays.map(gd => {
                    const isWE = gd.isWeekend;
                    const showMonthLabel = gd.dayOfMonth === 1 || gd.index === 1;
                    return (
                      <th
                        key={gd.index}
                        className={`font-condensed font-extrabold text-[9px] text-center border-r border-base-border/30 px-0.5 whitespace-nowrap overflow-hidden ${
                          gd.isToday ? 'bg-base-accent/15 text-base-accent' : isWE ? 'bg-base-surface3/40 text-base-muted/40 font-normal' : 'text-base-muted'
                        }`}
                      >
                        {showMonthLabel ? (
                          <span className="text-base-accent block font-extrabold pb-0.5">{gd.monthLabel}</span>
                        ) : null}
                        <span>{gd.dayOfMonth}</span>
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
                  const pSeq = `${pi + 1}`;

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
                              <span className="font-condensed font-extrabold text-sm text-base-text overflow-hidden text-ellipsis whitespace-nowrap block" title={`${pSeq}. ${p.name}`}>
                                {pSeq}. {p.name}
                              </span>
                            </div>
                            <span className="font-condensed font-extrabold text-xs text-base-muted pr-2">{pct}%</span>
                            {renderDepsBadges(pKey)}
                          </div>
                        </td>
                        {ganttDays.map(gd => {
                          return (
                            <td
                              key={gd.index}
                              className={`border-r border-base-border/30 border-b border-base-border/40 relative ${
                                gd.isToday ? 'bg-base-accent/5' : gd.isWeekend ? 'bg-base-surface3/15' : ''
                              }`}
                            >
                              {gd.isToday && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-accent/60 z-10 pointer-events-none" />}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Assemblies list rows */}
                      {!isColl &&
                        (p.assemblies || []).map((a, ai) => {
                          const aKey = `a:${p.id}:${a.id}`;
                          const isAssemblyColl = !!ganttCollapsed[aKey];
                          const aTotalWeight = (a.tasks || []).reduce((sum, t) => sum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
                          const aWeightedScale = (a.tasks || []).reduce((sum, t) => sum + (t.pct || 0) * (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
                          const aPct = aTotalWeight > 0 ? Math.round(aWeightedScale / aTotalWeight) : 0;
                          const aSeq = `${pSeq}.${ai + 1}`;

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

                                      <span className="text-xs font-semibold text-base-muted2 overflow-hidden text-ellipsis whitespace-nowrap block" title={`${aSeq} ${a.name}`}>
                                        {aSeq} {a.name}
                                      </span>
                                    </div>
                                    <span className="font-condensed font-bold text-xs text-base-muted2 pr-2">{aPct}%</span>
                                    {renderDepsBadges(aKey)}
                                  </div>
                                </td>
                                {ganttDays.map(gd => {
                                  return (
                                    <td
                                      key={gd.index}
                                      className={`border-r border-base-border/20 border-b border-base-border/20 relative ${
                                        gd.isToday ? 'bg-base-accent/5' : gd.isWeekend ? 'bg-base-surface3/15' : ''
                                      }`}
                                    >
                                      {gd.isToday && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-accent/60 z-10 pointer-events-none" />}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* Task list rows under assembly */}
                              {!isAssemblyColl &&
                                (a.tasks || []).map((t, ti) => {
                                  const tSeq = `${aSeq}.${ti + 1}`;
                                  return (
                                    <tr key={t.id} className="h-7 border-b border-base-border/30 hover:bg-base-surface2/30 group bg-base-surface2/5">
                                      <td className="sticky left-0 bg-base-surface border-r-2 border-base-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] z-10 pl-10 pr-2">
                                        <div className="flex items-center gap-1.5 justify-between">
                                          <div className="flex items-center gap-1 min-w-0 flex-1">
                                            <span className="text-base-muted2/50 font-bold text-[10px] select-none">↳</span>
                                            <span className="text-[11px] text-base-muted overflow-hidden text-ellipsis whitespace-nowrap block" title={`${tSeq} ${t.name}`}>
                                              {tSeq} {t.name}
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
                                      {ganttDays.map(gd => {
                                        return (
                                          <td
                                            key={gd.index}
                                            className={`border-r border-base-border/15 border-b border-base-border/15 relative ${
                                              gd.isToday ? 'bg-base-accent/3' : gd.isWeekend ? 'bg-base-surface3/10' : ''
                                            }`}
                                          >
                                            {gd.isToday && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-accent/60 z-10 pointer-events-none" />}
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
                const { key, type, color, pct, start, due, midY, barStartX: origStartX, barEndX: origEndX, activityCode, assignedResources } = row;
                if (origStartX === undefined || origEndX === undefined) return null;

                const isCurrentDrag = dragState && dragState.rowKey === key;
                const currentStartStr = isCurrentDrag ? (dragState.tempStart || start) : start;
                const currentDueStr = isCurrentDrag ? (dragState.tempDue || due) : due;

                const isProject = type === 'project';
                const isAssembly = type === 'assembly';
                const isMilestone = row.isMilestone || (currentStartStr && currentDueStr && currentStartStr === currentDueStr);

                const currentStart = currentStartStr ? new Date(currentStartStr + 'T00:00:00') : mStart;
                const currentDue = currentDueStr ? new Date(currentDueStr + 'T00:00:00') : mEnd;

                const { barStartX, barEndX } = getBarOffsets(currentStart, currentDue, isMilestone);
                if (barStartX === undefined || barEndX === undefined) return null;

                const barWidth = barEndX - barStartX;

                // Determine MS Project task variables
                const pId = key.split(':')[1];
                const assocProj = projects.find(x => x.id === pId);
                const todayStr = new Date().toISOString().slice(0, 10);
                const isOverdue = assocProj?.due ? (assocProj.due < todayStr && assocProj.status !== 'completed') : false;
                const isCriticalActive = isOverdue || assocProj?.status === 'pending';

                if (isMilestone) {
                  const diamondSz = 12;
                  return (
                    <div 
                      key={key}
                      className={`absolute flex items-center pointer-events-none text-xs ${isCurrentDrag ? 'z-50' : 'z-30'}`}
                      style={{
                        left: `${barStartX - diamondSz / 2}px`,
                        top: `${midY - diamondSz / 2}px`,
                        width: '500px',
                        height: `${diamondSz}px`
                      }}
                    >
                      <div
                        onMouseDown={(e) => handleBarMouseDown(e, key, 'drag', start || '', due || '')}
                        className={`relative shrink-0 hover:scale-125 transition-transform cursor-grab active:cursor-grabbing pointer-events-auto shadow-md rounded-[1px] ${
                          isCurrentDrag 
                            ? 'bg-amber-400 border-2 border-amber-300 ring-2 ring-amber-500/50 scale-125' 
                            : 'bg-amber-500 dark:bg-amber-400 border border-slate-900 dark:border-amber-300'
                        }`}
                        style={{
                          width: `${diamondSz}px`,
                          height: `${diamondSz}px`,
                          transform: 'rotate(45deg)'
                        }}
                        title={`${row.name} (Milestone — Drag to reschedule date)`}
                      />
                      <span className={`text-[10px] font-sans ml-3.5 px-2 py-0.5 rounded border shadow-xs pointer-events-none select-none whitespace-nowrap flex items-center gap-1.5 leading-none backdrop-blur-xs shrink-0 ${
                        isCurrentDrag 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold'
                          : 'bg-white/95 dark:bg-slate-800/95 border-slate-200/85 dark:border-slate-700/85 text-slate-800 dark:text-slate-100'
                      }`}>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{activityCode || 'MILESTONE'}</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="font-semibold">{row.name}</span>
                        {currentStartStr && (
                          <span className="text-slate-400 dark:text-slate-500 font-medium">
                            ({new Date(currentStartStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                          </span>
                        )}
                        {isCurrentDrag && (
                          <span className="ml-1 text-[8px] bg-amber-500 text-white font-extrabold px-1 rounded-sm">DRAGGING</span>
                        )}
                      </span>
                    </div>
                  );
                }

                if (barWidth <= 0) return null;

                // Standard MS Project-style Progress bars
                const barH = (isProject || isAssembly) ? 14 : 12;

                return (
                  <div 
                    key={key} 
                    className={`absolute flex items-center pointer-events-none text-xs ${isCurrentDrag ? 'z-50' : 'z-30'}`} 
                    style={{ 
                      left: `${barStartX}px`, 
                      top: `${midY - barH / 2}px`, 
                      width: `${barWidth + 400}px`, 
                      height: `${barH}px` 
                    }}
                  >
                    {isProject || isAssembly ? (
                      /* MS Project SUMMARY TASK STYLE (Sleek dark bracket with downward pointy chevrons) */
                      <div
                        className={`relative shrink-0 pointer-events-auto rounded-[2px] transition-shadow ${
                          isCurrentDrag ? 'ring-2 ring-amber-500 shadow-lg' : ''
                        }`}
                        style={{
                          width: `${barWidth}px`,
                          height: `${barH}px`,
                        }}
                        title={`${row.name} (Summary) — ${pct}%`}
                      >
                        {/* Summary Horizonal Bar */}
                        <div className="absolute top-0 left-[3px] right-[3px] h-[5px] bg-slate-800 dark:bg-slate-200" />
                        
                        {/* Left End Wedge */}
                        <div 
                          className="absolute left-0 top-0 w-[7px] h-[10px] bg-slate-800 dark:bg-slate-200" 
                          style={{ clipPath: 'polygon(0px 0px, 7px 0px, 7px 10px, 3px 10px, 0px 4px)' }} 
                        />
                        
                        {/* Right End Wedge */}
                        <div 
                          className="absolute right-0 top-0 w-[7px] h-[10px] bg-slate-800 dark:bg-slate-200" 
                          style={{ clipPath: 'polygon(0px 0px, 7px 0px, 7px 4px, 4px 10px, 0px 10px)' }} 
                        />

                        {/* Summary Progress Line (inside summary bar) */}
                        {pct > 0 && (
                          <div 
                            className="absolute left-[3px] top-[1px] h-[3px] bg-emerald-600 dark:bg-emerald-400 opacity-90 transition-all duration-300" 
                            style={{ width: `${Math.round((pct / 100) * (barWidth - 6))}px` }} 
                          />
                        )}

                        {/* LEFT RESIZE HANDLE */}
                        <div
                          onMouseDown={(e) => handleBarMouseDown(e, key, 'resize-left', start || '', due || '')}
                          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-amber-500/40 z-30 rounded-l pointer-events-auto"
                          title="Drag to change start date"
                        />

                        {/* RIGHT RESIZE HANDLE */}
                        <div
                          onMouseDown={(e) => handleBarMouseDown(e, key, 'resize-right', start || '', due || '')}
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-amber-500/40 z-30 rounded-r pointer-events-auto"
                          title="Drag to change finish date"
                        />

                        {/* DRAG MOVE AREA */}
                        <div
                          onMouseDown={(e) => handleBarMouseDown(e, key, 'drag', start || '', due || '')}
                          className="absolute left-2.5 right-2.5 top-0 bottom-0 cursor-grab active:cursor-grabbing z-20 pointer-events-auto"
                        />
                      </div>
                    ) : (
                      /* MS Project STANDARD TASK BAR (Active blue vs critical red/orange with inner dark core line) */
                      <div
                        className={`relative shrink-0 border pointer-events-auto rounded-[3px] transition-all bg-opacity-95 flex items-center ${
                          isCurrentDrag 
                            ? 'bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-500/35 dark:bg-amber-950/40 dark:border-amber-400'
                            : isCriticalActive 
                              ? 'bg-red-100 border-red-400 dark:bg-red-950/80 dark:border-red-500' 
                              : 'bg-blue-100 border-blue-400 dark:bg-blue-950/80 dark:border-blue-400'
                        }`}
                        style={{
                          width: `${barWidth}px`,
                          height: `${barH}px`,
                        }}
                        title={`${row.name} — ${pct}%`}
                      >
                        {/* Core center-level inner progress bar */}
                        {pct > 0 && (
                          <div
                            className={`absolute top-[2px] bottom-[2px] left-[1px] transition-all duration-300 rounded-[1px] ${
                              isCurrentDrag 
                                ? 'bg-amber-500'
                                : isCriticalActive 
                                  ? 'bg-red-700 dark:bg-red-400' 
                                  : 'bg-blue-600 dark:bg-sky-400'
                            }`}
                            style={{ width: `${Math.round((pct / 100) * (barWidth - 2))}px` }}
                          />
                        )}

                        {/* LEFT RESIZE HANDLE */}
                        <div
                          onMouseDown={(e) => handleBarMouseDown(e, key, 'resize-left', start || '', due || '')}
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-500/40 z-30 rounded-l pointer-events-auto"
                          title="Drag to change start date"
                        />

                        {/* RIGHT RESIZE HANDLE */}
                        <div
                          onMouseDown={(e) => handleBarMouseDown(e, key, 'resize-right', start || '', due || '')}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-500/40 z-30 rounded-r pointer-events-auto"
                          title="Drag to change finish date"
                        />

                        {/* DRAG MOVE AREA */}
                        <div
                          onMouseDown={(e) => handleBarMouseDown(e, key, 'drag', start || '', due || '')}
                          className="absolute left-2 right-2 top-0 bottom-0 cursor-grab active:cursor-grabbing z-20 pointer-events-auto"
                        />
                      </div>
                    )}

                    {/* Classic MS Project resource and activity labels written directly to the right */}
                    <span 
                      className={`text-[10px] font-sans ml-3.5 px-2 py-0.5 rounded border shadow-xs pointer-events-none select-none whitespace-nowrap flex items-center gap-1.5 leading-none backdrop-blur-xs shrink-0 ${
                        isCurrentDrag 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold' 
                          : 'bg-white/95 dark:bg-slate-800/95 border-slate-200/85 dark:border-slate-700/85 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <span className="text-sky-600 dark:text-sky-300 font-extrabold">{activityCode || 'ACT'}</span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="font-semibold max-w-[130px] truncate">{row.name}</span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      {assignedResources ? (
                        <>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{assignedResources}</span>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                        </>
                      ) : null}
                      <span className="text-orange-500 dark:text-amber-400 font-extrabold">{pct}%</span>
                      {isCurrentDrag && (
                        <span className="ml-1 text-[8px] bg-amber-500 text-white font-extrabold px-1 rounded-xs">SCHEDULING</span>
                      )}
                    </span>
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

      {dragState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-800/95 border border-amber-500/50 rounded-xl px-5 py-3 shadow-2xl z-50 flex items-center gap-3 font-sans animate-bounce pointer-events-auto">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-amber-500 font-extrabold uppercase tracking-wider">RE-SCHEDULING:</span>
          <span className="text-xs font-bold text-white font-mono">
            {dragState.tempStart} ➔ {dragState.tempDue}
          </span>
          <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded uppercase font-condensed">
            {dragState.type === 'drag' ? 'Moving Duration' : dragState.type === 'resize-left' ? 'Adjusting Start' : 'Adjusting Finish'}
          </span>
        </div>
      )}
    </div>
  );
}
