import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  MaterialVarianceKPIs,
  OffcutInventoryItem,
  OffcutSuggestion,
  User,
  Project
} from '../types';
import {
  TrendingUp,
  Percent,
  Layers,
  Sparkles,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Tag,
  Factory,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Database
} from 'lucide-react';

interface MaterialVarianceDashboardProps {
  currentUser: User;
  projects?: Project[];
  onNavigateToKiosk?: () => void;
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export const MaterialVarianceDashboard: React.FC<MaterialVarianceDashboardProps> = ({
  currentUser,
  projects = [],
  onNavigateToKiosk
}) => {
  const [kpiData, setKpiData] = useState<MaterialVarianceKPIs | null>(null);
  const [offcuts, setOffcuts] = useState<OffcutInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter for Offcut Table
  const [offcutSearch, setOffcutSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Suggestion Engine Planner Simulator State
  const [simGrade, setSimGrade] = useState('Hardox 450');
  const [simThk, setSimThk] = useState<number>(12);
  const [simLen, setSimLen] = useState<number>(1500);
  const [simWid, setSimWid] = useState<number>(600);
  const [simQty, setSimQty] = useState<number>(1);
  const [suggestions, setSuggestions] = useState<OffcutSuggestion[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [resKpi, resOffcuts] = await Promise.all([
        fetch('/api/materials/analytics/variance'),
        fetch('/api/materials/offcuts')
      ]);

      if (resKpi.ok) {
        const kpiJson = await resKpi.json();
        setKpiData(kpiJson);
      }

      if (resOffcuts.ok) {
        const offJson = await resOffcuts.json();
        setOffcuts(offJson.offcuts || []);
      }
    } catch (err) {
      console.error('Failed to load material analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run Suggestion Engine Simulator
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const params = new URLSearchParams({
        grade: simGrade,
        thicknessMm: String(simThk),
        lengthMm: String(simLen),
        widthMm: String(simWid),
        requiredQty: String(simQty)
      });
      const res = await fetch(`/api/materials/offcuts/suggest?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered Offcut Stock
  const filteredOffcuts = offcuts.filter((item) => {
    const matchesSearch =
      offcutSearch === '' ||
      item.id.toLowerCase().includes(offcutSearch.toLowerCase()) ||
      item.materialGrade.toLowerCase().includes(offcutSearch.toLowerCase()) ||
      item.rackLocation.toLowerCase().includes(offcutSearch.toLowerCase()) ||
      item.heatNumber.toLowerCase().includes(offcutSearch.toLowerCase()) ||
      item.sourceWorkOrder.toLowerCase().includes(offcutSearch.toLowerCase());

    const matchesGrade = gradeFilter === 'all' || item.materialGrade.toLowerCase() === gradeFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || item.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesGrade && matchesStatus;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-condensed font-black uppercase tracking-wider bg-emerald-600 text-white">
                MES ANALYTICS
              </span>
              <span className="text-xs text-base-muted font-mono font-medium">
                EPC Control System · Fabrication Facility
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-condensed font-black tracking-wide text-base-text uppercase">
              Material Yield, Scrap & BOM Variance Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-base-muted">
              Real-time monitoring of raw plate utilization, cutting machine yield vs benchmarks, and cumulative savings from offcut reuse.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              className="p-2 rounded-lg bg-base-surface2 hover:bg-neutral-800 border border-base-border text-base-muted hover:text-base-text transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {onNavigateToKiosk && (
              <button
                onClick={onNavigateToKiosk}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Factory className="h-4 w-4" />
                <span>Shop Floor Kiosk</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        {kpiData && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-base-border pt-4">
            <div className="bg-base-surface2 p-4 rounded-xl border border-base-border/80 space-y-1">
              <div className="flex items-center justify-between text-base-muted text-xs font-condensed font-bold uppercase tracking-wider">
                <span>Overall Material Yield</span>
                <Percent className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="font-mono font-black text-2xl text-emerald-400">
                {kpiData.overallYieldPct}%
              </div>
              <div className="text-[11px] text-base-muted">
                Target Benchmark: <strong className="text-base-text">{kpiData.targetYieldPct}%</strong> (+{(kpiData.overallYieldPct - kpiData.targetYieldPct).toFixed(1)}% efficiency)
              </div>
            </div>

            <div className="bg-base-surface2 p-4 rounded-xl border border-base-border/80 space-y-1">
              <div className="flex items-center justify-between text-base-muted text-xs font-condensed font-bold uppercase tracking-wider">
                <span>BOM Variance Rate</span>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <div className="font-mono font-black text-2xl text-blue-400">
                {kpiData.varianceRatePct > 0 ? `+${kpiData.varianceRatePct}%` : `${kpiData.varianceRatePct}%`}
              </div>
              <div className="text-[11px] text-base-muted">
                Actual vs Planned: <strong className="text-base-text">Favorable Consump.</strong>
              </div>
            </div>

            <div className="bg-base-surface2 p-4 rounded-xl border border-base-border/80 space-y-1">
              <div className="flex items-center justify-between text-base-muted text-xs font-condensed font-bold uppercase tracking-wider">
                <span>Cumulative Scrap Slag</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="font-mono font-black text-2xl text-amber-400">
                {kpiData.totalScrapKg} Kg
              </div>
              <div className="text-[11px] text-base-muted">
                From <strong className="text-base-text">{kpiData.totalRawConsumedKg} Kg</strong> raw stock processed
              </div>
            </div>

            <div className="bg-base-surface2 p-4 rounded-xl border border-base-border/80 space-y-1">
              <div className="flex items-center justify-between text-base-muted text-xs font-condensed font-bold uppercase tracking-wider">
                <span>Offcut Reuse Value Saved</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="font-mono font-black text-xl text-emerald-400 truncate">
                {formatCurrency(kpiData.cumulativeCostSavedIdr)}
              </div>
              <div className="text-[11px] text-base-muted">
                Reused: <strong className="text-base-text">{kpiData.totalOffcutsReusedKg} Kg</strong> of remnants
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Charts (BOM Variance by WO & Scrap Ratio by Machine) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: BOM Planned vs Actual Consumption by Work Order */}
        <div className="lg:col-span-7 bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-red-500" />
                Work Order BOM Material Consumption Variance (Kg)
              </span>
              <h3 className="text-sm font-bold text-base-text">Planned Mass vs. Actual Consumed Mass</h3>
            </div>
            <span className="text-[11px] font-mono text-base-muted">Unit: Kilograms (Kg)</span>
          </div>

          <div className="h-72 w-full pt-2">
            {kpiData && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={kpiData.consumptionVarianceByWO}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" opacity={0.6} />
                  <XAxis
                    dataKey="workOrder"
                    stroke="#737373"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#737373"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      borderColor: '#404040',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                  <Bar dataKey="plannedKg" name="BOM Target (Kg)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actualKg" name="Actual Cut (Kg)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Scrap / Yield Ratio by Cutting Machine */}
        <div className="lg:col-span-5 bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-amber-500" />
                Machine Scrap Rate vs Target Benchmark
              </span>
              <h3 className="text-sm font-bold text-base-text">Workstation Kerf & Slag Efficiency</h3>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {kpiData?.machineMetrics.map((m, idx) => {
              const isExceeding = m.scrapRatioPct > m.targetScrapPct;
              return (
                <div key={m.machine} className="bg-base-surface2 p-3 rounded-lg border border-base-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-base-text">{m.name}</span>
                    <span className={`font-mono font-bold ${isExceeding ? 'text-red-400' : 'text-emerald-400'}`}>
                      Yield: {m.yieldRatioPct}%
                    </span>
                  </div>

                  {/* Progress comparison bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-base-muted">
                      <span>Actual Scrap: <strong>{m.scrapRatioPct}%</strong></span>
                      <span>Target Benchmark: {m.targetScrapPct}%</span>
                    </div>
                    <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${m.yieldRatioPct}%` }}
                        title={`Yield: ${m.yieldRatioPct}%`}
                      />
                      <div
                        className={`h-full transition-all ${isExceeding ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${m.scrapRatioPct}%` }}
                        title={`Scrap: ${m.scrapRatioPct}%`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Offcut Reuse Savings Trend & Suggestion Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly Offcut Reuse Cost Savings Trend */}
        <div className="lg:col-span-6 bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Cumulative Remnant Reuse Cost Savings (IDR)
              </span>
              <h3 className="text-sm font-bold text-base-text">Monthly Trend: Reclaimed Steel Value</h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">Total: ~Rp 180M+</span>
          </div>

          <div className="h-64 w-full pt-2">
            {kpiData && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={kpiData.monthlySavings}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" opacity={0.6} />
                  <XAxis dataKey="month" stroke="#737373" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#737373"
                    fontSize={10}
                    tickFormatter={(v) => `${v / 1000000}M`}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(Number(v)), 'Savings']}
                    contentStyle={{
                      backgroundColor: '#171717',
                      borderColor: '#404040',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="savingsIdr"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSavings)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Reusable Offcut Suggestion Engine Simulator */}
        <div className="lg:col-span-6 bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-condensed font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Reusable Offcut Suggestion Engine
              </span>
              <h3 className="text-sm font-bold text-base-text">Query & Reserve Remnants for New BOM</h3>
            </div>
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer"
            >
              {isSimulating ? 'Searching...' : 'Find Matches'}
            </button>
          </div>

          {/* Criteria Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-base-muted uppercase font-mono block">Grade</label>
              <select
                value={simGrade}
                onChange={(e) => setSimGrade(e.target.value)}
                className="w-full bg-base-surface2 border border-base-border rounded p-1.5 text-xs text-base-text font-bold"
              >
                <option value="Hardox 450">Hardox 450</option>
                <option value="Bisalloy 400">Bisalloy 400</option>
                <option value="SS304">SS304</option>
                <option value="S355JR">S355JR</option>
                <option value="A36">A36 / SS400</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-base-muted uppercase font-mono block">Thickness</label>
              <input
                type="number"
                value={simThk}
                onChange={(e) => setSimThk(parseFloat(e.target.value) || 0)}
                className="w-full bg-base-surface2 border border-base-border rounded p-1.5 text-xs text-base-text font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-base-muted uppercase font-mono block">Target Len (mm)</label>
              <input
                type="number"
                value={simLen}
                onChange={(e) => setSimLen(parseInt(e.target.value) || 0)}
                className="w-full bg-base-surface2 border border-base-border rounded p-1.5 text-xs text-base-text font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-base-muted uppercase font-mono block">Target Wid (mm)</label>
              <input
                type="number"
                value={simWid}
                onChange={(e) => setSimWid(parseInt(e.target.value) || 0)}
                className="w-full bg-base-surface2 border border-base-border rounded p-1.5 text-xs text-base-text font-mono"
              />
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {suggestions.length === 0 ? (
              <div className="p-6 text-center text-xs text-base-muted border border-dashed border-base-border rounded-lg">
                Enter target dimensions and click "Find Matches" to query available rack offcuts.
              </div>
            ) : (
              suggestions.map((sugg) => (
                <div
                  key={sugg.offcut.id}
                  className="bg-base-surface2 p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400">{sugg.offcut.id}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                        Fit Score: {sugg.fitScorePct}%
                      </span>
                      <span className="text-[10px] text-base-muted font-mono">
                        Rack: {sugg.offcut.rackLocation}
                      </span>
                    </div>
                    <div className="text-base-text font-mono mt-0.5">
                      {sugg.offcut.materialGrade} {sugg.offcut.thicknessMm}mm — {sugg.offcut.lengthMm}×{sugg.offcut.widthMm}mm (~{sugg.offcut.approxWeightKg} Kg)
                    </div>
                    <div className="text-[11px] text-emerald-300 font-mono">
                      Potential Value Saved: {formatCurrency(sugg.potentialCostSavedIdr)}
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-condensed font-bold uppercase shrink-0">
                    Recommended
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Usable Offcut Stock Management Table */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted flex items-center gap-1.5">
              <Database className="h-4 w-4 text-emerald-500" />
              Active Remnant & Offcut Stock Inventory
            </span>
            <h3 className="text-base font-bold text-base-text">Shop Floor Rack Storage Registry</h3>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                type="text"
                value={offcutSearch}
                onChange={(e) => setOffcutSearch(e.target.value)}
                placeholder="Search Remnants..."
                className="bg-base-surface2 border border-base-border rounded-lg px-3 py-1.5 pl-8 text-xs text-base-text outline-none placeholder:text-neutral-500"
              />
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-base-muted" />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-base-surface2 border border-base-border rounded-lg p-1.5 text-xs text-base-text"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="consumed">Consumed</option>
            </select>
          </div>
        </div>

        {/* Offcut Inventory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-base-border text-base-muted font-sans text-[11px] uppercase tracking-wider bg-base-surface2/50">
                <th className="p-2.5">Offcut QR ID</th>
                <th className="p-2.5">Material Grade</th>
                <th className="p-2.5">Thickness</th>
                <th className="p-2.5">Dimensions (mm)</th>
                <th className="p-2.5">Mass (Kg)</th>
                <th className="p-2.5">Rack Location</th>
                <th className="p-2.5">Heat / MTC #</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Value (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border">
              {filteredOffcuts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-base-muted">
                    No offcuts match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOffcuts.map((item) => (
                  <tr key={item.id} className="hover:bg-base-surface2/40 transition-colors">
                    <td className="p-2.5 font-bold text-emerald-400">{item.id}</td>
                    <td className="p-2.5 font-bold text-base-text">{item.materialGrade}</td>
                    <td className="p-2.5">{item.thicknessMm} mm</td>
                    <td className="p-2.5">{item.lengthMm} × {item.widthMm}</td>
                    <td className="p-2.5">{item.approxWeightKg} kg</td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                        {item.rackLocation}
                      </span>
                    </td>
                    <td className="p-2.5 text-base-muted">
                      {item.heatNumber} / {item.mtcNumber}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-condensed font-black uppercase ${
                          item.status === 'available'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.status === 'reserved'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-bold text-emerald-400">
                      {formatCurrency(item.estimatedValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
