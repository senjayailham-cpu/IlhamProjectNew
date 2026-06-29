import { Project, Assembly, Task, User, TimesheetEntry, UserRole, ProjectStatus, ProjectCategory, ProjectLocation, TimesheetStatus } from '../types';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-' + Math.random().toString(36).substr(2, 9),
    name: 'Sample Task',
    pct: 0,
    done: false,
    difficulty: 1,
    ...overrides
  };
}

export function makeAssembly(overrides: Partial<Assembly> = {}): Assembly {
  return {
    id: 'assembly-' + Math.random().toString(36).substr(2, 9),
    name: 'Sample Assembly',
    tasks: [],
    ...overrides
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-' + Math.random().toString(36).substr(2, 9),
    name: 'Sample Project',
    client: 'Sample Client',
    status: ProjectStatus.Active,
    category: ProjectCategory.Tray,
    location: ProjectLocation.Workshop1,
    created: new Date().toISOString(),
    assemblies: [],
    ...overrides
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    name: 'Sample User',
    role: UserRole.Viewer,
    ...overrides
  };
}

export function makeTimesheetEntry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: 'ts-' + Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString().slice(0, 10),
    empId: 'emp-1',
    empName: 'John Doe',
    totalHours: 8,
    status: TimesheetStatus.Present,
    ...overrides
  };
}
