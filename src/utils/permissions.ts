import { User } from '../types';

export const PERMISSIONS = {
  admin:      { addProject: true, editProject: true, deleteProject: true, addAssembly: true, deleteAssembly: true, addTask: true, deleteTask: true, updateTask: true, manageUsers: true, exportData: true, importData: true, addDifficulty: true, addTaskInline: true, editProjectParams: true },
  manager:    { addProject: true, editProject: true, deleteProject: false, addAssembly: true, deleteAssembly: true, addTask: true, deleteTask: true, updateTask: true, manageUsers: false, exportData: true, importData: false, addDifficulty: true, addTaskInline: true, editProjectParams: true },
  coordinator: { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: true, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: true, addTaskInline: true, editProjectParams: false },
  viewer:     { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: false, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false },
  // Firestore-compat: intentional legacy spelling, do not change
  'facility maintanance': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false },
  'quality control': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false },
  'safety': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: false, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: false, addTaskInline: false, editProjectParams: false },
  'project control': { addProject: false, editProject: false, deleteProject: false, addAssembly: false, deleteAssembly: false, addTask: true, deleteTask: false, updateTask: true, manageUsers: false, exportData: false, importData: false, addDifficulty: true, addTaskInline: true, editProjectParams: false }
};

export function can(currentUser: User | null, perm: keyof typeof PERMISSIONS.admin): boolean {
  if (!currentUser) return false;
  if (currentUser.allowedPermissions && currentUser.allowedPermissions[perm] !== undefined) {
    return !!currentUser.allowedPermissions[perm];
  }
  const role = currentUser.role as keyof typeof PERMISSIONS;
  return !!PERMISSIONS[role]?.[perm];
}
