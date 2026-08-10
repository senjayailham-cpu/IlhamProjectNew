/**
 * ============================================================================
 * TYPE DEFINITIONS & SCHEMAS FOR AUSTIN BATAM PROJECT & MANPOWER PORTAL
 * ============================================================================
 * 
 * This file declares standard, strict, and robust TypeScript types, interfaces,
 * and enums used across the application. 
 */

// ============================================================================
// 1. ENUMERATED TYPES (STANDARD STRINGS)
// ============================================================================

export enum UserRole {
  Admin = 'admin',
  Manager = 'manager',
  Coordinator = 'coordinator',
  Viewer = 'viewer',
  FacilityMaintenance = 'facility maintanance', // Firestore-compat: intentional legacy spelling, do not change
  QualityControl = 'quality control',
  Safety = 'safety',
  ProjectControl = 'project control'
}

export type UserRoleType = UserRole | 'admin' | 'manager' | 'coordinator' | 'viewer' | 'facility maintanance' | 'quality control' | 'safety' | 'project control';

export enum ProjectStatus {
  Active = 'active',
  Pending = 'pending',
  Completed = 'completed',
  OnHold = 'on-hold'
}

export type ProjectStatusType = ProjectStatus | 'active' | 'pending' | 'completed' | 'on-hold';

export enum ProjectCategory {
  Tray = 'tray',
  NonTray = 'nontray'
}

export type ProjectCategoryType = string;

export enum ProjectLocation {
  Workshop1 = 'workshop1',
  Workshop2 = 'workshop2'
}

export type ProjectLocationType = string;

export enum TimesheetStatus {
  Present = 'present',
  Late = 'late',
  Absent = 'absent',
  Leave = 'leave'
}

export type TimesheetStatusType = TimesheetStatus | 'present' | 'late' | 'absent' | 'leave';

export enum ActivityLogType {
  TaskProgress = 'task_progress',
  TaskToggle = 'task_toggle',
  TaskAdd = 'task_add',
  TaskDelete = 'task_delete',
  ProjectAdd = 'project_add',
  ProjectEdit = 'project_edit',
  ProjectDelete = 'project_delete',
  AssemblyAdd = 'assembly_add',
  AssemblyEdit = 'assembly_edit',
  AssemblyDelete = 'assembly_delete'
}

export type ActivityLogTypeVal =
  | ActivityLogType
  | 'task_progress'
  | 'task_toggle'
  | 'task_add'
  | 'task_delete'
  | 'project_add'
  | 'project_edit'
  | 'project_delete'
  | 'assembly_add'
  | 'assembly_edit'
  | 'assembly_delete';

// ============================================================================
// 2. DATA MODELS & STRUCTURES
// ============================================================================

export interface User {
  id: string;
  name: string;
  role: UserRoleType;
  password?: string;
  passHash?: string;
  allowedFeatures?: string[];
  allowedPermissions?: Record<string, boolean>;
  currentSessionId?: string;
  uid?: string;
  preferences?: {
    sidebarCollapsed?: boolean;
    projectsViewMode?: 'list' | 'timeline' | 'radial';
    projectsFilterTab?: string;
    projectsSortBy?: 'deadline' | 'priority' | 'alphabetical';
    ganttShowSCurve?: boolean;
    ganttAutoSchedule?: boolean;
    ganttShowResourceLoad?: boolean;
    matProcessingViewMode?: string;
    readNotificationIds?: string[];
  };
}

export type WorkflowStatusType = 'verify' | 'on_track' | 'delayed' | 'complete' | 'not_started';

export interface Task {
  id: string;
  name: string;
  assigned?: string;
  difficulty?: number;
  pct: number;
  done: boolean;
  date?: string;
  finishDate?: string;
  startDate?: string;
  endDate?: string;
  predecessors?: Dependency[];
  successors?: Dependency[];
  isMilestone?: boolean;
  workflowStatus?: WorkflowStatusType;
  assignedCompany?: string;
  crewSize?: number;
}

export interface Dependency {
  key: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag?: number;
}

export interface Assembly {
  id: string;
  name: string;
  notes?: string;
  start?: string;
  finish?: string;
  tasks: Task[];
  budgetHours?: number;
  predecessors?: Dependency[];
  successors?: Dependency[];
}

