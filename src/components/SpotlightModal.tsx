import React, { useState, useMemo } from 'react';
import { User, Project, Assembly, Task, MaterialConsumptionLog, MaterialProcessing, ProcessingStageKey, ProcessingStage } from '../types';
import { useAppStore, useUIStore } from '../store';
import { calcPct, calcTaskCounts, getManHoursForWorkOrder, getManHoursForAssembly, fmtHrs, esc } from '../utils/projectUtils';
import { ClipboardList, Users, MapPin, Calendar, Clock, BookOpen, AlertTriangle, FileText, ChevronRight, Edit2, Trash2, Plus, Flame, Download, Target, Lock, Layers, BarChart2 } from 'lucide-react';
import { normalizePosition, CRAFT_COLORS } from '../utils/manpowerUtils';
import { downloadProjectPDF } from '../utils/pdfGenerator';

// Spotlight Modular Components
import { AddTaskModal } from './spotlight/AddTaskModal';
import { DeleteConfirmModal } from './spotlight/DeleteConfirmModal';
import { SpotlightOverviewTab } from './spotlight/SpotlightOverviewTab';
import { SpotlightProcessingTab } from './spotlight/SpotlightProcessingTab';

interface SpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projects: Project[];
  timesheets: any[];
  wireLogs?: any[];
  consumptionLogs?: MaterialConsumptionLog[];
  onAddMaterialProcessing?: (projectId: string, item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProcessingStage?: (projectId: string, mpId: string, stage: ProcessingStageKey, data: Partial<ProcessingStage>) => void;
  onDeleteMaterialProcessing?: (projectId: string, id: string) => void;
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
  onOpenDepModal?: (rowKey: string) => void;
}

const BAR_COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c'];
const STATUS_COLORS = {
  active: 'bg-base-blue-dim text-base-blue border-base-blue/20',
  pending: 'bg-yellow-400/10 text-yellow-600 border-yellow-500/20',
  completed: 'bg-base-green-dim text-base-green border-base-green/20',
  'on-hold': 'bg-base-border/50 text-base-muted2 border-base-border'
};

