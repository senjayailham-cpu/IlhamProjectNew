import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
  Filter
} from 'lucide-react';
import { normalizePosition, CRAFT_COLORS } from '../utils/manpowerUtils';
import { TimesheetEntry, Employee, Project } from '../types/index';

interface ManpowerBoardViewProps {
  timesheets: TimesheetEntry[];
  employees:  Employee[];
  projects:   Project[];
  initialDate?: string;
}

export default function ManpowerBoardView({
  timesheets,
  employees,
  projects,
  initialDate
}: ManpowerBoardViewProps) {
  const [selectedDate, setSelectedDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [activeSubTab, setActiveSubTab] = useState<'allocations' | 'available'>('allocations');
  const [selectedCraft, setSelectedCraft] = useState<string>('All');

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
    // Build employee lookup
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Filter: only this date, only present/late (on-site)
    const dayEntries = timesheets.filter(t => {
      const isDateAndOnsite = t.date === selectedDate && (t.status === 'present' || t.status === 'late');
      if (!isDateAndOnsite) return false;
      if (selectedCraft === 'All') return true;
      const emp = empMap.get(t.empId);
      const craft = normalizePosition(emp?.position);
      return craft === selectedCraft;
    });

    // Group by workOrder
    const projectMap = new Map<string, {
      project: Project | null;
      crafts: Map<string, {
        workers: { empId: string; empName: string; hours: number; status: string }[];
      }>;
      totalWorkers: number;
      totalHours: number;
    }>();

    dayEntries.forEach(t => {
      const wo = (t.workOrder && t.workOrder.trim() ? t.workOrder.trim() : 'Unassigned');
      const emp = empMap.get(t.empId);
      const craft = normalizePosition(emp?.position);
      
      const project = projects.find(
        p => (p.client || '').trim().toLowerCase() === wo.toLowerCase()
      ) || null;

      if (!projectMap.has(wo)) {
        projectMap.set(wo, {
          project,
          crafts: new Map(),
          totalWorkers: 0,
          totalHours: 0,
        });
      }

      const pg = projectMap.get(wo)!;

      if (!pg.crafts.has(craft)) {
        pg.crafts.set(craft, { workers: [] });
      }

      const cg = pg.crafts.get(craft)!;
      // Avoid duplicate worker in same craft (safety check)
      if (!cg.workers.find(w => w.empId === t.empId)) {
        cg.workers.push({
          empId:   t.empId,
          empName: t.empName,
          hours:   t.totalHours,
          status:  t.status,
        });
        pg.totalWorkers++;
        pg.totalHours += t.totalHours;
      }
    });

    // Convert to array sorted by totalWorkers desc
    return Array.from(projectMap.entries())
      .map(([wo, data]) => ({
        workOrder: wo,
        project: data.project,
        crafts: Array.from(data.crafts.entries())
          .map(([craft, { workers }]) => ({
            craft,
            workers: workers.sort((a, b) => b.hours - a.hours),
            count: workers.length,
            totalHours: workers.reduce((s, w) => s + w.hours, 0),
            color: CRAFT_COLORS[craft] || CRAFT_COLORS.Other,
          }))
          .sort((a, b) => b.count - a.count), // most workers first
        totalWorkers: data.totalWorkers,
        totalHours: data.totalHours,
      }))
      .sort((a, b) => b.totalWorkers - a.totalWorkers);
  }, [timesheets, employees, projects, selectedDate, selectedCraft]);

  // Compute Available / Unassigned Labor Data
  const availableLaborData = useMemo(() => {
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Find all timesheet entries for today
    const dayEntries = timesheets.filter(t => t.date === selectedDate);
    const loggedEmpIds = new Set(dayEntries.map(t => t.empId));

    // 1. On-site but Unassigned
    // Logged as present/late, but with blank or 'Unassigned' workOrder
    const onSiteUnassigned = dayEntries
      .filter(t => 
        (t.status === 'present' || t.status === 'late') && 
        (!t.workOrder || t.workOrder.trim() === '' || t.workOrder.trim().toLowerCase() === 'unassigned')
      )
      .map(t => {
        const emp = empMap.get(t.empId);
        return {
          empId: t.empId,
          empName: t.empName,
          status: t.status,
          hours: t.totalHours,
          position: emp?.position || 'Other',
          craft: normalizePosition(emp?.position)
        };
      })
      .filter(w => selectedCraft === 'All' || w.craft === selectedCraft);

    // 2. Off-site / Not Logged Today
    // Employees who don't have any timesheet entry for today
    const unlogged = employees
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

    // Group both categories by craft
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

  // Summary totals
  const summary = useMemo(() => {
    const totalOnSite = boardData.reduce((s, p) => s + p.totalWorkers, 0);
    const totalHours  = boardData.reduce((s, p) => s + p.totalHours, 0);
    const craftTotals = new Map<string, number>();
    boardData.forEach(p => {
      p.crafts.forEach(c => {
        craftTotals.set(c.craft, (craftTotals.get(c.craft) || 0) + c.count);
      });
    });
    return { totalOnSite, totalHours, craftTotals };
  }, [boardData]);

  // Available labor totals
  const availableSummary = useMemo(() => {
    const onSiteUnassignedCount = availableLaborData.reduce((s, c) => s + c.onSiteUnassigned.length, 0);
    const unloggedCount = availableLaborData.reduce((s, c) => s + c.unlogged.length, 0);
    return { onSiteUnassignedCount, unloggedCount, total: onSiteUnassignedCount + unloggedCount };
  }, [availableLaborData]);

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
          </div>
        </div>
      </div>

      {/* View Sub-Tabs */}
      <div className="flex border-b border-base-border bg-base-surface px-6">
        <button
          onClick={() => setActiveSubTab('allocations')}
          className={`px-4 py-2 text-xs font-condensed font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'allocations'
              ? 'border-base-accent text-base-accent'
              : 'border-transparent text-base-muted hover:text-base-text'
          }`}
        >
          Project Allocations ({boardData.length})
        </button>
        <button
          onClick={() => setActiveSubTab('available')}
          className={`px-4 py-2 text-xs font-condensed font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'available'
              ? 'border-base-accent text-base-accent'
              : 'border-transparent text-base-muted hover:text-base-text'
          }`}
        >
          Available Labor ({availableSummary.total})
        </button>
      </div>

      {activeSubTab === 'allocations' ? (
        <>
          {/* Summary strip */}
          <div className="flex items-center gap-6 px-6 py-3 bg-base-surface2 border-b border-base-border flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-base-muted" />
              <span className="text-sm font-condensed font-bold text-base-text">
                {summary.totalOnSite}
              </span>
              <span className="text-xs text-base-muted">{selectedCraft !== 'All' ? `${selectedCraft}s` : 'workers'} on site</span>
            </div>
            <div className="w-px h-4 bg-base-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-base-muted" />
              <span className="text-sm font-condensed font-bold text-base-text">
                {summary.totalHours}h
              </span>
              <span className="text-xs text-base-muted">logged</span>
            </div>
            <div className="w-px h-4 bg-base-border hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {Array.from(summary.craftTotals.entries())
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
                    <span className="font-condensed font-bold text-base-text">{count}</span>
                    <span className="text-base-muted">{craft}</span>
                  </span>
                ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-base-muted">{boardData.length} projects active</span>
            </div>
          </div>

          {/* Content Area */}
          {boardData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20 animate-fade-in">
              <Users className="h-14 w-14 text-base-muted opacity-20" />
              <p className="font-condensed font-bold text-base-muted uppercase tracking-widest text-sm">
                No matching allocations found
              </p>
              <p className="text-xs text-base-muted">
                {selectedCraft !== 'All' 
                  ? `No ${selectedCraft}s are allocated on ${selectedDate}.`
                  : `No attendance logged for ${selectedDate}.`
                }
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {boardData.map(pd => (
                  <ProjectAllocationCard key={pd.workOrder} data={pd} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Available summary strip */}
          <div className="flex items-center gap-6 px-6 py-3 bg-base-surface2 border-b border-base-border flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-base-green animate-pulse" />
              <span className="text-sm font-condensed font-bold text-base-text">
                {availableSummary.onSiteUnassignedCount}
              </span>
              <span className="text-xs text-base-muted">On-Site & Unassigned</span>
            </div>
            <div className="w-px h-4 bg-base-border" />
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-base-muted" />
              <span className="text-sm font-condensed font-bold text-base-text">
                {availableSummary.unloggedCount}
              </span>
              <span className="text-xs text-base-muted">Not Logged / Off-Site</span>
            </div>
            <div className="ml-auto text-[10px] text-base-muted">
              {availableLaborData.length} crafts represented
            </div>
          </div>

          {/* Available content area */}
          {availableLaborData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20 animate-fade-in">
              <Users className="h-14 w-14 text-base-muted opacity-20" />
              <p className="font-condensed font-bold text-base-muted uppercase tracking-widest text-sm">
                No available labor identified
              </p>
              <p className="text-xs text-base-muted">
                {selectedCraft !== 'All'
                  ? `All ${selectedCraft}s are allocated to projects on ${selectedDate}.`
                  : `All personnel are allocated to projects on ${selectedDate}.`
                }
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {availableLaborData.map(cg => (
                  <CraftAvailableCard key={cg.craft} craftGroup={cg} />
                ))}
              </div>
            </div>
          )}
        </>
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
}

function ProjectAllocationCard({ data }: ProjectAllocationCardProps) {
  const [expanded, setExpanded] = useState(false);

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
            <div className="text-2xl font-condensed font-black text-base-text leading-none">
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
              <span className="text-xs font-condensed font-black text-base-text bg-base-surface3 border border-base-border px-2 py-0.5 rounded">
                {c.count} {c.count === 1 ? 'Worker' : 'Workers'}
              </span>
              <span className="text-[10px] text-base-muted font-condensed font-bold">
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
                  <div
                    key={w.empId}
                    className="flex items-center justify-between text-[11px] text-base-text bg-base-surface border border-base-border/40 rounded-lg px-2 py-1 min-w-0 shadow-sm"
                  >
                    <span className="truncate font-semibold flex items-center gap-1 min-w-0">
                      {w.status === 'late' && (
                        <span className="text-[8px] bg-amber-500/15 text-amber-500 px-1 py-0.2 rounded font-black shrink-0">LATE</span>
                      )}
                      <span className="truncate" title={w.empName}>{w.empName}</span>
                    </span>
                    <span className="text-base-muted text-[10px] font-mono shrink-0 ml-1 bg-base-surface3 border border-base-border/20 px-1 py-0.2 rounded font-bold">{w.hours}h</span>
                  </div>
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
}

function CraftAvailableCard({ craftGroup }: CraftAvailableCardProps) {
  const [expanded, setExpanded] = useState(false);

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
          <span className="text-xs font-condensed font-bold bg-base-surface3 px-2 py-0.5 rounded border border-base-border text-base-text">
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
                  <div key={w.empId} className="bg-base-surface2 border border-base-border rounded px-2.5 py-1.5 flex flex-col justify-between">
                    <span className="text-xs font-bold text-base-text truncate">{w.empName}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-base-muted truncate max-w-[80px]">{w.position}</span>
                      <span className="text-[9px] px-1 rounded bg-base-green-dim text-base-green font-bold">{w.hours}h</span>
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
                  <div key={w.empId} className="bg-base-surface2/50 border border-base-border/50 rounded px-2.5 py-1.5 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium text-base-text truncate">{w.empName}</span>
                    <span className="text-[9px] text-base-muted mt-1 truncate">{w.position}</span>
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
