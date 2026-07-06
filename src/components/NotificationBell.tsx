import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle2, Activity } from 'lucide-react';
import { Project, ActivityLog, User } from '../types';

interface NotificationBellProps {
  projects: Project[];
  activities: ActivityLog[];
  currentUser: User;
}

interface AppNotif {
  id: string;
  kind: 'overdue' | 'due-soon' | 'completed' | 'activity';
  title: string;
  detail: string;
  ts: number;           // unix ms for sorting
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell({ projects, activities, currentUser }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due-soon' | 'activity'>('all');

  // Load and memoize reading state
  const STORAGE_KEY = `ab_notif_read_${currentUser.id}`;
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setReadIds(new Set(saved ? JSON.parse(saved) : []));
  }, [currentUser.id, STORAGE_KEY]);

  // Generate notifications
  const notifs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueList: AppNotif[] = [];
    const overdueKeys = new Set<string>();

    // 1. Overdue
    projects.forEach(project => {
      if (project.status !== 'active') return;
      project.assemblies?.forEach(assembly => {
        assembly.tasks?.forEach(task => {
          if (
            task.finishDate &&
            task.pct < 100 &&
            task.done !== true &&
            task.isMilestone !== true
          ) {
            const finishDateObj = new Date(task.finishDate);
            if (!isNaN(finishDateObj.getTime())) {
              const taskFinishDateNoHours = new Date(task.finishDate);
              taskFinishDateNoHours.setHours(0, 0, 0, 0);

              if (taskFinishDateNoHours < today) {
                const diffTime = today.getTime() - taskFinishDateNoHours.getTime();
                const daysOverdue = Math.floor(diffTime / 86400000);
                const taskKey = `${project.id}_${assembly.id}_${task.id}`;
                const id = `overdue_${project.id}_${assembly.id}_${task.id}`;
                
                overdueList.push({
                  id,
                  kind: 'overdue',
                  title: `⚠ Overdue — ${task.name}`,
                  detail: `${project.name} (${project.client}) · ${daysOverdue}d overdue`,
                  ts: finishDateObj.getTime()
                });
                overdueKeys.add(taskKey);
              }
            }
          }
        });
      });
    });
    // Sort: most overdue first (lowest ts first)
    overdueList.sort((a, b) => a.ts - b.ts);

    // 2. Due soon
    const dueSoonList: AppNotif[] = [];
    projects.forEach(project => {
      if (project.status !== 'active') return;
      project.assemblies?.forEach(assembly => {
        assembly.tasks?.forEach(task => {
          const taskKey = `${project.id}_${assembly.id}_${task.id}`;
          if (overdueKeys.has(taskKey)) return;

          if (
            task.finishDate &&
            task.pct < 100 &&
            task.done !== true
          ) {
            const finishDateObj = new Date(task.finishDate);
            if (!isNaN(finishDateObj.getTime())) {
              const taskFinishDateNoHours = new Date(task.finishDate);
              taskFinishDateNoHours.setHours(0, 0, 0, 0);

              const diffTime = taskFinishDateNoHours.getTime() - today.getTime();
              const daysLeft = Math.floor(diffTime / 86400000);

              if (daysLeft >= 0 && daysLeft <= 3) {
                const id = `due_${project.id}_${assembly.id}_${task.id}`;
                dueSoonList.push({
                  id,
                  kind: 'due-soon',
                  title: daysLeft === 0
                    ? `🔔 Due today — ${task.name}`
                    : `🔔 Due in ${daysLeft}d — ${task.name}`,
                  detail: `${project.name} · ${task.pct}% done · ${assembly.name}`,
                  ts: finishDateObj.getTime()
                });
              }
            }
          }
        });
      });
    });
    // Sort: soonest first
    dueSoonList.sort((a, b) => a.ts - b.ts);

    // Sort activities for recent logs
    const sortedActivities = [...activities].sort((a, b) => {
      const tsA = a.ts || (a as any).timestamp || 0;
      const tsB = b.ts || (b as any).timestamp || 0;
      const tA = new Date(tsA).getTime();
      const tB = new Date(tsB).getTime();
      return tB - tA;
    });

    // 3. Completed
    const completedList: AppNotif[] = [];
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;

    sortedActivities.forEach(activity => {
      const actTsStr = activity.ts || (activity as any).timestamp;
      if (!actTsStr) return;
      const actTime = new Date(actTsStr).getTime();
      if (isNaN(actTime) || actTime < fortyEightHoursAgo) return;

      const isTaskToggle = String(activity.type).toLowerCase() === 'task_toggle';
      const actionText = (activity.action || '').toLowerCase();
      const matchesAction = actionText.includes('100%') || actionText.includes('done') || actionText.includes('complete');

      if (isTaskToggle && matchesAction) {
        completedList.push({
          id: `done_${activity.id}`,
          kind: 'completed',
          title: `✓ ${activity.taskName || activity.action.slice(0, 50)}`,
          detail: `${activity.projectName || ''} · by ${activity.userName} · ${timeAgo(actTsStr)}`,
          ts: actTime
        });
      }
    });
    const finalCompletedList = completedList.slice(0, 5);

    // 4. Activity
    const activityList: AppNotif[] = [];
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    sortedActivities.forEach(activity => {
      const actTsStr = activity.ts || (activity as any).timestamp;
      if (!actTsStr) return;
      const actTime = new Date(actTsStr).getTime();
      if (isNaN(actTime) || actTime < twentyFourHoursAgo) return;

      if (currentUser && activity.userId === currentUser.id) return;

      const actType = String(activity.type).toLowerCase();
      const isExcludedType = ['auth_login', 'auth_logout', 'presence_heartbeat'].includes(actType);

      if (!isExcludedType) {
        activityList.push({
          id: `act_${activity.id}`,
          kind: 'activity',
          title: activity.action ? activity.action.slice(0, 60) : 'Activity updated',
          detail: `${activity.userName}${activity.projectName ? ' · ' + activity.projectName : ''} · ${timeAgo(actTsStr)}`,
          ts: actTime
        });
      }
    });
    const finalActivityList = activityList.slice(0, 8);

    // Combined capped list
    const combined = [...overdueList, ...dueSoonList, ...finalCompletedList, ...finalActivityList];
    return combined.slice(0, 25);
  }, [projects, activities, currentUser.id]);

  const markAllRead = () => {
    const allIds = notifs.map(n => n.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    setReadIds(new Set(allIds));
  };

  const handleNotifClick = (id: string) => {
    const updated = new Set(readIds);
    if (!updated.has(id)) {
      updated.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(updated)));
      setReadIds(updated);
    }
  };

  const unreadCount = useMemo(
    () => notifs.filter(n => !readIds.has(n.id)).length,
    [notifs, readIds]
  );

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifs;
    if (filter === 'activity') {
      return notifs.filter(n => n.kind === 'activity' || n.kind === 'completed');
    }
    return notifs.filter(n => n.kind === filter);
  }, [notifs, filter]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          setOpen(o => !o);
        }}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-base-border hover:bg-base-surface2 transition-colors cursor-pointer"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <Bell className="h-[18px] w-[18px] text-base-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-base-red text-white text-[9px] font-condensed font-black flex items-center justify-center border border-base-surface leading-none pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-h-[480px] bg-base-surface border border-base-border rounded-xl shadow-lg overflow-hidden flex flex-col z-50">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-surface2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-condensed font-extrabold text-[11px] uppercase tracking-widest text-base-text">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-base-red-dim text-base-red text-[9px] font-condensed font-black">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-base-muted font-condensed">
                {notifs.length} total
              </span>
              <button
                onClick={markAllRead}
                className="text-[10px] font-condensed font-bold text-base-accent hover:text-base-accent/80 uppercase tracking-wider cursor-pointer transition-colors"
              >
                Mark all read
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-base-border bg-base-surface2 flex-shrink-0 overflow-x-auto">
            {(['all', 'overdue', 'due-soon', 'activity'] as const).map(f => {
              const count = f === 'all' ? notifs.length
                : f === 'overdue' ? notifs.filter(n => n.kind === 'overdue').length
                : f === 'due-soon' ? notifs.filter(n => n.kind === 'due-soon').length
                : notifs.filter(n => n.kind === 'activity' || n.kind === 'completed').length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-condensed font-bold uppercase tracking-wider cursor-pointer transition-colors flex-shrink-0
                    ${filter === f
                      ? 'bg-base-accent-dim text-base-accent'
                      : 'text-base-muted hover:text-base-text'}`}
                >
                  {f === 'all' ? `All (${count})`
                    : f === 'overdue' ? `Overdue (${count})`
                    : f === 'due-soon' ? `Due soon (${count})`
                    : `Activity (${count})`}
                </button>
              );
            })}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1 divide-y divide-base-border">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Bell className="h-10 w-10 text-base-muted opacity-20" />
                <p className="text-[11px] text-base-muted font-condensed uppercase tracking-wider">
                  No notifications
                </p>
              </div>
            ) : (
              filtered.map(notif => {
                const isRead = readIds.has(notif.id);
                const borderColor = {
                  overdue: 'var(--red)',
                  'due-soon': 'var(--accent)',
                  completed: 'var(--green)',
                  activity: 'transparent',
                }[notif.kind];

                const Icon = {
                  overdue: AlertTriangle,
                  'due-soon': Clock,
                  completed: CheckCircle2,
                  activity: Activity,
                }[notif.kind];

                const iconStyle = {
                  overdue: 'bg-base-red-dim text-base-red',
                  'due-soon': 'bg-base-accent-dim text-base-accent',
                  completed: 'bg-base-green-dim text-base-green',
                  activity: 'bg-base-surface3 text-base-muted',
                }[notif.kind];

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotifClick(notif.id)}
                    style={{ borderLeftColor: borderColor, borderLeftWidth: '2px' }}
                    className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer select-none
                      ${isRead
                        ? 'opacity-60 hover:opacity-90 bg-base-surface'
                        : 'bg-base-accent-dim/10 hover:bg-base-surface2'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${iconStyle}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] text-base-text leading-snug truncate ${isRead ? 'font-medium' : 'font-extrabold'}`}>
                        {notif.title}
                      </p>
                      <p className="text-[10px] text-base-muted mt-0.5 leading-snug line-clamp-2">
                        {notif.detail}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-between flex-shrink-0 mt-0.5 gap-2">
                      <span className="text-[10px] text-base-muted whitespace-nowrap font-mono">
                        {timeAgo(new Date(notif.ts).toISOString())}
                      </span>
                      {!isRead && (
                        <span className="h-2 w-2 rounded-full bg-base-accent animate-pulse" title="Unread" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-base-border bg-base-surface2 flex-shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-base-muted font-condensed uppercase tracking-wider">
              Based on active projects · updates live
            </span>
            <span className="text-[10px] text-base-muted font-condensed">
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
