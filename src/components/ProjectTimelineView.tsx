import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Assembly, Task, ProjectStatusType, ProjectCategoryType } from '../types';
import {
  Calendar,
  Search,
  Filter,
  Layers,
  ChevronRight,
  ChevronDown,
  Flag,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Info,
  X,
  SlidersHorizontal,
  FolderKanban
} from 'lucide-react';

interface ProjectTimelineViewProps {
  projects: Project[];
}

// Parse date strings safely
const parseDate = (dStr?: string): Date | null => {
  if (!dStr) return null;
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
};

// Format Date for display
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Helper to calculate project-level progress
const calculateProjectProgress = (project: Project): number => {
  let totalTasks = 0;
  let completedTasks = 0;
  let weightedProgressSum = 0;

  project.assemblies?.forEach(assembly => {
    assembly.tasks?.forEach(task => {
      totalTasks++;
      weightedProgressSum += task.pct || 0;
      if (task.done) completedTasks++;
    });
  });

  if (totalTasks === 0) return 0;
  return Math.round(weightedProgressSum / totalTasks);
};

export default function ProjectTimelineView({ projects }: ProjectTimelineViewProps) {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [milestoneFilter, setMilestoneFilter] = useState<'all' | 'completed' | 'upcoming'>('all');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [timelineScale, setTimelineScale] = useState<'fit' | '3m' | '6m' | '1y'>('fit');
  const [selectedMilestone, setSelectedMilestone] = useState<{
    task: Task;
    projectName: string;
    assemblyName: string;
    date: Date;
  } | null>(null);

  // Toggle project collapse
  const toggleProject = (id: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Derive projects with their effective start/due dates
  const projectsWithDates = useMemo(() => {
    return projects.map(p => {
      let earliestDate = parseDate(p.start);
      let latestDate = parseDate(p.due);

      // Try parsing target month as fallback (e.g. "January 2026")
      if (!earliestDate && p.targetMonth) {
        // e.g. "January 2026"
        const parts = p.targetMonth.split(' ');
        if (parts.length === 2) {
          const mIndex = new Date(`${parts[0]} 1, ${parts[1]}`).getMonth();
          if (!isNaN(mIndex)) {
            earliestDate = new Date(parseInt(parts[1]), mIndex, 1);
          }
        }
      }

      // Fallback from assemblies
      p.assemblies?.forEach(a => {
        const aStart = parseDate(a.start);
        const aFinish = parseDate(a.finish);
        if (aStart && (!earliestDate || aStart < earliestDate)) earliestDate = aStart;
        if (aFinish && (!latestDate || aFinish > latestDate)) latestDate = aFinish;

        a.tasks?.forEach(t => {
          const tDate = parseDate(t.date || t.finishDate);
          if (tDate) {
            if (!earliestDate || tDate < earliestDate) earliestDate = tDate;
            if (!latestDate || tDate > latestDate) latestDate = tDate;
          }
        });
      });

      // Default fallbacks if still empty
      if (!earliestDate) earliestDate = parseDate(p.created) || new Date();
      if (!latestDate) {
        latestDate = new Date(earliestDate.getTime());
        latestDate.setMonth(latestDate.getMonth() + 3); // Default to +3 months
      }

      // Prevent negative timeline range
      if (latestDate < earliestDate) {
        latestDate = new Date(earliestDate.getTime() + 86400000 * 30);
      }

      // Collect milestones
      const milestones: { task: Task; date: Date; assemblyName: string }[] = [];
      p.assemblies?.forEach(a => {
        a.tasks?.forEach(t => {
          if (t.isMilestone || t.name.toLowerCase().includes('milestone') || t.name.toLowerCase().includes('gate')) {
            const mDate = parseDate(t.date || t.finishDate || (t as any).baselineDate || (t as any).baselineFinish);
            if (mDate) {
              milestones.push({
                task: t,
                date: mDate,
                assemblyName: a.name
              });
            }
          }
        });
      });

      return {
        ...p,
        effectiveStart: earliestDate,
        effectiveDue: latestDate,
        milestones: milestones.sort((a, b) => a.date.getTime() - b.date.getTime()),
        overallProgress: calculateProjectProgress(p)
      };
    });
  }, [projects]);

  // Apply search and tab filterings
  const filteredProjects = useMemo(() => {
    return projectsWithDates.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.gaNumber || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [projectsWithDates, searchQuery, statusFilter, categoryFilter]);

  // Determine timeline window boundaries
  const { timelineStart, timelineEnd, totalTimelineMs } = useMemo(() => {
    if (filteredProjects.length === 0) {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 5);
      return {
        timelineStart: start,
        timelineEnd: end,
        totalTimelineMs: end.getTime() - start.getTime()
      };
    }

    let minMs = Infinity;
    let maxMs = -Infinity;

    filteredProjects.forEach(p => {
      if (p.effectiveStart.getTime() < minMs) minMs = p.effectiveStart.getTime();
      if (p.effectiveDue.getTime() > maxMs) maxMs = p.effectiveDue.getTime();
    });

    // Handle zoom views or Fit view
    const start = new Date(minMs);
    const end = new Date(maxMs);

    // Add padding (e.g. 15 days) to sides
    start.setDate(start.getDate() - 15);
    end.setDate(end.getDate() + 15);

    if (timelineScale === '3m') {
      const now = new Date();
      start.setTime(now.getTime() - 86400000 * 30);
      end.setTime(now.getTime() + 86400000 * 60);
    } else if (timelineScale === '6m') {
      const now = new Date();
      start.setTime(now.getTime() - 86400000 * 30);
      end.setTime(now.getTime() + 86400000 * 150);
    } else if (timelineScale === '1y') {
      const now = new Date();
      start.setTime(now.getTime() - 86400000 * 60);
      end.setTime(now.getTime() + 86400000 * 300);
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      totalTimelineMs: end.getTime() - start.getTime()
    };
  }, [filteredProjects, timelineScale]);

  // Calculate month columns inside the timeline window
  const timelineMonths = useMemo(() => {
    const months: { label: string; year: number; month: number; startPct: number; endPct: number }[] = [];
    const current = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
    const endLimit = new Date(timelineEnd.getFullYear(), timelineEnd.getMonth() + 1, 1);

    while (current < endLimit) {
      const mStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const mEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);

      // Clamp to timeline boundaries
      const actualStart = mStart < timelineStart ? timelineStart : mStart;
      const actualEnd = mEnd > timelineEnd ? timelineEnd : mEnd;

      if (actualStart < actualEnd) {
        const startPct = ((actualStart.getTime() - timelineStart.getTime()) / totalTimelineMs) * 100;
        const endPct = ((actualEnd.getTime() - timelineStart.getTime()) / totalTimelineMs) * 100;

        months.push({
          label: current.toLocaleDateString('en-US', { month: 'short' }),
          year: current.getFullYear(),
          month: current.getMonth(),
          startPct,
          endPct
        });
      }

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [timelineStart, timelineEnd, totalTimelineMs]);

  // Calculate statistics KPIs
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const active = filteredProjects.filter(p => p.status === 'active').length;
    const completed = filteredProjects.filter(p => p.status === 'completed').length;

    // Check overdue
    const today = new Date();
    const overdue = filteredProjects.filter(p => p.status === 'active' && p.effectiveDue < today).length;

    // Milestone stats
    let totalMilestones = 0;
    let completedMilestones = 0;
    const upcomingMilestones: {
      task: Task;
      projectName: string;
      assemblyName: string;
      date: Date;
    }[] = [];

    filteredProjects.forEach(p => {
      p.milestones.forEach(m => {
        totalMilestones++;
        if (m.task.done) {
          completedMilestones++;
        } else if (m.date >= today) {
          upcomingMilestones.push({
            task: m.task,
            projectName: p.name,
            assemblyName: m.assemblyName,
            date: m.date
          });
        }
      });
    });

    upcomingMilestones.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      total,
      active,
      completed,
      overdue,
      totalMilestones,
      completedMilestones,
      milestoneSuccessRate: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
      upcomingMilestones: upcomingMilestones.slice(0, 4)
    };
  }, [filteredProjects]);

  // Helper to get relative placement of a date range
  const getRelativePlacement = (start?: Date, end?: Date) => {
    if (!start || !end) return { left: 0, width: 0 };

    const startClamp = start < timelineStart ? timelineStart : start;
    const endClamp = end > timelineEnd ? timelineEnd : end;

    if (startClamp >= timelineEnd || endClamp <= timelineStart) {
      return { left: 0, width: 0 }; // out of view
    }

    const left = ((startClamp.getTime() - timelineStart.getTime()) / totalTimelineMs) * 100;
    const width = ((endClamp.getTime() - startClamp.getTime()) / totalTimelineMs) * 100;

    return { left, width };
  };

  // Helper to get relative point of a single date
  const getRelativePoint = (date?: Date) => {
    if (!date) return -999;
    if (date < timelineStart || date > timelineEnd) return -999;
    return ((date.getTime() - timelineStart.getTime()) / totalTimelineMs) * 100;
  };

  // Status color mappings
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 text-emerald-950 border-emerald-400/20';
      case 'completed':
        return 'bg-blue-500 text-blue-950 border-blue-400/20';
      case 'on-hold':
        return 'bg-amber-500 text-amber-950 border-amber-400/20';
      default:
        return 'bg-zinc-500 text-zinc-950 border-zinc-400/20';
    }
  };

  const getStatusColorHex = (status: string) => {
    switch (status) {
      case 'active': return 'rgb(16, 185, 129)';
      case 'completed': return 'rgb(59, 130, 246)';
      case 'on-hold': return 'rgb(245, 158, 11)';
      default: return 'rgb(107, 114, 128)';
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-surface border border-base-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-base-accent/10 rounded-lg text-base-accent">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-base-text font-sans tracking-tight">
              Project Timeline Tracker
            </h1>
            <p className="text-xs text-base-muted mt-0.5">
              Visualize high-level timelines, phases (assemblies), key project milestones, and statuses.
            </p>
          </div>
        </div>

        {/* Quick controls / Scale selection */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-base-surface2 border border-base-border p-1 rounded-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-base-muted px-2">Timeline Range:</span>
          {(['fit', '3m', '6m', '1y'] as const).map(scale => (
            <button
              key={scale}
              onClick={() => setTimelineScale(scale)}
              className={`px-3 py-1 rounded text-xs font-condensed font-bold uppercase tracking-wider transition ${
                timelineScale === scale
                  ? 'bg-base-accent text-white shadow-sm'
                  : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
              }`}
            >
              {scale === 'fit' ? 'Fit All' : scale === '3m' ? '3 Months' : scale === '6m' ? '6 Months' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* STATS PANELS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active / Completed Card */}
        <div className="bg-base-surface border border-base-border rounded-xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
          <div>
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block">Projects Load</span>
            <div className="text-2xl font-extrabold text-base-text mt-1.5 flex items-baseline gap-2">
              <span>{stats.active}</span>
              <span className="text-xs font-normal text-base-muted">Active</span>
              <span className="text-neutral-300">/</span>
              <span className="text-lg text-base-muted font-bold">{stats.total}</span>
              <span className="text-xs font-normal text-base-muted">Total</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase">{stats.completed} Finished</span>
          </div>
        </div>

        {/* Timeline Delay / Alerts */}
        <div className="bg-base-surface border border-base-border rounded-xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
          <div>
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block">Overdue Alarms</span>
            <div className="text-2xl font-extrabold text-red-500 mt-1.5 flex items-baseline gap-1.5">
              <span>{stats.overdue}</span>
              <span className="text-xs font-normal text-base-muted">Active projects late</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-condensed font-bold text-base-muted uppercase">
            {stats.overdue > 0 ? (
              <span className="text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> High Urgency</span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> All schedules clear</span>
            )}
          </div>
        </div>

        {/* Milestone Achievement */}
        <div className="bg-base-surface border border-base-border rounded-xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
          <div>
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block">Milestone Completion</span>
            <div className="text-2xl font-extrabold text-base-text mt-1.5 flex items-baseline gap-2">
              <span>{stats.milestoneSuccessRate}%</span>
              <span className="text-xs font-normal text-base-muted">Success rate</span>
            </div>
          </div>
          <div className="w-full bg-base-surface3 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-base-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.milestoneSuccessRate}%` }}
            />
          </div>
        </div>

        {/* Next Key Milestone Card */}
        <div className="bg-base-surface border border-base-border rounded-xl p-4.5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
          <div>
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block">Next Key Milestone</span>
            {stats.upcomingMilestones.length > 0 ? (
              <div className="mt-1">
                <div className="text-xs font-bold text-base-text truncate">
                  {stats.upcomingMilestones[0].task.name}
                </div>
                <div className="text-[10px] text-base-muted truncate mt-0.5">
                  {stats.upcomingMilestones[0].projectName} &bull; {stats.upcomingMilestones[0].assemblyName}
                </div>
              </div>
            ) : (
              <div className="text-xs text-base-muted mt-2 italic">No upcoming milestones</div>
            )}
          </div>
          {stats.upcomingMilestones.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-base-accent font-bold">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(stats.upcomingMilestones[0].date)}</span>
            </div>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4.5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Text Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project name, client, GA number..."
              className="w-full pl-9 pr-4 py-2 bg-base-surface2 border border-base-border rounded-lg text-sm text-base-text placeholder-base-muted focus:outline-none focus:border-base-accent transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-base-muted hover:text-base-text transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2 bg-base-surface2 border border-base-border rounded-lg px-3 py-1.5 text-sm text-base-text">
            <Filter className="h-4 w-4 text-base-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2 bg-base-surface2 border border-base-border rounded-lg px-3 py-1.5 text-sm text-base-text">
            <SlidersHorizontal className="h-4 w-4 text-base-muted" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="tray">Tray</option>
              <option value="nontray">Non-Tray</option>
            </select>
          </div>
        </div>
      </div>

      {/* TIMELINE VISUALIZATION BOARD */}
      <div className="bg-base-surface border border-base-border rounded-xl shadow-sm overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="p-4 bg-base-accent/5 rounded-full text-base-accent/50">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-sm text-base-text">No Projects Match Your Filter</h3>
            <p className="text-xs text-base-muted max-w-sm">
              Try adjusting your search queries, statuses, or categories to find timeline tracking data.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Timeline Column Headers & Grid Indicator */}
            <div className="flex border-b border-base-border bg-base-surface2 sticky top-0 z-20 min-w-[760px]">
              {/* Left Column Spacer */}
              <div className="w-[280px] min-w-[280px] p-3 border-r border-base-border flex items-center justify-between text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                <span>Project Workspace List</span>
                <span className="text-[9px] text-base-accent">({filteredProjects.length} rows)</span>
              </div>

              {/* Right Column Timeline Month Headers */}
              <div className="flex-1 relative h-10 select-none">
                {timelineMonths.map((m, idx) => (
                  <div
                    key={`${m.year}-${m.month}-${idx}`}
                    className="absolute top-0 bottom-0 border-r border-base-border/50 flex flex-col items-center justify-center text-[10px] font-condensed font-extrabold uppercase tracking-wide text-base-muted"
                    style={{
                      left: `${m.startPct}%`,
                      width: `${m.endPct - m.startPct}%`,
                    }}
                  >
                    <span>{m.label}</span>
                    <span className="text-[8px] opacity-75 font-normal tracking-normal mt-0.5">{m.year}</span>
                  </div>
                ))}

                {/* Today Line Indicator */}
                {(() => {
                  const todayPct = getRelativePoint(new Date());
                  if (todayPct >= 0 && todayPct <= 100) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                      >
                        <div className="absolute top-0 -translate-x-1/2 bg-red-500 text-white text-[8px] font-condensed font-bold uppercase tracking-wide px-1 rounded-sm py-0.5 shadow-sm">
                          TODAY
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Timeline Rows container */}
            <div className="divide-y divide-base-border min-w-[760px]">
              {filteredProjects.map(p => {
                const isExpanded = !!expandedProjects[p.id];
                const placement = getRelativePlacement(p.effectiveStart, p.effectiveDue);

                return (
                  <div key={p.id} className="flex flex-col bg-base-surface">
                    {/* Project Primary Row */}
                    <div className="flex hover:bg-base-surface2/30 transition items-stretch border-l-4 border-l-transparent hover:border-l-base-accent">
                      {/* Left Side: Info */}
                      <div className="w-[280px] min-w-[280px] p-3.5 border-r border-base-border flex flex-col justify-between gap-2 bg-base-surface/50 z-10">
                        <div className="flex items-start justify-between gap-1">
                          <button
                            onClick={() => toggleProject(p.id)}
                            className="flex items-center gap-1.5 text-left group cursor-pointer focus:outline-none"
                          >
                            <span className="text-base-muted group-hover:text-base-text transition mt-0.5">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-base-text group-hover:text-base-accent transition block leading-tight">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-base-muted block mt-0.5 truncate max-w-[190px]">
                                Client: <span className="font-medium text-base-text/80">{p.client}</span>
                              </span>
                            </div>
                          </button>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[9px] font-condensed font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${getStatusClass(p.status)}`}>
                              {p.status}
                            </span>
                            {p.gaNumber && (
                              <span className="px-1 py-0.5 text-[8px] font-mono font-bold bg-base-surface3 border border-base-border rounded text-base-muted">
                                {p.gaNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Project completion status */}
                        <div className="flex items-center justify-between text-[10px] font-condensed text-base-muted mt-1 pt-1.5 border-t border-base-border/30">
                          <div className="flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5 text-base-muted" />
                            <span>{p.assemblies?.length || 0} Phases</span>
                          </div>
                          <div className="flex items-center gap-1 font-bold text-base-text">
                            <span>{p.overallProgress}% Complete</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Primary Project Track */}
                      <div className="flex-1 relative overflow-hidden h-20 min-h-[80px] self-stretch flex items-center bg-base-surface/10">
                        {/* Month Vertical Grid lines for tracking */}
                        <div className="absolute inset-0 pointer-events-none">
                          {timelineMonths.map((m, idx) => (
                            <div
                              key={idx}
                              className="absolute top-0 bottom-0 border-r border-base-border/30"
                              style={{ left: `${m.startPct}%` }}
                            />
                          ))}
                        </div>

                        {/* Relative Project Bar */}
                        {placement.width > 0 && (
                          <div
                            className="absolute h-9 rounded-lg border shadow-sm flex flex-col justify-center px-3 group/bar overflow-hidden transition-all"
                            style={{
                              left: `${placement.left}%`,
                              width: `${placement.width}%`,
                              borderColor: `${getStatusColorHex(p.status)}40`,
                              backgroundColor: `${getStatusColorHex(p.status)}10`
                            }}
                          >
                            {/* Interactive progress fill */}
                            <div
                              className="absolute left-0 top-0 bottom-0 opacity-20 pointer-events-none transition-all duration-500"
                              style={{
                                width: `${p.overallProgress}%`,
                                backgroundColor: getStatusColorHex(p.status)
                              }}
                            />

                            {/* Label inside bar */}
                            <div className="relative z-10 flex items-center justify-between text-[10px] font-condensed font-bold text-base-text truncate pointer-events-none">
                              <span className="truncate pr-2">{p.name} Bar</span>
                              <span className="opacity-75">{formatDate(p.effectiveStart)} - {formatDate(p.effectiveDue)}</span>
                            </div>
                          </div>
                        )}

                        {/* Interactive Milestone diamond markers plotted right on the track */}
                        {p.milestones.map((milestone, mIdx) => {
                          const mPct = getRelativePoint(milestone.date);
                          if (mPct < 0 || mPct > 100) return null;

                          const isMilestoneDone = milestone.task.done;

                          return (
                            <button
                              key={`${milestone.task.id}-${mIdx}`}
                              onClick={() => setSelectedMilestone({
                                task: milestone.task,
                                projectName: p.name,
                                assemblyName: milestone.assemblyName,
                                date: milestone.date
                              })}
                              className="absolute -translate-x-1/2 z-10 group/marker cursor-pointer focus:outline-none"
                              style={{ left: `${mPct}%` }}
                            >
                              <div className="relative flex flex-col items-center">
                                {/* Milestone Badge Diamond */}
                                <div
                                  className={`w-3.5 h-3.5 rotate-45 border-2 transition-transform duration-200 group-hover/marker:scale-130 shadow-md ${
                                    isMilestoneDone
                                      ? 'bg-emerald-500 border-emerald-300'
                                      : 'bg-amber-400 border-amber-200'
                                  }`}
                                />
                                {/* Display Flag outline for beauty */}
                                <Flag className={`h-2.5 w-2.5 absolute -top-5 pointer-events-none transition ${
                                  isMilestoneDone ? 'text-emerald-500' : 'text-amber-500'
                                }`} />

                                {/* Mini popover tooltip on hover */}
                                <div className="absolute bottom-6 bg-slate-900/95 text-white text-[9px] rounded-md px-2 py-1 shadow-xl opacity-0 pointer-events-none group-hover/marker:opacity-100 transition duration-150 z-30 whitespace-nowrap flex flex-col gap-0.5 -translate-x-1/2 left-1/2 border border-slate-700">
                                  <span className="font-extrabold flex items-center gap-1">
                                    <span className={`h-1.5 w-1.5 rounded-full ${isMilestoneDone ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                    {milestone.task.name}
                                  </span>
                                  <span className="text-[8px] text-slate-300 font-medium">Phase: {milestone.assemblyName}</span>
                                  <span className="text-[8px] font-mono text-slate-400">{formatDate(milestone.date)} ({isMilestoneDone ? 'Achieved' : 'Pending'})</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Collapsible Assemblies (Phases) row tracks */}
                    <AnimatePresence>
                      {isExpanded && p.assemblies && p.assemblies.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-base-border/40 bg-base-surface2/10 divide-y divide-base-border/30"
                        >
                          {p.assemblies.map(assembly => {
                            const aStart = parseDate(assembly.start) || p.effectiveStart;
                            const aFinish = parseDate(assembly.finish) || p.effectiveDue;
                            const aPlacement = getRelativePlacement(aStart, aFinish);
                            
                            // Calculate average progress for this specific assembly
                            const aTotalTasks = assembly.tasks?.length || 0;
                            const aDoneTasks = assembly.tasks?.filter(t => t.done).length || 0;
                            const aProgress = aTotalTasks > 0
                              ? Math.round((assembly.tasks?.reduce((sum, t) => sum + (t.pct || 0), 0) || 0) / aTotalTasks)
                              : 0;

                            // Collect milestones for this assembly specifically
                            const assemblyMilestones = assembly.tasks?.filter(t => t.isMilestone || t.name.toLowerCase().includes('milestone') || t.name.toLowerCase().includes('gate')) || [];

                            return (
                              <div key={assembly.id} className="flex items-stretch hover:bg-base-surface2/20 transition">
                                {/* Left Spacer Assembly info */}
                                <div className="w-[280px] min-w-[280px] pl-9 pr-3 py-2.5 border-r border-base-border flex flex-col justify-center bg-base-surface2/5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-bold text-base-text/90 leading-tight">
                                      {assembly.name}
                                    </span>
                                    <span className="text-[9px] font-condensed font-bold bg-base-surface3 border border-base-border text-base-muted rounded px-1 shrink-0">
                                      {assembly.budgetHours ? `${assembly.budgetHours} Hrs` : '—'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] text-base-muted mt-1 font-condensed">
                                    <span>{aTotalTasks} Tasks &bull; {aDoneTasks} Done</span>
                                    <span className="font-bold text-base-accent">{aProgress}% Progress</span>
                                  </div>
                                </div>

                                {/* Right Spacer Assembly timeline representation */}
                                <div className="flex-1 relative h-14 self-stretch flex items-center">
                                  {/* Sub Month lines */}
                                  <div className="absolute inset-0 pointer-events-none">
                                    {timelineMonths.map((m, idx) => (
                                      <div
                                        key={idx}
                                        className="absolute top-0 bottom-0 border-r border-base-border/20"
                                        style={{ left: `${m.startPct}%` }}
                                      />
                                    ))}
                                  </div>

                                  {/* Assembly Gantt Bar */}
                                  {aPlacement.width > 0 && (
                                    <div
                                      className="absolute h-6.5 rounded-md border border-base-accent/20 bg-base-accent/5 flex flex-col justify-center px-2.5 shadow-sm group/phase-bar overflow-hidden transition-all"
                                      style={{
                                        left: `${aPlacement.left}%`,
                                        width: `${aPlacement.width}%`,
                                      }}
                                    >
                                      {/* Sub-Progress fill inside Phase/Assembly */}
                                      <div
                                        className="absolute left-0 top-0 bottom-0 bg-base-accent/15 pointer-events-none transition-all duration-500"
                                        style={{ width: `${aProgress}%` }}
                                      />
                                      <span className="relative z-10 text-[9px] font-bold text-base-muted truncate font-sans">
                                        {assembly.name} phase &bull; {aProgress}%
                                      </span>
                                    </div>
                                  )}

                                  {/* Plot assembly-specific milestones as small ticks for details */}
                                  {assemblyMilestones.map((task, taskIdx) => {
                                    const tDate = parseDate(task.date || task.finishDate || (task as any).baselineDate || (task as any).baselineFinish);
                                    if (!tDate) return null;
                                    const mPct = getRelativePoint(tDate);
                                    if (mPct < 0 || mPct > 100) return null;

                                    return (
                                      <div
                                        key={`${task.id}-${taskIdx}`}
                                        className="absolute -translate-x-1/2 h-full flex flex-col justify-center z-10"
                                        style={{ left: `${mPct}%` }}
                                      >
                                        <div
                                          className={`w-2.5 h-2.5 rotate-45 border transition duration-200 ${
                                            task.done ? 'bg-emerald-500 border-emerald-300' : 'bg-amber-400 border-amber-200'
                                          }`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MILESTONE DETAILS LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedMilestone && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-base-surface border border-base-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative"
            >
              <button
                onClick={() => setSelectedMilestone(null)}
                className="absolute right-4 top-4 p-1.5 hover:bg-base-surface2 rounded-full text-base-muted hover:text-base-text transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-base-border pb-4 mb-4">
                <div className={`p-3 rounded-full ${
                  selectedMilestone.task.done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <Flag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-base-text uppercase tracking-wide font-sans">
                    Key Project Milestone
                  </h3>
                  <p className="text-xs text-base-muted mt-0.5">
                    Detailed status, completion, and timelines of the gate.
                  </p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-sm">
                <div>
                  <label className="text-[10px] font-bold text-base-muted uppercase tracking-wider block">Milestone Name</label>
                  <div className="text-base font-bold text-base-text mt-0.5">{selectedMilestone.task.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-base-muted uppercase tracking-wider block">Project Workspace</label>
                    <div className="font-bold text-base-text mt-0.5 truncate">{selectedMilestone.projectName}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-base-muted uppercase tracking-wider block">Phase / Assembly</label>
                    <div className="font-bold text-base-text mt-0.5 truncate">{selectedMilestone.assemblyName}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-base-border/30">
                  <div>
                    <label className="text-[10px] font-bold text-base-muted uppercase tracking-wider block">Target Date</label>
                    <div className="font-bold text-base-text mt-0.5">{formatDate(selectedMilestone.date)}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-base-muted uppercase tracking-wider block">Execution Status</label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        selectedMilestone.task.done ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                      }`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        selectedMilestone.task.done ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {selectedMilestone.task.done ? 'Achieved' : 'In Progress'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedMilestone.task.assigned && (
                  <div className="pt-3 border-t border-base-border/30">
                    <label className="text-[10px] font-bold text-base-muted uppercase tracking-wider block">Assigned Lead / Operator</label>
                    <div className="text-base-text font-bold mt-0.5">{selectedMilestone.task.assigned}</div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedMilestone(null)}
                  className="px-5 py-2.5 bg-base-accent hover:bg-base-accent/90 text-white font-condensed font-bold uppercase tracking-wider text-xs rounded-lg shadow-sm transition"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
