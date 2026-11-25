import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
  Filter,
  Zap,
  TrendingUp,
  Target,
  Activity,
  Search,
  Info,
  Plus,
  ChevronsUpDown,
  X
} from 'lucide-react';
import { normalizePosition, CRAFT_COLORS } from '../utils/manpowerUtils';
import { TimesheetEntry, Employee, Project, User } from '../types/index';
import { useAppStore } from '../store';
import { can } from '../utils/permissions';
import { calcPct, fmtHrs } from '../utils/projectUtils';
import { findProjectForTimesheet, matchesProjectEntry } from '../utils/timesheetHelpers';

interface ManpowerBoardViewProps {
  timesheets?: TimesheetEntry[];
  employees?: Employee[];
  projects?: Project[];
  initialDate?: string;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  currentUser?: User | null;
  onNavigateToTimesheet?: (date?: string) => void;
  openAddTimesheet?: () => void;
  openAddTimesheetForEmployee?: (empId: string) => void;
}

export default function ManpowerBoardView({
  timesheets: propTimesheets,
  employees: propEmployees,
  projects: propProjects,
  initialDate,
  selectedDate: controlledDate,
  onDateChange,
  currentUser: propUser,
  onNavigateToTimesheet,
  openAddTimesheet,
  openAddTimesheetForEmployee
}: ManpowerBoardViewProps) {
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeProjects = useAppStore((s) => s.projects);
  const storeCurrentUser = useAppStore((s) => s.currentUser);

  const timesheets = propTimesheets?.length ? propTimesheets : storeTimesheets;
  const employees = propEmployees?.length ? propEmployees : storeEmployees;
  const projects = propProjects?.length ? propProjects : storeProjects;
  const currentUser = propUser || storeCurrentUser;
  const canManageTimesheet = can(currentUser, 'manageTimesheet');

  const [internalDate, setInternalDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const selectedDate = controlledDate ?? internalDate;
  const setSelectedDate = (nextDate: string) => {
    if (onDateChange) onDateChange(nextDate);
    else setInternalDate(nextDate);
  };

  const [activeSubTab, setActiveSubTab] = useState<'allocations' | 'available' | 'output'>('allocations');
  const [selectedCraft, setSelectedCraft] = useState<string>('All');
  const [boardSearchQuery, setBoardSearchQuery] = useState<string>('');
  const [expandAllSignal, setExpandAllSignal] = useState<{ expanded: boolean; version: number }>({
    expanded: false,
    version: 0
  });

  // Time range & filters for Daily Output analytics module
  const [outputTimeRange, setOutputTimeRange] = useState<'selected_date' | '7_days' | '30_days' | 'this_month' | 'all_time'>('7_days');
  const [outputSearchQuery, setOutputSearchQuery] = useState('');
  const [outputSortBy, setOutputSortBy] = useState<'output' | 'hours' | 'days' | 'name'>('output');

  const shiftDay = (d: number) => {
    const dt = new Date(selectedDate + 'T00:00:00');
    dt.setDate(dt.getDate() + d);
    setSelectedDate(dt.toISOString().slice(0, 10));
  };

  // Generate craft options dynamically
  const craftOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.position) {
        set.add(normalizePosition(e.position));
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [employees]);

  // Compute Board Data (Assigned to Projects)
  const boardData = useMemo(() => {
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Filter: only this date, only present/late (on-site)
    const dayEntries = timesheets.filter(t => {
      const isDateAndOnsite = t.date === selectedDate && (t.status === 'present' || t.status === 'late');
      if (!isDateAndOnsite) return false;
      if (selectedCraft === 'All') return true;
      const emp = empMap.get(t.empId);
      const craft = normalizePosition(emp?.position || t.position);
      return craft === selectedCraft;
    });

    // Group by workOrder
    const projectMap = new Map<string, {
      project: Project | null;
      crafts: Map<string, {
        workers: { empId: string; empName: string; hours: number; status: string }[];
      }>;
      workerIds: Set<string>;
      totalWorkers: number;
      totalHours: number;
    }>();

    dayEntries.forEach(t => {
      const wo = (t.workOrder && t.workOrder.trim() ? t.workOrder.trim() : 'Unassigned');
      const emp = empMap.get(t.empId);
      const craft = normalizePosition(emp?.position || t.position);
      const project = findProjectForTimesheet(t, projects);

      if (!projectMap.has(wo)) {
        projectMap.set(wo, {
          project,
          crafts: new Map(),
          workerIds: new Set(),
          totalWorkers: 0,
          totalHours: 0,
        });
      }

      const pg = projectMap.get(wo)!;
      if (!pg.project && project) pg.project = project;

      if (!pg.crafts.has(craft)) {
        pg.crafts.set(craft, { workers: [] });
      }

      const cg = pg.crafts.get(craft)!;
      const entryHrs = t.totalHours || 0;
      const existingWorker = cg.workers.find(w => w.empId === t.empId);
      if (existingWorker) {
        // Accumulate split log hours for the same employee on this project/craft
        existingWorker.hours = Math.round((existingWorker.hours + entryHrs) * 10) / 10;
        if (t.status === 'late') existingWorker.status = 'late';
      } else {
        cg.workers.push({
          empId: t.empId,
          empName: t.empName,
          hours: entryHrs,
          status: t.status,
        });
      }

      if (!pg.workerIds.has(t.empId)) {
        pg.workerIds.add(t.empId);
        pg.totalWorkers++;
      }
      pg.totalHours = Math.round((pg.totalHours + entryHrs) * 10) / 10;
    });

    return Array.from(projectMap.entries())
      .map(([wo, data]) => ({
        workOrder: wo,
        project: data.project,
        crafts: Array.from(data.crafts.entries())
          .map(([craft, { workers }]) => ({
            craft,
            workers: workers.sort((a, b) => b.hours - a.hours),
            count: workers.length,
            totalHours: Math.round(workers.reduce((s, w) => s + w.hours, 0) * 10) / 10,
            color: CRAFT_COLORS[craft] || CRAFT_COLORS.Other,
          }))
          .sort((a, b) => b.count - a.count),
        totalWorkers: data.totalWorkers,
        totalHours: data.totalHours,
      }))
      .sort((a, b) => b.totalWorkers - a.totalWorkers);
  }, [timesheets, employees, projects, selectedDate, selectedCraft]);

  // Compute Available / Unassigned Labor Data
  const availableLaborData = useMemo(() => {
    const empMap = new Map(employees.map(e => [e.id, e]));
    const activeEmployees = employees.filter(e => !e.isExEmployee);

    const dayEntries = timesheets.filter(t => t.date === selectedDate);
    const loggedEmpIds = new Set(dayEntries.map(t => t.empId));

    // 1. On-site but Unassigned (deduplicated per employee with summed hours)
    const unassignedByEmp = new Map<string, {
      empId: string;
      empName: string;
      status: string;
      hours: number;
      position: string;
      craft: string;
    }>();

    dayEntries
      .filter(t =>
        (t.status === 'present' || t.status === 'late') &&
        (!t.workOrder || t.workOrder.trim() === '' || t.workOrder.trim().toLowerCase() === 'unassigned')
      )
      .forEach(t => {
        const emp = empMap.get(t.empId);
        const position = emp?.position || t.position || 'Other';
        const craft = normalizePosition(position);
        if (selectedCraft !== 'All' && craft !== selectedCraft) return;
        const prev = unassignedByEmp.get(t.empId);
        if (prev) {
          prev.hours = Math.round((prev.hours + (t.totalHours || 0)) * 10) / 10;
        } else {
          unassignedByEmp.set(t.empId, {
            empId: t.empId,
            empName: t.empName,
            status: t.status,
            hours: t.totalHours || 0,
            position,
            craft
          });
        }
      });

    const onSiteUnassigned = Array.from(unassignedByEmp.values());

    // 2. Off-site / Not Logged Today (only active non-ex employees)
    const unlogged = activeEmployees
      .filter(e => !loggedEmpIds.has(e.id))
      .map(e => ({
        empId: e.id,
        empName: e.name,
        status: 'unlogged',
        hours: 0,
        position: e.position || 'Other',
        craft: normalizePosition(e.position)
      }))
      .filter(w => selectedCraft === 'All' || w.craft === selectedCraft);

    const groupMap = new Map<string, {
      craft: string;
      color: string;
      onSiteUnassigned: typeof onSiteUnassigned;
      unlogged: typeof unlogged;
    }>();

    const getGroup = (craft: string) => {
      if (!groupMap.has(craft)) {
        groupMap.set(craft, {
          craft,
          color: CRAFT_COLORS[craft] || CRAFT_COLORS.Other,
          onSiteUnassigned: [],
          unlogged: []
        });
      }
      return groupMap.get(craft)!;
    };

    onSiteUnassigned.forEach(worker => {
      getGroup(worker.craft).onSiteUnassigned.push(worker);
    });

    unlogged.forEach(worker => {
      getGroup(worker.craft).unlogged.push(worker);
    });

    return Array.from(groupMap.values())
      .map(g => ({
        ...g,
        totalAvailable: g.onSiteUnassigned.length + g.unlogged.length
      }))
      .filter(g => g.totalAvailable > 0)
      .sort((a, b) => b.totalAvailable - a.totalAvailable);
  }, [timesheets, employees, selectedDate, selectedCraft]);

  // Filtered views via top board search query
  const filteredBoardData = useMemo(() => {
    const q = boardSearchQuery.trim().toLowerCase();
    if (!q) return boardData;
    return boardData.filter(pd => {
      const matchProj =
        pd.workOrder.toLowerCase().includes(q) ||
        (pd.project?.name || '').toLowerCase().includes(q) ||
        (pd.project?.gaNumber || '').toLowerCase().includes(q);
      if (matchProj) return true;
      return pd.crafts.some(
        c =>
          c.craft.toLowerCase().includes(q) ||
          c.workers.some(w => w.empName.toLowerCase().includes(q))
      );
    });
  }, [boardData, boardSearchQuery]);

  const filteredAvailableLaborData = useMemo(() => {
    const q = boardSearchQuery.trim().toLowerCase();
    if (!q) return availableLaborData;
    return availableLaborData
      .map(cg => {
        if (cg.craft.toLowerCase().includes(q)) return cg;
        const onSite = cg.onSiteUnassigned.filter(
          w => w.empName.toLowerCase().includes(q) || w.position.toLowerCase().includes(q)
        );
        const unlogged = cg.unlogged.filter(
          w => w.empName.toLowerCase().includes(q) || w.position.toLowerCase().includes(q)
        );
        return {
          ...cg,
          onSiteUnassigned: onSite,
          unlogged,
          totalAvailable: onSite.length + unlogged.length
        };
      })
      .filter(cg => cg.totalAvailable > 0);
  }, [availableLaborData, boardSearchQuery]);

  // Summary totals (deduplicated unique worker headcount across split WOs)
  const summary = useMemo(() => {
    const uniqueOnSiteWorkers = new Set<string>();
    const craftWorkerSets = new Map<string, Set<string>>();
    let totalHours = 0;

    boardData.forEach(p => {
      totalHours += p.totalHours;
      p.crafts.forEach(c => {
        if (!craftWorkerSets.has(c.craft)) craftWorkerSets.set(c.craft, new Set());
        const set = craftWorkerSets.get(c.craft)!;
        c.workers.forEach(w => {
          uniqueOnSiteWorkers.add(w.empId);
          set.add(w.empId);
        });
      });
    });

    const craftTotals = new Map<string, number>();
    craftWorkerSets.forEach((set, craft) => {
      craftTotals.set(craft, set.size);
    });

    const activeEmployees = employees.filter(e => !e.isExEmployee);
    const relevantEmployees =
      selectedCraft !== 'All'
        ? activeEmployees.filter(e => normalizePosition(e.position) === selectedCraft)
        : activeEmployees;

    const totalCapacity = relevantEmployees.length * 8;
    const roundedHours = Math.round(totalHours * 10) / 10;
    const utilizationPct = totalCapacity > 0 ? (roundedHours / totalCapacity) * 100 : 0;

    return {
      totalOnSite: uniqueOnSiteWorkers.size,
      totalHours: roundedHours,
      craftTotals,
      totalCapacity,
      utilizationPct
    };
  }, [boardData, employees, selectedCraft]);

  // Available labor totals
  const availableSummary = useMemo(() => {
    const onSiteUnassignedCount = availableLaborData.reduce((s, c) => s + c.onSiteUnassigned.length, 0);
    const unloggedCount = availableLaborData.reduce((s, c) => s + c.unlogged.length, 0);
    return { onSiteUnassignedCount, unloggedCount, total: onSiteUnassignedCount + unloggedCount };
  }, [availableLaborData]);

  // Compute Daily Output per Employee analytics
  const outputAnalyticsData = useMemo(() => {
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Determine date range boundaries based on outputTimeRange
    let startDateStr = selectedDate;
    let endDateStr = selectedDate;

    if (outputTimeRange === '7_days') {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 6);
      startDateStr = d.toISOString().slice(0, 10);
    } else if (outputTimeRange === '30_days') {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 29);
      startDateStr = d.toISOString().slice(0, 10);
    } else if (outputTimeRange === 'this_month') {
      startDateStr = selectedDate.slice(0, 7) + '-01';
      const year = parseInt(selectedDate.slice(0, 4), 10);
      const month = parseInt(selectedDate.slice(5, 7), 10);
      const lastDay = new Date(year, month, 0).getDate();
      endDateStr = `${selectedDate.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
    } else if (outputTimeRange === 'all_time') {
      startDateStr = '2000-01-01';
      endDateStr = '2099-12-31';
    }

    // Filter timesheets in date range and present/late
    const rangeTimesheets = timesheets.filter(t => {
      const isDateInRange = t.date >= startDateStr && t.date <= endDateStr;
      const isPresent = t.status === 'present' || t.status === 'late';
      if (!isDateInRange || !isPresent) return false;

      if (selectedCraft === 'All') return true;
      const emp = empMap.get(t.empId);
      const craft = normalizePosition(emp?.position);
      return craft === selectedCraft;
    });

    // Build map of project progress and total manhours in range
    const projectProgressMap = new Map<string, { project: Project; pct: number; totalHoursInRange: number }>();
    projects.forEach(p => {
      projectProgressMap.set(p.id, {
        project: p,
        pct: calcPct(p),
        totalHoursInRange: 0,
      });
    });

    // Compute total hours per project in range
    rangeTimesheets.forEach(t => {
      const matched = findProjectForTimesheet(t, projects);
      if (matched && projectProgressMap.has(matched.id)) {
        projectProgressMap.get(matched.id)!.totalHoursInRange += t.totalHours || 0;
      }
    });

    // Group timesheets by employee
    const empStatsMap = new Map<string, {
      empId: string;
      empName: string;
      position: string;
      craft: string;
      datesSet: Set<string>;
      totalHours: number;
      projectHoursMap: Map<string, number>;
    }>();

    rangeTimesheets.forEach(t => {
      const emp = empMap.get(t.empId);
      const empName = t.empName || emp?.name || 'Unknown Worker';
      const position = emp?.position || t.position || 'Other';
      const craft = normalizePosition(position);

      if (!empStatsMap.has(t.empId)) {
        empStatsMap.set(t.empId, {
          empId: t.empId,
          empName,
          position,
          craft,
          datesSet: new Set(),
          totalHours: 0,
          projectHoursMap: new Map(),
        });
      }

      const item = empStatsMap.get(t.empId)!;
      item.datesSet.add(t.date);
      item.totalHours += t.totalHours || 0;

      const wo = (t.workOrder || '').trim();
      if (wo) {
        item.projectHoursMap.set(wo, (item.projectHoursMap.get(wo) || 0) + (t.totalHours || 0));
      }
    });

    // Calculate per-employee progress output contribution and daily output rate
    let overallTotalProgressContrib = 0;
    let overallTotalDaysWorked = 0;
    let overallTotalHoursLogged = 0;

    const employeeRows = Array.from(empStatsMap.values()).map(e => {
      const daysWorked = e.datesSet.size;
      const avgDailyHours = daysWorked > 0 ? e.totalHours / daysWorked : 0;

      // Calculate progress contribution
      let progressContrib = 0;
      const assignedProjects: { workOrder: string; hours: number; projPct: number }[] = [];

      e.projectHoursMap.forEach((hrs, wo) => {
        const matchedProj = projects.find(
          p =>
            (p.client || '').trim().toLowerCase() === wo.toLowerCase() ||
            (p.gaNumber || '').trim().toLowerCase() === wo.toLowerCase() ||
            (p.name || '').trim().toLowerCase() === wo.toLowerCase()
        );
        const pData = matchedProj ? projectProgressMap.get(matchedProj.id) : undefined;
        const projPct = pData ? pData.pct : 0;
        assignedProjects.push({ workOrder: wo, hours: hrs, projPct });

        if (pData && pData.totalHoursInRange > 0) {
          progressContrib += (hrs / pData.totalHoursInRange) * projPct;
        } else if (pData) {
          progressContrib += (hrs / Math.max(1, e.totalHours)) * projPct;
        }
      });

      const dailyOutputRate = daysWorked > 0 ? progressContrib / daysWorked : 0;

      overallTotalProgressContrib += progressContrib;
      overallTotalDaysWorked += daysWorked;
      overallTotalHoursLogged += e.totalHours;

      // Status badge
      let performanceStatus: 'high' | 'normal' | 'developing' = 'normal';
      if (dailyOutputRate >= 3.0) performanceStatus = 'high';
      else if (dailyOutputRate < 1.0) performanceStatus = 'developing';

      return {
        ...e,
        daysWorked,
        avgDailyHours,
        progressContrib,
        dailyOutputRate,
        assignedProjects,
        performanceStatus,
      };
    });

    // Sort employee rows
    employeeRows.sort((a, b) => {
      if (outputSortBy === 'output') return b.dailyOutputRate - a.dailyOutputRate;
      if (outputSortBy === 'hours') return b.totalHours - a.totalHours;
      if (outputSortBy === 'days') return b.daysWorked - a.daysWorked;
      return a.empName.localeCompare(b.empName);
    });

    // Calculate Craft-level breakdown
    const craftMap = new Map<string, {
      craft: string;
      color: string;
      workerCount: number;
      totalDays: number;
      totalHours: number;
      totalProgressContrib: number;
    }>();

    employeeRows.forEach(e => {
      if (!craftMap.has(e.craft)) {
        craftMap.set(e.craft, {
          craft: e.craft,
          color: CRAFT_COLORS[e.craft] || CRAFT_COLORS.Other,
          workerCount: 0,
          totalDays: 0,
          totalHours: 0,
          totalProgressContrib: 0,
        });
      }
      const cg = craftMap.get(e.craft)!;
      cg.workerCount += 1;
      cg.totalDays += e.daysWorked;
      cg.totalHours += e.totalHours;
      cg.totalProgressContrib += e.progressContrib;
    });

    const craftBreakdown = Array.from(craftMap.values()).map(cg => {
      const avgDailyHours = cg.totalDays > 0 ? cg.totalHours / cg.totalDays : 0;
      const avgDailyOutput = cg.totalDays > 0 ? cg.totalProgressContrib / cg.totalDays : 0;
      return {
        ...cg,
        avgDailyHours,
        avgDailyOutput,
      };
    }).sort((a, b) => b.avgDailyOutput - a.avgDailyOutput);

    // Calculate Project-level breakdown
    const projectBreakdown = Array.from(projectProgressMap.values())
      .filter((data) => data.totalHoursInRange > 0)
      .map((data) => {
        const projectTs = rangeTimesheets.filter(t => matchesProjectEntry(t, data.project));
        const uniqueWorkers = new Set(projectTs.map(t => t.empId)).size;
        const uniqueEmpDays = new Set(projectTs.map(t => `${t.empId}_${t.date}`)).size;
        const dailyProgressRate = uniqueEmpDays > 0 ? data.pct / uniqueEmpDays : 0;

        return {
          workOrder: data.project.client || data.project.gaNumber || data.project.name,
          projectName: data.project.name || data.project.client || data.project.gaNumber || 'Project',
          projectPct: data.pct,
          status: data.project.status || 'active',
          totalHours: Math.round(data.totalHoursInRange * 10) / 10,
          workerCount: uniqueWorkers,
          empDaysWorked: uniqueEmpDays,
          dailyProgressRate,
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);

    // Summary Totals
    const activeWorkersCount = employeeRows.length;
    const avgDailyOutputOverall = overallTotalDaysWorked > 0 ? overallTotalProgressContrib / overallTotalDaysWorked : 0;
    const avgDailyHoursOverall = overallTotalDaysWorked > 0 ? overallTotalHoursLogged / overallTotalDaysWorked : 0;
    const outputEfficiencyIndex = overallTotalHoursLogged > 0 ? (overallTotalProgressContrib / (overallTotalHoursLogged / 100)) : 0;

    return {
      startDateStr,
      endDateStr,
      rangeTimesheetsCount: rangeTimesheets.length,
      activeWorkersCount,
      overallTotalDaysWorked,
      overallTotalHoursLogged,
      avgDailyOutputOverall,
      avgDailyHoursOverall,
      outputEfficiencyIndex,
      employeeRows,
      craftBreakdown,
      projectBreakdown,
    };
  }, [timesheets, employees, projects, selectedDate, selectedCraft, outputTimeRange, outputSortBy]);

  return (
    <div className="flex-1 flex flex-col bg-base-surface animate-fade-in" id="manpower-board-view">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 border-b border-base-border bg-base-surface gap-4">
        <div>
          <h1 className="font-condensed font-extrabold text-xl uppercase tracking-wider text-base-text">
            Manpower Board
          </h1>
          <p className="text-xs text-base-muted mt-0.5">Daily workforce allocation & labor availability tracker</p>
        </div>

        {/* Controls: Craft Filter & Date Navigator */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Craft Filter */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-base-surface2 border border-base-border rounded-lg">
            <Filter className="h-3.5 w-3.5 text-base-muted" />
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Craft:</span>
            <select
              value={selectedCraft}
              onChange={e => setSelectedCraft(e.target.value)}
              className="text-xs font-condensed font-bold text-base-text bg-transparent outline-none cursor-pointer border-none p-0 pr-1 focus:ring-0 focus:outline-none"
            >
              {craftOptions.map(c => (
                <option key={c} value={c} className="bg-base-surface text-base-text font-sans">
                  {c === 'All' ? 'All Crafts' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDay(-1)}
              className="w-8 h-8 rounded-lg border border-base-border flex items-center
                         justify-center text-base-muted hover:text-base-text
                         hover:bg-base-surface2 cursor-pointer transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-base-surface2
                            border border-base-border rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-base-muted" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-sm font-condensed font-bold text-base-text
                           bg-transparent outline-none cursor-pointer border-none p-0"
              />
              {selectedDate === new Date().toISOString().slice(0, 10) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-base-green-dim
                                 text-base-green font-condensed font-black uppercase">
                  TODAY
                </span>
              )}
            </div>

            <button
              onClick={() => shiftDay(1)}
              className="w-8 h-8 rounded-lg border border-base-border flex items-center
                         justify-center text-base-muted hover:text-base-text
                         hover:bg-base-surface2 cursor-pointer transition-colors"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
              className="px-3 h-8 rounded-lg border border-base-border text-[10px]
                         font-condensed font-bold uppercase text-base-muted
                         hover:text-base-text cursor-pointer transition-colors"
            >
              Today
            </button>

            {onNavigateToTimesheet && (
              <button
                onClick={() => onNavigateToTimesheet(selectedDate)}
                className="px-3 h-8 rounded-lg bg-base-surface2 hover:bg-base-surface3 border border-base-border hover:border-base-accent/50 text-base-text text-xs font-condensed font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ml-1 whitespace-nowrap shrink-0"
                title="Open Daily Timesheet Log Sheet for this date"
              >
                <Clock className="h-3.5 w-3.5 text-base-accent" />
                <span className="hidden sm:inline">Timesheet Log</span>
              </button>
            )}

            {canManageTimesheet && openAddTimesheet && (
              <button
                type="button"
                onClick={() => openAddTimesheet()}
                className="px-3 h-8 rounded-lg bg-base-accent hover:bg-base-accent2 text-white text-xs font-condensed font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                title="Input timesheet harian langsung dari Manpower Board"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Input Timesheet</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Sub-Tabs & Board Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-base-border bg-base-surface px-6 gap-2">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('allocations')}
            className={`px-4 py-2.5 text-xs font-condensed font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'allocations'
                ? 'border-base-accent text-base-accent'
                : 'border-transparent text-base-muted hover:text-base-text'
            }`}
          >
            Project Allocations ({filteredBoardData.length})
          </button>
          <button
            onClick={() => setActiveSubTab('available')}
            className={`px-4 py-2.5 text-xs font-condensed font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'available'
                ? 'border-base-accent text-base-accent'
                : 'border-transparent text-base-muted hover:text-base-text'
            }`}
          >
            Available Labor ({availableSummary.total})
          </button>
          <button
            onClick={() => setActiveSubTab('output')}
            className={`px-4 py-2.5 text-xs font-condensed font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'output'
                ? 'border-base-accent text-base-accent'
                : 'border-transparent text-base-muted hover:text-base-text'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-base-accent" />
            Daily Output & Productivity
          </button>
        </div>

        {(activeSubTab === 'allocations' || activeSubTab === 'available') && (
          <div className="flex items-center gap-2 py-1.5">
            <div className="relative flex-1 md:w-60">
              <Search className="h-3.5 w-3.5 text-base-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={boardSearchQuery}
                onChange={(e) => setBoardSearchQuery(e.target.value)}
                placeholder="Cari proyek, WO, atau pekerja..."
                className="w-full pl-8 pr-7 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent"
              />
              {boardSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBoardSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-base-muted hover:text-base-text cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setExpandAllSignal(prev => ({ expanded: !prev.expanded, version: prev.version + 1 }))
              }
              className="px-2.5 py-1.5 rounded-lg bg-base-surface2 hover:bg-base-surface3 border border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              title="Buka atau tutup semua nama pekerja di kartu"
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-base-muted" />
              <span>{expandAllSignal.expanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'allocations' && (
        <>
          {/* Summary strip */}
          <div className="flex items-center gap-6 px-6 py-3 bg-base-surface2 border-b border-base-border flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-base-muted" />
              <span className="text-sm font-condensed font-bold text-base-text tabular-nums">
                {summary.totalOnSite}
              </span>
              <span className="text-xs text-base-muted">{selectedCraft !== 'All' ? `${selectedCraft}s` : 'workers'} on site</span>
            </div>
            <div className="w-px h-4 bg-base-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-base-muted" />
              <span className="text-sm font-condensed font-bold text-base-text tabular-nums">
                {summary.totalHours}h
              </span>
              <span className="text-xs text-base-muted">logged</span>
            </div>
            <div className="w-px h-4 bg-base-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-base-accent" />
              <span className="text-sm font-condensed font-bold text-base-text tabular-nums">
                {outputAnalyticsData.avgDailyOutputOverall.toFixed(1)}%
              </span>
              <span className="text-xs text-base-muted">avg daily output / emp</span>
            </div>
            <div className="w-px h-4 bg-base-border hidden sm:block" />

            {/* Workshop Utilization Progress */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-condensed font-bold uppercase text-base-muted leading-none">Workshop Utilization</span>
                <span className="text-sm font-condensed font-bold text-base-text leading-tight mt-0.5 tabular-nums">
                  {summary.utilizationPct.toFixed(1)}%
                </span>
              </div>
              <div className="w-24 h-2.5 bg-base-surface border border-base-border rounded-full overflow-hidden flex relative" title={`${summary.totalHours}h / ${summary.totalCapacity}h max`}>
                <div
                  className={`h-full transition-all duration-500 ${summary.utilizationPct >= 80 ? 'bg-base-green' : summary.utilizationPct >= 50 ? 'bg-base-accent' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, summary.utilizationPct)}%` }}
                />
              </div>
            </div>
            <div className="w-px h-4 bg-base-border hidden sm:block" />

            <div className="flex items-center gap-2 flex-wrap flex-1">
              {(Array.from(summary.craftTotals.entries()) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([craft, count]) => (
                  <span
                    key={craft}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5
                               rounded-full border border-base-border bg-base-surface"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: CRAFT_COLORS[craft] || CRAFT_COLORS.Other }}
                    />
                    <span className="font-condensed font-bold text-base-text tabular-nums">{count}</span>
                    <span className="text-base-muted">{craft}</span>
                  </span>
                ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[10px] text-base-muted">{filteredBoardData.length} projects active</span>
              {onNavigateToTimesheet && (
                <button
                  onClick={() => onNavigateToTimesheet(selectedDate)}
                  className="text-xs font-condensed font-bold uppercase text-base-accent hover:underline cursor-pointer flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Edit Timesheets</span>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          {filteredBoardData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20 animate-fade-in">
              <Users className="h-14 w-14 text-base-muted opacity-20" />
              <p className="font-condensed font-bold text-base-muted uppercase tracking-widest text-sm">
                No matching allocations found
              </p>
              <p className="text-xs text-base-muted">
                {boardSearchQuery
                  ? `Tidak ada pekerja/proyek cocok dengan "${boardSearchQuery}".`
                  : selectedCraft !== 'All'
                    ? `No ${selectedCraft}s are allocated on ${selectedDate}.`
                    : `No attendance logged for ${selectedDate}.`}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBoardData.map(pd => (
                  <ProjectAllocationCard
                    key={pd.workOrder}
                    data={pd as any}
                    expandAllSignal={expandAllSignal}
                    onWorkerClick={
                      canManageTimesheet && openAddTimesheetForEmployee
                        ? (empId) => openAddTimesheetForEmployee(empId)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeSubTab === 'available' && (
        <>
          {/* Available summary strip */}
          <div className="flex items-center gap-6 px-6 py-3 bg-base-surface2 border-b border-base-border flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-base-green animate-pulse" />
              <span className="text-sm font-condensed font-bold text-base-text tabular-nums">
                {availableSummary.onSiteUnassignedCount}
              </span>
              <span className="text-xs text-base-muted">On-Site & Unassigned</span>
            </div>
            <div className="w-px h-4 bg-base-border" />
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-base-muted" />
              <span className="text-sm font-condensed font-bold text-base-text tabular-nums">
                {availableSummary.unloggedCount}
              </span>
              <span className="text-xs text-base-muted">Not Logged / Off-Site</span>
            </div>
            <div className="ml-auto text-[10px] text-base-muted">
              {filteredAvailableLaborData.length} crafts represented
            </div>
          </div>

          {/* Available content area */}
          {filteredAvailableLaborData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20 animate-fade-in">
              <Users className="h-14 w-14 text-base-muted opacity-20" />
              <p className="font-condensed font-bold text-base-muted uppercase tracking-widest text-sm">
                No available labor identified
              </p>
              <p className="text-xs text-base-muted">
                {boardSearchQuery
                  ? `Tidak ada pekerja cocok dengan "${boardSearchQuery}".`
                  : selectedCraft !== 'All'
                    ? `All ${selectedCraft}s are allocated to projects on ${selectedDate}.`
                    : `All personnel are allocated to projects on ${selectedDate}.`}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAvailableLaborData.map(cg => (
                  <CraftAvailableCard
                    key={cg.craft}
                    craftGroup={cg as any}
                    expandAllSignal={expandAllSignal}
                    onLogWorker={
                      canManageTimesheet && (openAddTimesheetForEmployee || openAddTimesheet)
                        ? (empId) => {
                            if (openAddTimesheetForEmployee) openAddTimesheetForEmployee(empId);
                            else openAddTimesheet?.();
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeSubTab === 'output' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
          {/* Header Controls for Output View */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-surface2 border border-base-border p-4 rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-base-accent" />
                <h2 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text">
                  Average Daily Output Analytics
                </h2>
              </div>
              <p className="text-xs text-base-muted mt-0.5">
                Quantifying daily output rate per employee based on timesheet hours and project progress (%/day)
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Period:</span>
              <div className="flex items-center bg-base-surface border border-base-border rounded-lg p-1">
                {(
                  [
                    { id: 'selected_date', label: 'Single Day' },
                    { id: '7_days', label: 'Last 7 Days' },
                    { id: '30_days', label: 'Last 30 Days' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'all_time', label: 'All Time' },
                  ] as const
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => setOutputTimeRange(item.id)}
                    className={`px-2.5 py-1 rounded text-[10px] font-condensed font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      outputTimeRange === item.id
                        ? 'bg-base-accent text-white shadow-sm'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top 4 Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Avg Daily Output Rate */}
            <div className="bg-base-surface border border-base-border rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-base-border2 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Avg Daily Output / Emp
                </span>
                <div className="p-2 rounded-lg bg-base-accent/10 text-base-accent">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-condensed font-black text-base-text">
                  {outputAnalyticsData.avgDailyOutputOverall.toFixed(1)}% <span className="text-xs text-base-muted font-normal">/ emp-day</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-base-muted">Project progress yield</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-base-green-dim text-base-green font-condensed font-bold uppercase">
                    {outputAnalyticsData.avgDailyOutputOverall >= 2.5 ? 'High Output' : 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 2: Avg Daily Work Hours */}
            <div className="bg-base-surface border border-base-border rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-base-border2 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Avg Daily Shift Hours
                </span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-condensed font-black text-base-text">
                  {outputAnalyticsData.avgDailyHoursOverall.toFixed(1)}h <span className="text-xs text-base-muted font-normal">/ day</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-base-muted">Logged shift duration</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-base-surface2 text-base-text font-condensed font-bold uppercase">
                    Std 8.0h Shift
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 3: Total Workforce Input */}
            <div className="bg-base-surface border border-base-border rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-base-border2 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Workforce Days & Hours
                </span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-condensed font-black text-base-text">
                  {outputAnalyticsData.overallTotalDaysWorked} <span className="text-xs text-base-muted font-normal">Days</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-base-muted">{fmtHrs(outputAnalyticsData.overallTotalHoursLogged)}h total logged</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-condensed font-bold uppercase">
                    {outputAnalyticsData.activeWorkersCount} Active Workers
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 4: Output Efficiency Index */}
            <div className="bg-base-surface border border-base-border rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-base-border2 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Output Efficiency Index
                </span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-condensed font-black text-base-text">
                  {outputAnalyticsData.outputEfficiencyIndex.toFixed(1)}% <span className="text-xs text-base-muted font-normal">/ 100h</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-base-muted">Progress yield per 100 manhours</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-condensed font-bold uppercase">
                    Efficiency Rate
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Craft and Project Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card A: Craft Output Breakdown */}
            <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-base-border bg-base-surface2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-base-muted" />
                  <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">
                    Daily Output by Craft / Position
                  </h3>
                </div>
                <span className="text-[10px] font-condensed font-bold text-base-muted uppercase">
                  {outputAnalyticsData.craftBreakdown.length} Crafts
                </span>
              </div>
              <div className="p-4 space-y-3">
                {outputAnalyticsData.craftBreakdown.length === 0 ? (
                  <p className="text-xs text-base-muted py-6 text-center">No craft entries recorded in selected period.</p>
                ) : (
                  outputAnalyticsData.craftBreakdown.map(cg => (
                    <div key={cg.craft} className="bg-base-surface2/60 border border-base-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: cg.color }} />
                          <span className="font-condensed font-bold text-xs uppercase tracking-wide text-base-text">
                            {cg.craft}
                          </span>
                          <span className="text-[10px] text-base-muted font-mono">
                            ({cg.workerCount} workers · {cg.totalDays} man-days)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-condensed font-black text-sm text-base-text">
                            {cg.avgDailyOutput.toFixed(1)}% <span className="text-[9px] text-base-muted font-normal">/ day</span>
                          </span>
                        </div>
                      </div>
                      {/* Visual progress bar */}
                      <div className="w-full bg-base-surface3 h-1.5 rounded-full overflow-hidden flex">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (cg.avgDailyOutput / 5) * 100)}%`,
                            background: cg.color
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-base-muted mt-1 font-condensed">
                        <span>Avg Shift: {cg.avgDailyHours.toFixed(1)}h/day</span>
                        <span>Total Logged: {fmtHrs(cg.totalHours)}h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card B: Project Output Rate */}
            <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-base-border bg-base-surface2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-base-muted" />
                  <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">
                    Daily Progress Rate by Project
                  </h3>
                </div>
                <span className="text-[10px] font-condensed font-bold text-base-muted uppercase">
                  {outputAnalyticsData.projectBreakdown.length} Active Projects
                </span>
              </div>
              <div className="p-4 space-y-3">
                {outputAnalyticsData.projectBreakdown.length === 0 ? (
                  <p className="text-xs text-base-muted py-6 text-center">No active project entries recorded in selected period.</p>
                ) : (
                  outputAnalyticsData.projectBreakdown.map(pg => (
                    <div key={pg.workOrder} className="bg-base-surface2/60 border border-base-border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <div className="font-condensed font-bold text-xs uppercase text-base-text truncate">
                            {pg.projectName}
                          </div>
                          <div className="text-[10px] text-base-muted font-condensed">
                            WO: {pg.workOrder} · {pg.workerCount} workers ({pg.empDaysWorked} man-days)
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-condensed font-black text-sm text-base-text">
                            {pg.dailyProgressRate.toFixed(2)}% <span className="text-[9px] text-base-muted font-normal">/ man-day</span>
                          </div>
                          <div className="text-[9px] font-bold text-base-accent">
                            Progress: {pg.projectPct}%
                          </div>
                        </div>
                      </div>
                      {/* Visual progress bar */}
                      <div className="w-full bg-base-surface3 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-base-accent rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, pg.projectPct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-base-muted mt-1 font-condensed">
                        <span>Total Hours Logged: {fmtHrs(pg.totalHours)}h</span>
                        <span>
                          {pg.projectPct < 100 && pg.dailyProgressRate > 0
                            ? `~${Math.ceil((100 - pg.projectPct) / Math.max(0.1, pg.dailyProgressRate))} man-days to finish`
                            : pg.projectPct >= 100 ? 'Completed' : 'Pace calculating...'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Detailed Employee Daily Output Table */}
          <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden shadow-card">
            {/* Table Header & Controls */}
            <div className="p-4 border-b border-base-border bg-base-surface2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
                  <Activity className="h-4 w-4 text-base-accent" />
                  Employee Daily Output Directory
                </h3>
                <p className="text-xs text-base-muted mt-0.5">
                  Individual workforce daily productivity metrics and estimated project progress contribution
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search Input */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-base-surface border border-base-border rounded-lg flex-1 md:w-56">
                  <Search className="h-3.5 w-3.5 text-base-muted shrink-0" />
                  <input
                    type="text"
                    value={outputSearchQuery}
                    onChange={e => setOutputSearchQuery(e.target.value)}
                    placeholder="Search name or position..."
                    className="text-xs font-sans text-base-text bg-transparent outline-none w-full border-none p-0 focus:ring-0"
                  />
                </div>

                {/* Sort selector */}
                <select
                  value={outputSortBy}
                  onChange={e => setOutputSortBy(e.target.value as any)}
                  className="text-xs font-condensed font-bold text-base-text bg-base-surface border border-base-border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
                >
                  <option value="output">Sort by Output Rate</option>
                  <option value="hours">Sort by Total Hours</option>
                  <option value="days">Sort by Days Worked</option>
                  <option value="name">Sort by Name</option>
                </select>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-base-border bg-base-surface3/60 text-[10px] font-condensed font-black uppercase tracking-wider text-base-muted">
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-3 text-center">Craft / Position</th>
                    <th className="py-2.5 px-3 text-center">Days Worked</th>
                    <th className="py-2.5 px-3 text-center">Total Hours</th>
                    <th className="py-2.5 px-3 text-center">Avg Shift (h/day)</th>
                    <th className="py-2.5 px-3">Assigned Work Orders</th>
                    <th className="py-2.5 px-3 text-right">Progress Contribution</th>
                    <th className="py-2.5 px-4 text-right">Avg Daily Output Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border/40 text-xs">
                  {(() => {
                    const filteredRows = outputAnalyticsData.employeeRows.filter(e => {
                      if (!outputSearchQuery.trim()) return true;
                      const q = outputSearchQuery.toLowerCase();
                      return e.empName.toLowerCase().includes(q) || e.position.toLowerCase().includes(q);
                    });

                    if (filteredRows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-base-muted">
                            No employees match the criteria for the selected period.
                          </td>
                        </tr>
                      );
                    }

                    return filteredRows.map(row => (
                      <tr key={row.empId} className="hover:bg-base-surface2/50 transition-colors">
                        {/* Name */}
                        <td className="py-3 px-4 font-bold text-base-text">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: CRAFT_COLORS[row.craft] || CRAFT_COLORS.Other }}
                            />
                            <span className="truncate">{row.empName}</span>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="py-3 px-3 text-center">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-base-surface2 border border-base-border/50 font-condensed font-bold uppercase text-base-muted">
                            {row.position}
                          </span>
                        </td>

                        {/* Days Worked */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-base-text">
                          {row.daysWorked} <span className="text-[9px] text-base-muted font-normal">days</span>
                        </td>

                        {/* Total Hours */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-base-text">
                          {fmtHrs(row.totalHours)}h
                        </td>

                        {/* Avg Daily Shift */}
                        <td className="py-3 px-3 text-center font-mono text-base-text">
                          {row.avgDailyHours.toFixed(1)}h
                        </td>

                        {/* Projects */}
                        <td className="py-3 px-3 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {row.assignedProjects.length === 0 ? (
                              <span className="text-[10px] text-base-muted">General / Unassigned</span>
                            ) : (
                              row.assignedProjects.map(ap => (
                                <span
                                  key={ap.workOrder}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-base-surface3 border border-base-border font-condensed font-bold text-base-text truncate max-w-[100px]"
                                  title={`${ap.workOrder}: ${ap.hours}h logged (${ap.projPct}% progress)`}
                                >
                                  {ap.workOrder} ({ap.hours}h)
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Progress Contribution */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-base-text">
                          {row.progressContrib.toFixed(1)}%
                        </td>

                        {/* Avg Daily Output Rate */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-condensed font-black text-sm text-base-accent">
                              {row.dailyOutputRate.toFixed(2)}% <span className="text-[9px] text-base-muted font-normal">/ day</span>
                            </span>
                            {row.performanceStatus === 'high' && (
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 font-bold uppercase shrink-0">
                                🔥 High
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Calculation Methodology Info Box */}
          <div className="bg-base-surface2 border border-base-border rounded-xl p-4 flex items-start gap-3 text-xs text-base-muted">
            <Info className="h-5 w-5 text-base-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-condensed font-bold uppercase text-base-text text-xs tracking-wider block">
                How Average Daily Output per Employee is Calculated
              </span>
              <p className="leading-relaxed">
                <strong>Daily Output Rate (%/emp-day):</strong> Total estimated project progress percentage contributed by an employee divided by their total worked days in the selected period.
                An employee's progress contribution on a project is calculated proportionally based on their logged timesheet man-hours relative to the total work order man-hours and project completion rate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProjectAllocationCardProps {
  data: {
    workOrder: string;
    project: Project | null;
    crafts: {
      craft: string;
      workers: { empId: string; empName: string; hours: number; status: string }[];
      count: number;
      totalHours: number;
      color: string;
    }[];
    totalWorkers: number;
    totalHours: number;
  };
  expandAllSignal?: { expanded: boolean; version: number };
  onWorkerClick?: (empId: string) => void;
}

function ProjectAllocationCard({ data, expandAllSignal, onWorkerClick }: ProjectAllocationCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expandAllSignal && expandAllSignal.version > 0) {
      setExpanded(expandAllSignal.expanded);
    }
  }, [expandAllSignal?.version, expandAllSignal?.expanded]);

  return (
    <div className="bg-base-surface border border-base-border rounded-xl
                    overflow-hidden hover:border-base-border2 transition-colors">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-base-border bg-base-surface2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-condensed font-extrabold text-sm uppercase
                            tracking-wider text-base-text truncate">
              {data.project?.name || data.workOrder}
            </div>
            <div className="text-[10px] text-base-muted mt-0.5 font-condensed">
              {data.workOrder}
              {data.project?.status && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase
                                  ${data.project.status === 'active'
                                    ? 'bg-base-green-dim text-base-green'
                                    : 'bg-base-surface3 text-base-muted'}`}>
                  {data.project.status}
                </span>
              )}
            </div>
          </div>
          {/* Total count badge */}
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-condensed font-black text-base-text leading-none tabular-nums">
              {data.totalWorkers}
            </div>
            <div className="text-[9px] text-base-muted font-condensed uppercase">
              workers
            </div>
          </div>
        </div>
      </div>

      {/* Craft Rows */}
      <div className="px-4 py-3 divide-y divide-base-border/30">
        {data.crafts.map(c => (
          <div key={c.craft} className="flex items-center justify-between py-2 first:pt-0.5 last:pb-0.5">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: c.color }}
              />
              <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-text">
                {c.craft}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-condensed font-black text-base-text bg-base-surface3 border border-base-border px-2 py-0.5 rounded tabular-nums">
                {c.count} {c.count === 1 ? 'Worker' : 'Workers'}
              </span>
              <span className="text-[10px] text-base-muted font-condensed font-bold tabular-nums">
                {c.totalHours}h
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Expand toggle — show names */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-2 border-t border-base-border text-[10px]
                   font-condensed font-bold uppercase tracking-wider text-base-muted
                   hover:text-base-text hover:bg-base-surface2 transition-colors
                   cursor-pointer flex items-center justify-center gap-1.5"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Hide names
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Show {data.totalWorkers} names · {data.totalHours}h
          </>
        )}
      </button>

      {/* Expanded name list */}
      {expanded && (
        <div className="border-t border-base-border bg-base-surface3 px-4 py-3">
          {data.crafts.map(c => (
            <div key={c.craft} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: c.color }}
                />
                <span className="text-[10px] font-condensed font-bold uppercase
                                 tracking-wider text-base-muted">
                  {c.craft} ({c.count})
                </span>
              </div>
              <div className="ml-3.5 grid grid-cols-1 min-[420px]:grid-cols-2 gap-1.5">
                {c.workers.map(w => (
                  <button
                    key={w.empId}
                    type="button"
                    onClick={() => onWorkerClick?.(w.empId)}
                    disabled={!onWorkerClick}
                    title={onWorkerClick ? `Klik untuk edit/split timesheet ${w.empName}` : w.empName}
                    className={`flex items-center justify-between text-[11px] text-base-text bg-base-surface border border-base-border/40 rounded-lg px-2 py-1 min-w-0 shadow-sm text-left ${
                      onWorkerClick ? 'hover:border-base-accent/60 cursor-pointer transition-colors' : ''
                    }`}
                  >
                    <span className="truncate font-semibold flex items-center gap-1 min-w-0">
                      {w.status === 'late' && (
                        <span className="text-[8px] bg-amber-500/15 text-amber-500 px-1 py-0.2 rounded font-black shrink-0">LATE</span>
                      )}
                      <span className="truncate">{w.empName}</span>
                    </span>
                    <span className="text-base-muted text-[10px] font-mono shrink-0 ml-1 bg-base-surface3 border border-base-border/20 px-1 py-0.2 rounded font-bold tabular-nums">{w.hours}h</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CraftAvailableCardProps {
  craftGroup: {
    craft: string;
    color: string;
    onSiteUnassigned: {
      empId: string;
      empName: string;
      status: string;
      hours: number;
      position: string;
      craft: string;
    }[];
    unlogged: {
      empId: string;
      empName: string;
      status: string;
      hours: number;
      position: string;
      craft: string;
    }[];
    totalAvailable: number;
  };
  expandAllSignal?: { expanded: boolean; version: number };
  onLogWorker?: (empId: string) => void;
}

function CraftAvailableCard({ craftGroup, expandAllSignal, onLogWorker }: CraftAvailableCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expandAllSignal && expandAllSignal.version > 0) {
      setExpanded(expandAllSignal.expanded);
    }
  }, [expandAllSignal?.version, expandAllSignal?.expanded]);

  return (
    <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden hover:border-base-border2 transition-colors">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-base-border bg-base-surface2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: craftGroup.color }} />
          <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">
            {craftGroup.craft}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-condensed font-bold bg-base-surface3 px-2 py-0.5 rounded border border-base-border text-base-text tabular-nums">
            {craftGroup.totalAvailable} Available
          </span>
        </div>
      </div>

      {/* Card Body - Collapsible */}
      {expanded && (
        <div className="p-4 space-y-4 border-b border-base-border animate-fade-in">
          {/* On-Site & Unassigned */}
          {craftGroup.onSiteUnassigned.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-base-green animate-pulse" />
                <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-green">
                  On-Site & Unassigned ({craftGroup.onSiteUnassigned.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3">
                {craftGroup.onSiteUnassigned.map((w) => (
                  <div key={w.empId} className="bg-base-surface2 border border-base-border rounded-lg px-2.5 py-1.5 flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-base-text truncate">{w.empName}</span>
                      <span className="text-[9px] px-1 rounded bg-base-green-dim text-base-green font-bold tabular-nums shrink-0">{w.hours}h</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] text-base-muted truncate">{w.position}</span>
                      {onLogWorker && (
                        <button
                          type="button"
                          onClick={() => onLogWorker(w.empId)}
                          className="text-[9px] font-condensed font-extrabold uppercase text-base-accent hover:underline cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Plot WO →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Logged / Off-Site */}
          {craftGroup.unlogged.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-base-muted" />
                <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Not Logged Today ({craftGroup.unlogged.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3">
                {craftGroup.unlogged.map((w) => (
                  <div key={w.empId} className="bg-base-surface2/50 border border-base-border/50 rounded-lg px-2.5 py-1.5 flex flex-col justify-between gap-1 hover:border-base-accent/40 transition-colors">
                    <span className="text-xs font-semibold text-base-text truncate">{w.empName}</span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] text-base-muted truncate">{w.position}</span>
                      {onLogWorker && (
                        <button
                          type="button"
                          onClick={() => onLogWorker(w.empId)}
                          className="text-[9px] font-condensed font-extrabold uppercase text-base-accent hover:underline cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Log →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expand Toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-2 text-[10px]
                   font-condensed font-bold uppercase tracking-wider text-base-muted
                   hover:text-base-text hover:bg-base-surface2 transition-colors
                   cursor-pointer flex items-center justify-center gap-1.5"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Hide names
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Show {craftGroup.totalAvailable} names
          </>
        )}
      </button>
    </div>
  );
}
