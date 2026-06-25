import React, { useState } from 'react';
import { User, UserRoleType } from '../types';
import { Users, Shield, ShieldAlert, Plus, Trash2, Key, HelpCircle, Check, RefreshCw, Search, Power, AlertCircle, CheckCircle2 } from 'lucide-react';

interface UsersAccessViewProps {
  users: User[];
  currentUser: User | null;
  onUpdateUsers: (updatedUsers: User[]) => void;
  activeTabsList: { id: string; label: string; icon: string; access: any }[];
  defaultPermissions: Record<string, Record<string, boolean>>;
  sha256: (str: string) => Promise<string>;
}

const permissionMeta = [
  { id: 'addProject', label: 'Create Projects', desc: 'Allows drafting and creating brand new projects' },
  { id: 'editProject', label: 'Edit Project Settings', desc: 'Allows modification of project details, dates and categories' },
  { id: 'deleteProject', label: 'Delete Projects', desc: 'Allows permanent deletion of projects and all inner records' },
  { id: 'addAssembly', label: 'Create Sub-Assemblies', desc: 'Allows creating new sub-assembly items on a project' },
  { id: 'deleteAssembly', label: 'Delete Sub-Assemblies', desc: 'Allows deleting assembly blocks' },
  { id: 'addTask', label: 'Create Tasks', desc: 'Allows adding new tasks to sub-assembly lists' },
  { id: 'deleteTask', label: 'Delete Tasks', desc: 'Allows removing specific task list items' },
  { id: 'updateTask', label: 'Update Task Progress', desc: 'Allows modifying percent progress and due dates on tasks' },
  { id: 'addDifficulty', label: 'Add / Edit Task Difficulty', desc: 'Allows setting and editing task difficulty parameters weight (1-20)' },
  { id: 'addTaskInline', label: 'Add Task Inside Project Pop-up', desc: 'Allows adding new tasks to sub-assembly lists directly inside the project overview modal' },
  { id: 'editProjectParameters', label: 'Edit Parameters in Project pop-up', desc: 'Allows editing project-specific parameters directly in the project overview details window' },
  { id: 'manageUsers', label: 'Manage Users & Access', desc: 'Allows editing user profiles, visible tabs and admin rules' },
  { id: 'exportData', label: 'Export Reports', desc: 'Allows exporting excel spreadsheets and CSV log files' },
  { id: 'importData', label: 'Import Excel Records', desc: 'Allows seeding data via excel file uploads' }
];

