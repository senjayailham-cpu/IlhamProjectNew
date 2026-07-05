import React, { useState, useEffect, lazy, Suspense } from 'react';
import { User, Project, Employee, TimesheetEntry, ActivityLog, ProblemReport, InspectionRequest, WireLog, MaterialItem, MaterialRequest, MaterialConsumptionLog } from './types';
import { DEFAULT_USERS, DEFAULT_PROJECTS, DEFAULT_EMPLOYEES, DEFAULT_TIMESHEETS, DEFAULT_ACTIVITIES, DEFAULT_PROBLEM_REPORTS, DEFAULT_INSPECTION_REQUESTS, DEFAULT_WIRE_LOGS } from './mockData';
import { exportProjectsCSV } from './utils/projectUtils';
import { can as canUtil, PERMISSIONS } from './utils/permissions';
import { uid, cleanFirestoreData, handleFirestoreError, OperationType, sha256 } from './utils/helpers';

// Firebase imports
import { db, auth } from './services/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';

// Custom Hooks & Subcomponents
import { AuthProvider, useAuth, useProjects, useEmployees, useTimesheets, useFirestore } from './hooks';
import ThemeToggle from './components/ThemeToggle';
import FormsAndModals from './components/FormsAndModals';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layout Components
import { AppSidebar } from './components/layout/AppSidebar';
import { AppMobileMenu } from './components/layout/AppMobileMenu';
import { AppTopBar } from './components/layout/AppTopBar';

// Fallback loader
import { PageLoadingFallback } from './components/layout/PageLoadingFallback';

// Modals, Custom Pages (Eager import LoginPage only)
import { LoginPage } from './pages';

