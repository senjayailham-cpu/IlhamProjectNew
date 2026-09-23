import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Project, Assembly, Task, Dependency, User, WorkflowStatusType, OrgSettings, TimesheetEntry } from '../types';
import { can } from '../utils/permissions';
import { calcPct } from '../utils/projectUtils';

import { 
  useGanttRows, 
  GanttRow, 
  daysBetween, 
  formatLocalDate, 
  addDaysToLocalDate, 
  parseLocalDate 
} from './useGanttRows';
import { 
  GanttGrid, 
  getCompanyColorClass, 
  WorkflowStatusBadge, 
  CircularProgressBadge,
  WORKFLOW_STATUS_CONFIG,
  getEffectiveWorkflowStatus
} from './GanttGrid';
import { GanttTimeline } from './GanttTimeline';

export { 
  getCompanyColorClass, 
  WorkflowStatusBadge, 
  CircularProgressBadge,
  WORKFLOW_STATUS_CONFIG,
  getEffectiveWorkflowStatus 
};
import { 
  ChevronRight, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Layers,
  Calendar,
  Search,
  Flag,
  Download,
  Plus,
  X,
  Trash2,
  Link,
  Users,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  BarChart3,
  Sparkles,
  Flame,
  Undo2,
  Redo2,
  Monitor,
  BookmarkCheck,
  BookmarkPlus
} from 'lucide-react';
import { highlightText } from '../utils/helpers';

// Helper function to dynamically filter cssRules and exclude oklab colors which html2canvas fails to parse
const overrideCssRules = () => {
  const overrides: Array<{ obj: any; prop: string; descriptor: PropertyDescriptor }> = [];

  const defineOverride = (obj: any, prop: string) => {
    if (!obj) return;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      if (descriptor && descriptor.get) {
        overrides.push({ obj, prop, descriptor });
        Object.defineProperty(obj, prop, {
          configurable: true,
          get: function() {
            try {
              const rules = descriptor.get?.call(this);
              if (!rules) return rules;

              const filteredRules: any[] = [];
              for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                try {
                  const text = rule.cssText;
                  if (text && (text.includes('oklab') || text.includes('oklch') || text.includes('light-dark'))) {
                    continue;
                  }
                  filteredRules.push(rule);
                } catch (e) {
                  filteredRules.push(rule);
                }
              }

              const result = {
                length: filteredRules.length,
                item: (index: number) => filteredRules[index],
                [Symbol.iterator]: function* () {
                  for (let i = 0; i < filteredRules.length; i++) {
                    yield filteredRules[i];
                  }
                }
              };
              for (let i = 0; i < filteredRules.length; i++) {
                (result as any)[i] = filteredRules[i];
              }
              return result as unknown as CSSRuleList;
            } catch (err) {
              return [] as unknown as CSSRuleList;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Failed to override', prop, e);
    }
  };

  // Override cssRules on prototype and instances
  if (typeof CSSStyleSheet !== 'undefined') defineOverride(CSSStyleSheet.prototype, 'cssRules');
  if (typeof StyleSheet !== 'undefined') defineOverride(StyleSheet.prototype, 'cssRules');
  if (typeof CSSGroupingRule !== 'undefined') defineOverride(CSSGroupingRule.prototype, 'cssRules');

  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      defineOverride(sheet, 'cssRules');
    }
  } catch (e) {
    console.warn('Failed to override sheets', e);
  }

  // Override CSSStyleDeclaration.prototype.getPropertyValue
  let originalGetPropertyValue: any = null;
  if (typeof CSSStyleDeclaration !== 'undefined' && CSSStyleDeclaration.prototype) {
    try {
      originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
      CSSStyleDeclaration.prototype.getPropertyValue = function(property: string) {
        try {
          const val = originalGetPropertyValue.call(this, property);
          if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch') || val.includes('light-dark'))) {
            return 'rgba(0, 0, 0, 0)';
          }
          return val;
        } catch (e) {
          return 'rgba(0, 0, 0, 0)';
        }
      };
    } catch (e) {
      console.warn('Failed to override getPropertyValue', e);
    }
  }

  // Override window.getComputedStyle
  let originalGetComputedStyle: any = null;
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function(element: Element, pseudoElt?: string | null) {
        const style = originalGetComputedStyle.call(window, element, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function(propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch') || val.includes('light-dark'))) {
                  return 'rgba(0, 0, 0, 0)';
                }
                return val;
              };
            }
            const val = Reflect.get(target, prop);
            if (typeof val === 'function') {
              return val.bind(target);
            }
            if (typeof val === 'string' && (val.includes('oklab') || val.includes('oklch') || val.includes('light-dark'))) {
              return 'rgba(0, 0, 0, 0)';
            }
            return val;
          }
        });
      };
    } catch (e) {
      console.warn('Failed to override getComputedStyle', e);
    }
  }

  return () => {
    // Restore cssRules overrides
    overrides.forEach(({ obj, prop, descriptor }) => {
      try {
        Object.defineProperty(obj, prop, descriptor);
      } catch (e) {
        console.warn('Failed to restore', prop, e);
      }
    });

    // Restore getPropertyValue
    if (originalGetPropertyValue && typeof CSSStyleDeclaration !== 'undefined' && CSSStyleDeclaration.prototype) {
      try {
        CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      } catch (e) {
        console.warn('Failed to restore getPropertyValue', e);
      }
    }

    // Restore getComputedStyle
    if (originalGetComputedStyle && typeof window !== 'undefined') {
      try {
        window.getComputedStyle = originalGetComputedStyle;
      } catch (e) {
        console.warn('Failed to restore getComputedStyle', e);
      }
    }
  };
};

interface GanttViewProps {
  project?: Project;
  projects?: Project[];
  timesheets?: TimesheetEntry[];
  onClose?: () => void;
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  depModalRowKey?: string;
  setDepModalOpen?: (open: boolean) => void;
  onSaveDependencies?: (targetKey: string, preds: Dependency[], succs: Dependency[]) => void;
  onCloseDepModal?: () => void;
  currentUser?: User | null;
  orgSettings?: OrgSettings;
  prefs?: {
    ganttShowSCurve?: boolean;
    ganttAutoSchedule?: boolean;
    ganttShowResourceLoad?: boolean;
    ganttShowHoursTracking?: boolean;
    ganttShowBaseline?: boolean;
  };
  onSetPref?: (key: string, value: any) => void;
  selectedMonth?: string;
  setSelectedMonth?: (month: string) => void;
  availableMonths?: string[];
  includeCompleted?: boolean;
  setIncludeCompleted?: (inc: boolean) => void;
}

interface DragState {
  rowId: string;
  type: 'move' | 'resize' | 'resize-left';
  initialX: number;
  initialStart: string;
  initialFinish: string;
  parentAsmId?: string;
  rowType: 'project' | 'assembly' | 'task';
  tempStart?: string;
  tempFinish?: string;
}

// Parse a predecessor string like "1.1FS+2" into a Dependency list
function parsePredecessorInput(
  raw: string,
  wbsMap: Record<string, string>
): Dependency[] {
  const results: Dependency[] = [];
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    const match = part.match(/^([\d.]+)(FS|SS|FF|SF)?(?:\+(\d+)d?)?$/i);
    if (!match) continue;

    const wbs = match[1];
    const type = (match[2]?.toUpperCase() as Dependency['type']) || 'FS';
    const lag = match[3] ? parseInt(match[3], 10) : undefined;

    const key = wbsMap[wbs];
    if (!key) continue;

    results.push({ key, type, lag });
  }

  return results;
}

// CPM (Critical Path Method) helper to calculate critical path task IDs
const calculateCriticalPath = (project: Project): { criticalIds: Set<string>; floatMap: Map<string, number> } => {
  const criticalIds = new Set<string>();
  const floatMap = new Map<string, number>();
  
  // 1. Gather all tasks in the project
  const tasks: {
    id: string;
    duration: number;
    predecessors: Dependency[];
    es: number;
    ef: number;
    ls: number;
    lf: number;
  }[] = [];
  
  const taskMap = new Map<string, typeof tasks[0]>();
  
  project.assemblies?.forEach(asm => {
    asm.tasks?.forEach(t => {
      // Parse task dates
      const tStart = t.date || asm.start || project.start || '';
      let tFinish = t.finishDate || tStart || '';
      if (new Date(tFinish) < new Date(tStart)) {
        tFinish = tStart;
      }
      const tStartD = parseLocalDate(tStart);
      const tFinishD = parseLocalDate(tFinish);
      const duration = t.isMilestone ? 0 : Math.max(1, daysBetween(tStartD, tFinishD) + 1);
      
      const cTask = {
        id: t.id,
        duration,
        predecessors: t.predecessors || [],
        es: 0,
        ef: 0,
        ls: 0,
        lf: 0
      };
      
      tasks.push(cTask);
      taskMap.set(t.id, cTask);
    });
  });
  
  if (tasks.length === 0) {
    return { criticalIds, floatMap };
  }
  
  // 2. Topological Sort with cycle detection
  const topoOrder: string[] = [];
  const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
  
  const visit = (id: string) => {
    const state = visited.get(id) || 0;
    if (state === 1) {
      // Cycle detected! Skip back-edge
      return;
    }
    if (state === 2) {
      return;
    }
    visited.set(id, 1);
    
    const task = taskMap.get(id);
    if (task) {
      task.predecessors.forEach(dep => {
        if (taskMap.has(dep.key)) {
          visit(dep.key);
        }
      });
    }
    
    visited.set(id, 2);
    topoOrder.push(id);
  };
  
  tasks.forEach(t => {
    if ((visited.get(t.id) || 0) === 0) {
      visit(t.id);
    }
  });
  
  // 3. Forward Pass (ES & EF)
  topoOrder.forEach(id => {
    const s = taskMap.get(id);
    if (!s) return;
    
    let maxES = 0;
    s.predecessors.forEach(dep => {
      const p = taskMap.get(dep.key);
      if (!p) return;
      
      const lag = dep.lag || 0;
      let candidate = 0;
      if (dep.type === 'FS') {
        candidate = p.ef + lag;
      } else if (dep.type === 'SS') {
        candidate = p.es + lag;
      } else if (dep.type === 'FF') {
        candidate = p.ef + lag - s.duration;
      } else if (dep.type === 'SF') {
        candidate = p.es + lag - s.duration;
      } else {
        candidate = p.ef + lag;
      }
      
      maxES = Math.max(maxES, candidate);
    });
    
    s.es = maxES;
    s.ef = s.es + s.duration;
  });
  
  // 4. Backward Pass (LS & LF)
  const maxEF = Math.max(0, ...tasks.map(t => t.ef));
  
  // Initialize late finish (LF) of all tasks to maxEF
  tasks.forEach(t => {
    t.lf = maxEF;
  });
  
  // Iterate in reverse topological order to propagate late dates
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const s = taskMap.get(id);
    if (!s) continue;
    
    s.ls = s.lf - s.duration;
    
    s.predecessors.forEach(dep => {
      const p = taskMap.get(dep.key);
      if (!p) return;
      
      const lag = dep.lag || 0;
      let maxLF = p.lf;
      if (dep.type === 'FS') {
        maxLF = s.ls - lag;
      } else if (dep.type === 'SS') {
        maxLF = s.ls - lag + p.duration;
      } else if (dep.type === 'FF') {
        maxLF = s.lf - lag;
      } else if (dep.type === 'SF') {
        maxLF = s.lf - lag + p.duration;
      } else {
        maxLF = s.ls - lag;
      }
      
      p.lf = Math.min(p.lf, maxLF);
    });
  }
  
  // 5. Identify critical path tasks (Total Float = 0)
  tasks.forEach(t => {
    const totalFloat = t.lf - t.ef;
    floatMap.set(t.id, totalFloat);
    if (Math.abs(totalFloat) < 0.001) {
      criticalIds.add(t.id);
    }
  });
  
  return { criticalIds, floatMap };
};

// Cascade Schedule helper function for cascading shifts to successor tasks
const cascadeSchedule = (
  updatedProject: Project,
  draggedOrEditedId?: string
): { updatedProject: Project; shiftedIds: Set<string> } => {
  const cloned = structuredClone(updatedProject) as Project;
  const shiftedIds = new Set<string>();

  // 1. Gather all tasks in a flat list
  const flatTasks: {
    id: string;
    date: string;
    finishDate: string;
    isMilestone?: boolean;
    predecessors: Dependency[];
    parentAsmId: string;
    duration: number;
    taskRef: Task;
  }[] = [];

  cloned.assemblies?.forEach(asm => {
    asm.tasks?.forEach(t => {
      const tStart = t.date || asm.start || cloned.start || '';
      let tFinish = t.finishDate || tStart || '';
      if (new Date(tFinish) < new Date(tStart)) {
        tFinish = tStart;
      }
      const tStartD = parseLocalDate(tStart);
      const tFinishD = parseLocalDate(tFinish);
      const duration = t.isMilestone ? 0 : Math.max(1, daysBetween(tStartD, tFinishD) + 1);

      flatTasks.push({
        id: t.id,
        date: tStart,
        finishDate: tFinish,
        isMilestone: t.isMilestone,
        predecessors: t.predecessors || [],
        parentAsmId: asm.id,
        duration,
        taskRef: t
      });
    });
  });

  if (flatTasks.length === 0) {
    return { updatedProject: cloned, shiftedIds };
  }

  // 2. Build dependency graph
  const taskMap = new Map<string, typeof flatTasks[0]>();
  flatTasks.forEach(t => taskMap.set(t.id, t));

  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  flatTasks.forEach(t => {
    adjList.set(t.id, []);
    inDegree.set(t.id, 0);
  });

  flatTasks.forEach(t => {
    t.predecessors.forEach(dep => {
      if (taskMap.has(dep.key)) {
        adjList.get(dep.key)!.push(t.id);
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
      }
    });
  });

  // 3. Kahn's Algorithm for Topological Sort
  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) {
      queue.push(id);
    }
  });

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    topoOrder.push(u);
    const successors = adjList.get(u) || [];
    successors.forEach(v => {
      const nextDegree = (inDegree.get(v) || 0) - 1;
      inDegree.set(v, nextDegree);
      if (nextDegree === 0) {
        queue.push(v);
      }
    });
  }

  // If there's a cycle, ensure all remaining nodes are appended to avoid skipping them
  if (topoOrder.length < flatTasks.length) {
    flatTasks.forEach(t => {
      if (!topoOrder.includes(t.id)) {
        topoOrder.push(t.id);
      }
    });
  }

  // 4. Propagate earliest start dates forward in topological order
  topoOrder.forEach(id => {
    const S = taskMap.get(id);
    if (!S) return;

    const originalStartD = parseLocalDate(S.date);
    let maxEarliestStartD = parseLocalDate(S.date);

    S.predecessors.forEach(dep => {
      const p = taskMap.get(dep.key);
      if (!p) return;

      const lag = dep.lag || 0;
      let candidateStartStr = S.date;

      if (dep.type === 'FS') {
        candidateStartStr = addDaysToLocalDate(p.finishDate, lag);
      } else if (dep.type === 'SS') {
        candidateStartStr = addDaysToLocalDate(p.date, lag);
      } else if (dep.type === 'FF') {
        if (S.isMilestone || S.duration === 0) {
          candidateStartStr = addDaysToLocalDate(p.finishDate, lag);
        } else {
          candidateStartStr = addDaysToLocalDate(p.finishDate, lag - S.duration + 1);
        }
      } else if (dep.type === 'SF') {
        if (S.isMilestone || S.duration === 0) {
          candidateStartStr = addDaysToLocalDate(p.date, lag);
        } else {
          candidateStartStr = addDaysToLocalDate(p.date, lag - S.duration + 1);
        }
      } else {
        candidateStartStr = addDaysToLocalDate(p.finishDate, lag);
      }

      const candidateStartD = parseLocalDate(candidateStartStr);
      if (candidateStartD > maxEarliestStartD) {
        maxEarliestStartD = candidateStartD;
      }
    });

    if (maxEarliestStartD > originalStartD) {
      const shiftDays = daysBetween(originalStartD, maxEarliestStartD);
      if (shiftDays > 0) {
        S.date = addDaysToLocalDate(S.date, shiftDays);
        S.finishDate = addDaysToLocalDate(S.finishDate, shiftDays);
        S.taskRef.date = S.date;
        S.taskRef.finishDate = S.finishDate;
        S.taskRef.startDate = S.date;
        S.taskRef.endDate = S.finishDate;

        if (S.id !== draggedOrEditedId) {
          shiftedIds.add(S.id);
        }
      }
    }
  });

  // 5. Recalculate assemblies start & finish
  cloned.assemblies?.forEach(asm => {
    if (!asm.tasks || asm.tasks.length === 0) return;

    let minStart: Date | null = null;
    let maxFinish: Date | null = null;

    asm.tasks.forEach(t => {
      const tStartStr = t.date || asm.start || cloned.start || '';
      const tFinishStr = t.finishDate || tStartStr || '';

      const tStartD = parseLocalDate(tStartStr);
      const tFinishD = parseLocalDate(tFinishStr);

      if (!minStart || tStartD < minStart) {
        minStart = tStartD;
      }
      if (!maxFinish || tFinishD > maxFinish) {
        maxFinish = tFinishD;
      }
    });

    if (minStart) {
      asm.start = formatLocalDate(minStart);
    }
    if (maxFinish) {
      asm.finish = formatLocalDate(maxFinish);
    }
  });

  return { updatedProject: cloned, shiftedIds };
};

