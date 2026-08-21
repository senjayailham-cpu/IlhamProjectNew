import React, { useState, useMemo } from 'react';
import { TimesheetEntry, Employee, Project, User } from '../../types';
import { fmtHrs, calcPct } from '../../utils/projectUtils';
import { can } from '../../utils/permissions';
import * as XLSX from 'xlsx';
import { 
  ClipboardList, 
  Users, 
  Search, 
  X, 
  Filter, 
  Download, 
  ExternalLink, 
  Calendar, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ChevronDown, 
  ChevronRight, 
  ArrowUpDown, 
  FileSpreadsheet, 
  Printer, 
  Eye, 
  Briefcase, 
  Check, 
  LayoutGrid, 
  List, 
  Maximize2,
  SlidersHorizontal,
  FolderKanban,
  UserCheck
} from 'lucide-react';

export interface ProjectHoursAllTimeTabProps {
  timesheets: TimesheetEntry[];
  employees: Employee[];
  projects: Project[];
  currentUser?: User | null;
  openSpotlight?: (pid: string) => void;
  openEditTimesheet?: (id: string) => void;
  onNavigateToDaily?: (date: string, workOrder?: string) => void;
}

export interface WorkOrderDetail {
  workOrder: string;
  totalHours: number;
  entryCount: number;
  uniqueEmployees: Map<string, {
    empId: string;
    empName: string;
    position: string;
    coordinator: string;
    hours: number;
    entryCount: number;
    firstDate: string;
    lastDate: string;
  }>;
  assemblies: Map<string, {
    assemblyName: string;
    hours: number;
    entryCount: number;
  }>;
  monthlyHours: Map<string, number>;
  earliestDate: string;
  latestDate: string;
  entries: TimesheetEntry[];
  project?: Project;
}

