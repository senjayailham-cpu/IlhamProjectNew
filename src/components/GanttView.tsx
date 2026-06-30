import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Project, Assembly, Task, Dependency } from '../types';
import { 
  ChevronRight, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Layers,
  Calendar,
  Search,
  Bookmark,
  Flag,
  Download
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
                item: (index: number) => filteredRules[index]
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
  project: Project;
  onClose?: () => void;
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
}

interface GanttRow {
  id: string;
  type: 'project' | 'assembly' | 'task';
  name: string;
  level: 0 | 1 | 2;
  wbs: string;
  start?: string;
  finish?: string;
  duration: number;
  pct: number;
  done: boolean;
  isMilestone?: boolean;
  predecessors?: Dependency[];
  parentAsmId?: string;
  assigned?: string;
  baselineDate?: string;
  baselineFinish?: string;
}

interface DragState {
  rowId: string;
  type: 'move' | 'resize';
  initialX: number;
  initialStart: string;
  initialFinish: string;
  parentAsmId?: string;
  rowType: 'project' | 'assembly' | 'task';
  tempStart?: string;
  tempFinish?: string;
}

// Utility to parse ISO date strictly without timezone shifts
const parseLocalDate = (dateStr: string) => {
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
};

// Calculate days between two pure local dates
const daysBetween = (d1: Date, d2: Date) => {
  const ut1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const ut2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((ut2 - ut1) / (1000 * 60 * 60 * 24));
};

// Format a Date object back to YYYY-MM-DD timezone-safe local string
const formatLocalDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Add days to a local date string
const addDaysToLocalDate = (dateStr: string, days: number) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};

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
      const tStart = t.date || asm.start || project.start;
      let tFinish = t.finishDate || tStart;
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
  const cloned = JSON.parse(JSON.stringify(updatedProject)) as Project;
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
      const tStart = t.date || asm.start || cloned.start;
      let tFinish = t.finishDate || tStart;
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
      const tStartStr = t.date || asm.start || cloned.start;
      const tFinishStr = t.finishDate || tStartStr;

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

