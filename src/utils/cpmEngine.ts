/**
 * ============================================================================
 * ORACLE PRIMAVERA P6 CPM (CRITICAL PATH METHOD) ENGINE
 * ============================================================================
 * 
 * Provides enterprise-grade scheduling logic:
 * - Forward Pass: Early Start (ES) and Early Finish (EF)
 * - Backward Pass: Late Start (LS) and Late Finish (LF)
 * - Float Calculation: Total Float (TF) & Free Float (FF)
 * - Critical Path identification (TF <= 0)
 * - Support for FS, SS, FF, SF relationships with Lag (+/- days)
 * - Generation of P6 Activity IDs (e.g., A1010, A1020, WBS-01)
 * - Schedule Recalculation (F9 Standard)
 */

import { Project, Dependency, Task, Assembly } from '../types';

export interface CPMTaskNode {
  id: string;
  name: string;
  activityId: string;
  duration: number;
  isMilestone: boolean;
  predecessors: Dependency[];
  parentAsmId?: string;
  projectId: string;
  rawStartDate: string;
  rawFinishDate: string;
  
  // CPM relative day offsets
  es: number;
  ef: number;
  ls: number;
  lf: number;
  
  // P6 Float metrics
  totalFloat: number; // TF (days)
  freeFloat: number;  // FF (days)
  isCritical: boolean;
  
  // Absolute calendar dates
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
}

export interface CPMProjectResult {
  projectId: string;
  dataDate: string;
  projectStartDate: string;
  projectFinishDate: string;
  criticalTaskIds: Set<string>;
  criticalAssemblyIds: Set<string>;
  taskMap: Map<string, CPMTaskNode>;
  floatMap: Map<string, number>;
  freeFloatMap: Map<string, number>;
  longestPathDuration: number;
  criticalCount: number;
  totalTaskCount: number;
  hasLoops: boolean;
  loopTaskIds: string[];
}

// Strictly parse ISO YYYY-MM-DD without timezone shift
export const parsePureDate = (dateStr: string): Date => {
  const parts = dateStr.slice(0, 10).split('-');
  const y = parseInt(parts[0], 10) || 2026;
  const m = (parseInt(parts[1], 10) || 1) - 1;
  const d = parseInt(parts[2], 10) || 1;
  return new Date(y, m, d);
};

// Format pure Date back to YYYY-MM-DD
export const formatPureDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Days between two dates
export const diffDays = (d1: Date, d2: Date): number => {
  const ut1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const ut2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((ut2 - ut1) / (1000 * 60 * 60 * 24));
};

// Add days to ISO date
export const addDays = (dateStr: string, days: number): string => {
  const d = parsePureDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatPureDate(d);
};

/**
 * Generate standard P6 Activity ID
 * Tasks get format: A1010, A1020, etc.
 * Assemblies get format: WBS.1.1
 */
export const getP6ActivityId = (
  type: 'project' | 'assembly' | 'task',
  wbs: string,
  asmIdx = 0,
  taskIdx = 0,
  customId?: string
): string => {
  if (customId && customId.trim().length > 0) return customId.trim();
  if (type === 'project') return `PRJ-${wbs || '01'}`;
  if (type === 'assembly') return `WBS.${wbs}`;
  const baseNum = 1000 + (asmIdx * 100) + ((taskIdx + 1) * 10);
  return `A${baseNum}`;
};

/**
 * Compute full CPM forward/backward passes and float analysis on a single Project
 */
