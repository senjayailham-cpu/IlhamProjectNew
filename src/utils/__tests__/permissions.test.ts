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

  it('unknown role returns false safely', () => {
    const userWithInvalidRole = makeUser({ role: 'unknown_role' as any });
    expect(can(userWithInvalidRole, 'addProject')).toBe(false);
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

  it('returns "manpower" for coordinator', () => {
    expect(getDefaultLandingTabForRole('coordinator')).toBe('manpower');
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
