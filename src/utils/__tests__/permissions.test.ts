import { describe, it, expect } from 'vitest';
import { can } from '../permissions';
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
