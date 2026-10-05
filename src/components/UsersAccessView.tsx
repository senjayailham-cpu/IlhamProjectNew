import React, { useState, useMemo } from 'react';
import { User, UserRoleType } from '../types';
import { 
  Users, 
  Shield, 
  Plus, 
  Trash2, 
  Key, 
  HelpCircle, 
  Check, 
  RefreshCw, 
  Search, 
  Power, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  UserCheck, 
  Lock,
  Compass,
  AlertTriangle,
  History,
  LayoutGrid,
  Folder,
  Calendar,
  TrendingUp,
  Clock,
  Layers,
  Package,
  ClipboardCheck,
  FileBadge,
  ListTree,
  Flame,
  FileText,
  ShieldCheck,
  Database,
  Settings,
  Factory,
  CheckSquare,
  Square,
  Filter,
  ChevronDown,
  ChevronRight,
  Eye,
  RotateCcw
} from 'lucide-react';
import UserSessionAuditView from './users/UserSessionAuditView';

const TabIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dash: LayoutGrid,
  projects: Folder,
  schedule: Calendar,
  progress: TrendingUp,
  shopfloor: Factory,
  timesheet: Clock,
  manpower: LayoutGrid,
  matprocessing: Layers,
  materials: Package,
  inspections: ClipboardCheck,
  drawings: FileBadge,
  bom: ListTree,
  consumable: Flame,
  dailyreport: FileText,
  employees: Users,
  users: ShieldCheck,
  masterdata: Database,
  orgsettings: Settings,
};

