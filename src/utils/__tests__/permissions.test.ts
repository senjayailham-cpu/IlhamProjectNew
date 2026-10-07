import { describe, it, expect } from 'vitest';
import { can, getDefaultLandingTabForRole } from '../permissions';
import { makeUser } from '../../test/factories';
import { UserRole } from '../../types';

describe('permissions - can', () => {
  it('returns false for null user', () => {
    expect(can(null, 'addProject')).toBe(false);
  });

  it('admin can do everything (all permissions = true)', () => {
    const adminUser = makeUser({ role: UserRole.Admin });
    expect(can(adminUser, 'addProject')).toBe(true);
    expect(can(adminUser, 'deleteProject')).toBe(true);
    expect(can(adminUser, 'manageUsers')).toBe(true);
  });

  it('viewer cannot do anything modifying', () => {
    const viewerUser = makeUser({ role: UserRole.Viewer });
    expect(can(viewerUser, 'addProject')).toBe(false);
    expect(can(viewerUser, 'deleteProject')).toBe(false);
    expect(can(viewerUser, 'updateTask')).toBe(false);
  });

  it('coordinator can updateTask but not addProject', () => {
    const coordinatorUser = makeUser({ role: UserRole.Coordinator });
    expect(can(coordinatorUser, 'updateTask')).toBe(true);
    expect(can(coordinatorUser, 'addProject')).toBe(false);
    expect(can(coordinatorUser, 'deleteProject')).toBe(false);
  });

  it('custom allowedPermissions override role defaults', () => {
    // Coordinator normally can't addProject
    const customUser = makeUser({
      role: UserRole.Coordinator,
      allowedPermissions: {
        addProject: true,
        updateTask: false // normally true, custom override to false
      }
    });
    expect(can(customUser, 'addProject')).toBe(true);
    expect(can(customUser, 'updateTask')).toBe(false);
  });

  it('only admin has permission to delete anything', () => {
    const adminUser = makeUser({ role: UserRole.Admin });
    const managerUser = makeUser({ role: UserRole.Manager });
    const coordinatorUser = makeUser({ role: UserRole.Coordinator });
    const viewerUser = makeUser({ role: UserRole.Viewer });
    const qcUser = makeUser({ role: UserRole.QualityControl });

    // Admin can delete
    expect(can(adminUser, 'deleteProject')).toBe(true);
    expect(can(adminUser, 'deleteAssembly')).toBe(true);
    expect(can(adminUser, 'deleteTask')).toBe(true);
    expect(can(adminUser, 'deleteEmployee')).toBe(true);
    expect(can(adminUser, 'deleteTimesheet')).toBe(true);
    expect(can(adminUser, 'deleteWireLog')).toBe(true);
    expect(can(adminUser, 'deleteInspection')).toBe(true);

    // Non-admin roles CANNOT delete anything
    expect(can(managerUser, 'deleteProject')).toBe(false);
    expect(can(managerUser, 'deleteAssembly')).toBe(false);
    expect(can(managerUser, 'deleteTask')).toBe(false);
    expect(can(managerUser, 'deleteEmployee')).toBe(false);
    expect(can(managerUser, 'deleteTimesheet')).toBe(false);
    expect(can(managerUser, 'deleteWireLog')).toBe(false);
    expect(can(managerUser, 'deleteInspection')).toBe(false);

    expect(can(coordinatorUser, 'deleteProject')).toBe(false);
    expect(can(coordinatorUser, 'deleteTask')).toBe(false);
    expect(can(viewerUser, 'deleteProject')).toBe(false);
    expect(can(qcUser, 'deleteInspection')).toBe(false);

    // Even if non-admin has custom allowedPermissions with delete, strictly denied
    const sneakyUser = makeUser({
      role: UserRole.Manager,
      allowedPermissions: { deleteProject: true, deleteTask: true }
    });
    expect(can(sneakyUser, 'deleteProject')).toBe(false);
    expect(can(sneakyUser, 'deleteTask')).toBe(false);
  });
});

describe('getDefaultLandingTabForRole', () => {
  it('returns "dash" for admin, manager, project control, viewer, facility, safety', () => {
    expect(getDefaultLandingTabForRole('admin')).toBe('dash');
    expect(getDefaultLandingTabForRole('manager')).toBe('dash');
    expect(getDefaultLandingTabForRole('project control')).toBe('dash');
    expect(getDefaultLandingTabForRole('viewer')).toBe('dash');
    expect(getDefaultLandingTabForRole('facility maintanance')).toBe('dash');
    expect(getDefaultLandingTabForRole('safety')).toBe('dash');
  });

  it('returns "shopfloor" for coordinator', () => {
    expect(getDefaultLandingTabForRole('coordinator')).toBe('shopfloor');
  });

  it('returns "inspections" for quality control', () => {
    expect(getDefaultLandingTabForRole('quality control')).toBe('inspections');
    expect(getDefaultLandingTabForRole('qc')).toBe('inspections');
  });

  it('falls back to custom allowedFeatures if default is not in allowedFeatures', () => {
    expect(getDefaultLandingTabForRole('coordinator', ['timesheet', 'drawings'])).toBe('timesheet');
  });

  it('returns "dash" for undefined role', () => {
    expect(getDefaultLandingTabForRole()).toBe('dash');
  });
});
