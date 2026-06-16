/**
 * ============================================================================
 * TYPE DEFINITIONS & SCHEMAS FOR AUSTIN BATAM PROJECT & MANPOWER PORTAL
 * ============================================================================
 * 
 * This file declares standard, strict, and robust TypeScript types, interfaces,
 * and enums used across the application. 
 * 
 * To ensure absolute backward compatibility and avoid casting overhead throughout
 * the frontend components, enums are complemented with explicit union types of
 * string literals.
 */

// ============================================================================
// 1. ENUMERATED TYPES (STANDARD STRINGS)
// ============================================================================

/**
 * Port Authorized User Security Roles.
 * Maps authorization privileges from read-only viewers to full administrator access.
 */
export enum UserRole {
  Admin = 'admin',
  Manager = 'manager',
  Technician = 'technician',
  Viewer = 'viewer',
  FacilityMaintanance = 'facility maintanance',
  QualityControl = 'quality control',
  Safety = 'safety',
  ProjectControl = 'project control'
}

/**
 * Helper Union Type covering UserRole enum values or direct matching string literals.
 */
export type UserRoleType = UserRole | 'admin' | 'manager' | 'technician' | 'viewer' | 'facility maintanance' | 'quality control' | 'safety' | 'project control';


/**
 * Core Status constraints for Projects and Work Orders.
 */
export enum ProjectStatus {
  Active = 'active',
  Pending = 'pending',
  Completed = 'completed',
  OnHold = 'on-hold'
}

/**
 * Helper Union Type covering ProjectStatus enum values or direct matching string literals.
 */
export type ProjectStatusType = ProjectStatus | 'active' | 'pending' | 'completed' | 'on-hold';


/**
 * Project Categories.
 * Tray indicates tray/cabling-specific works, Non-Tray covers custom mechanical panels, structures, and PLCs.
 */
export enum ProjectCategory {
  Tray = 'tray',
  NonTray = 'nontray'
}

/**
 * Helper Union Type covering ProjectCategory enum values or direct matching string literals.
 */
export type ProjectCategoryType = ProjectCategory | 'tray' | 'nontray';


/**
 * Physical Yard/Workshop Locations.
 */
export enum ProjectLocation {
  Workshop1 = 'workshop1',
  Workshop2 = 'workshop2'
}

/**
 * Helper Union Type covering ProjectLocation enum values or direct matching string literals.
 */
export type ProjectLocationType = ProjectLocation | 'workshop1' | 'workshop2';


/**
 * Daily Labor Attendance and Shift Status.
 */
export enum TimesheetStatus {
  Present = 'present',
  Late = 'late',
  Absent = 'absent',
  Leave = 'leave'
}

/**
 * Helper Union Type covering TimesheetStatus enum values or direct matching string literals.
 */
export type TimesheetStatusType = TimesheetStatus | 'present' | 'late' | 'absent' | 'leave';


/**
 * Audit Trail Logging Categories for User Activities.
 */
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

/**
 * Helper Union Type covering ActivityLogType enum values or direct matching string literals.
 */
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

/**
 * Fully authenticated portal user profile, supporting secure password verification.
 */
export interface User {
  /**
   * Unique alphanumeric identifier used to sign in to the platform.
   */
  id: string;

  /**
   * Full descriptive profile name of the logged-in personnel.
   */
  name: string;

  /**
   * Security role specifying feature operations and visual dashboards bounds.
   */
  role: UserRoleType;

  /**
   * Optional clear text password during user modification profiles payload.
   */
  password?: string;

  /**
   * Secure cryptographic SHA-256 hash representation of the password credential.
   */
  passHash?: string;

  /**
   * Optional custom menu features keys that this user is explicitly allowed to view.
   */
  allowedFeatures?: string[];

  /**
   * Optional dynamic action rules overrides that toggle individual controls state.
   */
  allowedPermissions?: Record<string, boolean>;
}

/**
 * Specific granular task node located inside a Sub-Assembly block.
 */
export interface Task {
  /**
   * Unique identifier of the task node.
   */
  id: string;

  /**
   * Clear instruction description of what tasks are required (e.g. "Cut columns and plates").
   */
  name: string;

  /**
   * Assigned personnel name handling the installation or welding of this element.
   */
  assigned: string;

  /**
   * Completion score slider scale percentage, from 0 to 100.
   */
  pct: number;

