import React, { useState, useMemo, useEffect } from 'react';
import { Project, Employee, TimesheetEntry, User, ProjectStatusType, Assembly, Task } from '../types';
import { calcPct, calcTaskCounts } from '../utils/projectUtils';
import { can } from '../utils/permissions';
import { getCategoriesForPosition, getDefaultCategoryForPosition } from '../utils/timesheetCategories';
import { useAppStore } from '../store';
import { useFirestore } from '../hooks/useFirestore';
import { showToast } from './Toast';
import { uid } from '../utils/helpers';
import { 
  QrCode, X, ListChecks, Clock, CheckCircle2, AlertTriangle, 
  UserCheck, ShieldAlert, Check, Save, Calendar, Plus, Trash2, 
  ArrowLeft, Search, Layers, CheckSquare
} from 'lucide-react';

export interface QrProjectPanelProps {
  projectId: string;
  onClose: () => void;
  projects?: Project[];
  employees?: Employee[];
  timesheets?: TimesheetEntry[];
  currentUser?: User | null;
  onSaveProject?: (project: Project, logParams?: any) => void;
  onSaveTimesheet?: (entry: Partial<TimesheetEntry>) => Promise<void> | void;
}

const STATUS_OPTIONS: { id: ProjectStatusType; label: string; desc: string; color: string }[] = [
  { id: 'active', label: 'Active (In Progress)', desc: 'Pekerjaan sedang berlangsung aktif di bengkel', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' },
  { id: 'pending', label: 'Pending', desc: 'Menunggu material, drawing revisi, atau jadwal', color: 'border-amber-500/50 bg-amber-500/10 text-amber-400' },
  { id: 'on-hold', label: 'On Hold', desc: 'Dihentikan sementara karena kendala atau permintaan klien', color: 'border-rose-500/50 bg-rose-500/10 text-rose-400' },
  { id: 'completed', label: 'Completed', desc: 'Seluruh assembly dan inspeksi telah selesai', color: 'border-blue-500/50 bg-blue-500/10 text-blue-400' }
];

interface TimesheetRowItem {
  rowId: string;
  empId: string;
  empName: string;
  empQuery?: string;
  empDropdownOpen?: boolean;
  position: string;
  assemblyId: string;
  assemblyName: string;
  taskId: string;
  taskName: string;
  totalHours: number;
  category: string;
  desc: string;
}

export default function QrProjectPanel({
  projectId,
  onClose,
  projects: propProjects,
  employees: propEmployees,
  timesheets: propTimesheets,
  currentUser: propUser,
  onSaveProject: propOnSaveProject,
  onSaveTimesheet: propOnSaveTimesheet
}: QrProjectPanelProps) {
  // Store fallback
  const storeProjects = useAppStore((s) => s.projects);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeCurrentUser = useAppStore((s) => s.currentUser);
  const { saveItem } = useFirestore();

  const projects = propProjects?.length ? propProjects : storeProjects;
  const employees = propEmployees?.length ? propEmployees : storeEmployees;
  const timesheets = propTimesheets?.length ? propTimesheets : storeTimesheets;
  const currentUser = propUser !== undefined ? propUser : storeCurrentUser;

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Find project by ID or Client (WO)
  const project = useMemo(() => {
    return projects.find((p) => p.id === projectId || p.client === projectId);
  }, [projects, projectId]);

  // Permissions check
  const canUpdateTask = can(currentUser ?? null, 'updateTask');
  const canManageTimesheet = can(currentUser ?? null, 'manageTimesheet');
  const canEditStatus = can(currentUser ?? null, 'editProject') || can(currentUser ?? null, 'editProjectParams');

  const availableTabs = useMemo(() => {
    const list: Array<{ id: 'progress' | 'timesheet' | 'status'; label: string; icon: React.ComponentType<any> }> = [];
    if (canUpdateTask) list.push({ id: 'progress', label: 'Progress', icon: ListChecks });
    if (canManageTimesheet) list.push({ id: 'timesheet', label: 'Timesheet', icon: Clock });
    if (canEditStatus) list.push({ id: 'status', label: 'Status', icon: CheckCircle2 });
    return list;
  }, [canUpdateTask, canManageTimesheet, canEditStatus]);

  const [activeTab, setActiveTab] = useState<'progress' | 'timesheet' | 'status'>(() => {
    if (canUpdateTask) return 'progress';
    if (canManageTimesheet) return 'timesheet';
    if (canEditStatus) return 'status';
    return 'progress';
  });

  // Ensure active tab is within available tabs
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  // ==========================================
  // TAB A: PROGRESS (BERTINGKAT ASSEMBLY -> TASK)
  // ==========================================
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(null);
  const [assemblySearch, setAssemblySearch] = useState<string>('');
  const [taskPcts, setTaskPcts] = useState<Record<string, number>>({});
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Initialize task pcts when project changes
  useEffect(() => {
    if (project?.assemblies) {
      const initial: Record<string, number> = {};
      project.assemblies.forEach((asm) => {
        (asm.tasks || []).forEach((t) => {
          initial[t.id] = t.pct ?? 0;
        });
      });
      setTaskPcts(initial);
    }
  }, [project]);

  // Dirty check for progress
  const hasProgressChanges = useMemo(() => {
    if (!project?.assemblies) return false;
    for (const asm of project.assemblies) {
      for (const t of asm.tasks || []) {
        const currentVal = taskPcts[t.id] ?? 0;
        if (currentVal !== (t.pct ?? 0)) return true;
      }
    }
    return false;
  }, [project, taskPcts]);

  // Assemblies list with progress calculations
  const assemblyListWithProgress = useMemo(() => {
    if (!project?.assemblies) return [];
    return project.assemblies.map((asm) => {
      const tasks = asm.tasks || [];
      const totalTasks = tasks.length;
      let totalPctSum = 0;
      let doneTasks = 0;

      tasks.forEach((t) => {
        const cur = taskPcts[t.id] !== undefined ? taskPcts[t.id] : (t.pct ?? 0);
        totalPctSum += cur;
        if (cur >= 100) doneTasks++;
      });

      const avgPct = totalTasks > 0 ? Math.round(totalPctSum / totalTasks) : 0;
      return {
        ...asm,
        totalTasks,
        doneTasks,
        avgPct
      };
    });
  }, [project?.assemblies, taskPcts]);

  // Filtered assembly list for Step 1
  const filteredAssemblies = useMemo(() => {
    if (!assemblySearch.trim()) return assemblyListWithProgress;
    const q = assemblySearch.trim().toLowerCase();
    return assemblyListWithProgress.filter((a) => a.name.toLowerCase().includes(q));
  }, [assemblyListWithProgress, assemblySearch]);

  // Currently selected assembly for Step 2
  const selectedAssembly = useMemo(() => {
    if (!selectedAssemblyId || !project?.assemblies) return null;
    return project.assemblies.find((a) => a.id === selectedAssemblyId) || null;
  }, [selectedAssemblyId, project?.assemblies]);

  // Selected assembly calculated stats
  const selectedAssemblyStats = useMemo(() => {
    if (!selectedAssembly) return null;
    const tasks = selectedAssembly.tasks || [];
    const total = tasks.length;
    let sumPct = 0;
    let done = 0;
    tasks.forEach((t) => {
      const p = taskPcts[t.id] !== undefined ? taskPcts[t.id] : (t.pct ?? 0);
      sumPct += p;
      if (p >= 100) done++;
    });
    return {
      total,
      done,
      avgPct: total > 0 ? Math.round(sumPct / total) : 0
    };
  }, [selectedAssembly, taskPcts]);

  // Save Progress Handler
  const handleSaveProgress = async () => {
    if (!project) return;
    setIsSavingProgress(true);
    try {
      const updatedAssemblies: Assembly[] = (project.assemblies || []).map((asm) => ({
        ...asm,
        tasks: (asm.tasks || []).map((task) => {
          const newPct = taskPcts[task.id] !== undefined ? taskPcts[task.id] : (task.pct ?? 0);
          const done = newPct >= 100;
          let workflowStatus = task.workflowStatus;
          if (newPct >= 100) {
            workflowStatus = 'complete';
          } else if (newPct > 0 && (!workflowStatus || workflowStatus === 'not_started')) {
            workflowStatus = 'on_track';
          }
          return {
            ...task,
            pct: newPct,
            done,
            workflowStatus
          };
        })
      }));

      const updatedProj: Project = {
        ...project,
        assemblies: updatedAssemblies
      };

      if (propOnSaveProject) {
        propOnSaveProject(updatedProj, {
          type: 'task_progress',
          action: `Updated task progress via QR for ${project.name}`
        });
      } else {
        await saveItem('projects', updatedProj);
        useAppStore.getState().setProjects((prev) =>
          prev.map((p) => (p.id === updatedProj.id ? updatedProj : p))
        );
      }
      showToast('Progress proyek berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan progress', 'error');
    } finally {
      setIsSavingProgress(false);
    }
  };

  // ==========================================
  // TAB B: TIMESHEET (MULTI-PERSONNEL + ASSY/TASK)
  // ==========================================
  const activeEmployees = useMemo(() => {
    return employees
      .filter((e) => !e.isExEmployee)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const createInitialRow = (): TimesheetRowItem => ({
    rowId: uid(),
    empId: '',
    empName: '',
    empQuery: '',
    empDropdownOpen: false,
    position: '',
    assemblyId: selectedAssemblyId || '',
    assemblyName: selectedAssembly ? selectedAssembly.name : '',
    taskId: '',
    taskName: '',
    totalHours: 8,
    category: '',
    desc: ''
  });

  const [timesheetRows, setTimesheetRows] = useState<TimesheetRowItem[]>([createInitialRow()]);
  const [isSavingTimesheet, setIsSavingTimesheet] = useState(false);

  // Helper to add new personnel row
  const handleAddTimesheetRow = () => {
    setTimesheetRows((prev) => [
      ...prev,
      createInitialRow()
    ]);
  };

  // Helper to remove row
  const handleRemoveTimesheetRow = (rowId: string) => {
    setTimesheetRows((prev) => {
      const filtered = prev.filter((r) => r.rowId !== rowId);
      return filtered.length > 0 ? filtered : [createInitialRow()];
    });
  };

  // Update specific row field
  const handleRowChange = (rowId: string, updates: Partial<TimesheetRowItem>) => {
    setTimesheetRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        return { ...row, ...updates };
      })
    );
  };

  // Filtered employees for autocomplete per row (max 15 results)
  const getFilteredEmployees = (query: string = '') => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return activeEmployees.slice(0, 10);
    }
    return activeEmployees
      .filter((e) => {
        const nameMatch = e.name.toLowerCase().includes(q);
        const noMatch = (e.empNo || '').toLowerCase().includes(q);
        const idMatch = e.id.toLowerCase().includes(q);
        const posMatch = (e.position || '').toLowerCase().includes(q);
        return nameMatch || noMatch || idMatch || posMatch;
      })
      .slice(0, 15);
  };

  // When user types in employee autocomplete search box
  const handleEmpQueryChange = (rowId: string, val: string) => {
    handleRowChange(rowId, {
      empQuery: val,
      empDropdownOpen: true,
      // If user edits text after having selected an employee, clear empId until chosen again from dropdown
      empId: '',
      empName: '',
      position: '',
      category: ''
    });
  };

  // When user clears the employee selection
  const handleClearEmployeeInRow = (rowId: string) => {
    handleRowChange(rowId, {
      empId: '',
      empName: '',
      empQuery: '',
      empDropdownOpen: false,
      position: '',
      category: ''
    });
  };

  // When employee is selected from suggestion dropdown in a row
  const handleSelectEmployeeInRow = (rowId: string, empId: string) => {
    const emp = activeEmployees.find((e) => e.id === empId);
    if (!emp) {
      handleRowChange(rowId, {
        empId: '',
        empName: '',
        empQuery: '',
        empDropdownOpen: false,
        position: '',
        category: ''
      });
      return;
    }
    const defaultCat = getDefaultCategoryForPosition(emp.position);
    handleRowChange(rowId, {
      empId: emp.id,
      empName: emp.name,
      empQuery: `${emp.name}${emp.empNo ? ` (${emp.empNo})` : ''}`,
      empDropdownOpen: false,
      position: emp.position || '',
      category: defaultCat
    });
  };

  // When assembly is selected in a row
  const handleSelectAssemblyInRow = (rowId: string, asmId: string) => {
    if (!asmId) {
      handleRowChange(rowId, {
        assemblyId: '',
        assemblyName: '',
        taskId: '',
        taskName: ''
      });
      return;
    }
    const asm = (project?.assemblies || []).find((a) => a.id === asmId);
    handleRowChange(rowId, {
      assemblyId: asmId,
      assemblyName: asm ? asm.name : '',
      taskId: '',
      taskName: ''
    });
  };

  // When task is selected in a row
  const handleSelectTaskInRow = (rowId: string, asmId: string, taskId: string) => {
    if (!taskId) {
      handleRowChange(rowId, { taskId: '', taskName: '' });
      return;
    }
    const asm = (project?.assemblies || []).find((a) => a.id === asmId);
    const task = (asm?.tasks || []).find((t) => t.id === taskId);
    handleRowChange(rowId, {
      taskId: taskId,
      taskName: task ? task.name : ''
    });
  };

  // Today's timesheets for this Work Order
  const todayWoTimesheets = useMemo(() => {
    if (!project?.client) return [];
    const clientUpper = project.client.trim().toUpperCase();
    return timesheets.filter((t) => 
      t.date === todayStr && 
      (t.workOrder || '').trim().toUpperCase() === clientUpper
    );
  }, [timesheets, project?.client, todayStr]);

  // Save Multi-Row Timesheet Handler
  const handleSaveAllTimesheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    // Filter valid rows: employee chosen and hours > 0
    const validRows = timesheetRows.filter((r) => r.empId && r.totalHours > 0);

    if (validRows.length === 0) {
      showToast('Pilih minimal 1 personil dengan jam kerja > 0 jam', 'warning');
      return;
    }

    // Check duplicate employee on same task
    const seen = new Set<string>();
    for (const r of validRows) {
      const key = `${r.empId}_${r.taskId || 'notask'}`;
      if (seen.has(key)) {
        showToast(
          `Personil ${r.empName} dimasukkan lebih dari sekali pada task yang sama. Gabungkan jam kerjanya atau pilih task berbeda.`,
          'warning'
        );
        return;
      }
      seen.add(key);
    }

    setIsSavingTimesheet(true);
    try {
      const workOrder = project.client || project.name;
      const targetWo = workOrder.trim().toLowerCase();
      let savedCount = 0;

      for (const row of validRows) {
        const targetTaskId = (row.taskId || '').trim();

        // Check existing entry for date + empId + workOrder + taskId
        const existing = timesheets.find((x) => 
          x.date === todayStr &&
          x.empId === row.empId &&
          (x.workOrder || '').trim().toLowerCase() === targetWo &&
          (targetTaskId ? (x.taskId || '').trim() === targetTaskId : (!x.taskId || x.taskId.trim() === ''))
        );

        const entry: TimesheetEntry = {
          id: existing?.id || uid(),
          date: todayStr,
          empId: row.empId,
          empName: row.empName,
          position: row.position || '',
          workOrder: workOrder,
          assemblyId: row.assemblyId || undefined,
          assemblyName: row.assemblyName || undefined,
          taskId: row.taskId || undefined,
          taskName: row.taskName || undefined,
          category: row.category || getDefaultCategoryForPosition(row.position),
          totalHours: Number(row.totalHours),
          status: 'present',
          desc: row.desc.trim() || undefined,
          projectId: project.id
        };

        if (propOnSaveTimesheet) {
          await propOnSaveTimesheet(entry);
        } else {
          await saveItem('timesheets', entry);
          useAppStore.getState().setTimesheets((prev) => {
            const idx = prev.findIndex((x) => x.id === entry.id);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = entry;
              return copy;
            }
            return [entry, ...prev];
          });
        }
        savedCount++;
      }

      showToast(`Berhasil mencatat timesheet untuk ${savedCount} personil!`, 'success');
      // Reset form to 1 blank row
      setTimesheetRows([createInitialRow()]);
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan timesheet', 'error');
    } finally {
      setIsSavingTimesheet(false);
    }
  };

  // ==========================================
  // TAB C: STATUS
  // ==========================================
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusType>(project?.status || 'active');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  useEffect(() => {
    if (project?.status) {
      setSelectedStatus(project.status);
    }
  }, [project?.status]);

  const handleSaveStatus = async () => {
    if (!project) return;
    setIsSavingStatus(true);
    try {
      const isCompleted = selectedStatus === 'completed';
      const updatedProj: Project = {
        ...project,
        status: selectedStatus,
        completedDate: isCompleted ? (project.completedDate || todayStr) : null
      };

      if (propOnSaveProject) {
        propOnSaveProject(updatedProj, {
          type: 'project_edit',
          action: `Changed status to "${selectedStatus}" via QR for ${project.name}`
        });
      } else {
        await saveItem('projects', updatedProj);
        useAppStore.getState().setProjects((prev) =>
          prev.map((p) => (p.id === updatedProj.id ? updatedProj : p))
        );
      }
      showToast(`Status proyek diubah ke ${selectedStatus.toUpperCase()}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengubah status', 'error');
    } finally {
      setIsSavingStatus(false);
    }
  };

  if (!project) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <div className="bg-base-surface border border-base-border rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-condensed font-extrabold text-xl text-base-text uppercase tracking-wide">
            Project Not Found
          </h3>
          <p className="text-sm text-base-muted">
            The scanned QR code with ID <span className="font-mono text-base-accent font-bold">{projectId}</span> does not match any project in the workspace.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-base-accent hover:bg-base-accent/90 text-white font-condensed font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </div>
    );
  }

  const currentOverallPct = calcPct(project);
  const taskCounts = calcTaskCounts(project);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-base-bg border border-base-border w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-base-border bg-base-surface flex items-start justify-between gap-3 relative shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-base-accent-dim border border-base-accent/30 text-base-accent flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-condensed font-extrabold text-base sm:text-lg text-base-text truncate">
                  {project.name}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider border ${
                  project.status === 'completed'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : project.status === 'on-hold'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                    : project.status === 'pending'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-base-muted mt-0.5 flex-wrap">
                {project.client && (
                  <span className="font-mono font-bold text-base-accent bg-base-accent-dim px-1.5 py-0.2 rounded">
                    WO: {project.client}
                  </span>
                )}
                {project.customer && (
                  <span className="truncate max-w-[120px]">Cust: {project.customer}</span>
                )}
                <span>• {project.category || 'General'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        {availableTabs.length > 0 ? (
          <div className="flex items-center border-b border-base-border bg-base-surface px-2 sm:px-4 shrink-0">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2.5 sm:py-3 px-2 flex items-center justify-center gap-2 border-b-2 font-condensed font-bold text-xs uppercase tracking-wider transition cursor-pointer ${
                    isActive
                      ? 'border-base-accent text-base-accent bg-base-accent-dim/20'
                      : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-surface2'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Read-only: Akun Anda tidak memiliki izin edit untuk proyek ini.</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* ========================================================= */}
          {/* TAB A: PROGRESS (BERTINGKAT ASSEMBLY -> TASK) */}
          {/* ========================================================= */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              {/* Overall Progress Summary Card */}
              <div className="bg-base-surface border border-base-border rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Total Progress Proyek
                  </div>
                  <div className="text-2xl font-condensed font-extrabold text-base-accent mt-0.5">
                    {currentOverallPct}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Task Selesai
                  </div>
                  <div className="text-sm font-condensed font-bold text-base-text mt-0.5">
                    {taskCounts.done} / {taskCounts.total} Task
                  </div>
                </div>
              </div>

              {/* No assemblies state */}
              {(!project.assemblies || project.assemblies.length === 0) ? (
                <div className="p-8 text-center text-base-muted border border-dashed border-base-border rounded-xl space-y-2">
                  <ListChecks className="w-8 h-8 mx-auto text-base-muted2" />
                  <p className="text-sm font-medium">Belum ada Assembly atau Task yang dibuat untuk proyek ini.</p>
                </div>
              ) : selectedAssembly === null ? (
                /* ------------------------------------------------------------- */
                /* LANGKAH 1: PILIH ASSEMBLY (LIST KARTU RINGKAS, BUKAN FLAT TASK) */
                /* ------------------------------------------------------------- */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-base-accent" />
                      Langkah 1: Pilih Assembly ({assemblyListWithProgress.length})
                    </span>
                    {hasProgressChanges && (
                      <span className="text-[10px] font-condensed font-bold uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                        Ada perubahan belum disimpan
                      </span>
                    )}
                  </div>

                  {/* Optional Search bar if assemblies > 2 */}
                  {assemblyListWithProgress.length > 2 && (
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" />
                      <input
                        type="text"
                        placeholder="Cari nama assembly..."
                        value={assemblySearch}
                        onChange={(e) => setAssemblySearch(e.target.value)}
                        className="w-full bg-base-surface border border-base-border rounded-xl pl-9 pr-3 py-2 text-xs text-base-text placeholder-base-muted/60 focus:outline-hidden focus:border-base-accent"
                      />
                      {assemblySearch && (
                        <button
                          type="button"
                          onClick={() => setAssemblySearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-muted hover:text-base-text text-xs p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* List of Assembly Cards */}
                  <div className="space-y-2.5">
                    {filteredAssemblies.map((asm) => (
                      <div
                        key={asm.id}
                        onClick={() => setSelectedAssemblyId(asm.id)}
                        className="bg-base-surface hover:bg-base-surface2 border border-base-border hover:border-base-accent/50 rounded-xl p-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md group active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-base-accent shrink-0" />
                            <h4 className="font-condensed font-extrabold text-sm text-base-text uppercase tracking-wide group-hover:text-base-accent transition-colors truncate">
                              {asm.name}
                            </h4>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs shrink-0 ${
                            asm.avgPct >= 100
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : asm.avgPct > 0
                              ? 'bg-base-accent-dim text-base-accent border border-base-accent/30'
                              : 'bg-base-surface3 text-base-muted border border-base-border'
                          }`}>
                            {asm.avgPct}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-base-surface3 h-2 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              asm.avgPct >= 100 ? 'bg-emerald-500' : 'bg-base-accent'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, asm.avgPct))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-base-muted">
                          <span>
                            {asm.doneTasks} dari {asm.totalTasks} task selesai
                          </span>
                          <span className="text-base-accent font-condensed font-bold uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Buka Task & Update &rarr;
                          </span>
                        </div>
                      </div>
                    ))}

                    {filteredAssemblies.length === 0 && (
                      <div className="p-6 text-center text-xs text-base-muted italic bg-base-surface border border-base-border rounded-xl">
                        Tidak ada assembly yang cocok dengan "{assemblySearch}"
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ------------------------------------------------------------- */
                /* LANGKAH 2: TAMPILKAN HANYA TASK DI ASSEMBLY TERPILIH */
                /* ------------------------------------------------------------- */
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {/* Sub-header navigation with "Ganti Assembly" button */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-base-border/70">
                    <button
                      type="button"
                      onClick={() => setSelectedAssemblyId(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-text font-condensed font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:border-base-accent/50"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Ganti Assembly</span>
                    </button>
                    
                    {selectedAssemblyStats && (
                      <span className="font-mono text-xs font-bold text-base-accent">
                        Assembly: {selectedAssemblyStats.avgPct}% ({selectedAssemblyStats.done}/{selectedAssemblyStats.total} Selesai)
                      </span>
                    )}
                  </div>

                  {/* Active Assembly Info */}
                  <div className="bg-base-surface2 border border-base-border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-base-muted font-condensed font-bold uppercase tracking-wider">
                        Assembly Terpilih:
                      </div>
                      <div className="font-condensed font-extrabold text-base text-base-text uppercase">
                        {selectedAssembly.name}
                      </div>
                    </div>
                    <span className="text-xs text-base-muted font-mono">
                      {(selectedAssembly.tasks || []).length} Task
                    </span>
                  </div>

                  {/* Tasks List */}
                  {(!selectedAssembly.tasks || selectedAssembly.tasks.length === 0) ? (
                    <div className="p-6 text-center text-xs text-base-muted italic bg-base-surface border border-base-border rounded-xl">
                      Belum ada task di bawah assembly ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedAssembly.tasks.map((task) => {
                        const curPct = taskPcts[task.id] !== undefined ? taskPcts[task.id] : (task.pct ?? 0);
                        return (
                          <div 
                            key={task.id} 
                            className="bg-base-surface border border-base-border rounded-xl p-3.5 space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-base-text truncate">
                                {task.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs shrink-0 ${
                                curPct >= 100 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                  : curPct > 0 
                                  ? 'bg-base-accent-dim text-base-accent border border-base-accent/30'
                                  : 'bg-base-surface3 text-base-muted border border-base-border'
                              }`}>
                                {curPct}%
                              </span>
                            </div>

                            {/* Slider & Presets */}
                            <div className="space-y-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={curPct}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setTaskPcts((prev) => ({ ...prev, [task.id]: val }));
                                }}
                                className="w-full accent-base-accent cursor-pointer h-2 bg-base-surface3 rounded-lg"
                              />
                              <div className="grid grid-cols-5 gap-1.5">
                                {[0, 25, 50, 75, 100].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                      setTaskPcts((prev) => ({ ...prev, [task.id]: preset }));
                                    }}
                                    className={`py-1.5 rounded text-[11px] font-condensed font-bold transition cursor-pointer text-center ${
                                      curPct === preset
                                        ? 'bg-base-accent text-white shadow-xs'
                                        : 'bg-base-surface2 text-base-muted hover:text-base-text hover:bg-base-surface3'
                                    }`}
                                  >
                                    {preset}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Progress Save Action (Always accessible) */}
              <div className="pt-2 sticky bottom-0 bg-base-bg/95 backdrop-blur-xs pb-1 space-y-2">
                <button
                  type="button"
                  onClick={handleSaveProgress}
                  disabled={isSavingProgress || !hasProgressChanges}
                  className={`w-full py-3 px-4 rounded-xl font-condensed font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                    hasProgressChanges
                      ? 'bg-base-accent text-white hover:bg-base-accent/90 shadow-md active:scale-[0.99]'
                      : 'bg-base-surface3 text-base-muted cursor-not-allowed opacity-60'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingProgress 
                      ? 'Menyimpan Progress...' 
                      : hasProgressChanges 
                      ? 'Simpan Perubahan Progress' 
                      : 'Belum Ada Perubahan Progress'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB B: TIMESHEET (MULTI-PERSONNEL + ASSY & TASK SELECTOR) */}
          {/* ========================================================= */}
          {activeTab === 'timesheet' && (
            <div className="space-y-4">
              {/* Context Header */}
              <div className="bg-base-surface border border-base-border rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center justify-between">
                  <span>Target Work Order</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {todayStr}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-base text-base-accent">
                    {project.client || project.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-condensed font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Status: Present
                  </span>
                </div>
              </div>

              {/* Multi-Person Timesheet Form */}
              <form onSubmit={handleSaveAllTimesheets} className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Daftar Personil Kerja ({timesheetRows.length} Orang)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddTimesheetRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-base-accent-dim text-base-accent border border-base-accent/30 font-condensed font-bold text-xs uppercase tracking-wider hover:bg-base-accent hover:text-white transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Orang</span>
                  </button>
                </div>

                {/* Rows List */}
                <div className="space-y-3">
                  {timesheetRows.map((row, index) => {
                    const rowCategories = getCategoriesForPosition(row.position);
                    const selectedAsm = (project.assemblies || []).find((a) => a.id === row.assemblyId);
                    const availableTasks = selectedAsm?.tasks || [];

                    return (
                      <div
                        key={row.rowId}
                        className="bg-base-surface border border-base-border rounded-xl p-3.5 space-y-3 relative shadow-xs"
                      >
                        {/* Row Header */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-base-border/50">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-base-surface3 text-base-text font-mono font-bold text-xs flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="font-condensed font-bold text-xs uppercase tracking-wider text-base-text">
                              Personil #{index + 1}
                            </span>
                            {row.position && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border text-base-muted">
                                {row.position}
                              </span>
                            )}
                          </div>
                          
                          {timesheetRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTimesheetRow(row.rowId)}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition cursor-pointer"
                              title="Hapus baris personil ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Employee Autocomplete Combobox */}
                        <div className="space-y-1 relative">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text">
                              Pilih Karyawan <span className="text-rose-500">*</span>
                            </label>
                            {row.empId && (
                              <span className="text-[10px] font-condensed font-bold uppercase text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Terpilih
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              value={row.empQuery !== undefined ? row.empQuery : (row.empName ? row.empName : '')}
                              onChange={(e) => handleEmpQueryChange(row.rowId, e.target.value)}
                              onFocus={() => handleRowChange(row.rowId, { empDropdownOpen: true })}
                              onBlur={() => {
                                // Delayed close to allow onMouseDown on suggestions
                                setTimeout(() => {
                                  handleRowChange(row.rowId, { empDropdownOpen: false });
                                }, 200);
                              }}
                              placeholder="Ketik nama / NIK / empNo..."
                              className={`w-full bg-base-surface2 border rounded-xl pl-3 pr-9 py-2 text-xs text-base-text placeholder-base-muted/50 focus:outline-hidden transition ${
                                row.empId
                                  ? 'border-emerald-500/50 bg-emerald-500/5 focus:border-emerald-500 font-medium'
                                  : 'border-base-border focus:border-base-accent'
                              }`}
                            />

                            {/* Clear "✕" Button */}
                            {(row.empQuery || row.empId || row.empName) && (
                              <button
                                type="button"
                                onClick={() => handleClearEmployeeInRow(row.rowId)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-muted hover:text-rose-400 text-xs p-1 rounded-full hover:bg-base-surface3 transition cursor-pointer"
                                title="Hapus pilihan karyawan"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Dropdown Suggestions */}
                          {row.empDropdownOpen && (
                            <div 
                              className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-surface border border-base-border rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-base-border/50 animate-in fade-in zoom-in-95 duration-100"
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                            >
                              {(() => {
                                const suggestions = getFilteredEmployees(row.empQuery || '');
                                if (suggestions.length === 0) {
                                  return (
                                    <div className="px-3 py-3 text-center text-xs text-base-muted italic">
                                      Tidak ada karyawan yang cocok dengan "{row.empQuery}"
                                    </div>
                                  );
                                }
                                return suggestions.map((emp) => {
                                  const isSelected = row.empId === emp.id;
                                  return (
                                    <div
                                      key={emp.id}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectEmployeeInRow(row.rowId, emp.id);
                                      }}
                                      className={`px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition select-none ${
                                        isSelected
                                          ? 'bg-base-accent-dim text-base-accent font-bold'
                                          : 'hover:bg-base-surface2 text-base-text'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="font-semibold truncate">
                                          {emp.name}
                                        </div>
                                        <div className="text-[10px] text-base-muted font-mono truncate">
                                          {emp.empNo ? `[${emp.empNo}] ` : ''}{emp.position || 'General'}
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-base-accent shrink-0" />
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Assembly & Task Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Assembly */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                              Pilih Assembly (Opsional)
                            </label>
                            <select
                              value={row.assemblyId}
                              onChange={(e) => handleSelectAssemblyInRow(row.rowId, e.target.value)}
                              className="w-full bg-base-surface2 border border-base-border rounded-xl px-2.5 py-2 text-xs text-base-text focus:outline-hidden focus:border-base-accent"
                            >
                              <option value="">-- Bebas / Semua Assembly --</option>
                              {(project.assemblies || []).map((asm) => (
                                <option key={asm.id} value={asm.id}>
                                  {asm.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Task */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                              Pilih Task (Opsional)
                            </label>
                            <select
                              value={row.taskId}
                              onChange={(e) => handleSelectTaskInRow(row.rowId, row.assemblyId, e.target.value)}
                              disabled={!row.assemblyId || availableTasks.length === 0}
                              className="w-full bg-base-surface2 border border-base-border rounded-xl px-2.5 py-2 text-xs text-base-text focus:outline-hidden focus:border-base-accent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">
                                {!row.assemblyId 
                                  ? '-- Pilih Assembly Dulu --' 
                                  : availableTasks.length === 0 
                                  ? '-- Tidak ada task --' 
                                  : '-- Bebas / Semua Task --'}
                              </option>
                              {availableTasks.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.pct ?? 0}%)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Hours & Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Hours */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text">
                              Jam Kerja <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0.5"
                                max="24"
                                step="0.5"
                                value={row.totalHours}
                                onChange={(e) => handleRowChange(row.rowId, { totalHours: parseFloat(e.target.value) || 0 })}
                                required
                                className="w-full bg-base-surface2 border border-base-border rounded-xl px-3 py-2 text-xs text-base-text font-mono font-bold focus:outline-hidden focus:border-base-accent"
                              />
                              <div className="flex gap-1 shrink-0">
                                {[4, 8, 10].map((h) => (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => handleRowChange(row.rowId, { totalHours: h })}
                                    className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                                      row.totalHours === h
                                        ? 'bg-base-accent text-white'
                                        : 'bg-base-surface2 text-base-muted hover:text-base-text'
                                    }`}
                                  >
                                    {h}h
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Category */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text">
                              Kategori Tugas <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={row.category}
                              onChange={(e) => handleRowChange(row.rowId, { category: e.target.value })}
                              required
                              className="w-full bg-base-surface2 border border-base-border rounded-xl px-2.5 py-2 text-xs text-base-text focus:outline-hidden focus:border-base-accent"
                            >
                              {rowCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Catatan / keterangan pekerjaan (opsional)..."
                            value={row.desc}
                            onChange={(e) => handleRowChange(row.rowId, { desc: e.target.value })}
                            className="w-full bg-base-surface2 border border-base-border rounded-xl px-3 py-1.5 text-xs text-base-text placeholder-base-muted/50 focus:outline-hidden focus:border-base-accent"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Row Button (Secondary) */}
                <button
                  type="button"
                  onClick={handleAddTimesheetRow}
                  className="w-full py-2.5 border border-dashed border-base-border hover:border-base-accent/50 rounded-xl text-xs font-condensed font-bold uppercase tracking-wider text-base-muted hover:text-base-accent flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Baris Personil Lain</span>
                </button>

                {/* Submit All Timesheets Button */}
                <div className="pt-2 sticky bottom-0 bg-base-bg/95 backdrop-blur-xs pb-1">
                  <button
                    type="submit"
                    disabled={isSavingTimesheet || !timesheetRows.some((r) => r.empId && r.totalHours > 0)}
                    className={`w-full py-3 px-4 rounded-xl font-condensed font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      timesheetRows.some((r) => r.empId && r.totalHours > 0)
                        ? 'bg-base-accent text-white hover:bg-base-accent/90 shadow-md active:scale-[0.99]'
                        : 'bg-base-surface3 text-base-muted cursor-not-allowed opacity-60'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>
                      {isSavingTimesheet 
                        ? 'Menyimpan Timesheet...' 
                        : `Simpan Timesheet (${timesheetRows.filter((r) => r.empId && r.totalHours > 0).length} Orang)`}
                    </span>
                  </button>
                </div>
              </form>

              {/* Today's Existing Entries for this Work Order */}
              <div className="mt-4 pt-3 border-t border-base-border/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Timesheet Hari Ini di WO Ini ({todayWoTimesheets.length})
                  </span>
                  <span className="font-mono text-xs text-base-accent font-bold">
                    Total: {todayWoTimesheets.reduce((s, t) => s + (t.totalHours || 0), 0)} jam
                  </span>
                </div>

                {todayWoTimesheets.length === 0 ? (
                  <div className="p-3 text-center text-xs text-base-muted italic bg-base-surface/50 border border-base-border/50 rounded-xl">
                    Belum ada timesheet yang dicatat untuk WO ini hari ini.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {todayWoTimesheets.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-base-surface border border-base-border rounded-lg p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-base-text truncate">
                            {entry.empName}
                          </div>
                          <div className="text-[10px] text-base-muted flex items-center gap-1.5 flex-wrap">
                            <span>{entry.position || 'General'}</span>
                            <span>•</span>
                            <span className="text-base-accent">{entry.category || 'General'}</span>
                            {(entry.assemblyName || entry.taskName) && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-base-text truncate max-w-[160px]">
                                  {entry.assemblyName ? `${entry.assemblyName}` : ''}
                                  {entry.taskName ? ` / ${entry.taskName}` : ''}
                                </span>
                              </>
                            )}
                          </div>
                          {entry.desc && (
                            <div className="text-[10px] text-base-muted italic truncate mt-0.5">
                              "{entry.desc}"
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm text-base-accent">
                            {entry.totalHours}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB C: STATUS */}
          {/* ========================================================= */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="text-xs text-base-muted font-medium">
                Pilih status operasional terbaru untuk proyek ini:
              </div>

              {/* Status Radio List */}
              <div className="space-y-2.5">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatus === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedStatus(opt.id)}
                      className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? `${opt.color} shadow-sm`
                          : 'border-base-border bg-base-surface hover:bg-base-surface2'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'border-current bg-current/20' : 'border-base-muted'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-condensed font-extrabold text-sm uppercase tracking-wide">
                          {opt.label}
                        </div>
                        <div className="text-xs text-base-muted mt-0.5">
                          {opt.desc}
                        </div>
                        {opt.id === 'completed' && isSelected && (
                          <div className="mt-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                            Tanggal selesai akan otomatis dicatat sebagai: {todayStr}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Save Action */}
              <div className="pt-2 sticky bottom-0 bg-base-bg/95 backdrop-blur-xs pb-1">
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  disabled={isSavingStatus || selectedStatus === project.status}
                  className={`w-full py-3 px-4 rounded-xl font-condensed font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                    selectedStatus !== project.status
                      ? 'bg-base-accent text-white hover:bg-base-accent/90 shadow-md active:scale-[0.99]'
                      : 'bg-base-surface3 text-base-muted cursor-not-allowed opacity-60'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingStatus
                      ? 'Menyimpan Status...'
                      : selectedStatus !== project.status
                      ? `Simpan Status: ${selectedStatus.toUpperCase()}`
                      : 'Status Tidak Berubah'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