// Lazy imports for views/pages
const DashboardView = lazy(() => import('./components/DashboardView'));
const Focus24View = lazy(() => import('./components/Focus24View'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const TimesheetView = lazy(() => import('./components/TimesheetView'));
const InspectionView = lazy(() => import('./components/InspectionView'));
const WireConsumableView = lazy(() => import('./components/WireConsumableView'));
const MaterialsView = lazy(() => import('./components/MaterialsView'));
const UsersAccessView = lazy(() => import('./components/UsersAccessView'));
const DailyReportView = lazy(() => import('./components/DailyReportView'));
const EmployeesView = lazy(() => import('./components/EmployeesView'));
const GanttPage = lazy(() => import('./pages/GanttPage').then(m => ({ default: m.GanttPage })));

// Lucide Icons
import {
  Download, LogOut, Key, Menu, X, ChevronLeft, ChevronRight,
  LayoutGrid, AlertTriangle, Folder, Clock, CheckCircle, Archive, ClipboardCheck, Flame, FileText, Users, ShieldCheck, BarChart2, Package
} from 'lucide-react';

const activeTabsList = [
  { id: 'dash', label: 'Dashboard', icon: 'LayoutGrid', access: 'all' },
  { id: 'focus24', label: '24 Hours Focus', icon: 'AlertTriangle', access: 'all' },
  { id: 'gantt', label: 'Gantt', icon: 'BarChart2', access: 'all' },
  { id: 'current', label: 'Current Projects', icon: 'Folder', access: 'all' },
  { id: 'completed', label: 'Project Complete', icon: 'CheckCircle', access: 'all' },
  { id: 'archive', label: 'Archive', icon: 'Archive', access: 'all' },
  { id: 'tray', label: 'Project Tray', icon: 'Folder', access: 'all' },
  { id: 'nontray', label: 'Project Non-Tray', icon: 'Folder', access: 'all' },
  { id: 'inspections', label: 'QC Inspection', icon: 'ClipboardCheck', access: 'all' },
  { id: 'wire', label: 'Wire Consumable', icon: 'Flame', access: 'all' },
  { id: 'materials', label: 'Materials', icon: 'Package', access: 'all' },
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
  ShieldCheck,
  BarChart2,
  Package
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
    items: ['inspections', 'wire', 'materials', 'dailyreport']
  },
  {
    title: 'Management',
    items: ['employees', 'timesheet', 'users']
  }
];

function DefaultErrorPage({ tab }: { tab: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 text-center bg-base-surface border border-base-border rounded-xl my-6">
      <div className="text-5xl">⚠️</div>
      <h2 className="font-condensed font-extrabold text-red-500 text-xl uppercase tracking-wider">
        Section Failed to Load
      </h2>
      <p className="text-sm text-neutral-500 max-w-md">
        An unexpected error occurred while rendering the {tab} section. This could be due to invalid or malformed data.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 bg-neutral-800 text-white font-bold rounded-lg uppercase tracking-wider text-xs hover:bg-neutral-700 transition-all cursor-pointer"
      >
        Reload Application
      </button>
    </div>
  );
}

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
  const { currentUser, fbUser, users, setUsers, isAuthLoading, setCurrentUser } = authHook;

  // Local sync and list states
  const [activities, setRealActivities] = useState<ActivityLog[]>([]);
  const [problemReports, setRealProblemReports] = useState<ProblemReport[]>([]);
  const [inspections, setRealInspections] = useState<InspectionRequest[]>([]);
  const [wireLogs, setRealWireLogs] = useState<WireLog[]>([]);
  const [materials, setRealMaterials] = useState<MaterialItem[]>([]);
  const [materialRequests, setRealMaterialRequests] = useState<MaterialRequest[]>([]);
  const [consumptionLogs, setRealConsumptionLogs] = useState<MaterialConsumptionLog[]>([]);

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
  const setMaterials = setRealMaterials;
  const setMaterialRequests = setRealMaterialRequests;
  const setConsumptionLogs = setRealConsumptionLogs;

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

  const { saveItem, removeItem, saveBatch } = useFirestore();

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

  const handleMarkExEmployee = async (id: string, resignDate: string, resignReason: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, isExEmployee: true, resignDate, resignReason };
      }
      return e;
    }));
    await saveItem('employees', { id, isExEmployee: true, resignDate, resignReason });
    verifyMarkChanged();
  };

  const handleReinstateEmployee = async (id: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        const copy = { ...e };
        copy.isExEmployee = false;
        copy.resignDate = '';
        copy.resignReason = '';
        return copy;
      }
      return e;
    }));
    await saveItem('employees', { id, isExEmployee: false, resignDate: '', resignReason: '' });
    verifyMarkChanged();
  };

  const handleBulkUpdateEmployees = async (ids: string[], updates: Partial<Employee>) => {
    let updatedList: Employee[] = [];
    setEmployees(prev => {
      const next = prev.map(e => {
        if (ids.includes(e.id)) {
          const updated = { ...e, ...updates };
          updatedList.push(updated);
          return updated;
        }
        return e;
      });
      return next;
    });

    if (updatedList.length > 0) {
      await saveBatch('employees', updatedList);
    }
    verifyMarkChanged();
    logActivity(
      'project_edit',
      `Performed bulk update for ${ids.length} personnel: ${Object.keys(updates).map(k => `${k}=${(updates as any)[k]}`).join(', ')}`
    );
  };

  const timesheetsHook = useTimesheets(verifyMarkChanged, setDeleteConfirm);
  const { timesheets, setTimesheets } = timesheetsHook;

  // Firestore Real-time Syncer Listener (Zero LocalStorage)
  useEffect(() => {
    let active = true;
    const unsubscribers: (() => void)[] = [];

    const setupSync = async () => {
      // Ensure we are fully authenticated and have user profile data before continuing
      if (!fbUser || !currentUser || !auth.currentUser) return;

      const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;

      try {
        let isSeeded = true;
        
        // Only run check and write seeding if we are online and database is directly reachable
        if (isOnline) {
          const initDocRef = doc(db, 'system_config', 'status');
          let initDocSnap;
          try {
            initDocSnap = await getDoc(initDocRef);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'system_config/status');
          }

          isSeeded = initDocSnap && initDocSnap.exists() && initDocSnap.data()?.seeded;

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
            try {
              await Promise.all(seedPromises);
              await setDoc(initDocRef, { seeded: true });
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, 'bootstrap_seeding');
            }
          }
        }

        const listenToCollection = (colName: string, stateSetter: (data: any) => void) => {
          const colRef = collection(db, colName);
          const unsub = onSnapshot(colRef, (snapshot) => {
            const list: any[] = [];
            const seenIds = new Set<string>();
            snapshot.forEach((d) => {
              const data = d.data();
              // Filter out the UID mapping documents from the users collection.
              // A UID mapping document's Firestore ID is the Firebase UID, which is different from the user's portal ID (data.id).
              if (colName === 'users' && d.id !== data.id) {
                return;
              }
              
              const itemId = data.id || d.id;
              if (itemId && seenIds.has(itemId)) {
                return;
              }
              if (itemId) {
                seenIds.add(itemId);
              }
              list.push(data);
            });
            stateSetter(list);
          }, (error) => {
            console.error(`Firestore real-time error on ${colName}:`, error);
            handleFirestoreError(error, OperationType.LIST, colName);
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
        listenToCollection('materials', setMaterials);
        listenToCollection('materialRequests', setMaterialRequests);
        listenToCollection('consumptionLogs', setConsumptionLogs);
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
        const hasRoleChanged = currentUser.role !== match.role;
        const hasPermissionsChanged = JSON.stringify(currentUser.allowedPermissions || {}) !== JSON.stringify(match.allowedPermissions || {});
        const hasFeaturesChanged = JSON.stringify(currentUser.allowedFeatures || []) !== JSON.stringify(match.allowedFeatures || []);
        const hasNameChanged = currentUser.name !== match.name;

        if (hasRoleChanged || hasPermissionsChanged || hasFeaturesChanged || hasNameChanged) {
          const updated = {
            ...currentUser,
            name: match.name,
            role: match.role,
            allowedPermissions: match.allowedPermissions || {},
            allowedFeatures: match.allowedFeatures || []
          };
          setCurrentUser(updated);
          sessionStorage.setItem('w2proj_session_v1', JSON.stringify(updated));

          // Also update the /users/{firebaseUser.uid} mapping in Firestore in real time if online and authenticated
          const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
          if (fbUser && auth.currentUser && auth.currentUser.uid === fbUser.uid && isOnline && fbUser.uid !== currentUser.id) {
            const uidDocRef = doc(db, 'users', fbUser.uid);
            setDoc(uidDocRef, cleanFirestoreData({
              ...updated,
              id: currentUser.id,
              uid: fbUser.uid
            })).catch(e => console.warn("Failed to sync real-time UID document:", e));
          }
        }
      }
    }
  }, [users, currentUser, fbUser, setCurrentUser]);

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

  const handleAddMaterial = async (item: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newItem: MaterialItem = { ...item, id: 'mat_' + uid(), createdAt: now, updatedAt: now };
    setMaterials(prev => [newItem, ...prev]);
    verifyMarkChanged();
    await saveItem('materials', newItem);
  };

  const handleUpdateMaterialStock = async (id: string, newStock: number) => {
    const now = new Date().toISOString();
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, currentStock: newStock, updatedAt: now } : m));
    verifyMarkChanged();
    await saveItem('materials', { id, currentStock: newStock, updatedAt: now });
  };

  const handleDeleteMaterial = async (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
    verifyMarkChanged();
    await removeItem('materials', id);
  };

  const handleAddMaterialRequest = async (mr: Omit<MaterialRequest, 'id' | 'mrNo'>) => {
    try {
      const counterDocRef = doc(db, 'system_config', 'counters');
      const newMrId = 'mr_' + uid();
      const yrCode = new Date().getFullYear();
      const mrNo = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterDocRef);
        const data = snap.exists() ? snap.data() : {};
        const next = (data.mrCounter || 0) + 1;
        transaction.set(counterDocRef, { ...data, mrCounter: next }, { merge: true });
        return `MR-${yrCode}-${String(next).padStart(3, '0')}`;
      });
      const newMr: MaterialRequest = { ...mr, id: newMrId, mrNo };
      setMaterialRequests(prev => [newMr, ...prev]);
      verifyMarkChanged();
      await saveItem('materialRequests', newMr);
    } catch (err) {
      console.error('Failed to create MR:', err);
    }
  };

  const handleUpdateMaterialRequestStatus = async (
    id: string,
    status: 'Draft' | 'Submitted' | 'Approved' | 'Issued' | 'Rejected',
    extra?: { approvedBy?: string; rejectedReason?: string; issuedBy?: string }
  ) => {
    const now = new Date().toISOString().slice(0, 10);

    // Auto-reduce stock and create consumption log entries when MR is Issued
    if (status === 'Issued') {
      const mr = materialRequests.find(r => r.id === id);
      if (mr) {
        for (const item of mr.items) {
          // Reduce stock
          const mat = materials.find(m => m.id === item.materialId);
          if (mat) {
            const qtyToIssue = item.qtyIssued ?? item.qtyRequested;
            const newStock = Math.max(0, mat.currentStock - qtyToIssue);
            handleUpdateMaterialStock(mat.id, newStock);

            // Create consumption log entry automatically
            const newLog: MaterialConsumptionLog = {
              id: 'cl_' + uid(),
              date: now,
              materialId: item.materialId,
              materialName: item.materialName,
              unit: item.unit,
              qtyUsed: qtyToIssue,
              projectId: mr.projectId,
              projectName: mr.projectName,
              assemblyId: mr.assemblyId,
              assemblyName: mr.assemblyName,
              issuedBy: extra?.issuedBy || 'System',
              mrId: mr.id,
              mrNo: mr.mrNo,
              notes: `Auto-issued from MR: ${mr.mrNo}`,
            };
            setConsumptionLogs(prev => [newLog, ...prev]);
            await saveItem('consumptionLogs', newLog);
          }
        }
      }
    }

    setMaterialRequests(prev => prev.map(mr => {
      if (mr.id !== id) return mr;
      return {
        ...mr,
        status,
        approvedBy: extra?.approvedBy || mr.approvedBy,
        approvedDate: status === 'Approved' ? now : mr.approvedDate,
        rejectedReason: extra?.rejectedReason || mr.rejectedReason,
        issuedBy: extra?.issuedBy || mr.issuedBy,
        issuedDate: status === 'Issued' ? now : mr.issuedDate,
      };
    }));
    verifyMarkChanged();
    await saveItem('materialRequests', { id, status, ...extra, ...(status === 'Approved' ? { approvedDate: now } : {}), ...(status === 'Issued' ? { issuedDate: now } : {}) });
  };

  const handleDeleteMaterialRequest = async (id: string) => {
    setMaterialRequests(prev => prev.filter(mr => mr.id !== id));
    verifyMarkChanged();
    await removeItem('materialRequests', id);
  };

  const handleAddConsumptionLog = async (log: Omit<MaterialConsumptionLog, 'id'>) => {
    const newLog: MaterialConsumptionLog = { ...log, id: 'cl_' + uid() };
    setConsumptionLogs(prev => [newLog, ...prev]);
    // Reduce stock automatically
    handleUpdateMaterialStock(log.materialId, Math.max(0, (materials.find(m => m.id === log.materialId)?.currentStock || 0) - log.qtyUsed));
    verifyMarkChanged();
    await saveItem('consumptionLogs', newLog);
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
    return <LoginPage />;
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
      <AppSidebar
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        allowedTabs={allowedTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sectionGroups={sectionGroups}
        projects={projects}
        problemReports={problemReports}
        inspections={inspections}
        currentUser={currentUser}
        onLogout={authHook.handleLogout}
        onChangePassword={() => authHook.setChangePasswordModalOpen(true)}
      />

      {/* 2 & 3. MOBILE MENU & DRAWER */}
      <AppMobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        allowedTabs={allowedTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sectionGroups={sectionGroups}
        projects={projects}
        problemReports={problemReports}
        inspections={inspections}
        currentUser={currentUser}
        onLogout={authHook.handleLogout}
        onChangePassword={() => authHook.setChangePasswordModalOpen(true)}
      />

      {/* 4. MAIN CONTENT CONTAINER (Desktop offset applied smoothly) */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        
        {/* Contextual Desktop Sub-Header Bar */}
        <AppTopBar
          activeTabLabel={activeTabLabel}
          currentUser={currentUser}
          isOffline={isOffline}
          canExport={can('exportData')}
          onExportCSV={() => exportProjectsCSV(projects, timesheets)}
        />

        {/* Core Screen Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
          <ErrorBoundary key={activeTab} fallback={<DefaultErrorPage tab={activeTab} />}>
            <Suspense fallback={<PageLoadingFallback />}>
              {activeTab === 'dash' && (
                <DashboardView
                  projects={projects}
                  timesheets={timesheets}
                  employees={employees}
                  materials={materials}
                  materialRequests={materialRequests}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  openSpotlight={(id) => {
                    projectsHook.setSpotlightProjectId(id);
                    projectsHook.setSpotlightOpen(true);
                  }}
                />
              )}

              {activeTab === 'focus24' && (
                <Focus24View
                  problemReports={problemReports}
                  projects={projects}
                  employees={employees}
                  currentUser={currentUser}
                  onAddProblemReport={handleAddProblemReport}
                  onUpdateProblemStatus={handleUpdateProblemStatus}
                  onDeleteProblemReport={handleDeleteProblemReport}
                  openSpotlight={(id) => {
                    projectsHook.setSpotlightProjectId(id);
                    projectsHook.setSpotlightOpen(true);
                  }}
                />
              )}

              {['current', 'completed', 'tray', 'nontray', 'archive'].includes(activeTab) && (
                <ProjectsPage
                  activeTab={activeTab as any}
                  projects={projects}
                  timesheets={timesheets}
                  wireLogs={wireLogs}
                  consumptionLogs={consumptionLogs}
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
                  importProjectsExcel={projectsHook.importProjectsExcel}
                  deleteProjectDetails={projectsHook.deleteProjectDetails}
                  deleteProjectsExceptTarget={projectsHook.deleteProjectsExceptTarget}
                />
              )}

              {activeTab === 'inspections' && (
                <InspectionView
                  inspections={inspections}
                  projects={projects}
                  currentUser={currentUser}
                  onAddInspection={handleAddInspection}
                  onUpdateInspectionStatus={handleUpdateInspectionStatus}
                  onDeleteInspection={handleDeleteInspection}
                />
              )}

              {activeTab === 'wire' && (
                <WireConsumableView
                  wireLogs={wireLogs}
                  projects={projects}
                  employees={employees}
                  currentUser={currentUser}
                  onAddWireLog={handleAddWireLog}
                  onDeleteWireLog={handleDeleteWireLog}
                />
              )}

              {activeTab === 'materials' && (
                <MaterialsView
                  materials={materials}
                  materialRequests={materialRequests}
                  consumptionLogs={consumptionLogs}
                  projects={projects}
                  currentUser={currentUser}
                  onAddMaterial={handleAddMaterial}
                  onUpdateMaterialStock={handleUpdateMaterialStock}
                  onDeleteMaterial={handleDeleteMaterial}
                  onAddMaterialRequest={handleAddMaterialRequest}
                  onUpdateMaterialRequestStatus={handleUpdateMaterialRequestStatus}
                  onDeleteMaterialRequest={handleDeleteMaterialRequest}
                  onAddConsumptionLog={handleAddConsumptionLog}
                />
              )}

              {activeTab === 'dailyreport' && (
                <DailyReportView
                  projects={projects}
                  activityLogs={activities}
                  reportDate={reportDate}
                  setReportDate={setReportDate}
                  clearActivityLogs={() => {
                    setRealActivities([]);
                    verifyMarkChanged();
                  }}
                  openPrintView={() => window.print()}
                  timesheets={timesheets}
                />
              )}

              {activeTab === 'gantt' && (
                <GanttPage
                  projects={projects}
                  onUpdateProject={(updatedProj) => {
                    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
                    saveItem('projects', updatedProj);
                    verifyMarkChanged();
                    logActivity(
                      'project_edit',
                      'Updated task schedules via Gantt chart drag-and-drop',
                      updatedProj.id,
                      updatedProj.name
                    );
                  }}
                  onOpenDepModal={(key) => {
                    projectsHook.setDepModalRowKey(key);
                    projectsHook.setDepModalOpen(true);
                  }}
                  depModalOpen={projectsHook.depModalOpen}
                  externalRowKey={projectsHook.depModalRowKey}
                  onCloseDepModal={() => projectsHook.setDepModalOpen(false)}
                />
              )}

               {activeTab === 'employees' && (
                <EmployeesView
                  employees={employees}
                  timesheets={timesheets}
                  wireLogs={wireLogs}
                  currentUser={currentUser}
                  openAddEmployee={employeesHook.openAddEmp}
                  openEditEmployee={employeesHook.openEditEmp}
                  deleteEmployee={employeesHook.removeEmployeeRecord}
                  onImportExcel={employeesHook.importEmployeesExcel}
                  onMarkExEmployee={handleMarkExEmployee}
                  onReinstateEmployee={handleReinstateEmployee}
                  onClearAllEmployees={employeesHook.clearAllEmployees}
                  onBulkUpdateEmployees={handleBulkUpdateEmployees}
                />
              )}

              {activeTab === 'timesheet' && (
                <TimesheetView
                  timesheets={timesheets}
                  employees={employees}
                  projects={projects}
                  timesheetDate={timesheetsHook.timesheetDate}
                  setTimesheetDate={timesheetsHook.setTimesheetDate}
                  openAddTimesheet={timesheetsHook.openTimesheetBulkAdd}
                  openEditTimesheet={timesheetsHook.openTimesheetEditForm}
                  deleteTsEntry={timesheetsHook.removeTimesheetEntry}
                  exportTimesheetDaily={timesheetsHook.exportTimesheetExcel}
                  openSpotlight={(pid) => {
                    projectsHook.setSpotlightProjectId(pid);
                    projectsHook.setSpotlightOpen(true);
                  }}
                />
              )}

              {activeTab === 'users' && (
                <UsersAccessView
                  users={users}
                  currentUser={currentUser}
                  onUpdateUsers={(updated) => {
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
                        // Delete the master profile
                        removeItem('users', u.id);
                        // If there is an associated Firebase UID, delete that UID mapping document as well
                        if (u.uid) {
                          removeItem('users', u.uid);
                        }
                      }
                    });
                  }}
                  activeTabsList={activeTabsList}
                  defaultPermissions={PERMISSIONS}
                  sha256={sha256}
                />
              )}
            </Suspense>
          </ErrorBoundary>
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
        consumptionLogs={consumptionLogs}
        setProjects={setProjects}
        verifyMarkChanged={verifyMarkChanged}
        logActivity={logActivity}
      />
    </div>
  );
}

export default App;