export interface Project {
  id: string;
  name: string;
  client: string;
  customer?: string;
  gaNumber?: string;
  start?: string;
  due?: string;
  status: ProjectStatusType;
  category: ProjectCategoryType;
  location: ProjectLocationType;
  created: string;
  assemblies: Assembly[];
  completedDate?: string | null;
  notes?: string;
  predecessors?: Dependency[];
  successors?: Dependency[];
  budgetHours?: number;
  isArchived?: boolean;
  targetMonth?: string;
  originalDue?: string;   // snapshot tanggal Due saat project pertama dibuat, TIDAK PERNAH diubah lagi setelahnya (untuk deteksi schedule slip)
  materialProcessing?: MaterialProcessing[];
  priority?: 'low' | 'medium' | 'high';
  bay?: string;
}

export interface Employee {
  id: string;
  name: string;
  position?: string;
  location?: string;
  coordinator?: string;
  empNo?: string;
  shift?: string;
  joinDate?: string;
  eoc?: string;
  employmentStatus?: string;
  isExEmployee?: boolean;
  resignDate?: string;
  resignReason?: string;
}

export interface TimesheetEntry {
  id: string;
  date: string;
  empId: string;
  empName: string;
  workOrder?: string;
  assemblyId?: string;
  assemblyName?: string;
  totalHours: number;
  status: TimesheetStatusType;
  desc?: string;
}

export interface ProblemReport {
  id: string;
  projectId?: string;
  projectName?: string;
  category: string;
  description: string;
  assignedPosition: string;
  reportedBy: string;
  date: string;
  status: 'Open' | 'Resolved';
  photo?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface InspectionRequest {
  id: string;
  rfiNo: string;
  projectId: string;
  projectName: string;
  assemblyId?: string;
  assemblyName?: string;
  inspectionType: string;
  status: 'Draft' | 'Requested' | 'Approved' | 'Rejected / Punchlist';
  requestedBy: string;
  requestedById: string;
  requestedDate: string;
  targetDate: string;
  assignedInspector?: string;
  comments?: string;
  rcomments?: string;
  punchList?: string;
  inspectedDate?: string;
  inspectedBy?: string;
}

export interface ActivityLog {
  id: string;
  ts: string;
  date: string;
  time: string;
  userId: string;
  userName: string;
  userRole: UserRoleType;
  type: ActivityLogTypeVal;
  action: string;
  projectId?: string;
  projectName?: string;
  assemblyName?: string;
  taskName?: string;
  oldPct?: number;
  newPct?: number;
  detail?: string;
}

// ============================================================================
// 3. AUXILIARY / INTERACTIVE SYSTEM INTERFACES
// ============================================================================

export interface DashboardKPIs {
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  totalTasks: number;
  completedTasks: number;
  overallProgressPct: number;
  totalLoggedHours: number;
  todayAttendance: {
    present: number;
    absent: number;
    late: number;
    leave: number;
  };
}

export interface BulkExportDataset {
  sheetName: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
}

export interface WireLog {
  id: string;
  date: string;
  welderId: string;
  welderName: string;
  welderPosition?: string; // position of the person e.g. 'WELDER'
  projectId: string;
  projectName: string;
  assemblyId: string;
  assemblyName: string;
  amountKg: number;
  notes?: string;
}

// ============================================================================
// MATERIAL MANAGEMENT TYPES
// ============================================================================

export type MaterialCategory =
  | 'Welding Consumable'
  | 'PPE'
  | 'Tools & Equipment'
  | 'Paint & Chemical'
  | 'Wire'
  | 'Other';

export type MaterialUnit =
  | 'kg'
  | 'pcs'
  | 'roll'
  | 'liter'
  | 'meter'
  | 'box'
  | 'set';

export type MaterialRequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Issued'
  | 'Rejected';

export type MaterialRequestUrgency = 'Normal' | 'Urgent' | 'Critical';

export interface MaterialItem {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  currentStock: number;
  minStock: number;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRequestLine {
  materialId: string;
  materialName: string;
  unit: MaterialUnit;
  qtyRequested: number;
  qtyIssued?: number;
  isWire?: boolean;   // true if this line is for welding wire
  amountKg?: number;  // wire-specific: kg amount (same as qtyRequested but semantic)
}

export interface MaterialRequest {
  id: string;
  mrNo: string;
  projectId: string;
  projectName: string;
  assemblyId?: string;
  assemblyName?: string;
  urgency: MaterialRequestUrgency;
  status: MaterialRequestStatus;
  items: MaterialRequestLine[];
  requestedBy: string;
  requestedById: string;
  requestedDate: string;
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectedReason?: string;
  issuedBy?: string;
  issuedDate?: string;
  forEmployeeId?: string;    // who this consumable is for
  forEmployeeName?: string;  // name of the receiver
  forEmployeePosition?: string; // their position
}

export interface MaterialConsumptionLog {
  id: string;
  date: string;
  materialId: string;
  materialName: string;
  unit: MaterialUnit;
  qtyUsed: number;
  projectId: string;
  projectName: string;
  assemblyId?: string;
  assemblyName?: string;
  issuedBy: string;
  mrId?: string;
  mrNo?: string;
  notes?: string;
  employeeId?: string;     // id of employee who used it
  employeeName?: string;   // name of employee who used it
  employeePosition?: string; // 'WELDER'|'FITTER'|'GRINDER'|'COORDINATOR'|etc
  category?: MaterialCategory; // which category of consumable
}

// ─── MATERIAL PROCESSING ──────────────────────────────────────────────────

export type ProcessingStageKey = string;

export type ProcessingStatus = 'pending' | 'in-progress' | 'done' | 'skipped';

export interface ProcessingStage {
  pct?:       number;           // 0–100, defaults to 0 when unset
  status:     ProcessingStatus;
  startDate?: string;           // ISO "YYYY-MM-DD"
  doneDate?:  string;
  operator?:  string;           // name of person doing this stage
  notes?:     string;
}

export interface MaterialProcessing {
  id:          string;          // 'mp_' + uid()
  projectId:   string;
  projectName: string;
  workOrder:   string;          // = project.client
  gaNumber?:   string;          // auto-copy from project.gaNumber, untuk grouping produk sejenis lintas project

