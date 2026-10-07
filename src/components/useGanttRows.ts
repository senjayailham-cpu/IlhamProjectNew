import React, { useState, useMemo } from 'react';
import { Project, Dependency, WorkflowStatusType, TimesheetEntry } from '../types';
import { calcPct } from '../utils/projectUtils';
import { 
  calculateMultiProjectCPM, 
  getP6ActivityId, 
  diffDays, 
  parsePureDate 
} from '../utils/cpmEngine';

export interface GanttRow {
  id: string;
  type: 'project' | 'assembly' | 'task';
  name: string;
  level: 0 | 1 | 2;
  wbs: string;
  activityId?: string; // Oracle Primavera P6 Activity ID (e.g., A1010, WBS.1.1, PRJ-1)
  start?: string;
  finish?: string;
  duration: number;
  od?: number; // Original Duration (days)
  rd?: number; // Remaining Duration (days)
  totalFloat?: number; // Total Float in days (TF)
  freeFloat?: number;  // Free Float in days (FF)
  isCritical?: boolean; // Critical Path flag (TF <= 0)
  earlyStart?: string; // CPM Early Start
  earlyFinish?: string; // CPM Early Finish
  lateStart?: string; // CPM Late Start
  lateFinish?: string; // CPM Late Finish
  varianceDays?: number; // Schedule variance vs Baseline Finish
  pct: number;
  done: boolean;
  isMilestone?: boolean;
  predecessors?: Dependency[];
  parentAsmId?: string;
  assigned?: string;
  workflowStatus?: WorkflowStatusType;
  assignedCompany?: string;
  crewSize?: number;
  budgetHours?: number;
  baselineStart?: string;
  baselineFinish?: string;
  baselineDuration?: number;
  planHours: number;
  actualHours: number;
  timesheetCount: number;
}

// Utility to parse ISO date strictly without timezone shifts
export const parseLocalDate = (dateStr: string): Date => {
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
};

// Calculate days between two pure local dates
export const daysBetween = (d1: Date, d2: Date): number => {
  const ut1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const ut2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((ut2 - ut1) / (1000 * 60 * 60 * 24));
};

export const calcBaselineDuration = (bStart?: string, bFinish?: string, isMilestone?: boolean): number | undefined => {
  if (!bStart || !bFinish) return undefined;
  if (isMilestone) return 0;
  try {
    const d1 = parseLocalDate(bStart);
    const d2 = parseLocalDate(bFinish);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return undefined;
    return Math.max(1, daysBetween(d1, d2) + 1);
  } catch {
    return undefined;
  }
};

// Format a Date object back to YYYY-MM-DD timezone-safe local string
export const formatLocalDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Add days to a local date string
export const addDaysToLocalDate = (dateStr: string, days: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};

export interface UseGanttRowsOptions {
  project?: Project;
  projects?: Project[];
  timesheets?: TimesheetEntry[];
  showCompleted: boolean;
  searchQuery: string;
  statusFilter: string;
  activeTab: string;
  lookaheadWeeks: number;
}

