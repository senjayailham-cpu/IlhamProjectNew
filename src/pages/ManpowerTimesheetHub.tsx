import React, { Suspense, lazy } from 'react';
import { TimesheetEntry, Employee, Project, User } from '../types';
import TimesheetView from '../components/TimesheetView';
import { Clock, UserCheck } from 'lucide-react';

const ManpowerBoardView = lazy(() => import('../components/ManpowerBoardView'));

interface ManpowerTimesheetHubProps {
  subTab: 'timesheet' | 'manpower';
  onSubTabChange: (tab: 'timesheet' | 'manpower') => void;
  timesheets: TimesheetEntry[];
  employees: Employee[];
  projects: Project[];
  timesheetDate: string;
  setTimesheetDate: (date: string) => void;
  openAddTimesheet: () => void;
  openAddTimesheetForEmployee?: (empId: string) => void;
  openEditTimesheet: (id: string) => void;
  deleteTsEntry: (id: string) => void;
  exportTimesheetDaily: () => void;
  openSpotlight: (pid: string) => void;
  currentUser: User | null;
}

export default function ManpowerTimesheetHub({
  subTab,
  onSubTabChange,
  timesheets,
  employees,
  projects,
  timesheetDate,
  setTimesheetDate,
  openAddTimesheet,
  openAddTimesheetForEmployee,
  openEditTimesheet,
  deleteTsEntry,
  exportTimesheetDaily,
  openSpotlight,
  currentUser,
}: ManpowerTimesheetHubProps) {
  return (
    <div className="space-y-4">
      {/* Unified Hub Sub-Navigation */}
      <div className="bg-base-surface border border-base-border rounded-xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onSubTabChange('timesheet')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'timesheet'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Timesheet & Jam Kerja</span>
          </button>
          <button
            type="button"
            onClick={() => onSubTabChange('manpower')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'manpower'
                ? 'bg-[#9b1c2e] text-white shadow-xs'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface/60'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Manpower Board</span>
          </button>
        </div>

        <span className="text-[11px] text-base-muted font-sans px-2 hidden sm:inline">
          Satu tempat terpadu untuk input absensi/jam kerja harian & pantau alokasi tim di bengkel.
        </span>
      </div>

      {subTab === 'timesheet' ? (
        <TimesheetView
          timesheets={timesheets}
          employees={employees}
          projects={projects}
          timesheetDate={timesheetDate}
          setTimesheetDate={setTimesheetDate}
          openAddTimesheet={openAddTimesheet}
          openEditTimesheet={openEditTimesheet}
          deleteTsEntry={deleteTsEntry}
          exportTimesheetDaily={exportTimesheetDaily}
          openSpotlight={openSpotlight}
          currentUser={currentUser}
          onNavigateToManpower={(date) => {
            if (date) setTimesheetDate(date);
            onSubTabChange('manpower');
          }}
        />
      ) : (
        <Suspense
          fallback={
            <div className="py-16 flex items-center justify-center">
              <div className="h-7 w-7 rounded-full border-2 border-base-accent border-t-transparent animate-spin" />
            </div>
          }
        >
          <ManpowerBoardView
            timesheets={timesheets}
            employees={employees}
            projects={projects}
            initialDate={timesheetDate}
            selectedDate={timesheetDate}
            onDateChange={setTimesheetDate}
            currentUser={currentUser}
            onNavigateToTimesheet={(date) => {
              if (date) setTimesheetDate(date);
              onSubTabChange('timesheet');
            }}
            openAddTimesheet={openAddTimesheet}
            openAddTimesheetForEmployee={openAddTimesheetForEmployee}
          />
        </Suspense>
      )}
    </div>
  );
}
