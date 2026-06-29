import React, { useState } from 'react';
import { User, Project, Assembly, Task } from '../types';
import { calcPct, calcTaskCounts, getManHoursForWorkOrder, getManHoursForAssembly, fmtHrs, esc } from '../utils/projectUtils';
import { ClipboardList, Users, MapPin, Calendar, Clock, BookOpen, AlertTriangle, FileText, ChevronRight, Edit2, Trash2, Plus, Flame, Download, Target, Lock } from 'lucide-react';
import { downloadProjectPDF } from '../utils/pdfGenerator';
import GanttView from './GanttView';

// Spotlight Modular Components
import { AddTaskModal } from './spotlight/AddTaskModal';
import { DeleteConfirmModal } from './spotlight/DeleteConfirmModal';
import { SpotlightOverviewTab } from './spotlight/SpotlightOverviewTab';

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
  selectedMonth,
  onOpenDepModal
}: SpotlightModalProps) {
  const isAdmin = currentUser?.role === 'admin';
  const [collapsedAsms, setCollapsedAsms] = useState<Record<string, boolean>>({});
  const [spotlightTab, setSpotlightTab] = useState<'overview' | 'gantt'>('overview');
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

        {/* Tab Selection Switcher */}
        <div className="flex border-b border-base-border bg-base-surface select-none shrink-0">
          <button
            onClick={() => setSpotlightTab('overview')}
            className={`flex-1 py-2.5 text-xs font-condensed font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              spotlightTab === 'overview'
                ? 'border-base-accent text-base-accent bg-base-accent-dim/10 font-extrabold'
                : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-surface2/50'
            }`}
          >
            📋 Project Overview
          </button>
          <button
            onClick={() => setSpotlightTab('gantt')}
            className={`flex-1 py-2.5 text-xs font-condensed font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              spotlightTab === 'gantt'
                ? 'border-base-accent text-base-accent bg-base-accent-dim/10 font-extrabold'
                : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-surface2/50'
            }`}
          >
            📊 Gantt Timeline
          </button>
        </div>

        {/* Center body columns */}
        {spotlightTab === 'overview' ? (
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
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col p-5 bg-base-bg">
            <GanttView project={p} onOpenDepModal={onOpenDepModal} />
          </div>
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
