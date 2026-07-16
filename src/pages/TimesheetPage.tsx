import React from 'react';
import TimesheetView from '../components/TimesheetView';
import { TimesheetEntry, Employee, Project, User } from '../types';

interface TimesheetPageProps {
  timesheets: TimesheetEntry[];
  employees: Employee[];
  projects: Project[];
  timesheetDate: string;
  setTimesheetDate: (date: string) => void;
  openAddTimesheet: () => void;
  openEditTimesheet: (id: string) => void;
  removeTimesheetEntry: (id: string) => void;
  exportTimesheetExcel: () => void;
  openSpotlight?: (pid: string) => void;
  currentUser: User | null;
}

export function TimesheetPage({
  timesheets,
  employees,
  projects,
  timesheetDate,
  setTimesheetDate,
  openAddTimesheet,
  openEditTimesheet,
  removeTimesheetEntry,
  exportTimesheetExcel,
  openSpotlight,
  currentUser
}: TimesheetPageProps) {
  return (
    <TimesheetView
      timesheets={timesheets}
      employees={employees}
      projects={projects}
      timesheetDate={timesheetDate}
      setTimesheetDate={setTimesheetDate}
      openAddTimesheet={openAddTimesheet}
      openEditTimesheet={openEditTimesheet}
      deleteTsEntry={removeTimesheetEntry}
      exportTimesheetDaily={exportTimesheetExcel}
      openSpotlight={openSpotlight}
      currentUser={currentUser}
    />
  );
}

export default TimesheetPage;
