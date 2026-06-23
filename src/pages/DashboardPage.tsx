import React from 'react';
import DashboardView from '../components/DashboardView';
import { Project, TimesheetEntry, Employee } from '../types';

interface DashboardPageProps {
  projects: Project[];
  timesheets: TimesheetEntry[];
  employees: Employee[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  openSpotlight: (id: string) => void;
}

export function DashboardPage({
  projects,
  timesheets,
  employees,
  selectedMonth,
  setSelectedMonth,
  openSpotlight
}: DashboardPageProps) {
  return (
    <DashboardView
      projects={projects}
      timesheets={timesheets}
      employees={employees}
      selectedMonth={selectedMonth}
      setSelectedMonth={setSelectedMonth}
      openSpotlight={openSpotlight}
    />
  );
}

export default DashboardPage;
