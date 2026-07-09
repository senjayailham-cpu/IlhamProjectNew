import React from 'react';
import { motion } from 'framer-motion';
import { Project, TimesheetEntry, WireLog, Assembly, Task, MaterialConsumptionLog } from '../types';
import { Search, Plus, Download, BookOpen, Edit, Copy, Clock, Flame, Archive, RotateCcw, Upload, Trash2, List, Calendar } from 'lucide-react';
import { calcPct, calcTaskCounts, fmtHrs, getManHoursForWorkOrder } from '../utils/projectUtils';
import { downloadProjectPDF } from '../utils/pdfGenerator';
import { useAuth } from '../hooks/useAuth';
import { can as canUtil } from '../utils/permissions';
import * as XLSX from 'xlsx';
import { uid } from '../utils';
import GanttView from '../components/GanttView';

interface ProjectsPageProps {
  activeTab: 'current' | 'completed' | 'tray' | 'nontray' | 'archive';
  projects: Project[];
  timesheets: TimesheetEntry[];
  wireLogs: WireLog[];
  consumptionLogs?: MaterialConsumptionLog[];
  projectSearchQuery: string;
  setProjectSearchQuery: (query: string) => void;
  currentTabMonthFilter: string;
  setCurrentTabMonthFilter: (month: string) => void;
  openAddProject: () => void;
  openEditProjectForm: (pid: string) => void;
  openAssemblyAddForm: (pid: string) => void;
  openCopyModalLauncher: (pid: string) => void;
  setSpotlightProjectId: (id: string | null) => void;
  setSpotlightOpen: (open: boolean) => void;
  archiveProject: (pid: string) => void;
  unarchiveProject: (pid: string) => void;
  importProjectsExcel?: (projects: Project[]) => void;
  deleteProjectDetails?: (pid: string) => void;
  deleteProjectsExceptTarget?: (targetWorkOrder: string) => void;
  // GANTT INTERACTIVE PROPS
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
  depModalOpen?: boolean;
  depModalRowKey?: string | null;
  onCloseDepModal?: () => void;
}

