import React from 'react';
import DailyReportView from '../components/DailyReportView';
import { Project, ActivityLog } from '../types';

interface ReportPageProps {
  projects: Project[];
  activityLogs: ActivityLog[];
  reportDate: string;
  setReportDate: (date: string) => void;
  clearActivityLogs: () => void;
  openPrintView: () => void;
}

export function ReportPage({
  projects,
  activityLogs,
  reportDate,
  setReportDate,
  clearActivityLogs,
  openPrintView
}: ReportPageProps) {
  return (
    <DailyReportView
      projects={projects}
      activityLogs={activityLogs}
      reportDate={reportDate}
      setReportDate={setReportDate}
      clearActivityLogs={clearActivityLogs}
      openPrintView={openPrintView}
    />
  );
}

export default ReportPage;
