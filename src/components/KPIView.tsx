import React, { useState, useMemo } from 'react';
import { 
  WireLog, 
  Employee, 
  Project, 
  User, 
  MaterialConsumptionLog,
  TimesheetEntry
} from '../types';
import { 
  Flame, 
  ShieldAlert, 
  Wrench, 
  Trophy, 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Users, 
  Briefcase,
  X,
  TrendingUp,
  Award,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';

interface KPIViewProps {
  wireLogs: WireLog[];
  consumptionLogs: MaterialConsumptionLog[];
  employees: Employee[];
  projects: Project[];
  currentUser: User;
  timesheets: TimesheetEntry[];
}

const getPositionColorClass = (position?: string) => {
  const pos = (position || '').toLowerCase();
  if (pos.includes('welder')) return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
  if (pos.includes('fitter')) return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
  if (pos.includes('grinder')) return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
  if (pos.includes('coordinator')) return 'bg-purple-500/10 text-purple-500 border border-purple-500/20';
  if (pos.includes('supervisor')) return 'bg-teal-500/10 text-teal-500 border border-teal-500/20';
  return 'bg-base-surface2 text-base-muted border border-base-border';
};

const getPositionHexColor = (position: string) => {
  const pos = position.toLowerCase();
  if (pos.includes('welder')) return '#3b82f6'; // blue
  if (pos.includes('fitter')) return '#10b981'; // emerald
  if (pos.includes('grinder')) return '#f59e0b'; // amber
  if (pos.includes('coordinator')) return '#a855f7'; // purple
  if (pos.includes('supervisor')) return '#14b8a6'; // teal
  return '#6b7280'; // gray
};

export default function KPIView({
  wireLogs = [],
  consumptionLogs = [],
  employees = [],
  projects = [],
  currentUser,
  timesheets = []
}: KPIViewProps) {

  // ========================================================
  // 1. DATE RANGE FILTER STATE & HELPERS
  // ========================================================
  type DatePill = 'week' | 'month' | '3months' | 'year' | 'all' | 'custom';
  const [activeDatePill, setActiveDatePill] = useState<DatePill>('month');

  const getLocalTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getBeginningOfMonthString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [customFrom, setCustomFrom] = useState(getBeginningOfMonthString());
  const [customTo, setCustomTo] = useState(getLocalTodayString());

  const activeRange = useMemo(() => {
    const today = new Date();
    const end = getLocalTodayString();

    switch (activeDatePill) {
      case 'week': {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        return {
          start: monday.toISOString().slice(0, 10),
          end
        };
      }
      case 'month': {
        return {
          start: getBeginningOfMonthString(),
          end
        };
      }
      case '3months': {
        const d = new Date();
        d.setMonth(d.getMonth() - 2);
        return {
          start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
          end
        };
      }
      case 'year': {
        return {
          start: `${today.getFullYear()}-01-01`,
          end
        };
      }
      case 'all': {
        return {
          start: '1970-01-01',
          end: '9999-12-31'
        };
      }
      case 'custom': {
        return {
          start: customFrom,
          end: customTo
        };
      }
      default:
        return null;
    }
  }, [activeDatePill, customFrom, customTo]);

  // ========================================================
  // 2. POSITION FILTER STATE
  // ========================================================
  type PositionPill = 'all' | 'welder' | 'fitter' | 'grinder' | 'coordinator' | 'supervisor';
  const [activePositionPill, setActivePositionPill] = useState<PositionPill>('all');

  // ========================================================
  // 3. TABLE FILTER, SORT, EXPAND STATES
  // ========================================================
  const [kpiSearchQuery, setKpiSearchQuery] = useState('');
  const [kpiSortField, setKpiSortField] = useState<'name' | 'wire' | 'ppe' | 'accessory' | 'total' | 'hours'>('total');
  const [kpiSortOrder, setKpiSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // ========================================================
  // 4. DATE-FILTERED LOGS
  // ========================================================
  const filteredWireLogs = useMemo(() => {
    return wireLogs.filter(w => {
      if (!activeRange) return true;
      return w.date >= activeRange.start && w.date <= activeRange.end;
    });
  }, [wireLogs, activeRange]);

  const filteredConsumptionLogs = useMemo(() => {
    return consumptionLogs.filter(c => {
      if (!activeRange) return true;
      return c.date >= activeRange.start && c.date <= activeRange.end;
    });
  }, [consumptionLogs, activeRange]);

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(t => {
      if (!activeRange) return true;
      return t.date >= activeRange.start && t.date <= activeRange.end;
    });
  }, [timesheets, activeRange]);

  // ========================================================
  // 5. EMPLOYEE KPI CALCULATIONS
  // ========================================================
  const get4WeekUsage = (empId: string) => {
    const now = new Date();
    const buckets: number[] = [];
    for (let i = 0; i < 4; i++) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000 + 1000);
      const sStr = start.toISOString().slice(0, 10);
      const eStr = end.toISOString().slice(0, 10);

      const wLogs = wireLogs.filter(w => w.welderId === empId && w.date >= sStr && w.date <= eStr);
      const cLogs = consumptionLogs.filter(c => c.employeeId === empId && c.date >= sStr && c.date <= eStr);

      const wireSum = wLogs.reduce((sum, w) => sum + w.amountKg, 0);
      const ppeSum = cLogs.filter(c => c.category === 'PPE').reduce((sum, c) => sum + c.qtyUsed, 0);
      const accSum = cLogs.filter(c => c.category === 'Welding Consumable').reduce((sum, c) => sum + c.qtyUsed, 0);
      buckets.unshift(wireSum + ppeSum + accSum); // chronologically oldest to newest
    }
    return buckets;
  };

  const employeeKPIs = useMemo(() => {
    return employees.map(emp => {
      // 1. Calculate Wire kilograms
      const empWireLogs = filteredWireLogs.filter(w => w.welderId === emp.id);
      const totalWireKg = empWireLogs.reduce((sum, w) => sum + w.amountKg, 0);

      // 2. Calculate PPE pieces
      const empPpeLogs = filteredConsumptionLogs.filter(c => c.employeeId === emp.id && c.category === 'PPE');
      const totalPpePcs = empPpeLogs.reduce((sum, c) => sum + c.qtyUsed, 0);

      // 3. Calculate Welding accessory pieces
      const empAccLogs = filteredConsumptionLogs.filter(c => c.employeeId === emp.id && c.category === 'Welding Consumable');
      const totalAccessoryPcs = empAccLogs.reduce((sum, c) => sum + c.qtyUsed, 0);

      // 4. Calculate total Hours
      const empTimesheets = filteredTimesheets.filter(t => t.empId === emp.id);
      const totalHours = empTimesheets.reduce((sum, t) => sum + (t.totalHours || 0), 0);

      const totalLogsCount = empWireLogs.length + empPpeLogs.length + empAccLogs.length;
      const combinedTotal = totalWireKg + totalPpePcs + totalAccessoryPcs;

      return {
        employee: emp,
        totalWireKg,
        totalPpePcs,
        totalAccessoryPcs,
        totalLogsCount,
        combinedTotal,
        totalHours,
        weeklyTrend: get4WeekUsage(emp.id)
      };
    });
  }, [employees, filteredWireLogs, filteredConsumptionLogs, filteredTimesheets, wireLogs, consumptionLogs]);

  // ========================================================
  // 6. OVERALL TOTALS & SUMMARY CARDS
  // ========================================================
  const overallTotals = useMemo(() => {
    const totalWire = filteredWireLogs.reduce((s, w) => s + w.amountKg, 0);
    const totalPpe = filteredConsumptionLogs.filter(c => c.category === 'PPE').reduce((s, c) => s + c.qtyUsed, 0);
    const totalAcc = filteredConsumptionLogs.filter(c => c.category === 'Welding Consumable').reduce((s, c) => s + c.qtyUsed, 0);
    const totalHoursAll = filteredTimesheets.reduce((s, t) => s + (t.totalHours || 0), 0);

    // Find most active employee in this period
    let mostActiveEmp: typeof employeeKPIs[0] | null = null;
    let maxTotal = 0;
    employeeKPIs.forEach(k => {
      if (k.combinedTotal > maxTotal) {
        maxTotal = k.combinedTotal;
        mostActiveEmp = k;
      }
    });

    return {
      totalWire,
      totalPpe,
      totalAcc,
      totalHoursAll,
      mostActive: mostActiveEmp ? {
        name: mostActiveEmp.employee.name,
        position: mostActiveEmp.employee.position || 'Manpower',
        total: mostActiveEmp.combinedTotal
      } : null
    };
  }, [filteredWireLogs, filteredConsumptionLogs, filteredTimesheets, employeeKPIs]);

  // ========================================================
  // 7. LEADERBOARD RENDERING PIPELINE (Position + Search + Sort)
  // ========================================================
  const filteredEmployeeKPIs = useMemo(() => {
    let result = employeeKPIs;

    // Filter by position group pill
    if (activePositionPill !== 'all') {
      result = result.filter(k => {
        const pos = (k.employee.position || '').toLowerCase();
        return pos.includes(activePositionPill);
      });
    }

    // Filter by search query
    if (kpiSearchQuery.trim()) {
      const q = kpiSearchQuery.toLowerCase().trim();
      result = result.filter(k => 
        k.employee.name.toLowerCase().includes(q) ||
        (k.employee.position && k.employee.position.toLowerCase().includes(q))
      );
    }

    // Sort leaderboard
    return [...result].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (kpiSortField === 'name') {
        valA = a.employee.name;
        valB = b.employee.name;
      } else if (kpiSortField === 'wire') {
        valA = a.totalWireKg;
        valB = b.totalWireKg;
      } else if (kpiSortField === 'ppe') {
        valA = a.totalPpePcs;
        valB = b.totalPpePcs;
      } else if (kpiSortField === 'accessory') {
        valA = a.totalAccessoryPcs;
        valB = b.totalAccessoryPcs;
      } else if (kpiSortField === 'hours') {
        valA = a.totalHours;
        valB = b.totalHours;
      } else {
        valA = a.combinedTotal;
        valB = b.combinedTotal;
      }

      if (valA < valB) return kpiSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return kpiSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [employeeKPIs, activePositionPill, kpiSearchQuery, kpiSortField, kpiSortOrder]);

  const handleToggleSort = (field: typeof kpiSortField) => {
    if (kpiSortField === field) {
      setKpiSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setKpiSortField(field);
      setKpiSortOrder('desc');
    }
  };

  // Inline project-level breakdown for expanded employee
  const expandedProjectStats = useMemo(() => {
    if (!expandedEmployeeId) return [];
    
    const empWireLogs = filteredWireLogs.filter(w => w.welderId === expandedEmployeeId);
    const empConsLogs = filteredConsumptionLogs.filter(c => c.employeeId === expandedEmployeeId);
    
    const projectStats: Record<string, { projectName: string; wire: number; ppe: number; acc: number; total: number }> = {};
    
    empWireLogs.forEach(w => {
      if (!projectStats[w.projectId]) {
        projectStats[w.projectId] = { projectName: w.projectName, wire: 0, ppe: 0, acc: 0, total: 0 };
      }
      projectStats[w.projectId].wire += w.amountKg;
      projectStats[w.projectId].total += w.amountKg;
    });
    
    empConsLogs.forEach(c => {
      if (!projectStats[c.projectId]) {
        projectStats[c.projectId] = { projectName: c.projectName, wire: 0, ppe: 0, acc: 0, total: 0 };
      }
      if (c.category === 'PPE') {
        projectStats[c.projectId].ppe += c.qtyUsed;
        projectStats[c.projectId].total += c.qtyUsed;
      } else {
        projectStats[c.projectId].acc += c.qtyUsed;
        projectStats[c.projectId].total += c.qtyUsed;
      }
    });
    
    return Object.values(projectStats).sort((a, b) => b.total - a.total);
  }, [expandedEmployeeId, filteredWireLogs, filteredConsumptionLogs]);

  // ========================================================
  // 8. CHARTS PREPARATION
  // ========================================================
  
  // CHART A: Usage by Position Group (Pie/Donut)
  const positionChartData = useMemo(() => {
    const totalsMap: Record<string, number> = {
      'Welder': 0,
      'Fitter': 0,
      'Grinder': 0,
      'Coordinator': 0,
      'Supervisor': 0,
      'Other': 0
    };

    let totalEntriesCount = filteredWireLogs.length + filteredConsumptionLogs.length;

    employeeKPIs.forEach(k => {
      const pos = (k.employee.position || '').toLowerCase();
      let groupKey = 'Other';
      if (pos.includes('welder')) groupKey = 'Welder';
      else if (pos.includes('fitter')) groupKey = 'Fitter';
      else if (pos.includes('grinder')) groupKey = 'Grinder';
      else if (pos.includes('coordinator')) groupKey = 'Coordinator';
      else if (pos.includes('supervisor')) groupKey = 'Supervisor';

      totalsMap[groupKey] += k.combinedTotal;
    });

    const data = Object.keys(totalsMap)
      .map(name => ({
        name,
        value: Math.round(totalsMap[name] * 10) / 10,
        color: getPositionHexColor(name)
      }))
      .filter(item => item.value > 0);

    return {
      data,
      totalEntriesCount
    };
  }, [employeeKPIs, filteredWireLogs, filteredConsumptionLogs]);

  // CHART B: Monthly Trend for last 6 months (Line)
  const monthlyTrendData = useMemo(() => {
    const list: { label: string; yearMonth: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ label, yearMonth });
    }

    return list.map(m => {
      const mWire = wireLogs.filter(w => w.date.startsWith(m.yearMonth));
      const mCons = consumptionLogs.filter(c => c.date.startsWith(m.yearMonth));

      const wireVal = mWire.reduce((sum, w) => sum + w.amountKg, 0);
      const ppeVal = mCons.filter(c => c.category === 'PPE').reduce((sum, c) => sum + c.qtyUsed, 0);
      const accVal = mCons.filter(c => c.category === 'Welding Consumable').reduce((sum, c) => sum + c.qtyUsed, 0);

      return {
        month: m.label,
        'Wire (kg)': Math.round(wireVal * 10) / 10,
        'PPE (pcs)': ppeVal,
        'Accessories (pcs)': accVal
      };
    });
  }, [wireLogs, consumptionLogs]);

  // ========================================================
  // 9. CSV EXPORT HANDLER
  // ========================================================
  const handleExportCSV = () => {
    const headers = [
      'Employee Name',
      'Position',
      'Total Jam Kerja',
      'Wire kg',
      'PPE pcs',
      'Welding Consumable pcs',
      'Total',
      'Period Start',
      'Period End'
    ];

    const startStr = activeRange?.start || 'All Time';
    const endStr = activeRange?.end || 'All Time';

    const rows = filteredEmployeeKPIs.map(k => [
      `"${k.employee.name.replace(/"/g, '""')}"`,
      `"${(k.employee.position || 'Manpower').replace(/"/g, '""')}"`,
      k.totalHours.toFixed(1),
      k.totalWireKg.toFixed(1),
      k.totalPpePcs,
      k.totalAccessoryPcs,
      k.combinedTotal.toFixed(1),
      startStr,
      endStr
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `austin_consumables_kpi_report_${startStr}_to_${endStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-0 animate-fade-in">

      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-border pb-4">
        <div>
          <h2 className="text-xl font-condensed font-black uppercase tracking-tight text-base-text flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span>Personnel Consumption KPI Analytics</span>
          </h2>
          <p className="text-xs text-base-muted font-sans font-medium mt-1">
            Real-time tracking of consumables allocation and usage KPI per employee to optimize shopfloor efficiency.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredEmployeeKPIs.length === 0}
          className="self-start md:self-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all cursor-pointer font-condensed font-bold text-xs rounded-xl uppercase tracking-wider flex items-center gap-2 shadow-xs disabled:opacity-45"
        >
          <Download className="h-4 w-4" />
          <span>Export KPI Report (CSV)</span>
        </button>
      </div>

      {/* FILTERS PANEL: DATE RANGE + POSITION GROUPS */}
      <div className="bg-base-surface border border-base-border p-4 rounded-2xl shadow-card space-y-4">
        
        {/* DATE RANGE PANEL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              <span>Time Period Filter</span>
            </label>
            <div className="flex flex-wrap gap-1 bg-base-surface2 border border-base-border p-1 rounded-xl w-fit">
              {(['week', 'month', '3months', 'year', 'all', 'custom'] as const).map(pill => {
                const labelMap: Record<DatePill, string> = {
                  week: 'This Week',
                  month: 'This Month',
                  '3months': 'Last 3 Months',
                  year: 'This Year',
                  all: 'All Time',
                  custom: 'Custom Range'
                };
                return (
                  <button
                    key={pill}
                    onClick={() => setActiveDatePill(pill)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      activeDatePill === pill
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    {labelMap[pill]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CUSTOM INPUTS */}
          {activeDatePill === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in bg-base-surface2 border border-base-border p-2 rounded-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-base-muted uppercase font-bold">From:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-2 py-1 bg-base-surface border border-base-border rounded-lg text-[11px] font-semibold text-base-text"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-base-muted uppercase font-bold">To:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-2 py-1 bg-base-surface border border-base-border rounded-lg text-[11px] font-semibold text-base-text"
                />
              </div>
            </div>
          )}
        </div>

        {/* POSITION GROUP FILTER */}
        <div className="space-y-1.5 border-t border-base-border/50 pt-3">
          <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
            <Briefcase className="h-3.5 w-3.5 text-amber-500" />
            <span>Position Group Filter</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'welder', 'fitter', 'grinder', 'coordinator', 'supervisor'] as const).map(pill => {
              const isActive = activePositionPill === pill;
              
              // Map colors for active pill
              let activeColorClass = 'bg-amber-500 text-slate-950 font-black';
              if (isActive) {
                if (pill === 'welder') activeColorClass = 'bg-blue-500 text-white font-black border-blue-500/30';
                if (pill === 'fitter') activeColorClass = 'bg-emerald-500 text-white font-black border-emerald-500/30';
                if (pill === 'grinder') activeColorClass = 'bg-amber-500 text-slate-950 font-black border-amber-500/30';
                if (pill === 'coordinator') activeColorClass = 'bg-purple-500 text-white font-black border-purple-500/30';
                if (pill === 'supervisor') activeColorClass = 'bg-teal-500 text-white font-black border-teal-500/30';
              }

              return (
                <button
                  key={pill}
                  onClick={() => setActivePositionPill(pill)}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    isActive
                      ? `${activeColorClass} shadow-xs`
                      : 'bg-base-surface2 border-base-border text-base-muted hover:text-base-text hover:border-base-muted'
                  }`}
                >
                  {pill}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* TOP SUMMARY STRIP ROW (5 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Wire Card */}
        <div className="bg-base-surface border border-base-border p-4 rounded-2xl shadow-card flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Flame className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Total Wire Issued</span>
            <span className="text-lg font-mono font-black text-blue-500 block mt-0.5">
              {overallTotals.totalWire.toFixed(1)} <span className="font-sans text-[10px] font-normal text-base-muted">kg</span>
            </span>
          </div>
        </div>

        {/* Total PPE Issued */}
        <div className="bg-base-surface border border-base-border p-4 rounded-2xl shadow-card flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <ShieldAlert className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Total PPE Issued</span>
            <span className="text-lg font-mono font-black text-emerald-500 block mt-0.5">
              {overallTotals.totalPpe} <span className="font-sans text-[10px] font-normal text-base-muted">pcs</span>
            </span>
          </div>
        </div>

        {/* Total Welding Consumable */}
        <div className="bg-base-surface border border-base-border p-4 rounded-2xl shadow-card flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Wrench className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Accessories Issued</span>
            <span className="text-lg font-mono font-black text-amber-500 block mt-0.5">
              {overallTotals.totalAcc} <span className="font-sans text-[10px] font-normal text-base-muted">pcs</span>
            </span>
          </div>
        </div>

        {/* Total Work Hours Card */}
        <div className="bg-base-surface border border-base-border p-4 rounded-2xl shadow-card flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Clock className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Total Jam Kerja</span>
            <span className="text-lg font-mono font-black text-indigo-500 block mt-0.5">
              {overallTotals.totalHoursAll.toFixed(1)} <span className="font-sans text-[10px] font-normal text-base-muted">hrs</span>
            </span>
          </div>
        </div>

        {/* Most Active Employee */}
        <div className="bg-base-surface border border-base-border p-4 rounded-2xl shadow-card flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Trophy className="h-5 w-5 text-purple-500 animate-bounce" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Most Active Employee</span>
            {overallTotals.mostActive ? (
              <div className="mt-0.5 min-w-0">
                <span className="block text-xs font-black truncate text-base-text">{overallTotals.mostActive.name}</span>
                <span className="inline-block text-[9px] font-bold px-1.5 py-0.1 uppercase text-purple-400 bg-purple-500/10 rounded-full">
                  {overallTotals.mostActive.position}
                </span>
              </div>
            ) : (
              <span className="text-xs text-base-muted block mt-0.5">No issued orders</span>
            )}
          </div>
        </div>

      </div>

      {/* MAIN BODY: LEADERBOARD GRID */}
      <div className="bg-base-surface border border-base-border rounded-2xl shadow-card p-5 space-y-4">
        
        {/* LEADERBOARD TITLE & SEARCH */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-border pb-3.5">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider">Personnel Consumption Rankings</span>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-base-muted" />
            <input
              type="text"
              placeholder="Search employee by name..."
              value={kpiSearchQuery}
              onChange={e => setKpiSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-medium placeholder:font-normal"
            />
          </div>
        </div>

        {/* LEADERBOARD TABLE */}
        <div className="overflow-x-auto rounded-xl border border-base-border bg-base-surface2/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-surface2/70 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border select-none">
                <th className="px-4 py-3 text-center w-16">Rank</th>
                <th 
                  onClick={() => handleToggleSort('name')} 
                  className="px-4 py-3 cursor-pointer hover:text-base-text transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    {kpiSortField === 'name' ? (kpiSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />) : null}
                  </div>
                </th>
                <th className="px-4 py-3">Position</th>
                <th 
                  onClick={() => handleToggleSort('hours')} 
                  className="px-4 py-3 text-center cursor-pointer hover:text-base-text transition-colors"
                  title="Calculated from timesheets"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Total Jam</span>
                    {kpiSortField === 'hours' ? (kpiSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />) : null}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('wire')} 
                  className="px-4 py-3 text-center cursor-pointer hover:text-base-text transition-colors"
                  title="Calculated from issued Material Requests"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Wire (kg)</span>
                    {kpiSortField === 'wire' ? (kpiSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />) : null}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('ppe')} 
                  className="px-4 py-3 text-center cursor-pointer hover:text-base-text transition-colors"
                  title="Calculated from issued Material Requests"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>PPE (pcs)</span>
                    {kpiSortField === 'ppe' ? (kpiSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />) : null}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('accessory')} 
                  className="px-4 py-3 text-center cursor-pointer hover:text-base-text transition-colors"
                  title="Calculated from issued Material Requests"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Weld. Consumable (pcs)</span>
                    {kpiSortField === 'accessory' ? (kpiSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />) : null}
                  </div>
                </th>
                <th 
                  onClick={() => handleToggleSort('total')} 
                  className="px-4 py-3 text-center cursor-pointer hover:text-base-text transition-colors"
                  title="Calculated from issued Material Requests"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Combined Total</span>
                    {kpiSortField === 'total' ? (kpiSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-amber-500" /> : <ChevronDown className="h-3 w-3 text-amber-500" />) : null}
                  </div>
                </th>
                <th className="px-4 py-3 text-center w-28">Last 4 Weeks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border text-base-text">
              {filteredEmployeeKPIs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-base-muted italic">
                    No matching issued KPIs found.
                  </td>
                </tr>
              ) : (
                filteredEmployeeKPIs.map((kpi, idx) => {
                  const isExpanded = expandedEmployeeId === kpi.employee.id;
                  
                  // Rank icon/pills
                  let rankIndicator: React.ReactNode = idx + 1;
                  if (idx === 0) rankIndicator = <span className="text-lg">🥇</span>;
                  else if (idx === 1) rankIndicator = <span className="text-lg">🥈</span>;
                  else if (idx === 2) rankIndicator = <span className="text-lg">🥉</span>;

                  // Weekly usage sparkline helpers
                  const maxWeeklyVal = Math.max(...kpi.weeklyTrend);
                  const sparklineHeight = 18;
                  const sparklineWidth = 36;
                  const barWidth = 6;
                  const gap = 3;

                  return (
                    <React.Fragment key={kpi.employee.id}>
                      <tr 
                        onClick={() => setExpandedEmployeeId(isExpanded ? null : kpi.employee.id)}
                        className={`hover:bg-base-surface/60 transition-all cursor-pointer ${
                          isExpanded ? 'bg-base-surface border-l-4 border-l-amber-500' : 'bg-transparent'
                        }`}
                        title="Click to view project consumption breakdown"
                      >
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-base-muted">
                           {rankIndicator}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-base-text">
                          <div className="flex items-center gap-2">
                            <span>{kpi.employee.name}</span>
                            <span className="text-[9px] text-base-muted font-normal bg-base-surface3 px-1.5 py-0.5 rounded border border-base-border">
                              {kpi.totalLogsCount} issued
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {kpi.employee.position && (
                            <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${getPositionColorClass(kpi.employee.position)}`}>
                              {kpi.employee.position}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-indigo-400">
                          {kpi.totalHours > 0 ? `${kpi.totalHours.toFixed(1)} hrs` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-blue-400">
                          {kpi.totalWireKg > 0 ? `${kpi.totalWireKg.toFixed(1)} kg` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400">
                          {kpi.totalPpePcs > 0 ? `${kpi.totalPpePcs} pcs` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-amber-500">
                          {kpi.totalAccessoryPcs > 0 ? `${kpi.totalAccessoryPcs} pcs` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-black text-amber-500 dark:text-amber-300">
                          {kpi.combinedTotal > 0 ? kpi.combinedTotal.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {/* Sparkline */}
                          <div className="inline-flex items-center justify-center">
                            <svg width={sparklineWidth} height={sparklineHeight} className="overflow-visible">
                              {kpi.weeklyTrend.map((val, bIdx) => {
                                const height = maxWeeklyVal > 0 ? (val / maxWeeklyVal) * (sparklineHeight - 3) + 3 : 2;
                                const y = sparklineHeight - height;
                                const x = bIdx * (barWidth + gap);
                                return (
                                  <rect
                                    key={bIdx}
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={height}
                                    fill={val > 0 ? '#f59e0b' : '#374151'}
                                    rx={1}
                                  >
                                    <title>{`Week ${bIdx+1}: ${val.toFixed(1)} units`}</title>
                                  </rect>
                                );
                              })}
                            </svg>
                          </div>
                        </td>
                      </tr>

                      {/* INLINE EXPANSION: PROJECT BREAKDOWN */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-base-surface2/50 p-4 border-y border-base-border/70">
                            <div className="space-y-2">
                              <span className="block text-[10px] font-condensed font-extrabold uppercase text-base-text tracking-wider flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                                <span>Project Breakdown for {kpi.employee.name} ({activeRange?.start} to {activeRange?.end})</span>
                              </span>
                              
                              {expandedProjectStats.length === 0 ? (
                                <p className="text-xs text-base-muted italic pl-5">No project orders issued for this range.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {expandedProjectStats.map((pStat, sIdx) => (
                                    <div key={sIdx} className="bg-base-surface border border-base-border/70 p-3 rounded-xl flex flex-col justify-between space-y-2">
                                      <span className="block font-bold text-xs text-base-text truncate">{pStat.projectName}</span>
                                      
                                      <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-mono font-semibold">
                                        <div className="bg-base-surface2 p-1 rounded">
                                          <span className="block text-base-muted text-[8px] uppercase font-bold">Wire</span>
                                          <span className="text-blue-400 font-extrabold">{pStat.wire > 0 ? `${pStat.wire.toFixed(1)}k` : '-'}</span>
                                        </div>
                                        <div className="bg-base-surface2 p-1 rounded">
                                          <span className="block text-base-muted text-[8px] uppercase font-bold">PPE</span>
                                          <span className="text-emerald-400 font-extrabold">{pStat.ppe > 0 ? pStat.ppe : '-'}</span>
                                        </div>
                                        <div className="bg-base-surface2 p-1 rounded">
                                          <span className="block text-base-muted text-[8px] uppercase font-bold">Weld.C</span>
                                          <span className="text-amber-500 font-extrabold">{pStat.acc > 0 ? pStat.acc : '-'}</span>
                                        </div>
                                      </div>

                                      <div className="border-t border-base-border/50 pt-1.5 flex justify-between items-center text-[9px]">
                                        <span className="text-base-muted font-bold uppercase">Combined Load</span>
                                        <span className="font-mono font-black text-amber-500">{pStat.total.toFixed(1)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECHARTS SECTION (TWO CHARTS SIDE BY SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CHART A: Usage by Position */}
        <div className="bg-base-surface border border-base-border p-5 rounded-2xl shadow-card space-y-4">
          <div className="border-b border-base-border pb-3">
            <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider block">
              Cumulative Usage by Position Group
            </span>
            <span className="text-[10px] text-base-muted">Total share of consumable allocations in current period</span>
          </div>

          <div className="h-64 w-full min-h-[256px] min-w-0 flex items-center justify-center" style={{ width: '100%', height: 256 }}>
            {positionChartData.data.length === 0 ? (
              <div className="text-xs text-base-muted italic">No data records found for selected filters</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <PieChart>
                  <Pie
                    data={positionChartData.data}
                    nameKey="name"
                    dataKey="value"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {positionChartData.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                    labelStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(val) => [`${val} Units`, 'Allocation']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART B: Monthly Consumable Trend */}
        <div className="bg-base-surface border border-base-border p-5 rounded-2xl shadow-card space-y-4">
          <div className="border-b border-base-border pb-3">
            <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider block">
              Monthly Consumption Trend
            </span>
            <span className="text-[10px] text-base-muted">Monthly historical breakdown for the last 6 months</span>
          </div>

          <div className="h-64 w-full min-h-[256px] min-w-0" style={{ width: '100%', height: 256 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={256}>
              <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis 
                  dataKey="month" 
                  stroke="currentColor" 
                  className="text-[9px] text-base-muted" 
                  tickLine={false}
                />
                <YAxis 
                  stroke="currentColor" 
                  className="text-[9px] text-base-muted" 
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '11px', color: '#fff' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px' }} 
                  iconType="plainline"
                />
                <Line 
                  type="monotone" 
                  dataKey="Wire (kg)" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5} 
                  dot={{ r: 3 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="PPE (pcs)" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  dot={{ r: 3 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="Accessories (pcs)" 
                  stroke="#f59e0b" 
                  strokeWidth={2.5} 
                  dot={{ r: 3 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
