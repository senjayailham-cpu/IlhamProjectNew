import React, { useState } from 'react';
import { User, Project, Assembly, Task } from '../types';
import { calcPct, calcTaskCounts, getManHoursForWorkOrder, getManHoursForAssembly, fmtHrs, esc } from '../utils/projectUtils';
import { ClipboardList, Users, MapPin, Calendar, Clock, BookOpen, AlertTriangle, FileText, ChevronRight, Edit2, Trash2, Plus, Flame, Download, Target, Lock } from 'lucide-react';
import { downloadProjectPDF } from '../utils/pdfGenerator';

interface SpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projects: Project[];
  timesheets: any[];
  wireLogs?: any[];
  onEdit: (pid: string) => void;
  onEditAssembly?: (pid: string, aid: string) => void;
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
  canUpdateTask?: boolean;
  canAddTaskInline?: boolean;
  canAddDifficulty?: boolean;
  canDeleteTask?: boolean;
  currentUser?: User | null;
  canEditProjectParams?: boolean;
  selectedMonth?: string;
}

const BAR_COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c'];
const STATUS_COLORS = {
  active: 'bg-base-blue-dim text-base-blue border-base-blue/20',
  pending: 'bg-yellow-400/10 text-yellow-600 border-yellow-500/20',
  completed: 'bg-base-green-dim text-base-green border-base-green/20',
  'on-hold': 'bg-base-border/50 text-base-muted2 border-base-border'
};

