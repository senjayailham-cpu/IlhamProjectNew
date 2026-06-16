import React, { useState } from 'react';
import { ActivityLog, Project } from '../types';
import { calcPct, esc } from '../utils/projectUtils';
import { FileText, Printer, Trash2, ArrowUp, ArrowDown, HelpCircle, Activity } from 'lucide-react';

interface DailyReportViewProps {
  projects: Project[];
  activityLogs: ActivityLog[];
  reportDate: string;
  setReportDate: (date: string) => void;
  clearActivityLogs: () => void;
  openPrintView: () => void;
}

const ACT_ICONS: Record<string, { label: string; color: string; bg: string }> = {
  task_progress: { label: 'Progress update', color: 'var(--accent)', bg: 'rgba(240,168,50,.12)' },
  task_toggle: { label: 'Task completion', color: 'var(--green)', bg: 'rgba(71,184,122,.12)' },
  task_add: { label: 'Task added', color: 'var(--blue)', bg: 'rgba(77,150,224,.15)' },
  task_delete: { label: 'Task deleted', color: 'var(--red)', bg: 'rgba(212,90,77,.12)' },
  project_add: { label: 'Project added', color: 'var(--blue)', bg: 'rgba(77,150,224,.15)' },
  project_edit: { label: 'Project edited', color: 'var(--accent)', bg: 'rgba(240,168,50,.12)' },
  project_delete: { label: 'Project deleted', color: 'var(--red)', bg: 'rgba(212,90,77,.12)' },
  assembly_add: { label: 'Assembly added', color: 'var(--blue)', bg: 'rgba(77,150,224,.15)' },
  assembly_edit: { label: 'Assembly edited', color: 'var(--accent)', bg: 'rgba(240,168,50,.12)' },
  assembly_delete: { label: 'Assembly deleted', color: 'var(--red)', bg: 'rgba(212,90,77,.12)' }
};

