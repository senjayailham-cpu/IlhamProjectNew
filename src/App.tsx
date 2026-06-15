import React, { useState, useEffect, useRef } from 'react';
import { User, Project, Employee, TimesheetEntry, ActivityLog, Task, Dependency, UserRole, Assembly, ProblemReport, InspectionRequest } from './types';
import { DEFAULT_USERS, DEFAULT_PROJECTS, DEFAULT_EMPLOYEES, DEFAULT_TIMESHEETS, DEFAULT_ACTIVITIES, DEFAULT_PROBLEM_REPORTS, DEFAULT_INSPECTION_REQUESTS } from './mockData';
import { calcPct, calcTaskCounts, fmtHrs, esc, getManHoursForWorkOrder } from './utils/projectUtils';

// Modular Subviews
import ThemeToggle from './components/ThemeToggle';
import DashboardView from './components/DashboardView';
import GanttView from './components/GanttView';
import TimesheetView from './components/TimesheetView';
import TimesheetModal from './components/TimesheetModal';
import EmployeesView from './components/EmployeesView';
import DailyReportView from './components/DailyReportView';
import SpotlightModal from './components/SpotlightModal';
import DepModal from './components/DepModal';
import Focus24View from './components/Focus24View';
import InspectionView from './components/InspectionView';

// Lucide Icons
import {
  Folder, Clock, CheckCircle, AlertTriangle, Users, BookOpen, FileText,
  UserPlus, Upload, ShieldCheck, Trash2, Edit, Copy, ChevronDown, LogOut, Save, Search, Lock,
  Archive, RotateCcw
} from 'lucide-react';

const PERMISSIONS = {
  admin:      { addProject: true, editProject: true, deleteProject: true, addAssembly: true, deleteAssembly: true, addTask: true, deleteTask: true, updateTask: true, manageUsers: true, exportData: true, importData: true },
  manager:    { addProject: true, editProject: true, deleteProject: false, addAssembly: true, deleteAssembly: true, addTask: true, deleteTask: true, updateTask: true, manageUsers: false, exportData: true, importData: false },
  technician: { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: true, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false },
  viewer:     { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: false, manageUsers: false, exportData: false, importData: false },
  'facility maintanance': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false },
  'quality control': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false },
  'safety': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false },
  'project control': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: true, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false }
};

