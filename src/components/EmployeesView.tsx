import React, { useState, useMemo } from 'react';
import { Employee, TimesheetEntry, WireLog, UserRoleType } from '../types';
import { can } from '../utils/permissions';
import {
  Search,
  UserPlus,
  Upload,
  User,
  Trash2,
  Edit,
  ChevronsDownUp,
  ChevronsUpDown,
  UserMinus,
  UserCheck,
  Calendar,
  TrendingUp,
  Clock,
  ArrowLeft,
  ArrowRight,
  FileText,
  Info,
  MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';

interface EmployeesViewProps {
  employees: Employee[];
  timesheets: TimesheetEntry[];
  wireLogs: WireLog[];
  currentUser: { id: string; name: string; role: UserRoleType } | null;
  openAddEmployee: () => void;
  openEditEmployee: (id: string) => void;
  deleteEmployee: (id: string) => void;
  onImportExcel: (imported: Omit<Employee, 'id'>[]) => void;
  onMarkExEmployee: (id: string, resignDate: string, resignReason: string) => void;
  onReinstateEmployee: (id: string) => void;
  onClearAllEmployees?: () => void;
  onBulkUpdateEmployees?: (ids: string[], updates: Partial<Employee>) => void;
}

const COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db'];

function getEmpColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return COLORS[h % COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateStr(str?: string) {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = months[monthIdx] || m;
  return `${parseInt(d, 10)} ${monthName} ${y}`;
}

function parseExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    // Excel base date is 1899-12-30 due to 1900 leap year bug
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      const date = new Date((num - 25569) * 86400 * 1000);
      return date.toISOString().slice(0, 10);
    }
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  return String(val);
}

const getMonthsInRange = (from: string, to: string) => {
  const months: string[] = [];
  let [fY, fM] = from.split('-').map(Number);
  const [tY, tM] = to.split('-').map(Number);

  while (fY < tY || (fY === tY && fM <= tM)) {
    months.push(`${fY}-${fM.toString().padStart(2, '0')}`);
    fM++;
    if (fM > 12) {
      fM = 1;
      fY++;
    }
  }
  return months;
};

