import { User } from '../types';

export const PERMISSIONS = {
  admin:      { addProject: true, editProject: true, deleteProject: true, addAssembly: true, deleteAssembly: true, addTask: true, deleteTask: true, updateTask: true, manageUsers: true, exportData: true, importData: true, addDifficulty: true, addTaskInline: true, editProjectParams: true, requestInspection: true, approveInspection: true, deleteInspection: true, manageMaterials: true, requestMaterial: true, issueMaterial: true, manageEmployees: true, deleteEmployee: true, manageTimesheet: true, deleteTimesheet: true, manageWireLog: true, deleteWireLog: true, editGanttSchedule: true, manageManpowerBoard: true, manageMasterData: true, manageBom: true },
  manager:    { addProject: true, editProject: true, deleteProject: false, addAssembly: true, deleteAssembly: true, addTask: true, deleteTask: true, updateTask: true, manageUsers: false, exportData: true, importData: false, addDifficulty: true, addTaskInline: true, editProjectParams: true, requestInspection: true, approveInspection: true, deleteInspection: false, manageMaterials: true, requestMaterial: true, issueMaterial: true, manageEmployees: true, deleteEmployee: false, manageTimesheet: true, deleteTimesheet: true, manageWireLog: true, deleteWireLog: true, editGanttSchedule: true, manageManpowerBoard: true, manageMasterData: true, manageBom: true },
  coordinator: { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: true, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: true, addTaskInline: true, editProjectParams: false, requestInspection: true, approveInspection: false, deleteInspection: false, manageMaterials: false, requestMaterial: true, issueMaterial: false, manageEmployees: false, deleteEmployee: false, manageTimesheet: true, deleteTimesheet: false, manageWireLog: true, deleteWireLog: false, editGanttSchedule: false, manageManpowerBoard: false, manageMasterData: false, manageBom: false },
  viewer:     { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: false, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false, requestInspection: false, approveInspection: false, deleteInspection: false, manageMaterials: false, requestMaterial: false, issueMaterial: false, manageEmployees: false, deleteEmployee: false, manageTimesheet: false, deleteTimesheet: false, manageWireLog: false, deleteWireLog: false, editGanttSchedule: false, manageManpowerBoard: false, manageMasterData: false, manageBom: false },
  // Firestore-compat: intentional legacy spelling, do not change
  'facility maintanance': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false, requestInspection: false, approveInspection: false, deleteInspection: false, manageMaterials: false, requestMaterial: true, issueMaterial: false, manageEmployees: false, deleteEmployee: false, manageTimesheet: false, deleteTimesheet: false, manageWireLog: false, deleteWireLog: false, editGanttSchedule: false, manageManpowerBoard: false, manageMasterData: false, manageBom: false },
  'quality control': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false, requestInspection: false, approveInspection: true, deleteInspection: false, manageMaterials: false, requestMaterial: true, issueMaterial: false, manageEmployees: false, deleteEmployee: false, manageTimesheet: false, deleteTimesheet: false, manageWireLog: false, deleteWireLog: false, editGanttSchedule: false, manageManpowerBoard: false, manageMasterData: false, manageBom: false },
  'safety': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false, requestInspection: false, approveInspection: false, deleteInspection: false, manageMaterials: false, requestMaterial: true, issueMaterial: false, manageEmployees: false, deleteEmployee: false, manageTimesheet: false, deleteTimesheet: false, manageWireLog: false, deleteWireLog: false, editGanttSchedule: false, manageManpowerBoard: false, manageMasterData: false, manageBom: false },
  'project control': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: true, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: true, addTaskInline: true, editProjectParams: false, requestInspection: true, approveInspection: false, deleteInspection: false, manageMaterials: false, requestMaterial: true, issueMaterial: false, manageEmployees: false, deleteEmployee: false, manageTimesheet: false, deleteTimesheet: false, manageWireLog: false, deleteWireLog: false, editGanttSchedule: false, manageManpowerBoard: false, manageMasterData: false, manageBom: true }
};

export function can(currentUser: User | null, perm: keyof typeof PERMISSIONS.admin): boolean {
  if (!currentUser) return false;
  if (currentUser.allowedPermissions && currentUser.allowedPermissions[perm] !== undefined) {
    return !!currentUser.allowedPermissions[perm];
  }
  const role = currentUser.role as keyof typeof PERMISSIONS;
  return !!PERMISSIONS[role]?.[perm];
}

/**
 * Resolves default landing tab for a given user role upon login/session initialization.
 * - admin / manager / project control → 'dash'
 * - coordinator → 'shopfloor'
 * - quality control → 'inspections'
 * - viewer → 'dash'
 * - facility / safety → 'dash'
 */
export function getDefaultLandingTabForRole(role?: string, allowedFeatures?: string[]): string {
  let target = 'dash';
  if (role) {
    const normalizedRole = role.toLowerCase().trim();
    switch (normalizedRole) {
      case 'coordinator':
        target = 'shopfloor';
        break;
      case 'quality control':
      case 'qc':
        target = 'inspections';
        break;
      case 'admin':
      case 'manager':
      case 'project control':
      case 'viewer':
      case 'facility maintanance':
      case 'facility maintenance':
      case 'safety':
      default:
        target = 'dash';
        break;
    }
  }

  // If user has custom allowedFeatures restrictions, ensure target tab is accessible
  if (allowedFeatures && allowedFeatures.length > 0) {
    if (!allowedFeatures.includes(target)) {
      target = allowedFeatures[0] || 'dash';
    }
  }

  return target;
}