export function ProjectsPage({
  activeTab,
  projects,
  timesheets,
  wireLogs,
  consumptionLogs = [],
  projectSearchQuery,
  setProjectSearchQuery,
  currentTabMonthFilter,
  setCurrentTabMonthFilter,
  openAddProject,
  openEditProjectForm,
  openAssemblyAddForm,
  openCopyModalLauncher,
  setSpotlightProjectId,
  setSpotlightOpen,
  archiveProject,
  unarchiveProject,
  importProjectsExcel,
  deleteProjectDetails,
  deleteProjectsExceptTarget,
  onUpdateProject,
  onOpenDepModal,
  depModalOpen,
  depModalRowKey,
  onCloseDepModal,
}: ProjectsPageProps) {
  const { currentUser } = useAuth();
  const can = (perm: any) => canUtil(currentUser, perm);

  const [viewMode, setViewMode] = React.useState<'list' | 'timeline'>(() => {
    try {
      return (localStorage.getItem('gantt_projects_viewMode') as 'list' | 'timeline') || 'list';
    } catch (_) {
      return 'list';
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('gantt_projects_viewMode', viewMode);
    } catch (_) {}
  }, [viewMode]);

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
          const category: 'tray' | 'nontray' = (catRaw.includes('nontray') || catRaw.includes('non-tray')) ? 'nontray' : 'tray';

          const locRaw = cellVal(5).toLowerCase();
          const location: 'workshop1' | 'workshop2' = (locRaw.includes('workshop2') || locRaw.includes('w2')) ? 'workshop2' : 'workshop1';

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
              assembliesMap: {}
            };
          }

          const pGroup = importMap[pKey];
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
        'Task Name', 'Is Milestone', 'Task Start', 'Task Finish', 'Difficulty'
      ];

      const sampleRows = [
        [
          'Austin Batam Project A', 'WO-2026-001', '2026-07-01', '2026-07-31', 'Tray',
          'Batam Workshop', '120', '2026-07', 'Assembly Structure Alpha',
          '40', '2026-07-02', '2026-07-15',
          'Design Structural Framing', 'No', '2026-07-02', '2026-07-08', '2'
        ],
        [
          'Austin Batam Project A', 'WO-2026-001', '2026-07-01', '2026-07-31', 'Tray',
          'Batam Workshop', '120', '2026-07', 'Assembly Structure Alpha',
          '40', '2026-07-02', '2026-07-15',
          'Material Procurement', 'No', '2026-07-09', '2026-07-14', '1'
        ],
        [
          'Austin Batam Project A', 'WO-2026-001', '2026-07-01', '2026-07-31', 'Tray',
          'Batam Workshop', '120', '2026-07', 'Assembly Structure Alpha',
          '40', '2026-07-02', '2026-07-15',
          'Alpha Phase Milestone', 'Yes', '2026-07-15', '2026-07-15', '1'
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
        { wch: 10 }  // Difficulty
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
        ['Difficulty', 'Tidak', 'Angka', 'Bobot tingkat kesulitan task (default: 1)']
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

  if (activeTab === 'current') {
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

    const filteredProjects = activePendingProjects
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
          p.client.toLowerCase().includes(q)
        );
      });

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap flex-1 min-w-[280px]">
            <h2 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text">
              Current <span className="text-base-accent">Schedules</span>
            </h2>

            {/* Interactive View Toggle: List vs Timeline Gantt */}
            <div className="relative flex bg-base-surface2 border border-base-border/70 rounded-xl p-1 shadow-xs select-none">
              <button
                onClick={() => setViewMode('list')}
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
                onClick={() => setViewMode('timeline')}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'text-white font-extrabold'
                    : 'text-base-muted hover:text-base-text'
                }`}
                title="Interactive Timeline Gantt View"
              >
                {viewMode === 'timeline' && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-base-accent rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Calendar className="h-3.5 w-3.5" />
                <span>Timeline</span>
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
        {viewMode === 'timeline' ? (
          <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-xs overflow-hidden">
            {filteredProjects.length === 0 ? (
              <div className="py-12 text-center bg-base-surface border border-base-border border-dashed rounded-xl space-y-3">
                <div className="text-base-muted font-medium text-sm">No current schedules match your filters.</div>
                <div className="flex gap-2 justify-center">
                  {projectSearchQuery && (
                    <button
                      id="current-projects-no-results-clear-btn-timeline"
                      onClick={() => setProjectSearchQuery('')}
                      className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                    >
                      Clear search filter
                    </button>
                  )}
                  {currentTabMonthFilter && (
                    <button
                      id="current-projects-no-results-clear-month-btn-timeline"
                      onClick={() => setCurrentTabMonthFilter('')}
                      className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                    >
                      Clear month filter
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <GanttView
                projects={filteredProjects}
                onUpdateProject={onUpdateProject}
                onOpenDepModal={onOpenDepModal}
                depModalOpen={depModalOpen}
                depModalRowKey={depModalRowKey || undefined}
                onCloseDepModal={onCloseDepModal}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProjects.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-base-surface border border-base-border border-dashed rounded-xl space-y-3">
                <div className="text-base-muted font-medium text-sm">No current schedules match your filters.</div>
                <div className="flex gap-2 justify-center">
                  {projectSearchQuery && (
                    <button
                      id="current-projects-no-results-clear-btn"
                      onClick={() => setProjectSearchQuery('')}
                      className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                    >
                      Clear search filter
                    </button>
                  )}
                  {currentTabMonthFilter && (
                    <button
                      id="current-projects-no-results-clear-month-btn"
                      onClick={() => setCurrentTabMonthFilter('')}
                      className="px-3 py-1.5 bg-base-surface border border-base-border text-xs rounded-lg text-base-text hover:bg-base-surface2 cursor-pointer font-condensed font-bold uppercase transition-all"
                    >
                      Clear month filter
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredProjects.map(p => {
                const pct = calcPct(p);
                const hasActiveSearch = projectSearchQuery.trim() !== '';

                return (
                  <div
                    key={p.id}
                    className={`py-1.5 px-3 rounded-lg relative overflow-hidden group transition-all duration-200 border flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 ${
                      hasActiveSearch
                        ? 'bg-base-surface border-2 border-base-accent animate-pulse-highlight'
                        : 'bg-base-surface border-base-border shadow-xs hover:border-base-border2'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${pct === 100 ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-base-accent shadow-[0_0_6px_var(--base-accent)]'}`} />
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3
                            onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                            className="font-condensed font-black text-sm tracking-wide text-base-text cursor-pointer hover:text-base-accent transition-colors leading-tight truncate"
                          >
                            {highlightText(p.name, projectSearchQuery)}
                          </h3>
                          {hasActiveSearch && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-condensed font-black uppercase bg-base-accent/15 text-base-accent border border-base-accent/30 tracking-wider">
                              MATCH
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-condensed font-bold text-base-blue uppercase tracking-wider font-mono">
                          {highlightText(p.client, projectSearchQuery)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-base-muted2 shrink-0">
                      {(p.start || p.due) && (
                        <span className="px-1.5 py-0.5 rounded bg-base-surface2 border border-base-border/30">
                          📅 {p.start ? p.start : '??'} → {p.due ? p.due : '??'}
                        </span>
                      )}
                      {p.targetMonth && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-condensed font-extrabold uppercase tracking-wide">
                          🎯 Target: {p.targetMonth}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wider ${p.location === 'workshop1' ? 'bg-[#9b1c2e]/10 text-[#9b1c2e]/85 border border-[#9b1c2e]/20' : 'bg-base-blue/10 text-base-blue border border-base-blue/20'}`}>
                        {p.location === 'workshop1' ? 'W1' : 'W2'}
                      </span>

                      {(() => {
                        const usedHours = getManHoursForWorkOrder(p.client, scopedTimesheetsForPage);
                        const hasBudget = p.budgetHours !== undefined && p.budgetHours > 0;
                        const isOverBudget = hasBudget && usedHours >= p.budgetHours;
                        return (
                          <span
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border transition-all ${
                              isOverBudget
                                ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                : hasBudget
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-base-accent-dim/20 text-base-accent border-transparent'
                            }`}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            <span>
                              {fmtHrs(usedHours)}h / {p.budgetHours || '??'}h
                            </span>
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
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-condensed font-extrabold uppercase tracking-wide border bg-amber-500/15 text-amber-500 border-amber-500/20 transition-all font-mono"
                            title="Total wire consumables logged"
                          >
                            <Flame className="h-2.5 w-2.5 animate-pulse" />
                            <span>{totalWire.toFixed(1)} kg</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 justify-between lg:justify-end w-full lg:w-auto pt-1 lg:pt-0 border-t lg:border-t-0 border-base-border/10">
                      <div className="flex items-center gap-3">
                        <div className="text-[11px] text-base-muted font-bold font-condensed uppercase tracking-wider hidden sm:block">
                          {p.assemblies ? p.assemblies.length : 0} subassemblies
                        </div>

                        <div className="space-y-0.5 w-20">
                          <div className="flex justify-between items-center text-[10px] font-condensed font-bold text-base-muted2">
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-base-border/20 rounded-full overflow-hidden w-20">
                            <div className="h-full rounded-full bg-base-accent transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {can('addAssembly') && (
                          <button
                            onClick={() => openAssemblyAddForm(p.id)}
                            className="px-1.5 py-0.5 text-[9px] font-condensed font-extrabold uppercase bg-base-surface2 border border-base-border/80 hover:bg-base-surface3 hover:text-base-text rounded text-base-muted2 cursor-pointer transition-colors"
                          >
                            + Assy
                          </button>
                        )}

                        {p.status === 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadProjectPDF(p, timesheets, wireLogs, consumptionLogs);
                            }}
                            className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md"
                            title="Download completion PDF report"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => { setSpotlightProjectId(p.id); setSpotlightOpen(true); }}
                          className="p-1 text-base-muted hover:text-base-text hover:bg-base-surface3 rounded-md"
                          title="Open spotlight inspector"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>

                        {can('editProject') && (
                          <button
                            onClick={() => openEditProjectForm(p.id)}
                            className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-md"
                            title="Edit parameters"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {can('editProject') && (
                          <button
                            onClick={() => openCopyModalLauncher(p.id)}
                            className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded-md"
                            title="Clone project"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {can('deleteProject') && deleteProjectDetails && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProjectDetails(p.id);
                            }}
                            className="p-1 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Delete project permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // Handle completed, tray, nontray, archive tabs
  const matchedProjects = projects.filter(p => {
    if (activeTab === 'completed') return p.status === 'completed' && !p.isArchived;
    if (activeTab === 'tray') return p.category === 'tray' && p.status !== 'completed' && !p.isArchived;
    if (activeTab === 'nontray') return p.category === 'nontray' && p.status !== 'completed' && !p.isArchived;
    if (activeTab === 'archive') return p.isArchived === true;
    return false;
  });

  return (
    <div className="space-y-4">
      <h2 className="font-condensed font-extrabold text-lg uppercase tracking-wider text-base-text">
        {activeTab === 'completed'
          ? 'Completed Log'
          : activeTab === 'tray'
            ? 'Tray Sub-directory'
            : activeTab === 'nontray'
              ? 'Non-Tray Sub-directory'
              : 'Historical Archive'}
      </h2>

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
    </div>
  );
}

export default ProjectsPage;
