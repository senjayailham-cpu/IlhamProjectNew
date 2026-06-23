import React from 'react';
import { Project, TimesheetEntry, WireLog } from '../types';
import { Search, Plus, Download, BookOpen, Edit, Copy, Clock, Flame, Archive, RotateCcw } from 'lucide-react';
import { calcPct, calcTaskCounts, fmtHrs, getManHoursForWorkOrder } from '../utils/projectUtils';
import { downloadProjectPDF } from '../utils/pdfGenerator';
import { useAuth } from '../hooks/useAuth';
import { can as canUtil } from '../utils/permissions';

interface ProjectsPageProps {
  activeTab: 'current' | 'completed' | 'tray' | 'nontray' | 'archive';
  projects: Project[];
  timesheets: TimesheetEntry[];
  wireLogs: WireLog[];
  projectSearchQuery: string;
  setProjectSearchQuery: (query: string) => void;
  currentTabMonthFilter: string;
  setCurrentTabMonthFilter: (month: string) => void;
  openAddProject: () => void;
  openEditProjectForm: (pid: string) => void;
  openAssemblyAddForm: (pid: string) => void;
  openCopyModalLauncher: (pid: string) => void;
  setSpotlightProjectId: (id: string | null) => void;
  setSpotlightOpen: (open: boolean) => void;
  archiveProject: (pid: string) => void;
  unarchiveProject: (pid: string) => void;
}

