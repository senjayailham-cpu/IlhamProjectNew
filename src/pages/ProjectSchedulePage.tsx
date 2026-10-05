import React, { useState, useMemo } from 'react';
import { Project, User, OrgSettings, TimesheetEntry, ProblemReport, InspectionRequest } from '../types';
import { GanttPage } from './GanttPage';
import ProjectTimelineView from '../components/ProjectTimelineView';
import SchedulingRiskDashboard from '../components/SchedulingRiskDashboard';
import { PredictiveScheduleDelayAlert } from '../components/PredictiveScheduleDelayAlert';
import { getPredictiveScheduleDelaySummary } from '../utils/predictiveDelay';
import { BarChart2, Calendar, Clock, SlidersHorizontal, TrendingUp, ShieldAlert, QrCode } from 'lucide-react';
import { useUIStore } from '../store';

export interface ProjectSchedulePageProps {
  projects: Project[];
  timesheets?: TimesheetEntry[];
  problemReports?: ProblemReport[];
  inspections?: InspectionRequest[];
  prefs?: any;
  onSetPref?: (key: string, value: any) => void;
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  externalRowKey?: string | null;
  onCloseDepModal?: () => void;
  currentUser: User | null;
  orgSettings?: OrgSettings;
  defaultView?: 'gantt' | 'timeline' | 'risk';
  onNavigateToProgress?: () => void;
  openSpotlight?: (id: string) => void;
}

export function ProjectSchedulePage({
  projects,
  timesheets = [],
  problemReports = [],
  inspections = [],
  prefs,
  onSetPref,
  onUpdateProject,
  onOpenDepModal,
  depModalOpen,
  externalRowKey,
  onCloseDepModal,
  currentUser,
  orgSettings,
  defaultView = 'gantt',
  onNavigateToProgress,
  openSpotlight
}: ProjectSchedulePageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'gantt' | 'timeline' | 'risk'>(
    defaultView === 'risk' ? 'risk' : defaultView === 'timeline' ? 'timeline' : 'gantt'
  );
  const setQrScannerOpen = useUIStore((s) => s.setQrScannerOpen);

  const delaySummary = useMemo(() => {
    return getPredictiveScheduleDelaySummary(
      projects,
      timesheets,
      problemReports,
      inspections
    );
  }, [projects, timesheets, problemReports, inspections]);

  return (
    <div className="flex-1 flex flex-col space-y-4">
      {/* Top Header Banner & View Toggle */}
      <div className="bg-base-surface border border-base-border p-4 sm:p-5 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-wrap items-center gap-3">
            <span className="p-2 rounded-lg bg-base-accent/10 text-base-accent shrink-0">
              <Calendar className="h-5 w-5" />
            </span>
            <h1 className="font-condensed font-black text-xl sm:text-2xl tracking-tight text-base-text uppercase shrink-0">
              Project Schedule & Timeline
            </h1>

            {/* Tab Toggle Switch placed right next to title */}
            <div className="flex items-center bg-base-surface2 border border-base-border p-1 rounded-xl shrink-0 flex-wrap gap-1">
              <button
                onClick={() => setActiveSubTab('gantt')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeSubTab === 'gantt'
                    ? 'bg-[#9b1c2e] text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text hover:bg-base-surface/50'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                <span>Gantt Chart</span>
              </button>
              <button
                onClick={() => setActiveSubTab('timeline')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeSubTab === 'timeline'
                    ? 'bg-[#9b1c2e] text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text hover:bg-base-surface/50'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Timeline View</span>
              </button>
              <button
                onClick={() => setActiveSubTab('risk')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeSubTab === 'risk'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-base-muted hover:text-base-text hover:bg-base-surface/50'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                <span>Delay Risk Analytics</span>
                {delaySummary.flaggedCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                    activeSubTab === 'risk' ? 'bg-white text-rose-700' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {delaySummary.flaggedCount}
                  </span>
                )}
              </button>

              {onNavigateToProgress && (
                <button
                  onClick={onNavigateToProgress}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 ml-1 border-l border-base-border pl-2"
                  title="Buka Halaman Cepat Update Progress Proyek"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Update Progress ↗</span>
                </button>
              )}

              <button
                onClick={() => setQrScannerOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer bg-[#9b1c2e]/10 hover:bg-[#9b1c2e] hover:text-white text-[#9b1c2e] dark:text-[#f87171] border border-[#9b1c2e]/30 shadow-xs"
                title="Pindai QR Traveler Tag unit fabrikasi di bengkel"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Scan QR Traveler</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-base-muted font-sans">
            Unified project scheduling hub — toggle between Interactive Gantt Chart, Visual Milestone Timeline, and Predictive Delay Risk Analytics. Tip: Klik kolom <strong className="text-base-text font-mono">% Comp</strong> di tabel untuk edit progres langsung.
          </p>
        </div>
      </div>

      {/* PREDICTIVE SCHEDULE DELAY ALERT BANNER (Shown across views when projects are at risk) */}
      <PredictiveScheduleDelayAlert
        projects={projects}
        timesheets={timesheets}
        problemReports={problemReports}
        inspections={inspections}
        openSpotlight={openSpotlight}
        onNavigateToSchedule={() => setActiveSubTab('gantt')}
      />

      {/* Main View Area */}
      <div>
        {activeSubTab === 'gantt' && (
          <GanttPage
            projects={projects}
            timesheets={timesheets}
            prefs={prefs}
            onSetPref={onSetPref}
            onUpdateProject={onUpdateProject}
            onOpenDepModal={onOpenDepModal}
            depModalOpen={depModalOpen}
            externalRowKey={externalRowKey}
            onCloseDepModal={onCloseDepModal}
            currentUser={currentUser}
            orgSettings={orgSettings}
          />
        )}

        {activeSubTab === 'timeline' && (
          <ProjectTimelineView projects={projects} />
        )}

        {activeSubTab === 'risk' && (
          <SchedulingRiskDashboard
            projects={projects}
            problemReports={problemReports}
            inspections={inspections}
            timesheets={timesheets}
            currentUser={currentUser}
            openSpotlight={openSpotlight}
          />
        )}
      </div>

    </div>
  );
}

export default ProjectSchedulePage;