/**
 * Highlighting matching search terms helper
 */
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

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);
  const [inspections, setInspections] = useState<InspectionRequest[]>([]);

  // Navigation and Filter parameters
  const [activeTab, setActiveTab] = useState<string>('current');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [timesheetDate, setTimesheetDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [reportDate, setReportDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // Default to yesterday
    return d.toISOString().slice(0, 10);
  });

  // Saving states and auto timer
  const [isChanged, setIsChanged] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('Not saved yet');

  // Search overlay values
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');

  // Authentication Fields
  const [loginId, setLoginId] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Forms Modals Controllers
  const [projectFormOpen, setProjectFormOpen] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [assemblyFormOpen, setAssemblyFormOpen] = useState<boolean>(false);
  const [editingAssemblyId, setEditingAssemblyId] = useState<string | null>(null);
  const [targetAsmProjectId, setTargetAsmProjectId] = useState<string | null>(null);

  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);
  const [copySourceId, setCopySourceId] = useState<string | null>(null);

  const [empModalOpen, setEmpModalOpen] = useState<boolean>(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  const [timesheetModalOpen, setTimesheetModalOpen] = useState<boolean>(false);
  const [editingTsId, setEditingTsId] = useState<string | null>(null);

  const [spotlightOpen, setSpotlightOpen] = useState<boolean>(false);
  const [spotlightProjectId, setSpotlightProjectId] = useState<string | null>(null);

  const [depModalOpen, setDepModalOpen] = useState<boolean>(false);
  const [depModalRowKey, setDepModalRowKey] = useState<string | null>(null);

  const [userMgmtOpen, setUserMgmtOpen] = useState<boolean>(false);
  const [userFormOpen, setUserFormOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [pName, setPName] = useState<string>('');
  const [pWorkOrder, setPWorkOrder] = useState<string>('');
  const [pStatus, setPStatus] = useState<'active' | 'pending' | 'completed' | 'on-hold'>('active');
  const [pStart, setPStart] = useState<string>('');
  const [pDue, setPDue] = useState<string>('');
  const [pCat, setPCat] = useState<'tray' | 'nontray'>('tray');
  const [pLoc, setPLoc] = useState<'workshop1' | 'workshop2'>('workshop1');
  const [pNotes, setPNotes] = useState<string>('');
  const [pBudgetHours, setPBudgetHours] = useState<string>('');

  const [aName, setAName] = useState<string>('');
  const [aStart, setAStart] = useState<string>('');
  const [aFinish, setAFinish] = useState<string>('');
  const [aNotes, setANotes] = useState<string>('');
  const [aBudgetHours, setABudgetHours] = useState<string>('');
  const [aTasksDraft, setATasksDraft] = useState<{ id: string; name: string; assigned: string; pct: number; done: boolean }[]>([]);

  const [copyName, setCopyName] = useState<string>('');
  const [copyStart, setCopyStart] = useState<string>('');
  const [copyDue, setCopyDue] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<string>('active');
  const [copyAsm, setCopyAsm] = useState<boolean>(true);
  const [copyTasks, setCopyTasks] = useState<boolean>(true);
  const [copyKeepClient, setCopyKeepClient] = useState<boolean>(true);

  const [empName, setEmpName] = useState<string>('');
  const [empPosition, setEmpPosition] = useState<string>('');
  const [empLocation, setEmpLocation] = useState<string>('');
  const [empCoordinator, setEmpCoordinator] = useState<string>('');

  const [ufId, setUfId] = useState<string>('');
  const [ufName, setUfName] = useState<string>('');
  const [ufRole, setUfRole] = useState<UserRole>('technician');
  const [ufPass, setUfPass] = useState<string>('');

  // 1. Unified state loader
  useEffect(() => {
    const initializeDataAndUsers = async () => {
      // Boot users
      let loadedUsers = localStorage.getItem('w2proj_users_v1');
      if (!loadedUsers) {
        const defaults = await DEFAULT_USERS();
        localStorage.setItem('w2proj_users_v1', JSON.stringify(defaults));
        setUsers(defaults);
      } else {
        setUsers(JSON.parse(loadedUsers));
      }

      // Check current login session
      const sess = sessionStorage.getItem('w2proj_session_v1');
      if (sess) {
        setCurrentUser(JSON.parse(sess));
      }

      // Boot projects
      const storedProj = localStorage.getItem('w2proj_v1');
      if (storedProj) {
        setProjects(JSON.parse(storedProj));
      } else {
        localStorage.setItem('w2proj_v1', JSON.stringify(DEFAULT_PROJECTS));
        setProjects(DEFAULT_PROJECTS);
      }

      // Boot employees
      const storedEmp = localStorage.getItem('w2proj_employees_v1');
      if (storedEmp) {
        setEmployees(JSON.parse(storedEmp));
      } else {
        localStorage.setItem('w2proj_employees_v1', JSON.stringify(DEFAULT_EMPLOYEES));
        setEmployees(DEFAULT_EMPLOYEES);
      }

      // Boot timesheets
      const storedTs = localStorage.getItem('w2proj_timesheet_v1');
      if (storedTs) {
        setTimesheets(JSON.parse(storedTs));
      } else {
        localStorage.setItem('w2proj_timesheet_v1', JSON.stringify(DEFAULT_TIMESHEETS));
        setTimesheets(DEFAULT_TIMESHEETS);
      }

      // Boot activities
      const storedAct = localStorage.getItem('w2proj_activity_v1');
      if (storedAct) {
        setActivities(JSON.parse(storedAct));
      } else {
        localStorage.setItem('w2proj_activity_v1', JSON.stringify(DEFAULT_ACTIVITIES));
        setActivities(DEFAULT_ACTIVITIES);
      }

      // Boot problem reports
      const storedProb = localStorage.getItem('w2proj_problem_reports_v1');
      if (storedProb) {
        setProblemReports(JSON.parse(storedProb));
      } else {
        localStorage.setItem('w2proj_problem_reports_v1', JSON.stringify(DEFAULT_PROBLEM_REPORTS));
        setProblemReports(DEFAULT_PROBLEM_REPORTS);
      }

      // Boot inspections
      const storedIns = localStorage.getItem('w2proj_inspections_v1');
      if (storedIns) {
        setInspections(JSON.parse(storedIns));
      } else {
        localStorage.setItem('w2proj_inspections_v1', JSON.stringify(DEFAULT_INSPECTION_REQUESTS));
        setInspections(DEFAULT_INSPECTION_REQUESTS);
      }
    };

    initializeDataAndUsers();
  }, []);

  // Recurrent Auto Save Scheduler
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (isChanged) {
        saveNow();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isChanged, projects, employees, timesheets, activities, users, problemReports, inspections]);

  const saveNow = () => {
    localStorage.setItem('w2proj_v1', JSON.stringify(projects));
    localStorage.setItem('w2proj_employees_v1', JSON.stringify(employees));
    localStorage.setItem('w2proj_timesheet_v1', JSON.stringify(timesheets));
    localStorage.setItem('w2proj_activity_v1', JSON.stringify(activities));
    localStorage.setItem('w2proj_users_v1', JSON.stringify(users));
    localStorage.setItem('w2proj_problem_reports_v1', JSON.stringify(problemReports));
    localStorage.setItem('w2proj_inspections_v1', JSON.stringify(inspections));

    setIsChanged(false);
    const tmStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastSavedLabel(`Last saved at ${tmStr}`);
  };

  const verifyMarkChanged = () => {
    setIsChanged(true);
  };

  const uid = () => {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  const sha256 = async (str: string) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const can = (perm: keyof typeof PERMISSIONS.admin): boolean => {
    if (!currentUser) return false;
    return !!PERMISSIONS[currentUser.role]?.[perm];
  };

  const logActivity = (type: any, action: string, projId?: string, projName?: string, asmName?: string, task?: string, oldP?: number, newP?: number, details?: string) => {
    if (!currentUser) return;
    const now = new Date();
    const newAct: ActivityLog = {
      id: uid(),
      ts: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      type,
      action,
      projectId: projId,
      projectName: projName,
      assemblyName: asmName,
      taskName: task,
      oldPct: oldP,
      newPct: newP,
      detail: details
    };

    setActivities(prev => {
      const next = [newAct, ...prev];
      if (next.length > 3000) next.pop();
      return next;
    });
    verifyMarkChanged();
  };

  // --------------------------------------------------------------------------
  // AUTH ROUTINES
  // --------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const targetId = loginId.trim();
    if (!targetId || !loginPass) {
      setLoginError('Complete ID and password fields.');
      return;
    }

    const testUser = users.find(u => u.id === targetId);
    if (!testUser) {
      setLoginError('User ID not found or registered.');
      return;
    }

    const hash = await sha256(loginPass);
    if (hash !== testUser.passHash) {
      setLoginError('Incorrect password value entered.');
      return;
    }

    const session: User = { id: testUser.id, name: testUser.name, role: testUser.role };
    setCurrentUser(session);
    sessionStorage.setItem('w2proj_session_v1', JSON.stringify(session));

    // Redirect
    setActiveTab(testUser.role === 'admin' || testUser.role === 'manager' ? 'current' : 'gantt');
    setLoginId('');
    setLoginPass('');
  };

  const handleLogout = () => {
    if (!confirm('Are you sure you want to log out of the session?')) return;
    setCurrentUser(null);
    sessionStorage.removeItem('w2proj_session_v1');
    setLoginId('');
    setLoginPass('');
  };

  // --------------------------------------------------------------------------
  // PROJECTS OPERATIONS
  // --------------------------------------------------------------------------
  const openAddProject = () => {
    setEditingProjectId(null);
    setPName('');
    setPWorkOrder('');
    setPStatus('active');
    setPStart('');
    setPDue('');
    setPCat('tray');
    setPLoc('workshop1');
    setPNotes('');
    setPBudgetHours('');
    setProjectFormOpen(true);
  };

  const openEditProjectForm = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setEditingProjectId(pid);
    setPName(p.name);
    setPWorkOrder(p.client);
    setPStatus(p.status);
    setPStart(p.start || '');
    setPDue(p.due || '');
    setPCat(p.category || 'tray');
    setPLoc(p.location || 'workshop1');
    setPNotes(p.notes || '');
    setPBudgetHours(p.budgetHours !== undefined ? String(p.budgetHours) : '');
    setProjectFormOpen(true);
  };

  const saveProjectForm = () => {
    if (!pName.trim()) return alert('Insert project name.');
    const wo = pWorkOrder.trim() || 'WO-' + uid().toUpperCase();
    const parsedBudget = pBudgetHours.trim() ? parseFloat(pBudgetHours) : undefined;

    if (editingProjectId) {
      setProjects(prev => prev.map(p => {
        if (p.id === editingProjectId) {
          const wasCompleted = p.status === 'completed';
          const completedDate = pStatus === 'completed' && !wasCompleted ? new Date().toISOString().slice(0, 10) : p.completedDate;
          return {
            ...p,
            name: pName.trim(),
            client: wo,
            status: pStatus,
            start: pStart,
            due: pDue,
            category: pCat,
            location: pLoc,
            notes: pNotes.trim(),
            budgetHours: parsedBudget,
            completedDate: pStatus === 'completed' ? completedDate : null
          };
        }
        return p;
      }));
      logActivity('project_edit', 'Edited project details', editingProjectId, pName.trim(), undefined, undefined, undefined, undefined, `Budget Hours: ${parsedBudget ?? 'N/A'}`);
    } else {
      const addedProj: Project = {
        id: uid(),
        name: pName.trim(),
        client: wo,
        status: pStatus,
        start: pStart,
        due: pDue,
        category: pCat,
        location: pLoc,
        created: new Date().toISOString().slice(0, 10),
        assemblies: [],
        notes: pNotes.trim(),
        budgetHours: parsedBudget,
        completedDate: pStatus === 'completed' ? new Date().toISOString().slice(0, 10) : null
      };

      setProjects(prev => [...prev, addedProj]);
      logActivity('project_add', 'Added new project', addedProj.id, addedProj.name, undefined, undefined, undefined, undefined, `Loc: ${addedProj.location}, Budget: ${parsedBudget ?? 'N/A'}`);
    }

    setProjectFormOpen(false);
    verifyMarkChanged();
  };

  const deleteProjectDetails = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    if (!confirm(`Delete project "${p.name}"? All assemblies and tasks inside will be permanently deleted.`)) return;

    setProjects(prev => prev.filter(x => x.id !== pid));
    logActivity('project_delete', 'Deleted project', pid, p.name);
    setProjectFormOpen(false);
    verifyMarkChanged();
  };

  const archiveProject = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setProjects(prev => prev.map(x => x.id === pid ? { ...x, isArchived: true } : x));
    logActivity('project_edit', 'Archived project', pid, p.name, undefined, undefined, undefined, undefined, 'Project moved to historical archive');
    verifyMarkChanged();
  };

  const unarchiveProject = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setProjects(prev => prev.map(x => x.id === pid ? { ...x, isArchived: false } : x));
    logActivity('project_edit', 'Restored project from archive', pid, p.name, undefined, undefined, undefined, undefined, 'Project moved back to active boards');
    verifyMarkChanged();
  };

  // --------------------------------------------------------------------------
  // SUB ASSEMBLY OPERATIONS
  // --------------------------------------------------------------------------
  const openAssemblyAddForm = (pid: string) => {
    setTargetAsmProjectId(pid);
    setEditingAssemblyId(null);
    setAName('');
    setAStart('');
    setAFinish('');
    setANotes('');
    setABudgetHours('');
    setATasksDraft([]);
    setAssemblyFormOpen(true);
  };

  const openAssemblyEditForm = (pid: string, aid: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    if (!a) return;

    setTargetAsmProjectId(pid);
    setEditingAssemblyId(aid);
    setAName(a.name);
    setAStart(a.start || '');
    setAFinish(a.finish || '');
    setANotes(a.notes || '');
    setABudgetHours(a.budgetHours !== undefined ? String(a.budgetHours) : '');
    setAssemblyFormOpen(true);
  };

  const addDraftTaskNode = () => {
    setATasksDraft(prev => [...prev, { id: uid(), name: '', assigned: '', pct: 0, done: false }]);
  };

  const removeDraftTaskNode = (idx: number) => {
    setATasksDraft(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDraftTaskField = (idx: number, field: string, val: string) => {
    setATasksDraft(prev => prev.map((t, i) => {
      if (i === idx) {
        return { ...t, [field]: val };
      }
      return t;
    }));
  };

  const saveAssemblyForm = () => {
    if (!aName.trim()) return alert('Assembly name required.');
    const p = projects.find(x => x.id === targetAsmProjectId);
    if (!p) return;
    const parsedAsmBudget = aBudgetHours.trim() ? parseFloat(aBudgetHours) : undefined;

    if (editingAssemblyId) {
      // Edit
      setProjects(prev => prev.map(proj => {
        if (proj.id === targetAsmProjectId) {
          return {
            ...proj,
            assemblies: proj.assemblies.map(a => {
              if (a.id === editingAssemblyId) {
                return { ...a, name: aName.trim(), start: aStart, finish: aFinish, notes: aNotes.trim(), budgetHours: parsedAsmBudget };
              }
              return a;
            })
          };
        }
        return proj;
      }));
      logActivity('assembly_edit', 'Edited sub-assembly characteristics', p.id, p.name, aName.trim());
    } else {
      // Create new with build tasks
      const createdAsm: Assembly = {
        id: uid(),
        name: aName.trim(),
        start: aStart,
        finish: aFinish,
        notes: aNotes.trim(),
        budgetHours: parsedAsmBudget,
        tasks: aTasksDraft
          .filter(t => t.name.trim())
          .map(t => ({ id: uid(), name: t.name.trim(), assigned: t.assigned.trim(), pct: 0, done: false }))
      };

      setProjects(prev => prev.map(proj => {
        if (proj.id === targetAsmProjectId) {
          return { ...proj, assemblies: [...proj.assemblies, createdAsm] };
        }
        return proj;
      }));
      logActivity('assembly_add', 'Added new sub-assembly', p.id, p.name, aName.trim(), undefined, undefined, undefined, `${createdAsm.tasks.length} initial tasks appended`);
    }

    setAssemblyFormOpen(false);
    verifyMarkChanged();
  };

  const deleteAssemblyDetails = (pid: string, aid: string) => {
    if (!confirm('Permantly delete this sub-assembly?')) return;
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);

    setProjects(prev => prev.map(proj => {
      if (proj.id === pid) {
        return { ...proj, assemblies: proj.assemblies.filter(x => x.id !== aid) };
      }
      return proj;
    }));

    logActivity('assembly_delete', 'Deleted sub-assembly', pid, p?.name, a ? a.name : '');
    verifyMarkChanged();
  };

  // --------------------------------------------------------------------------
  // TASKS LOGGING ROW MANIPULATIONS
  // --------------------------------------------------------------------------
  const editTaskParameters = (pid: string, aid: string, tid: string, action: string, field: 'name' | 'assigned' | 'pct', value: any) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    const t = a && a.tasks.find(x => x.id === tid);
    if (!t) return;

    const oldPct = t.pct;

    setProjects(prev => prev.map(proj => {
      if (proj.id === pid) {
        return {
          ...proj,
          assemblies: proj.assemblies.map(asm => {
            if (asm.id === aid) {
              return {
                ...asm,
                tasks: asm.tasks.map(tsk => {
                  if (tsk.id === tid) {
                    const next = { ...tsk, [field]: value };
                    if (field === 'pct') {
                      next.done = value >= 100;
                    }
                    return next;
                  }
                  return tsk;
                })
              };
            }
            return asm;
          }
          )
        };
      }
      return proj;
    }));

    if (field === 'pct') {
      logActivity('task_progress', action, pid, p?.name, a?.name, t.name, oldPct, value);
    }
    verifyMarkChanged();
  };

  const addNewTaskNode = (pid: string, aid: string, name: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    if (!a) return;

    const added: Task = { id: uid(), name: name.trim(), assigned: '', pct: 0, done: false };

    setProjects(prev => prev.map(proj => {
      if (proj.id === pid) {
        return {
          ...proj,
          assemblies: proj.assemblies.map(asm => {
            if (asm.id === aid) {
              return { ...asm, tasks: [...asm.tasks, added] };
            }
            return asm;
          })
        };
      }
      return proj;
    }));

    logActivity('task_add', 'Added new task', pid, p?.name, a.name, added.name);
    verifyMarkChanged();
  };

  const removeTaskNode = (pid: string, aid: string, tid: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    const t = a && a.tasks.find(x => x.id === tid);

    setProjects(prev => prev.map(proj => {
      if (proj.id === pid) {
        return {
          ...proj,
          assemblies: proj.assemblies.map(asm => {
            if (asm.id === aid) {
              return { ...asm, tasks: asm.tasks.filter(x => x.id !== tid) };
            }
            return asm;
          })
        };
      }
      return proj;
    }));

    logActivity('task_delete', 'Deleted task record', pid, p?.name, a?.name, t?.name);
    verifyMarkChanged();
  };

  // --------------------------------------------------------------------------
  // COPY COONS & MULTIPLICATION
  // --------------------------------------------------------------------------
  const openCopyModalLauncher = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setCopySourceId(pid);
    setCopyName('Copy of ' + p.name);
    setCopyStart(p.start || '');
    setCopyDue(p.due || '');
    setCopyStatus('active');
    setCopyModalOpen(true);
  };

  const confirmCopyMultiplier = () => {
    const src = projects.find(x => x.id === copySourceId);
    if (!src) return;
    if (!copyName.trim()) return alert('Name project copy.');

    const copiedProj: Project = {
      id: uid(),
      name: copyName.trim(),
      client: copyKeepClient ? src.client : '',
      start: copyStart,
      due: copyDue,
      status: copyStatus as any,
      category: src.category || 'tray',
      location: src.location || 'workshop1',
      created: new Date().toISOString().slice(0, 10),
      assemblies: copyAsm ? (src.assemblies || []).map(a => ({
        id: uid(),
        name: a.name,
        notes: a.notes,
        tasks: copyTasks ? (a.tasks || []).map(t => ({ id: uid(), name: t.name, assigned: t.assigned, pct: 0, done: false })) : []
      })) : []
    };

    setProjects(prev => [...prev, copiedProj]);
    setCopyModalOpen(false);
    verifyMarkChanged();
    alert('Project cloned!');
  };

  // --------------------------------------------------------------------------
  // EMPLOYEES
  // --------------------------------------------------------------------------
  const openAddEmp = () => {
    setEditingEmpId(null);
    setEmpName('');
    setEmpPosition('');
    setEmpLocation('');
    setEmpCoordinator('');
    setEmpModalOpen(true);
  };

  const openEditEmp = (id: string) => {
    const e = employees.find(x => x.id === id);
    if (!e) return;
    setEditingEmpId(id);
    setEmpName(e.name);
    setEmpPosition(e.position || '');
    setEmpLocation(e.location || '');
    setEmpCoordinator(e.coordinator || '');
    setEmpModalOpen(true);
  };

  const saveEmployeeForm = () => {
    if (!empName.trim()) return alert('Name required.');
    if (editingEmpId) {
      setEmployees(prev => prev.map(e => {
        if (e.id === editingEmpId) {
          return { ...e, name: empName.trim(), position: empPosition.trim(), location: empLocation.trim(), coordinator: empCoordinator.trim() };
        }
        return e;
      }));
    } else {
      setEmployees(prev => [...prev, { id: uid(), name: empName.trim(), position: empPosition.trim(), location: empLocation.trim(), coordinator: empCoordinator.trim() }]);
    }
    setEmpModalOpen(false);
    verifyMarkChanged();
  };

  const removeEmployeeRecord = (id: string) => {
    if (!confirm('Confirm personnel deletion?')) return;
    setEmployees(prev => prev.filter(x => x.id !== id));
    verifyMarkChanged();
  };

  const importEmployeesExcel = (rows: Omit<Employee, 'id'>[]) => {
    setEmployees(prev => {
      const copy = [...prev];
      rows.forEach(r => {
        if (!copy.some(x => x.name.toLowerCase() === r.name.toLowerCase())) {
          copy.push({ id: uid(), ...r });
        }
      });
      return copy;
    });
    verifyMarkChanged();
  };

  const handleAddProblemReport = (report: Omit<ProblemReport, 'id' | 'date'>) => {
    const newReport: ProblemReport = {
      ...report,
      id: 'rep_' + uid(),
      date: new Date().toISOString().slice(0, 10)
    };
    setProblemReports(prev => [newReport, ...prev]);
    verifyMarkChanged();
    logActivity(
      'task_add',
      `Reported floor impediment: ${report.category}`,
      report.projectId,
      report.projectName,
      undefined,
      undefined,
      undefined,
      undefined,
      `Department: ${report.assignedPosition}. Desc: ${report.description}`
    );
  };

  const handleUpdateProblemStatus = (id: string, status: 'Open' | 'Resolved', resolutionNote?: string) => {
    setProblemReports(prev => prev.map(r => {
      if (r.id === id) {
        const nowStr = new Date().toISOString().slice(0, 10);
        return {
          ...r,
          status,
          resolutionNote: status === 'Resolved' ? resolutionNote : undefined,
          resolvedAt: status === 'Resolved' ? nowStr : undefined,
          resolvedBy: status === 'Resolved' ? (currentUser?.name || 'System') : undefined
        };
      }
      return r;
    }));
    verifyMarkChanged();

    // Query state directly (or use a functional lookup if needed)
    setProblemReports(current => {
      const target = current.find(x => x.id === id);
      if (target) {
        logActivity(
          'task_toggle',
          `Changed problem status to ${status}`,
          target.projectId,
          target.projectName,
          undefined,
          undefined,
          undefined,
          undefined,
          status === 'Resolved' ? `Resolution: ${resolutionNote}` : 'Re-opened case'
        );
      }
      return current;
    });
  };

  const handleDeleteProblemReport = (id: string) => {
    let deletedTarget = problemReports.find(x => x.id === id);
    setProblemReports(prev => prev.filter(r => r.id !== id));
    verifyMarkChanged();
    if (deletedTarget) {
      logActivity(
        'task_delete',
        `Deleted problem report: ${deletedTarget.category}`,
        deletedTarget.projectId,
        deletedTarget.projectName,
        undefined,
        undefined,
        undefined,
        undefined,
        deletedTarget.description
      );
    }
  };

  // --------------------------------------------------------------------------
  // REQUEST FOR INSPECTION (RFI) LOGISTICS
  // --------------------------------------------------------------------------
  const handleAddInspection = (ins: Omit<InspectionRequest, 'id' | 'rfiNo'>) => {
    const yrCode = new Date().getFullYear();
    const count = inspections.length + 1;
    const rfiNo = `RFI-${yrCode}-${String(count).padStart(3, '0')}`;

    const newIns: InspectionRequest = {
      ...ins,
      id: 'ins_' + uid(),
      rfiNo
    };

    setInspections(prev => [newIns, ...prev]);
    verifyMarkChanged();

    logActivity(
      'assembly_add',
      `Submitted inspection request ${newIns.rfiNo} (${newIns.inspectionType})`,
      newIns.projectId,
      newIns.projectName,
      newIns.assemblyName,
      undefined,
      undefined,
      undefined,
      `Requested target date is ${newIns.targetDate}. Remarks: ${newIns.rcomments || 'None'}`
    );
  };

  const handleUpdateInspectionStatus = (
    id: string,
    status: InspectionRequest['status'],
    comments?: string,
    assignedInspector?: string,
    punchList?: string
  ) => {
    setInspections(prev => prev.map(ins => {
      if (ins.id === id) {
        const isApprove = status === 'Approved';
        const actMsg = isApprove
          ? `Approved inspection request ${ins.rfiNo} (${ins.inspectionType})`
          : `Issued rework punchlist for ${ins.rfiNo} (${ins.inspectionType})`;

        logActivity(
          'assembly_edit',
          actMsg,
          ins.projectId,
          ins.projectName,
          ins.assemblyName,
          undefined,
          undefined,
          undefined,
          comments
        );

        return {
          ...ins,
          status,
          comments: comments || ins.comments,
          assignedInspector: assignedInspector || ins.assignedInspector,
          punchList: punchList !== undefined ? punchList : ins.punchList,
          inspectedDate: new Date().toISOString().slice(0, 10),
          inspectedBy: assignedInspector || currentUser?.name || 'QC Inspector'
        };
      }
      return ins;
    }));
    verifyMarkChanged();
  };

  const handleDeleteInspection = (id: string) => {
    const deleted = inspections.find(ins => ins.id === id);
    setInspections(prev => prev.filter(ins => ins.id !== id));
    verifyMarkChanged();

    if (deleted) {
      logActivity(
        'assembly_delete',
        `Deleted inspection request record ${deleted.rfiNo}`,
        deleted.projectId,
        deleted.projectName,
        deleted.assemblyName,
        undefined,
        undefined,
        undefined,
        `Type: ${deleted.inspectionType}`
      );
    }
  };

  // --------------------------------------------------------------------------
  // TIMESHEETS LOGISTICS
  // --------------------------------------------------------------------------
  const openTimesheetBulkAdd = () => {
    setEditingTsId(null);
    setTimesheetModalOpen(true);
  };

  const openTimesheetEditForm = (id: string) => {
    setEditingTsId(id);
    setTimesheetModalOpen(true);
  };

  const saveTimesheetsBulkImport = (rawLogs: any[]) => {
    setTimesheets(prev => {
      const copy = [...prev];
      rawLogs.forEach(rl => {
        if (editingTsId) {
          const idx = copy.findIndex(x => x.id === editingTsId && x.empId === rl.empId);
          if (idx > -1) {
            copy[idx] = { ...copy[idx], ...rl };
          } else {
            copy.push({ id: uid(), date: timesheetDate, ...rl });
          }
        } else {
          // Overwrite duplicate records logged for that worker on the same date
          const idx = copy.findIndex(x => x.date === timesheetDate && x.empId === rl.empId);
          if (idx > -1) {
            copy[idx] = { ...copy[idx], ...rl };
          } else {
            copy.push({ id: uid(), date: timesheetDate, ...rl });
          }
        }
      });
      return copy;
    });

    setTimesheetModalOpen(false);
    verifyMarkChanged();
  };

  const removeTimesheetEntry = (id: string) => {
    if (!confirm('Remove logging entry?')) return;
    setTimesheets(prev => prev.filter(x => x.id !== id));
    verifyMarkChanged();
  };

  const exportTimesheetExcel = () => {
    // Dynamically downloads standard XLSX document rows in background
    alert('Spreadsheet compiled dynamically in component views!');
  };

  // --------------------------------------------------------------------------
  // DEPENDENCY TREE CONNECTIONS
  // --------------------------------------------------------------------------
  const saveDependenciesHandler = (rowKey: string, predsArr: Dependency[], succsArr: Dependency[]) => {
    const updateRelations = (target: Dependency[], inverseField: 'successors' | 'predecessors', key: string) => {
      // Purge old inverse connections
      setProjects(prev => prev.map(p => {
        const clearInverseDir = (arr?: Dependency[]) => (arr || []).filter(x => x.key !== key);
        const pKey = `p:${p.id}`;
        let updatedP = {
          ...p,
          [inverseField]: clearInverseDir(p[inverseField])
        };

        updatedP.assemblies = (p.assemblies || []).map(a => {
          const aKey = `a:${p.id}:${a.id}`;
          return {
            ...a,
            [inverseField]: clearInverseDir(a[inverseField])
          };
        });

        return updatedP;
      }));

      // Map new ones
      target.forEach(dep => {
        setProjects(prev => prev.map(p => {
          const pKey = `p:${p.id}`;
          if (pKey === dep.key) {
            const arr = p[inverseField] || [];
            if (!arr.some(x => x.key === key)) {
              return { ...p, [inverseField]: [...arr, { key, type: dep.type, lag: dep.lag }] };
            }
          }

          p.assemblies = (p.assemblies || []).map(a => {
            const aKey = `a:${p.id}:${a.id}`;
            if (aKey === dep.key) {
              const arr = a[inverseField] || [];
              if (!arr.some(x => x.key === key)) {
                return { ...a, [inverseField]: [...arr, { key, type: dep.type, lag: dep.lag }] };
              }
            }
            return a;
          });

          return p;
        }));
      });
    };

    // Update main
    setProjects(prev => prev.map(p => {
      const pKey = `p:${p.id}`;
      if (pKey === rowKey) {
        return { ...p, predecessors: predsArr, successors: succsArr };
      }

      p.assemblies = (p.assemblies || []).map(a => {
        const aKey = `a:${p.id}:${a.id}`;
        if (aKey === rowKey) {
          return { ...a, predecessors: predsArr, successors: succsArr };
        }
        return a;
      });

      return p;
    }));

    updateRelations(predsArr, 'successors', rowKey);
    updateRelations(succsArr, 'predecessors', rowKey);

    setDepModalOpen(false);
    verifyMarkChanged();
  };

  // --------------------------------------------------------------------------
  // INLINE FORM MODALS RENDERING
  // --------------------------------------------------------------------------

  // Render Login Window overlay if user not verified
  if (!currentUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-linear-to-b from-[#e8e8e8] to-[#f4f5f7] dark:from-[#0d1014] dark:to-[#151921] z-50">
        <div className="bg-base-surface shadow-modal border border-base-border2 p-8 rounded-2xl w-full max-w-sm flex flex-col space-y-6 animate-in zoom-in-95 ease-out duration-150 relative">
          <div className="flex flex-col items-center space-y-2 text-center">
            <h1 className="text-3xl font-extrabold font-condensed tracking-wider uppercase text-[#9b1c2e]">AUSTIN BATAM</h1>
            <p className="text-xs text-base-muted font-condensed tracking-widest font-bold">PROJECT & MANPOWER TRACKER</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 text-xs bg-base-red-dim border border-base-red/25 rounded-lg text-base-red text-center select-none font-semibold">
                {loginError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">User ID ID</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. admin, rizki, hasrad"
                className="w-full px-3 py-2 bg-base-bg border border-base-border rounded text-xs select-text focus:border-base-accent outline-none text-base-text font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-3 py-2 bg-base-bg border border-base-border rounded text-xs select-text focus:border-base-accent outline-none text-base-text font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-base-accent text-white font-condensed font-bold text-sm tracking-wider uppercase rounded-xl hover:bg-base-accent2 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock className="h-4 w-4" />
              <span>Log in to portal</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter lists inside active tab parameters
  const activeTabsList = [
    { id: 'dash', label: 'Dashboard', icon: 'LayoutGrid', access: 'all' },
    { id: 'focus24', label: '24 Hours Focus', icon: 'AlertTriangle', access: 'all' },
    { id: 'current', label: 'Current Projects', icon: 'Folder', access: 'all' },
    { id: 'gantt', label: 'Gantt', icon: 'Clock', access: 'all' },
    { id: 'completed', label: 'Project Complete', icon: 'CheckCircle', access: 'all' },
    { id: 'archive', label: 'Archive', icon: 'Archive', access: 'all' },
    { id: 'tray', label: 'Project Tray', icon: 'Folder', access: 'all' },
    { id: 'nontray', label: 'Project Non-Tray', icon: 'Folder', access: 'all' },
    { id: 'inspections', label: 'QC Inspection', icon: 'ClipboardCheck', access: 'all' },
    { id: 'dailyreport', label: 'Daily Report', icon: 'FileText', access: ['admin', 'manager'] },
    { id: 'employees', label: 'Employees', icon: 'Users', access: 'all' },
    { id: 'timesheet', label: 'Timesheet', icon: 'Clock', access: 'all' }
  ];

  return (
    <div className="min-h-screen bg-base-bg text-base-text flex flex-col font-sans transition-colors duration-200">
      
      {/* Topbar Layout Header */}
      <header className="sticky top-0 bg-base-surface border-b border-base-border z-40 px-6 py-3.5 shadow-card flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-2 select-none">
          <div className="font-condensed font-black text-2xl tracking-widest text-base-text select-none leading-none mr-1">
            AUSTIN <span className="text-[#9b1c2e]">BATAM</span>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full font-condensed font-extrabold text-[9px] uppercase bg-base-accent-dim text-base-accent border border-base-accent/20 tracking-wider">
            Workspace
          </span>
        </div>

        {/* Global Toolbar and Session info */}
        <div className="flex items-center gap-3">
          {/* Last save status */}
          <div className="hidden lg:flex items-center text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted gap-1 border-r border-base-border pr-2">
            <span className={`w-2 h-2 rounded-full ${isChanged ? 'bg-base-accent animate-ping' : 'bg-base-green'}`} />
            <span>{isChanged ? 'Unsaved changes' : lastSavedLabel}</span>
          </div>

          <ThemeToggle />

          {/* User Profile Pill details */}
          <div className="flex items-center gap-2 border border-base-border rounded-full p-1 pl-3 bg-base-surface2 border-b">
            <div className="flex flex-col items-end hidden sm:block leading-none">
              <span className="text-xs font-bold text-base-text block">{currentUser.name}</span>
              <span className="text-[9px] font-condensed font-extrabold text-base-accent uppercase mt-1 tracking-wider">{currentUser.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 px-2.5 rounded-full text-base-muted hover:text-base-red hover:bg-base-red/10 cursor-pointer flex items-center justify-center font-bold text-xs"
              title="Log out session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {can('manageUsers') && (
            <button
              onClick={() => {
                setUserFormOpen(false);
                setUserMgmtOpen(true);
              }}
              className="px-3.5 py-1.5 bg-base-surface text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer font-condensed font-bold text-xs border border-base-border rounded-lg uppercase tracking-wider"
            >
              Users
            </button>
          )}

          {can('exportData') && (
            <button
              onClick={saveNow}
              className="p-2 border border-base-border bg-base-surface text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer rounded-lg flex items-center justify-center shadow-xs"
              title="Save Portal database"
            >
              <Save className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tab selection row */}
      <nav className="bg-base-surface2 px-6 border-b border-base-border flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none shadow-card sticky top-14.5 z-30">
        {activeTabsList
          .filter(t => t.access === 'all' || (Array.isArray(t.access) && t.access.includes(currentUser.role)))
          .map(t => {
            const hasCountsBadge = t.id === 'completed';
            const compCount = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
            const hasArchiveBadge = t.id === 'archive';
            const archiveCount = projects.filter(p => p.isArchived).length;
            const hasProblemBadge = t.id === 'focus24';
            const openProbCount = problemReports.filter(r => r.status === 'Open').length;
            const hasInspectionBadge = t.id === 'inspections';
            const pendingQcCount = inspections.filter(ins => ins.status === 'Requested').length;

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-3 px-4 font-condensed font-extrabold uppercase text-xs tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === t.id
                    ? 'border-base-accent text-base-accent'
                    : 'border-transparent text-base-muted hover:text-base-text'
                }`}
              >
                <span>{t.label}</span>
                {hasCountsBadge && compCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-base-green/20 text-base-green leading-none">{compCount}</span>
                )}
                {hasArchiveBadge && archiveCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-base-accent-dim text-base-accent border border-base-accent/20 leading-none">{archiveCount}</span>
                )}
                {hasProblemBadge && openProbCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-[#9b1c2e] text-white font-sans font-bold leading-none animate-pulse">{openProbCount}</span>
                )}
                {hasInspectionBadge && pendingQcCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-500 font-sans font-bold leading-none">{pendingQcCount}</span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Main viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {/* Render selected Tabs component views */}
        {activeTab === 'dash' && (
          <DashboardView
            projects={projects}
            timesheets={timesheets}
            employees={employees}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            openSpotlight={(id) => { setSpotlightProjectId(id); setSpotlightOpen(true); }}
          />
        )}

        {/* 24 Hours Focus tab */}
        {activeTab === 'focus24' && (
          <Focus24View
            problemReports={problemReports}
            projects={projects}
            employees={employees}
            currentUser={currentUser}
            onAddProblemReport={handleAddProblemReport}
            onUpdateProblemStatus={handleUpdateProblemStatus}
            onDeleteProblemReport={handleDeleteProblemReport}
            openSpotlight={(id) => { setSpotlightProjectId(id); setSpotlightOpen(true); }}
          />
        )}

        {/* Current Projects tab */}
        {activeTab === 'current' && (() => {
          const filteredProjects = projects
            .filter(p => p.status === 'active' || p.status === 'pending')
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProjects.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-base-surface border border-base-border border-dashed rounded-xl space-y-3">
                    <div className="text-base-muted font-medium text-sm">No current schedules match your search.</div>
                    {projectSearchQuery && (
                      <button
                        id="current-projects-no-results-clear-btn"
                        onClick={() => setProjectSearchQuery('')}
                        className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase"
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                ) : (
                  filteredProjects.map(p => {
                    const pct = calcPct(p);
                    const tasksInfo = calcTaskCounts(p);
                    const hasActiveSearch = projectSearchQuery.trim() !== '';

                    return (
                      <div 
                        key={p.id} 
                        className={`p-4 space-y-4 rounded-xl relative overflow-hidden group transition-all duration-300 ${
                          hasActiveSearch 
                            ? 'bg-base-surface border-2 border-base-accent animate-pulse-highlight scale-[1.011]' 
                            : 'bg-base-surface border border-base-border shadow-card hover:border-base-border2'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1 pr-6 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                                className="font-condensed font-extrabold text-lg tracking-wide text-base-text cursor-pointer hover:text-base-accent transition-colors leading-tight truncate flex-1 min-w-0"
                              >
                                {highlightText(p.name, projectSearchQuery)}
                              </h3>
                              {hasActiveSearch && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-condensed font-black uppercase bg-base-accent/15 text-base-accent border border-base-accent/30 tracking-wider">
                                  <Search className="w-2 h-2 text-base-accent animate-pulse" />
                                  MATCH
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-condensed font-extrabold text-base-blue uppercase mt-0.5 tracking-wider font-mono">
                              {highlightText(p.client, projectSearchQuery)}
                            </p>
                          </div>

                          {/* Interactive toggle forms */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                              className="p-1 text-base-muted hover:text-base-text hover:bg-base-surface3 rounded-lg"
                              title="Open spotlight inspector"
                            >
                              <BookOpen className="h-4 w-4" />
                            </button>
                            {can('editProject') && (
                              <button
                                onClick={() => openEditProjectForm(p.id)}
                                className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-lg"
                                title="Edit parameters"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {can('editProject') && (
                              <button
                                onClick={() => openCopyModalLauncher(p.id)}
                                className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-lg"
                                title="Clone project"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Timeline properties */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-base-muted2 font-medium items-center">
                          {p.start && <span><b>Start:</b> {p.start}</span>}
                          {p.due && <span><b>Due:</b> {p.due}</span>}
                          <span><b>Workshop:</b> <span className="capitalize">{p.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2'}</span></span>
                          {(() => {
                            const usedHours = getManHoursForWorkOrder(p.client, timesheets);
                            const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                            const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                            return (
                              <span 
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-condensed font-extrabold uppercase tracking-wide border transition-all ${
                                  isOverBudget 
                                    ? 'bg-red-500/10 text-red-500 border-red-500/40 animate-pulse font-black' 
                                    : hasBudget
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                      : 'bg-base-accent-dim/25 text-base-accent border-transparent'
                                }`}
                              >
                                <Clock className="h-3 w-3" />
                                <span>
                                  {fmtHrs(usedHours)}h used 
                                  {hasBudget && ` / ${p.budgetHours}h budget`}
                                </span>
                              </span>
                            );
                          })()}
                        </div>

                        {/* Progression bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-condensed font-bold text-base-muted2">
                            <span>Complete score</span>
                            <span>{pct}% ({tasksInfo.done}/{tasksInfo.total} tasks)</span>
                          </div>
                          <div className="h-2 bg-base-border/20 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-base-accent transition-all duration-300" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {can('addAssembly') && (
                          <div className="pt-2 flex justify-between items-center border-t border-base-border/30">
                            <span className="text-[11px] text-base-muted font-bold font-condensed uppercase tracking-wider">{p.assemblies.length} subassembly blocks</span>
                            <button
                              onClick={() => openAssemblyAddForm(p.id)}
                              className="px-2.5 py-1 text-[10px] font-condensed font-extrabold uppercase bg-base-surface2 border border-base-border hover:bg-base-surface3 hover:text-base-text rounded-md text-base-muted2 cursor-pointer transition-colors"
                            >
                              + Add Assembly
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'gantt' && (
          <GanttView
            projects={projects}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            openDepModal={(rowKey) => { setDepModalRowKey(rowKey); setDepModalOpen(true); }}
          />
        )}

        {/*completed, tray, nontray, and archive tabs will filter the list and render lists identical to current*/}
        {(activeTab === 'completed' || activeTab === 'tray' || activeTab === 'nontray' || activeTab === 'archive') && (
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

            {(() => {
              const matchedProjects = projects.filter(p => {
                if (activeTab === 'completed') return p.status === 'completed' && !p.isArchived;
                if (activeTab === 'tray') return p.category === 'tray' && p.status !== 'completed' && !p.isArchived;
                if (activeTab === 'nontray') return p.category === 'nontray' && p.status !== 'completed' && !p.isArchived;
                if (activeTab === 'archive') return p.isArchived === true;
                return false;
              });

              if (matchedProjects.length === 0) {
                return (
                  <div className="bg-base-surface border border-base-border rounded-xl p-8 text-center text-sm text-base-muted font-medium">
                    No projects found in this view.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchedProjects.map(p => {
                    const pct = calcPct(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                        className="bg-base-surface border border-base-border hover:border-base-border2 rounded-xl p-4 shadow-card hover:shadow-elevated transition-colors cursor-pointer space-y-3 relative group"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-condensed font-extrabold text-base text-base-text leading-snug truncate pr-6">{p.name}</h3>
                            <span className="text-[10px] font-condensed font-extrabold text-base-blue uppercase tracking-wide font-mono mt-0.5 block">{p.client}</span>
                          </div>
                          <span className="font-condensed font-extrabold text-sm text-base-accent shrink-0">{pct}%</span>
                        </div>
                        <div className="text-[10px] font-condensed font-bold uppercase text-base-muted2 tracking-wider flex items-center justify-between pt-2 border-t border-base-border/30 gap-2">
                          <span className="shrink-0">Due: {p.due || 'No date'}</span>
                          {(() => {
                            const usedHours = getManHoursForWorkOrder(p.client, timesheets);
                            const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                            const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                            return (
                              <span className={`font-extrabold text-[12px] flex items-center gap-1 normal-case shrink-0 ${
                                isOverBudget 
                                  ? 'text-red-500 animate-pulse font-black' 
                                  : 'text-base-accent'
                              }`}>
                                Hours: {fmtHrs(usedHours)}H{hasBudget ? ` / ${p.budgetHours}H` : ''}
                              </span>
                            );
                          })()}
                          <span className="capitalize shrink-0">{p.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2'}</span>
                        </div>

                        {/* Card actions line */}
                        <div className="flex justify-end pt-1 gap-2 border-t border-base-border/20">
                          {p.status === 'completed' && !p.isArchived && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveProject(p.id);
                              }}
                              className="px-2.5 py-1 text-[10px] font-condensed font-extrabold bg-base-accent-dim hover:bg-base-accent hover:text-white border border-base-accent/20 hover:border-transparent text-base-accent rounded transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                              title="Archive completed project"
                            >
                              <Archive className="w-3 h-3 text-current" />
                              <span>Archive Project</span>
                            </button>
                          )}
                          {p.isArchived && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                unarchiveProject(p.id);
                              }}
                              className="px-2.5 py-1 text-[10px] font-condensed font-extrabold bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 hover:border-transparent text-emerald-500 rounded transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                              title="Restore to Completed Log"
                            >
                              <RotateCcw className="w-3 h-3 text-current" />
                              <span>Restore Project</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'dailyreport' && (
          <DailyReportView
            projects={projects}
            activityLogs={activities}
            reportDate={reportDate}
            setReportDate={setReportDate}
            clearActivityLogs={() => { if (confirm('Clear audit trails permanently?')) setActivities([]); }}
            openPrintView={() => {
              // Custom printer window triggers
              const w = window.open('','_blank','width=900,height=700');
              if (w) {
                w.document.write(`
                  <html>
                    <head><title>Austin Batam Daily Audit Report</title></head>
                    <body style="font-family:sans-serif;padding:40px;color:#111">
                      <h2>Austin Daily Audit Log — ${reportDate}</h2>
                      <hr style="border:0;border-bottom:1px solid #ddd;margin:20px 0"/>
                      <ul>
                        ${activities.filter(a => a.date === reportDate).map(a => `<li>[${a.time}] <b>${a.userName}</b>: ${a.action} (${a.projectName || ''})</li>`).join('')}
                      </ul>
                    </body>
                  </html>
                `);
                w.document.close();
                w.print();
              }
            }}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesView
            employees={employees}
            openAddEmployee={openAddEmp}
            openEditEmployee={openEditEmp}
            deleteEmployee={removeEmployeeRecord}
            onImportExcel={importEmployeesExcel}
          />
        )}

        {activeTab === 'inspections' && (
          <InspectionView
            projects={projects}
            inspections={inspections}
            currentUser={currentUser}
            onAddInspection={handleAddInspection}
            onUpdateInspectionStatus={handleUpdateInspectionStatus}
            onDeleteInspection={handleDeleteInspection}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetView
            timesheets={timesheets}
            employees={employees}
            projects={projects}
            timesheetDate={timesheetDate}
            setTimesheetDate={setTimesheetDate}
            openAddTimesheet={openTimesheetBulkAdd}
            openEditTimesheet={openTimesheetEditForm}
            deleteTsEntry={removeTimesheetEntry}
            exportTimesheetDaily={exportTimesheetExcel}
            openSpotlight={(pid) => { setSpotlightProjectId(pid); setSpotlightOpen(true); }}
          />
        )}
      </main>

      {/* Auto saving persistent footer message */}
      <footer className="fixed bottom-0 left-0 right-0 py-2.5 px-6 border-t border-base-border bg-base-surface text-base-muted text-[10px] font-condensed font-bold uppercase tracking-wider flex items-center justify-between z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <span>Austin Batam · Project tracking console</span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isChanged ? 'bg-base-accent animate-pulse' : 'bg-base-green'}`} />
          <span>{isChanged ? 'Save portal memory now' : lastSavedLabel}</span>
        </span>
      </footer>

      {/* --------------------------------------------------------------------------
          MODALS AND FORMS
          -------------------------------------------------------------------------- */}

      {/* Project Form Modal */}
      {projectFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150 relative">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">
              {editingProjectId ? 'Modify Project' : 'Configure Project'}
            </h3>
            
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Project Name</label>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="e.g. Panel Upgrade, Piping Framing..."
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Work Order Code</label>
                <input
                  type="text"
                  value={pWorkOrder}
                  onChange={(e) => setPWorkOrder(e.target.value)}
                  placeholder="e.g. WO-2026-001..."
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none uppercase font-mono font-bold tracking-wide"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Status</label>
                  <select
                    value={pStatus}
                    onChange={(e: any) => setPStatus(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Category</label>
                  <select
                    value={pCat}
                    onChange={(e: any) => setPCat(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                  >
                    <option value="tray">Tray</option>
                    <option value="nontray">Non-Tray</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Start Date</label>
                  <input
                    type="date"
                    value={pStart}
                    onChange={(e) => setPStart(e.target.value)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Due Date</label>
                  <input
                    type="date"
                    value={pDue}
                    onChange={(e) => setPDue(e.target.value)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Location Workshop</label>
                  <select
                    value={pLoc}
                    onChange={(e: any) => setPLoc(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                  >
                    <option value="workshop1">Workshop 1</option>
                    <option value="workshop2">Workshop 2</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Budget Hours</label>
                  <input
                    type="number"
                    value={pBudgetHours}
                    onChange={(e) => setPBudgetHours(e.target.value)}
                    placeholder="None (e.g. 100)"
                    min="0"
                    step="any"
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Scope Notes</label>
                <textarea
                  value={pNotes}
                  onChange={(e) => setPNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none h-16 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {editingProjectId && can('deleteProject') ? (
                <button
                  onClick={() => deleteProjectDetails(editingProjectId)}
                  className="px-2.5 py-1.5 bg-base-red-dim border border-base-red/30 text-base-red hover:bg-base-red font-condensed font-bold text-xs uppercase tracking-wider rounded-lg hover:text-white"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex gap-2 text-xs">
                <button onClick={() => setProjectFormOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
                <button onClick={saveProjectForm} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assembly Add/Edit Form Modal */}
      {assemblyFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150 relative">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">
              {editingAssemblyId ? 'Edit Sub-Assembly' : 'Configure Sub-Assembly'}
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Assembly Name</label>
                <input
                  type="text"
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                  placeholder="e.g. Electrical Panels wiring, framing structural..."
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Start Date</label>
                  <input
                    type="date"
                    value={aStart}
                    onChange={(e) => setAStart(e.target.value)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Finish Date</label>
                  <input
                    type="date"
                    value={aFinish}
                    onChange={(e) => setAFinish(e.target.value)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Notes</label>
                <input
                  type="text"
                  value={aNotes}
                  onChange={(e) => setANotes(e.target.value)}
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Budget Hours Limit</label>
                <input
                  type="number"
                  value={aBudgetHours}
                  onChange={(e) => setABudgetHours(e.target.value)}
                  placeholder="None (e.g. 40)"
                  min="0"
                  step="any"
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                />
              </div>

              {!editingAssemblyId && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Tasks Draft List</label>
                    <button
                      onClick={addDraftTaskNode}
                      className="px-2 py-0.5 rounded border border-base-border bg-base-surface3 leading-none text-[9px] uppercase font-condensed font-extrabold cursor-pointer"
                    >
                      + Add Task
                    </button>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {aTasksDraft.map((t, idx) => (
                      <div key={t.id} className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={t.name}
                          onChange={(e) => handleDraftTaskField(idx, 'name', e.target.value)}
                          placeholder="Task name..."
                          className="flex-1 px-2 py-1 bg-base-surface2 border border-base-border rounded text-xs"
                        />
                        <button
                          onClick={() => removeDraftTaskNode(idx)}
                          className="px-1.5 py-1 text-base-red hover:bg-base-red/10 rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              {editingAssemblyId && can('deleteAssembly') && targetAsmProjectId ? (
                <button
                  onClick={() => { deleteAssemblyDetails(targetAsmProjectId, editingAssemblyId); setAssemblyFormOpen(false); }}
                  className="px-2.5 py-1.5 bg-base-red-dim border border-base-red/30 text-base-red hover:bg-base-red font-condensed font-bold text-xs uppercase tracking-wider rounded-lg hover:text-white"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex gap-2 text-xs">
                <button onClick={() => setAssemblyFormOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
                <button onClick={saveAssemblyForm} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150 relative">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">Cloning project metadata</h3>
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Name</label>
                <input type="text" value={copyName} onChange={(e) => setCopyName(e.target.value)} className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Start</label>
                  <input type="date" value={copyStart} onChange={(e) => setCopyStart(e.target.value)} className="w-full px-3 py-1.5 bg-base-bg border-base-border border rounded outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Due</label>
                  <input type="date" value={copyDue} onChange={(e) => setCopyDue(e.target.value)} className="w-full px-3 py-1.5 bg-base-bg border-base-border border rounded outline-none" />
                </div>
              </div>
              <div className="bg-base-surface2 border border-base-border p-3.5 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={copyAsm} onChange={(e) => setCopyAsm(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Clone sub-assemblies
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={copyTasks} onChange={(e) => setCopyTasks(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Clone tasks details
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={copyKeepClient} onChange={(e) => setCopyKeepClient(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Keep Work Order
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs pt-2">
              <button onClick={() => setCopyModalOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
              <button onClick={confirmCopyMultiplier} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Clone</button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal Form Dialog */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">
              {editingEmpId ? 'Modify Personnel' : 'Add Personnel'}
            </h3>
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Full Name</label>
                <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="e.g. Budi Wijaya" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Position Role</label>
                <input type="text" value={empPosition} onChange={(e) => setEmpPosition(e.target.value)} placeholder="e.g. Fitter Class 1" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Site Location</label>
                <input type="text" value={empLocation} onChange={(e) => setEmpLocation(e.target.value)} placeholder="e.g. Workshop 1, Batam" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Coordinator PPC</label>
                <input type="text" value={empCoordinator} onChange={(e) => setEmpCoordinator(e.target.value)} placeholder="e.g. Rizki PPC, Hasrad PPC" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs pt-2">
              <button onClick={() => setEmpModalOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
              <button onClick={saveEmployeeForm} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Timesheet Modal Dialog viewport loader */}
      <TimesheetModal
        isOpen={timesheetModalOpen}
        onClose={() => setTimesheetModalOpen(false)}
        timesheetDate={timesheetDate}
        setTimesheetDate={setTimesheetDate}
        timesheets={timesheets}
        employees={employees}
        projects={projects}
        editingId={editingTsId}
        onSave={saveTimesheetsBulkImport}
      />

      {/* Project Spotlight Inspector */}
      <SpotlightModal
        isOpen={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        projectId={spotlightProjectId}
        projects={projects}
        timesheets={timesheets}
        onEdit={(pid) => { setSpotlightOpen(false); openEditProjectForm(pid); }}
        onEditAssembly={(pid, aid) => { setSpotlightOpen(false); openAssemblyEditForm(pid, aid); }}
        onUpdateProject={(updatedProj, logParams) => {
          setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
          verifyMarkChanged();
          if (logParams) {
            logActivity(
              logParams.type,
              logParams.action,
              updatedProj.id,
              updatedProj.name,
              logParams.asmName,
              logParams.task,
              logParams.oldP,
              logParams.newP
            );
          }
        }}
        canUpdateTask={can('updateTask')}
      />

      {/* Dependency Link Editor Modal */}
      <DepModal
        isOpen={depModalOpen}
        onClose={() => setDepModalOpen(false)}
        rowKey={depModalRowKey}
        projects={projects}
        onSave={saveDependenciesHandler}
      />

      {/* Users Admin Control Modal */}
      {userMgmtOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150">
            <div className="flex justify-between items-center border-b border-base-border pb-2.5">
              <span className="font-condensed font-extrabold uppercase text-base text-base-text">Port User Administration</span>
              <button
                onClick={() => {
                  setEditingUserId(null);
                  setUfId('');
                  setUfName('');
                  setUfRole('technician');
                  setUfPass('');
                  setUserFormOpen(true);
                }}
                className="btn btn-accent btn-sm p-1.5 font-condensed font-bold uppercase text-[10px] tracking-wider"
              >
                + New user
              </button>
            </div>

            {/* In-app user drafting section */}
            {userFormOpen && (
              <div className="bg-base-surface2 border border-base-border p-4 rounded-lg space-y-3.5 text-xs font-semibold">
                <div className="font-condensed font-bold uppercase tracking-widest text-[#9b1c2e]" style={{ fontSize: '10px' }}>User Parameters Form</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">User ID ID</label>
                    <input type="text" value={ufId} disabled={!!editingUserId} onChange={(e) => setUfId(e.target.value)} className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border border rounded" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Display name</label>
                    <input type="text" value={ufName} onChange={(e) => setUfName(e.target.value)} className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border border rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Portal Role</label>
                    <select
                      value={ufRole}
                      onChange={(e: any) => setUfRole(e.target.value)}
                      className="w-full px-2 py-1.5 bg-base-bg border border-base-border border rounded outline-none font-bold"
                    >
                      <option value="admin">Admin (Full Control)</option>
                      <option value="manager">Manager (Edit Scope)</option>
                      <option value="technician">Coordinator (Update Tasks)</option>
                      <option value="viewer">Viewer (Read Only)</option>
                      <option value="facility maintanance">Facility Maintanance</option>
                      <option value="quality control">Quality Control</option>
                      <option value="safety">Safety</option>
                      <option value="project control">Project Control</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Password</label>
                    <input type="password" value={ufPass} onChange={(e) => setUfPass(e.target.value)} className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border border rounded" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end text-xs pt-1">
                  <button onClick={() => setUserFormOpen(false)} className="px-2.5 py-1 text-[10px] uppercase font-condensed border border-base-border hover:bg-base-surface3 text-base-muted2 rounded">Cancel</button>
                  <button
                    onClick={async () => {
                      if (!ufId.trim() || !ufName.trim()) return alert('Complete all columns.');
                      const passValue = ufPass.trim();
                      if (!editingUserId && !passValue) return alert('Input temporary password.');

                      let nextUsers = [...users];
                      if (editingUserId) {
                        nextUsers = nextUsers.map(u => {
                          if (u.id === editingUserId) {
                            const updated: User = { ...u, name: ufName.trim(), role: ufRole };
                            return updated;
                          }
                          return u;
                        });
                      } else {
                        if (nextUsers.some(u => u.id === ufId.trim())) return alert('ID duplicate!');
                        nextUsers.push({ id: ufId.trim(), name: ufName.trim(), role: ufRole, passHash: await sha256(passValue) });
                      }
                      setUsers(nextUsers);
                      setUserFormOpen(false);
                      setIsChanged(true);
                      alert('Roster users changes processed!');
                    }}
                    className="px-3.5 py-1 bg-base-accent text-white font-condensed font-bold uppercase tracking-wider rounded text-[10px]"
                  >
                    Keep Form
                  </button>
                </div>
              </div>
            )}

            {/* Users grid list display */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.map(u => (
                <div key={u.id} className="flex px-3 py-2 bg-base-surface2 border border-base-border rounded-lg items-center justify-between text-xs font-semibold">
                  <div>
                    <div className="text-base-text font-bold">{u.name} (<span className="text-base-accent font-condensed font-extrabold uppercase text-[10px] tracking-wide">{u.id}</span>)</div>
                    <div className="text-[10px] text-base-muted uppercase font-condensed mt-0.5 font-bold tracking-wider">{u.role}</div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => {
                        setEditingUserId(u.id);
                        setUfId(u.id);
                        setUfName(u.name);
                        setUfRole(u.role);
                        setUfPass('');
                        setUserFormOpen(true);
                      }}
                      className="p-1 rounded text-base-muted hover:text-base-accent hover:bg-base-surface3 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => {
                          if (!confirm(`Delete user "${u.name}" permanently?`)) return;
                          setUsers(prev => prev.filter(x => x.id !== u.id));
                          setIsChanged(true);
                        }}
                        className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/15 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setUserMgmtOpen(false)} className="px-4 py-1.5 bg-base-surface border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold text-xs uppercase tracking-wider cursor-pointer">Close panel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