export default function DailyReportView({
  projects,
  activityLogs,
  reportDate,
  setReportDate,
  clearActivityLogs,
  openPrintView
}: DailyReportViewProps) {
  const [userCollapsed, setUserCollapsed] = useState<Record<string, boolean>>({});

  const shiftDate = (d: number) => {
    const dt = new Date(reportDate + 'T12:00:00');
    dt.setDate(dt.getDate() + d);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dt.toISOString().slice(0, 10) > todayStr) return; // boundary check
    setReportDate(dt.toISOString().slice(0, 10));
  };

  const jumpYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const jumpToday = () => {
    setReportDate(new Date().toISOString().slice(0, 10));
  };

  const formatHeaderLabel = () => {
    const d = new Date(reportDate + 'T12:00:00');
    const todayStr = new Date().toISOString().slice(0, 10);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);

    const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    if (reportDate === todayStr) return `TODAY — ${dateStr}`;
    if (reportDate === yestStr) return `YESTERDAY — ${dateStr}`;
    return `${dayName.toUpperCase()} — ${dateStr}`;
  };

  const currentDateObj = new Date(reportDate + 'T12:00:00');
  const curYear = currentDateObj.getFullYear();
  const curMonth = currentDateObj.getMonth();
  const curDay = currentDateObj.getDate();

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(curYear, val, 1);
    const maxDays = new Date(curYear, val + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDays);
    d.setDate(targetDay);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(curYear, curMonth, val);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(val, curMonth, 1);
    const maxDays = new Date(val, curMonth + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDays);
    d.setDate(targetDay);
    setReportDate(d.toISOString().slice(0, 10));
  };

  const MONTHS_LIST = [
    { value: 0, label: 'Jan' },
    { value: 1, label: 'Feb' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Apr' },
    { value: 4, label: 'May' },
    { value: 5, label: 'Jun' },
    { value: 6, label: 'Jul' },
    { value: 7, label: 'Aug' },
    { value: 8, label: 'Sep' },
    { value: 9, label: 'Oct' },
    { value: 10, label: 'Nov' },
    { value: 11, label: 'Dec' }
  ];

  const daysCount = new Date(curYear, curMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);
  const yearsArray = Array.from({ length: 11 }, (_, i) => 2024 + i); // 2024 to 2034

  const dayLogs = activityLogs
    .filter(log => log.date === reportDate)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  // Snapshot calculations
  const projectsSnapshot: Record<string, { id: string; name: string; changes: number; totalDelta: number }> = {};
  dayLogs.forEach(l => {
    if (!l.projectId) return;
    if (!projectsSnapshot[l.projectId]) {
      projectsSnapshot[l.projectId] = { id: l.projectId, name: l.projectName || '', changes: 0, totalDelta: 0 };
    }
    const delta = (l.newPct || 0) - (l.oldPct || 0);
    projectsSnapshot[l.projectId].changes++;
    projectsSnapshot[l.projectId].totalDelta += delta;
  });

  const uniqueActiveUsers = [...new Set(dayLogs.map(l => l.userId))].length;
  const progressUpdatesCount = dayLogs.filter(l => l.type === 'task_progress' || l.type === 'task_toggle').length;

  // Process overall portfolio progress impact
  const totalProjects = projects.length;
  let overallImpactScore = 0;
  if (totalProjects > 0) {
    const overallNow = Math.round(projects.reduce((s, p) => s + calcPct(p), 0) / totalProjects);
    let overallBefore = 0;
    projects.forEach(p => {
      let tasksSum = 0;
      let tasksCount = 0;
      (p.assemblies || []).forEach(a => {
        (a.tasks || []).forEach(t => {
          tasksCount++;
          tasksSum += t.pct || 0;
        });
      });
      tasksCount = tasksCount || 1;
      const snap = projectsSnapshot[p.id];
      const beforeSum = snap ? tasksSum - snap.totalDelta : tasksSum;
      overallBefore += Math.round(beforeSum / tasksCount);
    });
    overallBefore = Math.round(overallBefore / totalProjects);
    overallImpactScore = overallNow - overallBefore;
  }

  // Group logs by User
  const userGroups: Record<string, { name: string; role: string; entries: ActivityLog[] }> = {};
  dayLogs.forEach(l => {
    if (!userGroups[l.userId]) {
      userGroups[l.userId] = { name: l.userName, role: l.userRole, entries: [] };
    }
    userGroups[l.userId].entries.push(l);
  });

  const toggleUserCollapse = (uid: string) => {
    setUserCollapsed(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const collapseAll = () => {
    const coll: Record<string, boolean> = {};
    Object.keys(userGroups).forEach(uid => { coll[uid] = true; });
    setUserCollapsed(coll);
  };

  const expandAll = () => {
    setUserCollapsed({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
            Daily <span className="text-base-accent">Activities</span>
          </h2>

          {/* Date Picker Switcher */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
              title="Previous Day"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="flex items-center gap-0.5 font-condensed font-bold text-xs">
              {/* Day Dropdown */}
              <select
                value={curDay}
                onChange={handleDayChange}
                className="bg-transparent text-base-text py-0.5 px-1 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center"
              >
                {daysArray.map(d => (
                  <option key={d} value={d} className="bg-base-surface2 text-base-text font-sans">
                    {String(d).padStart(2, '0')}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Month Dropdown */}
              <select
                value={curMonth}
                onChange={handleMonthChange}
                className="bg-transparent text-base-text py-0.5 px-1 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors uppercase text-center"
              >
                {MONTHS_LIST.map(m => (
                  <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Year Dropdown */}
              <select
                value={curYear}
                onChange={handleYearChange}
                className="bg-transparent text-base-text py-0.5 px-0.5 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center"
              >
                {yearsArray.map(y => (
                  <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
              title="Next Day"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button
            onClick={jumpYesterday}
            className="px-2.5 py-1.5 border border-base-border hover:bg-base-surface3 text-base-muted2 rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
          >
            Yesterday
          </button>
          <button
            onClick={jumpToday}
            className="px-2.5 py-1.5 border border-base-blue/20 hover:bg-base-blue-dim text-base-blue rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openPrintView}
            className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4 text-base-accent" />
            <span>Print PDF</span>
          </button>
          <button
            onClick={clearActivityLogs}
            className="btn btn-sm btn-danger flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {dayLogs.length === 0 ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
          <FileText className="h-10 w-10 text-base-border mb-3" />
          <p className="text-sm font-semibold">No activity logs recorded for this date.</p>
          <p className="text-xs text-base-muted2 mt-1">Changes are tracked automatically as coordinators update sub-assemblies and schedules.</p>
        </div>
      ) : (
        <>
          {/* KPI Widget Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-accent">
              <div className="text-[28px] font-condensed font-extrabold text-base-accent leading-none">{dayLogs.length}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Total updates</div>
            </div>
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-blue">
              <div className="text-[28px] font-condensed font-extrabold text-base-blue leading-none">{uniqueActiveUsers}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Active users</div>
            </div>
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-green">
              <div className="text-[28px] font-condensed font-extrabold text-base-green leading-none">{progressUpdatesCount}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Progress updates</div>
            </div>
            <div className={`bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 ${
              overallImpactScore > 0 ? 'border-b-base-green' : overallImpactScore < 0 ? 'border-b-base-red' : 'border-b-base-border'
            }`}>
              <div className={`text-[28px] font-condensed font-extrabold leading-none ${
                overallImpactScore > 0 ? 'text-base-green' : overallImpactScore < 0 ? 'text-base-red' : 'text-base-muted2'
              }`}>
                {overallImpactScore > 0 ? `+${overallImpactScore}` : overallImpactScore}%
              </div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Portfolio Impact</div>
            </div>
          </div>

          {/* Touched Project Progress Section */}
          {Object.keys(projectsSnapshot).length > 0 && (
            <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
              <div className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center gap-2">
                <Activity className="h-4 w-4 text-base-accent" />
                <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Projects touched today</h3>
              </div>
              <div className="divide-y divide-base-border/40">
                {Object.entries(projectsSnapshot).map(([pid, info], i) => {
                  const proj = projects.find(x => x.id === pid);
                  const curPct = proj ? calcPct(proj) : 0;
                  return (
                    <div key={pid} className="flex px-4 py-3 items-center justify-between gap-4 text-xs">
                      <div className="font-bold text-base-text flex-1 truncate min-width-0" title={info.name}>{info.name}</div>
                      <div className="flex-1 max-w-[200px] h-1.5 bg-base-border/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-base-accent transition-all duration-500 ease-out" style={{ width: `${curPct}%` }} />
                      </div>
                      <div className="font-condensed font-bold text-sm text-base-muted2 min-width-[34px] text-right">{curPct}%</div>
                      <span className={`font-condensed font-extrabold text-sm ml-4 min-width-[40px] text-right ${
                        info.totalDelta > 0 ? 'text-base-green' : info.totalDelta < 0 ? 'text-base-red' : 'text-base-muted'
                      }`}>
                        {info.totalDelta > 0 ? `+${info.totalDelta}` : info.totalDelta}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity by User */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-condensed font-bold uppercase text-xs tracking-widest text-base-muted">Activity by user</h3>
              <div className="flex gap-2">
                <button onClick={collapseAll} className="px-2.5 py-1 text-[10px] uppercase font-condensed font-extrabold border border-base-border hover:bg-base-surface3 rounded-lg text-base-muted2 cursor-pointer flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" /> Collapse All
                </button>
                <button onClick={expandAll} className="px-2.5 py-1 text-[10px] uppercase font-condensed font-extrabold border border-base-border hover:bg-base-surface3 rounded-lg text-base-muted2 cursor-pointer flex items-center gap-1">
                  <ArrowDown className="h-3 w-3" /> Expand All
                </button>
              </div>
            </div>

            {Object.entries(userGroups).map(([uid, ug]) => {
              const init = ug.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const isColl = !!userCollapsed[uid];

              return (
                <div key={uid} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
                  {/* Collapsible item leader bar */}
                  <div
                    onClick={() => toggleUserCollapse(uid)}
                    className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-base-surface3/40"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 text-base-muted transition-transform ${isColl ? '-rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <div className="h-7 w-7 rounded-full bg-base-accent-dim text-base-accent flex items-center justify-center font-condensed font-extrabold text-[11px]">
                        {init}
                      </div>
                      <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">{ug.name}</span>
                      <span className="text-[10px] text-base-muted uppercase font-bold">{ug.role}</span>
                    </div>
                    <span className="text-xs text-base-muted">{ug.entries.length} log{ug.entries.length !== 1 ? 's' : ''} submitted</span>
                  </div>

                  {/* List expanded rows */}
                  {!isColl && (
                    <div className="divide-y divide-base-border/30">
                      {ug.entries.map(e => {
                        const meta = ACT_ICONS[e.type] || { label: 'Audit Log', color: 'var(--muted)', bg: 'rgba(0,0,0,.05)' };
                        const delta = (e.newPct || 0) - (e.oldPct || 0);

                        return (
                          <div key={e.id} className="p-3.5 sm:px-5 flex items-start gap-3 hover:bg-base-surface2/10 transition-colors">
                            <span className="text-[11px] font-condensed font-semibold text-base-muted w-14 pt-0.5">{e.time}</span>
                            <div className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg }}>
                              <svg viewBox="0 0 24 24" className="h-3 w-3" style={{ stroke: meta.color }} fill="none" strokeWidth="3" strokeLinecap="round">
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            </div>
                            <div className="flex-1 text-xs text-base-muted2 leading-relaxed">
                              <span className="font-bold text-base-text">{e.action}</span>
                              {e.taskName && (
                                <span className="font-medium text-base-text">: "{e.taskName}"</span>
                              )}
                              {e.assemblyName && (
                                <span> in <em>{e.assemblyName}</em></span>
                              )}
                              {e.projectName && (
                                <span className="block text-base-accent font-condensed font-bold uppercase tracking-wider text-[11px] mt-0.5">{e.projectName}</span>
                              )}
                              {e.detail && (
                                <span className="block text-base-muted mt-1 bg-base-surface2/50 border border-base-border/50 rounded-sm p-2 ml-1 italic font-medium">"{e.detail}"</span>
                              )}
                            </div>

                            {/* Render delta pills for progress edits */}
                            {(e.type === 'task_progress' || e.type === 'task_toggle') && delta !== 0 && (
                              <span className={`px-2 py-0.5 rounded font-condensed font-extrabold text-[10px] flex items-center gap-0.5 select-none ${
                                delta > 0 ? 'bg-base-green-dim text-base-green' : 'bg-base-red-dim text-base-red'
                              }`}>
                                {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
