import React, { useState, useEffect } from 'react';
import { User, Project, Employee, TimesheetEntry, ActivityLog, ProblemReport, InspectionRequest, WireLog } from './types';
import { DEFAULT_USERS, DEFAULT_PROJECTS, DEFAULT_EMPLOYEES, DEFAULT_TIMESHEETS, DEFAULT_ACTIVITIES, DEFAULT_PROBLEM_REPORTS, DEFAULT_INSPECTION_REQUESTS, DEFAULT_WIRE_LOGS } from './mockData';
import { exportProjectsCSV } from './utils/projectUtils';
import { can as canUtil, PERMISSIONS } from './utils/permissions';
import { uid } from './utils/helpers';

// Firebase imports
import { db, auth } from './services/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';

// Custom Hooks & Subcomponents
import { AuthProvider, useAuth, useProjects, useEmployees, useTimesheets, useFirestore } from './hooks';
import ThemeToggle from './components/ThemeToggle';
import GanttView from './components/GanttView';
import Focus24View from './components/Focus24View';
import FormsAndModals from './components/FormsAndModals';

// Modals, Custom Pages
import {
  LoginPage, DashboardPage, ProjectsPage, EmployeesPage, TimesheetPage, InspectionsPage, WireLogPage, ReportPage, UsersPage
} from './pages';