export default function GanttView({ project, onClose, onUpdateProject, onOpenDepModal }: GanttViewProps) {
  // Navigation / Configuration State
  const [zoomMode, setZoomMode] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [showArrows, setShowArrows] = useState<boolean>(true);
  const [showProgress, setShowProgress] = useState<boolean>(true);
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(false);
  const [showBaseline, setShowBaseline] = useState<boolean>(false);
  const [cascadedTaskIds, setCascadedTaskIds] = useState<Set<string>>(new Set());

  // Export State and Refs
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);
  const ganttWorkspaceRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
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

      // Capture canvas
      const canvas = await html2canvas(ganttWorkspaceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      // Restore displays
      elementsToHide.forEach((el, idx) => {
        (el as HTMLElement).style.display = originalDisplays[idx] || '';
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `gantt_${project.name || 'project'}_${new Date().toISOString().slice(0, 10)}.png`;
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

      // Capture canvas
      const canvas = await html2canvas(ganttWorkspaceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false
      });

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
      const rangeStr = `${project.start || '—'} to ${project.due || '—'}`;

      const canvasPageWidth = usableWidth / pdfScale;

      for (let i = 0; i < numPages; i++) {
        if (i > 0) {
          doc.addPage('a3', 'landscape');
        }

        // Draw header on each page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(31, 41, 55); // slate-800
        doc.text(`Gantt Chart - ${project.name || 'Project'}`, 30, 25);

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

      doc.save(`gantt_${project.name || 'project'}_${date}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setToastMsg('Export PDF failed. Please try again.');
    } finally {
      restoreCssRules();
      setIsExporting(false);
    }
  };

  const handleSetBaseline = () => {
    if (!onUpdateProject) return;
    const confirmSet = window.confirm("Set current schedule as baseline? This will overwrite the previous baseline.");
    if (!confirmSet) return;

    const updated = JSON.parse(JSON.stringify(project)) as Project;
    updated.baselineStart = updated.start;
    updated.baselineDue = updated.due;
    updated.baselineSetAt = new Date().toISOString();

    updated.assemblies?.forEach(asm => {
      asm.baselineStart = asm.start;
      asm.baselineFinish = asm.finish;
      asm.tasks?.forEach(t => {
        t.baselineDate = t.date;
        t.baselineFinish = t.finishDate;
      });
    });

    onUpdateProject(updated);
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
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [collapsedAsms, setCollapsedAsms] = useState<Record<string, boolean>>({});

  // Filtering States & Ref
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'on-track'|'overdue'|'done'|'not-started'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Inline Editing States
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: 'start' | 'finish' } | null>(null);
  const [editingPred, setEditingPred] = useState<string | null>(null);
  const [predInputVal, setPredInputVal] = useState<string>('');
  const [editingPct, setEditingPct] = useState<string | null>(null);
  const [flashingCellId, setFlashingCellId] = useState<string | null>(null);

  // Drag interaction state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Left Panel Resizing state (MS Project sheet table resizing)
  const defaultTotalTableWidth = 56 + 200 + 64 + 85 + 85 + 90 + 52; // 632
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`gantt_left_panel_width_${project.id}`);
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
        localStorage.setItem(`gantt_left_panel_width_${project.id}`, leftPanelWidth.toString());
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
  }, [isResizingSplitter, leftPanelWidth, project.id]);

  // Tooltip state
  const [hoveredTask, setHoveredTask] = useState<{
    row: GanttRow;
    x: number;
    y: number;
  } | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Sync left panel scroll with right timeline vertical scroll
  const handleScroll = () => {
    if (rightScrollRef.current && leftScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  };

  // Handle wheel scrolling on the left panel by forwarding to the right scroll panel
  const handleLeftWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop += e.deltaY;
    }
  };

  // Safe calculation of project level start/end dates
  const { start: pStart, due: pDue } = useMemo(() => {
    let start = project.start;
    let due = project.due;

    const taskDates: Date[] = [];
    project.assemblies?.forEach(asm => {
      asm.tasks?.forEach(t => {
        if (t.date) taskDates.push(parseLocalDate(t.date));
        if (t.finishDate) taskDates.push(parseLocalDate(t.finishDate));
      });
    });

    if (taskDates.length > 0) {
      const minDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...taskDates.map(d => d.getTime())));
      start = formatLocalDate(minDate);
      due = formatLocalDate(maxDate);
    } else {
      if (!start) start = new Date().toISOString().slice(0, 10);
      if (!due) {
        const d = parseLocalDate(start);
        d.setDate(d.getDate() + 30);
        due = formatLocalDate(d);
      }
    }

    return { start, due };
  }, [project]);

  const pStartD = useMemo(() => parseLocalDate(pStart), [pStart]);
  const pDueD = useMemo(() => parseLocalDate(pDue), [pDue]);

  const { criticalPathIds, slackMap } = useMemo(() => {
    const res = calculateCriticalPath(project);
    return {
      criticalPathIds: res.criticalIds,
      slackMap: res.floatMap
    };
  }, [project]);

  const criticalAssemblyIds = useMemo(() => {
    const ids = new Set<string>();
    project.assemblies?.forEach(asm => {
      const hasCriticalTask = asm.tasks?.some(t => criticalPathIds.has(t.id));
      if (hasCriticalTask) {
        ids.add(asm.id);
      }
    });
    return ids;
  }, [project, criticalPathIds]);

  const criticalChainLength = useMemo(() => {
    const criticalTasks = project.assemblies?.flatMap(asm => 
      asm.tasks?.filter(t => criticalPathIds.has(t.id)) || []
    ) || [];

    if (criticalTasks.length === 0) return 0;

    const dates = criticalTasks.flatMap(t => {
      const start = t.date || project.start;
      const finish = t.finishDate || start;
      return [parseLocalDate(start), parseLocalDate(finish)];
    });

    if (dates.length === 0) return 0;

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return Math.max(1, daysBetween(minDate, maxDate) + 1);
  }, [project, criticalPathIds]);

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

  // Generate full unfiltered list of Gantt rows (including WBS numbering)
  const allRows = useMemo(() => {
    const result: GanttRow[] = [];

    // 1. Project level summary row
    let totalPcts = 0;
    let totalTasksCount = 0;
    project.assemblies?.forEach(asm => {
      asm.tasks?.forEach(t => {
        totalPcts += t.pct || 0;
        totalTasksCount++;
      });
    });
    const pPct = totalTasksCount > 0 ? Math.round(totalPcts / totalTasksCount) : 0;
    const pDuration = Math.max(1, daysBetween(pStartD, pDueD) + 1);

    result.push({
      id: project.id,
      type: 'project',
      name: project.name,
      level: 0,
      wbs: "1",
      start: pStart,
      finish: pDue,
      duration: pDuration,
      pct: pPct,
      done: pPct >= 100,
      predecessors: project.predecessors,
      baselineDate: project.baselineStart,
      baselineFinish: project.baselineDue
    });

    // 2. Assembly & Task level rows
    project.assemblies?.forEach((asm, asmIdx) => {
      let aStart = asm.start;
      let aFinish = asm.finish;

      const taskDates: Date[] = [];
      asm.tasks?.forEach(t => {
        if (t.date) taskDates.push(parseLocalDate(t.date));
        if (t.finishDate) taskDates.push(parseLocalDate(t.finishDate));
      });

      // Recalculate sub-assembly start and finish dates dynamically as rollup of tasks
      if (taskDates.length > 0) {
        const minDate = new Date(Math.min(...taskDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...taskDates.map(d => d.getTime())));
        aStart = formatLocalDate(minDate);
        aFinish = formatLocalDate(maxDate);
      } else {
        if (!aStart) aStart = pStart;
        if (!aFinish) aFinish = pDue;
      }

      const aStartD = parseLocalDate(aStart);
      const aFinishD = parseLocalDate(aFinish);
      const aDuration = Math.max(1, daysBetween(aStartD, aFinishD) + 1);

      const aTotalTasks = asm.tasks?.length || 0;
      const aPct = aTotalTasks > 0
        ? Math.round(asm.tasks.reduce((sum, t) => sum + (t.pct || 0), 0) / aTotalTasks)
        : 0;

      const assemblyWbs = `1.${asmIdx + 1}`;

      result.push({
        id: asm.id,
        type: 'assembly',
        name: asm.name,
        level: 1,
        wbs: assemblyWbs,
        start: aStart,
        finish: aFinish,
        duration: aDuration,
        pct: aPct,
        done: aPct >= 100,
        predecessors: asm.predecessors,
        baselineDate: asm.baselineStart,
        baselineFinish: asm.baselineFinish
      });

      // Add child tasks if assembly is expanded
      const isAsmCollapsed = collapsedAsms[asm.id] !== false;
      if (!isAsmCollapsed) {
        asm.tasks?.forEach((t, taskIdx) => {
          const tStart = t.date || aStart || pStart;
          let tFinish = t.finishDate || tStart;

          if (new Date(tFinish) < new Date(tStart)) {
            tFinish = tStart;
          }

          const tStartD = parseLocalDate(tStart);
          const tFinishD = parseLocalDate(tFinish);
          const tDuration = t.isMilestone ? 0 : Math.max(1, daysBetween(tStartD, tFinishD) + 1);

          result.push({
            id: t.id,
            type: 'task',
            name: t.name,
            level: 2,
            wbs: `${assemblyWbs}.${taskIdx + 1}`,
            start: tStart,
            finish: tFinish,
            duration: tDuration,
            pct: t.pct || 0,
            done: !!t.done,
            isMilestone: !!t.isMilestone,
            predecessors: t.predecessors,
            parentAsmId: asm.id,
            assigned: t.assigned,
            baselineDate: t.baselineDate,
            baselineFinish: t.baselineFinish
          });
        });
      }
    });

    return result;
  }, [project, collapsedAsms, pStart, pDue, pStartD, pDueD]);

  // Generate list of filtered Gantt rows
  const rows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
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
      return true;
    };

    // First, identify all task rows (level 2) that match the filter
    const matchingTaskIds = new Set<string>();
    allRows.forEach(row => {
      if (row.level === 2 && matchesFilter(row)) {
        matchingTaskIds.add(row.id);
      }
    });

    // Filter rows based on matching level 2 tasks and hierarchy rules
    const filteredRows = allRows.filter(row => {
      if (row.level === 0) return true; // Level 0 (project row) selalu tampil
      if (row.level === 2) {
        return matchingTaskIds.has(row.id);
      }
      if (row.level === 1) {
        // Level 1 (assembly) tampil jika setidaknya satu child task lolos filter, atau jika search kosong
        if (searchLower === '') {
          return true;
        }
        // If search is not empty, check if at least one child task of this assembly matches the filter
        const childTasks = allRows.filter(r => r.level === 2 && r.parentAsmId === row.id);
        const hasMatchingChild = childTasks.some(r => matchingTaskIds.has(r.id));
        return hasMatchingChild;
      }
      return true;
    });

    return filteredRows;
  }, [allRows, searchQuery, statusFilter]);

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

    // Deep clone project
    const updated = JSON.parse(JSON.stringify(project)) as Project;

    if (rowId === project.id) {
      // Project level
      if (field === 'start') updated.start = newVal;
      else updated.due = newVal;
    } else {
      // Find in assemblies
      const asm = updated.assemblies.find(a => a.id === rowId);
      if (asm) {
        if (field === 'start') asm.start = newVal;
        else asm.finish = newVal;
      } else {
        // Find in tasks
        for (const a of updated.assemblies) {
          const t = a.tasks.find(t => t.id === rowId);
          if (t) {
            if (field === 'start') t.date = newVal;
            else t.finishDate = newVal;
            break;
          }
        }
      }
    }
    // Cascade schedule
    const { updatedProject, shiftedIds } = cascadeSchedule(updated, rowId);
    if (shiftedIds.size > 0) {
      setCascadedTaskIds(shiftedIds);
    }
    onUpdateProject(updatedProject);
  };

  // Inline Predecessors Saving handler
  const savePredecessors = (rowId: string, inputStr: string) => {
    if (!onUpdateProject) return;
    const deps = parsePredecessorInput(inputStr, wbsMap);
    const updated = JSON.parse(JSON.stringify(project)) as Project;

    if (rowId === project.id) {
      updated.predecessors = deps;
    } else {
      const asm = updated.assemblies.find(a => a.id === rowId);
      if (asm) {
        asm.predecessors = deps;
      } else {
        for (const a of updated.assemblies) {
          const t = a.tasks.find(t => t.id === rowId);
          if (t) {
            t.predecessors = deps;
            break;
          }
        }
      }
    }
    onUpdateProject(updated);
  };

  // Inline Progress (%) Saving handler
  const saveProgress = (taskId: string, newPct: number) => {
    if (!onUpdateProject) return;

    // Clamp between 0 and 100
    const clampedPct = Math.min(100, Math.max(0, newPct));

    // Deep clone project
    const updated = JSON.parse(JSON.stringify(project)) as Project;

    let found = false;
    for (const a of updated.assemblies) {
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

  // Header row elements generators
  const topHeaders = useMemo(() => {
    const list: { label: string; width: number }[] = [];
    const temp = new Date(timelineStart);
    let currentLabel = '';
    let currentWidth = 0;

    while (temp <= timelineEnd) {
      let label = '';
      if (zoomMode === 'day' || zoomMode === 'week') {
        label = temp.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else {
        label = temp.getFullYear().toString();
      }

      if (currentLabel === '') {
        currentLabel = label;
        currentWidth = pixelsPerDay;
      } else if (currentLabel === label) {
        currentWidth += pixelsPerDay;
      } else {
        list.push({ label: currentLabel, width: currentWidth });
        currentLabel = label;
        currentWidth = pixelsPerDay;
      }
      temp.setDate(temp.getDate() + 1);
    }
    if (currentWidth > 0) {
      list.push({ label: currentLabel, width: currentWidth });
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
    project.assemblies?.forEach(asm => {
      count += asm.tasks?.length || 0;
    });
    return count;
  }, [project]);

  const isFilterActive = searchQuery !== '' || statusFilter !== 'all';

  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  // Row coordinate helper supporting real-time drag adjustments
  const getRowBarCoords = (row: GanttRow) => {
    let startStr = row.start;
    let finishStr = row.finish;

    if (dragState && dragState.rowId === row.id) {
      startStr = dragState.tempStart || row.start;
      finishStr = dragState.tempFinish || row.finish;
    }

    if (!startStr) return null;
    const startD = parseLocalDate(startStr);
    const left = daysBetween(timelineStart, startD) * pixelsPerDay;
    
    let width = 0;
    if (!row.isMilestone) {
      const finishD = finishStr ? parseLocalDate(finishStr) : startD;
      const duration = Math.max(1, daysBetween(startD, finishD) + 1);
      width = duration * pixelsPerDay;
    }
    
    return { left, width };
  };

  // Baseline coordinate helper
  const getBaselineCoords = (row: GanttRow) => {
    if (!row.baselineDate) return null;
    try {
      const startD = parseLocalDate(row.baselineDate);
      const left = daysBetween(timelineStart, startD) * pixelsPerDay;
      
      let width = 0;
      if (!row.isMilestone) {
        const finishD = row.baselineFinish ? parseLocalDate(row.baselineFinish) : startD;
        const duration = Math.max(1, daysBetween(startD, finishD) + 1);
        width = duration * pixelsPerDay;
      }
      return { left, width };
    } catch (e) {
      return null;
    }
  };

  // Drag listeners handler
  const handleBarMouseDown = (row: GanttRow, type: 'move' | 'resize', e: React.MouseEvent) => {
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

  const handleBarTouchStart = (row: GanttRow, type: 'move' | 'resize', e: React.TouchEvent) => {
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
          if (dragState.rowType === 'project') {
            // Level 0 Project: Update project.start and project.due
            onUpdateProject && onUpdateProject({
              ...project,
              start: dragState.tempStart,
              due: dragState.tempFinish
            });
          } else if (dragState.rowType === 'assembly') {
            // Level 1 Assembly: Update assembly start and finish and cascade deltaDays to child tasks
            const dStart = parseLocalDate(dragState.initialStart);
            const dTempStart = parseLocalDate(dragState.tempStart);
            const deltaDays = daysBetween(dStart, dTempStart);

            const updatedAssemblies = project.assemblies.map(asm => {
              if (asm.id !== dragState.rowId) return asm;

              const updatedTasks = (asm.tasks || []).map(t => {
                const nextTaskStart = t.date ? addDaysToLocalDate(t.date, deltaDays) : t.date;
                const nextTaskFinish = t.finishDate ? addDaysToLocalDate(t.finishDate, deltaDays) : t.finishDate;
                return {
                  ...t,
                  date: nextTaskStart,
                  finishDate: nextTaskFinish
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
              ...project,
              assemblies: updatedAssemblies
            };
            const { updatedProject, shiftedIds } = cascadeSchedule(baseUpdated, dragState.rowId);
            if (shiftedIds.size > 0) {
              setCascadedTaskIds(shiftedIds);
            }
            onUpdateProject && onUpdateProject(updatedProject);
          } else if (dragState.rowType === 'task') {
            // Level 2 Task: Update the single task
            const updatedAssemblies = project.assemblies.map(asm => {
              if (asm.id !== dragState.parentAsmId) return asm;
              return {
                ...asm,
                tasks: asm.tasks.map(t => {
                  if (t.id !== dragState.rowId) return t;
                  return {
                    ...t,
                    date: dragState.tempStart,
                    finishDate: dragState.tempFinish
                  };
                })
              };
            });

            const baseUpdated = {
              ...project,
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
  }, [dragState, pixelsPerDay, project, onUpdateProject]);

  // Generate SVG dependency path lines
  const arrows = useMemo(() => {
    if (!showArrows) return [];
    const list: {
      path: string;
      isCritical: boolean;
      markerEnd: string;
    }[] = [];

    rows.forEach((targetRow, targetIdx) => {
      if (!targetRow.predecessors) return;

      targetRow.predecessors.forEach(dep => {
        const sourceRowIdx = rowIndexMap[dep.key];
        if (sourceRowIdx === undefined) return; // predecessor row is collapsed or hidden

        const sourceRow = rows[sourceRowIdx];
        const sourceCoords = getRowBarCoords(sourceRow);
        const targetCoords = getRowBarCoords(targetRow);

        if (!sourceCoords || !targetCoords) return;

        const sy = sourceRowIdx * 32 + 16;
        const ty = targetIdx * 32 + 16;

        const isCritical = criticalPathIds.has(sourceRow.id) && criticalPathIds.has(targetRow.id);

        let path = '';
        let markerEnd = 'url(#arrow-right)';

        const sx_start = sourceCoords.left;
        const sx_end = sourceCoords.left + sourceCoords.width;
        const tx_start = targetCoords.left;
        const tx_end = targetCoords.left + targetCoords.width;

        if (dep.type === 'FS') {
          const sx = sx_end;
          const tx = tx_start;
          if (tx >= sx + 20) {
            path = `M ${sx} ${sy} H ${sx + 10} V ${ty} H ${tx}`;
          } else {
            const detourX = Math.max(sx, tx) + 20;
            const midY = Math.min(sy, ty) - 16;
            path = `M ${sx} ${sy} V ${midY} H ${detourX} V ${ty} H ${tx}`;
          }
          markerEnd = 'url(#arrow-right)';
        } else if (dep.type === 'SS') {
          const sx = sx_start;
          const tx = tx_start;
          const minX = Math.min(sx, tx) - 16;
          path = `M ${sx} ${sy} H ${minX} V ${ty} H ${tx}`;
          markerEnd = 'url(#arrow-right)';
        } else if (dep.type === 'FF') {
          const sx = sx_end;
          const tx = tx_end;
          const maxX = Math.max(sx, tx) + 16;
          path = `M ${sx} ${sy} H ${maxX} V ${ty} H ${tx}`;
          markerEnd = 'url(#arrow-right)';
        } else if (dep.type === 'SF') {
          const sx = sx_start;
          const tx = tx_end;
          const midY = (sy + ty) / 2;
          path = `M ${sx} ${sy} H ${sx - 10} V ${midY} H ${tx + 10} V ${ty} H ${tx}`;
          markerEnd = 'url(#arrow-left)';
        }

        list.push({ path, isCritical, markerEnd });
      });
    });

    return list;
  }, [rows, rowIndexMap, timelineStart, pixelsPerDay, showArrows, dragState]);

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

  const toggleAssemblyCollapse = (asmId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedAsms(prev => {
      const isCurrentlyCollapsed = prev[asmId] !== false;
      return {
        ...prev,
        [asmId]: isCurrentlyCollapsed ? false : true
      };
    });
  };

  const expandAllAssemblies = () => {
    const newCollapsed: Record<string, boolean> = {};
    project.assemblies?.forEach(asm => {
      newCollapsed[asm.id] = false;
    });
    setCollapsedAsms(newCollapsed);
  };

  const collapseAllAssemblies = () => {
    const newCollapsed: Record<string, boolean> = {};
    project.assemblies?.forEach(asm => {
      newCollapsed[asm.id] = true;
    });
    setCollapsedAsms(newCollapsed);
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
  const colStartWidth = 85;
  const colFinishWidth = 85;
  const colPredWidth = 90;
  const colPctWidth = 52;
  const colVarWidth = 48;
  const isBaselineActiveAndSet = showBaseline && !!project.baselineSetAt;
  const totalTableWidth = colWbsWidth + colNameWidth + colDurWidth + colStartWidth + colFinishWidth + colPredWidth + colPctWidth + (isBaselineActiveAndSet ? colVarWidth : 0);

  return (
    <div className={`flex flex-col bg-base-bg text-base-text transition-all duration-200 ${
      isFullscreen ? 'fixed inset-0 z-50 p-6 flex flex-col overflow-hidden h-screen bg-base-bg' : 'w-full'
    }`}>
      {/* TOOLBAR PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-base-border mb-4">
        {/* Title & Info */}
        <div className="flex items-center gap-3">
          <h2 className="font-condensed font-extrabold text-lg sm:text-xl tracking-tight flex items-center gap-2">
            📊 Gantt Chart — <span className="text-base-accent font-black">{project.name}</span>
          </h2>
          <span className={`px-2 py-0.5 rounded font-condensed font-bold text-[10px] uppercase tracking-wider border ${getStatusColorClass(project.status)}`}>
            {project.status}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Today Button */}
          <button 
            onClick={scrollToToday}
            className="flex items-center gap-2 px-3 py-1 rounded-lg border border-base-border hover:bg-base-surface transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text bg-base-surface/50 h-[34px]"
            title="Scroll to today"
          >
            <Calendar className="h-3.5 w-3.5 text-base-red shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="text-[9px] leading-tight font-extrabold">Today</span>
              <span className="text-[7.5px] leading-none text-base-muted font-normal lowercase tracking-wide font-mono">{todayFormattedShort}</span>
            </div>
          </button>

          {/* Search bar & Status Filter */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-base-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="pl-8 pr-2.5 py-1.5 text-xs bg-base-surface border border-base-border rounded-lg outline-none focus:border-base-accent w-[180px] h-[34px] font-medium"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-base-surface border border-base-border rounded-lg outline-none focus:border-base-accent h-[34px] cursor-pointer font-medium text-base-muted2 focus:text-base-text"
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
                  className="px-2.5 py-1.5 text-xs hover:text-base-red transition-all flex items-center justify-center bg-base-surface border border-base-border rounded-lg h-[34px] cursor-pointer font-bold gap-1 text-base-muted2"
                  title="Clear filters"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            {isFilterActive && (
              <span className="text-[10px] text-base-muted font-mono leading-none ml-1">
                Showing {visibleTasksCount} of {totalTasksCountInProject} tasks
              </span>
            )}
          </div>

          {/* Zoom Level Toggle Buttons */}
          <div className="flex items-center bg-base-surface border border-base-border rounded-lg p-1">
            <button 
              onClick={() => setZoomMode('day')} 
              className={`px-2.5 py-1 rounded font-condensed font-bold uppercase transition-all cursor-pointer ${
                zoomMode === 'day' ? 'bg-base-accent text-white font-extrabold' : 'text-base-muted hover:text-base-text'
              }`}
            >
              Day
            </button>
            <button 
              onClick={() => setZoomMode('week')} 
              className={`px-2.5 py-1 rounded font-condensed font-bold uppercase transition-all cursor-pointer ${
                zoomMode === 'week' ? 'bg-base-accent text-white font-extrabold' : 'text-base-muted hover:text-base-text'
              }`}
            >
              Week
            </button>
            <button 
              onClick={() => setZoomMode('month')} 
              className={`px-2.5 py-1 rounded font-condensed font-bold uppercase transition-all cursor-pointer ${
                zoomMode === 'month' ? 'bg-base-accent text-white font-extrabold' : 'text-base-muted hover:text-base-text'
              }`}
            >
              Month
            </button>
            <button 
              onClick={() => setZoomMode('quarter')} 
              className={`px-2.5 py-1 rounded font-condensed font-bold uppercase transition-all cursor-pointer ${
                zoomMode === 'quarter' ? 'bg-base-accent text-white font-extrabold' : 'text-base-muted hover:text-base-text'
              }`}
            >
              Quarter
            </button>
          </div>

          <div className="w-[1px] h-4 bg-base-border" />

          {/* Expand/Collapse All Buttons */}
          <div className="flex items-center bg-base-surface border border-base-border rounded-lg p-1">
            <button 
              onClick={expandAllAssemblies} 
              className="px-2.5 py-1 rounded font-condensed font-bold uppercase transition-all cursor-pointer text-xs text-base-muted hover:text-base-text flex items-center gap-1.5"
              title="Expand All Assemblies"
            >
              <Maximize2 className="h-3.5 w-3.5 text-current" />
              <span>Expand All</span>
            </button>
            <div className="w-[1px] h-3 bg-base-border mx-1" />
            <button 
              onClick={collapseAllAssemblies} 
              className="px-2.5 py-1 rounded font-condensed font-bold uppercase transition-all cursor-pointer text-xs text-base-muted hover:text-base-text flex items-center gap-1.5"
              title="Collapse All Assemblies"
            >
              <Minimize2 className="h-3.5 w-3.5 text-current" />
              <span>Collapse All</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-base-border" />

          {/* Toggle Switches */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-base-muted2 hover:text-base-text transition-colors">
            <input 
              type="checkbox" 
              checked={showArrows} 
              onChange={e => setShowArrows(e.target.checked)}
              className="h-3.5 w-3.5 accent-base-accent border-base-border rounded"
            />
            <span>Show Arrows</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-base-muted2 hover:text-base-text transition-colors">
            <input 
              type="checkbox" 
              checked={showProgress} 
              onChange={e => setShowProgress(e.target.checked)}
              className="h-3.5 w-3.5 accent-base-accent border-base-border rounded"
            />
            <span>Show Progress</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-base-muted2 hover:text-base-text transition-colors">
            <input 
              type="checkbox" 
              checked={showCriticalPath} 
              onChange={e => setShowCriticalPath(e.target.checked)}
              className="h-3.5 w-3.5 accent-base-accent border-base-border rounded"
            />
            <span>Show Critical Path</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-base-muted2 hover:text-base-text transition-colors">
            <input 
              type="checkbox" 
              checked={showBaseline} 
              onChange={e => setShowBaseline(e.target.checked)}
              className="h-3.5 w-3.5 accent-base-accent border-base-border rounded"
            />
            <span>Show Baseline</span>
          </label>

          {onUpdateProject !== undefined && (
            <button
              onClick={handleSetBaseline}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-base-border hover:bg-base-accent/10 hover:text-base-accent transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 bg-base-surface"
              title="Set current schedule as baseline"
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0 text-base-accent" />
              <span>Set Baseline</span>
            </button>
          )}

          <div className="w-[1px] h-4 bg-base-border" />

          {/* Fullscreen Button */}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base-border hover:bg-base-surface transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Fullscreen</span>
              </>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base-border hover:bg-base-surface transition-all cursor-pointer font-bold uppercase tracking-wider text-[10px] font-condensed text-base-muted2 hover:text-base-text bg-base-surface/30 h-[34px]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
            </button>
            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-36 bg-base-surface border border-base-border rounded-lg shadow-xl py-1 z-[150]">
                <button
                  onClick={handleExportPNG}
                  className="w-full text-left px-3 py-2 text-xs font-condensed font-bold uppercase tracking-wide text-base-text hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
                >
                  Export PNG
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-3 py-2 text-xs font-condensed font-bold uppercase tracking-wide text-base-text hover:bg-base-accent hover:text-white transition-colors cursor-pointer"
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>

          {onClose && (
            <button 
              onClick={onClose} 
              className="px-3 py-1.5 border border-base-border hover:bg-base-red/10 hover:text-base-red hover:border-base-red/20 transition-all font-bold uppercase tracking-wider text-[10px] font-condensed rounded-lg cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

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

      {/* Gantt Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-base-surface/50 border-b border-base-border text-[11px] font-medium text-base-muted2 select-none">
        <span className="flex items-center gap-1"><span className="text-[10px]">🔴</span> Critical Path</span>
        <span className="flex items-center gap-1"><span className="text-[10px]">🔵</span> On Track</span>
        <span className="flex items-center gap-1"><span className="text-[10px]">🟡</span> Overdue</span>
        <span className="flex items-center gap-1"><span className="text-[10px]">🟢</span> Done</span>
      </div>

      {/* CORE GANTT WORKSPACE BOX */}
      <div ref={ganttWorkspaceRef} className="shadow-card border border-base-border rounded-xl bg-base-surface flex flex-1 overflow-hidden relative" style={{ maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '550px' }}>
        
        {/* LEFT FIXED PANEL (MS Project Columns) */}
        <div 
          className="shrink-0 flex flex-col bg-base-surface relative z-20 select-none overflow-x-auto overflow-y-hidden"
          style={{ width: `${leftPanelWidth}px` }}
          onWheel={handleLeftWheel}
        >
          {/* Two-row Headers (56px matching the timeline side exactly) */}
          <div 
            className="h-14 border-b border-base-border divide-y divide-base-border/50 font-condensed flex flex-col justify-stretch select-none shrink-0 bg-base-surface3/40"
            style={{ width: `${totalTableWidth}px` }}
          >
            {/* Header row 1 */}
            <div className="h-7 px-3 flex items-center justify-between text-[10px] font-bold text-base-muted uppercase tracking-wider">
              <span>Task Sheet & Scheduling Grid</span>
              <Layers className="h-3 w-3 text-base-muted/70" />
            </div>
            {/* Header row 2 */}
            <div className="h-7 flex text-[9px] font-bold text-base-muted uppercase tracking-wider items-center divide-x divide-base-border/30">
              <div style={{ width: `${colWbsWidth}px` }} className="shrink-0 text-center font-bold">WBS</div>
              <div style={{ width: `${colNameWidth}px` }} className="shrink-0 px-2 font-bold truncate">Task Name</div>
              <div style={{ width: `${colDurWidth}px` }} className="shrink-0 text-center font-bold truncate">Duration</div>
              <div style={{ width: `${colStartWidth}px` }} className="shrink-0 text-center font-bold truncate">Start</div>
              <div style={{ width: `${colFinishWidth}px` }} className="shrink-0 text-center font-bold truncate">Finish</div>
              <div style={{ width: `${colPredWidth}px` }} className="shrink-0 text-center font-bold truncate">Pred</div>
              <div style={{ width: `${colPctWidth}px` }} className="shrink-0 text-center font-bold truncate">%</div>
              {isBaselineActiveAndSet && (
                <div style={{ width: `${colVarWidth}px` }} className="shrink-0 text-center font-bold truncate">Var</div>
              )}
            </div>
          </div>

          {/* Left Panel rows list (sync scrolls vertically via ref) */}
          <div 
            ref={leftScrollRef} 
            className="flex-1 overflow-y-hidden divide-y divide-base-border/40 select-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', width: `${totalTableWidth}px` }}
          >
            {rows.map((row, idx) => {
              const isSelected = selectedRowId === row.id;
              
              let bgClass = 'bg-base-surface hover:bg-base-surface2/50';
              if (row.level === 0) bgClass = 'bg-base-accent-dim hover:bg-base-accent-dim/80';
              else if (row.level === 1) bgClass = 'bg-base-surface2 hover:bg-base-surface3/50';
              else if (idx % 2 === 1) bgClass = 'bg-base-surface2/30 hover:bg-base-surface2/75';

              if (isSelected) bgClass = 'bg-base-accent-dim/60 font-semibold';

              return (
                <div 
                  key={row.id} 
                  onClick={() => setSelectedRowId(row.id)}
                  className={`h-8 flex text-xs font-semibold select-none items-center cursor-pointer transition-colors border-b border-base-border/20 divide-x divide-base-border/10 ${bgClass}`}
                >
                  {/* WBS Column */}
                  <div style={{ width: `${colWbsWidth}px` }} className="shrink-0 text-center font-mono text-[10px] text-base-muted font-bold">
                    {row.wbs}
                  </div>

                  {/* Task Name Column with indentations, WBS prefix, and icons */}
                  <div 
                    className="shrink-0 flex items-center min-w-0 pr-1 select-none font-sans"
                    style={{ 
                      width: `${colNameWidth}px`,
                      paddingLeft: `${row.level === 1 ? 8 : row.level === 2 ? 24 : 4}px` 
                    }}
                  >
                    {row.type === 'assembly' && (
                      <button 
                        onClick={(e) => toggleAssemblyCollapse(row.id, e)}
                        className="p-0.5 mr-1 rounded hover:bg-base-surface3 text-base-muted hover:text-base-text shrink-0 cursor-pointer transition-all"
                      >
                        {collapsedAsms[row.id] !== false ? (
                          <ChevronRight className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    )}

                    {row.isMilestone && (
                      <span className="text-yellow-500 mr-1.5 leading-none">◆</span>
                    )}



                    <span className={`truncate select-none ${
                      row.level === 0 ? 'font-condensed font-extrabold text-base-accent text-sm tracking-wide' :
                      row.level === 1 ? 'font-condensed font-bold text-xs text-base-text uppercase tracking-wide' :
                      'font-medium text-xs text-base-muted2'
                    }`} title={row.name}>
                      {highlightText(row.name, searchQuery)}
                    </span>
                    {showCriticalPath && row.level === 1 && criticalAssemblyIds.has(row.id) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 ml-1.5" title="Contains critical tasks" />
                    )}
                  </div>

                  {/* Duration Days */}
                  <div style={{ width: `${colDurWidth}px` }} className="shrink-0 text-center text-[10px] font-mono text-base-muted font-bold">
                    {row.isMilestone ? '0 days' : `${row.duration}d`}
                  </div>

                  {/* Start Date Column with Inline Editing */}
                  <div 
                    style={{ width: `${colStartWidth}px` }} 
                    className="shrink-0 text-center font-mono text-[10px] text-base-muted truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full"
                    onClick={() => {
                      if (onUpdateProject) {
                        setEditingCell({ rowId: row.id, field: 'start' });
                      }
                    }}
                  >
                    {editingCell?.rowId === row.id && editingCell.field === 'start' ? (
                      <input
                        type="date"
                        autoFocus
                        defaultValue={row.start || ''}
                        className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          saveDate(row.id, 'start', e.target.value);
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { 
                            saveDate(row.id, 'start', e.currentTarget.value); 
                            setEditingCell(null); 
                          }
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <span className="flex items-center gap-1 select-none" title="Click to edit">
                        {row.start || '—'}
                        {onUpdateProject && <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-1">✏️</span>}
                      </span>
                    )}
                  </div>

                  {/* Finish Date Column with Inline Editing */}
                  <div 
                    style={{ width: `${colFinishWidth}px` }} 
                    className="shrink-0 text-center font-mono text-[10px] text-base-muted truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full"
                    onClick={() => {
                      if (onUpdateProject) {
                        setEditingCell({ rowId: row.id, field: 'finish' });
                      }
                    }}
                  >
                    {editingCell?.rowId === row.id && editingCell.field === 'finish' ? (
                      <input
                        type="date"
                        autoFocus
                        defaultValue={row.finish || ''}
                        className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          saveDate(row.id, 'finish', e.target.value);
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { 
                            saveDate(row.id, 'finish', e.currentTarget.value); 
                            setEditingCell(null); 
                          }
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <span className="flex items-center gap-1 select-none" title="Click to edit">
                        {row.finish || '—'}
                        {onUpdateProject && <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-1">✏️</span>}
                      </span>
                    )}
                  </div>

                  {/* Pred Column with Click-to-Modal and Inline Editing */}
                  <div
                    style={{ width: `${colPredWidth}px` }}
                    className="shrink-0 text-center font-mono text-[10px] truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 group relative flex items-center justify-center h-full"
                    onClick={() => {
                      if (editingPred !== row.id) {
                        setEditingPred(row.id);
                        const existing = (row.predecessors || [])
                          .map(dep => {
                            const predWbs = rows.find(r => r.id === dep.key)?.wbs || '';
                            if (!predWbs) return '';
                            const lagStr = dep.lag ? `+${dep.lag}` : '';
                            const typeStr = dep.type === 'FS' ? '' : dep.type;
                            return `${predWbs}${typeStr}${lagStr}`;
                          })
                          .filter(Boolean)
                          .join(', ');
                        setPredInputVal(existing);
                      }
                    }}
                  >
                    {editingPred === row.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={predInputVal}
                        placeholder="1.1FS, 1.2SS"
                        className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none"
                        onClick={(e) => e.stopPropagation()}
                        onChange={e => setPredInputVal(e.target.value)}
                        onBlur={() => {
                          savePredecessors(row.id, predInputVal);
                          setEditingPred(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { 
                            savePredecessors(row.id, predInputVal); 
                            setEditingPred(null); 
                          }
                          if (e.key === 'Escape') setEditingPred(null);
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1 select-none">
                        {row.predecessors && row.predecessors.length > 0 ? (
                          <span 
                            onClick={(e) => {
                              if (onOpenDepModal) {
                                e.stopPropagation();
                                let rowKey = '';
                                if (row.level === 0) rowKey = `p:${project.id}`;
                                else if (row.level === 1) rowKey = `a:${project.id}:${row.id}`;
                                else if (row.level === 2) rowKey = `t:${project.id}:${row.parentAsmId}:${row.id}`;
                                if (rowKey) onOpenDepModal(rowKey);
                              }
                            }}
                            className="text-blue-500 hover:text-blue-600 hover:underline font-bold cursor-pointer"
                            title="Click to manage predecessors in modal"
                          >
                            {getPredecessorsLabel(row)}
                          </span>
                        ) : (
                          <span className="text-base-muted">—</span>
                        )}
                        {onUpdateProject && (
                          <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-1">✏️</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Progress % Column */}
                  <div
                    style={{ width: `${colPctWidth}px` }}
                    className={`shrink-0 text-center font-mono text-[10px] h-full flex items-center justify-center transition-all duration-300 relative group
                      ${flashingCellId === row.id 
                        ? 'bg-base-green-dim' 
                        : row.level === 2 && onUpdateProject 
                          ? 'cursor-pointer hover:bg-base-accent-dim/40' 
                          : 'bg-base-surface3/40 cursor-default'}
                    `}
                    onClick={() => {
                      if (onUpdateProject && row.level === 2) {
                        setEditingPct(row.id);
                      }
                    }}
                  >
                    {row.level === 2 && onUpdateProject && editingPct === row.id ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        autoFocus
                        defaultValue={row.pct}
                        className="w-full text-center text-[10px] font-mono bg-base-surface border border-base-accent rounded py-0 outline-none h-6 px-0.5"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          saveProgress(row.id, isNaN(val) ? 0 : val);
                          setEditingPct(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(e.currentTarget.value, 10);
                            saveProgress(row.id, isNaN(val) ? 0 : val);
                            setEditingPct(null);
                          }
                          if (e.key === 'Escape') setEditingPct(null);
                        }}
                      />
                    ) : (
                      <span className="select-none font-bold">
                        {row.pct}%
                        {row.level === 2 && onUpdateProject && (
                          <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-0.5">✏️</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Variance Column */}
                  {isBaselineActiveAndSet && (
                    <div
                      style={{ width: `${colVarWidth}px` }}
                      className="shrink-0 text-center font-mono text-[10px] h-full flex items-center justify-center border-l border-base-border/10 select-none"
                    >
                      {(() => {
                        if (!row.finish || !row.baselineFinish) {
                          return <span className="text-base-muted">—</span>;
                        }
                        try {
                          const act = parseLocalDate(row.finish);
                          const base = parseLocalDate(row.baselineFinish);
                          const diff = daysBetween(base, act);
                          if (diff > 0) {
                            return <span className="text-red-500 font-bold">{`+${diff}d`}</span>;
                          } else {
                            return <span className="text-green-500 font-bold">✓</span>;
                          }
                        } catch (e) {
                          return <span className="text-base-muted">—</span>;
                        }
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
        <div 
          ref={rightScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto relative select-none"
        >
          {/* Scrollable Container Content Stage */}
          <div 
            className="gantt-relative-container relative min-h-full" 
            style={{ width: `${totalTimelineDays * pixelsPerDay}px` }}
          >
            {/* 1. TIMELINE HEADER BAND (56px) */}
            <div className="h-14 border-b border-base-border sticky top-0 z-30 select-none shrink-0 bg-base-surface">
              {/* Row 1: Month Name / Year Header */}
              <div className="h-7 border-b border-base-border/50 flex select-none bg-base-surface3">
                {topHeaders.map((m, idx) => (
                  <div 
                    key={`${m.label}-${idx}`}
                    style={{ width: `${m.width}px` }}
                    className="h-full border-r border-base-border/30 flex items-center justify-center font-condensed font-extrabold text-[10px] text-base-muted uppercase tracking-wider select-none shrink-0"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Row 2: Sub-dates depending on Zoom */}
              <div className="h-7 flex select-none bg-base-surface2">
                {bottomHeaders.map((w, idx) => (
                  <div 
                    key={`${w.label}-${idx}`}
                    style={{ width: `${w.width}px` }}
                    className={`h-full border-r border-base-border/30 flex items-center justify-center font-mono text-[9px] font-bold select-none shrink-0 ${
                      w.isWeekend ? 'bg-base-red-dim text-base-red' : 'text-base-muted/80'
                    }`}
                  >
                    {w.label}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. BACKGROUND WEEKEND BANDS AND GRID COLUMN VERTS */}
            <div className="absolute top-14 bottom-0 left-0 right-0 pointer-events-none select-none z-0">
              {/* Weekend backgrounds */}
              {weekendBands.map((band, idx) => (
                <div 
                  key={`weekend-${idx}`}
                  className="absolute top-0 bottom-0 bg-slate-100 dark:bg-slate-900/40 pointer-events-none z-0"
                  style={{ left: `${band.left}px`, width: `${band.width}px` }}
                />
              ))}

              {/* Grid vertical lines */}
              {bottomHeaders.map((bh, idx) => {
                let accumulatedLeft = 0;
                for (let i = 0; i < idx; i++) accumulatedLeft += bottomHeaders[i].width;
                return (
                  <div 
                    key={`vert-grid-${idx}`}
                    className="absolute top-0 bottom-0 border-r border-base-border/20"
                    style={{ left: `${accumulatedLeft}px`, width: `${bh.width}px` }}
                  />
                );
              })}
            </div>

            {/* 3. TODAY LINE INDICATOR */}
            {isTodayInTimeline && (
              <div 
                className="absolute top-14 bottom-0 border-l-2 border-dashed border-base-red pointer-events-none z-15 select-none"
                style={{ left: `${todayX}px` }}
              >
                <span className="absolute top-1 -left-4 px-1.5 py-0.5 rounded bg-base-red text-white font-condensed font-extrabold text-[8px] tracking-wider select-none">
                  TODAY
                </span>
                <span className="absolute bottom-1 left-0 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-base-red text-white font-mono text-[8px] select-none font-bold">
                  {todayFormattedFull}
                </span>
              </div>
            )}

            {/* 4. CHANNELS / ROWS ZONE */}
            <div className="relative pt-0 min-h-full z-10 select-none">
              {visibleTasksCount === 0 && isFilterActive ? (
                <div className="absolute inset-x-0 top-14 flex flex-col items-center justify-center p-8 text-center z-40 bg-base-bg/85 min-h-[250px]">
                  <div className="p-3 bg-base-surface border border-base-border rounded-full mb-3 text-base-muted flex items-center justify-center shadow-sm">
                    <Search className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <h3 className="font-condensed font-extrabold text-sm text-base-text">No tasks match your filter.</h3>
                  <p className="text-[11px] text-base-muted mt-1 max-w-xs">
                    Try adjusting your search term or status dropdown to find what you are looking for.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                    className="mt-4 px-3 py-1.5 text-[10px] uppercase tracking-wider font-condensed font-extrabold bg-base-accent text-white rounded-lg hover:bg-base-accent/90 transition-all cursor-pointer shadow-sm"
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                rows.map((row, idx) => {
                const isSelected = selectedRowId === row.id;
                const barCoords = getRowBarCoords(row);
                const baselineCoords = getBaselineCoords(row);
                const slackValue = slackMap.get(row.id) ?? 999;
                const hasEarlyWarning = showCriticalPath && row.level === 2 && !criticalPathIds.has(row.id) && slackValue >= 0 && slackValue <= 1;
                
                let hoverClass = 'hover:bg-base-surface2/50';
                if (row.level === 0) hoverClass = 'hover:bg-base-accent-dim/80';
                else if (row.level === 1) hoverClass = 'hover:bg-base-surface3/50';

                return (
                  <div 
                    key={`timeline-row-${row.id}`}
                    onClick={() => setSelectedRowId(row.id)}
                    className={`h-8 relative select-none border-b border-base-border/20 cursor-pointer transition-colors ${hoverClass} ${
                      isSelected ? 'bg-base-accent-dim/40' : ''
                    }`}
                    style={{ height: '32px' }}
                  >
                    {/* Render Baseline Bar */}
                    {showBaseline && baselineCoords && row.level === 2 && !row.isMilestone && (
                      <div 
                        className="absolute select-none pointer-events-none z-10"
                        style={{ 
                          left: `${baselineCoords.left}px`, 
                          width: `${Math.max(8, baselineCoords.width)}px`,
                          top: '25px',
                          height: '3px',
                          backgroundColor: '#6b7280',
                          opacity: 0.5
                        }}
                      />
                    )}

                    {barCoords && (
                      <div 
                        onMouseEnter={(e) => handleMouseEnter(row, e)}
                        onMouseLeave={handleMouseLeave}
                        className="absolute select-none group"
                        style={{ 
                          left: `${barCoords.left}px`, 
                          width: `${row.isMilestone ? '20' : Math.max(12, barCoords.width)}px`,
                          top: '0px',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {/* Summary Bar Level 0 (Project rollup) */}
                        {row.level === 0 && (
                          <div 
                            className="w-full relative flex items-center h-4 select-none"
                            style={{ cursor: onUpdateProject ? (dragState?.rowId === row.id ? 'grabbing' : 'grab') : 'default' }}
                            onMouseDown={(e) => handleBarMouseDown(row, 'move', e)}
                          >
                            <div className="w-full h-2 bg-base-accent-dim relative rounded-xs overflow-hidden flex items-center border border-base-accent/40 pointer-events-none">
                              <div 
                                className="h-full bg-base-accent"
                                style={{ width: `${row.pct}%` }}
                              />
                            </div>
                            <div className="absolute left-0 top-1.5 border-t-[6px] border-t-base-accent border-x-[4px] border-x-transparent pointer-events-none" />
                            <div className="absolute right-0 top-1.5 border-t-[6px] border-t-base-accent border-x-[4px] border-x-transparent pointer-events-none" />
                          </div>
                        )}

                        {/* Summary Bar Level 1 (Assembly Rollup) */}
                        {row.level === 1 && (
                          <div 
                            className={`w-full relative flex items-center h-4 select-none ${
                              showCriticalPath && criticalAssemblyIds.has(row.id)
                                ? 'border-l-2 border-red-600 pl-1'
                                : ''
                            }`}
                            style={{ cursor: onUpdateProject ? (dragState?.rowId === row.id ? 'grabbing' : 'grab') : 'default' }}
                            onMouseDown={(e) => handleBarMouseDown(row, 'move', e)}
                          >
                            <div className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 relative rounded-full overflow-hidden flex items-center border border-slate-400/20 pointer-events-none">
                              <div 
                                className="h-full bg-slate-800 dark:bg-slate-200"
                                style={{ width: `${row.pct}%` }}
                              />
                            </div>
                            <div className="absolute left-0 top-1 border-t-[6px] border-t-slate-800 dark:border-t-slate-200 border-x-[4px] border-x-transparent pointer-events-none" />
                            <div className="absolute right-0 top-1 border-t-[6px] border-t-slate-800 dark:border-t-slate-200 border-x-[4px] border-x-transparent pointer-events-none" />
                          </div>
                        )}

                        {/* Task Bar Level 2 (Standard Task) */}
                        {row.level === 2 && !row.isMilestone && (
                          <div 
                            className={`w-full h-4.5 rounded relative overflow-hidden flex items-center select-none text-[9px] font-bold text-white transition-all shadow-xs border ${
                              cascadedTaskIds.has(row.id)
                                ? 'border-dashed border-2 border-amber-400 animate-pulse bg-base-blue'
                                : row.done 
                                  ? 'bg-base-green border-base-green' 
                                  : showCriticalPath && criticalPathIds.has(row.id)
                                    ? 'bg-red-600 border-red-600'
                                    : (() => {
                                        const todayStr = new Date().toISOString().slice(0, 10);
                                        const isOverdue = row.pct < 100 && row.finish && row.finish < todayStr;
                                        return isOverdue 
                                          ? 'bg-base-red border-base-red animate-pulse' 
                                          : 'bg-base-blue border-base-blue';
                                      })()
                            } ${hasEarlyWarning ? 'border-l-2 border-l-amber-400 pl-1' : ''}`}
                            style={{ cursor: onUpdateProject ? 'move' : 'default' }}
                            onMouseDown={(e) => handleBarMouseDown(row, 'move', e)}
                            onTouchStart={(e) => handleBarTouchStart(row, 'move', e)}
                          >
                            {/* Progress overlay */}
                            {showProgress && row.pct > 0 && (
                              <div 
                                className="absolute left-0 top-0 bottom-0 bg-black/25 pointer-events-none"
                                style={{ width: `${row.pct}%` }}
                              />
                            )}

                            {/* Task name inside label if wide enough */}
                            {barCoords.width > 80 && (
                              <span className="relative z-10 truncate select-none leading-none px-2 pointer-events-none pr-8">
                                {row.name} ({row.pct}%)
                              </span>
                            )}

                            {/* Critical Path Indicator Badge inside bar */}
                            {showCriticalPath && criticalPathIds.has(row.id) && !row.done && barCoords.width > 40 && (
                              <span className="absolute right-2.5 text-[7px] bg-white/20 px-1 rounded-sm text-white select-none pointer-events-none z-10 uppercase tracking-wider font-extrabold font-mono">
                                CP
                              </span>
                            )}

                            {/* Right edge drag resize handle */}
                            {onUpdateProject && (
                              <div 
                                data-export-hide="true"
                                className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/30 cursor-col-resize z-20 print:hidden"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  handleBarMouseDown(row, 'resize', e);
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  handleBarTouchStart(row, 'resize', e);
                                }}
                              />
                            )}
                          </div>
                        )}

                        {/* Milestone Diamond shape */}
                        {row.isMilestone && (
                          <div 
                            className="w-3.5 h-3.5 bg-yellow-500 dark:bg-yellow-400 rotate-45 transform border border-white/40 shadow-xs flex items-center justify-center shrink-0 -ml-1.5 z-20 cursor-move"
                            onMouseDown={(e) => handleBarMouseDown(row, 'move', e)}
                            title="Drag milestone to shift target date"
                          />
                        )}

                        {/* Resource Labels shown to the right of the bar */}
                        {row.level === 2 && row.assigned && (
                          <span className="absolute left-[calc(100%+8px)] whitespace-nowrap text-[10px] text-base-muted font-semibold z-10 pointer-events-none bg-base-surface/60 px-1 rounded backdrop-blur-[1px]">
                            {row.assigned}
                          </span>
                        )}
                        {row.isMilestone && (
                          <span className="absolute left-[calc(100%+8px)] whitespace-nowrap text-[10px] text-yellow-600 dark:text-yellow-400 font-bold z-10 pointer-events-none bg-base-surface/60 px-1 rounded backdrop-blur-[1px]">
                            {row.name} (Milestone)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }))}

              {/* 5. SVG DEPENDENCY CONNECTOR ARROWS OVERLAY */}
              <svg 
                className="absolute pointer-events-none"
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${totalTimelineDays * pixelsPerDay}px`, 
                  height: `${rows.length * 32}px`,
                  zIndex: 10
                }}
              >
                <defs>
                  <marker 
                    id="arrow-right" 
                    viewBox="0 0 10 10" 
                    refX="8" 
                    refY="5" 
                    markerWidth="6" 
                    markerHeight="6" 
                    orient="auto"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#888" />
                  </marker>
                  <marker 
                    id="arrow-left" 
                    viewBox="0 0 10 10" 
                    refX="2" 
                    refY="5" 
                    markerWidth="6" 
                    markerHeight="6" 
                    orient="auto"
                  >
                    <path d="M 10 1.5 L 2 5 L 10 8.5 z" fill="#888" />
                  </marker>
                </defs>

                {arrows.map((arr, index) => (
                  <path
                    key={`arrow-${index}`}
                    d={arr.path}
                    fill="none"
                    stroke={arr.isCritical ? '#ef4444' : '#6b7280'}
                    strokeWidth={arr.isCritical ? 2 : 1.5}
                    markerEnd={arr.markerEnd}
                    className="transition-all duration-300"
                    opacity={arr.isCritical ? 1 : 0.9}
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* FLOATING HOVER TOOLTIP */}
        {hoveredTask && !isTouchDragging && (
          <div 
            data-export-hide="true"
            className="absolute bg-base-surface border border-base-border rounded-lg shadow-md p-3 text-xs z-[200] max-w-sm font-sans pointer-events-none animate-fade-in print:hidden"
            style={{ 
              left: `${Math.max(0, Math.min(hoveredTask.x, totalTimelineDays * pixelsPerDay - 280))}px`, 
              top: `${hoveredTask.y - (showBaseline && hoveredTask.row.baselineDate ? 210 : 145)}px` 
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
                <span>Start Date:</span>
                <span className="font-mono text-base-text">{hoveredTask.row.start || '—'}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Finish Date:</span>
                <span className="font-mono text-base-text">{hoveredTask.row.finish || '—'}</span>
              </div>
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
              )}
              
              {showBaseline && hoveredTask.row.baselineDate && (
                <div className="border-t border-base-border/40 mt-1.5 pt-1.5 space-y-1">
                  <div className="flex justify-between gap-6">
                    <span>Baseline Start:</span>
                    <span className="font-mono text-base-text">{hoveredTask.row.baselineDate}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Baseline Finish:</span>
                    <span className="font-mono text-base-text">{hoveredTask.row.baselineFinish || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Variance:</span>
                    {(() => {
                      if (!hoveredTask.row.finish || !hoveredTask.row.baselineFinish) {
                        return <span className="font-mono text-base-muted">—</span>;
                      }
                      try {
                        const act = parseLocalDate(hoveredTask.row.finish);
                        const base = parseLocalDate(hoveredTask.row.baselineFinish);
                        const diff = daysBetween(base, act);
                        if (diff > 0) {
                          return <span className="font-mono text-red-500 font-bold">⚠ {diff} days late</span>;
                        } else if (diff < 0) {
                          return <span className="font-mono text-green-500 font-bold">✓ {Math.abs(diff)} days early</span>;
                        } else {
                          return <span className="font-mono text-green-500 font-bold">✓ On time</span>;
                        }
                      } catch (e) {
                        return <span className="font-mono text-base-muted">—</span>;
                      }
                    })()}
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
      </div>
    </div>
  );
}
