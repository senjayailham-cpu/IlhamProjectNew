import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { User, Project, Employee, TimesheetEntry, ActivityLog, ProblemReport, InspectionRequest, WireLog, MaterialItem, MaterialRequest, MaterialConsumptionLog, MaterialProcessing, ProcessingStageKey, ProcessingStage, MaterialUnit, MaterialCategory, Assembly, DrawingRevision, BomTemplate, BomItem } from './types';
import { DEFAULT_USERS, DEFAULT_PROJECTS, DEFAULT_EMPLOYEES, DEFAULT_TIMESHEETS, DEFAULT_ACTIVITIES, DEFAULT_PROBLEM_REPORTS, DEFAULT_INSPECTION_REQUESTS, DEFAULT_WIRE_LOGS } from './mockData';
import { exportProjectsCSV } from './utils/projectUtils';
import { can as canUtil, PERMISSIONS, getDefaultLandingTabForRole } from './utils/permissions';
import { uid, cleanFirestoreData, handleFirestoreError, OperationType, sha256 } from './utils/helpers';

// Firebase imports
import { db, auth } from './services/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, runTransaction, query, orderBy, limit, CollectionReference, Query } from 'firebase/firestore';

// Custom Hooks & Subcomponents
import { AuthProvider, useAuth, useProjects, useEmployees, useTimesheets, useFirestore, useMasterData, useOrgSettings } from './hooks';
import { useUserPreferences } from './hooks/useUserPreferences';
import { useAppStore, useUIStore } from './store';
import ThemeToggle from './components/ThemeToggle';
import FormsAndModals from './components/FormsAndModals';
import SpotlightModal from './components/SpotlightModal';
import { GaAutoMatchModal } from './components/GaAutoMatchModal';
import { IndustryTemplatePicker } from './components/IndustryTemplatePicker';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layout Components
import { AppSidebar } from './components/layout/AppSidebar';
import { AppMobileMenu } from './components/layout/AppMobileMenu';
import { AppTopBar } from './components/layout/AppTopBar';
import BottomNav from './components/layout/BottomNav';
import InstallPrompt from './components/layout/InstallPrompt';

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
const ConsumableView = lazy(() => import('./components/ConsumableView'));
const MaterialsView = lazy(() => import('./components/MaterialsView'));
const UsersAccessView = lazy(() => import('./components/UsersAccessView'));
const DailyReportView = lazy(() => import('./components/DailyReportView'));
const EmployeesView = lazy(() => import('./components/EmployeesView'));
const ProjectSchedulePage = lazy(() => import('./pages/ProjectSchedulePage').then(m => ({ default: m.ProjectSchedulePage })));
const MaterialProcessingView = lazy(() => import('./components/MaterialProcessingView'));
const ManpowerBoardView = lazy(() => import('./components/ManpowerBoardView'));
const ProgressUpdateView = lazy(() => import('./components/ProgressUpdateView'));
const MasterDataPage = lazy(() => import('./pages/MasterDataPage').then(m => ({ default: m.MasterDataPage })));
const OrgSettingsPage = lazy(() => import('./pages/OrgSettingsPage').then(m => ({ default: m.OrgSettingsPage })));
const KPIView = lazy(() => import('./components/KPIView'));
const DrawingRegisterView = lazy(() => import('./components/DrawingRegisterView'));
const BomView = lazy(() => import('./components/BomView'));
const ProjectTimelineView = lazy(() => import('./components/ProjectTimelineView'));
const SchedulingRiskDashboard = lazy(() => import('./components/SchedulingRiskDashboard'));
const ShopFloorView = lazy(() => import('./components/ShopFloorView'));

// Lucide Icons
import {
  Download, LogOut, Key, Menu, X, ChevronLeft, ChevronRight,
  LayoutGrid, AlertTriangle, Folder, Clock, CheckCircle, Archive, ClipboardCheck, Flame, FileText, FileBadge, ListTree, Users, ShieldCheck, BarChart2, Package, Layers, ListChecks, Database, Trophy, Calendar, TrendingUp, Settings, Factory
} from 'lucide-react';

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
  FileBadge,
  ListTree,
  Users,
  ShieldCheck,
  BarChart2,
  Package,
  Layers,
  ListChecks,
  Database,
  Trophy,
  Calendar,
  TrendingUp,
  Settings,
  Factory
};

