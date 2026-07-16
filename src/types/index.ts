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

export type ProjectCategoryType = ProjectCategory | 'tray' | 'nontray';

export enum ProjectLocation {
  Workshop1 = 'workshop1',
  Workshop2 = 'workshop2'
}

export type ProjectLocationType = ProjectLocation | 'workshop1' | 'workshop2';

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
}

export interface Task {
  id: string;
  name: string;
  assigned?: string;
  difficulty?: number;
  pct: number;
  done: boolean;
  date?: string;
  finishDate?: string;
  predecessors?: Dependency[];
  successors?: Dependency[];
  isMilestone?: boolean;
  baselineDate?: string;      // tanggal start baseline (YYYY-MM-DD)
  baselineFinish?: string;    // tanggal finish baseline (YYYY-MM-DD)
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
  baselineStart?: string;
  baselineFinish?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
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
  baselineStart?: string;
  baselineDue?: string;
  baselineSetAt?: string;     // timestamp kapan baseline di-set
  materialProcessing?: MaterialProcessing[];
  priority?: 'low' | 'medium' | 'high';
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
  category: 'Facility Issue' | 'Drawing Issue' | 'Safety Issue' | 'Material Issue' | 'Equipment Issue' | 'Other';
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
  inspectionType: 'Fit-up' | 'Welding Visual' | 'Dimensional Check' | 'NDT' | 'Painting / Blasting' | 'Final Inspection' | 'FAT' | 'Other';
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
  | 'Raw Material'
  | 'PPE'
  | 'Tools & Equipment'
  | 'Paint & Chemical'
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
}

// ─── MATERIAL PROCESSING ──────────────────────────────────────────────────

export type ProcessingStageKey = 'nesting' | 'cnc' | 'bending' | 'machining';

export type ProcessingStatus = 'pending' | 'in-progress' | 'done' | 'skipped';

export interface ProcessingStage {
  pct:        number;           // 0–100
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
  thickness?:   string;         // e.g. "6mm", "10mm"
  material?:    string;         // e.g. "SS304", "CS A36", "Aluminium"
  qty:          number;         // quantity of pieces/sheets
  unit:         string;         // "pcs", "sheet", "kg"

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
  category: 'material' | 'partNo' | 'client' | 'subAssembly' | 'gaNumber';
  value: string;                 // nilai asli, contoh: "Plate SS304 6mm"
  normalizedValue: string;       // value.trim().toLowerCase(), untuk deteksi duplikat
  gaNumber?: string;             // opsional, kalau entry ini terkait GA Number tertentu (khusus category material)
  usageCount: number;            // berapa kali dipakai
  lastUsedAt: string;            // ISO date
  createdAt: string;             // ISO date
  createdBy?: string;            // nama/id user yang pertama input
}

