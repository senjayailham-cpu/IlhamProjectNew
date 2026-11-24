import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
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
import { runP6ScheduleF9 } from '../utils/cpmEngine';
import { 
  GanttGrid, 
  getCompanyColorClass, 
  WorkflowStatusBadge, 
  CircularProgressBadge,
  WORKFLOW_STATUS_CONFIG,
  getEffectiveWorkflowStatus
} from './GanttGrid';
import { GanttTimeline } from './GanttTimeline';
import { GanttViewFilterDrawer } from './GanttViewFilterDrawer';

export { 
  getCompanyColorClass, 
  WorkflowStatusBadge, 
  CircularProgressBadge,
  WORKFLOW_STATUS_CONFIG,
  getEffectiveWorkflowStatus 
};
import { 
  ChevronRight, 
  ChevronLeft,
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
  BookmarkPlus,
  ArrowRight,
  Scan,
  FileSpreadsheet,
  SlidersHorizontal,
  Play
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
  embedded?: boolean;
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
      // Do not automatically assign dates to unstarted tasks
      if (!t.date && !t.startDate) return;
      const tStart = t.date || t.startDate || '';
      let tFinish = t.finishDate || t.endDate || tStart;
      if (tStart && tFinish && daysBetween(parseLocalDate(tStart), parseLocalDate(tFinish)) < 0) {
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
  setIncludeCompleted,
  embedded = false
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
    cpmData,
    fullTreeRows,
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
    if (row.projectId) return row.projectId;
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
  const [customPixelsPerDay, setCustomPixelsPerDay] = useState<number | null>(null);
  const skipNextZoomAutoScrollRef = useRef<boolean>(false);
  const pendingZoomScrollRef = useRef<{ anchorTimeMs: number; viewportOffsetX: number } | null>(null);
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

  // ── SMART SCHEDULE ENGINE (DRY-RUN PREVIEW + APPLY) ──
  interface SmartSchedulePreviewItem {
    taskId: string;
    projectName: string;
    wbs: string;
    taskName: string;
    oldStart: string;
    oldFinish: string;
    newStart: string;
    newFinish: string;
    deltaDays: number;
  }

  interface SmartScheduleProjectImpact {
    projectId: string;
    projectName: string;
    oldDue: string;
    newDue: string;
    deltaDays: number;
  }

  const [smartSchedulePreview, setSmartSchedulePreview] = useState<{
    updatedProjects: Project[];
    shiftedIds: string[];
    items: SmartSchedulePreviewItem[];
    projectImpacts: SmartScheduleProjectImpact[];
    totalShiftedCount: number;
    maxDeltaDays: number;
  } | null>(null);

  const handleSmartSchedule = () => {
    if (!onUpdateProject || projectsList.length === 0) return;

    const updatedProjects: Project[] = [];
    const allShiftedIds = new Set<string>();
    const items: SmartSchedulePreviewItem[] = [];
    const projectImpacts: SmartScheduleProjectImpact[] = [];
    let maxDeltaDays = 0;

    projectsList.forEach((proj, pIdx) => {
      const oldTaskDates = new Map<string, { start: string; finish: string }>();
      (proj.assemblies || []).forEach(asm => {
        (asm.tasks || []).forEach(t => {
          const s = t.date || t.startDate || asm.start || proj.start || '';
          const f = t.finishDate || t.endDate || s;
          oldTaskDates.set(t.id, { start: s, finish: f });
        });
      });

      const { updatedProject, shiftedIds } = cascadeSchedule(proj);
      if (shiftedIds.size > 0) {
        updatedProjects.push(updatedProject);
        shiftedIds.forEach(id => allShiftedIds.add(id));

        (updatedProject.assemblies || []).forEach((asm, asmIdx) => {
          (asm.tasks || []).forEach((t, tIdx) => {
            if (!shiftedIds.has(t.id)) return;
            const prev = oldTaskDates.get(t.id);
            const oldStart = prev?.start || t.date || '';
            const oldFinish = prev?.finish || t.finishDate || oldStart;
            const newStart = t.date || t.startDate || oldStart;
            const newFinish = t.finishDate || t.endDate || newStart;
            const deltaDays = oldStart && newStart
              ? daysBetween(parseLocalDate(oldStart), parseLocalDate(newStart))
              : 0;
            if (Math.abs(deltaDays) > Math.abs(maxDeltaDays)) {
              maxDeltaDays = deltaDays;
            }
            items.push({
              taskId: t.id,
              projectName: proj.name,
              wbs: `${pIdx + 1}.${asmIdx + 1}.${tIdx + 1}`,
              taskName: t.name,
              oldStart,
              oldFinish,
              newStart,
              newFinish,
              deltaDays,
            });
          });
        });

        const newMaxFinishStr = (updatedProject.assemblies || [])
          .map(a => a.finish)
          .filter((d): d is string => Boolean(d))
          .sort()
          .pop();
        if (proj.due && newMaxFinishStr) {
          const dueDelta = daysBetween(parseLocalDate(proj.due), parseLocalDate(newMaxFinishStr));
          if (dueDelta > 0) {
            projectImpacts.push({
              projectId: proj.id,
              projectName: proj.name,
              oldDue: proj.due,
              newDue: newMaxFinishStr,
              deltaDays: dueDelta,
            });
          }
        }
      }
    });

    if (items.length === 0) {
      setToastMsg('Smart Schedule: Semua ketergantungan task sudah selaras tanpa konflik tumpang tindih.');
      setTimeout(() => {
        setToastMsg(null);
      }, 4000);
      return;
    }

    setSmartSchedulePreview({
      updatedProjects,
      shiftedIds: Array.from(allShiftedIds),
      items,
      projectImpacts,
      totalShiftedCount: items.length,
      maxDeltaDays,
    });
  };

  const confirmApplySmartSchedule = () => {
    if (!smartSchedulePreview || !onUpdateProject) return;

    smartSchedulePreview.updatedProjects.forEach(proj => {
      onUpdateProject(proj);
    });
    setCascadedTaskIds(new Set(smartSchedulePreview.shiftedIds));
    setToastMsg(
      `Smart Schedule: ${smartSchedulePreview.totalShiftedCount} task berhasil disesuaikan secara otomatis.`
    );
    setSmartSchedulePreview(null);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // ── ORACLE PRIMAVERA P6 SCHEDULE (F9) ENGINE ──
  const [p6ModalData, setP6ModalData] = useState<{
    isOpen: boolean;
    dataDate: string;
    totalTasks: number;
    criticalCount: number;
    longestPath: number;
    shiftedCount: number;
    hasLoops: boolean;
  } | null>(null);

  const [baselineConfirm, setBaselineConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  const handleRunP6Schedule = () => {
    if (!onUpdateProject || projectsList.length === 0) return;

    let overallTotalTasks = 0;
    let overallCriticalCount = 0;
    let overallLongestPath = 0;
    let overallShiftedCount = 0;
    let anyLoops = false;

    projectsList.forEach(proj => {
      const { updatedProject, cpmResult, shiftedCount } = runP6ScheduleF9(proj);
      overallTotalTasks += cpmResult.totalTaskCount;
      overallCriticalCount += cpmResult.criticalCount;
      overallLongestPath = Math.max(overallLongestPath, cpmResult.longestPathDuration);
      overallShiftedCount += shiftedCount;
      if (cpmResult.hasLoops) anyLoops = true;
      if (shiftedCount > 0) {
        onUpdateProject(updatedProject);
      }
    });

    const dataDateStr = new Date().toISOString().slice(0, 10);
    setP6ModalData({
      isOpen: true,
      dataDate: dataDateStr,
      totalTasks: overallTotalTasks,
      criticalCount: overallCriticalCount,
      longestPath: overallLongestPath,
      shiftedCount: overallShiftedCount,
      hasLoops: anyLoops
    });

    // Automatically enable critical path highlighting so user immediately sees the critical chain in red
    setShowCriticalPath(true);

    setToastMsg(
      `Primavera P6 Schedule (F9) Sukses: Data Date ${dataDateStr} | ${overallCriticalCount} Aktivitas Kritis (TF: 0d) | ${overallShiftedCount} Jadwal Terupdate.`
    );
    setTimeout(() => setToastMsg(null), 5000);
  };

  // Global F9 keyboard shortcut for P6 Run Schedule & Escape modal dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleRunP6Schedule();
      } else if (e.key === 'Escape' && smartSchedulePreview) {
        setSmartSchedulePreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectsList, onUpdateProject, smartSchedulePreview]);

  // Export State and Refs
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [isPrefsDropdownOpen, setIsPrefsDropdownOpen] = useState<boolean>(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [exportAlignRight, setExportAlignRight] = useState<boolean>(false);
  const [prefsAlignRight, setPrefsAlignRight] = useState<boolean>(false);
  const [baselineAlignRight, setBaselineAlignRight] = useState<boolean>(false);
  const [showAnalysisToolbar, setShowAnalysisToolbar] = useState<boolean>(() => {
    const saved = localStorage.getItem('gantt_showAnalysisToolbar');
    return saved !== null ? saved === 'true' : true;
  });
  const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);
  const ganttWorkspaceRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const prefsDropdownRef = useRef<HTMLDivElement>(null);
  const baselineDropdownRef = useRef<HTMLDivElement>(null);

  const shouldAlignMenuRight = (el: HTMLElement | null, menuWidthPx: number): boolean => {
    if (!el || typeof window === 'undefined') return false;
    const rect = el.getBoundingClientRect();
    return rect.left + menuWidthPx > window.innerWidth - 16;
  };

  const toggleAnalysisToolbar = () => {
    setShowAnalysisToolbar(prev => {
      const next = !prev;
      localStorage.setItem('gantt_showAnalysisToolbar', String(next));
      return next;
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
      if (prefsDropdownRef.current && !prefsDropdownRef.current.contains(event.target as Node)) {
        setIsPrefsDropdownOpen(false);
      }
      if (baselineDropdownRef.current && !baselineDropdownRef.current.contains(event.target as Node)) {
        setShowBaselineMenu(false);
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

    // Wait for React to disable row virtualization and render all visible rows cleanly
    await new Promise(resolve => setTimeout(resolve, 90));

    // Apply oklab workaround for html2canvas
    const restoreCssRules = overrideCssRules();

    try {
      const elementsToHide = ganttWorkspaceRef.current.querySelectorAll('.print\\:hidden, [data-export-hide]');
      const originalDisplays = Array.from(elementsToHide).map(el => (el as HTMLElement).style.display);

      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      const originalMaxHeight = ganttWorkspaceRef.current.style.maxHeight;
      ganttWorkspaceRef.current.style.maxHeight = 'none';

      const canvas = await html2canvas(ganttWorkspaceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      ganttWorkspaceRef.current.style.maxHeight = originalMaxHeight;

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
      setToastMsg('Export PNG gagal. Silakan coba lagi.');
    } finally {
      restoreCssRules();
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!ganttWorkspaceRef.current) return;
    setIsExporting(true);
    setIsExportDropdownOpen(false);

    // Wait for React to disable row virtualization and render all visible rows cleanly
    await new Promise(resolve => setTimeout(resolve, 90));

    // Apply oklab workaround for html2canvas
    const restoreCssRules = overrideCssRules();

    try {
      const elementsToHide = ganttWorkspaceRef.current.querySelectorAll('.print\\:hidden, [data-export-hide]');
      const originalDisplays = Array.from(elementsToHide).map(el => (el as HTMLElement).style.display);

      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      const originalMaxHeight = ganttWorkspaceRef.current.style.maxHeight;
      ganttWorkspaceRef.current.style.maxHeight = 'none';

      const canvas = await html2canvas(ganttWorkspaceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      ganttWorkspaceRef.current.style.maxHeight = originalMaxHeight;

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
      setToastMsg('Export PDF gagal. Silakan coba lagi.');
    } finally {
      restoreCssRules();
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExportDropdownOpen(false);
    const exportRows = rows.length > 0 ? rows : fullTreeRows;
    if (exportRows.length === 0) {
      setToastMsg('Tidak ada data aktivitas untuk diekspor.');
      return;
    }

    const csvEscape = (val: unknown): string => {
      const str = String(val ?? '').replace(/\r?\n/g, ' ');
      if (str.includes(',') || str.includes('"') || str.includes(';')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Act ID',
      'WBS',
      'Level',
      'Activity Name',
      'Type',
      'Duration (d)',
      'Start',
      'Finish',
      'Base Start',
      'Base Finish',
      'Predecessors',
      'Progress (%)',
      'Total Float (d)',
      'Free Float (d)',
      'Plan Hours',
      'Actual Hours',
      'Variance Hours',
      'Assignee',
      'Company',
      'Status'
    ];

    const lines = [
      headers.map(csvEscape).join(','),
      ...exportRows.map(r => {
        const levelLabel = r.level === 0 ? 'Project' : r.level === 1 ? 'Sub-Assembly' : (r.isMilestone ? 'Milestone' : 'Task');
        const predLabel = getPredecessorsLabel(r);
        const variance = (r.planHours || 0) - (r.actualHours || 0);
        return [
          r.activityId || '',
          r.wbs,
          levelLabel,
          r.name,
          r.type,
          r.isMilestone ? 0 : r.duration,
          r.start || '',
          r.finish || '',
          r.baselineStart || '',
          r.baselineFinish || '',
          predLabel === '—' ? '' : predLabel,
          r.pct,
          r.totalFloat ?? '',
          r.freeFloat ?? '',
          r.planHours ? r.planHours.toFixed(1) : '0',
          r.actualHours ? r.actualHours.toFixed(1) : '0',
          variance.toFixed(1),
          r.assigned || '',
          r.assignedCompany || '',
          r.workflowStatus || (r.done ? 'complete' : r.pct > 0 ? 'on_track' : 'not_started')
        ].map(csvEscape).join(',');
      })
    ];

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadName = projectsList.length === 1 && projectsList[0] ? projectsList[0].name : 'Projects';
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule_${downloadName || 'project'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToastMsg(`Berhasil mengekspor ${exportRows.length} baris ke CSV (Excel).`);
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
  const [editingBaselineCell, setEditingBaselineCell] = useState<{ rowId: string; field: 'start' | 'finish' } | null>(null);
  const [baselineManagerModalOpen, setBaselineManagerModalOpen] = useState<boolean>(false);
  const [shiftDaysInput, setShiftDaysInput] = useState<number>(7);
  const [baselineTargetProjectId, setBaselineTargetProjectId] = useState<string>('');
  const [editingLookaheadCell, setEditingLookaheadCell] = useState<{ rowId: string; field: 'crew' | 'company' | 'assigned' } | null>(null);
  const [editingPred, setEditingPred] = useState<string | null>(null);
  const [predInputVal, setPredInputVal] = useState<string>('');
  const [editingPct, setEditingPct] = useState<string | null>(null);
  const [editingHoursCell, setEditingHoursCell] = useState<string | null>(null);
  const [flashingCellId, setFlashingCellId] = useState<string | null>(null);
  const [flashingTimelineRowId, setFlashingTimelineRowId] = useState<string | null>(null);
  const flashBarTimerRef = useRef<number | null>(null);

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
  const latestLeftPanelWidthRef = useRef<number>(leftPanelWidth);
  latestLeftPanelWidthRef.current = leftPanelWidth;

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplitter(true);
    splitterStartRef.current = {
      x: e.clientX,
      width: leftPanelWidth
    };
  };

  const handleSplitterDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Auto fit to comfortable width (or toggle between compact and wide)
    const targetWidth = leftPanelWidth <= 150 ? defaultTotalTableWidth : (leftPanelWidth > 800 ? defaultTotalTableWidth : 880);
    setLeftPanelWidth(targetWidth);
    try {
      localStorage.setItem(`gantt_left_panel_width_${projectStorageId}`, targetWidth.toString());
    } catch {}
  };

  const handleToggleCollapseTable = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (leftPanelWidth <= 120) {
      const target = defaultTotalTableWidth;
      setLeftPanelWidth(target);
      try { localStorage.setItem(`gantt_left_panel_width_${projectStorageId}`, target.toString()); } catch {}
    } else {
      setLeftPanelWidth(90);
      try { localStorage.setItem(`gantt_left_panel_width_${projectStorageId}`, '90'); } catch {}
    }
  };

  useEffect(() => {
    if (!isResizingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitterStartRef.current) return;
      const deltaX = e.clientX - splitterStartRef.current.x;
      const nextWidth = Math.max(70, Math.min(splitterStartRef.current.width + deltaX, 1300));
      latestLeftPanelWidthRef.current = nextWidth;
      setLeftPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSplitter(false);
      splitterStartRef.current = null;
      try {
        localStorage.setItem(`gantt_left_panel_width_${projectStorageId}`, latestLeftPanelWidthRef.current.toString());
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
  }, [isResizingSplitter, project?.id, projectsList, projectStorageId]);

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
      if (flashBarTimerRef.current !== null) {
        window.clearTimeout(flashBarTimerRef.current);
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
      if (pStartStr && typeof pStartStr === 'string') {
        const d = parseLocalDate(pStartStr.slice(0, 10));
        if (!overallMinDate || d < overallMinDate) overallMinDate = d;
      }
      if (p.due && typeof p.due === 'string') {
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

  // Unified CPM results from cpmEngine (single source of truth for table & timeline)
  const criticalPathIds = cpmData.criticalTaskIds;
  const slackMap = cpmData.floatMap;
  const criticalAssemblyIds = cpmData.criticalAssemblyIds;

  const criticalChainLength = useMemo(() => {
    const criticalTasks = projectsList.flatMap(p =>
      p.assemblies?.flatMap(asm =>
        asm.tasks?.filter(t => criticalPathIds.has(t.id)) || []
      ) || []
    );

    if (criticalTasks.length === 0) return 0;

    const dates = criticalTasks.flatMap(t => {
      const start = t.date || t.startDate || pStart;
      const finish = t.finishDate || t.endDate || start;
      return [parseLocalDate(start), parseLocalDate(finish)];
    });

    if (dates.length === 0) return 0;

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return Math.max(1, daysBetween(minDate, maxDate) + 1);
  }, [projectsList, criticalPathIds, pStart]);

  // Pixels per day calculated based on custom fit/wheel zoom or selected preset level
  const pixelsPerDay = useMemo(() => {
    if (customPixelsPerDay !== null) return customPixelsPerDay;
    switch (zoomMode) {
      case 'day': return 42;
      case 'week': return 14;
      case 'month': return 4;
      case 'quarter': return 1.5;
      default: return 14;
    }
  }, [zoomMode, customPixelsPerDay]);

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

  const pixelsPerDayRef = useRef<number>(pixelsPerDay);
  pixelsPerDayRef.current = pixelsPerDay;
  const timelineStartRef = useRef<Date>(timelineStart);
  timelineStartRef.current = timelineStart;

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
  const saveDate = (rowId: string, field: 'start' | 'finish' | 'both', newVal: string) => {
    if (!onUpdateProject) return;

    const res = findAndCloneProject(rowId);
    if (!res) return;
    const updated = res.cloned;

    if (rowId === updated.id) {
      // Project level
      if (field === 'start') updated.start = newVal || '';
      else if (field === 'finish') updated.due = newVal || '';
      else {
        updated.start = '';
        updated.due = '';
      }
    } else {
      // Find in assemblies
      const asm = updated.assemblies?.find(a => a.id === rowId || rowId.startsWith(a.id));
      if (asm) {
        if (field === 'start') asm.start = newVal || undefined;
        else if (field === 'finish') asm.finish = newVal || undefined;
        else {
          asm.start = undefined;
          asm.finish = undefined;
        }
      } else {
        // Find in tasks
        for (const a of updated.assemblies || []) {
          const t = a.tasks?.find(task => task.id === rowId || rowId.startsWith(task.id));
          if (t) {
            if (field === 'start') {
              t.date = newVal || undefined;
              t.startDate = newVal || undefined;
            } else if (field === 'finish') {
              t.finishDate = newVal || undefined;
              t.endDate = newVal || undefined;
            } else {
              // 'both' -> clear both start and finish
              t.date = undefined;
              t.startDate = undefined;
              t.finishDate = undefined;
              t.endDate = undefined;
            }
            break;
          }
        }
      }
    }
    // AUTO-SCHEDULE FEATURE
    if (autoSchedule && newVal) {
      // Auto-Schedule ON: cascade successor tasks only if a valid non-empty date was assigned
      const { updatedProject, shiftedIds } = cascadeSchedule(updated, rowId);
      if (shiftedIds.size > 0) {
        setCascadedTaskIds(shiftedIds);
      }
      onUpdateProject(updatedProject);
    } else {
      // Auto-Schedule OFF or clearing date: save directly without shifting other tasks
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
    setToastMsg(`Relasi dependensi dihapus: ${srcRow?.wbs || 'Task'} → ${targetRow.wbs}`);
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
        if (clampedPct === 100) {
          t.workflowStatus = 'complete';
        } else if (clampedPct > 0 && (!t.workflowStatus || t.workflowStatus === 'not_started')) {
          t.workflowStatus = 'on_track';
        }
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

  // Inline Duration (days) save handler
  const saveDuration = (rowId: string, days: number) => {
    if (!onUpdateProject) return;
    const safeDays = Math.max(1, Math.min(3650, Math.round(days)));

    const res = findAndCloneProject(rowId);
    if (!res) return;
    const updated = res.cloned;

    let found = false;
    for (const a of updated.assemblies || []) {
      const t = a.tasks?.find(task => task.id === rowId);
      if (t) {
        if (t.isMilestone) return;
        const curStart = t.date || t.startDate || a.start || updated.start || formatLocalDate(new Date());
        const nextFinish = addDaysToLocalDate(curStart, safeDays - 1);
        t.date = curStart;
        t.startDate = curStart;
        t.finishDate = nextFinish;
        t.endDate = nextFinish;
        found = true;
        break;
      }
    }

    if (!found) return;

    updated.assemblies?.forEach(asm => {
      if (!asm.tasks || asm.tasks.length === 0) return;
      let minStart: Date | null = null;
      let maxFinish: Date | null = null;
      asm.tasks.forEach(t => {
        const sStr = t.date || t.startDate;
        const fStr = t.finishDate || t.endDate || sStr;
        if (sStr) {
          const sd = parseLocalDate(sStr);
          if (!minStart || sd < minStart) minStart = sd;
        }
        if (fStr) {
          const fd = parseLocalDate(fStr);
          if (!maxFinish || fd > maxFinish) maxFinish = fd;
        }
      });
      if (minStart) asm.start = formatLocalDate(minStart);
      if (maxFinish) asm.finish = formatLocalDate(maxFinish);
    });

    if (autoSchedule) {
      const { updatedProject, shiftedIds } = cascadeSchedule(updated, rowId);
      if (shiftedIds.size > 0) {
        setCascadedTaskIds(shiftedIds);
      }
      onUpdateProject(updatedProject);
    } else {
      onUpdateProject(updated);
    }

    setFlashingCellId(rowId);
    setTimeout(() => setFlashingCellId(null), 500);
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

  const applyBaselineForProject = (targetProj: Project) => {
    if (!onUpdateProject) return;

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

  const setBaselineForProject = (targetProj: Project, bypassConfirm = false) => {
    if (!onUpdateProject) return;

    const hasExistingBaseline = Boolean(
      targetProj.baselineStart ||
      targetProj.baselineFinish ||
      targetProj.assemblies?.some(a => a.baselineStart || a.tasks?.some(t => t.baselineStart))
    );

    if (hasExistingBaseline && !bypassConfirm) {
      setBaselineConfirm({
        isOpen: true,
        title: 'Timpa Baseline Proyek?',
        message: `Proyek "${targetProj.name}" sudah memiliki Baseline (${targetProj.baselineStart || '—'} s/d ${targetProj.baselineFinish || '—'}). Re-baseline dengan jadwal aktual saat ini?`,
        confirmLabel: 'Ya, Perbarui Baseline',
        tone: 'primary',
        onConfirm: () => {
          applyBaselineForProject(targetProj);
          setBaselineConfirm(null);
        }
      });
      return;
    }

    applyBaselineForProject(targetProj);
  };

  const handleSetBaselineAll = () => {
    if (!onUpdateProject || projectsList.length === 0) return;
    setBaselineConfirm({
      isOpen: true,
      title: `Kunci Baseline (${projectsList.length} Proyek)`,
      message: `Jadwal rencana baseline untuk seluruh ${projectsList.length} proyek yang ditampilkan akan disalin dari tanggal aktual saat ini.`,
      confirmLabel: 'Kunci Semua Baseline',
      tone: 'primary',
      onConfirm: () => {
        projectsList.forEach(p => applyBaselineForProject(p));
        setBaselineConfirm(null);
      }
    });
  };

  // Inline Baseline Date Saving handler (per task, per assembly, or per project)
  const saveBaselineDate = (rowId: string, field: 'start' | 'finish' | 'both', newVal: string) => {
    if (!onUpdateProject) return;

    const res = findAndCloneProject(rowId);
    if (!res) return;
    const updated = res.cloned;

    if (rowId === updated.id) {
      if (field === 'start') updated.baselineStart = newVal || undefined;
      else if (field === 'finish') updated.baselineFinish = newVal || undefined;
      else {
        updated.baselineStart = undefined;
        updated.baselineFinish = undefined;
      }
    } else {
      const asm = updated.assemblies?.find(a => a.id === rowId || rowId.startsWith(a.id) || a.id.startsWith(rowId));
      if (asm) {
        if (field === 'start') asm.baselineStart = newVal || undefined;
        else if (field === 'finish') asm.baselineFinish = newVal || undefined;
        else {
          asm.baselineStart = undefined;
          asm.baselineFinish = undefined;
        }
      } else {
        for (const a of updated.assemblies || []) {
          const t = a.tasks?.find(task => task.id === rowId || rowId.startsWith(task.id) || task.id.startsWith(rowId));
          if (t) {
            if (field === 'start') t.baselineStart = newVal || undefined;
            else if (field === 'finish') t.baselineFinish = newVal || undefined;
            else {
              t.baselineStart = undefined;
              t.baselineFinish = undefined;
            }

            // Recalculate parent assembly baseline bounds
            let minAsmBaseStart: string | null = null;
            let maxAsmBaseFinish: string | null = null;
            a.tasks?.forEach(task => {
              if (task.baselineStart) {
                if (!minAsmBaseStart || task.baselineStart < minAsmBaseStart) minAsmBaseStart = task.baselineStart;
              }
              if (task.baselineFinish) {
                if (!maxAsmBaseFinish || task.baselineFinish > maxAsmBaseFinish) maxAsmBaseFinish = task.baselineFinish;
              }
            });
            a.baselineStart = minAsmBaseStart || undefined;
            a.baselineFinish = maxAsmBaseFinish || undefined;
            break;
          }
        }
      }
    }

    // Also recalculate project level baseline bounds
    let pMinBase: string | null = null;
    let pMaxBase: string | null = null;
    updated.assemblies?.forEach(a => {
      if (a.baselineStart && (!pMinBase || a.baselineStart < pMinBase)) pMinBase = a.baselineStart;
      if (a.baselineFinish && (!pMaxBase || a.baselineFinish > pMaxBase)) pMaxBase = a.baselineFinish;
    });
    updated.baselineStart = pMinBase || undefined;
    updated.baselineFinish = pMaxBase || undefined;

    onUpdateProject(updated);
    setToastMsg(`Baseline diperbarui: ${newVal || 'Dikosongkan'}`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Clear / Reset Baseline handler
  const clearBaselineForProject = (targetProj: Project) => {
    if (!onUpdateProject) return;
    setBaselineConfirm({
      isOpen: true,
      title: 'Reset Baseline Proyek?',
      message: `Hapus seluruh jadwal baseline untuk proyek "${targetProj.name}"? Anda dapat mengatur ulang dari awal setelah direset.`,
      confirmLabel: 'Ya, Reset Baseline',
      tone: 'danger',
      onConfirm: () => {
        const updatedAssemblies = (targetProj.assemblies || []).map(asm => ({
          ...asm,
          baselineStart: undefined,
          baselineFinish: undefined,
          tasks: (asm.tasks || []).map(t => ({
            ...t,
            baselineStart: undefined,
            baselineFinish: undefined
          }))
        }));

        const updated: Project = {
          ...targetProj,
          baselineStart: undefined,
          baselineFinish: undefined,
          assemblies: updatedAssemblies
        };

        onUpdateProject(updated);
        setToastMsg(`Baseline proyek "${targetProj.name}" berhasil direset.`);
        setTimeout(() => setToastMsg(null), 3000);
        setBaselineConfirm(null);
      }
    });
  };

  // Shift Baseline by X Days (geser serentak)
  const shiftBaselineForProject = (targetProj: Project, days: number) => {
    if (!onUpdateProject || days === 0) return;

    const updatedAssemblies = (targetProj.assemblies || []).map(asm => {
      const nextAsmStart = asm.baselineStart ? addDaysToLocalDate(asm.baselineStart, days) : asm.baselineStart;
      const nextAsmFinish = asm.baselineFinish ? addDaysToLocalDate(asm.baselineFinish, days) : asm.baselineFinish;

      const updatedTasks = (asm.tasks || []).map(t => {
        const nextStart = t.baselineStart ? addDaysToLocalDate(t.baselineStart, days) : t.baselineStart;
        const nextFinish = t.baselineFinish ? addDaysToLocalDate(t.baselineFinish, days) : t.baselineFinish;
        return {
          ...t,
          baselineStart: nextStart,
          baselineFinish: nextFinish
        };
      });

      return {
        ...asm,
        baselineStart: nextAsmStart,
        baselineFinish: nextAsmFinish,
        tasks: updatedTasks
      };
    });

    const nextPStart = targetProj.baselineStart ? addDaysToLocalDate(targetProj.baselineStart, days) : targetProj.baselineStart;
    const nextPFinish = targetProj.baselineFinish ? addDaysToLocalDate(targetProj.baselineFinish, days) : targetProj.baselineFinish;

    const updated: Project = {
      ...targetProj,
      baselineStart: nextPStart,
      baselineFinish: nextPFinish,
      assemblies: updatedAssemblies
    };

    onUpdateProject(updated);
    setToastMsg(`Baseline digeser ${days > 0 ? `+${days}` : days} hari untuk "${targetProj.name}".`);
    setTimeout(() => setToastMsg(null), 3000);
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

  // Handle toast auto dismissal cleanly
  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => {
      setToastMsg(null);
    }, 3800);
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

  // ── S-CURVE FEATURE (WEIGHTED BY PLAN MAN-HOURS WHEN AVAILABLE) ──
  const sCurveData = useMemo(() => {
    if (!showSCurve) return null;

    // Only use task-level rows (level === 2), skip milestones
    const taskRows = allRows.filter(r =>
      r.level === 2 && !r.isMilestone && r.start && r.finish
    );

    if (taskRows.length === 0) return null;

    const totalPlanHrs = taskRows.reduce((sum, r) => sum + (r.planHours > 0 ? r.planHours : 0), 0);
    const useHoursWeighting = totalPlanHrs > 0;
    const N = taskRows.length;

    const totalDays = totalTimelineDays;
    const plannedArr = new Float32Array(totalDays + 1).fill(0);
    const actualArr  = new Float32Array(totalDays + 1).fill(0);

    taskRows.forEach(row => {
      const weight = useHoursWeighting
        ? ((row.planHours > 0 ? row.planHours : 0) / totalPlanHrs)
        : (1 / N);

      if (weight <= 0) return;

      const planStart  = parseLocalDate(row.start!);
      const planFinish = parseLocalDate(row.finish!);
      const planDays   = Math.max(1, daysBetween(planStart, planFinish) + 1);

      const planStartIdx  = Math.max(0, daysBetween(timelineStart, planStart));
      const planFinishIdx = Math.min(totalDays, daysBetween(timelineStart, planFinish));

      if (planStartIdx <= planFinishIdx) {
        const increment = weight / planDays;
        for (let d = planStartIdx; d <= planFinishIdx; d++) {
          plannedArr[d] = (plannedArr[d] || 0) + increment;
        }
      }

      const completedFraction = (row.pct || 0) / 100;
      if (planStartIdx <= planFinishIdx && completedFraction > 0) {
        const increment = (weight * completedFraction) / planDays;
        for (let d = planStartIdx; d <= planFinishIdx; d++) {
          actualArr[d] = (actualArr[d] || 0) + increment;
        }
      }
    });

    // Convert to cumulative (prefix sum), scale to 0–100
    let plannedCum = 0;
    let actualCum  = 0;
    const points: { day: number; planned: number; actual: number }[] = [];
    const sampleInterval = totalDays <= 90 ? 1 : 3;

    for (let d = 0; d <= totalDays; d++) {
      plannedCum = Math.min(100, plannedCum + (plannedArr[d] || 0) * 100);
      actualCum = Math.min(100, actualCum + (actualArr[d] || 0) * 100);
      if (d % sampleInterval === 0 || d === totalDays) {
        points.push({ day: d, planned: plannedCum, actual: actualCum });
      }
    }

    return points;
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
      plannedPath: buildPath('planned'),
      actualPath:  buildPath('actual'),
      totalWidth: totalTimelineDays * pixelsPerDay,
      totalDays: totalTimelineDays,
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
      setToastMsg('Hari ini berada di luar rentang timeline yang ditampilkan.');
      return;
    }
    const scrollTo = Math.max(0, todayX - (rightScrollRef.current.clientWidth / 2));
    rightScrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
  };

  const handleZoomToFit = () => {
    const container = rightScrollRef.current;
    const viewportW = container?.clientWidth || 900;
    const spanDays = Math.max(7, daysBetween(pStartD, pDueD) + 14);
    const idealPx = Number(Math.max(1.0, Math.min(48, (viewportW - 40) / spanDays)).toFixed(2));
    const targetMode: 'day' | 'week' | 'month' | 'quarter' =
      idealPx >= 24 ? 'day' : idealPx >= 8 ? 'week' : idealPx >= 2.6 ? 'month' : 'quarter';

    pendingZoomScrollRef.current = {
      anchorTimeMs: pStartD.getTime(),
      viewportOffsetX: 20,
    };
    skipNextZoomAutoScrollRef.current = true;
    setZoomMode(targetMode);
    setCustomPixelsPerDay(idealPx);
  };

  const scrollToRowOnTimeline = (
    rowId: string,
    opts?: { center?: boolean; onlyIfOffscreen?: boolean }
  ) => {
    const container = rightScrollRef.current;
    if (!container) return;

    const coords = rowBarCoordsCache.get(rowId);
    if (!coords) {
      if (!opts?.onlyIfOffscreen) {
        setToastMsg('Task ini belum memiliki tanggal pada timeline.');
      }
      return;
    }

    const viewLeft = container.scrollLeft;
    const viewWidth = container.clientWidth;
    const viewRight = viewLeft + viewWidth;
    const barLeft = coords.left;
    const barWidth = Math.max(16, coords.width);
    const barRight = barLeft + barWidth;

    if (opts?.onlyIfOffscreen) {
      const isVisible = barRight >= viewLeft + 24 && barLeft <= viewRight - 24;
      if (isVisible) return;
    }

    const targetLeft = barWidth > viewWidth * 0.75
      ? Math.max(0, barLeft - 48)
      : Math.max(0, (barLeft + barWidth / 2) - (viewWidth / 2));

    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setSelectedRowId(rowId);
    setFlashingTimelineRowId(rowId);

    if (flashBarTimerRef.current !== null) {
      window.clearTimeout(flashBarTimerRef.current);
    }
    flashBarTimerRef.current = window.setTimeout(() => {
      setFlashingTimelineRowId(null);
      flashBarTimerRef.current = null;
    }, 1200);
  };

  const hasAutoScrolled = useRef(false);
  const prevZoomModeRef = useRef<string | null>(null);

  // Auto-scroll on mount and zoom change (skipped when Zoom-to-Fit or Ctrl+Wheel handles scroll anchor)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasAutoScrolled.current) {
        scrollToToday();
        hasAutoScrolled.current = true;
        prevZoomModeRef.current = zoomMode;
      } else if (prevZoomModeRef.current !== zoomMode) {
        prevZoomModeRef.current = zoomMode;
        if (skipNextZoomAutoScrollRef.current) {
          skipNextZoomAutoScrollRef.current = false;
          return;
        }
        scrollToToday();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [todayX, zoomMode]);

  // Apply cursor-anchored or fit-anchored scroll once timelineStart & pixelsPerDay commit
  useEffect(() => {
    const pending = pendingZoomScrollRef.current;
    const container = rightScrollRef.current;
    if (!pending || !container) return;
    pendingZoomScrollRef.current = null;
    const anchorDaysFromStart = (pending.anchorTimeMs - timelineStart.getTime()) / 86400000;
    const nextScrollLeft = Math.max(0, anchorDaysFromStart * pixelsPerDay - pending.viewportOffsetX);
    container.scrollLeft = nextScrollLeft;
  }, [timelineStart, pixelsPerDay]);

  // Ctrl/Cmd + Mouse Wheel smooth zoom anchored to cursor on timeline
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;

    const handleWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const cursorViewportX = e.clientX - rect.left;
      const currentPx = pixelsPerDayRef.current;
      const currentTimelineStart = timelineStartRef.current;

      const factor = e.deltaY < 0 ? 1.18 : 0.85;
      const nextPx = Math.max(1.0, Math.min(64, Number((currentPx * factor).toFixed(2))));
      if (Math.abs(nextPx - currentPx) < 0.01) return;

      const offsetDays = (el.scrollLeft + cursorViewportX) / currentPx;
      const anchorTimeMs = currentTimelineStart.getTime() + offsetDays * 86400000;
      const targetMode: 'day' | 'week' | 'month' | 'quarter' =
        nextPx >= 24 ? 'day' : nextPx >= 8 ? 'week' : nextPx >= 2.6 ? 'month' : 'quarter';

      pendingZoomScrollRef.current = {
        anchorTimeMs,
        viewportOffsetX: cursorViewportX,
      };
      skipNextZoomAutoScrollRef.current = true;
      setZoomMode(targetMode);
      setCustomPixelsPerDay(nextPx);
    };

    el.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelZoom);
  }, []);

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
        if (daysBetween(parseLocalDate(dragState.initialStart), parseLocalDate(nextFinish)) < 0) {
          nextFinish = dragState.initialStart;
        }
        setDragState(prev => prev ? { ...prev, tempFinish: nextFinish } : null);
      } else if (dragState.type === 'resize-left') {
        let nextStart = addDaysToLocalDate(dragState.initialStart, deltaDays);
        if (daysBetween(parseLocalDate(dragState.initialFinish), parseLocalDate(nextStart)) > 0) {
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
        if (daysBetween(parseLocalDate(dragState.initialStart), parseLocalDate(nextFinish)) < 0) {
          nextFinish = dragState.initialStart;
        }
        setDragState(prev => prev ? { ...prev, tempFinish: nextFinish } : null);
      } else if (dragState.type === 'resize-left') {
        let nextStart = addDaysToLocalDate(dragState.initialStart, deltaDays);
        if (daysBetween(parseLocalDate(dragState.initialFinish), parseLocalDate(nextStart)) > 0) {
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
  const colNameWidth = 210;
  const colDurWidth = 64;
  const colBaseDurWidth = 64;
  const colPlanHrsWidth = 68;
  const colActHrsWidth = 68;
  const colVarianceWidth = 72;
  const colCrewWidth = 50;
  const colCompanyWidth = 105;
  const colAssigneeWidth = 105;
  const colBaseStartWidth = 92;
  const colBaseFinishWidth = 92;
  const colStartWidth = 104;
  const colFinishWidth = 104;
  const colPredWidth = 90;
  const colPctWidth = 64;
  const colStatusWidth = 100;
  const totalTableWidth = colWbsWidth + colNameWidth + colDurWidth + colBaseDurWidth
    + 75 + 52 + 52 + 74 // Act ID, OD, RD, Total Float in default layout
    + (showHoursTracking ? (colPlanHrsWidth + colActHrsWidth + colVarianceWidth) : 0)
    + (showBaseline ? (colBaseStartWidth + colBaseFinishWidth) : 0)
    + (activeTab === 'lookahead' ? (colCrewWidth + colCompanyWidth + colAssigneeWidth) : 0)
    + colStartWidth + colFinishWidth + colPredWidth + colPctWidth + colStatusWidth;

  const activeLayerCount =
    (showBaseline ? 1 : 0) +
    (showHoursTracking ? 1 : 0) +
    (showCriticalPath ? 1 : 0) +
    (showResourceLoad ? 1 : 0) +
    (showSCurve ? 1 : 0) +
    (connectMode ? 1 : 0);

  return (
    <div className={
      isFullscreen
        ? 'fixed inset-0 z-[200] p-3 sm:p-4 flex flex-col h-screen w-screen bg-base-bg text-base-text transition-all duration-200'
        : `w-full flex flex-col ${embedded ? 'h-[calc(100vh-205px)] min-h-[540px]' : 'h-[calc(100vh-145px)] min-h-[580px]'} bg-base-bg text-base-text transition-all duration-200`
    }>
      {/* TOOLBAR PANEL (overflow-visible so dropdown menus are never clipped) */}
      <div className="flex flex-col gap-2 pb-2.5 border-b border-base-border mb-2 bg-base-bg z-30 shrink-0">
        {/* Bar 1: Primary Navigation, Filter, Zoom & Global Actions (grouped left-to-right for all viewport widths) */}
        <div className="flex flex-wrap items-center justify-start gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {/* Full title when standalone or fullscreen; compact project badge when embedded */}
            {(!embedded || isFullscreen) ? (
              <div className="flex items-center gap-2 min-w-0 mr-1">
                <h2 className="font-condensed font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-1.5 min-w-0">
                  <BarChart3 className="h-4 w-4 text-base-accent shrink-0" />
                  <span className="truncate max-w-[240px] sm:max-w-[340px]" title={projectsList.length > 1 ? 'All Scheduled Projects' : projectsList[0]?.name || 'Project'}>
                    Gantt — <span className="text-base-accent font-black">{projectsList.length > 1 ? 'All Scheduled Projects' : projectsList[0]?.name || 'Project'}</span>
                  </span>
                </h2>
                {projectsList.length === 1 && projectsList[0] && (
                  <span className={`px-2 py-0.5 rounded font-condensed font-bold text-[10px] uppercase tracking-wider border shrink-0 ${getStatusColorClass(projectsList[0].status)}`}>
                    {projectsList[0].status}
                  </span>
                )}
              </div>
            ) : (
              projectsList.length === 1 && projectsList[0] && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-base-surface border border-base-border h-[32px] shrink-0 max-w-[200px]">
                  <span className="text-[11px] font-condensed font-extrabold text-base-text truncate" title={projectsList[0].name}>
                    {projectsList[0].name}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded font-condensed font-bold text-[9px] uppercase border shrink-0 ${getStatusColorClass(projectsList[0].status)}`}>
                    {projectsList[0].status}
                  </span>
                </div>
              )
            )}

            {/* Main View Tab Switcher: Gantt vs Lookahead */}
            <div className="relative flex items-center bg-base-surface border border-base-border rounded-lg p-0.5 h-[32px] shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('gantt')}
                className={`relative z-10 px-2.5 py-1 rounded-md font-condensed font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap transition-colors duration-200 cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeTab === 'gantt' ? 'text-white' : 'text-base-muted hover:text-base-text'
                }`}
              >
                {activeTab === 'gantt' && (
                  <motion.div
                    layoutId="ganttMainTabPill"
                    className="absolute inset-0 bg-base-accent rounded-md -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Gantt</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lookahead')}
                className={`relative z-10 px-2.5 py-1 rounded-md font-condensed font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap transition-colors duration-200 cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeTab === 'lookahead' ? 'text-white' : 'text-base-muted hover:text-base-text'
                }`}
              >
                {activeTab === 'lookahead' && (
                  <motion.div
                    layoutId="ganttMainTabPill"
                    className="absolute inset-0 bg-base-accent rounded-md -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Calendar className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'lookahead' ? 'text-white' : 'text-amber-500'}`} />
                <span>Lookahead</span>
              </button>
            </div>

            {/* Lookahead Range Selector */}
            {activeTab === 'lookahead' && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 h-[32px] shrink-0">
                <span className="text-[10px] font-condensed font-bold uppercase text-amber-600 dark:text-amber-400 shrink-0">
                  Range:
                </span>
                <select
                  value={lookaheadWeeks}
                  onChange={(e) => setLookaheadWeeks(Number(e.target.value))}
                  className="bg-transparent text-xs font-mono font-bold text-amber-700 dark:text-amber-300 outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map(w => (
                    <option key={w} value={w} className="bg-base-surface text-base-text">{w} minggu</option>
                  ))}
                </select>
              </div>
            )}

            {/* Today Button */}
            <button
              type="button"
              onClick={scrollToToday}
              className="flex items-center gap-1.5 px-2.5 rounded-lg border border-base-border hover:bg-base-surface transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text bg-base-surface/60 h-[32px] whitespace-nowrap shrink-0"
              title={`Gulir ke tanggal hari ini (${todayFormattedShort})`}
            >
              <Calendar className="h-3.5 w-3.5 text-base-red shrink-0" />
              <span>Hari Ini</span>
              <span className="hidden xl:inline text-[9px] text-base-muted font-mono font-normal lowercase">({todayFormattedShort})</span>
            </button>

            {/* Search & Status Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex items-center shrink-0">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-base-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari task / WBS..."
                  className="pl-8 pr-2.5 py-1 text-xs bg-base-surface border border-base-border rounded-lg outline-none focus:border-base-accent w-[140px] sm:w-[165px] h-[32px] font-medium"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2 py-1 text-xs bg-base-surface border border-base-border rounded-lg outline-none focus:border-base-accent h-[32px] cursor-pointer font-medium text-base-muted2 focus:text-base-text shrink-0"
              >
                <option value="all">Semua Status</option>
                <option value="on-track">On Track</option>
                <option value="overdue">Terlambat</option>
                <option value="done">Selesai</option>
                <option value="not-started">Belum Mulai</option>
              </select>

              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-2 text-[11px] hover:text-base-red transition-all flex items-center justify-center bg-base-surface border border-base-border rounded-lg h-[32px] cursor-pointer font-bold gap-1 text-base-muted2 whitespace-nowrap shrink-0"
                  title="Reset filter pencarian & status"
                >
                  <X className="h-3 w-3 shrink-0" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Zoom Level Toggle Buttons + Fit */}
            <div className="relative flex items-center bg-base-surface2 border border-base-border rounded-lg p-0.5 h-[32px] shrink-0">
              {['day', 'week', 'month', 'quarter'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    skipNextZoomAutoScrollRef.current = false;
                    setCustomPixelsPerDay(null);
                    setZoomMode(mode as any);
                  }}
                  title={`Zoom ${mode} (atau Ctrl + Scroll pada area timeline)`}
                  className={`relative z-10 px-2 py-1 rounded-md font-condensed font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap transition-colors duration-200 cursor-pointer shrink-0 ${
                    zoomMode === mode && customPixelsPerDay === null ? 'text-white' : 'text-base-muted hover:text-base-text'
                  }`}
                >
                  {zoomMode === mode && customPixelsPerDay === null && (
                    <motion.div
                      layoutId="ganttZoomPill"
                      className="absolute inset-0 bg-base-accent rounded-md -z-10 shadow-xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {mode}
                </button>
              ))}
              <div className="w-[1px] h-3.5 bg-base-border mx-0.5 shrink-0" />
              <button
                type="button"
                onClick={handleZoomToFit}
                title="Zoom to Fit seluruh durasi proyek ke layar"
                className={`relative z-10 px-2 py-1 rounded-md font-condensed font-extrabold uppercase text-[10px] tracking-wider whitespace-nowrap transition-colors duration-200 cursor-pointer shrink-0 flex items-center gap-1 ${
                  customPixelsPerDay !== null
                    ? 'bg-base-accent text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                <Scan className="h-3 w-3 shrink-0" />
                <span>Fit</span>
              </button>
            </div>

            {/* Expand/Collapse All Buttons */}
            <div className="flex items-center bg-base-surface border border-base-border rounded-lg p-0.5 h-[32px] shrink-0">
              <button
                type="button"
                onClick={expandAllAssemblies}
                className="px-2 py-1 rounded-md font-condensed font-bold uppercase transition-all cursor-pointer text-[10px] tracking-wider text-base-muted hover:text-base-text flex items-center gap-1 whitespace-nowrap shrink-0"
                title="Buka Semua Proyek & Task"
              >
                <Maximize2 className="h-3 w-3 shrink-0" />
                <span>Expand</span>
              </button>
              <div className="w-[1px] h-3 bg-base-border mx-0.5 shrink-0" />
              <button
                type="button"
                onClick={collapseAllAssemblies}
                className="px-2 py-1 rounded-md font-condensed font-bold uppercase transition-all cursor-pointer text-[10px] tracking-wider text-base-muted hover:text-base-text flex items-center gap-1 whitespace-nowrap shrink-0"
                title="Tutup Semua Task (Ringkas Proyek)"
              >
                <Minimize2 className="h-3 w-3 shrink-0" />
                <span>Collapse</span>
              </button>
            </div>
          </div>

          <div className="hidden xl:block w-[1px] h-5 bg-base-border shrink-0" />

          {/* Global Actions kept inline right next to primary controls (never stranded far-right on ultrawide screens) */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 rounded-lg border transition-all cursor-pointer font-condensed font-extrabold uppercase tracking-wider text-[10px] h-[32px] whitespace-nowrap shrink-0 ${
                isFilterActive
                  ? 'bg-[#9b1c2e] text-white border-[#9b1c2e] shadow-xs'
                  : 'bg-base-surface border-base-border text-base-text hover:bg-base-surface2 hover:border-base-accent/50'
              }`}
              title="Buka panel View & Filter lengkap"
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>View & Filter</span>
              {(isFilterActive || activeLayerCount > 0) && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono tabular-nums ${
                  isFilterActive ? 'bg-white/20 text-white' : 'bg-base-accent/15 text-base-accent'
                }`}>
                  {activeLayerCount + (isFilterActive ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={toggleAnalysisToolbar}
              className={`flex items-center gap-1.5 px-2.5 rounded-lg border transition-all cursor-pointer font-condensed font-extrabold uppercase tracking-wider text-[10px] h-[32px] whitespace-nowrap shrink-0 ${
                showAnalysisToolbar
                  ? 'bg-base-surface2 border-base-accent/50 text-base-text'
                  : 'bg-base-surface border-base-border text-base-muted2 hover:text-base-text hover:border-base-accent/40'
              }`}
              title={showAnalysisToolbar ? 'Sembunyikan baris alat jadwal & analisis agar area chart lebih luas' : 'Tampilkan baris alat jadwal & analisis'}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-base-accent shrink-0" />
              <span>Alat Analisis</span>
              {!showAnalysisToolbar && activeLayerCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-base-accent text-white text-[9px] font-mono tabular-nums">
                  {activeLayerCount}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-150 ${showAnalysisToolbar ? 'rotate-180' : ''}`} />
            </button>

            {/* Export Dropdown */}
            <div className="relative shrink-0" ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setExportAlignRight(shouldAlignMenuRight(exportDropdownRef.current, 180));
                  setIsExportDropdownOpen(prev => !prev);
                  setIsPrefsDropdownOpen(false);
                  setShowBaselineMenu(false);
                }}
                disabled={isExporting}
                className="flex items-center gap-1 px-2.5 rounded-lg border border-base-border bg-base-surface font-condensed font-bold uppercase tracking-wider text-[10px] text-base-muted2 hover:text-base-text hover:bg-base-surface2 transition-colors cursor-pointer h-[32px] whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>{isExporting ? 'Export...' : 'Export'}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
              {isExportDropdownOpen && (
                <div className={`absolute ${exportAlignRight ? 'right-0' : 'left-0'} top-full mt-1.5 w-44 bg-base-surface border border-base-border rounded-xl shadow-xl py-1 z-[160]`}>
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="w-full text-left px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wide text-base-text hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
                  >
                    Export PNG
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full text-left px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wide text-base-text hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
                  >
                    Export PDF
                  </button>
                  <div className="border-t border-base-border/60 my-0.5" />
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full text-left px-3 py-1.5 text-xs font-condensed font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                    <span>Export CSV (Excel)</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={isFullscreen ? handleExitFullscreen : handleEnterFullscreen}
              className={`flex items-center gap-1.5 px-2.5 text-[10px] font-condensed font-bold uppercase tracking-wider transition-all rounded-lg cursor-pointer whitespace-nowrap shrink-0 border h-[32px] ${
                isFullscreen
                  ? 'text-white bg-base-accent hover:bg-base-accent/90 border-base-accent'
                  : 'text-base-text hover:text-white bg-base-surface hover:bg-base-accent border-base-border hover:border-base-accent'
              }`}
              title={isFullscreen ? 'Keluar dari mode Layar Penuh' : 'Perbesar ke mode Layar Penuh'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Keluar</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Layar Penuh</span>
                </>
              )}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted hover:text-base-red transition-colors rounded-lg cursor-pointer whitespace-nowrap shrink-0 border border-base-border hover:bg-base-surface bg-base-surface/40 h-[32px]"
              >
                Tutup
              </button>
            )}
          </div>
        </div>

        {/* Bar 2: Scheduling Controls & Analysis Layers (collapsible, left-aligned grouped cluster) */}
        {showAnalysisToolbar && (
          <div className="flex flex-wrap items-center justify-start gap-2 bg-base-surface2/55 border border-base-border/80 rounded-xl px-2.5 py-1.5 text-xs">
            {/* Group A: Schedule Editing & CPM Tools */}
            {onUpdateProject !== undefined && (
              <div className="flex flex-wrap items-center gap-1 bg-base-surface border border-base-border/70 rounded-lg p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyStack.length === 0}
                  className={`flex items-center gap-1 px-2 h-[28px] rounded-md transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 ${
                    historyStack.length > 0
                      ? 'hover:bg-base-surface2 text-base-text active:scale-95'
                      : 'text-base-muted/40 cursor-not-allowed opacity-50'
                  }`}
                  title={historyStack.length > 0 ? 'Undo aksi Gantt terakhir (Ctrl + Z)' : 'Tidak ada aksi untuk Undo'}
                >
                  <Undo2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className={`flex items-center gap-1 px-2 h-[28px] rounded-md transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 ${
                    redoStack.length > 0
                      ? 'hover:bg-base-surface2 text-base-text active:scale-95'
                      : 'text-base-muted/40 cursor-not-allowed opacity-50'
                  }`}
                  title={redoStack.length > 0 ? 'Redo aksi Gantt (Ctrl + Y)' : 'Tidak ada aksi untuk Redo'}
                >
                  <Redo2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Redo</span>
                </button>

                <div className="w-[1px] h-4 bg-base-border mx-0.5 shrink-0" />

                <button
                  type="button"
                  onClick={handleSmartSchedule}
                  className="flex items-center gap-1 px-2 h-[28px] rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/35 transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 active:scale-95"
                  title="Smart Schedule: Geser otomatis task dependen yang tumpang tindih dengan pratinjau"
                >
                  <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                  <span>Smart Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunP6Schedule}
                  className="flex items-center gap-1 px-2 h-[28px] rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/35 transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 active:scale-95"
                  title="Hitung ulang jaringan CPM & Critical Path (Shortcut: F9)"
                >
                  <Play className="h-3 w-3 fill-current shrink-0" />
                  <span>Hitung CPM (F9)</span>
                </button>

                <div className="w-[1px] h-4 bg-base-border mx-0.5 shrink-0" />

                <button
                  type="button"
                  onClick={() => handleSetAutoSchedule(!autoSchedule)}
                  title={autoSchedule
                    ? 'Auto-Shift AKTIF — menggeser task otomatis menggeser task penerusnya'
                    : 'Auto-Shift NONAKTIF — hanya task yang digeser yang berpindah'}
                  className={`relative z-10 flex items-center gap-1 px-2 h-[28px] rounded-md font-condensed font-bold uppercase tracking-wider text-[10px] cursor-pointer transition-colors duration-200 whitespace-nowrap shrink-0 ${
                    autoSchedule ? 'text-white font-extrabold' : 'text-base-muted hover:text-base-text'
                  }`}
                >
                  {autoSchedule && (
                    <motion.div
                      layoutId="ganttAutoSchedulePill"
                      className="absolute inset-0 bg-base-accent rounded-md -z-10 shadow-xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span>Auto-Shift</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConnectMode(!connectMode);
                    if (depPanelOpen) setDepPanelOpen(false);
                  }}
                  className={`flex items-center gap-1 px-2 h-[28px] rounded-md transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 ${
                    connectMode
                      ? 'bg-emerald-600 text-white shadow-xs font-black'
                      : 'text-base-muted hover:text-emerald-600'
                  }`}
                  title="Tarik garis dependensi antar task langsung di timeline"
                >
                  <Link className="h-3 w-3 shrink-0" />
                  <span>{connectMode ? 'Drawing...' : 'Draw Link'}</span>
                </button>
              </div>
            )}

            {/* Group B: Analysis Overlays, Baseline & Layer Menu */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Baseline Toggle + Atur Baseline */}
              <div className="flex items-center gap-1 shrink-0 relative" ref={baselineDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !showBaseline;
                    setShowBaseline(nextVal);
                    handleSetShowBaseline(nextVal);
                    if (nextVal) {
                      setToastMsg('Baseline Aktif: Menampilkan perbandingan jadwal Rencana (Baseline) vs Aktual.');
                      setTimeout(() => setToastMsg(null), 3000);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 rounded-lg border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 h-[30px] ${
                    showBaseline
                      ? 'bg-slate-700 text-white border-slate-600 shadow-xs'
                      : 'bg-base-surface border-base-border text-base-muted hover:text-base-text hover:border-slate-500/50'
                  }`}
                  title="Tampilkan atau sembunyikan bar target jadwal Baseline"
                >
                  <BookmarkCheck className={`h-3.5 w-3.5 shrink-0 ${showBaseline ? 'text-white' : 'text-slate-500'}`} />
                  <span>Baseline</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black tabular-nums ${
                    showBaseline ? 'bg-white/20 text-white' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30'
                  }`}>
                    {baselineStats.count}
                  </span>
                </button>

                {canSetBaseline && onUpdateProject && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setBaselineAlignRight(shouldAlignMenuRight(baselineDropdownRef.current, 290));
                        setShowBaselineMenu(prev => !prev);
                        setIsPrefsDropdownOpen(false);
                        setIsExportDropdownOpen(false);
                      }}
                      className="flex items-center gap-1 px-2.5 rounded-lg border border-base-border bg-base-surface text-base-text hover:bg-base-accent/10 hover:border-base-accent/50 hover:text-base-accent transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 h-[30px]"
                      title="Kelola Jadwal Target Baseline (Kunci, Ubah, Geser, atau Reset)"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5 text-base-accent shrink-0" />
                      <span>Atur Baseline</span>
                      <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
                    </button>

                    {showBaselineMenu && (
                      <div className={`absolute ${baselineAlignRight ? 'right-0' : 'left-0'} top-full mt-1.5 w-72 bg-base-surface border border-base-border rounded-xl shadow-xl p-2 z-[160] text-left space-y-1 animate-fade-in font-sans`}>
                        <div className="px-2 py-1 text-[10px] font-bold text-base-muted uppercase tracking-wider border-b border-base-border/50 flex items-center justify-between">
                          <span>Menu Baseline</span>
                          <span className="text-[9px] font-mono font-bold text-slate-500 tabular-nums">{projectsList.length} Proyek</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowBaselineMenu(false);
                            const target = selectedProject || (projectsList.length > 0 ? projectsList[0] : null);
                            if (target) setBaselineTargetProjectId(target.id);
                            setBaselineManagerModalOpen(true);
                            if (!showBaseline) handleSetShowBaseline(true);
                          }}
                          className="w-full text-left px-2 py-2 rounded-lg text-xs hover:bg-base-accent/10 hover:text-base-accent font-bold transition-colors flex items-center gap-2 text-base-text cursor-pointer"
                        >
                          <span className="p-1 rounded bg-base-accent/15 text-base-accent text-xs">⚙️</span>
                          <div>
                            <div className="leading-tight font-extrabold">Buka Pengelola Baseline...</div>
                            <div className="text-[10px] text-base-muted font-normal font-sans">Ubah, geser hari, atau reset baseline</div>
                          </div>
                        </button>

                        <div className="border-t border-base-border/50 my-1" />

                        <div className="px-2 py-0.5 text-[9px] font-bold text-base-muted uppercase tracking-wider font-condensed">
                          Aksi Cepat:
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowBaselineMenu(false);
                            const target = selectedProject || (projectsList.length === 1 ? projectsList[0] : null);
                            if (target) {
                              setBaselineForProject(target);
                              if (!showBaseline) handleSetShowBaseline(true);
                            } else {
                              handleSetBaselineAll();
                              if (!showBaseline) handleSetShowBaseline(true);
                            }
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-base-surface2 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">
                            {selectedProject ? `Kunci Aktual → Baseline (${selectedProject.name})` : 'Kunci Aktual → Baseline Semua'}
                          </span>
                        </button>

                        {projectsList.length > 1 && (
                          <div className="pt-1">
                            <div className="px-2 py-0.5 text-[9px] font-bold text-base-muted uppercase tracking-wider font-condensed">
                              Pilih Proyek:
                            </div>
                            <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                              {projectsList.map(p => (
                                <button
                                  type="button"
                                  key={p.id}
                                  onClick={() => {
                                    setShowBaselineMenu(false);
                                    setBaselineForProject(p);
                                    if (!showBaseline) handleSetShowBaseline(true);
                                  }}
                                  className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-base-surface2 transition-colors flex items-center justify-between gap-1.5 cursor-pointer"
                                >
                                  <span className="truncate">{p.name}</span>
                                  {p.baselineStart && (
                                    <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                      {p.baselineStart.slice(5)}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Plan vs Actual Hours Button */}
              <button
                type="button"
                onClick={() => {
                  const nextVal = !showHoursTracking;
                  setShowHoursTracking(nextVal);
                  handleSetShowHoursTracking(nextVal);
                  if (nextVal) {
                    setToastMsg(`Plan vs Actual Aktif: ${totalHoursStats.actual.toFixed(1)} jam tercatat / ${totalHoursStats.plan.toFixed(1)} jam anggaran (${totalHoursStats.burn}% terpakai).`);
                    setTimeout(() => setToastMsg(null), 3500);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 rounded-lg border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 h-[30px] ${
                  showHoursTracking
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-base-surface border-base-border text-base-muted hover:text-blue-600 hover:border-blue-500/50'
                }`}
                title="Bandingkan anggaran jam kerja vs log aktual Timesheet bengkel"
              >
                <Clock className={`h-3.5 w-3.5 shrink-0 ${showHoursTracking ? 'text-white' : 'text-blue-500'}`} />
                <span>Plan vs Aktual</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black tabular-nums ${
                  showHoursTracking ? 'bg-white/20 text-white' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                }`}>
                  {Math.round(totalHoursStats.actual)}h/{Math.round(totalHoursStats.plan)}h
                </span>
              </button>

              {/* Critical Path Button */}
              <button
                type="button"
                onClick={() => {
                  const nextState = !showCriticalPath;
                  setShowCriticalPath(nextState);
                  if (nextState) {
                    setToastMsg(`Critical Path Aktif: ${criticalPathIds.size} task kritis menentukan durasi selesai proyek.`);
                    setTimeout(() => setToastMsg(null), 3500);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 rounded-lg border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 h-[30px] ${
                  showCriticalPath
                    ? 'bg-red-600 text-white border-red-500 shadow-xs'
                    : 'bg-base-surface border-base-border text-base-muted hover:text-red-600 hover:border-red-500/50'
                }`}
                title="Sorot jalur kritis (Critical Path) tanpa slack yang menentukan jadwal akhir proyek"
              >
                <Flame className={`h-3.5 w-3.5 shrink-0 ${showCriticalPath ? 'text-white fill-white' : 'text-red-500'}`} />
                <span>Critical Path</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black tabular-nums ${
                  showCriticalPath ? 'bg-white/20 text-white' : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                }`}>
                  {criticalPathIds.size}
                </span>
              </button>

              {/* Resource Load Button */}
              <button
                type="button"
                onClick={() => handleSetShowResourceLoad(!showResourceLoad)}
                className={`flex items-center gap-1.5 px-2.5 rounded-lg border transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 h-[30px] ${
                  showResourceLoad
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                    : 'bg-base-surface border-base-border text-base-muted hover:text-indigo-500 hover:border-indigo-500/50'
                }`}
                title="Tampilkan alokasi resource harian & deteksi overload bengkel"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Resource Load</span>
                {resourceLoadData && resourceLoadData.totalOverloadedEmployees > 0 && (
                  <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black tabular-nums animate-pulse">
                    {resourceLoadData.totalOverloadedEmployees}
                  </span>
                )}
              </button>

              {/* Conflict Alert Button (when conflicts exist) */}
              {totalDependencyConflictsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstConflictingId = Array.from(dependencyViolationsMap.keys())[0];
                    if (firstConflictingId && rightScrollRef.current) {
                      const rowIdx = rows.findIndex(r => r.id === firstConflictingId);
                      if (rowIdx >= 0) {
                        rightScrollRef.current.scrollTop = rowIdx * 32;
                        setSelectedRowId(firstConflictingId);
                        const rowConflicts = dependencyViolationsMap.get(firstConflictingId);
                        setToastMsg(`Konflik Jadwal pada "${rows[rowIdx].name}": ${rowConflicts?.[0]?.reason || ''}. Klik 'Smart Schedule' untuk menyelaraskan.`);
                        setTimeout(() => setToastMsg(null), 6000);
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/50 shadow-xs transition-all cursor-pointer font-extrabold uppercase tracking-wider text-[10px] font-condensed whitespace-nowrap shrink-0 h-[30px] animate-pulse"
                  title={`${totalDependencyConflictsCount} task memiliki bentrok dependensi jadwal. Klik untuk lompat ke konflik pertama.`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span>{totalDependencyConflictsCount} Bentrok</span>
                </button>
              )}

              {/* Display Layers Dropdown */}
              <div className="relative shrink-0" ref={prefsDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setPrefsAlignRight(shouldAlignMenuRight(prefsDropdownRef.current, 230));
                    setIsPrefsDropdownOpen(prev => !prev);
                    setShowBaselineMenu(false);
                    setIsExportDropdownOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 rounded-lg border border-base-border bg-base-surface hover:bg-base-surface2 transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text h-[30px] whitespace-nowrap shrink-0"
                  title="Atur preferensi lapisan tampilan Gantt (Panah, Progres, Kurva-S, dll)"
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  <span>Lapisan</span>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </button>
                {isPrefsDropdownOpen && (
                  <div className={`absolute ${prefsAlignRight ? 'right-0' : 'left-0'} top-full mt-1.5 w-56 bg-base-surface border border-base-border rounded-xl shadow-xl p-3.5 z-[160] space-y-2.5 font-sans`}>
                    <div className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted pb-1 border-b border-base-border/50">
                      Lapisan Tampilan Gantt
                    </div>

                    <label className="flex items-center justify-between cursor-pointer group py-0.5">
                      <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Panah Dependensi</span>
                      <input
                        type="checkbox"
                        checked={showArrows}
                        onChange={e => setShowArrows(e.target.checked)}
                        className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group py-0.5">
                      <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Bar Progres (%)</span>
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
                      <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Kurva-S (S-Curve)</span>
                      <input
                        type="checkbox"
                        checked={showSCurve}
                        onChange={e => handleSetShowSCurve(e.target.checked)}
                        className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group py-0.5">
                      <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Beban Resource</span>
                      <input
                        type="checkbox"
                        checked={showResourceLoad}
                        onChange={e => handleSetShowResourceLoad(e.target.checked)}
                        className="h-3.5 w-3.5 accent-base-accent border-base-border rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group py-0.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Jam Kerja Plan vs Aktual</span>
                        <span className="text-[8.5px] text-base-muted font-mono">Integrasi Timesheet</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showHoursTracking}
                        onChange={e => handleSetShowHoursTracking(e.target.checked)}
                        className="h-3.5 w-3.5 accent-blue-600 border-base-border rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group py-0.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-base-muted2 group-hover:text-base-text transition-colors">Tampilkan Baseline</span>
                        <span className="text-[8.5px] text-base-muted font-mono">Target Rencana vs Aktual</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showBaseline}
                        onChange={e => handleSetShowBaseline(e.target.checked)}
                        className="h-3.5 w-3.5 accent-slate-600 border-base-border rounded cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connect Mode Guidance Banner */}
      {connectMode && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium shadow-sm animate-fade-in shrink-0 z-20 border-b border-emerald-700 rounded-lg mb-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-bold font-condensed uppercase tracking-wider text-xs">Mode Tarik Relasi Aktif</span>
            <span className="text-emerald-100 hidden sm:inline text-[11px]">— Seret dari titik ujung task (biru=mulai, hijau=selesai) ke task tujuan, atau klik (✕) pada garis untuk memutus relasi.</span>
          </div>
          <button
            type="button"
            onClick={() => setConnectMode(false)}
            className="px-2.5 py-0.5 bg-emerald-800 hover:bg-emerald-900 rounded font-bold text-[10px] uppercase tracking-wide transition-colors cursor-pointer shrink-0"
          >
            Keluar (Esc)
          </button>
        </div>
      )}

      {/* Critical Path Summary Mini-Panel */}
      {showCriticalPath && (
        <div className="flex flex-wrap items-center justify-start gap-3 px-3 py-1.5 bg-base-red-dim/20 border border-base-border rounded-lg mb-1.5 text-xs select-none shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-base-text">
            <span className="font-condensed font-extrabold text-base-red uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-base-red animate-pulse" />
              Ringkasan Critical Path
            </span>
            <div className="hidden sm:block w-[1px] h-3 bg-base-border" />
            <div className="flex items-center gap-1 font-semibold text-base-muted2 text-[11px]">
              <span>Task Kritis:</span>
              <span className="font-mono font-bold text-base-red bg-base-red-dim/30 px-1.5 py-0.5 rounded text-[10px] tabular-nums">
                {criticalPathIds.size}
              </span>
            </div>
            <div className="hidden sm:block w-[1px] h-3 bg-base-border" />
            <div className="flex items-center gap-1 font-semibold text-base-muted2 text-[11px]">
              <span>Panjang Rantai Kritis:</span>
              <span className="font-mono font-extrabold text-base-text text-[11px] tabular-nums">
                {criticalChainLength} hari
              </span>
            </div>
          </div>
          {firstCriticalRowIdx !== -1 && (
            <button
              type="button"
              onClick={jumpToFirstCriticalTask}
              className="flex items-center gap-1 px-2.5 py-1 bg-base-red text-white font-condensed font-bold uppercase tracking-wider text-[10px] rounded hover:bg-opacity-90 cursor-pointer transition-colors shrink-0"
            >
              <span>Lompat ke task kritis pertama</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}

      {/* Gantt Legend & Hours Summary (left-grouped so hours summary stays in sight on ultrawide monitors) */}
      <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1.5 px-3 py-1.5 bg-base-surface/60 border border-base-border/70 rounded-lg mb-1.5 text-[11px] font-medium text-base-muted2 select-none shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1"><span className="text-[10px]">🔴</span> Critical Path</span>
          <span className="flex items-center gap-1"><span className="text-[10px]">🔵</span> On Track</span>
          <span className="flex items-center gap-1"><span className="text-[10px]">🟡</span> Terlambat</span>
          <span className="flex items-center gap-1"><span className="text-[10px]">🟢</span> Selesai</span>
          {showBaseline && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-2 rounded-xs bg-slate-400/60 dark:bg-slate-500/60 border border-slate-500/80 shadow-2xs" />
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Baseline</span>
            </span>
          )}
          <span className="hidden xl:inline text-[10px] text-base-muted border-l border-base-border pl-2.5">
            Tips: Klik kolom <strong className="font-mono text-base-text">% Comp</strong> untuk edit progres langsung
          </span>
        </div>

        {showHoursTracking && (
          <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-mono tabular-nums xl:border-l xl:border-base-border xl:pl-3">
            <span className="text-base-muted hidden sm:inline">Jam Kerja:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              Plan {totalHoursStats.plan.toFixed(1)}h
            </span>
            <span className="text-base-border">|</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              Actual {totalHoursStats.actual.toFixed(1)}h ({totalHoursStats.entries})
            </span>
            <span className="text-base-border">|</span>
            <span className={`font-black px-1.5 py-0.5 rounded ${
              totalHoursStats.actual > totalHoursStats.plan
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}>
              Burn {totalHoursStats.burn}% ({totalHoursStats.variance > 0 ? `+${totalHoursStats.variance.toFixed(1)}h over` : `${Math.abs(totalHoursStats.variance).toFixed(1)}h under`})
            </span>
          </div>
        )}
      </div>

      {/* CORE GANTT WORKSPACE BOX */}
      <div ref={ganttWorkspaceRef} className="shadow-card border border-base-border rounded-xl bg-base-surface flex flex-1 min-h-0 overflow-hidden relative">
        
        {/* LEFT FIXED PANEL (MS Project Columns) */}
        <GanttGrid
          leftPanelWidth={leftPanelWidth}
          totalTableWidth={totalTableWidth}
          leftScrollRef={leftScrollRef}
          handleLeftWheel={handleLeftWheel}
          colActIdWidth={75}
          colWbsWidth={colWbsWidth}
          colNameWidth={colNameWidth}
          colDurWidth={colDurWidth}
          colBaseDurWidth={colBaseDurWidth}
          colOdWidth={52}
          colRdWidth={52}
          colTotalFloatWidth={74}
          colFreeFloatWidth={70}
          colEarlyStartWidth={88}
          colEarlyFinishWidth={88}
          colLateStartWidth={88}
          colLateFinishWidth={88}
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
          allRows={fullTreeRows}
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
          isFilterActive={isFilterActive || activeTab === 'lookahead'}
          onScrollToBar={scrollToRowOnTimeline}
          onSaveDuration={allowedToEdit ? saveDuration : undefined}
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
          editingBaselineCell={editingBaselineCell}
          setEditingBaselineCell={setEditingBaselineCell}
          saveBaselineDate={allowedToEdit ? saveBaselineDate : undefined}
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

        {/* ENHANCED RESIZE SPLITTER BAR */}
        <div
          className={`w-3.5 cursor-col-resize relative z-30 shrink-0 self-stretch transition-all select-none flex flex-col items-center justify-center bg-base-surface2 border-x border-base-border group ${
            isResizingSplitter
              ? 'bg-base-accent/25 border-base-accent shadow-md'
              : 'hover:bg-base-accent-dim/40 hover:border-base-accent/60'
          }`}
          onMouseDown={handleSplitterMouseDown}
          onDoubleClick={handleSplitterDoubleClick}
          title="Geser (Drag) untuk mengubah lebar tabel | Double-click untuk Auto-Fit | Klik tombol panah untuk Ciutkan/Lebarkan"
        >
          {/* Quick Collapse / Expand Toggle Button on Splitter */}
          <button
            type="button"
            onClick={handleToggleCollapseTable}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-2 w-5 h-6 rounded-md bg-base-surface border border-base-border shadow-xs flex items-center justify-center text-base-muted hover:text-base-accent hover:border-base-accent transition-all cursor-pointer z-40 hover:scale-110 active:scale-95"
            title={leftPanelWidth <= 120 ? "Lebarkan Tabel (Buka)" : "Ciutkan Tabel (Fokus ke Timeline)"}
          >
            {leftPanelWidth <= 120 ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Grip Texture (Vertical textured dots/bars) */}
          <div className="flex flex-col gap-1 items-center justify-center pointer-events-none py-2">
            <div className={`w-1 h-1 rounded-full transition-colors ${isResizingSplitter ? 'bg-base-accent' : 'bg-base-muted/40 group-hover:bg-base-accent'}`} />
            <div className={`w-1 h-3 rounded-full transition-colors ${isResizingSplitter ? 'bg-base-accent' : 'bg-base-muted/50 group-hover:bg-base-accent'}`} />
            <div className={`w-1 h-1 rounded-full transition-colors ${isResizingSplitter ? 'bg-base-accent' : 'bg-base-muted/40 group-hover:bg-base-accent'}`} />
          </div>

          {/* Floating live width badge during resizing */}
          {isResizingSplitter && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-base-surface text-base-text border border-base-accent px-2 py-0.5 rounded shadow-lg text-[9px] font-mono font-bold whitespace-nowrap z-50 pointer-events-none animate-pulse">
              {leftPanelWidth}px
            </div>
          )}
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
          flashingTimelineRowId={flashingTimelineRowId}
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
                          setToastMsg(`Melompat ke task: ${t.taskName}`);
                          setTimeout(() => setToastMsg(null), 3000);
                        }
                      }}
                      className="p-1.5 rounded bg-base-surface2 border border-base-border/60 hover:border-indigo-500 hover:bg-indigo-500/10 cursor-pointer transition-all text-[11px] flex items-center justify-between group"
                      title="Klik untuk lompat ke task ini pada Gantt chart di atas"
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
          <div className="fixed bottom-24 right-5 bg-base-surface border border-base-border shadow-2xl rounded-xl pl-3.5 pr-2.5 py-2.5 text-xs font-semibold z-[1100] flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-md">
            <span className="w-2 h-2 rounded-full bg-base-accent shrink-0" />
            <span className="text-base-text font-semibold leading-snug">{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="p-0.5 rounded hover:bg-base-surface3 text-base-muted hover:text-base-text cursor-pointer shrink-0"
              title="Tutup"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* FLOATING ACTION BUTTON (FAB) — Opens Consolidated 'View & Filter' Drawer */}
        <button
          type="button"
          data-export-hide="true"
          onClick={() => setIsFilterDrawerOpen(true)}
          className="fixed bottom-5 md:bottom-12 right-5 z-[220] flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#9b1c2e] hover:bg-[#821524] text-white shadow-xl border border-white/15 font-condensed font-extrabold uppercase tracking-wider text-xs cursor-pointer transition-all active:scale-95 print:hidden whitespace-nowrap"
          title="Buka panel View & Filter Gantt (Akses cepat semua kontrol di layar mana pun)"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span>View & Filter</span>
          {(isFilterActive || activeLayerCount > 0) && (
            <span className="px-1.5 py-0.2 rounded-full bg-white text-[#9b1c2e] text-[10px] font-mono font-black tabular-nums">
              {activeLayerCount + (isFilterActive ? 1 : 0)}
            </span>
          )}
        </button>

        {/* CONSOLIDATED 'VIEW & FILTER' DRAWER */}
        <GanttViewFilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lookaheadWeeks={lookaheadWeeks}
          setLookaheadWeeks={setLookaheadWeeks}
          scrollToToday={scrollToToday}
          todayFormattedShort={todayFormattedShort}
          expandAllAssemblies={expandAllAssemblies}
          collapseAllAssemblies={collapseAllAssemblies}
          isFullscreen={isFullscreen}
          onToggleFullscreen={isFullscreen ? handleExitFullscreen : handleEnterFullscreen}
          onCloseGantt={onClose}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          availableMonths={availableMonths}
          showCompleted={showCompleted}
          setShowCompleted={setShowCompleted}
          isFilterActive={isFilterActive}
          zoomMode={zoomMode}
          customPixelsPerDay={customPixelsPerDay}
          onSelectZoom={(mode) => {
            skipNextZoomAutoScrollRef.current = false;
            setCustomPixelsPerDay(null);
            setZoomMode(mode);
          }}
          onZoomToFit={handleZoomToFit}
          showArrows={showArrows}
          setShowArrows={setShowArrows}
          showProgress={showProgress}
          setShowProgress={setShowProgress}
          showCriticalPath={showCriticalPath}
          setShowCriticalPath={setShowCriticalPath}
          criticalCount={criticalPathIds.size}
          showSCurve={showSCurve}
          onToggleSCurve={handleSetShowSCurve}
          showResourceLoad={showResourceLoad}
          onToggleResourceLoad={handleSetShowResourceLoad}
          overloadedEmployeesCount={resourceLoadData?.totalOverloadedEmployees || 0}
          showHoursTracking={showHoursTracking}
          onToggleHoursTracking={(val) => {
            setShowHoursTracking(val);
            handleSetShowHoursTracking(val);
          }}
          totalHoursStats={totalHoursStats}
          showBaseline={showBaseline}
          onToggleBaseline={(val) => {
            setShowBaseline(val);
            handleSetShowBaseline(val);
          }}
          baselineCount={baselineStats.count}
          totalDependencyConflictsCount={totalDependencyConflictsCount}
          onJumpToFirstConflict={() => {
            const firstConflictingId = Array.from(dependencyViolationsMap.keys())[0];
            if (firstConflictingId && rightScrollRef.current) {
              const rowIdx = rows.findIndex(r => r.id === firstConflictingId);
              if (rowIdx >= 0) {
                rightScrollRef.current.scrollTop = rowIdx * 32;
                setSelectedRowId(firstConflictingId);
                const rowConflicts = dependencyViolationsMap.get(firstConflictingId);
                setToastMsg(`Konflik Jadwal pada "${rows[rowIdx].name}": ${rowConflicts?.[0]?.reason || ''}. Klik 'Smart Schedule' untuk menyelaraskan.`);
              }
            }
          }}
          canEditSchedule={onUpdateProject !== undefined}
          canUndo={historyStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSmartSchedule={handleSmartSchedule}
          onRunP6Schedule={handleRunP6Schedule}
          autoSchedule={autoSchedule}
          onToggleAutoSchedule={handleSetAutoSchedule}
          connectMode={connectMode}
          onToggleConnectMode={() => {
            setConnectMode(!connectMode);
            if (depPanelOpen) setDepPanelOpen(false);
          }}
          canSetBaseline={canSetBaseline && Boolean(onUpdateProject)}
          projectsList={projectsList}
          onOpenBaselineManager={() => {
            const target = selectedProject || (projectsList.length > 0 ? projectsList[0] : null);
            if (target) setBaselineTargetProjectId(target.id);
            setBaselineManagerModalOpen(true);
            if (!showBaseline) handleSetShowBaseline(true);
          }}
          onQuickLockBaseline={() => {
            const target = selectedProject || (projectsList.length === 1 ? projectsList[0] : null);
            if (target) {
              setBaselineForProject(target);
              if (!showBaseline) handleSetShowBaseline(true);
            } else {
              handleSetBaselineAll();
              if (!showBaseline) handleSetShowBaseline(true);
            }
          }}
          isExporting={isExporting}
          onExportPNG={handleExportPNG}
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
        />

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

                          setToastMsg(`Relasi dibuat: ${srcR.wbs} → ${tgtR.wbs} (${pendingDepType}${pendingDepLag ? `+${pendingDepLag}` : ''})`);
                          setTimeout(() => setToastMsg(null), 3000);
                        }
                      }
                      setPendingConnect(null);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    {isAlreadyLinked ? 'Perbarui Relasi' : 'Tambah Relasi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingConnect(null)}
                    className="px-3 bg-base-surface2 hover:bg-base-surface3 text-base-text border border-base-border py-1.5 rounded font-bold transition-all cursor-pointer"
                  >
                    Batal
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
                    <h3 className="font-condensed font-extrabold text-sm text-base-text tracking-tight uppercase">Dependensi Task</h3>
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
                  <h4 className="text-[10px] uppercase font-extrabold text-base-muted tracking-wider mb-2 font-condensed">Predecessor Aktif</h4>
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
                                Tipe: <span className="text-base-text font-bold">{dep.type}</span>
                                {dep.lag ? ` | Lag: ` : ''}
                                {dep.lag ? <span className="text-base-text font-bold">{dep.lag}h</span> : ''}
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                handleDeletePredecessor(dep.key);
                              }}
                              className="p-1.5 text-base-muted hover:text-base-red hover:bg-base-red-dim/20 rounded-md transition-all cursor-pointer"
                              title="Hapus relasi dependensi"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-base-surface2/50 border border-dashed border-base-border rounded-lg text-[10px] text-base-muted font-bold font-condensed">
                      Belum ada predecessor aktif untuk task ini.
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-base-border/50" />

                {/* Search & Add Section */}
                <div>
                  <h4 className="text-[10px] uppercase font-extrabold text-base-muted tracking-wider mb-2 font-condensed">Hubungkan Predecessor Baru</h4>
                  
                  {/* Search Input */}
                  <div className="relative flex items-center mb-3">
                    <Search className="absolute left-2.5 h-3.5 w-3.5 text-base-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari task berdasarkan nama atau WBS..."
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
                          Tidak ada task yang sesuai.
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
                                  
                                  setToastMsg(`Predecessor ditambahkan: ${r.wbs} → ${targetRow.wbs}`);
                                  setTimeout(() => setToastMsg(null), 3000);
                                }}
                                className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-base-accent text-white hover:bg-base-accent/90 transition-all rounded text-[9px] font-bold uppercase cursor-pointer"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>Hubungkan</span>
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

        {/* BASELINE MANAGER MODAL */}
        {baselineManagerModalOpen && (() => {
          const currentTargetProj = projectsList.find(p => p.id === baselineTargetProjectId) || selectedProject || projectsList[0];
          const hasBaseline = Boolean(currentTargetProj?.baselineStart || currentTargetProj?.baselineFinish);
          
          let varianceText = 'On target';
          let varianceClass = 'text-slate-500';
          if (currentTargetProj?.due && currentTargetProj?.baselineFinish) {
            const actD = parseLocalDate(currentTargetProj.due);
            const baseD = parseLocalDate(currentTargetProj.baselineFinish);
            const diffDays = Math.round((actD.getTime() - baseD.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
              varianceText = `+${diffDays} hari terlambat dari rencana`;
              varianceClass = 'text-red-500 font-bold';
            } else if (diffDays < 0) {
              varianceText = `${Math.abs(diffDays)} hari lebih cepat dari rencana`;
              varianceClass = 'text-emerald-500 font-bold';
            }
          }

          return (
            <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
              <div 
                className="bg-base-surface border-2 border-base-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-base-text animate-scale-up"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-700 text-white shadow-xs">
                      <BookmarkCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold font-condensed uppercase tracking-wide">
                        Pengelola Baseline Proyek
                      </h3>
                      <p className="text-xs text-base-muted font-sans">
                        Atur target jadwal komitmen rencana proyek & sub-assembly
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBaselineManagerModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
                  {/* Project Selector if multiple */}
                  {projectsList.length > 1 && (
                    <div>
                      <label className="block text-[11px] font-bold text-base-muted uppercase tracking-wider mb-1 font-condensed">
                        Pilih Target Proyek:
                      </label>
                      <select
                        value={currentTargetProj?.id || ''}
                        onChange={(e) => setBaselineTargetProjectId(e.target.value)}
                        className="w-full bg-base-surface2 border border-base-border rounded-xl px-3 py-2 text-xs font-bold text-base-text outline-none focus:border-base-accent"
                      >
                        {projectsList.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.baselineStart ? `(Baseline: ${p.baselineStart})` : '(Belum ada baseline)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Baseline Status Card */}
                  {currentTargetProj && (
                    <div className="p-4 rounded-xl bg-slate-500/10 border border-slate-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-base-muted font-condensed uppercase tracking-wider">
                          Status Baseline: {currentTargetProj.name}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          hasBaseline ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                        }`}>
                          {hasBaseline ? 'Terkunci (Active)' : 'Belum Dikunci'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
                        <div className="bg-base-surface p-2 rounded-lg border border-base-border">
                          <div className="text-[9px] text-base-muted uppercase font-sans font-bold">Baseline Start</div>
                          <div className="font-extrabold text-base-text">{currentTargetProj.baselineStart || '—'}</div>
                        </div>
                        <div className="bg-base-surface p-2 rounded-lg border border-base-border">
                          <div className="text-[9px] text-base-muted uppercase font-sans font-bold">Baseline Finish</div>
                          <div className="font-extrabold text-base-text">{currentTargetProj.baselineFinish || '—'}</div>
                        </div>
                        <div className="bg-base-surface p-2 rounded-lg border border-base-border col-span-2 sm:col-span-1">
                          <div className="text-[9px] text-base-muted uppercase font-sans font-bold">Deviasi / Variance</div>
                          <div className={`text-xs ${varianceClass}`}>{varianceText}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action 1: Set Baseline from Current Schedule */}
                  <div className="p-4 rounded-xl border border-base-border bg-base-surface space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold uppercase font-condensed text-base-text flex items-center gap-1.5">
                          <BookmarkPlus className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>1. Kunci Baseline dari Jadwal Saat Ini</span>
                        </div>
                        <p className="text-[11px] text-base-muted mt-0.5">
                          Salin seluruh tanggal jadwal aktual saat ini (proyek, sub-assembly, task) menjadi target rencana Baseline baru.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentTargetProj) {
                            setBaselineForProject(currentTargetProj, false);
                          }
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-condensed font-extrabold uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Kunci Sekarang
                      </button>
                    </div>
                  </div>

                  {/* Action 2: Shift Baseline by X Days */}
                  <div className="p-4 rounded-xl border border-base-border bg-base-surface space-y-3">
                    <div>
                      <div className="text-xs font-extrabold uppercase font-condensed text-base-text flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                        <span>2. Geser Jadwal Baseline (+ / - Hari)</span>
                      </div>
                      <p className="text-[11px] text-base-muted mt-0.5">
                        Jika ada kesepakatan penyesuaian target atau addendum, geser seluruh tanggal baseline proyek sekaligus tanpa mengubah tanggal satu per satu.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 bg-base-surface2 border border-base-border rounded-xl px-2 py-1">
                        <input
                          type="number"
                          value={shiftDaysInput}
                          onChange={(e) => setShiftDaysInput(parseInt(e.target.value, 10) || 0)}
                          className="w-16 bg-transparent text-xs font-mono font-bold text-center outline-none"
                        />
                        <span className="text-[10px] text-base-muted font-bold">Hari</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShiftDaysInput(-7)}
                          className="px-2 py-1 bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                        >
                          -7 hr
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftDaysInput(7)}
                          className="px-2 py-1 bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                        >
                          +7 hr
                        </button>
                        <button
                          type="button"
                          onClick={() => setShiftDaysInput(14)}
                          className="px-2 py-1 bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                        >
                          +14 hr
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (currentTargetProj && shiftDaysInput !== 0) {
                            shiftBaselineForProject(currentTargetProj, shiftDaysInput);
                          }
                        }}
                        className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-condensed font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Terapkan Pergeseran ({shiftDaysInput > 0 ? `+${shiftDaysInput}` : shiftDaysInput}d)
                      </button>
                    </div>
                  </div>

                  {/* Tip: Inline Date Editing on Table */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                    <span className="text-base shrink-0">💡</span>
                    <div className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                      <strong className="font-extrabold">Ubah Tanggal Baseline Per Baris Task:</strong><br />
                      Anda juga bisa langsung mengklik tanggal di kolom <span className="font-mono font-bold bg-amber-500/20 px-1 py-0.5 rounded">Base Start</span> atau <span className="font-mono font-bold bg-amber-500/20 px-1 py-0.5 rounded">Base Finish</span> pada tabel di sebelah kiri untuk memilih tanggal secara manual dengan kalender interaktif!
                    </div>
                  </div>

                  {/* Action 4: Reset / Delete Baseline */}
                  {hasBaseline && currentUser?.role === 'admin' && (
                    <div className="pt-2 border-t border-base-border flex items-center justify-between">
                      <span className="text-[11px] text-base-muted">
                        Ingin mengosongkan target jadwal baseline?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentTargetProj) {
                            clearBaselineForProject(currentTargetProj);
                          }
                        }}
                        className="px-3 py-1.5 border border-red-500/40 text-red-600 hover:bg-red-500/10 rounded-xl text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span>Reset Baseline</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-base-border bg-base-surface2/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBaselineManagerModalOpen(false)}
                    className="px-4 py-1.5 bg-base-surface border border-base-border hover:bg-base-surface3 rounded-xl text-xs font-bold text-base-text transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── ORACLE PRIMAVERA P6 SCHEDULE CALCULATION REPORT MODAL ── */}
        {p6ModalData && p6ModalData.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
            <div className="bg-base-surface border border-base-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-scale-up">
              {/* Header */}
              <div className="px-5 py-4 border-b border-base-border bg-gradient-to-r from-red-600/10 via-base-surface to-base-surface flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-mono font-black text-xs shadow-md">
                    P6
                  </div>
                  <div>
                    <h3 className="font-condensed font-extrabold text-base text-base-text uppercase tracking-wider flex items-center gap-1.5">
                      <span>Schedule Calculation Log (F9)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40">
                        CPM ENGINE
                      </span>
                    </h3>
                    <p className="text-[11px] text-base-muted font-normal">
                      Critical Path Method — Forward & Backward Pass Execution Report
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setP6ModalData(prev => prev ? { ...prev, isOpen: false } : null)}
                  className="p-1.5 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Status Banner */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold">Penjadwalan Berhasil Dihitung.</span> Jaringan dependensi (FS, SS, FF, SF) dan tenggat waktu telah disinkronkan secara matematis.
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Data Date</span>
                    <span className="text-sm font-mono font-black text-base-text mt-0.5">{p6ModalData.dataDate}</span>
                    <span className="text-[9px] text-base-muted/70">Waktu acuan CPM</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Total Aktivitas</span>
                    <span className="text-sm font-mono font-black text-base-text mt-0.5">{p6ModalData.totalTasks}</span>
                    <span className="text-[9px] text-base-muted/70">Elemen WBS terjadwal</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col">
                    <span className="text-[10px] text-red-600 dark:text-red-400 uppercase font-condensed font-bold">Aktivitas Kritis</span>
                    <span className="text-sm font-mono font-black text-red-600 dark:text-red-400 mt-0.5">{p6ModalData.criticalCount}</span>
                    <span className="text-[9px] text-red-600/70 dark:text-red-400/70">Total Float = 0 hari</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Longest Path</span>
                    <span className="text-sm font-mono font-black text-base-text mt-0.5">{p6ModalData.longestPath} Hari</span>
                    <span className="text-[9px] text-base-muted/70">Durasi rantai kritis</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Jadwal Disesuaikan</span>
                    <span className="text-sm font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5">{p6ModalData.shiftedCount}</span>
                    <span className="text-[9px] text-base-muted/70">Tanggal bergeser logis</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Loop Sirkular</span>
                    <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {p6ModalData.hasLoops ? 'Terdeteksi' : '0 (Bersih)'}
                    </span>
                    <span className="text-[9px] text-base-muted/70">Integritas jaringan</span>
                  </div>
                </div>

                {/* Explanation */}
                <div className="p-3 rounded-xl bg-base-surface2/60 border border-base-border text-[11px] text-base-muted space-y-1">
                  <div className="font-bold text-base-text">Fitur Primavera P6 yang Aktif:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><span className="font-medium text-base-text">Bar Merah & Badge CP</span>: Semua aktivitas di jalur kritis otomatis ditandai.</li>
                    <li><span className="font-medium text-base-text">Total Float (TF) & Free Float (FF)</span>: Nilai float dihitung secara presisi per aktivitas.</li>
                    <li><span className="font-medium text-base-text">P6 Activity ID</span>: Setiap task memiliki kode unik (misal: A1010, A1020).</li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-base-border bg-base-surface2/50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setP6ModalData(prev => prev ? { ...prev, isOpen: false } : null)}
                  className="px-4 py-2 bg-base-accent hover:bg-base-accent2 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Lihat Hasil Gantt Chart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Styled In-App Baseline Confirmation Modal */}
        {baselineConfirm?.isOpen && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setBaselineConfirm(null)}
          >
            <div
              className="w-full max-w-md bg-base-surface border border-base-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2/70">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                    baselineConfirm.tone === 'danger'
                      ? 'bg-base-danger-dim text-base-danger border-base-danger/30'
                      : 'bg-base-accent-dim text-base-accent border-base-accent/30'
                  }`}>
                    {baselineConfirm.tone === 'danger' ? <Trash2 className="h-4 w-4" /> : <BookmarkCheck className="h-4 w-4" />}
                  </div>
                  <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">
                    {baselineConfirm.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBaselineConfirm(null)}
                  className="p-1 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5">
                <p className="text-xs text-base-muted leading-relaxed">
                  {baselineConfirm.message}
                </p>
              </div>

              <div className="px-5 py-3 border-t border-base-border bg-base-surface2/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBaselineConfirm(null)}
                  className="px-4 py-2 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface3 text-xs font-bold text-base-text transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={baselineConfirm.onConfirm}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
                    baselineConfirm.tone === 'danger'
                      ? 'bg-base-danger hover:bg-base-danger/90'
                      : 'bg-base-accent hover:bg-base-accent2'
                  }`}
                >
                  {baselineConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Smart Schedule Impact Preview Modal */}
        {smartSchedulePreview && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSmartSchedulePreview(null)}
          >
            <div
              className="w-full max-w-2xl bg-base-surface border border-base-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">
                      Pratinjau Dampak Smart Schedule
                    </h3>
                    <p className="text-[11px] text-base-muted">
                      Tinjau perubahan jadwal sebelum diterapkan ke proyek Anda
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSmartSchedulePreview(null)}
                  className="p-1 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Summary Cards */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Task Terdampak</span>
                    <span className="text-base font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {smartSchedulePreview.totalShiftedCount}
                    </span>
                    <span className="text-[9px] text-base-muted/80">Bergeser sesuai logika dependensi</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Proyek Terdampak</span>
                    <span className="text-base font-mono font-black text-base-text mt-0.5">
                      {smartSchedulePreview.updatedProjects.length}
                    </span>
                    <span className="text-[9px] text-base-muted/80">Proyek akan diperbarui</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-base-surface2 border border-base-border flex flex-col">
                    <span className="text-[10px] text-base-muted uppercase font-condensed font-bold">Pergeseran Maks</span>
                    <span className="text-base font-mono font-black text-base-accent mt-0.5">
                      {smartSchedulePreview.maxDeltaDays > 0 ? `+${smartSchedulePreview.maxDeltaDays}d` : `${smartSchedulePreview.maxDeltaDays}d`}
                    </span>
                    <span className="text-[9px] text-base-muted/80">Perubahan hari terbesar</span>
                  </div>
                </div>

                {/* Project Due Date Warning */}
                {smartSchedulePreview.projectImpacts.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Peringatan Target Selesai Proyek (Melewati Due Date):</span>
                    </div>
                    <div className="space-y-1">
                      {smartSchedulePreview.projectImpacts.map(imp => (
                        <div key={imp.projectId} className="flex items-center justify-between text-[11px] bg-base-surface/80 px-2.5 py-1.5 rounded-lg border border-red-500/20">
                          <span className="font-semibold text-base-text truncate max-w-[220px]">{imp.projectName}</span>
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <span className="text-base-muted">{imp.oldDue}</span>
                            <ArrowRight className="h-3 w-3 text-red-500" />
                            <span className="font-bold text-red-600 dark:text-red-400">{imp.newDue}</span>
                            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 font-bold">
                              +{imp.deltaDays}d
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affected Tasks Table */}
                <div className="border border-base-border rounded-xl overflow-hidden">
                  <div className="bg-base-surface2 px-3 py-2 border-b border-base-border flex items-center justify-between">
                    <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2">
                      Daftar Task yang Akan Bergeser
                    </span>
                    <span className="text-[10px] font-mono text-base-muted">
                      {smartSchedulePreview.items.length} aktivitas
                    </span>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-base-border/70">
                    {smartSchedulePreview.items.map(item => (
                      <div key={item.taskId} className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-base-surface2/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border text-base-muted2 shrink-0">
                              {item.wbs}
                            </span>
                            <span className="text-xs font-semibold text-base-text truncate">
                              {item.taskName}
                            </span>
                          </div>
                          {projectsList.length > 1 && (
                            <div className="text-[10px] text-base-muted truncate mt-0.5">
                              {item.projectName}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right font-mono text-[10px]">
                            <div className="text-base-muted line-through">
                              {item.oldStart} → {item.oldFinish}
                            </div>
                            <div className="font-bold text-base-text flex items-center justify-end gap-1">
                              <span>{item.newStart} → {item.newFinish}</span>
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold shrink-0 ${
                            item.deltaDays > 0
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {item.deltaDays > 0 ? `+${item.deltaDays}d` : `${item.deltaDays}d`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-base-border bg-base-surface2/50 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] text-base-muted">
                  Dapat dibatalkan kapan saja dengan tombol Undo.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSmartSchedulePreview(null)}
                    className="px-4 py-2 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface3 text-xs font-bold text-base-text transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={confirmApplySmartSchedule}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Terapkan Jadwal ({smartSchedulePreview.totalShiftedCount})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
