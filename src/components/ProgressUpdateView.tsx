import React, { useState, useMemo, useEffect } from 'react';
import { Project, Task, User } from '../types';
import { Search, ChevronDown, ChevronRight, CheckCircle2, Layers } from 'lucide-react';
import { can } from '../utils/permissions';

interface ProgressUpdateViewProps {
  projects: Project[];
  onUpdateProject: (project: Project) => void;
  currentUser: User | null;
}

function saveProgress(
  projects: Project[],
  projectId: string,
  taskId: string,
  newPct: number,
  onUpdateProject: (project: Project) => void
) {
  const proj = projects.find(p => p.id === projectId);
  if (!proj) return;
  const pct = Math.max(0, Math.min(100, newPct));
  const updated: Project = JSON.parse(JSON.stringify(proj));
  
  if (updated.assemblies) {
    for (const asm of updated.assemblies) {
      if (asm.tasks) {
        const task = asm.tasks.find(t => t.id === taskId);
        if (task) {
          task.pct = pct;
          task.done = pct >= 100;
          break;
        }
      }
    }
  }
  onUpdateProject(updated);
}

export default function ProgressUpdateView({ projects, onUpdateProject, currentUser }: ProgressUpdateViewProps) {
  const canUpdateTask = can(currentUser, 'updateTask');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [flashingTaskId, setFlashingTaskId] = useState<string | null>(null);

  const relevantProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return projects
      .filter(p => p.status !== 'completed' && !p.isArchived)
      .map(p => {
        const tasks = (p.assemblies || []).flatMap(asm =>
          (asm.tasks || []).map(t => ({ ...t, assemblyName: asm.name, assemblyId: asm.id }))
        );
        const projectMatchesWO = p.client && p.client.toLowerCase().includes(q);
        const filteredTasks = tasks.filter(t => {
          if (hideCompleted && (t.pct >= 100 || t.done)) return false;
          if (!q) return true;
          // Jika WO project cocok, tampilkan SEMUA task di project ini
          // (bukan hanya task yang namanya cocok)
          if (projectMatchesWO) return true;
          return (
            t.name.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            t.assemblyName.toLowerCase().includes(q)
          );
        });
        return { project: p, tasks: filteredTasks };
      })
      .filter(group => {
        if (!searchQuery.trim()) return group.tasks.length > 0;
        const woMatch = group.project.client && group.project.client.toLowerCase().includes(q);
        const nameMatch = group.project.name.toLowerCase().includes(q);
        return group.tasks.length > 0 || woMatch || nameMatch;
      });
  }, [projects, searchQuery, hideCompleted]);

  const totalTaskCount = useMemo(
    () => relevantProjects.reduce((sum, g) => sum + g.tasks.length, 0),
    [relevantProjects]
  );

  useEffect(() => {
    const q = searchQuery.trim();

    if (!q) {
      // Search dikosongkan — kembalikan ke pilihan manual user
      setCollapsedProjects(manualOverride);
      return;
    }

    // Ada query — auto-expand project yang match, auto-collapse yang tidak
    const matchingIds = new Set(relevantProjects.map(g => g.project.id));
    setCollapsedProjects(prev => {
      const next: Record<string, boolean> = { ...prev };
      projects.forEach(p => {
        next[p.id] = !matchingIds.has(p.id);
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, relevantProjects.length]);

  const toggleProject = (projectId: string) => {
    setCollapsedProjects(prev => {
      const current = prev[projectId] ?? true;
      const next = { ...prev, [projectId]: !current };
      setManualOverride(m => {
        const currentManual = m[projectId] ?? true;
        return { ...m, [projectId]: !currentManual };
      });
      return next;
    });
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    projects.forEach(p => { next[p.id] = true; });
    setCollapsedProjects(next);
    setManualOverride(next);
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    projects.forEach(p => { next[p.id] = false; });
    setCollapsedProjects(next);
    setManualOverride(next);
  };

  const quickUpdate = (projectId: string, taskId: string, currentPct: number, delta: number | 'done') => {
    const newPct = delta === 'done' ? 100 : Math.min(100, currentPct + delta);
    saveProgress(projects, projectId, taskId, newPct, onUpdateProject);
    setFlashingTaskId(taskId);
    setTimeout(() => setFlashingTaskId(null), 500);
  };

  return (
    <div className="space-y-4">
      {/* HEADER + FILTER BAR */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3 justify-between" id="progress-header">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-base-accent" />
          <h2 className="font-condensed font-extrabold uppercase text-base tracking-wider text-base-text">
            Update Progress
          </h2>
          <span className="text-xs font-condensed font-bold bg-base-accent/10 text-base-accent px-2 py-0.5 rounded-full">
            {totalTaskCount} tasks
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search WO, project, or task..."
              className="pl-8 pr-3 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs w-64 focus:border-base-accent outline-none text-base-text"
              id="progress-search-input"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs font-condensed font-bold text-base-muted2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={e => setHideCompleted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-base-border text-base-accent cursor-pointer"
              id="progress-hide-completed-checkbox"
            />
            Hide completed
          </label>

          <div className="h-4 w-px bg-base-border mx-1" />

          <button
            onClick={collapseAll}
            className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase bg-base-surface2 border border-base-border rounded-lg hover:bg-base-surface3 hover:text-base-text text-base-muted2 cursor-pointer transition-colors"
          >
            Collapse All
          </button>
          <button
            onClick={expandAll}
            className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase bg-base-surface2 border border-base-border rounded-lg hover:bg-base-surface3 hover:text-base-text text-base-muted2 cursor-pointer transition-colors"
          >
            Expand All
          </button>
        </div>
      </div>

      {/* EMPTY STATE */}
      {relevantProjects.length === 0 && (
        <div className="bg-base-surface border border-base-border border-dashed rounded-xl p-12 text-center text-base-muted" id="progress-empty-state">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/50" />
          <p className="text-sm font-semibold">
            {hideCompleted ? 'All tasks are complete, or no tasks match your search.' : 'No tasks found.'}
          </p>
        </div>
      )}

      {/* PROJECT GROUPS */}
      {relevantProjects.map(({ project, tasks }) => {
        const isCollapsed = collapsedProjects[project.id] ?? true;
        return (
          <div key={project.id} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden" id={`project-group-${project.id}`}>
            <div
              onClick={() => toggleProject(project.id)}
              className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-base-surface3/40 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-base-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-base-muted shrink-0" />}
                <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text truncate">
                  {project.name}
                </span>
                <span className={`text-[10px] font-mono uppercase shrink-0 px-1.5 py-0.5 rounded ${
                  searchQuery.trim() && project.client?.toLowerCase().includes(searchQuery.toLowerCase().trim())
                    ? 'bg-base-accent/15 text-base-accent font-bold'
                    : 'text-base-blue'
                }`}>
                  {project.client}
                </span>
                {searchQuery.trim() && !isCollapsed && (
                  <span className="text-[9px] font-condensed font-bold uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                    Auto-expanded
                  </span>
                )}
              </div>
              <span className="px-2 py-0.5 text-[10px] bg-base-border/25 rounded font-bold text-base-accent leading-none shrink-0">
                {tasks.length} tasks
              </span>
            </div>

            {!isCollapsed && (
              <div className="relative group/scroll">
                {/* Horizontal Scroll Helper on Mobile */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5 border-b border-base-border/50 md:hidden text-[10px] text-amber-600 font-bold font-condensed uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <span>↔ Scroll horizontally for all columns</span>
                  </span>
                  <span className="animate-pulse">Swipe Left/Right 👉</span>
                </div>

                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-base-border scrollbar-track-transparent">
                  <table className="w-full text-left border-collapse text-xs min-w-[500px] sm:min-w-0">
                    <thead>
                      <tr className="bg-base-surface2/50 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                        <th className="px-2 sm:px-4 py-2">Assembly</th>
                        <th className="px-2 sm:px-4 py-2">Task</th>
                        <th className="px-2 sm:px-4 py-2 text-center w-20 sm:w-24">Progress</th>
                        {canUpdateTask && <th className="px-2 sm:px-4 py-2 text-center w-48 sm:w-64">Quick Update</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-border text-base-text">
                      {tasks.map(t => {
                        const isEditing = editingTaskId === t.id;
                        const isFlashing = flashingTaskId === t.id;
                        return (
                          <tr key={t.id} className={`transition-colors ${isFlashing ? 'bg-emerald-500/10' : 'hover:bg-base-surface2/30'}`} id={`task-row-${t.id}`}>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-base-muted2 font-semibold truncate max-w-[100px] sm:max-w-none" title={t.assemblyName}>
                              {t.assemblyName}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 font-semibold truncate max-w-[120px] sm:max-w-none" title={t.name}>
                              {t.name}
                              {t.isMilestone && (
                                <span className="ml-1.5 px-1 py-0.5 text-[8px] bg-base-blue/10 text-base-blue rounded font-bold uppercase">MS</span>
                              )}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-center">
                              {isEditing && canUpdateTask ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  defaultValue={t.pct}
                                  autoFocus
                                  onBlur={e => {
                                    const val = parseInt(e.target.value, 10);
                                    saveProgress(projects, project.id, t.id, isNaN(val) ? 0 : val, onUpdateProject);
                                    setEditingTaskId(null);
                                    setFlashingTaskId(t.id);
                                    setTimeout(() => setFlashingTaskId(null), 500);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditingTaskId(null);
                                  }}
                                  className="w-14 sm:w-16 px-1.5 py-1 bg-base-bg text-center font-mono text-xs font-extrabold border border-base-accent rounded outline-none text-base-text"
                                  id={`task-input-${t.id}`}
                                />
                              ) : canUpdateTask ? (
                                <button
                                  onClick={() => setEditingTaskId(t.id)}
                                  className={`w-14 sm:w-16 px-1.5 py-1 font-mono text-xs font-extrabold border rounded cursor-pointer transition-colors ${
                                    t.pct >= 100 ? 'text-emerald-500 border-emerald-500/25 bg-emerald-500/5' :
                                    t.pct > 50 ? 'text-base-accent border-base-accent/25' :
                                    'text-base-blue border-base-border'
                                  }`}
                                  id={`task-pct-btn-${t.id}`}
                                >
                                  {t.pct}%
                                </button>
                              ) : (
                                <span
                                  className={`inline-block w-14 sm:w-16 px-1.5 py-1 font-mono text-xs font-extrabold border rounded select-none ${
                                    t.pct >= 100 ? 'text-emerald-500 border-emerald-500/25 bg-emerald-500/5' :
                                    t.pct > 50 ? 'text-base-accent border-base-accent/25' :
                                    'text-base-blue border-base-border'
                                  }`}
                                >
                                  {t.pct}%
                                </span>
                              )}
                            </td>
                            {canUpdateTask && (
                              <td className="px-2 sm:px-4 py-2 sm:py-2.5">
                                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                                  <button
                                    onClick={() => quickUpdate(project.id, t.id, t.pct, 10)}
                                    disabled={t.pct >= 100}
                                    className="px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] font-condensed font-extrabold bg-base-surface2 border border-base-border rounded hover:bg-base-accent hover:text-white hover:border-base-accent transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-base-text"
                                    id={`task-add10-btn-${t.id}`}
                                  >
                                    +10%
                                  </button>
                                  <button
                                    onClick={() => quickUpdate(project.id, t.id, t.pct, 25)}
                                    disabled={t.pct >= 100}
                                    className="px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] font-condensed font-extrabold bg-base-surface2 border border-base-border rounded hover:bg-base-accent hover:text-white hover:border-base-accent transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-base-text"
                                    id={`task-add25-btn-${t.id}`}
                                  >
                                    +25%
                                  </button>
                                  <button
                                    onClick={() => quickUpdate(project.id, t.id, t.pct, 'done')}
                                    disabled={t.pct >= 100}
                                    className="px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] font-condensed font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded hover:bg-emerald-500 hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                                    id={`task-done-btn-${t.id}`}
                                  >
                                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                                    Done
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