export default function UsersAccessView({
  users,
  currentUser,
  onUpdateUsers,
  activeTabsList,
  defaultPermissions,
  sha256
}: UsersAccessViewProps) {
  // Local staged copy of users for drafting modifications
  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
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
    showToast('success', `User account staged for "${cleanName}". Please click "Save Changes" or "Save & Update Roster" to broadcast.`);
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
      message: `Are you sure you want to stage deletion of user "${target.name}" (${target.id})? Note: Deletion won't be final until you click "Save Changes" or "Save & Update Roster".`,
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

  const handleToggleTabVisibility = (tabId: string) => {
    if (!selectedUser) return;

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
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4.5 py-3.5 rounded-xl shadow-elevated border animate-in slide-in-from-top-3 duration-300 ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/35 text-emerald-500'
            : notification.type === 'error'
              ? 'bg-red-500/10 dark:bg-red-500/15 border-red-500/35 text-red-500'
              : 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/35 text-blue-400'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <HelpCircle className="w-5 h-5 shrink-0" />
          )}
          <div className="text-xs font-bold leading-snug max-w-sm">
            {notification.message}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded transition-colors text-xxs font-extrabold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* ⚠️ UNSAVED CHANGES FLOATING ACTION BANNER */}
      {isDirty && (
        <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/35 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-elevated animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 animate-spin-slow text-amber-500" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase font-condensed tracking-wider text-base-text">Unsaved Changes Staged</h4>
              <p className="text-xs text-base-muted leading-tight mt-0.5">
                You have modified user profiles, roles, or access bounds. Click <strong className="text-base-text font-bold">"Save & Update Roster"</strong> to apply changes permanently.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={() => setLocalUsers(users)}
              className="flex-1 md:flex-none px-4 py-2 border border-base-border text-base-muted hover:text-base-text font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface3 transition-all cursor-pointer text-xs"
            >
              Discard Changes
            </button>
            <button
              onClick={() => {
                onUpdateUsers(localUsers);
                showToast('success', 'All changes saved and broadcast successfully to the Live Cloud Sync!');
              }}
              className="flex-1 md:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md text-xs flex items-center justify-center gap-1.5 glow-green active:scale-[0.98]"
            >
              <Check className="h-4 w-4" />
              <span>Save & Update Roster</span>
            </button>
          </div>
        </div>
      )}

      {/* TWO COLUMN GRID WRAPPER */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
      
      {/* LEFT COLUMN: User Directory list */}
      <div className="w-full lg:w-80 flex flex-col gap-4 bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
        <div className="flex justify-between items-center pb-2 border-b border-base-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-base-accent" />
            <h2 className="font-condensed font-extrabold uppercase text-sm tracking-wide text-base-text">User roster roster</h2>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-2 py-1 bg-base-accent hover:bg-base-accent2 text-white font-condensed font-bold text-xxs uppercase tracking-wider rounded transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>

        {/* Searching field */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-base-muted2" />
          <input
            type="text"
            placeholder="Filter profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg outline-none focus:border-base-accent text-base-text font-semibold placeholder:font-normal"
          />
        </div>

        {/* Adds New User Roster Block Form Inline Modal */}
        {showAddForm && (
          <form onSubmit={handleCreateUser} className="bg-base-surface2 border border-base-accent/20 p-3.5 rounded-lg space-y-3 shadow-inner">
            <div className="text-[10px] uppercase font-condensed font-black tracking-widest text-[#9b1c2e]">Add New User Parameters</div>
            
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">User login ID (No spaces)</label>
              <input
                type="text"
                placeholder="e.g. suparman"
                required
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">Name Profile Details</label>
              <input
                type="text"
                placeholder="e.g. Suparman Batam"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">Initial Base Role</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRoleType)}
                className="w-full px-2 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none font-bold"
              >
                <option value="admin">Admin (Full Control)</option>
                <option value="manager">Manager (Edit Scope)</option>
                <option value="coordinator">Coordinator (Update Tasks)</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="facility maintanance">Facility Maintanance</option>
                <option value="quality control">Quality Control</option>
                <option value="safety">Safety</option>
                <option value="project control">Project Control</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase font-condensed font-bold text-base-muted tracking-wider">Temporary password</label>
              <input
                type="password"
                required
                placeholder="Set sign-in password..."
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-bg border border-base-border rounded text-xs outline-none"
              />
            </div>

            <div className="flex gap-1.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2.5 py-1 text-[10px] font-condensed uppercase font-bold border border-base-border rounded text-base-muted hover:bg-base-surface"
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 bg-[#9b1c2e] hover:bg-[#b02237] text-white font-condensed font-bold uppercase tracking-wider rounded text-[10px]"
              >
                Assemble user
              </button>
            </div>
          </form>
        )}

        {/* Directory List Container */}
        <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[500px] pr-1">
          {filteredUsers.length === 0 ? (
            <div className="text-xs text-base-muted italic text-center py-6">No users discovered.</div>
          ) : (
            filteredUsers.map(u => {
              const isSel = u.id === selectedUserId;
              const hasCustomAttrs = u.allowedFeatures !== undefined || u.allowedPermissions !== undefined;
              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isSel
                      ? 'bg-base-accent-dim/10 border-base-accent text-base-accent shadow-xs'
                      : 'bg-base-surface2 border-transparent hover:border-base-border text-base-muted2 hover:text-base-text'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-xs flex items-center gap-1.5 truncate text-base-text">
                      {u.currentSessionId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0" title="User is currently live & online" />
                      )}
                      <span className="truncate">{u.name}</span>
                      {u.id === currentUser?.id && (
                        <span className="shrink-0 scale-90 px-1 py-0.2 rounded-full text-[8px] uppercase bg-base-green/20 text-base-green font-bold tracking-tight">Active</span>
                      )}
                    </div>
                    <div className="text-[10px] text-base-muted flex items-center gap-1 items-baseline font-bold mt-0.5 uppercase tracking-wide truncate">
                      <span>({u.id})</span>
                      <span>•</span>
                      <span>{u.role}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {hasCustomAttrs && (
                      <span className="w-2 h-2 rounded-full bg-base-accent" title="Custom Permission Overrides Enabled" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUser(u.id);
                      }}
                      className="p-1 text-base-muted hover:text-base-red hover:bg-base-red/10 rounded-md transition-colors"
                      title="Permanently remove user"
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

      {/* RIGHT COLUMN: Studio Permissions Override Engine */}
      <div className="flex-1 bg-base-surface border border-base-border rounded-xl p-6 shadow-card flex flex-col gap-6">
        {selectedUser ? (
          <>
            {/* 1. Core Profile Details and Security Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-base-border">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-condensed font-black uppercase text-lg text-base-text leading-none">{selectedUser.name}</span>
                  <span className="px-2 py-0.5 bg-base-surface2 border border-base-border text-base-muted font-mono font-extrabold text-[10px] rounded tracking-wide leading-none">{selectedUser.id}</span>
                  {(selectedUser.allowedFeatures !== undefined || selectedUser.allowedPermissions !== undefined) && (
                    <span className="px-2 py-0.5 rounded-full bg-base-accent/15 text-base-accent border border-base-accent/25 text-[9px] uppercase font-extrabold tracking-wider leading-none">Custom rules active</span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base-muted2 text-[10px] uppercase font-condensed tracking-wider">Role profile:</span>
                    <select
                      value={selectedUser.role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRoleType)}
                      className="px-2 py-0.5 bg-base-bg border border-base-border border rounded font-bold text-xs uppercase cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="viewer">Viewer</option>
                      <option value="facility maintanance">Facility Maintanance</option>
                      <option value="quality control">Quality Control</option>
                      <option value="safety">Safety</option>
                      <option value="project control">Project Control</option>
                    </select>
                  </div>
                  
                  <span className="text-base-border">|</span>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-base-muted2 text-[10px] uppercase font-condensed tracking-wider">Change Display Name:</span>
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
                      className="px-2 py-0.5 bg-base-bg border border-base-border rounded text-xs font-bold w-40 outline-none focus:border-base-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Action utilities */}
              <div className="flex items-center gap-2 shrink-0">
                {isDirty && (
                  <button
                    onClick={() => {
                      onUpdateUsers(localUsers);
                      showToast('success', 'All changes saved and broadcast successfully to the Live Cloud Sync!');
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 glow-green shadow-md active:scale-95 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                )}

                <button
                  onClick={() => setShowPassReset(!showPassReset)}
                  className="px-3 py-1.5 bg-base-surface border border-base-border hover:bg-base-surface3 hover:text-base-text text-base-muted2 font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                  title="Modify user sign-in credentials"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Passcode</span>
                </button>
                
                {(selectedUser.allowedFeatures !== undefined || selectedUser.allowedPermissions !== undefined) && (
                  <button
                    onClick={handleResetToDefaults}
                    className="px-3 py-1.5 bg-base-surface hover:bg-base-accent-dim/15 hover:text-base-accent border border-base-border hover:border-base-accent/25 text-base-muted2 font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to default</span>
                  </button>
                )}
              </div>
            </div>

            {/* Password edit form toggler inline */}
            {showPassReset && (
              <div className="bg-amber-500/5 border border-amber-500/25 p-4 rounded-xl space-y-2.5 max-w-sm">
                <div className="text-[10px] uppercase font-condensed font-extrabold text-amber-500 tracking-wider flex items-center gap-1">
                  <Key className="w-4 h-4" />
                  <span>Credential Passcode Overrider</span>
                </div>
                <div className="text-[11px] text-base-muted">Update sign-in password for {selectedUser.name}.</div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Input new lockpass..."
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    className="flex-1 px-3 py-1 bg-base-bg border border-base-border rounded outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleUpdatePassword}
                    className="px-3 py-1 bg-amber-500 text-white font-condensed font-bold uppercase text-xs rounded transition-colors hover:bg-amber-600"
                  >
                    Apply Change
                  </button>
                </div>
              </div>
            )}

            {/* Live Session Status Panel */}
            <div className="bg-base-surface2 border border-base-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-condensed font-extrabold tracking-wider text-base-muted">Live Integration Status</span>
                  {selectedUser.currentSessionId ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] uppercase font-black tracking-wide animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Active Session</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-500 text-[10px] uppercase font-black tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                      <span>Offline</span>
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-base-muted max-w-xl leading-relaxed">
                  {selectedUser.currentSessionId ? (
                    <span>This user is currently logged in with active session token <code className="bg-base-bg px-1.5 py-0.5 rounded text-[10px] font-mono border border-base-border text-base-text font-bold">{selectedUser.currentSessionId.substring(0, 8)}...</code>. Any attempt to sign in from another browser or device will automatically invalidate this session and force a real-time logout on this device.</span>
                  ) : (
                    <span>No active live session is recorded in the cloud database for this user. The user will be initialized and authenticated upon their next secure portal sign-in.</span>
                  )}
                </p>
              </div>

              {selectedUser.currentSessionId && currentUser?.role === 'admin' && (
                <button
                  onClick={() => handleForceTerminateSession(selectedUser.id)}
                  className="px-3.5 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 hover:border-red-500/40 font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer hover:shadow-sm"
                  title="Force a real-time logout of this active session across all open browsers."
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Force Terminate</span>
                </button>
              )}
            </div>

            {/* Split Permissions Grid: Features (Left half) vs Controls (Right half) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              
              {/* FEATURE TABS ALLOWED SEGMENT */}
              <div className="space-y-3.5 bg-base-surface2 p-4 rounded-xl border border-base-border">
                <div className="flex justify-between items-center pb-1 border-b border-base-border/50">
                  <div>
                    <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Menu Feature access bounds</h3>
                    <p className="text-[11px] text-base-muted leading-tight mt-0.5">Choose which tabs this user is allowed to view in navigation menu</p>
                  </div>
                  {isSelectedUserUsingDefaultFeatures && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] uppercase bg-base-green/20 text-base-green font-bold shrink-0">Role Defaults</span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {activeTabsList
                    .filter(t => t.id !== 'users') // Keep user control secured
                    .map(t => {
                      const isDefaultVisible = getIsTabVisibleByDefault(t.id, selectedUser.role);
                      const isCurrentlyVisible = selectedUser.allowedFeatures 
                        ? selectedUser.allowedFeatures.includes(t.id)
                        : isDefaultVisible;

                      return (
                        <label
                          key={t.id}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                            isCurrentlyVisible
                              ? 'bg-base-bg border-base-green/20 text-base-text hover:bg-base-surface'
                              : 'bg-base-bg/50 border-base-border/50 text-base-muted hover:text-base-muted2 hover:bg-base-bg/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isCurrentlyVisible}
                              onChange={() => handleToggleTabVisibility(t.id)}
                              className="w-4 h-4 accent-base-accent shrink-0 rounded cursor-pointer"
                            />
                            <div className="truncate min-w-0">
                              <div className="text-xs font-bold text-base-text">{t.label} Tab</div>
                              <div className="text-[9px] text-base-muted leading-tight font-normal">
                                {isDefaultVisible ? 'Visible by default' : 'Hidden by default'} for the {selectedUser.role} role.
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-condensed font-bold px-1.5 py-0.5 rounded bg-base-surface border border-base-border font-mono">
                            {t.id}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* CONTROL PERMISSIONS SEGMENT */}
              <div className="space-y-3.5 bg-base-surface2 p-4 rounded-xl border border-base-border">
                <div className="flex justify-between items-center pb-1 border-b border-base-border/50">
                  <div>
                    <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Operational Action Permissions</h3>
                    <p className="text-[11px] text-base-muted leading-tight mt-0.5">Toggle what operations this user can trigger and execute</p>
                  </div>
                  {isSelectedUserUsingDefaultPermissions && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] uppercase bg-base-green/20 text-base-green font-bold shrink-0">Role Defaults</span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {permissionMeta.map(pMeta => {
                    const isDefaultAllowed = getIsPermissionAllowedByDefault(pMeta.id, selectedUser.role);
                    const isCurrentlyAllowed = selectedUser.allowedPermissions
                      ? !!selectedUser.allowedPermissions[pMeta.id]
                      : isDefaultAllowed;

                    return (
                      <label
                        key={pMeta.id}
                        className={`flex items-center justify-between px-3.5 py-2 rounded-lg border transition-all cursor-pointer font-semibold ${
                          isCurrentlyAllowed
                            ? 'bg-base-bg border-base-accent/20 text-base-text hover:bg-base-surface'
                            : 'bg-base-bg/50 border-base-border/50 text-base-muted hover:text-base-muted2 hover:bg-base-bg/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isCurrentlyAllowed}
                            onChange={() => handleTogglePermission(pMeta.id)}
                            className="w-4 h-4 accent-base-accent shrink-0 rounded cursor-pointer"
                          />
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-base-text">{pMeta.label}</div>
                            <div className="text-[9.5px] text-base-muted leading-tight font-normal truncate" title={pMeta.desc}>
                              {pMeta.desc}
                            </div>
                          </div>
                        </div>
                        <span className={`text-[9px] uppercase font-condensed font-black px-1.5 py-0.3 rounded border ${
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

            </div>

            {/* Note on sync and instant effect */}
            <div className="text-[11px] bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-lg flex items-start gap-2 text-base-muted italic">
              <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Staged Editing Engine:</strong> Access overrides processed above are drafted locally. They will not take effect on the workspace until you click <strong className="text-base-text font-bold">"Save Changes"</strong> or <strong className="text-base-text font-bold">"Save & Update Roster"</strong>. Once saved, active sessions are refreshed immediately.
              </span>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-base-muted flex flex-col items-center justify-center gap-2">
            <Users className="w-10 h-10 text-base-border" />
            <div className="text-sm font-semibold">No roster user currently selected.</div>
            <div className="text-xs">Create or search a user id from the left panel directory to start managing tabs and permissions.</div>
          </div>
        )}
      </div>
      </div>
      
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in animate-duration-200">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5 text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-full text-red-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1 select-none">
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