export function calculateProjectCPM(project: Project): CPMProjectResult {
  const taskMap = new Map<string, CPMTaskNode>();
  const criticalTaskIds = new Set<string>();
  const criticalAssemblyIds = new Set<string>();
  const floatMap = new Map<string, number>();
  const freeFloatMap = new Map<string, number>();

  // Determine reference project start date
  let pStartStr = project.start || project.created?.slice(0, 10) || formatPureDate(new Date());
  let minRawDate: Date | null = null;

  (project.assemblies || []).forEach(asm => {
    (asm.tasks || []).forEach(t => {
      const dStr = t.date || asm.start || pStartStr;
      if (dStr) {
        const d = parsePureDate(dStr);
        if (!minRawDate || d < minRawDate) minRawDate = d;
      }
    });
  });

  if (minRawDate) {
    pStartStr = formatPureDate(minRawDate);
  }
  const projectStartDate = pStartStr;
  const pStartD = parsePureDate(projectStartDate);

  // 1. Gather all tasks and initialize nodes
  const rawNodes: CPMTaskNode[] = [];
  let globalTaskCounter = 0;

  (project.assemblies || []).forEach((asm, asmIdx) => {
    (asm.tasks || []).forEach((t, taskIdx) => {
      globalTaskCounter++;
      const tStart = t.date || asm.start || projectStartDate;
      let tFinish = t.finishDate || tStart;
      if (new Date(tFinish) < new Date(tStart)) {
        tFinish = tStart;
      }
      const tStartD = parsePureDate(tStart);
      const tFinishD = parsePureDate(tFinish);
      const duration = t.isMilestone ? 0 : Math.max(1, diffDays(tStartD, tFinishD) + 1);
      const rawOffsetDays = Math.max(0, diffDays(pStartD, tStartD));

      const activityId = (t as any).activityId || getP6ActivityId('task', `${asmIdx + 1}.${taskIdx + 1}`, asmIdx, taskIdx);

      const node: CPMTaskNode = {
        id: t.id,
        name: t.name,
        activityId,
        duration,
        isMilestone: !!t.isMilestone,
        predecessors: t.predecessors || [],
        parentAsmId: asm.id,
        projectId: project.id,
        rawStartDate: tStart,
        rawFinishDate: tFinish,
        es: rawOffsetDays,
        ef: rawOffsetDays + duration,
        ls: 0,
        lf: 0,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: false,
        earlyStart: tStart,
        earlyFinish: tFinish,
        lateStart: tStart,
        lateFinish: tFinish
      };

      rawNodes.push(node);
      taskMap.set(t.id, node);
    });
  });

  if (rawNodes.length === 0) {
    return {
      projectId: project.id,
      dataDate: formatPureDate(new Date()),
      projectStartDate,
      projectFinishDate: projectStartDate,
      criticalTaskIds,
      criticalAssemblyIds,
      taskMap,
      floatMap,
      freeFloatMap,
      longestPathDuration: 0,
      criticalCount: 0,
      totalTaskCount: 0,
      hasLoops: false,
      loopTaskIds: []
    };
  }

  // 2. Build graph & topological order with loop detection
  const topoOrder: string[] = [];
  const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
  const loopTaskIds: string[] = [];
  let hasLoops = false;

  const visit = (id: string) => {
    const state = visited.get(id) || 0;
    if (state === 1) {
      hasLoops = true;
      loopTaskIds.push(id);
      return; // Cycle detected: skip back edge
    }
    if (state === 2) return;

    visited.set(id, 1);
    const node = taskMap.get(id);
    if (node) {
      node.predecessors.forEach(dep => {
        if (taskMap.has(dep.key)) {
          visit(dep.key);
        }
      });
    }

    visited.set(id, 2);
    topoOrder.push(id);
  };

  rawNodes.forEach(node => {
    if ((visited.get(node.id) || 0) === 0) {
      visit(node.id);
    }
  });

  // Build successor adjacency map for Backward Pass and Free Float
  const successorsMap = new Map<string, { succId: string; dep: Dependency }[]>();
  rawNodes.forEach(node => {
    node.predecessors.forEach(dep => {
      if (taskMap.has(dep.key)) {
        const list = successorsMap.get(dep.key) || [];
        list.push({ succId: node.id, dep });
        successorsMap.set(dep.key, list);
      }
    });
  });

  // 3. Forward Pass: Calculate Early Start (ES) and Early Finish (EF)
  topoOrder.forEach(id => {
    const node = taskMap.get(id);
    if (!node) return;

    let calculatedES = node.es; // baseline raw offset as lower bound

    if (node.predecessors.length > 0) {
      let maxDepES = 0;
      let hasValidDep = false;

      node.predecessors.forEach(dep => {
        const pred = taskMap.get(dep.key);
        if (!pred) return;
        hasValidDep = true;

        const lag = dep.lag || 0;
        let candES = 0;

        switch (dep.type) {
          case 'SS':
            candES = pred.es + lag;
            break;
          case 'FF':
            candES = pred.ef + lag - node.duration;
            break;
          case 'SF':
            candES = pred.es + lag - node.duration;
            break;
          case 'FS':
          default:
            candES = pred.ef + lag;
            break;
        }

        if (candES > maxDepES) maxDepES = candES;
      });

      if (hasValidDep) {
        calculatedES = Math.max(calculatedES, maxDepES);
      }
    }

    node.es = Math.max(0, calculatedES);
    node.ef = node.es + node.duration;
    node.earlyStart = addDays(projectStartDate, node.es);
    node.earlyFinish = addDays(projectStartDate, Math.max(node.es, node.ef - (node.isMilestone ? 0 : 1)));
  });

  // Project overall finish is the max of all EF
  const maxProjectEF = Math.max(1, ...rawNodes.map(n => n.ef));
  const projectFinishDate = addDays(projectStartDate, maxProjectEF);

  // 4. Backward Pass: Calculate Late Finish (LF) and Late Start (LS)
  rawNodes.forEach(node => {
    node.lf = maxProjectEF;
  });

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const node = taskMap.get(id);
    if (!node) continue;

    const successors = successorsMap.get(id);

    if (successors && successors.length > 0) {
      let minLF = maxProjectEF;

      successors.forEach(({ succId, dep }) => {
        const succ = taskMap.get(succId);
        if (!succ) return;

        const lag = dep.lag || 0;
        let candLF = succ.lf;

        switch (dep.type) {
          case 'SS':
            candLF = succ.ls - lag + node.duration;
            break;
          case 'FF':
            candLF = succ.lf - lag;
            break;
          case 'SF':
            candLF = succ.lf - lag + node.duration;
            break;
          case 'FS':
          default:
            candLF = succ.ls - lag;
            break;
        }

        if (candLF < minLF) minLF = candLF;
      });

      node.lf = Math.max(node.ef, minLF);
    } else {
      node.lf = maxProjectEF;
    }

    node.ls = Math.max(0, node.lf - node.duration);
    node.lateStart = addDays(projectStartDate, node.ls);
    node.lateFinish = addDays(projectStartDate, Math.max(node.ls, node.lf - (node.isMilestone ? 0 : 1)));
  }

  // 5. Total Float & Free Float Calculation
  rawNodes.forEach(node => {
    const tf = Math.max(0, node.lf - node.ef);
    node.totalFloat = tf;
    floatMap.set(node.id, tf);

    // Free Float: min(succ.es - lag) - node.ef
    const successors = successorsMap.get(node.id);
    if (!successors || successors.length === 0) {
      node.freeFloat = tf;
    } else {
      let minSuccES = Infinity;
      successors.forEach(({ succId, dep }) => {
        const succ = taskMap.get(succId);
        if (succ) {
          const lag = dep.lag || 0;
          const cand = dep.type === 'SS' ? succ.es - lag : succ.es - lag;
          if (cand < minSuccES) minSuccES = cand;
        }
      });
      node.freeFloat = minSuccES !== Infinity ? Math.max(0, minSuccES - node.ef) : tf;
    }
    freeFloatMap.set(node.id, node.freeFloat);

    // Critical Path: Total Float == 0 (within 0.001 tolerance)
    if (tf <= 0.001) {
      node.isCritical = true;
      criticalTaskIds.add(node.id);
      if (node.parentAsmId) {
        criticalAssemblyIds.add(node.parentAsmId);
      }
    } else {
      node.isCritical = false;
    }
  });

  return {
    projectId: project.id,
    dataDate: formatPureDate(new Date()),
    projectStartDate,
    projectFinishDate,
    criticalTaskIds,
    criticalAssemblyIds,
    taskMap,
    floatMap,
    freeFloatMap,
    longestPathDuration: maxProjectEF,
    criticalCount: criticalTaskIds.size,
    totalTaskCount: rawNodes.length,
    hasLoops,
    loopTaskIds
  };
}

