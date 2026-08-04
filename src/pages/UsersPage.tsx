import React from 'react';
import UsersAccessView from '../components/UsersAccessView';
import { User, UserRoleType } from '../types';
import { PERMISSIONS } from '../utils/permissions';
import { sha256 } from '../utils/helpers';

const activeTabsList = [
  { id: 'dash', label: 'Dashboard', icon: 'LayoutGrid', access: 'all' },
  { id: 'focus24', label: '24 Hours Focus', icon: 'AlertTriangle', access: 'all' },
  { id: 'current', label: 'Current Projects', icon: 'Folder', access: 'all' },
  { id: 'completed', label: 'Project Complete', icon: 'CheckCircle', access: 'all' },
  { id: 'archive', label: 'Archive', icon: 'Archive', access: 'all' },
  { id: 'tray', label: 'Project Tray', icon: 'Folder', access: 'all' },
  { id: 'nontray', label: 'Project Non-Tray', icon: 'Folder', access: 'all' },
  { id: 'inspections', label: 'QC Inspection', icon: 'ClipboardCheck', access: 'all' },
  { id: 'wire', label: 'Consumable', icon: 'Flame', access: 'all' },
  { id: 'dailyreport', label: 'Daily Report', icon: 'FileText', access: ['admin', 'manager'] },
  { id: 'employees', label: 'Employees', icon: 'Users', access: 'all' },
  { id: 'timesheet', label: 'Timesheet', icon: 'Clock', access: 'all' },
  { id: 'users', label: 'Users & Access', icon: 'ShieldCheck', access: ['admin'] }
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
    />
  );
}

export default UsersPage;