export default function SpotlightModal({
  isOpen: propIsOpen,
  onClose: propOnClose,
  projectId: propProjectId,
  projects: propProjects,
  timesheets: propTimesheets,
  wireLogs: propWireLogs = [],
  consumptionLogs: propConsumptionLogs = [],
  onAddMaterialProcessing,
  onUpdateProcessingStage,
  onDeleteMaterialProcessing,
  onEdit,
  onEditAssembly,
  onUpdateProject,
  canUpdateTask = true,
  canAddTaskInline = true,
  canAddDifficulty = true,
  canDeleteTask = true,
  currentUser: propUser = null,
  canEditProjectParams = true,
  selectedMonth,
  onOpenDepModal
}: SpotlightModalProps) {
  const storeProjects = useAppStore((s) => s.projects);
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeWireLogs = useAppStore((s) => s.wireLogs);
  const storeConsumptionLogs = useAppStore((s) => s.consumptionLogs);
  const storeCurrentUser = useAppStore((s) => s.currentUser);

  const storeIsSpotlightOpen = useUIStore((s) => s.isSpotlightOpen);
  const storeSpotlightProjectId = useUIStore((s) => s.spotlightProjectId);
  const storeCloseSpotlight = useUIStore((s) => s.closeSpotlight);

  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsSpotlightOpen;
  const onClose = propOnClose || storeCloseSpotlight;
  const projectId = propProjectId || storeSpotlightProjectId;
  const projects = propProjects?.length ? propProjects : storeProjects;
  const timesheets = propTimesheets?.length ? propTimesheets : storeTimesheets;
  const wireLogs = propWireLogs?.length ? propWireLogs : storeWireLogs;
  const consumptionLogs = propConsumptionLogs?.length ? propConsumptionLogs : storeConsumptionLogs;
  const currentUser = propUser || storeCurrentUser;

  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'overview' | 'assemblies' | 'processing'>('overview');
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

  const p = projectId ? projects.find(x => x.id === projectId) : undefined;

  const commandCenterData = useMemo(() => {
    if (!p) return null;

    const currentPct = calcPct(p);
    const today = new Date().toISOString().slice(0, 10);

    // Today's manpower for this project
    const todayEntries = timesheets.filter(t =>
      t.date === today &&
      (t.status === 'present' || t.status === 'late') &&
      (t.workOrder || '').trim().toLowerCase() === (p.client || '').trim().toLowerCase()
    );
    const onSiteToday = new Set(todayEntries.map(t => t.empId)).size;

    // Overdue tasks
    const overdueTasks = (p.assemblies || [])
      .flatMap(a => (a.tasks || []).map(t => ({ ...t, assemblyName: a.name })))
      .filter(t =>
        t.finishDate && t.finishDate < today &&
        t.pct < 100 && !t.done && !t.isMilestone
      )
      .sort((a, b) => (a.finishDate || '').localeCompare(b.finishDate || ''));

    // Forecast completion (simple linear projection)
    let forecastLabel = '—';
    if (p.start && currentPct > 0 && currentPct < 100) {
      const startD = new Date(p.start);
      const daysElapsed = Math.max(1, (Date.now() - startD.getTime()) / 86400000);
      const dailyRate = currentPct / daysElapsed;
      if (dailyRate > 0) {
        const daysLeft = (100 - currentPct) / dailyRate;
        const forecastD = new Date();
        forecastD.setDate(forecastD.getDate() + Math.ceil(daysLeft));
        forecastLabel = forecastD.toLocaleDateString('id-ID',
          { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } else if (currentPct >= 100) {
      forecastLabel = 'Done';
    }

    // Assembly-level progress for mini timeline
    const assemblyProgress = (p.assemblies || []).map(a => {
      const tasks = a.tasks || [];
      const avgPct = tasks.length > 0
        ? Math.round(tasks.reduce((s, t) => s + (t.pct || 0), 0) / tasks.length)
        : 0;
      return { id: a.id, name: a.name, pct: avgPct };
    });

    // Material processing summary (per stage average)
    const mpItems = p.materialProcessing || [];
    const stageAverages: Record<string, number> = {};
    ['nesting', 'cnc', 'bending', 'machining'].forEach(stage => {
      const relevant = mpItems.filter(m => m.activeStages?.includes(stage as any));
      if (relevant.length > 0) {
        stageAverages[stage] = Math.round(
          relevant.reduce((s, m) => s + (m.stages?.[stage as any]?.pct ?? 0), 0)
          / relevant.length
        );
      }
    });

    return {
      pct: currentPct, overdueTasks, onSiteToday, forecastLabel,
      assemblyProgress, stageAverages, todayEntries,
    };
  }, [p, timesheets]);

  if (!isOpen || !projectId || !p) return null;

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
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-base-bg border border-base-border2 rounded-none sm:rounded-xl shadow-modal w-full max-w-5xl max-h-screen sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 ease-out duration-150">
        
        {/* Header Band */}
        <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-base-border flex items-start gap-3 bg-linear-to-b from-base-accent-dim/20 to-transparent relative">
          <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-base-accent-dim border border-base-accent/25 flex items-center justify-center flex-shrink-0 shadow-xs">
            <ClipboardList className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5 text-base-accent" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-condensed font-extrabold text-xl text-base-text leading-tight truncate">{p.name}</h3>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className={`px-2.5 py-0.5 rounded font-condensed font-extrabold text-[9px] sm:text-[10px] uppercase tracking-wider border ${STATUS_COLORS[p.status]}`}>
                {p.status}
              </span>
              {p.client && (
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] rounded font-condensed font-bold uppercase tracking-wider bg-base-blue-dim text-base-blue border border-base-blue/20">
                  WO: {p.client}
                </span>
              )}
              {p.customer && (
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] rounded font-condensed font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Customer: {p.customer}
                </span>
              )}
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] rounded font-condensed font-bold uppercase tracking-wider bg-base-blue-dim text-base-blue border border-base-blue/20">
                {String(p.category || 'Tray')}
              </span>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] rounded font-condensed font-bold uppercase tracking-wider bg-base-green-dim text-base-green border border-base-green/20">
                {String(p.location || 'WS 1')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer font-bold text-sm">✕</button>
        </div>

        {/* Stats segment grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-base-border border-b border-base-border text-center bg-base-surface">
          <div className="py-3">
            <div className="text-lg sm:text-2xl font-condensed font-extrabold text-base-accent">{pct}%</div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Overall Progress</div>
          </div>
          <div className="py-3">
            <div className="text-lg sm:text-2xl font-condensed font-extrabold text-base-text">{doneTasks}/{totalTasks}</div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Tasks complete</div>
          </div>
          <div className="py-3">
            <div className="text-lg sm:text-2xl font-condensed font-extrabold text-base-text">{asms.length}</div>
            <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-0.5">Assemblies</div>
          </div>
          <div className="py-3">
            <div className={`text-lg sm:text-2.5xl font-condensed font-extrabold ${isOverdue ? 'text-base-red' : 'text-base-text'}`}>
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

        {/* Spotlight Navigation Tabs */}
        <div className="flex overflow-x-auto bg-base-surface border-b border-base-border px-4 py-2 gap-1 flex-shrink-0 select-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-2.5 sm:px-4 py-1.5 rounded-lg font-condensed font-bold uppercase text-xs tracking-wider transition whitespace-nowrap flex-shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-base-accent text-black font-extrabold'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('assemblies')}
            className={`px-2.5 sm:px-4 py-1.5 rounded-lg font-condensed font-bold uppercase text-xs tracking-wider transition whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'assemblies'
                ? 'bg-base-accent text-black font-extrabold'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Sub-Assemblies & Tasks ({asms.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-2.5 sm:px-4 py-1.5 rounded-lg font-condensed font-bold uppercase text-xs tracking-wider transition whitespace-nowrap flex-shrink-0 flex items-center gap-1 cursor-pointer ${
              activeTab === 'processing'
                ? 'bg-base-accent text-black font-extrabold'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Processing</span>
          </button>
        </div>

        {/* Center body columns */}
        {activeTab === 'overview' && commandCenterData && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {/* KPI GRID (4 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 px-4 pt-4">
              <div className="bg-base-surface2 border border-base-border rounded-xl p-3">
                <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                  Progress
                </div>
                <div className="text-xl font-condensed font-black text-base-text">
                  {commandCenterData.pct}%
                </div>
              </div>
              <div className="bg-base-surface2 border border-base-border rounded-xl p-3">
                <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                  On site today
                </div>
                <div className="text-xl font-condensed font-black text-base-text">
                  {commandCenterData.onSiteToday}
                </div>
              </div>
              <div className="bg-base-surface2 border border-base-border rounded-xl p-3">
                <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                  Overdue tasks
                </div>
                <div className={`text-xl font-condensed font-black ${commandCenterData.overdueTasks.length > 0 ? 'text-base-red text-red-500' : 'text-base-text'}`}>
                  {commandCenterData.overdueTasks.length}
                </div>
              </div>
              <div className="bg-base-surface2 border border-base-border rounded-xl p-3">
                <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                  Forecast
                </div>
                <div className="text-sm font-condensed font-black text-base-text mt-1.5">
                  {commandCenterData.forecastLabel}
                </div>
              </div>
            </div>

            {/* TWO-COLUMN PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-2 px-4 pt-2 pb-4">
              {/* LEFT: mini timeline + overdue alerts */}
              <div className="bg-base-surface2 border border-base-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text mb-2">
                  <BarChart2 className="h-3.5 w-3.5 text-base-accent animate-pulse" />
                  <span>Mini timeline</span>
                </div>
                {commandCenterData.assemblyProgress.length > 0 ? (
                  <div className="space-y-1.5">
                    {commandCenterData.assemblyProgress.slice(0, 6).map(a => (
                      <div key={a.id} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-base-muted w-24 flex-shrink-0 truncate" title={a.name}>
                          {a.name}
                        </span>
                        <div className="flex-1 h-1.5 bg-base-surface3 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${a.pct}%`,
                              backgroundColor: a.pct >= 80 ? '#4caf7d' : a.pct >= 40 ? '#e8a020' : '#d65c4f'
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-base-text w-8 text-right font-bold">
                          {a.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-base-muted text-center py-2">
                    No assembly progress data
                  </div>
                )}

                {/* OVERDUE ALERTS SECTION */}
                <div className="mt-4 pt-3 border-t border-base-border/50">
                  <div className="flex items-center gap-1.5 text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-base-red" />
                    <span>Overdue Tasks ({commandCenterData.overdueTasks.length})</span>
                  </div>
                  {commandCenterData.overdueTasks.length > 0 ? (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {commandCenterData.overdueTasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-[10px] bg-base-surface3/40 border border-base-border/30 rounded-lg px-2.5 py-1.5">
                          <div className="truncate pr-2">
                            <span className="font-extrabold text-base-text">{t.name}</span>
                            <span className="text-base-muted mx-1">•</span>
                            <span className="text-base-muted truncate">{t.assemblyName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-base-red text-red-500 font-mono font-bold">
                              {t.finishDate ? t.finishDate.slice(5) : ''}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-sm font-bold bg-base-red/10 text-base-red text-red-500 uppercase text-[8px] tracking-wide border border-base-red/20">
                              Overdue
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-base-green bg-base-green/5 border border-base-green/20 rounded-lg px-3 py-2 text-center font-bold">
                      ✓ All scheduled tasks are currently on track
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: today's manpower + material processing status */}
              <div className="flex flex-col gap-2">
                {/* TODAY'S MANPOWER CARD */}
                <div className="bg-base-surface2 border border-base-border rounded-xl p-3 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>Today's Manpower</span>
                    </div>
                    <span className="text-[10px] font-mono text-base-accent bg-base-accent/10 border border-base-accent/20 px-1.5 py-0.5 rounded-md font-bold">
                      {commandCenterData.onSiteToday} present
                    </span>
                  </div>

                  {commandCenterData.todayEntries.length > 0 ? (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {commandCenterData.todayEntries.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-[10px] bg-base-surface3/40 border border-base-border/30 rounded-lg px-2.5 py-1.5">
                          <span className="font-bold text-base-text truncate">{t.empName}</span>
                          <span className="px-2 py-0.5 rounded-md bg-base-surface font-mono text-[9px] text-base-muted2 border border-base-border/40 shrink-0">
                            {t.totalHours} hrs
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-base-muted bg-base-surface border border-base-border/40 rounded-lg px-3 py-4 text-center">
                      No manpower logs recorded for this project today
                    </div>
                  )}
                </div>

                {/* MATERIAL PROCESSING STATUS CARD */}
                <div className="bg-base-surface2 border border-base-border rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text mb-2.5">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Material Processing Status</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    {['nesting', 'cnc', 'bending', 'machining'].map(stage => {
                      const avg = commandCenterData.stageAverages[stage];
                      const hasData = avg !== undefined;
                      return (
                        <div key={stage} className="bg-base-surface border border-base-border/30 rounded-lg p-2 flex flex-col justify-between min-h-[52px]">
                          <div className="flex items-center justify-between">
                            <span className="capitalize font-bold text-base-muted2 font-condensed tracking-wide">
                              {stage}
                            </span>
                            <span className={`font-mono font-bold ${hasData ? 'text-base-accent' : 'text-base-muted'}`}>
                              {hasData ? `${avg}%` : '—'}
                            </span>
                          </div>
                          {hasData ? (
                            <div className="w-full h-1 bg-base-surface3 rounded-full mt-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-base-accent transition-all duration-300"
                                style={{ width: `${avg}%` }}
                              />
                            </div>
                          ) : (
                            <span className="text-[8.5px] text-base-muted italic mt-1 leading-none">Inactive</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assemblies' && (
          <SpotlightOverviewTab
            project={p}
            asms={asms}
            modalTimesheets={modalTimesheets}
            wireLogs={wireLogs}
            collapsedAsms={collapsedAsms}
            toggleAsm={toggleAsm}
            canAddTaskInline={canAddTaskInline}
            canAddDifficulty={canAddDifficulty}
            canDeleteTask={canDeleteTask}
            canUpdateTask={canUpdateTask}
            isAdmin={isAdmin}
            isOverdue={isOverdue}
            onUpdateProject={onUpdateProject}
            onEditAssembly={onEditAssembly}
            setActiveTargetAssembly={setActiveTargetAssembly}
            setTaskName={setTaskName}
            setTaskDifficulty={setTaskDifficulty}
            setTaskStart={setTaskStart}
            setTaskFinish={setTaskFinish}
            setIsTaskModalOpen={setIsTaskModalOpen}
            setDeleteConfirm={setDeleteConfirm}
            quickTaskNames={quickTaskNames}
            setQuickTaskNames={setQuickTaskNames}
            quickTaskDifficulty={quickTaskDifficulty}
            setQuickTaskDifficulty={setQuickTaskDifficulty}
            quickTaskDates={quickTaskDates}
            setQuickTaskDates={setQuickTaskDates}
            quickTaskFinishDates={quickTaskFinishDates}
            setQuickTaskFinishDates={setQuickTaskFinishDates}
            handleQuickAddTask={handleQuickAddTask}
            onOpenDepModal={onOpenDepModal}
          />
        )}

        {activeTab === 'processing' && (
          <SpotlightProcessingTab
            project={p}
            materialProcessings={p.materialProcessing || []}
            currentUser={currentUser}
            onAdd={(item) => onAddMaterialProcessing!(p.id, item)}
            onUpdateStage={(mpId, stageKey, stageData) => onUpdateProcessingStage!(p.id, mpId, stageKey, stageData)}
            onDelete={(mpId) => onDeleteMaterialProcessing!(p.id, mpId)}
            setDeleteConfirm={setDeleteConfirm}
          />
        )}

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
                  <span>Consumable: {totalWire.toFixed(1)} kg Total</span>
                </div>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.status === 'completed' && (
              <button
                onClick={() => downloadProjectPDF(p, timesheets, wireLogs || [], consumptionLogs)}
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
    <AddTaskModal
      isOpen={isTaskModalOpen}
      onClose={() => {
        setIsTaskModalOpen(false);
        setActiveTargetAssembly(null);
      }}
      activeTargetAssembly={activeTargetAssembly}
      taskName={taskName}
      setTaskName={setTaskName}
      taskDifficulty={taskDifficulty}
      setTaskDifficulty={setTaskDifficulty}
      taskStart={taskStart}
      setTaskStart={setTaskStart}
      taskFinish={taskFinish}
      setTaskFinish={setTaskFinish}
      onSave={handleSaveNewTask}
      canAddDifficulty={canAddDifficulty}
    />

    {/* Custom Delete Confirmation Modal */}
    <DeleteConfirmModal
      isOpen={deleteConfirm.isOpen}
      title={deleteConfirm.title}
      message={deleteConfirm.message}
      onCancel={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
      onConfirm={deleteConfirm.onConfirm}
    />
  </>
);
}
