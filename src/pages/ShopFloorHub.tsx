import React from 'react';
import {
  Project,
  TimesheetEntry,
  InspectionRequest,
  MaterialRequest,
  OrgSettings,
  ProblemReport,
  Employee,
  User,
} from '../types';
import ShopFloorView from '../components/ShopFloorView';
import ProgressUpdateView from '../components/ProgressUpdateView';
import { Factory, TrendingUp } from 'lucide-react';

interface ShopFloorHubProps {
  subTab: 'hub' | 'progress';
  onSubTabChange: (tab: 'hub' | 'progress') => void;
  projects: Project[];
  timesheets: TimesheetEntry[];
  inspections: InspectionRequest[];
  materialRequests: MaterialRequest[];
  orgSettings?: OrgSettings;
  problemReports: ProblemReport[];
  employees: Employee[];
  currentUser: User | null;
  onAddProblemReport: (report: Omit<ProblemReport, 'id' | 'date'>) => void;
  onUpdateProblemStatus: (id: string, status: 'Open' | 'Resolved', resolutionNote?: string) => void;
  onDeleteProblemReport: (id: string) => void;
  openSpotlight: (pid: string) => void;
  onOpenQrPanel: (pid: string) => void;
  onUpdateProject: (updatedProj: Project) => void;
}

export default function ShopFloorHub({
  subTab,
  onSubTabChange,
  projects,
  timesheets,
  inspections,
  materialRequests,
  orgSettings,
  problemReports,
  employees,
  currentUser,
  onAddProblemReport,
  onUpdateProblemStatus,
  onDeleteProblemReport,
  openSpotlight,
  onOpenQrPanel,
  onUpdateProject,
}: ShopFloorHubProps) {
  return (
    <div className="space-y-4">
      {/* Unified Shop Floor & Quick Progress Switcher */}
      <div className="bg-base-surface border border-base-border rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onSubTabChange('hub')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'hub'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <Factory className="h-3.5 w-3.5" />
            <span>Station Hub & 24h Focus</span>
          </button>
          <button
            type="button"
            onClick={() => onSubTabChange('progress')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'progress'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Update Progress Cepat</span>
          </button>
        </div>

        <span className="text-[11px] text-base-muted font-sans px-2 hidden sm:inline">
          Operasional bengkel harian, serah-terima shift, kendala 24 jam, & pembaruan progres task.
        </span>
      </div>

      {subTab === 'hub' ? (
        <ShopFloorView
          projects={projects}
          timesheets={timesheets}
          inspections={inspections}
          materialRequests={materialRequests}
          orgSettings={orgSettings}
          problemReports={problemReports}
          employees={employees}
          currentUser={currentUser}
          onAddProblemReport={onAddProblemReport}
          onUpdateProblemStatus={onUpdateProblemStatus}
          onDeleteProblemReport={onDeleteProblemReport}
          openSpotlight={openSpotlight}
          onOpenQrPanel={onOpenQrPanel}
        />
      ) : (
        <ProgressUpdateView
          projects={projects}
          onUpdateProject={onUpdateProject}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