  // Material identification
  materialName: string;         // e.g. "Plate SS304 6mm"
  partNo?:      string;         // drawing part number
  description?: string;
  dimensions?:  string;         // e.g. "100x200x6mm"
  thickness?:   string;         // e.g. "6mm", "10mm"
  material?:    string;         // e.g. "SS304", "CS A36", "Aluminium"
  qty:          number;         // quantity of pieces/sheets
  unit:         string;         // "pcs", "sheet", "kg"
  lengthMm?:    number;          // panjang part dalam mm
  widthMm?:     number;          // lebar part dalam mm
  grade?:       string;          // grade material, e.g. "AMS140" (boleh kosong/"-")
  massKg?:      number;          // berat per 1 pcs part, dalam kg

  // Which stages are applicable for this material
  // (not all materials need all stages)
  activeStages: ProcessingStageKey[];

  // Stage data
  stages: Partial<Record<ProcessingStageKey, ProcessingStage>>;

  // Computed / meta
  overallPct:   number;         // avg of active stages pct
  createdAt:    string;
  updatedAt:    string;
  createdBy:    string;
  assemblyId?:  string;         // optional link to assembly
  assemblyName?: string;
  isCompleted:  boolean;        // true when all active stages = done
  isStocked?:   boolean;        // true when quantity has been sent/synced to stock
}

// Helper: stage display config
export const PROCESSING_STAGES: Record<ProcessingStageKey, {
  label: string;
  color: string;      // CSS variable name
  icon:  string;      // emoji fallback
  order: number;
}> = {
  nesting:  { label: 'Nesting',   color: 'var(--green)',  icon: '📐', order: 1 },
  cnc:      { label: 'CNC',       color: 'var(--accent)', icon: '⚙️',  order: 2 },
  bending:  { label: 'Bending',   color: 'var(--blue)',   icon: '🔧', order: 3 },
  machining:{ label: 'Machining', color: 'var(--muted)', icon: '🔩', order: 4 },
};

export interface MasterDataEntry {
  id: string;                    // 'md_' + uid()
  category: 'material' | 'partNo' | 'client' | 'customer' | 'subAssembly' | 'gaNumber';
  value: string;                 // nilai asli, contoh: "Plate SS304 6mm"
  normalizedValue: string;       // value.trim().toLowerCase(), untuk deteksi duplikat
  gaNumber?: string;             // opsional, kalau entry ini terkait GA Number tertentu (khusus category material)
  usageCount: number;            // berapa kali dipakai
  lastUsedAt: string;            // ISO date
  createdAt: string;             // ISO date
  createdBy?: string;            // nama/id user yang pertama input
}

// ─── ORGANIZATION SETTINGS & TEMPLATES ─────────────────────────────────────

export interface OrgSettings {
  id: string;                    // 'default' or org-specific
  industryTemplate: 'fabrication' | 'construction' | 'it' | 'general' | 'custom';

