import React from 'react';
import { Search, AlertTriangle, Clock, Link } from 'lucide-react';
import { Project } from '../types';
import { GanttRow, daysBetween, formatLocalDate, addDaysToLocalDate, parseLocalDate } from './useGanttRows';

export interface GanttTimelineProps {
  rightScrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  totalTimelineDays: number;
  pixelsPerDay: number;
  topHeaders: Array<{ label: string; width: number }>;
  bottomHeaders: Array<{ label: string; width: number; isWeekend?: boolean }>;
  weekendBands: Array<{ left: number; width: number }>;
  isTodayInTimeline: boolean;
  todayX: number;
  todayFormattedFull: string;
  visibleTasksCount: number;
  isFilterActive: boolean;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: any) => void;

  // Windowing & Rows
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  visibleRows: GanttRow[];
  startIndex: number;
  rows: GanttRow[];
  selectedRowId: string | null;
  setSelectedRowId: (id: string | null) => void;
  dragHoverTargetRowId: string | null;

  // Bar coordinates & features
  rowBarCoordsCache: Map<string, { left: number; width: number }>;
  showBaseline: boolean;
  rowBaselineCoordsCache: Map<string, { left: number; width: number }>;
  slackMap: Map<string, number>;
  showCriticalPath: boolean;
  criticalPathIds: Set<string>;
  criticalAssemblyIds: Set<string>;
  cascadedTaskIds: Set<string>;
  showProgress: boolean;
  showHoursTracking: boolean;
  dependencyViolationsMap: Map<string, any[]>;

  // Hover & Tooltips
  handleMouseEnter: (row: GanttRow, e: React.MouseEvent) => void;
  handleMouseLeave: () => void;

  // Interactions & Dragging
  onUpdateProject?: (project: Project) => void;
  connectMode: boolean;
  connectDraw: {
    sourceRowId: string;
    sourceX: number;
    sourceY: number;
    currentX: number;
    currentY: number;
  } | null;
  setConnectDraw: (val: any) => void;
  dragState: any;
  handleBarMouseDown: (row: GanttRow, mode: 'move' | 'resize' | 'resize-left', e: React.MouseEvent) => void;
  handleBarTouchStart: (row: GanttRow, mode: 'move' | 'resize' | 'resize-left', e: React.TouchEvent) => void;

  // Arrows & SVG dependencies
  arrows: Array<{
    id: string;
    sourceRowId: string;
    targetRowId: string;
    path: string;
    markerEnd: string;
    isCritical: boolean;
    isConflict?: boolean;
    sourceWbs: string;
    targetWbs: string;
    midX: number;
    midY: number;
  }>;
  hoveredArrowId: string | null;
  setHoveredArrowId: (id: string | null) => void;
  selectedArrowId: string | null;
  setSelectedArrowId: (id: string | null) => void;
  handleDeleteDependencyArrow: (targetRowId: string, sourceRowId: string) => void;

  // S-Curve Overlay
  showSCurve: boolean;
  sCurvePaths: any;
  SCURVE_H: number;
  sCurveData: any[];
  timelineStart: Date;

  // Resource Load View Grid
  showResourceLoad: boolean;
  resourceLoadData: any;
  dailyCapacityLimit: number;
  expandedResources: Set<string>;
  setHoveredResourceCell: (val: any) => void;
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({
  rightScrollRef,
  handleScroll,
  totalTimelineDays,
  pixelsPerDay,
  topHeaders,
  bottomHeaders,
  weekendBands,
  isTodayInTimeline,
  todayX,
  todayFormattedFull,
  visibleTasksCount,
  isFilterActive,
  setSearchQuery,
  setStatusFilter,

  topSpacerHeight,
  bottomSpacerHeight,
  visibleRows,
  startIndex,
  rows,
  selectedRowId,
  setSelectedRowId,
  dragHoverTargetRowId,

  rowBarCoordsCache,
  showBaseline,
  rowBaselineCoordsCache,
  slackMap,
  showCriticalPath,
  criticalPathIds,
  criticalAssemblyIds,
  cascadedTaskIds,
  showProgress,
  showHoursTracking,
  dependencyViolationsMap,

  handleMouseEnter,
  handleMouseLeave,

  onUpdateProject,
  connectMode,
  connectDraw,
  setConnectDraw,
  dragState,
  handleBarMouseDown,
  handleBarTouchStart,

  arrows,
  hoveredArrowId,
  setHoveredArrowId,
  selectedArrowId,
  setSelectedArrowId,
  handleDeleteDependencyArrow,

  showSCurve,
  sCurvePaths,
  SCURVE_H,
  sCurveData,
  timelineStart,

  showResourceLoad,
  resourceLoadData,
  dailyCapacityLimit,
  expandedResources,
  setHoveredResourceCell,
}) => {
  return (
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
            <>
              {topSpacerHeight > 0 && (
                <div style={{ height: `${topSpacerHeight}px` }} className="pointer-events-none" aria-hidden="true" />
              )}
              {visibleRows.map((row, i) => {
                const idx = startIndex + i;
                const isSelected = selectedRowId === row.id;
                const isTargetHovered = dragHoverTargetRowId === row.id;
                const barCoords = rowBarCoordsCache.get(row.id);
                const baselineCoords = showBaseline ? rowBaselineCoordsCache.get(row.id) : null;
                const slackValue = slackMap.get(row.id) ?? 999;
                const hasEarlyWarning = showCriticalPath && row.level === 2 && !criticalPathIds.has(row.id) && slackValue >= 0 && slackValue <= 1;

                let hoverClass = 'hover:bg-base-surface2/50';
                if (row.level === 0) hoverClass = 'hover:bg-base-accent-dim/80';
                else if (row.level === 1) hoverClass = 'hover:bg-base-surface3/50';

                return (
                  <div
                    key={`timeline-row-${row.id}-${idx}`}
                    onClick={() => setSelectedRowId(row.id)}
                    className={`h-8 relative select-none border-b border-base-border/20 cursor-pointer transition-colors ${hoverClass} ${
                      isTargetHovered ? 'bg-green-500/25 border-y-2 border-green-500 z-20 font-bold' : isSelected ? 'bg-base-accent-dim/40' : ''
                    }`}
                    style={{ height: '32px' }}
                  >
                    {/* Baseline Bar (Fixed target schedule, read-only and non-draggable) */}
                    {baselineCoords && (
                      <div
                        className="absolute select-none pointer-events-none z-10"
                        style={{
                          left: `${baselineCoords.left}px`,
                          width: `${row.isMilestone ? 14 : Math.max(8, baselineCoords.width)}px`,
                          bottom: row.level === 0 ? '1px' : '2px',
                          height: row.level === 0 ? '5px' : '6px',
                        }}
                        title={`Baseline: ${row.baselineStart} → ${row.baselineFinish || row.baselineStart}`}
                      >
                        {row.isMilestone ? (
                          <div className="w-3.5 h-3.5 bg-slate-500/80 border border-slate-600 rotate-45 mx-auto" />
                        ) : (
                          <div
                            className="w-full h-full rounded-xs bg-slate-400/50 dark:bg-slate-500/50 border border-slate-500/70 dark:border-slate-400/60 shadow-2xs"
                            style={{
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(100,116,139,0.25) 3px, rgba(100,116,139,0.25) 6px)'
                            }}
                          />
                        )}
                      </div>
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
                        {/* Target hover indicator on bar */}
                        {isTargetHovered && (
                          <div
                            className="absolute -left-1 z-30 w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-md animate-ping pointer-events-none"
                          />
                        )}

                        {/* Connector Nodes for Draw-to-Connect dependency arrows */}
                        {onUpdateProject && (
                          <>
                            {/* Left Start Node Handle */}
                            <div
                              data-export-hide="true"
                              className={`absolute -left-2 z-30 w-3 h-3 rounded-full bg-blue-500 hover:bg-blue-400 border-2 border-white dark:border-slate-800 shadow-md cursor-crosshair transition-all duration-150 flex items-center justify-center ${
                                connectMode ? 'opacity-100 animate-pulse scale-110' : 'opacity-0 group-hover:opacity-100 hover:scale-125'
                              }`}
                              title={`Drag from Start of ${row.name} to connect`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const container = document.querySelector('.gantt-relative-container');
                                if (container) {
                                  const rect = container.getBoundingClientRect();
                                  const sourceRowIdx = rows.findIndex(r => r.id === row.id);
                                  const startX = barCoords ? barCoords.left : (e.clientX - rect.left);
                                  const startY = sourceRowIdx >= 0 ? (sourceRowIdx * 32 + 16) : (e.clientY - rect.top - 56);

                                  setConnectDraw({
                                    sourceRowId: row.id,
                                    sourceX: startX,
                                    sourceY: startY,
                                    currentX: e.clientX - rect.left,
                                    currentY: e.clientY - rect.top - 56
                                  });
                                }
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.touches.length === 0) return;
                                const touch = e.touches[0];
                                const container = document.querySelector('.gantt-relative-container');
                                if (container) {
                                  const rect = container.getBoundingClientRect();
                                  const sourceRowIdx = rows.findIndex(r => r.id === row.id);
                                  const startX = barCoords ? barCoords.left : (touch.clientX - rect.left);
                                  const startY = sourceRowIdx >= 0 ? (sourceRowIdx * 32 + 16) : (touch.clientY - rect.top - 56);

                                  setConnectDraw({
                                    sourceRowId: row.id,
                                    sourceX: startX,
                                    sourceY: startY,
                                    currentX: touch.clientX - rect.left,
                                    currentY: touch.clientY - rect.top - 56
                                  });
                                }
                              }}
                            >
                              <div className="w-1 h-1 bg-white rounded-full pointer-events-none" />
                            </div>

                            {/* Right Finish Node Handle */}
                            <div
                              data-export-hide="true"
                              className={`absolute -right-2 z-30 w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-400 border-2 border-white dark:border-slate-800 shadow-md cursor-crosshair transition-all duration-150 flex items-center justify-center ${
                                connectMode ? 'opacity-100 animate-pulse scale-110' : 'opacity-0 group-hover:opacity-100 hover:scale-125'
                              }`}
                              title={`Drag from Finish of ${row.name} to connect`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const container = document.querySelector('.gantt-relative-container');
                                if (container) {
                                  const rect = container.getBoundingClientRect();
                                  const sourceRowIdx = rows.findIndex(r => r.id === row.id);
                                  const startX = barCoords ? (barCoords.left + (row.isMilestone ? 20 : Math.max(12, barCoords.width))) : (e.clientX - rect.left);
                                  const startY = sourceRowIdx >= 0 ? (sourceRowIdx * 32 + 16) : (e.clientY - rect.top - 56);

                                  setConnectDraw({
                                    sourceRowId: row.id,
                                    sourceX: startX,
                                    sourceY: startY,
                                    currentX: e.clientX - rect.left,
                                    currentY: e.clientY - rect.top - 56
                                  });
                                }
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                if (e.touches.length === 0) return;
                                const touch = e.touches[0];
                                const container = document.querySelector('.gantt-relative-container');
                                if (container) {
                                  const rect = container.getBoundingClientRect();
                                  const sourceRowIdx = rows.findIndex(r => r.id === row.id);
                                  const startX = barCoords ? (barCoords.left + (row.isMilestone ? 20 : Math.max(12, barCoords.width))) : (touch.clientX - rect.left);
                                  const startY = sourceRowIdx >= 0 ? (sourceRowIdx * 32 + 16) : (touch.clientY - rect.top - 56);

                                  setConnectDraw({
                                    sourceRowId: row.id,
                                    sourceX: startX,
                                    sourceY: startY,
                                    currentX: touch.clientX - rect.left,
                                    currentY: touch.clientY - rect.top - 56
                                  });
                                }
                              }}
                            >
                              <div className="w-1 h-1 bg-white rounded-full pointer-events-none" />
                            </div>
                          </>
                        )}

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
                        {row.level === 2 && !row.isMilestone && (() => {
                          const rowConflicts = dependencyViolationsMap.get(row.id);
                          const hasConflict = rowConflicts && rowConflicts.length > 0;

                          return (
                            <div
                              className={`w-full h-4.5 rounded relative overflow-hidden flex items-center select-none text-[9px] font-bold text-white transition-all shadow-xs border ${
                                hasConflict
                                  ? 'bg-red-600 border-2 border-red-500 ring-2 ring-red-500/60 shadow-md animate-pulse'
                                  : cascadedTaskIds.has(row.id)
                                    ? 'border-2 border-amber-400 ring-2 ring-amber-400/40 ring-offset-0 animate-[pulse_0.6s_ease-in-out_3] bg-amber-500'
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

                              {/* AUTO-SCHEDULE FEATURE SHIFTED LABEL */}
                              {cascadedTaskIds.has(row.id) && !hasConflict && (
                                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-amber-900 uppercase tracking-widest pointer-events-none z-10">
                                  ↕ shifted
                                </span>
                              )}

                              {/* Task name inside label if wide enough */}
                              {barCoords.width > 80 && (
                                <span className={`relative z-10 truncate select-none leading-none px-2 pointer-events-none pr-8 ${row.pct === 100 ? 'line-through opacity-75' : ''}`}>
                                  {row.pct === 100 ? `✓ — ${row.name}` : row.name} ({row.pct}%)
                                </span>
                              )}

                              {/* Critical Path Indicator Badge inside bar */}
                              {showCriticalPath && criticalPathIds.has(row.id) && !row.done && !hasConflict && barCoords.width > 40 && (
                                <span className="absolute right-2.5 text-[7px] bg-white/20 px-1 rounded-sm text-white select-none pointer-events-none z-10 uppercase tracking-wider font-extrabold font-mono">
                                  CP
                                </span>
                              )}

                              {/* Hard Dependency Conflict Badge */}
                              {hasConflict && (
                                <span
                                  className="absolute right-1 text-[7.5px] bg-red-950/90 text-white border border-red-300 px-1 rounded flex items-center gap-0.5 select-none pointer-events-none z-20 uppercase font-mono font-black animate-pulse"
                                  title={rowConflicts.map(c => c.reason).join('\n')}
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 text-red-300 fill-red-600 shrink-0" />
                                  <span>CONFLICT</span>
                                </span>
                              )}

                              {/* Live Date Tooltip Badge while dragging */}
                              {dragState && dragState.rowId === row.id && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-30 font-bold border border-slate-700 dark:border-slate-300">
                                  {dragState.tempStart || row.start} → {dragState.tempFinish || row.finish}
                                </div>
                              )}

                              {/* Left edge drag resize handle */}
                              {onUpdateProject && (
                                <div
                                  data-export-hide="true"
                                  className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-white/40 cursor-col-resize z-20 print:hidden rounded-l"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleBarMouseDown(row, 'resize-left', e);
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    handleBarTouchStart(row, 'resize-left', e);
                                  }}
                                  title="Drag to adjust start date"
                                />
                              )}

                              {/* Right edge drag resize handle */}
                              {onUpdateProject && (
                                <div
                                  data-export-hide="true"
                                  className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-white/40 cursor-col-resize z-20 print:hidden rounded-r"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleBarMouseDown(row, 'resize', e);
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    handleBarTouchStart(row, 'resize', e);
                                  }}
                                  title="Drag to adjust end date"
                                />
                              )}
                            </div>
                          );
                        })()}

                        {/* Milestone Diamond shape */}
                        {row.isMilestone && (() => {
                          const rowConflicts = dependencyViolationsMap.get(row.id);
                          const hasConflict = rowConflicts && rowConflicts.length > 0;
                          return (
                            <div
                              className={`w-3.5 h-3.5 rotate-45 transform border shadow-xs flex items-center justify-center shrink-0 -ml-1.5 z-20 cursor-move ${
                                hasConflict
                                  ? 'bg-red-600 border-red-300 ring-2 ring-red-500/60 animate-pulse'
                                  : 'bg-yellow-500 dark:bg-yellow-400 border-white/40'
                              }`}
                              onMouseDown={(e) => handleBarMouseDown(row, 'move', e)}
                              title={hasConflict ? `Milestone Dependency Conflict:\n${rowConflicts.map(c => c.reason).join('\n')}` : "Drag milestone to shift target date"}
                            />
                          );
                        })()}

                        {/* Resource Labels & Hours Tracking shown to the right of the bar */}
                        {!row.isMilestone && (
                          <div className="absolute left-[calc(100%+8px)] whitespace-nowrap text-[10px] z-10 pointer-events-none flex items-center gap-1.5">
                            {row.assigned && (
                              <span className="font-semibold text-base-muted bg-base-surface/80 px-1.5 py-0.5 rounded border border-base-border/30 backdrop-blur-[2px]">
                                {row.assigned}
                              </span>
                            )}
                            {showHoursTracking && (row.planHours > 0 || row.actualHours > 0) && (
                              <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-[2px] ${
                                row.actualHours > row.planHours
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                                  : row.actualHours > 0
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                    : 'bg-base-surface/80 text-base-muted border-base-border/30'
                              }`}>
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span>{row.actualHours.toFixed(0)}h / {row.planHours.toFixed(0)}h</span>
                                {row.actualHours > row.planHours && (
                                  <span className="text-[7.5px] font-black uppercase text-red-500 bg-red-500/20 px-1 rounded">OVER</span>
                                )}
                              </span>
                            )}
                          </div>
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
              })}
              {bottomSpacerHeight > 0 && (
                <div style={{ height: `${bottomSpacerHeight}px` }} className="pointer-events-none" aria-hidden="true" />
              )}
            </>
          )}

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
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6b7280" />
              </marker>
              <marker
                id="arrow-critical"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
              </marker>
              <marker
                id="arrow-conflict"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
              </marker>
              <marker
                id="arrow-hover"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6" />
              </marker>
            </defs>

            {arrows.map((arr) => {
              const isHovered = hoveredArrowId === arr.id;
              const isSelected = selectedArrowId === arr.id;
              const showNodeBadge = connectMode || isHovered || isSelected || arr.isConflict;

              return (
                <g key={`arrow-group-${arr.id}`}>
                  {/* Thick invisible hit path for easy interaction */}
                  <path
                    d={arr.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    className="pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setHoveredArrowId(arr.id)}
                    onMouseLeave={() => setHoveredArrowId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArrowId(selectedArrowId === arr.id ? null : arr.id);
                    }}
                  />

                  {/* Visible Arrow Line */}
                  <path
                    d={arr.path}
                    fill="none"
                    stroke={
                      isHovered || isSelected
                        ? '#3b82f6'
                        : arr.isConflict
                          ? '#dc2626'
                          : arr.isCritical
                            ? '#ef4444'
                            : '#6b7280'
                    }
                    strokeWidth={
                      isHovered || isSelected
                        ? 3
                        : arr.isConflict
                          ? 2.5
                          : arr.isCritical
                            ? 2
                            : 1.5
                    }
                    strokeDasharray={arr.isConflict ? '5,3' : (isHovered ? '4,3' : undefined)}
                    markerEnd={
                      isHovered || isSelected
                        ? 'url(#arrow-hover)'
                        : arr.markerEnd
                    }
                    className="transition-all duration-200 pointer-events-none"
                    opacity={isHovered || isSelected ? 1 : arr.isCritical ? 1 : 0.85}
                  />

                  {/* Interactive Removal Node Badge at Line Midpoint */}
                  {showNodeBadge && (
                    <foreignObject
                      x={arr.midX - 52}
                      y={arr.midY - 12}
                      width={104}
                      height={26}
                      className="pointer-events-auto overflow-visible z-50"
                    >
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDependencyArrow(arr.targetRowId, arr.sourceRowId);
                          }}
                          className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md border border-white/40 flex items-center gap-1 cursor-pointer transition-all hover:scale-110 whitespace-nowrap"
                          title={`Click to remove link: ${arr.sourceWbs} → ${arr.targetWbs}`}
                        >
                          <Link className="h-2.5 w-2.5 rotate-45" />
                          <span>{arr.sourceWbs}➔{arr.targetWbs}</span>
                          <span className="bg-red-800 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black ml-0.5">✕</span>
                        </button>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Live Rubber-Band Connection Line */}
            {connectDraw && (
              <path
                d={`M ${connectDraw.sourceX} ${connectDraw.sourceY} L ${connectDraw.currentX} ${connectDraw.currentY}`}
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeDasharray="4,4"
                markerEnd="url(#arrow-right)"
              />
            )}
          </svg>
        </div>

        {/* ── S-CURVE OVERLAY ── */}
        {showSCurve && sCurvePaths && (
          <div
            className="relative border-t border-base-border bg-base-surface2 flex-shrink-0"
            style={{ height: `${SCURVE_H + 28}px`, width: `${sCurvePaths.totalWidth}px` }}
          >
            {/* Labels row */}
            <div className="absolute top-0 left-0 right-0 flex items-center gap-3 px-3 h-6 border-b border-base-border bg-base-surface z-10">
              <span className="font-condensed font-extrabold text-[9px] uppercase tracking-widest text-base-muted">
                S-Curve
              </span>
              {/* Planned legend */}
              <span className="flex items-center gap-1 text-[9px] text-base-muted">
                <svg width="18" height="4" aria-hidden="true">
                  <line x1="0" y1="2" x2="18" y2="2" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 2" />
                </svg>
                Planned
              </span>
              {/* Actual legend */}
              <span className="flex items-center gap-1 text-[9px] text-base-muted">
                <svg width="18" height="4" aria-hidden="true">
                  <line x1="0" y1="2" x2="18" y2="2" stroke="var(--green)" strokeWidth="2" />
                </svg>
                Actual
              </span>
              {/* Live pct readout */}
              {(() => {
                const lastPt = sCurveData?.[sCurveData.length - 1];
                if (!lastPt) return null;
                const diff = lastPt.actual - lastPt.planned;
                const color = diff >= 0 ? 'var(--green)' : 'var(--red)';
                const label = diff >= 0
                  ? `+${diff.toFixed(1)}% ahead`
                  : `${diff.toFixed(1)}% behind`;
                return (
                  <span className="ml-auto text-[9px] font-condensed font-black" style={{ color }}>
                    {label}
                  </span>
                );
              })()}
            </div>

            {/* SVG chart area */}
            <svg
              width={sCurvePaths.totalWidth}
              height={SCURVE_H}
              viewBox={`0 0 ${sCurvePaths.totalWidth} ${SCURVE_H}`}
              className="absolute bottom-0 left-0"
              style={{ overflow: 'visible' }}
              aria-label="S-Curve planned vs actual progress"
              role="img"
            >
              {/* Horizontal grid lines at 25%, 50%, 75%, 100% */}
              {[25, 50, 75, 100].map(pct => {
                const y = SCURVE_H - (pct / 100) * (SCURVE_H - 4) - 2;
                return (
                  <g key={pct}>
                    <line
                      x1={0} y1={y}
                      x2={sCurvePaths.totalWidth} y2={y}
                      stroke="var(--border)" strokeWidth="0.5"
                    />
                    <text
                      x={4} y={y - 2}
                      fontSize="7" fill="var(--muted)"
                      fontFamily="var(--font-condensed, sans-serif)"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {/* Today vertical line */}
              {(() => {
                const todayD = daysBetween(timelineStart, new Date());
                if (todayD < 0 || todayD > sCurvePaths.totalDays) return null;
                const tx = todayD * pixelsPerDay;
                return (
                  <line
                    x1={tx} y1={0} x2={tx} y2={SCURVE_H}
                    stroke="var(--red)" strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                );
              })()}

              {/* Planned path (dashed blue/accent) */}
              {sCurvePaths.plannedPath && (
                <path
                  d={sCurvePaths.plannedPath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                />
              )}

              {/* Actual path (solid green) */}
              {sCurvePaths.actualPath && (
                <path
                  d={sCurvePaths.actualPath}
                  fill="none"
                  stroke="var(--green)"
                  strokeWidth="2.5"
                />
              )}

              {/* Variance indicator at Today */}
              {(() => {
                const todayD = Math.max(0, Math.min(
                  sCurvePaths.totalDays,
                  daysBetween(timelineStart, new Date())
                ));
                const todayPt = sCurveData?.find(p => p.day >= todayD);
                if (!todayPt) return null;
                const tx = todayD * pixelsPerDay;
                const py = SCURVE_H - (todayPt.planned / 100) * (SCURVE_H - 4) - 2;
                const ay = SCURVE_H - (todayPt.actual / 100) * (SCURVE_H - 4) - 2;
                const isAhead = todayPt.actual >= todayPt.planned;
                return (
                  <g>
                    {/* Vertical variance line */}
                    <line
                      x1={tx} y1={Math.min(py, ay)}
                      x2={tx} y2={Math.max(py, ay)}
                      stroke={isAhead ? 'var(--green)' : 'var(--red)'}
                      strokeWidth="2"
                      strokeDasharray="2 2"
                    />
                    {/* Dot on planned */}
                    <circle cx={tx} cy={py} r="3" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
                    {/* Dot on actual */}
                    <circle cx={tx} cy={ay} r="3" fill="var(--green)" stroke="var(--surface)" strokeWidth="1.5" />
                  </g>
                );
              })()}
            </svg>
          </div>
        )}

        {/* ── RESOURCE LOAD VIEW TIMELINE GRID ── */}
        {showResourceLoad && resourceLoadData && (
          <div className="relative border-t-2 border-base-border bg-base-surface flex-shrink-0" style={{ width: `${totalTimelineDays * pixelsPerDay}px` }}>
            {/* Section Header Spacer */}
            <div className="h-[61px] border-b border-base-border bg-base-surface2/80 flex items-center px-4">
              <span className="font-condensed font-extrabold text-[10px] uppercase tracking-widest text-base-muted flex items-center gap-2">
                <span>Daily Allocated Man-Hours Grid</span>
                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  ■ 8h (Optimal)
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  ■ &gt;8h (Conflict Overload)
                </span>
              </span>
            </div>

            {/* Resource Rows Grid */}
            {resourceLoadData.resourceList.map(emp => {
              const isExpanded = expandedResources.has(emp.name);
              const hasConflicts = emp.conflictDaysCount > 0;

              return (
                <React.Fragment key={`res-row-right-${emp.name}`}>
                  {/* Main Employee Daily Cell Row */}
                  <div className={`h-9 border-b border-base-border flex ${hasConflicts ? 'bg-red-500/5' : 'bg-base-surface'}`}>
                    {Array.from({ length: totalTimelineDays + 1 }).map((_, dIdx) => {
                      const hours = emp.dailyHours[dIdx];
                      const isOver = hours > dailyCapacityLimit;
                      const isOptimal = hours === dailyCapacityLimit;
                      const isUnder = hours > 0 && hours < dailyCapacityLimit;

                      const currentDateStr = addDaysToLocalDate(formatLocalDate(timelineStart), dIdx);

                      return (
                        <div
                          key={`res-cell-${emp.name}-${dIdx}`}
                          style={{ width: `${pixelsPerDay}px` }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredResourceCell({
                              employeeName: emp.name,
                              dayIdx: dIdx,
                              dateStr: currentDateStr,
                              totalHours: hours,
                              tasks: emp.dailyTasks.get(dIdx) || [],
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8
                            });
                          }}
                          onMouseLeave={() => setHoveredResourceCell(null)}
                          className={`h-full border-r border-base-border/40 flex items-center justify-center font-mono text-[10px] transition-all cursor-pointer select-none ${
                            isOver
                              ? 'bg-red-500/30 text-red-700 dark:text-red-300 font-black border-y-2 border-red-500/60 shadow-xs hover:bg-red-500/50 hover:scale-105 z-10'
                              : isOptimal
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border-y border-emerald-500/30 hover:bg-emerald-500/30'
                                : isUnder
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold hover:bg-blue-500/25'
                                  : 'text-base-muted/20 hover:bg-base-surface3/40'
                          }`}
                        >
                          {hours > 0 ? (
                            <span className={`px-1 py-0.2 rounded ${isOver ? 'bg-red-600 text-white font-black' : ''}`}>
                              {hours}h
                            </span>
                          ) : (
                            <span>·</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Sub-rows for tasks when expanded */}
                  {isExpanded && emp.assignedTasks.map(t => {
                    const taskStartD = parseLocalDate(t.start);
                    const taskFinishD = parseLocalDate(t.finish);
                    const taskStartIdx = daysBetween(timelineStart, taskStartD);
                    const taskFinishIdx = daysBetween(timelineStart, taskFinishD);

                    return (
                      <div key={`res-task-right-${emp.name}-${t.id}`} className="h-7 border-b border-base-border/60 bg-base-surface2/30 flex">
                        {Array.from({ length: totalTimelineDays + 1 }).map((_, dIdx) => {
                          const isActive = dIdx >= taskStartIdx && dIdx <= taskFinishIdx;

                          return (
                            <div
                              key={`res-task-cell-${t.id}-${dIdx}`}
                              style={{ width: `${pixelsPerDay}px` }}
                              className={`h-full border-r border-base-border/30 flex items-center justify-center font-mono text-[9px] ${
                                isActive
                                  ? 'bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold border-y border-indigo-500/40'
                                  : 'text-transparent'
                              }`}
                              title={isActive ? `${t.name} (8h)` : ''}
                            >
                              {isActive ? '8h' : ''}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
