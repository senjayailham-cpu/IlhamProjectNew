import React, { useState } from 'react';
import { Project, TimesheetEntry, Employee, MaterialItem, MaterialRequest } from '../types';
import { calcPct, calcTaskCounts, getTotalManHours, fmtHrs } from '../utils/projectUtils';
import { Folder, Clock, CheckCircle, AlertTriangle, Users, ShieldAlert, ArrowRight, ExternalLink, AlertCircle, TrendingUp, Package, X } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface DashboardViewProps {
  projects: Project[];
  timesheets: TimesheetEntry[];
  employees: Employee[];
  selectedMonth: string;
  setSelectedMonth: (val: string) => void;
  openSpotlight: (id: string) => void;
  materials?: MaterialItem[];
  materialRequests?: MaterialRequest[];
}

const BAR_COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c'];
const STATUS_COLORS = {
  active: '#4a90d9',
  pending: '#e8a020',
  completed: '#4caf7d',
  'on-hold': '#7a7870'
};

export default function DashboardView({
  projects,
  timesheets,
  employees,
  selectedMonth,
  setSelectedMonth,
  openSpotlight,
  materials = [],
  materialRequests = [],
}: DashboardViewProps) {
  const [dashLoc, setDashLoc] = useState<'all' | 'workshop1' | 'workshop2'>('all');
  const [activeModal, setActiveModal] = useState<'project' | 'active' | 'completed' | 'overdue' | 'absent' | null>(null);

  // Custom component for styling Recharts Tooltips with Tailwind theme variables.
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-base-surface border border-base-border p-3.5 rounded-xl shadow-modal text-xs space-y-1.5 font-condensed font-bold border-l-4 border-l-base-accent">
          <p className="text-base-text uppercase tracking-wider border-b border-base-border/50 pb-1 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: entry.stroke || entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color }} />
                {entry.name}:
              </span>
              <span className="text-base-text font-mono">{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // --------------------------------------------------------------------------
  // DYNAMIC CUMULATIVE TREND DATA (S-CURVE) CALCULATION
  // --------------------------------------------------------------------------
  const trendData = (() => {
    // Determine target month & length
    const parts = selectedMonth.split('-');
    const yearStr = parts[0] || '2026';
    const monthStr = parts[1] || '06';
    const yr = parseInt(yearStr, 10);
    const mo = parseInt(monthStr, 10);
    const totalDays = new Date(yr, mo, 0).getDate();

    // Use current real date as boundaries
    const today = new Date();
    const todayStr = new Date().toISOString().slice(0, 10);

    const list: Array<{
      day: string;
      actual: number | null;
      planned: number;
    }> = [];

    const getInterpolatedPct = (
      dateStr: string,
      startStr: string,
      endStr: string,
      startPct: number,
      endPct: number
    ): number => {
      const tStart = new Date(startStr).getTime();
      const tEnd = new Date(endStr).getTime();
      const tCurrent = new Date(dateStr).getTime();
      if (isNaN(tStart) || isNaN(tEnd) || isNaN(tCurrent)) return endPct;
      if (tCurrent <= tStart) return startPct;
      if (tCurrent >= tEnd) return endPct;
      const ratio = (tCurrent - tStart) / (tEnd - tStart);
      return startPct + ratio * (endPct - startPct);
    };

    // Filter projects matching current dashboard scope
    const targetProjs = projects.filter(p => {
      if (dashLoc !== 'all' && p.location !== dashLoc) return false;
      if (!selectedMonth) return true;

      // If target month is set, strictly match it
      if (p.targetMonth) {
        return p.targetMonth === selectedMonth;
      }

      const pStart = p.start || '';
      const pDue = p.due || '';
      const startM = pStart.slice(0, 7);
      const dueM = pDue.slice(0, 7);

      return startM === selectedMonth || dueM === selectedMonth || (pStart && pDue && pStart <= `${selectedMonth}-31` && pDue >= `${selectedMonth}-01`);
    });

    if (targetProjs.length === 0) {
      // Return beautiful fallback placeholder slope if there are no registered projects
      for (let d = 1; d <= totalDays; d++) {
        const dayPad = String(d).padStart(2, '0');
        const defaultVal = Math.round((d / totalDays) * 100);
        list.push({
          day: `${dayPad} ${monthStr}`,
          actual: d <= 15 ? Math.round(defaultVal * 0.9) : null,
          planned: defaultVal
        });
      }
      return list;
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayPad = String(d).padStart(2, '0');
      const dateStr = `${yearStr}-${monthStr}-${dayPad}`;
      
      let totalActual = 0;
      let totalPlanned = 0;
      const isFuture = dateStr > todayStr;

      targetProjs.forEach(p => {
        const hasBaseline = !!p.baselineSetAt;
        const pStart = (hasBaseline ? p.baselineStart : p.start) || p.start || `${yearStr}-${monthStr}-01`;
        const pDue = (hasBaseline ? p.baselineDue : p.due) || p.due || `${yearStr}-${monthStr}-${totalDays}`;
        
        // Flatten all tasks across all assemblies for the project
        const projectTasks: any[] = [];
        (p.assemblies || []).forEach(asm => {
          (asm.tasks || []).forEach(t => {
            projectTasks.push(t);
          });
        });

        let plannedValue = 0;
        if (projectTasks.length === 0) {
          plannedValue = getInterpolatedPct(dateStr, pStart, pDue, 0, 100);
        } else {
          let totalProjDifficulty = 0;
          let weightedPlannedSum = 0;

          projectTasks.forEach(t => {
            const difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
            totalProjDifficulty += difficulty;

            const tStart = (hasBaseline ? t.baselineDate : t.date) || t.date || pStart;
            const tFinish = (hasBaseline ? t.baselineFinish : t.finishDate) || t.finishDate || tStart;

            if (dateStr >= tFinish) {
              weightedPlannedSum += 100 * difficulty;
            } else if (dateStr < tStart) {
              weightedPlannedSum += 0 * difficulty;
            } else {
              const taskPct = getInterpolatedPct(dateStr, tStart, tFinish, 0, 100);
              weightedPlannedSum += taskPct * difficulty;
            }
          });

          plannedValue = totalProjDifficulty > 0 ? (weightedPlannedSum / totalProjDifficulty) : 0;
        }
        totalPlanned += plannedValue;

        // Actual trajectory curve based on historic milestones or progress interpolation up to today
        let actualValue = 0;
        const currentPct = calcPct(p);
        const actualStart = p.start || `${yearStr}-${monthStr}-01`;

        if (p.status === 'completed' && p.completedDate) {
          if (dateStr >= p.completedDate) {
            actualValue = 100;
          } else {
            actualValue = getInterpolatedPct(dateStr, actualStart, p.completedDate, 0, 100);
          }
        } else {
          if (dateStr >= todayStr) {
            actualValue = currentPct;
          } else {
            actualValue = getInterpolatedPct(dateStr, actualStart, todayStr, 0, currentPct);
          }
        }
        totalActual += actualValue;
      });

      const avgPlanned = Math.round(totalPlanned / targetProjs.length);
      const avgActual = isFuture ? null : Math.round(totalActual / targetProjs.length);

      list.push({
        day: `${dayPad} ${monthStr}`,
        actual: avgActual,
        planned: avgPlanned
      });
    }

    return list;
  })();

  // --------------------------------------------------------------------------
  // DYNAMIC OVERDUE BLOCKER & DEPENDENCY ALERT CALCULATIONS
  // --------------------------------------------------------------------------
  const getAssemblyPct = (asm: any): number => {
    if (!asm.tasks || asm.tasks.length === 0) return 100;
    const totalWeight = asm.tasks.reduce((sum: number, t: any) => sum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
    const weightedScale = asm.tasks.reduce((sum: number, t: any) => sum + (t.pct || 0) * (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1), 0);
    if (totalWeight === 0) return 0;
    return Math.round(weightedScale / totalWeight);
  };

  const daysDiff = (d1Str: string, d2Str: string) => {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    const diffTime = d1.getTime() - d2.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));

  const assemblyMap = new Map<string, { proj: Project; asm: any }>();
  projects.forEach(p => {
    (p.assemblies || []).forEach(a => {
      assemblyMap.set(a.id, { proj: p, asm: a });
    });
  });

  // Calculate Overdue Blockers List
  const overdueBlockers = (() => {
    const list: Array<{
      id: string;
      type: 'project' | 'assembly';
      blockedName: string;
      blockedClient: string;
      blockedProjectId: string;
      blockingName: string;
      blockingProjectId: string;
      blockingDue?: string;
      daysOverdue: number;
      progress: number;
    }> = [];

    projects.forEach(blockedProj => {
      if (blockedProj.status === 'completed') return;

      // Project level predecessor dependency
      (blockedProj.predecessors || []).forEach(dep => {
        if (dep.key.startsWith('p:')) {
          const blockingId = dep.key.substring(2);
          const blockingProj = projectMap.get(blockingId);
          if (blockingProj && blockingProj.status !== 'completed') {
            const due = blockingProj.due;
            if (due && due < todayStr) {
              const days = daysDiff(todayStr, due);
              list.push({
                id: `block-p-${blockedProj.id}-${blockingProj.id}`,
                type: 'project',
                blockedName: blockedProj.name,
                blockedClient: blockedProj.client,
                blockedProjectId: blockedProj.id,
                blockingName: blockingProj.name,
                blockingProjectId: blockingProj.id,
                blockingDue: due,
                daysOverdue: days,
                progress: calcPct(blockingProj)
              });
            }
          }
        }
      });

      // Assembly level predecessor dependency
      (blockedProj.assemblies || []).forEach(blockedAsm => {
        const blockedAsmPct = getAssemblyPct(blockedAsm);
        if (blockedAsmPct >= 100) return;

        (blockedAsm.predecessors || []).forEach(dep => {
          if (dep.key.startsWith('a:')) {
            const parts = dep.key.split(':');
            if (parts.length >= 3) {
              const blockingAsmId = parts[2];
              const data = assemblyMap.get(blockingAsmId);
              if (data) {
                const { proj: blockingProj, asm: blockingAsm } = data;
                const blockingAsmPct = getAssemblyPct(blockingAsm);
                if (blockingAsmPct < 100) {
                  const finish = blockingAsm.finish;
                  if (finish && finish < todayStr) {
                    const days = daysDiff(todayStr, finish);
                    list.push({
                      id: `block-a-${blockedProj.id}-${blockedAsm.id}-${blockingAsm.id}`,
                      type: 'assembly',
                      blockedName: `${blockedAsm.name}`,
                      blockedClient: blockedProj.client,
                      blockedProjectId: blockedProj.id,
                      blockingName: `${blockingAsm.name} (${blockingProj.name})`,
                      blockingProjectId: blockingProj.id,
                      blockingDue: finish,
                      daysOverdue: days,
                      progress: blockingAsmPct
                    });
                  }
                }
              }
            }
          }
        });
      });
    });

    return list;
  })();

  // Calculate Dependency & Resource Alerts List
  const dependencyAlerts = (() => {
    const list: Array<{
      id: string;
      severity: 'high' | 'medium' | 'info';
      category: 'schedule' | 'sequence' | 'resource' | 'missing-date';
      message: string;
      targetId: string;
      badgeText: string;
    }> = [];

    const absentEmpNames = new Set<string>();
    const leaveEmpNames = new Set<string>();
    const todayTimesheets = timesheets.filter(ts => ts.date === todayStr);

    todayTimesheets.forEach(ts => {
      if (ts.status === 'absent') {
        absentEmpNames.add(ts.empName);
      } else if (ts.status === 'leave') {
        leaveEmpNames.add(ts.empName);
      }
    });

    projects.forEach(bProj => {
      if (bProj.status === 'completed') return;

      // Project level predecessors check
      (bProj.predecessors || []).forEach((dep, idx) => {
        if (dep.key.startsWith('p:')) {
          const blockingId = dep.key.substring(2);
          const aProj = projectMap.get(blockingId);
          if (aProj) {
            // Schedule Overlap/Mismatch check
            if (aProj.due && bProj.start && aProj.due > bProj.start) {
              list.push({
                id: `alert-p-mismatch-${bProj.id}-${aProj.id}-${idx}`,
                severity: 'high',
                category: 'schedule',
                badgeText: 'Timeline Overlap',
                message: `Sequence Conflict: Project "${bProj.name}" is scheduled to start on ${bProj.start}, before its predecessor "${aProj.name}" finishes (${aProj.due}).`,
                targetId: bProj.id
              });
            }

            // Out-of-Sequence work execution check
            const pctA = calcPct(aProj);
            const pctB = calcPct(bProj);
            if (pctA < 100 && (pctB > 0 || bProj.status === 'active')) {
              list.push({
                id: `alert-p-seq-${bProj.id}-${aProj.id}-${idx}`,
                severity: 'medium',
                category: 'sequence',
                badgeText: 'Out of Sequence',
                message: `Premature Progress: "${bProj.name}" is ${bProj.status} (${pctB}% complete) but its blocking predecessor "${aProj.name}" is only ${pctA}% complete.`,
                targetId: bProj.id
              });
            }
          }
        }
      });

      // Assembly level within Project
      (bProj.assemblies || []).forEach(bAsm => {
        const bAsmPct = getAssemblyPct(bAsm);
        if (bAsmPct >= 100) return;

        (bAsm.predecessors || []).forEach((dep, idx) => {
          if (dep.key.startsWith('a:')) {
            const parts = dep.key.split(':');
            if (parts.length >= 3) {
              const blockingAsmId = parts[2];
              const data = assemblyMap.get(blockingAsmId);
              if (data) {
                const { proj: aProj, asm: aAsm } = data;
                const aAsmPct = getAssemblyPct(aAsm);

                // Schedule Overlap check
                if (aAsm.finish && bAsm.start && aAsm.finish > bAsm.start) {
                  list.push({
                    id: `alert-a-mismatch-${bProj.id}-${bAsm.id}-${aAsm.id}-${idx}`,
                    severity: 'high',
                    category: 'schedule',
                    badgeText: 'Sub-Assembly Clash',
                    message: `Timeline Overlap: Sub-assembly "${bAsm.name}" starts on ${bAsm.start}, before its predecessor "${aAsm.name}" inside "${aProj.name}" finishes (${aAsm.finish}).`,
                    targetId: bProj.id
                  });
                }

                // Out of sequence work execution check
                if (aAsmPct < 100 && bAsmPct > 0) {
                  list.push({
                    id: `alert-a-seq-${bProj.id}-${bAsm.id}-${aAsm.id}-${idx}`,
                    severity: 'medium',
                    category: 'sequence',
                    badgeText: 'Sequence Warning',
                    message: `Sequence warning: Sub-assembly "${bAsm.name}" shows ${bAsmPct}% work progress while predecessor "${aAsm.name}" is incomplete (${aAsmPct}%).`,
                    targetId: bProj.id
                  });
                }
              }
            }
          }
        });


      });
    });

    return list;
  })();

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const jumpToToday = () => {
    const today = new Date();
    setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  };

  const isCurrentMonth = () => {
    const today = new Date();
    const curYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === curYM;
  };

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // Filter projects by month and workshop
  const filteredProjects = projects.filter(p => {
    // If target month is set, strictly match it
    if (p.targetMonth) {
      return p.targetMonth === selectedMonth;
    }

    if (p.status === 'completed' && p.completedDate) {
      // Completed projects belong to their completed month
      return p.completedDate.slice(0, 7) === selectedMonth;
    }
    const createdYM = (p.start || p.created || '').slice(0, 7);
    const dueYM = (p.due || '').slice(0, 7);

    return (createdYM === selectedMonth || dueYM === selectedMonth || (createdYM === '' && isCurrentMonth()));
  }).filter(p => {
    if (dashLoc === 'all') return true;
    return p.location === dashLoc;
  });

  // Task statistics
  let totalTasks = 0;
  let doneTasks = 0;
  filteredProjects.forEach(p => {
    const counts = calcTaskCounts(p);
    totalTasks += counts.total;
    doneTasks += counts.done;
  });

  const overallPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  // Status statistics counts
  const statusCounts = { active: 0, pending: 0, completed: 0, 'on-hold': 0 };
  filteredProjects.forEach(p => {
    if (p.status in statusCounts) {
      statusCounts[p.status as keyof typeof statusCounts]++;
    }
  });

  // KPI Calculations
  const activeCount = filteredProjects.filter(p => p.status === 'active').length;
  const completedCount = filteredProjects.filter(p => p.status === 'completed').length;
  const overdueCount = filteredProjects.filter(p => p.due && p.due < todayStr && p.status !== 'completed').length;

  // Attendance metrics based on today's logs
  const todayTimesheets = timesheets.filter(ts => ts.date === todayStr);
  const presentCount = todayTimesheets.filter(ts => ts.status === 'present' || ts.status === 'late').length;
  const absentCount = todayTimesheets.filter(ts => ts.status === 'absent' || ts.status === 'leave').length;

  // Scoped timesheets for selected month and active workshop location
  const scopedTimesheets = timesheets.filter(ts => {
    if (!ts.date || ts.date.slice(0, 7) !== selectedMonth) return false;
    if (dashLoc !== 'all') {
      const targetProj = projects.find(
        p => p.client && p.client.trim().toLowerCase() === (ts.workOrder || '').trim().toLowerCase()
      );
      if (!targetProj || targetProj.location !== dashLoc) return false;
    }
    return true;
  });

  // Ring circular coordinates
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (circ * overallPct) / 100;

  // Donut chart segments calculation
  const totalProjCount = filteredProjects.length || 1;
  const statusKeys: ('active' | 'pending' | 'completed' | 'on-hold')[] = ['active', 'pending', 'completed', 'on-hold'];

  let currentOffset = 0;
  const donutCircles = statusKeys.map((s) => {
    const count = statusCounts[s];
    if (count === 0) return null;
    const fraction = count / totalProjCount;
    const dash = circ * fraction;
    const gap = circ * (1 - fraction);
    const strokeOffset = (-currentOffset * circ) / totalProjCount + circ * 0.25;
    currentOffset += count;

    return (
      <circle
        key={s}
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={STATUS_COLORS[s]}
        strokeWidth="14"
        strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
        strokeDashoffset={strokeOffset.toFixed(2)}
        transform="rotate(-90 60 60)"
        opacity="0.9"
        className="transition-all duration-500 ease-in-out"
      />
    );
  });

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="dash-hero relative overflow-hidden bg-base-surface border border-base-border2 rounded-2xl p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-6 dark:from-[#151921] dark:to-[#1b212c]">
        {/* Decorative background details */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-radial from-base-accent-dim to-transparent opacity-40 pointer-events-none" />
        <div className="absolute -bottom-12 left-1/3 w-48 h-48 rounded-full bg-radial from-base-blue-dim to-transparent opacity-40 pointer-events-none" />

        <div className="flex-1 space-y-4 relative z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-base-surface2 border border-base-border2 rounded-lg p-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded hover:bg-base-surface3 transition-colors text-base-muted2 hover:text-base-text"
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span
                onClick={jumpToToday}
                className="font-condensed font-bold text-sm tracking-wide text-base-text px-4 cursor-pointer hover:bg-base-surface3 rounded py-1 transition-colors"
              >
                {formatMonthLabel(selectedMonth)}
              </span>
              <button
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded hover:bg-base-surface3 transition-colors text-base-muted2 hover:text-base-text"
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <button
              onClick={jumpToToday}
              className="px-3.5 py-1.5 border border-base-accent/25 hover:bg-base-accent-dim text-base-accent rounded-lg font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Today
            </button>
            {isCurrentMonth() && (
              <span className="px-2.5 py-1 text-xs rounded-full font-condensed font-bold uppercase tracking-wider bg-base-green-dim text-base-green border border-base-green/20">
                Current month
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold font-condensed tracking-tight text-base-text">
              Project <span className="text-base-accent">Overview</span>
            </h1>
            <p className="text-xs sm:text-sm text-base-muted2">
              {doneTasks} of {totalTasks} tasks completed across {filteredProjects.length} project
              {filteredProjects.length !== 1 ? 's' : ''} {dashLoc !== 'all' ? `— ${dashLoc === 'workshop1' ? 'Workshop 1' : 'Workshop 2'}` : ''}
            </p>
          </div>

          {/* Workshop location chips */}
          <div className="flex gap-2 items-center flex-wrap pt-1">
            <button
              onClick={() => setDashLoc('all')}
              className={`px-3 py-1.5 text-xs rounded-full font-condensed font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                dashLoc === 'all'
                  ? 'bg-base-accent text-white border-base-accent'
                  : 'bg-base-surface border-base-border hover:bg-base-surface3 text-base-muted2'
              }`}
            >
              All locations
            </button>
            <button
              onClick={() => setDashLoc('workshop1')}
              className={`px-3 py-1.5 text-xs rounded-full font-condensed font-bold uppercase tracking-wider border cursor-pointer transition-colors flex items-center gap-1.5 ${
                dashLoc === 'workshop1'
                  ? 'bg-base-accent text-white border-base-accent'
                  : 'bg-base-surface border-base-border hover:bg-base-surface3 text-base-muted2'
              }`}
            >
              Workshop 1
            </button>
            <button
              onClick={() => setDashLoc('workshop2')}
              className={`px-3 py-1.5 text-xs rounded-full font-condensed font-bold uppercase tracking-wider border cursor-pointer transition-colors flex items-center gap-1.5 ${
                dashLoc === 'workshop2'
                  ? 'bg-base-accent text-white border-base-accent'
                  : 'bg-base-surface border-base-border hover:bg-base-surface3 text-base-muted2'
              }`}
            >
              Workshop 2
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-condensed font-bold text-base-green mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-base-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-base-green"></span>
            </span>
            LIVE
          </div>
        </div>

        {/* Big circular progress gauge */}
        <div className="flex flex-col items-center gap-2 relative z-10 flex-shrink-0">
          <div className="relative">
            <svg className="h-24 w-24" viewBox="0 0 90 90">
              {/* Background trace */}
              <circle cx="45" cy="45" r={radius} fill="none" stroke="rgba(0, 0, 0, 0.05)" strokeWidth="10" />
              {/* Core arc */}
              <circle
                cx="45"
                cy="45"
                r={radius}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 45 45)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
              <text
                x="45"
                y="51"
                textAnchor="middle"
                fill="var(--text)"
                className="font-condensed font-extrabold text-lg tracking-tight"
              >
                {overallPct}%
              </text>
            </svg>
          </div>
          <span className="font-condensed font-bold text-xs uppercase tracking-widest text-base-muted">Overall progress</span>
        </div>
      </div>

      {/* SECTION 2 — Bento KPI Grid */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1 - Total Projects */}
          <div 
            onClick={() => setActiveModal('project')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-accent group cursor-pointer transition-all hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-base-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Folder className="h-4.5 w-4.5 text-base-accent" />
                Total projects
              </div>
              <svg className="w-10 h-3 text-base-accent/35" viewBox="0 0 50 10">
                <path d="M 2,7 L 12,4 L 22,6 L 32,3 L 42,5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="7" r="1" fill="currentColor" />
                <circle cx="12" cy="4" r="1" fill="currentColor" />
                <circle cx="22" cy="6" r="1" fill="currentColor" />
                <circle cx="32" cy="3" r="1" fill="currentColor" />
                <circle cx="42" cy="5" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-accent select-none">{filteredProjects.length}</div>
            </div>
            <p className="text-xs text-base-muted2 mt-1">{isCurrentMonth() ? 'this month' : 'within scope'}</p>
          </div>

          {/* Card 2 - Active */}
          <div 
            onClick={() => setActiveModal('active')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-blue group cursor-pointer transition-all hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-base-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-base-blue" />
                Active
              </div>
              <svg className="w-10 h-3 text-base-blue/35" viewBox="0 0 50 10">
                <path d="M 2,6 L 12,3 L 22,7 L 32,4 L 42,5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="6" r="1" fill="currentColor" />
                <circle cx="12" cy="3" r="1" fill="currentColor" />
                <circle cx="22" cy="7" r="1" fill="currentColor" />
                <circle cx="32" cy="4" r="1" fill="currentColor" />
                <circle cx="42" cy="5" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-blue select-none">{activeCount}</div>
            </div>
            <p className="text-xs text-base-muted2 mt-1">in progress</p>
          </div>

          {/* Card 3 - Completed */}
          <div 
            onClick={() => setActiveModal('completed')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-green group cursor-pointer transition-all hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-base-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4.5 w-4.5 text-base-green" />
                Completed
              </div>
              <svg className="w-10 h-3 text-base-green/35" viewBox="0 0 50 10">
                <path d="M 2,5 L 12,6 L 22,4 L 32,7 L 42,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="5" r="1" fill="currentColor" />
                <circle cx="12" cy="6" r="1" fill="currentColor" />
                <circle cx="22" cy="4" r="1" fill="currentColor" />
                <circle cx="32" cy="7" r="1" fill="currentColor" />
                <circle cx="42" cy="3" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-green select-none">{completedCount}</div>
            </div>
            <p className="text-xs text-base-muted2 mt-1">finished</p>
          </div>

          {/* Card 4 - Overdue */}
          <div 
            onClick={() => setActiveModal('overdue')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-red group cursor-pointer transition-all hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-base-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4.5 w-4.5 text-base-red" />
                Overdue
              </div>
              <svg className="w-10 h-3 text-base-red/35" viewBox="0 0 50 10">
                <path d="M 2,3 L 12,5 L 22,3 L 32,6 L 42,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="3" r="1" fill="currentColor" />
                <circle cx="12" cy="5" r="1" fill="currentColor" />
                <circle cx="22" cy="3" r="1" fill="currentColor" />
                <circle cx="32" cy="6" r="1" fill="currentColor" />
                <circle cx="42" cy="7" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-red select-none">{overdueCount}</div>
              {overdueCount > 0 && (
                <span className="text-xs font-condensed font-bold text-base-red bg-base-red/10 px-2 py-0.5 rounded-full animate-pulse">
                  ⚠ Action needed
                </span>
              )}
            </div>
            <p className="text-xs text-base-muted2 mt-1">past due date</p>
          </div>
        </div>

        {/* Second row - attendance + manhours */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          {/* Card 5 - Man Hours */}
          <div className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-blue group cursor-default">
            <div className="absolute inset-0 bg-gradient-to-br from-base-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-base-blue" />
                Man-hours
              </div>
              <svg className="w-10 h-3 text-base-blue/35" viewBox="0 0 50 10">
                <path d="M 2,7 L 12,5 L 22,6 L 32,4 L 42,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="7" r="1" fill="currentColor" />
                <circle cx="12" cy="5" r="1" fill="currentColor" />
                <circle cx="22" cy="6" r="1" fill="currentColor" />
                <circle cx="32" cy="4" r="1" fill="currentColor" />
                <circle cx="42" cy="7" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-blue select-none">{fmtHrs(getTotalManHours(scopedTimesheets))}h</div>
            </div>
            <p className="text-xs text-base-muted2 mt-1">{isCurrentMonth() ? 'logged this month' : 'within scope'}</p>
          </div>

          {/* Card 6 - Present Today */}
          <div className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-green group cursor-default">
            <div className="absolute inset-0 bg-gradient-to-br from-base-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Users className="h-4.5 w-4.5 text-base-green" />
                Present
              </div>
              <svg className="w-10 h-3 text-base-green/35" viewBox="0 0 50 10">
                <path d="M 2,4 L 12,6 L 22,3 L 32,5 L 42,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="4" r="1" fill="currentColor" />
                <circle cx="12" cy="6" r="1" fill="currentColor" />
                <circle cx="22" cy="3" r="1" fill="currentColor" />
                <circle cx="32" cy="5" r="1" fill="currentColor" />
                <circle cx="42" cy="7" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-green select-none">{presentCount}</div>
            </div>
            <p className="text-xs text-base-muted2 mt-1">out of {employees.length} guys</p>
          </div>

          {/* Card 7 - Absent Today */}
          <div 
            onClick={() => setActiveModal('absent')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-red group cursor-pointer transition-all hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-base-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-4.5 w-4.5 text-base-red" />
                Absent
              </div>
              <svg className="w-10 h-3 text-base-red/35" viewBox="0 0 50 10">
                <path d="M 2,7 L 12,4 L 22,6 L 32,3 L 42,4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="7" r="1" fill="currentColor" />
                <circle cx="12" cy="4" r="1" fill="currentColor" />
                <circle cx="22" cy="6" r="1" fill="currentColor" />
                <circle cx="32" cy="3" r="1" fill="currentColor" />
                <circle cx="42" cy="4" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-red select-none">{absentCount}</div>
            </div>
            <p className="text-xs text-base-muted2 mt-1">out of {employees.length} guys</p>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Main Content Bento (3-column on desktop) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* LEFT COLUMN — spans 2 cols */}
        <div className="xl:col-span-2 space-y-4">

          {/* S-Curve Chart — keep existing chart code exactly, just re-wrap */}
          <div className="bg-base-surface border border-base-border rounded-2xl shadow-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-base-accent" />
                  Cumulative Project Progress Trend (S-Curve)
                </h3>
                <p className="text-xs text-base-muted2">
                  Comparison of actual cumulative completion percentage against planned trajectory for the selected period.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-condensed font-bold uppercase tracking-wider bg-base-bg/50 px-3 py-1.5 rounded-lg border border-base-border shrink-0 self-start sm:self-auto select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-0.75 bg-base-accent rounded-full" />
                  <span className="text-base-text">Actual Completion</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-base-border pl-3">
                  <span className="w-3.5 h-0.75 border-t-2 border-dashed border-base-blue" />
                  <span className="text-base-muted2">Planned Baseline</span>
                </div>
              </div>
            </div>

            <div className="h-[260px] w-full pt-1">
              <ResponsiveContainer width="99%" height={255}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: 'var(--muted2)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fill: 'var(--muted2)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area 
                    name="Actual Progress"
                    type="monotone" 
                    dataKey="actual" 
                    stroke="var(--accent)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorActual)"
                    activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--accent)' }}
                    connectNulls
                  />
                  <Area 
                    name="Planned Baseline"
                    type="monotone" 
                    dataKey="planned" 
                    stroke="var(--blue)" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none" 
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Progress List — keep existing code, add subtle improvement */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-base-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-base-accent" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <h3 className="font-condensed font-extrabold uppercase text-base tracking-wider text-base-text">Project Progress</h3>
              </div>
              {/* Add project count badge */}
              <span className="text-xs font-condensed font-bold bg-base-accent/10 text-base-accent px-2 py-0.5 rounded-full">
                {filteredProjects.length} projects
              </span>
            </div>
            <div className="p-5 divide-y divide-base-border/50">
              {filteredProjects.length === 0 ? (
                <div className="text-base-muted text-xs py-4 text-center">No projects assigned during this period.</div>
              ) : (
                filteredProjects.map((p, i) => {
                  const pct = calcPct(p);
                  const col = BAR_COLORS[i % BAR_COLORS.length];
                  return (
                    <div
                      key={p.id}
                      onClick={() => openSpotlight(p.id)}
                      className="py-3 flex items-center gap-4 cursor-pointer hover:bg-base-surface2/30 px-2 rounded-lg transition-colors group"
                    >
                      <span className="text-sm font-semibold flex-1 min-width-0 overflow-hidden text-ellipsis whitespace-nowrap text-base-text group-hover:text-base-accent transition-colors">
                        {p.name}
                      </span>
                      <div className="flex-1 max-w-[124px] sm:max-w-[200px] h-2 bg-base-border/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%`, backgroundColor: col }} />
                      </div>
                      <span className="font-condensed font-bold text-sm text-base-muted min-width-[36px] text-right">{pct}%</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN — spans 1 col */}
        <div className="space-y-4">

          {/* WIDGET 1 — Today's Attendance Summary */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card p-5">
            <h3 className="font-condensed font-extrabold text-xs uppercase tracking-widest text-base-muted mb-4 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-base-accent" />
              Today's Headcount
            </h3>
            {/* Big attendance visual */}
            <div className="flex items-center justify-center gap-6 py-2">
              <div className="text-center">
                <div className="text-4xl font-condensed font-extrabold text-base-green">{presentCount}</div>
                <div className="text-xs text-base-muted font-condensed font-bold uppercase mt-1">Present</div>
              </div>
              <div className="text-2xl text-base-border font-light">/</div>
              <div className="text-center">
                <div className="text-4xl font-condensed font-extrabold text-base-text">{employees.length}</div>
                <div className="text-xs text-base-muted font-condensed font-bold uppercase mt-1">Total</div>
              </div>
            </div>
            {/* Attendance bar */}
            <div className="mt-4">
              <div className="h-3 bg-base-border/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: employees.length > 0 ? `${Math.round((presentCount / employees.length) * 100)}%` : '0%',
                    background: 'linear-gradient(90deg, var(--green), var(--accent))'
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-base-muted font-condensed font-bold uppercase mt-1">
                <span>{employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0}% attendance rate</span>
                <span>{absentCount} absent</span>
              </div>
            </div>
          </div>

          {/* WIDGET 2 — Material Alerts (new) */}
          {(materials.length > 0 || materialRequests.length > 0) && (() => {
            const lowStockItems = materials.filter(m => m.currentStock > 0 && m.currentStock < m.minStock);
            const outOfStockItems = materials.filter(m => m.currentStock === 0);
            const pendingMRs = materialRequests.filter(mr => mr.status === 'Submitted');
            return (
              <div className="bg-base-surface border border-base-border rounded-xl shadow-card p-5">
                <h3 className="font-condensed font-extrabold text-xs uppercase tracking-widest text-base-muted mb-4 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-base-accent" />
                  Material Alerts
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-red/8 border border-base-red/15">
                    <span className="text-xs font-condensed font-bold text-base-red flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-base-red" />
                      Out of Stock
                    </span>
                    <span className="text-sm font-condensed font-extrabold text-base-red">{outOfStockItems.length} items</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-accent/8 border border-base-accent/15">
                    <span className="text-xs font-condensed font-bold text-base-accent flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-base-accent" />
                      Low Stock
                    </span>
                    <span className="text-sm font-condensed font-extrabold text-base-accent">{lowStockItems.length} items</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-blue/8 border border-base-blue/15">
                    <span className="text-xs font-condensed font-bold text-base-blue flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-base-blue" />
                      Pending MR
                    </span>
                    <span className="text-sm font-condensed font-extrabold text-base-blue">{pendingMRs.length} requests</span>
                  </div>
                </div>
                {(outOfStockItems.length > 0 || lowStockItems.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-base-border space-y-1.5">
                    <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Critical items:</p>
                    {[...outOfStockItems, ...lowStockItems].slice(0, 3).map(m => (
                      <div key={m.id} className="flex items-center justify-between text-xs">
                        <span className="text-base-text truncate max-w-[140px]">{m.name}</span>
                        <span className={`font-condensed font-bold ${m.currentStock === 0 ? 'text-base-red' : 'text-base-accent'}`}>
                          {m.currentStock} {m.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* WIDGET 3 — Status Donut (keep existing donut, re-wrap) */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-base-border flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-base-accent" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h3 className="font-condensed font-extrabold uppercase text-base tracking-wider text-base-text">Status Breakdown</h3>
            </div>
            <div className="p-5 flex flex-col sm:flex-row xl:flex-col items-center justify-around gap-4">
              <div className="relative h-[120px] w-[120px]">
                <svg className="h-[120px] w-[120px]" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="14" />
                  {donutCircles}
                </svg>
              </div>

              <div className="space-y-2 flex-1 max-w-[200px] w-full">
                {statusKeys.map(s => (
                  <div key={s} className="flex items-center justify-between text-xs py-1 border-b border-base-border/30 last:border-none">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                      <span className="text-base-muted2 font-medium capitalize">{s}</span>
                    </div>
                    <span className="font-condensed font-bold text-sm" style={{ color: STATUS_COLORS[s] }}>
                      {statusCounts[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 4 — Critical Path Blockers (keep existing, visual upgrade only) */}
      <div className="bg-base-surface border border-base-border rounded-2xl shadow-card p-5 space-y-6 relative overflow-hidden">
        {/* Top visual accents */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-base-red via-base-accent to-base-blue opacity-90" />
        
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(var(--text) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="font-condensed font-extrabold text-xl uppercase tracking-wider text-base-text flex items-center gap-2">
              <ShieldAlert className="h-5.5 w-5.5 text-base-red" />
              Critical Path Blockers & Dependency Safety Checks
            </h2>
            <p className="text-xs text-base-muted2">
              Dynamic detection of sequence-interrupted schedules, overdue predecessor assemblies, and craftsman attendance shortfalls.
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2.5 py-1 text-xs rounded-full font-condensed font-bold uppercase tracking-wider ${
              overdueBlockers.length > 0
                ? 'bg-base-red-dim text-base-red border border-base-red/20'
                : 'bg-base-green-dim text-base-green border border-base-green/20'
            }`}>
              {overdueBlockers.length} Active Blockers
            </span>
            <span className={`px-2.5 py-1 text-xs rounded-full font-condensed font-bold uppercase tracking-wider ${
              dependencyAlerts.length > 0
                ? 'bg-base-accent-dim text-base-accent border border-base-accent/20'
                : 'bg-base-green-dim text-base-green border border-base-green/20'
            }`}>
              {dependencyAlerts.length} Risks Detected
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 relative z-10">
          {/* Column 1: Overdue Blockers list */}
          <div className="space-y-3">
            <h3 className="font-condensed font-extrabold text-xs uppercase tracking-widest text-base-muted flex items-center gap-1.5 border-b border-base-border pb-2">
              <AlertTriangle className="h-4 w-4 text-base-red" />
              Overdue Blockers (Work Order Bottlenecks)
            </h3>
            
            {overdueBlockers.length === 0 ? (
              <div className="p-8 text-center bg-base-surface2 border border-base-border border-dashed rounded-xl flex flex-col items-center justify-center space-y-2">
                <CheckCircle className="h-8 w-8 text-base-green/85" />
                <p className="text-xs font-semibold text-base-text">No active bottlenecks</p>
                <p className="text-[11px] text-base-muted max-w-[280px]">
                  All current active successors are unblocked or have completed predecessor phases. Great job!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {overdueBlockers.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => openSpotlight(item.blockedProjectId)}
                    className="p-3.5 bg-[#fcf2f2]/60 dark:bg-[#251b1c]/50 hover:bg-[#faebee] dark:hover:bg-[#2e1d1f] border border-base-red/20 hover:border-base-red/40 rounded-xl transition-all cursor-pointer flex items-start gap-3 relative group"
                  >
                    <div className="p-1 px-1.5 mt-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider bg-base-red-dim text-base-red border border-base-red/10 flex-shrink-0">
                      {item.type}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-base-text truncate">
                          {item.blockedName}
                        </span>
                        <span className="font-mono text-[9px] font-bold text-base-blue uppercase bg-base-blue-dim px-1.5 rounded">
                          {item.blockedClient}
                        </span>
                      </div>
                      
                      <div className="text-[11px] text-base-muted2 leading-normal flex items-center gap-1 flex-wrap">
                        <span>Blocked by:</span>
                        <strong className="text-base-text font-bold">{item.blockingName}</strong>
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-base-red font-medium flex items-center gap-1 font-condensed font-bold uppercase tracking-wider">
                          <Clock className="h-3.5 w-3.5" />
                          Overdue by {item.daysOverdue} days (Finished {item.blockingDue})
                        </span>
                        <span className="font-condensed font-extrabold text-[10px] uppercase text-base-muted">
                          Predecessor: {item.progress}%
                        </span>
                      </div>
                    </div>

                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-base-muted">
                      <ExternalLink className="h-4 w-4 text-base-red" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Dependency Alerts list */}
          <div className="space-y-3">
            <h3 className="font-condensed font-extrabold text-xs uppercase tracking-widest text-base-muted flex items-center gap-1.5 border-b border-base-border pb-2">
              <AlertCircle className="h-4 w-4 text-base-accent" />
              Schedule & Resource Safety Warnings
            </h3>
            
            {dependencyAlerts.length === 0 ? (
              <div className="p-8 text-center bg-base-surface2 border border-base-border border-dashed rounded-xl flex flex-col items-center justify-center space-y-2">
                <CheckCircle className="h-8 w-8 text-base-green/85" />
                <p className="text-xs font-semibold text-base-text">No timeline warnings</p>
                <p className="text-[11px] text-base-muted max-w-[280px]">
                  All scheduled start dates align with sequence requirements and no coordinators are overdue/absent today.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {dependencyAlerts.map(alert => (
                  <div 
                    key={alert.id}
                    onClick={() => openSpotlight(alert.targetId)}
                    className="p-3.5 bg-[#fbf9f4]/60 dark:bg-[#25221b]/50 hover:bg-[#faf5ea]/80 dark:hover:bg-[#2f2a1d] border border-base-accent/25 hover:border-base-accent/50 rounded-xl transition-all cursor-pointer flex items-start gap-3 relative group"
                  >
                    <div className="p-1 px-1.5 mt-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider bg-base-accent-dim text-base-accent border border-base-accent/10 flex-shrink-0">
                      {alert.badgeText}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-base-text leading-relaxed pr-6">
                        {alert.message}
                      </p>
                      
                      <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center gap-1 hover:text-base-accent transition-colors">
                        <span>Click to investigate sheet</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-base-muted">
                      <ExternalLink className="h-4 w-4 text-base-accent" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Detail Modal Popups */}
      {activeModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-base-surface border border-base-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-base-border bg-base-surface2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                {activeModal === 'project' && <Folder className="h-5.5 w-5.5 text-base-accent" />}
                {activeModal === 'active' && <Clock className="h-5.5 w-5.5 text-base-blue" />}
                {activeModal === 'completed' && <CheckCircle className="h-5.5 w-5.5 text-base-green" />}
                {activeModal === 'overdue' && <AlertTriangle className="h-5.5 w-5.5 text-base-red" />}
                {activeModal === 'absent' && <ShieldAlert className="h-5.5 w-5.5 text-base-red" />}
                
                <h3 className="font-condensed font-black text-xl uppercase tracking-wider text-base-text">
                  {activeModal === 'project' && 'All Projects'}
                  {activeModal === 'active' && 'Active Projects'}
                  {activeModal === 'completed' && 'Completed Projects'}
                  {activeModal === 'overdue' && 'Overdue Projects'}
                  {activeModal === 'absent' && 'Absent Personnel Today'}
                </h3>
                
                <span className="px-2 py-0.5 rounded-full bg-base-surface3 border border-base-border text-xs font-condensed font-bold text-base-muted select-none">
                  {activeModal === 'project' && filteredProjects.length}
                  {activeModal === 'active' && activeCount}
                  {activeModal === 'completed' && completedCount}
                  {activeModal === 'overdue' && overdueCount}
                  {activeModal === 'absent' && absentCount}
                </span>
              </div>
              
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-base-surface3 transition-colors text-base-muted hover:text-base-text cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* If no data */}
              {((activeModal === 'project' && filteredProjects.length === 0) ||
                (activeModal === 'active' && activeCount === 0) ||
                (activeModal === 'completed' && completedCount === 0) ||
                (activeModal === 'overdue' && overdueCount === 0) ||
                (activeModal === 'absent' && absentCount === 0)) ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-base-surface2 flex items-center justify-center border border-base-border">
                    <AlertCircle className="h-6 w-6 text-base-muted" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-condensed font-bold text-sm uppercase tracking-wider text-base-text">No Records Found</p>
                    <p className="text-xs text-base-muted">There are no entries under this category for the current scope.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-base-border border border-base-border rounded-xl overflow-hidden bg-base-surface">
                  {activeModal === 'project' && filteredProjects.map(p => {
                    const pct = calcPct(p);
                    return (
                      <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-base-surface2 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono bg-base-surface3 px-1.5 py-0.5 rounded border border-base-border font-semibold text-base-muted">
                              WO: {p.client}
                            </span>
                            <span className={`text-[10px] font-condensed font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              p.status === 'completed' ? 'bg-base-green-dim text-base-green' :
                              p.status === 'active' ? 'bg-base-blue-dim text-base-blue' :
                              p.status === 'pending' ? 'bg-base-accent-dim text-base-accent' :
                              'bg-base-surface3 text-base-muted'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                          <p className="font-semibold text-sm text-base-text truncate">{p.name}</p>
                          <p className="text-[11px] text-base-muted">
                            Due Date: <span className="font-mono">{p.due || 'No date'}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right space-y-1 hidden sm:block">
                            <p className="font-condensed font-black text-xs text-base-muted uppercase tracking-wider">Progress</p>
                            <p className="font-mono text-sm font-bold text-base-text">{pct}%</p>
                          </div>
                          <div className="w-24 bg-base-surface3 h-1.5 rounded-full overflow-hidden hidden sm:block border border-base-border">
                            <div className="bg-base-accent h-full" style={{ width: `${pct}%` }} />
                          </div>
                          <button
                            onClick={() => {
                              openSpotlight(p.id);
                              setActiveModal(null);
                            }}
                            className="p-2 bg-base-accent-dim hover:bg-base-accent hover:text-white text-base-accent transition-all rounded-lg font-condensed font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-base-accent/25"
                          >
                            <span>Details</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {activeModal === 'active' && filteredProjects.filter(p => p.status === 'active').map(p => {
                    const pct = calcPct(p);
                    return (
                      <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-base-surface2 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-base-surface3 px-1.5 py-0.5 rounded border border-base-border font-semibold text-base-muted">
                              WO: {p.client}
                            </span>
                            <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-base-blue-dim text-base-blue">
                              {p.assemblies?.length || 0} Assemblies
                            </span>
                          </div>
                          <p className="font-semibold text-sm text-base-text truncate">{p.name}</p>
                          <p className="text-[11px] text-base-muted">
                            Due Date: <span className="font-mono">{p.due || 'No date'}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right space-y-1 hidden sm:block">
                            <p className="font-condensed font-black text-xs text-base-muted uppercase tracking-wider">Progress</p>
                            <p className="font-mono text-sm font-bold text-base-text">{pct}%</p>
                          </div>
                          <div className="w-24 bg-base-surface3 h-1.5 rounded-full overflow-hidden hidden sm:block border border-base-border">
                            <div className="bg-base-blue h-full" style={{ width: `${pct}%` }} />
                          </div>
                          <button
                            onClick={() => {
                              openSpotlight(p.id);
                              setActiveModal(null);
                            }}
                            className="p-2 bg-base-blue-dim hover:bg-base-blue hover:text-white text-base-blue transition-all rounded-lg font-condensed font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-base-blue/25"
                          >
                            <span>Details</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {activeModal === 'completed' && filteredProjects.filter(p => p.status === 'completed').map(p => (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-base-surface2 transition-colors">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-base-surface3 px-1.5 py-0.5 rounded border border-base-border font-semibold text-base-muted">
                            WO: {p.client}
                          </span>
                          <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-base-green-dim text-base-green">
                            100% DONE
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-base-text truncate">{p.name}</p>
                        {p.completedDate && (
                          <p className="text-[11px] text-base-green font-medium">
                            Completed Date: <span className="font-mono">{p.completedDate}</span>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <button
                          onClick={() => {
                            openSpotlight(p.id);
                            setActiveModal(null);
                          }}
                          className="p-2 bg-base-green-dim hover:bg-base-green hover:text-white text-base-green transition-all rounded-lg font-condensed font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-base-green/25"
                        >
                          <span>Details</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {activeModal === 'overdue' && filteredProjects.filter(p => p.due && p.due < todayStr && p.status !== 'completed').map(p => {
                    const pct = calcPct(p);
                    const days = daysDiff(todayStr, p.due || '');
                    return (
                      <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-base-surface2 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono bg-base-surface3 px-1.5 py-0.5 rounded border border-base-border font-semibold text-base-muted">
                              WO: {p.client}
                            </span>
                            <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-base-red-dim text-base-red animate-pulse">
                              {days} days overdue
                            </span>
                          </div>
                          <p className="font-semibold text-sm text-base-text truncate">{p.name}</p>
                          <p className="text-[11px] text-base-red font-medium">
                            Target Date was: <span className="font-mono">{p.due}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right space-y-1 hidden sm:block">
                            <p className="font-condensed font-black text-xs text-base-muted uppercase tracking-wider">Progress</p>
                            <p className="font-mono text-sm font-bold text-base-red">{pct}%</p>
                          </div>
                          <div className="w-24 bg-base-surface3 h-1.5 rounded-full overflow-hidden hidden sm:block border border-base-border">
                            <div className="bg-base-red h-full" style={{ width: `${pct}%` }} />
                          </div>
                          <button
                            onClick={() => {
                              openSpotlight(p.id);
                              setActiveModal(null);
                            }}
                            className="p-2 bg-base-red-dim hover:bg-base-red hover:text-white text-base-red transition-all rounded-lg font-condensed font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-base-red/25"
                          >
                            <span>Details</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {activeModal === 'absent' && timesheets.filter(ts => ts.date === todayStr && (ts.status === 'absent' || ts.status === 'leave')).map(ts => {
                    const empDetail = employees.find(e => e.id === ts.empId);
                    return (
                      <div key={ts.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-base-surface2 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-condensed font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              ts.status === 'leave' ? 'bg-base-accent-dim text-base-accent' : 'bg-base-red-dim text-base-red'
                            }`}>
                              {ts.status.toUpperCase()}
                            </span>
                            {empDetail?.position && (
                              <span className="text-[10px] font-condensed uppercase tracking-wider text-base-muted font-bold">
                                {empDetail.position}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-base-text">{ts.empName}</p>
                          {ts.desc && (
                            <p className="text-xs text-base-muted bg-base-surface3 p-2 rounded-lg border border-base-border mt-1">
                              Reason: <span className="italic">"{ts.desc}"</span>
                            </p>
                          )}
                        </div>
                        
                        <div className="flex-shrink-0 text-right text-[11px] font-condensed text-base-muted">
                          {empDetail?.location && (
                            <span className="bg-base-surface3 border border-base-border px-2 py-0.5 rounded font-bold uppercase">
                              {empDetail.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-base-border bg-base-surface2 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-base-muted font-condensed uppercase tracking-wider">
                Click details to open project spotlight
              </span>
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-base-surface border border-base-border hover:bg-base-surface3 text-base-text transition-colors rounded-lg font-condensed font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
