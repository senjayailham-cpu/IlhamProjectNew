import React, { useState } from 'react';
import { TimesheetEntry, Employee, Project, User } from '../types';
import { fmtHrs, esc } from '../utils/projectUtils';
import { 
  Clock, 
  Check, 
  Calendar, 
  AlertTriangle, 
  ArrowRight, 
  ClipboardList, 
  Trash2, 
  Edit, 
  ExternalLink,
  FileText,
  Printer,
  Download,
  Users,
  Percent,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileSpreadsheet,
  FolderKanban
} from 'lucide-react';
import { DailyTimesheetTab } from './timesheet/DailyTimesheetTab';
import { PerformanceReportTab } from './timesheet/PerformanceReportTab';
import { ProjectHoursAllTimeTab } from './timesheet/ProjectHoursAllTimeTab';
import { useAppStore } from '../store';

interface TimesheetViewProps {
  timesheets?: TimesheetEntry[];
  employees?: Employee[];
  projects?: Project[];
  timesheetDate?: string;
  setTimesheetDate?: (date: string) => void;
  openAddTimesheet?: () => void;
  openEditTimesheet?: (id: string) => void;
  deleteTsEntry?: (id: string) => void;
  exportTimesheetDaily?: () => void;
  openSpotlight?: (pid: string) => void;
  currentUser?: User | null;
  onNavigateToManpower?: (date?: string) => void;
}

const STATUS_PILLS = {
  present: 'bg-base-green-dim text-base-green border border-base-green/20',
  late: 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
  absent: 'bg-base-red-dim text-base-red border border-base-red/20',
  leave: 'bg-base-blue-dim text-base-blue border border-base-blue/20'
};

