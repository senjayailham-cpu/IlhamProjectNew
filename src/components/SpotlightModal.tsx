import React, { useState } from 'react';
import { Project, Assembly } from '../types';
import { calcPct, calcTaskCounts, getManHoursForWorkOrder, getManHoursForAssembly, fmtHrs, esc } from '../utils/projectUtils';
import { ClipboardList, Users, MapPin, Calendar, Clock, BookOpen, AlertTriangle, FileText, ChevronRight, Edit2 } from 'lucide-react';

interface SpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projects: Project[];
  timesheets: any[];
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
  onEdit,
  onEditAssembly,
  onUpdateProject,
  canUpdateTask = true
}: SpotlightModalProps) {
  const [collapsedAsms, setCollapsedAsms] = useState<Record<string, boolean>>({});

  if (!isOpen || !projectId) return null;
  const p = projects.find(x => x.id === projectId);
  if (!p) return null;

  const pct = calcPct(p);
  const { total: totalTasks, done: doneTasks } = calcTaskCounts(p);
  const asms = p.assemblies || [];

  const toggleAsm = (aid: string) => {
    setCollapsedAsms(prev => ({ ...prev, [aid]: !prev[aid] }));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = p.due && p.due < todayStr && p.status !== 'completed';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-base-bg border border-base-border2 rounded-xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 ease-out duration-150">
        
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
          <div className="grid grid-cols-2 gap-3.5">
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
                            const usedHours = getManHoursForAssembly(p.client || '', a.id, timesheets);
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
                            <div className="h-full rounded-full bg-base-blue animate-pulse" style={{ width: `${aPct}%` }} />
                          </div>
                          <span className="font-condensed font-bold text-xs text-base-muted2">{aPct}%</span>
                          <span className="text-[10px] text-base-muted font-medium bg-base-border/20 px-1.5 py-0.5 rounded leading-none whitespace-nowrap">{aDone}/{aTotal}</span>
                        </div>
                      </div>

                      {/* Accordion task cards inside assembly */}
                      {!isColl && (
                        <div className="p-3 divide-y divide-base-border/40 select-text">
                          {tasks.length === 0 ? (
                            <div className="text-xs text-base-muted italic py-1 text-center">No tasks assigned to this assembly.</div>
                          ) : (
                            tasks.map(t => {
                              const handlePctChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                                        onChange={(e) => handleToggleDone(e.target.checked)}
                                        className="h-4 w-4 rounded border-base-border text-base-accent focus:ring-base-accent accent-base-accent cursor-pointer"
                                      />
                                    ) : (
                                      <div className={`h-4 w-4 rounded border flex items-center justify-center ${t.done ? 'bg-base-green-dim text-base-green border-base-green/20' : 'border-base-border'}`}>
                                        {t.done && <span className="text-[10px]">✓</span>}
                                      </div>
                                    )}
                                    <span className={`text-base-text truncate ${t.done ? 'line-through text-base-muted font-normal' : ''}`} title={t.name}>
                                      {t.name}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    {t.assigned && (
                                      <span className="text-[10px] text-base-muted italic hidden sm:inline">By {t.assigned}</span>
                                    )}
                                    
                                    {canUpdateTask ? (
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={t.pct}
                                          onChange={handlePctChange}
                                          className={`w-13 px-1.5 py-0.5 bg-base-bg text-center font-mono text-xs font-extrabold border rounded-md focus:border-base-accent outline-none ${t.pct >= 100 ? 'text-base-green border-base-green/25' : t.pct > 50 ? 'text-base-accent border-base-accent/25' : 'text-base-blue border-base-border'}`}
                                        />
                                        <span className="text-[10px] text-base-muted font-bold">%</span>
                                      </div>
                                    ) : (
                                      <span className={`font-condensed font-bold text-xs ${t.pct >= 100 ? 'text-base-green' : t.pct > 50 ? 'text-base-accent' : 'text-base-blue'}`}>
                                        {t.pct}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
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
          <div className="text-base-muted font-condensed font-bold uppercase tracking-wider text-[11px] flex items-center gap-1 leading-none">
            <Clock className="h-4 w-4" />
            <span>Man-hours used: {p.client ? fmtHrs(getManHoursForWorkOrder(p.client, timesheets)) : 0}h Total</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Close</button>
            <button
              id="spl-edit-btn"
              onClick={() => onEdit(p.id)}
              className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Edit parameters
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