export function useGanttRows({
  project,
  projects,
  timesheets,
  showCompleted,
  searchQuery,
  statusFilter,
  activeTab,
  lookaheadWeeks
}: UseGanttRowsOptions) {
  // Aggregate timesheets for hours tracking
  const timesheetSummary = useMemo(() => {
    const taskHoursMap = new Map<string, { actualHours: number; count: number }>();
    const taskNameHoursMap = new Map<string, { actualHours: number; count: number }>();
    const asmHoursMap = new Map<string, { actualHours: number; count: number }>();
    const woHoursMap = new Map<string, { actualHours: number; count: number }>();
    let grandTotalActualHours = 0;

    (timesheets || []).forEach(ts => {
      const hrs = typeof ts.totalHours === 'number' ? ts.totalHours : (Number((ts as any).hours) || 0);
      grandTotalActualHours += hrs;
      if (ts.taskId) {
        const prev = taskHoursMap.get(ts.taskId) || { actualHours: 0, count: 0 };
        taskHoursMap.set(ts.taskId, { actualHours: prev.actualHours + hrs, count: prev.count + 1 });
      }
      if (ts.taskName && ts.assemblyId) {
        const key = `${ts.assemblyId}:::${ts.taskName.trim().toLowerCase()}`;
        const prev = taskNameHoursMap.get(key) || { actualHours: 0, count: 0 };
        taskNameHoursMap.set(key, { actualHours: prev.actualHours + hrs, count: prev.count + 1 });
      }
      if (ts.assemblyId) {
        const prev = asmHoursMap.get(ts.assemblyId) || { actualHours: 0, count: 0 };
        asmHoursMap.set(ts.assemblyId, { actualHours: prev.actualHours + hrs, count: prev.count + 1 });
      }
      if (ts.workOrder) {
        const woKey = ts.workOrder.trim().toLowerCase();
        const prev = woHoursMap.get(woKey) || { actualHours: 0, count: 0 };
        woHoursMap.set(woKey, { actualHours: prev.actualHours + hrs, count: prev.count + 1 });
      }
    });

    return { taskHoursMap, taskNameHoursMap, asmHoursMap, woHoursMap, grandTotalActualHours };
  }, [timesheets]);

  // Filter project masuk Gantt
  // Default rows hanya project yang:
  // - !isArchived
  // - status active | pending | on-hold
  // Archive tidak masuk default
  const projectsList = useMemo(() => {
    let list: Project[] = [];
    if (projects && projects.length > 0) {
      list = [...projects];
    } else if (project) {
      list = [project];
    } else {
      return [];
    }

    list = list.filter(p => {
      if (p.isArchived) return false;
      if (showCompleted) return true;
      return p.status === 'active' || p.status === 'pending' || p.status === 'on-hold';
    });

    const getProjectStartDate = (p: Project): string => {
      let minDate: Date | null = null;
      const pStartStr = p.start || p.created || '';
      if (pStartStr) {
        try {
          minDate = parseLocalDate(pStartStr.slice(0, 10));
        } catch (e) {
          // ignore
        }
      }
      p.assemblies?.forEach(asm => {
        asm.tasks?.forEach(t => {
          if (t.date) {
            try {
              const d = parseLocalDate(t.date);
              if (!minDate || d < minDate) minDate = d;
            } catch (e) {
              // ignore
            }
          }
        });
      });
      return minDate ? formatLocalDate(minDate) : '9999-12-31';
    };

    return list.sort((a, b) => getProjectStartDate(a).localeCompare(getProjectStartDate(b)));
  }, [project, projects, showCompleted]);

  // Requirement 2: Collapse default — project rows collapsed by default
  // allRows / visible row list HANYA berisi project-level, BUKAN semua task
  // Task di-flatten HANYA untuk project yang di-expand user
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(project?.id ? [project.id] : []));
  const [collapsedAsms, setCollapsedAsms] = useState<Record<string, boolean>>({});

  const toggleProjectCollapse = (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleAssemblyCollapse = (asmId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedAsms(prev => ({
      ...prev,
      [asmId]: !prev[asmId]
    }));
  };

  const expandAllAssemblies = () => {
    setExpandedIds(new Set(projectsList.map(p => p.id)));
    setCollapsedAsms({});
  };

  const collapseAllAssemblies = () => {
    setExpandedIds(new Set());
    const newCollapsed: Record<string, boolean> = {};
    projectsList.forEach(p => {
      p.assemblies?.forEach(asm => {
        newCollapsed[asm.id] = true;
      });
    });
    setCollapsedAsms(newCollapsed);
  };

  const findProject = (rowId: string): Project | null => {
    return projectsList.find(p => {
      if (p.id === rowId) return true;
      if (p.assemblies?.some(a => a.id === rowId)) return true;
      if (p.assemblies?.some(a => a.tasks?.some(t => t.id === rowId))) return true;
      return false;
    }) || null;
  };

  // Oracle Primavera P6 Multi-Project CPM Calculation
  const cpmData = useMemo(() => {
    return calculateMultiProjectCPM(projectsList);
  }, [projectsList]);

  // Generate full unfiltered list of Gantt rows (including WBS numbering and P6 CPM attributes)
  const allRows = useMemo(() => {
    const result: GanttRow[] = [];
    const usedIds = new Set<string>();

    const getUniqueRowId = (baseId: string) => {
      if (!baseId) baseId = 'row';
      if (!usedIds.has(baseId)) {
        usedIds.add(baseId);
        return baseId;
      }
      let counter = 1;
      while (usedIds.has(`${baseId}_${counter}`)) {
        counter++;
      }
      const uniqueId = `${baseId}_${counter}`;
      usedIds.add(uniqueId);
      return uniqueId;
    };

    projectsList.forEach((p, pIdx) => {
      // Pre-calculate hours rollups for this project
      let projectPlanHoursSum = 0;
      let projectTaskActualHoursSum = 0;
      let projectTimesheetCount = 0;

      const asmHoursRollup = new Map<string, { planHours: number; actualHours: number; count: number }>();
      const taskHoursRollup = new Map<string, { planHours: number; actualHours: number; count: number }>();

      (p.assemblies || []).forEach(asm => {
        let asmPlanSum = 0;
        let asmTaskActualSum = 0;
        let asmTaskCount = 0;

        (asm.tasks || []).forEach(t => {
          const tStart = t.date || t.startDate || '';
          const tFinish = t.finishDate || t.endDate || '';
          const baseDur = calcBaselineDuration(t.baselineStart, t.baselineFinish, t.isMilestone);
          let tDuration = 1;
          if (tStart && tFinish) {
            tDuration = t.isMilestone ? 0 : Math.max(1, daysBetween(parseLocalDate(tStart), parseLocalDate(tFinish)) + 1);
          } else if (baseDur !== undefined) {
            tDuration = baseDur;
          }

          // Task planned hours: explicit budgetHours, or estimated from (crew * duration * 8) or (difficulty * 8)
          const tPlanHours = (typeof t.budgetHours === 'number' && t.budgetHours >= 0)
            ? t.budgetHours
            : (t.crewSize ? (t.crewSize * tDuration * 8) : (t.difficulty ? t.difficulty * 8 : tDuration * 8));

          // Task actual hours from timesheets
          const taskStatsById = timesheetSummary.taskHoursMap.get(t.id);
          const taskStatsByName = timesheetSummary.taskNameHoursMap.get(`${asm.id}:::${t.name.trim().toLowerCase()}`);
          const tActualHours = (taskStatsById?.actualHours || 0) + (taskStatsByName && !taskStatsById ? taskStatsByName.actualHours : 0);
          const tTimesheetCount = (taskStatsById?.count || 0) + (taskStatsByName && !taskStatsById ? taskStatsByName.count : 0);

          taskHoursRollup.set(t.id, { planHours: tPlanHours, actualHours: tActualHours, count: tTimesheetCount });

          asmPlanSum += tPlanHours;
          asmTaskActualSum += tActualHours;
          asmTaskCount += tTimesheetCount;
        });

        // Direct assembly timesheets (if any logged directly to assembly)
        const directAsmStats = timesheetSummary.asmHoursMap.get(asm.id);
        const aActualHours = Math.max(asmTaskActualSum, directAsmStats?.actualHours || 0);
        const aCount = (directAsmStats?.count || 0) + asmTaskCount;
        const aPlanHours = (typeof (asm as any).budgetHours === 'number' && (asm as any).budgetHours > 0)
          ? (asm as any).budgetHours
          : asmPlanSum;

        asmHoursRollup.set(asm.id, { planHours: aPlanHours, actualHours: aActualHours, count: aCount });

        projectPlanHoursSum += aPlanHours;
        projectTaskActualHoursSum += aActualHours;
        projectTimesheetCount += aCount;
      });

      // Project level actual hours & plan hours
      const woStats = timesheetSummary.woHoursMap.get(p.name.trim().toLowerCase()) 
        || (p.client ? timesheetSummary.woHoursMap.get(p.client.trim().toLowerCase()) : undefined);
      const pActualHours = Math.max(projectTaskActualHoursSum, woStats?.actualHours || 0);
      const pTimesheetCountTotal = (woStats?.count || 0) + projectTimesheetCount;
      const pPlanHours = (typeof p.budgetHours === 'number' && p.budgetHours > 0)
        ? p.budgetHours
        : projectPlanHoursSum;

      // 1. Project level summary row
      const pPct = calcPct(p);
      
      // Calculate start and due for this specific project
      let pStartStr = p.start;
      let pDueStr = p.due;
      let minTime = Infinity;
      let maxTime = -Infinity;
      p.assemblies?.forEach(asm => {
        asm.tasks?.forEach(t => {
          if (t.date) {
            const ms = parseLocalDate(t.date).getTime();
            if (ms < minTime) minTime = ms;
            if (ms > maxTime) maxTime = ms;
          }
          if (t.finishDate) {
            const ms = parseLocalDate(t.finishDate).getTime();
            if (ms < minTime) minTime = ms;
            if (ms > maxTime) maxTime = ms;
          }
        });
      });
      if (minTime !== Infinity) {
        const minDate = new Date(minTime);
        const maxDate = new Date(maxTime);
        pStartStr = formatLocalDate(minDate);
        pDueStr = formatLocalDate(maxDate);
      } else {
        if (!pStartStr) pStartStr = p.created?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        if (!pDueStr) {
          const d = parseLocalDate(pStartStr);
          d.setDate(d.getDate() + 30);
          pDueStr = formatLocalDate(d);
        }
      }

      const pStartD_local = parseLocalDate(pStartStr);
      const pDueD_local = parseLocalDate(pDueStr);
      const pDuration = Math.max(1, daysBetween(pStartD_local, pDueD_local) + 1);

      const projectWbs = `${pIdx + 1}`;
      const pCpm = cpmData.projectResults.get(p.id);
      const pCriticalCount = pCpm?.criticalCount || 0;
      const pFloatValues = pCpm ? Array.from(pCpm.floatMap.values()) : [];
      const pMinTF = pFloatValues.length > 0 ? Math.min(...pFloatValues) : 0;
      const pVarianceDays = p.baselineFinish ? diffDays(parsePureDate(p.baselineFinish), parsePureDate(pDueStr)) : undefined;

      result.push({
        id: getUniqueRowId(p.id),
        type: 'project',
        name: p.name,
        level: 0,
        wbs: projectWbs,
        activityId: getP6ActivityId('project', projectWbs),
        start: pStartStr,
        finish: pDueStr,
        duration: pDuration,
        od: pDuration,
        rd: pPct >= 100 ? 0 : Math.max(0, Math.round(pDuration * (1 - pPct / 100))),
        totalFloat: pMinTF,
        freeFloat: 0,
        isCritical: pCriticalCount > 0,
        earlyStart: pStartStr,
        earlyFinish: pDueStr,
        lateStart: pStartStr,
        lateFinish: pDueStr,
        varianceDays: pVarianceDays,
        pct: pPct,
        done: pPct >= 100,
        predecessors: p.predecessors,
        budgetHours: p.budgetHours,
        baselineStart: p.baselineStart,
        baselineFinish: p.baselineFinish,
        baselineDuration: calcBaselineDuration(p.baselineStart, p.baselineFinish, false),
        planHours: pPlanHours,
        actualHours: pActualHours,
        timesheetCount: pTimesheetCountTotal
      });

      // 2. Assembly & Task level rows (HANYA di-flatten jika project di-expand user)
      if (expandedIds.has(p.id)) {
        p.assemblies?.forEach((asm, asmIdx) => {
          let aStart = asm.start;
          let aFinish = asm.finish;

          const taskDates: Date[] = [];
          asm.tasks?.forEach(t => {
            if (t.date) taskDates.push(parseLocalDate(t.date));
            if (t.finishDate) taskDates.push(parseLocalDate(t.finishDate));
          });

          // Recalculate sub-assembly start and finish dates dynamically as rollup of tasks ONLY IF tasks have dates
          if (taskDates.length > 0) {
            const minDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...taskDates.map(d => d.getTime())));
            aStart = formatLocalDate(minDate);
            aFinish = formatLocalDate(maxDate);
          }

          const aDuration = (aStart && aFinish)
            ? Math.max(1, daysBetween(parseLocalDate(aStart), parseLocalDate(aFinish)) + 1)
            : 0;

          const aWeightResult = (asm.tasks || []).reduce((acc, t) => {
            const difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
            acc.totalWeight += difficulty;
            acc.weightedPct += (t.pct || 0) * difficulty;
            return acc;
          }, { totalWeight: 0, weightedPct: 0 });
          const aPct = aWeightResult.totalWeight > 0
            ? Math.round(aWeightResult.weightedPct / aWeightResult.totalWeight)
            : 0;

          const assemblyWbs = `${projectWbs}.${asmIdx + 1}`;
          const asmStats = asmHoursRollup.get(asm.id) || { planHours: 0, actualHours: 0, count: 0 };
          const isAsmCritical = cpmData.criticalAssemblyIds.has(asm.id);
          const asmTasks = asm.tasks || [];
          const asmFloatValues = asmTasks.map(t => cpmData.floatMap.get(t.id) ?? 0);
          const asmMinTF = asmFloatValues.length > 0 ? Math.min(...asmFloatValues) : 0;
          const aVarianceDays = asm.baselineFinish ? diffDays(parsePureDate(asm.baselineFinish), parsePureDate(aFinish)) : undefined;

          result.push({
            id: getUniqueRowId(asm.id),
            type: 'assembly',
            name: asm.name,
            level: 1,
            wbs: assemblyWbs,
            activityId: getP6ActivityId('assembly', assemblyWbs, asmIdx),
            start: aStart || undefined,
            finish: aFinish || undefined,
            duration: aDuration,
            od: aDuration,
            rd: aPct >= 100 ? 0 : (aDuration ? Math.max(0, Math.round(aDuration * (1 - aPct / 100))) : 0),
            totalFloat: asmMinTF,
            freeFloat: 0,
            isCritical: isAsmCritical,
            earlyStart: aStart || undefined,
            earlyFinish: aFinish || undefined,
            lateStart: aStart || undefined,
            lateFinish: aFinish || undefined,
            varianceDays: aVarianceDays,
            pct: aPct,
            done: aPct >= 100,
            predecessors: asm.predecessors,
            budgetHours: (asm as any).budgetHours,
            baselineStart: asm.baselineStart,
            baselineFinish: asm.baselineFinish,
            baselineDuration: calcBaselineDuration(asm.baselineStart, asm.baselineFinish, false),
            planHours: asmStats.planHours,
            actualHours: asmStats.actualHours,
            timesheetCount: asmStats.count
          });

          // Add child tasks if assembly is expanded
          const isAsmCollapsed = collapsedAsms[asm.id] === true;
          if (!isAsmCollapsed) {
            asm.tasks?.forEach((t, taskIdx) => {
              // Actual task start & finish: only populated if task explicitly has actual dates!
              const tStart = t.date || t.startDate || '';
              let tFinish = t.finishDate || t.endDate || '';

              if (tStart && tFinish && new Date(tFinish) < new Date(tStart)) {
                tFinish = tStart;
              }

              let tDuration = 0;
              if (tStart && tFinish) {
                const tStartD = parseLocalDate(tStart);
                const tFinishD = parseLocalDate(tFinish);
                tDuration = t.isMilestone ? 0 : Math.max(1, daysBetween(tStartD, tFinishD) + 1);
              } else if (t.isMilestone) {
                tDuration = 0;
              }

              const tStats = taskHoursRollup.get(t.id) || { planHours: 0, actualHours: 0, count: 0 };

              const cpmNode = cpmData.taskMap.get(t.id);
              const tTotalFloat = cpmNode?.totalFloat ?? 0;
              const tFreeFloat = cpmNode?.freeFloat ?? 0;
              const isTaskCritical = cpmNode?.isCritical ?? (tTotalFloat <= 0.001);
              const taskWbs = `${assemblyWbs}.${taskIdx + 1}`;
              const taskActId = cpmNode?.activityId || getP6ActivityId('task', taskWbs, asmIdx, taskIdx, (t as any).activityId);
              const tVarianceDays = (t.baselineFinish && tFinish) ? diffDays(parsePureDate(t.baselineFinish), parsePureDate(tFinish)) : undefined;

              result.push({
                id: getUniqueRowId(t.id),
                type: 'task',
                name: t.name,
                level: 2,
                wbs: taskWbs,
                activityId: taskActId,
                start: tStart || undefined,
                finish: tFinish || undefined,
                duration: tDuration,
                od: tDuration,
                rd: t.done ? 0 : (tDuration ? Math.max(0, Math.round(tDuration * (1 - (t.pct || 0) / 100))) : 0),
                totalFloat: tTotalFloat,
                freeFloat: tFreeFloat,
                isCritical: isTaskCritical,
                earlyStart: tStart ? (cpmNode?.earlyStart || tStart) : undefined,
                earlyFinish: tFinish ? (cpmNode?.earlyFinish || tFinish) : undefined,
                lateStart: tStart ? (cpmNode?.lateStart || tStart) : undefined,
                lateFinish: tFinish ? (cpmNode?.lateFinish || tFinish) : undefined,
                varianceDays: tVarianceDays,
                pct: t.pct || 0,
                done: !!t.done,
                isMilestone: !!t.isMilestone,
                predecessors: t.predecessors,
                parentAsmId: asm.id,
                assigned: t.assigned,
                workflowStatus: t.workflowStatus,
                assignedCompany: t.assignedCompany,
                crewSize: t.crewSize,
                budgetHours: t.budgetHours,
                baselineStart: t.baselineStart,
                baselineFinish: t.baselineFinish,
                baselineDuration: calcBaselineDuration(t.baselineStart, t.baselineFinish, !!t.isMilestone),
                planHours: tStats.planHours,
                actualHours: tStats.actualHours,
                timesheetCount: tStats.count
              });
            });
          }
        });
      }
    });

    return result;
  }, [projectsList, expandedIds, collapsedAsms, timesheetSummary, cpmData]);

  // Overall Project Plan vs Actual hours statistics
  const totalHoursStats = useMemo(() => {
    let plan = 0;
    let actual = 0;
    let entries = 0;

    allRows.filter(r => r.level === 0).forEach(r => {
      plan += r.planHours;
      actual += r.actualHours;
      entries += r.timesheetCount;
    });

    const burn = plan > 0 ? Math.round((actual / plan) * 100) : 0;
    const variance = actual - plan;
    return { plan, actual, entries, burn, variance };
  }, [allRows]);

  // Generate list of filtered Gantt rows
  const rows = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    const lookaheadEndStr = addDaysToLocalDate(todayStr, lookaheadWeeks * 7);
    const searchLower = searchQuery.toLowerCase().trim();

    // Helper to check if a row matches the filters
    const matchesFilter = (row: GanttRow) => {
      // Search filter
      if (searchLower !== '' && !row.name.toLowerCase().includes(searchLower)) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const isDone = row.pct === 100 || row.done;
        const isOverdue = row.pct < 100 && row.finish && row.finish < todayStr;
        const isOnTrack = row.pct < 100 && row.finish && row.finish >= todayStr;
        const isNotStarted = row.pct === 0 && !row.done;

        if (statusFilter === 'done' && !isDone) return false;
        if (statusFilter === 'overdue' && !isOverdue) return false;
        if (statusFilter === 'on-track' && !isOnTrack) return false;
        if (statusFilter === 'not-started' && !isNotStarted) return false;
      }
      // Lookahead date window filter
      if (activeTab === 'lookahead') {
        const rStart = row.start || row.finish || todayStr;
        const rFinish = row.finish || row.start || todayStr;
        const overlaps = rStart <= lookaheadEndStr && rFinish >= todayStr;
        if (!overlaps) return false;
      }
      return true;
    };

    // If no filters are active, show all rows directly
    if (searchLower === '' && statusFilter === 'all' && activeTab === 'gantt') {
      return allRows;
    }

    // First, identify all task rows (level 2) that match the filter
    const matchingTaskIds = new Set<string>();
    allRows.forEach(row => {
      if (row.level === 2 && matchesFilter(row)) {
        matchingTaskIds.add(row.id);
      }
    });

    // Helper to get project id for a row
    const getProjectIdOfRow = (r: GanttRow): string => {
      if (r.level === 0) return r.id;
      return r.id.split('-')[0];
    };

    // Filter rows based on matching level 2 tasks, direct name matches, and hierarchy rules
    const filteredRows = allRows.filter(row => {
      // If row itself directly matches name filter
      if (searchLower !== '' && row.name.toLowerCase().includes(searchLower)) {
        return true;
      }

      if (row.level === 2) {
        return matchingTaskIds.has(row.id);
      }
      if (row.level === 1) {
        // Assembly is kept if at least one child task matches or assembly itself has no tasks
        const childTasks = allRows.filter(r => r.level === 2 && r.parentAsmId === row.id);
        if (childTasks.length === 0 && searchLower === '' && statusFilter === 'all') return true;
        return childTasks.some(r => matchingTaskIds.has(r.id));
      }
      if (row.level === 0) {
        // Project is kept if at least one task across its assemblies matches or project has no tasks
        const projTasks = allRows.filter(r => r.level === 2 && getProjectIdOfRow(r) === row.id);
        if (projTasks.length === 0 && searchLower === '' && statusFilter === 'all') return true;
        return projTasks.some(r => matchingTaskIds.has(r.id));
      }
      return true;
    });

    return filteredRows;
  }, [allRows, searchQuery, statusFilter, activeTab, lookaheadWeeks]);

  return {
    timesheetSummary,
    projectsList,
    allRows,
    rows,
    expandedIds,
    setExpandedIds,
    collapsedAsms,
    setCollapsedAsms,
    toggleProjectCollapse,
    toggleAssemblyCollapse,
    expandAllAssemblies,
    collapseAllAssemblies,
    findProject,
    totalHoursStats,
    cpmData,
  };
}