  /**
   * Quick status boolean for task completion. Setting pct to 100 sets done to true.
   */
  done: boolean;

  /**
   * Optional date (due date) assigned to this specific task, formatted as YYYY-MM-DD.
   */
  date?: string;

  /**
   * Optional completion or target finish date assigned to this task, formatted as YYYY-MM-DD.
   */
  finishDate?: string;
}

/**
 * Relationship link modeling task dependencies in the Gantt layout or schedule tree.
 */
export interface Dependency {
  /**
   * Identifier of the target predecessor or successor task, e.g. "p:id" or "a:pid:aid".
   */
  key: string;

  /**
   * Standard relationship constraint type:
   * - FS: Finish-to-Start (predecessor finishes, then successor start)
   * - SS: Start-to-Start (predecessor starts, then successor start)
   * - FF: Finish-to-Finish (predecessor finishes, then successor finish)
   * - SF: Start-to-Finish (predecessor starts, then successor finish)
   */
  type: 'FS' | 'SS' | 'FF' | 'SF';

  /**
   * Optional lead/lag offset factor expressed in working calendar days.
   */
  lag?: number;
}

/**
 * Intermediate Sub-Assembly grouping list of physical tasks, with timelines.
 */
export interface Assembly {
  /**
   * Unique identifier of the sub-assembly block.
   */
  id: string;

  /**
   * Name label describing this block of works.
   */
  name: string;

  /**
   * Informative optional field for sub-assembly remarks or instructions.
   */
  notes?: string;

  /**
   * Planned starting schedule formatted as YYYY-MM-DD.
   */
  start?: string;

  /**
   * Planned ending schedule formatted as YYYY-MM-DD.
   */
  finish?: string;

  /**
   * List of specific granular task records belonging to this sub-assembly.
   */
  tasks: Task[];

  /**
   * Optional budgeted man-hours allowed for this sub-assembly.
   */
  budgetHours?: number;

  /**
   * List of links pointing to predecessor items this sub-assembly depends on.
   */
  predecessors?: Dependency[];

  /**
   * List of links pointing to successor items dependent on this sub-assembly.
   */
  successors?: Dependency[];
}

/**
 * Comprehensive top-level Project record tracking a Work Order.
 */
export interface Project {
  /**
   * Unique identifier of the project.
   */
  id: string;

  /**
   * Human readable description name of the structural project.
   */
  name: string;

  /**
   * Associated unique Work Order number (e.g. "WO-2026-001"), used for database lookups and timesheet mapping.
   */
  client: string;

  /**
   * Physical fabrication starting date formatted as YYYY-MM-DD.
   */
  start?: string;

  /**
   * Structural deadline date formatted as YYYY-MM-DD.
   */
  due?: string;

  /**
   * Active tracking status of the project workflow.
   */
  status: ProjectStatusType;

  /**
   * Workspace category distinguishing Tray vs. Non-Tray projects.
   */
  category: ProjectCategoryType;

  /**
   * Location of fabrication workspace.
   */
  location: ProjectLocationType;

  /**
   * Date the project was initially created formatted as YYYY-MM-DD.
   */
  created: string;

  /**
   * Group of Sub-Assembly modules inside the project.
   */
  assemblies: Assembly[];

  /**
   * Timestamp record of when the project status was checked as 'completed'. Formatted as YYYY-MM-DD.
   */
  completedDate?: string | null;

  /**
   * Overall comments, design guidelines, or logistics notes.
   */
  notes?: string;

  /**
   * List of project-level predecessor dependencies.
   */
  predecessors?: Dependency[];

  /**
   * List of project-level successor dependencies.
   */
  successors?: Dependency[];

  /**
   * General budgeted man-hours allowed for executing this project details.
   */
  budgetHours?: number;

  /**
   * Flag indicating whether the project has been archived for clean workspace reasons.
   */
  isArchived?: boolean;
}

/**
 * Worker / Craftsman profile logged in the personnel list.
 */
export interface Employee {
  /**
   * Unique identifier of the personnel.
   */
  id: string;

  /**
   * Full descriptive profile name of the employee.
   */
  name: string;

  /**
   * Designation or engineering craft (e.g., "Welder Class 1", "Fitter", "HSE Supervisor").
   */
  position?: string;

  /**
   * Primary assigned field site or yard workshop location.
   */
  location?: string;

  /**
   * Name of supervising coordinator or manager.
   */
  coordinator?: string;
}

