import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Link,
  Search,
  Users,
  GripVertical,
  RotateCcw,
  X,
  Trash2,
  Calendar
} from 'lucide-react';
import { Project, WorkflowStatusType } from '../types';
import { GanttRow } from './useGanttRows';
import { GanttDatePickerPopover } from './GanttDatePickerPopover';

export const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatusType, { label: string; dotColor: string; badgeClass: string }> = {
  verify: {
    label: 'VERIFY',
    dotColor: 'bg-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50 dark:border-amber-700/50 hover:bg-amber-500/20',
  },
  on_track: {
    label: 'ON TRACK',
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50 dark:border-emerald-700/50 hover:bg-emerald-500/20',
  },
  delayed: {
    label: 'DELAYED',
    dotColor: 'bg-red-500',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-300/50 dark:border-red-700/50 hover:bg-red-500/20',
  },
  complete: {
    label: 'COMPLETE',
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50 dark:border-blue-700/50 hover:bg-blue-500/20',
  },
  not_started: {
    label: 'NOT STARTED',
    dotColor: 'bg-slate-400',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300/50 dark:border-slate-700/50 hover:bg-slate-500/20',
  },
};

export const getEffectiveWorkflowStatus = (
  status?: WorkflowStatusType,
  pct?: number,
  done?: boolean
): WorkflowStatusType => {
  if (status) return status;
  if (done || (typeof pct === 'number' && pct >= 100)) return 'complete';
  if (typeof pct === 'number' && pct > 0) return 'on_track';
  return 'not_started';
};

const COMPANY_PALETTES = [
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300/50 dark:border-indigo-700/50',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/50 dark:border-emerald-700/50',
  'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/50 dark:border-purple-700/50',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/50 dark:border-amber-700/50',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-300/50 dark:border-cyan-700/50',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/50 dark:border-rose-700/50',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-300/50 dark:border-teal-700/50',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/50 dark:border-sky-700/50',
  'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/50 dark:border-fuchsia-700/50',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300/50 dark:border-violet-700/50',
];

export const getCompanyColorClass = (companyName?: string): string => {
  if (!companyName) return 'bg-slate-500/10 text-slate-600 border-slate-300/50';
  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = (hash << 5) - hash + companyName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COMPANY_PALETTES.length;
  return COMPANY_PALETTES[index];
};

export interface CircularProgressBadgeProps {
  pct: number;
  size?: number;
  strokeWidth?: number;
}