const defaultSectionGroups = [
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

interface UsersAccessViewProps {
  users: User[];
  currentUser: User | null;
  onUpdateUsers: (updatedUsers: User[]) => void;
  activeTabsList: { id: string; label: string; icon: string; access: any }[];
  defaultPermissions: Record<string, Record<string, boolean>>;
  sha256: (str: string) => Promise<string>;
  sectionGroups?: { title: string; items: string[] }[];
}

export interface PermissionMetaItem {
  id: string;
  label: string;
  desc: string;
  category: string;
  relatedTab: string;
}

const permissionCategories = [
  'Projects & Tasks',
  'Schedule & Progress',
  'Shop Floor, Timesheet & Manpower',
  'Materials & Processing',
  'Quality Control (QC)',
  'Engineering & Drawings',
  'Admin & Master Data'
];

const permissionMeta: PermissionMetaItem[] = [
  // 1. Projects & Tasks
  { id: 'addProject', label: 'Create Projects', desc: 'Allows drafting and creating brand new projects', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'editProject', label: 'Edit Project Settings', desc: 'Allows modification of project details, dates and categories', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'editProjectParams', label: 'Edit Parameters in Project pop-up', desc: 'Allows editing parameters inside the project overview modal/pop-up', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'deleteProject', label: 'Delete Projects', desc: 'Allows permanent deletion of projects and all inner records', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'addAssembly', label: 'Create Sub-Assemblies', desc: 'Allows creating new sub-assembly items on a project', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'deleteAssembly', label: 'Delete Sub-Assemblies', desc: 'Allows deleting assembly blocks', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'addTask', label: 'Create Tasks', desc: 'Allows adding new tasks to sub-assembly lists', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'deleteTask', label: 'Delete Tasks', desc: 'Allows removing specific task list items', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'addDifficulty', label: 'Add / Edit Task Difficulty', desc: 'Allows setting and editing task difficulty parameters weight (1-20)', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'addTaskInline', label: 'Add Task Inside Project Pop-up', desc: 'Allows adding new tasks to sub-assembly lists directly inside modal', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'exportData', label: 'Export Reports', desc: 'Allows exporting excel spreadsheets and CSV log files', category: 'Projects & Tasks', relatedTab: 'projects' },
  { id: 'importData', label: 'Import Excel Records', desc: 'Allows seeding data via excel file uploads', category: 'Projects & Tasks', relatedTab: 'projects' },

  // 2. Schedule & Progress
  { id: 'editGanttSchedule', label: 'Edit Gantt Schedule', desc: 'Allows dragging, resizing, and rescheduling tasks in the Gantt chart', category: 'Schedule & Progress', relatedTab: 'schedule' },
  { id: 'updateTask', label: 'Update Task Progress', desc: 'Allows modifying percent progress, workflow status, and task completion', category: 'Schedule & Progress', relatedTab: 'progress' },

  // 3. Shop Floor, Timesheet & Manpower
  { id: 'manageTimesheet', label: 'Manage Timesheet', desc: 'Allows adding and editing timesheet entries for personnel', category: 'Shop Floor, Timesheet & Manpower', relatedTab: 'timesheet' },
  { id: 'deleteTimesheet', label: 'Delete Timesheet Entries', desc: 'Allows permanent deletion of timesheet entries', category: 'Shop Floor, Timesheet & Manpower', relatedTab: 'timesheet' },
  { id: 'manageManpowerBoard', label: 'Manage Manpower Board', desc: 'Allows assigning and reassigning employees on the Manpower Board', category: 'Shop Floor, Timesheet & Manpower', relatedTab: 'manpower' },

  // 4. Materials & Processing
  { id: 'manageMatProcessing', label: 'Manage Material Processing', desc: 'Allows adding, stage updates, and processing fabrication steel', category: 'Materials & Processing', relatedTab: 'matprocessing' },
  { id: 'manageMaterials', label: 'Manage Material Inventory', desc: 'Allows adding stock items, importing material excel data, and modifying quantities', category: 'Materials & Processing', relatedTab: 'materials' },
  { id: 'requestMaterial', label: 'Create Material Requests', desc: 'Allows drafting and submitting requests for project/assembly materials', category: 'Materials & Processing', relatedTab: 'materials' },
  { id: 'issueMaterial', label: 'Approve & Issue Materials', desc: 'Allows approving, rejecting and issuing material requests to dispense stock', category: 'Materials & Processing', relatedTab: 'materials' },

  // 5. Quality Control (QC)
  { id: 'requestInspection', label: 'Request QC Inspection', desc: 'Allows submitting a new Request For Inspection (RFI)', category: 'Quality Control (QC)', relatedTab: 'inspections' },
  { id: 'approveInspection', label: 'QC Inspector Review', desc: 'Allows signing-off, approving or issuing rework punchlists for RFIs', category: 'Quality Control (QC)', relatedTab: 'inspections' },
  { id: 'deleteInspection', label: 'Delete Inspection Record', desc: 'Allows permanent deletion of RFI and inspection request history', category: 'Quality Control (QC)', relatedTab: 'inspections' },

  // 6. Engineering & Drawings
  { id: 'manageDrawings', label: 'Manage Drawing Register', desc: 'Allows uploading new revisions, editing drawing details, and voiding drawings', category: 'Engineering & Drawings', relatedTab: 'drawings' },
  { id: 'manageBom', label: 'Manage BOM Master Templates', desc: 'Allows drafting, editing, importing excel, and deleting BOM master templates', category: 'Engineering & Drawings', relatedTab: 'bom' },
  { id: 'manageWireLog', label: 'Manage Consumable Log', desc: 'Allows adding new consumable wire log entries', category: 'Engineering & Drawings', relatedTab: 'consumable' },
  { id: 'deleteWireLog', label: 'Delete Consumable Log Entries', desc: 'Allows permanent deletion of consumable log entries', category: 'Engineering & Drawings', relatedTab: 'consumable' },

  // 7. Admin & Master Data
  { id: 'manageDailyReport', label: 'Manage Daily Report', desc: 'Allows reviewing, filtering, and printing site daily activity logs', category: 'Admin & Master Data', relatedTab: 'dailyreport' },
  { id: 'manageEmployees', label: 'Manage Employees', desc: 'Allows adding and editing employee master records', category: 'Admin & Master Data', relatedTab: 'employees' },
  { id: 'deleteEmployee', label: 'Delete Employees', desc: 'Allows permanent deletion of employee records', category: 'Admin & Master Data', relatedTab: 'employees' },
  { id: 'manageUsers', label: 'Manage Users & Access', desc: 'Allows editing user accounts, access roles, and permissions', category: 'Admin & Master Data', relatedTab: 'users' },
  { id: 'manageMasterData', label: 'Manage Master Data', desc: 'Allows managing, deleting, and merging GA Number, Material, and Part No entries', category: 'Admin & Master Data', relatedTab: 'masterdata' },
  { id: 'manageOrgSettings', label: 'Manage System Settings', desc: 'Allows modifying system terminology, company details, and templates', category: 'Admin & Master Data', relatedTab: 'orgsettings' }
];

export default function UsersAccessView({
  users,
  currentUser,
  onUpdateUsers,
  activeTabsList,
  defaultPermissions,
  sha256,
  sectionGroups = defaultSectionGroups
}: UsersAccessViewProps) {
  // Local staged copy of users for drafting modifications
  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Main View Switcher: User Accounts Directory vs Login/Logout Audit Logs
  const [viewMode, setViewMode] = useState<'directory' | 'audit_logs'>('directory');

  // Right Column Sub-Tab State
  const [activeSubTab, setActiveSubTab] = useState<'account' | 'navigation' | 'permissions'>('account');

  // Custom Toast Notification State
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4500);
  };
  
  // Synchronize when users from props update in background, but only if they have no unsaved changes
  React.useEffect(() => {
    const isCurrentlyDirty = JSON.stringify(localUsers) !== JSON.stringify(users);
    if (!isCurrentlyDirty) {
      setLocalUsers(users);
    }
  }, [users]);

  // Compute dirty state of current staged users vs original prop state
  const isDirty = React.useMemo(() => {
    return JSON.stringify(localUsers) !== JSON.stringify(users);
  }, [localUsers, users]);

  // New User Form States
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newUserId, setNewUserId] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRoleType>('coordinator');
  const [newUserPass, setNewUserPass] = useState<string>('');

  // Password Edit States
  const [showPassReset, setShowPassReset] = useState<boolean>(false);
  const [newPasswordValue, setNewPasswordValue] = useState<string>('');

  // Delete/Action Confirmation States
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const selectedUser = localUsers.find(u => u.id === selectedUserId);

  const getIsTabVisibleByDefault = (tabId: string, role: string) => {
    if (tabId === 'users') return role === 'admin';
    const tab = activeTabsList.find(t => t.id === tabId);
    if (!tab) return false;
    return tab.access === 'all' || (Array.isArray(tab.access) && tab.access.includes(role));
  };

  const getIsPermissionAllowedByDefault = (permId: string, role: string) => {
    return !!defaultPermissions[role]?.[permId];
  };

  const filteredUsers = localUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newUserId.trim().toLowerCase();
    const cleanName = newUserName.trim();
    const cleanPass = newUserPass.trim();

    if (!cleanId || !cleanName || !cleanPass) {
      showToast('error', 'Please fill out all user creation parameters.');
      return;
    }

    if (localUsers.some(u => u.id === cleanId)) {
      showToast('error', `User ID "${cleanId}" already exists in the roster!`);
      return;
    }

    const hashed = await sha256(cleanPass);
    const createdUser: User = {
      id: cleanId,
      name: cleanName,
      role: newUserRole,
      passHash: hashed
    };

    setLocalUsers([...localUsers, createdUser]);
    setSelectedUserId(createdUser.id);
    
    // Reset Form
    setNewUserId('');
    setNewUserName('');
    setNewUserRole('coordinator');
    setNewUserPass('');
    setShowAddForm(false);
    showToast('success', `User account staged for "${cleanName}". Please click "Save & Update Roster" to save.`);
  };

  const handleDeleteUser = (uId: string) => {
    if (currentUser && currentUser.id === uId) {
      showToast('error', 'You cannot delete your own logged-in user session!');
      return;
    }
    const target = localUsers.find(u => u.id === uId);
    if (!target) return;

    setDeleteConfirm({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to delete user "${target.name}" (${target.id})? Note: Deletion won't be final until you click "Save Changes" or "Save & Update Roster".`,
      onConfirm: () => {
        const updated = localUsers.filter(u => u.id !== uId);
        setLocalUsers(updated);
        if (selectedUserId === uId) {
          setSelectedUserId(updated[0]?.id || '');
        }
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        showToast('info', `Staged deletion of "${target.name}".`);
      }
    });
  };

  const handleForceTerminateSession = (uId: string) => {
    const target = localUsers.find(u => u.id === uId);
    if (!target) return;

    setDeleteConfirm({
      isOpen: true,
      title: 'Force Terminate Session',
      message: `Are you sure you want to terminate the active live session for user "${target.name}"? This will invalidate their token and trigger an immediate real-time logout on their device.`,
      onConfirm: () => {
        const updated = localUsers.map(u => {
          if (u.id === uId) {
            return {
              ...u,
              currentSessionId: undefined
            };
          }
          return u;
        });
        setLocalUsers(updated);
        // Persist immediately in the cloud
        onUpdateUsers(updated);
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        showToast('success', `Live session terminated for ${target.name}.`);
      }
    });
  };

  const handleResetToDefaults = () => {
    if (!selectedUser) return;
    setDeleteConfirm({
      isOpen: true,
      title: 'Reset User Defaults',
      message: `Reset "${selectedUser.name}" to standard defaults for the "${selectedUser.role}" role? This will stage the reset of custom overrides. Remember to click Save afterwards.`,
      onConfirm: () => {
        const updated = localUsers.map(u => {
          if (u.id === selectedUser.id) {
            return {
              ...u,
              allowedFeatures: undefined,
              allowedPermissions: undefined
            };
          }
          return u;
        });
        setLocalUsers(updated);
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        showToast('success', 'Reset custom permissions to default settings for this role.');
      }
    });
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPasswordValue.trim()) return;
    const hashed = await sha256(newPasswordValue.trim());
    
    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, passHash: hashed };
      }
      return u;
    });

    setLocalUsers(updated);
    setNewPasswordValue('');
    setShowPassReset(false);
    showToast('success', `Successfully staged passcode change for ${selectedUser.name}. Click "Save Changes" to apply permanently.`);
  };

  // Search states for Subtabs 2 & 3
  const [tabSearchQuery, setTabSearchQuery] = useState<string>('');
  const [permSearchQuery, setPermSearchQuery] = useState<string>('');

  const handleToggleTabVisibility = (tabId: string) => {
    if (!selectedUser) return;

    // Prevent admin from removing users access from themselves
    if (tabId === 'users' && selectedUser.id === currentUser?.id && currentUser?.role === 'admin') {
      showToast('error', 'You cannot disable Users & Access on your own active admin account to prevent lockout.');
      return;
    }

    const currentAllowed = selectedUser.allowedFeatures 
      ? [...selectedUser.allowedFeatures]
      : activeTabsList
          .filter(t => getIsTabVisibleByDefault(t.id, selectedUser.role))
          .map(t => t.id);

    let nextAllowed: string[];
    if (currentAllowed.includes(tabId)) {
      nextAllowed = currentAllowed.filter(id => id !== tabId);
    } else {
      nextAllowed = [...currentAllowed, tabId];
    }

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return {
          ...u,
          allowedFeatures: nextAllowed
        };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleSelectAllTabsInSection = (itemIds: string[]) => {
    if (!selectedUser) return;
    const currentAllowed = selectedUser.allowedFeatures 
      ? [...selectedUser.allowedFeatures]
      : activeTabsList
          .filter(t => getIsTabVisibleByDefault(t.id, selectedUser.role))
          .map(t => t.id);

    const nextAllowed = Array.from(new Set([...currentAllowed, ...itemIds]));
    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedFeatures: nextAllowed };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleDeselectAllTabsInSection = (itemIds: string[]) => {
    if (!selectedUser) return;
    const currentAllowed = selectedUser.allowedFeatures 
      ? [...selectedUser.allowedFeatures]
      : activeTabsList
          .filter(t => getIsTabVisibleByDefault(t.id, selectedUser.role))
          .map(t => t.id);

    // Keep 'users' if current user is admin modifying themselves
    const isSelfAdmin = selectedUser.id === currentUser?.id && currentUser?.role === 'admin';
    const nextAllowed = currentAllowed.filter(id => {
      if (isSelfAdmin && id === 'users') return true;
      return !itemIds.includes(id);
    });

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedFeatures: nextAllowed };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleEnableAllTabs = () => {
    if (!selectedUser) return;
    const allTabIds = activeTabsList.map(t => t.id);
    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedFeatures: allTabIds };
      }
      return u;
    });
    setLocalUsers(updated);
    showToast('info', 'Enabled all menu tabs for this user.');
  };

  const handleResetTabsToRoleDefaults = () => {
    if (!selectedUser) return;
    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedFeatures: undefined };
      }
      return u;
    });
    setLocalUsers(updated);
    showToast('info', 'Reset visible tabs to standard role defaults.');
  };

  const handleTogglePermission = (permId: string) => {
    if (!selectedUser) return;

    const currentPerms = selectedUser.allowedPermissions 
      ? { ...selectedUser.allowedPermissions }
      : { ...defaultPermissions[selectedUser.role] };

    const originalValue = currentPerms[permId] !== undefined 
      ? currentPerms[permId] 
      : getIsPermissionAllowedByDefault(permId, selectedUser.role);

    const nextPerms = {
      ...currentPerms,
      [permId]: !originalValue
    };

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return {
          ...u,
          allowedPermissions: nextPerms
        };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleSelectAllPermissionsInCategory = (categoryPermIds: string[]) => {
    if (!selectedUser) return;
    const currentPerms = selectedUser.allowedPermissions 
      ? { ...selectedUser.allowedPermissions }
      : { ...defaultPermissions[selectedUser.role] };

    const nextPerms = { ...currentPerms };
    categoryPermIds.forEach(id => {
      nextPerms[id] = true;
    });

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedPermissions: nextPerms };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleDeselectAllPermissionsInCategory = (categoryPermIds: string[]) => {
    if (!selectedUser) return;
    const currentPerms = selectedUser.allowedPermissions 
      ? { ...selectedUser.allowedPermissions }
      : { ...defaultPermissions[selectedUser.role] };

    const nextPerms = { ...currentPerms };
    categoryPermIds.forEach(id => {
      nextPerms[id] = false;
    });

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedPermissions: nextPerms };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleEnableAllPermissions = () => {
    if (!selectedUser) return;
    const nextPerms: Record<string, boolean> = {};
    permissionMeta.forEach(p => {
      nextPerms[p.id] = true;
    });

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedPermissions: nextPerms };
      }
      return u;
    });
    setLocalUsers(updated);
    showToast('info', 'Granted all operational privileges for this user.');
  };

  const handleResetPermissionsToRoleDefaults = () => {
    if (!selectedUser) return;
    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, allowedPermissions: undefined };
      }
      return u;
    });
    setLocalUsers(updated);
    showToast('info', 'Reset operational privileges to standard role defaults.');
  };

  const handleRoleChange = (roleVal: UserRoleType) => {
    if (!selectedUser) return;
    
    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return {
          ...u,
          role: roleVal,
          // Re-initialize permissions to fit updated default guidelines
          allowedFeatures: undefined,
          allowedPermissions: undefined
        };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleDisplayNameChange = (nameVal: string) => {
    if (!selectedUser || !nameVal.trim()) return;

    const updated = localUsers.map(u => {
      if (u.id === selectedUser.id) {
        return {
          ...u,
          name: nameVal.trim()
        };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const isSelectedUserUsingDefaultFeatures = selectedUser && selectedUser.allowedFeatures === undefined;
  const isSelectedUserUsingDefaultPermissions = selectedUser && selectedUser.allowedPermissions === undefined;

  return (
    <div className="flex flex-col gap-6 p-6 min-h-[calc(100vh-140px)] animate-fade-in select-text w-full relative">
      
      {/* 🔔 CUSTOM TOAST NOTIFICATION BANNER */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4.5 py-3.5 rounded-xl shadow-lg border animate-in slide-in-from-top-3 duration-300 ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
            : notification.type === 'error'
              ? 'bg-red-500/10 dark:bg-red-500/15 border-red-500/30 text-red-500'
              : 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/30 text-blue-400'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <HelpCircle className="w-5 h-5 shrink-0" />
          )}
          <div className="text-xs font-semibold leading-snug max-w-sm">
            {notification.message}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition-colors text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-border pb-4">
        <div>
          <h1 className="text-2xl font-black font-condensed uppercase tracking-wider text-base-text flex items-center gap-2">
            <Users className="h-7 w-7 text-[#9b1c2e]" />
            Users & Access Management
          </h1>
          <p className="text-xs text-base-muted mt-1 max-w-2xl leading-relaxed">
            Assign workspace navigation boundaries, tab visibility bounds, and operational action privileges across all fabrication staff and administrators.
          </p>
        </div>
        
        {/* Floating save indicator or quick save button when changes are staged */}
        {isDirty && viewMode === 'directory' && (
          <div className="flex items-center gap-2 animate-pulse-slow">
            <button
              onClick={() => setLocalUsers(users)}
              className="px-3.5 py-1.5 border border-base-border text-base-muted hover:text-base-text font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface3 transition-all cursor-pointer text-xs"
            >
              Discard Changes
            </button>
            <button
              onClick={() => {
                onUpdateUsers(localUsers);
                showToast('success', 'All changes saved and broadcast successfully to the Live Cloud Sync!');
              }}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md text-xs flex items-center gap-1.5 glow-green active:scale-[0.98]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save & Update Roster</span>
            </button>
          </div>
        )}
      </div>

      {/* TOP VIEW TABS (Manajemen User & Hak Akses vs Catatan Login & Logout) */}
      <div className="flex items-center gap-2 border-b border-base-border pb-2">
        <button
          onClick={() => setViewMode('directory')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            viewMode === 'directory'
              ? 'bg-[#9b1c2e] text-white shadow-sm'
              : 'bg-base-surface hover:bg-base-surface2 border border-base-border text-base-muted hover:text-base-text'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Daftar User & Hak Akses</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${
            viewMode === 'directory' ? 'bg-white/20 text-white' : 'bg-base-surface3 text-base-muted'
          }`}>
            {localUsers.length}
          </span>
        </button>

        <button
          onClick={() => setViewMode('audit_logs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            viewMode === 'audit_logs'
              ? 'bg-[#9b1c2e] text-white shadow-sm'
              : 'bg-base-surface hover:bg-base-surface2 border border-base-border text-base-muted hover:text-base-text'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Catatan Login & Logout</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Live Audit Active"></span>
        </button>
      </div>

      {/* VIEW CONTENT */}
      {viewMode === 'audit_logs' ? (
        <UserSessionAuditView currentUser={currentUser} users={users} />
      ) : (
        /* TWO COLUMN GRID WRAPPER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
      
        {/* LEFT COLUMN: User Directory list (Grid cols: 4) */}
        <div className="lg:col-span-4 flex flex-col gap-4 bg-base-surface border border-base-border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center pb-2.5 border-b border-base-border">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#9b1c2e]" />
              <h2 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">User Directory</h2>
            </div>
            <button
              onClick={() => setShowAddForm(prev => !prev)}
              className={`px-2.5 py-1 text-xxs font-condensed font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1 cursor-pointer ${
                showAddForm 
                  ? 'bg-base-surface border border-base-border hover:border-base-border/80 text-base-muted' 
                  : 'bg-[#9b1c2e] hover:bg-[#801422] text-white'
              }`}
            >
              {showAddForm ? 'Cancel' : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>Create User</span>
                </>
              )}
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-base-muted2" />
            <input
              type="text"
              placeholder="Search user ID or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg outline-none focus:border-[#9b1c2e] text-base-text font-semibold placeholder:font-normal placeholder:text-base-muted/75"
            />
          </div>

          {/* Create User Form - Inline Collapsible */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="bg-base-surface2 border border-[#9b1c2e]/20 p-4 rounded-lg space-y-3.5 shadow-inner animate-fade-in">
              <div className="text-[10px] uppercase font-condensed font-black tracking-widest text-[#9b1c2e] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Add New User Account</span>
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">User Sign-in ID (No spaces)</label>
                <input
                  type="text"
                  placeholder="e.g. suparman"
                  required
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none focus:border-[#9b1c2e]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">Full Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Suparman Batam"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none font-semibold focus:border-[#9b1c2e]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">Default Role Profile</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRoleType)}
                  className="w-full px-2 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none font-bold text-base-text"
                >
                  <option value="admin">Admin (Full Access)</option>
                  <option value="manager">Manager (Edit Scope)</option>
                  <option value="coordinator">Coordinator (Edit Tasks)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                  <option value="facility maintanance">Facility Maintenance</option>
                  <option value="quality control">Quality Control</option>
                  <option value="safety">Safety</option>
                  <option value="project control">Project Control</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">Initial Passcode</label>
                <input
                  type="password"
                  required
                  placeholder="Set account password..."
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none focus:border-[#9b1c2e]"
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#9b1c2e] hover:bg-[#801422] text-white font-condensed font-bold uppercase tracking-wider rounded text-[10px] w-full shadow-sm transition-all"
                >
                  Staged Create User
                </button>
              </div>
            </form>
          )}

          {/* Directory List Container */}
          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[520px] pr-1">
            {filteredUsers.length === 0 ? (
              <div className="text-xs text-base-muted italic text-center py-8">No matching user records found.</div>
            ) : (
              filteredUsers.map(u => {
                const isSelected = u.id === selectedUserId;
                const hasOverrides = u.allowedFeatures !== undefined || u.allowedPermissions !== undefined;
                
                // Get initials
                const initials = u.name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[#9b1c2e]/5 border-[#9b1c2e]/45 text-base-text shadow-xs ring-1 ring-[#9b1c2e]/10'
                        : 'bg-base-surface2 border-transparent hover:border-base-border text-base-muted hover:text-base-text'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-3 flex-1">
                      {/* Modern Round Initials Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black font-condensed tracking-wider transition-colors ${
                        isSelected 
                          ? 'bg-[#9b1c2e] text-white' 
                          : 'bg-base-surface border border-base-border text-base-muted'
                      }`}>
                        {initials || '?'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-xs flex items-center gap-1.5 text-base-text">
                          <span className="truncate">{u.name}</span>
                          {u.currentSessionId && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="User is currently live & online" />
                          )}
                          {u.id === currentUser?.id && (
                            <span className="shrink-0 text-[8px] font-condensed font-extrabold tracking-widest uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Me</span>
                          )}
                        </div>
                        <div className="text-[10px] text-base-muted flex items-center gap-1.5 font-bold mt-0.5 uppercase tracking-wide truncate">
                          <span className="font-mono">{u.id}</span>
                          <span>•</span>
                          <span className="text-[9px] font-extrabold text-[#9b1c2e]/90">{u.role}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {hasOverrides && (
                        <span className="w-2 h-2 rounded-full bg-amber-500" title="Custom overrides active" />
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(u.id);
                        }}
                        className="p-1 text-base-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Details & Permissions Override Panel (Grid cols: 8) */}
        <div className="lg:col-span-8 bg-base-surface border border-base-border rounded-xl p-5 shadow-sm flex flex-col gap-5 min-h-[550px]">
          {selectedUser ? (
            <>
              {/* Profile Details header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-condensed font-black uppercase text-lg text-base-text">{selectedUser.name}</span>
                    <span className="px-2 py-0.5 bg-base-surface2 border border-base-border text-base-muted font-mono text-[9px] font-bold rounded">ID: {selectedUser.id}</span>
                    {(selectedUser.allowedFeatures !== undefined || selectedUser.allowedPermissions !== undefined) && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[9px] uppercase font-extrabold tracking-wider">Custom overrides active</span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base-muted text-[10px] uppercase font-condensed tracking-wider">System Role:</span>
                      <select
                        value={selectedUser.role}
                        onChange={(e) => handleRoleChange(e.target.value as UserRoleType)}
                        className="px-2 py-0.5 bg-base-bg border border-base-border rounded font-bold text-xxs uppercase tracking-wider text-base-text outline-none focus:border-[#9b1c2e]"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="viewer">Viewer</option>
                        <option value="facility maintanance">Facility Maintenance</option>
                        <option value="quality control">Quality Control</option>
                        <option value="safety">Safety</option>
                        <option value="project control">Project Control</option>
                      </select>
                    </div>
                    
                    <span className="text-base-border">|</span>
                    
                    <div className="flex items-center gap-1.5">
                      <span className="text-base-muted text-[10px] uppercase font-condensed tracking-wider">Rename:</span>
                      <input
                        type="text"
                        defaultValue={selectedUser.name}
                        onBlur={(e) => handleDisplayNameChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleDisplayNameChange(e.currentTarget.value);
                            e.currentTarget.blur();
                          }
                        }}
                        className="px-2 py-0.5 bg-base-bg border border-base-border rounded text-xs font-semibold w-40 outline-none focus:border-[#9b1c2e]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  {isDirty && (
                    <button
                      onClick={() => {
                        onUpdateUsers(localUsers);
                        showToast('success', 'All changes saved and broadcast successfully to the Live Cloud Sync!');
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Minimalist Inline Tab switcher inside the details container */}
              <div className="flex border-b border-base-border gap-1.5 pb-0.5">
                <button
                  onClick={() => setActiveSubTab('account')}
                  className={`px-4 py-2 font-condensed font-bold uppercase text-xs tracking-wider border-b-2 transition-all ${
                    activeSubTab === 'account'
                      ? 'border-[#9b1c2e] text-base-text bg-[#9b1c2e]/5'
                      : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-surface2/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Account & Security</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveSubTab('navigation')}
                  className={`px-4 py-2 font-condensed font-bold uppercase text-xs tracking-wider border-b-2 transition-all ${
                    activeSubTab === 'navigation'
                      ? 'border-[#9b1c2e] text-base-text bg-[#9b1c2e]/5'
                      : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-surface2/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Menu Tab Visibility</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveSubTab('permissions')}
                  className={`px-4 py-2 font-condensed font-bold uppercase text-xs tracking-wider border-b-2 transition-all ${
                    activeSubTab === 'permissions'
                      ? 'border-[#9b1c2e] text-base-text bg-[#9b1c2e]/5'
                      : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-surface2/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Operational Actions</span>
                  </div>
                </button>
              </div>

              {/* Sub-Tab Content Panels */}
              <div className="flex-1 flex flex-col justify-between">
                
                {/* SUBTAB 1: ACCOUNT & GENERAL SECURITY */}
                {activeSubTab === 'account' && (
                  <div className="space-y-4 animate-fade-in">
                    
                    {/* Live Session Control Card */}
                    <div className="bg-base-surface2 border border-base-border p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-condensed font-black tracking-wider text-base-muted">Live Active Status</span>
                          {selectedUser.currentSessionId ? (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] uppercase font-black tracking-wide animate-pulse border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Active Live</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-base-border text-base-muted text-[9px] uppercase font-black tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-base-muted/50"></span>
                              <span>Offline</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-base-muted leading-relaxed">
                          {selectedUser.currentSessionId ? (
                            <span>Currently authenticated on device/browser with token <code className="bg-base-bg px-1 rounded text-[10px] font-mono border border-base-border text-base-text">{selectedUser.currentSessionId.substring(0, 8)}...</code>. Logging in on another system will terminate this instantly.</span>
                          ) : (
                            <span>No active live session. This user is logged out of all active devices.</span>
                          )}
                        </p>
                      </div>

                      {selectedUser.currentSessionId && currentUser?.role === 'admin' && (
                        <button
                          onClick={() => handleForceTerminateSession(selectedUser.id)}
                          className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/15 text-red-600 border border-red-500/20 font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>Force Log Out</span>
                        </button>
                      )}
                    </div>

                    {/* Passcode Overrider */}
                    <div className="bg-base-surface2 border border-base-border p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text flex items-center gap-1.5">
                            <Key className="w-4 h-4 text-[#9b1c2e]" />
                            Modify Password Code
                          </h4>
                          <p className="text-[11px] text-base-muted leading-snug mt-0.5">Reset or replace the secure passcode for signing in.</p>
                        </div>
                        <button
                          onClick={() => setShowPassReset(prev => !prev)}
                          className="px-2.5 py-1 text-xxs font-condensed font-bold uppercase border border-base-border text-base-muted hover:text-base-text rounded-md transition-colors"
                        >
                          {showPassReset ? 'Collapse' : 'Update Passcode'}
                        </button>
                      </div>

                      {showPassReset && (
                        <div className="flex gap-2 max-w-md pt-1.5 animate-fade-in">
                          <input
                            type="password"
                            placeholder="Input new secure lockpass..."
                            value={newPasswordValue}
                            onChange={(e) => setNewPasswordValue(e.target.value)}
                            className="flex-1 px-2.5 py-1 bg-base-bg border border-base-border rounded text-xs outline-none focus:border-[#9b1c2e]"
                          />
                          <button
                            type="button"
                            onClick={handleUpdatePassword}
                            className="px-4 py-1 bg-[#9b1c2e] text-white font-condensed font-bold uppercase text-xs rounded transition-colors hover:bg-[#801422] cursor-pointer"
                          >
                            Apply Change
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Reset custom privileges block */}
                    <div className="bg-base-surface2 border border-base-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                          Default Roster Alignment
                        </h4>
                        <p className="text-[11px] text-base-muted max-w-xl">
                          Wipe all manual overrides, re-aligning tab visibility and operational actions back to standard preset roles.
                        </p>
                      </div>

                      {(selectedUser.allowedFeatures !== undefined || selectedUser.allowedPermissions !== undefined) ? (
                        <button
                          onClick={handleResetToDefaults}
                          className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 text-amber-600 font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all"
                        >
                          Reset Defaults
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase font-condensed font-black tracking-wider text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                          Aligned with role presets
                        </span>
                      )}
                    </div>

                    {/* Security warning alert box */}
                    <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/25 p-3.5 rounded-lg flex items-start gap-2 text-base-muted italic">
                      <Lock className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-relaxed text-base-muted">
                        <strong>Passcode Encryption:</strong> Passwords are fully hashed with a secure PBKDF2 style SHA-256 routine before transmitting or storing in Firestore, protecting credential vectors from leakages or unauthenticated readers.
                      </span>
                    </div>

                  </div>
                )}

                {/* SUBTAB 2: MENU NAVIGATION ACCESS */}
                {activeSubTab === 'navigation' && (() => {
                  const totalTabsCount = activeTabsList.length;
                  const activeTabsCount = activeTabsList.filter(t => {
                    const isDefaultVisible = getIsTabVisibleByDefault(t.id, selectedUser.role);
                    return selectedUser.allowedFeatures 
                      ? selectedUser.allowedFeatures.includes(t.id) 
                      : isDefaultVisible;
                  }).length;

                  // Group tabs by sectionGroups
                  const groupedTabs: { title: string; tabs: typeof activeTabsList }[] = [];
                  const assignedTabIds = new Set<string>();

                  sectionGroups.forEach(group => {
                    const tabsInGroup = activeTabsList.filter(t => group.items.includes(t.id));
                    if (tabsInGroup.length > 0) {
                      groupedTabs.push({ title: group.title, tabs: tabsInGroup });
                      tabsInGroup.forEach(t => assignedTabIds.add(t.id));
                    }
                  });

                  // Add any unassigned tabs to "Other Menus"
                  const remainingTabs = activeTabsList.filter(t => !assignedTabIds.has(t.id));
                  if (remainingTabs.length > 0) {
                    groupedTabs.push({ title: 'Other Modules', tabs: remainingTabs });
                  }

                  const query = tabSearchQuery.toLowerCase().trim();

                  return (
                    <div className="space-y-4 animate-fade-in">
                      {/* Top Header & Overview Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-border pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Menu Tab Visibility Controls</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#9b1c2e]/10 text-[#9b1c2e] border border-[#9b1c2e]/20">
                              {activeTabsCount} / {totalTabsCount} Menus Active
                            </span>
                          </div>
                          <p className="text-[11px] text-base-muted mt-0.5">
                            Toggle sidebar & mobile navigation tabs for this user account. Customizations override role defaults.
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isSelectedUserUsingDefaultFeatures ? (
                            <span className="px-2 py-1 rounded text-[9px] uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold shrink-0">
                              Role Defaults Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResetTabsToRoleDefaults}
                              className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase rounded border border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
                              title="Reset all menu tabs to standard role defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset to Role Defaults</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleEnableAllTabs}
                            className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase rounded border border-base-border text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
                          >
                            Enable All Menus
                          </button>
                        </div>
                      </div>

                      {/* Search / Filter input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" />
                        <input
                          type="text"
                          value={tabSearchQuery}
                          onChange={(e) => setTabSearchQuery(e.target.value)}
                          placeholder="Filter menu tabs by name or id (e.g. progress, shopfloor, drawings)..."
                          className="w-full pl-8.5 pr-3 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs outline-none focus:border-[#9b1c2e] text-base-text placeholder:text-base-muted/60"
                        />
                        {tabSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setTabSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-base-muted hover:text-base-text"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Grouped Tab Sections */}
                      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                        {groupedTabs.map(group => {
                          const matchingTabs = group.tabs.filter(t => 
                            !query || 
                            t.label.toLowerCase().includes(query) || 
                            t.id.toLowerCase().includes(query)
                          );

                          if (matchingTabs.length === 0) return null;

                          const visibleInGroup = matchingTabs.filter(t => {
                            const isDefaultVisible = getIsTabVisibleByDefault(t.id, selectedUser.role);
                            return selectedUser.allowedFeatures 
                              ? selectedUser.allowedFeatures.includes(t.id) 
                              : isDefaultVisible;
                          }).length;

                          return (
                            <div key={group.title} className="bg-base-surface/50 border border-base-border/70 rounded-xl p-3 space-y-2.5">
                              {/* Section Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-base-border/50 pb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-condensed font-black uppercase text-xs tracking-wider text-base-text">
                                    {group.title}
                                  </h4>
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-base-surface3 border border-base-border text-base-muted">
                                    {visibleInGroup} / {matchingTabs.length} visible
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-condensed font-bold uppercase">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllTabsInSection(matchingTabs.map(t => t.id))}
                                    className="px-2 py-0.5 rounded text-base-muted hover:text-emerald-600 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all cursor-pointer"
                                  >
                                    Select All
                                  </button>
                                  <span className="text-base-border">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeselectAllTabsInSection(matchingTabs.map(t => t.id))}
                                    className="px-2 py-0.5 rounded text-base-muted hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                                  >
                                    Clear All
                                  </button>
                                </div>
                              </div>

                              {/* Tabs Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {matchingTabs.map(t => {
                                  const isDefaultVisible = getIsTabVisibleByDefault(t.id, selectedUser.role);
                                  const isCurrentlyVisible = selectedUser.allowedFeatures 
                                    ? selectedUser.allowedFeatures.includes(t.id)
                                    : isDefaultVisible;

                                  const IconComponent = TabIconMap[t.id] || Folder;
                                  const isProtectedAdminTab = t.id === 'users' && selectedUser.id === currentUser?.id && currentUser?.role === 'admin';

                                  return (
                                    <label
                                      key={t.id}
                                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                                        isProtectedAdminTab
                                          ? 'bg-base-surface2 border-amber-500/30 text-base-text opacity-90'
                                          : isCurrentlyVisible
                                            ? 'bg-base-surface2 border-[#9b1c2e]/30 text-base-text hover:bg-base-surface3/40'
                                            : 'bg-base-bg/30 border-base-border/50 text-base-muted hover:text-base-muted2 hover:bg-base-bg/50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <input
                                          type="checkbox"
                                          checked={isCurrentlyVisible}
                                          disabled={isProtectedAdminTab}
                                          onChange={() => handleToggleTabVisibility(t.id)}
                                          className={`w-4 h-4 rounded cursor-pointer shrink-0 ${
                                            isProtectedAdminTab ? 'cursor-not-allowed opacity-60' : 'accent-[#9b1c2e]'
                                          }`}
                                        />
                                        <div className="w-7 h-7 rounded-md bg-base-surface border border-base-border/70 flex items-center justify-center shrink-0 text-base-muted">
                                          <IconComponent className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="truncate min-w-0 pr-1">
                                          <div className="text-xs font-bold text-base-text flex items-center gap-1.5 truncate">
                                            <span>{t.label}</span>
                                            {t.id === 'progress' && (
                                              <span className="text-[9px] bg-blue-500/10 text-blue-500 font-normal px-1 rounded border border-blue-500/20">
                                                Update
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[9px] text-base-muted leading-tight font-normal">
                                            {isProtectedAdminTab ? (
                                              <span className="text-amber-500 font-bold">Admin Self-Protect Lock</span>
                                            ) : isDefaultVisible ? (
                                              <span className="text-emerald-500 font-medium">Standard for {selectedUser.role}</span>
                                            ) : (
                                              <span className="text-base-muted">Hidden by default for {selectedUser.role}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <span className="text-[9px] uppercase font-mono bg-base-surface border border-base-border px-1.5 py-0.5 rounded text-base-muted shrink-0">
                                        {t.id}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* SUBTAB 3: OPERATIONAL ACTION PRIVILEGES */}
                {activeSubTab === 'permissions' && (() => {
                  const totalPermsCount = permissionMeta.length;
                  const grantedPermsCount = permissionMeta.filter(pMeta => {
                    const isDefaultAllowed = getIsPermissionAllowedByDefault(pMeta.id, selectedUser.role);
                    return selectedUser.allowedPermissions
                      ? !!selectedUser.allowedPermissions[pMeta.id]
                      : isDefaultAllowed;
                  }).length;

                  const query = permSearchQuery.toLowerCase().trim();

                  return (
                    <div className="space-y-4 animate-fade-in">
                      {/* Top Header & Overview Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-border pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Operational Action Privileges</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              {grantedPermsCount} / {totalPermsCount} Actions Granted
                            </span>
                          </div>
                          <p className="text-[11px] text-base-muted mt-0.5">
                            Configure granular action privileges (create, update, approve, delete) for all operational modules.
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isSelectedUserUsingDefaultPermissions ? (
                            <span className="px-2 py-1 rounded text-[9px] uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold shrink-0">
                              Role Defaults Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResetPermissionsToRoleDefaults}
                              className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase rounded border border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
                              title="Reset operational actions back to standard role defaults"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset to Role Defaults</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleEnableAllPermissions}
                            className="px-2.5 py-1 text-[10px] font-condensed font-bold uppercase rounded border border-base-border text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
                          >
                            Grant All Privileges
                          </button>
                        </div>
                      </div>

                      {/* Search / Filter input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" />
                        <input
                          type="text"
                          value={permSearchQuery}
                          onChange={(e) => setPermSearchQuery(e.target.value)}
                          placeholder="Search action by name, module, or related menu (e.g. progress, gantt, timesheet, drawing)..."
                          className="w-full pl-8.5 pr-3 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs outline-none focus:border-[#9b1c2e] text-base-text placeholder:text-base-muted/60"
                        />
                        {permSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setPermSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-base-muted hover:text-base-text"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Grouped Category Sections */}
                      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                        {permissionCategories.map(cat => {
                          const permsInCat = permissionMeta.filter(p => p.category === cat);
                          const matchingPerms = permsInCat.filter(p => 
                            !query ||
                            p.label.toLowerCase().includes(query) ||
                            p.desc.toLowerCase().includes(query) ||
                            p.relatedTab.toLowerCase().includes(query) ||
                            p.id.toLowerCase().includes(query)
                          );

                          if (matchingPerms.length === 0) return null;

                          const grantedInCat = matchingPerms.filter(p => {
                            const isDefaultAllowed = getIsPermissionAllowedByDefault(p.id, selectedUser.role);
                            return selectedUser.allowedPermissions
                              ? !!selectedUser.allowedPermissions[p.id]
                              : isDefaultAllowed;
                          }).length;

                          return (
                            <div key={cat} className="bg-base-surface/50 border border-base-border/70 rounded-xl p-3 space-y-2.5">
                              {/* Category Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-base-border/50 pb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-condensed font-black uppercase text-xs tracking-wider text-base-text">
                                    {cat}
                                  </h4>
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-base-surface3 border border-base-border text-base-muted">
                                    {grantedInCat} / {matchingPerms.length} granted
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-condensed font-bold uppercase">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllPermissionsInCategory(matchingPerms.map(p => p.id))}
                                    className="px-2 py-0.5 rounded text-base-muted hover:text-emerald-600 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all cursor-pointer"
                                  >
                                    Grant All
                                  </button>
                                  <span className="text-base-border">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeselectAllPermissionsInCategory(matchingPerms.map(p => p.id))}
                                    className="px-2 py-0.5 rounded text-base-muted hover:text-red-600 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                                  >
                                    Revoke All
                                  </button>
                                </div>
                              </div>

                              {/* Perms Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {matchingPerms.map(pMeta => {
                                  const isDefaultAllowed = getIsPermissionAllowedByDefault(pMeta.id, selectedUser.role);
                                  const isCurrentlyAllowed = selectedUser.allowedPermissions
                                    ? !!selectedUser.allowedPermissions[pMeta.id]
                                    : isDefaultAllowed;

                                  return (
                                    <label
                                      key={pMeta.id}
                                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                                        isCurrentlyAllowed
                                          ? 'bg-base-surface2 border-emerald-500/25 text-base-text hover:bg-base-surface3/40'
                                          : 'bg-base-bg/30 border-base-border/50 text-base-muted hover:text-base-muted2 hover:bg-base-bg/50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <input
                                          type="checkbox"
                                          checked={isCurrentlyAllowed}
                                          onChange={() => handleTogglePermission(pMeta.id)}
                                          className="w-4 h-4 accent-emerald-500 shrink-0 rounded cursor-pointer"
                                        />
                                        <div className="min-w-0 pr-1">
                                          <div className="text-xs font-bold text-base-text truncate flex items-center gap-1.5">
                                            <span>{pMeta.label}</span>
                                            <span className="text-[9px] font-mono text-base-muted bg-base-surface px-1 rounded border border-base-border/70">
                                              {pMeta.relatedTab}
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-base-muted leading-tight font-normal truncate" title={pMeta.desc}>
                                            {pMeta.desc}
                                          </div>
                                        </div>
                                      </div>
                                      <span className={`text-[8px] uppercase font-condensed font-black px-1.5 py-0.2 rounded border shrink-0 ${
                                        isDefaultAllowed 
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                                          : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                                      }`}>
                                        {isDefaultAllowed ? 'Std' : 'Restricted'}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Staged banner indicator inside details view */}
                <div className="border-t border-base-border/40 pt-3.5 mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-base-muted flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-base-accent" />
                    <span>Changes above will not write to cloud until you click <strong>Save Changes</strong></span>
                  </span>
                  
                  {isDirty && (
                    <button
                      onClick={() => {
                        onUpdateUsers(localUsers);
                        showToast('success', 'All changes saved and broadcast successfully to the Live Cloud Sync!');
                      }}
                      className="px-4 py-1.5 bg-[#9b1c2e] hover:bg-[#801422] text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md"
                    >
                      Save Changes
                    </button>
                  )}
                </div>

              </div>
            </>
          ) : (
            <div className="text-center py-20 text-base-muted flex flex-col items-center justify-center gap-3 flex-1">
              <Users className="w-12 h-12 text-base-border animate-pulse-slow" />
              <div className="text-sm font-bold uppercase font-condensed tracking-wider">No User Profile Selected</div>
              <p className="text-xs max-w-sm leading-relaxed text-base-muted/80">
                Please search and select a team member from the directory list on the left to start viewing live status and adjusting granular permissions.
              </p>
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5 text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-full text-red-600 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">{deleteConfirm.title}</h4>
                <p className="text-xs text-base-muted font-normal leading-relaxed">
                  {deleteConfirm.message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end text-xs pt-1">
              <button 
                onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))} 
                className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={deleteConfirm.onConfirm} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Action</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
