import React, { useState, useEffect } from 'react';
import { User, Project, Employee, TimesheetEntry, ActivityLog, ProblemReport, InspectionRequest, WireLog } from './types';
import { DEFAULT_USERS, DEFAULT_PROJECTS, DEFAULT_EMPLOYEES, DEFAULT_TIMESHEETS, DEFAULT_ACTIVITIES, DEFAULT_PROBLEM_REPORTS, DEFAULT_INSPECTION_REQUESTS, DEFAULT_WIRE_LOGS } from './mockData';
import { exportProjectsCSV } from './utils/projectUtils';
import { can as canUtil, PERMISSIONS } from './utils/permissions';
import { uid } from './utils/helpers';

// Firebase imports
import { db } from './services/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';

// Custom Hooks & Subcomponents
import { AuthProvider, useAuth, useProjects, useEmployees, useTimesheets, useFirestore } from './hooks';
import ThemeToggle from './components/ThemeToggle';
import GanttView from './components/GanttView';
import Focus24View from './components/Focus24View';
import FormsAndModals from './components/FormsAndModals';
import { ToastContainer } from './components/Toast';

// Modals, Custom Pages
import {
  LoginPage, DashboardPage, ProjectsPage, EmployeesPage, TimesheetPage, InspectionsPage, WireLogPage, ReportPage, UsersPage
} from './pages';

// Lucide Icons
import {
  Download, LogOut, Key, Menu, X, ChevronLeft, ChevronRight,
  LayoutGrid, AlertTriangle, Folder, Clock, CheckCircle, Archive, ClipboardCheck, Flame, FileText, Users, ShieldCheck
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

const IconMap: Record<string, React.ComponentType<any>> = {
  LayoutGrid,
  AlertTriangle,
  Folder,
  Clock,
  CheckCircle,
  Archive,
  ClipboardCheck,
  Flame,
  FileText,
  Users,
  ShieldCheck
};

const sectionGroups = [
  {
    title: 'Overview',
    items: ['dash', 'focus24', 'gantt']
  },
  {
    title: 'Projects',
    items: ['current', 'completed', 'archive', 'tray', 'nontray']
  },
  {
    title: 'Operations',
    items: ['inspections', 'wire', 'dailyreport']
  },
  {
    title: 'Management',
    items: ['employees', 'timesheet', 'users']
  }
];

export function App() {
  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer />
    </AuthProvider>
  );
}

