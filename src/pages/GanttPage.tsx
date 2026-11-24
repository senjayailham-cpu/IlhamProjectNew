import React, { useState, useMemo } from 'react';
import { Project, User, OrgSettings, TimesheetEntry } from '../types';
import GanttView from '../components/GanttView';
import { Briefcase, Calendar, AlertCircle, FileText, BarChart2 } from 'lucide-react';

interface GanttPageProps {
  projects: Project[];
  timesheets?: TimesheetEntry[];
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  externalRowKey?: string | null;
  onCloseDepModal?: () => void;
  currentUser: User | null;
  orgSettings?: OrgSettings;
  prefs?: any;
  onSetPref?: (key: string, value: any) => void;
  embedded?: boolean;
}

export function GanttPage({ 
  projects, 
  timesheets = [],
  onUpdateProject, 
  onOpenDepModal,
  depModalOpen,
  externalRowKey,
  onCloseDepModal,
  currentUser,
  orgSettings,
  prefs,
  onSetPref,
  embedded = false
}: GanttPageProps) {
  // Default selected month to 'ALL' so all projects are displayed by default
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [includeCompleted, setIncludeCompleted] = useState<boolean>(false);

  const activeProjects = useMemo(
    () => projects.filter(p => {
      // Archive tidak masuk default
      if (p.isArchived) return false;
      if (includeCompleted) return true;
      return p.status === 'active' || p.status === 'pending' || p.status === 'on-hold';
    }),
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

  const filterControls = (
    <div className="flex items-center flex-wrap gap-3 sm:gap-4">
      {availableMonths.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="month-select" className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wider shrink-0">
            Target Bulan:
          </label>
          <div className="relative shrink-0">
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-base-text font-condensed uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-base-accent transition-all min-w-[200px]"
            >
              <option value="ALL">SEMUA PROYEK (ALL)</option>
              {availableMonths.map((m) => {
                const [yr, mo] = m.split('-').map(Number);
                const date = new Date(yr, mo - 1, 1);
                const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
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

      <label className="flex items-center gap-2 shrink-0 text-xs font-condensed font-bold text-base-muted uppercase tracking-wider cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeCompleted}
          onChange={(e) => setIncludeCompleted(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-base-border text-base-accent cursor-pointer"
        />
        Tampilkan Proyek Selesai
        {!includeCompleted && hiddenCompletedCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-base-surface2 text-base-muted2 text-[10px] normal-case font-mono">
            {hiddenCompletedCount} disembunyikan
          </span>
        )}
      </label>
    </div>
  );

  return (
    <div className={`flex-1 flex flex-col animate-in fade-in duration-200 ${embedded ? 'space-y-2' : 'p-4 sm:p-5 space-y-4'}`}>
      {!embedded && (
        <div className="flex flex-col gap-2 bg-base-surface border border-base-border p-4 rounded-xl shadow-xs">
          <div className="flex items-center flex-wrap gap-3 sm:gap-4">
            <h1 className="font-condensed font-extrabold text-2xl tracking-tight text-base-text flex items-center gap-2 shrink-0">
              <BarChart2 className="h-6 w-6 text-base-accent shrink-0" />
              <span>Jadwal Gantt Chart</span>
            </h1>
            <div className="sm:ml-2">{filterControls}</div>
          </div>
          <p className="text-xs text-base-muted font-sans">
            Analisis, pantau, dan koordinasikan task assembly, dependensi, serta milestone kritis secara real-time.
          </p>
        </div>
      )}

      {/* Main Gantt View Section */}
      <div className={`bg-base-surface border border-base-border rounded-xl shadow-xs ${embedded ? 'p-2.5 sm:p-3 space-y-2' : 'p-3 sm:p-4 space-y-3'}`}>
        {embedded && (
          <div className="flex items-center justify-start flex-wrap gap-x-4 gap-y-2 pb-1.5 border-b border-base-border/60">
            {filterControls}
            <span className="text-[11px] font-mono text-base-muted tabular-nums shrink-0 sm:border-l sm:border-base-border sm:pl-3">
              {projectsInMonth.length} proyek ditampilkan
            </span>
          </div>
        )}
        <GanttView 
          projects={projectsInMonth} 
          timesheets={timesheets}
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
          embedded={embedded}
        />
      </div>
    </div>
  );
}
