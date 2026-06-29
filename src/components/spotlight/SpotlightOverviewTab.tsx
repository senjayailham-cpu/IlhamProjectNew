import React from 'react';
import { Project, Assembly, Task } from '../../types';
import { getManHoursForAssembly, fmtHrs } from '../../utils/projectUtils';
import { 
  ClipboardList, MapPin, Calendar, BookOpen, ChevronRight, 
  Clock, Flame, Edit2, Plus, Lock, Target, Trash2, FileText, Link2
} from 'lucide-react';

interface SpotlightOverviewTabProps {
  project: Project;
  asms: Assembly[];
  modalTimesheets: any[];
  wireLogs: any[];
  collapsedAsms: Record<string, boolean>;
  toggleAsm: (aid: string) => void;
  canAddTaskInline: boolean;
  canAddDifficulty: boolean;
  canDeleteTask: boolean;
  canUpdateTask: boolean;
  isAdmin: boolean;
  isOverdue: boolean;
  onUpdateProject?: (
    updatedProj: Project,
    logParams?: {
      type: string;
      action: string;
      asmName?: string;
      task?: string;
      oldP?: number;
      newP?: number;
    }
  ) => void;
  onEditAssembly?: (pid: string, aid: string) => void;
  setActiveTargetAssembly: (a: Assembly | null) => void;
  setTaskName: (n: string) => void;
  setTaskDifficulty: (d: number) => void;
  setTaskStart: (s: string) => void;
  setTaskFinish: (f: string) => void;
  setIsTaskModalOpen: (o: boolean) => void;
  setDeleteConfirm: (state: any) => void;
  
  quickTaskNames: Record<string, string>;
  setQuickTaskNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quickTaskDifficulty: Record<string, number>;
  setQuickTaskDifficulty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  quickTaskDates: Record<string, string>;
  setQuickTaskDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  quickTaskFinishDates: Record<string, string>;
  setQuickTaskFinishDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleQuickAddTask: (a: Assembly) => void;
  onOpenDepModal?: (rowKey: string) => void;
}