  // Configurable processing stages
  processingStages: {
    key: string;                 // slug, e.g. 'nesting', 'foundation'
    label: string;               // display name, e.g. "Nesting", "Foundation"
    color: string;               // CSS variable or hex
    order: number;
  }[];

  // Configurable trade/position list
  tradePositions: {
    key: string;
    label: string;
    color: string;
  }[];

  // Configurable inspection/QC types
  inspectionTypes: string[];

  // Configurable project categories
  projectCategories: string[];

  // Configurable locations
  projectLocations: string[];

  // Configurable problem/issue categories
  issueCategories: string[];

  // Terminology overrides
  terminology: {
    gaNumberLabel: string;        // default: "GA Number"
    materialProcessingLabel: string; // default: "Material Processing"
    wireConsumableLabel: string;  // default: "Consumable"
  };

  updatedAt: string;
}


export interface DrawingRevision {
  id: string;
  drawingNumber: string;      // contoh: "AB-DT-001"
  title: string;              // contoh: "Floor Plate Assembly - Ultima 793"
  revision: string;           // contoh: "A", "B", "C1", "Rev.2"
  projectId?: string;         // link ke project (opsional)
  projectName?: string;       // denormalized untuk display
  discipline: 'structural' | 'mechanical' | 'welding' | 'assembly' | 'general';
  status: 'active' | 'superseded' | 'void';
  uploadedBy: string;         // userId
  uploadedByName: string;     // display name
  uploadedAt: string;         // ISO timestamp
  notes?: string;             // catatan revisi (apa yang berubah)
  fileUrl?: string;           // URL Firebase Storage (opsional — lihat note)
  fileName?: string;          // nama file asli
  supersededBy?: string;      // id DrawingRevision yang menggantikan ini
}

export interface BomItem {
  id: string;
  partNumber: string;        // contoh: "AB-FP-001" or "66679"
  description: string;       // contoh: "Floor Plate Main" or "12T RATED LIFT LUG"
  material: string;          // contoh: "Bisalloy 400", "Hardox 450", "36PL MS"
  quantity: number;
  unit: 'pcs' | 'kg' | 'm' | 'm2' | 'set';
  dimensions?: string;       // contoh: "265×160mm" (free text)
  weightPerUnit?: number;    // kg per pcs/unit
  totalWeight?: number;      // kalkulasi otomatis: weightPerUnit × quantity
  drawingRef?: string;       // referensi nomor drawing (linked ke DrawingRevision)
  category: 'plate' | 'structural' | 'hardware' | 'welding_consumable' | 'paint' | 'other';
  notes?: string;
  rev?: string;              // contoh: "A", "B"
  lengthMm?: number;         // panjang part dalam mm (contoh: 265)
  widthMm?: number;          // lebar part dalam mm (contoh: 160)
  grade?: string;            // grade material (contoh: "350", "AMS140")
  pros?: string;             // proses/cad spec (contoh: "DXF", "F DXF")
  subAssembly?: string;      // nama sub assembly (contoh: "Body Assembly", "Floor Assembly")
}

export interface BomTemplate {
  id: string;
  name: string;              // contoh: "Austin Ultima — Komatsu 930E"
  model: string;             // contoh: "Ultima", "HPT", "JEC"
  truckModel?: string;       // contoh: "Komatsu 930E", "CAT 793"
  version: string;           // contoh: "v1", "v2.1"
  status: 'active' | 'draft' | 'archived';
  gaNumber?: string;         // GA Number order/unit yang pakai BOM ini
  items: BomItem[];          // nested array dalam dokumen Firestore
  totalEstWeight?: number;   // sum semua totalWeight item (auto-calc)
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export const INDUSTRY_TEMPLATES: Record<string, Omit<OrgSettings, 'id' | 'updatedAt'>> = {
  fabrication: {
    industryTemplate: 'fabrication',
    processingStages: [
      { key: 'nesting', label: 'Nesting', color: 'var(--green)', order: 1 },
      { key: 'cnc', label: 'CNC', color: 'var(--accent)', order: 2 },
      { key: 'bending', label: 'Bending', color: 'var(--blue)', order: 3 },
      { key: 'machining', label: 'Machining', color: '#8b5cf6', order: 4 },
    ],
    tradePositions: [
      { key: 'welder', label: 'Welder', color: 'var(--accent)' },
      { key: 'fitter', label: 'Fitter', color: '#2c6eb3' },
      { key: 'grinder', label: 'Grinder', color: 'var(--green)' },
      { key: 'supervisor', label: 'Supervisor', color: '#8b5cf6' },
    ],
    inspectionTypes: ['Fit-up', 'Welding Visual', 'Dimensional Check', 'NDT',
                       'Painting / Blasting', 'Final Inspection', 'FAT', 'Other'],
    projectCategories: ['Tray', 'Non-Tray'],
    projectLocations: ['Workshop 1', 'Workshop 2'],
    issueCategories: ['Facility Issue', 'Drawing Issue', 'Safety Issue',
                       'Material Issue', 'Equipment Issue', 'Other'],
    terminology: {
      gaNumberLabel: 'GA Number',
      materialProcessingLabel: 'Material Processing',
      wireConsumableLabel: 'Consumable',
    },
  },

  construction: {
    industryTemplate: 'construction',
    processingStages: [
      { key: 'foundation', label: 'Foundation', color: 'var(--green)', order: 1 },
      { key: 'structure', label: 'Structure', color: 'var(--accent)', order: 2 },
      { key: 'mep', label: 'MEP', color: 'var(--blue)', order: 3 },
      { key: 'finishing', label: 'Finishing', color: '#8b5cf6', order: 4 },
    ],
    tradePositions: [
      { key: 'mason', label: 'Mason', color: 'var(--accent)' },
      { key: 'carpenter', label: 'Carpenter', color: '#2c6eb3' },
      { key: 'electrician', label: 'Electrician', color: 'var(--green)' },
      { key: 'plumber', label: 'Plumber', color: '#8b5cf6' },
      { key: 'supervisor', label: 'Supervisor', color: '#f59e0b' },
    ],
    inspectionTypes: ['Structural Inspection', 'MEP Inspection', 'Fire Safety Check',
                       'Waterproofing Check', 'Final Inspection', 'Occupancy Certificate', 'Other'],
    projectCategories: ['Residential', 'Commercial', 'Infrastructure'],
    projectLocations: ['Site A', 'Site B'],
    issueCategories: ['Structural Issue', 'Drawing Issue', 'Safety Issue',
                       'Material Issue', 'Equipment Issue', 'Permit Issue', 'Other'],
    terminology: {
      gaNumberLabel: 'Design Reference',
      materialProcessingLabel: 'Work Stages',
      wireConsumableLabel: 'Consumables',
    },
  },

  it: {
    industryTemplate: 'it',
    processingStages: [
      { key: 'design', label: 'Design', color: 'var(--green)', order: 1 },
      { key: 'development', label: 'Development', color: 'var(--accent)', order: 2 },
      { key: 'testing', label: 'Testing', color: 'var(--blue)', order: 3 },
      { key: 'deployment', label: 'Deployment', color: '#8b5cf6', order: 4 },
    ],
    tradePositions: [
      { key: 'frontend', label: 'Frontend Dev', color: 'var(--accent)' },
      { key: 'backend', label: 'Backend Dev', color: '#2c6eb3' },
      { key: 'qa', label: 'QA Engineer', color: 'var(--green)' },
      { key: 'designer', label: 'Designer', color: '#8b5cf6' },
    ],
    inspectionTypes: ['Code Review', 'QA Testing', 'UAT', 'Security Review',
                       'Performance Review', 'Final Sign-off', 'Other'],
    projectCategories: ['Web', 'Mobile', 'Backend'],
    projectLocations: ['Remote', 'Office'],
    issueCategories: ['Bug', 'Feature Request', 'Technical Debt',
                       'Infrastructure Issue', 'Other'],
    terminology: {
      gaNumberLabel: 'Design Reference',
      materialProcessingLabel: 'Work Stages',
      wireConsumableLabel: 'Resources',
    },
  },

  general: {
    industryTemplate: 'general',
    processingStages: [
      { key: 'planning', label: 'Planning', color: 'var(--green)', order: 1 },
      { key: 'execution', label: 'Execution', color: 'var(--accent)', order: 2 },
      { key: 'review', label: 'Review', color: 'var(--blue)', order: 3 },
    ],
    tradePositions: [
      { key: 'team-member', label: 'Team Member', color: 'var(--accent)' },
      { key: 'supervisor', label: 'Supervisor', color: '#8b5cf6' },
    ],
    inspectionTypes: ['Quality Check', 'Final Review', 'Other'],
    projectCategories: ['Type A', 'Type B'],
    projectLocations: ['Location A', 'Location B'],
    issueCategories: ['General Issue', 'Resource Issue', 'Other'],
    terminology: {
      gaNumberLabel: 'Design Reference',
      materialProcessingLabel: 'Work Stages',
      wireConsumableLabel: 'Consumables',
    },
  },
};