const sectionGroups = [
  {
    title: 'Overview',
    items: ['dash', 'projects', 'schedule']
  },
  {
    title: 'Shop Floor',
    items: ['shopfloor', 'timesheet', 'manpower', 'matprocessing', 'materials', 'inspections']
  },
  {
    title: 'Engineering',
    items: ['drawings', 'bom', 'consumable']
  },
  {
    title: 'Admin',
    items: ['dailyreport', 'employees', 'users', 'masterdata', 'orgsettings']
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
  const { prefs, setPref } = useUserPreferences(currentUser);

  // Local sync and list states
  const [activities, setRealActivities] = useState<ActivityLog[]>([]);
  const [problemReports, setRealProblemReports] = useState<ProblemReport[]>([]);
  const [inspections, setRealInspections] = useState<InspectionRequest[]>([]);
  const [wireLogs, setRealWireLogs] = useState<WireLog[]>([]);
  const [materials, setRealMaterials] = useState<MaterialItem[]>([]);
  const [materialRequests, setRealMaterialRequests] = useState<MaterialRequest[]>([]);
  const [consumptionLogs, setRealConsumptionLogs] = useState<MaterialConsumptionLog[]>([]);
  const [drawings, setRealDrawings] = useState<DrawingRevision[]>([]);
  const [bomTemplates, setRealBomTemplates] = useState<BomTemplate[]>([]);

  // Toggle states for sidebar and navigation
  const sidebarCollapsed = prefs.sidebarCollapsed ?? false;
  const toggleSidebar = () => setPref('sidebarCollapsed', !sidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Wrap state setters for direct local updates to both local state and useAppStore
  const setActivities = (action: React.SetStateAction<ActivityLog[]>) => {
    setRealActivities((prev) => {
      const next = typeof action === 'function' ? (action as (a: ActivityLog[]) => ActivityLog[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setActivities(next);
      });
      return next;
    });
  };
  const setProblemReports = (action: React.SetStateAction<ProblemReport[]>) => {
    setRealProblemReports((prev) => {
      const next = typeof action === 'function' ? (action as (p: ProblemReport[]) => ProblemReport[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setProblemReports(next);
      });
      return next;
    });
  };
  const setInspections = (action: React.SetStateAction<InspectionRequest[]>) => {
    setRealInspections((prev) => {
      const next = typeof action === 'function' ? (action as (i: InspectionRequest[]) => InspectionRequest[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setInspections(next);
      });
      return next;
    });
  };
  const setWireLogs = (action: React.SetStateAction<WireLog[]>) => {
    setRealWireLogs((prev) => {
      const next = typeof action === 'function' ? (action as (w: WireLog[]) => WireLog[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setWireLogs(next);
      });
      return next;
    });
  };
  const setMaterials = (action: React.SetStateAction<MaterialItem[]>) => {
    setRealMaterials((prev) => {
      const next = typeof action === 'function' ? (action as (m: MaterialItem[]) => MaterialItem[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setMaterials(next);
      });
      return next;
    });
  };
  const setMaterialRequests = (action: React.SetStateAction<MaterialRequest[]>) => {
    setRealMaterialRequests((prev) => {
      const next = typeof action === 'function' ? (action as (mr: MaterialRequest[]) => MaterialRequest[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setMaterialRequests(next);
      });
      return next;
    });
  };
  const setConsumptionLogs = (action: React.SetStateAction<MaterialConsumptionLog[]>) => {
    setRealConsumptionLogs((prev) => {
      const next = typeof action === 'function' ? (action as (c: MaterialConsumptionLog[]) => MaterialConsumptionLog[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setConsumptionLogs(next);
      });
      return next;
    });
  };
  const setDrawings = (action: React.SetStateAction<DrawingRevision[]>) => {
    setRealDrawings((prev) => {
      const next = typeof action === 'function' ? (action as (d: DrawingRevision[]) => DrawingRevision[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setDrawings(next);
      });
      return next;
    });
  };
  const setBomTemplates = (action: React.SetStateAction<BomTemplate[]>) => {
    setRealBomTemplates((prev) => {
      const next = typeof action === 'function' ? (action as (b: BomTemplate[]) => BomTemplate[])(prev) : action;
      queueMicrotask(() => {
        useAppStore.getState().setBomTemplates(next);
      });
      return next;
    });
  };

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
    useAppStore.setState({ isOffline, lastSavedLabel: isOffline ? 'OFFLINE MODE (Cached)' : 'All synced online' });
  }, [isOffline]);

  // Flag ref to ensure default landing tab per role is only set once per user session (doesn't override manual navigation)
  const defaultTabSetForUserRef = useRef<string | null>(null);

  // Sync Current User with Zustand App Store
  useEffect(() => {
    useAppStore.setState({ currentUser, users });
  }, [currentUser, users]);

  // Helper to remap deprecated tabs
  const getMappedTab = (tab: string) => {
    switch (tab) {
      case 'focus':
      case 'focus24': return 'shopfloor';
      case 'scheduling-risk': return 'schedule';
      case 'progress': return 'projects';
      case 'kpi': return 'dash';
      default: return tab;
    }
  };

  // Central Navigation Handler (single source of truth for tab switches)
  const navigateTo = (tab: string) => {
    let mapped = getMappedTab(tab);

    // Guard: Shop Floor is restricted to coordinator and admin roles
    if (mapped === 'shopfloor' && currentUser) {
      const isAllowedRole = currentUser.role === 'coordinator' || currentUser.role === 'admin';
      const hasExplicitFeature = currentUser.allowedFeatures?.includes('shopfloor');
      const isForbidden = !isAllowedRole && !hasExplicitFeature;
      if (isForbidden) {
        mapped = getDefaultLandingTabForRole(currentUser.role, currentUser.allowedFeatures) || 'dash';
      }
    }

    setActiveTab(mapped);
    useUIStore.setState({ activeTab: mapped });
  };

  // Set default landing tab per user session once
  useEffect(() => {
    if (currentUser?.id) {
      if (defaultTabSetForUserRef.current !== currentUser.id) {
        defaultTabSetForUserRef.current = currentUser.id;
        const initialRoleTab = getDefaultLandingTabForRole(currentUser.role, currentUser.allowedFeatures);
        navigateTo(initialRoleTab);
      }
    } else {
      defaultTabSetForUserRef.current = null;
    }
  }, [currentUser?.id, currentUser?.role]);

  // UI Store Navigation Sync (Store -> Local state)
  const storeActiveTab = useUIStore((s) => s.activeTab);
  const shopFloorMode = useUIStore((s) => s.shopFloorMode);
  const setShopFloorMode = useUIStore((s) => s.setShopFloorMode);

  useEffect(() => {
    if (storeActiveTab) {
      const mappedTab = getMappedTab(storeActiveTab);
      if (mappedTab !== activeTab) {
        setActiveTab(mappedTab);
      }
    }
  }, [storeActiveTab]);

  // Sync other UI state variables to useUIStore (without touching activeTab to prevent race conditions)
  useEffect(() => {
    useUIStore.setState({
      mobileMenuOpen,
      selectedMonth,
      reportDate,
      projectSearchQuery,
      currentTabMonthFilter
    });
  }, [mobileMenuOpen, selectedMonth, reportDate, projectSearchQuery, currentTabMonthFilter]);

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

  const can = (userOrPerm: any, maybePerm?: keyof typeof PERMISSIONS.admin): boolean => {
    if (maybePerm) {
      return canUtil(userOrPerm, maybePerm);
    }
    const perm = userOrPerm as keyof typeof PERMISSIONS.admin;
    if (!currentUser) return false;
    if (currentUser.allowedPermissions && currentUser.allowedPermissions[perm] !== undefined) {
      return !!currentUser.allowedPermissions[perm];
    }
    return !!PERMISSIONS[currentUser.role]?.[perm];
  };

  const handleUpdateProject = (
    updatedProj: Project,
    logParams?: {
      type: string;
      action: string;
      asmName?: string;
      task?: string;
      oldP?: number;
      newP?: number;
    }
  ) => {
    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
    saveItem('projects', updatedProj);
    verifyMarkChanged();
    if (logParams) {
      logActivity(
        logParams.type as any,
        logParams.action,
        updatedProj.id,
        updatedProj.name,
        logParams.asmName,
        logParams.task,
        logParams.oldP,
        logParams.newP
      );
    }
  };

  const masterData = useMasterData(!!fbUser && !!currentUser && !!auth.currentUser);
  const orgSettingsHook = useOrgSettings(!!fbUser && !!currentUser && !!auth.currentUser);
  const { orgSettings, saveSettings, applyTemplate } = orgSettingsHook;

  // Setup sub-hooks and project contexts
  const projectsHook = useProjects(logActivity, verifyMarkChanged, setDeleteConfirm, masterData.ensureEntry, bomTemplates);
  const { projects, setProjects } = projectsHook;

  const employeesHook = useEmployees(verifyMarkChanged, setDeleteConfirm);
  const { employees, setEmployees } = employeesHook;

  const [gaBackfillDone, setGaBackfillDone] = useState(false);

  useEffect(() => {
    if (gaBackfillDone || projects.length === 0 || !masterData.entries) return;
    const existingGaValues = new Set(
      masterData.entries
        .filter(e => e.category === 'gaNumber')
        .map(e => e.value.toUpperCase())
    );
    const uniqueGaNumbers = new Set<string>(
      projects
        .map(p => p.gaNumber?.trim().toUpperCase())
        .filter((g): g is string => !!g && !existingGaValues.has(g))
    );
    if (uniqueGaNumbers.size > 0) {
      Promise.all(
        Array.from(uniqueGaNumbers).map(ga =>
          masterData.ensureEntry('gaNumber', ga).catch(() => {})
        )
      ).then(() => setGaBackfillDone(true));
    } else {
      setGaBackfillDone(true);
    }
  }, [projects, masterData.entries, gaBackfillDone]);

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

        const listenToCollection = (
          colName: string,
          stateSetter: (data: any) => void,
          queryFn?: (colRef: CollectionReference) => Query
        ) => {
          const colRef = collection(db, colName);
          const q = queryFn ? queryFn(colRef) : colRef;
          const unsub = onSnapshot(q, (snapshot) => {
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

            // Sync to Zustand Store for global real-time access
            const store = useAppStore.getState();
            if (colName === 'projects') store.setProjects(list);
            else if (colName === 'employees') store.setEmployees(list);
            else if (colName === 'timesheets') store.setTimesheets(list);
            else if (colName === 'activities') store.setActivities(list);
            else if (colName === 'problemReports') store.setProblemReports(list);
            else if (colName === 'inspections') store.setInspections(list);
            else if (colName === 'users') store.setUsers(list);
            else if (colName === 'wireLogs') store.setWireLogs(list);
            else if (colName === 'materials') store.setMaterials(list);
            else if (colName === 'materialRequests') store.setMaterialRequests(list);
            else if (colName === 'consumptionLogs') store.setConsumptionLogs(list);
            else if (colName === 'drawings') store.setDrawings(list);
            else if (colName === 'bomTemplates') store.setBomTemplates(list);
          }, (error) => {
            console.error(`Firestore real-time error on ${colName}:`, error);
            handleFirestoreError(error, OperationType.LIST, colName);
          });
          unsubscribers.push(unsub);
        };

        listenToCollection('projects', setProjects);
        listenToCollection('employees', setEmployees);
        listenToCollection('timesheets', setTimesheets);
        listenToCollection('activities', setActivities, (colRef) =>
          query(colRef, orderBy('ts', 'desc'), limit(100))
        );
        listenToCollection('problemReports', setProblemReports, (colRef) =>
          query(colRef, orderBy('date', 'desc'), limit(150))
        );
        listenToCollection('inspections', setInspections);
        if (currentUser.role === 'admin') {
          listenToCollection('users', setUsers);
        }
        listenToCollection('wireLogs', setWireLogs, (colRef) =>
          query(colRef, orderBy('date', 'desc'), limit(200))
        );
        listenToCollection('materials', setMaterials);
        listenToCollection('materialRequests', setMaterialRequests);
        listenToCollection('consumptionLogs', setConsumptionLogs, (colRef) =>
          query(colRef, orderBy('date', 'desc'), limit(300))
        );
        listenToCollection('drawings', setDrawings);
        listenToCollection('bomTemplates', setBomTemplates);
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
    await handleUpdateMaterial(id, { currentStock: newStock });
  };

  const handleUpdateMaterial = async (id: string, updates: Partial<MaterialItem>) => {
    const now = new Date().toISOString();
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: now } : m));
    verifyMarkChanged();
    await saveItem('materials', { id, ...updates, updatedAt: now });
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
          if (item.materialId && item.materialId !== 'wire') {
            const mat = materials.find(m => m.id === item.materialId);
            if (mat) {
              const qtyToIssue = item.qtyIssued ?? item.qtyRequested;
              const newStock = Math.max(0, mat.currentStock - qtyToIssue);
              handleUpdateMaterialStock(mat.id, newStock);
            }
          }

          if (item.isWire === true || item.materialId === 'wire') {
            // FOR WIRE ITEMS (item.isWire === true): create a WireLog
            const newWireLog: WireLog = {
              id: 'wl_' + uid(),
              date: now,
              welderId: mr.forEmployeeId || mr.requestedById,
              welderName: mr.forEmployeeName || mr.requestedBy,
              welderPosition: mr.forEmployeePosition,
              projectId: mr.projectId,
              projectName: mr.projectName,
              assemblyId: mr.assemblyId || '',
              assemblyName: mr.assemblyName || '',
              amountKg: item.qtyIssued ?? item.qtyRequested,
              notes: `Issued from ${mr.mrNo}`,
            };
            setWireLogs(prev => [newWireLog, ...prev]);
            await saveItem('wireLogs', newWireLog);
          } else {
            // FOR PPE AND WELDING CONSUMABLE ITEMS (item.isWire !== true): create a consumptionLog WITH employee fields
            const mat = materials.find(m => m.id === item.materialId);
            const newLog: MaterialConsumptionLog = {
              id: 'cl_' + uid(),
              date: now,
              materialId: item.materialId,
              materialName: item.materialName,
              unit: item.unit,
              qtyUsed: item.qtyIssued ?? item.qtyRequested,
              projectId: mr.projectId,
              projectName: mr.projectName,
              assemblyId: mr.assemblyId || '',
              assemblyName: mr.assemblyName || '',
              employeeId: mr.forEmployeeId || mr.requestedById,
              employeeName: mr.forEmployeeName || mr.requestedBy,
              employeePosition: mr.forEmployeePosition,
              category: (item as any).category || mat?.category || 'Welding Consumable',
              issuedBy: extra?.issuedBy || currentUser?.name || 'System',
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

  const handleDeleteConsumptionLog = async (id: string) => {
    const target = consumptionLogs.find(l => l.id === id);
    if (!target) return;
    setConsumptionLogs(prev => prev.filter(l => l.id !== id));
    verifyMarkChanged();
    logActivity('assembly_progress' as any, `Deleted consumption log entry: ${target.qtyUsed} ${target.unit} of ${target.materialName}`, target.projectId, target.projectName, target.assemblyName, undefined, undefined, undefined, `Logs historical revision by user: ${currentUser?.name || 'Authorized user'}`);
    await removeItem('consumptionLogs', id);
  };

  const handleAddMaterialProcessing = async (
    projectId: string,
    itemOrItems: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'> | Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const rawItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (rawItems.length === 0) return;

    let proj = projects.find(p => p.id === projectId);
    if (!proj && rawItems[0]?.projectId) {
      proj = projects.find(p => p.id === rawItems[0].projectId);
    }
    if (!proj && rawItems[0]?.gaNumber) {
      const cleanGa = (rawItems[0].gaNumber || '').trim().toUpperCase();
      proj = projects.find(p => p.gaNumber && (p.gaNumber || '').trim().toUpperCase() === cleanGa);
    }
    if (!proj && projects.length > 0) {
      proj = projects[0];
    }
    if (!proj) return;

    const targetProjectId = proj.id;
    const now = new Date().toISOString();

    const createdItems: MaterialProcessing[] = rawItems.map((item, idx) => {
      const newItem: MaterialProcessing = {
        ...item,
        id: 'mp_' + uid() + '_' + idx,
        projectId: targetProjectId,
        projectName: proj!.client || proj!.name,
        gaNumber: item.gaNumber || proj!.gaNumber || '',
        createdBy: item.createdBy || currentUser?.name || 'System',
        createdAt: now,
        updatedAt: now,
      };

      // Check if the added item is already completed / 100% and not yet stocked
      if ((newItem.overallPct === 100 || newItem.isCompleted) && !newItem.isStocked) {
        const itemMatName = (newItem.materialName || newItem.description || '').trim().toLowerCase();
        const itemPartNo = (newItem.partNo || '').trim().toLowerCase();
        const existingMat = materials.find(m => {
          const mName = (m?.name || '').trim().toLowerCase();
          const mPart = (m?.partNumber || '').trim().toLowerCase();
          return (itemMatName && mName === itemMatName) || (itemPartNo && mPart === itemPartNo);
        });

        if (existingMat) {
          const newStock = existingMat.currentStock + newItem.qty;
          const updates: Partial<MaterialItem> = { currentStock: newStock, updatedAt: now };
          if (!existingMat.partNumber && newItem.partNo) {
            updates.partNumber = newItem.partNo.trim();
          }
          setMaterials(prev => prev.map(m => m.id === existingMat.id ? { ...m, ...updates } : m));
          saveItem('materials', { id: existingMat.id, ...updates });
        } else {
          const units: MaterialUnit[] = ['kg', 'pcs', 'roll', 'liter', 'meter', 'box', 'set'];
          const unitLower = (newItem.unit || 'pcs').toLowerCase() as any;
          const unit: MaterialUnit = units.includes(unitLower) ? unitLower : 'pcs';

          const newMat: MaterialItem = {
            id: 'mat_' + uid() + '_' + idx,
            name: (newItem.materialName || newItem.description || 'Unnamed Part').trim(),
            partNumber: newItem.partNo ? newItem.partNo.trim() : undefined,
            category: 'Other',
            unit,
            currentStock: newItem.qty,
            minStock: 0,
            createdAt: now,
            updatedAt: now
          };

          setMaterials(prev => [newMat, ...prev]);
          saveItem('materials', newMat);
        }
        newItem.isStocked = true;
      }

      return newItem;
    });

    let finalUpdatedList: MaterialProcessing[] = [];

    setProjects(prevProjects => {
      return prevProjects.map(p => {
        if (p.id === targetProjectId) {
          const existingList = p.materialProcessing || [];
          const combined = [...createdItems, ...existingList];
          finalUpdatedList = combined;
          return { ...p, materialProcessing: combined };
        }
        return p;
      });
    });

    if (finalUpdatedList.length === 0) {
      finalUpdatedList = [...createdItems, ...(proj.materialProcessing || [])];
    }

    try {
      // Force re-read dari Firestore setelah save berhasil
      // supaya Spotlight langsung dapat data terbaru
      await saveItem('projects', { id: targetProjectId, materialProcessing: finalUpdatedList });
      logActivity('task_add' as any,
        `Added ${createdItems.length} material processing item(s) → ${proj.client || proj.name}`);
    } catch (err) {
      console.error("Error adding material processing:", err);
      handleFirestoreError(err, OperationType.WRITE, 'projects');
    }

    verifyMarkChanged();
  };

  const handleUpdateProcessingStage = async (
    projectId: string,
    mpId: string,
    stageKey: ProcessingStageKey,
    stageData: Partial<ProcessingStage>
  ) => {
    const now = new Date().toISOString();
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const currentList = proj.materialProcessing || [];

    let updatedMpName = '';
    let updatedItem: MaterialProcessing | null = null;

    const updatedMPs = currentList.map(mp => {
      if (mp.id !== mpId) return mp;
      updatedMpName = mp.materialName || mp.description || 'Unnamed Part';
      const existingStage = mp.stages[stageKey];

      let newPct = stageData.pct ?? existingStage?.pct ?? 0;
      let newStatus = stageData.status ?? existingStage?.status ?? 'pending';

      if (newPct >= 100) {
        newPct = 100;
        if (newStatus !== 'skipped') newStatus = 'done';
      } else if (newStatus === 'done') {
        newPct = 100;
      }

      const updatedStage: ProcessingStage = {
        ...existingStage,
        ...stageData,
        pct: newPct,
        status: newStatus,
      };

      const updatedStages: Partial<Record<ProcessingStageKey, ProcessingStage>> = {
        ...mp.stages,
        [stageKey]: updatedStage
      };

      // Expand activeStages (e.g. handle legacy 'nesting_cnc' or empty)
      const rawActiveStages = mp.activeStages && mp.activeStages.length > 0
        ? mp.activeStages
        : (['nesting', 'cnc', 'bending', 'machining'] as ProcessingStageKey[]);

      const expandedActiveStages = Array.from(
        new Set(
          rawActiveStages.flatMap(s => (s as string) === 'nesting_cnc' ? ['nesting', 'cnc'] : [s])
        )
      ) as ProcessingStageKey[];

      if (!expandedActiveStages.includes(stageKey)) {
        expandedActiveStages.push(stageKey);
      }

      const allDone = expandedActiveStages.length > 0 &&
        expandedActiveStages.every(k => {
          const st = updatedStages[k];
          if (!st) return false; // belum pernah diupdate = pct 0 = belum done
          return st.status === 'done' || st.status === 'skipped' || (st.pct ?? 0) >= 100;
        });

      const activePcts = expandedActiveStages.map(k => {
        const st = updatedStages[k];
        if (!st) return 0; // stage belum pernah diupdate = 0%, BUKAN dikecualikan
        if (st.status === 'done' || st.status === 'skipped') return 100;
        return st.pct ?? 0;
      });

      const overallPct = activePcts.length === 0
        ? 0
        : (allDone
            ? 100
            : Math.round(activePcts.reduce((a, b) => a + b, 0) / activePcts.length));

      const isCompleted = overallPct === 100 || allDone;

      const itemAfterStage: MaterialProcessing = {
        ...mp,
        activeStages: expandedActiveStages,
        stages: updatedStages,
        overallPct,
        isCompleted,
        updatedAt: now
      };

      updatedItem = itemAfterStage;
      return itemAfterStage;
    });

    // Check if item is 100% completed or isCompleted, and not yet stocked
    if (updatedItem && (updatedItem.overallPct === 100 || updatedItem.isCompleted) && !updatedItem.isStocked) {
      const matNameClean = (updatedItem.materialName || updatedItem.description || '').trim();
      const itemPartNoClean = (updatedItem.partNo || '').trim();
      const existingMat = materials.find(m => {
        const mName = (m?.name || '').trim().toLowerCase();
        const mPart = (m?.partNumber || '').trim().toLowerCase();
        const nameMatch = (matNameClean && mName === matNameClean.toLowerCase()) ||
                          (itemPartNoClean && mPart === itemPartNoClean.toLowerCase());
        const projectMatch = m.projectId === projectId;
        return nameMatch && projectMatch;
      });

      if (existingMat) {
        // Increment stock
        const newStock = existingMat.currentStock + (updatedItem.qty || 1);
        const updates: Partial<MaterialItem> = { 
          currentStock: newStock, 
          updatedAt: now,
          projectId: projectId,
          projectName: proj.name,
          workOrder: updatedItem.workOrder || proj.client
        };
        if (!existingMat.partNumber && itemPartNoClean) {
          updates.partNumber = itemPartNoClean;
        }
        setMaterials(prev => prev.map(m => m.id === existingMat.id ? { ...m, ...updates } : m));
        await saveItem('materials', { id: existingMat.id, ...updates });
        logActivity('material_edit' as any, `Added ${updatedItem.qty} ${updatedItem.unit || 'pcs'} of ${matNameClean} to stock (Material Processing Completed)`);
      } else {
        // Create new MaterialItem in Stock
        const units: MaterialUnit[] = ['kg', 'pcs', 'roll', 'liter', 'meter', 'box', 'set'];
        const unitLower = (updatedItem.unit || 'pcs').toLowerCase() as any;
        const unit: MaterialUnit = units.includes(unitLower) ? unitLower : 'pcs';

        const newMat: MaterialItem = {
          id: 'mat_' + uid(),
          name: matNameClean || 'Processed Part',
          partNumber: itemPartNoClean || undefined,
          projectId: projectId,
          projectName: proj.name,
          workOrder: updatedItem.workOrder || proj.client,
          category: 'Other',
          unit,
          currentStock: updatedItem.qty || 1,
          minStock: 0,
          location: `${proj.name} — WO: ${updatedItem.workOrder || proj.client}`,
          notes: `Auto-stocked from Material Processing — Project: ${proj.name}`,
          createdAt: now,
          updatedAt: now
        };

        setMaterials(prev => [newMat, ...prev]);
        await saveItem('materials', newMat);
        logActivity('material_add' as any, `Created stock item "${newMat.name}" with ${updatedItem.qty} ${unit} (Material Processing Completed)`);
      }

      // Mark the material processing as stocked!
      updatedItem.isStocked = true;
      updatedItem.updatedAt = now;

      // Update in updatedMPs array
      const finalMPs = updatedMPs.map(mp => mp.id === mpId ? updatedItem! : mp);

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, materialProcessing: finalMPs } : p));
      verifyMarkChanged();

      try {
        await saveItem('projects', { id: projectId, materialProcessing: finalMPs });
        logActivity('task_progress' as any,
          `Completed Material Processing & Added to Stock: ${updatedMpName} (100%)`);
      } catch (err) {
        console.error("Error saving project material processing complete:", err);
        handleFirestoreError(err, OperationType.WRITE, 'projects');
      }
    } else {
      // Regular stage update
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, materialProcessing: updatedMPs } : p));
      verifyMarkChanged();

      try {
        await saveItem('projects', { id: projectId, materialProcessing: updatedMPs });
        logActivity('task_progress' as any,
          `Updated ${stageKey}: ${stageData.pct ?? ''}% — ${updatedMpName}`);
      } catch (err) {
        console.error("Error updating processing stage:", err);
        handleFirestoreError(err, OperationType.WRITE, 'projects');
      }
    }
  };

  const handleDeleteMaterialProcessing = async (projectId: string, id: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const currentList = proj.materialProcessing || [];
    const updatedMPs = currentList.filter(m => m.id !== id);

    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, materialProcessing: updatedMPs } : p));
    verifyMarkChanged();

    try {
      await saveItem('projects', { id: projectId, materialProcessing: updatedMPs });
    } catch (err) {
      console.error("Error deleting material processing:", err);
      handleFirestoreError(err, OperationType.WRITE, 'projects');
    }
  };

  const handleDeleteAllMaterialProcessing = async (targetProjectId?: string, itemIdsToDelete?: string[]) => {
    if (itemIdsToDelete && itemIdsToDelete.length > 0) {
      const idSet = new Set(itemIdsToDelete);
      const updatedProjects = projects.map(p => {
        if (!p.materialProcessing || p.materialProcessing.length === 0) return p;
        const filtered = p.materialProcessing.filter(mp => !idSet.has(mp.id));
        return { ...p, materialProcessing: filtered };
      });
      setProjects(updatedProjects);
      verifyMarkChanged();
      try {
        const changedProjects = updatedProjects.filter((p, idx) => {
          const orig = projects[idx];
          return (orig.materialProcessing?.length || 0) !== (p.materialProcessing?.length || 0);
        });
        for (const p of changedProjects) {
          await saveItem('projects', { id: p.id, materialProcessing: p.materialProcessing });
        }
        logActivity('task_progress' as any, `Deleted ${itemIdsToDelete.length} Material Processing items`);
      } catch (err) {
        console.error("Error deleting material processing items:", err);
        handleFirestoreError(err, OperationType.WRITE, 'projects');
      }
    } else if (targetProjectId) {
      const proj = projects.find(p => p.id === targetProjectId);
      if (!proj) return;
      const count = proj.materialProcessing?.length || 0;
      const updatedProjects = projects.map(p => p.id === targetProjectId ? { ...p, materialProcessing: [] } : p);
      setProjects(updatedProjects);
      verifyMarkChanged();
      try {
        await saveItem('projects', { id: targetProjectId, materialProcessing: [] });
        logActivity('task_progress' as any, `Deleted all ${count} Material Processing items in project ${proj.name}`);
      } catch (err) {
        console.error("Error deleting all material processing for project:", err);
        handleFirestoreError(err, OperationType.WRITE, 'projects');
      }
    } else {
      const totalCount = projects.reduce((acc, p) => acc + (p.materialProcessing?.length || 0), 0);
      const updatedProjects = projects.map(p => ({ ...p, materialProcessing: [] }));
      setProjects(updatedProjects);
      verifyMarkChanged();
      try {
        for (const p of updatedProjects) {
          if (p.materialProcessing !== undefined) {
            await saveItem('projects', { id: p.id, materialProcessing: [] });
          }
        }
        logActivity('task_progress' as any, `Deleted all ${totalCount} Material Processing items across all projects`);
      } catch (err) {
        console.error("Error deleting all material processing:", err);
        handleFirestoreError(err, OperationType.WRITE, 'projects');
      }
    }
  };

  const handleAddDrawing = async (
    drawing: Omit<DrawingRevision, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByName' | 'status'> & { revision: string }
  ) => {
    const now = new Date().toISOString();
    const newDrawing: DrawingRevision = {
      ...drawing,
      id: 'drw_' + uid(),
      status: 'active',
      uploadedBy: currentUser?.id || 'sys',
      uploadedByName: currentUser?.name || 'Authorized User',
      uploadedAt: now,
    };
    setDrawings(prev => [newDrawing, ...prev]);
    verifyMarkChanged();
    await saveItem('drawings', newDrawing);

    logActivity('task_add' as any, `Uploaded drawing: ${newDrawing.drawingNumber} Rev ${newDrawing.revision} — "${newDrawing.title}"`, newDrawing.projectId, newDrawing.projectName);

    const notif = {
      id: 'notif_' + uid(),
      type: 'drawing_revision',
      title: 'New Drawing Revision',
      message: `Drawing ${newDrawing.drawingNumber} Rev ${newDrawing.revision} — "${newDrawing.title}" has been uploaded by ${newDrawing.uploadedByName}`,
      targetRoles: ['admin', 'manager', 'coordinator', 'project_control', 'project control'],
      projectId: newDrawing.projectId || null,
      createdAt: now
    };
    await saveItem('notifications', notif);
  };

  const handleReviseDrawing = async (
    oldDrawingId: string,
    newDrawing: Omit<DrawingRevision, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByName' | 'status'> & { revision: string }
  ) => {
    const now = new Date().toISOString();
    const newId = 'drw_' + uid();

    const oldDrawing = drawings.find(d => d.id === oldDrawingId);
    if (oldDrawing) {
      const updatedOld: DrawingRevision = {
        ...oldDrawing,
        status: 'superseded',
        supersededBy: newId
      };
      setDrawings(prev => prev.map(d => d.id === oldDrawingId ? updatedOld : d));
      await saveItem('drawings', updatedOld);
    }

    const createdDrawing: DrawingRevision = {
      ...newDrawing,
      id: newId,
      status: 'active',
      uploadedBy: currentUser?.id || 'sys',
      uploadedByName: currentUser?.name || 'Authorized User',
      uploadedAt: now
    };
    setDrawings(prev => [createdDrawing, ...prev.filter(d => d.id !== oldDrawingId)]);
    verifyMarkChanged();
    await saveItem('drawings', createdDrawing);

    logActivity('task_edit' as any, `Revised drawing: ${createdDrawing.drawingNumber} to Rev ${createdDrawing.revision}`, createdDrawing.projectId, createdDrawing.projectName);

    const notif = {
      id: 'notif_' + uid(),
      type: 'drawing_revision',
      title: 'New Drawing Revision',
      message: `Drawing ${createdDrawing.drawingNumber} Rev ${createdDrawing.revision} — "${createdDrawing.title}" has been uploaded by ${createdDrawing.uploadedByName}`,
      targetRoles: ['admin', 'manager', 'coordinator', 'project_control', 'project control'],
      projectId: createdDrawing.projectId || null,
      createdAt: now
    };
    await saveItem('notifications', notif);
  };

  const handleVoidDrawing = async (id: string) => {
    const target = drawings.find(d => d.id === id);
    if (!target) return;
    const updatedTarget: DrawingRevision = { ...target, status: 'void' };
    setDrawings(prev => prev.map(d => d.id === id ? updatedTarget : d));
    verifyMarkChanged();
    await saveItem('drawings', updatedTarget);
    logActivity('task_edit' as any, `Voided drawing: ${target.drawingNumber} Rev ${target.revision}`, target.projectId, target.projectName);
  };

  const handleDeleteDrawing = async (id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
    verifyMarkChanged();
    await removeItem('drawings', id);
  };

  const handleAddBomTemplate = async (
    template: Omit<BomTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName'>
  ) => {
    const now = new Date().toISOString();
    const newTemplate: BomTemplate = {
      ...template,
      id: 'bom_' + uid(),
      createdBy: currentUser?.id || 'sys',
      createdByName: currentUser?.name || 'Authorized User',
      createdAt: now,
      updatedAt: now
    };
    setBomTemplates(prev => [newTemplate, ...prev]);
    verifyMarkChanged();
    await saveItem('bomTemplates', newTemplate);
    logActivity('task_add' as any, `Created BOM Template: "${newTemplate.name}" (${newTemplate.model})`, undefined, undefined, undefined, undefined, undefined, undefined, `GA: ${newTemplate.gaNumber || 'None'}`);
  };

  const handleUpdateBomTemplate = async (id: string, updates: Partial<BomTemplate>) => {
    const now = new Date().toISOString();
    setBomTemplates(prev => prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: now } : b));
    verifyMarkChanged();
    await saveItem('bomTemplates', { id, ...updates, updatedAt: now });
  };

  const handleDeleteBomTemplate = async (id: string) => {
    setBomTemplates(prev => prev.filter(b => b.id !== id));
    verifyMarkChanged();
    await removeItem('bomTemplates', id);
    logActivity('task_edit' as any, `Deleted BOM Template: ${id}`);
  };

  const activeTabsList = React.useMemo(() => [
    { id: 'dash', label: 'Dashboard', icon: 'LayoutGrid', access: 'all' },
    { id: 'shopfloor', label: 'Shop Floor', icon: 'Factory', access: ['admin', 'coordinator'] },
    { id: 'projects', label: 'Projects', icon: 'Folder', access: 'all' },
    { id: 'schedule', label: 'Schedule', icon: 'Calendar', access: 'all' },
    { id: 'timesheet', label: 'Timesheet', icon: 'Clock', access: 'all' },
    { id: 'manpower', label: 'Manpower Board', icon: 'LayoutGrid', access: 'all' },
    { id: 'matprocessing', label: orgSettings?.terminology?.materialProcessingLabel || 'Mat. Processing', icon: 'Layers', access: 'all' },
    { id: 'materials', label: 'Materials', icon: 'Package', access: 'all' },
    { id: 'inspections', label: 'QC Inspection', icon: 'ClipboardCheck', access: 'all' },
    { id: 'drawings', label: 'Drawing Register', icon: 'FileBadge', access: 'all' },
    { id: 'bom', label: 'BOM', icon: 'ListTree', access: 'all' },
    { id: 'consumable', label: orgSettings?.terminology?.wireConsumableLabel || 'Consumable', icon: 'Flame', access: 'all' },
    { id: 'dailyreport', label: 'Daily Report', icon: 'FileText', access: ['admin', 'manager'] },
    { id: 'employees', label: 'Employees', icon: 'Users', access: 'all' },
    { id: 'users', label: 'Users & Access', icon: 'ShieldCheck', access: ['admin'] },
    { id: 'masterdata', label: 'Master Data', icon: 'Database', access: ['admin', 'manager'] },
    { id: 'orgsettings', label: 'Settings', icon: 'Settings', access: ['admin'] }
  ], [orgSettings]);

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

  const effectiveSidebarCollapsed = shopFloorMode || sidebarCollapsed;

  return (
    <div className="min-h-screen bg-base-bg text-base-text transition-colors duration-200 flex flex-col md:flex-row font-sans select-none antialiased">
      
      {/* 1. DESKTOP LEFT SIDEBAR */}
      <AppSidebar
        sidebarCollapsed={effectiveSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        allowedTabs={allowedTabs}
        activeTab={activeTab}
        setActiveTab={navigateTo}
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
        setActiveTab={navigateTo}
        sectionGroups={sectionGroups}
        projects={projects}
        problemReports={problemReports}
        inspections={inspections}
        currentUser={currentUser}
        onLogout={authHook.handleLogout}
        onChangePassword={() => authHook.setChangePasswordModalOpen(true)}
      />

      {/* 4. MAIN CONTENT CONTAINER (Desktop offset applied smoothly) */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${effectiveSidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        
        {/* Contextual Desktop Sub-Header Bar */}
        <AppTopBar
          activeTabLabel={activeTabLabel}
          currentUser={currentUser}
          isOffline={isOffline}
          canExport={can('exportData')}
          onExportCSV={() => exportProjectsCSV(projects, timesheets, wireLogs, consumptionLogs)}
          projects={projects}
          activities={activities}
          employees={employees}
          materials={materials}
          bomTemplates={bomTemplates}
          setActiveTab={navigateTo}
          readNotificationIds={prefs.readNotificationIds || []}
          onMarkRead={(ids) => setPref('readNotificationIds', ids)}
          openSpotlight={(id) => {
            projectsHook.setSpotlightProjectId(id);
            projectsHook.setSpotlightOpen(true);
          }}
        />

        {/* Core Screen Viewport */}
        <main key={activeTab} className={`flex-1 w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-32 page-enter ${activeTab === 'gantt' || activeTab === 'schedule' ? 'max-w-none' : 'max-w-[1600px]'}`}>
          
          {/* Shop Floor Tablet Banner when activeTab is not shopfloor */}
          {shopFloorMode && activeTab !== 'shopfloor' && (
            <div className="mb-6 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 rounded bg-base-warn text-white font-condensed font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                  <Factory className="h-3.5 w-3.5" />
                  Shop Floor Mode
                </span>
                <span className="text-xs text-base-muted hidden sm:inline font-condensed">Quick Navigation:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => navigateTo('shopfloor')}
                    className="px-2.5 py-1 rounded-lg bg-base-surface hover:bg-base-surface2 border border-base-border text-base-text font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Hub
                  </button>
                  <button
                    onClick={() => navigateTo('timesheet')}
                    className={`px-2.5 py-1 rounded-lg border font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                      activeTab === 'timesheet' ? 'bg-base-info text-white border-base-info' : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-text'
                    }`}
                  >
                    1. Timesheet
                  </button>
                  <button
                    onClick={() => navigateTo('projects')}
                    className={`px-2.5 py-1 rounded-lg border font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                      activeTab === 'projects' ? 'bg-base-ok text-white border-base-ok' : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-text'
                    }`}
                  >
                    2. Progress
                  </button>
                  <button
                    onClick={() => navigateTo('materials')}
                    className={`px-2.5 py-1 rounded-lg border font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                      activeTab === 'materials' ? 'bg-base-warn text-white border-base-warn font-black' : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-text'
                    }`}
                  >
                    3. Materials
                  </button>
                  <button
                    onClick={() => navigateTo('inspections')}
                    className={`px-2.5 py-1 rounded-lg border font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                      activeTab === 'inspections' ? 'bg-base-accent text-white border-base-accent' : 'bg-base-surface hover:bg-base-surface2 border-base-border text-base-text'
                    }`}
                  >
                    4. QC
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShopFloorMode(false)}
                className="px-3 py-1.5 bg-base-surface hover:bg-base-surface2 border border-base-border text-base-red font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Exit Shop Floor Mode"
              >
                <X className="h-3.5 w-3.5" />
                <span>Exit</span>
              </button>
            </div>
          )}

          <ErrorBoundary key={activeTab} fallback={<DefaultErrorPage tab={activeTab} />}>
            <Suspense fallback={<PageLoadingFallback />}>
              {activeTab === 'shopfloor' && (
                <ShopFloorView
                  projects={projects}
                  timesheets={timesheets}
                  inspections={inspections}
                  materialRequests={materialRequests}
                  orgSettings={orgSettings}
                  problemReports={problemReports}
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

              {activeTab === 'dash' && (
                <DashboardView
                  projects={projects}
                  timesheets={timesheets}
                  employees={employees}
                  materials={materials}
                  materialRequests={materialRequests}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  problemReports={problemReports}
                  inspections={inspections}
                  setActiveTab={navigateTo}
                  openSpotlight={(id) => {
                    projectsHook.setSpotlightProjectId(id);
                    projectsHook.setSpotlightOpen(true);
                  }}
                />
              )}

              {activeTab === 'focus24' && (
                <Focus24View
                  orgSettings={orgSettings}
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

              {activeTab === 'scheduling-risk' && (
                <SchedulingRiskDashboard
                  projects={projects}
                  problemReports={problemReports}
                  inspections={inspections}
                  currentUser={currentUser}
                  openSpotlight={(id) => {
                    projectsHook.setSpotlightProjectId(id);
                    projectsHook.setSpotlightOpen(true);
                  }}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectsPage
                  orgSettings={orgSettings}
                  projects={projects}
                  prefs={prefs}
                  onSetPref={(key, val) => setPref(key as any, val)}
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
                  // Gantt interactivity handlers
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
                  depModalRowKey={projectsHook.depModalRowKey}
                  onCloseDepModal={() => projectsHook.setDepModalOpen(false)}
                />
              )}

              {activeTab === 'inspections' && (
                <InspectionView
                  orgSettings={orgSettings}
                  inspections={inspections}
                  projects={projects}
                  currentUser={currentUser}
                  onAddInspection={handleAddInspection}
                  onUpdateInspectionStatus={handleUpdateInspectionStatus}
                  onDeleteInspection={handleDeleteInspection}
                />
              )}

              {activeTab === 'drawings' && (
                <DrawingRegisterView
                  drawings={drawings}
                  projects={projects}
                  currentUser={currentUser}
                  onAddDrawing={handleAddDrawing}
                  onReviseDrawing={handleReviseDrawing}
                  onVoidDrawing={handleVoidDrawing}
                  onDeleteDrawing={handleDeleteDrawing}
                />
              )}

              {activeTab === 'bom' && (
                <BomView
                  bomTemplates={bomTemplates}
                  materials={materials}
                  materialProcessings={projects.flatMap(p => (p.materialProcessing || []).map(mp => ({ ...mp, gaNumber: p.gaNumber })))}
                  drawings={drawings}
                  masterData={masterData}
                  projects={projects}
                  currentUser={currentUser}
                  setActiveTab={navigateTo}
                  onAddBomTemplate={handleAddBomTemplate}
                  onUpdateBomTemplate={handleUpdateBomTemplate}
                  onDeleteBomTemplate={handleDeleteBomTemplate}
                  onAddMaterialProcessing={handleAddMaterialProcessing}
                />
              )}

              {activeTab === 'consumable' && (
                <ConsumableView
                  orgSettings={orgSettings}
                  wireLogs={wireLogs}
                  consumptionLogs={consumptionLogs}
                  materials={materials}
                  projects={projects}
                  employees={employees}
                  currentUser={currentUser}
                  materialRequests={materialRequests}
                  onDeleteWireLog={handleDeleteWireLog}
                  onAddMaterialRequest={handleAddMaterialRequest}
                  onUpdateMaterialRequestStatus={handleUpdateMaterialRequestStatus}
                  onNavigateToKPI={() => navigateTo('kpi')}
                  onNavigateToMaterials={() => navigateTo('materials')}
                  onAddMaterial={handleAddMaterial}
                  onUpdateMaterial={handleUpdateMaterial}
                  onDeleteMaterial={handleDeleteMaterial}
                  setDeleteConfirm={setDeleteConfirm}
                />
              )}

              {activeTab === 'kpi' && (
                <KPIView
                  wireLogs={wireLogs}
                  consumptionLogs={consumptionLogs}
                  projects={projects}
                  employees={employees}
                  currentUser={currentUser}
                  timesheets={timesheets}
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
                  onUpdateMaterial={handleUpdateMaterial}
                  onDeleteMaterial={handleDeleteMaterial}
                  onAddMaterialRequest={handleAddMaterialRequest}
                  onUpdateMaterialRequestStatus={handleUpdateMaterialRequestStatus}
                  onDeleteMaterialRequest={handleDeleteMaterialRequest}
                  onAddConsumptionLog={handleAddConsumptionLog}
                  setDeleteConfirm={setDeleteConfirm}
                />
              )}

              {activeTab === 'matprocessing' && (
                <MaterialProcessingView
                  orgSettings={orgSettings}
                  projects={projects}
                  currentUser={currentUser!}
                  prefs={prefs}
                  onSetPref={(key, val) => setPref(key as any, val)}
                  onAdd={handleAddMaterialProcessing}
                  onUpdateStage={handleUpdateProcessingStage}
                  onDelete={handleDeleteMaterialProcessing}
                  onDeleteAll={handleDeleteAllMaterialProcessing}
                  setDeleteConfirm={setDeleteConfirm}
                  masterDataEntries={masterData.entries}
                  onEnsureMasterData={masterData.ensureEntry}
                  initialProjectId={projectsHook.spotlightProjectId || undefined}
                  onCopyStructure={async (targetProjectId: string, newAssemblies: Assembly[]) => {
                    const proj = projects.find(p => p.id === targetProjectId);
                    if (!proj) return;
                    const merged = [...(proj.assemblies || []), ...newAssemblies];
                    setProjects(prev => prev.map(p => p.id === targetProjectId ? { ...p, assemblies: merged } : p));
                    try {
                      await saveItem('projects', { id: targetProjectId, assemblies: merged });
                    } catch (err) {
                      console.error('Failed to copy structure:', err);
                    }
                  }}
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

              {(activeTab === 'schedule' || activeTab === 'gantt' || activeTab === 'timeline') && (
                <ProjectSchedulePage
                  projects={projects}
                  prefs={prefs}
                  onSetPref={(key, val) => setPref(key as any, val)}
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
                  currentUser={currentUser}
                  orgSettings={orgSettings}
                  defaultView={activeTab === 'timeline' ? 'timeline' : 'gantt'}
                />
              )}

              {activeTab === 'progress' && (
                <ProgressUpdateView
                  projects={projects}
                  onUpdateProject={(updatedProj) => {
                    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
                    saveItem('projects', updatedProj);
                    verifyMarkChanged();
                    logActivity(
                      'project_edit',
                      'Updated task progress via Update Progress page',
                      updatedProj.id,
                      updatedProj.name
                    );
                  }}
                  currentUser={currentUser}
                />
              )}

               {activeTab === 'employees' && (
                <EmployeesView
                  orgSettings={orgSettings}
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
                  currentUser={currentUser}
                  onNavigateToManpower={(date) => {
                    if (date) timesheetsHook.setTimesheetDate(date);
                    navigateTo('manpower');
                  }}
                />
              )}

              {activeTab === 'manpower' && (
                <ErrorBoundary key="manpower">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <ManpowerBoardView
                      timesheets={timesheets}
                      employees={employees}
                      projects={projects}
                      initialDate={timesheetsHook.timesheetDate}
                      currentUser={currentUser}
                      onNavigateToTimesheet={(date) => {
                        if (date) timesheetsHook.setTimesheetDate(date);
                        navigateTo('timesheet');
                      }}
                      openAddTimesheet={timesheetsHook.openTimesheetBulkAdd}
                    />
                  </Suspense>
                </ErrorBoundary>
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

              {activeTab === 'masterdata' && (
                <ErrorBoundary key="masterdata">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <MasterDataPage currentUser={currentUser} />
                  </Suspense>
                </ErrorBoundary>
              )}

              {activeTab === 'orgsettings' && (
                <ErrorBoundary key="orgsettings">
                  <Suspense fallback={<PageLoadingFallback />}>
                    <OrgSettingsPage
                      orgSettings={orgSettings}
                      currentUser={currentUser}
                      onSave={saveSettings}
                      onApplyTemplate={applyTemplate}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* PWA Mobile Install Banner */}
        <InstallPrompt />

        {/* PWA Mobile Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={navigateTo}
          setMobileMenuOpen={setMobileMenuOpen}
          totalMenuCount={allowedTabs.length}
          currentUser={currentUser}
        />

        {/* Universal Footer Alignment (Desktop only) */}
        <footer className={`fixed bottom-0 right-0 py-2.5 px-6 border-t border-base-border bg-base-surface text-base-muted text-[10px] font-condensed font-bold uppercase tracking-wider hidden md:flex items-center justify-between z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] transition-all duration-300 ${effectiveSidebarCollapsed ? 'left-16' : 'left-64'}`}>
          <span>Austin Batam · Project tracking console</span>
          <span className="text-base-accent font-bold">{lastSavedLabel}</span>
        </footer>

      </div>

      {/* Modal and forms center */}
      <FormsAndModals
        projects={projects}
        bomTemplates={bomTemplates}
        orgSettings={orgSettings}
        authHook={authHook}
        projectsHook={projectsHook}
        employeesHook={employeesHook}
        timesheetsHook={timesheetsHook}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        timesheets={timesheets}
        wireLogs={wireLogs}
        consumptionLogs={consumptionLogs}
        onAddMaterialProcessing={handleAddMaterialProcessing}
        onUpdateProcessingStage={handleUpdateProcessingStage}
        onDeleteMaterialProcessing={handleDeleteMaterialProcessing}
        setProjects={setProjects}
        verifyMarkChanged={verifyMarkChanged}
        logActivity={logActivity}
        masterDataEntries={masterData.entries}
        onEnsureMasterData={masterData.ensureEntry}
      />

      <GaAutoMatchModal
        orgSettings={orgSettings}
        isOpen={projectsHook.gaMatchModalOpen}
        gaNumber={projectsHook.pGaNumber}
        matchedProjects={projectsHook.gaMatchCandidates}
        pendingProjectData={projectsHook.pendingNewProjectData}
        onConfirmCopy={projectsHook.handleGaConfirmCopy}
        onCreateEmpty={projectsHook.handleGaCreateEmpty}
        onCancel={projectsHook.handleGaCancel}
      />

      <SpotlightModal
        isOpen={projectsHook.spotlightOpen}
        onClose={() => projectsHook.setSpotlightOpen(false)}
        projectId={projectsHook.spotlightProjectId}
        projects={projects}
        timesheets={timesheets}
        wireLogs={wireLogs}
        consumptionLogs={consumptionLogs}
        onAddMaterialProcessing={handleAddMaterialProcessing}
        onUpdateProcessingStage={handleUpdateProcessingStage}
        onDeleteMaterialProcessing={handleDeleteMaterialProcessing}
        onEdit={projectsHook.openEditProject}
        onUpdateProject={handleUpdateProject}
        currentUser={currentUser}
        canUpdateTask={can(currentUser, 'updateTask')}
      />
    </div>
  );
}

export default App;