function AppContent() {
  const authHook = useAuth();
  const { currentUser, fbUser, users, setUsers, isAuthLoading } = authHook;

  // Local sync and list states
  const [activities, setRealActivities] = useState<ActivityLog[]>([]);
  const [problemReports, setRealProblemReports] = useState<ProblemReport[]>([]);
  const [inspections, setRealInspections] = useState<InspectionRequest[]>([]);
  const [wireLogs, setRealWireLogs] = useState<WireLog[]>([]);

  // Toggle states for sidebar and navigation
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('w2proj_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      try {
        localStorage.setItem('w2proj_sidebar_collapsed', String(!prev));
      } catch (_) {}
      return !prev;
    });
  };

  // Wrap state setters for direct local updates if needed, but snapshots set these directly.
  const setActivities = setRealActivities;
  const setProblemReports = setRealProblemReports;
  const setInspections = setRealInspections;
  const setWireLogs = setRealWireLogs;

  // Local states for custom search filters
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');
  const [currentTabMonthFilter, setCurrentTabMonthFilter] = useState<string>('');

  const [activeTab, setActiveTab] = useState<string>('dash');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [isChanged, setIsChanged] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('All synced');
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const verifyMarkChanged = () => setIsChanged(true);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update synchronization label dynamically
  useEffect(() => {
    if (isOffline) {
      setLastSavedLabel('OFFLINE MODE (Cached)');
    } else {
      setLastSavedLabel('All synced online');
    }
  }, [isOffline]);

  const { saveItem, removeItem } = useFirestore();

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
    saveItem('activities', newAct);
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

  // Firestore Real-time Syncer Listener (Zero LocalStorage)
  useEffect(() => {
    let active = true;
    const unsubscribers: (() => void)[] = [];

    const setupSync = async () => {
      if (!fbUser) return;

      try {
        const initDocRef = doc(db, 'system_config', 'status');
        let initDocSnap = await getDoc(initDocRef);
        const isSeeded = initDocSnap.exists() && initDocSnap.data()?.seeded;

        if (!active) return;

        if (!isSeeded) {
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

        const listenToCollection = (colName: string, stateSetter: (data: any) => void) => {
          const colRef = collection(db, colName);
          const unsub = onSnapshot(colRef, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((d) => {
              list.push(d.data());
            });
            stateSetter(list);
          }, (error) => {
            console.error(`Firestore real-time error on ${colName}:`, error);
          });
          unsubscribers.push(unsub);
        };

        listenToCollection('projects', setProjects);
        listenToCollection('employees', setEmployees);
        listenToCollection('timesheets', setTimesheets);
        listenToCollection('activities', setActivities);
        listenToCollection('problemReports', setProblemReports);
        listenToCollection('inspections', setInspections);
        listenToCollection('users', setUsers);
        listenToCollection('wireLogs', setWireLogs);
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

  // Synchronize currentUser details when roles or permissions change dynamically
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const match = users.find(u => u.id === currentUser.id);
      if (match) {
        // Only set storage or session if something actually changed
        const sessStored = sessionStorage.getItem('w2proj_session_v1');
        if (sessStored) {
          const parsed = JSON.parse(sessStored) as User;
          if (parsed.role !== match.role || JSON.stringify(parsed.allowedPermissions) !== JSON.stringify(match.allowedPermissions)) {
            const updated = { ...parsed, role: match.role, allowedPermissions: match.allowedPermissions };
            sessionStorage.setItem('w2proj_session_v1', JSON.stringify(updated));
          }
        }
      }
    }
  }, [users, currentUser]);

  // Handlers for Focus24, Inspections, and WireLogs
  const handleAddProblemReport = async (report: Omit<ProblemReport, 'id' | 'date'>) => {
    const newReport: ProblemReport = { ...report, id: 'rep_' + uid(), date: new Date().toISOString().slice(0, 10) };
    setProblemReports(prev => [newReport, ...prev]);
    verifyMarkChanged();
    logActivity('task_add', `Reported floor impediment: ${report.category}`, report.projectId, report.projectName, undefined, undefined, undefined, undefined, `Department: ${report.assignedPosition}. Desc: ${report.description}`);
    
    await saveItem('problemReports', newReport);
  };

  const handleUpdateProblemStatus = async (id: string, status: 'Open' | 'Resolved', resolutionNote?: string) => {
    let updatedReport: ProblemReport | undefined;
    setProblemReports(prev => prev.map(r => {
      if (r.id === id) {
        updatedReport = {
          ...r,
          status,
          resolutionNote: status === 'Resolved' ? resolutionNote : undefined,
          resolvedAt: status === 'Resolved' ? new Date().toISOString().slice(0, 10) : undefined,
          resolvedBy: status === 'Resolved' ? (currentUser?.name || 'System') : undefined
        };
        return updatedReport;
      }
      return r;
    }));
    verifyMarkChanged();
    setProblemReports(current => {
      const target = current.find(x => x.id === id);
      if (target) {
        logActivity('task_toggle', `Changed problem status to ${status}`, target.projectId, target.projectName, undefined, undefined, undefined, undefined, status === 'Resolved' ? `Resolution: ${resolutionNote}` : 'Re-opened case');
      }
      return current;
    });

    if (updatedReport) {
      await saveItem('problemReports', updatedReport);
    }
  };

  const handleDeleteProblemReport = async (id: string) => {
    const target = problemReports.find(x => x.id === id);
    setProblemReports(prev => prev.filter(r => r.id !== id));
    verifyMarkChanged();
    if (target) {
      logActivity('task_delete', `Deleted problem report: ${target.category}`, target.projectId, target.projectName, undefined, undefined, undefined, undefined, target.description);
    }

    await removeItem('problemReports', id);
  };

  const handleAddInspection = async (ins: Omit<InspectionRequest, 'id' | 'rfiNo'>) => {
    try {
      const counterDocRef = doc(db, 'system_config', 'counters');
      const newInsId = 'ins_' + uid();
      const yrCode = new Date().getFullYear();

      const rfiNo = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterDocRef);
        let nextCount = 1;

        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (typeof data?.rfiCounter === 'number') {
            nextCount = data.rfiCounter + 1;
          } else {
            nextCount = inspections.length + 1;
          }
        } else {
          nextCount = inspections.length + 1;
        }

        const calculatedRfiNo = `RFI-${yrCode}-${String(nextCount).padStart(3, '0')}`;
        const newIns: InspectionRequest = { ...ins, id: newInsId, rfiNo: calculatedRfiNo };

        // 1. Update counter
        transaction.set(counterDocRef, { rfiCounter: nextCount }, { merge: true });

        // 2. Write new inspection
        transaction.set(doc(db, 'inspections', newInsId), newIns);

        return calculatedRfiNo;
      });

      const finalIns: InspectionRequest = { ...ins, id: newInsId, rfiNo };
      setInspections(prev => [finalIns, ...prev]);
      verifyMarkChanged();
      logActivity('assembly_add', `Submitted inspection request ${finalIns.rfiNo} (${finalIns.inspectionType})`, finalIns.projectId, finalIns.projectName, finalIns.assemblyName, undefined, undefined, undefined, `Requested target date is ${finalIns.targetDate}. Remarks: ${finalIns.rcomments || 'None'}`);

    } catch (err) {
      console.error("Failed to add inspection with transaction:", err);
    }
  };

  const handleUpdateInspectionStatus = async (id: string, status: InspectionRequest['status'], comments?: string, assignedInspector?: string, punchList?: string) => {
    let updatedIns: InspectionRequest | undefined;
    setInspections(prev => prev.map(ins => {
      if (ins.id === id) {
        const isApprove = status === 'Approved';
        logActivity('assembly_edit', isApprove ? `Approved inspection request ${ins.rfiNo} (${ins.inspectionType})` : `Issued rework punchlist for ${ins.rfiNo} (${ins.inspectionType})`, ins.projectId, ins.projectName, ins.assemblyName, undefined, undefined, undefined, comments);
        updatedIns = {
          ...ins, status, comments: comments || ins.comments, assignedInspector: assignedInspector || ins.assignedInspector, punchList: punchList !== undefined ? punchList : ins.punchList,
          inspectedDate: new Date().toISOString().slice(0, 10), inspectedBy: assignedInspector || currentUser?.name || 'QC Inspector'
        };
        return updatedIns;
      }
      return ins;
    }));
    verifyMarkChanged();

    if (updatedIns) {
      await saveItem('inspections', updatedIns);
    }
  };

  const handleDeleteInspection = async (id: string) => {
    const target = inspections.find(ins => ins.id === id);
    setInspections(prev => prev.filter(ins => ins.id !== id));
    verifyMarkChanged();
    if (target) {
      logActivity('assembly_delete', `Deleted inspection request record ${target.rfiNo}`, target.projectId, target.projectName, target.assemblyName, undefined, undefined, undefined);
    }

    await removeItem('inspections', id);
  };

  const handleAddWireLog = async (log: Omit<WireLog, 'id'>) => {
    const newLog: WireLog = { ...log, id: 'wl_' + uid() };
    setWireLogs(prev => [newLog, ...prev]);
    verifyMarkChanged();
    logActivity('assembly_progress', `Logged daily wire taken: ${newLog.amountKg} kg for ${newLog.welderName}`, newLog.projectId, newLog.projectName, newLog.assemblyName, undefined, undefined, undefined, newLog.notes || `Daily wire consumables logged.`);

    await saveItem('wireLogs', newLog);
  };

  const handleDeleteWireLog = async (id: string) => {
    const target = wireLogs.find(l => l.id === id);
    if (!target) return;
    setWireLogs(prev => prev.filter(l => l.id !== id));
    verifyMarkChanged();
    logActivity('assembly_progress', `Deleted wire log entry: ${target.amountKg} kg taken by ${target.welderName}`, target.projectId, target.projectName, target.assemblyName, undefined, undefined, undefined, `Logs historical revision by user: ${currentUser?.name || 'Authorized user'}`);

    await removeItem('wireLogs', id);
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

  // Filter list of tabs allowed for current user session
  const allowedTabs = activeTabsList.filter(t => {
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
  });

  const activeTabItem = activeTabsList.find(t => t.id === activeTab);
  const activeTabLabel = activeTabItem ? activeTabItem.label : 'Project Workspace';

  return (
    <div className="min-h-screen bg-base-bg text-base-text transition-colors duration-200 flex flex-col md:flex-row font-sans select-none antialiased">
      
      {/* 1. DESKTOP LEFT SIDEBAR */}
      <aside className={`hidden md:flex flex-col bg-base-surface border-r border-base-border fixed top-0 bottom-0 left-0 z-40 select-none transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        
        {/* Header Branding Logo */}
        <div className="h-14 border-b border-base-border flex items-center justify-between px-4 shrink-0">
          {!sidebarCollapsed ? (
            <>
              <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]">
                AUSTIN <span className="text-base-text">BATAM</span>
              </div>
              <button 
                onClick={toggleSidebar} 
                className="p-1 rounded-md hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center relative">
              <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]" title="Austin Batam">
                AB
              </div>
              <button 
                onClick={toggleSidebar} 
                className="absolute -right-1 p-1 rounded-md hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Nav Items list grouped inside Sections */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-none">
          {sectionGroups.map((group, grpIdx) => {
            const groupTabs = allowedTabs.filter(t => group.items.includes(t.id));
            if (groupTabs.length === 0) return null;

            return (
              <div key={grpIdx} className="space-y-1">
                {!sidebarCollapsed ? (
                  <div className="px-3 text-[9px] font-condensed font-bold uppercase tracking-widest text-base-muted/50 py-1 select-none">
                    {group.title}
                  </div>
                ) : (
                  <div className="border-t border-base-border/50 my-2" />
                )}
                {groupTabs.map(t => {
                  const IconComponent = IconMap[t.icon] || Folder;
                  const isTabActive = activeTab === t.id;

                  const hasCountsComp = t.id === 'completed';
                  const compCount = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
                  const hasCountsArc = t.id === 'archive';
                  const arcCount = projects.filter(p => p.isArchived).length;
                  const hascountsProb = t.id === 'focus24';
                  const openProbCount = problemReports.filter(r => r.status === 'Open').length;
                  const hasCountsInsp = t.id === 'inspections';
                  const pendingInspCount = inspections.filter(ins => ins.status === 'Requested').length;

                  let badgeCount = 0;
                  let badgeBg = 'bg-base-accent-dim text-base-accent border border-base-accent/10';
                  if (hasCountsComp) {
                    badgeCount = compCount;
                    badgeBg = 'bg-base-green/10 text-base-green border border-base-green/20';
                  } else if (hasCountsArc) {
                    badgeCount = arcCount;
                  } else if (hascountsProb) {
                    badgeCount = openProbCount;
                    badgeBg = 'bg-red-500 text-white animate-pulse';
                  } else if (hasCountsInsp) {
                    badgeCount = pendingInspCount;
                    badgeBg = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                  }

                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all group relative cursor-pointer ${
                        isTabActive
                          ? 'bg-base-accent-dim/15 text-base-accent border-l-2 border-base-accent font-extrabold pl-2.5'
                          : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
                      }`}
                    >
                      <div className="relative flex items-center">
                        <IconComponent className="h-4 w-4 shrink-0" />
                        {sidebarCollapsed && badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 border border-base-surface animate-pulse" />
                        )}
                      </div>

                      {!sidebarCollapsed && (
                        <span className="flex-1 text-left truncate">{t.label}</span>
                      )}

                      {!sidebarCollapsed && badgeCount > 0 && (
                        <span className={`px-1.5 py-0.5 rounded font-condensed font-extrabold text-[9px] ${badgeBg}`}>
                          {badgeCount}
                        </span>
                      )}

                      {/* Hover Tooltip for Collapsed Sidebar */}
                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-base-surface border border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-lg">
                          <span className="flex items-center gap-2">
                            {t.label}
                            {badgeCount > 0 && (
                              <span className={`px-1 rounded text-[8px] font-condensed font-extrabold ${badgeBg}`}>
                                {badgeCount}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer Profile User Card */}
        <div className="border-t border-base-border p-3 space-y-2 shrink-0">
          {!sidebarCollapsed ? (
            <div className="flex flex-col space-y-2 bg-base-surface2 p-3 rounded-xl border border-base-border2/40">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-xs uppercase shadow-[0_2px_4px_rgba(0,0,0,0.15)] shrink-0">
                  {currentUser.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0 leading-none">
                  <h4 className="text-xs font-bold text-base-text truncate">{currentUser.name}</h4>
                  <span className="text-[9px] font-condensed font-semibold text-base-accent uppercase tracking-wider block mt-0.5">{currentUser.role}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-base-border/50 pt-2 text-[10px] font-condensed uppercase tracking-wider font-extrabold select-none">
                <button 
                  onClick={() => authHook.setChangePasswordModalOpen(true)} 
                  className="flex items-center gap-1 text-base-muted hover:text-base-accent cursor-pointer"
                  title="Change Security Configuration"
                >
                  <Key className="h-3 w-3" />
                  <span>Config Key</span>
                </button>
                <button 
                  onClick={authHook.handleLogout} 
                  className="flex items-center gap-1 text-base-muted hover:text-base-red cursor-pointer"
                  title="Disconnect Workspace"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 py-1">
              <div className="h-8 w-8 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-xs uppercase cursor-help group relative shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                {currentUser.name.slice(0, 2)}
                <div className="absolute left-full ml-3 px-2.5 py-1 rounded bg-base-surface border border-base-border text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  <span className="font-condensed font-bold uppercase tracking-wider text-base-accent block">{currentUser.name}</span>
                  <span className="text-[10px] text-base-muted block">{currentUser.role}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 select-none">
                <button 
                  onClick={() => authHook.setChangePasswordModalOpen(true)} 
                  className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-accent transition-colors cursor-pointer" 
                  title="Change Password"
                >
                  <Key className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={authHook.handleLogout} 
                  className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-red transition-colors cursor-pointer" 
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 2. MOBILE TOP HEADER BAR */}
      <header className="md:hidden h-14 bg-base-surface border-b border-base-border px-4 flex items-center justify-between sticky top-0 z-40 select-none shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer" 
            title="Open Workspace Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]">
            AUSTIN <span className="text-base-text">BATAM</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="h-7 w-7 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-xs uppercase" title={`${currentUser.name} (${currentUser.role})`}>
            {currentUser.name.slice(0, 2)}
          </div>
        </div>
      </header>

      {/* 3. MOBILE DRAWER SLIDE-IN PANEL */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)} 
            className="fixed inset-0 bg-black/60 z-50 md:hidden transition-opacity duration-300" 
          />
          
          {/* Drawer content frame */}
          <aside className="fixed inset-y-0 left-0 w-64 bg-base-surface border-r border-base-border flex flex-col z-[100] select-none md:hidden transition-transform duration-300 shadow-2xl">
            <div className="h-14 border-b border-base-border flex items-center justify-between px-4 shrink-0">
              <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]">
                AUSTIN <span className="text-base-text">BATAM</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
              {sectionGroups.map((group, grpIdx) => {
                const groupTabs = allowedTabs.filter(t => group.items.includes(t.id));
                if (groupTabs.length === 0) return null;

                return (
                  <div key={grpIdx} className="space-y-1">
                    <div className="px-3 text-[9px] font-condensed font-bold uppercase tracking-widest text-base-muted/50 py-1">
                      {group.title}
                    </div>
                    {groupTabs.map(t => {
                      const IconComponent = IconMap[t.icon] || Folder;
                      const isTabActive = activeTab === t.id;

                      const hasCountsComp = t.id === 'completed';
                      const compCount = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
                      const hasCountsArc = t.id === 'archive';
                      const arcCount = projects.filter(p => p.isArchived).length;
                      const hascountsProb = t.id === 'focus24';
                      const openProbCount = problemReports.filter(r => r.status === 'Open').length;
                      const hasCountsInsp = t.id === 'inspections';
                      const pendingInspCount = inspections.filter(ins => ins.status === 'Requested').length;

                      let badgeCount = 0;
                      let badgeBg = 'bg-base-accent-dim text-base-accent border border-base-accent/10';
                      if (hasCountsComp) {
                        badgeCount = compCount;
                        badgeBg = 'bg-base-green/10 text-base-green border border-base-green/20';
                      } else if (hasCountsArc) {
                        badgeCount = arcCount;
                      } else if (hascountsProb) {
                        badgeCount = openProbCount;
                        badgeBg = 'bg-red-500 text-white animate-pulse';
                      } else if (hasCountsInsp) {
                        badgeCount = pendingInspCount;
                        badgeBg = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                      }

                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTab(t.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isTabActive
                              ? 'bg-base-accent-dim/15 text-base-accent border-l-2 border-base-accent font-extrabold pl-2.5'
                              : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
                          }`}
                        >
                          <IconComponent className="h-4.5 w-4.5 shrink-0" />
                          <span className="flex-1 text-left truncate">{t.label}</span>
                          {badgeCount > 0 && (
                            <span className={`px-1.5 py-0.5 rounded font-condensed font-extrabold text-[9px] ${badgeBg}`}>
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-base-border p-4 bg-base-surface2 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-sm uppercase">
                  {currentUser.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0 leading-none">
                  <h4 className="text-xs font-bold text-base-text truncate">{currentUser.name}</h4>
                  <span className="text-[9px] font-condensed font-semibold text-base-accent uppercase tracking-wider block mt-0.5">{currentUser.role}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-condensed uppercase tracking-wider font-extrabold text-base-muted">
                <button 
                  onClick={() => { authHook.setChangePasswordModalOpen(true); setMobileMenuOpen(false); }} 
                  className="flex items-center gap-1 hover:text-base-accent cursor-pointer"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>Update Key</span>
                </button>
                <button 
                  onClick={() => { authHook.handleLogout(); setMobileMenuOpen(false); }} 
                  className="flex items-center gap-1 hover:text-base-red cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* 4. MAIN CONTENT CONTAINER (Desktop offset applied smoothly) */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        
        {/* Contextual Desktop Sub-Header Bar */}
        <header className="hidden md:flex h-14 bg-base-surface/80 backdrop-blur-md border-b border-base-border px-6 items-center justify-between sticky top-0 z-30 select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-condensed font-extrabold uppercase tracking-widest text-base-accent bg-base-accent-dim/15 px-3 py-1 rounded border border-base-accent/20">
              {activeTabLabel}
            </span>
            {isOffline && (
              <span className="px-2 py-0.5 rounded-full font-condensed font-extrabold text-[9px] uppercase bg-red-500/15 text-red-500 border border-red-500/30 tracking-wider animate-pulse">
                OFFLINE (CACHE ACTIVE)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            {can('exportData') && (
              <button 
                onClick={() => exportProjectsCSV(projects, timesheets)} 
                className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 transition-all font-condensed font-extrabold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                title="Download consolidated spreadsheets"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV data</span>
              </button>
            )}
          </div>
        </header>

        {/* Core Screen Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
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
              clearActivityLogs={() => { setRealActivities([]); verifyMarkChanged(); }}
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
            <UsersPage users={users} currentUser={currentUser} onUpdateUsers={(updated) => {
              const prev = users;
              setUsers(updated);
              verifyMarkChanged();
              
              // Granular updates for users
              const prevMap = new Map(prev.map(u => [u.id, u]));
              updated.forEach(u => {
                const oldU = prevMap.get(u.id);
                if (!oldU || JSON.stringify(oldU) !== JSON.stringify(u)) {
                  saveItem('users', u);
                }
              });
              const updatedSet = new Set(updated.map(u => u.id));
              prev.forEach(u => {
                if (!updatedSet.has(u.id)) {
                  removeItem('users', u.id);
                }
              });
            }} />
          )}
        </main>

        {/* Universal Footer Alignment */}
        <footer className={`fixed bottom-0 right-0 py-2.5 px-6 border-t border-base-border bg-base-surface text-base-muted text-[10px] font-condensed font-bold uppercase tracking-wider flex items-center justify-between z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] transition-all duration-300 ${sidebarCollapsed ? 'left-16' : 'left-64'} md:left-auto`}>
          <span>Austin Batam · Project tracking console</span>
          <span className="text-base-accent font-bold">{lastSavedLabel}</span>
        </footer>

      </div>

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