export const ProjectHoursAllTimeTab: React.FC<ProjectHoursAllTimeTabProps> = ({
  timesheets = [],
  employees = [],
  projects = [],
  currentUser,
  openSpotlight,
  openEditTimesheet,
  onNavigateToDaily
}) => {
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [projectLinkFilter, setProjectLinkFilter] = useState<'all' | 'linked' | 'active' | 'completed' | 'unlinked'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'hours_desc' | 'hours_asc' | 'workers_desc' | 'entries_desc' | 'latest_date' | 'name_asc'>('hours_desc');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'this_year' | 'last_30_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  
  // Expanded Work Orders (Inline Accordion) & Focused Work Order Modal
  const [expandedWOs, setExpandedWOs] = useState<Record<string, boolean>>({});
  const [selectedWOForModal, setSelectedWOForModal] = useState<string | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'manpower' | 'assemblies' | 'logs' | 'monthly'>('manpower');
  const [detailLogsSearch, setDetailLogsSearch] = useState('');

  // 1. Date-filtered Timesheets
  const filteredTimesheets = useMemo(() => {
    if (dateRangePreset === 'all') return timesheets;

    const now = new Date();
    let startStr = '';
    let endStr = '';

    if (dateRangePreset === 'this_year') {
      startStr = `${now.getFullYear()}-01-01`;
      endStr = `${now.getFullYear()}-12-31`;
    } else if (dateRangePreset === 'last_30_days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startStr = past30.toISOString().slice(0, 10);
      endStr = now.toISOString().slice(0, 10);
    } else if (dateRangePreset === 'custom') {
      startStr = customStartDate;
      endStr = customEndDate;
    }

    return timesheets.filter(e => {
      if (!e.date) return false;
      if (startStr && e.date < startStr) return false;
      if (endStr && e.date > endStr) return false;
      return true;
    });
  }, [timesheets, dateRangePreset, customStartDate, customEndDate]);

  // 2. Comprehensive Work Order Aggregation Map
  const workOrderDetailsMap = useMemo(() => {
    const map = new Map<string, WorkOrderDetail>();

    // Index employees for fast O(1) lookup
    const empMap = new Map<string, Employee>();
    employees.forEach(emp => {
      empMap.set(emp.id, emp);
      if (emp.name) empMap.set(emp.name.toLowerCase(), emp);
    });

    // Match projects by client, gaNumber, or name
    const findProjectForWO = (woCode: string): Project | undefined => {
      const clean = woCode.trim().toLowerCase();
      if (!clean) return undefined;
      return projects.find(p => 
        (p.client || '').trim().toLowerCase() === clean ||
        (p.gaNumber || '').trim().toLowerCase() === clean ||
        (p.name || '').trim().toLowerCase() === clean
      );
    };

    filteredTimesheets.forEach(entry => {
      const rawWO = (entry.workOrder || '').trim();
      const woKey = rawWO || '— Unspecified Work Order —';

      if (!map.has(woKey)) {
        const linkedProj = findProjectForWO(rawWO);
        map.set(woKey, {
          workOrder: woKey,
          totalHours: 0,
          entryCount: 0,
          uniqueEmployees: new Map(),
          assemblies: new Map(),
          monthlyHours: new Map(),
          earliestDate: entry.date,
          latestDate: entry.date,
          entries: [],
          project: linkedProj
        });
      }

      const detail = map.get(woKey)!;
      const hrs = entry.totalHours || 0;
      detail.totalHours += hrs;
      detail.entryCount += 1;
      detail.entries.push(entry);

      // Date bounds
      if (entry.date && (!detail.earliestDate || entry.date < detail.earliestDate)) {
        detail.earliestDate = entry.date;
      }
      if (entry.date && (!detail.latestDate || entry.date > detail.latestDate)) {
        detail.latestDate = entry.date;
      }

      // Monthly bounds (YYYY-MM)
      if (entry.date) {
        const monthKey = entry.date.slice(0, 7);
        detail.monthlyHours.set(monthKey, (detail.monthlyHours.get(monthKey) || 0) + hrs);
      }

      // Unique Employee Aggregation
      const empIdentifier = entry.empId || entry.empName || 'unknown';
      const employeeObj = empMap.get(entry.empId) || empMap.get(entry.empName.toLowerCase());
      const empName = entry.empName || employeeObj?.name || 'Unknown Employee';
      const position = employeeObj?.position || 'Crew';
      const coordinator = employeeObj?.coordinator || '—';

      if (!detail.uniqueEmployees.has(empIdentifier)) {
        detail.uniqueEmployees.set(empIdentifier, {
          empId: entry.empId,
          empName,
          position,
          coordinator,
          hours: 0,
          entryCount: 0,
          firstDate: entry.date,
          lastDate: entry.date
        });
      }

      const empDetail = detail.uniqueEmployees.get(empIdentifier)!;
      empDetail.hours += hrs;
      empDetail.entryCount += 1;
      if (entry.date && (!empDetail.firstDate || entry.date < empDetail.firstDate)) empDetail.firstDate = entry.date;
      if (entry.date && (!empDetail.lastDate || entry.date > empDetail.lastDate)) empDetail.lastDate = entry.date;

      // Assembly breakdown
      const asmName = (entry.assemblyName || 'General / Unassigned').trim();
      if (!detail.assemblies.has(asmName)) {
        detail.assemblies.set(asmName, {
          assemblyName: asmName,
          hours: 0,
          entryCount: 0
        });
      }
      const asmDetail = detail.assemblies.get(asmName)!;
      asmDetail.hours += hrs;
      asmDetail.entryCount += 1;
    });

    return map;
  }, [filteredTimesheets, employees, projects]);

  // 3. Filtered & Sorted Work Orders List
  const workOrdersList = useMemo(() => {
    const list = Array.from(workOrderDetailsMap.values());

    return list.filter(wo => {
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesWO = wo.workOrder.toLowerCase().includes(q);
        const matchesProj = wo.project ? (
          wo.project.name.toLowerCase().includes(q) ||
          (wo.project.client || '').toLowerCase().includes(q) ||
          (wo.project.gaNumber || '').toLowerCase().includes(q)
        ) : false;

        // Check if any worker matches
        let matchesWorker = false;
        wo.uniqueEmployees.forEach(emp => {
          if (emp.empName.toLowerCase().includes(q) || emp.position.toLowerCase().includes(q)) {
            matchesWorker = true;
          }
        });

        // Check if any assembly matches
        let matchesAssembly = false;
        wo.assemblies.forEach(asm => {
          if (asm.assemblyName.toLowerCase().includes(q)) {
            matchesAssembly = true;
          }
        });

        if (!matchesWO && !matchesProj && !matchesWorker && !matchesAssembly) {
          return false;
        }
      }

      // Project Link Filter
      if (projectLinkFilter === 'linked') {
        if (!wo.project) return false;
      } else if (projectLinkFilter === 'active') {
        if (!wo.project || wo.project.status !== 'active') return false;
      } else if (projectLinkFilter === 'completed') {
        if (!wo.project || wo.project.status !== 'completed') return false;
      } else if (projectLinkFilter === 'unlinked') {
        if (wo.project) return false;
      }

      // Specific Employee Filter
      if (employeeFilter) {
        let hasEmployee = false;
        wo.uniqueEmployees.forEach(emp => {
          if (emp.empId === employeeFilter || emp.empName.toLowerCase() === employeeFilter.toLowerCase()) {
            hasEmployee = true;
          }
        });
        if (!hasEmployee) return false;
      }

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'hours_desc':
          return b.totalHours - a.totalHours;
        case 'hours_asc':
          return a.totalHours - b.totalHours;
        case 'workers_desc':
          return b.uniqueEmployees.size - a.uniqueEmployees.size;
        case 'entries_desc':
          return b.entryCount - a.entryCount;
        case 'latest_date':
          return (b.latestDate || '').localeCompare(a.latestDate || '');
        case 'name_asc':
          return a.workOrder.localeCompare(b.workOrder);
        default:
          return b.totalHours - a.totalHours;
      }
    });
  }, [workOrderDetailsMap, searchQuery, projectLinkFilter, employeeFilter, sortBy]);

  // 4. Global Statistics for Header
  const globalStats = useMemo(() => {
    let totalHours = 0;
    let totalEntries = 0;
    const allEmployees = new Set<string>();

    workOrdersList.forEach(wo => {
      totalHours += wo.totalHours;
      totalEntries += wo.entryCount;
      wo.uniqueEmployees.forEach((_, empKey) => allEmployees.add(empKey));
    });

    const topWO = workOrdersList.length > 0 ? workOrdersList[0] : null;
    const avgHours = workOrdersList.length > 0 ? totalHours / workOrdersList.length : 0;

    return {
      totalWorkOrders: workOrdersList.length,
      totalHours,
      totalEntries,
      uniqueWorkersCount: allEmployees.size,
      topWO,
      avgHours
    };
  }, [workOrdersList]);

  // Toggle Accordion Expansion
  const toggleWOExpansion = (woKey: string) => {
    setExpandedWOs(prev => ({
      ...prev,
      [woKey]: !prev[woKey]
    }));
  };

  // Export Full Summary to Excel
  const handleExportSummaryExcel = () => {
    if (workOrdersList.length === 0) {
      alert('No work orders available to export.');
      return;
    }

    const summaryData = workOrdersList.map(wo => {
      const budget = wo.project?.budgetHours || 0;
      const variance = budget > 0 ? budget - wo.totalHours : 0;
      const progress = wo.project ? calcPct(wo.project) : null;

      return {
        'Work Order': wo.workOrder,
        'Linked Project Name': wo.project?.name || '— Unlinked / Ad-hoc —',
        'Project Client': wo.project?.client || '',
        'GA Number': wo.project?.gaNumber || '',
        'Project Status': wo.project?.status || 'N/A',
        'Progress %': progress !== null ? `${progress}%` : '',
        'Total Cumulative Hours': wo.totalHours,
        'Budget Hours': budget > 0 ? budget : 'N/A',
        'Budget Variance (Hours)': budget > 0 ? variance : 'N/A',
        'Crew Count': wo.uniqueEmployees.size,
        'Total Log Submissions': wo.entryCount,
        'First Active Date': wo.earliestDate || '',
        'Latest Active Date': wo.latestDate || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Work Orders Summary');
    XLSX.writeFile(wb, `Project_Hours_AllTime_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export Detailed Logs for a specific Work Order
  const handleExportSingleWODetails = (wo: WorkOrderDetail) => {
    const logsData = wo.entries.map(e => ({
      'Date': e.date,
      'Work Order': e.workOrder || wo.workOrder,
      'Employee Name': e.empName,
      'Sub-Assembly': e.assemblyName || '',
      'Hours': e.totalHours,
      'Status': e.status,
      'Description / Task': e.desc || ''
    }));

    const manpowerData = Array.from(wo.uniqueEmployees.values()).map(emp => ({
      'Employee Name': emp.empName,
      'Position': emp.position,
      'Coordinator': emp.coordinator,
      'Total Hours Contributed': emp.hours,
      '% Contribution': wo.totalHours > 0 ? `${((emp.hours / wo.totalHours) * 100).toFixed(1)}%` : '0%',
      'Total Log Count': emp.entryCount,
      'First Logged Date': emp.firstDate,
      'Last Logged Date': emp.lastDate
    }));

    const wb = XLSX.utils.book_new();
    const wsLogs = XLSX.utils.json_to_sheet(logsData);
    const wsManpower = XLSX.utils.json_to_sheet(manpowerData);

    XLSX.utils.book_append_sheet(wb, wsManpower, 'Manpower Breakdown');
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Detailed Timesheets');

    const cleanName = wo.workOrder.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `WO_${cleanName}_Hours_Breakdown.xlsx`);
  };

  // Print Summary
  const handlePrint = () => {
    window.print();
  };

  // Selected WO for Modal
  const activeModalWO = selectedWOForModal ? workOrderDetailsMap.get(selectedWOForModal) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP HEADER & KPI METRICS CARDS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-base-accent" />
            <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
              Project Hours <span className="text-base-accent">(All Time)</span>
            </h2>
          </div>
          <p className="text-xs text-base-muted mt-0.5">
            Comprehensive audit, search, and manpower distribution for every work order logged across the system.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportSummaryExcel}
            className="btn btn-sm bg-base-surface2 border border-base-border text-base-text hover:bg-base-surface3 flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            title="Download Excel Summary of all Work Orders"
          >
            <Download className="h-4 w-4 text-emerald-500" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
            title="Print Report"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* KPI STATS TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-base-surface border border-base-border rounded-xl p-3.5 shadow-card border-b-2 border-b-base-accent">
          <div className="flex items-center justify-between text-base-muted mb-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider">Total Work Orders</span>
            <ClipboardList className="h-4 w-4 text-base-accent opacity-75" />
          </div>
          <div className="text-2xl font-condensed font-extrabold text-base-text">{globalStats.totalWorkOrders}</div>
          <div className="text-[10px] text-base-muted mt-1">Unique scopes recorded</div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-3.5 shadow-card border-b-2 border-b-emerald-500">
          <div className="flex items-center justify-between text-base-muted mb-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider">Cumulative Man-Hours</span>
            <Clock className="h-4 w-4 text-emerald-500 opacity-75" />
          </div>
          <div className="text-2xl font-condensed font-extrabold text-emerald-500">
            {fmtHrs(globalStats.totalHours)}<span className="text-xs ml-0.5">h</span>
          </div>
          <div className="text-[10px] text-base-muted mt-1">From {globalStats.totalEntries} timesheet logs</div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-3.5 shadow-card border-b-2 border-b-base-blue">
          <div className="flex items-center justify-between text-base-muted mb-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider">Active Manpower</span>
            <Users className="h-4 w-4 text-base-blue opacity-75" />
          </div>
          <div className="text-2xl font-condensed font-extrabold text-base-blue">{globalStats.uniqueWorkersCount}</div>
          <div className="text-[10px] text-base-muted mt-1">Distinct technicians/crew</div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-3.5 shadow-card border-b-2 border-b-amber-500">
          <div className="flex items-center justify-between text-base-muted mb-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider">Avg Hours / WO</span>
            <TrendingUp className="h-4 w-4 text-amber-500 opacity-75" />
          </div>
          <div className="text-2xl font-condensed font-extrabold text-amber-500">
            {fmtHrs(globalStats.avgHours)}<span className="text-xs ml-0.5">h</span>
          </div>
          <div className="text-[10px] text-base-muted mt-1">Workload density</div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-3.5 shadow-card border-b-2 border-b-purple-500 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-base-muted mb-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider">Highest Volume WO</span>
            <Briefcase className="h-4 w-4 text-purple-500 opacity-75" />
          </div>
          <div className="text-sm font-condensed font-extrabold text-base-text truncate" title={globalStats.topWO?.workOrder}>
            {globalStats.topWO ? globalStats.topWO.workOrder : '—'}
          </div>
          <div className="text-[10px] text-purple-400 font-bold mt-1">
            {globalStats.topWO ? `${fmtHrs(globalStats.topWO.totalHours)}h (${globalStats.topWO.uniqueEmployees.size} crew)` : 'No entries'}
          </div>
        </div>
      </div>

      {/* 2. SEARCH, FILTER, AND VIEW CONTROLS TOOLBAR */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted" />
            <input
              type="text"
              placeholder="Search Work Order, Project Name, GA Number, Assembly, or Employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-base-surface3 text-base-muted transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Project Link Status Filter */}
          <div className="relative min-w-[170px]">
            <select
              value={projectLinkFilter}
              onChange={(e) => setProjectLinkFilter(e.target.value as any)}
              className="w-full pl-3 pr-8 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text appearance-none focus:outline-none focus:border-base-accent transition-all cursor-pointer font-sans"
            >
              <option value="all">All Work Orders</option>
              <option value="linked">Linked to Project Master</option>
              <option value="active">Active Projects Only</option>
              <option value="completed">Completed Projects</option>
              <option value="unlinked">Unlinked / Ad-hoc WOs</option>
            </select>
            <div className="absolute right-3 top-2.5 pointer-events-none text-base-muted">
              <Filter className="h-4 w-4" />
            </div>
          </div>

          {/* Specific Employee Filter */}
          <div className="relative min-w-[170px]">
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text appearance-none focus:outline-none focus:border-base-accent transition-all cursor-pointer font-sans"
            >
              <option value="">All Manpower</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.position || 'Crew'})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-2.5 pointer-events-none text-base-muted">
              <Users className="h-4 w-4" />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative min-w-[160px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full pl-3 pr-8 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text appearance-none focus:outline-none focus:border-base-accent transition-all cursor-pointer font-sans"
            >
              <option value="hours_desc">Hours (Highest First)</option>
              <option value="hours_asc">Hours (Lowest First)</option>
              <option value="workers_desc">Most Manpower</option>
              <option value="entries_desc">Most Log Entries</option>
              <option value="latest_date">Latest Activity Date</option>
              <option value="name_asc">Work Order (A-Z)</option>
            </select>
            <div className="absolute right-3 top-2.5 pointer-events-none text-base-muted">
              <ArrowUpDown className="h-4 w-4" />
            </div>
          </div>

          {/* View Mode Toggle (Table vs Cards) */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-base-accent text-white shadow-xs' : 'text-base-muted hover:text-base-text'
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-base-accent text-white shadow-xs' : 'text-base-muted hover:text-base-text'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* Date Scope Filter Bar */}
        <div className="flex flex-wrap items-center justify-between border-t border-base-border/50 pt-2.5 gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-base-accent" />
              Date Scope:
            </span>
            <div className="flex items-center gap-1 bg-base-surface2 p-0.5 rounded-lg border border-base-border text-[11px]">
              <button
                onClick={() => setDateRangePreset('all')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  dateRangePreset === 'all' ? 'bg-base-accent text-white font-bold' : 'text-base-muted hover:text-base-text'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setDateRangePreset('this_year')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  dateRangePreset === 'this_year' ? 'bg-base-accent text-white font-bold' : 'text-base-muted hover:text-base-text'
                }`}
              >
                This Year
              </button>
              <button
                onClick={() => setDateRangePreset('last_30_days')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  dateRangePreset === 'last_30_days' ? 'bg-base-accent text-white font-bold' : 'text-base-muted hover:text-base-text'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setDateRangePreset('custom')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  dateRangePreset === 'custom' ? 'bg-base-accent text-white font-bold' : 'text-base-muted hover:text-base-text'
                }`}
              >
                Custom Range
              </button>
            </div>

            {dateRangePreset === 'custom' && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-base-surface2 border border-base-border rounded text-[11px] text-base-text"
                />
                <span className="text-base-muted">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-base-surface2 border border-base-border rounded text-[11px] text-base-text"
                />
              </div>
            )}
          </div>

          {/* Active Filter summary & Clear */}
          {(searchQuery || projectLinkFilter !== 'all' || employeeFilter || dateRangePreset !== 'all') && (
            <div className="flex items-center gap-2">
              <span className="text-base-muted text-[11px]">
                Showing <strong>{workOrdersList.length}</strong> of <strong>{workOrderDetailsMap.size}</strong> work orders
              </span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setProjectLinkFilter('all');
                  setEmployeeFilter('');
                  setDateRangePreset('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] font-bold text-base-red hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
              >
                <X className="h-3 w-3" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. MAIN WORK ORDERS LIST (TABLE OR CARDS) */}
      {workOrdersList.length === 0 ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
          <FolderKanban className="h-12 w-12 text-base-border/80 mb-3" />
          <h3 className="text-sm font-bold text-base-text">No Work Orders Found</h3>
          <p className="text-xs text-base-muted mt-1 max-w-sm">
            No work order records match your search criteria or date filter. Try clearing filters to see all recorded hours.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        
        /* TABLE VIEW WITH INLINE ACCORDION DRILLDOWN */
        <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-base-surface2/50 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border">
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-3">Work Order / Code</th>
                  <th className="py-3 px-4">Associated Project Master</th>
                  <th className="py-3 px-3 text-right">Cumulative Hours</th>
                  <th className="py-3 px-3 text-center">Budget / Variance</th>
                  <th className="py-3 px-3 text-center">Manpower</th>
                  <th className="py-3 px-3 text-center">Log Count</th>
                  <th className="py-3 px-3">Activity Period</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border/40 text-xs">
                {workOrdersList.map((wo) => {
                  const isExpanded = !!expandedWOs[wo.workOrder];
                  const proj = wo.project;
                  const budget = proj?.budgetHours || 0;
                  const progressPct = proj ? calcPct(proj) : null;
                  const variance = budget > 0 ? budget - wo.totalHours : 0;
                  const isOverBudget = budget > 0 && wo.totalHours > budget;

                  return (
                    <React.Fragment key={wo.workOrder}>
                      <tr 
                        className={`hover:bg-base-surface2/30 transition-colors ${
                          isExpanded ? 'bg-base-surface2/40' : ''
                        }`}
                      >
                        {/* Expand Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => toggleWOExpansion(wo.workOrder)}
                            className="p-1 rounded hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse Details' : 'Expand Details'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-base-accent" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        {/* Work Order Code */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-condensed font-extrabold text-sm text-base-blue uppercase tracking-wide">
                              {wo.workOrder}
                            </span>
                            {proj && (
                              <button
                                onClick={() => openSpotlight?.(proj.id)}
                                className="p-0.5 rounded text-base-blue hover:text-base-accent transition-colors cursor-pointer"
                                title={`Open Spotlight: ${proj.name}`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-base-muted mt-0.5">
                            {wo.assemblies.size} sub-assemblies
                          </div>
                        </td>

                        {/* Associated Project */}
                        <td className="py-3 px-4">
                          {proj ? (
                            <div>
                              <div className="font-bold text-base-text truncate max-w-[220px]" title={proj.name}>
                                {proj.name}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-base-muted mt-0.5 flex-wrap">
                                {proj.gaNumber && <span>GA: <strong className="text-base-text">{proj.gaNumber}</strong></span>}
                                {proj.client && <span>Client: <strong>{proj.client}</strong></span>}
                                {progressPct !== null && (
                                  <span className="bg-base-accent/10 text-base-accent px-1 rounded font-bold">
                                    {progressPct}% Done
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-base-muted italic text-[11px]">Unlinked / Ad-hoc WO</span>
                          )}
                        </td>

                        {/* Total Hours */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-condensed font-extrabold text-base text-base-accent bg-base-accent-dim/20 px-2 py-0.5 rounded inline-block">
                            {fmtHrs(wo.totalHours)}h
                          </div>
                        </td>

                        {/* Budget & Variance */}
                        <td className="py-3 px-3 text-center">
                          {budget > 0 ? (
                            <div>
                              <div className="text-[11px] font-condensed font-bold text-base-text">
                                Budget: {fmtHrs(budget)}h
                              </div>
                              <div className={`text-[10px] font-bold ${
                                isOverBudget ? 'text-base-red' : 'text-emerald-500'
                              }`}>
                                {isOverBudget ? `+${fmtHrs(Math.abs(variance))}h Over` : `${fmtHrs(variance)}h Left`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-base-muted text-[10px]">—</span>
                          )}
                        </td>

                        {/* Manpower Count */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-base-surface2 border border-base-border text-[11px] font-semibold text-base-text">
                            <Users className="h-3 w-3 text-base-blue" />
                            <span>{wo.uniqueEmployees.size}</span>
                          </span>
                        </td>

                        {/* Entries count */}
                        <td className="py-3 px-3 text-center">
                          <span className="text-[11px] text-base-muted font-medium">
                            {wo.entryCount} logs
                          </span>
                        </td>

                        {/* Activity Period */}
                        <td className="py-3 px-3">
                          <div className="text-[11px] text-base-text font-medium">
                            {wo.latestDate || '—'}
                          </div>
                          <div className="text-[9px] text-base-muted">
                            First: {wo.earliestDate || '—'}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedWOForModal(wo.workOrder);
                                setModalActiveTab('manpower');
                              }}
                              className="btn btn-xs bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-text flex items-center gap-1 font-condensed font-bold uppercase tracking-wider cursor-pointer"
                              title="Inspect Full Details"
                            >
                              <Eye className="h-3 w-3 text-base-blue" />
                              <span className="hidden sm:inline">Details</span>
                            </button>

                            <button
                              onClick={() => handleExportSingleWODetails(wo)}
                              className="p-1 rounded text-base-muted hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title="Export Work Order to Excel"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            </button>

                            {onNavigateToDaily && wo.latestDate && (
                              <button
                                onClick={() => onNavigateToDaily(wo.latestDate, wo.workOrder)}
                                className="p-1 rounded text-base-muted hover:text-base-accent hover:bg-base-surface3 transition-colors cursor-pointer"
                                title={`Jump to Daily Log (${wo.latestDate})`}
                              >
                                <Calendar className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ACCORDION EXPANDED DRILLDOWN PANEL */}
                      {isExpanded && (
                        <tr className="bg-base-surface2/20 border-b border-base-border">
                          <td colSpan={9} className="p-4 pl-12">
                            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-sm space-y-4 animate-fade-in">
                              
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-base-border/60 pb-3">
                                <div>
                                  <h4 className="font-condensed font-extrabold uppercase text-sm text-base-text flex items-center gap-2">
                                    <span>Work Order Breakdown: {wo.workOrder}</span>
                                    {proj && (
                                      <span className="text-xs font-normal text-base-muted">
                                        ({proj.name})
                                      </span>
                                    )}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleExportSingleWODetails(wo)}
                                    className="text-xs text-emerald-500 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                  >
                                    <Download className="h-3 w-3" />
                                    <span>Export Breakdown</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedWOForModal(wo.workOrder);
                                      setModalActiveTab('manpower');
                                    }}
                                    className="text-xs text-base-accent hover:underline flex items-center gap-1 font-bold cursor-pointer ml-3"
                                  >
                                    <Maximize2 className="h-3 w-3" />
                                    <span>Open Fullscreen Inspector</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Manpower Contribution Table */}
                                <div className="border border-base-border/70 rounded-lg overflow-hidden bg-base-surface2/30">
                                  <div className="px-3 py-2 bg-base-surface2/80 border-b border-base-border/70 flex justify-between items-center text-xs font-condensed font-bold uppercase tracking-wider text-base-text">
                                    <span className="flex items-center gap-1.5">
                                      <Users className="h-3.5 w-3.5 text-base-blue" />
                                      Manpower Distribution ({wo.uniqueEmployees.size})
                                    </span>
                                    <span className="text-[10px] text-base-muted">Hours (% of total)</span>
                                  </div>
                                  <div className="max-h-[220px] overflow-y-auto divide-y divide-base-border/40">
                                    {Array.from(wo.uniqueEmployees.values())
                                      .sort((a, b) => b.hours - a.hours)
                                      .map((emp) => {
                                        const pct = wo.totalHours > 0 ? (emp.hours / wo.totalHours) * 100 : 0;
                                        return (
                                          <div key={emp.empId || emp.empName} className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs hover:bg-base-surface2/50">
                                            <div className="min-w-0 flex-1">
                                              <div className="font-bold text-base-text truncate">{emp.empName}</div>
                                              <div className="text-[10px] text-base-muted">{emp.position} • {emp.entryCount} logs</div>
                                              {/* Mini Contribution Bar */}
                                              <div className="w-full bg-base-border/40 h-1 rounded-full mt-1 overflow-hidden">
                                                <div 
                                                  className="bg-base-accent h-full rounded-full transition-all"
                                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                                />
                                              </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <div className="font-condensed font-extrabold text-sm text-base-accent">{fmtHrs(emp.hours)}h</div>
                                              <div className="text-[10px] font-bold text-base-muted">{pct.toFixed(1)}%</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>

                                {/* Assemblies Breakdown Table */}
                                <div className="border border-base-border/70 rounded-lg overflow-hidden bg-base-surface2/30">
                                  <div className="px-3 py-2 bg-base-surface2/80 border-b border-base-border/70 flex justify-between items-center text-xs font-condensed font-bold uppercase tracking-wider text-base-text">
                                    <span className="flex items-center gap-1.5">
                                      <Layers className="h-3.5 w-3.5 text-amber-500" />
                                      Assembly / Sub-Jobs ({wo.assemblies.size})
                                    </span>
                                    <span className="text-[10px] text-base-muted">Hours</span>
                                  </div>
                                  <div className="max-h-[220px] overflow-y-auto divide-y divide-base-border/40">
                                    {Array.from(wo.assemblies.values())
                                      .sort((a, b) => b.hours - a.hours)
                                      .map((asm) => {
                                        const pct = wo.totalHours > 0 ? (asm.hours / wo.totalHours) * 100 : 0;
                                        return (
                                          <div key={asm.assemblyName} className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs hover:bg-base-surface2/50">
                                            <div className="min-w-0 flex-1">
                                              <div className="font-bold text-base-text truncate">{asm.assemblyName}</div>
                                              <div className="text-[10px] text-base-muted">{asm.entryCount} entries logged</div>
                                              <div className="w-full bg-base-border/40 h-1 rounded-full mt-1 overflow-hidden">
                                                <div 
                                                  className="bg-amber-500 h-full rounded-full transition-all"
                                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                                />
                                              </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <div className="font-condensed font-extrabold text-sm text-amber-500">{fmtHrs(asm.hours)}h</div>
                                              <div className="text-[10px] font-bold text-base-muted">{pct.toFixed(1)}%</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>

                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workOrdersList.map((wo) => {
            const proj = wo.project;
            const budget = proj?.budgetHours || 0;
            const progressPct = proj ? calcPct(proj) : null;
            const isOverBudget = budget > 0 && wo.totalHours > budget;
            const topWorkers = Array.from(wo.uniqueEmployees.values())
              .sort((a, b) => b.hours - a.hours)
              .slice(0, 3);

            return (
              <div 
                key={wo.workOrder}
                className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card hover:border-base-accent/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-base-border/50 pb-2.5 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-condensed font-extrabold text-base text-base-blue uppercase tracking-wide">
                          {wo.workOrder}
                        </span>
                        {proj && (
                          <button
                            onClick={() => openSpotlight?.(proj.id)}
                            className="text-base-blue hover:text-base-accent"
                            title="Open Spotlight"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="font-bold text-xs text-base-text mt-0.5 truncate max-w-[220px]" title={proj?.name || 'Ad-hoc'}>
                        {proj ? proj.name : 'Unlinked Work Order'}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-condensed font-extrabold text-lg text-base-accent bg-base-accent-dim/20 px-2 py-0.5 rounded">
                        {fmtHrs(wo.totalHours)}h
                      </span>
                    </div>
                  </div>

                  {/* Meta Pills */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-base-surface2/50 rounded-lg p-2 mb-3 border border-base-border/50">
                    <div>
                      <div className="text-[9px] font-condensed font-bold text-base-muted uppercase">Crew</div>
                      <div className="text-xs font-extrabold text-base-text">{wo.uniqueEmployees.size}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-condensed font-bold text-base-muted uppercase">Logs</div>
                      <div className="text-xs font-extrabold text-base-text">{wo.entryCount}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-condensed font-bold text-base-muted uppercase">Latest</div>
                      <div className="text-[10px] font-bold text-base-muted truncate">{wo.latestDate || '—'}</div>
                    </div>
                  </div>

                  {/* Budget bar if present */}
                  {budget > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                        <span className="text-base-muted">Budget: {fmtHrs(budget)}h</span>
                        <span className={isOverBudget ? 'text-base-red' : 'text-emerald-500'}>
                          {isOverBudget ? 'Exceeded Budget' : `${fmtHrs(budget - wo.totalHours)}h remain`}
                        </span>
                      </div>
                      <div className="w-full bg-base-border/40 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isOverBudget ? 'bg-base-red' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min((wo.totalHours / budget) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Top Contributors */}
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Top Contributors:</div>
                    {topWorkers.map(w => (
                      <div key={w.empId || w.empName} className="flex justify-between items-center text-[11px]">
                        <span className="text-base-text truncate max-w-[140px]">{w.empName}</span>
                        <span className="font-condensed font-bold text-base-accent">{fmtHrs(w.hours)}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between border-t border-base-border/50 pt-3 mt-2">
                  <button
                    onClick={() => {
                      setSelectedWOForModal(wo.workOrder);
                      setModalActiveTab('manpower');
                    }}
                    className="btn btn-xs bg-base-accent text-white flex items-center gap-1 font-condensed font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <Eye className="h-3 w-3" />
                    <span>View Details</span>
                  </button>

                  <button
                    onClick={() => handleExportSingleWODetails(wo)}
                    className="text-xs text-base-muted hover:text-emerald-500 flex items-center gap-1 cursor-pointer font-bold"
                    title="Export to Excel"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. DEDICATED FULLSCREEN / EXPANDED WORK ORDER INSPECTOR MODAL */}
      {activeModalWO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-base-surface border border-base-border rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-base-surface2 border-b border-base-border flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-condensed font-black text-xl text-base-blue uppercase tracking-wide">
                    {activeModalWO.workOrder}
                  </span>
                  {activeModalWO.project && (
                    <span className="px-2 py-0.5 rounded font-condensed font-bold text-[10px] uppercase tracking-wider bg-base-accent/15 text-base-accent border border-base-accent/20">
                      {activeModalWO.project.status}
                    </span>
                  )}
                  <span className="text-xs text-base-muted font-medium">
                    • First logged: {activeModalWO.earliestDate || '—'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-base-text mt-1">
                  {activeModalWO.project ? activeModalWO.project.name : 'Unlinked Work Order'}
                </h3>
                {activeModalWO.project && (
                  <div className="flex items-center gap-3 text-xs text-base-muted mt-1 flex-wrap">
                    {activeModalWO.project.client && <span>Client: <strong>{activeModalWO.project.client}</strong></span>}
                    {activeModalWO.project.gaNumber && <span>GA: <strong>{activeModalWO.project.gaNumber}</strong></span>}
                    {activeModalWO.project.category && <span>Category: <strong>{activeModalWO.project.category}</strong></span>}
                    {activeModalWO.project.location && <span>Location: <strong>{activeModalWO.project.location}</strong></span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportSingleWODetails(activeModalWO)}
                  className="btn btn-sm bg-base-surface3 border border-base-border text-base-text hover:text-emerald-500 flex items-center gap-1.5 font-condensed font-bold text-xs uppercase cursor-pointer"
                  title="Export this Work Order"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export Excel</span>
                </button>
                {activeModalWO.project && (
                  <button
                    onClick={() => {
                      openSpotlight?.(activeModalWO.project!.id);
                      setSelectedWOForModal(null);
                    }}
                    className="btn btn-sm btn-accent flex items-center gap-1.5 font-condensed font-bold text-xs uppercase cursor-pointer"
                    title="Open Spotlight Project"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open Spotlight</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedWOForModal(null)}
                  className="p-1.5 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                  title="Close Modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Quick Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-base-surface3/30 border-b border-base-border text-center">
              <div>
                <div className="text-[10px] font-condensed font-bold uppercase text-base-muted">Cumulative Hours</div>
                <div className="text-xl font-condensed font-extrabold text-base-accent">{fmtHrs(activeModalWO.totalHours)}h</div>
              </div>
              <div>
                <div className="text-[10px] font-condensed font-bold uppercase text-base-muted">Total Crew</div>
                <div className="text-xl font-condensed font-extrabold text-base-text">{activeModalWO.uniqueEmployees.size} workers</div>
              </div>
              <div>
                <div className="text-[10px] font-condensed font-bold uppercase text-base-muted">Total Entries</div>
                <div className="text-xl font-condensed font-extrabold text-base-text">{activeModalWO.entryCount} logs</div>
              </div>
              <div>
                <div className="text-[10px] font-condensed font-bold uppercase text-base-muted">Latest Activity</div>
                <div className="text-sm font-condensed font-extrabold text-base-blue mt-1">{activeModalWO.latestDate || '—'}</div>
              </div>
            </div>

            {/* Sub-Tabs Nav in Modal */}
            <div className="flex border-b border-base-border px-4 pt-2 bg-base-surface2/50 gap-2">
              <button
                onClick={() => setModalActiveTab('manpower')}
                className={`px-4 py-2 font-condensed font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalActiveTab === 'manpower'
                    ? 'border-base-accent text-base-accent'
                    : 'border-transparent text-base-muted hover:text-base-text'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Manpower Distribution ({activeModalWO.uniqueEmployees.size})</span>
              </button>

              <button
                onClick={() => setModalActiveTab('assemblies')}
                className={`px-4 py-2 font-condensed font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalActiveTab === 'assemblies'
                    ? 'border-base-accent text-base-accent'
                    : 'border-transparent text-base-muted hover:text-base-text'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Sub-Assemblies ({activeModalWO.assemblies.size})</span>
              </button>

              <button
                onClick={() => setModalActiveTab('logs')}
                className={`px-4 py-2 font-condensed font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalActiveTab === 'logs'
                    ? 'border-base-accent text-base-accent'
                    : 'border-transparent text-base-muted hover:text-base-text'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Chronological Timesheets ({activeModalWO.entries.length})</span>
              </button>

              <button
                onClick={() => setModalActiveTab('monthly')}
                className={`px-4 py-2 font-condensed font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalActiveTab === 'monthly'
                    ? 'border-base-accent text-base-accent'
                    : 'border-transparent text-base-muted hover:text-base-text'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Monthly Trend</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 max-h-[500px]">
              
              {/* TAB 1: MANPOWER DISTRIBUTION */}
              {modalActiveTab === 'manpower' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-base-border rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-base-surface2 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border">
                          <th className="py-2.5 px-3">Employee Name</th>
                          <th className="py-2.5 px-3">Position</th>
                          <th className="py-2.5 px-3">Coordinator</th>
                          <th className="py-2.5 px-3 text-center">Log Count</th>
                          <th className="py-2.5 px-3 text-right">Hours Logged</th>
                          <th className="py-2.5 px-3 text-right">% of WO</th>
                          <th className="py-2.5 px-3">Active Period</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/40">
                        {Array.from(activeModalWO.uniqueEmployees.values())
                          .sort((a, b) => b.hours - a.hours)
                          .map((emp) => {
                            const pct = activeModalWO.totalHours > 0 ? (emp.hours / activeModalWO.totalHours) * 100 : 0;
                            return (
                              <tr key={emp.empId || emp.empName} className="hover:bg-base-surface2/30">
                                <td className="py-2.5 px-3 font-bold text-base-text">{emp.empName}</td>
                                <td className="py-2.5 px-3 text-base-muted">{emp.position}</td>
                                <td className="py-2.5 px-3 text-base-muted">{emp.coordinator}</td>
                                <td className="py-2.5 px-3 text-center font-medium">{emp.entryCount}</td>
                                <td className="py-2.5 px-3 text-right font-condensed font-extrabold text-sm text-base-accent">
                                  {fmtHrs(emp.hours)}h
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-base-muted">
                                  {pct.toFixed(1)}%
                                </td>
                                <td className="py-2.5 px-3 text-[10px] text-base-muted">
                                  {emp.firstDate} → {emp.lastDate}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: SUB-ASSEMBLIES */}
              {modalActiveTab === 'assemblies' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-base-border rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-base-surface2 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border">
                          <th className="py-2.5 px-3">Sub-Assembly / Task Scope</th>
                          <th className="py-2.5 px-3 text-center">Logs Count</th>
                          <th className="py-2.5 px-3 text-right">Cumulative Hours</th>
                          <th className="py-2.5 px-3 text-right">% Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/40">
                        {Array.from(activeModalWO.assemblies.values())
                          .sort((a, b) => b.hours - a.hours)
                          .map((asm) => {
                            const pct = activeModalWO.totalHours > 0 ? (asm.hours / activeModalWO.totalHours) * 100 : 0;
                            return (
                              <tr key={asm.assemblyName} className="hover:bg-base-surface2/30">
                                <td className="py-2.5 px-3 font-bold text-base-text">{asm.assemblyName}</td>
                                <td className="py-2.5 px-3 text-center font-medium">{asm.entryCount}</td>
                                <td className="py-2.5 px-3 text-right font-condensed font-extrabold text-sm text-amber-500">
                                  {fmtHrs(asm.hours)}h
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-base-muted">
                                  {pct.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: CHRONOLOGICAL TIMESHEETS */}
              {modalActiveTab === 'logs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-base-muted" />
                      <input
                        type="text"
                        placeholder="Filter logs by employee or description..."
                        value={detailLogsSearch}
                        onChange={(e) => setDetailLogsSearch(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text"
                      />
                    </div>
                    <span className="text-xs text-base-muted">
                      Total: <strong>{activeModalWO.entries.length}</strong> logs
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-base-border rounded-xl max-h-[350px]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-base-surface2 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border sticky top-0">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Sub-Assembly</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/40">
                        {activeModalWO.entries
                          .filter(e => {
                            if (!detailLogsSearch.trim()) return true;
                            const q = detailLogsSearch.toLowerCase();
                            return (
                              e.empName.toLowerCase().includes(q) ||
                              (e.desc || '').toLowerCase().includes(q) ||
                              (e.assemblyName || '').toLowerCase().includes(q) ||
                              e.date.includes(q)
                            );
                          })
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map(entry => (
                            <tr key={entry.id} className="hover:bg-base-surface2/30">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-base-muted">{entry.date}</td>
                              <td className="py-2.5 px-3 font-bold text-base-text">{entry.empName}</td>
                              <td className="py-2.5 px-3">
                                <div>
                                  <div className="text-base-text font-medium">{entry.assemblyName || '—'}</div>
                                  {entry.taskName && (
                                    <div className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5 mt-0.5">
                                      <span>▸</span>
                                      <span>{entry.taskName}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-base-muted2 max-w-[250px] truncate" title={entry.desc}>
                                {entry.desc || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[9px] font-condensed font-bold uppercase tracking-wider bg-base-surface3 border border-base-border">
                                  {entry.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-condensed font-extrabold text-sm text-base-accent">
                                {fmtHrs(entry.totalHours)}h
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: MONTHLY TREND */}
              {modalActiveTab === 'monthly' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from(activeModalWO.monthlyHours.entries())
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([monthKey, hrs]) => {
                        const pct = activeModalWO.totalHours > 0 ? (hrs / activeModalWO.totalHours) * 100 : 0;
                        return (
                          <div key={monthKey} className="bg-base-surface2 border border-base-border rounded-xl p-3 shadow-xs">
                            <div className="text-xs font-condensed font-bold text-base-muted uppercase">{monthKey}</div>
                            <div className="text-xl font-condensed font-extrabold text-base-accent mt-1">{fmtHrs(hrs)}h</div>
                            <div className="text-[10px] text-base-muted font-semibold mt-0.5">{pct.toFixed(1)}% of total</div>
                            <div className="w-full bg-base-border/50 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div className="bg-base-accent h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-base-surface2 border-t border-base-border flex justify-end">
              <button
                onClick={() => setSelectedWOForModal(null)}
                className="btn btn-sm btn-ghost border border-base-border font-condensed font-bold text-xs uppercase cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
