import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, Project, ActivityLog } from '../types';
import { Bell, AlertTriangle, Clock, CheckCircle, Activity, Users } from 'lucide-react';

interface NotificationPanelProps {
  projects: Project[];
  activityLogs: ActivityLog[];
  currentUser: User;
  users: User[];
  activeTab: string;       // current user's active page
}

interface AppNotification {
  id: string;
  type: 'overdue' | 'warning' | 'success' | 'info';
  title: string;
  subtitle: string;
  timestamp: Date;
  projectId?: string;
  isRead: boolean;
}

interface PresenceData {
  userId: string;
  userName: string;
  activeTab: string;
  lastSeen: any;
  isOnline: boolean;
}

const tabNameMap: Record<string, string> = {
  'dash': 'Dashboard',
  'gantt': 'Gantt chart',
  'focus24': 'Focus 24h',
  'current': 'Active projects',
  'timesheet': 'Timesheet',
  'inspections': 'QC Inspection',
  'wire': 'Wire log',
  'materials': 'Materials',
  'dailyreport': 'Daily report',
  'employees': 'Team',
  'users': 'Admin',
};

// HELPER FUNCTIONS
function initials(name: string): string {
  if (!name) return 'U';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isActiveRecently(lastSeen: any): boolean {
  try {
    if (!lastSeen) return true; // Treat newly created / null as active
    const date = lastSeen?.toDate?.() ?? new Date(lastSeen);
    return Date.now() - date.getTime() < 5 * 60 * 1000; // 5 minutes
  } catch {
    return false;
  }
}

export function NotificationPanel({
  projects,
  activityLogs,
  currentUser,
  users,
  activeTab,
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [presenceList, setPresenceList] = useState<PresenceData[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Read state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`notif_read_${currentUser.id}`);
      if (stored) {
        setReadIds(JSON.parse(stored));
      } else {
        setReadIds([]);
      }
    } catch (e) {
      console.warn('Failed to load read notification IDs:', e);
    }
  }, [currentUser.id]);

  // Outside click listener to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Current user's presence setup & unload cleanup
  useEffect(() => {
    if (!currentUser?.id) return;

    const userPresenceRef = doc(db, 'presence', currentUser.id);

    const initPresence = async () => {
      try {
        await setDoc(userPresenceRef, {
          userId: currentUser.id,
          userName: currentUser.name,
          activeTab: activeTab,
          lastSeen: serverTimestamp(),
          isOnline: true,
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to set initial presence:', e);
      }
    };

    initPresence();

    const markOffline = async () => {
      try {
        await updateDoc(userPresenceRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Failed to mark presence offline:', e);
      }
    };

    window.addEventListener('beforeunload', markOffline);

    return () => {
      markOffline();
      window.removeEventListener('beforeunload', markOffline);
    };
  }, [currentUser?.id]);

  // Current user's tab update
  useEffect(() => {
    if (!currentUser?.id) return;
    const userPresenceRef = doc(db, 'presence', currentUser.id);

    const updatePresenceTab = async () => {
      try {
        await updateDoc(userPresenceRef, {
          activeTab: activeTab,
          lastSeen: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Failed to update presence tab:', e);
      }
    };

    updatePresenceTab();
  }, [activeTab, currentUser?.id]);

  // Listen to all user presences
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'presence'), (snap) => {
        const list = snap.docs.map(d => d.data() as PresenceData);
        setPresenceList(list);
      }, (error) => {
        console.warn('Presence onSnapshot failure (usually rules block):', error);
      });
      return unsub;
    } catch (e) {
      console.warn('Presence snapshot failed to initialize:', e);
    }
  }, []);

  // Compute Notifications
  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTime = new Date(todayStr).getTime();
    
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysFromNowStr = threeDaysFromNow.toISOString().slice(0, 10);

    const overdueTaskIds = new Set<string>();

    // 1. OVERDUE TASKS
    const overdueItems: AppNotification[] = [];
    projects.forEach(project => {
      if (project.assemblies) {
        project.assemblies.forEach(assembly => {
          if (assembly.tasks) {
            assembly.tasks.forEach(task => {
              if (task.finishDate && task.finishDate < todayStr && task.pct < 100 && !task.done) {
                const overdueDate = new Date(task.finishDate);
                const daysOverdue = Math.max(1, Math.floor((todayTime - overdueDate.getTime()) / (1000 * 60 * 60 * 24)));
                
                overdueTaskIds.add(task.id);
                
                overdueItems.push({
                  id: `overdue_${task.id}`,
                  type: 'overdue',
                  title: `${task.name} — overdue`,
                  subtitle: `${project.name} · assigned to ${task.assigned || 'Unassigned'} · ${daysOverdue} day(s) overdue`,
                  timestamp: overdueDate,
                  projectId: project.id,
                  isRead: false,
                });
              }
            });
          }
        });
      }
    });

    // Sort overdue: most overdue first (ascending due date timestamp)
    overdueItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    list.push(...overdueItems);

    // 2. WARNING TASKS
    const warningItems: AppNotification[] = [];
    projects.forEach(project => {
      if (project.assemblies) {
        project.assemblies.forEach(assembly => {
          if (assembly.tasks) {
            assembly.tasks.forEach(task => {
              if (task.finishDate && task.finishDate >= todayStr && task.finishDate <= threeDaysFromNowStr && task.pct < 80 && !task.done) {
                if (overdueTaskIds.has(task.id)) return;
                
                const dueDate = new Date(task.finishDate);
                const daysLeft = Math.max(0, Math.ceil((dueDate.getTime() - todayTime) / (1000 * 60 * 60 * 24)));
                
                warningItems.push({
                  id: `warning_${task.id}`,
                  type: 'warning',
                  title: `Due in ${daysLeft} day(s) — ${task.name}`,
                  subtitle: `${project.name} · ${task.pct}% complete`,
                  timestamp: dueDate,
                  projectId: project.id,
                  isRead: false,
                });
              }
            });
          }
        });
      }
    });

    // Sort warnings: closest due date first
    warningItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    list.push(...warningItems);

    // 3. SUCCESS TASKS (recently completed)
    const successItems: AppNotification[] = [];
    const taskToggleLogs = activityLogs.filter(log => log.type === 'task_toggle');

    taskToggleLogs.forEach(log => {
      const logTime = log.ts ? new Date(log.ts) : null;
      if (logTime && (Date.now() - logTime.getTime() < 24 * 60 * 60 * 1000)) {
        const actionLower = log.action ? log.action.toLowerCase() : '';
        if (actionLower.includes('done') || actionLower.includes('100%')) {
          const title = log.action.length > 60 ? log.action.slice(0, 57) + '...' : log.action;
          successItems.push({
            id: `success_${log.id}`,
            type: 'success',
            title,
            subtitle: `${log.projectName || 'Project'} · ${log.userName} · ${formatTimeAgo(logTime)}`,
            timestamp: logTime,
            projectId: log.projectId,
            isRead: false,
          });
        }
      }
    });

    successItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    list.push(...successItems.slice(0, 3));

    // 4. INFO TASKS (recent activity by other users)
    const infoItems: AppNotification[] = [];
    const otherLogs = activityLogs.filter(log => log.userId !== currentUser.id);

    otherLogs.forEach(log => {
      const logTime = log.ts ? new Date(log.ts) : null;
      if (logTime) {
        const title = log.action && log.action.length > 60 ? log.action.slice(0, 57) + '...' : (log.action || '');
        infoItems.push({
          id: `info_${log.id}`,
          type: 'info',
          title,
          subtitle: `${log.userName} · ${log.projectName || ''} · ${formatTimeAgo(logTime)}`,
          timestamp: logTime,
          projectId: log.projectId,
          isRead: false,
        });
      }
    });

    infoItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    list.push(...infoItems.slice(0, 5));

    return list.slice(0, 20);
  }, [projects, activityLogs, currentUser.id]);

  // Unread Count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Online Users filter
  const onlineUsers = useMemo(() => {
    return presenceList.filter(p => {
      if (p.userId === currentUser.id) return false;
      if (p.isOnline !== true) return false;
      return isActiveRecently(p.lastSeen);
    });
  }, [presenceList, currentUser.id]);

  // Mark all read
  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(`notif_read_${currentUser.id}`, JSON.stringify(allIds));
    } catch (e) {
      console.warn('Failed to save read notification IDs to storage:', e);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'overdue': return 'var(--red)';
      case 'warning': return 'var(--accent)';
      case 'success': return 'var(--green)';
      case 'info':
      default:
        return 'transparent';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-base-border hover:bg-base-surface2 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-base-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-base-red text-white text-[9px] font-condensed font-black flex items-center justify-center border border-base-surface leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[380px] max-h-[520px] bg-base-surface border border-base-border rounded-xl z-50 overflow-hidden flex flex-col shadow-xl animate-in fade-in-50 slide-in-from-top-1 duration-150">
          
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-surface2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-condensed font-extrabold text-xs uppercase tracking-widest text-base-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-base-red-dim text-base-red text-[9px] font-condensed font-black uppercase">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={markAllRead}
              className="text-[10px] font-condensed font-bold text-base-accent hover:opacity-85 uppercase tracking-wider cursor-pointer"
            >
              Mark all read
            </button>
          </div>

          {/* Scrollable Notification List */}
          <div className="flex-1 overflow-y-auto max-h-[280px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="h-8 w-8 text-base-muted opacity-30" />
                <p className="text-[11px] text-base-muted font-condensed uppercase tracking-wider">
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = readIds.includes(n.id);
                const typeColor = getTypeColor(n.type);

                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b border-base-border cursor-default transition-colors hover:bg-base-surface2/50 ${
                      !isRead ? 'bg-base-surface' : 'opacity-70'
                    } border-l-2`}
                    style={{ borderLeftColor: typeColor }}
                  >
                    {/* Left Icon */}
                    <div className="flex-shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        n.type === 'overdue' ? 'bg-base-red-dim/15 text-base-red' :
                        n.type === 'warning' ? 'bg-base-accent-dim/15 text-base-accent' :
                        n.type === 'success' ? 'bg-base-green-dim/15 text-base-green' :
                        'bg-base-surface3 text-base-muted'
                      }`}>
                        {n.type === 'overdue' && <AlertTriangle className="h-3.5 w-3.5" />}
                        {n.type === 'warning' && <Clock className="h-3.5 w-3.5" />}
                        {n.type === 'success' && <CheckCircle className="h-3.5 w-3.5" />}
                        {n.type === 'info' && <Activity className="h-3.5 w-3.5" />}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-base-text leading-tight truncate">
                        {n.title}
                      </p>
                      <p className="text-[10px] text-base-muted mt-0.5 leading-tight line-clamp-2">
                        {n.subtitle}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-base-muted flex-shrink-0">
                      {formatTimeAgo(n.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Who's Online Section */}
          <div className="border-t border-base-border bg-base-surface2 px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-condensed font-extrabold text-[9px] uppercase tracking-widest text-base-muted flex items-center gap-1">
                <Users className="h-3 w-3 text-base-accent" />
                Online now
              </span>
              <span className="text-[9px] text-base-muted">
                {onlineUsers.length + 1} active
              </span>
            </div>

            <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1">
              {/* Current user - always shown first */}
              <div className="flex items-center gap-2">
                <div className="relative flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-base-accent-dim flex items-center justify-center text-[9px] font-condensed font-black text-base-accent border border-base-accent/20">
                    {initials(currentUser.name)}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border border-base-surface2"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-base-text font-medium">
                    {currentUser.name} (you)
                  </span>
                  <span className="text-[9px] text-base-muted ml-1">
                    · {tabNameMap[activeTab] || 'App'}
                  </span>
                </div>
              </div>

              {/* Other online users */}
              {onlineUsers.map(presence => (
                <div key={presence.userId} className="flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-base-surface3 border border-base-border flex items-center justify-center text-[9px] font-condensed font-black text-base-muted">
                      {initials(presence.userName)}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-base-surface2 ${
                      isActiveRecently(presence.lastSeen) ? 'bg-green-500' : 'bg-yellow-400'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-base-text font-medium">
                      {presence.userName}
                    </span>
                    <span className="text-[9px] text-base-muted ml-1">
                      · {tabNameMap[presence.activeTab] || 'App'}
                    </span>
                  </div>
                  <span className="text-[9px] text-base-muted flex-shrink-0">
                    {presence.lastSeen ? formatTimeAgo(presence.lastSeen?.toDate?.() ?? new Date(presence.lastSeen)) : 'just now'}
                  </span>
                </div>
              ))}

              {onlineUsers.length === 0 && (
                <p className="text-[10px] text-base-muted italic">No other users online</p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
