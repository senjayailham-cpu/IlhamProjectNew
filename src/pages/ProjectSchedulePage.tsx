import React, { useState } from 'react';
import { Project, User, OrgSettings } from '../types';
import { GanttPage } from './GanttPage';
import ProjectTimelineView from '../components/ProjectTimelineView';
import { BarChart2, Calendar, Clock, SlidersHorizontal } from 'lucide-react';

export interface ProjectSchedulePageProps {
  projects: Project[];
  prefs?: any;
  onSetPref?: (key: string, value: any) => void;
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  externalRowKey?: string | null;
  onCloseDepModal?: () => void;
  currentUser: User | null;
  orgSettings?: OrgSettings;
  defaultView?: 'gantt' | 'timeline';
}

export function ProjectSchedulePage({
  projects,
  prefs,
  onSetPref,
  onUpdateProject,
  onOpenDepModal,
  depModalOpen,
  externalRowKey,
  onCloseDepModal,
  currentUser,
  orgSettings,
  defaultView = 'gantt'
}: ProjectSchedulePageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'gantt' | 'timeline'>(defaultView);

  return (
    <div className="flex-1 flex flex-col space-y-4">
      {/* Top Header Banner & View Toggle */}
      <div className="bg-base-surface border border-base-border p-4 sm:p-5 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-base-accent/10 text-base-accent">
              <Calendar className="h-5 w-5" />
            </span>
            <h1 className="font-condensed font-black text-xl sm:text-2xl tracking-tight text-base-text uppercase">
              Project Schedule & Timeline
            </h1>
          </div>
          <p className="text-xs text-base-muted mt-1 font-sans">
            Unified project scheduling hub — toggle between Interactive Gantt Chart and Visual Milestone Timeline.
          </p>
        </div>

        {/* Tab Toggle Switch */}
        <div className="flex items-center bg-base-surface2 border border-base-border p-1 rounded-xl shrink-0 self-stretch md:self-auto">
          <button
            onClick={() => setActiveSubTab('gantt')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer ${
              activeSubTab === 'gantt'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/50'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            <span>Gantt Chart</span>
          </button>
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide transition-all cursor-pointer ${
              activeSubTab === 'timeline'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/50'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Timeline View</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div>
        {activeSubTab === 'gantt' && (
          <GanttPage
            projects={projects}
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
      </div>
    </div>
  );
}

export default ProjectSchedulePage;
