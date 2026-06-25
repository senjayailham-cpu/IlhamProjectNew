import React from 'react';
import DailyReportView from '../components/DailyReportView';
import { Project, ActivityLog, TimesheetEntry } from '../types';

interface ReportPageProps {
  projects: Project[];
  activityLogs: ActivityLog[];
  reportDate: string;
  setReportDate: (date: string) => void;
  clearActivityLogs: () => void;
  openPrintView: () => void;
  timesheets: TimesheetEntry[];
}

export function ReportPage({
  projects,
  activityLogs,
  reportDate,
  setReportDate,
  clearActivityLogs,
  openPrintView,
  timesheets
}: ReportPageProps) {
  return (
    <DailyReportView
      projects={projects}
      activityLogs={activityLogs}
      reportDate={reportDate}
      setReportDate={setReportDate}
      clearActivityLogs={clearActivityLogs}
      openPrintView={openPrintView}
      timesheets={timesheets}
    />
  );
}

export default ReportPage;
