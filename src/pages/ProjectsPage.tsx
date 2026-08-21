import React from 'react';
import { motion } from 'framer-motion';
import { Project, TimesheetEntry, WireLog, Assembly, Task, MaterialConsumptionLog, OrgSettings } from '../types';
import { Search, Plus, Download, BookOpen, Edit, Clock, Flame, Archive, RotateCcw, Upload, Trash2, List, Calendar, Gauge } from 'lucide-react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { calcPct, calcTaskCounts, fmtHrs, getManHoursForWorkOrder } from '../utils/projectUtils';
import { calcProjectRiskScore, getRiskBadgeClasses } from '../utils/riskScore';
import { downloadProjectPDF } from '../utils/pdfGenerator';
import { useAuth } from '../hooks/useAuth';
import { useAppStore, useUIStore } from '../store';
import { can as canUtil } from '../utils/permissions';
import { ColdStorageArchiveModal } from '../components/ColdStorageArchiveModal';
import * as XLSX from 'xlsx';
import { uid } from '../utils';

function getProjectCriticalPath(p: Project, allProjects: Project[]) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let hasOverdueTasks = false;
  let overdueTasksCount = 0;
  let overduePredecessorsCount = 0;
  let missingPredecessorsCount = 0;
  let isOverdueProject = false;
  const issues: string[] = [];

  // 1. Is the project itself overdue?
  if (p.status !== 'completed' && p.due && p.due < todayStr) {
    isOverdueProject = true;
    issues.push(`Project is past due date (${p.due})`);
  }

  // 2. Are there overdue tasks in this project?
  (p.assemblies || []).forEach(a => {
    (a.tasks || []).forEach(t => {
      if (t.pct < 100 && !t.done && t.finishDate && t.finishDate < todayStr) {
        hasOverdueTasks = true;
        overdueTasksCount++;
      }
    });
  });
  if (overdueTasksCount > 0) {
    issues.push(`${overdueTasksCount} task(s) overdue`);
  }

  // 3. Are there missing or overdue critical dependencies?
  (p.predecessors || []).forEach(dep => {
    if (dep.key.startsWith('p:')) {
      const targetProjId = dep.key.substring(2);
      const targetProj = allProjects.find(ap => ap.id === targetProjId);
      if (!targetProj) {
        missingPredecessorsCount++;
      } else if (targetProj.status !== 'completed' && targetProj.due && targetProj.due < todayStr) {
        overduePredecessorsCount++;
      }
    }
  });

  (p.assemblies || []).forEach(a => {
    const isAsmComplete = (a.tasks || []).length > 0 && (a.tasks || []).every(t => t.pct >= 100 || t.done);
    if (!isAsmComplete) {
      (a.predecessors || []).forEach(dep => {
        if (dep.key.startsWith('a:')) {
          const parts = dep.key.split(':');
          if (parts.length >= 3) {
            const targetAsmId = parts[2];
            let foundAsm = null;
            for (const ap of allProjects) {
              const match = (ap.assemblies || []).find(x => x.id === targetAsmId);
              if (match) {
                foundAsm = match;
                break;
              }
            }
            if (!foundAsm) {
              missingPredecessorsCount++;
            } else {
              const targetAsmComplete = (foundAsm.tasks || []).length > 0 && (foundAsm.tasks || []).every(t => t.pct >= 100 || t.done);
              if (!targetAsmComplete && foundAsm.finish && foundAsm.finish < todayStr) {
                overduePredecessorsCount++;
              }
            }
          }
        }
      });
    }
  });

  if (missingPredecessorsCount > 0) {
    issues.push(`${missingPredecessorsCount} missing dependency reference(s)`);
  }
  if (overduePredecessorsCount > 0) {
    issues.push(`${overduePredecessorsCount} overdue dependency predecessor(s)`);
  }

  const isCritical = isOverdueProject || hasOverdueTasks || missingPredecessorsCount > 0 || overduePredecessorsCount > 0;

  return {
    isCritical,
    isOverdueProject,
    hasOverdueTasks,
    overdueTasksCount,
    overduePredecessorsCount,
    missingPredecessorsCount,
    issues
  };
}

interface ProjectsPageProps {
  projects?: Project[];
  timesheets?: TimesheetEntry[];
  wireLogs?: WireLog[];
  consumptionLogs?: MaterialConsumptionLog[];
  projectSearchQuery?: string;
  setProjectSearchQuery?: (query: string) => void;
  currentTabMonthFilter?: string;
  setCurrentTabMonthFilter?: (month: string) => void;
  openAddProject?: () => void;
  openEditProjectForm?: (pid: string) => void;
  openAssemblyAddForm?: (pid: string) => void;
  setSpotlightProjectId?: (id: string | null) => void;
  setSpotlightOpen?: (open: boolean) => void;
  archiveProject?: (pid: string) => void;
  unarchiveProject?: (pid: string) => void;
  importProjectsExcel?: (projects: Project[]) => void;
  deleteProjectDetails?: (pid: string) => void;
  deleteProjectsExceptTarget?: (targetWorkOrder: string) => void;
  openCopyModalLauncher?: (pid: string) => void;
  // GANTT INTERACTIVE PROPS
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  depModalRowKey?: string | null;
  onCloseDepModal?: () => void;
  orgSettings?: OrgSettings;
  prefs?: { 
    projectsViewMode?: string;
    projectsFilterTab?: string; 
    projectsSortBy?: string;
  };
  onSetPref?: (key: string, value: any) => void;
}

