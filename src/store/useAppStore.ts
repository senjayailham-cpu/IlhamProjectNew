import { create } from 'zustand';
import { 
  Project, 
  ActivityLog, 
  ProblemReport, 
  InspectionRequest, 
  WireLog, 
  MaterialItem, 
  MaterialRequest, 
  MaterialConsumptionLog, 
  DrawingRevision, 
  BomTemplate, 
  Employee, 
  TimesheetEntry, 
  User 
} from '../types';

type StateSetter<T> = T | ((prev: T) => T);

interface AppStore {
  // Collections
  projects: Project[];
  setProjects: (projects: StateSetter<Project[]>) => void;

  activities: ActivityLog[];
  setActivities: (activities: StateSetter<ActivityLog[]>) => void;

  problemReports: ProblemReport[];
  setProblemReports: (problemReports: StateSetter<ProblemReport[]>) => void;

  inspections: InspectionRequest[];
  setInspections: (inspections: StateSetter<InspectionRequest[]>) => void;

  wireLogs: WireLog[];
  setWireLogs: (wireLogs: StateSetter<WireLog[]>) => void;

  materials: MaterialItem[];
  setMaterials: (materials: StateSetter<MaterialItem[]>) => void;

  materialRequests: MaterialRequest[];
  setMaterialRequests: (materialRequests: StateSetter<MaterialRequest[]>) => void;

  consumptionLogs: MaterialConsumptionLog[];
  setConsumptionLogs: (consumptionLogs: StateSetter<MaterialConsumptionLog[]>) => void;

  drawings: DrawingRevision[];
  setDrawings: (drawings: StateSetter<DrawingRevision[]>) => void;

  bomTemplates: BomTemplate[];
  setBomTemplates: (bomTemplates: StateSetter<BomTemplate[]>) => void;

  employees: Employee[];
  setEmployees: (employees: StateSetter<Employee[]>) => void;

  timesheets: TimesheetEntry[];
  setTimesheets: (timesheets: StateSetter<TimesheetEntry[]>) => void;

  users: User[];
  setUsers: (users: StateSetter<User[]>) => void;

  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // Sync & System status
  isOffline: boolean;
  setIsOffline: (isOffline: boolean) => void;
  lastSavedLabel: string;
  setLastSavedLabel: (label: string) => void;
  isChanged: boolean;
  setIsChanged: (isChanged: boolean) => void;

  // Helper selectors
  getProjectById: (id: string) => Project | undefined;
  getMaterialById: (id: string) => MaterialItem | undefined;
  getEmployeeById: (id: string) => Employee | undefined;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Collections
  projects: [],
  setProjects: (projects) =>
    set((state) => ({
      projects: typeof projects === 'function' ? projects(state.projects) : projects
    })),

  activities: [],
  setActivities: (activities) =>
    set((state) => ({
      activities: typeof activities === 'function' ? activities(state.activities) : activities
    })),

  problemReports: [],
  setProblemReports: (problemReports) =>
    set((state) => ({
      problemReports: typeof problemReports === 'function' ? problemReports(state.problemReports) : problemReports
    })),

  inspections: [],
  setInspections: (inspections) =>
    set((state) => ({
      inspections: typeof inspections === 'function' ? inspections(state.inspections) : inspections
    })),

  wireLogs: [],
  setWireLogs: (wireLogs) =>
    set((state) => ({
      wireLogs: typeof wireLogs === 'function' ? wireLogs(state.wireLogs) : wireLogs
    })),

  materials: [],
  setMaterials: (materials) =>
    set((state) => ({
      materials: typeof materials === 'function' ? materials(state.materials) : materials
    })),

  materialRequests: [],
  setMaterialRequests: (materialRequests) =>
    set((state) => ({
      materialRequests: typeof materialRequests === 'function' ? materialRequests(state.materialRequests) : materialRequests
    })),

  consumptionLogs: [],
  setConsumptionLogs: (consumptionLogs) =>
    set((state) => ({
      consumptionLogs: typeof consumptionLogs === 'function' ? consumptionLogs(state.consumptionLogs) : consumptionLogs
    })),

  drawings: [],
  setDrawings: (drawings) =>
    set((state) => ({
      drawings: typeof drawings === 'function' ? drawings(state.drawings) : drawings
    })),

  bomTemplates: [],
  setBomTemplates: (bomTemplates) =>
    set((state) => ({
      bomTemplates: typeof bomTemplates === 'function' ? bomTemplates(state.bomTemplates) : bomTemplates
    })),

  employees: [],
  setEmployees: (employees) =>
    set((state) => ({
      employees: typeof employees === 'function' ? employees(state.employees) : employees
    })),

  timesheets: [],
  setTimesheets: (timesheets) =>
    set((state) => ({
      timesheets: typeof timesheets === 'function' ? timesheets(state.timesheets) : timesheets
    })),

  users: [],
  setUsers: (users) =>
    set((state) => ({
      users: typeof users === 'function' ? users(state.users) : users
    })),

  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),

  // Sync & System status
  isOffline: !navigator.onLine,
  setIsOffline: (isOffline) => set({ isOffline }),
  lastSavedLabel: 'All synced',
  setLastSavedLabel: (lastSavedLabel) => set({ lastSavedLabel }),
  isChanged: false,
  setIsChanged: (isChanged) => set({ isChanged }),

  // Helper selectors
  getProjectById: (id) => get().projects.find((p) => p.id === id),
  getMaterialById: (id) => get().materials.find((m) => m.id === id),
  getEmployeeById: (id) => get().employees.find((e) => e.id === id)
}));
