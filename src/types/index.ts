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
  FacilityMaintanance = 'facility maintanance',
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
}

export interface Employee {
  id: string;
  name: string;
  position?: string;
  location?: string;
  coordinator?: string;
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