export function ProjectsPage({
  projects: propProjects,
  timesheets: propTimesheets,
  wireLogs: propWireLogs,
  consumptionLogs: propConsumptionLogs = [],
  projectSearchQuery: propProjectSearchQuery,
  setProjectSearchQuery: propSetProjectSearchQuery,
  currentTabMonthFilter: propCurrentTabMonthFilter,
  setCurrentTabMonthFilter: propSetCurrentTabMonthFilter,
  openAddProject = () => {},
  openEditProjectForm = () => {},
  openAssemblyAddForm = () => {},
  setSpotlightProjectId = () => {},
  setSpotlightOpen = () => {},
  archiveProject = () => {},
  unarchiveProject = () => {},
  importProjectsExcel,
  deleteProjectDetails,
  deleteProjectsExceptTarget,
  openCopyModalLauncher,
  onUpdateProject,
  onOpenDepModal,
  depModalOpen,
  depModalRowKey,
  onCloseDepModal,
  orgSettings,
  prefs,
  onSetPref
}: ProjectsPageProps) {
  const { currentUser: authUser } = useAuth();
  const storeProjects = useAppStore((s) => s.projects);
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeWireLogs = useAppStore((s) => s.wireLogs);
  const storeConsumptionLogs = useAppStore((s) => s.consumptionLogs);
  const storeCurrentUser = useAppStore((s) => s.currentUser);
  const inspections = useAppStore((s) => s.inspections);
  const problemReports = useAppStore((s) => s.problemReports);

  const storeProjectSearchQuery = useUIStore((s) => s.projectSearchQuery);
  const storeSetProjectSearchQuery = useUIStore((s) => s.setProjectSearchQuery);
  const storeCurrentTabMonthFilter = useUIStore((s) => s.currentTabMonthFilter);
  const storeSetCurrentTabMonthFilter = useUIStore((s) => s.setCurrentTabMonthFilter);

  const projects = propProjects?.length ? propProjects : storeProjects;
  const timesheets = propTimesheets?.length ? propTimesheets : storeTimesheets;
  const wireLogs = propWireLogs?.length ? propWireLogs : storeWireLogs;
  const consumptionLogs = propConsumptionLogs?.length ? propConsumptionLogs : storeConsumptionLogs;
  const currentUser = authUser || storeCurrentUser;

  const projectSearchQuery = propProjectSearchQuery !== undefined ? propProjectSearchQuery : storeProjectSearchQuery;
  const setProjectSearchQuery = propSetProjectSearchQuery || storeSetProjectSearchQuery;
  const currentTabMonthFilter = propCurrentTabMonthFilter !== undefined ? propCurrentTabMonthFilter : storeCurrentTabMonthFilter;
  const setCurrentTabMonthFilter = propSetCurrentTabMonthFilter || storeSetCurrentTabMonthFilter;

  const can = (perm: any) => canUtil(currentUser, perm);

  const [projectFilterTab, setProjectFilterTab] = React.useState<string>(() => {
    return prefs?.projectsFilterTab || (localStorage.getItem('projectsFilterTab') as any) || 'current';
  });

  const [viewMode, setViewMode] = React.useState<'list' | 'radial'>(() => {
    const saved = (prefs?.projectsViewMode as any) || (localStorage.getItem('gantt_projects_viewMode') as any) || 'list';
    return saved === 'radial' ? 'radial' : 'list';
  });

  const [projectSortBy, setProjectSortBy] = React.useState<'deadline' | 'risk' | 'priority' | 'alphabetical'>(() => {
    return (prefs?.projectsSortBy as any) || (localStorage.getItem('gantt_projects_sortBy') as any) || 'deadline';
  });

  const [coldStorageOpen, setColdStorageOpen] = React.useState(false);

  React.useEffect(() => {
    if (prefs?.projectsFilterTab) {
      setProjectFilterTab(prefs.projectsFilterTab);
    }
  }, [prefs?.projectsFilterTab]);

  React.useEffect(() => {
    if (prefs?.projectsViewMode) {
      setViewMode(prefs.projectsViewMode as any);
    }
  }, [prefs?.projectsViewMode]);

  React.useEffect(() => {
    if (prefs?.projectsSortBy) {
      setProjectSortBy(prefs.projectsSortBy as any);
    }
  }, [prefs?.projectsSortBy]);

  const handleSetFilterTab = (tab: string) => {
    setProjectFilterTab(tab);
    if (onSetPref) onSetPref('projectsFilterTab', tab);
    else localStorage.setItem('projectsFilterTab', tab);
  };

  const handleSetViewMode = (mode: 'list' | 'radial') => {
    setViewMode(mode);
    if (onSetPref) onSetPref('projectsViewMode', mode);
    else localStorage.setItem('gantt_projects_viewMode', mode);
  };

  const handleSetSortBy = (sort: 'deadline' | 'risk' | 'priority' | 'alphabetical') => {
    setProjectSortBy(sort);
    if (onSetPref) onSetPref('projectsSortBy', sort);
    else localStorage.setItem('gantt_projects_sortBy', sort);
  };

  const scopedTimesheetsForPage = currentTabMonthFilter
    ? timesheets.filter(ts => ts.date && ts.date.slice(0, 7) === currentTabMonthFilter)
    : timesheets;

  const triggerExcelUpload = () => {
    const inputEl = document.getElementById('project-excel-input-file') as HTMLInputElement | null;
    if (inputEl) inputEl.click();
  };

  const parseExcelDate = (val: any): string | undefined => {
    if (!val) return undefined;
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
    const str = String(val).trim();
    if (!str) return undefined;
    
    const dateParsed = new Date(str);
    if (!isNaN(dateParsed.getTime())) {
      return dateParsed.toISOString().slice(0, 10);
    }
    return str;
  };

  const parseExcelTargetMonth = (val: any): string | undefined => {
    if (val === undefined || val === null) return undefined;
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
    }
    const str = String(val).trim();
    if (!str) return undefined;

    const num = Number(str);
    if (!isNaN(num)) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
    }

    const cleaned = str.toLowerCase().replace(/[-/]/g, ' ');
    const parts = cleaned.split(/\s+/).filter(Boolean);

    if (parts.length === 2) {
      const monthsMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
        january: 1, february: 2, march: 3, april: 4, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
      };

      let monthNum: number | undefined;
      let yearNum: number | undefined;

      if (monthsMap[parts[0]] !== undefined) {
        monthNum = monthsMap[parts[0]];
        const yrStr = parts[1];
        const yr = parseInt(yrStr, 10);
        if (!isNaN(yr)) {
          yearNum = yr < 100 ? (yr < 70 ? 2000 + yr : 1900 + yr) : yr;
        }
      } else if (monthsMap[parts[1]] !== undefined) {
        monthNum = monthsMap[parts[1]];
        const yrStr = parts[0];
        const yr = parseInt(yrStr, 10);
        if (!isNaN(yr)) {
          yearNum = yr < 100 ? (yr < 70 ? 2000 + yr : 1900 + yr) : yr;
        }
      }

      if (monthNum !== undefined && yearNum !== undefined) {
        const mStr = String(monthNum).padStart(2, '0');
        return `${yearNum}-${mStr}`;
      }
    }

    const yyyyMmRegex = /^(\d{4})-(\d{2})$/;
    if (yyyyMmRegex.test(str)) {
      return str;
    }

    const dateParsed = new Date(str);
    if (!isNaN(dateParsed.getTime())) {
      const y = dateParsed.getFullYear();
      const m = String(dateParsed.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }

    return str;
  };

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(dataArr, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

        if (!rows.length) {
          alert('No data found inside spreadsheet.');
          return;
        }

        let startIndex = 0;
        const firstRow = rows[0];
        if (firstRow && firstRow.length > 0) {
          const firstCell = String(firstRow[0]).trim().toLowerCase();
          if (firstCell === 'project name' || firstCell === 'project_name' || firstCell.includes('project') || firstCell.includes('name')) {
            startIndex = 1; // Skip header row
          }
        }

        const importMap: Record<string, {
          name: string;
          workOrder: string;
          start?: string;
          due?: string;
          category: 'tray' | 'nontray';
          location: 'workshop1' | 'workshop2';
          budgetHours?: number;
          targetMonth?: string;
          gaNumber?: string;
          customer?: string;
          assembliesMap: Record<string, {
            name: string;
            budgetHours?: number;
            start?: string;    // BARU
            finish?: string;   // BARU
            tasks: {
              name: string;
              isMilestone?: boolean;
              start?: string;
              finish?: string;
              difficulty: number;
            }[];
          }>;
        }> = {};

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const cellVal = (idx: number) => {
            if (idx >= row.length || row[idx] === undefined || row[idx] === null) return '';
            return String(row[idx]).trim();
          };

          const pName = cellVal(0);
          if (!pName) continue; // Skip empty project name rows

          const pWorkOrder = cellVal(1) || ('WO-' + uid().toUpperCase());
          const pStart = parseExcelDate(row[2]);
          const pDue = parseExcelDate(row[3]);

          const catRaw = cellVal(4).toLowerCase();
          let category = dynamicCategories.length > 0 ? (typeof dynamicCategories[0] === 'string' ? dynamicCategories[0] : (dynamicCategories[0] as any).key) : 'tray';
          for (const dCat of dynamicCategories) {
            const catKey = typeof dCat === 'string' ? dCat : (dCat as any).key;
            if (catRaw.includes(catKey.toLowerCase())) {
              category = catKey;
              break;
            }
          }

          const dynamicLocs = orgSettings?.projectLocations || ['workshop1', 'workshop2'];
          const locRaw = cellVal(5).toLowerCase();
          let location = dynamicLocs.length > 0 ? (typeof dynamicLocs[0] === 'string' ? dynamicLocs[0] : (dynamicLocs[0] as any).key) : 'workshop1';
          for (const dLoc of dynamicLocs) {
            const locKey = typeof dLoc === 'string' ? dLoc : (dLoc as any).key;
            if (locRaw.includes(locKey.toLowerCase())) {
              location = locKey;
              break;
            }
          }

          const budgetHoursRaw = parseFloat(cellVal(6));
          const budgetHours = isNaN(budgetHoursRaw) ? undefined : budgetHoursRaw;

          const targetMonth = parseExcelTargetMonth(row[7]);

          const assemblyName = cellVal(8);
          const assemblyBudgetHoursRaw = parseFloat(cellVal(9));
          const assemblyBudgetHours = isNaN(assemblyBudgetHoursRaw) ? undefined : assemblyBudgetHoursRaw;

          let assemblyStart = parseExcelDate(row[10]);   // BARU - kolom K
          let assemblyFinish = parseExcelDate(row[11]);  // BARU - kolom L

          if (assemblyStart && assemblyFinish && new Date(assemblyFinish) < new Date(assemblyStart)) {
            // Tandai sebagai invalid, jangan dipakai (biarkan fallback ke auto-calc dari task)
            assemblyStart = undefined;
            assemblyFinish = undefined;
          }

          const taskName = cellVal(12);                     // geser dari 10 -> 12
          const isMilestoneRaw = cellVal(13).toLowerCase(); // geser dari 11 -> 13
          const isMilestone = (isMilestoneRaw === 'yes' || isMilestoneRaw === 'true' || isMilestoneRaw === '1' || isMilestoneRaw === 'y');

          const taskStart = parseExcelDate(row[14]);  // geser dari 12 -> 14
          const taskFinish = parseExcelDate(row[15]); // geser dari 13 -> 15

          const difficultyRaw = parseInt(cellVal(16), 10); // geser dari 14 -> 16
          const difficulty = isNaN(difficultyRaw) || difficultyRaw <= 0 ? 1 : difficultyRaw;
          const gaNumber = cellVal(17).toUpperCase(); // GA Number
          const customer = cellVal(18); // Kolom baru paling akhir — Customer name

          const pKey = pName.toLowerCase() + '||' + pWorkOrder.toLowerCase();

          if (!importMap[pKey]) {
            importMap[pKey] = {
              name: pName,
              workOrder: pWorkOrder,
              start: pStart,
              due: pDue,
              category,
              location,
              budgetHours,
              targetMonth,
              gaNumber: gaNumber || undefined,
              customer: customer.trim() || undefined,
              assembliesMap: {}
            };
          }

          const pGroup = importMap[pKey];
          if (gaNumber && !pGroup.gaNumber) pGroup.gaNumber = gaNumber;
          if (customer && !pGroup.customer) pGroup.customer = customer.trim() || undefined;
          if (pStart && !pGroup.start) pGroup.start = pStart;
          if (pDue && !pGroup.due) pGroup.due = pDue;
          if (budgetHours && !pGroup.budgetHours) pGroup.budgetHours = budgetHours;
          if (targetMonth && !pGroup.targetMonth) pGroup.targetMonth = targetMonth;

          if (assemblyName) {
            const aKey = assemblyName.toLowerCase();
            if (!pGroup.assembliesMap[aKey]) {
              pGroup.assembliesMap[aKey] = {
                name: assemblyName,
                budgetHours: assemblyBudgetHours,
                start: assemblyStart,
                finish: assemblyFinish,
                tasks: []
              };
            }
            const aGroup = pGroup.assembliesMap[aKey];
            if (assemblyBudgetHours && !aGroup.budgetHours) aGroup.budgetHours = assemblyBudgetHours;
            if (assemblyStart && !aGroup.start) aGroup.start = assemblyStart;
            if (assemblyFinish && !aGroup.finish) aGroup.finish = assemblyFinish;

            if (taskName) {
              aGroup.tasks.push({
                name: taskName,
                isMilestone,
                start: taskStart,
                finish: taskFinish,
                difficulty
              });
            }
          }
        }

        const finalProjects: Project[] = Object.values(importMap).map(p => {
          const assemblies: Assembly[] = Object.values(p.assembliesMap).map(a => {
            const tasks: Task[] = a.tasks.map(t => ({
              id: uid(),
              name: t.name,
              pct: 0,
              done: false,
              difficulty: t.difficulty,
              isMilestone: t.isMilestone,
              date: t.start,
              finishDate: t.finish
            }));

            return {
              id: uid(),
              name: a.name,
              budgetHours: a.budgetHours,
              start: a.start,    // BARU - jika kosong, GanttView akan auto-calc dari tasks
              finish: a.finish,  // BARU - jika kosong, GanttView akan auto-calc dari tasks
              tasks
            };
          });

          return {
            id: uid(),
            name: p.name,
            client: p.workOrder,
            gaNumber: p.gaNumber || '',
            customer: p.customer || undefined,
            start: p.start,
            due: p.due,
            status: 'active',
            category: p.category,
            location: p.location,
            created: new Date().toISOString().slice(0, 10),
            assemblies,
            budgetHours: p.budgetHours,
            targetMonth: p.targetMonth,
            notes: ''
          };
        });

        if (finalProjects.length > 0) {
          if (importProjectsExcel) {
            importProjectsExcel(finalProjects);
            alert(`Success! Imported ${finalProjects.length} projects containing ${finalProjects.reduce((acc, curr) => acc + curr.assemblies.length, 0)} assemblies successfully.`);
          } else {
            alert('Import handler not configured.');
          }
        } else {
          alert('No valid projects found to import.');
        }
      } catch (err: any) {
        alert('Parsing spreadsheet documents crashed: ' + err.message);
      }
      ev.target.value = '';
    };
    r.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    try {
      const headers = [
        'Project Name', 'Work Order', 'Start Date', 'Due Date', 'Category',
        'Location', 'Budget Hours', 'Target Month', 'Assembly Name',
        'Assembly Budget Hours', 'Assembly Start', 'Assembly Finish',
        'Task Name', 'Is Milestone', 'Task Start', 'Task Finish', 'Difficulty', 'GA Number', 'Customer'
      ];

      const sampleRows = [
        [
          'Austin Batam Project A', 'WO-2026-001', '2026-07-01', '2026-07-31', 'Tray',
          'Batam Workshop', '120', '2026-07', 'Assembly Structure Alpha',
          '40', '2026-07-02', '2026-07-15',
          'Design Structural Framing', 'No', '2026-07-02', '2026-07-08', '2', 'GA17733', 'PT Chevron Pacific'
        ],
        [
          'Austin Batam Project A', 'WO-2026-001', '2026-07-01', '2026-07-31', 'Tray',
          'Batam Workshop', '120', '2026-07', 'Assembly Structure Alpha',
          '40', '2026-07-02', '2026-07-15',
          'Material Procurement', 'No', '2026-07-09', '2026-07-14', '1', 'GA17733', 'PT Chevron Pacific'
        ],
        [
          'Austin Batam Project A', 'WO-2026-001', '2026-07-01', '2026-07-31', 'Tray',
          'Batam Workshop', '120', '2026-07', 'Assembly Structure Alpha',
          '40', '2026-07-02', '2026-07-15',
          'Alpha Phase Milestone', 'Yes', '2026-07-15', '2026-07-15', '1', 'GA17733', 'PT Chevron Pacific'
        ]
      ];

      const cols = [
        { wch: 22 }, // Project Name
        { wch: 14 }, // Work Order
        { wch: 12 }, // Start Date
        { wch: 12 }, // Due Date
        { wch: 12 }, // Category
        { wch: 16 }, // Location
        { wch: 14 }, // Budget Hours
        { wch: 14 }, // Target Month
        { wch: 22 }, // Assembly Name
        { wch: 20 }, // Assembly Budget Hours
        { wch: 14 }, // Assembly Start
        { wch: 14 }, // Assembly Finish
        { wch: 24 }, // Task Name
        { wch: 12 }, // Is Milestone
        { wch: 12 }, // Task Start
        { wch: 12 }, // Task Finish
        { wch: 10 }, // Difficulty
        { wch: 14 }, // GA Number
        { wch: 20 }  // Customer
      ];

      const guideHeaders = ['Nama Kolom', 'Wajib', 'Format/Tipe', 'Keterangan'];
      const guideRows = [
        ['Project Name', 'Ya', 'Teks', 'Nama project utama (misal: Austin Batam Project A)'],
        ['Work Order', 'Ya', 'Teks', 'Nomor Work Order unik'],
        ['Start Date', 'Ya', 'YYYY-MM-DD', 'Tanggal mulai project'],
        ['Due Date', 'Ya', 'YYYY-MM-DD', 'Tanggal tenggat project'],
        ['Category', 'Ya', 'Tray / Non-Tray', 'Kategori project ("Tray" atau "Non-Tray")'],
        ['Location', 'Tidak', 'Teks', 'Lokasi pengerjaan project'],
        ['Budget Hours', 'Tidak', 'Angka', 'Total budget man-hours project'],
        ['Target Month', 'Tidak', 'YYYY-MM', 'Bulan target pengerjaan (misal: 2026-07)'],
        ['Assembly Name', 'Ya', 'Teks', 'Nama assembly/grup di dalam project'],
        ['Assembly Budget Hours', 'Tidak', 'Angka', 'Budget man-hours untuk assembly ini'],
        ['Assembly Start', 'Tidak', 'YYYY-MM-DD', 'Opsional. Jika kosong, otomatis dihitung dari tanggal task termuda di assembly tsb'],
        ['Assembly Finish', 'Tidak', 'YYYY-MM-DD', 'Opsional. Jika kosong, otomatis dihitung dari tanggal task terlambat di assembly tsb'],
        ['Task Name', 'Ya', 'Teks', 'Nama task di dalam assembly'],
        ['Is Milestone', 'Tidak', 'Yes / No', 'Apakah task ini berupa milestone (Yes jika ya, default No)'],
        ['Task Start', 'Ya', 'YYYY-MM-DD', 'Tanggal mulai task'],
        ['Task Finish', 'Ya', 'YYYY-MM-DD', 'Tanggal selesai task'],
        ['Difficulty', 'Tidak', 'Angka', 'Bobot tingkat kesulitan task (default: 1)'],
        ['GA Number', 'Tidak', 'Teks', 'Nomor identitas jenis produk/desain. Project dengan GA Number sama dianggap produk sejenis dengan material yang sama, walau nama project & client berbeda (misal: GA17733)'],
        ['Customer', 'Tidak', 'Teks', 'Nama customer/end-user akhir dari project ini (contoh: PT Chevron Pacific, Rio Tinto, BHP). Bisa berbeda dengan Work Order yang merupakan nama perusahaan pemberi order langsung.']
      ];

      const wb = XLSX.utils.book_new();

      const wsData = [headers, ...sampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = cols;
      XLSX.utils.book_append_sheet(wb, ws, 'Template Import');

      const wsGuideData = [guideHeaders, ...guideRows];
      const wsGuide = XLSX.utils.aoa_to_sheet(wsGuideData);
      wsGuide['!cols'] = [
        { wch: 22 },
        { wch: 10 },
        { wch: 15 },
        { wch: 80 }
      ];
      XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan');

      XLSX.writeFile(wb, 'Austin_Batam_Project_Template.xlsx');
    } catch (err: any) {
      alert('Error creating template: ' + err.message);
    }
  };

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-base-accent/25 text-base-accent font-black rounded px-0.5 select-all inline-block">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const countCurrent = projects.filter(p => !p.isArchived && (p.status === 'active' || p.status === 'pending' || p.status === 'on-hold')).length;
  const countCompleted = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
  const countArchive = projects.filter(p => p.isArchived === true).length;
  const dynamicCategories = orgSettings?.projectCategories && orgSettings.projectCategories.length > 0 ? orgSettings.projectCategories : ['tray', 'nontray'];

  const renderTabPills = () => (
    <div className="flex flex-wrap bg-base-surface2 border border-base-border p-1 rounded-xl shadow-xs self-start gap-1">
      <button
        onClick={() => handleSetFilterTab('current')}
        className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
          projectFilterTab === 'current'
            ? 'bg-base-accent text-white shadow-xs'
            : 'text-base-muted hover:text-base-text'
        }`}
      >
        <span>Current</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          projectFilterTab === 'current' ? 'bg-white/20 text-white' : 'bg-base-surface3 text-base-muted'
        }`}>
          {countCurrent}
        </span>
      </button>
      <button
        onClick={() => handleSetFilterTab('completed')}
        className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
          projectFilterTab === 'completed'
            ? 'bg-base-accent text-white shadow-xs'
            : 'text-base-muted hover:text-base-text'
        }`}
      >
        <span>Completed</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          projectFilterTab === 'completed' ? 'bg-white/20 text-white' : 'bg-base-surface3 text-base-muted'
        }`}>
          {countCompleted}
        </span>
      </button>
      {dynamicCategories.map((cat: any) => {
        const catStr = typeof cat === 'string' ? cat : (cat.label || cat.key || String(cat));
        const catKey = typeof cat === 'string' ? cat : (cat.key || catStr);
        const catCount = projects.filter(p => p.category === catKey && p.status !== 'completed' && !p.isArchived).length;
        return (
          <button
            key={catKey}
            onClick={() => handleSetFilterTab(catKey)}
            className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              projectFilterTab === catKey ? 'bg-base-accent text-white shadow-xs' : 'text-base-muted hover:text-base-text'
            }`}
          >
            <span>{catStr}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${projectFilterTab === catKey ? 'bg-white/20 text-white' : 'bg-base-surface3 text-base-muted'}`}>
              {catCount}
            </span>
          </button>
        );
      })}
      <button
        onClick={() => handleSetFilterTab('archive')}
        className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
          projectFilterTab === 'archive'
            ? 'bg-base-accent text-white shadow-xs'
            : 'text-base-muted hover:text-base-text'
        }`}
      >
        <span>Archive</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          projectFilterTab === 'archive' ? 'bg-white/20 text-white' : 'bg-base-surface3 text-base-muted'
        }`}>
          {countArchive}
        </span>
      </button>
    </div>
  );

  if (projectFilterTab === 'current') {
    const activePendingProjects = projects.filter(p => !p.isArchived && (p.status === 'active' || p.status === 'pending' || p.status === 'on-hold'));

    const monthOptionsMap: Record<string, string> = {};
    activePendingProjects.forEach(p => {
      if (p.due) {
        const d = new Date(p.due + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthOptionsMap[k] = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
      }
      if (p.start) {
        const d = new Date(p.start + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthOptionsMap[k] = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
      }
    });
    const sortedMonthFilterKeys = Object.keys(monthOptionsMap).sort();

    const rawFilteredProjects = activePendingProjects
      .filter(p => {
        if (currentTabMonthFilter) {
          const startStr = p.start || '';
          const dueStr = p.due || '';
          const matchesStart = startStr.slice(0, 7) === currentTabMonthFilter;
          const matchesDue = dueStr.slice(0, 7) === currentTabMonthFilter;

          const filterStart = `${currentTabMonthFilter}-01`;
          const filterEnd = `${currentTabMonthFilter}-31`;
          const spansFilter = (startStr && dueStr && startStr <= filterEnd && dueStr >= filterStart);

          if (!matchesStart && !matchesDue && !spansFilter) return false;
        }
        return true;
      })
      .filter(p => {
        if (!projectSearchQuery.trim()) return true;
        const q = projectSearchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          (p.customer && p.customer.toLowerCase().includes(q)) ||
          (p.gaNumber && p.gaNumber.toLowerCase().includes(q))
        );
      });

    const filteredProjects = [...rawFilteredProjects].sort((a, b) => {
      if (projectSortBy === 'risk') {
        const riskA = calcProjectRiskScore(a, {
          timesheets: scopedTimesheetsForPage,
          inspections,
          problemReports,
          materialProcessing: a.materialProcessing
        });
        const riskB = calcProjectRiskScore(b, {
          timesheets: scopedTimesheetsForPage,
          inspections,
          problemReports,
          materialProcessing: b.materialProcessing
        });
        if (riskB.score !== riskA.score) {
          return riskB.score - riskA.score; // High risk first
        }
        // Secondary sort by deadline
        const dateA = a.due || '9999-12-31';
        const dateB = b.due || '9999-12-31';
        return dateA.localeCompare(dateB);
      }
      if (projectSortBy === 'deadline') {
        const dateA = a.due || '9999-12-31';
        const dateB = b.due || '9999-12-31';
        return dateA.localeCompare(dateB);
      }
      if (projectSortBy === 'priority') {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 2;
        const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 2;
        if (weightA !== weightB) {
          return weightB - weightA; // High priority first
        }
        // Secondary sort by deadline
        const dateA = a.due || '9999-12-31';
        const dateB = b.due || '9999-12-31';
        return dateA.localeCompare(dateB);
      }
      if (projectSortBy === 'alphabetical') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return 0;
    });

    return (
      <div className="space-y-4 animate-fade-in">
        {renderTabPills()}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap flex-1 min-w-[280px]">
            <h2 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text">
              Current <span className="text-base-accent">Schedules</span>
            </h2>

            {/* Interactive View Toggle: List vs Timeline Gantt vs Radial Gauge */}
            <div className="relative flex bg-base-surface2 border border-base-border/70 rounded-xl p-1 shadow-xs select-none">
              <button
                onClick={() => handleSetViewMode('list')}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                  viewMode === 'list'
                    ? 'text-white font-extrabold'
                    : 'text-base-muted hover:text-base-text'
                }`}
                title="Standard List View"
              >
                {viewMode === 'list' && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <List className="h-3.5 w-3.5" />
                <span>List</span>
              </button>
              <button
                onClick={() => handleSetViewMode('radial')}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                  viewMode === 'radial'
                    ? 'text-white font-extrabold'
                    : 'text-base-muted hover:text-base-text'
                }`}
                title="Radial Gauge Visualization"
              >
                {viewMode === 'radial' && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Gauge className="h-3.5 w-3.5" />
                <span>Radial Gauge</span>
              </button>
            </div>

            {/* Real-time Search Box */}
            <div id="project-search-container" className="relative w-full sm:max-w-xs md:max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-base-muted">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="current-projects-search-input"
                type="text"
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                placeholder="Search name or work order..."
                className="w-full pl-9 pr-8 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs select-text focus:border-base-accent outline-none text-base-text font-medium"
              />
              {projectSearchQuery && (
                <button
                  id="current-projects-clear-search-btn"
                  onClick={() => setProjectSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-base-muted hover:text-base-text cursor-pointer font-bold text-[10px]"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Months Drop-down Filter */}
            <div className="relative">
              <select
                id="current-projects-month-select"
                value={currentTabMonthFilter}
                onChange={(e) => setCurrentTabMonthFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer outline-none focus:border-base-accent text-base-muted2 hover:text-base-text transition-colors"
                title="Filter projects by month"
              >
                <option value="">All Months</option>
                {sortedMonthFilterKeys.map(k => (
                  <option key={k} value={k} className="font-sans normal-case">
                    {monthOptionsMap[k]}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Drop-down Filter */}
            <div className="relative flex items-center gap-1">
              <select
                id="current-projects-sort-select"
                value={projectSortBy}
                onChange={(e: any) => handleSetSortBy(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer outline-none focus:border-base-accent text-base-muted2 hover:text-base-text transition-colors"
                title="Sort projects by"
              >
                <option value="deadline">📅 Sort: Deadline</option>
                <option value="risk">🔥 Sort: Risk Score</option>
                <option value="priority">⚠️ Sort: Priority</option>
                <option value="alphabetical">🔤 Sort: Alphabetical</option>
              </select>
            </div>
          </div>

          {can('addProject') && (
            <div className="flex gap-2">
              <button
                onClick={triggerExcelUpload}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer transition-all flex items-center gap-1.5"
                title="Import projects with custom Excel sheet"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import Excel</span>
              </button>
              <input
                type="file"
                id="project-excel-input-file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={openAddProject}
                className="btn btn-accent btn-sm flex items-center gap-1 font-condensed font-bold uppercase cursor-pointer"
              >
                <span>Add project</span>
              </button>
            </div>
          )}
        </div>

        {/* List current active cards */}
        {viewMode === 'radial' ? (
          <div className="bg-base-surface border border-base-border rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-border/50 pb-4">
              <div className="space-y-1">
                <h3 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-base-accent" />
                  Radial Gauge Visualization
                </h3>
                <p className="text-xs text-base-muted2">
                  High-level radial gauge analytics visualizing overall completion progress across filtered projects.
                </p>
              </div>
              <div className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wider">
                Total Projects: <span className="text-base-accent font-black">{filteredProjects.length}</span>
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-12 text-center bg-base-surface2/30 border border-dashed border-base-border rounded-xl text-base-muted text-xs space-y-3">
                <div>No projects match the selected search or month filter.</div>
                <div className="flex gap-2 justify-center">
                  {projectSearchQuery && (
                    <button
                      onClick={() => setProjectSearchQuery('')}
                      className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                    >
                      Clear search filter
                    </button>
                  )}
                  {currentTabMonthFilter && (
                    <button
                      onClick={() => setCurrentTabMonthFilter('')}
                      className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                    >
                      Clear month filter
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProjects.map(p => {
                  const pct = calcPct(p);
                  const taskCounts = calcTaskCounts(p);
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isOverdue = p.due && p.due < todayStr && p.status !== 'completed';
                  
                  const gaugeColor = pct >= 100 
                    ? '#10b981' 
                    : isOverdue 
                    ? '#f43f5e' 
                    : p.status === 'active' 
                    ? '#3b82f6' 
                    : '#f59e0b';

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSpotlightProjectId(p.id);
                        setSpotlightOpen(true);
                      }}
                      className="bg-base-surface2/30 hover:bg-base-surface2/80 border border-base-border hover:border-base-accent/60 p-4 rounded-xl shadow-xs hover:shadow-card transition-all cursor-pointer group flex flex-col items-center justify-between text-center relative overflow-hidden space-y-3"
                    >
                      {/* Top Bar Info */}
                      <div className="w-full flex items-center justify-between text-[10px] font-condensed font-bold uppercase tracking-wider">
                        <span className="text-base-muted truncate max-w-[140px]" title={p.customer ? `${p.client} — ${p.customer}` : p.client}>
                          {p.client || 'WO N/A'}{p.customer ? ` (${p.customer})` : ''}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md border text-[9px] uppercase font-bold"
                          style={{
                            backgroundColor: p.status === 'completed' ? '#10b98115' : p.status === 'active' ? '#3b82f615' : '#f59e0b15',
                            color: p.status === 'completed' ? '#10b981' : p.status === 'active' ? '#3b82f6' : '#f59e0b',
                            borderColor: p.status === 'completed' ? '#10b98130' : p.status === 'active' ? '#3b82f630' : '#f59e0b30'
                          }}
                        >
                          {p.status}
                        </span>
                      </div>

                      {/* Radial Gauge Chart Container */}
                      <div className="relative w-36 h-36 min-w-[144px] min-h-[144px] flex items-center justify-center my-1" style={{ width: 144, height: 144 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={144} minHeight={144}>
                          <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="72%"
                            outerRadius="100%"
                            barSize={11}
                            data={[{ name: p.name, value: pct, fill: gaugeColor }]}
                            startAngle={90}
                            endAngle={-270}
                          >
                            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                            <RadialBar
                              background={{ fill: 'var(--border)', opacity: 0.3 }}
                              dataKey="value"
                              cornerRadius={8}
                            />
                          </RadialBarChart>
                        </ResponsiveContainer>

                        {/* Center Overlay Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="font-condensed font-black text-2xl tracking-tight text-base-text group-hover:scale-110 transition-transform">
                            {pct}%
                          </span>
                          <span className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-widest">
                            {pct >= 100 ? 'COMPLETE' : 'PROGRESS'}
                          </span>
                        </div>
                      </div>

                      {/* Project Meta Details */}
                      <div className="w-full space-y-1.5 border-t border-base-border/50 pt-2.5">
                        <h4 className="font-condensed font-extrabold text-xs text-base-text truncate group-hover:text-base-accent transition-colors" title={p.name}>
                          {p.name}
                        </h4>

                        <div className="flex items-center justify-center gap-3 text-[11px] text-base-muted">
                          <span className="font-mono font-bold text-base-text">{taskCounts.done}/{taskCounts.total} Tasks</span>
                          <span>•</span>
                          <span className={`font-mono text-[10px] ${isOverdue ? 'text-rose-500 font-bold' : ''}`}>
                            {p.due ? `Due: ${p.due.slice(5)}` : 'No Due Date'}
                          </span>
                        </div>

                        {/* Location & Risk Badges */}
                        <div className="pt-1 flex items-center justify-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-condensed font-bold uppercase tracking-wider text-base-muted px-2 py-0.5 rounded bg-base-bg border border-base-border">
                            {p.location === 'workshop1' ? 'Workshop 1' : p.location === 'workshop2' ? 'Workshop 2' : p.location || 'All Locs'}
                          </span>
                          {(() => {
                            const risk = calcProjectRiskScore(p, {
                              timesheets: scopedTimesheetsForPage,
                              inspections,
                              problemReports,
                              materialProcessing: p.materialProcessing,
                            });
                            if (p.status === 'completed' || p.isArchived) return null;
                            const badgeClass = getRiskBadgeClasses(risk.score);
                            return (
                              <span 
                                className={`text-[9px] font-condensed font-bold uppercase tracking-wider px-2 py-0.5 rounded border cursor-help ${badgeClass}`}
                                title={`Risk Score: ${risk.score}/100\n${risk.reasons.length > 0 ? risk.reasons.map(r => `• ${r}`).join('\n') : 'Risiko rendah'}`}
                              >
                                Risk: {risk.score}
                              </span>
                            );
                          })()}
                          {isOverdue && (
                            <span className="text-[9px] font-condensed font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-border bg-base-surface shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-surface2 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3 text-center">Location</th>
                  <th className="px-4 py-3 text-center">Priority</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-right">Usage</th>
                  <th className="px-4 py-3 text-center">Assemblies</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border text-base-text text-[11px] font-semibold">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-base-muted italic">
                      <div className="flex flex-col items-center gap-3">
                        <span>No current schedules match your filters.</span>
                        <div className="flex gap-2 justify-center not-italic">
                          {projectSearchQuery && (
                            <button
                              onClick={() => setProjectSearchQuery('')}
                              className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                            >
                              Clear search filter
                            </button>
                          )}
                          {currentTabMonthFilter && (
                            <button
                              onClick={() => setCurrentTabMonthFilter('')}
                              className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                            >
                              Clear month filter
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map(p => {
                    const pct = calcPct(p);
                    const hasActiveSearch = projectSearchQuery.trim() !== '';
                    const cp = getProjectCriticalPath(p, projects);
                    const usedHours = getManHoursForWorkOrder(p.client, scopedTimesheetsForPage);
                    const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                    const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                    const totalWire = (wireLogs || [])
                      .filter(wl => wl.projectId === p.id)
                      .reduce((sum, wl) => sum + wl.amountKg, 0);

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-base-surface2/30 transition-colors ${
                          hasActiveSearch ? 'bg-base-accent/5' : ''
                        }`}
                      >
                        {/* Kolom 1: Project name + client + status dot */}
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-base-accent shadow-[0_0_6px_var(--base-accent)]'}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                                  className="font-condensed font-black text-sm tracking-wide text-base-text cursor-pointer hover:text-base-accent transition-colors truncate block"
                                >
                                  {highlightText(p.name, projectSearchQuery)}
                                </span>
                                {hasActiveSearch && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-condensed font-black uppercase bg-base-accent/15 text-base-accent border border-base-accent/30 tracking-wider shrink-0">
                                    MATCH
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-condensed font-bold text-base-blue uppercase tracking-wider font-mono truncate">
                                {highlightText(p.client, projectSearchQuery)}
                                {p.customer && (
                                  <span className="text-emerald-500 font-semibold uppercase font-sans ml-1.5 border-l border-base-border/50 pl-1.5">
                                    👤 {highlightText(p.customer, projectSearchQuery)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Kolom 2: Schedule dates + target month */}
                        <td className="px-4 py-3.5 text-base-muted2">
                          {(p.start || p.due) && (
                            <div className="whitespace-nowrap font-mono text-[10px]">
                              {p.start || '??'} → {p.due || '??'}
                            </div>
                          )}
                          {p.targetMonth && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-condensed font-extrabold uppercase tracking-wide">
                              🎯 {p.targetMonth}
                            </span>
                          )}
                        </td>

                        {/* Kolom 3: Location */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider ${p.location === 'workshop1' ? 'bg-[#9b1c2e]/10 text-[#9b1c2e]/85 border border-[#9b1c2e]/20' : 'bg-base-blue/10 text-base-blue border border-base-blue/20'}`}>
                            {p.location === 'workshop1' ? 'W1' : 'W2'}
                          </span>
                        </td>

                        {/* Kolom 4: Priority */}
                        <td className="px-4 py-3.5 text-center">
                          {p.priority ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border whitespace-nowrap ${
                              p.priority === 'high'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : p.priority === 'low'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {p.priority === 'high' ? '🔴 High' : p.priority === 'low' ? '🟢 Low' : '🟡 Med'}
                            </span>
                          ) : (
                            <span className="text-base-muted">—</span>
                          )}
                        </td>

                        {/* Kolom 5: Flags (Critical Path & Risk Score) */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            {(() => {
                              const risk = calcProjectRiskScore(p, {
                                timesheets: scopedTimesheetsForPage,
                                inspections,
                                problemReports,
                                materialProcessing: p.materialProcessing,
                              });
                              if (p.status === 'completed' || p.isArchived) return null;
                              const badgeClass = getRiskBadgeClasses(risk.score);
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border cursor-help whitespace-nowrap ${badgeClass}`}
                                  title={`Risk Score: ${risk.score}/100\n${risk.reasons.length > 0 ? risk.reasons.map(r => `• ${r}`).join('\n') : 'Risiko rendah'}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${risk.score >= 70 ? 'bg-red-500' : risk.score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  <span>Risk: {risk.score}</span>
                                </span>
                              );
                            })()}
                            {cp.isCritical && (
                              <div
                                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all cursor-help whitespace-nowrap"
                                title={`Critical Path issues:\n${cp.issues.map(iss => `• ${iss}`).join('\n')}`}
                              >
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                                <span>Critical</span>
                              </div>
                            )}
                            {!cp.isCritical && (p.status === 'completed' || p.isArchived) && (
                              <span className="text-base-muted">—</span>
                            )}
                          </div>
                        </td>

                        {/* Kolom 6: Usage (hours + wire) */}
                        <td className="px-4 py-3.5 text-right">
                          <div className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold whitespace-nowrap ${
                            isOverBudget ? 'text-red-500' : hasBudget ? 'text-emerald-500' : 'text-base-accent'
                          }`}>
                            <Clock className="h-2.5 w-2.5" />
                            {fmtHrs(usedHours)}h / {p.budgetHours || '??'}h
                          </div>
                          {totalWire > 0 && (
                            <div className="flex items-center justify-end gap-1 text-amber-500 font-mono text-[10px] font-bold mt-0.5">
                              <Flame className="h-2.5 w-2.5" />
                              {totalWire.toFixed(1)} kg
                            </div>
                          )}
                        </td>

                        {/* Kolom 7: Assemblies count */}
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-base-muted2">
                          {p.assemblies ? p.assemblies.length : 0}
                        </td>

                        {/* Kolom 8: Progress */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5 w-24">
                            <div className="flex justify-between items-center text-[10px] font-condensed font-bold text-base-muted2">
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-base-border/20 rounded-full overflow-hidden w-24">
                              <div className="h-full rounded-full bg-base-accent transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>

                        {/* Kolom 9: Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-0.5">
                            {can('addAssembly') && (
                              <button
                                onClick={() => openAssemblyAddForm(p.id)}
                                className="px-1.5 py-0.5 text-[9px] font-condensed font-extrabold uppercase bg-base-surface2 border border-base-border/80 hover:bg-base-surface3 hover:text-base-text rounded text-base-muted2 cursor-pointer transition-colors whitespace-nowrap"
                                title="Add assembly"
                              >
                                + Assy
                              </button>
                            )}
                            {p.status === 'completed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); downloadProjectPDF(p, timesheets, wireLogs, consumptionLogs); }}
                                className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md cursor-pointer"
                                title="Download completion PDF report"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                              className="p-1 text-base-muted hover:text-base-text hover:bg-base-surface3 rounded-md cursor-pointer"
                              title="Open spotlight inspector"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </button>
                            {can('editProject') && (
                              <button
                                onClick={() => openEditProjectForm(p.id)}
                                className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-md cursor-pointer"
                                title="Edit parameters"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {can('deleteProject') && deleteProjectDetails && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteProjectDetails(p.id); }}
                                className="p-1 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                                title="Delete project permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Handle completed, tray, nontray, archive tabs
  const matchedProjects = projects.filter(p => {
    if (projectFilterTab === 'completed') return p.status === 'completed' && !p.isArchived;
    if (projectFilterTab === 'archive') return p.isArchived === true;
    
    // Check if it matches a dynamic category
    const isDynamicCat = dynamicCategories.some((cat: any) => {
      const catKey = typeof cat === 'string' ? cat : (cat.key || cat.label || String(cat));
      return catKey === projectFilterTab;
    });
    if (isDynamicCat) return p.category === projectFilterTab && p.status !== 'completed' && !p.isArchived;
    
    return false;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {renderTabPills()}
      <div className="flex items-center justify-between">
        <h2 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text">
          {projectFilterTab === 'completed'
            ? 'Completed Log'
            : projectFilterTab === 'archive'
              ? 'Historical Archive'
              : `${projectFilterTab} Sub-directory`}
        </h2>
        {projectFilterTab === 'archive' && (
          <button
            onClick={() => setColdStorageOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs font-condensed font-bold uppercase text-base-muted hover:bg-base-surface2 hover:text-base-accent transition-colors"
          >
            <Archive className="h-4 w-4" />
            <span>Open Cold Storage</span>
          </button>
        )}
      </div>

      {matchedProjects.length === 0 ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-8 text-center text-sm text-base-muted font-medium">
          No projects found in this view.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 animate-fade-in">
          {matchedProjects.map(p => {
            const pct = calcPct(p);
            return (
              <div
                key={p.id}
                onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                className="bg-base-surface border border-base-border hover:border-base-border2 rounded-lg py-1.5 px-3 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 relative group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-base-accent shadow-[0_0_6px_var(--base-accent)]'}`} />
                  <div className="min-w-0">
                    <h3 className="font-condensed font-black text-sm text-base-text leading-tight truncate">{p.name}</h3>
                    <span className="text-[10px] font-condensed font-bold text-base-blue uppercase tracking-wide font-mono mt-0.5 block">{p.client}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-base-muted2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border/30">
                    Due: {p.due || 'No date'}
                  </span>
                  {p.targetMonth && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-condensed font-extrabold uppercase tracking-wide">
                      🎯 Target: {p.targetMonth}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider ${p.location === 'workshop1' ? 'bg-[#9b1c2e]/10 text-[#9b1c2e]/85 border border-[#9b1c2e]/20' : 'bg-base-blue/10 text-base-blue border border-base-blue/20'}`}>
                    {p.location === 'workshop1' ? 'W1' : 'W2'}
                  </span>
                  {p.priority && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border ${
                      p.priority === 'high' 
                        ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                        : p.priority === 'low'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {p.priority === 'high' ? '🔴 High' : p.priority === 'low' ? '🟢 Low' : '🟡 Medium'}
                    </span>
                  )}

                  {(() => {
                    const risk = calcProjectRiskScore(p, {
                      timesheets: scopedTimesheetsForPage,
                      inspections,
                      problemReports,
                      materialProcessing: p.materialProcessing,
                    });
                    if (p.status === 'completed' || p.isArchived) return null;
                    const badgeClass = getRiskBadgeClasses(risk.score);
                    return (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border cursor-help transition-all flex items-center gap-1 ${badgeClass}`}
                        title={`Risk Score: ${risk.score}/100\n${risk.reasons.length > 0 ? risk.reasons.map(r => `• ${r}`).join('\n') : 'Risiko rendah'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${risk.score >= 70 ? 'bg-red-500 animate-ping' : risk.score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <span>Risk: {risk.score}</span>
                      </span>
                    );
                  })()}
                  
                  {(() => {
                    const cp = getProjectCriticalPath(p, projects);
                    if (!cp.isCritical) return null;
                    return (
                      <div 
                        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all cursor-help" 
                        title={`Critical Path issues:\n${cp.issues.map(iss => `• ${iss}`).join('\n')}`}
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                        </span>
                        <span>Critical Path</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const usedHours = getManHoursForWorkOrder(p.client, scopedTimesheetsForPage);
                    const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                    const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                    return (
                      <span className={`font-extrabold text-[10px] uppercase font-condensed px-1.5 py-0.5 rounded border ${
                        isOverBudget
                          ? 'bg-red-500/10 text-red-500 border-red-500/30'
                          : 'bg-base-accent-dim/20 text-base-accent border-transparent'
                      }`}>
                        Hours: {fmtHrs(usedHours)}h{hasBudget ? ` / ${p.budgetHours}h` : ''}
                      </span>
                    );
                  })()}

                  {(() => {
                    const totalWire = (wireLogs || [])
                      .filter(wl => wl.projectId === p.id)
                      .reduce((sum, wl) => sum + wl.amountKg, 0);
                    if (totalWire === 0) return null;
                    return (
                      <span
                        className="flex items-center gap-1 font-extrabold text-[10px] uppercase font-condensed px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-500 border-amber-500/20 transition-all font-mono"
                        title="Total wire consumables logged"
                      >
                        <Flame className="h-2.5 w-2.5 animate-pulse" />
                        <span>Wire: {totalWire.toFixed(1)} kg</span>
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between lg:justify-end w-full lg:w-auto pt-1 lg:pt-0 border-t lg:border-t-0 border-base-border/10">
                  <div className="space-y-0.5 w-16">
                    <div className="flex justify-between items-center text-[9px] font-condensed font-bold text-base-muted2">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 bg-base-border/20 rounded-full overflow-hidden w-16">
                      <div className="h-full rounded-full bg-base-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {p.status === 'completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadProjectPDF(p, timesheets, wireLogs, consumptionLogs);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/25 text-emerald-500 rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1-sm p"
                        title="Download PDF"
                      >
                        <Download className="w-2.5 h-2.5" />
                        <span>PDF</span>
                      </button>
                    )}
                    {p.status === 'completed' && !p.isArchived && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveProject(p.id);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-base-accent-dim hover:bg-base-accent hover:text-white border border-base-accent/20 text-base-accent rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
                        title="Archive completed project"
                      >
                        <Archive className="w-2.5 h-2.5" />
                        <span>Archive</span>
                      </button>
                    )}
                    {p.isArchived && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unarchiveProject(p.id);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
                        title="Restore to Completed Log"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Restore</span>
                      </button>
                    )}
                    {can('deleteProject') && deleteProjectDetails && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProjectDetails(p.id);
                        }}
                        className="px-2 py-0.5 text-[9px] font-condensed font-extrabold bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-500 rounded cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
                        title="Delete project permanently"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ColdStorageArchiveModal
        isOpen={coldStorageOpen}
        onClose={() => setColdStorageOpen(false)}
        archivedProjects={projects.filter(p => p.isArchived === true)}
        onRestoreProject={async (id) => { unarchiveProject(id); }}
        currentUser={currentUser}
      />
    </div>
  );
}

export default ProjectsPage;
