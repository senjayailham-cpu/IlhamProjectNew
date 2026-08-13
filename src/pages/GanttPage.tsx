import React, { useState, useMemo } from 'react';
import { Project, User, OrgSettings } from '../types';
import GanttView from '../components/GanttView';
import { Briefcase, Calendar, AlertCircle, FileText, BarChart2 } from 'lucide-react';

interface GanttPageProps {
  projects: Project[];
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  externalRowKey?: string | null;
  onCloseDepModal?: () => void;
  currentUser: User | null;
  orgSettings?: OrgSettings;
  prefs?: any;
  onSetPref?: (key: string, value: any) => void;
}

export function GanttPage({ 
  projects, 
  onUpdateProject, 
  onOpenDepModal,
  depModalOpen,
  externalRowKey,
  onCloseDepModal,
  currentUser,
  orgSettings,
  prefs,
  onSetPref
}: GanttPageProps) {
  // Default selected month to 'ALL' so all projects are displayed by default
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(false);

  const activeProjects = useMemo(
    () => projects.filter(p => includeCompleted || (p.status !== 'completed' && !p.isArchived)),
    [projects, includeCompleted]
  );

  // Collect all available target months from projects
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    activeProjects.forEach(p => {
      if (p.targetMonth) {
        months.add(p.targetMonth);
      } else {
        const dateStr = p.start || p.created || '';
        if (dateStr && dateStr.length >= 7) {
          months.add(dateStr.slice(0, 7));
        }
      }
    });
    return Array.from(months).sort();
  }, [activeProjects]);

  // Filter projects by selected target month
  const projectsInMonth = useMemo(() => {
    if (selectedMonth === 'ALL') {
      return activeProjects;
    }
    return activeProjects.filter(p => {
      if (p.targetMonth) {
        return p.targetMonth === selectedMonth;
      }
      const fallbackM = (p.start || p.created || '').slice(0, 7);
      return fallbackM === selectedMonth;
    });
  }, [activeProjects, selectedMonth]);

  const hiddenCompletedCount = useMemo(
    () => projects.length - activeProjects.length,
    [projects, activeProjects]
  );

  // Handle saving back to original projects
  const handleUpdateProject = (updatedProj: Project) => {
    if (!onUpdateProject) return;
    onUpdateProject(updatedProj);
  };

  return (
    <div className="flex-1 flex flex-col p-5 space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col gap-2 bg-base-surface border border-base-border p-5 rounded-xl shadow-xs">
        <div className="flex items-center flex-wrap gap-3 sm:gap-4">
          <h1 className="font-condensed font-extrabold text-2xl tracking-tight text-base-text flex items-center gap-2 shrink-0">
            <BarChart2 className="h-6 w-6 text-base-accent shrink-0" />
            <span>Timeline Gantt Schedules</span>
          </h1>

          {/* Target Month Selector - Placed directly next to Timeline Gantt Schedules title */}
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 sm:ml-2">
              <label htmlFor="month-select" className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wider shrink-0">
                Target Month:
              </label>
              <div className="relative shrink-0">
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-base-text font-condensed uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-base-accent transition-all min-w-[200px]"
                >
                  <option value="ALL">ALL PROJECTS (SEMUA PROYEK)</option>
                  {availableMonths.map((m) => {
                    const [yr, mo] = m.split('-').map(Number);
                    const date = new Date(yr, mo - 1, 1);
                    const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
                    return (
                      <option key={m} value={m}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-base-muted text-[10px]">
                  ▼
                </div>
              </div>
            </div>
          )}

          {/* Toggle: Include Completed/Archived */}
          <label className="flex items-center gap-2 shrink-0 text-xs font-condensed font-bold text-base-muted uppercase tracking-wider cursor-pointer select-none sm:ml-2">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-base-border text-base-accent cursor-pointer"
            />
            Include Completed/Archived
            {!includeCompleted && hiddenCompletedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-base-surface2 text-base-muted2 text-[10px] normal-case font-mono">
                {hiddenCompletedCount} hidden
              </span>
            )}
          </label>
        </div>
        <p className="text-xs text-base-muted font-sans">
          Analyze, monitor, and coordinate assembly tasks, dependencies, and critical milestones in real time.
        </p>
      </div>

      {/* Main Gantt View Section */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-xs">
        <GanttView 
          projects={projectsInMonth} 
          onUpdateProject={handleUpdateProject} 
          onOpenDepModal={onOpenDepModal} 
          depModalOpen={depModalOpen}
          depModalRowKey={externalRowKey || undefined}
          onCloseDepModal={onCloseDepModal}
          currentUser={currentUser}
          orgSettings={orgSettings}
          prefs={prefs}
          onSetPref={onSetPref}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          availableMonths={availableMonths}
          includeCompleted={includeCompleted}
          setIncludeCompleted={setIncludeCompleted}
        />
      </div>
    </div>
  );
}
