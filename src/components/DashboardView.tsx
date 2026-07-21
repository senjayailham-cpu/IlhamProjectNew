import React, { useState, useMemo } from 'react';
import { Project, TimesheetEntry, Employee, MaterialItem, MaterialRequest, MaterialProcessing, ProblemReport, InspectionRequest } from '../types';
import AICenterModal from './AICenterModal';
import { calcPct, calcTaskCounts, getTotalManHours, fmtHrs } from '../utils/projectUtils';
import { Folder, Clock, CheckCircle, AlertTriangle, Users, ShieldAlert, ArrowRight, ExternalLink, AlertCircle, TrendingUp, Package, X, Layers, Siren, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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
  problemReports?: ProblemReport[];
  inspections?: InspectionRequest[];
  setActiveTab?: (tab: string) => void;
}

const BAR_COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c'];
const STATUS_COLORS = {
  active: '#4a90d9',
  pending: '#e8a020',
  completed: '#4caf7d',
  'on-hold': '#7a7870'
};

const getOverdueTasksCount = (p: Project, todayStr: string): number => {
  let count = 0;
  (p.assemblies || []).forEach(asm => {
    (asm.tasks || []).forEach(t => {
      if (!t.done && t.pct < 100 && t.finishDate && t.finishDate < todayStr) {
        count++;
      }
    });
  });
  return count;
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
  problemReports = [],
  inspections = [],
  setActiveTab,
}: DashboardViewProps) {
  const materialProcessings = useMemo(() => {
    return projects.flatMap(p => p.materialProcessing || []);
  }, [projects]);

  const [dashLoc, setDashLoc] = useState<'all' | 'workshop1' | 'workshop2'>('all');
  const [activeModal, setActiveModal] = useState<'project' | 'active' | 'completed' | 'overdue' | 'man-hours' | 'present' | 'absent' | 'problem-center' | 'ai-command-center' | null>(null);
  const [overdueTab, setOverdueTab] = useState<'projects' | 'tasks'>('projects');
  const [sCurveView, setSCurveView] = useState<'month' | 'quarter'>('month');

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
  // DYNAMIC CUMULATIVE TREND DATA (S-CURVE) & ANALYTICS CALCULATION
  // --------------------------------------------------------------------------
  const { 
    trendData, 
    targetProjs, 
    variance, 
    dailyRate, 
    remainingPct, 
    forecastDateStr 
  } = useMemo(() => {
    const parts = selectedMonth.split('-');
    const yearStr = parts[0] || '2026';
    const monthStr = parts[1] || '06';
    const yr = parseInt(yearStr, 10);
    const mo = parseInt(monthStr, 10);

    const targetMonths: string[] = [];
    if (sCurveView === 'quarter') {
      const quarter = Math.ceil(mo / 3);
      targetMonths.push(
        `${yearStr}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}`,
        `${yearStr}-${String((quarter - 1) * 3 + 2).padStart(2, '0')}`,
        `${yearStr}-${String((quarter - 1) * 3 + 3).padStart(2, '0')}`
      );
    } else {
      targetMonths.push(selectedMonth);
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    // Filter projects matching current dashboard scope and selected period
    const targetProjsList = projects.filter(p => {
      if (dashLoc !== 'all' && p.location !== dashLoc) return false;
      
      return targetMonths.some(m => {
        if (p.targetMonth) {
          return p.targetMonth === m;
        }

        const pStart = p.start || '';
        const pDue = p.due || '';
        const startM = pStart.slice(0, 7);
        const dueM = pDue.slice(0, 7);

        return startM === m || dueM === m || (pStart && pDue && pStart <= `${m}-31` && pDue >= `${m}-01`);
      });
    });

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

    const datesList: Array<{ dateStr: string; label: string }> = [];
    targetMonths.forEach(m => {
      const [y, moStr] = m.split('-');
      const yrVal = parseInt(y, 10);
      const moVal = parseInt(moStr, 10);
      const totalDaysInMonth = new Date(yrVal, moVal, 0).getDate();
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dayPad = String(d).padStart(2, '0');
        datesList.push({
          dateStr: `${y}-${moStr}-${dayPad}`,
          label: `${dayPad} ${moStr}`
        });
      }
    });

    const list: Array<{
      day: string;
      actual: number | null;
      planned: number;
    }> = [];

    if (targetProjsList.length === 0) {
      // Return beautiful fallback placeholder slope if there are no registered projects
      datesList.forEach((item, index) => {
        const defaultVal = Math.round(((index + 1) / datesList.length) * 100);
        const isFuture = item.dateStr > todayStr;
        list.push({
          day: item.label,
          actual: isFuture ? null : Math.round(defaultVal * 0.9),
          planned: defaultVal
        });
      });
    } else {
      datesList.forEach((item) => {
        const dateStr = item.dateStr;
        let totalActual = 0;
        let totalPlanned = 0;
        const isFuture = dateStr > todayStr;

        targetProjsList.forEach(p => {
          const hasBaseline = !!p.baselineSetAt;
          const pStart = (hasBaseline ? p.baselineStart : p.start) || p.start || `${targetMonths[0]}-01`;
          const pDue = (hasBaseline ? p.baselineDue : p.due) || p.due || `${targetMonths[targetMonths.length - 1]}-28`;
          
          // Flatten all tasks across all assemblies for the project
          const projectTasks: any[] = [];
          (p.assemblies || []).forEach(asm => {
            (asm.tasks || []).forEach(t => {
              projectTasks.push(t);
            });
          });

          let plannedValue = 0;

          // HARD GUARD: a project cannot have any planned progress before its own
          // start date, and must be considered 100% planned once past its due date.
          // This ensures the Planned Baseline line always starts exactly at 0% on
          // the project's start date, regardless of any inconsistent task-level data.
          if (dateStr < pStart) {
            plannedValue = 0;
          } else if (dateStr >= pDue) {
            plannedValue = 100;
          } else if (projectTasks.length === 0) {
            plannedValue = getInterpolatedPct(dateStr, pStart, pDue, 0, 100);
          } else {
            let totalProjDifficulty = 0;
            let weightedPlannedSum = 0;

            projectTasks.forEach(t => {
              const difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
              totalProjDifficulty += difficulty;

              // Clamp task dates to stay within the project's own baseline/schedule window,
              // so a task's individual date data can never push progress outside the
              // project's own [pStart, pDue] boundaries.
              let tStart = (hasBaseline ? t.baselineDate : t.date) || t.date || pStart;
              let tFinish = (hasBaseline ? t.baselineFinish : t.finishDate) || t.finishDate || tStart;
              if (tStart < pStart) tStart = pStart;
              if (tFinish > pDue) tFinish = pDue;
              if (tFinish < tStart) tFinish = tStart;

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
          const actualStart = p.start || `${targetMonths[0]}-01`;

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

        const avgPlanned = Math.round(totalPlanned / targetProjsList.length);
        const avgActual = isFuture ? null : Math.round(totalActual / targetProjsList.length);

        list.push({
          day: item.label,
          actual: avgActual,
          planned: avgPlanned
        });
      });
    }

    // Analytics calculations
    const latestActualEntry = [...list].reverse().find(d => d.actual !== null);
    const actualVal = latestActualEntry ? latestActualEntry.actual ?? 0 : 0;
    const plannedVal = latestActualEntry ? latestActualEntry.planned ?? 0 : 0;
    const varianceVal = actualVal - plannedVal;

    // Elapsed days from the start of the period to the last recorded actual progress day
    const firstDateStr = datesList[0]?.dateStr;
    const lastActualDateStr = latestActualEntry ? datesList[list.indexOf(latestActualEntry)]?.dateStr : todayStr;
    
    let elapsedDays = 1;
    if (firstDateStr && lastActualDateStr) {
      const fDate = new Date(firstDateStr);
      const lDate = new Date(lastActualDateStr);
      const elapsedMs = lDate.getTime() - fDate.getTime();
      elapsedDays = Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)));
    }

    const dailyRateVal = elapsedDays > 0 ? actualVal / elapsedDays : 0;
    const remainingPctVal = Math.max(0, 100 - actualVal);
    const remainingDaysVal = dailyRateVal > 0 ? Math.ceil(remainingPctVal / dailyRateVal) : null;
    
    let forecastDateStrVal = 'N/A';
    if (remainingDaysVal !== null && remainingDaysVal !== Infinity && remainingDaysVal >= 0) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + remainingDaysVal);
      forecastDateStrVal = forecastDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    return {
      trendData: list,
      targetProjs: targetProjsList,
      variance: varianceVal,
      dailyRate: dailyRateVal,
      remainingPct: remainingPctVal,
      forecastDateStr: forecastDateStrVal
    };
  }, [projects, selectedMonth, dashLoc, sCurveView]);

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

  // Material processing calculations
  const filteredProcessings = materialProcessings.filter(mp => {
    return filteredProjects.some(p => p.id === mp.projectId);
  });
  const totalProc = filteredProcessings.length;
  const completedProc = filteredProcessings.filter(mp => mp.isCompleted).length;
  const activeProc = filteredProcessings.filter(mp => !mp.isCompleted).length;
  const overdueProc = filteredProcessings.filter(mp => {
    if (mp.isCompleted) return false;
    const hasInProgress = mp.activeStages.some(
      k => mp.stages[k]?.status === 'in-progress'
    );
    if (!hasInProgress) return false;
    const updated = new Date(mp.updatedAt || mp.createdAt);
    const diffTime = Math.abs(Date.now() - updated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  }).length;

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

  // Memoized lists for the detail modals
  const overdueProjectsList = useMemo(() => {
    return filteredProjects.filter(p => p.due && p.due < todayStr && p.status !== 'completed');
  }, [filteredProjects, todayStr]);

  const overdueTasksList = useMemo(() => {
    const list: Array<{
      id: string;
      taskName: string;
      projectName: string;
      projectId: string;
      assemblyName: string;
      assigned: string;
      finishDate: string;
      progress: number;
    }> = [];

    filteredProjects.forEach(p => {
      (p.assemblies || []).forEach(asm => {
        (asm.tasks || []).forEach(t => {
          if (!t.done && t.pct < 100 && t.finishDate && t.finishDate < todayStr) {
            list.push({
              id: t.id,
              taskName: t.name,
              projectName: p.name,
              projectId: p.id,
              assemblyName: asm.name,
              assigned: t.assigned || 'Unassigned',
              finishDate: t.finishDate,
              progress: t.pct,
            });
          }
        });
      });
    });

    return list;
  }, [filteredProjects, todayStr]);

  const presentPersonnelToday = useMemo(() => {
    return todayTimesheets.filter(ts => ts.status === 'present' || ts.status === 'late');
  }, [todayTimesheets]);

  const absentPersonnelToday = useMemo(() => {
    return todayTimesheets.filter(ts => ts.status === 'absent' || ts.status === 'leave');
  }, [todayTimesheets]);

  // Expanded sections state for Problem Center Accordion
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    outOfStock: true,
    overdueProjects: true,
    overdueBlockers: true,
    lowStock: true,
    delayedProcessing: true,
    openProblems: true,
    inspectionPunchlist: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const lowStockItems = useMemo(() => {
    return (materials || []).filter(m => m.currentStock > 0 && m.currentStock < m.minStock);
  }, [materials]);

  const outOfStockItems = useMemo(() => {
    return (materials || []).filter(m => m.currentStock === 0);
  }, [materials]);

  const openProblemReports = useMemo(() => {
    return (problemReports || []).filter(pr => pr.status === 'Open');
  }, [problemReports]);

  const punchlistInspections = useMemo(() => {
    return (inspections || []).filter(ins => ins.status === 'Rejected / Punchlist');
  }, [inspections]);

  const scheduleSlips = useMemo(() => {
    return filteredProjects.filter(p => {
      return !!p.baselineDue && !!p.due && p.due > p.baselineDue && p.status !== 'completed';
    });
  }, [filteredProjects]);

  const overdueProcList = useMemo(() => {
    return filteredProcessings.filter(mp => {
      if (mp.isCompleted) return false;
      const hasInProgress = mp.activeStages?.some(
        k => mp.stages[k]?.status === 'in-progress'
      ) ?? false;
      if (!hasInProgress) return false;
      const updated = new Date(mp.updatedAt || mp.createdAt);
      const diffTime = Math.abs(Date.now() - updated.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 7;
    });
  }, [filteredProcessings]);

  const totalActiveProblems = useMemo(() => {
    return (
      outOfStockItems.length +
      overdueProjectsList.length +
      scheduleSlips.length +
      overdueBlockers.length +
      lowStockItems.length +
      overdueProcList.length +
      openProblemReports.length +
      punchlistInspections.length
    );
  }, [
    outOfStockItems.length,
    overdueProjectsList.length,
    scheduleSlips.length,
    overdueBlockers.length,
    lowStockItems.length,
    overdueProcList.length,
    openProblemReports.length,
    punchlistInspections.length
  ]);

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
            onClick={() => {
              setActiveModal('overdue');
              setOverdueTab(overdueCount > 0 ? 'projects' : overdueTasksList.length > 0 ? 'tasks' : 'projects');
            }}
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
              <div className="text-3xl font-condensed font-extrabold text-base-red select-none">
                {overdueCount} <span className="text-xs font-medium text-base-muted">Proj</span>
                {overdueTasksList.length > 0 && (
                  <>
                    <span className="text-base-muted text-sm mx-1">/</span>
                    <span className="text-base-red/90">{overdueTasksList.length}</span> <span className="text-xs font-medium text-base-muted">Tasks</span>
                  </>
                )}
              </div>
              {(overdueCount > 0 || overdueTasksList.length > 0) && (
                <span className="text-[10px] font-condensed font-bold text-base-red bg-base-red/10 px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                  ⚠ Alert
                </span>
              )}
            </div>
            <p className="text-xs text-base-muted2 mt-1">past target date</p>
          </div>
        </div>

        {/* Second row - attendance + manhours + material processing */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {/* Card 5 - Man Hours */}
          <div 
            onClick={() => setActiveModal('man-hours')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-blue group cursor-pointer transition-all hover:shadow-lg"
          >
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
          <div 
            onClick={() => setActiveModal('present')}
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-green group cursor-pointer transition-all hover:shadow-lg"
          >
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

          {/* Card 8 - Material Processing Shop-Floor */}
          <div 
            className="kpi-card relative overflow-hidden bg-base-surface border border-base-border p-5 rounded-xl shadow-card hover-lift border-b-4 border-b-base-accent group transition-all hover:shadow-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-base-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-base-muted text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4.5 w-4.5 text-base-accent" />
                Mat. Processing
              </div>
              <svg className="w-10 h-3 text-base-accent/35" viewBox="0 0 50 10">
                <path d="M 2,3 L 12,6 L 22,4 L 32,7 L 42,5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="2" cy="3" r="1" fill="currentColor" />
                <circle cx="12" cy="6" r="1" fill="currentColor" />
                <circle cx="22" cy="4" r="1" fill="currentColor" />
                <circle cx="32" cy="7" r="1" fill="currentColor" />
                <circle cx="42" cy="5" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-condensed font-extrabold text-base-accent select-none">
                {completedProc}/{totalProc}
              </div>
              {overdueProc > 0 && (
                <span className="text-[10px] font-condensed font-bold text-base-red bg-base-red/10 px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                  ⚠ {overdueProc} Delayed
                </span>
              )}
            </div>
            <p className="text-xs text-base-muted2 mt-1">active: {activeProc} items in stages</p>
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
              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                {/* Month/Quarter Toggle */}
                <div className="flex items-center bg-base-bg/70 border border-base-border rounded-lg p-0.5 text-xs font-condensed font-bold uppercase tracking-wider select-none shrink-0">
                  <button
                    onClick={() => setSCurveView('month')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      sCurveView === 'month'
                        ? 'bg-base-accent text-white shadow-sm'
                        : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setSCurveView('quarter')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      sCurveView === 'quarter'
                        ? 'bg-base-accent text-white shadow-sm'
                        : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
                    }`}
                  >
                    Quarter
                  </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs font-condensed font-bold uppercase tracking-wider bg-base-bg/50 px-3 py-1.5 rounded-lg border border-base-border shrink-0 select-none">
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

            {/* S-Curve Additional Insights Section */}
            <div className="border-t border-base-border/50 pt-5 space-y-5">
              {/* Variance & Forecast Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* A. Variance Indicator */}
                <div className="bg-base-surface2/40 border border-base-border rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted">Schedule Variance</span>
                    <h4 className="text-sm font-semibold text-base-text">Vs. Planned Baseline</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {variance >= 0 ? (
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        <TrendingUp className="h-4.5 w-4.5" />
                        <span className="font-condensed font-extrabold text-sm select-none">+{variance.toFixed(0)}% AHEAD</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-lg border border-rose-500/20">
                        <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
                        <span className="font-condensed font-extrabold text-sm select-none">{variance.toFixed(0)}% BEHIND</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* D. Completion Forecast */}
                <div className="bg-base-surface2/40 border border-base-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted">Completion Forecast</span>
                    <span className="text-[10px] font-mono font-bold text-base-accent">Based on {dailyRate.toFixed(2)}%/day rate</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-base-bg border border-base-border px-2.5 py-1 rounded-lg text-xs font-condensed font-bold text-base-text">
                      Daily Rate: <span className="font-mono text-base-accent">{dailyRate.toFixed(2)}%</span>
                    </div>
                    <div className="bg-base-bg border border-base-border px-2.5 py-1 rounded-lg text-xs font-condensed font-bold text-base-text">
                      Remaining: <span className="font-mono text-base-blue">{remainingPct.toFixed(0)}%</span>
                    </div>
                    {(() => {
                      const remainingDays = dailyRate > 0 ? Math.ceil(remainingPct / dailyRate) : null;
                      return remainingDays !== null && remainingDays !== Infinity && remainingDays >= 0 ? (
                        <div className="bg-base-accent/10 border border-base-accent/20 px-2.5 py-1 rounded-lg text-xs font-condensed font-bold text-base-accent flex items-center gap-1">
                          <span>Est. Finish:</span>
                          <span className="font-mono uppercase">{forecastDateStr}</span>
                        </div>
                      ) : (
                        <div className="bg-base-border/30 border border-base-border px-2.5 py-1 rounded-lg text-xs font-condensed font-bold text-base-muted2">
                          No active progress trend
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* B. Project Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-condensed font-extrabold text-xs uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                    <Folder className="h-4 w-4 text-base-accent" />
                    Project Scope Breakdown & Performance
                  </h4>
                  <span className="text-[10px] font-condensed font-bold text-base-muted">
                    {targetProjs.length} active in this period
                  </span>
                </div>
                
                <div className="border border-base-border rounded-xl overflow-hidden bg-base-surface3/25">
                  <div className="overflow-x-auto text-base-text">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-base-surface2/70 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                          <th className="px-4 py-2.5">Project Name</th>
                          <th className="px-4 py-2.5">Client / Code</th>
                          <th className="px-4 py-2.5 text-center">Status</th>
                          <th className="px-4 py-2.5 text-center">Overdue Tasks</th>
                          <th className="px-4 py-2.5 w-44">Overall Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/50 text-base-text font-medium">
                        {targetProjs.map(p => {
                          const pct = calcPct(p);
                          const todayStr = new Date().toISOString().slice(0, 10);
                          const overdueTasks = getOverdueTasksCount(p, todayStr);
                          const isProjOverdue = p.due && p.due < todayStr && p.status !== 'completed';
                          return (
                            <tr key={p.id} className="hover:bg-base-surface2/30 transition-colors">
                              <td className="px-4 py-3 font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base-text truncate max-w-[180px]">{p.name}</span>
                                  {isProjOverdue && (
                                    <span className="px-1.5 py-0.5 text-[8px] font-condensed font-bold bg-rose-500/10 text-rose-500 border border-rose-500/25 rounded uppercase">
                                      Overdue Proj
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-base-muted2 font-mono text-[11px]">{p.client || 'N/A'}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 text-[9px] font-condensed font-bold uppercase rounded-full`}
                                      style={{
                                        backgroundColor: `${STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] || '#7a7870'}15`,
                                        color: STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] || '#7a7870',
                                        border: `1px solid ${STATUS_COLORS[p.status as keyof typeof STATUS_COLORS] || '#7a7870'}25`
                                      }}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {overdueTasks > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg">
                                    {overdueTasks} overdue
                                  </span>
                                ) : (
                                  <span className="text-base-muted2 font-mono">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-base-border/35 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full transition-all duration-500" 
                                      style={{ 
                                        width: `${pct}%`,
                                        backgroundColor: pct >= 100 ? '#4caf7d' : 'var(--accent)'
                                      }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-xs text-base-text shrink-0">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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

          {/* WIDGET — Status Breakdown Donut (upgraded) */}
          <div className="card-panel relative overflow-hidden">
            <div className="card-panel-header">
              <h3 className="card-panel-title">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-base-accent" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Status Breakdown
              </h3>
              <span className="text-[10px] font-condensed font-bold text-base-muted bg-base-surface3 px-2 py-0.5 rounded-full">
                {filteredProjects.length} total
              </span>
            </div>

            <div className="card-panel-body">
              <div className="flex flex-col items-center gap-5">

                {/* Donut with center total count */}
                <div className="relative h-[140px] w-[140px] shrink-0">
                  <svg className="h-[140px] w-[140px] -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" opacity="0.35" />
                    {donutCircles}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-condensed font-extrabold text-base-text leading-none">
                      {filteredProjects.length}
                    </span>
                    <span className="text-[9px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-0.5">
                      Projects
                    </span>
                  </div>
                </div>

                {/* Legend with progress bars per status */}
                <div className="w-full space-y-2.5">
                  {statusKeys.map(s => {
                    const count = statusCounts[s];
                    const pct = filteredProjects.length > 0 ? Math.round((count / filteredProjects.length) * 100) : 0;
                    return (
                      <div key={s} className="group">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-base-surface transition-all group-hover:scale-110"
                              style={{ backgroundColor: STATUS_COLORS[s], ['--tw-ring-color' as any]: `${STATUS_COLORS[s]}30` }}
                            />
                            <span className="text-base-muted2 font-semibold capitalize">{s.replace('-', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-condensed font-extrabold text-sm" style={{ color: STATUS_COLORS[s] }}>
                              {count}
                            </span>
                            <span className="text-[10px] text-base-muted font-mono">
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-base-surface3 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* Subtle decorative corner accent */}
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.06] pointer-events-none"
              style={{ background: `radial-gradient(circle, var(--accent), transparent 70%)` }}
            />
          </div>

        </div>
      </div>



      {/* Interactive Detail Modal Popups */}
      {activeModal && activeModal !== 'ai-command-center' && (
        <div 
          className={`fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center animate-in fade-in duration-200 ${
            activeModal === 'problem-center' ? 'p-0 sm:p-4' : 'p-4'
          }`}
          onClick={() => setActiveModal(null)}
        >
          <div 
            className={`bg-base-surface border border-base-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
              activeModal === 'problem-center'
                ? 'w-full h-[90vh] sm:h-auto sm:max-w-5xl sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl mt-auto sm:mt-0'
                : 'w-full max-w-5xl max-h-[85vh] rounded-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-base-border bg-base-surface2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                {activeModal === 'project' && <Folder className="h-5.5 w-5.5 text-base-accent" />}
                {activeModal === 'active' && <Clock className="h-5.5 w-5.5 text-base-blue" />}
                {activeModal === 'completed' && <CheckCircle className="h-5.5 w-5.5 text-base-green" />}
                {activeModal === 'overdue' && <AlertTriangle className="h-5.5 w-5.5 text-base-red" />}
                {activeModal === 'man-hours' && <Clock className="h-5.5 w-5.5 text-base-blue" />}
                {activeModal === 'present' && <Users className="h-5.5 w-5.5 text-base-green" />}
                {activeModal === 'absent' && <ShieldAlert className="h-5.5 w-5.5 text-base-red" />}
                {activeModal === 'problem-center' && <Siren className={`h-5.5 w-5.5 ${totalActiveProblems > 0 ? 'text-base-red animate-pulse' : 'text-base-green'}`} />}
                
                <h3 className="font-condensed font-black text-xl uppercase tracking-wider text-base-text">
                  {activeModal === 'project' && 'All Projects'}
                  {activeModal === 'active' && 'Active Projects'}
                  {activeModal === 'completed' && 'Completed Projects'}
                  {activeModal === 'overdue' && 'Overdue Items'}
                  {activeModal === 'man-hours' && 'Man-hours Log Detail'}
                  {activeModal === 'present' && 'Present Personnel Today'}
                  {activeModal === 'absent' && 'Absent/Leave Personnel Today'}
                  {activeModal === 'problem-center' && 'Problem Center'}
                </h3>
                
                <span className="px-2 py-0.5 rounded-full bg-base-surface3 border border-base-border text-xs font-condensed font-bold text-base-muted select-none">
                  {activeModal === 'project' && filteredProjects.length}
                  {activeModal === 'active' && activeCount}
                  {activeModal === 'completed' && completedCount}
                  {activeModal === 'overdue' && (overdueProjectsList.length + overdueTasksList.length)}
                  {activeModal === 'man-hours' && scopedTimesheets.length}
                  {activeModal === 'present' && presentPersonnelToday.length}
                  {activeModal === 'absent' && absentPersonnelToday.length}
                  {activeModal === 'problem-center' && totalActiveProblems}
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

            {/* Overdue sub-tab navigation bar */}
            {activeModal === 'overdue' && (
              <div className="px-6 py-2 bg-base-surface3 border-b border-base-border flex gap-2">
                <button
                  onClick={() => setOverdueTab('projects')}
                  className={`px-4 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                    overdueTab === 'projects'
                      ? 'bg-base-red text-white border-base-red shadow-sm'
                      : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-muted2'
                  }`}
                >
                  Overdue Projects ({overdueProjectsList.length})
                </button>
                <button
                  onClick={() => setOverdueTab('tasks')}
                  className={`px-4 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                    overdueTab === 'tasks'
                      ? 'bg-base-red text-white border-base-red shadow-sm'
                      : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-muted2'
                  }`}
                >
                  Overdue Tasks ({overdueTasksList.length})
                </button>
              </div>
            )}

            {/* Modal Body / Scrollable Table Content */}
            <div className="overflow-y-auto flex-1 p-6">
              {activeModal === 'problem-center' ? (
                <div className="space-y-4">
                  {totalActiveProblems === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-16 h-16 rounded-full bg-base-green/10 border border-base-green/20 flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-base-green animate-bounce" style={{ animationDuration: '3s' }} />
                      </div>
                      <h4 className="font-condensed font-bold text-lg text-base-text mb-1">Semua Aman!</h4>
                      <p className="text-sm text-base-muted max-w-md">Tidak ada masalah aktif atau keterlambatan sistem yang terdeteksi saat ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Accordion Categories */}
                      
                      {/* 1) Out of Stock (paling kritis, warna merah) */}
                      {outOfStockItems.length > 0 && (
                        <div className="border border-base-red/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('outOfStock')}
                            className="w-full px-4 py-3 bg-base-red/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-base-red border-b border-base-red/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-base-red animate-ping" />
                              <Package className="h-4.5 w-4.5 text-base-red" />
                              Out of Stock
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-base-red text-white">
                                {outOfStockItems.length}
                              </span>
                            </span>
                            {expandedSections.outOfStock ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.outOfStock && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-base-surface">
                              {outOfStockItems.map(item => (
                                <div key={item.id} className="p-3 border border-base-red/10 rounded-xl bg-base-red/4 hover:bg-base-red/8 transition-colors">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h5 className="font-bold text-sm text-base-text">{item.name}</h5>
                                      <p className="text-xs text-base-muted font-mono mt-0.5">
                                        Category: {item.category} | Loc: {item.location || 'N/A'}
                                      </p>
                                    </div>
                                    <span className="px-2 py-1 text-xs font-condensed font-extrabold uppercase bg-base-red text-white rounded-md select-none">
                                      Stock: 0
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2) Overdue Projects & Prediksi Meleset (merah) */}
                      {(overdueProjectsList.length > 0 || scheduleSlips.length > 0) && (
                        <div className="border border-base-red/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('overdueProjects')}
                            className="w-full px-4 py-3 bg-base-red/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-base-red border-b border-base-red/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="h-4.5 w-4.5 text-base-red" />
                              Overdue Projects & Schedule Slips
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-base-red text-white">
                                {overdueProjectsList.length + scheduleSlips.length}
                              </span>
                            </span>
                            {expandedSections.overdueProjects ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.overdueProjects && (
                            <div className="p-4 space-y-3 bg-base-surface">
                              {overdueProjectsList.map(p => {
                                const daysOver = p.due ? Math.ceil((new Date(todayStr).getTime() - new Date(p.due).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                return (
                                  <div 
                                    key={`overdue-p-${p.id}`}
                                    onClick={() => { openSpotlight(p.id); setActiveModal(null); }}
                                    className="p-3.5 border border-base-red/15 rounded-xl bg-base-red/4 hover:bg-base-red/8 cursor-pointer transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                  >
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h5 className="font-bold text-sm text-base-text hover:underline">{p.name}</h5>
                                        <span className="text-[10px] uppercase font-condensed font-bold bg-base-red/15 text-base-red px-1.5 py-0.5 rounded">Overdue</span>
                                      </div>
                                      <p className="text-xs text-base-muted mt-0.5">Client: {p.client} | Start: {p.start} | Target: {p.due}</p>
                                      <p className="text-xs text-base-red font-semibold font-condensed uppercase tracking-wider mt-1 flex items-center gap-1">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Overdue by {daysOver > 0 ? daysOver : 0} days
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 self-end md:self-center">
                                      <div className="text-right">
                                        <span className="font-mono text-sm font-extrabold text-base-text">{calcPct(p)}%</span>
                                        <p className="text-[9px] text-base-muted uppercase font-bold">Progress</p>
                                      </div>
                                      <ArrowRight className="h-4 w-4 text-base-muted" />
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {scheduleSlips.map(p => {
                                const slipDays = p.due && p.baselineDue ? Math.ceil((new Date(p.due).getTime() - new Date(p.baselineDue).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                return (
                                  <div 
                                    key={`slip-p-${p.id}`}
                                    onClick={() => { openSpotlight(p.id); setActiveModal(null); }}
                                    className="p-3.5 border border-[#e8a020]/25 rounded-xl bg-[#e8a020]/4 hover:bg-[#e8a020]/8 cursor-pointer transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                  >
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h5 className="font-bold text-sm text-base-text hover:underline">{p.name}</h5>
                                        <span className="text-[10px] uppercase font-condensed font-bold bg-[#e8a020]/15 text-[#e8a020] px-1.5 py-0.5 rounded">Schedule Slip</span>
                                      </div>
                                      <p className="text-xs text-base-muted mt-0.5">Client: {p.client} | Baseline Target: {p.baselineDue} | New Target: {p.due}</p>
                                      <p className="text-xs text-[#e8a020] font-semibold font-condensed uppercase tracking-wider mt-1 flex items-center gap-1">
                                        <TrendingUp className="h-3.5 w-3.5" />
                                        Deadline slipped by {slipDays} days
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 self-end md:self-center">
                                      <div className="text-right">
                                        <span className="font-mono text-sm font-extrabold text-base-text">{calcPct(p)}%</span>
                                        <p className="text-[9px] text-base-muted uppercase font-bold">Progress</p>
                                      </div>
                                      <ArrowRight className="h-4 w-4 text-base-muted" />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3) Overdue Blockers / dependency terhambat (oranye/accent) */}
                      {overdueBlockers.length > 0 && (
                        <div className="border border-base-accent/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('overdueBlockers')}
                            className="w-full px-4 py-3 bg-base-accent/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-base-accent border-b border-base-accent/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Layers className="h-4.5 w-4.5 text-base-accent" />
                              Overdue Blockers & Dependencies
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-base-accent text-white">
                                {overdueBlockers.length}
                              </span>
                            </span>
                            {expandedSections.overdueBlockers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.overdueBlockers && (
                            <div className="p-4 space-y-3 bg-base-surface">
                              {overdueBlockers.map(b => (
                                <div 
                                  key={b.id}
                                  className="p-3.5 border border-base-accent/15 rounded-xl bg-base-accent/4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[9px] font-condensed font-extrabold bg-base-accent-dim text-base-accent px-1.5 py-0.5 rounded uppercase select-none">
                                        Blocked {b.type}
                                      </span>
                                      <h5 className="font-bold text-sm text-base-text">{b.blockedName}</h5>
                                    </div>
                                    <div className="text-xs text-base-muted">
                                      <span className="font-medium text-base-red">Blocked by incomplete predecessor:</span>{' '}
                                      <span className="font-semibold text-base-text">{b.blockingName}</span>{' '}
                                      (Due: {b.blockingDue}, overdue by <span className="font-bold text-base-red">{b.daysOverdue} days</span>, currently <span className="font-mono text-base-text">{b.progress}%</span> progress)
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2 self-end md:self-center">
                                    <button
                                      onClick={() => { openSpotlight(b.blockedProjectId); setActiveModal(null); }}
                                      className="px-2.5 py-1.5 border border-base-accent/20 hover:bg-base-accent-dim text-base-accent rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                      Spotlight Blocked
                                    </button>
                                    <button
                                      onClick={() => { openSpotlight(b.blockingProjectId); setActiveModal(null); }}
                                      className="px-2.5 py-1.5 border border-base-border hover:bg-base-surface2 text-base-text rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                      Spotlight Blocker
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4) Low Stock (kuning/accent) */}
                      {lowStockItems.length > 0 && (
                        <div className="border border-[#e8a020]/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('lowStock')}
                            className="w-full px-4 py-3 bg-[#e8a020]/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-[#e8a020] border-b border-[#e8a020]/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Package className="h-4.5 w-4.5 text-[#e8a020]" />
                              Low Stock Items
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-[#e8a020] text-white">
                                {lowStockItems.length}
                              </span>
                            </span>
                            {expandedSections.lowStock ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.lowStock && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-base-surface">
                              {lowStockItems.map(item => (
                                <div key={item.id} className="p-3 border border-[#e8a020]/10 rounded-xl bg-[#e8a020]/4 hover:bg-[#e8a020]/8 transition-colors">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h5 className="font-bold text-sm text-base-text">{item.name}</h5>
                                      <p className="text-xs text-base-muted font-mono mt-0.5">
                                        Category: {item.category} | Loc: {item.location || 'N/A'}
                                      </p>
                                    </div>
                                    <div className="text-right select-none">
                                      <span className="px-2 py-1 text-xs font-condensed font-extrabold uppercase bg-[#e8a020] text-white rounded-md">
                                        Stock: {item.currentStock}
                                      </span>
                                      <p className="text-[9px] text-base-muted uppercase font-bold mt-1">Min: {item.minStock} {item.unit}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5) Delayed Material Processing (oranye) */}
                      {overdueProcList.length > 0 && (
                        <div className="border border-base-accent/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('delayedProcessing')}
                            className="w-full px-4 py-3 bg-base-accent/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-base-accent border-b border-base-accent/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Clock className="h-4.5 w-4.5 text-base-accent" />
                              Delayed Material Processing
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-base-accent text-white">
                                {overdueProcList.length}
                              </span>
                            </span>
                            {expandedSections.delayedProcessing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.delayedProcessing && (
                            <div className="p-4 space-y-3 bg-base-surface">
                              {overdueProcList.map(mp => (
                                <div 
                                  key={mp.id}
                                  onClick={() => { openSpotlight(mp.projectId); setActiveModal(null); }}
                                  className="p-3.5 border border-base-accent/15 rounded-xl bg-base-accent/4 hover:bg-base-accent/8 cursor-pointer transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                >
                                  <div>
                                    <h5 className="font-bold text-sm text-base-text hover:underline">{mp.materialName} <span className="text-xs font-medium text-base-muted">({mp.qty} {mp.unit})</span></h5>
                                    <p className="text-xs text-base-muted mt-0.5">Project: {mp.projectName} | GA: {mp.gaNumber || 'N/A'}</p>
                                    <p className="text-[10px] text-base-red font-semibold font-condensed uppercase tracking-wider mt-1">
                                      ⚠ No progress update for over 7 days
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 self-end md:self-center">
                                    <div className="text-right">
                                      <span className="font-mono text-sm font-extrabold text-base-text">{mp.overallPct}%</span>
                                      <p className="text-[9px] text-base-muted uppercase font-bold">Overall</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-base-muted" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 6) Open Problem Reports (oranye) */}
                      {openProblemReports.length > 0 && (
                        <div className="border border-base-accent/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('openProblems')}
                            className="w-full px-4 py-3 bg-base-accent/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-base-accent border-b border-base-accent/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <ShieldAlert className="h-4.5 w-4.5 text-base-accent" />
                              Open Problem Reports
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-base-accent text-white">
                                {openProblemReports.length}
                              </span>
                            </span>
                            {expandedSections.openProblems ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.openProblems && (
                            <div className="p-4 space-y-3 bg-base-surface">
                              {openProblemReports.map(pr => (
                                <div 
                                  key={pr.id}
                                  onClick={() => { if (pr.projectId) { openSpotlight(pr.projectId); setActiveModal(null); } }}
                                  className={`p-3.5 border border-base-accent/15 rounded-xl bg-base-accent/4 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${pr.projectId ? 'cursor-pointer hover:bg-base-accent/8' : ''}`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-condensed font-extrabold bg-base-accent-dim text-base-accent px-1.5 py-0.5 rounded uppercase select-none">
                                        {pr.category}
                                      </span>
                                      <span className="text-[10px] text-base-muted">{pr.date}</span>
                                    </div>
                                    <p className="font-semibold text-xs text-base-text mt-1.5 italic">"{pr.description}"</p>
                                    <p className="text-[11px] text-base-muted mt-1">
                                      Project: <span className="font-semibold">{pr.projectName || 'N/A'}</span> | Reported by: <span className="font-semibold">{pr.reportedBy}</span> (Assigned: <span className="font-semibold">{pr.assignedPosition}</span>)
                                    </p>
                                  </div>
                                  {pr.projectId && (
                                    <div className="self-end md:self-center">
                                      <ArrowRight className="h-4 w-4 text-base-muted" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 7) Inspection Punchlist / Rejected (oranye) */}
                      {punchlistInspections.length > 0 && (
                        <div className="border border-base-accent/20 rounded-xl overflow-hidden bg-base-surface">
                          <button
                            onClick={() => toggleSection('inspectionPunchlist')}
                            className="w-full px-4 py-3 bg-base-accent/5 flex items-center justify-between font-condensed font-bold text-sm uppercase tracking-wider text-base-accent border-b border-base-accent/10 cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <AlertCircle className="h-4.5 w-4.5 text-base-accent" />
                              Inspection Punchlists & Rejections
                              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-base-accent text-white">
                                {punchlistInspections.length}
                              </span>
                            </span>
                            {expandedSections.inspectionPunchlist ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          
                          {expandedSections.inspectionPunchlist && (
                            <div className="p-4 space-y-3 bg-base-surface">
                              {punchlistInspections.map(ins => (
                                <div 
                                  key={ins.id}
                                  onClick={() => { openSpotlight(ins.projectId); setActiveModal(null); }}
                                  className="p-3.5 border border-base-accent/15 rounded-xl bg-base-accent/4 hover:bg-base-accent/8 cursor-pointer transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase font-condensed font-black bg-base-red-dim text-base-red px-1.5 py-0.5 rounded">REJECTED / PUNCHLIST</span>
                                      <span className="text-xs font-mono font-bold text-base-text">{ins.rfiNo}</span>
                                    </div>
                                    <p className="text-xs text-base-muted mt-1.5">
                                      Project: <span className="font-semibold text-base-text">{ins.projectName}</span>{' '}
                                      {ins.assemblyName && (
                                        <> | Assembly: <span className="font-semibold text-base-text">{ins.assemblyName}</span></>
                                      )}
                                    </p>
                                    <div className="p-2.5 rounded bg-base-surface border border-base-red/10 mt-2 text-xs italic text-base-red font-medium">
                                      Punch List: {ins.punchList || 'No punchlist notes recorded.'}
                                    </div>
                                    <p className="text-[10px] text-base-muted mt-2 font-condensed uppercase font-bold">
                                      Target Date: {ins.targetDate} | Requested by: {ins.requestedBy}
                                    </p>
                                  </div>
                                  <div className="self-end md:self-center">
                                    <ArrowRight className="h-4 w-4 text-base-muted" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Check empty states */}
                  {((activeModal === 'project' && filteredProjects.length === 0) ||
                    (activeModal === 'active' && activeCount === 0) ||
                    (activeModal === 'completed' && completedCount === 0) ||
                    (activeModal === 'overdue' && overdueTab === 'projects' && overdueProjectsList.length === 0) ||
                    (activeModal === 'overdue' && overdueTab === 'tasks' && overdueTasksList.length === 0) ||
                    (activeModal === 'man-hours' && scopedTimesheets.length === 0) ||
                    (activeModal === 'present' && presentPersonnelToday.length === 0) ||
                    (activeModal === 'absent' && absentPersonnelToday.length === 0)) ? (
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
                    <div className="border border-base-border rounded-xl overflow-hidden bg-base-surface">
                  {/* Category 1: All Projects */}
                  {activeModal === 'project' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                            <th className="py-2.5 px-4 font-bold">Work Order</th>
                            <th className="py-2.5 px-4 font-bold">Project Name</th>
                            <th className="py-2.5 px-4 font-bold">Category</th>
                            <th className="py-2.5 px-4 font-bold">Location</th>
                            <th className="py-2.5 px-4 font-bold">Status</th>
                            <th className="py-2.5 px-4 font-bold text-center">Progress</th>
                            <th className="py-2.5 px-4 font-bold">Due Date</th>
                            <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                          {filteredProjects.map(p => {
                            const pct = calcPct(p);
                            return (
                              <tr key={p.id} className="hover:bg-base-surface2/50 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-base-muted">
                                  {p.client || '—'}
                                </td>
                                <td className="py-3 px-4 font-medium truncate max-w-[180px]" title={p.name}>
                                  {p.name}
                                </td>
                                <td className="py-3 px-4 capitalize text-base-muted2">
                                  {p.category}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-[10px] uppercase font-condensed font-extrabold px-2 py-0.5 rounded border bg-base-surface3 text-base-muted">
                                    {p.location === 'workshop1' ? 'Workshop 1' : p.location === 'workshop2' ? 'Workshop 2' : p.location}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-[10px] font-condensed font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    p.status === 'completed' ? 'bg-base-green-dim text-base-green' :
                                    p.status === 'active' ? 'bg-base-blue-dim text-base-blue' :
                                    p.status === 'pending' ? 'bg-base-accent-dim text-base-accent' :
                                    'bg-base-surface3 text-base-muted'
                                  }`}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2 justify-center">
                                    <span className="font-mono font-bold w-8 text-right">{pct}%</span>
                                    <div className="w-16 bg-base-surface3 h-1.5 rounded-full overflow-hidden border border-base-border">
                                      <div className="bg-base-accent h-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-base-muted">
                                  {p.due || 'No date'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      openSpotlight(p.id);
                                      setActiveModal(null);
                                    }}
                                    className="inline-flex items-center gap-1 p-1 px-2.5 bg-base-accent-dim hover:bg-base-accent hover:text-white text-base-accent transition-all rounded-lg font-condensed font-bold text-[11px] uppercase tracking-wider border border-base-accent/25 cursor-pointer"
                                  >
                                    <span>View</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Category 2: Active Projects */}
                  {activeModal === 'active' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                            <th className="py-2.5 px-4 font-bold">Work Order</th>
                            <th className="py-2.5 px-4 font-bold">Project Name</th>
                            <th className="py-2.5 px-4 font-bold text-center">Assemblies</th>
                            <th className="py-2.5 px-4 font-bold">Location</th>
                            <th className="py-2.5 px-4 font-bold text-center">Progress</th>
                            <th className="py-2.5 px-4 font-bold">Due Date</th>
                            <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                          {filteredProjects.filter(p => p.status === 'active').map(p => {
                            const pct = calcPct(p);
                            return (
                              <tr key={p.id} className="hover:bg-base-surface2/50 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-base-muted">
                                  {p.client || '—'}
                                </td>
                                <td className="py-3 px-4 font-medium truncate max-w-[200px]" title={p.name}>
                                  {p.name}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="text-[10px] font-mono bg-base-surface3 border px-2 py-0.5 rounded font-bold">
                                    {p.assemblies?.length || 0}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-[10px] uppercase font-condensed font-extrabold px-2 py-0.5 rounded border bg-base-surface3 text-base-muted">
                                    {p.location === 'workshop1' ? 'Workshop 1' : p.location === 'workshop2' ? 'Workshop 2' : p.location}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2 justify-center">
                                    <span className="font-mono font-bold w-8 text-right">{pct}%</span>
                                    <div className="w-16 bg-base-surface3 h-1.5 rounded-full overflow-hidden border border-base-border">
                                      <div className="bg-base-blue h-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-base-muted">
                                  {p.due || 'No date'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      openSpotlight(p.id);
                                      setActiveModal(null);
                                    }}
                                    className="inline-flex items-center gap-1 p-1 px-2.5 bg-base-blue-dim hover:bg-base-blue hover:text-white text-base-blue transition-all rounded-lg font-condensed font-bold text-[11px] uppercase tracking-wider border border-base-blue/25 cursor-pointer"
                                  >
                                    <span>View</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Category 3: Completed Projects */}
                  {activeModal === 'completed' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                            <th className="py-2.5 px-4 font-bold">Work Order</th>
                            <th className="py-2.5 px-4 font-bold">Project Name</th>
                            <th className="py-2.5 px-4 font-bold">Location</th>
                            <th className="py-2.5 px-4 font-bold">Date Completed</th>
                            <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                          {filteredProjects.filter(p => p.status === 'completed').map(p => {
                            return (
                              <tr key={p.id} className="hover:bg-base-surface2/50 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-base-muted">
                                  {p.client || '—'}
                                </td>
                                <td className="py-3 px-4 font-medium truncate max-w-[240px]" title={p.name}>
                                  {p.name}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-[10px] uppercase font-condensed font-extrabold px-2 py-0.5 rounded border bg-base-surface3 text-base-muted">
                                    {p.location === 'workshop1' ? 'Workshop 1' : p.location === 'workshop2' ? 'Workshop 2' : p.location}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-base-green font-semibold">
                                  {p.completedDate || 'Completed'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      openSpotlight(p.id);
                                      setActiveModal(null);
                                    }}
                                    className="inline-flex items-center gap-1 p-1 px-2.5 bg-base-green-dim hover:bg-base-green hover:text-white text-base-green transition-all rounded-lg font-condensed font-bold text-[11px] uppercase tracking-wider border border-base-green/25 cursor-pointer"
                                  >
                                    <span>View</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Category 4: Overdue Items (Tabbed) */}
                  {activeModal === 'overdue' && (
                    <div className="overflow-x-auto">
                      {overdueTab === 'projects' ? (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                              <th className="py-2.5 px-4 font-bold">Work Order</th>
                              <th className="py-2.5 px-4 font-bold">Project Name</th>
                              <th className="py-2.5 px-4 font-bold text-base-red">Target Date</th>
                              <th className="py-2.5 px-4 font-bold text-center">Days Overdue</th>
                              <th className="py-2.5 px-4 font-bold text-center">Progress</th>
                              <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                            {overdueProjectsList.map(p => {
                              const pct = calcPct(p);
                              const days = daysDiff(todayStr, p.due || '');
                              return (
                                <tr key={p.id} className="hover:bg-base-surface2/50 transition-colors">
                                  <td className="py-3 px-4 font-mono font-bold text-base-muted">
                                    {p.client || '—'}
                                  </td>
                                  <td className="py-3 px-4 font-medium truncate max-w-[200px]" title={p.name}>
                                    {p.name}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-semibold text-base-red">
                                    {p.due}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-base-red">
                                    {days} days
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2 justify-center">
                                      <span className="font-mono font-bold w-8 text-right text-base-red">{pct}%</span>
                                      <div className="w-16 bg-base-surface3 h-1.5 rounded-full overflow-hidden border border-base-border">
                                        <div className="bg-base-red h-full" style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => {
                                        openSpotlight(p.id);
                                        setActiveModal(null);
                                      }}
                                      className="inline-flex items-center gap-1 p-1 px-2.5 bg-base-red-dim hover:bg-base-red hover:text-white text-base-red transition-all rounded-lg font-condensed font-bold text-[11px] uppercase tracking-wider border border-base-red/25 cursor-pointer"
                                    >
                                      <span>View</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                              <th className="py-2.5 px-4 font-bold">Task Name</th>
                              <th className="py-2.5 px-4 font-bold">Project</th>
                              <th className="py-2.5 px-4 font-bold">Assembly</th>
                              <th className="py-2.5 px-4 font-bold">Assigned</th>
                              <th className="py-2.5 px-4 font-bold text-base-red">Target Finish</th>
                              <th className="py-2.5 px-4 font-bold text-center">Days Overdue</th>
                              <th className="py-2.5 px-4 font-bold text-center">Progress</th>
                              <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                            {overdueTasksList.map(t => {
                              const days = daysDiff(todayStr, t.finishDate || '');
                              return (
                                <tr key={t.id} className="hover:bg-base-surface2/50 transition-colors">
                                  <td className="py-3 px-4 font-semibold text-base-text max-w-[160px] truncate" title={t.taskName}>
                                    {t.taskName}
                                  </td>
                                  <td className="py-3 px-4 text-base-muted2 max-w-[150px] truncate" title={t.projectName}>
                                    {t.projectName}
                                  </td>
                                  <td className="py-3 px-4 text-base-muted2 max-w-[120px] truncate" title={t.assemblyName}>
                                    {t.assemblyName}
                                  </td>
                                  <td className="py-3 px-4 text-base-muted font-medium whitespace-nowrap">
                                    {t.assigned}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-semibold text-base-red">
                                    {t.finishDate}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-base-red">
                                    {days} days
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono font-bold text-base-red">
                                    {t.progress}%
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => {
                                        openSpotlight(t.projectId);
                                        setActiveModal(null);
                                      }}
                                      className="inline-flex items-center gap-1 p-1 px-2.5 bg-base-red-dim hover:bg-base-red hover:text-white text-base-red transition-all rounded-lg font-condensed font-bold text-[11px] uppercase tracking-wider border border-base-red/25 cursor-pointer"
                                    >
                                      <span>View</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Category 5: Man-hours breakdown */}
                  {activeModal === 'man-hours' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                            <th className="py-2.5 px-4 font-bold">Date</th>
                            <th className="py-2.5 px-4 font-bold">Employee</th>
                            <th className="py-2.5 px-4 font-bold">Work Order</th>
                            <th className="py-2.5 px-4 font-bold">Assembly</th>
                            <th className="py-2.5 px-4 font-bold text-center">Hours</th>
                            <th className="py-2.5 px-4 font-bold">Status</th>
                            <th className="py-2.5 px-4 font-bold">Activity Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                          {scopedTimesheets.map(ts => {
                            return (
                              <tr key={ts.id} className="hover:bg-base-surface2/50 transition-colors">
                                <td className="py-3 px-4 font-mono text-base-muted whitespace-nowrap">
                                  {ts.date}
                                </td>
                                <td className="py-3 px-4 font-semibold text-base-text whitespace-nowrap">
                                  {ts.empName}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-base-muted">
                                  {ts.workOrder || '—'}
                                </td>
                                <td className="py-3 px-4 text-base-muted2 max-w-[120px] truncate" title={ts.assemblyName}>
                                  {ts.assemblyName || '—'}
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-base-blue">
                                  {ts.totalHours}h
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-[10px] font-condensed font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    ts.status === 'present' ? 'bg-base-green-dim text-base-green' :
                                    ts.status === 'late' ? 'bg-base-accent-dim text-base-accent' :
                                    'bg-base-surface3 text-base-muted'
                                  }`}>
                                    {ts.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 max-w-[200px] truncate text-base-muted2 italic" title={ts.desc}>
                                  {ts.desc || 'No description'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Category 6: Present Personnel Today */}
                  {activeModal === 'present' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                            <th className="py-2.5 px-4 font-bold">Employee Name</th>
                            <th className="py-2.5 px-4 font-bold">Position</th>
                            <th className="py-2.5 px-4 font-bold">Location</th>
                            <th className="py-2.5 px-4 font-bold">Status</th>
                            <th className="py-2.5 px-4 font-bold">Work Order (Assignment)</th>
                            <th className="py-2.5 px-4 font-bold text-center">Hours Logged</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                          {presentPersonnelToday.map(ts => {
                            const empDetail = employees.find(e => e.id === ts.empId);
                            return (
                              <tr key={ts.id} className="hover:bg-base-surface2/50 transition-colors">
                                <td className="py-3 px-4 font-semibold text-base-text">
                                  {ts.empName}
                                </td>
                                <td className="py-3 px-4 text-base-muted font-medium">
                                  {empDetail?.position || 'Personnel'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-[10px] uppercase font-condensed font-extrabold px-2 py-0.5 rounded border bg-base-surface3 text-base-muted">
                                    {empDetail?.location || 'Unassigned'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-[10px] font-condensed font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    ts.status === 'late' ? 'bg-base-accent-dim text-base-accent' : 'bg-base-green-dim text-base-green'
                                  }`}>
                                    {ts.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-base-muted2">
                                  {ts.workOrder ? (
                                    <span className="font-mono font-bold text-base-muted bg-base-surface3 border border-base-border px-1.5 py-0.5 rounded">
                                      WO: {ts.workOrder}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                  {ts.assemblyName && <span className="text-[11px] ml-1.5 text-base-muted2">({ts.assemblyName})</span>}
                                </td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-base-green">
                                  {ts.totalHours}h
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Category 7: Absent Today */}
                  {activeModal === 'absent' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-base-border bg-base-surface2 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted select-none">
                            <th className="py-2.5 px-4 font-bold">Employee Name</th>
                            <th className="py-2.5 px-4 font-bold">Position</th>
                            <th className="py-2.5 px-4 font-bold">Location</th>
                            <th className="py-2.5 px-4 font-bold">Status</th>
                            <th className="py-2.5 px-4 font-bold">Reason for Absence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-base-border/50 text-xs text-base-text">
                          {absentPersonnelToday.map(ts => {
                            const empDetail = employees.find(e => e.id === ts.empId);
                            return (
                              <tr key={ts.id} className="hover:bg-base-surface2/50 transition-colors">
                                <td className="py-3 px-4 font-semibold text-base-text">
                                  {ts.empName}
                                </td>
                                <td className="py-3 px-4 text-base-muted font-medium">
                                  {empDetail?.position || 'Personnel'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-[10px] uppercase font-condensed font-extrabold px-2 py-0.5 rounded border bg-base-surface3 text-base-muted">
                                    {empDetail?.location || 'Unassigned'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-[10px] font-condensed font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    ts.status === 'leave' ? 'bg-base-accent-dim text-base-accent' : 'bg-base-red-dim text-base-red'
                                  }`}>
                                    {ts.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-3 px-4 italic text-base-muted max-w-[280px] truncate" title={ts.desc}>
                                  {ts.desc || 'No reason provided'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-base-border bg-base-surface2 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-base-muted font-condensed uppercase tracking-wider select-none">
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

      {/* AI Command Center Modal */}
      {activeModal === 'ai-command-center' && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <AICenterModal
              projects={projects}
              employees={employees}
              materials={materials}
              materialRequests={materialRequests}
              problemReports={problemReports}
              inspections={inspections}
              timesheets={timesheets}
              setActiveTab={(tab) => {
                setActiveTab?.(tab);
                setActiveModal(null);
              }}
              onClose={() => setActiveModal(null)}
              openSpotlight={openSpotlight}
            />
          </div>
        </div>
      )}

      {/* AI Command Center FAB Button */}
      <div className="fixed bottom-24 right-6 z-[90]">
        <button
          onClick={() => setActiveModal('ai-command-center')}
          className="relative w-14 h-14 rounded-full bg-base-accent hover:bg-base-accent/90 text-black flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-base-accent/20 animate-pulse"
          style={{ animationDuration: '4s' }}
          title="AI Command Center"
        >
          <Sparkles className="h-6 w-6 text-black" />
        </button>
      </div>

      {/* Problem Center FAB Button */}
      <div className="fixed bottom-6 right-6 z-[90]">
        <button
          onClick={() => setActiveModal('problem-center')}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ${
            totalActiveProblems > 0
              ? 'bg-base-red hover:bg-base-red/90 text-white ring-4 ring-base-red/20 animate-pulse'
              : 'bg-base-green hover:bg-base-green/90 text-white ring-4 ring-base-green/20'
          }`}
          title="Problem Center"
        >
          <Siren className="h-6 w-6" />
          
          {totalActiveProblems > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-base-red border-2 border-base-red shadow-md select-none animate-bounce" style={{ animationDuration: '3s' }}>
              {totalActiveProblems}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