export default function SpotlightModal({
  isOpen,
  onClose,
  projectId,
  projects,
  timesheets,
  wireLogs = [],
  onEdit,
  onEditAssembly,
  onUpdateProject,
  canUpdateTask = true,
  canAddTaskInline = true,
  canAddDifficulty = true,
  canDeleteTask = true,
  currentUser = null,
  canEditProjectParams = true,
  selectedMonth
}: SpotlightModalProps) {
  const isAdmin = currentUser?.role === 'admin';
  const [collapsedAsms, setCollapsedAsms] = useState<Record<string, boolean>>({});
  const [quickTaskNames, setQuickTaskNames] = useState<Record<string, string>>({});
  const [quickTaskDifficulty, setQuickTaskDifficulty] = useState<Record<string, number>>({});
  const [quickTaskDates, setQuickTaskDates] = useState<Record<string, string>>({});
  const [quickTaskFinishDates, setQuickTaskFinishDates] = useState<Record<string, string>>({});

  // Dedicated Add Task Pop-up Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTargetAssembly, setActiveTargetAssembly] = useState<Assembly | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDifficulty, setTaskDifficulty] = useState(1);
  const [taskStart, setTaskStart] = useState('');
  const [taskFinish, setTaskFinish] = useState('');

  // Custom Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  if (!isOpen || !projectId) return null;
  const p = projects.find(x => x.id === projectId);
  if (!p) return null;

  const modalTimesheets = selectedMonth
    ? timesheets.filter(ts => ts.date && ts.date.slice(0, 7) === selectedMonth)
    : timesheets;

  const pct = calcPct(p);
  const { total: totalTasks, done: doneTasks } = calcTaskCounts(p);
  const asms = p.assemblies || [];

  const toggleAsm = (aid: string) => {
    setCollapsedAsms(prev => ({ ...prev, [aid]: !prev[aid] }));
  };

  const handleQuickAddTask = (a: Assembly) => {
    const nameVal = quickTaskNames[a.id] || '';
    if (!nameVal.trim()) return;

    const newTask: Task = {
      id: 'tsk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      name: nameVal.trim(),
      difficulty: quickTaskDifficulty[a.id] || 1,
      pct: 0,
      done: false,
      date: quickTaskDates[a.id] || undefined,
      finishDate: quickTaskFinishDates[a.id] || undefined
    };

    const updatedAssemblies = asms.map(asm => {
      if (asm.id !== a.id) return asm;
      return {
        ...asm,
        tasks: [...(asm.tasks || []), newTask]
      };
    });

    if (onUpdateProject) {
      onUpdateProject({
        ...p,
        assemblies: updatedAssemblies
      }, {
        type: 'task_add',
        action: `Added task "${newTask.name}" to assembly "${a.name}"`,
        asmName: a.name,
        task: newTask.name,
        oldP: undefined,
        newP: 0
      });
    }

    // Reset inputs
    setQuickTaskNames(prev => ({ ...prev, [a.id]: '' }));
    setQuickTaskDifficulty(prev => ({ ...prev, [a.id]: 1 }));
    setQuickTaskDates(prev => ({ ...prev, [a.id]: '' }));
    setQuickTaskFinishDates(prev => ({ ...prev, [a.id]: '' }));
  };

  const handleSaveNewTask = () => {
    if (!activeTargetAssembly) return;
    if (!taskName.trim()) return;

    const newTask: Task = {
      id: 'tsk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      name: taskName.trim(),
      difficulty: taskDifficulty,
      pct: 0,
      done: false,
      date: taskStart || undefined,
      finishDate: taskFinish || undefined
    };

    const updatedAssemblies = asms.map(asm => {
      if (asm.id !== activeTargetAssembly.id) return asm;
      return {
        ...asm,
        tasks: [...(asm.tasks || []), newTask]
      };
    });

    if (onUpdateProject) {
      onUpdateProject({
        ...p,
        assemblies: updatedAssemblies
      }, {
        type: 'task_add',
        action: `Added task "${newTask.name}" to assembly "${activeTargetAssembly.name}"`,
        asmName: activeTargetAssembly.name,
        task: newTask.name,
        oldP: undefined,
        newP: 0
      });
    }

    // Reset and close
    setTaskName('');
    setTaskDifficulty(1);
    setTaskStart('');
    setTaskFinish('');
    setIsTaskModalOpen(false);
    setActiveTargetAssembly(null);
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = p.due && p.due < todayStr && p.status !== 'completed';

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-base-bg border border-base-border2 rounded-xl shadow-modal w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 ease-out duration-150">
        
        {/* Header Band */}
        <div className="px-5 py-4 border-b border-base-border flex items-start gap-3 bg-linear-to-b from-base-accent-dim/20 to-transparent relative">
          <div className="h-11 w-11 rounded-lg bg-base-accent-dim border border-base-accent/25 flex items-center justify-center flex-shrink-0 shadow-xs">
            <ClipboardList className="h-5.5 w-5.5 text-base-accent" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-condensed font-extrabold text-xl text-base-text leading-tight truncate">{p.name}</h3>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className={`px-2.5 py-0.5 rounded font-condensed font-extrabold text-[10px] uppercase tracking-wider border ${STATUS_COLORS[p.status]}`}>
                {p.status}
              </span>
              <span className="px-2 py-0.5 text-[10px] rounded font-condensed font-bold uppercase tracking-wider bg-base-blue-dim text-base-blue border border-base-blue/20">
                {p.category === 'tray' ? 'Tray' : 'Non-Tray'}
              </span>
              <span className="px-2 py-0.5 text-[10px] rounded font-condensed font-bold uppercase tracking-wider bg-base-green-dim text-base-green border border-base-green/20">
                {p.location === 'workshop1' ? 'WS 1' : 'WS 2'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer font-bold text-sm">✕</button>
        </div>

        {/* Stats segment grid */}
        <div className="grid grid-cols-4 divide-x divide-base-border border-b border-base-border text-center bg-base-surface">
          <div className="py-3">
            <div className="text-2xl font-condensed font-extrabold text-base-accent">{pct}%</div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Overall Progress</div>
          </div>
          <div className="py-3">
            <div className="text-2xl font-condensed font-extrabold text-base-text">{doneTasks}/{totalTasks}</div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Tasks complete</div>
          </div>
          <div className="py-3">
            <div className="text-2xl font-condensed font-extrabold text-base-text">{asms.length}</div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Assemblies</div>
          </div>
          <div className="py-3">
            <div className={`text-2.5xl font-condensed font-extrabold ${isOverdue ? 'text-base-red' : 'text-base-text'}`}>
              {p.due ? p.due.slice(5) : '—'}
            </div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Due date</div>
          </div>
        </div>

        {/* Progress Fill bar (Decorative) */}
        <div className="p-4 border-b border-base-border bg-base-surface2/50">
          <div className="flex justify-between items-center text-xs font-condensed font-bold text-base-muted2 mb-1.5">
            <span>Overall completion progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-base-border/20 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-linear-to-r from-base-accent2 to-base-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Center body columns */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {p.client && (
              <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
                <div className="h-7 w-7 rounded bg-base-blue-dim flex items-center justify-center flex-shrink-0 text-base-blue">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Work Order</div>
                  <div className="text-xs font-bold text-base-text mt-0.5 font-condensed uppercase tracking-wide">{p.client}</div>
                </div>
              </div>
            )}
            <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
              <div className="h-7 w-7 rounded bg-base-green-dim flex items-center justify-center flex-shrink-0 text-base-green">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Location</div>
                <div className="text-xs font-bold text-base-text mt-0.5 capitalize">{p.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2'}</div>
              </div>
            </div>
            {p.start && (
              <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
                <div className="h-7 w-7 rounded bg-yellow-400/10 flex items-center justify-center flex-shrink-0 text-yellow-600 dark:text-yellow-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Start date</div>
                  <div className="text-xs font-bold text-base-text mt-0.5 font-mono">{p.start}</div>
                </div>
              </div>
            )}
            {p.targetMonth && (
              <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
                <div className="h-7 w-7 rounded bg-amber-400/10 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Target Month</div>
                  <div className="text-xs font-bold text-base-text mt-0.5 font-mono">{p.targetMonth}</div>
                </div>
              </div>
            )}
            {p.due && (
              <div className="bg-base-surface border border-base-border rounded-lg p-3 flex items-center gap-3">
                <div className={`h-7 w-7 rounded flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-base-red-dim text-base-red' : 'bg-base-border text-base-muted2'}`}>
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider">Due date</div>
                  <div className={`text-xs font-bold mt-0.5 font-mono ${isOverdue ? 'text-base-red' : 'text-base-text'}`}>{p.due}</div>
                </div>
              </div>
            )}
          </div>

          {/* Project notes */}
          {p.notes && p.notes.trim() && (
            <div className="bg-base-surface2 border border-base-border rounded-lg p-3.5 space-y-1.5 shadow-xs">
              <div className="text-[10px] font-condensed font-bold text-base-muted uppercase tracking-wider flex items-center gap-1.5 leading-none">
                <FileText className="h-3.5 w-3.5 text-base-accent" />
                <span>Project Notes</span>
              </div>
              <p className="text-xs text-base-muted2 font-medium leading-relaxed italic pr-2 whitespace-pre-line">"{p.notes}"</p>
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
                            const usedHours = getManHoursForAssembly(p.client || '', a.id, modalTimesheets);
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
                            const loggedWire = (wireLogs || []).filter(wl => wl.projectId === p.id && wl.assemblyId === a.id);
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
                                onEditAssembly(p.id, a.id);
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
                                  onUpdateProject({ ...p, assemblies: updatedAssemblies }, {
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
                                  onUpdateProject({ ...p, assemblies: updatedAssemblies }, {
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
                                                onUpdateProject && onUpdateProject({ ...p, assemblies: updatedAssemblies });
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
                                                onUpdateProject && onUpdateProject({ ...p, assemblies: updatedAssemblies });
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
                                            onUpdateProject && onUpdateProject({ ...p, assemblies: updatedAssemblies });
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
                                          onUpdateProject && onUpdateProject({ ...p, assemblies: updatedAssemblies });
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
                                              onUpdateProject && onUpdateProject({ ...p, assemblies: updatedAssemblies }, {
                                                type: 'task_delete',
                                                action: `Deleted task "${t.name}" from assembly "${a.name}"`,
                                                asmName: a.name,
                                                task: t.name
                                              });
                                              setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
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

                          {/* Quick Add Form Section */}
                          {canAddTaskInline && (
                            <div className="pt-3 pb-1 border-t border-base-border/30 mt-1.5 hidden">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  placeholder="Quick add new task name..."
                                  value={quickTaskNames[a.id] || ''}
                                  onChange={(e) => setQuickTaskNames(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleQuickAddTask(a);
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 text-xs bg-base-bg border border-base-border rounded focus:border-base-accent outline-none font-semibold"
                                />
                                <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                                  <div className="flex items-center gap-1 bg-base-bg border border-base-border rounded focus-within:border-base-accent px-2 py-1">
                                    <span className="text-[10px] text-base-muted font-bold select-none">Diff:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="20"
                                      value={quickTaskDifficulty[a.id] || 1}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        setQuickTaskDifficulty(prev => ({ ...prev, [a.id]: val }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleQuickAddTask(a);
                                        }
                                      }}
                                      className="w-10 text-center bg-transparent border-none outline-none font-bold text-xs text-base-text"
                                    />
                                  </div>
                                  <div className="flex gap-1 items-center flex-wrap sm:flex-nowrap">
                                    <input
                                      type="date"
                                      value={quickTaskDates[a.id] || ''}
                                      onChange={(e) => setQuickTaskDates(prev => ({ ...prev, [a.id]: e.target.value }))}
                                      className="w-24 px-1 py-1 text-[10px] bg-base-bg border border-base-border rounded focus:border-base-accent outline-none font-semibold cursor-pointer text-base-muted"
                                      title="Start Date"
                                    />
                                    <span className="text-[10px] text-base-muted font-bold">to</span>
                                    <input
                                      type="date"
                                      value={quickTaskFinishDates[a.id] || ''}
                                      onChange={(e) => setQuickTaskFinishDates(prev => ({ ...prev, [a.id]: e.target.value }))}
                                      className="w-24 px-1 py-1 text-[10px] bg-base-bg border border-base-border rounded focus:border-base-accent outline-none font-semibold cursor-pointer text-emerald-600"
                                      title="Finish Date"
                                    />
                                    <button
                                      onClick={() => handleQuickAddTask(a)}
                                      className="px-3 py-1.5 bg-base-accent hover:bg-base-accent2 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 shrink-0 ml-1"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
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

        {/* Global properties edit button */}
        <div className="px-5 py-3 border-t border-base-border flex items-center justify-between flex-shrink-0 bg-base-surface2 text-xs">
          <div className="text-base-muted font-condensed font-bold uppercase tracking-wider text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1 leading-none">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Man-hours used: {p.client ? fmtHrs(getManHoursForWorkOrder(p.client, modalTimesheets)) : 0}h {selectedMonth ? `in ${selectedMonth}` : 'Total'}</span>
            </div>
            {(() => {
              const totalWire = (wireLogs || [])
                .filter(wl => wl.projectId === p.id)
                .reduce((sum, wl) => sum + wl.amountKg, 0);
              if (totalWire === 0) return null;
              return (
                <div className="flex items-center gap-1 border-l border-base-border/50 pl-3 text-amber-500">
                  <Flame className="h-4 w-4 text-amber-500 animate-pulse" />
                  <span>Wire consumable: {totalWire.toFixed(1)} kg Total</span>
                </div>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.status === 'completed' && (
              <button
                onClick={() => downloadProjectPDF(p, timesheets, wireLogs || [])}
                className="px-3.5 py-1.5 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all"
                title="Download completion report in PDF format"
              >
                <Download className="h-4 w-4" />
                <span>Export PDF</span>
              </button>
            )}
            <button onClick={onClose} className="px-3.5 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Close</button>
            {canEditProjectParams && (
              <button
                id="spl-edit-btn"
                onClick={() => onEdit(p.id)}
                className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Edit parameters
              </button>
            )}
          </div>
        </div>

      </div>
    </div>

    {/* Dedicated Add Task Pop-up Modal */}
    {isTaskModalOpen && activeTargetAssembly && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-100">
        <div className="bg-base-surface border border-base-border2 rounded-2xl shadow-modal w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 ease-out duration-150 relative text-base-text select-text">
          <div className="flex items-center gap-2.5 border-b border-base-border pb-3.5">
            <div className="h-9 w-9 rounded-lg bg-base-accent-dim border border-base-accent/20 flex items-center justify-center shrink-0">
              <Plus className="h-5 w-5 text-base-accent" />
            </div>
            <div>
              <h3 className="font-condensed font-extrabold uppercase text-sm tracking-wide text-base-text leading-none">Add Task to Assembly</h3>
              <p className="text-[10px] font-medium text-base-muted2 uppercase tracking-wider mt-1.5 truncate max-w-[280px]" title={activeTargetAssembly.name}>
                For: {activeTargetAssembly.name}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            <div className="space-y-1.5">
              <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-accent block">Task Name</label>
              <input
                type="text"
                autoFocus
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Panel structural check"
                className="w-full px-3.5 py-2.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-xs font-semibold text-base-text transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNewTask();
                  }
                }}
              />
            </div>

            {canAddDifficulty ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Difficulty (1-20)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={taskDifficulty}
                  onChange={(e) => setTaskDifficulty(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="w-full px-3.5 py-2 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-xs font-bold text-base-text transition-all"
                />
              </div>
            ) : (
              <input type="hidden" value={taskDifficulty} />
            )}

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Start Date (S)</label>
                <input
                  type="date"
                  value={taskStart}
                  onChange={(e) => setTaskStart(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-[11px] font-semibold text-base-text transition-all cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Finish Date (F)</label>
                <input
                  type="date"
                  value={taskFinish}
                  onChange={(e) => setTaskFinish(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-[11px] font-semibold text-emerald-600 transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-base-border/30 pt-3.5 mt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsTaskModalOpen(false);
                setActiveTargetAssembly(null);
              }}
              className="px-4 py-2 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNewTask}
              disabled={!taskName.trim()}
              className="px-5 py-2 bg-base-accent text-white hover:bg-base-accent2 disabled:opacity-55 disabled:cursor-not-allowed rounded-lg font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all shadow-md"
            >
              Save Task
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Custom Delete Confirmation Modal */}
    {deleteConfirm.isOpen && (
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-[60] animate-fade-in animate-duration-200">
        <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5 text-left">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/10 rounded-full text-red-600 shrink-0">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 flex-1 select-none">
              <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">{deleteConfirm.title}</h4>
              <p className="text-xs text-base-muted font-normal leading-relaxed">
                {deleteConfirm.message}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end text-xs pt-1">
            <button 
              onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))} 
              className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={deleteConfirm.onConfirm} 
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}