export default function GanttView({ 
  project, 
  projects, 
  timesheets = [],
  onClose, 
  onUpdateProject: onUpdateProjectRaw, 
  onOpenDepModal,
  depModalOpen,
  depModalRowKey,
  setDepModalOpen,
  onSaveDependencies,
  onCloseDepModal,
  currentUser,
  orgSettings,
  prefs,
  onSetPref,
  selectedMonth,
  setSelectedMonth,
  availableMonths,
  includeCompleted,
  setIncludeCompleted
}: GanttViewProps) {
  const allowedToEdit = can(currentUser ?? null, 'editGanttSchedule');

  const [internalIncludeCompleted, setInternalIncludeCompleted] = useState<boolean>(false);
  const showCompleted = includeCompleted !== undefined ? includeCompleted : internalIncludeCompleted;
  const setShowCompleted = setIncludeCompleted || setInternalIncludeCompleted;

  interface HistoryEntry {
    projectId: string;
    before: Project;
    after: Project;
  }

  const [historyStack, setHistoryStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const commitProjectUpdate = (updatedProject: Project) => {
    if (!onUpdateProjectRaw) return;
    const existing = projectsList.find(p => p.id === updatedProject.id);
    if (existing) {
      const entry: HistoryEntry = {
        projectId: updatedProject.id,
        before: structuredClone(existing),
        after: structuredClone(updatedProject)
      };
      setHistoryStack(prev => [...prev.slice(-29), entry]);
      setRedoStack([]);
    }
    onUpdateProjectRaw(updatedProject);
  };

  const onUpdateProject = allowedToEdit ? commitProjectUpdate : undefined;

  // Filtering States & Ref
  const [activeTab, setActiveTab] = useState<'gantt' | 'lookahead'>('gantt');
  const [lookaheadWeeks, setLookaheadWeeks] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'on-track'|'overdue'|'done'|'not-started'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useGanttRows({
    project,
    projects,
    timesheets,
    showCompleted,
    searchQuery,
    statusFilter,
    activeTab,
    lookaheadWeeks,
  });

  const findAndCloneProject = (rowId: string): { original: Project; cloned: Project } | null => {
    const orig = findProject(rowId);
    if (!orig) return null;
    return {
      original: orig,
      cloned: structuredClone(orig) as Project
    };
  };

  const getProjectIdOfRow = (row: GanttRow): string => {
    if (row.level === 0) return row.id;
    const p = projectsList.find(proj => {
      if (row.level === 1) return proj.assemblies?.some(a => a.id === row.id);
      if (row.level === 2) return proj.assemblies?.some(a => a.id === row.parentAsmId);
      return false;
    });
    return p ? p.id : (project?.id || '');
  };

  // Navigation / Configuration State
  const [zoomMode, setZoomMode] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [showArrows, setShowArrows] = useState<boolean>(true);
  const [showProgress, setShowProgress] = useState<boolean>(true);
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(false);
  const [showSCurve, setShowSCurve] = useState<boolean>(() =>
    prefs?.ganttShowSCurve ?? (localStorage.getItem('gantt_showSCurve') === 'true')
  );
  const [showHoursTracking, setShowHoursTracking] = useState<boolean>(() =>
    prefs?.ganttShowHoursTracking ?? (localStorage.getItem('gantt_showHoursTracking') !== 'false')
  );
  const [showBaseline, setShowBaseline] = useState<boolean>(() =>
    prefs?.ganttShowBaseline ?? (localStorage.getItem('gantt_showBaseline') !== 'false')
  );
  const [showBaselineMenu, setShowBaselineMenu] = useState<boolean>(false);
  const [cascadedTaskIds, setCascadedTaskIds] = useState<Set<string>>(new Set());

  // AUTO-SCHEDULE FEATURE
  const [autoSchedule, setAutoSchedule] = useState<boolean>(() => {
    if (prefs?.ganttAutoSchedule !== undefined) return prefs.ganttAutoSchedule;
    const saved = localStorage.getItem('gantt_autoSchedule');
    return saved !== null ? saved === 'true' : true; // default ON
  });

  // Save to prefs / localStorage on change
  const handleSetAutoSchedule = (val: boolean) => {
    setAutoSchedule(val);
    if (onSetPref) onSetPref('ganttAutoSchedule', val);
    else localStorage.setItem('gantt_autoSchedule', String(val));
  };

  const handleSetShowSCurve = (val: boolean) => {
    setShowSCurve(val);
    if (onSetPref) onSetPref('ganttShowSCurve', val);
    else localStorage.setItem('gantt_showSCurve', String(val));
  };

  const handleSetShowHoursTracking = (val: boolean) => {
    setShowHoursTracking(val);
    if (onSetPref) onSetPref('ganttShowHoursTracking', val);
    else localStorage.setItem('gantt_showHoursTracking', String(val));
  };

  const handleSetShowBaseline = (val: boolean) => {
    setShowBaseline(val);
    if (onSetPref) onSetPref('ganttShowBaseline', val);
    else localStorage.setItem('gantt_showBaseline', String(val));
  };

  useEffect(() => {
    if (prefs?.ganttAutoSchedule !== undefined) {
      setAutoSchedule(prefs.ganttAutoSchedule);
    }
  }, [prefs?.ganttAutoSchedule]);

  useEffect(() => {
    if (prefs?.ganttShowSCurve !== undefined) {
      setShowSCurve(prefs.ganttShowSCurve);
    }
  }, [prefs?.ganttShowSCurve]);

  useEffect(() => {
    if (prefs?.ganttShowHoursTracking !== undefined) {
      setShowHoursTracking(prefs.ganttShowHoursTracking);
    }
  }, [prefs?.ganttShowHoursTracking]);

  useEffect(() => {
    if (prefs?.ganttShowBaseline !== undefined) {
      setShowBaseline(prefs.ganttShowBaseline);
    }
  }, [prefs?.ganttShowBaseline]);

  // ── RESOURCE LOAD VIEW STATES ──
  const [showResourceLoad, setShowResourceLoad] = useState<boolean>(() => {
    if (prefs?.ganttShowResourceLoad !== undefined) return prefs.ganttShowResourceLoad;
    const saved = localStorage.getItem('gantt_showResourceLoad');
    return saved !== null ? saved === 'true' : true;
  });

  const handleSetShowResourceLoad = (val: boolean) => {
    setShowResourceLoad(val);
    if (onSetPref) onSetPref('ganttShowResourceLoad', val);
    else localStorage.setItem('gantt_showResourceLoad', String(val));
  };

  useEffect(() => {
    if (prefs?.ganttShowResourceLoad !== undefined) {
      setShowResourceLoad(prefs.ganttShowResourceLoad);
    }
  }, [prefs?.ganttShowResourceLoad]);
  const [resourceFilter, setResourceFilter] = useState<'all' | 'conflicts'>('all');
  const [resourceSearch, setResourceSearch] = useState<string>('');
  const [dailyCapacityLimit, setDailyCapacityLimit] = useState<number>(8);
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [hoveredResourceCell, setHoveredResourceCell] = useState<{
    employeeName: string;
    dayIdx: number;
    dateStr: string;
    totalHours: number;
    tasks: Array<{ taskId: string; taskName: string; wbs: string; project: string; hours: number }>;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('gantt_showResourceLoad', String(showResourceLoad));
  }, [showResourceLoad]);

  // ── SMART SCHEDULE ENGINE ──
  const handleSmartSchedule = () => {
    if (!onUpdateProject || projectsList.length === 0) return;

    let totalShiftedCount = 0;
    const allShiftedIds = new Set<string>();

    projectsList.forEach(proj => {
      const { updatedProject, shiftedIds } = cascadeSchedule(proj);
      if (shiftedIds.size > 0) {
        shiftedIds.forEach(id => allShiftedIds.add(id));
        totalShiftedCount += shiftedIds.size;
        onUpdateProject(updatedProject);
      }
    });

    if (totalShiftedCount > 0) {
      setCascadedTaskIds(allShiftedIds);
      setToastMsg(`Smart Schedule: Automatically shifted ${totalShiftedCount} dependent task(s) to eliminate overlap conflicts.`);
    } else {
      setToastMsg(`Smart Schedule: All task dependencies are already properly aligned with no overlaps.`);
    }

    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Export State and Refs
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [isPrefsDropdownOpen, setIsPrefsDropdownOpen] = useState<boolean>(false);
  const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);
  const ganttWorkspaceRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const prefsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
      if (prefsDropdownRef.current && !prefsDropdownRef.current.contains(event.target as Node)) {
        setIsPrefsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportPNG = async () => {
    if (!ganttWorkspaceRef.current) return;
    setIsExporting(true);
    setIsExportDropdownOpen(false);

    // Apply oklab workaround for html2canvas
    const restoreCssRules = overrideCssRules();

    try {
      // Find elements to hide temporarily
      const elementsToHide = ganttWorkspaceRef.current.querySelectorAll('.print\\:hidden, [data-export-hide]');
      const originalDisplays = Array.from(elementsToHide).map(el => (el as HTMLElement).style.display);
      
      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      const originalMaxHeight = ganttWorkspaceRef.current.style.maxHeight;
      ganttWorkspaceRef.current.style.maxHeight = 'none';

      // Capture canvas
      const canvas = await html2canvas(ganttWorkspaceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      ganttWorkspaceRef.current.style.maxHeight = originalMaxHeight;

      // Restore displays
      elementsToHide.forEach((el, idx) => {
        (el as HTMLElement).style.display = originalDisplays[idx] || '';
      });

      const downloadName = projectsList.length === 1 && projectsList[0] ? projectsList[0].name : 'Projects';
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `gantt_${downloadName || 'project'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error exporting PNG:', error);
      setToastMsg('Export PNG failed. Please try again.');
    } finally {
      restoreCssRules();
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!ganttWorkspaceRef.current) return;
    setIsExporting(true);
    setIsExportDropdownOpen(false);

    // Apply oklab workaround for html2canvas
    const restoreCssRules = overrideCssRules();

    try {
      // Find elements to hide temporarily
      const elementsToHide = ganttWorkspaceRef.current.querySelectorAll('.print\\:hidden, [data-export-hide]');
      const originalDisplays = Array.from(elementsToHide).map(el => (el as HTMLElement).style.display);
      
      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      const originalMaxHeight = ganttWorkspaceRef.current.style.maxHeight;
      ganttWorkspaceRef.current.style.maxHeight = 'none';

      // Capture canvas
      const canvas = await html2canvas(ganttWorkspaceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      ganttWorkspaceRef.current.style.maxHeight = originalMaxHeight;

      // Restore displays
      elementsToHide.forEach((el, idx) => {
        (el as HTMLElement).style.display = originalDisplays[idx] || '';
      });

      const doc = new jsPDF({ orientation: 'landscape', format: 'a3', unit: 'px' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const headerHeight = 60;
      const margin = 30;
      const usableHeight = pageHeight - headerHeight - 20;
      const usableWidth = pageWidth - (margin * 2);

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Fit height of the canvas to usable page height
      const pdfScale = usableHeight / canvasHeight;
      const imgRenderHeight = usableHeight;
      const imgRenderWidth = canvasWidth * pdfScale;

      // Determine how many pages wide the content is
      const numPages = Math.ceil(imgRenderWidth / usableWidth);
      const date = new Date().toISOString().slice(0, 10);
      const rangeStr = `${pStart || '—'} to ${pDue || '—'}`;
      const downloadName = projectsList.length === 1 && projectsList[0] ? projectsList[0].name : 'Projects';

      const canvasPageWidth = usableWidth / pdfScale;

      for (let i = 0; i < numPages; i++) {
        if (i > 0) {
          doc.addPage('a3', 'landscape');
        }

        // Draw header on each page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(31, 41, 55); // slate-800
        doc.text(`Gantt Chart - ${downloadName || 'Project'}`, 30, 25);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128); // gray-500
        doc.text(`Export Date: ${date}   |   Timeline Range: ${rangeStr}   |   Page ${i + 1} of ${numPages}`, 30, 42);

        doc.setDrawColor(229, 231, 235); // gray-200
        doc.setLineWidth(1);
        doc.line(30, 50, pageWidth - 30, 50);

        // Slice horizontal segment of the canvas
        const sourceX = i * canvasPageWidth;
        const sourceWidth = Math.min(canvasPageWidth, canvasWidth - sourceX);

        if (sourceWidth > 0) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = sourceWidth;
          tempCanvas.height = canvasHeight;
          const tempCtx = tempCanvas.getContext('2d');

          if (tempCtx) {
            tempCtx.drawImage(
              canvas,
              sourceX, 0, sourceWidth, canvasHeight,
              0, 0, sourceWidth, canvasHeight
            );
          }

          const sliceDataUrl = tempCanvas.toDataURL('image/png');
          const sliceRenderWidth = sourceWidth * pdfScale;

          doc.addImage(
            sliceDataUrl,
            'PNG',
            margin,
            headerHeight,
            sliceRenderWidth,
            imgRenderHeight
          );
        }
      }

      doc.save(`gantt_${downloadName || 'project'}_${date}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setToastMsg('Export PDF failed. Please try again.');
    } finally {
      restoreCssRules();
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (cascadedTaskIds.size > 0) {
      const timer = setTimeout(() => {
        setCascadedTaskIds(new Set());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [cascadedTaskIds]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto browser fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFullscreen = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isNativeFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleEnterFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
    } catch (err) {
      console.log('Fullscreen request handled:', err);
    }
    setIsFullscreen(true);
  };

  const handleExitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      console.log('Exit fullscreen error:', err);
    }
    setIsFullscreen(false);
  };
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [statusPopoverRowId, setStatusPopoverRowId] = useState<string | null>(null);

  // Draw-to-Connect Interaction States
  const [connectMode, setConnectMode] = useState<boolean>(false);
  const [dragHoverTargetRowId, setDragHoverTargetRowId] = useState<string | null>(null);
  const [hoveredArrowId, setHoveredArrowId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [connectDraw, setConnectDraw] = useState<{
    sourceRowId: string;
    sourceX: number;
    sourceY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{
    sourceRowId: string;
    targetRowId: string;
  } | null>(null);
  const [pendingDepType, setPendingDepType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [pendingDepLag, setPendingDepLag] = useState<string>('0');
  const [connectPopupPos, setConnectPopupPos] = useState<{ x: number; y: number } | null>(null);

  // Smart Search Side Panel States
  const [depPanelOpen, setDepPanelOpen] = useState<boolean>(false);
  const [depPanelRowId, setDepPanelRowId] = useState<string | null>(null);
  const [depPanelSearch, setDepPanelSearch] = useState<string>('');
  const [depPanelType, setDepPanelType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [depPanelLag, setDepPanelLag] = useState<string>('0');

  // Sync external trigger (SpotlightModal / onOpenDepModal) with internal Side Panel
  useEffect(() => {
    if (depModalOpen && depModalRowKey) {
      setDepPanelRowId(depModalRowKey);
      setDepPanelOpen(true);
      setDepPanelSearch('');
      if (setDepModalOpen) {
        setDepModalOpen(false);
      }
    }
  }, [depModalOpen, depModalRowKey, setDepModalOpen]);

  // Escape key global handler to dismiss connection drawing / side panel
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connectMode) setConnectMode(false);
        if (connectDraw) setConnectDraw(null);
        if (pendingConnect) setPendingConnect(null);
        if (depPanelOpen) setDepPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [connectMode, connectDraw, pendingConnect, depPanelOpen]);

  // Inline Editing States
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: 'start' | 'finish' } | null>(null);
  const [editingLookaheadCell, setEditingLookaheadCell] = useState<{ rowId: string; field: 'crew' | 'company' | 'assigned' } | null>(null);
  const [editingPred, setEditingPred] = useState<string | null>(null);
  const [predInputVal, setPredInputVal] = useState<string>('');
  const [editingPct, setEditingPct] = useState<string | null>(null);
  const [editingHoursCell, setEditingHoursCell] = useState<string | null>(null);
  const [flashingCellId, setFlashingCellId] = useState<string | null>(null);

  // Drag interaction state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Left Panel Resizing state (MS Project sheet table resizing)
  const defaultTotalTableWidth = 56 + 200 + 64 + 85 + 85 + 90 + 52; // 632
  const projectStorageId = project?.id || (projects && projects[0]?.id) || 'default';
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`gantt_left_panel_width_${projectStorageId}`);
      return saved ? parseInt(saved, 10) : defaultTotalTableWidth;
    } catch {
      return defaultTotalTableWidth;
    }
  });
  const [isResizingSplitter, setIsResizingSplitter] = useState(false);
  const splitterStartRef = useRef<{ x: number; width: number } | null>(null);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplitter(true);
    splitterStartRef.current = {
      x: e.clientX,
      width: leftPanelWidth
    };
  };

  useEffect(() => {
    if (!isResizingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitterStartRef.current) return;
      const deltaX = e.clientX - splitterStartRef.current.x;
      const nextWidth = Math.max(80, Math.min(splitterStartRef.current.width + deltaX, 1200));
      setLeftPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSplitter(false);
      splitterStartRef.current = null;
      try {
        localStorage.setItem(`gantt_left_panel_width_${projectStorageId}`, leftPanelWidth.toString());
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplitter, leftPanelWidth, project?.id, projectsList]);

  // Tooltip state
  const [hoveredTask, setHoveredTask] = useState<{
    row: GanttRow;
    x: number;
    y: number;
  } | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Vertical virtualization state
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(800);

  // Sync left panel scroll with right timeline vertical scroll using requestAnimationFrame throttling
  const handleScroll = () => {
    if (scrollRafRef.current !== null) return; // already scheduled
    scrollRafRef.current = requestAnimationFrame(() => {
      if (rightScrollRef.current) {
        const st = rightScrollRef.current.scrollTop;
        if (leftScrollRef.current) {
          leftScrollRef.current.scrollTop = st;
        }
        setScrollTop(st);
      }
      scrollRafRef.current = null;
    });
  };

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Track container height for virtualization window calculation
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setViewportHeight(el.clientHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(() => {
      updateHeight();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Handle wheel scrolling on the left panel by forwarding to the right scroll panel
  const handleLeftWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop += e.deltaY;
    }
  };

  // Safe calculation of project level start/end dates
  const { start: pStart, due: pDue } = useMemo(() => {
    let overallMinDate: Date | null = null;
    let overallMaxDate: Date | null = null;

    projectsList.forEach(p => {
      const pStartStr = p.start || p.created || '';
      if (pStartStr) {
        const d = parseLocalDate(pStartStr.slice(0, 10));
        if (!overallMinDate || d < overallMinDate) overallMinDate = d;
      }
      if (p.due) {
        const d = parseLocalDate(p.due.slice(0, 10));
        if (!overallMaxDate || d > overallMaxDate) overallMaxDate = d;
      }

      p.assemblies?.forEach(asm => {
        asm.tasks?.forEach(t => {
          if (t.date) {
            const d = parseLocalDate(t.date);
            if (!overallMinDate || d < overallMinDate) overallMinDate = d;
          }
          if (t.finishDate) {
            const d = parseLocalDate(t.finishDate);
            if (!overallMaxDate || d > overallMaxDate) overallMaxDate = d;
          }
        });
      });
    });

    let start = overallMinDate ? formatLocalDate(overallMinDate) : new Date().toISOString().slice(0, 10);
    let due = overallMaxDate ? formatLocalDate(overallMaxDate) : '';
    if (!due) {
      const d = parseLocalDate(start);
      d.setDate(d.getDate() + 30);
      due = formatLocalDate(d);
    }

    if (activeTab === 'lookahead') {
      const todayStr = formatLocalDate(new Date());
      const dueStr = addDaysToLocalDate(todayStr, lookaheadWeeks * 7);
      return { start: todayStr, due: dueStr };
    }

    return { start, due };
  }, [projectsList, activeTab, lookaheadWeeks]);

  const pStartD = useMemo(() => parseLocalDate(pStart), [pStart]);
  const pDueD = useMemo(() => parseLocalDate(pDue), [pDue]);

  const scheduleKey = useMemo(() => {
    // Only recompute CPM when dates change, not pct/done
    return projectsList.map(p =>
      p.assemblies?.flatMap(asm =>
        asm.tasks?.map(t => `${t.id}:${t.date}:${t.finishDate}`)
      ).join('|')
    ).join('||');
  }, [projectsList]);

  const { criticalPathIds, slackMap } = useMemo(() => {
    const mergedCritical = new Set<string>();
    const mergedSlack = new Map<string, number>();

    projectsList.forEach(p => {
      const res = calculateCriticalPath(p);
      res.criticalIds.forEach(id => mergedCritical.add(id));
      res.floatMap.forEach((val, id) => mergedSlack.set(id, val));
    });

    return {
      criticalPathIds: mergedCritical,
      slackMap: mergedSlack
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleKey]);

  const criticalAssemblyIds = useMemo(() => {
    const ids = new Set<string>();
    projectsList.forEach(p => {
      p.assemblies?.forEach(asm => {
        const hasCriticalTask = asm.tasks?.some(t => criticalPathIds.has(t.id));
        if (hasCriticalTask) {
          ids.add(asm.id);
        }
      });
    });
    return ids;
  }, [projectsList, criticalPathIds]);

  const criticalChainLength = useMemo(() => {
    const criticalTasks = projectsList.flatMap(p => 
      p.assemblies?.flatMap(asm => 
        asm.tasks?.filter(t => criticalPathIds.has(t.id)) || []
      ) || []
    );

    if (criticalTasks.length === 0) return 0;

    const dates = criticalTasks.flatMap(t => {
      const start = t.date || pStart;
      const finish = t.finishDate || start;
      return [parseLocalDate(start), parseLocalDate(finish)];
    });

    if (dates.length === 0) return 0;

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return Math.max(1, daysBetween(minDate, maxDate) + 1);
  }, [projectsList, criticalPathIds, pStart]);

  // Pixels per day calculated based on the selected zoom level
  const pixelsPerDay = useMemo(() => {
    switch (zoomMode) {
      case 'day': return 42;
      case 'week': return 14;
      case 'month': return 4;
      case 'quarter': return 1.5;
      default: return 14;
    }
  }, [zoomMode]);

  // Timeline boundaries aligned nicely based on zoom level
  const { timelineStart, timelineEnd, totalTimelineDays } = useMemo(() => {
    const start = new Date(pStartD);
    const end = new Date(pDueD);
    
    if (zoomMode === 'day' || zoomMode === 'week') {
      start.setDate(start.getDate() - 7);
      // Align start to Sunday for week-level grid alignment
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      
      end.setDate(end.getDate() + 21);
      // Align end to Saturday
      const endDay = end.getDay();
      end.setDate(end.getDate() + (6 - endDay));
    } else {
      // Align to start of current year and end of next year for roomy views
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      end.setFullYear(end.getFullYear() + 1);
    }
    
    const days = daysBetween(start, end) + 1;
    return { timelineStart: start, timelineEnd: end, totalTimelineDays: days };
  }, [pStartD, pDueD, zoomMode]);

  // ── ROW VIRTUALIZATION CONSTANTS & CALCULATIONS ──
  const ROW_HEIGHT = 32;
  const OVERSCAN = 8;
  const totalRowsCount = rows.length;
  const totalContentHeight = totalRowsCount * ROW_HEIGHT;

  const { startIndex, endIndex, visibleRows, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
    if (isExporting || totalRowsCount === 0) {
      return {
        startIndex: 0,
        endIndex: totalRowsCount,
        visibleRows: rows,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const rawStart = Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN;
    const start = Math.max(0, Math.min(totalRowsCount - 1, rawStart));
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const end = Math.min(totalRowsCount, Math.max(start + 1, Math.floor(scrollTop / ROW_HEIGHT) + visibleCount + OVERSCAN));

    const topSpacer = start * ROW_HEIGHT;
    const bottomSpacer = Math.max(0, (totalRowsCount - end) * ROW_HEIGHT);

    return {
      startIndex: start,
      endIndex: end,
      visibleRows: rows.slice(start, end),
      topSpacerHeight: topSpacer,
      bottomSpacerHeight: bottomSpacer,
    };
  }, [scrollTop, viewportHeight, totalRowsCount, rows, isExporting]);

  // Keep scrollTop state in sync if totalContentHeight shrinks (e.g. on project/assembly collapse)
  useEffect(() => {
    if (rightScrollRef.current) {
      const currentSt = rightScrollRef.current.scrollTop;
      if (currentSt !== scrollTop) {
        setScrollTop(currentSt);
        if (leftScrollRef.current) {
          leftScrollRef.current.scrollTop = currentSt;
        }
      }
    }
  }, [totalContentHeight]);

  // ── HARD DEPENDENCY CONSTRAINT VIOLATION CALCULATOR ──
  const dependencyViolationsMap = useMemo(() => {
    const map = new Map<string, Array<{
      predId: string;
      predWbs: string;
      predName: string;
      predFinish: string;
      predStart: string;
      depType: string;
      lag?: number;
      requiredMinDateStr: string;
      actualDateStr: string;
      reason: string;
    }>>();

    const rowLookup = new Map<string, GanttRow>();
    allRows.forEach(r => {
      if (r.id) rowLookup.set(r.id, r);
    });

    allRows.forEach(row => {
      if (row.level !== 2 || !row.predecessors || row.predecessors.length === 0 || !row.start || !row.finish) {
        return;
      }

      const conflicts: Array<{
        predId: string;
        predWbs: string;
        predName: string;
        predFinish: string;
        predStart: string;
        depType: string;
        lag?: number;
        requiredMinDateStr: string;
        actualDateStr: string;
        reason: string;
      }> = [];

      row.predecessors.forEach(dep => {
        const pred = rowLookup.get(dep.key);
        if (!pred || !pred.start || !pred.finish) return;

        const lag = dep.lag || 0;
        const type = dep.type || 'FS';

        if (type === 'FS') {
          // Finish-to-Start: target start must be on or after pred.finish + lag
          const requiredStartStr = addDaysToLocalDate(pred.finish, lag);
          if (row.start! < requiredStartStr) {
            conflicts.push({
              predId: pred.id,
              predWbs: pred.wbs,
              predName: pred.name,
              predFinish: pred.finish,
              predStart: pred.start,
              depType: type,
              lag,
              requiredMinDateStr: requiredStartStr,
              actualDateStr: row.start!,
              reason: `Starts on ${row.start} before predecessor [WBS ${pred.wbs}] finishes on ${pred.finish}${lag ? ` (+${lag}d lag)` : ''}`
            });
          }
        } else if (type === 'SS') {
          // Start-to-Start: target start must be on or after pred.start + lag
          const requiredStartStr = addDaysToLocalDate(pred.start, lag);
          if (row.start! < requiredStartStr) {
            conflicts.push({
              predId: pred.id,
              predWbs: pred.wbs,
              predName: pred.name,
              predFinish: pred.finish,
              predStart: pred.start,
              depType: type,
              lag,
              requiredMinDateStr: requiredStartStr,
              actualDateStr: row.start!,
              reason: `Starts on ${row.start} before predecessor [WBS ${pred.wbs}] starts on ${pred.start}${lag ? ` (+${lag}d lag)` : ''}`
            });
          }
        } else if (type === 'FF') {
          // Finish-to-Finish: target finish must be on or after pred.finish + lag
          const requiredFinishStr = addDaysToLocalDate(pred.finish, lag);
          if (row.finish! < requiredFinishStr) {
            conflicts.push({
              predId: pred.id,
              predWbs: pred.wbs,
              predName: pred.name,
              predFinish: pred.finish,
              predStart: pred.start,
              depType: type,
              lag,
              requiredMinDateStr: requiredFinishStr,
              actualDateStr: row.finish!,
              reason: `Finishes on ${row.finish} before predecessor [WBS ${pred.wbs}] finishes on ${pred.finish}${lag ? ` (+${lag}d lag)` : ''}`
            });
          }
        } else if (type === 'SF') {
          // Start-to-Finish: target finish must be on or after pred.start + lag
          const requiredFinishStr = addDaysToLocalDate(pred.start, lag);
          if (row.finish! < requiredFinishStr) {
            conflicts.push({
              predId: pred.id,
              predWbs: pred.wbs,
              predName: pred.name,
              predFinish: pred.finish,
              predStart: pred.start,
              depType: type,
              lag,
              requiredMinDateStr: requiredFinishStr,
              actualDateStr: row.finish!,
              reason: `Finishes on ${row.finish} before predecessor [WBS ${pred.wbs}] starts on ${pred.start}${lag ? ` (+${lag}d lag)` : ''}`
            });
          }
        }
      });

      if (conflicts.length > 0) {
        map.set(row.id, conflicts);
      }
    });

    return map;
  }, [allRows]);

  const totalDependencyConflictsCount = useMemo(() => {
    return dependencyViolationsMap.size;
  }, [dependencyViolationsMap]);

  // Global window mouse/touch movement and release listener for Draw-to-Connect
  useEffect(() => {
    if (!connectDraw) {
      setDragHoverTargetRowId(null);
      return;
    }

    const updatePositionAndTarget = (clientX: number, clientY: number) => {
      const container = document.querySelector('.gantt-relative-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      
      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top - 56;

      setConnectDraw(prev => prev ? {
        ...prev,
        currentX,
        currentY
      } : null);

      const targetRowIdx = Math.floor(currentY / 32);

      if (targetRowIdx >= 0 && targetRowIdx < rows.length) {
        const targetRow = rows[targetRowIdx];
        if (targetRow && targetRow.id !== connectDraw.sourceRowId) {
          setDragHoverTargetRowId(targetRow.id);
        } else {
          setDragHoverTargetRowId(null);
        }
      } else {
        setDragHoverTargetRowId(null);
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      updatePositionAndTarget(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updatePositionAndTarget(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const finishConnect = (clientX: number, clientY: number) => {
      const container = document.querySelector('.gantt-relative-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const currentY = clientY - rect.top - 56;
        const targetRowIdx = Math.floor(currentY / 32);

        if (targetRowIdx >= 0 && targetRowIdx < rows.length) {
          const targetRow = rows[targetRowIdx];
          if (targetRow && targetRow.id !== connectDraw.sourceRowId) {
            const popupX = Math.min(Math.max(160, clientX), window.innerWidth - 160);
            const popupY = Math.min(Math.max(180, clientY), window.innerHeight - 80);

            setPendingConnect({
              sourceRowId: connectDraw.sourceRowId,
              targetRowId: targetRow.id
            });
            setConnectPopupPos({
              x: popupX,
              y: popupY
            });
          }
        }
      }
      setConnectDraw(null);
      setDragHoverTargetRowId(null);
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      finishConnect(e.clientX, e.clientY);
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length > 0) {
        finishConnect(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      } else {
        setConnectDraw(null);
        setDragHoverTargetRowId(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [connectDraw, rows]);

  // WBS Map lookup for predecessor parsing
  const wbsMap = useMemo(() => {
    const map: Record<string, string> = {};
    allRows.forEach(r => {
      map[r.wbs] = r.id;
    });
    return map;
  }, [allRows]);

  // Index map of visible rows for fast O(1) dependency calculations
  const rowIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r, idx) => {
      map[r.id] = idx;
    });
    return map;
  }, [rows]);

  // Memoized search results for linking new predecessors
  const availablePredecessors = useMemo(() => {
    if (!depPanelRowId) return [];
    
    // Parse depPanelRowId (format: t:pId:asmId:taskId, a:pId:asmId, or p:pId) to find actual row ID
    const parts = depPanelRowId.split(':');
    const rowId = parts[parts.length - 1];
    const targetRow = rows.find(r => r.id === rowId);
    if (!targetRow) return [];
    
    const currentKeys = new Set(targetRow.predecessors?.map(d => d.key) || []);
    
    // Filter all rows (Project, SubAssembly/Assembly, Task) that are NOT target, and NOT already linked
    return rows.filter(row => {
      if (row.id === targetRow.id) return false;
      if (currentKeys.has(row.id)) return false;
      if (!depPanelSearch) return true;
      
      const term = depPanelSearch.toLowerCase();
      return row.name.toLowerCase().includes(term) || row.wbs.toLowerCase().includes(term);
    });
  }, [rows, depPanelRowId, depPanelSearch]);

  const displayedPredecessors = useMemo(() => {
    return availablePredecessors.slice(0, 5);
  }, [availablePredecessors]);

  const firstCriticalRowIdx = useMemo(() => {
    return rows.findIndex(row => row.level === 2 && criticalPathIds.has(row.id));
  }, [rows, criticalPathIds]);

  const jumpToFirstCriticalTask = () => {
    const idx = rows.findIndex(row => row.level === 2 && criticalPathIds.has(row.id));
    if (idx !== -1 && rightScrollRef.current) {
      setSelectedRowId(rows[idx].id);
      rightScrollRef.current.scrollTo({
        top: idx * 32,
        behavior: 'smooth'
      });
    }
  };

  // Predecessor label showing WBS-style label instead of index number
  const getPredecessorsLabel = (row: GanttRow): string => {
    if (!row.predecessors || row.predecessors.length === 0) return '—';
    return row.predecessors
      .map(dep => {
        const predRow = rows.find(r => r.id === dep.key);
        if (!predRow) return '';
        const typeStr = dep.type === 'FS' ? '' : dep.type;
        const lagStr = dep.lag ? `+${dep.lag}d` : '';
        return `${predRow.wbs}${typeStr}${lagStr}`;
      })
      .filter(Boolean)
      .join(', ') || '—';
  };

  // Inline Date Saving handler
  const saveDate = (rowId: string, field: 'start' | 'finish', newVal: string) => {
    if (!newVal || !onUpdateProject) return;

    const res = findAndCloneProject(rowId);
    if (!res) return;
    const updated = res.cloned;

    if (rowId === updated.id) {
      // Project level
      if (field === 'start') updated.start = newVal;
      else updated.due = newVal;
    } else {
      // Find in assemblies
      const asm = updated.assemblies?.find(a => a.id === rowId);
      if (asm) {
        if (field === 'start') asm.start = newVal;
        else asm.finish = newVal;
      } else {
        // Find in tasks
        for (const a of updated.assemblies || []) {
          const t = a.tasks?.find(t => t.id === rowId);
          if (t) {
            if (field === 'start') {
              t.date = newVal;
              t.startDate = newVal;
            } else {
              t.finishDate = newVal;
              t.endDate = newVal;
            }
            break;
          }
        }
      }
    }
    // AUTO-SCHEDULE FEATURE
    if (autoSchedule) {
      // Auto-Schedule ON: cascade successor tasks
      const { updatedProject, shiftedIds } = cascadeSchedule(updated, rowId);
      if (shiftedIds.size > 0) {
        setCascadedTaskIds(shiftedIds);
      }
      onUpdateProject(updatedProject);
    } else {
      // Auto-Schedule OFF: save only the dragged/edited task, no cascade
      onUpdateProject(updated);
    }
  };

  // Inline Predecessors Saving handler
  const savePredecessors = (rowId: string, inputStr: string) => {
    if (!onUpdateProject) return;
    const deps = parsePredecessorInput(inputStr, wbsMap);
    const res = findAndCloneProject(rowId);
    if (!res) return;
    const updated = res.cloned;

    if (rowId === updated.id) {
      updated.predecessors = deps;
    } else {
      const asm = updated.assemblies?.find(a => a.id === rowId);
      if (asm) {
        asm.predecessors = deps;
      } else {
        for (const a of updated.assemblies || []) {
          const t = a.tasks?.find(t => t.id === rowId);
          if (t) {
            t.predecessors = deps;
            break;
          }
        }
      }
    }
    onUpdateProject(updated);
  };

  // Direct predecessors list saving (bypasses string parsing and uses scheduling cascade/propagation if onSaveDependencies prop is available)
  const savePredecessorsDirect = (rowId: string, deps: Dependency[]) => {
    const parts = rowId.split(':');
    const actualRowId = parts[parts.length - 1];

    let rowKey = '';
    const targetRow = rows.find(r => r.id === actualRowId);
    if (targetRow) {
      const pId = getProjectIdOfRow(targetRow);
      if (targetRow.level === 0) rowKey = `p:${pId}`;
      else if (targetRow.level === 1) rowKey = `a:${pId}:${targetRow.id}`;
      else if (targetRow.level === 2) rowKey = `t:${pId}:${targetRow.parentAsmId}:${targetRow.id}`;
    }

    if (rowKey && onSaveDependencies) {
      onSaveDependencies(rowKey, deps, []);
      return;
    }

    if (!onUpdateProject) return;
    const res = findAndCloneProject(actualRowId);
    if (!res) return;
    const updated = res.cloned;

    if (actualRowId === updated.id) {
      updated.predecessors = deps;
    } else {
      const asm = updated.assemblies?.find(a => a.id === actualRowId);
      if (asm) {
        asm.predecessors = deps;
      } else {
        for (const a of updated.assemblies || []) {
          const t = a.tasks?.find(t => t.id === actualRowId);
          if (t) {
            t.predecessors = deps;
            break;
          }
        }
      }
    }
    onUpdateProject(updated);
  };

  // Delete dependency link between targetRow and sourceRow directly from SVG line or node
  const handleDeleteDependencyArrow = (targetRowId: string, sourceRowId: string) => {
    const targetRow = rows.find(r => r.id === targetRowId);
    if (!targetRow) return;
    const currentDeps = targetRow.predecessors || [];
    const nextDeps = currentDeps.filter(d => d.key !== sourceRowId);
    savePredecessorsDirect(targetRow.id, nextDeps);

    const srcRow = rows.find(r => r.id === sourceRowId);
    setToastMsg(`Removed dependency link: ${srcRow?.wbs || 'Task'} → ${targetRow.wbs}`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleAddPredecessor = (predId: string) => {
    if (!depPanelRowId) return;
    const parts = depPanelRowId.split(':');
    const actualRowId = parts[parts.length - 1];
    const targetRow = rows.find(r => r.id === actualRowId);
    if (!targetRow) return;
    const currentDeps = targetRow.predecessors || [];
    const parsedLag = parseInt(depPanelLag.replace('d', ''), 10);
    const lagValue = !isNaN(parsedLag) && parsedLag !== 0 ? parsedLag : undefined;
    const newDep: Dependency = {
      key: predId,
      type: depPanelType,
      lag: lagValue
    };
    
    // Avoid duplicate predecessor links
    let nextDeps = [...currentDeps];
    const existingIdx = nextDeps.findIndex(d => d.key === newDep.key);
    if (existingIdx !== -1) {
      nextDeps[existingIdx] = newDep;
    } else {
      nextDeps.push(newDep);
    }

    savePredecessorsDirect(depPanelRowId, nextDeps);
    setDepPanelSearch('');
  };

  const handleDeletePredecessor = (predId: string) => {
    if (!depPanelRowId) return;
    const parts = depPanelRowId.split(':');
    const actualRowId = parts[parts.length - 1];
    const targetRow = rows.find(r => r.id === actualRowId);
    if (!targetRow) return;
    const currentDeps = targetRow.predecessors || [];
    const nextDeps = currentDeps.filter(d => d.key !== predId);
    savePredecessorsDirect(depPanelRowId, nextDeps);
  };

  // Inline Progress (%) Saving handler
  const saveProgress = (taskId: string, newPct: number) => {
    if (!onUpdateProject) return;

    // Clamp between 0 and 100
    const clampedPct = Math.min(100, Math.max(0, newPct));

    const res = findAndCloneProject(taskId);
    if (!res) return;
    const updated = res.cloned;

    let found = false;
    for (const a of updated.assemblies || []) {
      const t = a.tasks?.find(t => t.id === taskId);
      if (t) {
        t.pct = clampedPct;
        t.done = clampedPct === 100;
        found = true;
        break;
      }
    }

    if (found) {
      // Trigger flash green animation
      setFlashingCellId(taskId);
      setTimeout(() => {
        setFlashingCellId(null);
      }, 500);

      onUpdateProject(updated);
    }
  };

  // Workflow Status Saving handler
  const saveWorkflowStatus = (taskId: string, newStatus: WorkflowStatusType) => {
    if (!onUpdateProject) return;

    const res = findAndCloneProject(taskId);
    if (!res) return;
    const updated = res.cloned;

    let found = false;
    for (const a of updated.assemblies || []) {
      const t = a.tasks?.find(t => t.id === taskId);
      if (t) {
        t.workflowStatus = newStatus;
        found = true;
        break;
      }
    }

    if (found) {
      setFlashingCellId(taskId);
      setTimeout(() => {
        setFlashingCellId(null);
      }, 500);

      onUpdateProject(updated);
    }
  };

  // Lookahead task field save handler
  const saveTaskField = (taskId: string, field: 'crew' | 'company' | 'assigned', val: string) => {
    if (!onUpdateProject) return;

    const res = findAndCloneProject(taskId);
    if (!res) return;
    const updated = res.cloned;

    let found = false;
    for (const a of updated.assemblies || []) {
      const t = a.tasks?.find(t => t.id === taskId);
      if (t) {
        if (field === 'crew') {
          const num = parseInt(val, 10);
          t.crewSize = isNaN(num) || num <= 0 ? undefined : num;
        } else if (field === 'company') {
          t.assignedCompany = val.trim() || undefined;
        } else if (field === 'assigned') {
          t.assigned = val.trim() || undefined;
        }
        found = true;
        break;
      }
    }

    if (found) {
      setFlashingCellId(taskId);
      setTimeout(() => {
        setFlashingCellId(null);
      }, 500);

      onUpdateProject(updated);
    }
  };

  // Plan / Budget hours save handler for rows (Tasks, Assemblies, Projects)
  const saveRowBudgetHours = (rowId: string, level: 0 | 1 | 2, val: string) => {
    if (!onUpdateProject) return;
    const num = parseFloat(val);
    const budgetHoursVal = isNaN(num) || num < 0 ? undefined : num;

    if (level === 2) {
      const res = findAndCloneProject(rowId);
      if (!res) return;
      const updated = res.cloned;
      for (const a of updated.assemblies || []) {
        const t = a.tasks?.find(task => task.id === rowId);
        if (t) {
          t.budgetHours = budgetHoursVal;
          break;
        }
      }
      setFlashingCellId(rowId);
      setTimeout(() => setFlashingCellId(null), 500);
      onUpdateProject(updated);
    } else if (level === 1) {
      const res = findAndCloneProject(rowId);
      if (!res) return;
      const updated = res.cloned;
      const a = updated.assemblies?.find(asm => asm.id === rowId);
      if (a) {
        (a as any).budgetHours = budgetHoursVal;
      }
      setFlashingCellId(rowId);
      setTimeout(() => setFlashingCellId(null), 500);
      onUpdateProject(updated);
    } else if (level === 0) {
      const p = projectsList.find(proj => proj.id === rowId);
      if (p) {
        const updated = { ...p, budgetHours: budgetHoursVal };
        setFlashingCellId(rowId);
        setTimeout(() => setFlashingCellId(null), 500);
        onUpdateProject(updated);
      }
    }
  };

  // Baseline Scheduling Actions & Permissions
  const canSetBaseline = Boolean(
    currentUser && (
      currentUser.role === 'admin' ||
      currentUser.role === 'manager' ||
      currentUser.role === 'project control' ||
      can(currentUser, 'editGanttSchedule')
    )
  );

  const selectedProject = useMemo(() => {
    if (!selectedRowId) return projectsList.length === 1 ? projectsList[0] : null;
    const orig = findProject(selectedRowId);
    if (orig) return orig;
    return projectsList.length === 1 ? projectsList[0] : null;
  }, [projectsList, selectedRowId]);

  const baselineStats = useMemo(() => {
    let count = 0;
    allRows.forEach(r => {
      if (r.baselineStart) count++;
    });
    return { count };
  }, [allRows]);

  const setBaselineForProject = (targetProj: Project, bypassConfirm = false) => {
    if (!onUpdateProject) return;

    const hasExistingBaseline = Boolean(
      targetProj.baselineStart ||
      targetProj.baselineFinish ||
      targetProj.assemblies?.some(a => a.baselineStart || a.tasks?.some(t => t.baselineStart))
    );

    if (hasExistingBaseline && !bypassConfirm) {
      const confirmed = window.confirm(
        `Proyek "${targetProj.name}" sudah memiliki Baseline (${targetProj.baselineStart || '—'} s/d ${targetProj.baselineFinish || '—'}).\n\nRe-baseline (replace existing) dengan jadwal aktual saat ini?`
      );
      if (!confirmed) return;
    }

    let pMinStart: string | null = null;
    let pMaxFinish: string | null = null;

    const updatedAssemblies = (targetProj.assemblies || []).map(asm => {
      let aMinStart: string | null = null;
      let aMaxFinish: string | null = null;

      const updatedTasks = (asm.tasks || []).map(t => {
        const actualStart = t.startDate || t.date || asm.start || targetProj.start;
        const actualFinish = t.endDate || t.finishDate || actualStart;
        if (actualStart) {
          if (!aMinStart || actualStart < aMinStart) aMinStart = actualStart;
          if (actualFinish && (!aMaxFinish || actualFinish > aMaxFinish)) aMaxFinish = actualFinish;

          if (!pMinStart || actualStart < pMinStart) pMinStart = actualStart;
          if (actualFinish && (!pMaxFinish || actualFinish > pMaxFinish)) pMaxFinish = actualFinish;

          return {
            ...t,
            baselineStart: actualStart,
            baselineFinish: actualFinish || actualStart
          };
        }
        return { ...t };
      });

      let asmBaselineStart = asm.baselineStart;
      let asmBaselineFinish = asm.baselineFinish;

      if (aMinStart) {
        asmBaselineStart = aMinStart;
        asmBaselineFinish = aMaxFinish || aMinStart;
      } else if (asm.start) {
        asmBaselineStart = asm.start;
        asmBaselineFinish = asm.finish || asm.start;
        if (!pMinStart || asmBaselineStart < pMinStart) pMinStart = asmBaselineStart;
        if (asmBaselineFinish && (!pMaxFinish || asmBaselineFinish > pMaxFinish)) pMaxFinish = asmBaselineFinish;
      }

      return {
        ...asm,
        baselineStart: asmBaselineStart,
        baselineFinish: asmBaselineFinish,
        tasks: updatedTasks
      };
    });

    const finalBaselineStart = pMinStart || targetProj.start;
    const finalBaselineFinish = pMinStart ? (pMaxFinish || pMinStart) : (targetProj.due || targetProj.start);

    const updated: Project = {
      ...targetProj,
      assemblies: updatedAssemblies,
      baselineStart: finalBaselineStart,
      baselineFinish: finalBaselineFinish
    };

    onUpdateProject(updated);
    setToastMsg(`Baseline berhasil dikunci untuk "${targetProj.name}": ${updated.baselineStart || '—'} → ${updated.baselineFinish || '—'}`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSetBaselineAll = () => {
    if (!onUpdateProject || projectsList.length === 0) return;
    const confirmed = window.confirm(
      `Kunci Baseline untuk semua (${projectsList.length}) proyek yang ditampilkan?\n\nJadwal rencana baseline akan disalin dari tanggal aktual saat ini.`
    );
    if (!confirmed) return;
    projectsList.forEach(p => setBaselineForProject(p, true));
  };

  // Header row elements generators
  const topHeaders = useMemo(() => {
    const list: { label: string; width: number }[] = [];
    const temp = new Date(timelineStart);

    while (temp <= timelineEnd) {
      let label = '';
      let nextBoundary: Date;

      if (zoomMode === 'day' || zoomMode === 'week') {
        label = temp.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        nextBoundary = new Date(temp.getFullYear(), temp.getMonth() + 1, 1);
      } else {
        label = temp.getFullYear().toString();
        nextBoundary = new Date(temp.getFullYear() + 1, 0, 1);
      }

      if (nextBoundary > timelineEnd) {
        nextBoundary = new Date(timelineEnd);
        nextBoundary.setDate(nextBoundary.getDate() + 1); // include the end day
      }

      const daysToJump = daysBetween(temp, nextBoundary);
      if (daysToJump <= 0) {
        list.push({ label, width: pixelsPerDay });
        temp.setDate(temp.getDate() + 1);
      } else {
        list.push({ label, width: daysToJump * pixelsPerDay });
        temp.setDate(temp.getDate() + daysToJump);
      }
    }
    return list;
  }, [timelineStart, timelineEnd, pixelsPerDay, zoomMode]);

  const bottomHeaders = useMemo(() => {
    const list: { label: string; width: number; isWeekend?: boolean }[] = [];
    const temp = new Date(timelineStart);

    if (zoomMode === 'day') {
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      while (temp <= timelineEnd) {
        const dayOfWeek = temp.getDay();
        list.push({
          label: `${dayNames[dayOfWeek]} ${temp.getDate()}`,
          width: pixelsPerDay,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6
        });
        temp.setDate(temp.getDate() + 1);
      }
    } else if (zoomMode === 'week') {
      while (temp <= timelineEnd) {
        const label = `${temp.getMonth() + 1}/${temp.getDate()}`;
        list.push({
          label,
          width: 7 * pixelsPerDay
        });
        temp.setDate(temp.getDate() + 7);
      }
    } else if (zoomMode === 'month') {
      while (temp <= timelineEnd) {
        const year = temp.getFullYear();
        const month = temp.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const label = temp.toLocaleDateString('en-US', { month: 'short' });
        list.push({
          label,
          width: daysInMonth * pixelsPerDay
        });
        temp.setDate(temp.getDate() + daysInMonth);
      }
    } else if (zoomMode === 'quarter') {
      while (temp <= timelineEnd) {
        const year = temp.getFullYear();
        const month = temp.getMonth();
        const qIdx = Math.floor(month / 3) + 1;
        let daysInQ = 0;
        for (let m = month; m < month + 3; m++) {
          daysInQ += new Date(year, m + 1, 0).getDate();
        }
        list.push({
          label: `Q${qIdx}`,
          width: daysInQ * pixelsPerDay
        });
        temp.setDate(temp.getDate() + daysInQ);
      }
    }

    return list;
  }, [timelineStart, timelineEnd, pixelsPerDay, zoomMode]);

  // Weekend background highlights (Only in Day zoom mode)
  const weekendBands = useMemo(() => {
    if (zoomMode !== 'day') return [];
    const bands: { left: number; width: number }[] = [];
    const temp = new Date(timelineStart);
    let idx = 0;
    while (temp <= timelineEnd) {
      const day = temp.getDay();
      if (day === 0 || day === 6) {
        bands.push({
          left: idx * pixelsPerDay,
          width: pixelsPerDay
        });
      }
      temp.setDate(temp.getDate() + 1);
      idx++;
    }
    return bands;
  }, [timelineStart, timelineEnd, pixelsPerDay, zoomMode]);

  // Today vertical line coordinate
  const todayX = useMemo(() => {
    const today = new Date();
    return daysBetween(timelineStart, today) * pixelsPerDay;
  }, [timelineStart, pixelsPerDay]);

  const isTodayInTimeline = useMemo(() => {
    const totalTimelineW = totalTimelineDays * pixelsPerDay;
    return todayX >= 0 && todayX <= totalTimelineW;
  }, [todayX, totalTimelineDays, pixelsPerDay]);

  const visibleTasksCount = useMemo(() => {
    return rows.filter(r => r.level === 2).length;
  }, [rows]);

  const totalTasksCountInProject = useMemo(() => {
    let count = 0;
    projectsList.forEach(p => {
      p.assemblies?.forEach(asm => {
        count += asm.tasks?.length || 0;
      });
    });
    return count;
  }, [projectsList]);

  const isFilterActive = searchQuery !== '' || statusFilter !== 'all';

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleUndo = () => {
    if (historyStack.length === 0 || !onUpdateProjectRaw) return;

    const lastEntry = historyStack[historyStack.length - 1];
    const newHistoryStack = historyStack.slice(0, historyStack.length - 1);

    setRedoStack(prev => [...prev, lastEntry]);
    setHistoryStack(newHistoryStack);

    onUpdateProjectRaw(lastEntry.before);

    setToastMsg('Undo: Perubahan terakhir dibatalkan (Ctrl+Z)');
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !onUpdateProjectRaw) return;

    const nextEntry = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, redoStack.length - 1);

    setHistoryStack(prev => [...prev, nextEntry]);
    setRedoStack(newRedoStack);

    onUpdateProjectRaw(nextEntry.after);

    setToastMsg('Redo: Perubahan diterapkan kembali (Ctrl+Y)');
  };

  useEffect(() => {
    const handleUndoRedoKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInput && !e.shiftKey) {
          return;
        }
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleUndoRedoKeyDown);
    return () => window.removeEventListener('keydown', handleUndoRedoKeyDown);
  }, [historyStack, redoStack, onUpdateProjectRaw]);

  // To handle auto dismissal safely
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => {
      setToastMsg(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const todayFormattedShort = useMemo(() => {
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleString('en-US', { month: 'short' });
    return `${day} ${month}`; // e.g. "28 Jun"
  }, []);

  const todayFormattedFull = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }); // e.g. "Sun, 28 Jun 2026"
  }, []);

  // ── S-CURVE FEATURE ──
  const sCurveData = useMemo(() => {
    if (!showSCurve) return null;

    // Only use task-level rows (level === 2), skip milestones
    const taskRows = allRows.filter(r =>
      r.level === 2 && !r.isMilestone && r.start && r.finish
    );

    if (taskRows.length === 0) return null;

    // Each task contributes equal weight (1/N of total progress)
    // For planned: assume linear progress based on actual start/finish
    // For actual:  assume linear progress from start to finish at pct%
    //              (tasks past finish with pct<100 cap at pct)

    const N = taskRows.length;
    const weight = 1 / N; // each task = 1/N of total (0-100 scale)

    // Build day-by-day cumulative arrays
    // Index = day offset from timelineStart
    const totalDays = totalTimelineDays;
    const plannedArr = new Float32Array(totalDays + 1).fill(0);
    const actualArr  = new Float32Array(totalDays + 1).fill(0);

    taskRows.forEach(row => {
      // --- PLANNED curve (based on actual scheduled dates) ---
      const planStart  = parseLocalDate(row.start!);
      const planFinish = parseLocalDate(row.finish!);
      const planDays   = Math.max(1, daysBetween(planStart, planFinish) + 1);

      const planStartIdx  = Math.max(0, daysBetween(timelineStart, planStart));
      const planFinishIdx = Math.min(totalDays, daysBetween(timelineStart, planFinish));

      // Distribute this task's weight linearly across its planned duration
      if (planStartIdx <= planFinishIdx) {
        const increment = weight / planDays;
        for (let d = planStartIdx; d <= planFinishIdx; d++) {
          plannedArr[d] = (plannedArr[d] || 0) + increment;
        }
      }

      // --- ACTUAL curve ---
      const actStart  = parseLocalDate(row.start!);
      const actFinish = parseLocalDate(row.finish!);
      const actDays   = Math.max(1, daysBetween(actStart, actFinish) + 1);

      const actStartIdx  = Math.max(0, daysBetween(timelineStart, actStart));
      const actFinishIdx = Math.min(totalDays, daysBetween(timelineStart, actFinish));

      // Progress portion this task has actually completed
      const completedFraction = (row.pct || 0) / 100;

      // Distribute completed progress linearly up to finish
      // For tasks past due with pct<100, show flat line after their finish
      if (actStartIdx <= actFinishIdx) {
        const increment = (weight * completedFraction) / actDays;
        for (let d = actStartIdx; d <= actFinishIdx; d++) {
          actualArr[d] = (actualArr[d] || 0) + increment;
        }
      }
    });

    // Convert to cumulative (prefix sum), scale to 0–100
    let plannedCum = 0;
    let actualCum  = 0;
    const points: { day: number; planned: number; actual: number }[] = [];

    for (let d = 0; d <= totalDays; d++) {
      plannedCum = Math.min(100, plannedCum + (plannedArr[d] || 0) * 100);
      actualCum = Math.min(100, actualCum + (actualArr[d] || 0) * 100);
      // Sample every 3 days to reduce SVG path complexity (or every 1 day if short)
      const sampleInterval = totalDays < 7 ? 1 : 3;
      if (d % sampleInterval === 0 || d === totalDays) {
        points.push({ day: d, planned: plannedCum, actual: actualCum });
      }
    }

    return points; // array of { day, planned, actual }
  }, [showSCurve, allRows, timelineStart, totalTimelineDays]);

  const SCURVE_H = 60;  // chart height in px

  const sCurvePaths = useMemo(() => {
    if (!sCurveData || sCurveData.length === 0) return null;

    const toX = (day: number) => day * pixelsPerDay;
    const toY = (pct: number) => SCURVE_H - (pct / 100) * (SCURVE_H - 4) - 2;

    const buildPath = (key: 'planned' | 'actual') => {
      return sCurveData
        .map((pt, i) =>
          `${i === 0 ? 'M' : 'L'} ${toX(pt.day).toFixed(1)} ${toY(pt[key]).toFixed(1)}`
        )
        .join(' ');
    };

    return {
      planned: buildPath('planned'),
      actual:  buildPath('actual'),
      totalWidth: totalTimelineDays * pixelsPerDay,
    };
  }, [sCurveData, pixelsPerDay, totalTimelineDays]);

  // Daily Resource Load & Man-Hours Calculation Engine
  const resourceLoadData = useMemo(() => {
    if (!showResourceLoad) return null;

    // Filter level 2 task rows with valid start and finish dates
    const taskRows = allRows.filter(r => r.level === 2 && r.type === 'task' && r.start && r.finish);

    const employeeMap = new Map<string, {
      name: string;
      company: string;
      dailyHours: Float32Array;
      dailyTasks: Map<number, Array<{ taskId: string; taskName: string; wbs: string; project: string; hours: number }>>;
      assignedTasks: Array<{ id: string; name: string; wbs: string; start: string; finish: string; company?: string }>;
    }>();

    taskRows.forEach(row => {
      const rawAssigned = row.assigned && row.assigned.trim() !== '' ? row.assigned : 'Unassigned';
      const assignees = rawAssigned
        .split(/[,/&]+/)
        .map(s => s.trim())
        .filter(Boolean);

      const startD = parseLocalDate(row.start!);
      const finishD = parseLocalDate(row.finish!);
      const startIdx = Math.max(0, daysBetween(timelineStart, startD));
      const finishIdx = Math.min(totalTimelineDays, daysBetween(timelineStart, finishD));

      // Standard allocation = 8 man-hours per day per assigned person
      const dailyHoursPerPerson = 8;

      assignees.forEach(empName => {
        let empRecord = employeeMap.get(empName);
        if (!empRecord) {
          empRecord = {
            name: empName,
            company: row.assignedCompany || (empName === 'Unassigned' ? 'System' : 'Internal'),
            dailyHours: new Float32Array(totalTimelineDays + 1).fill(0),
            dailyTasks: new Map(),
            assignedTasks: []
          };
          employeeMap.set(empName, empRecord);
        }

        if (!empRecord.assignedTasks.some(t => t.id === row.id)) {
          empRecord.assignedTasks.push({
            id: row.id,
            name: row.name,
            wbs: row.wbs,
            start: row.start!,
            finish: row.finish!,
            company: row.assignedCompany
          });
        }

        if (startIdx <= finishIdx) {
          for (let d = startIdx; d <= finishIdx; d++) {
            empRecord.dailyHours[d] += dailyHoursPerPerson;

            if (!empRecord.dailyTasks.has(d)) {
              empRecord.dailyTasks.set(d, []);
            }
            empRecord.dailyTasks.get(d)!.push({
              taskId: row.id,
              taskName: row.name,
              wbs: row.wbs,
              project: 'Task',
              hours: dailyHoursPerPerson
            });
          }
        }
      });
    });

    const resourceList = Array.from(employeeMap.values()).map(emp => {
      let totalHours = 0;
      let conflictDaysCount = 0;
      let maxDailyHours = 0;

      for (let d = 0; d <= totalTimelineDays; d++) {
        const h = emp.dailyHours[d];
        totalHours += h;
        if (h > maxDailyHours) maxDailyHours = h;
        if (h > dailyCapacityLimit) {
          conflictDaysCount++;
        }
      }

      return {
        ...emp,
        totalHours,
        conflictDaysCount,
        maxDailyHours
      };
    });

    // Sort resources: employees with conflicts first, then total hours, then alphabetically
    resourceList.sort((a, b) => {
      if (b.conflictDaysCount !== a.conflictDaysCount) {
        return b.conflictDaysCount - a.conflictDaysCount;
      }
      if (b.totalHours !== a.totalHours) {
        return b.totalHours - a.totalHours;
      }
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return a.name.localeCompare(b.name);
    });

    const filteredList = resourceList.filter(emp => {
      const q = resourceSearch.trim().toLowerCase();
      const matchesSearch = q === '' ||
        emp.name.toLowerCase().includes(q) ||
        emp.company.toLowerCase().includes(q);

      const matchesFilter = resourceFilter === 'all' || (resourceFilter === 'conflicts' && emp.conflictDaysCount > 0);

      return matchesSearch && matchesFilter;
    });

    const totalResources = resourceList.length;
    const totalOverloadedEmployees = resourceList.filter(r => r.conflictDaysCount > 0).length;
    const totalConflictDaysOverall = resourceList.reduce((acc, r) => acc + r.conflictDaysCount, 0);

    return {
      resourceList: filteredList,
      totalResources,
      totalOverloadedEmployees,
      totalConflictDaysOverall
    };
  }, [allRows, timelineStart, totalTimelineDays, dailyCapacityLimit, showResourceLoad, resourceFilter, resourceSearch]);

  const scrollToToday = () => {
    if (!rightScrollRef.current) return;
    if (!isTodayInTimeline) {
      setToastMsg("Today is outside the current timeline range.");
      return;
    }
    const scrollTo = Math.max(0, todayX - (rightScrollRef.current.clientWidth / 2));
    rightScrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
  };

  const hasAutoScrolled = useRef(false);
  const prevZoomModeRef = useRef<string | null>(null);

  // Auto-scroll on mount and zoom change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasAutoScrolled.current) {
        scrollToToday();
        hasAutoScrolled.current = true;
        prevZoomModeRef.current = zoomMode;
      } else if (prevZoomModeRef.current !== zoomMode) {
        scrollToToday();
        prevZoomModeRef.current = zoomMode;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [todayX, zoomMode]);

  // Keyboard shortcut Ctrl+F / Cmd+F to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // AUTO-SCHEDULE FEATURE KEYBOARD SHORTCUT
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+A = toggle Auto-Schedule
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setAutoSchedule(prev => {
          const next = !prev;
          // Brief toast-like feedback via title
          document.title = `Auto-Schedule ${next ? 'ON' : 'OFF'} — ${document.title}`;
          setTimeout(() => {
            document.title = document.title.replace(/^Auto-Schedule (ON|OFF) — /, '');
          }, 2000);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);



  // Drag listeners handler
  const handleBarMouseDown = (row: GanttRow, type: 'move' | 'resize' | 'resize-left', e: React.MouseEvent) => {
    if (!onUpdateProject || !row.start || !row.finish) return;
    e.preventDefault();
    setDragState({
      rowId: row.id,
      type,
      initialX: e.clientX,
      initialStart: row.start,
      initialFinish: row.finish,
      parentAsmId: row.parentAsmId,
      rowType: row.type,
      tempStart: row.start,
      tempFinish: row.finish
    });
  };

  const handleBarTouchStart = (row: GanttRow, type: 'move' | 'resize' | 'resize-left', e: React.TouchEvent) => {
    if (!onUpdateProject || !row.start || !row.finish) return;
    
    setIsTouchDragging(true);

    // Apply grabbing style and user-select: none to body
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.cursor = 'grabbing';

    setDragState({
      rowId: row.id,
      type,
      initialX: e.touches[0].clientX,
      initialStart: row.start,
      initialFinish: row.finish,
      parentAsmId: row.parentAsmId,
      rowType: row.type,
      tempStart: row.start,
      tempFinish: row.finish
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.initialX;
      const deltaDays = Math.round(deltaX / pixelsPerDay);

      if (dragState.type === 'move') {
        const nextStart = addDaysToLocalDate(dragState.initialStart, deltaDays);
        const nextFinish = addDaysToLocalDate(dragState.initialFinish, deltaDays);
        setDragState(prev => prev ? { ...prev, tempStart: nextStart, tempFinish: nextFinish } : null);
      } else if (dragState.type === 'resize') {
        let nextFinish = addDaysToLocalDate(dragState.initialFinish, deltaDays);
        if (new Date(nextFinish) < new Date(dragState.initialStart)) {
          nextFinish = dragState.initialStart;
        }
        setDragState(prev => prev ? { ...prev, tempFinish: nextFinish } : null);
      } else if (dragState.type === 'resize-left') {
        let nextStart = addDaysToLocalDate(dragState.initialStart, deltaDays);
        if (new Date(nextStart) > new Date(dragState.initialFinish)) {
          nextStart = dragState.initialFinish;
        }
        setDragState(prev => prev ? { ...prev, tempStart: nextStart } : null);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - dragState.initialX;
      const deltaDays = Math.round(deltaX / pixelsPerDay);

      if (dragState.type === 'move') {
        const nextStart = addDaysToLocalDate(dragState.initialStart, deltaDays);
        const nextFinish = addDaysToLocalDate(dragState.initialFinish, deltaDays);
        setDragState(prev => prev ? { ...prev, tempStart: nextStart, tempFinish: nextFinish } : null);
      } else if (dragState.type === 'resize') {
        let nextFinish = addDaysToLocalDate(dragState.initialFinish, deltaDays);
        if (new Date(nextFinish) < new Date(dragState.initialStart)) {
          nextFinish = dragState.initialStart;
        }
        setDragState(prev => prev ? { ...prev, tempFinish: nextFinish } : null);
      } else if (dragState.type === 'resize-left') {
        let nextStart = addDaysToLocalDate(dragState.initialStart, deltaDays);
        if (new Date(nextStart) > new Date(dragState.initialFinish)) {
          nextStart = dragState.initialFinish;
        }
        setDragState(prev => prev ? { ...prev, tempStart: nextStart } : null);
      }
      e.preventDefault();
    };

    const handleMouseUp = () => {
      // Clean body styles
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';
      setIsTouchDragging(false);

      if (dragState.tempStart && dragState.tempFinish) {
        const hasChanged = dragState.tempStart !== dragState.initialStart || dragState.tempFinish !== dragState.initialFinish;
        if (hasChanged) {
          const res = findAndCloneProject(dragState.rowId);
          if (res) {
            const targetProj = res.cloned;

            if (dragState.rowType === 'project') {
              // Level 0 Project: Update project.start, project.due, and cascade deltaDays
              const dStart = parseLocalDate(dragState.initialStart);
              const dTempStart = parseLocalDate(dragState.tempStart);
              const deltaDays = daysBetween(dStart, dTempStart);

              const updatedAssemblies = (targetProj.assemblies || []).map(asm => {
                const updatedTasks = (asm.tasks || []).map(t => {
                  const curStart = t.startDate || t.date;
                  const curFinish = t.endDate || t.finishDate;
                  const nextTaskStart = curStart ? addDaysToLocalDate(curStart, deltaDays) : curStart;
                  const nextTaskFinish = curFinish ? addDaysToLocalDate(curFinish, deltaDays) : curFinish;
                  return {
                    ...t,
                    date: nextTaskStart,
                    finishDate: nextTaskFinish,
                    startDate: nextTaskStart,
                    endDate: nextTaskFinish
                  };
                });

                return {
                  ...asm,
                  start: asm.start ? addDaysToLocalDate(asm.start, deltaDays) : asm.start,
                  finish: asm.finish ? addDaysToLocalDate(asm.finish, deltaDays) : asm.finish,
                  tasks: updatedTasks
                };
              });

              const baseUpdated = {
                ...targetProj,
                start: dragState.tempStart,
                due: dragState.tempFinish,
                assemblies: updatedAssemblies
              };

              const { updatedProject, shiftedIds } = cascadeSchedule(baseUpdated, dragState.rowId);
              if (shiftedIds.size > 0) {
                setCascadedTaskIds(shiftedIds);
              }
              onUpdateProject && onUpdateProject(updatedProject);
            } else if (dragState.rowType === 'assembly') {
              // Level 1 Assembly: Update assembly start and finish and cascade deltaDays to child tasks
              const dStart = parseLocalDate(dragState.initialStart);
              const dTempStart = parseLocalDate(dragState.tempStart);
              const deltaDays = daysBetween(dStart, dTempStart);

              const updatedAssemblies = (targetProj.assemblies || []).map(asm => {
                if (asm.id !== dragState.rowId) return asm;

                const updatedTasks = (asm.tasks || []).map(t => {
                  const curStart = t.startDate || t.date;
                  const curFinish = t.endDate || t.finishDate;
                  const nextTaskStart = curStart ? addDaysToLocalDate(curStart, deltaDays) : curStart;
                  const nextTaskFinish = curFinish ? addDaysToLocalDate(curFinish, deltaDays) : curFinish;
                  return {
                    ...t,
                    date: nextTaskStart,
                    finishDate: nextTaskFinish,
                    startDate: nextTaskStart,
                    endDate: nextTaskFinish
                  };
                });

                return {
                  ...asm,
                  start: dragState.tempStart,
                  finish: dragState.tempFinish,
                  tasks: updatedTasks
                };
              });

              const baseUpdated = {
                ...targetProj,
                assemblies: updatedAssemblies
              };

              const { updatedProject, shiftedIds } = cascadeSchedule(baseUpdated, dragState.rowId);
              if (shiftedIds.size > 0) {
                setCascadedTaskIds(shiftedIds);
              }
              onUpdateProject && onUpdateProject(updatedProject);
            } else if (dragState.rowType === 'task') {
              // Level 2 Task: Update the single task startDate and endDate
              const updatedAssemblies = (targetProj.assemblies || []).map(asm => {
                if (asm.id !== dragState.parentAsmId) return asm;
                return {
                  ...asm,
                  tasks: (asm.tasks || []).map(t => {
                    if (t.id !== dragState.rowId) return t;
                    return {
                      ...t,
                      date: dragState.tempStart,
                      finishDate: dragState.tempFinish,
                      startDate: dragState.tempStart,
                      endDate: dragState.tempFinish
                    };
                  })
                };
              });

              const baseUpdated = {
                ...targetProj,
                assemblies: updatedAssemblies
              };

              const { updatedProject, shiftedIds } = cascadeSchedule(baseUpdated, dragState.rowId);
              if (shiftedIds.size > 0) {
                setCascadedTaskIds(shiftedIds);
              }
              onUpdateProject && onUpdateProject(updatedProject);
            }
          }
        }
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);

      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragState, pixelsPerDay, project, projectsList, onUpdateProject]);

  // Precomputed Map of row coordinate helper supporting real-time drag adjustments
  const rowBarCoordsCache = useMemo(() => {
    const cache = new Map<string, { left: number; width: number } | null>();
    rows.forEach(row => {
      let startStr = row.start;
      let finishStr = row.finish;

      if (dragState && dragState.rowId === row.id) {
        startStr = dragState.tempStart || row.start;
        finishStr = dragState.tempFinish || row.finish;
      }

      if (!startStr) {
        cache.set(row.id, null);
        return;
      }
      const startD = parseLocalDate(startStr);
      const left = daysBetween(timelineStart, startD) * pixelsPerDay;
      
      let width = 0;
      if (!row.isMilestone) {
        const finishD = finishStr ? parseLocalDate(finishStr) : startD;
        const duration = Math.max(1, daysBetween(startD, finishD) + 1);
        width = duration * pixelsPerDay;
      }
      cache.set(row.id, { left, width });
    });
    return cache;
  }, [rows, timelineStart, pixelsPerDay, dragState]);

  // Precomputed Map of baseline bar coordinates (fixed target schedule, independent of drag)
  const rowBaselineCoordsCache = useMemo(() => {
    const cache = new Map<string, { left: number; width: number } | null>();
    rows.forEach(row => {
      if (!row.baselineStart) {
        cache.set(row.id, null);
        return;
      }
      const bStartD = parseLocalDate(row.baselineStart);
      const left = daysBetween(timelineStart, bStartD) * pixelsPerDay;
      const bFinishD = row.baselineFinish ? parseLocalDate(row.baselineFinish) : bStartD;
      const duration = Math.max(1, daysBetween(bStartD, bFinishD) + 1);
      const width = row.isMilestone ? 14 : Math.max(8, duration * pixelsPerDay);
      cache.set(row.id, { left, width });
    });
    return cache;
  }, [rows, timelineStart, pixelsPerDay]);

  // Generate SVG dependency path lines
  const arrows = useMemo(() => {
    if (!showArrows) return [];
    const list: {
      id: string;
      sourceRowId: string;
      targetRowId: string;
      sourceWbs: string;
      targetWbs: string;
      sourceName: string;
      targetName: string;
      depType: string;
      lag?: number;
      path: string;
      midX: number;
      midY: number;
      isCritical: boolean;
      isConflict: boolean;
      markerEnd: string;
    }[] = [];

    rows.forEach((targetRow, targetIdx) => {
      if (!targetRow.predecessors) return;

      targetRow.predecessors.forEach(dep => {
        const sourceRowIdx = rowIndexMap[dep.key];
        if (sourceRowIdx === undefined) return; // predecessor row is collapsed or hidden

        // Performance Optimization: Skip dependency lines where BOTH source and target
        // are completely outside the visible viewport window (with safe margin)
        if (!isExporting) {
          const arrowMinRow = Math.max(0, startIndex - 6);
          const arrowMaxRow = Math.min(rows.length - 1, endIndex + 6);
          if (Math.max(sourceRowIdx, targetIdx) < arrowMinRow || Math.min(sourceRowIdx, targetIdx) > arrowMaxRow) {
            return;
          }
        }

        const sourceRow = rows[sourceRowIdx];
        const sourceCoords = rowBarCoordsCache.get(sourceRow.id);
        const targetCoords = rowBarCoordsCache.get(targetRow.id);

        if (!sourceCoords || !targetCoords) return;

        const sy = sourceRowIdx * 32 + 16;
        const ty = targetIdx * 32 + 16;

        const isConflict = dependencyViolationsMap.get(targetRow.id)?.some(c => c.predId === sourceRow.id) ?? false;
        const isCritical = criticalPathIds.has(sourceRow.id) && criticalPathIds.has(targetRow.id);

        let path = '';
        let midX = 0;
        let midY = (sy + ty) / 2;
        const markerEnd = isConflict ? 'url(#arrow-conflict)' : (isCritical ? 'url(#arrow-critical)' : 'url(#arrow-right)');

        const sx_start = sourceCoords.left;
        const sx_end = sourceCoords.left + sourceCoords.width;
        const tx_start = targetCoords.left;
        const tx_end = targetCoords.left + targetCoords.width;

        if (dep.type === 'FS') {
          const sx = sx_end + 3;
          const tx = tx_start - 6;
          if (tx >= sx + 12) {
            const mX = sx + Math.max(6, (tx - sx) / 2);
            path = `M ${sx} ${sy} H ${mX} V ${ty} H ${tx}`;
            midX = mX;
          } else {
            const rightMargin = sx + 12;
            const leftMargin = Math.min(sx_start, tx_start) - 16;
            const mY = (sy + ty) / 2;
            path = `M ${sx} ${sy} H ${rightMargin} V ${mY} H ${leftMargin} V ${ty} H ${tx}`;
            midX = (leftMargin + rightMargin) / 2;
            midY = mY;
          }
        } else if (dep.type === 'SS') {
          const sx = sx_start - 3;
          const tx = tx_start - 6;
          const minX = Math.min(sx_start, tx_start) - 16;
          path = `M ${sx} ${sy} H ${minX} V ${ty} H ${tx}`;
          midX = minX;
        } else if (dep.type === 'FF') {
          const sx = sx_end + 3;
          const tx = tx_end + 6;
          const maxX = Math.max(sx_end, tx_end) + 16;
          path = `M ${sx} ${sy} H ${maxX} V ${ty} H ${tx}`;
          midX = maxX;
        } else if (dep.type === 'SF') {
          const sx = sx_start - 3;
          const tx = tx_end + 6;
          const mY = (sy + ty) / 2;
          path = `M ${sx} ${sy} H ${sx - 10} V ${mY} H ${tx + 10} V ${ty} H ${tx}`;
          midX = (sx - 10 + tx + 10) / 2;
          midY = mY;
        }

        list.push({
          id: `${sourceRow.id}->${targetRow.id}`,
          sourceRowId: sourceRow.id,
          targetRowId: targetRow.id,
          sourceWbs: sourceRow.wbs,
          targetWbs: targetRow.wbs,
          sourceName: sourceRow.name,
          targetName: targetRow.name,
          depType: dep.type || 'FS',
          lag: dep.lag,
          path,
          midX,
          midY,
          isCritical,
          isConflict,
          markerEnd
        });
      });
    });

    return list;
  }, [rows, rowIndexMap, timelineStart, pixelsPerDay, showArrows, criticalPathIds, dependencyViolationsMap, startIndex, endIndex, isExporting]);

  const handleMouseEnter = (row: GanttRow, event: React.MouseEvent) => {
    if (isTouchDragging) return;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const parent = event.currentTarget.closest('.gantt-relative-container');
    const parentRect = parent?.getBoundingClientRect();

    const x = rect.left - (parentRect?.left || 0) + rect.width / 2;
    const y = rect.top - (parentRect?.top || 0) - 10;
    setHoveredTask({ row, x, y });
  };

  const handleMouseLeave = () => {
    setHoveredTask(null);
  };

  const getStatusColorClass = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'bg-base-blue-dim text-base-blue border-base-blue/20';
      case 'pending': return 'bg-yellow-400/10 text-yellow-600 border-yellow-500/20';
      case 'completed': return 'bg-base-green-dim text-base-green border-base-green/20';
      case 'on-hold': return 'bg-base-border/50 text-base-muted2 border-base-border';
      default: return 'bg-base-surface3 text-base-muted';
    }
  };

  // Fixed widths representing authentic MS Project layout columns (with WBS column)
  const colWbsWidth = 56;
  const colNameWidth = 200;
  const colDurWidth = 64;
  const colPlanHrsWidth = 68;
  const colActHrsWidth = 68;
  const colVarianceWidth = 72;
  const colCrewWidth = 50;
  const colCompanyWidth = 105;
  const colAssigneeWidth = 105;
  const colBaseStartWidth = 75;
  const colBaseFinishWidth = 75;
  const colStartWidth = 85;
  const colFinishWidth = 85;
  const colPredWidth = 90;
  const colPctWidth = 64;
  const colStatusWidth = 100;
  const totalTableWidth = colWbsWidth + colNameWidth + colDurWidth 
    + (showHoursTracking ? (colPlanHrsWidth + colActHrsWidth + colVarianceWidth) : 0)
    + (showBaseline ? (colBaseStartWidth + colBaseFinishWidth) : 0)
    + (activeTab === 'lookahead' ? (colCrewWidth + colCompanyWidth + colAssigneeWidth) : 0)
    + colStartWidth + colFinishWidth + colPredWidth + colPctWidth + colStatusWidth;

  if (!isFullscreen) {
    return (
      <div className="w-full flex flex-col items-center justify-center border border-base-border rounded-2xl p-8 sm:p-12 text-center bg-base-surface shadow-xs my-2 relative overflow-hidden">
        {/* Background ambient glow decoration */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-base-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-base-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl flex flex-col items-center">
          {/* Glowing Icon Box */}
          <div className="h-16 w-16 rounded-2xl bg-base-accent/15 border border-base-accent/30 flex items-center justify-center text-base-accent mb-5 shadow-xs">
            <Maximize2 className="h-8 w-8 animate-pulse" />
          </div>

          {/* Title & Badge */}
          <h2 className="font-condensed font-black text-2xl sm:text-3xl tracking-tight text-base-text uppercase">
            Project Schedule & Gantt Timeline
          </h2>

          <div className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-base-accent/10 border border-base-accent/20 text-base-accent text-xs font-condensed font-bold uppercase tracking-wider">
            <Monitor className="h-3.5 w-3.5" />
            <span>Wajib Mode Full Screen (Mandatory Fullscreen)</span>
          </div>

          {/* Target Month Selector on Gate Screen */}
          {setSelectedMonth && availableMonths && (
            <div className="mt-5 w-full bg-base-surface2 border border-base-border rounded-xl p-3.5 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="gate-month-select" className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wider shrink-0">
                  Target Month:
                </label>
                <div className="relative shrink-0">
                  <select
                    id="gate-month-select"
                    value={selectedMonth || 'ALL'}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none bg-base-surface hover:bg-base-surface2 border border-base-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-base-text font-condensed uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-base-accent transition-all min-w-[200px]"
                  >
                    <option value="ALL">ALL PROJECTS (SEMUA PROYEK)</option>
                    {availableMonths.map((m) => {
                      const [yr, mo] = m.split('-').map(Number);
                      const date = new Date(yr, mo - 1, 1);
                      const label = isNaN(date.getTime()) ? m : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
                      return (
                        <option key={m} value={m}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-base-muted text-[10px]">
                    ▼
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-condensed font-bold text-base-muted uppercase tracking-wider cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-base-border text-base-accent cursor-pointer"
                />
                Show Completed Projects
              </label>
            </div>
          )}

          {/* Explanation */}
          <p className="text-xs sm:text-sm text-base-muted font-sans mt-4 leading-relaxed max-w-md">
            Untuk analisis timeline, alur keterkaitan task (<em>dependencies</em>), serta S-Curve secara presisi tanpa hambatan ruang, Project Schedule wajib dibuka dalam mode <strong>Layar Penuh (Full Screen)</strong>.
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6 mb-8 text-left">
            <div className="p-3 bg-base-surface2 border border-base-border rounded-xl">
              <div className="flex items-center gap-2 text-xs font-condensed font-bold text-base-text uppercase">
                <BarChart3 className="h-4 w-4 text-base-accent" />
                <span>Full Timeline</span>
              </div>
              <p className="text-[11px] text-base-muted mt-1">Bebas hambatan scroll & visualisasi luas</p>
            </div>
            <div className="p-3 bg-base-surface2 border border-base-border rounded-xl">
              <div className="flex items-center gap-2 text-xs font-condensed font-bold text-base-text uppercase">
                <Layers className="h-4 w-4 text-base-accent" />
                <span>Interactive Drag</span>
              </div>
              <p className="text-[11px] text-base-muted mt-1">Ubah durasi & jadwal langsung di grafik</p>
            </div>
            <div className="p-3 bg-base-surface2 border border-base-border rounded-xl">
              <div className="flex items-center gap-2 text-xs font-condensed font-bold text-base-text uppercase">
                <Sparkles className="h-4 w-4 text-base-accent" />
                <span>Dependencies</span>
              </div>
              <p className="text-[11px] text-base-muted mt-1">Hubungkan alur antar sub-assembly presisi</p>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleEnterFullscreen}
            className="group flex items-center justify-center gap-3 px-8 py-3.5 bg-[#9b1c2e] hover:bg-[#7a1624] text-white rounded-xl font-condensed font-black uppercase tracking-wider text-sm shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Maximize2 className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span>Buka Project Schedule (Full Screen)</span>
          </button>

          <p className="text-[11px] text-base-muted mt-3">
            Klik tombol di atas untuk membuka jadwal proyek dalam mode Layar Penuh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] p-4 sm:p-6 flex flex-col overflow-hidden h-screen w-screen bg-base-bg text-base-text transition-all duration-200">
      {/* TOOLBAR PANEL */}
      <div className="flex flex-col gap-3 pb-4 border-b border-base-border mb-4 sticky top-0 bg-base-bg/95 z-30 backdrop-blur-xs">
        {/* Row 1: Title, Info, and Close Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-condensed font-extrabold text-lg sm:text-xl tracking-tight flex items-center gap-2 min-w-0">
              <span className="shrink-0">📊</span>
              <span className="truncate" title={projectsList.length > 1 ? "All Scheduled Projects" : projectsList[0]?.name || "Project"}>
                Gantt Chart — <span className="text-base-accent font-black">{projectsList.length > 1 ? "All Scheduled Projects" : projectsList[0]?.name || "Project"}</span>
              </span>
            </h2>
            {projectsList.length === 1 && projectsList[0] && (
              <span className={`px-2 py-0.5 rounded font-condensed font-bold text-[10px] uppercase tracking-wider border shrink-0 ${getStatusColorClass(projectsList[0].status)}`}>
                {projectsList[0].status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExitFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider text-base-accent hover:text-white bg-base-accent/10 hover:bg-base-accent border border-base-accent/30 transition-all rounded-lg cursor-pointer shrink-0"
              title="Keluar dari mode Layar Penuh"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Keluar Full Screen</span>
            </button>
            {onClose && (
              <button 
                onClick={onClose} 
                className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted hover:text-base-red transition-colors rounded-lg cursor-pointer shrink-0 border border-base-border hover:bg-base-surface bg-base-surface/30 h-[34px]"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Action Controls (stable, overflow-visible container, wraps on small screens) */}
        <div className="flex items-center gap-3 text-xs overflow-visible py-1 w-full flex-wrap shrink-0">
          {/* Target Month Selector inside Fullscreen Toolbar */}
          {setSelectedMonth && availableMonths && (
            <div className="flex items-center gap-1.5 bg-base-surface border border-base-border rounded-xl px-2.5 py-1 h-[34px] shrink-0 shadow-2xs">
              <span className="text-[10px] font-condensed font-bold uppercase text-base-accent shrink-0 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Target Month:</span>
              </span>
              <select
                value={selectedMonth || 'ALL'}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-condensed font-bold uppercase tracking-wide text-base-text outline-none cursor-pointer min-w-[150px]"
              >
                <option value="ALL" className="bg-base-surface text-base-text">ALL PROJECTS (SEMUA PROYEK)</option>
                {availableMonths.map((m) => {
                  const [yr, mo] = m.split('-').map(Number);
                  const date = new Date(yr, mo - 1, 1);
                  const label = isNaN(date.getTime()) ? m : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
                  return (
                    <option key={m} value={m} className="bg-base-surface text-base-text">
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <label className="flex items-center gap-1.5 px-2.5 py-1 bg-base-surface border border-base-border rounded-xl h-[34px] text-[10px] font-condensed font-bold text-base-muted hover:text-base-text uppercase tracking-wider cursor-pointer select-none shrink-0 shadow-2xs">
            <input
              type="checkbox"
              checked={!!showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-base-border text-base-accent cursor-pointer"
            />
            <span>Show Completed</span>
          </label>

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Main View Tab Switcher: Gantt vs Lookahead */}
          <div className="relative flex items-center bg-base-surface border border-base-border rounded-xl p-0.5 h-[34px] shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('gantt')}
              className={`relative z-10 px-3 py-1 rounded-lg font-condensed font-extrabold uppercase text-[10px] tracking-wider transition-colors duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'gantt' ? 'text-white' : 'text-base-muted hover:text-base-text'
              }`}
            >
              {activeTab === 'gantt' && (
                <motion.div
                  layoutId="ganttMainTabPill"
                  className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Layers className="w-3.5 h-3.5" />
              <span>Gantt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('lookahead')}
              className={`relative z-10 px-3 py-1 rounded-lg font-condensed font-extrabold uppercase text-[10px] tracking-wider transition-colors duration-200 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'lookahead' ? 'text-white' : 'text-base-muted hover:text-base-text'
              }`}
            >
              {activeTab === 'lookahead' && (
                <motion.div
                  layoutId="ganttMainTabPill"
                  className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Lookahead</span>
            </button>
          </div>

          {/* Lookahead Range Selector (only shown when Lookahead tab is active) */}
          {activeTab === 'lookahead' && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1 h-[34px] shrink-0">
              <span className="text-[10px] font-condensed font-bold uppercase text-amber-600 dark:text-amber-400 shrink-0">
                Range:
              </span>
              <select
                value={lookaheadWeeks}
                onChange={(e) => setLookaheadWeeks(Number(e.target.value))}
                className="bg-transparent text-xs font-mono font-bold text-amber-700 dark:text-amber-300 outline-none cursor-pointer"
              >
                <option value={1} className="bg-base-surface text-base-text">1 minggu ke depan</option>
                <option value={2} className="bg-base-surface text-base-text">2 minggu ke depan</option>
                <option value={3} className="bg-base-surface text-base-text">3 minggu ke depan</option>
                <option value={4} className="bg-base-surface text-base-text">4 minggu ke depan</option>
                <option value={5} className="bg-base-surface text-base-text">5 minggu ke depan</option>
                <option value={6} className="bg-base-surface text-base-text">6 minggu ke depan</option>
              </select>
            </div>
          )}

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Today Button */}
          <button 
            onClick={scrollToToday}
            className="flex items-center gap-2 px-3 py-1 rounded-xl border border-base-border hover:bg-base-surface transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text bg-base-surface/40 h-[34px] shrink-0"
            title="Scroll to today"
          >
            <Calendar className="h-3.5 w-3.5 text-base-red shrink-0" />
            <div className="flex flex-col items-start text-left shrink-0">
              <span className="text-[9px] leading-tight font-extrabold">Today</span>
              <span className="text-[7.5px] leading-none text-base-muted font-normal lowercase tracking-wide font-mono">{todayFormattedShort}</span>
            </div>
          </button>

          {/* Search bar & Status Filter */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center shrink-0">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-base-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="pl-8 pr-2.5 py-1.5 text-xs bg-base-surface border border-base-border rounded-xl outline-none focus:border-base-accent w-[150px] h-[34px] font-medium"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-base-surface border border-base-border rounded-xl outline-none focus:border-base-accent h-[34px] cursor-pointer font-medium text-base-muted2 focus:text-base-text shrink-0"
              >
                <option value="all">All Status</option>
                <option value="on-track">On Track</option>
                <option value="overdue">Overdue</option>
                <option value="done">Done</option>
                <option value="not-started">Not Started</option>
              </select>

              {isFilterActive && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-2.5 py-1.5 text-xs hover:text-base-red transition-all flex items-center justify-center bg-base-surface border border-base-border rounded-xl h-[34px] cursor-pointer font-bold gap-1 text-base-muted2 shrink-0"
                  title="Clear filters"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Zoom Level Toggle Buttons with layoutId */}
          <div className="relative flex items-center bg-base-surface2 border border-base-border rounded-xl p-0.5 h-[34px] shrink-0">
            {['day', 'week', 'month', 'quarter'].map((mode) => (
              <button
                key={mode}
                onClick={() => setZoomMode(mode as any)}
                className={`relative z-10 px-2.5 py-1 rounded-lg font-condensed font-extrabold uppercase text-[10px] tracking-wider transition-colors duration-200 cursor-pointer shrink-0 ${
                  zoomMode === mode ? 'text-white' : 'text-base-muted hover:text-base-text'
                }`}
              >
                {zoomMode === mode && (
                  <motion.div
                    layoutId="ganttZoomPill"
                    className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {mode}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Expand/Collapse All Buttons */}
          <div className="flex items-center bg-base-surface border border-base-border rounded-xl p-0.5 h-[34px] shrink-0">
            <button 
              onClick={expandAllAssemblies} 
              className="px-2.5 py-1 rounded-lg font-condensed font-bold uppercase transition-all cursor-pointer text-[10px] tracking-wider text-base-muted hover:text-base-text flex items-center gap-1 shrink-0"
              title="Expand All Projects & Tasks"
            >
              <Maximize2 className="h-3 w-3 text-current shrink-0" />
              <span>Expand</span>
            </button>
            <div className="w-[1px] h-3 bg-base-border mx-1 shrink-0" />
            <button 
              onClick={collapseAllAssemblies} 
              className="px-2.5 py-1 rounded-lg font-condensed font-bold uppercase transition-all cursor-pointer text-[10px] tracking-wider text-base-muted hover:text-base-text flex items-center gap-1 shrink-0"
              title="Collapse All Projects"
            >
              <Minimize2 className="h-3 w-3 text-current shrink-0" />
              <span>Collapse</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Display Settings Dropdown */}
          <div className="relative shrink-0" ref={prefsDropdownRef}>
            <button
              onClick={() => setIsPrefsDropdownOpen(!isPrefsDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base-border hover:bg-base-surface transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text bg-base-surface/30 h-[34px] shrink-0"
              title="Configure chart visibility preferences"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>Gantt Settings</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </button>
            {isPrefsDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-base-surface border border-base-border rounded-xl shadow-xl p-3.5 z-[150] space-y-3 font-sans">
                <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted mb-2 pb-1 border-b border-base-border/50">
                  Toggle Layer Views
                </div>
                
                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Show Arrows</span>
                  <input 
                    type="checkbox" 
                    checked={showArrows} 
                    onChange={e => setShowArrows(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Show Progress</span>
                  <input 
                    type="checkbox" 
                    checked={showProgress} 
                    onChange={e => setShowProgress(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Critical Path</span>
                  <input 
                    type="checkbox" 
                    checked={showCriticalPath} 
                    onChange={e => setShowCriticalPath(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">S-Curve Overlay</span>
                  <input 
                    type="checkbox" 
                    checked={showSCurve} 
                    onChange={e => setShowSCurve(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Resource Load View</span>
                  <input 
                    type="checkbox" 
                    checked={showResourceLoad} 
                    onChange={e => setShowResourceLoad(e.target.checked)}
                    className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Plan vs Actual Hours</span>
                    <span className="text-[8.5px] text-base-muted font-mono">Timesheet Integration</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showHoursTracking} 
                    onChange={e => {
                      const nextVal = e.target.checked;
                      setShowHoursTracking(nextVal);
                      handleSetShowHoursTracking(nextVal);
                    }}
                    className="h-3.5 w-3.5 accent-blue-600 border-base-border rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group py-0.5">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Show Baseline Schedule</span>
                    <span className="text-[8.5px] text-base-muted font-mono">Target Rencana vs Aktual</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showBaseline} 
                    onChange={e => {
                      const nextVal = e.target.checked;
                      setShowBaseline(nextVal);
                      handleSetShowBaseline(nextVal);
                    }}
                    className="h-3.5 w-3.5 accent-slate-600 border-base-border rounded cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Baseline Schedule Toggle & Set Baseline Button */}
          <div className="flex items-center gap-1 shrink-0 relative">
            <button
              onClick={() => {
                const nextVal = !showBaseline;
                setShowBaseline(nextVal);
                handleSetShowBaseline(nextVal);
                if (nextVal) {
                  setToastMsg(`Baseline Active: Menampilkan perbandingan jadwal Rencana (Baseline) vs Aktual.`);
                  setTimeout(() => setToastMsg(null), 3000);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 h-[34px] ${
                showBaseline 
                  ? 'bg-slate-700 text-white border-slate-600 shadow-sm ring-2 ring-slate-500/30' 
                  : 'bg-base-surface border-base-border text-base-muted hover:text-slate-700 hover:border-slate-500/50'
              }`}
              title="Toggle Baseline Schedule: Tampilkan / sembunyikan bar target jadwal rencana (Baseline)"
            >
              <BookmarkCheck className={`h-3.5 w-3.5 shrink-0 ${showBaseline ? 'text-white' : 'text-slate-500'}`} />
              <span>Baseline</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                showBaseline ? 'bg-white/20 text-white' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30'
              }`}>
                {baselineStats.count}
              </span>
            </button>

            {canSetBaseline && onUpdateProject && (
              <div className="relative">
                <button
                  onClick={() => {
                    if (projectsList.length > 1 && !selectedProject) {
                      setShowBaselineMenu(prev => !prev);
                    } else if (selectedProject) {
                      setBaselineForProject(selectedProject);
                    } else if (projectsList.length === 1) {
                      setBaselineForProject(projectsList[0]);
                    } else {
                      setShowBaselineMenu(prev => !prev);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-base-border bg-base-surface text-base-text hover:bg-base-accent/10 hover:border-base-accent/50 hover:text-base-accent transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 h-[34px]"
                  title={
                    selectedProject
                      ? `Kunci Jadwal Baseline untuk Proyek "${selectedProject.name}"`
                      : 'Kunci Jadwal Baseline (Salin Aktual → Baseline)'
                  }
                >
                  <BookmarkPlus className="h-3.5 w-3.5 text-base-accent shrink-0" />
                  <span>Set Baseline</span>
                  {projectsList.length > 1 && (
                    <span className="text-[8px] opacity-70">▼</span>
                  )}
                </button>

                {/* Dropdown menu when multiple projects available */}
                {showBaselineMenu && projectsList.length > 1 && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-base-surface border border-base-border rounded-xl shadow-xl p-2 z-50 text-left space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-base-muted uppercase tracking-wider border-b border-base-border/50">
                      Pilih Proyek untuk Set Baseline:
                    </div>
                    {projectsList.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setShowBaselineMenu(false);
                          setBaselineForProject(p);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-base-surface2 transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-semibold">{p.name}</span>
                        {p.baselineStart && (
                          <span className="text-[9px] font-mono text-slate-500 shrink-0">
                            {p.baselineStart.slice(5)}
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="border-t border-base-border/50 pt-1 mt-1">
                      <button
                        onClick={() => {
                          setShowBaselineMenu(false);
                          handleSetBaselineAll();
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-base-accent hover:bg-base-accent/10 transition-colors"
                      >
                        ★ Set Baseline Semua Proyek ({projectsList.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dedicated Plan vs Actual Timesheet Hours Button */}
          <button
            onClick={() => {
              const nextVal = !showHoursTracking;
              setShowHoursTracking(nextVal);
              handleSetShowHoursTracking(nextVal);
              if (nextVal) {
                setToastMsg(`Plan vs Actual Hours Active: ${totalHoursStats.actual.toFixed(1)}h logged / ${totalHoursStats.plan.toFixed(1)}h budgeted (${totalHoursStats.burn}% burn).`);
                setTimeout(() => setToastMsg(null), 3500);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 h-[34px] ${
              showHoursTracking 
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm ring-2 ring-blue-500/30' 
                : 'bg-base-surface border-base-border text-base-muted hover:text-blue-600 hover:border-blue-500/50'
            }`}
            title="Toggle Plan vs Actual Hours: Compare budgeted man-hours against real workshop Timesheet logs"
          >
            <Clock className={`h-3.5 w-3.5 shrink-0 ${showHoursTracking ? 'text-white' : 'text-blue-500'}`} />
            <span>Plan vs Actual</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black ${
              showHoursTracking ? 'bg-white/20 text-white' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
            }`}>
              {Math.round(totalHoursStats.actual)}h / {Math.round(totalHoursStats.plan)}h
            </span>
          </button>

          {/* Dedicated Critical Path Highlighter Button */}
          <button
            onClick={() => {
              const nextState = !showCriticalPath;
              setShowCriticalPath(nextState);
              if (nextState) {
                setToastMsg(`Critical Path Highlighter Active: ${criticalPathIds.size} critical tasks driving project timeline.`);
                setTimeout(() => setToastMsg(null), 3500);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 h-[34px] ${
              showCriticalPath 
                ? 'bg-red-600 text-white border-red-500 shadow-sm ring-2 ring-red-500/30' 
                : 'bg-base-surface border-base-border text-base-muted hover:text-red-600 hover:border-red-500/50'
            }`}
            title="Toggle Critical Path Highlighter: Automatically identifies and highlights the zero-slack chain of tasks determining overall project completion"
          >
            <Flame className={`h-3.5 w-3.5 shrink-0 ${showCriticalPath ? 'text-white fill-white' : 'text-red-500'}`} />
            <span>Critical Path</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black ${
              showCriticalPath ? 'bg-white/20 text-white' : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
            }`}>
              {criticalPathIds.size}
            </span>
          </button>

          {/* Dependency Constraint Violation Badge/Button */}
          {totalDependencyConflictsCount > 0 && (
            <>
              <div className="w-[1px] h-4 bg-base-border shrink-0" />
              <button
                onClick={() => {
                  const firstConflictingId = Array.from(dependencyViolationsMap.keys())[0];
                  if (firstConflictingId && rightScrollRef.current) {
                    const rowIdx = rows.findIndex(r => r.id === firstConflictingId);
                    if (rowIdx >= 0) {
                      rightScrollRef.current.scrollTop = rowIdx * 32;
                      setSelectedRowId(firstConflictingId);
                      const rowConflicts = dependencyViolationsMap.get(firstConflictingId);
                      setToastMsg(`Constraint Conflict on "${rows[rowIdx].name}": ${rowConflicts?.[0]?.reason || ''}. Click 'Smart Schedule' to resolve.`);
                      setTimeout(() => setToastMsg(null), 6000);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-500/60 shadow-xs transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 h-[34px] animate-pulse"
                title={`${totalDependencyConflictsCount} task(s) violate hard dependency timing constraints! Click to jump to the first conflict.`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span>{totalDependencyConflictsCount} Violation{totalDependencyConflictsCount > 1 ? 's' : ''}</span>
              </button>
            </>
          )}

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Dedicated Resource Load Button */}
          <button
            onClick={() => setShowResourceLoad(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 h-[34px] ${
              showResourceLoad 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' 
                : 'bg-base-surface border-base-border text-base-muted hover:text-indigo-500 hover:border-indigo-500/50'
            }`}
            title="Toggle Resource Daily Allocation & Scheduling Conflict Load View"
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Resource Load</span>
            {resourceLoadData && resourceLoadData.totalOverloadedEmployees > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black animate-pulse">
                {resourceLoadData.totalOverloadedEmployees} ⚠️
              </span>
            )}
          </button>

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Scheduling & Interactivity Actions Group */}
          {onUpdateProject !== undefined && (
            <div className="flex items-center bg-base-surface2 border border-base-border/70 rounded-xl p-0.5 h-[34px] shrink-0 gap-0.5">
              {/* Undo Button */}
              <button
                onClick={handleUndo}
                disabled={historyStack.length === 0}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 ${
                  historyStack.length > 0
                    ? 'bg-base-surface hover:bg-base-surface3 text-base-text border border-base-border shadow-2xs active:scale-95'
                    : 'text-base-muted/40 cursor-not-allowed opacity-50'
                }`}
                title={historyStack.length > 0 ? "Undo last Gantt action (Ctrl + Z)" : "Nothing to undo"}
              >
                <Undo2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Undo</span>
              </button>

              {/* Redo Button */}
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 ${
                  redoStack.length > 0
                    ? 'bg-base-surface hover:bg-base-surface3 text-base-text border border-base-border shadow-2xs active:scale-95'
                    : 'text-base-muted/40 cursor-not-allowed opacity-50'
                }`}
                title={redoStack.length > 0 ? "Redo Gantt action (Ctrl + Y or Ctrl + Shift + Z)" : "Nothing to redo"}
              >
                <Redo2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Redo</span>
              </button>

              <div className="w-[1px] h-3 bg-base-border mx-0.5 shrink-0" />

              {/* Smart Schedule Button */}
              <button
                onClick={handleSmartSchedule}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:border-amber-500/70 transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 shadow-xs active:scale-95"
                title="Smart Schedule: Automatically shift start dates of dependent tasks using existing dependency structure to eliminate overlaps"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-pulse" />
                <span>Smart Schedule</span>
              </button>

              <div className="w-[1px] h-3 bg-base-border mx-0.5 shrink-0" />

              {/* Auto Schedule switch */}
              <button
                onClick={() => setAutoSchedule(prev => !prev)}
                title={autoSchedule 
                  ? "Auto-Schedule ON — successors cascade automatically. Click to turn OFF." 
                  : "Auto-Schedule OFF — only dragged task moves. Click to turn ON."}
                className={`relative z-10 flex items-center gap-1 px-2.5 py-1 rounded-lg font-condensed font-bold uppercase tracking-wider text-[10px] cursor-pointer transition-colors duration-200 shrink-0 ${
                  autoSchedule
                    ? 'text-white font-extrabold'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                {autoSchedule && (
                  <motion.div
                    layoutId="ganttAutoSchedulePill"
                    className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span>Auto-Shift</span>
              </button>

              <div className="w-[1px] h-3 bg-base-border mx-1 shrink-0" />

              {/* Draw Link */}
              <button
                onClick={() => {
                  setConnectMode(!connectMode);
                  if (depPanelOpen) setDepPanelOpen(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed shrink-0 ${
                  connectMode 
                    ? 'bg-emerald-600 text-white shadow-xs font-black' 
                    : 'text-base-muted hover:text-emerald-500'
                }`}
                title="Toggle Draw-to-Connect Mode"
              >
                <Link className="h-3 w-3 shrink-0" />
                <span>{connectMode ? 'Drawing...' : 'Draw Link'}</span>
              </button>
            </div>
          )}

          <div className="w-[1px] h-4 bg-base-border shrink-0" />

          {/* Layout & File Export Actions */}
          <div className="flex items-center bg-base-surface border border-base-border rounded-xl p-0.5 h-[34px] shrink-0">
            {/* Fullscreen Exit */}
            <button 
              onClick={handleExitFullscreen}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-condensed font-bold uppercase tracking-wider text-[10px] text-base-accent hover:bg-base-accent/15 transition-colors cursor-pointer shrink-0"
              title="Keluar dari Fullscreen"
            >
              <Minimize2 className="h-3 w-3 shrink-0" />
              <span>Keluar Full Screen</span>
            </button>

            <div className="w-[1px] h-3 bg-base-border mx-1 shrink-0" />

            {/* Export */}
            <div className="relative shrink-0" ref={exportDropdownRef}>
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                disabled={isExporting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-condensed font-bold uppercase tracking-wider text-[10px] text-base-muted2 hover:text-base-text transition-colors cursor-pointer bg-transparent h-auto shrink-0"
              >
                <Download className="h-3 w-3 shrink-0" />
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                <ChevronDown className="h-2.5 w-2.5 ml-0.5 shrink-0" />
              </button>
              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-32 bg-base-surface border border-base-border rounded-lg shadow-xl py-1 z-[150]">
                  <button
                    onClick={handleExportPNG}
                    className="w-full text-left px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wide text-base-text hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
                  >
                    Export PNG
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full text-left px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wide text-base-text hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
                  >
                    Export PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connect Mode Guidance Banner */}
      {connectMode && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between font-medium shadow-sm animate-fade-in shrink-0 z-20 border-b border-emerald-700">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-bold font-condensed uppercase tracking-wider text-xs">Visual Link Mode Active</span>
            <span className="text-emerald-100 hidden sm:inline text-[11px]">— Drag from any task node circle (blue=start, green=finish) to connect dependencies, or click on any line node (✕) to remove links.</span>
          </div>
          <button
            onClick={() => setConnectMode(false)}
            className="px-2.5 py-0.5 bg-emerald-800 hover:bg-emerald-900 rounded font-bold text-[10px] uppercase tracking-wide transition-colors cursor-pointer shrink-0"
          >
            Exit (Esc)
          </button>
        </div>
      )}

      {/* Critical Path Summary Mini-Panel */}
      {showCriticalPath && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-base-red-dim/20 border-b border-base-border text-xs select-none">
          <div className="flex flex-wrap items-center gap-4 text-base-text">
            <span className="font-condensed font-extrabold text-base-red uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-base-red animate-pulse" />
              Critical Path Summary
            </span>
            <div className="hidden sm:block w-[1px] h-3 bg-base-border" />
            <div className="flex items-center gap-1 font-semibold text-base-muted2 text-[11px]">
              <span>Critical Tasks:</span>
              <span className="font-mono font-bold text-base-red bg-base-red-dim/30 px-1.5 py-0.5 rounded text-[10px]">
                {criticalPathIds.size}
              </span>
            </div>
            <div className="hidden sm:block w-[1px] h-3 bg-base-border" />
            <div className="flex items-center gap-1 font-semibold text-base-muted2 text-[11px]">
              <span>Longest Critical Chain Length:</span>
              <span className="font-mono font-extrabold text-base-text text-[11px]">
                {criticalChainLength} days
              </span>
            </div>
          </div>
          {firstCriticalRowIdx !== -1 && (
            <button
              onClick={jumpToFirstCriticalTask}
              className="flex items-center gap-1 px-2.5 py-1 bg-base-red text-white font-condensed font-bold uppercase tracking-wider text-[10px] rounded hover:bg-opacity-90 cursor-pointer transition-colors shrink-0"
            >
              <span>Jump to first critical task</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}

      {/* Gantt Legend & Hours Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-base-surface/50 border-b border-base-border text-[11px] font-medium text-base-muted2 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="text-[10px]">🔴</span> Critical Path</span>
          <span className="flex items-center gap-1"><span className="text-[10px]">🔵</span> On Track</span>
          <span className="flex items-center gap-1"><span className="text-[10px]">🟡</span> Overdue</span>
          <span className="flex items-center gap-1"><span className="text-[10px]">🟢</span> Done</span>
          {showBaseline && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-2 rounded-xs bg-slate-400/60 dark:bg-slate-500/60 border border-slate-500/80 shadow-2xs" />
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Baseline (Target)</span>
            </span>
          )}
        </div>

        {showHoursTracking && (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-base-muted">Shopfloor Man-Hours:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              Plan: {totalHoursStats.plan.toFixed(1)}h
            </span>
            <span className="text-base-border">|</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              Actual: {totalHoursStats.actual.toFixed(1)}h ({totalHoursStats.entries} entries)
            </span>
            <span className="text-base-border">|</span>
            <span className={`font-black px-1.5 py-0.5 rounded ${
              totalHoursStats.actual > totalHoursStats.plan
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}>
              Burn: {totalHoursStats.burn}% ({totalHoursStats.variance > 0 ? `+${totalHoursStats.variance.toFixed(1)}h over` : `${Math.abs(totalHoursStats.variance).toFixed(1)}h under`})
            </span>
          </div>
        )}
      </div>

      {/* CORE GANTT WORKSPACE BOX */}
      <div ref={ganttWorkspaceRef} className="shadow-card border border-base-border rounded-xl bg-base-surface flex flex-1 overflow-hidden relative" style={{ maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '550px' }}>
        
        {/* LEFT FIXED PANEL (MS Project Columns) */}
        <GanttGrid
          leftPanelWidth={leftPanelWidth}
          totalTableWidth={totalTableWidth}
          leftScrollRef={leftScrollRef}
          handleLeftWheel={handleLeftWheel}
          colWbsWidth={colWbsWidth}
          colNameWidth={colNameWidth}
          colDurWidth={colDurWidth}
          colPlanHrsWidth={colPlanHrsWidth}
          colActHrsWidth={colActHrsWidth}
          colVarianceWidth={colVarianceWidth}
          colCrewWidth={colCrewWidth}
          colCompanyWidth={colCompanyWidth}
          colAssigneeWidth={colAssigneeWidth}
          colStartWidth={colStartWidth}
          colFinishWidth={colFinishWidth}
          colBaseStartWidth={colBaseStartWidth}
          colBaseFinishWidth={colBaseFinishWidth}
          colPredWidth={colPredWidth}
          colPctWidth={colPctWidth}
          colStatusWidth={colStatusWidth}
          showHoursTracking={showHoursTracking}
          showBaseline={showBaseline}
          activeTab={activeTab}
          searchQuery={searchQuery}
          showCriticalPath={showCriticalPath}
          criticalAssemblyIds={criticalAssemblyIds}
          visibleRows={visibleRows}
          allRows={allRows}
          rows={rows}
          startIndex={startIndex}
          topSpacerHeight={topSpacerHeight}
          bottomSpacerHeight={bottomSpacerHeight}
          selectedRowId={selectedRowId}
          setSelectedRowId={setSelectedRowId}
          dragHoverTargetRowId={dragHoverTargetRowId}
          dependencyViolationsMap={dependencyViolationsMap}
          expandedIds={expandedIds}
          toggleProjectCollapse={toggleProjectCollapse}
          collapsedAsms={collapsedAsms}
          toggleAssemblyCollapse={toggleAssemblyCollapse}
          highlightText={highlightText}
          getProjectIdOfRow={getProjectIdOfRow}
          onUpdateProject={onUpdateProject}
          editingHoursCell={editingHoursCell}
          setEditingHoursCell={setEditingHoursCell}
          saveRowBudgetHours={saveRowBudgetHours}
          editingLookaheadCell={editingLookaheadCell}
          setEditingLookaheadCell={setEditingLookaheadCell}
          saveTaskField={saveTaskField}
          editingCell={editingCell}
          setEditingCell={setEditingCell}
          saveDate={saveDate}
          editingPred={editingPred}
          setEditingPred={setEditingPred}
          predInputVal={predInputVal}
          setPredInputVal={setPredInputVal}
          savePredecessors={savePredecessors}
          getPredecessorsLabel={getPredecessorsLabel}
          setDepPanelRowId={setDepPanelRowId}
          setDepPanelOpen={setDepPanelOpen}
          setDepPanelSearch={setDepPanelSearch}
          flashingCellId={flashingCellId}
          editingPct={editingPct}
          setEditingPct={setEditingPct}
          saveProgress={saveProgress}
          statusPopoverRowId={statusPopoverRowId}
          setStatusPopoverRowId={setStatusPopoverRowId}
          saveWorkflowStatus={saveWorkflowStatus}
          showSCurve={showSCurve}
          sCurvePaths={sCurvePaths}
          SCURVE_H={SCURVE_H}
          showResourceLoad={showResourceLoad}
          resourceLoadData={resourceLoadData}
          setResourceFilter={setResourceFilter}
          resourceFilter={resourceFilter}
          resourceSearch={resourceSearch}
          setResourceSearch={setResourceSearch}
          dailyCapacityLimit={dailyCapacityLimit}
          setDailyCapacityLimit={setDailyCapacityLimit}
          expandedResources={expandedResources}
          setExpandedResources={setExpandedResources}
        />

        {/* RESIZE SPLITTER */}
        <div
          className={`w-2 cursor-col-resize relative z-30 shrink-0 self-stretch transition-colors flex items-center justify-center bg-base-surface2 border-l border-r border-base-border ${
            isResizingSplitter ? 'bg-base-accent/30 border-base-accent' : 'hover:bg-base-accent-dim/50 hover:border-base-accent/50'
          }`}
          onMouseDown={handleSplitterMouseDown}
          title="Drag to resize task sheet table"
        >
          <div className={`w-[2px] h-6 rounded-full ${isResizingSplitter ? 'bg-base-accent' : 'bg-base-muted/40'}`} />
        </div>

        {/* RIGHT SCROLLABLE TIMELINE PANEL */}
        <GanttTimeline
          rightScrollRef={rightScrollRef}
          handleScroll={handleScroll}
          totalTimelineDays={totalTimelineDays}
          pixelsPerDay={pixelsPerDay}
          topHeaders={topHeaders}
          bottomHeaders={bottomHeaders}
          weekendBands={weekendBands}
          isTodayInTimeline={isTodayInTimeline}
          todayX={todayX}
          todayFormattedFull={todayFormattedFull}
          visibleTasksCount={visibleTasksCount}
          isFilterActive={isFilterActive}
          setSearchQuery={setSearchQuery}
          setStatusFilter={setStatusFilter}
          topSpacerHeight={topSpacerHeight}
          bottomSpacerHeight={bottomSpacerHeight}
          visibleRows={visibleRows}
          startIndex={startIndex}
          rows={rows}
          selectedRowId={selectedRowId}
          setSelectedRowId={setSelectedRowId}
          dragHoverTargetRowId={dragHoverTargetRowId}
          rowBarCoordsCache={rowBarCoordsCache}
          showBaseline={showBaseline}
          rowBaselineCoordsCache={rowBaselineCoordsCache}
          slackMap={slackMap}
          showCriticalPath={showCriticalPath}
          criticalPathIds={criticalPathIds}
          criticalAssemblyIds={criticalAssemblyIds}
          cascadedTaskIds={cascadedTaskIds}
          showProgress={showProgress}
          showHoursTracking={showHoursTracking}
          dependencyViolationsMap={dependencyViolationsMap}
          handleMouseEnter={handleMouseEnter}
          handleMouseLeave={handleMouseLeave}
          onUpdateProject={onUpdateProject}
          connectMode={connectMode}
          connectDraw={connectDraw}
          setConnectDraw={setConnectDraw}
          dragState={dragState}
          handleBarMouseDown={handleBarMouseDown}
          handleBarTouchStart={handleBarTouchStart}
          arrows={arrows}
          hoveredArrowId={hoveredArrowId}
          setHoveredArrowId={setHoveredArrowId}
          selectedArrowId={selectedArrowId}
          setSelectedArrowId={setSelectedArrowId}
          handleDeleteDependencyArrow={handleDeleteDependencyArrow}
          showSCurve={showSCurve}
          sCurvePaths={sCurvePaths}
          SCURVE_H={SCURVE_H}
          sCurveData={sCurveData}
          timelineStart={timelineStart}
          showResourceLoad={showResourceLoad}
          resourceLoadData={resourceLoadData}
          dailyCapacityLimit={dailyCapacityLimit}
          expandedResources={expandedResources}
          setHoveredResourceCell={setHoveredResourceCell}
        />

        {/* RESOURCE LOAD HOVER TOOLTIP POPUP */}
        {hoveredResourceCell && (
          <div
            className="fixed z-50 bg-base-surface border-2 border-base-border rounded-xl shadow-2xl p-3 w-80 text-xs text-base-text pointer-events-auto animate-fade-in"
            style={{
              left: `${Math.min(Math.max(160, hoveredResourceCell.x), window.innerWidth - 340)}px`,
              top: `${Math.max(80, hoveredResourceCell.y - 180)}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex items-center justify-between border-b border-base-border pb-2 mb-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <UserIcon className="h-4 w-4 text-indigo-500" />
                <span className="truncate max-w-[180px]">{hoveredResourceCell.employeeName}</span>
              </div>
              <span className="text-[10px] font-mono text-base-muted font-bold">
                {hoveredResourceCell.dateStr}
              </span>
            </div>

            {/* Capacity Status Pill */}
            {hoveredResourceCell.totalHours > dailyCapacityLimit ? (
              <div className="bg-red-500/20 border border-red-500/50 text-red-600 dark:text-red-400 p-2 rounded-lg mb-2 font-mono text-[11px] font-bold flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold uppercase">Scheduling Overload Conflict!</div>
                  <div>Total: {hoveredResourceCell.totalHours}h / max {dailyCapacityLimit}h (+{hoveredResourceCell.totalHours - dailyCapacityLimit}h over capacity)</div>
                </div>
              </div>
            ) : hoveredResourceCell.totalHours === dailyCapacityLimit ? (
              <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 p-1.5 rounded-lg mb-2 font-mono text-[11px] font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Full Capacity (8 Hours Allocated)</span>
              </div>
            ) : hoveredResourceCell.totalHours > 0 ? (
              <div className="bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-300 p-1.5 rounded-lg mb-2 font-mono text-[11px] font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                <span>Part-Time Load ({hoveredResourceCell.totalHours} Hours Allocated)</span>
              </div>
            ) : (
              <div className="text-base-muted p-1 text-[11px] italic mb-2">No tasks assigned on this date.</div>
            )}

            {/* Active Tasks Breakdown List */}
            {hoveredResourceCell.tasks.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-base-muted uppercase tracking-wider mb-1">
                  Active Assigned Tasks ({hoveredResourceCell.tasks.length}):
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {hoveredResourceCell.tasks.map(t => (
                    <div
                      key={`tooltip-task-${t.taskId}`}
                      onClick={() => {
                        const rowIdx = allRows.findIndex(r => r.id === t.taskId);
                        if (rowIdx >= 0 && rightScrollRef.current) {
                          rightScrollRef.current.scrollTop = rowIdx * 32;
                          setToastMsg(`Jumped to task: ${t.taskName}`);
                          setTimeout(() => setToastMsg(null), 3000);
                        }
                      }}
                      className="p-1.5 rounded bg-base-surface2 border border-base-border/60 hover:border-indigo-500 hover:bg-indigo-500/10 cursor-pointer transition-all text-[11px] flex items-center justify-between group"
                      title="Click to jump to this task in Gantt chart above"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className="font-mono text-[10px] font-bold text-indigo-500">[{t.wbs}]</span>
                        <span className="truncate font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{t.taskName}</span>
                      </div>
                      <span className="font-mono font-bold text-[10px] text-base-muted group-hover:text-indigo-500 shrink-0">
                        8h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FLOATING HOVER TOOLTIP */}
        {hoveredTask && !isTouchDragging && (
          <div 
            data-export-hide="true"
            className="absolute bg-base-surface border border-base-border rounded-lg shadow-md p-3 text-xs z-[200] max-w-sm font-sans pointer-events-none animate-fade-in print:hidden"
            style={{ 
              left: `${Math.max(0, Math.min(hoveredTask.x, totalTimelineDays * pixelsPerDay - 280))}px`, 
              top: `${hoveredTask.y - 145}px` 
            }}
          >
            <div className="font-condensed font-extrabold text-xs text-base-text uppercase tracking-wide border-b border-base-border pb-1.5 mb-1.5 flex items-center gap-1.5 justify-between">
              <span className="truncate max-w-56">{hoveredTask.row.name}</span>
              <span className="text-[9px] text-base-accent bg-base-accent-dim px-1.5 py-0.5 rounded font-bold">
                WBS {hoveredTask.row.wbs}
              </span>
            </div>
            <div className="space-y-1 text-base-muted2 text-[10px] font-semibold">
              <div className="flex justify-between gap-6">
                <span>Duration:</span>
                <span className="font-mono text-base-text font-extrabold">
                  {hoveredTask.row.isMilestone ? 'Milestone (0 days)' : `${hoveredTask.row.duration} days`}
                </span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Actual Start:</span>
                <span className="font-mono text-base-text font-bold">{hoveredTask.row.start || '—'}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Actual Finish:</span>
                <span className="font-mono text-base-text font-bold">{hoveredTask.row.finish || '—'}</span>
              </div>
              {hoveredTask.row.baselineStart && (
                <div className="bg-slate-500/10 border border-slate-500/20 rounded p-1.5 my-1 space-y-0.5">
                  <div className="flex justify-between gap-6">
                    <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1">
                      <BookmarkCheck className="h-3 w-3" /> Baseline:
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-200 font-bold">
                      {hoveredTask.row.baselineStart} → {hoveredTask.row.baselineFinish || hoveredTask.row.baselineStart}
                    </span>
                  </div>
                  {hoveredTask.row.finish && hoveredTask.row.baselineFinish && (
                    <div className="flex justify-between gap-6 text-[9.5px]">
                      <span>Variance:</span>
                      {(() => {
                        const actD = parseLocalDate(hoveredTask.row.finish);
                        const baseD = parseLocalDate(hoveredTask.row.baselineFinish);
                        const diffDays = Math.round((actD.getTime() - baseD.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                          return <span className="text-red-500 font-bold font-mono">+{diffDays} days delay</span>;
                        } else if (diffDays < 0) {
                          return <span className="text-emerald-500 font-bold font-mono">{Math.abs(diffDays)} days ahead</span>;
                        } else {
                          return <span className="text-slate-500 font-bold font-mono">On target</span>;
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between gap-6">
                <span>Progress:</span>
                <span className="font-mono text-base-text font-black text-xs">
                  {hoveredTask.row.pct}%
                </span>
              </div>
              {hoveredTask.row.assigned && (
                <div className="flex justify-between gap-6">
                  <span>Resource:</span>
                  <span className="font-sans text-base-text font-extrabold">{hoveredTask.row.assigned}</span>
                </div>
              )}
              
              {hoveredTask.row.level === 2 && (
                <>
                  <div className="flex justify-between gap-6 border-t border-base-border/40 mt-1.5 pt-1.5">
                    <span>Slack:</span>
                    {criticalPathIds.has(hoveredTask.row.id) ? (
                      <span className="text-red-600 dark:text-red-400 font-extrabold font-condensed uppercase tracking-wider">Critical — 0 days slack</span>
                    ) : (
                      <span className="font-mono text-base-text font-extrabold">
                        {Math.max(0, Math.round(slackMap.get(hoveredTask.row.id) ?? 0))} day(s)
                      </span>
                    )}
                  </div>

                  {dependencyViolationsMap.get(hoveredTask.row.id) && (
                    <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-2 my-1.5 text-[10px] font-mono">
                      <div className="font-extrabold uppercase flex items-center gap-1 text-red-600 dark:text-red-400 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
                        <span>HARD DEPENDENCY VIOLATION</span>
                      </div>
                      {dependencyViolationsMap.get(hoveredTask.row.id)!.map((c, i) => (
                        <div key={i} className="text-[10px] leading-tight text-red-700 dark:text-red-300 font-medium my-0.5">
                          • {c.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Plan vs Actual Hours Details */}
              {(hoveredTask.row.planHours > 0 || hoveredTask.row.actualHours > 0) && (
                <div className="border-t border-base-border/40 mt-1.5 pt-1.5 space-y-1">
                  <div className="flex justify-between gap-6">
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                      <Clock className="w-3 h-3 shrink-0" /> Plan Hours:
                    </span>
                    <span className="font-mono text-base-text font-bold">
                      {hoveredTask.row.planHours.toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Clock className="w-3 h-3 shrink-0" /> Actual (Timesheets):
                    </span>
                    <span className="font-mono text-base-text font-bold">
                      {hoveredTask.row.actualHours.toFixed(1)} hrs ({hoveredTask.row.timesheetCount} logs)
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Variance / Burn:</span>
                    <span className={`font-mono font-black ${
                      hoveredTask.row.actualHours > hoveredTask.row.planHours
                        ? 'text-red-500'
                        : hoveredTask.row.actualHours > 0
                          ? 'text-emerald-500'
                          : 'text-base-muted'
                    }`}>
                      {hoveredTask.row.planHours > 0
                        ? `${Math.round((hoveredTask.row.actualHours / hoveredTask.row.planHours) * 100)}% burn (${(hoveredTask.row.planHours - hoveredTask.row.actualHours).toFixed(1)}h remaining)`
                        : 'No plan'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* TOAST NOTIFICATION */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 bg-base-surface border border-base-border shadow-lg rounded-lg px-4 py-2.5 text-xs font-semibold z-[300] flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-base-red shrink-0" />
            <span className="text-base-text font-bold">{toastMsg}</span>
          </div>
        )}

        {/* DRAW-TO-CONNECT POPUP DIALOG */}
        {pendingConnect && (() => {
          const sourceRow = rows.find(r => r.id === pendingConnect.sourceRowId);
          const targetRow = rows.find(r => r.id === pendingConnect.targetRowId);
          const isAlreadyLinked = targetRow?.predecessors?.some(d => d.key === sourceRow?.id);

          return (
            <div 
              data-export-hide="true"
              className="fixed bg-base-surface border-2 border-green-500 rounded-xl shadow-2xl p-4 z-[250] w-72 text-xs font-sans animate-fade-in print:hidden"
              style={{ 
                left: `${connectPopupPos ? connectPopupPos.x : 0}px`, 
                top: `${connectPopupPos ? connectPopupPos.y : 0}px`,
                transform: 'translate(-50%, -100%) translateY(-12px)'
              }}
            >
              <div className="flex items-center justify-between border-b border-base-border pb-2 mb-2">
                <div className="flex items-center gap-1.5 font-condensed font-extrabold text-sm uppercase tracking-wide text-green-500">
                  <Link className="h-4 w-4" />
                  <span>Link Dependency</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingConnect(null)}
                  className="text-base-muted hover:text-base-text transition-colors p-0.5 rounded cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {sourceRow && targetRow && (
                <div className="text-[10px] font-mono text-base-muted mb-3 bg-base-surface2 p-2 rounded border border-base-border space-y-1">
                  <div className="truncate"><strong className="text-base-text font-sans">From:</strong> [{sourceRow.wbs}] {sourceRow.name}</div>
                  <div className="truncate"><strong className="text-base-text font-sans">To:</strong> [{targetRow.wbs}] {targetRow.name}</div>
                </div>
              )}

              {isAlreadyLinked && sourceRow && targetRow && (
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteDependencyArrow(targetRow.id, sourceRow.id);
                    setPendingConnect(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[10px] font-bold py-1.5 rounded transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 mb-3"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Remove Existing Link ({sourceRow.wbs}➔{targetRow.wbs})</span>
                </button>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">Relationship Type</label>
                  <select
                    value={pendingDepType}
                    onChange={(e) => setPendingDepType(e.target.value as any)}
                    className="w-full bg-base-surface2 border border-base-border rounded px-2 py-1.5 focus:border-green-500 outline-none font-medium text-base-text"
                  >
                    <option value="FS">Finish-to-Start (FS)</option>
                    <option value="SS">Start-to-Start (SS)</option>
                    <option value="FF">Finish-to-Finish (FF)</option>
                    <option value="SF">Start-to-Finish (SF)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed font-mono">Lag (e.g. 2d, -1d)</label>
                  <input
                    type="text"
                    placeholder="0d"
                    value={pendingDepLag}
                    onChange={(e) => setPendingDepLag(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded px-2 py-1.5 focus:border-green-500 outline-none font-mono text-base-text"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingConnect) {
                        const srcR = rows.find(r => r.id === pendingConnect.sourceRowId);
                        const tgtR = rows.find(r => r.id === pendingConnect.targetRowId);
                        if (srcR && tgtR) {
                          setDepPanelRowId(tgtR.id);
                          setDepPanelType(pendingDepType);
                          setDepPanelLag(pendingDepLag);
                          
                          const currentDeps = tgtR.predecessors || [];
                          const parsedLag = parseInt(pendingDepLag.replace('d', ''), 10);
                          const lagValue = !isNaN(parsedLag) && parsedLag !== 0 ? parsedLag : undefined;
                          const newDep = {
                            key: srcR.id,
                            type: pendingDepType,
                            lag: lagValue
                          };
                          const nextDeps = [...currentDeps];
                          const existingIdx = nextDeps.findIndex(d => d.key === newDep.key);
                          if (existingIdx !== -1) {
                            nextDeps[existingIdx] = newDep;
                          } else {
                            nextDeps.push(newDep);
                          }
                          savePredecessorsDirect(tgtR.id, nextDeps);

                          setToastMsg(`Linked ${srcR.wbs} → ${tgtR.wbs} (${pendingDepType}${pendingDepLag ? `+${pendingDepLag}` : ''})`);
                          setTimeout(() => setToastMsg(null), 3000);
                        }
                      }
                      setPendingConnect(null);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    {isAlreadyLinked ? 'Update Link' : 'Add Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingConnect(null)}
                    className="px-3 bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border py-1.5 rounded font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SMART SEARCH DEPENDENCY SIDE PANEL */}
        {depPanelOpen && (() => {
          let targetRow: any = null;
          if (depPanelRowId) {
            const parts = depPanelRowId.split(':');
            const rowId = parts[parts.length - 1];
            targetRow = rows.find(r => r.id === rowId);
          }

          if (!targetRow) return null;

          return (
            <div 
              data-export-hide="true"
              className="fixed inset-y-0 right-0 z-50 w-96 bg-base-surface border-l border-base-border shadow-2xl flex flex-col font-sans select-none print:hidden animate-fade-in"
            >
              {/* Header */}
              <div className="p-4 border-b border-base-border flex items-center justify-between bg-base-surface2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-base-accent/10 text-base-accent rounded">
                    <Link className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-condensed font-extrabold text-sm text-base-text tracking-tight uppercase">Dependencies</h3>
                    <p className="text-[10px] text-base-muted font-bold font-mono">WBS {targetRow.wbs} — {targetRow.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setDepPanelOpen(false);
                    setDepPanelRowId(null);
                  }}
                  className="p-1 rounded-full hover:bg-base-surface3 text-base-muted hover:text-base-text transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Active Predecessors List */}
                <div>
                  <h4 className="text-[10px] uppercase font-extrabold text-base-muted tracking-wider mb-2 font-condensed">Active Predecessors</h4>
                  {targetRow.predecessors && targetRow.predecessors.length > 0 ? (
                    <div className="space-y-2">
                      {targetRow.predecessors.map((dep: any) => {
                        const predRow = rows.find(r => r.id === dep.key);
                        if (!predRow) return null;
                        return (
                          <div 
                            key={`dep-item-${dep.key}`}
                            className="flex items-center justify-between p-2.5 bg-base-surface2 border border-base-border rounded-lg"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-bold bg-base-accent-dim text-base-accent px-1.5 py-0.5 rounded">
                                  {predRow.wbs}
                                </span>
                                <span className="text-[11px] font-bold truncate text-base-text">{predRow.name}</span>
                              </div>
                              <div className="mt-1 text-[9px] text-base-muted font-mono">
                                Type: <span className="text-base-text font-bold">{dep.type}</span>
                                {dep.lag ? ` | Lag: ` : ''}
                                {dep.lag ? <span className="text-base-text font-bold">{dep.lag}d</span> : ''}
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                handleDeletePredecessor(dep.key);
                              }}
                              className="p-1.5 text-base-muted hover:text-base-red hover:bg-base-red-dim/20 rounded-md transition-all cursor-pointer"
                              title="Delete dependency link"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-base-surface2/50 border border-dashed border-base-border rounded-lg text-[10px] text-base-muted font-bold font-condensed">
                      No active predecessors for this task.
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-base-border/50" />

                {/* Search & Add Section */}
                <div>
                  <h4 className="text-[10px] uppercase font-extrabold text-base-muted tracking-wider mb-2 font-condensed">Link New Predecessor</h4>
                  
                  {/* Search Input */}
                  <div className="relative flex items-center mb-3">
                    <Search className="absolute left-2.5 h-3.5 w-3.5 text-base-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search tasks by name or WBS..."
                      value={depPanelSearch}
                      onChange={(e) => setDepPanelSearch(e.target.value)}
                      className="w-full bg-base-surface2 border border-base-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-base-accent font-medium text-base-text"
                    />
                  </div>

                  {/* Results List */}
                  {(() => {
                    const query = depPanelSearch.toLowerCase().trim();
                    const available = rows.filter(r => {
                      if (r.level !== 2) return false;
                      if (r.id === targetRow.id) return false;
                      const isLinked = targetRow.predecessors?.some((dep: any) => dep.key === r.id);
                      if (isLinked) return false;
                      if (query) {
                        return r.name.toLowerCase().includes(query) || r.wbs.toLowerCase().includes(query);
                      }
                      return true;
                    });

                    if (available.length === 0) {
                      return (
                        <div className="text-center py-4 text-[10px] text-base-muted font-bold font-condensed">
                          No matching available tasks.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {available.slice(0, 10).map((r: any, rIdx: number) => (
                          <div 
                            key={`search-item-${r.id}-${rIdx}`}
                            className="p-2 bg-base-surface2/40 hover:bg-base-surface2 border border-base-border rounded-lg flex flex-col gap-2 transition-all"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-[9px] font-bold text-base-muted">{r.wbs}</span>
                              <span className="text-[11px] font-bold truncate text-base-text flex-1">{r.name}</span>
                            </div>

                            {/* Link Quick Creator Controls */}
                            <div className="flex items-center gap-1.5">
                              {/* Relationship Select */}
                              <select
                                id={`type-sel-${r.id}`}
                                className="bg-base-surface border border-base-border text-[9px] font-bold rounded px-1 py-0.5 outline-none font-sans text-base-text"
                                defaultValue="FS"
                              >
                                <option value="FS">FS</option>
                                <option value="SS">SS</option>
                                <option value="FF">FF</option>
                                <option value="SF">SF</option>
                              </select>

                              {/* Lag Input */}
                              <input
                                id={`lag-inp-${r.id}`}
                                type="text"
                                placeholder="Lag"
                                className="bg-base-surface border border-base-border text-[9px] rounded px-1 py-0.5 w-10 text-center outline-none font-mono text-base-text"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const typeSel = document.getElementById(`type-sel-${r.id}`) as HTMLSelectElement;
                                  const lagInp = document.getElementById(`lag-inp-${r.id}`) as HTMLInputElement;
                                  const typeVal = typeSel?.value || 'FS';
                                  const lagVal = lagInp?.value ? lagInp.value.replace('d', '') : '';

                                  const currentDeps = targetRow.predecessors || [];
                                  const parsedLag = parseInt(lagVal.replace('d', ''), 10);
                                  const lagValue = !isNaN(parsedLag) && parsedLag !== 0 ? parsedLag : undefined;
                                  const newDep = {
                                    key: r.id,
                                    type: typeVal as any,
                                    lag: lagValue
                                  };
                                  const nextDeps = [...currentDeps];
                                  const existingIdx = nextDeps.findIndex(d => d.key === newDep.key);
                                  if (existingIdx !== -1) {
                                    nextDeps[existingIdx] = newDep;
                                  } else {
                                    nextDeps.push(newDep);
                                  }
                                  savePredecessorsDirect(targetRow.id, nextDeps);
                                  setDepPanelSearch('');
                                  
                                  setToastMsg(`Added Predecessor: ${r.wbs} → ${targetRow.wbs}`);
                                  setTimeout(() => setToastMsg(null), 3000);
                                }}
                                className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-base-accent text-white hover:bg-base-accent/90 transition-all rounded text-[9px] font-bold uppercase cursor-pointer"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>Link</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