/**
 * Run CPM across all active projects and merge results
 */
export function calculateMultiProjectCPM(projects: Project[]): {
  criticalTaskIds: Set<string>;
  criticalAssemblyIds: Set<string>;
  taskMap: Map<string, CPMTaskNode>;
  floatMap: Map<string, number>;
  freeFloatMap: Map<string, number>;
  projectResults: Map<string, CPMProjectResult>;
  totalCritical: number;
} {
  const criticalTaskIds = new Set<string>();
  const criticalAssemblyIds = new Set<string>();
  const taskMap = new Map<string, CPMTaskNode>();
  const floatMap = new Map<string, number>();
  const freeFloatMap = new Map<string, number>();
  const projectResults = new Map<string, CPMProjectResult>();

  projects.forEach(p => {
    const res = calculateProjectCPM(p);
    projectResults.set(p.id, res);

    res.criticalTaskIds.forEach(id => criticalTaskIds.add(id));
    res.criticalAssemblyIds.forEach(id => criticalAssemblyIds.add(id));
    res.taskMap.forEach((node, id) => taskMap.set(id, node));
    res.floatMap.forEach((tf, id) => floatMap.set(id, tf));
    res.freeFloatMap.forEach((ff, id) => freeFloatMap.set(id, ff));
  });

  return {
    criticalTaskIds,
    criticalAssemblyIds,
    taskMap,
    floatMap,
    freeFloatMap,
    projectResults,
    totalCritical: criticalTaskIds.size
  };
}

/**
 * P6 Schedule (F9) Runner:
 * Recalculates all early dates based on CPM network logic and updates the project models
 */
export function runP6ScheduleF9(project: Project): {
  updatedProject: Project;
  cpmResult: CPMProjectResult;
  shiftedCount: number;
} {
  const cloned = structuredClone(project) as Project;
  const cpm = calculateProjectCPM(cloned);
  let shiftedCount = 0;

  // Align dates according to CPM Early Start and Early Finish
  cloned.assemblies?.forEach(asm => {
    asm.tasks?.forEach(t => {
      const node = cpm.taskMap.get(t.id);
      if (node) {
        if (t.date !== node.earlyStart || t.finishDate !== node.earlyFinish) {
          t.date = node.earlyStart;
          t.finishDate = node.earlyFinish;
          shiftedCount++;
        }
      }
    });

    // Rollup assembly dates
    const taskDates: Date[] = [];
    asm.tasks?.forEach(t => {
      if (t.date) taskDates.push(parsePureDate(t.date));
      if (t.finishDate) taskDates.push(parsePureDate(t.finishDate));
    });
    if (taskDates.length > 0) {
      const minDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...taskDates.map(d => d.getTime())));
      asm.start = formatPureDate(minDate);
      asm.finish = formatPureDate(maxDate);
    }
  });

  // Rollup project due date
  cloned.due = cpm.projectFinishDate;

  return {
    updatedProject: cloned,
    cpmResult: cpm,
    shiftedCount
  };
}
