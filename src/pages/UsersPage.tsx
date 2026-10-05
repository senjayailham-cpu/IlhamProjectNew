import React from 'react';
import UsersAccessView from '../components/UsersAccessView';
import { User, UserRoleType } from '../types';
import { PERMISSIONS } from '../utils/permissions';
import { sha256 } from '../utils/helpers';

const activeTabsList = [
  { id: 'dash', label: 'Dashboard', icon: 'LayoutGrid', access: 'all' },
  { id: 'shopfloor', label: 'Shop Floor', icon: 'Factory', access: ['admin', 'coordinator'] },
  { id: 'projects', label: 'Projects', icon: 'Folder', access: 'all' },
  { id: 'schedule', label: 'Schedule', icon: 'Calendar', access: 'all' },
  { id: 'progress', label: 'Update Progress', icon: 'TrendingUp', access: 'all' },
  { id: 'timesheet', label: 'Timesheet', icon: 'Clock', access: 'all' },
  { id: 'manpower', label: 'Manpower Board', icon: 'LayoutGrid', access: 'all' },
  { id: 'matprocessing', label: 'Mat. Processing', icon: 'Layers', access: 'all' },
  { id: 'materials', label: 'Materials', icon: 'Package', access: 'all' },
  { id: 'inspections', label: 'QC Inspection', icon: 'ClipboardCheck', access: 'all' },
  { id: 'drawings', label: 'Drawing Register', icon: 'FileBadge', access: 'all' },
  { id: 'bom', label: 'BOM', icon: 'ListTree', access: 'all' },
  { id: 'consumable', label: 'Consumable', icon: 'Flame', access: 'all' },
  { id: 'dailyreport', label: 'Daily Report', icon: 'FileText', access: ['admin', 'manager'] },
  { id: 'employees', label: 'Employees', icon: 'Users', access: 'all' },
  { id: 'users', label: 'Users & Access', icon: 'ShieldCheck', access: ['admin'] },
  { id: 'masterdata', label: 'Master Data', icon: 'Database', access: ['admin', 'manager'] },
  { id: 'orgsettings', label: 'Settings', icon: 'Settings', access: ['admin'] }
];

const sectionGroups = [
  {
    title: 'Overview',
    items: ['dash', 'projects', 'schedule', 'progress']
  },
  {
    title: 'Shop Floor',
    items: ['shopfloor', 'timesheet', 'manpower', 'matprocessing', 'materials', 'inspections']
  },
  {
    title: 'Engineering',
    items: ['drawings', 'bom', 'consumable']
  },
  {
    title: 'Admin',
    items: ['dailyreport', 'employees', 'users', 'masterdata', 'orgsettings']
  }
];

interface UsersPageProps {
  users: User[];
  currentUser: User | null;
  onUpdateUsers: (u: User[]) => void;
}

export function UsersPage({
  users,
  currentUser,
  onUpdateUsers
}: UsersPageProps) {
  return (
    <UsersAccessView
      users={users}
      currentUser={currentUser}
      onUpdateUsers={onUpdateUsers}
      activeTabsList={activeTabsList}
      defaultPermissions={PERMISSIONS}
      sha256={sha256}
      sectionGroups={sectionGroups}
    />
  );
}

export default UsersPage;
