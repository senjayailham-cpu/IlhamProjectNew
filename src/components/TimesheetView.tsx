import React, { useState } from 'react';
import { TimesheetEntry, Employee, Project } from '../types';
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
  FileSpreadsheet
} from 'lucide-react';

interface TimesheetViewProps {
  timesheets: TimesheetEntry[];
  employees: Employee[];
  projects: Project[];
  timesheetDate: string;
  setTimesheetDate: (date: string) => void;
  openAddTimesheet: () => void;
  openEditTimesheet: (id: string) => void;
  deleteTsEntry: (id: string) => void;
  exportTimesheetDaily: () => void;
  openSpotlight?: (pid: string) => void;
}

const STATUS_PILLS = {
  present: 'bg-base-green-dim text-base-green border border-base-green/20',
  late: 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
  absent: 'bg-base-red-dim text-base-red border border-base-red/20',
  leave: 'bg-base-blue-dim text-base-blue border border-base-blue/20'
};

export default function TimesheetView({
  timesheets,
  employees,
  projects,
  timesheetDate,
  setTimesheetDate,
  openAddTimesheet,
  openEditTimesheet,
  deleteTsEntry,
  exportTimesheetDaily,
  openSpotlight
}: TimesheetViewProps) {
  // Navigation between Daily Log and Monthly/Weekly Reporting
  const [activeSegment, setActiveSegment] = useState<'daily' | 'reporting'>('daily');
  
  // Daily states
  const [tsGroupCollapsed, setTsGroupCollapsed] = useState<Record<string, boolean>>({});

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

  // Group stats counts
  const counts = { present: 0, late: 0, absent: 0, leave: 0 };
  dayEntries.forEach(e => {
    if (e.status in counts) {
      counts[e.status as keyof typeof counts]++;
    }
  });

  const totalHrsToday = dayEntries.reduce((s, e) => s + (e.totalHours || 0), 0);

  // Group rows by Coordinator
  const coordGroups: Record<string, TimesheetEntry[]> = {};
  dayEntries.forEach(e => {
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
      <div className="flex border-b border-base-border justify-between items-center bg-base-surface/50 p-1.5 rounded-lg border">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveSegment('daily')}
            className={`px-4 py-2 rounded-md font-condensed font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSegment === 'daily'
                ? 'bg-base-accent text-white shadow-md'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daily Log Sheet</span>
          </button>
          <button
            onClick={() => setActiveSegment('reporting')}
            className={`px-4 py-2 rounded-md font-condensed font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
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
        // ==========================================
        // DAILY TIMESHEETS PANEL (ORIGINAL RENDER)
        // ==========================================
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
                Daily <span className="text-base-accent">Timesheets</span>
              </h2>

              {/* Date Picker Switcher */}
              <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 gap-1">
                <button
                  onClick={() => shiftDate(-1)}
                  className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
                  title="Previous Day"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <div className="flex items-center gap-0.5 font-condensed font-bold text-xs">
                  {/* Day Dropdown */}
                  <select
                    value={curDay}
                    onChange={handleDayChange}
                    className="bg-transparent text-base-text py-0.5 px-1 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center"
                  >
                    {daysArray.map(d => (
                      <option key={d} value={d} className="bg-base-surface2 text-base-text font-sans">
                        {String(d).padStart(2, '0')}
                      </option>
                    ))}
                  </select>

                  <span className="text-base-muted/40">/</span>

                  {/* Month Dropdown */}
                  <select
                    value={curMonth}
                    onChange={handleMonthChange}
                    className="bg-transparent text-base-text py-0.5 px-1 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors uppercase text-center"
                  >
                    {MONTHS_LIST.map(m => (
                      <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans">
                        {m.label.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <span className="text-base-muted/40">/</span>

                  {/* Year Dropdown */}
                  <select
                    value={curYear}
                    onChange={handleYearChange}
                    className="bg-transparent text-base-text py-0.5 px-0.5 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center"
                  >
                    {yearsArray.map(y => (
                      <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => shiftDate(1)}
                  className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
                  title="Next Day"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              <button
                onClick={jumpToday}
                className="px-2.5 py-1.5 border border-base-accent/25 hover:bg-base-accent-dim text-base-accent rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
              >
                Today
              </button>
            </div>

            {/* Global Action Handlers */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportTimesheetDaily}
                className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
              >
                <ClipboardList className="h-4 w-4 text-base-blue animate-pulse" />
                <span>Export Daily</span>
              </button>
              <button
                onClick={openAddTimesheet}
                className="btn btn-accent btn-sm flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                <Clock className="h-4 w-4" />
                <span>Add Entry</span>
              </button>
            </div>
          </div>

          {/* KPI Dashboard widget cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 animate-fade-in">
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-border">
              <div className="text-[26px] font-condensed font-extrabold text-base-text leading-none">{dayEntries.length}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Total entries</div>
            </div>
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-accent">
              <div className="text-[26px] font-condensed font-extrabold text-base-accent leading-none">{fmtHrs(totalHrsToday)}h</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Man-hours today</div>
            </div>
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-green">
              <div className="text-[26px] font-condensed font-extrabold text-base-green leading-none">{counts.present + counts.late}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Present/Late</div>
            </div>
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-red">
              <div className="text-[26px] font-condensed font-extrabold text-base-red leading-none">{counts.absent}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Absent</div>
            </div>
            <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-blue">
              <div className="text-[26px] font-condensed font-extrabold text-base-blue leading-none">{counts.leave}</div>
              <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Leave</div>
            </div>
          </div>

          {/* Cumulative Work order statistics */}
          {sortedWOs.length > 0 && (
            <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden animate-fade-in">
              <div className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-base-accent" />
                <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Project Hours (All Time)</h3>
              </div>
              <div className="divide-y divide-base-border/50">
                {sortedWOs.map(([wo, info]) => {
                  const proj = projects.find(x => (x.client || '').trim().toLowerCase() === (wo || '').trim().toLowerCase());
                  return (
                    <div
                      key={wo}
                      onClick={() => proj && openSpotlight?.(proj.id)}
                      className={`flex px-4 py-3 items-center justify-between gap-4 text-xs group transition-all duration-150 ${
                        proj ? 'hover:bg-base-surface2/60 cursor-pointer' : ''
                      }`}
                      title={proj ? `Click to view project: ${proj.name}` : undefined}
                    >
                      <div className="font-condensed font-extrabold text-sm text-base-blue flex-shrink-0 min-w-[100px] uppercase tracking-wide flex items-center gap-1.5">
                        <span>{wo}</span>
                        {proj && (
                          <ExternalLink className="h-3 w-3 text-base-blue opacity-50 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                      <div className="flex-1 font-medium text-base-muted2 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-base-text transition-colors">
                        {proj ? proj.name : 'Unassociated work order scope'}
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="text-[10px] text-base-muted">{info.list.size} manpower</span>
                        <span className="font-condensed font-extrabold text-base text-base-accent bg-base-accent-dim/20 px-2 py-0.5 rounded-sm">
                          {fmtHrs(info.hrs)}h
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main timesheet groups by Coordinator */}
          <div className="space-y-4 animate-fade-in">
            {dayEntries.length === 0 ? (
              <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
                <Calendar className="h-10 w-10 text-base-border/80 mb-3" />
                <p className="text-sm font-semibold">No timesheet records submitted for this date.</p>
                <button
                  onClick={openAddTimesheet}
                  className="mt-4 px-4 py-2 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Log hours now
                </button>
              </div>
            ) : (
              coordNames.map(coord => {
                const list = coordGroups[coord];
                const isColl = !!tsGroupCollapsed[coord];
                const coordHrs = list.reduce((s, e) => s + (e.totalHours || 0), 0);

                return (
                  <div key={coord} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
                    {/* Collapsible Coordinator header */}
                    <div
                      onClick={() => toggleGroup(coord)}
                      className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-base-surface3/40"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 text-base-muted transition-transform ${isColl ? '-rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">{coord}</span>
                        <span className="px-2 py-0.5 text-[10px] bg-base-border/20 rounded font-semibold text-base-muted leading-none">
                          {list.length} log{list.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="font-condensed font-extrabold text-sm text-base-accent">{fmtHrs(coordHrs)}h logged</span>
                    </div>

                    {/* Timesheets log list */}
                    {!isColl && (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-base-surface2/30 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border/50">
                              <th className="py-2.5 px-4 font-condensed uppercase tracking-wider">Employee</th>
                              <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Work Order</th>
                              <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Hours</th>
                              <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Description</th>
                              <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Status</th>
                              <th className="py-2.5 px-4 text-right font-condensed uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-base-border/30 text-xs">
                            {list.map(e => {
                              const emp = employees.find(x => x.id === e.empId);
                              return (
                                <tr key={e.id} className="hover:bg-base-surface2/20 transition-colors">
                                  <td className="py-3 px-4">
                                    <div>
                                      <div className="font-bold text-base-text">{e.empName}</div>
                                      <div className="text-[10px] text-base-muted mt-0.5">{emp?.position || 'Crew'}</div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    {(() => {
                                      const proj = projects.find(
                                        x => (x.client || '').trim().toLowerCase() === (e.workOrder || '').trim().toLowerCase()
                                      );
                                      return (
                                        <div>
                                          {proj ? (
                                            <button
                                              onClick={() => openSpotlight?.(proj.id)}
                                              className="font-condensed font-extrabold text-sm text-base-blue uppercase tracking-wide hover:underline hover:text-base-accent cursor-pointer flex items-center gap-1 group text-left"
                                              title={`View Project Spotlight: ${proj.name}`}
                                            >
                                              <span>{e.workOrder || '—'}</span>
                                              <ExternalLink className="h-3 w-3 inline text-base-blue opacity-50 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                          ) : (
                                            <div className="font-condensed font-extrabold text-sm text-base-blue uppercase tracking-wide">
                                              {e.workOrder || '—'}
                                            </div>
                                          )}
                                          {e.assemblyName && (
                                            <div className="text-[10px] text-base-muted2 font-medium mt-0.5">{e.assemblyName}</div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-3 px-3 font-condensed font-extrabold text-sm text-base-accent">
                                    {fmtHrs(e.totalHours || 0)}h
                                  </td>
                                  <td className="py-3 px-3 max-w-[200px] truncate text-base-muted2" title={e.desc}>
                                    {e.desc || '—'}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`px-2.5 py-0.5 rounded font-condensed font-extrabold text-[10px] uppercase tracking-wider ${STATUS_PILLS[e.status]}`}>
                                      {e.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => openEditTimesheet(e.id)}
                                      className="p-1 rounded text-base-muted hover:text-base-accent hover:bg-base-surface3 transition-all cursor-pointer inline-flex items-center justify-center mr-1"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteTsEntry(e.id)}
                                      className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/10 transition-all cursor-pointer inline-flex items-center justify-center"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        // ==========================================
        // DYNAMIC WEEKLY/MONTHLY PERFORMANCE REPORT PANEL
        // ==========================================
        <div className="space-y-6 animate-fade-in">
          
          {/* SEARCH & CONTROLS HEADER */}
          <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Type Switcher */}
              <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1">
                <button
                  onClick={() => setReportRangeType('monthly')}
                  className={`px-3 py-1.5 rounded-md font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    reportRangeType === 'monthly'
                      ? 'bg-base-accent text-white shadow-sm'
                      : 'text-base-muted hover:text-base-text'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setReportRangeType('weekly')}
                  className={`px-3 py-1.5 rounded-md font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    reportRangeType === 'weekly'
                      ? 'bg-base-accent text-white shadow-sm'
                      : 'text-base-muted hover:text-base-text'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setReportRangeType('custom')}
                  className={`px-3 py-1.5 rounded-md font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    reportRangeType === 'custom'
                      ? 'bg-base-accent text-white shadow-sm'
                      : 'text-base-muted hover:text-base-text'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Dynamic Period Dropdowns */}
              {reportRangeType === 'monthly' && (
                <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border rounded-lg p-1 text-xs font-bold font-condensed">
                  <select
                    value={repMonth}
                    onChange={(e) => setRepMonth(parseInt(e.target.value, 10))}
                    className="bg-transparent text-base-text py-1 px-2 cursor-pointer outline-none rounded hover:bg-base-surface3 transition-colors uppercase text-center font-bold"
                  >
                    {MONTHS_LIST.map(m => (
                      <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans">
                        {m.label.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span className="text-base-muted/40">/</span>
                  <select
                    value={repYear}
                    onChange={(e) => setRepYear(parseInt(e.target.value, 10))}
                    className="bg-transparent text-base-text py-1 px-2 cursor-pointer outline-none rounded hover:bg-base-surface3 transition-colors text-center font-bold"
                  >
                    {yearsArray.map(y => (
                      <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reportRangeType === 'weekly' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wide">Base Week Date:</span>
                  <input
                    type="date"
                    value={repWeekAnchor}
                    onChange={(e) => setRepWeekAnchor(e.target.value)}
                    className="px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs font-bold font-mono outline-none text-base-text"
                  />
                </div>
              )}

              {reportRangeType === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={repCustomStart}
                    onChange={(e) => setRepCustomStart(e.target.value)}
                    className="px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs font-bold font-mono outline-none text-base-text"
                  />
                  <span className="text-xs text-base-muted uppercase font-condensed font-bold">to</span>
                  <input
                    type="date"
                    value={repCustomEnd}
                    onChange={(e) => setRepCustomEnd(e.target.value)}
                    className="px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs font-bold font-mono outline-none text-base-text"
                  />
                </div>
              )}
            </div>

            {/* Print and Excel Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto">
              <button
                onClick={downloadExcelSheet}
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel (CSV)</span>
              </button>
              <button
                onClick={handlePrintPDF}
                className="flex-1 md:flex-none px-4 py-2 border border-base-accent/30 bg-base-accent-dim/10 hover:bg-base-accent text-base-accent hover:text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print PDF Report</span>
              </button>
            </div>
          </div>

          {/* PERIOD HEADER DESCRIPTION */}
          <div className="bg-base-accent-dim/10 border border-base-accent/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-[10px] tracking-widest font-condensed font-black uppercase text-base-accent">ACTIVE PERMANENT TIME PERIOD</div>
              <h3 className="text-lg font-condensed font-black text-base-text mt-0.5 tracking-wide">{activePeriod.label}</h3>
              <p className="text-xs text-base-muted mt-1 leading-normal font-medium">
                Showing all projects with labor entries tracked between <span className="font-mono text-base-text font-bold bg-base-surface3 px-1.5 py-0.2 rounded">{activePeriod.startStr}</span> and <span className="font-mono text-base-text font-bold bg-base-surface3 px-1.5 py-0.2 rounded">{activePeriod.endStr}</span>.
              </p>
            </div>
            
            <div className="bg-base-surface border border-base-border/50 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-base-accent animate-pulse" />
              <div className="text-right">
                <div className="text-[10px] text-base-muted uppercase font-condensed font-bold">TOTAL PERIOD WORK</div>
                <div className="text-sm font-condensed font-extrabold text-base-text">{fmtHrs(rangeTotalHours)}h logged</div>
              </div>
            </div>
          </div>

          {/* DYNAMIC BENTO METRIC CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
              <div className="text-2xl font-condensed font-black text-base-accent">{fmtHrs(rangeTotalHours)}h</div>
              <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1">Sum actual hours</div>
            </div>
            
            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
              <div className="text-2xl font-condensed font-black text-base-bold text-base-green">{healthyProjectsCount}</div>
              <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1">Healthy projects</div>
            </div>

            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
              <div className="text-2xl font-condensed font-black text-yellow-600 dark:text-yellow-400">{warningProjectsCount}</div>
              <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1">Near budget warnings (&gt;85%)</div>
            </div>

            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card border-b-2 border-b-base-red">
              <div className="text-2xl font-condensed font-black text-base-red">{dangerProjectsCount}</div>
              <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1 font-bold">OVER BUDGET PROJECTS</div>
            </div>
          </div>

          {/* CORE PERFORMANCE METRIC DATA GRID */}
          <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-base-border bg-base-surface2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-base-accent" />
              <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Project Performance Sheet</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-base-surface2/40 text-left text-[10px] font-condensed font-bold uppercase tracking-wider border-b border-base-border/70 text-base-muted">
                    <th className="py-3 px-4 font-condensed tracking-wider">Work Order</th>
                    <th className="py-3 px-3 font-condensed tracking-wider">Project Description</th>
                    <th className="py-3 px-3 font-condensed tracking-wider">Budget Hours</th>
                    <th className="py-3 px-3 font-condensed tracking-wider text-base-blue">Period Hours</th>
                    <th className="py-3 px-3 font-condensed tracking-wider">All-Time Cumulative</th>
                    <th className="py-3 px-3 font-condensed tracking-wider">Remaining Variance</th>
                    <th className="py-3 px-3 font-condensed tracking-wider">Utilization</th>
                    <th className="py-3 px-3 font-condensed tracking-wider">Health Status</th>
                    <th className="py-3 px-4 font-condensed tracking-wider">Active Crew (Period)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border/30 text-xs">
                  {reportProjectsData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-base-muted">
                        <div className="flex flex-col items-center justify-center">
                          <Users className="w-8 h-8 text-base-border/60 mb-2" />
                          <p className="font-semibold text-sm">No project timesheet entries identified in this time period.</p>
                          <p className="text-xs text-base-muted2 mt-1">Please select another date range or log hours into daily logs.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reportProjectsData.map(d => {
                      const proj = d.project;
                      
                      // Status styling classes
                      let badgeStyle = 'bg-base-surface3 text-base-muted border border-base-border';
                      let labelText = 'No Budget';
                      if (d.statusGroup === 'healthy') {
                        badgeStyle = 'bg-base-green-dim text-base-green border border-base-green/20';
                        labelText = 'On Track';
                      } else if (d.statusGroup === 'warning') {
                        badgeStyle = 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20';
                        labelText = 'Near Budget';
                      } else if (d.statusGroup === 'danger') {
                        badgeStyle = 'bg-base-red-dim text-base-red border border-base-red/20';
                        labelText = 'Budget Exceeded';
                      }

                      return (
                        <tr key={proj.id} className="hover:bg-base-surface2/20 transition-colors">
                          <td className="py-3.5 px-4 font-condensed font-black text-sm text-base-blue uppercase">
                            {proj.client || '—'}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-base-text hover:text-base-accent hover:underline cursor-pointer transition-all" onClick={() => openSpotlight?.(proj.id)}>
                              {proj.name}
                            </div>
                            <div className="text-[9px] uppercase font-condensed font-bold text-base-muted2 tracking-wider mt-0.5">
                              {proj.location === 'workshop1' ? 'Workshop 1 Batam' : 'Workshop 2 Batam'}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-base-text">
                            {d.budget > 0 ? `${fmtHrs(d.budget)}h` : '—'}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-base-blue">
                            {fmtHrs(d.periodHrs)}h
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-base-text">
                            {fmtHrs(d.cumulativeHrs)}h
                          </td>
                          <td className="py-3.5 px-3">
                            {d.budget > 0 ? (
                              <span className={`font-mono font-bold ${d.variance < 0 ? 'text-base-red' : 'text-base-green'}`}>
                                {d.variance < 0 ? '-' : ''}{fmtHrs(Math.abs(d.variance))}h
                              </span>
                            ) : (
                              <span className="text-base-muted2">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            {d.budget > 0 ? (
                              <div className="space-y-1 w-20">
                                <div className="text-[10px] font-bold text-base-text">{d.utilizationRate.toFixed(1)}%</div>
                                <div className="h-1.5 bg-base-border/20 rounded-full overflow-hidden w-20">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      d.statusGroup === 'danger' 
                                        ? 'bg-base-red' 
                                        : d.statusGroup === 'warning' 
                                          ? 'bg-yellow-500' 
                                          : 'bg-base-green'
                                    }`} 
                                    style={{ width: `${Math.min(100, d.utilizationRate)}%` }} 
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-base-muted2">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded font-condensed font-black text-[9px] uppercase tracking-wider ${badgeStyle}`}>
                              {labelText}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {d.crewNames.length === 0 ? (
                              <span className="text-base-muted2 italic">No labor entries</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {d.crewNames.map(name => (
                                  <span key={name} className="px-1.5 py-0.5 rounded bg-base-surface3 border border-base-border text-[9px] text-base-muted font-bold font-sans">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-base-surface2/30 px-4 py-3.5 border-t border-base-border text-[11px] text-base-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                <span>
                  <strong>Performance Notice:</strong> Variance is computed relative to all-time cumulative man-hours submitted to general databases.
                </span>
              </div>
              <span className="italic font-bold">Total analyzed items count: {reportProjectsData.length}</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