export default function TimesheetView({
  timesheets: propTimesheets,
  employees: propEmployees,
  projects: propProjects,
  timesheetDate: propTimesheetDate,
  setTimesheetDate,
  openAddTimesheet = () => {},
  openEditTimesheet = () => {},
  deleteTsEntry = () => {},
  exportTimesheetDaily = () => {},
  openSpotlight,
  currentUser: propUser,
  onNavigateToManpower
}: TimesheetViewProps) {
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeProjects = useAppStore((s) => s.projects);
  const storeCurrentUser = useAppStore((s) => s.currentUser);

  const timesheets = propTimesheets?.length ? propTimesheets : storeTimesheets;
  const employees = propEmployees?.length ? propEmployees : storeEmployees;
  const projects = propProjects?.length ? propProjects : storeProjects;
  const currentUser = propUser || storeCurrentUser;
  const timesheetDate = propTimesheetDate || new Date().toISOString().slice(0, 10);
  // Navigation between Daily Log, Project Hours (All Time), and Monthly/Weekly Reporting
  const [activeSegment, setActiveSegment] = useState<'daily' | 'alltime' | 'reporting'>('daily');
  
  // Search & Filter states for daily log
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Daily states
  const [tsGroupCollapsed, setTsGroupCollapsed] = useState<Record<string, boolean>>({});

  // Reset filters on date or tab segment change
  React.useEffect(() => {
    setSearchQuery('');
    setProjectFilter('');
    setEmployeeFilter('');
  }, [timesheetDate, activeSegment]);

  const shiftDate = (d: number) => {
    const dt = new Date(timesheetDate + 'T00:00:00');
    dt.setDate(dt.getDate() + d);
    setTimesheetDate(dt.toISOString().slice(0, 10));
  };

  const jumpToday = () => {
    setTimesheetDate(new Date().toISOString().slice(0, 10));
  };

  const currentDateObj = new Date(timesheetDate + 'T12:00:00');
  const curYear = currentDateObj.getFullYear();
  const curMonth = currentDateObj.getMonth();
  const curDay = currentDateObj.getDate();

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(curYear, val, 1);
    const maxDays = new Date(curYear, val + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDays);
    d.setDate(targetDay);
    setTimesheetDate(d.toISOString().slice(0, 10));
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(curYear, curMonth, val);
    setTimesheetDate(d.toISOString().slice(0, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    const d = new Date(val, curMonth, 1);
    const maxDays = new Date(val, curMonth + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDays);
    d.setDate(targetDay);
    setTimesheetDate(d.toISOString().slice(0, 10));
  };

  const MONTHS_LIST = [
    { value: 0, label: 'Jan' },
    { value: 1, label: 'Feb' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Apr' },
    { value: 4, label: 'May' },
    { value: 5, label: 'Jun' },
    { value: 6, label: 'Jul' },
    { value: 7, label: 'Aug' },
    { value: 8, label: 'Sep' },
    { value: 9, label: 'Oct' },
    { value: 10, label: 'Nov' },
    { value: 11, label: 'Dec' }
  ];

  const daysCount = new Date(curYear, curMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);
  const yearsArray = Array.from({ length: 11 }, (_, i) => 2024 + i); // 2024 to 2034

  const dayEntries = timesheets.filter(e => e.date === timesheetDate);

  const filteredDayEntries = dayEntries.filter(e => {
    const matchesSearch = searchQuery === '' || 
      e.empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.workOrder || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.desc || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesProject = projectFilter === '' || 
      (e.workOrder || '').trim().toLowerCase() === projectFilter.trim().toLowerCase();
      
    const matchesEmployee = employeeFilter === '' || 
      e.empId === employeeFilter;
      
    return matchesSearch && matchesProject && matchesEmployee;
  });

  // Group stats counts (derived from filtered entries)
  const counts = { present: 0, late: 0, absent: 0, leave: 0 };
  filteredDayEntries.forEach(e => {
    if (e.status in counts) {
      counts[e.status as keyof typeof counts]++;
    }
  });

  const totalHrsToday = filteredDayEntries.reduce((s, e) => s + (e.totalHours || 0), 0);

  // Group rows by Coordinator (derived from filtered entries)
  const coordGroups: Record<string, TimesheetEntry[]> = {};
  filteredDayEntries.forEach(e => {
    const emp = employees.find(x => x.id === e.empId);
    const coord = (emp?.coordinator || '').trim() || '— No coordinator —';
    if (!coordGroups[coord]) {
      coordGroups[coord] = [];
    }
    coordGroups[coord].push(e);
  });

  const coordNames = Object.keys(coordGroups).sort((a, b) => {
    if (a === '— No coordinator —') return 1;
    if (b === '— No coordinator —') return -1;
    return a.localeCompare(b);
  });

  const toggleGroup = (coord: string) => {
    setTsGroupCollapsed(prev => ({ ...prev, [coord]: !prev[coord] }));
  };

  // Compile Cumulative Work Order totals (all-time)
  const workOrderAccumulator: Record<string, { hrs: number; list: Set<string> }> = {};
  timesheets.forEach(e => {
    if (!e.workOrder) return;
    if (!workOrderAccumulator[e.workOrder]) {
      workOrderAccumulator[e.workOrder] = { hrs: 0, list: new Set() };
    }
    workOrderAccumulator[e.workOrder].hrs += e.totalHours || 0;
    workOrderAccumulator[e.workOrder].list.add(e.empId || e.empName);
  });

  const sortedWOs = Object.entries(workOrderAccumulator).sort((a, b) => b[1].hrs - a[1].hrs);


  // ==========================================
  // PERFORMANCE REPORT STATES & CALCULATIONS
  // ==========================================
  const [reportRangeType, setReportRangeType] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [repMonth, setRepMonth] = useState<number>(curMonth);
  const [repYear, setRepYear] = useState<number>(curYear);
  const [repWeekAnchor, setRepWeekAnchor] = useState<string>(timesheetDate);
  const [repCustomStart, setRepCustomStart] = useState<string>(timesheetDate);
  const [repCustomEnd, setRepCustomEnd] = useState<string>(timesheetDate);

  // Calculate standard boundaries of selected range filter
  const getReportingPeriod = () => {
    let startStr = '';
    let endStr = '';
    let label = '';

    if (reportRangeType === 'monthly') {
      const eDate = new Date(repYear, repMonth + 1, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      startStr = `${repYear}-${pad(repMonth + 1)}-01`;
      endStr = `${repYear}-${pad(repMonth + 1)}-${pad(eDate.getDate())}`;
      
      const sDateObj = new Date(repYear, repMonth, 1);
      label = sDateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
    } else if (reportRangeType === 'weekly') {
      const dt = new Date(repWeekAnchor + 'T12:00:00');
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1); // Monday relative anchor
      
      const sDate = new Date(dt);
      sDate.setDate(diff);
      const eDate = new Date(sDate);
      eDate.setDate(sDate.getDate() + 6);
      
      const pad = (n: number) => String(n).padStart(2, '0');
      startStr = `${sDate.getFullYear()}-${pad(sDate.getMonth() + 1)}-${pad(sDate.getDate())}`;
      endStr = `${eDate.getFullYear()}-${pad(eDate.getMonth() + 1)}-${pad(eDate.getDate())}`;
      
      label = `WEEK OF ${sDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${eDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`.toUpperCase();
    } else {
      startStr = repCustomStart;
      endStr = repCustomEnd;
      const sDate = new Date(repCustomStart + 'T12:00:00');
      const eDate = new Date(repCustomEnd + 'T12:00:00');
      label = `${sDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} TO ${eDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`.toUpperCase();
    }

    return { startStr, endStr, label };
  };

  const activePeriod = getReportingPeriod();

  // Range Entries filtering
  const rangeEntries = timesheets.filter(e => e.date >= activePeriod.startStr && e.date <= activePeriod.endStr);
  
  // KPI summary computations for range
  const rangeTotalHours = rangeEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
  const rangeActivePersonnel = new Set(rangeEntries.map(e => e.empId)).size;

  // Aggregate project data for range
  const reportProjectsData = projects.map(p => {
    // Total historical all-time man hours logged
    const cumulativeHrs = timesheets
      .filter(e => e.workOrder?.toLowerCase().trim() === p.client?.toLowerCase().trim())
      .reduce((sum, e) => sum + (e.totalHours || 0), 0);

    // Filter range hours logged
    const periodHrs = rangeEntries
      .filter(e => e.workOrder?.toLowerCase().trim() === p.client?.toLowerCase().trim())
      .reduce((sum, e) => sum + (e.totalHours || 0), 0);

    // Distinct crew listing
    const crewNames = Array.from(new Set(
      rangeEntries
        .filter(e => e.workOrder?.toLowerCase().trim() === p.client?.toLowerCase().trim())
        .map(e => e.empName)
    ));

    const budget = p.budgetHours || 0;
    const variance = budget - cumulativeHrs;
    const utilizationRate = budget > 0 ? (cumulativeHrs / budget) * 100 : 0;

    let statusGroup: 'healthy' | 'warning' | 'danger' | 'nobudget' = 'nobudget';
    if (budget > 0) {
      if (cumulativeHrs > budget) statusGroup = 'danger';
      else if (utilizationRate >= 85) statusGroup = 'warning';
      else statusGroup = 'healthy';
    }

    return {
      project: p,
      budget,
      periodHrs,
      cumulativeHrs,
      variance,
      utilizationRate,
      statusGroup,
      crewNames
    };
  }).filter(item => item.periodHrs > 0 || item.cumulativeHrs > 0); // only list projects with past or current labor index

  // Overall budget alarms count
  const dangerProjectsCount = reportProjectsData.filter(i => i.statusGroup === 'danger').length;
  const warningProjectsCount = reportProjectsData.filter(i => i.statusGroup === 'warning').length;
  const healthyProjectsCount = reportProjectsData.filter(i => i.statusGroup === 'healthy').length;

  // Export to standard Excel-ready CSV Sheet
  const downloadExcelSheet = () => {
    const headers = [
      'Work Order No.',
      'Project Name',
      'Location',
      'Project Status',
      'Budget Hours',
      `Period Hours (${activePeriod.label})`,
      'Cumulative Logged Hours (All-Time)',
      'Remaining Budget Variance',
      'Utilization Rate (%)',
      'Budget Health Status',
      'Active crew list'
    ];

    const dataRows = reportProjectsData.map(d => [
      d.project.client,
      d.project.name,
      d.project.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2',
      d.project.status.toUpperCase(),
      d.budget ? d.budget.toString() : 'N/A',
      d.periodHrs.toString(),
      d.cumulativeHrs.toString(),
      d.budget ? d.variance.toString() : 'N/A',
      d.budget ? `${d.utilizationRate.toFixed(1)}%` : 'N/A',
      d.statusGroup.toUpperCase(),
      d.crewNames.join('; ')
    ]);

    const nestedRows = [
      [`PROJECT PERFORMANCE EXECUTIVE REPORT - ${activePeriod.label}`],
      [`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
      [],
      headers,
      ...dataRows
    ];

    const csvContentString = nestedRows.map(row => 
      row.map(val => {
        const text = val || '';
        const escaped = text.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
          ? `"${escaped}"`
          : escaped;
      }).join(',')
    ).join('\n');

    const fileBlob = new Blob([csvContentString], { type: 'text/csv;charset=utf-8;' });
    const fileUrl = URL.createObjectURL(fileBlob);
    const linkObj = document.createElement("a");
    linkObj.setAttribute("href", fileUrl);
    linkObj.setAttribute("download", `Manhours_Performance_Report_${activePeriod.label.replace(/\s+/g, '_')}.csv`);
    linkObj.style.visibility = 'hidden';
    document.body.appendChild(linkObj);
    linkObj.click();
    document.body.removeChild(linkObj);
  };

  // Printer Action handler for PDF prints
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('Could not open print window. Please check if browser popups are blocked!');
      return;
    }

    const tableRowsHtml = reportProjectsData.map(d => {
      let statusLabel = 'No Budget';
      let statusClass = 'badge-gray';
      if (d.statusGroup === 'healthy') { statusLabel = 'On Track'; statusClass = 'badge-success'; }
      if (d.statusGroup === 'warning') { statusLabel = 'Warning 85%'; statusClass = 'badge-warning'; }
      if (d.statusGroup === 'danger') { statusLabel = 'Over Budget'; statusClass = 'badge-danger'; }

      const vtext = d.budget > 0 
        ? d.variance < 0 
          ? `<span style="color:#b91c1c;font-weight:bold">${d.variance.toFixed(1)}h over</span>`
          : `<span style="color:#166534;font-weight:bold">${d.variance.toFixed(1)}h remaining</span>`
        : '—';

      return `
        <tr>
          <td style="font-weight:bold;color:#0f172a">${d.project.client}</td>
          <td>
            <div style="font-weight:600">${d.project.name}</div>
            <div style="font-size:9px;color:#64748b">${d.project.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2'}</div>
          </td>
          <td>${d.budget > 0 ? d.budget + 'h' : '—'}</td>
          <td style="font-weight:bold;color:#2563eb">${d.periodHrs.toFixed(1)}h</td>
          <td style="font-weight:bold">${d.cumulativeHrs.toFixed(1)}h</td>
          <td>${vtext}</td>
          <td>
            <div style="font-weight:600">${d.budget > 0 ? d.utilizationRate.toFixed(1) + '%' : '—'}</div>
            ${d.budget > 0 ? `
              <div class="bar-bg">
                <div class="bar-fg" style="width:${Math.min(100, d.utilizationRate)}%;background-color:${d.statusGroup === 'danger' ? '#b91c1c' : d.statusGroup === 'warning' ? '#d97706' : '#10b981'}"></div>
              </div>
            ` : ''}
          </td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td class="crew">${d.crewNames.join(', ') || '—'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Executive Man-hours Performance Report — ${activePeriod.label}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
            .header-wrap { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
            .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin: 0; }
            .sub { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: bold; }
            .logo-placeholder { font-size: 18px; font-weight: 900; letter-spacing: 0.05em; color: #f59e0b; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center; background: #f8fafc; }
            .card-val { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
            .card-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; tracking: 0.05em; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 11px; }
            th { background: #f1f5f9; border-bottom: 2px solid #cbd5e1; padding: 10px; text-align: left; font-weight: 700; text-transform: uppercase; color: #475569; font-size: 10px; }
            td { border-bottom: 1px solid #e2e8f0; padding: 10px; vertical-align: middle; color: #334155; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 8px; text-transform: uppercase; }
            .badge-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fee2e2; }
            .badge-warning { background: #fffbeb; color: #92400e; border: 1px solid #fef3c7; }
            .badge-success { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
            .badge-gray { background: #f8fafc; color: #64748b; border: 1px solid #cbd5e1; }
            .crew { font-size: 9px; color: #64748b; max-width: 200px; word-wrap: break-word; }
            .bar-bg { background: #e2e8f0; height: 5px; border-radius: 3px; overflow: hidden; width: 60px; margin-top: 4px; }
            .bar-fg { height: 100%; border-radius: 3px; }
            @media print {
              body { padding: 10px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="header-wrap">
            <div>
              <h1 class="title">Austin Batam Performance</h1>
              <div class="sub">PROJECT-LEVEL MAN-HOURS AUDIT LOG — ${activePeriod.label}</div>
            </div>
            <div class="logo-placeholder">AUSTIN SERVICES</div>
          </div>
          
          <div class="meta-grid">
            <div class="card">
              <div class="card-val">${rangeTotalHours.toFixed(1)}h</div>
              <div class="card-lbl">Total Period Hours</div>
            </div>
            <div class="card">
              <div class="card-val">${rangeActivePersonnel}</div>
              <div class="card-lbl">Active Labor Crew</div>
            </div>
            <div class="card" style="border-bottom: 3px solid #10b981">
              <div class="card-val">${healthyProjectsCount}</div>
              <div class="card-lbl">On Track Projects</div>
            </div>
            <div class="card" style="border-bottom: 3px solid #ef4444">
              <div class="card-val">${dangerProjectsCount}</div>
              <div class="card-lbl">Over Budget Alarms</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:12%">Work Order</th>
                <th style="width:23%">Project Name</th>
                <th style="width:10%">Budget Hrs</th>
                <th style="width:12%">Period Hours</th>
                <th style="width:12%">All-Time Cum.</th>
                <th style="width:15%">Remaining Budget</th>
                <th style="width:10%">Utilization</th>
                <th style="width:10%">Status</th>
                <th style="width:16%">Crew (Period)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml || '<tr><td colspan="9" style="text-align:center;color:#64748b">No active labor entries found in this selection.</td></tr>'}
            </tbody>
          </table>

          <div style="font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:15px;display:flex;justify-content:space-between">
            <span>Report generated automatically of Austin Production Sync Dashboard on: ${new Date().toLocaleString()}</span>
            <span>Signature Verified PPC</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION TABS HEADER */}
      <div className="flex flex-col sm:flex-row border-b border-base-border justify-between items-stretch sm:items-center bg-base-surface/50 p-1.5 rounded-lg border gap-2">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveSegment('daily')}
            className={`px-3.5 py-2 rounded-md font-condensed font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSegment === 'daily'
                ? 'bg-base-accent text-white shadow-md'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daily Log Sheet</span>
          </button>

          <button
            onClick={() => setActiveSegment('alltime')}
            className={`px-3.5 py-2 rounded-md font-condensed font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSegment === 'alltime'
                ? 'bg-base-accent text-white shadow-md'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Project Hours (All Time)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeSegment === 'alltime' ? 'bg-white/20 text-white' : 'bg-base-surface3 text-base-muted'
            }`}>
              {sortedWOs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSegment('reporting')}
            className={`px-3.5 py-2 rounded-md font-condensed font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSegment === 'reporting'
                ? 'bg-base-accent text-white shadow-md'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Project Performance Report</span>
          </button>
        </div>
        
        {activeSegment === 'reporting' && (
          <div className="flex items-center gap-1.5 shrink-0 pr-1 select-none">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] uppercase font-condensed font-black tracking-wider text-emerald-500 hidden sm:inline">PPC Audit Sync Live</span>
          </div>
        )}
      </div>

      {activeSegment === 'daily' ? (
        <DailyTimesheetTab
          timesheets={timesheets}
          employees={employees}
          projects={projects}
          timesheetDate={timesheetDate}
          curDay={curDay}
          curMonth={curMonth}
          curYear={curYear}
          daysArray={daysArray}
          MONTHS_LIST={MONTHS_LIST}
          yearsArray={yearsArray}
          dayEntries={filteredDayEntries}
          unfilteredDayEntriesCount={dayEntries.length}
          counts={counts}
          totalHrsToday={totalHrsToday}
          sortedWOs={sortedWOs}
          coordNames={coordNames}
          coordGroups={coordGroups}
          tsGroupCollapsed={tsGroupCollapsed}
          shiftDate={shiftDate}
          handleDayChange={handleDayChange}
          handleMonthChange={handleMonthChange}
          handleYearChange={handleYearChange}
          jumpToday={jumpToday}
          exportTimesheetDaily={exportTimesheetDaily}
          openAddTimesheet={openAddTimesheet}
          openEditTimesheet={openEditTimesheet}
          deleteTsEntry={deleteTsEntry}
          toggleGroup={toggleGroup}
          openSpotlight={openSpotlight}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          projectFilter={projectFilter}
          setProjectFilter={setProjectFilter}
          employeeFilter={employeeFilter}
          setEmployeeFilter={setEmployeeFilter}
          currentUser={currentUser}
          onNavigateToManpower={onNavigateToManpower}
          onNavigateToProjectHours={() => setActiveSegment('alltime')}
        />
      ) : activeSegment === 'alltime' ? (
        <ProjectHoursAllTimeTab
          timesheets={timesheets}
          employees={employees}
          projects={projects}
          currentUser={currentUser}
          openSpotlight={openSpotlight}
          openEditTimesheet={openEditTimesheet}
          onNavigateToDaily={(date) => {
            setTimesheetDate?.(date);
            setActiveSegment('daily');
          }}
        />
      ) : (
        <PerformanceReportTab
          reportRangeType={reportRangeType}
          setReportRangeType={setReportRangeType}
          repMonth={repMonth}
          setRepMonth={setRepMonth}
          repYear={repYear}
          setRepYear={setRepYear}
          repWeekAnchor={repWeekAnchor}
          setRepWeekAnchor={setRepWeekAnchor}
          repCustomStart={repCustomStart}
          setRepCustomStart={setRepCustomStart}
          repCustomEnd={repCustomEnd}
          setRepCustomEnd={setRepCustomEnd}
          MONTHS_LIST={MONTHS_LIST}
          yearsArray={yearsArray}
          activePeriod={activePeriod}
          rangeTotalHours={rangeTotalHours}
          healthyProjectsCount={healthyProjectsCount}
          warningProjectsCount={warningProjectsCount}
          dangerProjectsCount={dangerProjectsCount}
          reportProjectsData={reportProjectsData}
          downloadExcelSheet={downloadExcelSheet}
          handlePrintPDF={handlePrintPDF}
          openSpotlight={openSpotlight}
        />
      )}

    </div>
  );
}