export default function EmployeesView({
  employees,
  timesheets,
  wireLogs,
  currentUser,
  openAddEmployee,
  openEditEmployee,
  deleteEmployee,
  onImportExcel,
  onMarkExEmployee,
  onReinstateEmployee,
  onClearAllEmployees,
  onBulkUpdateEmployees
}: EmployeesViewProps) {
  const [activeTab, setActiveTab] = useState<'workshop1' | 'workshop2' | 'other' | 'kpi' | 'ex'>('workshop1');
  const [groupBy, setGroupBy] = useState<'coordinator' | 'location'>('coordinator');
  const [q, setQ] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const isRosterTab = activeTab === 'workshop1' || activeTab === 'workshop2' || activeTab === 'other';

  // States for Bulk Updates
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [bulkShift, setBulkShift] = useState<string>('');
  const [bulkCoordinator, setBulkCoordinator] = useState<string>('');
  const [bulkCoordType, setBulkCoordType] = useState<'existing' | 'custom'>('existing');
  const [bulkLocation, setBulkLocation] = useState<string>('');

  // Clear selections when switching tabs
  React.useEffect(() => {
    setSelectedEmpIds([]);
    setBulkShift('');
    setBulkCoordinator('');
    setBulkLocation('');
    setBulkCoordType('existing');
  }, [activeTab]);

  // Compute unique coordinators and locations for bulk selectors
  const uniqueCoordinators = useMemo(() => {
    const list = employees
      .map(e => (e.coordinator || '').trim())
      .filter((v, i, a) => v && a.indexOf(v) === i);
    return list.sort();
  }, [employees]);

  const uniqueLocations = useMemo(() => {
    const list = employees
      .map(e => (e.location || '').trim())
      .filter((v, i, a) => v && a.indexOf(v) === i);
    return list.sort();
  }, [employees]);

  const handleApplyBulkChanges = () => {
    if (!onBulkUpdateEmployees) {
      alert("Bulk update function is not configured.");
      return;
    }
    const updates: Partial<Employee> = {};
    if (bulkShift) updates.shift = bulkShift;
    if (bulkCoordinator.trim()) updates.coordinator = bulkCoordinator.trim();
    if (bulkLocation) updates.location = bulkLocation;

    if (Object.keys(updates).length === 0) return;

    onBulkUpdateEmployees(selectedEmpIds, updates);
    setSelectedEmpIds([]);
    setBulkShift('');
    setBulkCoordinator('');
    setBulkLocation('');
    setBulkCoordType('existing');
  };

  // States for Mark as Ex-Employee inline form
  const [markingExId, setMarkingExId] = useState<string | null>(null);
  const [resignDate, setResignDate] = useState<string>('');
  const [resignReason, setResignReason] = useState<string>('');

  // States for KPI tab
  const [selectedKpiEmpId, setSelectedKpiEmpId] = useState<string>('');
  const [kpiSearch, setKpiSearch] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>(() => {
    // July is month 6 (0-indexed). Go back 2 months to May.
    const d = new Date(2026, 6, 1);
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 7); // "2026-05"
  });
  const [filterTo, setFilterTo] = useState<string>('2026-07');

  // States for Attendance tab
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>('2026-07');

  const canManageEmployees = can(currentUser as any, 'manageEmployees');
  const canDeleteEmployee = can(currentUser as any, 'deleteEmployee');

  const toggleGroup = (coord: string) => {
    setCollapsedGroups(prev => ({ ...prev, [coord]: !prev[coord] }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value);
  };

  // ROSTER LIST (isExEmployee !== true)
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.isExEmployee !== true);
  }, [employees]);

  // EX-EMPLOYEES LIST (isExEmployee === true)
  const exEmployees = useMemo(() => {
    return employees.filter(e => e.isExEmployee === true);
  }, [employees]);

  // Active employees filtered specifically for the selected tab/location menu
  const activeEmployeesForTab = useMemo(() => {
    if (activeTab === 'workshop1') {
      return activeEmployees.filter(e => (e.location || '').trim().toLowerCase() === 'workshop 1');
    }
    if (activeTab === 'workshop2') {
      return activeEmployees.filter(e => (e.location || '').trim().toLowerCase() === 'workshop 2');
    }
    if (activeTab === 'other') {
      return activeEmployees.filter(e => {
        const loc = (e.location || '').trim().toLowerCase();
        return loc !== 'workshop 1' && loc !== 'workshop 2';
      });
    }
    return activeEmployees;
  }, [activeEmployees, activeTab]);

  const filteredRoster = useMemo(() => {
    if (!q) return activeEmployeesForTab;
    const term = q.toLowerCase();
    return activeEmployeesForTab.filter(e =>
      (
        e.name +
        (e.empNo || '') +
        (e.position || '') +
        (e.location || '') +
        (e.coordinator || '')
      ).toLowerCase().includes(term)
    );
  }, [activeEmployeesForTab, q]);

  const filteredEx = useMemo(() => {
    if (!q) return exEmployees;
    const term = q.toLowerCase();
    return exEmployees.filter(e =>
      (
        e.name +
        (e.empNo || '') +
        (e.position || '') +
        (e.location || '') +
        (e.coordinator || '')
      ).toLowerCase().includes(term)
    );
  }, [exEmployees, q]);

  // Roster Location Summary Bar computation
  const locationSummaries = useMemo(() => {
    const locs: Record<string, { headcount: number; positions: Record<string, number> }> = {};
    activeEmployeesForTab.forEach(e => {
      const loc = e.location?.trim() || 'No Location Assigned';
      if (!locs[loc]) {
        locs[loc] = { headcount: 0, positions: {} };
      }
      locs[loc].headcount++;
      if (e.position) {
        const pos = e.position.trim();
        locs[loc].positions[pos] = (locs[loc].positions[pos] || 0) + 1;
      }
    });
    return Object.entries(locs).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeEmployeesForTab]);

  // Group employees dynamically for Roster tab (by Coordinator or by Location)
  const groupedData = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    filteredRoster.forEach(e => {
      const key = groupBy === 'coordinator'
        ? ((e.coordinator || '').trim() || '— No coordinator —')
        : ((e.location || '').trim() || '— No location assigned —');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(e);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const isAEmpty = a.startsWith('—');
      const isBEmpty = b.startsWith('—');
      if (isAEmpty && !isBEmpty) return 1;
      if (!isAEmpty && isBEmpty) return -1;
      return a.localeCompare(b);
    });

    return { groups, sortedKeys };
  }, [filteredRoster, groupBy]);

  // Overall attendance stats per employee computed from timesheets
  const employeeAttendanceStats = useMemo(() => {
    const stats: Record<string, { present: number; late: number; absent: number; leave: number; total: number }> = {};
    timesheets.forEach(t => {
      if (!stats[t.empId]) {
        stats[t.empId] = { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
      }
      stats[t.empId].total++;
      if (t.status === 'present') stats[t.empId].present++;
      else if (t.status === 'late') stats[t.empId].late++;
      else if (t.status === 'absent') stats[t.empId].absent++;
      else if (t.status === 'leave') stats[t.empId].leave++;
    });
    return stats;
  }, [timesheets]);

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groupedData.sortedKeys.forEach(k => {
      next[k] = true;
    });
    setCollapsedGroups(next);
  };

  const expandAll = () => {
    setCollapsedGroups({});
  };

  const triggerExcelUpload = () => {
    const inputEl = document.getElementById('emp-excel-input-file') as HTMLInputElement | null;
    if (inputEl) inputEl.click();
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
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) {
          alert('No logs found inside spreadsheet document template.');
          return;
        }

        const norm = (s: any) => s.toString().trim().toLowerCase();
        const findKey = (row: any, ...variants: string[]) => {
          const keys = Object.keys(row);
          for (const v of variants) {
            const f = keys.find(k => norm(k) === norm(v));
            if (f) return f;
          }
          return null;
        };

        const first = rows[0] as any;
        const kName = findKey(first, 'name', 'full name', 'employee name', 'nama');
        const kPos = findKey(first, 'position', 'jabatan', 'role', 'job title');
        const kLoc = findKey(first, 'location', 'lokasi', 'site', 'area');
        const kCoord = findKey(first, 'coordinator', 'koordinator', 'supervisor', 'managed by');
        const kEmpNo = findKey(first, 'emp. no', 'emp no', 'employee no', 'id');
        const kShift = findKey(first, 'shift', 'shif');
        const kJoinDate = findKey(first, 'join date', 'join_date', 'tanggal gabung');
        const kEoc = findKey(first, 'eoc', 'end of contract', 'kontrak selesai');
        const kStatus = findKey(first, 'status ', 'status'); // Status has a trailing space

        if (!kName) {
          alert('Could not map "Name" headers. Ensure Column 1 or headers contains Full Name, Position, Location, etc.');
          return;
        }

        const validImport: Omit<Employee, 'id'>[] = [];
        rows.forEach((row: any) => {
          const name = row[kName]?.toString().trim();
          if (!name) return;
          validImport.push({
            name,
            position: kPos ? row[kPos]?.toString().trim() : '',
            location: kLoc ? row[kLoc]?.toString().trim() : '',
            coordinator: kCoord ? row[kCoord]?.toString().trim() : '',
            empNo: kEmpNo ? row[kEmpNo]?.toString().trim() : '',
            shift: kShift ? row[kShift]?.toString().trim() : 'DAY SHIFT',
            joinDate: kJoinDate ? parseExcelDate(row[kJoinDate]) : '',
            eoc: kEoc ? parseExcelDate(row[kEoc]) : '',
            employmentStatus: kStatus ? row[kStatus]?.toString().trim() : 'Permanent',
            isExEmployee: false
          });
        });

        if (validImport.length > 0) {
          onImportExcel(validImport);
          alert(`Success! Imported ${validImport.length} employee records.`);
        } else {
          alert('No valid employees found to import.');
        }
      } catch (err: any) {
        alert('Parsing spreadsheet documents crashed: ' + err.message);
      }
      ev.target.value = '';
    };
    r.readAsArrayBuffer(file);
  };

  const handleMarkExSubmit = (empId: string) => {
    if (!resignDate || !resignReason.trim()) {
      alert('Resignation date and reason are required.');
      return;
    }
    onMarkExEmployee(empId, resignDate, resignReason.trim());
    setMarkingExId(null);
    setResignDate('');
    setResignReason('');
  };

  // KPI Computations for Selected Employee
  const kpiEmployees = useMemo(() => {
    if (!kpiSearch) return employees;
    const t = kpiSearch.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(t));
  }, [employees, kpiSearch]);

  const activeKpiEmp = useMemo(() => {
    const target = selectedKpiEmpId || (kpiEmployees.length > 0 ? kpiEmployees[0].id : '');
    return employees.find(e => e.id === target);
  }, [employees, selectedKpiEmpId, kpiEmployees]);

  const kpiData = useMemo(() => {
    if (!activeKpiEmp) return null;

    // Filter wireLogs
    const filteredWire = wireLogs.filter(w =>
      (w.welderId === activeKpiEmp.id || w.welderName === activeKpiEmp.name) &&
      w.date.slice(0, 7) >= filterFrom &&
      w.date.slice(0, 7) <= filterTo
    );

    const totalWireKg = filteredWire.reduce((acc, curr) => acc + curr.amountKg, 0);

    // Aggregate by project/assembly
    const wireBreakdown: Record<string, { projectName: string; assemblyName: string; amountKg: number }> = {};
    filteredWire.forEach(w => {
      const key = `${w.projectId}-${w.assemblyId}`;
      if (!wireBreakdown[key]) {
        wireBreakdown[key] = { projectName: w.projectName, assemblyName: w.assemblyName, amountKg: 0 };
      }
      wireBreakdown[key].amountKg += w.amountKg;
    });

    // Filter timesheets
    const filteredTimesheets = timesheets.filter(t =>
      t.empId === activeKpiEmp.id &&
      t.date.slice(0, 7) >= filterFrom &&
      t.date.slice(0, 7) <= filterTo
    );

    // Attendance breakdown counting
    let countPresent = 0;
    let countLate = 0;
    let countSick = 0;
    let countAnnual = 0;
    let countUnpaid = 0;
    let countHalf = 0;
    let countOtherLeave = 0;
    let countAbsence = 0;

    filteredTimesheets.forEach(t => {
      if (t.status === 'present') {
        countPresent++;
      } else if (t.status === 'late') {
        countLate++;
      } else if (t.status === 'absent') {
        countAbsence++;
      } else if (t.status === 'leave') {
        const desc = (t.desc || '').toLowerCase();
        if (desc.includes('annual') || desc.includes('al')) {
          countAnnual++;
        } else if (desc.includes('sick') || desc.includes('mc')) {
          countSick++;
        } else if (desc.includes('unpaid') || desc.includes('ul')) {
          countUnpaid++;
        } else if (desc.includes('half')) {
          countHalf++;
        } else {
          countOtherLeave++;
        }
      }
    });

    // Generate month array for trends
    const months = getMonthsInRange(filterFrom, filterTo);
    const trendData = months.map(m => {
      // Wire consumed in month
      const wireInMonth = filteredWire
        .filter(w => w.date.slice(0, 7) === m)
        .reduce((sum, curr) => sum + curr.amountKg, 0);

      // Attendance stats in month
      const tsInMonth = filteredTimesheets.filter(t => t.date.slice(0, 7) === m);
      let present = 0, late = 0, sick = 0, annual = 0, unpaid = 0, half = 0, absence = 0;
      tsInMonth.forEach(t => {
        if (t.status === 'present') present++;
        else if (t.status === 'late') late++;
        else if (t.status === 'absent') absence++;
        else if (t.status === 'leave') {
          const desc = (t.desc || '').toLowerCase();
          if (desc.includes('annual') || desc.includes('al')) annual++;
          else if (desc.includes('sick') || desc.includes('mc')) sick++;
          else if (desc.includes('unpaid') || desc.includes('ul')) unpaid++;
          else if (desc.includes('half')) half++;
        }
      });

      const [y, mm] = m.split('-');
      const monthLabel = new Date(parseInt(y), parseInt(mm) - 1, 1).toLocaleDateString('en-US', { month: 'short' });

      return {
        month: m,
        monthLabel,
        wireKg: wireInMonth,
        Present: present,
        Late: late,
        Sick: sick,
        'Annual Leave': annual,
        'Unpaid Leave': unpaid,
        'Half Day': half,
        Absence: absence
      };
    });

    return {
      totalWireKg,
      wireBreakdown: Object.values(wireBreakdown),
      attendanceCounts: {
        present: countPresent,
        late: countLate,
        sick: countSick,
        annual: countAnnual,
        unpaid: countUnpaid,
        half: countHalf,
        other: countOtherLeave,
        absence: countAbsence
      },
      trendData
    };
  }, [activeKpiEmp, wireLogs, timesheets, filterFrom, filterTo]);

  // Attendance Matrix computations
  const sortedActiveEmployees = useMemo(() => {
    return [...activeEmployees].sort((a, b) => {
      const locA = a.location || '';
      const locB = b.location || '';
      const compLoc = locA.localeCompare(locB);
      if (compLoc !== 0) return compLoc;
      return a.name.localeCompare(b.name);
    });
  }, [activeEmployees]);

  const [attendanceYear, attendanceMonth] = selectedAttendanceMonth.split('-').map(Number);
  const totalDaysInMonth = new Date(attendanceYear, attendanceMonth, 0).getDate();
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const getMonthLabel = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedAttendanceMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    setSelectedAttendanceMonth(prev.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedAttendanceMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    setSelectedAttendanceMonth(next.toISOString().slice(0, 7));
  };

  // Monthly Attendance Location Summary
  const monthlyLocationSummaries = useMemo(() => {
    const summaries: Record<string, { present: number; late: number; absent: number; leave: number }> = {};
    
    sortedActiveEmployees.forEach(emp => {
      const loc = emp.location?.trim() || 'No Location Assigned';
      if (!summaries[loc]) {
        summaries[loc] = { present: 0, late: 0, absent: 0, leave: 0 };
      }

      // Filter timesheets for this employee in selected month
      const empMonthTs = timesheets.filter(t => t.empId === emp.id && t.date.slice(0, 7) === selectedAttendanceMonth);
      empMonthTs.forEach(t => {
        if (t.status === 'present') summaries[loc].present++;
        else if (t.status === 'late') summaries[loc].late++;
        else if (t.status === 'absent') summaries[loc].absent++;
        else if (t.status === 'leave') summaries[loc].leave++;
      });
    });

    return Object.entries(summaries).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedActiveEmployees, timesheets, selectedAttendanceMonth]);

  function getAttendanceCell(entry?: TimesheetEntry) {
    if (!entry) return <span className="text-base-muted/20 font-mono text-[9px] select-none">—</span>;

    let label = 'P';
    let colorClass = 'bg-green-500/15 text-green-400 border border-green-500/30';

    if (entry.status === 'present') {
      label = 'P';
      colorClass = 'bg-green-500/15 text-green-400 border border-green-500/30';
    } else if (entry.status === 'late') {
      label = 'L';
      colorClass = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    } else if (entry.status === 'absent') {
      label = 'A';
      colorClass = 'bg-red-500/15 text-red-400 border border-red-500/30';
    } else if (entry.status === 'leave') {
      const desc = (entry.desc || '').toLowerCase();
      if (desc.includes('annual') || desc.includes('al')) {
        label = 'AL';
        colorClass = 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
      } else if (desc.includes('sick') || desc.includes('mc')) {
        label = 'SL';
        colorClass = 'bg-teal-500/15 text-teal-400 border border-teal-500/30';
      } else if (desc.includes('unpaid') || desc.includes('ul')) {
        label = 'UL';
        colorClass = 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
      } else if (desc.includes('half')) {
        label = 'HD';
        colorClass = 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
      } else {
        label = 'OL';
        colorClass = 'bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30';
      }
    }

    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-extrabold cursor-help transition-transform hover:scale-110 ${colorClass}`}
        title={`${entry.date}: ${entry.status.toUpperCase()} (${entry.desc || 'No description'})`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Location-specific and report sub-tabs bar */}
      <div className="border-b border-base-border/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2">
        <div className="flex flex-wrap items-center gap-1 bg-base-surface border border-base-border p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab('workshop1'); setQ(''); }}
            className={`px-3 py-2 rounded-lg font-condensed font-extrabold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'workshop1'
                ? 'bg-base-accent text-white shadow-card'
                : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <MapPin className="h-4 w-4 text-emerald-400" />
            <span>Workshop 1</span>
            <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-base-border/30 rounded font-mono font-bold">
              {activeEmployees.filter(e => (e.location || '').trim().toLowerCase() === 'workshop 1').length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('workshop2'); setQ(''); }}
            className={`px-3 py-2 rounded-lg font-condensed font-extrabold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'workshop2'
                ? 'bg-base-accent text-white shadow-card'
                : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <MapPin className="h-4 w-4 text-cyan-400" />
            <span>Workshop 2</span>
            <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-base-border/30 rounded font-mono font-bold">
              {activeEmployees.filter(e => (e.location || '').trim().toLowerCase() === 'workshop 2').length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('other'); setQ(''); }}
            className={`px-3 py-2 rounded-lg font-condensed font-extrabold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'other'
                ? 'bg-base-accent text-white shadow-card'
                : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <MapPin className="h-4 w-4 text-purple-400" />
            <span>Other Sites</span>
            <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-base-border/30 rounded font-mono font-bold">
              {activeEmployees.filter(e => {
                const loc = (e.location || '').trim().toLowerCase();
                return loc !== 'workshop 1' && loc !== 'workshop 2';
              }).length}
            </span>
          </button>

          <div className="h-5 w-px bg-base-border mx-1" />

          <button
            onClick={() => { setActiveTab('kpi'); setQ(''); }}
            className={`px-3 py-2 rounded-lg font-condensed font-extrabold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'kpi'
                ? 'bg-base-accent text-white shadow-card'
                : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <span>KPI Report</span>
          </button>

          <button
            onClick={() => { setActiveTab('ex'); setQ(''); }}
            className={`px-3 py-2 rounded-lg font-condensed font-extrabold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ex'
                ? 'bg-base-accent text-white shadow-card'
                : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
            }`}
          >
            <UserMinus className="h-4 w-4 text-red-400" />
            <span>Ex-Employees</span>
          </button>
        </div>

        {/* Global Controls or Excel upload for specific tabs */}
        {(isRosterTab || activeTab === 'ex') && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-muted" />
              <input
                type="text"
                value={q}
                onChange={handleSearchChange}
                placeholder={isRosterTab ? "Search active roster..." : "Search ex-employees..."}
                className="pl-9 pr-4 py-1.5 bg-base-surface text-base-text text-xs rounded-lg border border-base-border focus:border-base-accent outline-none w-60 transition-all shadow-sm"
              />
            </div>

            {isRosterTab && (
              <>
                {/* Group By selector */}
                <div className="flex items-center gap-1 bg-base-surface border border-base-border rounded-lg p-0.5 shadow-sm">
                  <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted px-2 select-none">Group:</span>
                  <button
                    onClick={() => setGroupBy('location')}
                    className={`px-2 py-1 text-[10px] font-condensed font-bold uppercase rounded-md transition-all cursor-pointer ${
                      groupBy === 'location'
                        ? 'bg-base-accent text-white shadow-sm'
                        : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
                    }`}
                  >
                    Location
                  </button>
                  <button
                    onClick={() => setGroupBy('coordinator')}
                    className={`px-2 py-1 text-[10px] font-condensed font-bold uppercase rounded-md transition-all cursor-pointer ${
                      groupBy === 'coordinator'
                        ? 'bg-base-accent text-white shadow-sm'
                        : 'text-base-muted2 hover:text-base-text hover:bg-base-surface3'
                    }`}
                  >
                    Coordinator
                  </button>
                </div>



                <button
                  type="button"
                  id="bulk-select-all-btn"
                  onClick={() => {
                    const filteredIds = filteredRoster.map(e => e.id);
                    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedEmpIds.includes(id));
                    if (allSelected) {
                      setSelectedEmpIds(prev => prev.filter(id => !filteredIds.includes(id)));
                    } else {
                      setSelectedEmpIds(prev => [
                        ...prev,
                        ...filteredIds.filter(id => !prev.includes(id))
                      ]);
                    }
                  }}
                  className="px-2.5 py-1 bg-base-surface border border-base-border rounded-lg text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 hover:text-base-accent hover:border-base-accent/50 cursor-pointer transition-all shadow-sm h-7 flex items-center"
                >
                  {filteredRoster.length > 0 && filteredRoster.every(e => selectedEmpIds.includes(e.id)) ? 'Clear Selection' : 'Select All'}
                </button>

                <div id="employee-collapse-controls" className="flex items-center gap-1 bg-base-surface border border-base-border rounded-lg p-0.5 shadow-sm">
                  <button
                    id="emp-collapse-all-btn"
                    onClick={collapseAll}
                    title="Collapse All Groups"
                    className="px-2 py-1 rounded hover:bg-base-surface3 hover:text-base-text text-base-muted flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ChevronsDownUp className="h-3.5 w-3.5 text-base-accent" />
                  </button>
                  <div className="h-4 w-px bg-base-border" />
                  <button
                    id="emp-expand-all-btn"
                    onClick={expandAll}
                    title="Expand All Groups"
                    className="px-2 py-1 rounded hover:bg-base-surface3 hover:text-base-text text-base-muted flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5 text-base-accent" />
                  </button>
                </div>

                {canManageEmployees && (
                  <>
                    <input
                      type="file"
                      id="emp-excel-input-file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={triggerExcelUpload}
                      className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer shadow-sm"
                    >
                      <Upload className="h-4 w-4 text-base-blue" />
                      <span>Import</span>
                    </button>
                    <button
                      onClick={openAddEmployee}
                      className="btn btn-accent btn-sm flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Add Employee</span>
                    </button>
                  </>
                )}
                {canDeleteEmployee && onClearAllEmployees && (
                  <button
                    onClick={onClearAllEmployees}
                    className="btn btn-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                    title="Permanently delete all employees"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <span>Delete All</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: ROSTER                                                 */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {isRosterTab && (
        <div className="space-y-6">
          {/* LOCATION SUMMARY BAR */}
          <div className="space-y-2">
            <h4 className="font-condensed font-bold text-xs uppercase tracking-wider text-base-muted">
              {activeTab === 'workshop1' ? 'Workshop 1 Overview' : activeTab === 'workshop2' ? 'Workshop 2 Overview' : 'Other Sites Overview'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {locationSummaries.map(([loc, summary]) => (
                <div key={loc} className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text block truncate max-w-[70%]">
                      {loc}
                    </span>
                    <span className="bg-base-accent/15 text-base-accent px-2 py-0.5 text-xs font-bold rounded-full">
                      {summary.headcount} active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-base-border/50">
                    {Object.entries(summary.positions).map(([pos, count]) => (
                      <span key={pos} className="bg-base-surface2 border border-base-border/50 px-1.5 py-0.5 text-[9px] font-semibold text-base-muted2 rounded">
                        {pos} <span className="text-base-accent font-bold">×{count}</span>
                      </span>
                    ))}
                    {Object.keys(summary.positions).length === 0 && (
                      <span className="text-base-muted text-[10px] italic">No positions declared</span>
                    )}
                  </div>
                </div>
              ))}
              {locationSummaries.length === 0 && (
                <div className="col-span-full py-4 text-center bg-base-surface border border-base-border rounded-xl text-base-muted text-xs">
                  No location summary available (empty active roster).
                </div>
              )}
            </div>
          </div>

          {/* Roster Grid grouped by Coordinator */}
          <div className="space-y-6">
            {filteredRoster.length === 0 ? (
              <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
                <User className="h-10 w-10 text-base-border/80 mb-3" />
                <p className="text-sm font-semibold">No active employee found matching search parameters.</p>
              </div>
            ) : (
              groupedData.sortedKeys.map(key => {
                const list = groupedData.groups[key];
                const isColl = !!collapsedGroups[key];

                return (
                  <div key={key} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
                    <div
                      onClick={() => toggleGroup(key)}
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
                        <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">{key}</span>
                        <span className="px-2 py-0.5 text-[10px] bg-base-border/25 rounded font-bold text-base-accent leading-none">
                          {list.length} Personnel
                        </span>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          id={`select-group-${key.replace(/[^a-zA-Z0-9]/g, '-')}`}
                          onClick={() => {
                            const groupEmpIds = list.map(emp => emp.id);
                            const allSelected = groupEmpIds.length > 0 && groupEmpIds.every(id => selectedEmpIds.includes(id));
                            if (allSelected) {
                              setSelectedEmpIds(prev => prev.filter(id => !groupEmpIds.includes(id)));
                            } else {
                              setSelectedEmpIds(prev => [
                                ...prev,
                                ...groupEmpIds.filter(id => !prev.includes(id))
                              ]);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg border border-base-border hover:border-base-accent/50 bg-base-surface text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 hover:text-base-accent cursor-pointer transition-all shadow-sm"
                        >
                          {list.length > 0 && list.every(emp => selectedEmpIds.includes(emp.id)) ? 'Deselect Group' : 'Select Group'}
                        </button>
                      </div>
                    </div>

                    {!isColl && (
                      <div className="p-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[850px]">
                          <thead>
                            <tr className="bg-base-surface2 text-base-muted font-condensed font-bold text-xs uppercase tracking-wider border-b border-base-border">
                              <th className="px-3 py-2 text-center w-12">
                                <input
                                  type="checkbox"
                                  checked={list.length > 0 && list.every(emp => selectedEmpIds.includes(emp.id))}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const groupEmpIds = list.map(emp => emp.id);
                                    if (checked) {
                                      setSelectedEmpIds(prev => [
                                        ...prev,
                                        ...groupEmpIds.filter(id => !prev.includes(id))
                                      ]);
                                    } else {
                                      setSelectedEmpIds(prev => prev.filter(id => !groupEmpIds.includes(id)));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-base-border text-base-accent focus:ring-base-accent bg-base-surface cursor-pointer"
                                />
                              </th>
                              <th className="px-3 py-2">Nama</th>
                              <th className="px-3 py-2">Position</th>
                              <th className="px-3 py-2">Site Location</th>
                              <th className="px-3 py-2">Join Date</th>
                              <th className="px-3 py-2">EOC</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2 text-center w-24">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-base-border text-xs">
                            {list.map(emp => {
                              return (
                                <tr key={emp.id} className="hover:bg-base-surface3/30 transition duration-150 h-[38px]">
                                  <td className="px-3 py-1.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedEmpIds.includes(emp.id)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSelectedEmpIds(prev =>
                                          checked
                                            ? [...prev, emp.id]
                                            : prev.filter(id => id !== emp.id)
                                        );
                                      }}
                                      className="h-4 w-4 rounded border-base-border text-base-accent focus:ring-base-accent bg-base-surface cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <div>
                                      <div className="font-semibold text-sm text-base-text">
                                        {emp.name}
                                      </div>
                                      <div className="text-[10px] text-base-muted font-mono mt-0.5">
                                        {emp.empNo ? `ID: ${emp.empNo}` : '—'}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5 font-medium text-base-text">
                                    {emp.position || '—'}
                                  </td>
                                  <td className="px-3 py-1.5 font-medium text-base-text">
                                    {emp.location || '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-base-muted font-mono">
                                    {formatDateStr(emp.joinDate)}
                                  </td>
                                  <td className="px-3 py-1.5 text-base-muted font-mono">
                                    {formatDateStr(emp.eoc)}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    {emp.isExEmployee ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                                        Ex-Employee
                                      </span>
                                    ) : emp.employmentStatus === 'Contract' ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        Contract
                                      </span>
                                    ) : emp.employmentStatus === 'Finish Contract' ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                        Finish Contract
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                                        Permanent
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {canManageEmployees && (
                                        <button
                                          onClick={() => openEditEmployee(emp.id)}
                                          className="p-1 rounded text-base-muted hover:text-base-accent hover:bg-base-surface3 transition-all cursor-pointer"
                                          title="Edit employee details"
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      {canDeleteEmployee && (
                                        <button
                                          onClick={() => deleteEmployee(emp.id)}
                                          className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/10 transition-all cursor-pointer"
                                          title="Delete employee record"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
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
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: KPI REPORT                                             */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {activeTab === 'kpi' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT COLUMN: Employee directory selector */}
          <div className="lg:col-span-1 bg-base-surface border border-base-border p-4 rounded-xl shadow-card space-y-4">
            <h4 className="font-condensed font-bold text-xs uppercase tracking-wider text-base-muted flex items-center gap-1.5">
              <User className="h-4 w-4 text-base-accent" />
              <span>Select Employee</span>
            </h4>

            {/* Selector list search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-muted" />
              <input
                type="text"
                value={kpiSearch}
                onChange={(e) => setKpiSearch(e.target.value)}
                placeholder="Search name..."
                className="pl-8 pr-3 py-1.5 bg-base-bg text-base-text text-xs rounded-lg border border-base-border focus:border-base-accent outline-none w-full"
              />
            </div>

            {/* List scroll panel on desktop / dropdown on mobile */}
            <div className="hidden lg:block max-h-[60vh] overflow-y-auto divide-y divide-base-border/30 pr-1">
              {kpiEmployees.map(emp => {
                const isActive = (selectedKpiEmpId || (kpiEmployees.length > 0 ? kpiEmployees[0].id : '')) === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedKpiEmpId(emp.id)}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer ${
                      isActive ? 'bg-base-accent text-white font-extrabold' : 'hover:bg-base-surface3 text-base-muted2 hover:text-base-text'
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shrink-0 ${isActive ? 'bg-white text-base-accent' : 'bg-base-border text-base-muted'}`}>
                      {getInitials(emp.name)}
                    </div>
                    <div className="truncate flex-1">
                      <span className="block truncate font-bold">{emp.name}</span>
                      <span className={`text-[9px] block ${isActive ? 'text-white/80' : 'text-base-muted'}`}>
                        {emp.position || '—'} {emp.isExEmployee && '· Ex'}
                      </span>
                    </div>
                  </button>
                );
              })}
              {kpiEmployees.length === 0 && (
                <div className="text-center py-6 text-base-muted text-xs">No employees match.</div>
              )}
            </div>

            {/* Selector Dropdown visible only on mobile */}
            <div className="block lg:hidden">
              <select
                value={selectedKpiEmpId || (kpiEmployees.length > 0 ? kpiEmployees[0].id : '')}
                onChange={(e) => setSelectedKpiEmpId(e.target.value)}
                className="w-full px-3 py-2 bg-base-bg border border-base-border rounded-lg outline-none text-xs text-base-text"
              >
                {kpiEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position || 'No Position'}) {emp.isExEmployee ? '[EX]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* RIGHT COLUMN: KPI Dashboard Dashboard */}
          <div className="lg:col-span-3 space-y-6">
            {activeKpiEmp ? (
              <div className="bg-base-surface border border-base-border p-6 rounded-xl shadow-card space-y-6">
                
                {/* Profile Header & Date filter */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-base-border/60">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center font-condensed font-black text-sm"
                      style={{ backgroundColor: `${getEmpColor(activeKpiEmp.name)}15`, color: getEmpColor(activeKpiEmp.name) }}
                    >
                      {getInitials(activeKpiEmp.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-base-text">{activeKpiEmp.name}</h3>
                        {activeKpiEmp.isExEmployee && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                            Ex-Employee
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-base-muted2 font-medium">
                        {activeKpiEmp.position || 'No Position'} <span className="text-base-border mx-1">|</span> {activeKpiEmp.location || 'No Site'}
                      </p>
                    </div>
                  </div>

                  {/* Filter range selector */}
                  <div className="flex items-center gap-2 bg-base-surface2 border border-base-border rounded-xl p-2 text-xs shadow-sm">
                    <span className="font-condensed font-bold uppercase text-[10px] tracking-wider text-base-muted">Range:</span>
                    <input
                      type="month"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                      className="bg-base-bg text-base-text px-2 py-1 rounded border border-base-border outline-none text-xs"
                    />
                    <span className="text-base-muted text-xs font-bold font-mono">to</span>
                    <input
                      type="month"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                      className="bg-base-bg text-base-text px-2 py-1 rounded border border-base-border outline-none text-xs"
                    />
                  </div>
                </div>

                {/* SECTION A — WIRE CONSUMABLE SUMMARY */}
                <div className="space-y-4">
                  <h4 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-1.5 border-b border-base-border pb-1">
                    <FileText className="h-4 w-4 text-base-accent" />
                    <span>Section A — Wire Consumable Summary</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Consumed KPI Value Card */}
                    <div className="md:col-span-1 bg-base-bg/40 border border-base-border rounded-xl p-5 flex flex-col justify-center items-center text-center shadow-sm">
                      <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block mb-1">Total Consumed</span>
                      <div className="text-3xl font-condensed font-black text-base-accent tracking-tight leading-none">
                        {kpiData?.totalWireKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-bold text-base-text">kg</span>
                      </div>
                      <span className="text-[9px] text-base-muted2 block mt-2">
                        Inside the selected month window
                      </span>
                    </div>

                    {/* Chart trend consumable summary */}
                    <div className="md:col-span-2 bg-base-bg/10 border border-base-border/50 rounded-xl p-4 min-h-[160px]">
                      <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block mb-2">Consumable Monthly Trend (kg)</span>
                      <div className="h-32 w-full text-xs font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={kpiData?.trendData || []} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                            <XAxis dataKey="monthLabel" stroke="#888" fontSize={10} />
                            <YAxis stroke="#888" fontSize={10} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#181818', borderColor: '#2e2e2e', color: '#fff' }}
                              labelStyle={{ fontWeight: 'bold' }}
                            />
                            <Bar dataKey="wireKg" name="Wire Consumption (kg)" fill="#e8a020" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Project breakdown table */}
                  <div className="bg-base-bg/20 border border-base-border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full border-collapse text-xs text-left">
                      <thead>
                        <tr className="bg-base-surface2/50 border-b border-base-border text-[9px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                          <th className="py-2 px-4">Project Title</th>
                          <th className="py-2 px-3">Assembly Element</th>
                          <th className="py-2 px-4 text-right">Consumed Wire (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/20">
                        {kpiData?.wireBreakdown.map((row, i) => (
                          <tr key={i} className="hover:bg-base-surface2/15 transition-colors font-semibold">
                            <td className="py-2 px-4 text-base-text">{row.projectName}</td>
                            <td className="py-2 px-3 text-base-muted2">{row.assemblyName}</td>
                            <td className="py-2 px-4 text-right text-base-accent font-mono font-bold">{row.amountKg.toFixed(1)} kg</td>
                          </tr>
                        ))}
                        {kpiData?.wireBreakdown.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-base-muted text-xs italic">
                              No wire consumable logs found for this user in the filtered range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION B — ATTENDANCE SUMMARY */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-1.5 border-b border-base-border pb-1">
                    <Calendar className="h-4 w-4 text-base-accent" />
                    <span>Section B — Attendance Summary</span>
                  </h4>

                  {/* Stat cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-green-400 font-bold font-condensed">✅ Present</span>
                      <span className="text-xl font-black text-green-400 font-condensed">{kpiData?.attendanceCounts.present}</span>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-amber-400 font-bold font-condensed">🕐 Late</span>
                      <span className="text-xl font-black text-amber-400 font-condensed">{kpiData?.attendanceCounts.late}</span>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-teal-400 font-bold font-condensed">🏥 Sick</span>
                      <span className="text-xl font-black text-teal-400 font-condensed">{kpiData?.attendanceCounts.sick}</span>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-blue-400 font-bold font-condensed">🌴 Annual</span>
                      <span className="text-xl font-black text-blue-400 font-condensed">{kpiData?.attendanceCounts.annual}</span>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-orange-400 font-bold font-condensed">💸 Unpaid</span>
                      <span className="text-xl font-black text-orange-400 font-condensed">{kpiData?.attendanceCounts.unpaid}</span>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-purple-400 font-bold font-condensed">🌗 Half Day</span>
                      <span className="text-xl font-black text-purple-400 font-condensed">{kpiData?.attendanceCounts.half}</span>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <span className="block text-[8px] uppercase tracking-wider text-red-400 font-bold font-condensed">❌ Absence</span>
                      <span className="text-xl font-black text-red-400 font-condensed">{kpiData?.attendanceCounts.absence}</span>
                    </div>
                  </div>

                  {/* Monthly line trend graph */}
                  <div className="bg-base-bg/10 border border-base-border/50 rounded-xl p-4 min-h-[220px]">
                    <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block mb-3">Attendance Trends (Days counted per category)</span>
                    <div className="h-44 w-full text-xs font-mono">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={kpiData?.trendData || []} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="monthLabel" stroke="#888" fontSize={10} />
                          <YAxis stroke="#888" fontSize={10} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#181818', borderColor: '#2e2e2e', color: '#fff' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          <Line type="monotone" dataKey="Present" stroke="#4caf7d" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Late" stroke="#e8a020" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Sick" stroke="#1abc9c" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Annual Leave" stroke="#4a90d9" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Unpaid Leave" stroke="#e67e22" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="Absence" stroke="#e74c3c" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-base-surface border border-base-border rounded-xl p-16 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
                <TrendingUp className="h-10 w-10 text-base-border/80 mb-3" />
                <p className="text-sm font-semibold">No employee available or selected to calculate performance index.</p>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ────────────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 4: EX-EMPLOYEES                                           */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ex' && (
        <div className="space-y-4">
          {filteredEx.length === 0 ? (
            <div className="bg-base-surface border border-base-border rounded-xl p-16 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
              <UserMinus className="h-10 w-10 text-base-border/80 mb-3" />
              <p className="text-sm font-semibold">No released ex-employee records archived currently.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEx.map(emp => {
                const col = getEmpColor(emp.name);
                const initials = getInitials(emp.name);

                return (
                  <div key={emp.id} className="border border-base-red/20 rounded-xl bg-base-surface p-4 flex flex-col justify-between space-y-4 shadow-sm hover:border-base-red/50 transition-all">
                    
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center font-condensed font-black text-xs shrink-0"
                          style={{ backgroundColor: `${col}15`, color: col }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-base-text leading-tight">{emp.name}</h4>
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none">
                              Ex
                            </span>
                          </div>
                          <span className="text-[10px] text-base-muted2 font-mono block mt-0.5">
                            {emp.empNo ? `ID: ${emp.empNo}` : 'No Employee ID'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Resignation Metadata info */}
                    <div className="p-3 bg-base-red/5 border border-base-red/10 rounded-lg text-xs space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-base-red uppercase font-condensed tracking-wider">Released Date</span>
                        <span className="text-base-text font-mono font-medium">{formatDateStr(emp.resignDate)}</span>
                      </div>
                      <div className="text-[10px] text-base-muted2 leading-relaxed">
                        <span className="block font-bold uppercase font-condensed tracking-wider text-[8px] text-base-muted mb-0.5">Reason</span>
                        {emp.resignReason || 'No reason specified'}
                      </div>
                    </div>

                    {/* Historic meta */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-base-muted2 pt-1 border-t border-base-border/50">
                      <div>
                        <span className="block text-[8px] uppercase font-condensed font-bold tracking-wider text-base-muted">Prior Position</span>
                        <span className="text-base-text font-medium truncate block">{emp.position || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] uppercase font-condensed font-bold tracking-wider text-base-muted font-mono">Prior Site</span>
                        <span className="text-base-text font-medium truncate block">{emp.location || '—'}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-between items-center pt-2 border-t border-base-border/40 gap-2">
                      <button
                        onClick={() => {
                          setSelectedKpiEmpId(emp.id);
                          setActiveTab('kpi');
                        }}
                        className="px-3 py-1.5 rounded bg-base-surface border border-base-border text-base-muted hover:text-base-accent text-[9px] font-condensed font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <TrendingUp className="h-3.5 w-3.5 text-base-accent" />
                        <span>View KPI History</span>
                      </button>

                      {canManageEmployees && (
                        <button
                          onClick={() => onReinstateEmployee(emp.id)}
                          className="px-3 py-1.5 rounded bg-green-500 text-white hover:bg-green-600 text-[9px] font-condensed font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Reinstate</span>
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {isRosterTab && selectedEmpIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-base-surface/95 border-2 border-base-accent/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-base-accent text-white h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-md animate-bounce">
              {selectedEmpIds.length}
            </div>
            <div>
              <h4 className="font-bold text-sm text-base-text">Personnel Selected</h4>
              <p className="text-xs text-base-muted">Perform batch operations on selected employees</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick action selectors */}
            <div className="flex flex-wrap items-center gap-2 bg-base-surface2 p-1.5 rounded-xl border border-base-border">
              {/* Shift Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-condensed font-bold tracking-wider text-base-muted px-1">Shift:</span>
                <select
                  id="bulk-shift-select"
                  value={bulkShift}
                  onChange={(e) => setBulkShift(e.target.value)}
                  className="bg-base-surface border border-base-border text-xs rounded-lg px-2.5 py-1 text-base-text outline-none focus:border-base-accent"
                >
                  <option value="">— Unchanged —</option>
                  <option value="DAY SHIFT">DAY SHIFT</option>
                  <option value="NIGHT SHIFT">NIGHT SHIFT</option>
                </select>
              </div>

              <div className="h-4 w-px bg-base-border" />

              {/* Coordinator Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-condensed font-bold tracking-wider text-base-muted px-1">Coordinator:</span>
                <div className="relative flex items-center">
                  <select
                    id="bulk-coord-select"
                    value={bulkCoordType === 'existing' ? bulkCoordinator : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setBulkCoordType('custom');
                        setBulkCoordinator('');
                      } else {
                        setBulkCoordType('existing');
                        setBulkCoordinator(e.target.value);
                      }
                    }}
                    className="bg-base-surface border border-base-border text-xs rounded-lg px-2.5 py-1 text-base-text outline-none focus:border-base-accent"
                  >
                    <option value="">— Unchanged —</option>
                    {uniqueCoordinators.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="custom">+ Type custom...</option>
                  </select>

                  {bulkCoordType === 'custom' && (
                    <input
                      type="text"
                      id="bulk-coord-custom-input"
                      value={bulkCoordinator}
                      onChange={(e) => setBulkCoordinator(e.target.value)}
                      placeholder="Coordinator name"
                      className="ml-2 bg-base-surface border border-base-border text-xs rounded-lg px-2 py-1 text-base-text outline-none focus:border-base-accent w-32"
                    />
                  )}
                </div>
              </div>

              <div className="h-4 w-px bg-base-border" />

              {/* Location Selector */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-condensed font-bold tracking-wider text-base-muted px-1">Location:</span>
                <select
                  id="bulk-location-select"
                  value={bulkLocation}
                  onChange={(e) => setBulkLocation(e.target.value)}
                  className="bg-base-surface border border-base-border text-xs rounded-lg px-2.5 py-1 text-base-text outline-none focus:border-base-accent"
                >
                  <option value="">— Unchanged —</option>
                  <option value="Workshop 1">Workshop 1</option>
                  <option value="Workshop 2">Workshop 2</option>
                  {uniqueLocations.filter(loc => loc.toLowerCase() !== 'workshop 1' && loc.toLowerCase() !== 'workshop 2').map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="bulk-apply-btn"
                onClick={handleApplyBulkChanges}
                disabled={!bulkShift && !bulkCoordinator && !bulkLocation}
                className={`px-4 py-2 rounded-xl font-condensed font-extrabold text-xs uppercase tracking-wider text-white shadow-md cursor-pointer transition-all ${
                  (!bulkShift && !bulkCoordinator && !bulkLocation)
                    ? 'bg-base-border text-base-muted cursor-not-allowed shadow-none'
                    : 'bg-base-accent hover:bg-base-accent/90'
                }`}
              >
                Apply
              </button>
              <button
                type="button"
                id="bulk-cancel-btn"
                onClick={() => setSelectedEmpIds([])}
                className="px-3 py-2 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface2 text-base-text font-condensed font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