// Lucide Icons
import {
  Download, LogOut, Key
} from 'lucide-react';

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
  { id: 'wire', label: 'Wire Consumable', icon: 'Flame', access: 'all' },
  { id: 'dailyreport', label: 'Daily Report', icon: 'FileText', access: ['admin', 'manager'] },
  { id: 'employees', label: 'Employees', icon: 'Users', access: 'all' },
  { id: 'timesheet', label: 'Timesheet', icon: 'Clock', access: 'all' },
  { id: 'users', label: 'Users & Access', icon: 'ShieldCheck', access: ['admin'] }
];

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const authHook = useAuth();
  const { currentUser, fbUser, users, setUsers, isAuthLoading } = authHook;

  // Local sync and list states
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [problemReports, setProblemReports] = useState<ProblemReport[]>([]);
  const [inspections, setInspections] = useState<InspectionRequest[]>([]);
  const [wireLogs, setWireLogs] = useState<WireLog[]>([]);

  // Local states for custom search filters
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');
  const [currentTabMonthFilter, setCurrentTabMonthFilter] = useState<string>('');

  const [activeTab, setActiveTab] = useState<string>('dash');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [isChanged, setIsChanged] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('All synced');

  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const verifyMarkChanged = () => setIsChanged(true);

  // Activity Logger
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

  const can = (perm: keyof typeof PERMISSIONS.admin): boolean => {
    if (!currentUser) return false;
    if (currentUser.allowedPermissions && currentUser.allowedPermissions[perm] !== undefined) {
      return !!currentUser.allowedPermissions[perm];
    }
    return !!PERMISSIONS[currentUser.role]?.[perm];
  };

  // Setup sub-hooks and project contexts
  const projectsHook = useProjects(logActivity, verifyMarkChanged, setDeleteConfirm);
  const { projects, setProjects } = projectsHook;

  const employeesHook = useEmployees(verifyMarkChanged, setDeleteConfirm);
  const { employees, setEmployees } = employeesHook;

  const timesheetsHook = useTimesheets(verifyMarkChanged, setDeleteConfirm);
  const { timesheets, setTimesheets } = timesheetsHook;

  const { syncList } = useFirestore();

  // Firestore Real-time Syncer Listener
  useEffect(() => {
    let active = true;
    const unsubscribers: (() => void)[] = [];

    const setupSync = async () => {
      // Load stored lists on mount
      const storedProj = localStorage.getItem('w2proj_v1');
      if (storedProj) setProjects(JSON.parse(storedProj));
      else { localStorage.setItem('w2proj_v1', JSON.stringify(DEFAULT_PROJECTS)); setProjects(DEFAULT_PROJECTS); }

      const storedEmp = localStorage.getItem('w2proj_employees_v1');
      if (storedEmp) setEmployees(JSON.parse(storedEmp));
      else { localStorage.setItem('w2proj_employees_v1', JSON.stringify(DEFAULT_EMPLOYEES)); setEmployees(DEFAULT_EMPLOYEES); }

      const storedTs = localStorage.getItem('w2proj_timesheet_v1');
      if (storedTs) setTimesheets(JSON.parse(storedTs));
      else { localStorage.setItem('w2proj_timesheet_v1', JSON.stringify(DEFAULT_TIMESHEETS)); setTimesheets(DEFAULT_TIMESHEETS); }

      const storedAct = localStorage.getItem('w2proj_activity_v1');
      if (storedAct) setActivities(JSON.parse(storedAct));
      else { localStorage.setItem('w2proj_activity_v1', JSON.stringify(DEFAULT_ACTIVITIES)); setActivities(DEFAULT_ACTIVITIES); }

      const storedProb = localStorage.getItem('w2proj_problem_reports_v1');
      if (storedProb) setProblemReports(JSON.parse(storedProb));
      else { localStorage.setItem('w2proj_problem_reports_v1', JSON.stringify(DEFAULT_PROBLEM_REPORTS)); setProblemReports(DEFAULT_PROBLEM_REPORTS); }

      const storedIns = localStorage.getItem('w2proj_inspections_v1');
      if (storedIns) setInspections(JSON.parse(storedIns));
      else { localStorage.setItem('w2proj_inspections_v1', JSON.stringify(DEFAULT_INSPECTION_REQUESTS)); setInspections(DEFAULT_INSPECTION_REQUESTS); }

      const storedWl = localStorage.getItem('w2proj_wire_logs_v1');
      if (storedWl) setWireLogs(JSON.parse(storedWl));
      else { localStorage.setItem('w2proj_wire_logs_v1', JSON.stringify(DEFAULT_WIRE_LOGS)); setWireLogs(DEFAULT_WIRE_LOGS); }

      if (!fbUser) return;

      try {
        const initDocRef = doc(db, 'system_config', 'status');
        let initDocSnap = await getDoc(initDocRef);
        const isInitialized = initDocSnap.exists() && initDocSnap.data()?.seeded;

        if (!active) return;

        if (!isInitialized) {
          const defUsers = await DEFAULT_USERS();
          const seedPromises = [
            ...DEFAULT_PROJECTS.map(item => setDoc(doc(db, 'projects', item.id), item)),
            ...DEFAULT_EMPLOYEES.map(item => setDoc(doc(db, 'employees', item.id), item)),
            ...DEFAULT_TIMESHEETS.map(item => setDoc(doc(db, 'timesheets', item.id), item)),
            ...DEFAULT_ACTIVITIES.map(item => setDoc(doc(db, 'activities', item.id), item)),
            ...DEFAULT_PROBLEM_REPORTS.map(item => setDoc(doc(db, 'problemReports', item.id), item)),
            ...DEFAULT_INSPECTION_REQUESTS.map(item => setDoc(doc(db, 'inspections', item.id), item)),
            ...DEFAULT_WIRE_LOGS.map(item => setDoc(doc(db, 'wireLogs', item.id), item)),
            ...defUsers.map(item => setDoc(doc(db, 'users', item.id), item)),
          ];
          await Promise.all(seedPromises);
          await setDoc(initDocRef, { seeded: true });
        }

        const listenToCollection = (colName: string, stateSetter: (data: any) => void, storageKey: string) => {
          const colRef = collection(db, colName);
          const unsub = onSnapshot(colRef, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((d) => {
              list.push(d.data());
            });
            stateSetter(list);
            localStorage.setItem(storageKey, JSON.stringify(list));
          }, (error) => {
            console.error(`Firestore real-time error on ${colName}:`, error);
          });
          unsubscribers.push(unsub);
        };

        listenToCollection('projects', setProjects, 'w2proj_v1');
        listenToCollection('employees', setEmployees, 'w2proj_employees_v1');
        listenToCollection('timesheets', setTimesheets, 'w2proj_timesheet_v1');
        listenToCollection('activities', setActivities, 'w2proj_activity_v1');
        listenToCollection('problemReports', setProblemReports, 'w2proj_problem_reports_v1');
        listenToCollection('inspections', setInspections, 'w2proj_inspections_v1');
        listenToCollection('users', setUsers, 'w2proj_users_v1');
        listenToCollection('wireLogs', setWireLogs, 'w2proj_wire_logs_v1');
      } catch (err) {
        console.error("Firestore setup sync error:", err);
      }
    };

    setupSync();

    return () => {
      active = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentUser, fbUser]);

  // Handle auto saves
  useEffect(() => {
    if (!currentUser || !isChanged) return;
    const timer = setTimeout(async () => {
      localStorage.setItem('w2proj_v1', JSON.stringify(projects));
      localStorage.setItem('w2proj_employees_v1', JSON.stringify(employees));
      localStorage.setItem('w2proj_timesheet_v1', JSON.stringify(timesheets));
      localStorage.setItem('w2proj_activity_v1', JSON.stringify(activities));
      localStorage.setItem('w2proj_users_v1', JSON.stringify(users));
      localStorage.setItem('w2proj_problem_reports_v1', JSON.stringify(problemReports));
      localStorage.setItem('w2proj_inspections_v1', JSON.stringify(inspections));
      localStorage.setItem('w2proj_wire_logs_v1', JSON.stringify(wireLogs));

      setIsChanged(false);
      const tmStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedLabel(`Saving...`);

      if (auth.currentUser) {
        try {
          await Promise.all([
            syncList('projects', projects),
            syncList('employees', employees),
            syncList('timesheets', timesheets),
            syncList('activities', activities),
            syncList('users', users),
            syncList('problemReports', problemReports),
            syncList('inspections', inspections),
            syncList('wireLogs', wireLogs),
          ]);
          setLastSavedLabel(`Synced online at ${tmStr}`);
        } catch (err) {
          console.error("Cloud syncer failed", err);
          setLastSavedLabel(`Saved local (sync failed)`);
        }
      } else {
        setLastSavedLabel(`Last saved at ${tmStr}`);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isChanged, projects, employees, timesheets, activities, users, problemReports, inspections, wireLogs]);

  // Synchronize currentUser details when roles or permissions change dynamically
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const match = users.find(u => u.id === currentUser.id);
      if (match) {
        const featuresMatch = JSON.stringify(match.allowedFeatures) === JSON.stringify(currentUser.allowedFeatures);
        const permMatch = JSON.stringify(match.allowedPermissions) === JSON.stringify(currentUser.allowedPermissions);
        const nameMatch = match.name === currentUser.name;
        const roleMatch = match.role === currentUser.role;
        if (!featuresMatch || !permMatch || !nameMatch || !roleMatch) {
          const updated: User = {
            ...currentUser,
            name: match.name,
            role: match.role,
            allowedFeatures: match.allowedFeatures,
            allowedPermissions: match.allowedPermissions
          };
          authHook.setCurrentUser(updated);
          sessionStorage.setItem('w2proj_session_v1', JSON.stringify(updated));
        }
      }
    }
  }, [users, currentUser]);

  // Handlers for Focus24, Inspections, and WireLogs
  const handleAddProblemReport = (report: Omit<ProblemReport, 'id' | 'date'>) => {
    const newReport: ProblemReport = { ...report, id: 'rep_' + uid(), date: new Date().toISOString().slice(0, 10) };
    setProblemReports(prev => [newReport, ...prev]);
    verifyMarkChanged();
    logActivity('task_add', `Reported floor impediment: ${report.category}`, report.projectId, report.projectName, undefined, undefined, undefined, undefined, `Department: ${report.assignedPosition}. Desc: ${report.description}`);
  };

  const handleUpdateProblemStatus = (id: string, status: 'Open' | 'Resolved', resolutionNote?: string) => {
    setProblemReports(prev => prev.map(r => r.id === id ? {
      ...r,
      status,
      resolutionNote: status === 'Resolved' ? resolutionNote : undefined,
      resolvedAt: status === 'Resolved' ? new Date().toISOString().slice(0, 10) : undefined,
      resolvedBy: status === 'Resolved' ? (currentUser?.name || 'System') : undefined
    } : r));
    verifyMarkChanged();
    setProblemReports(current => {
      const target = current.find(x => x.id === id);
      if (target) {
        logActivity('task_toggle', `Changed problem status to ${status}`, target.projectId, target.projectName, undefined, undefined, undefined, undefined, status === 'Resolved' ? `Resolution: ${resolutionNote}` : 'Re-opened case');
      }
      return current;
    });
  };

  const handleDeleteProblemReport = (id: string) => {
    const target = problemReports.find(x => x.id === id);
    setProblemReports(prev => prev.filter(r => r.id !== id));
    verifyMarkChanged();
    if (target) {
      logActivity('task_delete', `Deleted problem report: ${target.category}`, target.projectId, target.projectName, undefined, undefined, undefined, undefined, target.description);
    }
  };

  const handleAddInspection = (ins: Omit<InspectionRequest, 'id' | 'rfiNo'>) => {
    const yrCode = new Date().getFullYear();
    const count = inspections.length + 1;
    const rfiNo = `RFI-${yrCode}-${String(count).padStart(3, '0')}`;
    const newIns: InspectionRequest = { ...ins, id: 'ins_' + uid(), rfiNo };
    setInspections(prev => [newIns, ...prev]);
    verifyMarkChanged();
    logActivity('assembly_add', `Submitted inspection request ${newIns.rfiNo} (${newIns.inspectionType})`, newIns.projectId, newIns.projectName, newIns.assemblyName, undefined, undefined, undefined, `Requested target date is ${newIns.targetDate}. Remarks: ${newIns.rcomments || 'None'}`);
  };

  const handleUpdateInspectionStatus = (id: string, status: InspectionRequest['status'], comments?: string, assignedInspector?: string, punchList?: string) => {
    setInspections(prev => prev.map(ins => {
      if (ins.id === id) {
        const isApprove = status === 'Approved';
        logActivity('assembly_edit', isApprove ? `Approved inspection request ${ins.rfiNo} (${ins.inspectionType})` : `Issued rework punchlist for ${ins.rfiNo} (${ins.inspectionType})`, ins.projectId, ins.projectName, ins.assemblyName, undefined, undefined, undefined, comments);
        return {
          ...ins, status, comments: comments || ins.comments, assignedInspector: assignedInspector || ins.assignedInspector, punchList: punchList !== undefined ? punchList : ins.punchList,
          inspectedDate: new Date().toISOString().slice(0, 10), inspectedBy: assignedInspector || currentUser?.name || 'QC Inspector'
        };
      }
      return ins;
    }));
    verifyMarkChanged();
  };

  const handleDeleteInspection = (id: string) => {
    const target = inspections.find(ins => ins.id === id);
    setInspections(prev => prev.filter(ins => ins.id !== id));
    verifyMarkChanged();
    if (target) {
      logActivity('assembly_delete', `Deleted inspection request record ${target.rfiNo}`, target.projectId, target.projectName, target.assemblyName, undefined, undefined, undefined);
    }
  };

  const handleAddWireLog = (log: Omit<WireLog, 'id'>) => {
    const newLog: WireLog = { ...log, id: 'wl_' + uid() };
    setWireLogs(prev => [newLog, ...prev]);
    verifyMarkChanged();
    logActivity('assembly_progress', `Logged daily wire taken: ${newLog.amountKg} kg for ${newLog.welderName}`, newLog.projectId, newLog.projectName, newLog.assemblyName, undefined, undefined, undefined, newLog.notes || `Daily wire consumables logged.`);
  };

  const handleDeleteWireLog = (id: string) => {
    const target = wireLogs.find(l => l.id === id);
    if (!target) return;
    setWireLogs(prev => prev.filter(l => l.id !== id));
    verifyMarkChanged();
    logActivity('assembly_progress', `Deleted wire log entry: ${target.amountKg} kg taken by ${target.welderName}`, target.projectId, target.projectName, target.assemblyName, undefined, undefined, undefined, `Logs historical revision by user: ${currentUser?.name || 'Authorized user'}`);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center p-6 space-y-4">
        <div className="h-8 w-8 rounded-full border-2 border-base-accent border-t-transparent animate-spin" />
        <span className="text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted animate-pulse">Establishing Session Workspace...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-base-bg text-base-text transition-colors duration-200 flex flex-col font-sans select-none antialiased">
      {/* Universal Header */}
      <header className="h-14.5 bg-base-surface border-b border-base-border px-6 flex items-center justify-between sticky top-0 z-40 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 select-none">
          <div className="font-condensed font-black text-2xl tracking-widest text-[#9b1c2e]">
            AUSTIN <span className="text-base-text">BATAM</span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full font-condensed font-extrabold text-[9px] uppercase bg-base-accent-dim text-base-accent border border-base-accent/20 tracking-wider">
            Workspace
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 border border-base-border rounded-full p-1 pl-3 bg-base-surface2">
            <div className="flex flex-col items-end hidden sm:block leading-none">
              <span className="text-xs font-bold text-base-text">{currentUser.name}</span>
              <span className="text-[9px] font-condensed font-extrabold text-base-accent uppercase tracking-wider">{currentUser.role}</span>
            </div>
            <button onClick={() => authHook.setChangePasswordModalOpen(true)} className="p-1 px-1.5 rounded-full text-base-muted hover:text-base-accent" title="Change Password">
              <Key className="h-3.5 w-3.5" />
            </button>
            <button onClick={authHook.handleLogout} className="p-1 px-2.5 rounded-full text-base-muted hover:text-base-red text-xs font-condensed font-bold uppercase" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {can('exportData') && (
            <button onClick={() => exportProjectsCSV(projects, timesheets)} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 transition-all font-condensed font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation menu selection row */}
      <nav className="bg-base-surface2 px-6 border-b border-base-border flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none sticky top-14.5 z-30">
        {activeTabsList
          .filter(t => {
            if (t.id === 'users') {
              if (currentUser.allowedFeatures && currentUser.allowedFeatures.length > 0) {
                return currentUser.allowedFeatures.includes('users');
              }
              return can('manageUsers');
            }
            if (currentUser.allowedFeatures && currentUser.allowedFeatures.length > 0) {
              return currentUser.allowedFeatures.includes(t.id);
            }
            return t.access === 'all' || (Array.isArray(t.access) && t.access.includes(currentUser.role));
          })
          .map(t => {
            const hasCountsComp = t.id === 'completed';
            const compCount = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
            const hasCountsArc = t.id === 'archive';
            const arcCount = projects.filter(p => p.isArchived).length;
            const hascountsProb = t.id === 'focus24';
            const openProbCount = problemReports.filter(r => r.status === 'Open').length;
            const hasCountsInsp = t.id === 'inspections';
            const pendingInspCount = inspections.filter(ins => ins.status === 'Requested').length;

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-3.5 px-4.5 font-condensed font-extrabold uppercase text-xs tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === t.id ? 'border-base-accent text-base-accent bg-base-accent-dim/10' : 'border-transparent text-base-muted hover:text-base-text'
                }`}
              >
                <span>{t.label}</span>
                {hasCountsComp && compCount > 0 && <span className="px-1.5 py-0.5 rounded bg-base-green/20 text-base-green text-[9px]">{compCount}</span>}
                {hasCountsArc && arcCount > 0 && <span className="px-1.5 py-0.5 rounded bg-base-accent-dim text-base-accent text-[9px]">{arcCount}</span>}
                {hascountsProb && openProbCount > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] animate-pulse">{openProbCount}</span>}
                {hasCountsInsp && pendingInspCount > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[9px]">{pendingInspCount}</span>}
              </button>
            );
          })}
      </nav>

      {/* Main View Port Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {activeTab === 'dash' && (
          <DashboardPage projects={projects} timesheets={timesheets} employees={employees} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} openSpotlight={(id) => { projectsHook.setSpotlightProjectId(id); projectsHook.setSpotlightOpen(true); }} />
        )}

        {activeTab === 'focus24' && (
          <Focus24View problemReports={problemReports} projects={projects} employees={employees} currentUser={currentUser} onAddProblemReport={handleAddProblemReport} onUpdateProblemStatus={handleUpdateProblemStatus} onDeleteProblemReport={handleDeleteProblemReport} openSpotlight={(id) => { projectsHook.setSpotlightProjectId(id); projectsHook.setSpotlightOpen(true); }} />
        )}

        {['current', 'completed', 'tray', 'nontray', 'archive'].includes(activeTab) && (
          <ProjectsPage
            activeTab={activeTab as any}
            projects={projects}
            timesheets={timesheets}
            wireLogs={wireLogs}
            projectSearchQuery={projectSearchQuery}
            setProjectSearchQuery={setProjectSearchQuery}
            currentTabMonthFilter={currentTabMonthFilter}
            setCurrentTabMonthFilter={setCurrentTabMonthFilter}
            openAddProject={projectsHook.openAddProject}
            openEditProjectForm={projectsHook.openEditProjectForm}
            openAssemblyAddForm={projectsHook.openAssemblyAddForm}
            openCopyModalLauncher={projectsHook.openCopyModalLauncher}
            setSpotlightProjectId={projectsHook.setSpotlightProjectId}
            setSpotlightOpen={projectsHook.setSpotlightOpen}
            archiveProject={projectsHook.archiveProject}
            unarchiveProject={projectsHook.unarchiveProject}
          />
        )}

        {activeTab === 'gantt' && (
          <GanttView
            projects={projects}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            openDepModal={(rowKey) => { projectsHook.setDepModalRowKey(rowKey); projectsHook.setDepModalOpen(true); }}
          />
        )}

        {activeTab === 'inspections' && (
          <InspectionsPage inspections={inspections} projects={projects} currentUser={currentUser} onAddInspection={handleAddInspection} onUpdateInspectionStatus={handleUpdateInspectionStatus} onDeleteInspection={handleDeleteInspection} />
        )}

        {activeTab === 'wire' && (
          <WireLogPage wireLogs={wireLogs} projects={projects} employees={employees} currentUser={currentUser} onAddWireLog={handleAddWireLog} onDeleteWireLog={handleDeleteWireLog} />
        )}

        {activeTab === 'dailyreport' && (
          <ReportPage
            projects={projects}
            activityLogs={activities}
            reportDate={reportDate}
            setReportDate={setReportDate}
            clearActivityLogs={() => { setActivities([]); verifyMarkChanged(); }}
            openPrintView={() => window.print()}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeesPage
            employees={employees}
            openAddEmp={employeesHook.openAddEmp}
            openEditEmp={employeesHook.openEditEmp}
            removeEmployeeRecord={employeesHook.removeEmployeeRecord}
            importEmployeesExcel={employeesHook.importEmployeesExcel}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetPage
            timesheets={timesheets}
            employees={employees}
            projects={projects}
            timesheetDate={timesheetsHook.timesheetDate}
            setTimesheetDate={timesheetsHook.setTimesheetDate}
            openAddTimesheet={timesheetsHook.openTimesheetBulkAdd}
            openEditTimesheet={timesheetsHook.openTimesheetEditForm}
            removeTimesheetEntry={timesheetsHook.removeTimesheetEntry}
            exportTimesheetExcel={timesheetsHook.exportTimesheetExcel}
            openSpotlight={(pid) => { projectsHook.setSpotlightProjectId(pid); projectsHook.setSpotlightOpen(true); }}
          />
        )}

        {activeTab === 'users' && (
          <UsersPage users={users} currentUser={currentUser} onUpdateUsers={(updated) => { setUsers(updated); verifyMarkChanged(); }} />
        )}
      </main>

      {/* Universal Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-2.5 px-6 border-t border-base-border bg-base-surface text-base-muted text-[10px] font-condensed font-bold uppercase tracking-wider flex items-center justify-between z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <span>Austin Batam · Project tracking console</span>
        <span className="text-base-accent font-bold">{lastSavedLabel}</span>
      </footer>

      {/* Modal and forms center */}
      <FormsAndModals
        authHook={authHook}
        projectsHook={projectsHook}
        employeesHook={employeesHook}
        timesheetsHook={timesheetsHook}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        timesheets={timesheets}
        wireLogs={wireLogs}
        setProjects={setProjects}
        verifyMarkChanged={verifyMarkChanged}
        logActivity={logActivity}
      />
    </div>
  );
}

export default App;
