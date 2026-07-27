import React, { useState, useEffect } from 'react';
import { ActivityLog, Project, TimesheetEntry, InspectionRequest, ProblemReport } from '../types';
import { calcPct, esc } from '../utils/projectUtils';
import { FileText, Printer, Trash2, ArrowUp, ArrowDown, HelpCircle, Activity, TrendingUp, Users, Clock, BarChart2, FileCheck, AlertTriangle } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface DailyReportViewProps {
  projects: Project[];
  activityLogs: ActivityLog[];
  reportDate: string;
  setReportDate: (date: string) => void;
  clearActivityLogs: () => void;
  openPrintView: () => void;
  timesheets: TimesheetEntry[];
}

const ACT_ICONS: Record<string, { label: string; color: string; bg: string }> = {
  task_progress: { label: 'Progress update', color: 'var(--accent)', bg: 'rgba(240,168,50,.12)' },
  task_toggle: { label: 'Task completion', color: 'var(--green)', bg: 'rgba(71,184,122,.12)' },
  task_add: { label: 'Task added', color: 'var(--blue)', bg: 'rgba(77,150,224,.15)' },
  task_delete: { label: 'Task deleted', color: 'var(--red)', bg: 'rgba(212,90,77,.12)' },
  project_add: { label: 'Project added', color: 'var(--blue)', bg: 'rgba(77,150,224,.15)' },
  project_edit: { label: 'Project edited', color: 'var(--accent)', bg: 'rgba(240,168,50,.12)' },
  project_delete: { label: 'Project deleted', color: 'var(--red)', bg: 'rgba(212,90,77,.12)' },
  assembly_add: { label: 'Assembly added', color: 'var(--blue)', bg: 'rgba(77,150,224,.15)' },
  assembly_edit: { label: 'Assembly edited', color: 'var(--accent)', bg: 'rgba(240,168,50,.12)' },
  assembly_delete: { label: 'Assembly deleted', color: 'var(--red)', bg: 'rgba(212,90,77,.12)' }
};