/**
 * Daily timesheet check log record.
 */
export interface TimesheetEntry {
  /**
   * Unique identifier of the timesheet entry row.
   */
  id: string;

  /**
   * Calendar logging date mapped to this shift check, formatted as YYYY-MM-DD.
   */
  date: string;

  /**
   * Associated Employee record identifier.
   */
  empId: string;

  /**
   * Denormalized name of the employee to speed up list lookups and filtering.
   */
  empName: string;

  /**
   * Optional mapped Work Order number linking this entry to a primary Project.
   */
  workOrder?: string;

  /**
   * Optional mapped Sub-Assembly ID where specific craft hours were spent.
   */
  assemblyId?: string;

  /**
   * Denormalized sub-assembly title for reporting purposes.
   */
  assemblyName?: string;

  /**
   * Total number of working/overtime hours logged on this shift (e.g. 8.0, 10.0h).
   */
  totalHours: number;

  /**
   * Attendance index for this day.
   */
  status: TimesheetStatusType;

  /**
   * Detailed work card logs or progress descriptions.
   */
  desc?: string;
}

/**
 * Problem report record logged in the 24 Hours Focus dashboard.
 */
export interface ProblemReport {
  id: string;
  projectId?: string;
  projectName?: string;
  category: 'Facility Issue' | 'Drawing Issue' | 'Safety Issue' | 'Material Issue' | 'Equipment Issue' | 'Other';
  description: string;
  assignedPosition: string; // Intended target position (e.g., "Supervisor", "HSE", etc.)
  reportedBy: string;
  date: string; // YYYY-MM-DD
  status: 'Open' | 'Resolved';
  photo?: string; // Base64 image data url or image asset URL
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

/**
 * Request For Inspection (RFI) model.
 */
export interface InspectionRequest {
  id: string;
  rfiNo: string; // e.g. RFI-2026-001
  projectId: string;
  projectName: string;
  assemblyId?: string;
  assemblyName?: string;
  inspectionType: 'Fit-up' | 'Welding Visual' | 'Dimensional Check' | 'NDT' | 'Painting / Blasting' | 'Final Inspection' | 'FAT' | 'Other';
  status: 'Draft' | 'Requested' | 'Approved' | 'Rejected / Punchlist';
  requestedBy: string; // User Display Name
  requestedById: string; // User ID
  requestedDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
  assignedInspector?: string; // QC Inspector name
  comments?: string; // QC comments
  rcomments?: string; // Requestor comments / description
  punchList?: string; // Punch points list
  inspectedDate?: string; // YYYY-MM-DD
  inspectedBy?: string; // QC Inspector name
}

/**
 * Immutable audit trail item documenting operations.
 */
export interface ActivityLog {
  /**
   * Unique identifier of the action entry.
   */
  id: string;

  /**
   * High-precision ISO timestamp string of the occurrence.
   */
  ts: string;

  /**
   * Quick-index date in YYYY-MM-DD format.
   */
  date: string;

  /**
   * Human-readable wall-clock offset value formatted as "HH:MM AM/PM".
   */
  time: string;

  /**
   * User identifier who performed the action.
   */
  userId: string;

  /**
   * Display name of the active user.
   */
  userName: string;

  /**
   * High-level security role of the active user.
   */
  userRole: UserRoleType;

  /**
   * Broad action category classifying the log event.
   */
  type: ActivityLogTypeVal;

  /**
   * Human-readable concise single sentence describing what changed in detail.
   */
  action: string;

  /**
   * Optional target project identifier affected by this event.
   */
  projectId?: string;

  /**
   * Denormalized project title.
   */
  projectName?: string;

  /**
   * Denormalized affected subassembly title.
   */
  assemblyName?: string;

  /**
   * Denormalized target task description.
   */
  taskName?: string;

  /**
   * For numeric records (like task percent completion), original score.
   */
  oldPct?: number;

  /**
   * For numeric records (like task percent completion), updated score.
   */
  newPct?: number;

  /**
   * Optional lengthy secondary context remarks.
   */
  detail?: string;
}


// ============================================================================
// 3. AUXILIARY / INTERACTIVE SYSTEM INTERFACES
// ============================================================================

/**
 * Key Performance indicators (KPI) compiled dynamically for the Dashboard view.
 */
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

/**
 * Represents structured tabular data compiled for Excel export.
 */
export interface BulkExportDataset {
  sheetName: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
}