export const CircularProgressBadge: React.FC<CircularProgressBadgeProps> = ({
  pct,
  size = 24,
  strokeWidth = 2.5
}) => {
  const clampedPct = Math.min(100, Math.max(0, Math.round(pct || 0)));
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  const isCompleted = clampedPct === 100;
  const strokeColor = isCompleted ? '#10b981' : 'var(--accent, #3b82f6)';
  const textColorClass = isCompleted
    ? 'text-emerald-500 font-extrabold'
    : clampedPct > 0
      ? 'text-base-text font-bold'
      : 'text-base-muted/60 font-semibold';

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      title={`${clampedPct}% complete`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-base-border/40"
        />
        {clampedPct > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        )}
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-mono leading-none ${textColorClass}`}>
        {clampedPct}
      </span>
    </div>
  );
};

export interface WorkflowStatusBadgeProps {
  status: WorkflowStatusType;
  onClick?: (e: React.MouseEvent) => void;
  isInteractive?: boolean;
}

export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({ status, onClick, isInteractive }) => {
  const cfg = WORKFLOW_STATUS_CONFIG[status] || WORKFLOW_STATUS_CONFIG.not_started;
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-tight select-none transition-all ${cfg.badgeClass} ${
        isInteractive ? 'cursor-pointer hover:scale-105 active:scale-95 hover:shadow-xs' : 'cursor-default'
      }`}
      title={isInteractive ? 'Click to change status' : cfg.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotColor}`} />
      <span className="truncate max-w-[65px]">{cfg.label}</span>
    </div>
  );
};

export interface GanttGridProps {
  leftPanelWidth: number;
  totalTableWidth: number;
  leftScrollRef: React.RefObject<HTMLDivElement | null>;
  handleLeftWheel: (e: React.WheelEvent) => void;

  // Column widths
  colActIdWidth?: number;
  colWbsWidth: number;
  colNameWidth: number;
  colDurWidth: number;
  colBaseDurWidth?: number;
  colOdWidth?: number;
  colRdWidth?: number;
  colTotalFloatWidth?: number;
  colFreeFloatWidth?: number;
  colEarlyStartWidth?: number;
  colEarlyFinishWidth?: number;
  colLateStartWidth?: number;
  colLateFinishWidth?: number;
  colPlanHrsWidth: number;
  colActHrsWidth: number;
  colVarianceWidth: number;
  colCrewWidth: number;
  colCompanyWidth: number;
  colAssigneeWidth: number;
  colStartWidth: number;
  colFinishWidth: number;
  colBaseStartWidth: number;
  colBaseFinishWidth: number;
  colPredWidth: number;
  colPctWidth: number;
  colStatusWidth: number;

  // Visibility / Tab modes
  showHoursTracking: boolean;
  showBaseline: boolean;
  activeTab: string;
  searchQuery: string;
  showCriticalPath: boolean;
  criticalAssemblyIds: Set<string>;

  // Rows and windowing
  visibleRows: GanttRow[];
  allRows: GanttRow[];
  rows: GanttRow[];
  startIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  selectedRowId: string | null;
  setSelectedRowId: (id: string | null) => void;
  dragHoverTargetRowId: string | null;
  dependencyViolationsMap: Map<string, any[]>;
  expandedIds: Set<string>;
  toggleProjectCollapse: (projectId: string, e?: React.MouseEvent) => void;
  collapsedAsms: Record<string, boolean>;
  toggleAssemblyCollapse: (asmId: string, e: React.MouseEvent) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  getProjectIdOfRow: (row: GanttRow) => string;

  // Inline editing & actions
  onUpdateProject?: (project: Project) => void;
  editingHoursCell: string | null;
  setEditingHoursCell: (id: string | null) => void;
  saveRowBudgetHours: (rowId: string, level: number, valueStr: string) => void;
  editingLookaheadCell: { rowId: string; field: 'crew' | 'company' | 'assigned' } | null;
  setEditingLookaheadCell: (val: { rowId: string; field: 'crew' | 'company' | 'assigned' } | null) => void;
  saveTaskField: (taskId: string, field: 'crew' | 'company' | 'assigned', val: any) => void;
  editingCell: { rowId: string; field: 'start' | 'finish' } | null;
  setEditingCell: (val: { rowId: string; field: 'start' | 'finish' } | null) => void;
  saveDate: (rowId: string, field: 'start' | 'finish' | 'both', value: string) => void;
  editingBaselineCell?: { rowId: string; field: 'start' | 'finish' } | null;
  setEditingBaselineCell?: (val: { rowId: string; field: 'start' | 'finish' } | null) => void;
  saveBaselineDate?: (rowId: string, field: 'start' | 'finish' | 'both', value: string) => void;
  editingPred: string | null;
  setEditingPred: (id: string | null) => void;
  predInputVal: string;
  setPredInputVal: (val: string) => void;
  savePredecessors: (rowId: string, predStr: string) => void;
  getPredecessorsLabel: (row: GanttRow) => string;
  setDepPanelRowId: (key: string) => void;
  setDepPanelOpen: (open: boolean) => void;
  setDepPanelSearch: (val: string) => void;
  flashingCellId: string | null;
  editingPct: string | null;
  setEditingPct: (id: string | null) => void;
  saveProgress: (rowId: string, val: number) => void;
  statusPopoverRowId: string | null;
  setStatusPopoverRowId: (id: string | null) => void;
  saveWorkflowStatus: (rowId: string, stKey: WorkflowStatusType) => void;

  // S-Curve & Resource load
  showSCurve: boolean;
  sCurvePaths: any;
  SCURVE_H: number;
  showResourceLoad: boolean;
  resourceLoadData: any;
  setResourceFilter: (filter: 'all' | 'conflicts') => void;
  resourceFilter: 'all' | 'conflicts';
  resourceSearch: string;
  setResourceSearch: (val: string) => void;
  dailyCapacityLimit: number;
  setDailyCapacityLimit: (val: number) => void;
  expandedResources: Set<string>;
  setExpandedResources: (val: Set<string>) => void;
}

export type ColumnId =
  | 'activityId'
  | 'wbs'
  | 'name'
  | 'od'
  | 'rd'
  | 'dur'
  | 'baseDur'
  | 'totalFloat'
  | 'freeFloat'
  | 'earlyStart'
  | 'earlyFinish'
  | 'lateStart'
  | 'lateFinish'
  | 'start'
  | 'finish'
  | 'pct'
  | 'pred'
  | 'planHrs'
  | 'actHrs'
  | 'variance'
  | 'baseStart'
  | 'baseFinish'
  | 'crew'
  | 'company'
  | 'assignee'
  | 'status';

export const P6_COLUMN_ORDER: ColumnId[] = [
  'activityId',
  'wbs',
  'name',
  'od',
  'rd',
  'baseDur',
  'totalFloat',
  'start',
  'finish',
  'pct',
  'pred',
  'status',
];

export const STANDARD_COLUMN_ORDER: ColumnId[] = [
  'wbs',
  'name',
  'dur',
  'baseDur',
  'start',
  'finish',
  'pct',
  'pred',
  'status',
];

export const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  'wbs',
  'name',
  'dur',
  'baseDur',
  'start',
  'finish',
  'pct',
  'pred',
  'status',
  'planHrs',
  'actHrs',
  'variance',
  'baseStart' as ColumnId,
  'baseFinish' as ColumnId,
  'crew' as ColumnId,
  'company' as ColumnId,
  'assignee' as ColumnId,
  'activityId',
  'od',
  'rd',
  'totalFloat',
];

export const GanttGrid: React.FC<GanttGridProps> = ({
  leftPanelWidth,
  totalTableWidth,
  leftScrollRef,
  handleLeftWheel,

  colActIdWidth = 75,
  colWbsWidth,
  colNameWidth,
  colDurWidth,
  colBaseDurWidth = 64,
  colOdWidth = 48,
  colRdWidth = 48,
  colTotalFloatWidth = 72,
  colFreeFloatWidth = 68,
  colEarlyStartWidth = 80,
  colEarlyFinishWidth = 80,
  colLateStartWidth = 80,
  colLateFinishWidth = 80,
  colPlanHrsWidth,
  colActHrsWidth,
  colVarianceWidth,
  colCrewWidth,
  colCompanyWidth,
  colAssigneeWidth,
  colStartWidth,
  colFinishWidth,
  colBaseStartWidth,
  colBaseFinishWidth,
  colPredWidth,
  colPctWidth,
  colStatusWidth,

  showHoursTracking,
  showBaseline,
  activeTab,
  searchQuery,
  showCriticalPath,
  criticalAssemblyIds,

  visibleRows,
  allRows,
  rows,
  startIndex,
  topSpacerHeight,
  bottomSpacerHeight,
  selectedRowId,
  setSelectedRowId,
  dragHoverTargetRowId,
  dependencyViolationsMap,
  expandedIds,
  toggleProjectCollapse,
  collapsedAsms,
  toggleAssemblyCollapse,
  highlightText,
  getProjectIdOfRow,

  onUpdateProject,
  editingHoursCell,
  setEditingHoursCell,
  saveRowBudgetHours,
  editingLookaheadCell,
  setEditingLookaheadCell,
  saveTaskField,
  editingCell,
  setEditingCell,
  saveDate,
  editingBaselineCell,
  setEditingBaselineCell,
  saveBaselineDate,
  editingPred,
  setEditingPred,
  predInputVal,
  setPredInputVal,
  savePredecessors,
  getPredecessorsLabel,
  setDepPanelRowId,
  setDepPanelOpen,
  setDepPanelSearch,
  flashingCellId,
  editingPct,
  setEditingPct,
  saveProgress,
  statusPopoverRowId,
  setStatusPopoverRowId,
  saveWorkflowStatus,

  showSCurve,
  sCurvePaths,
  SCURVE_H,
  showResourceLoad,
  resourceLoadData,
  setResourceFilter,
  resourceFilter,
  resourceSearch,
  setResourceSearch,
  dailyCapacityLimit,
  setDailyCapacityLimit,
  expandedResources,
  setExpandedResources,
}) => {
  // Column Reordering State with LocalStorage Persistence
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => {
    try {
      const saved = localStorage.getItem('austin_gantt_column_order_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as ColumnId[];
        const valid = parsed.filter(id => DEFAULT_COLUMN_ORDER.includes(id));
        DEFAULT_COLUMN_ORDER.forEach(id => {
          if (!valid.includes(id)) valid.push(id);
        });
        return valid;
      }
    } catch {}
    return DEFAULT_COLUMN_ORDER;
  });

  const [draggedCol, setDraggedCol] = useState<ColumnId | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | null>(null);

  const handleDropColumn = (targetCol: ColumnId, side: 'left' | 'right') => {
    if (!draggedCol || draggedCol === targetCol) return;

    setColumnOrder(prev => {
      const filtered = prev.filter(c => c !== draggedCol);
      const targetIdx = filtered.indexOf(targetCol);
      if (targetIdx === -1) return prev;

      const insertIdx = side === 'right' ? targetIdx + 1 : targetIdx;
      const next = [...filtered.slice(0, insertIdx), draggedCol, ...filtered.slice(insertIdx)];
      try {
        localStorage.setItem('austin_gantt_column_order_v2', JSON.stringify(next));
      } catch {}
      return next;
    });

    setDraggedCol(null);
    setDragOverCol(null);
    setDragOverSide(null);
  };

  const handleResetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    try {
      localStorage.removeItem('austin_gantt_column_order_v2');
    } catch {}
  };

  const isColVisible = (colId: ColumnId) => {
    if (colId === 'planHrs' || colId === 'actHrs' || colId === 'variance') return showHoursTracking;
    if (colId === 'crew' || colId === 'company' || colId === 'assignee') return activeTab === 'lookahead';
    if (colId === 'baseStart' || colId === 'baseFinish') return showBaseline;
    return true;
  };

  const activeColumns = columnOrder.filter(isColVisible);

  const getColConfig = (colId: ColumnId) => {
    switch (colId) {
      case 'activityId':
        return { width: colActIdWidth, title: 'Oracle Primavera P6 Activity ID', label: 'Act ID', align: 'center', className: 'text-amber-500 font-mono font-bold' };
      case 'wbs':
        return { width: colWbsWidth, title: 'WBS Code', label: 'WBS', align: 'center' };
      case 'name':
        return { width: colNameWidth, title: 'Task Name / Description', label: 'Activity Name', align: 'left' };
      case 'od':
        return { width: colOdWidth, title: 'Original Duration (Days)', label: 'OD', align: 'center', className: 'font-mono' };
      case 'rd':
        return { width: colRdWidth, title: 'Remaining Duration (Days)', label: 'RD', align: 'center', className: 'font-mono' };
      case 'dur':
        return { width: colDurWidth, title: 'Duration (Days)', label: 'Duration', align: 'center' };
      case 'baseDur':
        return { width: colBaseDurWidth, title: 'Baseline Duration (Target Rencana Hari)', label: 'Base Dur', align: 'center', className: 'text-slate-500 font-mono font-bold' };
      case 'totalFloat':
        return { width: colTotalFloatWidth, title: 'Total Float / Slack (Days)', label: 'Total Float', align: 'center', className: 'font-mono font-bold' };
      case 'freeFloat':
        return { width: colFreeFloatWidth, title: 'Free Float (Days)', label: 'Free Float', align: 'center', className: 'font-mono' };
      case 'earlyStart':
        return { width: colEarlyStartWidth, title: 'CPM Early Start Date', label: 'Early Start', align: 'center', className: 'text-emerald-600 dark:text-emerald-400' };
      case 'earlyFinish':
        return { width: colEarlyFinishWidth, title: 'CPM Early Finish Date', label: 'Early Finish', align: 'center', className: 'text-emerald-600 dark:text-emerald-400' };
      case 'lateStart':
        return { width: colLateStartWidth, title: 'CPM Late Start Date', label: 'Late Start', align: 'center', className: 'text-orange-500 dark:text-orange-400' };
      case 'lateFinish':
        return { width: colLateFinishWidth, title: 'CPM Late Finish Date', label: 'Late Finish', align: 'center', className: 'text-orange-500 dark:text-orange-400' };
      case 'planHrs':
        return { width: colPlanHrsWidth, title: 'Planned/Budgeted Man-Hours', label: 'Plan Hrs', align: 'center', className: 'text-indigo-600 dark:text-indigo-400' };
      case 'actHrs':
        return { width: colActHrsWidth, title: 'Actual Timesheet Hours', label: 'Act Hrs', align: 'center', className: 'text-blue-600 dark:text-blue-400' };
      case 'variance':
        return { width: colVarianceWidth, title: 'Variance & Burn Rate', label: 'Burn / Var', align: 'center', className: 'text-amber-600 dark:text-amber-400' };
      case 'crew':
        return { width: colCrewWidth, title: 'Crew Size', label: 'Crew', align: 'center' };
      case 'company':
        return { width: colCompanyWidth, title: 'Company / Vendor', label: 'Company', align: 'center' };
      case 'assignee':
        return { width: colAssigneeWidth, title: 'Assignees / PIC', label: 'Assignees', align: 'center' };
      case 'start':
        return { width: colStartWidth, title: 'Start Date', label: 'Start', align: 'center' };
      case 'finish':
        return { width: colFinishWidth, title: 'Finish Date', label: 'Finish', align: 'center' };
      case 'baseStart':
        return { width: colBaseStartWidth, title: 'Baseline Start Date (Jadwal Target Rencana)', label: 'Base Start', align: 'center', className: 'text-slate-500' };
      case 'baseFinish':
        return { width: colBaseFinishWidth, title: 'Baseline Finish Date (Jadwal Target Rencana)', label: 'Base Finish', align: 'center', className: 'text-slate-500' };
      case 'pred':
        return { width: colPredWidth, title: 'Predecessors', label: 'Pred', align: 'center' };
      case 'pct':
        return { width: colPctWidth, title: '% Complete', label: '% Comp', align: 'center' };
      case 'status':
        return { width: colStatusWidth, title: 'Workflow Status', label: 'Status', align: 'center' };
    }
  };

  const renderColumnHeader = (colId: ColumnId) => {
    const conf = getColConfig(colId);
    const isBeingDragged = draggedCol === colId;
    const isTarget = dragOverCol === colId;

    return (
      <div
        key={`hdr-col-${colId}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', colId);
          setDraggedCol(colId);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const mid = rect.left + rect.width / 2;
          const side = e.clientX > mid ? 'right' : 'left';
          setDragOverCol(colId);
          setDragOverSide(side);
        }}
        onDragLeave={() => {
          if (dragOverCol === colId) {
            setDragOverCol(null);
            setDragOverSide(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragOverSide) {
            handleDropColumn(colId, dragOverSide);
          }
        }}
        onDragEnd={() => {
          setDraggedCol(null);
          setDragOverCol(null);
          setDragOverSide(null);
        }}
        style={{ width: `${conf.width}px` }}
        className={`shrink-0 text-xs font-black uppercase tracking-wider truncate h-full flex items-center justify-between px-1.5 cursor-grab active:cursor-grabbing hover:bg-base-accent-dim/40 transition-all group relative select-none text-base-text ${
          conf.align === 'center' ? 'text-center' : 'text-left'
        } ${conf.className || ''} ${
          isBeingDragged ? 'opacity-30 bg-base-accent/20' : ''
        } ${
          isTarget && dragOverSide === 'left' ? 'border-l-2 border-l-base-accent bg-base-accent/15' : ''
        } ${
          isTarget && dragOverSide === 'right' ? 'border-r-2 border-r-base-accent bg-base-accent/15' : ''
        }`}
        title={`${conf.title} (Klik dan Drag untuk memindahkan urutan kolom)`}
      >
        <span className="truncate flex-1 font-bold">{conf.label}</span>
        <GripVertical className="h-2.5 w-2.5 opacity-25 group-hover:opacity-100 text-base-muted shrink-0 ml-0.5" />
      </div>
    );
  };

  const renderColumnCell = (
    colId: ColumnId,
    row: GanttRow,
    idx: number,
    rowConflicts: any[] | undefined,
    hasConflict: boolean
  ) => {
    switch (colId) {
      case 'wbs':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colWbsWidth}px` }} className="shrink-0 text-center font-mono text-xs text-base-text/80 font-bold">
            {row.wbs}
          </div>
        );

      case 'name':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            className="shrink-0 flex items-center min-w-0 pr-1 select-none font-sans"
            style={{
              width: `${colNameWidth}px`,
              paddingLeft: `${row.level === 1 ? 16 : row.level === 2 ? 28 : 4}px`
            }}
          >
            {row.type === 'project' && (
              <button
                type="button"
                onClick={(e) => toggleProjectCollapse(row.id, e)}
                className="p-0.5 mr-1 rounded hover:bg-base-surface3 text-base-accent hover:text-base-text shrink-0 cursor-pointer transition-all"
                title={expandedIds.has(row.id) ? "Collapse Project" : "Expand Project"}
              >
                {expandedIds.has(row.id) ? (
                  <ChevronDown className="h-3.5 w-3.5 text-base-accent" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-base-accent" />
                )}
              </button>
            )}

            {row.type === 'assembly' && (
              <button
                type="button"
                onClick={(e) => toggleAssemblyCollapse(row.id, e)}
                className="p-0.5 mr-1 rounded hover:bg-base-surface3 text-base-muted hover:text-base-text shrink-0 cursor-pointer transition-all"
                title={collapsedAsms[row.id] ? "Expand Assembly" : "Collapse Assembly"}
              >
                {collapsedAsms[row.id] ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}

            {row.isMilestone && (
              <span className="text-yellow-500 mr-1.5 leading-none">◆</span>
            )}

            {hasConflict && (
              <span
                className="inline-flex items-center gap-0.5 mr-1.5 px-1 py-0.2 rounded bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50 text-[9px] font-extrabold font-mono animate-pulse shrink-0 cursor-help"
                title={`HARD DEPENDENCY CONSTRAINT VIOLATION:\n${(rowConflicts || []).map(c => `• ${c.reason}`).join('\n')}`}
              >
                <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                <span className="hidden sm:inline">CONFLICT</span>
              </span>
            )}

            <span className={`truncate select-none ${
              row.level === 0 ? 'font-condensed font-extrabold text-base-accent text-sm tracking-wide' :
              row.level === 1 ? 'font-condensed font-bold text-xs sm:text-[13px] text-base-text uppercase tracking-wide' :
              'font-semibold text-xs sm:text-[13px] text-base-text'
            } ${row.pct === 100 ? 'line-through opacity-50 decoration-emerald-500/70' : ''}`} title={row.name}>
              {row.pct === 100 && (
                <span className="no-underline inline-flex items-center text-emerald-500 font-bold mr-1" title="Completed">
                  ✓ — 
                </span>
              )}
              {highlightText(row.name, searchQuery)}
            </span>
            {showCriticalPath && row.level === 1 && criticalAssemblyIds.has(row.id) && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 ml-1.5" title="Contains critical tasks" />
            )}
          </div>
        );

      case 'activityId':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colActIdWidth}px` }} className="shrink-0 text-center font-mono text-xs truncate px-1 flex items-center justify-center h-full">
            <span className={`px-1.5 py-0.5 rounded font-extrabold font-mono tracking-tight text-[11px] ${
              row.level === 0 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
              row.level === 1 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
              row.isCritical ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40 font-black' :
              'bg-base-surface2 text-base-text font-bold'
            }`}>
              {row.activityId || row.wbs}
            </span>
          </div>
        );

      case 'od':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colOdWidth}px` }} className="shrink-0 text-center text-xs font-mono text-base-text font-bold">
            {row.isMilestone ? '0d' : `${row.od ?? row.duration}d`}
          </div>
        );

      case 'rd':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colRdWidth}px` }} className="shrink-0 text-center text-xs font-mono font-bold">
            <span className={row.rd === 0 ? 'text-emerald-500 font-extrabold' : 'text-amber-600 dark:text-amber-400'}>
              {row.isMilestone ? '0d' : `${row.rd ?? (row.done ? 0 : row.duration)}d`}
            </span>
          </div>
        );

      case 'totalFloat': {
        const tf = row.totalFloat ?? 0;
        const isCrit = row.level === 2 ? (row.isCritical || tf <= 0.001) : (tf <= 0.001);
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colTotalFloatWidth}px` }} className="shrink-0 text-center text-xs font-mono font-black flex items-center justify-center h-full px-1">
            {row.level === 2 ? (
              isCrit ? (
                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white border border-red-500 shadow-2xs text-[10px] uppercase tracking-wider font-extrabold animate-pulse" title="Zero Float: Critical Path driving overall schedule">
                  0d (CP)
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                  {tf}d
                </span>
              )
            ) : (
              <span className={`text-[10.5px] ${isCrit ? 'text-red-500 font-extrabold' : 'text-base-muted'}`}>
                {tf}d
              </span>
            )}
          </div>
        );
      }

      case 'freeFloat':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colFreeFloatWidth}px` }} className="shrink-0 text-center text-xs font-mono text-base-muted font-semibold">
            {row.level === 2 ? `${row.freeFloat ?? 0}d` : '—'}
          </div>
        );

      case 'earlyStart':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colEarlyStartWidth}px` }} className="shrink-0 text-center font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            {row.earlyStart || row.start || '—'}
          </div>
        );

      case 'earlyFinish':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colEarlyFinishWidth}px` }} className="shrink-0 text-center font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            {row.earlyFinish || row.finish || '—'}
          </div>
        );

      case 'lateStart':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colLateStartWidth}px` }} className="shrink-0 text-center font-mono text-xs text-orange-500 dark:text-orange-400 font-medium">
            {row.lateStart || '—'}
          </div>
        );

      case 'lateFinish':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colLateFinishWidth}px` }} className="shrink-0 text-center font-mono text-xs text-orange-500 dark:text-orange-400 font-bold">
            {row.lateFinish || '—'}
          </div>
        );

      case 'dur':
        return (
          <div key={`cell-${colId}-${row.id}`} style={{ width: `${colDurWidth}px` }} className="shrink-0 text-center text-xs font-mono text-base-text font-bold">
            {row.isMilestone ? '0 days' : (row.start && row.finish && row.duration > 0 ? `${row.duration}d` : '—')}
          </div>
        );

      case 'baseDur':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colBaseDurWidth}px` }}
            className="shrink-0 text-center text-xs font-mono text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center h-full bg-slate-500/5"
            title={row.baselineDuration !== undefined ? `Baseline Duration: ${row.baselineDuration} days` : 'Belum di-set baseline'}
          >
            {row.baselineDuration !== undefined
              ? (row.isMilestone ? '0d' : `${row.baselineDuration}d`)
              : '—'}
          </div>
        );

      case 'planHrs':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colPlanHrsWidth}px` }}
            className="shrink-0 text-center font-mono text-xs truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full"
            onClick={() => {
              if (onUpdateProject) {
                setEditingHoursCell(row.id);
              }
            }}
            title={row.level === 2 ? 'Click to edit Planned/Budgeted hours for task' : row.level === 1 ? 'Click to set Assembly budget hours' : 'Click to set Project budget hours'}
          >
            {editingHoursCell === row.id && onUpdateProject ? (
              <input
                type="number"
                min="0"
                step="0.5"
                autoFocus
                defaultValue={row.budgetHours ?? (row.planHours > 0 ? row.planHours : '')}
                placeholder="Hrs..."
                className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none text-center"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  saveRowBudgetHours(row.id, row.level, e.target.value);
                  setEditingHoursCell(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveRowBudgetHours(row.id, row.level, e.currentTarget.value);
                    setEditingHoursCell(null);
                  }
                  if (e.key === 'Escape') setEditingHoursCell(null);
                }}
              />
            ) : (
              <span className={`select-none font-bold ${row.level === 0 ? 'text-indigo-600 dark:text-indigo-400' : row.level === 1 ? 'text-base-text font-extrabold' : 'text-base-muted2'}`}>
                {row.planHours > 0 ? `${row.planHours % 1 === 0 ? row.planHours : row.planHours.toFixed(1)}h` : '—'}
                {onUpdateProject && (
                  <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-0.5 text-base-muted">✏️</span>
                )}
              </span>
            )}
          </div>
        );

      case 'actHrs':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colActHrsWidth}px` }}
            className="shrink-0 text-center font-mono text-xs truncate px-1 flex items-center justify-center h-full"
            title={`${row.actualHours.toFixed(1)} actual hours logged across ${row.timesheetCount} timesheet entries`}
          >
            {row.actualHours > 0 ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px]">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span>{row.actualHours % 1 === 0 ? row.actualHours : row.actualHours.toFixed(1)}h</span>
              </span>
            ) : (
              <span className="text-base-muted/40 select-none font-mono">0h</span>
            )}
          </div>
        );

      case 'variance':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colVarianceWidth}px` }}
            className="shrink-0 text-center font-mono text-[10px] truncate px-1 flex items-center justify-center h-full"
          >
            {(() => {
              if (row.planHours === 0 && row.actualHours === 0) {
                return <span className="text-base-muted/40 select-none">—</span>;
              }
              const diff = row.actualHours - row.planHours;
              const burnPct = row.planHours > 0 ? Math.round((row.actualHours / row.planHours) * 100) : 100;
              const isOver = diff > 0.05;
              const isNear = !isOver && burnPct >= 85;

              if (isOver) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 text-[8.5px] font-black font-mono animate-pulse"
                    title={`OVER BUDGET:\nActual (${row.actualHours.toFixed(1)}h) exceeds Plan (${row.planHours.toFixed(1)}h) by +${diff.toFixed(1)}h (${burnPct}% burn)`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-red-500" />
                    <span>+{diff.toFixed(0)}h</span>
                  </span>
                );
              }
              if (isNear) {
                return (
                  <span
                    className="inline-flex items-center px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[8.5px] font-bold font-mono"
                    title={`NEAR BUDGET:\n${burnPct}% of planned hours used (${row.actualHours.toFixed(1)}h / ${row.planHours.toFixed(1)}h)`}
                  >
                    {burnPct}%
                  </span>
                );
              }
              return (
                <span
                  className="inline-flex items-center px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[8.5px] font-mono font-medium"
                  title={`UNDER BUDGET:\n${burnPct}% of planned hours used (${(row.planHours - row.actualHours).toFixed(1)}h remaining)`}
                >
                  {burnPct}%
                </span>
              );
            })()}
          </div>
        );

      case 'crew':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colCrewWidth}px` }}
            className="shrink-0 text-center font-mono text-[10px] truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full"
            onClick={() => {
              if (row.level === 2 && onUpdateProject) {
                setEditingLookaheadCell({ rowId: row.id, field: 'crew' });
              }
            }}
          >
            {editingLookaheadCell?.rowId === row.id && editingLookaheadCell.field === 'crew' ? (
              <input
                type="number"
                min="1"
                autoFocus
                defaultValue={row.crewSize || ''}
                className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none text-center"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  saveTaskField(row.id, 'crew', e.target.value);
                  setEditingLookaheadCell(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveTaskField(row.id, 'crew', e.currentTarget.value);
                    setEditingLookaheadCell(null);
                  }
                  if (e.key === 'Escape') setEditingLookaheadCell(null);
                }}
              />
            ) : (
              <span className="select-none font-bold text-base-text" title={row.level === 2 ? 'Click to edit Crew Size' : ''}>
                {row.level === 2
                  ? (row.crewSize ? row.crewSize : '—')
                  : (
                    (() => {
                      const childCrew = allRows
                        .filter(r => r.level === 2 && (row.level === 1 ? r.parentAsmId === row.id : getProjectIdOfRow(r) === row.id))
                        .reduce((sum, r) => sum + (r.crewSize || 0), 0);
                      return childCrew > 0 ? childCrew : '—';
                    })()
                  )
                }
                {row.level === 2 && onUpdateProject && (
                  <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-0.5">✏️</span>
                )}
              </span>
            )}
          </div>
        );

      case 'company':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colCompanyWidth}px` }}
            className="shrink-0 text-center text-[10px] truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full"
            onClick={() => {
              if (row.level === 2 && onUpdateProject) {
                setEditingLookaheadCell({ rowId: row.id, field: 'company' });
              }
            }}
          >
            {editingLookaheadCell?.rowId === row.id && editingLookaheadCell.field === 'company' ? (
              <input
                type="text"
                autoFocus
                defaultValue={row.assignedCompany || ''}
                placeholder="Company..."
                className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  saveTaskField(row.id, 'company', e.target.value);
                  setEditingLookaheadCell(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveTaskField(row.id, 'company', e.currentTarget.value);
                    setEditingLookaheadCell(null);
                  }
                  if (e.key === 'Escape') setEditingLookaheadCell(null);
                }}
              />
            ) : (
              row.level === 2 && row.assignedCompany ? (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold truncate max-w-[95px] ${getCompanyColorClass(row.assignedCompany)}`} title={row.assignedCompany}>
                  {row.assignedCompany}
                </span>
              ) : (
                <span className="text-base-muted/60 text-[10px] select-none">—</span>
              )
            )}
          </div>
        );

      case 'assignee':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colAssigneeWidth}px` }}
            className="shrink-0 text-center text-[10px] truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full"
            onClick={() => {
              if (row.level === 2 && onUpdateProject) {
                setEditingLookaheadCell({ rowId: row.id, field: 'assigned' });
              }
            }}
          >
            {editingLookaheadCell?.rowId === row.id && editingLookaheadCell.field === 'assigned' ? (
              <input
                type="text"
                autoFocus
                defaultValue={row.assigned || ''}
                placeholder="Assignees..."
                className="w-full text-[10px] font-mono bg-base-surface border border-base-accent rounded px-1 py-0 outline-none"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  saveTaskField(row.id, 'assigned', e.target.value);
                  setEditingLookaheadCell(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveTaskField(row.id, 'assigned', e.currentTarget.value);
                    setEditingLookaheadCell(null);
                  }
                  if (e.key === 'Escape') setEditingLookaheadCell(null);
                }}
              />
            ) : (
              <span className="text-base-text font-medium truncate max-w-[95px] select-none" title={row.assigned || ''}>
                {row.assigned || '—'}
              </span>
            )}
          </div>
        );

      case 'start': {
        const hasStart = !!row.start;
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colStartWidth}px` }}
            className={`shrink-0 text-center font-mono text-xs text-base-text truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full ${
              editingCell?.rowId === row.id && editingCell.field === 'start' ? 'z-50' : ''
            }`}
            onClick={() => {
              if (onUpdateProject) {
                setEditingCell({ rowId: row.id, field: 'start' });
              }
            }}
          >
            {editingCell?.rowId === row.id && editingCell.field === 'start' ? (
              <GanttDatePickerPopover
                row={row}
                field="start"
                onSave={(val) => {
                  saveDate(row.id, 'start', val);
                  setEditingCell(null);
                }}
                onClear={() => {
                  saveDate(row.id, 'start', '');
                  setEditingCell(null);
                }}
                onClearBoth={row.finish ? () => {
                  saveDate(row.id, 'both', '');
                  setEditingCell(null);
                } : undefined}
                onClose={() => setEditingCell(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-1 w-full px-0.5 select-none" title={hasStart ? `Start: ${row.start} (Klik untuk ubah / klik ikon tempat sampah untuk hapus)` : 'Klik untuk tentukan tanggal mulai aktual'}>
                <span className={`truncate flex-1 font-mono text-xs ${hasStart ? 'text-base-text font-bold' : 'text-slate-400 dark:text-slate-500 font-normal'}`}>
                  {hasStart ? row.start : '—'}
                </span>
                {hasStart && onUpdateProject && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveDate(row.id, 'start', '');
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Hapus tanggal mulai (1-klik)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {!hasStart && onUpdateProject && (
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-sans text-base-accent font-bold transition-opacity">
                    +Set
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'finish': {
        const hasFinish = !!row.finish;
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colFinishWidth}px` }}
            className={`shrink-0 text-center font-mono text-xs text-base-text truncate px-1 cursor-pointer hover:bg-base-accent-dim/40 transition-colors group relative flex items-center justify-center h-full ${
              editingCell?.rowId === row.id && editingCell.field === 'finish' ? 'z-50' : ''
            }`}
            onClick={() => {
              if (onUpdateProject) {
                setEditingCell({ rowId: row.id, field: 'finish' });
              }
            }}
          >
            {editingCell?.rowId === row.id && editingCell.field === 'finish' ? (
              <GanttDatePickerPopover
                row={row}
                field="finish"
                onSave={(val) => {
                  saveDate(row.id, 'finish', val);
                  setEditingCell(null);
                }}
                onClear={() => {
                  saveDate(row.id, 'finish', '');
                  setEditingCell(null);
                }}
                onClearBoth={row.start ? () => {
                  saveDate(row.id, 'both', '');
                  setEditingCell(null);
                } : undefined}
                onClose={() => setEditingCell(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-1 w-full px-0.5 select-none" title={hasFinish ? `Finish: ${row.finish} (Klik untuk ubah / klik ikon tempat sampah untuk hapus)` : 'Klik untuk tentukan tanggal selesai aktual'}>
                <span className={`truncate flex-1 font-mono text-xs ${hasFinish ? 'text-base-text font-bold' : 'text-slate-400 dark:text-slate-500 font-normal'}`}>
                  {hasFinish ? row.finish : '—'}
                </span>
                {hasFinish && onUpdateProject && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveDate(row.id, 'finish', '');
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Hapus tanggal selesai (1-klik)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {!hasFinish && onUpdateProject && (
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-sans text-base-accent font-bold transition-opacity">
                    +Set
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'baseStart': {
        const hasBaseStart = !!row.baselineStart;
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colBaseStartWidth}px` }}
            className={`shrink-0 text-center font-mono text-xs truncate px-1 flex items-center justify-center h-full bg-slate-500/5 group relative ${
              saveBaselineDate ? 'cursor-pointer hover:bg-slate-500/20' : ''
            } ${editingBaselineCell?.rowId === row.id && editingBaselineCell.field === 'start' ? 'z-50' : ''}`}
            onClick={() => {
              if (saveBaselineDate && setEditingBaselineCell) {
                setEditingBaselineCell({ rowId: row.id, field: 'start' });
              }
            }}
          >
            {editingBaselineCell?.rowId === row.id && editingBaselineCell.field === 'start' && saveBaselineDate ? (
              <GanttDatePickerPopover
                row={row}
                field="start"
                isBaseline={true}
                onSave={(val) => {
                  saveBaselineDate(row.id, 'start', val);
                  setEditingBaselineCell && setEditingBaselineCell(null);
                }}
                onClear={() => {
                  saveBaselineDate(row.id, 'start', '');
                  setEditingBaselineCell && setEditingBaselineCell(null);
                }}
                onClearBoth={row.baselineFinish ? () => {
                  saveBaselineDate(row.id, 'both', '');
                  setEditingBaselineCell && setEditingBaselineCell(null);
                } : undefined}
                onClose={() => setEditingBaselineCell && setEditingBaselineCell(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-1 w-full px-0.5 select-none" title={hasBaseStart ? `Baseline Start: ${row.baselineStart} (Klik untuk ubah / hapus)` : 'Belum di-set baseline start'}>
                <span className={`truncate flex-1 font-mono text-xs ${hasBaseStart ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-slate-400 dark:text-slate-500 font-normal'}`}>
                  {hasBaseStart ? row.baselineStart : '—'}
                </span>
                {hasBaseStart && saveBaselineDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveBaselineDate(row.id, 'start', '');
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Hapus baseline start (1-klik)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {!hasBaseStart && saveBaselineDate && (
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-sans text-slate-500 font-bold transition-opacity">
                    +Set
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'baseFinish': {
        const hasBaseFinish = !!row.baselineFinish;
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colBaseFinishWidth}px` }}
            className={`shrink-0 text-center font-mono text-xs truncate px-1 flex items-center justify-center h-full bg-slate-500/5 group relative ${
              saveBaselineDate ? 'cursor-pointer hover:bg-slate-500/20' : ''
            } ${editingBaselineCell?.rowId === row.id && editingBaselineCell.field === 'finish' ? 'z-50' : ''}`}
            onClick={() => {
              if (saveBaselineDate && setEditingBaselineCell) {
                setEditingBaselineCell({ rowId: row.id, field: 'finish' });
              }
            }}
          >
            {editingBaselineCell?.rowId === row.id && editingBaselineCell.field === 'finish' && saveBaselineDate ? (
              <GanttDatePickerPopover
                row={row}
                field="finish"
                isBaseline={true}
                onSave={(val) => {
                  saveBaselineDate(row.id, 'finish', val);
                  setEditingBaselineCell && setEditingBaselineCell(null);
                }}
                onClear={() => {
                  saveBaselineDate(row.id, 'finish', '');
                  setEditingBaselineCell && setEditingBaselineCell(null);
                }}
                onClearBoth={row.baselineStart ? () => {
                  saveBaselineDate(row.id, 'both', '');
                  setEditingBaselineCell && setEditingBaselineCell(null);
                } : undefined}
                onClose={() => setEditingBaselineCell && setEditingBaselineCell(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-1 w-full px-0.5 select-none" title={hasBaseFinish ? `Baseline Finish: ${row.baselineFinish} (Klik untuk ubah / hapus)` : 'Belum di-set baseline finish'}>
                <span className={`truncate flex-1 font-mono text-xs ${hasBaseFinish ? 'text-slate-700 dark:text-slate-300 font-bold' : 'text-slate-400 dark:text-slate-500 font-normal'}`}>
                  {hasBaseFinish ? row.baselineFinish : '—'}
                </span>
                {hasBaseFinish && saveBaselineDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveBaselineDate(row.id, 'finish', '');
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Hapus baseline finish (1-klik)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {!hasBaseFinish && saveBaselineDate && (
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-sans text-slate-500 font-bold transition-opacity">
                    +Set
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'pred':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
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
              <div className="flex items-center justify-center gap-1 select-none w-full relative">
                {row.predecessors && row.predecessors.length > 0 ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      let rowKey = '';
                      const pId = getProjectIdOfRow(row);
                      if (row.level === 0) rowKey = `p:${pId}`;
                      else if (row.level === 1) rowKey = `a:${pId}:${row.id}`;
                      else if (row.level === 2) rowKey = `t:${pId}:${row.parentAsmId}:${row.id}`;
                      if (rowKey) {
                        setDepPanelRowId(rowKey);
                        setDepPanelOpen(true);
                        setDepPanelSearch('');
                      }
                    }}
                    className={hasConflict
                      ? "text-red-600 dark:text-red-400 font-extrabold cursor-pointer truncate max-w-[65px] flex items-center justify-center gap-0.5 bg-red-500/20 border border-red-500/50 px-1 py-0.5 rounded text-[10px] animate-pulse"
                      : "text-blue-500 hover:text-blue-600 hover:underline font-bold cursor-pointer truncate max-w-[55px]"
                    }
                    title={hasConflict
                      ? `DEPENDENCY CONSTRAINT VIOLATION:\n${(rowConflicts || []).map(c => `• ${c.reason}`).join('\n')}`
                      : "Click to manage predecessors"
                    }
                  >
                    {hasConflict && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />}
                    {getPredecessorsLabel(row)}
                  </span>
                ) : (
                  <span className="text-base-muted/40 group-hover:hidden select-none">—</span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    let rowKey = '';
                    const pId = getProjectIdOfRow(row);
                    if (row.level === 0) rowKey = `p:${pId}`;
                    else if (row.level === 1) rowKey = `a:${pId}:${row.id}`;
                    else if (row.level === 2) rowKey = `t:${pId}:${row.parentAsmId}:${row.id}`;
                    if (rowKey) {
                      setDepPanelRowId(rowKey);
                      setDepPanelOpen(true);
                      setDepPanelSearch('');
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-base-muted hover:text-base-accent rounded cursor-pointer absolute right-1"
                  title="Manage dependencies"
                >
                  <Link className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );

      case 'pct':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colPctWidth}px` }}
            title={row.level === 2 && onUpdateProject ? `Klik untuk update progress (${Math.round(row.pct)}%)` : `${Math.round(row.pct)}% complete`}
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
              <div className="flex items-center justify-center relative w-full h-full">
                <CircularProgressBadge pct={row.pct} size={24} />
                {row.level === 2 && onUpdateProject && (
                  <span className="opacity-0 group-hover:opacity-100 text-[8px] transition-opacity select-none absolute right-0.5 top-0.5">✏️</span>
                )}
              </div>
            )}
          </div>
        );

      case 'status':
        return (
          <div
            key={`cell-${colId}-${row.id}`}
            style={{ width: `${colStatusWidth}px` }}
            className="shrink-0 text-center font-mono text-[10px] h-full flex items-center justify-center relative px-1"
          >
            {row.level === 2 ? (
              <div className="relative flex items-center justify-center w-full">
                <WorkflowStatusBadge
                  status={getEffectiveWorkflowStatus(row.workflowStatus, row.pct, row.done)}
                  isInteractive={!!onUpdateProject}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateProject) {
                      setStatusPopoverRowId(statusPopoverRowId === row.id ? null : row.id);
                    }
                  }}
                />

                {statusPopoverRowId === row.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusPopoverRowId(null);
                      }}
                    />
                    <div
                      className="absolute top-full mt-1 z-50 bg-base-surface border border-base-border rounded-lg shadow-xl p-1 flex flex-col gap-0.5 w-32 text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(['verify', 'on_track', 'delayed', 'complete', 'not_started'] as WorkflowStatusType[]).map((stKey) => {
                        const cfg = WORKFLOW_STATUS_CONFIG[stKey];
                        const isSelected = getEffectiveWorkflowStatus(row.workflowStatus, row.pct, row.done) === stKey;
                        return (
                          <button
                            key={stKey}
                            type="button"
                            onClick={() => {
                              saveWorkflowStatus(row.id, stKey);
                              setStatusPopoverRowId(null);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono font-bold transition-colors w-full ${
                              isSelected ? 'bg-base-accent/20 text-base-text font-extrabold' : 'hover:bg-base-surface3 text-base-muted hover:text-base-text'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotColor}`} />
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <WorkflowStatusBadge
                status={getEffectiveWorkflowStatus(undefined, row.pct, row.done)}
                isInteractive={false}
              />
            )}
          </div>
        );
    }
  };

  return (
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
        <div className="h-7 px-3 flex items-center justify-between text-xs font-bold text-base-text uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-base-text font-black tracking-wider">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-[10px] font-mono font-bold">P6</span>
              <span className="text-xs font-black">Activity Table</span>
            </span>
            <div className="w-[1px] h-3.5 bg-base-border mx-0.5" />
            <span className="text-[10px] font-normal text-base-muted hidden md:inline">Layout:</span>
            <button
              type="button"
              onClick={() => {
                setColumnOrder(P6_COLUMN_ORDER);
                try { localStorage.setItem('austin_gantt_column_order_v1', JSON.stringify(P6_COLUMN_ORDER)); } catch {}
              }}
              className="text-[10.5px] font-sans font-bold text-amber-600 dark:text-amber-400 hover:text-white hover:bg-amber-600 px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 transition-colors cursor-pointer"
              title="Aktifkan Kolom Standar Primavera P6 (Act ID, WBS, OD, RD, Total Float, Dates)"
            >
              Primavera P6
            </button>
            <button
              type="button"
              onClick={() => {
                setColumnOrder(STANDARD_COLUMN_ORDER);
                try { localStorage.setItem('austin_gantt_column_order_v1', JSON.stringify(STANDARD_COLUMN_ORDER)); } catch {}
              }}
              className="text-[10.5px] font-sans font-semibold text-base-muted hover:text-base-text px-2 py-0.5 rounded-md border border-base-border bg-base-surface transition-colors cursor-pointer"
              title="Tampilan Kolom Minimalis"
            >
              Standard
            </button>
            <button
              type="button"
              onClick={handleResetColumnOrder}
              className="text-[10.5px] font-sans font-semibold text-base-muted hover:text-base-accent px-2 py-0.5 rounded-md border border-base-border/60 hover:border-base-accent/50 bg-base-surface transition-colors cursor-pointer flex items-center gap-1"
              title="Kembalikan susunan kolom ke default"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-base-muted font-normal lowercase">
            <span className="hidden sm:inline">drag header untuk geser kolom</span>
            <Layers className="h-3.5 w-3.5 text-base-muted/70" />
          </div>
        </div>
        {/* Header row 2 */}
        <div className="h-7 flex text-xs font-bold text-base-muted uppercase tracking-wider items-center divide-x divide-base-border/30">
          {activeColumns.map(colId => renderColumnHeader(colId))}
        </div>
      </div>

      {/* Left Panel rows list (sync scrolls vertically via ref) */}
      <div
        ref={leftScrollRef}
        className="flex-1 overflow-y-hidden select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', width: `${totalTableWidth}px` }}
      >
        {topSpacerHeight > 0 && (
          <div style={{ height: `${topSpacerHeight}px` }} className="pointer-events-none shrink-0" aria-hidden="true" />
        )}
        {visibleRows.map((row, i) => {
          const idx = startIndex + i;
          const isSelected = selectedRowId === row.id;
          const isTargetHovered = dragHoverTargetRowId === row.id;
          const rowConflicts = dependencyViolationsMap.get(row.id);
          const hasConflict = rowConflicts && rowConflicts.length > 0;

          let bgClass = 'bg-base-surface hover:bg-base-surface2/50';
          if (isTargetHovered) bgClass = 'bg-green-500/20 text-green-800 dark:text-green-300 font-bold border-y-2 border-green-500 z-20';
          else if (hasConflict) bgClass = 'bg-red-500/15 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-l-4 border-l-red-500';
          else if (row.level === 0) bgClass = 'bg-base-accent-dim hover:bg-base-accent-dim/80';
          else if (row.level === 1) bgClass = 'bg-base-surface2 hover:bg-base-surface3/50';
          else if (idx % 2 === 1) bgClass = 'bg-base-surface2/30 hover:bg-base-surface2/75';

          if (!isTargetHovered && isSelected) bgClass = hasConflict ? 'bg-red-500/25 border-l-4 border-l-red-600 font-bold' : 'bg-base-accent-dim/60 font-semibold';

          return (
            <div
              key={`row-left-${row.id}-${idx}`}
              onClick={() => setSelectedRowId(row.id)}
              className={`h-8 flex text-xs font-semibold select-none items-center cursor-pointer transition-colors border-b border-base-border/20 divide-x divide-base-border/10 ${bgClass}`}
            >
              {activeColumns.map(colId => renderColumnCell(colId, row, idx, rowConflicts, !!hasConflict))}
            </div>
          );
        })}
        {bottomSpacerHeight > 0 && (
          <div style={{ height: `${bottomSpacerHeight}px` }} className="pointer-events-none shrink-0" aria-hidden="true" />
        )}

        {/* ── S-CURVE FEATURE SPACER ── */}
        {showSCurve && sCurvePaths && (
          <div
            className="flex-shrink-0 border-t border-base-border bg-base-surface3"
            style={{ height: `${SCURVE_H + 28}px`, width: `${totalTableWidth}px` }}
          >
            <div className="flex items-center h-6 px-3 border-b border-base-border">
              <span className="font-condensed font-bold text-[9px] uppercase tracking-widest text-base-muted">
                S-Curve Chart
              </span>
            </div>
          </div>
        )}

        {/* ── RESOURCE LOAD VIEW TABLE SECTION ── */}
        {showResourceLoad && resourceLoadData && (
          <div className="flex-shrink-0 border-t-2 border-base-border bg-base-surface3/80" style={{ width: `${totalTableWidth}px` }}>
            {/* Section Header Controls */}
            <div className="px-3 py-2 border-b border-base-border bg-base-surface flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="font-condensed font-extrabold text-xs uppercase tracking-wider text-base-text">
                    Resource Daily Man-Hours Load
                  </span>
                  <span className="text-[10px] text-base-muted font-mono font-bold px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border">
                    {resourceLoadData.totalResources} Employees
                  </span>
                </div>

                {resourceLoadData.totalOverloadedEmployees > 0 ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 text-[10px] font-mono font-extrabold animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span>{resourceLoadData.totalOverloadedEmployees} Overloaded ({resourceLoadData.totalConflictDaysOverall} Conflict Days)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>Optimal Capacity</span>
                  </div>
                )}
              </div>

              {/* Control Bar: Filters, Search, Capacity threshold */}
              <div className="flex items-center justify-between gap-2 text-[10px] font-sans">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setResourceFilter('all')}
                    className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] cursor-pointer transition-all ${
                      resourceFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-base-surface2 text-base-muted hover:text-base-text'
                    }`}
                  >
                    All Resources
                  </button>
                  <button
                    onClick={() => setResourceFilter('conflicts')}
                    className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] cursor-pointer transition-all flex items-center gap-1 ${
                      resourceFilter === 'conflicts'
                        ? 'bg-red-600 text-white shadow-xs font-black'
                        : 'bg-base-surface2 text-base-muted hover:text-red-500'
                    }`}
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    <span>Conflicts Only</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search box */}
                  <div className="relative flex items-center">
                    <Search className="h-3 w-3 absolute left-1.5 text-base-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search resource..."
                      value={resourceSearch}
                      onChange={e => setResourceSearch(e.target.value)}
                      className="pl-5 pr-2 py-0.5 text-[10px] bg-base-surface border border-base-border rounded focus:outline-none focus:border-indigo-500 w-28 text-base-text"
                    />
                  </div>

                  {/* Max Capacity threshold */}
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-base-muted">
                    <span>Max:</span>
                    <select
                      value={dailyCapacityLimit}
                      onChange={e => setDailyCapacityLimit(Number(e.target.value))}
                      className="bg-base-surface border border-base-border rounded px-1 py-0.5 text-[10px] text-base-text font-bold cursor-pointer"
                    >
                      <option value={8}>8h / day</option>
                      <option value={10}>10h / day</option>
                      <option value={12}>12h / day</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Resource Rows List */}
            {resourceLoadData.resourceList.length === 0 ? (
              <div className="p-4 text-center text-xs text-base-muted font-mono">
                No resources match current filter.
              </div>
            ) : (
              <div>
                {resourceLoadData.resourceList.map(emp => {
                  const isExpanded = expandedResources.has(emp.name);
                  const hasConflicts = emp.conflictDaysCount > 0;

                  return (
                    <React.Fragment key={`res-row-left-${emp.name}`}>
                      {/* Employee Main Row */}
                      <div className={`h-9 border-b border-base-border flex items-center px-2 gap-2 text-xs transition-colors ${
                        hasConflicts ? 'bg-red-500/10 dark:bg-red-950/20' : 'bg-base-surface hover:bg-base-surface2'
                      }`}>
                        <button
                          onClick={() => {
                            const next = new Set(expandedResources);
                            if (isExpanded) next.delete(emp.name);
                            else next.add(emp.name);
                            setExpandedResources(next);
                          }}
                          className="p-0.5 rounded hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer shrink-0"
                          title="Expand task breakdown"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>

                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-xs ${
                          hasConflicts ? 'bg-red-600' : 'bg-indigo-600'
                        }`}>
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-base-text text-xs truncate">{emp.name}</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-base-surface2 border border-base-border text-base-muted truncate">
                              {emp.company}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {hasConflicts ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[9px] flex items-center gap-1 font-mono shadow-xs animate-pulse">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{emp.conflictDaysCount} Overload Days</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[9px] font-mono border border-emerald-500/30">
                              OK ({emp.totalHours}h)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Task Breakdown Sub-rows */}
                      {isExpanded && emp.assignedTasks.map(t => (
                        <div key={`res-task-left-${emp.name}-${t.id}`} className="h-7 border-b border-base-border/60 bg-base-surface2/50 flex items-center pl-8 pr-2 gap-2 text-[11px] text-base-muted">
                          <span className="font-mono text-[10px] font-bold text-indigo-500 shrink-0">[{t.wbs}]</span>
                          <span className="truncate flex-1 font-medium text-base-text">{t.name}</span>
                          <span className="text-[9px] font-mono text-base-muted shrink-0">{t.start} → {t.finish}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