export function SpotlightOverviewTab({
  project,
  asms,
  modalTimesheets,
  wireLogs,
  collapsedAsms,
  toggleAsm,
  canAddTaskInline,
  canAddDifficulty,
  canDeleteTask,
  canUpdateTask,
  isAdmin,
  isOverdue,
  onUpdateProject,
  onEditAssembly,
  setActiveTargetAssembly,
  setTaskName,
  setTaskDifficulty,
  setTaskStart,
  setTaskFinish,
  setIsTaskModalOpen,
  setDeleteConfirm,
  quickTaskNames,
  setQuickTaskNames,
  quickTaskDifficulty,
  setQuickTaskDifficulty,
  quickTaskDates,
  setQuickTaskDates,
  quickTaskFinishDates,
  setQuickTaskFinishDates,
  handleQuickAddTask,
  onOpenDepModal,
}: SpotlightOverviewTabProps) {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Metadata parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {project.client && (
          <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-base-blue-dim flex items-center justify-center flex-shrink-0 text-base-blue">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Work Order</div>
              <div className="text-xs font-bold text-base-text mt-0.5 font-condensed uppercase tracking-wide">{project.client}</div>
            </div>
          </div>
        )}
        <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-base-green-dim flex items-center justify-center flex-shrink-0 text-base-green">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Location</div>
            <div className="text-xs font-bold text-base-text mt-0.5 capitalize">{project.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2'}</div>
          </div>
        </div>
        {project.start && (
          <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-yellow-400/10 flex items-center justify-center flex-shrink-0 text-yellow-600 dark:text-yellow-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Start date</div>
              <div className="text-xs font-bold text-base-text mt-0.5 font-mono">{project.start}</div>
            </div>
          </div>
        )}
        {project.targetMonth && (
          <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
            <div className="h-7 w-7 rounded bg-amber-400/10 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Target Month</div>
              <div className="text-xs font-bold text-base-text mt-0.5 font-mono">{project.targetMonth}</div>
            </div>
          </div>
        )}
        {project.due && (
          <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
            <div className={`h-7 w-7 rounded flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-base-red-dim text-base-red' : 'bg-base-border text-base-muted2'}`}>
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Due date</div>
              <div className={`text-xs font-bold mt-0.5 font-mono ${isOverdue ? 'text-base-red' : 'text-base-text'}`}>{project.due}</div>
            </div>
          </div>
        )}
      </div>

      {/* Project notes */}
      {project.notes && project.notes.trim() && (
        <div className="bg-base-surface2 border border-base-border rounded-lg p-3.5 space-y-1.5 shadow-xs">
          <div className="text-[10px] font-condensed font-bold text-base-muted uppercase tracking-wider flex items-center gap-1.5 leading-none">
            <FileText className="h-3.5 w-3.5 text-base-accent" />
            <span>Project Notes</span>
          </div>
          <p className="text-xs text-base-muted2 font-medium leading-relaxed italic pr-2 whitespace-pre-line">"{project.notes}"</p>
        </div>
      )}

      {/* Assemblies listings */}
      <div className="space-y-3.5">
        <h4 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-muted flex items-center gap-1.5 ml-1">
          <BookOpen className="h-4.5 w-4.5 text-base-accent" />
          <span>Sub-Assemblies and tasks progress ({asms.length})</span>
        </h4>
        <div className="space-y-3">
          {asms.length === 0 ? (
            <div className="text-xs text-base-muted italic pl-1">No sub-assemblies created for this project.</div>
          ) : (
            asms.map((a, idx) => {
              const tasks = a.tasks || [];
              const aDone = tasks.filter(t => t.done).length;
              const aTotal = tasks.length;
              const aPct = aTotal > 0 ? Math.round((aDone / aTotal) * 100) : 0;
              const isColl = !!collapsedAsms[a.id];

              return (
                <div key={a.id} className="bg-base-surface border border-base-border rounded-lg overflow-hidden shadow-xs">
                  {/* Sub-assembly bar leader */}
                  <div
                    onClick={() => toggleAsm(a.id)}
                    className="px-3.5 py-2.5 bg-base-surface2/60 hover:bg-base-surface2 border-b border-base-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ChevronRight className={`h-4 w-4 text-base-muted transition-transform ${isColl ? '' : 'rotate-90'}`} />
                      <span className="font-condensed font-extrabold text-xs uppercase tracking-wide text-base-text truncate">
                        {idx + 1}. {a.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap flex-shrink-0">
                      {(() => {
                        const usedHours = getManHoursForAssembly(project.client || '', a.id, modalTimesheets);
                        const hasBudget = a.budgetHours !== undefined && a.budgetHours > 0;
                        const isOverBudget = hasBudget && usedHours >= a.budgetHours;
                        return (
                          <span 
                            className={`inline-flex items-center gap-1 text-[10px] font-condensed font-extrabold uppercase px-1.5 py-0.5 rounded border transition-all ${
                              isOverBudget 
                                ? 'bg-red-500/15 text-red-500 border-red-500/40 animate-pulse font-black' 
                                : hasBudget
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                  : 'bg-base-border/40 text-base-muted2 border-transparent'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5 text-current" />
                            <span>
                              {fmtHrs(usedHours)}h 
                              {hasBudget && ` / ${a.budgetHours}h budget`}
                            </span>
                          </span>
                        );
                      })()}

                      {(() => {
                        const loggedWire = (wireLogs || []).filter(wl => wl.projectId === project.id && wl.assemblyId === a.id);
                        const totalWire = loggedWire.reduce((sum, wl) => sum + wl.amountKg, 0);
                        if (totalWire === 0) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-condensed font-extrabold uppercase px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-500 border-amber-500/30 transition-all" title="Total wire consumable taken by welders">
                            <Flame className="w-2.5 h-2.5 text-current animate-pulse" />
                            <span>{totalWire.toFixed(1)} kg Wire</span>
                          </span>
                        );
                      })()}

                      {onEditAssembly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditAssembly(project.id, a.id);
                          }}
                          className="p-1 rounded bg-base-surface3 border border-base-border hover:text-base-accent text-base-muted hover:border-base-border2 transition-all cursor-pointer"
                          title="Edit assembly parameters"
                        >
                          <Edit2 className="w-3 h-3 text-current" />
                        </button>
                      )}

                      <div className="w-12 h-1.5 bg-base-border/20 rounded-full overflow-hidden hidden md:block">
                        <div className="h-full rounded-full bg-base-blue transition-all duration-500 ease-out" style={{ width: `${aPct}%` }} />
                      </div>
                      <span className="font-condensed font-bold text-xs text-base-muted2">{aPct}%</span>
                      <span className="text-[10px] text-base-muted font-medium bg-base-border/20 px-1.5 py-0.5 rounded leading-none whitespace-nowrap">{aDone}/{aTotal}</span>
                    </div>
                  </div>

                  {/* Accordion task cards inside assembly */}
                  {!isColl && (
                    <div className="p-4 divide-y divide-base-border/40 select-text space-y-3">
                      {tasks.length === 0 ? (
                        <div className="text-xs text-base-muted py-8 px-4 text-center bg-base-surface3/10 rounded-xl border border-dashed border-base-border flex flex-col items-center gap-3">
                          <span className="italic">No tasks assigned to this sub-assembly yet.</span>
                          {canAddTaskInline && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTargetAssembly(a);
                                setTaskName('');
                                setTaskDifficulty(1);
                                setTaskStart('');
                                setTaskFinish('');
                                setIsTaskModalOpen(true);
                              }}
                              className="px-4 py-2 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-extrabold uppercase tracking-wider text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add First Task</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        tasks.map(t => {
                          const isLocked = t.pct === 100 && !isAdmin;
                          const handlePctChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                            if (isLocked) return;
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            if (onUpdateProject) {
                              const updatedAssemblies = asms.map(asm => {
                                if (asm.id !== a.id) return asm;
                                return {
                                  ...asm,
                                  tasks: asm.tasks.map(tsk => {
                                    if (tsk.id !== t.id) return tsk;
                                    return { ...tsk, pct: val, done: val >= 100 };
                                  })
                                };
                              });
                              onUpdateProject({ ...project, assemblies: updatedAssemblies }, {
                                type: 'task_progress',
                                action: `Updated task "${t.name}" progress to ${val}%`,
                                asmName: a.name,
                                task: t.name,
                                oldP: t.pct,
                                newP: val
                              });
                            }
                          };

                          const handleToggleDone = (checked: boolean) => {
                            if (isLocked) return;
                            const val = checked ? 100 : 0;
                            if (onUpdateProject) {
                              const updatedAssemblies = asms.map(asm => {
                                if (asm.id !== a.id) return asm;
                                return {
                                  ...asm,
                                  tasks: asm.tasks.map(tsk => {
                                    if (tsk.id !== t.id) return tsk;
                                    return { ...tsk, pct: val, done: checked };
                                  })
                                };
                              });
                              onUpdateProject({ ...project, assemblies: updatedAssemblies }, {
                                type: 'task_toggle',
                                action: checked ? `Marked task "${t.name}" as completed` : `Marked task "${t.name}" as incomplete`,
                                asmName: a.name,
                                task: t.name,
                                oldP: t.pct,
                                newP: val
                              });
                            }
                          };

                          return (
                            <div key={t.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-xs font-semibold hover:bg-base-surface2/30 px-1 rounded-sm transition-colors duration-150">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {canUpdateTask ? (
                                  <input
                                    type="checkbox"
                                    checked={t.done}
                                    disabled={isLocked}
                                    onChange={(e) => handleToggleDone(e.target.checked)}
                                    className={`h-4 w-4 rounded border-base-border text-base-accent focus:ring-base-accent accent-base-accent ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                  />
                                ) : (
                                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${t.done ? 'bg-base-green-dim text-base-green border-base-green/20' : 'border-base-border'}`}>
                                    {t.done && <span className="text-[10px]">✓</span>}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5">
                                  <span className={`text-base-text truncate ${t.done ? 'line-through text-base-muted font-normal' : ''}`} title={t.name}>
                                    {t.name}
                                  </span>
                                  {isLocked && (
                                    <Lock className="h-3 w-3 text-amber-500 shrink-0" title="Locked (100% complete - can only be edited by Admin)" />
                                  )}
                                  
                                  {/* Task date display / edit badge */}
                                  {canUpdateTask ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Start Date */}
                                      <div className="flex items-center gap-0.5" title="Set Task Start/Due Date">
                                        <span className="text-[9px] text-base-muted font-bold">S:</span>
                                        <Calendar className="w-2.5 h-2.5 text-base-muted" />
                                        <input
                                          type="date"
                                          value={t.date || ''}
                                          disabled={isLocked}
                                          onChange={(e) => {
                                            if (isLocked) return;
                                            const updatedAssemblies = asms.map(asm => {
                                              if (asm.id !== a.id) return asm;
                                              return {
                                                ...asm,
                                                tasks: asm.tasks.map(tsk => {
                                                  if (tsk.id !== t.id) return tsk;
                                                  return { ...tsk, date: e.target.value || undefined };
                                                })
                                              };
                                            });
                                            onUpdateProject && onUpdateProject({ ...project, assemblies: updatedAssemblies });
                                          }}
                                          className={`text-[10px] bg-transparent text-base-muted hover:text-base-text border-0 p-0 outline-none w-22 leading-none focus:text-base-accent ${isLocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
                                        />
                                      </div>
                                      {/* Finish Date */}
                                      <div className="flex items-center gap-0.5" title="Set Task Finish Date">
                                        <span className="text-[9px] text-emerald-500 font-bold">F:</span>
                                        <Calendar className="w-2.5 h-2.5 text-emerald-500/60" />
                                        <input
                                          type="date"
                                          value={t.finishDate || ''}
                                          disabled={isLocked}
                                          onChange={(e) => {
                                            if (isLocked) return;
                                            const updatedAssemblies = asms.map(asm => {
                                              if (asm.id !== a.id) return asm;
                                              return {
                                                ...asm,
                                                tasks: asm.tasks.map(tsk => {
                                                  if (tsk.id !== t.id) return tsk;
                                                  return { ...tsk, finishDate: e.target.value || undefined };
                                                })
                                              };
                                            });
                                            onUpdateProject && onUpdateProject({ ...project, assemblies: updatedAssemblies });
                                          }}
                                          className={`text-[10px] bg-transparent text-emerald-600 hover:text-emerald-500 border-0 p-0 outline-none w-22 leading-none focus:text-base-accent ${isLocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 shrink-0 text-[10px]">
                                      {t.date && (
                                        <span className="text-base-muted font-normal flex items-center gap-0.5 leading-none">
                                          <span className="font-bold text-[9px]">S:</span>
                                          <Calendar className="w-2.5 h-2.5" />
                                          <span>{t.date}</span>
                                        </span>
                                      )}
                                      {t.finishDate && (
                                        <span className="text-emerald-600 font-normal flex items-center gap-0.5 leading-none">
                                          <span className="font-bold text-[9px]">F:</span>
                                          <Calendar className="w-2.5 h-2.5" />
                                          <span>{t.finishDate}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                {onOpenDepModal && (
                                  <button
                                    onClick={() => onOpenDepModal(`t:${project.id}:${a.id}:${t.id}`)}
                                    className="px-2 py-1 rounded bg-base-accent-dim/20 hover:bg-base-accent-dim/50 text-base-accent hover:text-base-accent2 border border-base-accent/20 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-condensed font-bold uppercase tracking-wider"
                                    title="Set Predecessor"
                                  >
                                    <Link2 className="w-3.5 h-3.5 text-current" />
                                    <span>Set Predecessor</span>
                                  </button>
                                )}

                                {canAddDifficulty ? (
                                  <div className="flex items-center gap-1.5 bg-base-surface3/30 px-2 py-1 rounded border border-base-border/50">
                                    <span className="text-[9px] text-base-muted font-bold select-none uppercase tracking-wider font-condensed">Diff:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="20"
                                      value={typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1}
                                      disabled={isLocked}
                                      onChange={(e) => {
                                        if (isLocked) return;
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        const updatedAssemblies = asms.map(asm => {
                                          if (asm.id !== a.id) return asm;
                                          return {
                                            ...asm,
                                            tasks: asm.tasks.map(tsk => {
                                              if (tsk.id !== t.id) return tsk;
                                              return { ...tsk, difficulty: val };
                                            })
                                          };
                                        });
                                        onUpdateProject && onUpdateProject({ ...project, assemblies: updatedAssemblies });
                                      }}
                                      className={`w-10 text-center bg-base-bg border border-base-border rounded text-[10px] text-base-text font-bold outline-none focus:border-base-accent ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-base-muted select-none flex items-center gap-1 bg-base-surface3/20 px-2 py-0.5 rounded">
                                    Diff: <span className="font-bold text-base-accent font-mono">{typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1}</span>
                                  </span>
                                )}
                                
                                {canUpdateTask ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={t.pct}
                                      disabled={isLocked}
                                      onChange={handlePctChange}
                                      className={`w-12 px-1.5 py-0.5 bg-base-bg text-center font-mono text-xs font-extrabold border rounded focus:border-base-accent outline-none ${isLocked ? 'cursor-not-allowed opacity-50' : ''} ${t.pct >= 100 ? 'text-base-green border-base-green/25' : t.pct > 50 ? 'text-base-accent border-base-accent/25' : 'text-base-blue border-base-border'}`}
                                    />
                                    <span className="text-[10px] text-base-muted font-bold">%</span>
                                  </div>
                                ) : (
                                  <span className={`font-condensed font-bold text-xs ${t.pct >= 100 ? 'text-base-green' : t.pct > 50 ? 'text-base-accent' : 'text-base-blue'}`}>
                                    {t.pct}%
                                  </span>
                                )}

                                {/* Milestone Toggle / Indicator */}
                                {canUpdateTask ? (
                                  <button
                                    onClick={() => {
                                      if (isLocked) return;
                                      const updatedAssemblies = asms.map(asm => {
                                        if (asm.id !== a.id) return asm;
                                        return {
                                          ...asm,
                                          tasks: asm.tasks.map(tsk => {
                                            if (tsk.id !== t.id) return tsk;
                                            const nextIsMilestone = !tsk.isMilestone;
                                            return {
                                              ...tsk,
                                              isMilestone: nextIsMilestone,
                                              finishDate: nextIsMilestone ? (tsk.date || new Date().toISOString().slice(0, 10)) : tsk.finishDate
                                            };
                                          })
                                        };
                                      });
                                      onUpdateProject && onUpdateProject({ ...project, assemblies: updatedAssemblies });
                                    }}
                                    disabled={isLocked}
                                    className={`p-1 rounded transition-colors ${isLocked ? 'cursor-not-allowed opacity-50' : ''} ${t.isMilestone ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'text-base-muted hover:text-amber-500 hover:bg-base-surface3/40'}`}
                                    title={t.isMilestone ? "Marked as Milestone" : "Mark as Milestone"}
                                  >
                                    <Target className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  t.isMilestone && (
                                    <span className="p-1 rounded text-amber-500 bg-amber-500/10 cursor-default" title="Milestone">
                                      <Target className="w-3.5 h-3.5" />
                                    </span>
                                  )
                                )}

                                {/* Inline Delete Button */}
                                {canDeleteTask && !isLocked && (
                                  <button
                                    onClick={() => {
                                      setDeleteConfirm({
                                        isOpen: true,
                                        title: 'Delete Task Record',
                                        message: `Are you sure you want to permanently delete task "${t.name}"? This will remove its scheduling and tracking records.`,
                                        onConfirm: () => {
                                          const updatedAssemblies = asms.map(asm => {
                                            if (asm.id !== a.id) return asm;
                                            return {
                                              ...asm,
                                              tasks: asm.tasks.filter(tsk => tsk.id !== t.id)
                                            };
                                          });
                                          onUpdateProject && onUpdateProject({ ...project, assemblies: updatedAssemblies }, {
                                            type: 'task_delete',
                                            action: `Deleted task "${t.name}" from assembly "${a.name}"`,
                                            asmName: a.name,
                                            task: t.name
                                          });
                                          setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
                                        }
                                      });
                                    }}
                                    className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/10 transition-colors"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}

                      {/* Dedicated Add Task Pop-up Trigger Button */}
                      {canAddTaskInline && tasks.length > 0 && (
                        <div className="pt-4 pb-1 border-t border-base-border/30 mt-3 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTargetAssembly(a);
                              setTaskName('');
                              setTaskDifficulty(1);
                              setTaskStart('');
                              setTaskFinish('');
                              setIsTaskModalOpen(true);
                            }}
                            className="w-full sm:w-auto px-5 py-2.5 bg-base-accent/10 border border-base-accent/25 hover:border-base-accent text-base-accent hover:bg-base-accent hover:text-white rounded-xl font-condensed font-extrabold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all duration-200 animate-in fade-in"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Task to {a.name}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