export function ProjectsPage({
  activeTab,
  projects,
  timesheets,
  wireLogs,
  projectSearchQuery,
  setProjectSearchQuery,
  currentTabMonthFilter,
  setCurrentTabMonthFilter,
  openAddProject,
  openEditProjectForm,
  openAssemblyAddForm,
  openCopyModalLauncher,
  setSpotlightProjectId,
  setSpotlightOpen,
  archiveProject,
  unarchiveProject,
}: ProjectsPageProps) {
  const { currentUser } = useAuth();
  const can = (perm: any) => canUtil(currentUser, perm);

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-base-accent/25 text-base-accent font-black rounded px-0.5 select-all inline-block">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  if (activeTab === 'current') {
    const activePendingProjects = projects.filter(p => !p.isArchived && (p.status === 'active' || p.status === 'pending' || p.status === 'on-hold'));

    const monthOptionsMap: Record<string, string> = {};
    activePendingProjects.forEach(p => {
      if (p.due) {
        const d = new Date(p.due + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthOptionsMap[k] = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
      }
      if (p.start) {
        const d = new Date(p.start + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthOptionsMap[k] = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
      }
    });
    const sortedMonthFilterKeys = Object.keys(monthOptionsMap).sort();

    const filteredProjects = activePendingProjects
      .filter(p => {
        if (currentTabMonthFilter) {
          const startStr = p.start || '';
          const dueStr = p.due || '';
          const matchesStart = startStr.slice(0, 7) === currentTabMonthFilter;
          const matchesDue = dueStr.slice(0, 7) === currentTabMonthFilter;

          const filterStart = `${currentTabMonthFilter}-01`;
          const filterEnd = `${currentTabMonthFilter}-31`;
          const spansFilter = (startStr && dueStr && startStr <= filterEnd && dueStr >= filterStart);

          if (!matchesStart && !matchesDue && !spansFilter) return false;
        }
        return true;
      })
      .filter(p => {
        if (!projectSearchQuery.trim()) return true;
        const q = projectSearchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q)
        );
      });

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap flex-1 min-w-[280px]">
            <h2 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text">
              Current <span className="text-base-accent">Schedules</span>
            </h2>

            {/* Real-time Search Box */}
            <div id="project-search-container" className="relative w-full sm:max-w-xs md:max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base-muted">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="current-projects-search-input"
                type="text"
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                placeholder="Search name or work order..."
                className="w-full pl-9 pr-8 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs select-text focus:border-base-accent outline-none text-base-text font-medium"
              />
              {projectSearchQuery && (
                <button
                  id="current-projects-clear-search-btn"
                  onClick={() => setProjectSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-base-muted hover:text-base-text cursor-pointer font-bold text-[10px]"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Months Drop-down Filter */}
            <div className="relative">
              <select
                id="current-projects-month-select"
                value={currentTabMonthFilter}
                onChange={(e) => setCurrentTabMonthFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer outline-none focus:border-base-accent text-base-muted2 hover:text-base-text transition-colors"
                title="Filter projects by month"
              >
                <option value="">All Months</option>
                {sortedMonthFilterKeys.map(k => (
                  <option key={k} value={k} className="font-sans normal-case">
                    {monthOptionsMap[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {can('addProject') && (
            <button
              onClick={openAddProject}
              className="btn btn-accent btn-sm flex items-center gap-1 font-condensed font-bold uppercase cursor-pointer"
            >
              <span>Add project</span>
            </button>
          )}
        </div>

        {/* List current active cards */}
        <div className="grid grid-cols-1 gap-4">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-base-surface border border-base-border border-dashed rounded-xl space-y-3">
              <div className="text-base-muted font-medium text-sm">No current schedules match your filters.</div>
              <div className="flex gap-2 justify-center">
                {projectSearchQuery && (
                  <button
                    id="current-projects-no-results-clear-btn"
                    onClick={() => setProjectSearchQuery('')}
                    className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                  >
                    Clear search filter
                  </button>
                )}
                {currentTabMonthFilter && (
                  <button
                    id="current-projects-no-results-clear-month-btn"
                    onClick={() => setCurrentTabMonthFilter('')}
                    className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                  >
                    Clear month filter
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredProjects.map(p => {
              const pct = calcPct(p);
              const hasActiveSearch = projectSearchQuery.trim() !== '';

              return (
                <div
                  key={p.id}
                  className={`py-1.5 px-3 rounded-lg relative overflow-hidden group transition-all duration-200 border flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 ${
                    hasActiveSearch
                      ? 'bg-base-surface border-2 border-base-accent animate-pulse-highlight'
                      : 'bg-base-surface border-base-border shadow-xs hover:border-base-border2'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-base-accent shadow-[0_0_6px_var(--base-accent)]'}`} />
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                          className="font-condensed font-black text-sm tracking-wide text-base-text cursor-pointer hover:text-base-accent transition-colors leading-tight truncate"
                        >
                          {highlightText(p.name, projectSearchQuery)}
                        </h3>
                        {hasActiveSearch && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-condensed font-black uppercase bg-base-accent/15 text-base-accent border border-base-accent/30 tracking-wider">
                            MATCH
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-condensed font-bold text-base-blue uppercase tracking-wider font-mono">
                        {highlightText(p.client, projectSearchQuery)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-base-muted2 shrink-0">
                    {(p.start || p.due) && (
                      <span className="px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border/30">
                        📅 {p.start ? p.start : '??'} → {p.due ? p.due : '??'}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider ${p.location === 'workshop1' ? 'bg-[#9b1c2e]/10 text-[#9b1c2e]/85 border border-[#9b1c2e]/20' : 'bg-base-blue/10 text-base-blue border border-base-blue/20'}`}>
                      {p.location === 'workshop1' ? 'W1' : 'W2'}
                    </span>

                    {(() => {
                      const usedHours = getManHoursForWorkOrder(p.client, timesheets);
                      const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                      const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                      return (
                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border transition-all ${
                            isOverBudget
                              ? 'bg-red-500/10 text-red-500 border-red-500/30'
                              : hasBudget
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-base-accent-dim/20 text-base-accent border-transparent'
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          <span>
                            {fmtHrs(usedHours)}h / {p.budgetHours || '??'}h
                          </span>
                        </span>
                      );
                    })()}

                    {(() => {
                      const totalWire = (wireLogs || [])
                        .filter(wl => wl.projectId === p.id)
                        .reduce((sum, wl) => sum + wl.amountKg, 0);
                      if (totalWire === 0) return null;
                      return (
                        <span
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border bg-amber-500/15 text-amber-500 border-amber-500/20 transition-all font-mono"
                          title="Total wire consumables logged"
                        >
                          <Flame className="h-2.5 w-2.5 animate-pulse" />
                          <span>{totalWire.toFixed(1)} kg</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 justify-between lg:justify-end w-full lg:w-auto pt-1 lg:pt-0 border-t lg:border-t-0 border-base-border/10">
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] text-base-muted font-bold font-condensed uppercase tracking-wider hidden sm:block">
                        {p.assemblies ? p.assemblies.length : 0} subassemblies
                      </div>

                      <div className="space-y-0.5 w-20">
                        <div className="flex justify-between items-center text-[10px] font-condensed font-bold text-base-muted2">
                          <span>Progress</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-base-border/20 rounded-full overflow-hidden w-20">
                          <div className="h-full rounded-full bg-base-accent transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {can('addAssembly') && (
                        <button
                          onClick={() => openAssemblyAddForm(p.id)}
                          className="px-1.5 py-0.5 text-[9px] font-condensed font-extrabold uppercase bg-base-surface2 border border-base-border/80 hover:bg-base-surface3 hover:text-base-text rounded text-base-muted2 cursor-pointer transition-colors"
                        >
                          + Assy
                        </button>
                      )}

                      {p.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadProjectPDF(p, timesheets, wireLogs);
                          }}
                          className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md"
                          title="Download completion PDF report"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                        className="p-1 text-base-muted hover:text-base-text hover:bg-base-surface3 rounded-md"
                        title="Open spotlight inspector"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </button>

                      {can('editProject') && (
                        <button
                          onClick={() => openEditProjectForm(p.id)}
                          className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-md"
                          title="Edit parameters"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {can('editProject') && (
                        <button
                          onClick={() => openCopyModalLauncher(p.id)}
                          className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-md"
                          title="Clone project"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Handle completed, tray, nontray, archive tabs
  const matchedProjects = projects.filter(p => {
    if (activeTab === 'completed') return p.status === 'completed' && !p.isArchived;
    if (activeTab === 'tray') return p.category === 'tray' && p.status !== 'completed' && !p.isArchived;
    if (activeTab === 'nontray') return p.category === 'nontray' && p.status !== 'completed' && !p.isArchived;
    if (activeTab === 'archive') return p.isArchived === true;
    return false;
  });

  return (
    <div className="space-y-4">
      <h2 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text">
        {activeTab === 'completed'
          ? 'Completed Log'
          : activeTab === 'tray'
            ? 'Tray Sub-directory'
            : activeTab === 'nontray'
              ? 'Non-Tray Sub-directory'
              : 'Historical Archive'}
      </h2>

      {matchedProjects.length === 0 ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-8 text-center text-sm text-base-muted font-medium">
          No projects found in this view.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 animate-fade-in">
          {matchedProjects.map(p => {
            const pct = calcPct(p);
            return (
              <div
                key={p.id}
                onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                className="bg-base-surface border border-base-border hover:border-base-border2 rounded-lg py-1.5 px-3 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 relative group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-base-accent shadow-[0_0_6px_var(--base-accent)]'}`} />
                  <div className="min-w-0">
                    <h3 className="font-condensed font-black text-sm text-base-text leading-tight truncate">{p.name}</h3>
                    <span className="text-[10px] font-condensed font-bold text-base-blue uppercase tracking-wide font-mono mt-0.5 block">{p.client}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-base-muted2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border/30">
                    Due: {p.due || 'No date'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider ${p.location === 'workshop1' ? 'bg-[#9b1c2e]/10 text-[#9b1c2e]/85 border border-[#9b1c2e]/20' : 'bg-base-blue/10 text-base-blue border border-base-blue/20'}`}>
                    {p.location === 'workshop1' ? 'W1' : 'W2'}
                  </span>
                  {(() => {
                    const usedHours = getManHoursForWorkOrder(p.client, timesheets);
                    const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                    const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                    return (
                      <span className={`font-extrabold text-[10px] uppercase font-condensed px-1.5 py-0.5 rounded border ${
                        isOverBudget
                          ? 'bg-red-500/10 text-red-500 border-red-500/30'
                          : 'bg-base-accent-dim/20 text-base-accent border-transparent'
                      }`}>
                        Hours: {fmtHrs(usedHours)}h{hasBudget ? ` / ${p.budgetHours}h` : ''}
                      </span>
                    );
                  })()}

                  {(() => {
                    const totalWire = (wireLogs || [])
                      .filter(wl => wl.projectId === p.id)
                      .reduce((sum, wl) => sum + wl.amountKg, 0);
                    if (totalWire === 0) return null;
                    return (
                      <span
                        className="flex items-center gap-1 font-extrabold text-[10px] uppercase font-condensed px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-500 border-amber-500/20 transition-all font-mono"
                        title="Total wire consumables logged"
                      >
                        <Flame className="h-2.5 w-2.5 animate-pulse" />
                        <span>Wire: {totalWire.toFixed(1)} kg</span>
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between lg:justify-end w-full lg:w-auto pt-1 lg:pt-0 border-t lg:border-t-0 border-base-border/10">
                  <div className="space-y-0.5 w-16">
                    <div className="flex justify-between items-center text-[9px] font-condensed font-bold text-base-muted2">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 bg-base-border/20 rounded-full overflow-hidden w-16">
                      <div className="h-full rounded-full bg-base-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {p.status === 'completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadProjectPDF(p, timesheets, wireLogs);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/25 text-emerald-500 rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1-sm p"
                        title="Download PDF"
                      >
                        <Download className="w-2.5 h-2.5" />
                        <span>PDF</span>
                      </button>
                    )}
                    {p.status === 'completed' && !p.isArchived && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveProject(p.id);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-base-accent-dim hover:bg-base-accent hover:text-white border border-base-accent/20 text-base-accent rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
                        title="Archive completed project"
                      >
                        <Archive className="w-2.5 h-2.5" />
                        <span>Archive</span>
                      </button>
                    )}
                    {p.isArchived && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unarchiveProject(p.id);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
                        title="Restore to Completed Log"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;
