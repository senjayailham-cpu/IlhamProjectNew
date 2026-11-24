import React from 'react';
import UsersAccessView from '../components/UsersAccessView';
import { User, UserRoleType } from '../types';
import { PERMISSIONS } from '../utils/permissions';
import { sha256 } from '../utils/helpers';

const activeTabsList = [
  { id: 'dash', label: 'Dashboard', icon: 'LayoutGrid', access: 'all' },
  { id: 'projects', label: 'Projects', icon: 'Folder', access: 'all' },
  { id: 'schedule', label: 'Schedule & Risk', icon: 'Calendar', access: ['admin', 'manager', 'project control', 'coordinator', 'quality control', 'viewer'] },
  { id: 'shopfloor', label: 'Shop Floor', icon: 'Factory', access: ['admin', 'manager', 'coordinator', 'project control', 'quality control', 'facility maintanance', 'safety'] },
  { id: 'timesheet', label: 'Manpower & Timesheet', icon: 'Clock', access: ['admin', 'manager', 'coordinator', 'project control'] },
  { id: 'matprocessing', label: 'Mat. Processing', icon: 'Layers', access: ['admin', 'manager', 'coordinator', 'project control', 'quality control'] },
  { id: 'materials', label: 'Warehouse & Consumables', icon: 'Package', access: ['admin', 'manager', 'coordinator', 'project control', 'quality control', 'facility maintanance', 'safety'] },
  { id: 'inspections', label: 'QC Inspection', icon: 'ClipboardCheck', access: ['admin', 'manager', 'coordinator', 'project control', 'quality control'] },
  { id: 'drawings', label: 'Drawing Register', icon: 'FileBadge', access: ['admin', 'manager', 'project control', 'quality control', 'coordinator', 'viewer'] },
  { id: 'bom', label: 'BOM', icon: 'ListTree', access: ['admin', 'manager', 'project control', 'coordinator'] },
  { id: 'dailyreport', label: 'Daily Report', icon: 'FileText', access: ['admin', 'manager', 'project control'] },
  { id: 'employees', label: 'Employees', icon: 'Users', access: ['admin', 'manager'] },
  { id: 'masterdata', label: 'Master Data', icon: 'Database', access: ['admin', 'manager'] },
  { id: 'users', label: 'Users & Access', icon: 'ShieldCheck', access: ['admin'] },
  { id: 'orgsettings', label: 'Settings', icon: 'Settings', access: ['admin'] }
];

const sectionGroups = [
  {
    title: 'Overview',
    items: ['dash', 'projects', 'schedule']
  },
  {
    title: 'Shop Floor',
    items: ['shopfloor', 'timesheet', 'matprocessing', 'materials', 'inspections']
  },
  {
    title: 'Engineering',
    items: ['drawings', 'bom']
  },
  {
    title: 'Admin & Reports',
    items: ['dailyreport', 'employees', 'masterdata', 'users', 'orgsettings']
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