export default function DailyReportView({
  projects,
  activityLogs,
  reportDate,
  setReportDate,
  clearActivityLogs,
  openPrintView,
  timesheets
}: DailyReportViewProps) {
  const [userCollapsed, setUserCollapsed] = useState<Record<string, boolean>>({});
  const [trendPeriod, setTrendPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [attendanceMetric, setAttendanceMetric] = useState<'hours' | 'headcount'>('hours');

  const [inspections, setInspections] = useState<InspectionRequest[]>([]);
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);

  useEffect(() => {
    const unsubInspections = onSnapshot(collection(db, 'inspections'), (snapshot) => {
      const list: InspectionRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as InspectionRequest);
      });
      setInspections(list);
    });

    const unsubProblems = onSnapshot(collection(db, 'problemReports'), (snapshot) => {
      const list: ProblemReport[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ProblemReport);
      });
      setProblemReports(list);
    });

    return () => {
      unsubInspections();
      unsubProblems();
    };
  }, []);

  const shiftDate = (d: number) => {
    const dt = new Date(reportDate + 'T12:00:00');
    dt.setDate(dt.getDate() + d);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dt.toISOString().slice(0, 10) > todayStr) return; // boundary check
    setReportDate(dt.toISOString().slice(0, 10));
  };

  const jumpYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const jumpToday = () => {
    setReportDate(new Date().toISOString().slice(0, 10));
  };

  const formatHeaderLabel = () => {
    const d = new Date(reportDate + 'T12:00:00');
    const todayStr = new Date().toISOString().slice(0, 10);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);

    const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    if (reportDate === todayStr) return `TODAY — ${dateStr}`;
    if (reportDate === yestStr) return `YESTERDAY — ${dateStr}`;
    return `${dayName.toUpperCase()} — ${dateStr}`;
  };

  const currentDateObj = new Date(reportDate + 'T12:00:00');
  const curYear = currentDateObj.getFullYear();
  const curMonth = currentDateObj.getMonth();
  const curDay = currentDateObj.getDate();

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(curYear, val, 1);
    const maxDays = new Date(curYear, val + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDays);
    d.setDate(targetDay);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(curYear, curMonth, val);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(val, curMonth, 1);
    const maxDays = new Date(val, curMonth + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDays);
    d.setDate(targetDay);
    setReportDate(d.toISOString().slice(0, 10));
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

  const daysCount = new Date(curYear, curMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);
  const yearsArray = Array.from({ length: 11 }, (_, i) => 2024 + i); // 2024 to 2034

  const dayLogs = activityLogs
    .filter(log => log.date === reportDate)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  // Helper to calculate project before pct based on day's logs
  const getProjectBeforePct = (p: Project, logs: ActivityLog[]): number => {
    let totalWeight = 0;
    let accumulatedWeightedPct = 0;
    (p.assemblies || []).forEach(a => {
      (a.tasks || []).forEach(t => {
        const difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
        totalWeight += difficulty;

        // Find progress/toggle logs for this specific task
        const taskLogs = logs.filter(l => 
          l.projectId === p.id && 
          l.assemblyName === a.name && 
          l.taskName === t.name &&
          (l.type === 'task_progress' || l.type === 'task_toggle')
        );

        let beforePct = t.pct || 0;
        if (taskLogs.length > 0) {
          // Sort by timestamp to find the earliest
          const sortedLogs = [...taskLogs].sort((x, y) => x.ts.localeCompare(y.ts));
          if (sortedLogs[0].oldPct !== undefined) {
            beforePct = sortedLogs[0].oldPct;
          }
        }
        accumulatedWeightedPct += beforePct * difficulty;
      });
    });

    if (totalWeight === 0) return 0;
    return Math.round(accumulatedWeightedPct / totalWeight);
  };

  // Helper to calculate user's specific impact
  const getUserImpact = (uid: string, entries: ActivityLog[]) => {
    const projectImpacts: Record<string, { 
      projectName: string; 
      beforePct: number; 
      afterPct: number; 
      delta: number 
    }> = {};

    const userProjectLogs: Record<string, ActivityLog[]> = {};
    entries.forEach(l => {
      if (!l.projectId) return;
      if (!userProjectLogs[l.projectId]) {
        userProjectLogs[l.projectId] = [];
      }
      userProjectLogs[l.projectId].push(l);
    });

    let totalPortfolioImpact = 0;

    Object.entries(userProjectLogs).forEach(([pid, logs]) => {
      const proj = projects.find(p => p.id === pid);
      if (!proj) return;

      let totalProjectWeight = 0;
      (proj.assemblies || []).forEach(a => {
        (a.tasks || []).forEach(t => {
          const difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
          totalProjectWeight += difficulty;
        });
      });

      if (totalProjectWeight === 0) return;

      const taskLogsGrouped: Record<string, ActivityLog[]> = {};
      logs.forEach(l => {
        if (!l.taskName || !l.assemblyName) return;
        const key = `${l.assemblyName} ||| ${l.taskName}`;
        if (!taskLogsGrouped[key]) {
          taskLogsGrouped[key] = [];
        }
        taskLogsGrouped[key].push(l);
      });

      let userWeightedDeltaSum = 0;

      Object.entries(taskLogsGrouped).forEach(([key, taskLogs]) => {
        const [assemblyName, taskName] = key.split(' ||| ');
        let difficulty = 1;
        (proj.assemblies || []).forEach(a => {
          if (a.name === assemblyName) {
            const t = (a.tasks || []).find(t => t.name === taskName);
            if (t) {
              difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
            }
          }
        });

        const sorted = [...taskLogs].sort((x, y) => x.ts.localeCompare(y.ts));
        const firstLog = sorted[0];
        const lastLog = sorted[sorted.length - 1];

        const oldP = firstLog.oldPct !== undefined ? firstLog.oldPct : 0;
        const newP = lastLog.newPct !== undefined ? lastLog.newPct : 0;
        const taskDelta = newP - oldP;

        userWeightedDeltaSum += taskDelta * difficulty;
      });

      const projectDelta = userWeightedDeltaSum / totalProjectWeight;
      const projectDeltaRounded = Math.round(projectDelta * 10) / 10;

      const afterPct = calcPct(proj);
      const beforePct = Math.max(0, Math.min(100, Math.round(afterPct - projectDelta)));

      if (projectDeltaRounded !== 0) {
        projectImpacts[pid] = {
          projectName: proj.name,
          beforePct,
          afterPct,
          delta: projectDeltaRounded
        };
        
        if (projects.length > 0) {
          totalPortfolioImpact += projectDelta / projects.length;
        }
      }
    });

    return {
      projectImpacts,
      portfolioImpact: Math.round(totalPortfolioImpact * 10) / 10
    };
  };

  // Snapshot calculations
  const projectsSnapshot: Record<string, { id: string; name: string; changes: number; totalDelta: number }> = {};
  dayLogs.forEach(l => {
    if (!l.projectId) return;
    if (!projectsSnapshot[l.projectId]) {
      projectsSnapshot[l.projectId] = { id: l.projectId, name: l.projectName || '', changes: 0, totalDelta: 0 };
    }
    const delta = (l.newPct || 0) - (l.oldPct || 0);
    projectsSnapshot[l.projectId].changes++;
    projectsSnapshot[l.projectId].totalDelta += delta;
  });

  const uniqueActiveUsers = [...new Set(dayLogs.map(l => l.userId))].length;
  const progressUpdatesCount = dayLogs.filter(l => l.type === 'task_progress' || l.type === 'task_toggle').length;

  // Process overall portfolio progress impact using the exact weighted progress difference
  const totalProjects = projects.length;
  let overallImpactScore = 0;
  if (totalProjects > 0) {
    const overallNow = Math.round(projects.reduce((s, p) => s + calcPct(p), 0) / totalProjects);
    let overallBefore = 0;
    projects.forEach(p => {
      overallBefore += getProjectBeforePct(p, dayLogs);
    });
    overallBefore = Math.round(overallBefore / totalProjects);
    overallImpactScore = overallNow - overallBefore;
  }

  // Dynamic Trend & Correlation Calculations
  const daysToCompute = trendPeriod === 'weekly' ? 7 : 30;
  
  const generateDatesRange = (endDateStr: string, count: number): string[] => {
    const dates: string[] = [];
    const end = new Date(endDateStr + 'T12:00:00');
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  };

  const datesRange = generateDatesRange(reportDate, daysToCompute);

  const trendData = datesRange.map(d => {
    const dayTimesheets = timesheets.filter(ts => ts.date === d);
    const totalHours = dayTimesheets.reduce((sum, ts) => sum + (ts.totalHours || 0), 0);
    const headcount = new Set(dayTimesheets.map(ts => ts.empId)).size;

    const dayLogsList = activityLogs.filter(l => l.date === d);
    const progressAdded = dayLogsList.reduce((sum, l) => {
      if (l.type === 'task_progress' || l.type === 'task_toggle') {
        const delta = (l.newPct || 0) - (l.oldPct || 0);
        return sum + (delta > 0 ? delta : 0);
      }
      return sum;
    }, 0);

    const parsedDate = new Date(d + 'T12:00:00');
    const dayName = parsedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    return {
      dateStr: d,
      day: dayName,
      hours: Math.round(totalHours * 10) / 10,
      headcount,
      progress: Math.round(progressAdded * 10) / 10
    };
  });

  const calcCorrelation = (data: { x: number; y: number }[]) => {
    const n = data.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    data.forEach(p => {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
      sumY2 += p.y * p.y;
    });
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    return num / den;
  };

  const correlationPairs = trendData.map(d => ({
    x: attendanceMetric === 'hours' ? d.hours : d.headcount,
    y: d.progress
  }));
  const rCoeff = calcCorrelation(correlationPairs);
  const rCoeffRounded = Math.round(rCoeff * 100) / 100;

  let correlationLabel = "Minimal or baseline correlation detected";
  let correlationColor = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  if (rCoeffRounded > 0.5) {
    correlationLabel = `Strong positive correlation (r = +${rCoeffRounded})`;
    correlationColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  } else if (rCoeffRounded > 0.2) {
    correlationLabel = `Moderate positive correlation (r = +${rCoeffRounded})`;
    correlationColor = "bg-teal-500/10 text-teal-500 border-teal-500/20";
  } else if (rCoeffRounded < -0.2) {
    correlationLabel = `Inverse correlation detected (r = ${rCoeffRounded})`;
    correlationColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }

  // Group logs by User
  const userGroups: Record<string, { name: string; role: string; entries: ActivityLog[] }> = {};
  dayLogs.forEach(l => {
    if (!userGroups[l.userId]) {
      userGroups[l.userId] = { name: l.userName, role: l.userRole, entries: [] };
    }
    userGroups[l.userId].entries.push(l);
  });

  const toggleUserCollapse = (uid: string) => {
    setUserCollapsed(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const collapseAll = () => {
    const coll: Record<string, boolean> = {};
    Object.keys(userGroups).forEach(uid => { coll[uid] = true; });
    setUserCollapsed(coll);
  };

  const expandAll = () => {
    setUserCollapsed({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
            Daily <span className="text-base-accent">Activities</span>
          </h2>

          {/* Date Picker Switcher */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
              title="Previous Day"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="flex items-center gap-0.5 font-condensed font-bold text-xs">
              {/* Day Dropdown */}
              <select
                value={curDay}
                onChange={handleDayChange}
                className="bg-transparent text-base-text py-0.5 px-1 w-[32px] text-center cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors"
              >
                {daysArray.map(d => (
                  <option key={d} value={d} className="bg-base-surface2 text-base-text font-sans">
                    {String(d).padStart(2, '0')}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Month Dropdown */}
              <select
                id="month-select"
                value={curMonth}
                onChange={handleMonthChange}
                className="bg-transparent text-base-text py-0.5 px-1 w-[54px] text-center cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors uppercase font-bold"
              >
                {MONTHS_LIST.map(m => (
                  <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Year Dropdown */}
              <select
                value={curYear}
                onChange={handleYearChange}
                className="bg-transparent text-base-text py-0.5 px-0.5 w-[46px] text-center cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors"
              >
                {yearsArray.map(y => (
                  <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
              title="Next Day"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button
            onClick={jumpYesterday}
            className="px-2.5 py-1.5 border border-base-border hover:bg-base-surface3 text-base-muted2 rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
          >
            Yesterday
          </button>
          <button
            onClick={jumpToday}
            className="px-2.5 py-1.5 border border-base-blue/20 hover:bg-base-blue-dim text-base-blue rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openPrintView}
            className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4 text-base-accent" />
            <span>Print PDF</span>
          </button>
          <button
            onClick={clearActivityLogs}
            className="btn btn-sm btn-danger flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {dayLogs.length === 0 ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
          <FileText className="h-10 w-10 text-base-border mb-3" />
          <p className="text-sm font-semibold">No activity logs recorded for this date.</p>
          <p className="text-xs text-base-muted2 mt-1">Changes are tracked automatically as coordinators update sub-assemblies and schedules.</p>
        </div>
      ) : (
        <>
          {/* SECTION A — EXECUTIVE SUMMARY & PORTFOLIO KPIS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <BarChart2 className="h-4 w-4 text-base-accent" />
              <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">
                Section A — Executive Summary & Portfolio KPIs
              </h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-accent">
                <div className="text-[28px] font-condensed font-extrabold text-base-accent leading-none">{dayLogs.length}</div>
                <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Total updates</div>
              </div>
              <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-blue">
                <div className="text-[28px] font-condensed font-extrabold text-base-blue leading-none">{uniqueActiveUsers}</div>
                <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Active users</div>
              </div>
              <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-green">
                <div className="text-[28px] font-condensed font-extrabold text-base-green leading-none">{progressUpdatesCount}</div>
                <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Progress updates</div>
              </div>
              <div className={`bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 ${
                overallImpactScore > 0 ? 'border-b-base-green' : overallImpactScore < 0 ? 'border-b-base-red' : 'border-b-base-border'
              }`}>
                <div className={`text-[28px] font-condensed font-extrabold leading-none ${
                  overallImpactScore > 0 ? 'text-base-green' : overallImpactScore < 0 ? 'text-base-red' : 'text-base-muted2'
                }`}>
                  {overallImpactScore > 0 ? `+${overallImpactScore}` : overallImpactScore}%
                </div>
                <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Portfolio Impact</div>
              </div>
            </div>
          </div>

          {/* SECTION B — WORKFORCE ALLOCATION & PRODUCTIVITY TREND */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card p-5 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-border/50 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-base-accent" />
                  <h3 className="font-condensed font-extrabold uppercase text-sm tracking-wider text-base-text">
                    Section B — Workforce Allocation & Productivity Trend
                  </h3>
                </div>
                <p className="text-[11px] text-base-muted mt-1 leading-relaxed">
                  Visualizing the relationship between labor resources allocated (timesheet metrics) and daily progress gains.
                </p>
              </div>

              {/* Dynamic Correlation Badge */}
              <div className={`px-3 py-1.5 rounded-lg border text-xxs font-bold uppercase tracking-wider ${correlationColor}`}>
                {correlationLabel}
              </div>

              {/* Chart Filters */}
              <div className="flex items-center gap-3 self-end md:self-auto">
                {/* Metric Selector */}
                <div className="flex bg-base-surface2 border border-base-border rounded-lg p-0.5 text-xxs font-bold">
                  <button
                    onClick={() => setAttendanceMetric('hours')}
                    className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                      attendanceMetric === 'hours'
                        ? 'bg-base-surface text-base-accent shadow-sm font-black'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    Hours Logged
                  </button>
                  <button
                    onClick={() => setAttendanceMetric('headcount')}
                    className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                      attendanceMetric === 'headcount'
                        ? 'bg-base-surface text-base-accent shadow-sm font-black'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    Headcount
                  </button>
                </div>

                {/* Period Selector */}
                <div className="flex bg-base-surface2 border border-base-border rounded-lg p-0.5 text-xxs font-bold">
                  <button
                    onClick={() => setTrendPeriod('weekly')}
                    className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                      trendPeriod === 'weekly'
                        ? 'bg-base-surface text-base-accent shadow-sm font-black'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setTrendPeriod('monthly')}
                    className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                      trendPeriod === 'monthly'
                        ? 'bg-base-surface text-base-accent shadow-sm font-black'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </div>

            {/* Line Graph Area */}
            <div className="h-[250px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: 'var(--muted2)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  {/* Left Y-axis for workforce metric */}
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: 'var(--muted2)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => attendanceMetric === 'hours' ? `${val}h` : `${val}p`}
                  />
                  {/* Right Y-axis for progress added */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'var(--muted2)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `+${val}%`}
                  />
                  
                  {/* Tooltip */}
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-base-surface border border-base-border p-3 rounded-xl shadow-modal text-xs space-y-2 font-bold border-l-4 border-l-base-accent">
                            <p className="text-base-text border-b border-base-border/50 pb-1 font-condensed tracking-wider uppercase">{label}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-base-blue">
                                <span className="w-1.5 h-1.5 rounded-full bg-base-blue" />
                                {attendanceMetric === 'hours' ? 'Total Hours:' : 'Staff Count:'}
                              </span>
                              <span className="text-base-text font-mono">
                                {payload[0]?.value}{attendanceMetric === 'hours' ? ' hours' : ' present'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-emerald-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Progress Added:
                              </span>
                              <span className="text-base-text font-mono">+{payload[1]?.value}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {/* Lines */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey={attendanceMetric === 'hours' ? 'hours' : 'headcount'}
                    name={attendanceMetric === 'hours' ? 'Workforce Effort (Hours)' : 'Workforce Present (Count)'}
                    stroke="var(--blue)"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 0, fill: 'var(--blue)' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="progress"
                    name="Productivity (Progress Added %)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 0, fill: '#10b981' }}
                    activeDot={{ r: 5 }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    content={({ payload }) => (
                      <div className="flex justify-center gap-6 mt-2 text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                        {payload?.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <span className="w-3 h-0.75 rounded" style={{ backgroundColor: entry.color }} />
                            <span>{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECTION C — PROGRESSIVE PROJECT TRACKING */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center gap-2">
              <Activity className="h-4 w-4 text-base-accent" />
              <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">
                Section C — Progressive Project Tracking
              </h3>
            </div>
            {Object.keys(projectsSnapshot).length > 0 ? (
              <div className="divide-y divide-base-border/40">
                {Object.entries(projectsSnapshot).map(([pid, info], i) => {
                  const proj = projects.find(x => x.id === pid);
                  const curPct = proj ? calcPct(proj) : 0;
                  const beforePct = proj ? getProjectBeforePct(proj, dayLogs) : 0;
                  const projectDelta = curPct - beforePct;
                  return (
                    <div key={pid} className="flex px-4 py-3.5 items-center justify-between gap-4 text-xs">
                      <div className="font-bold text-base-text flex-1 truncate min-w-0" title={info.name}>
                        {info.name}
                      </div>

                      {/* Before and After progression */}
                      <div className="flex items-center gap-2 text-xxs font-mono text-base-muted2 shrink-0">
                        <span>{beforePct}%</span>
                        <span className="text-base-muted/40">➔</span>
                        <span className="font-extrabold text-base-text">{curPct}%</span>
                      </div>

                      {/* Progressive Track */}
                      <div className="flex-1 max-w-[200px] h-2 bg-base-border/20 rounded-full overflow-hidden relative hidden sm:block shrink-0">
                        {/* Before base progress */}
                        <div className="absolute top-0 left-0 h-full bg-base-accent/40 rounded-full" style={{ width: `${beforePct}%` }} />
                        {/* Current actual progress bar */}
                        <div className="absolute top-0 left-0 h-full bg-base-accent rounded-full transition-all duration-500 ease-out" style={{ width: `${curPct}%` }} />
                        {/* Added progress highlight segment */}
                        {projectDelta > 0 && (
                          <div 
                            className="absolute top-0 h-full bg-emerald-500 animate-pulse" 
                            style={{ left: `${beforePct}%`, width: `${projectDelta}%` }} 
                          />
                        )}
                      </div>

                      <span className={`font-condensed font-extrabold text-sm ml-4 min-w-[50px] text-right shrink-0 ${
                        projectDelta > 0 ? 'text-base-green' : projectDelta < 0 ? 'text-base-red' : 'text-base-muted'
                      }`}>
                        {projectDelta > 0 ? `+${projectDelta}` : projectDelta}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-base-muted italic">
                No project progress logged on this date.
              </div>
            )}
          </div>

          {/* SECTION D — PERSONNEL UPDATES & ACTIVITY LOGS */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-base-accent" />
                <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">
                  Section D — Personnel Updates & Activity Logs
                </h3>
              </div>
              <div className="flex gap-2">
                <button onClick={collapseAll} className="px-2.5 py-1 text-[10px] uppercase font-condensed font-extrabold border border-base-border hover:bg-base-surface3 rounded-lg text-base-muted2 cursor-pointer flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" /> Collapse All
                </button>
                <button onClick={expandAll} className="px-2.5 py-1 text-[10px] uppercase font-condensed font-extrabold border border-base-border hover:bg-base-surface3 rounded-lg text-base-muted2 cursor-pointer flex items-center gap-1">
                  <ArrowDown className="h-3 w-3" /> Expand All
                </button>
              </div>
            </div>

            {Object.entries(userGroups).map(([uid, ug]) => {
              const init = ug.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const isColl = !!userCollapsed[uid];
              const impact = getUserImpact(uid, ug.entries);

              return (
                <div key={uid} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
                  {/* Collapsible item leader bar */}
                  <div
                    onClick={() => toggleUserCollapse(uid)}
                    className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-base-surface3/40"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 text-base-muted transition-transform ${isColl ? '-rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <div className="h-7 w-7 rounded-full bg-base-accent-dim text-base-accent flex items-center justify-center font-condensed font-extrabold text-[11px]">
                        {init}
                      </div>
                      <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">{ug.name}</span>
                      <span className="text-[10px] text-base-muted uppercase font-bold">{ug.role}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-base-muted mr-1">{ug.entries.length} log{ug.entries.length !== 1 ? 's' : ''}</span>
                      {impact.portfolioImpact > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] uppercase font-black tracking-wide">
                          Portfolio Impact: +{impact.portfolioImpact}%
                        </span>
                      ) : impact.portfolioImpact < 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] uppercase font-black tracking-wide">
                          Portfolio Impact: {impact.portfolioImpact}%
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* List expanded rows */}
                  {!isColl && (
                    <div className="divide-y divide-base-border/30">
                      {/* Detailed user impact panel if they generated progress */}
                      {Object.keys(impact.projectImpacts).length > 0 && (
                        <div className="bg-base-surface2/40 border-b border-base-border/45 p-4 space-y-2.5">
                          <div className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-base-accent" />
                            <span>Progress Impact Generated Today</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(impact.projectImpacts).map(([pid, pInfo]) => (
                              <div key={pid} className="bg-base-surface border border-base-border/50 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <div className="font-bold text-base-text truncate" title={pInfo.projectName}>
                                    {pInfo.projectName}
                                  </div>
                                  <div className="text-[10px] text-base-muted2 font-mono flex items-center gap-1">
                                    <span>{pInfo.beforePct}%</span>
                                    <span>➔</span>
                                    <span className="text-base-text font-bold">{pInfo.afterPct}%</span>
                                  </div>
                                </div>
                                <div className={`font-condensed font-extrabold text-sm px-2 py-1 rounded shrink-0 ${
                                  pInfo.delta > 0 ? 'bg-base-green-dim text-base-green' : 'bg-base-red-dim text-base-red'
                                }}`}>
                                  {pInfo.delta > 0 ? `+${pInfo.delta}` : pInfo.delta}%
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ug.entries.map(e => {
                        const meta = ACT_ICONS[e.type] || { label: 'Audit Log', color: 'var(--muted)', bg: 'rgba(0,0,0,.05)' };
                        const delta = (e.newPct || 0) - (e.oldPct || 0);

                        return (
                          <div key={e.id} className="p-3.5 sm:px-5 flex items-start gap-3 hover:bg-base-surface2/10 transition-colors">
                            <span className="text-[11px] font-condensed font-semibold text-base-muted w-14 pt-0.5">{e.time}</span>
                            <div className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg }}>
                              <svg viewBox="0 0 24 24" className="h-3 w-3" style={{ stroke: meta.color }} fill="none" strokeWidth="3" strokeLinecap="round">
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            </div>
                            <div className="flex-1 text-xs text-base-muted2 leading-relaxed">
                              <span className="font-bold text-base-text">{e.action}</span>
                              {e.taskName && (
                                <span className="font-medium text-base-text">: "{e.taskName}"</span>
                              )}
                              {e.assemblyName && (
                                <span> in <em>{e.assemblyName}</em></span>
                              )}
                              {e.projectName && (
                                <span className="block text-base-accent font-condensed font-bold uppercase tracking-wider text-[11px] mt-0.5">{e.projectName}</span>
                              )}
                              {e.detail && (
                                <span className="block text-base-muted mt-1 bg-base-surface2/50 border border-base-border/50 rounded-sm p-2 ml-1 italic font-medium">"{e.detail}"</span>
                              )}
                            </div>

                            {/* Render delta pills for progress edits */}
                            {(e.type === 'task_progress' || e.type === 'task_toggle') && delta !== 0 && (
                              <span className={`px-2 py-0.5 rounded font-condensed font-extrabold text-[10px] flex items-center gap-0.5 select-none ${
                                delta > 0 ? 'bg-base-green-dim text-base-green' : 'bg-base-red-dim text-base-red'
                              }`}>
                                {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SECTION E — QUALITY CONTROL & NDT INSPECTIONS */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-base-accent" />
                <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">
                  Section E — Quality Control & NDT Inspections
                </h3>
              </div>
              <span className="text-[10px] bg-base-accent-dim/10 text-base-accent px-2 py-0.5 rounded font-bold font-mono">
                {inspections.filter(ins => ins.requestedDate === reportDate || ins.inspectedDate === reportDate || ins.targetDate === reportDate).length} RFI(s)
              </span>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-base-muted leading-relaxed">
                Quality inspections, NDT verifications, fit-up, and dimensional checks requested or performed on this date.
              </p>
              
              {(() => {
                const dayInspections = inspections.filter(ins => 
                  ins.requestedDate === reportDate || 
                  ins.inspectedDate === reportDate || 
                  ins.targetDate === reportDate
                );

                if (dayInspections.length === 0) {
                  return (
                    <div className="text-center py-6 text-xs text-base-muted italic">
                      No quality inspections or RFIs recorded for this date.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dayInspections.map(ins => {
                      let statusColor = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
                      if (ins.status === 'Approved') statusColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                      else if (ins.status === 'Requested') statusColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                      else if (ins.status === 'Rejected / Punchlist') statusColor = "bg-red-500/10 text-red-500 border-red-500/20";

                      return (
                        <div key={ins.id} className="border border-base-border/50 rounded-lg p-3 bg-base-surface2/30 space-y-2 text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-[10px] font-mono font-bold text-base-accent uppercase tracking-wider">{ins.rfiNo || 'NO RFI NO'}</span>
                              <h4 className="font-bold text-base-text mt-0.5">{ins.projectName}</h4>
                              {ins.assemblyName && <p className="text-[10px] text-base-muted">Assembly: {ins.assemblyName}</p>}
                            </div>
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${statusColor}`}>
                              {ins.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-base-border/30 text-[10px]">
                            <div>
                              <span className="text-base-muted block uppercase font-condensed font-bold tracking-wider">Type</span>
                              <span className="text-base-text font-semibold">{ins.inspectionType}</span>
                            </div>
                            <div>
                              <span className="text-base-muted block uppercase font-condensed font-bold tracking-wider">Target Date</span>
                              <span className="text-base-text font-mono">{ins.targetDate || '—'}</span>
                            </div>
                          </div>

                          {ins.comments && (
                            <div className="bg-base-surface border border-base-border/40 rounded p-1.5 text-[10px] italic text-base-muted mt-1">
                              "{ins.comments}"
                            </div>
                          )}
                          {ins.punchList && ins.status === 'Rejected / Punchlist' && (
                            <div className="bg-red-500/5 border border-red-500/10 text-red-400 rounded p-1.5 text-[10px] mt-1">
                              <strong>Punch List:</strong> {ins.punchList}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* SECTION F — SAFETY, MATERIALS & FACILITY ISSUES */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-base-accent" />
                <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">
                  Section F — Safety, Materials & Facility Issues
                </h3>
              </div>
              <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded font-bold font-mono">
                {problemReports.filter(prob => prob.date === reportDate || (prob.resolvedAt && prob.resolvedAt.slice(0, 10) === reportDate)).length} Alert(s)
              </span>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-base-muted leading-relaxed">
                Unplanned incidents, material shortages, drawing errors, or safety observations recorded today.
              </p>
              
              {(() => {
                const dayProblems = problemReports.filter(prob => 
                  prob.date === reportDate || 
                  (prob.resolvedAt && prob.resolvedAt.slice(0, 10) === reportDate)
                );

                if (dayProblems.length === 0) {
                  return (
                    <div className="text-center py-6 text-xs text-base-muted italic">
                      No safety, material, or facility issues reported on this date.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dayProblems.map(prob => {
                      const isResolved = prob.status === 'Resolved';
                      const catColors: Record<string, string> = {
                        'Facility Issue': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                        'Drawing Issue': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                        'Safety Issue': 'bg-red-500/10 text-red-500 border-red-500/20',
                        'Material Issue': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
                        'Equipment Issue': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                        'Other': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      };
                      const badgeColor = catColors[prob.category] || catColors['Other'];

                      return (
                        <div key={prob.id} className="border border-base-border/50 rounded-lg p-3 bg-base-surface2/30 space-y-2 text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}>
                              {prob.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              isResolved 
                                ? 'bg-emerald-500/10 text-emerald-500' 
                                : 'bg-red-500/10 text-red-500 animate-pulse'
                            }`}>
                              {isResolved ? '✓ Resolved' : '● Open'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {prob.projectName && (
                              <div className="text-[10px] text-base-accent font-bold uppercase font-condensed tracking-wider">
                                {prob.projectName}
                              </div>
                            )}
                            <p className="text-base-text leading-relaxed">{prob.description}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-base-border/30 text-[10px]">
                            <div>
                              <span className="text-base-muted block uppercase font-condensed font-bold tracking-wider">Reported By</span>
                              <span className="text-base-text font-semibold">{prob.reportedBy}</span>
                            </div>
                            <div>
                              <span className="text-base-muted block uppercase font-condensed font-bold tracking-wider">Assigned to</span>
                              <span className="text-base-text font-mono">{prob.assignedPosition || '—'}</span>
                            </div>
                          </div>

                          {isResolved && prob.resolutionNote && (
                            <div className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded p-1.5 text-[10px] mt-2">
                              <strong>Resolution Note:</strong> {prob.resolutionNote}
                              {prob.resolvedBy && <span className="block text-[9px] text-base-muted2 mt-0.5">Resolved by: {prob.resolvedBy}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
