import React, { useState, useMemo } from 'react';
import { Project, TimesheetEntry, WireLog, MaterialConsumptionLog, Employee, MaterialItem } from '../types';
import { 
  calculateProjectCostSummary, 
  formatCurrency, 
  formatCompactCurrency,
  CURRENCY_SYMBOLS 
} from '../utils/costEngine';
import { useAppStore } from '../store';
import { CurrencySelector } from './CurrencySelector';
import { 
  DollarSign, 
  Users, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Edit3, 
  Save, 
  X,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface ProjectCostSheetViewProps {
  projects: Project[];
  timesheets: TimesheetEntry[];
  wireLogs: WireLog[];
  consumptionLogs: MaterialConsumptionLog[];
  employees: Employee[];
  materials: MaterialItem[];
  onOpenSpotlight: (projectId: string) => void;
  onUpdateProject?: (updated: Project) => void;
}

export function ProjectCostSheetView({
  projects,
  timesheets,
  wireLogs,
  consumptionLogs,
  employees,
  materials,
  onOpenSpotlight,
  onUpdateProject,
}: ProjectCostSheetViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-progress' | 'over-budget' | 'under-budget'>('all');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetInputVal, setBudgetInputVal] = useState<string>('');

  const currency = useAppStore((s) => s.currency);
  const exchangeRates = useAppStore((s) => s.exchangeRates);

  const fmt = (val: number | undefined | null) => formatCurrency(val, currency, exchangeRates);
  const fmtCompact = (val: number | undefined | null) => formatCompactCurrency(val, currency, exchangeRates);

  // Calculate cost summary for each project
  const projectSummaries = useMemo(() => {
    return projects.map((p) => {
      const summary = calculateProjectCostSummary(
        p,
        timesheets,
        wireLogs,
        consumptionLogs,
        employees,
        materials
      );
      return { project: p, summary };
    });
  }, [projects, timesheets, wireLogs, consumptionLogs, employees, materials]);

  // Enterprise Rollup Totals
  const enterpriseTotals = useMemo(() => {
    let totalBudget = 0;
    let totalLaborCost = 0;
    let totalLaborHours = 0;
    let totalWireCost = 0;
    let totalWireKg = 0;
    let totalConsumableCost = 0;
    let totalActualCost = 0;
    let overBudgetCount = 0;

    projectSummaries.forEach(({ summary }) => {
      totalBudget += summary.budgetCost;
      totalLaborCost += summary.totalLaborCost;
      totalLaborHours += summary.totalLaborHours;
      totalWireCost += summary.totalWireCost;
      totalWireKg += summary.totalWireKg;
      totalConsumableCost += summary.totalConsumableCost;
      totalActualCost += summary.totalActualCost;
      if (summary.isOverBudget) overBudgetCount++;
    });

    const totalVariance = totalBudget - totalActualCost;
    const overallBurnRate = totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 100) : 0;

    return {
      totalBudget,
      totalLaborCost,
      totalLaborHours,
      totalWireCost,
      totalWireKg,
      totalConsumableCost,
      totalActualCost,
      totalVariance,
      overallBurnRate,
      overBudgetCount,
      projectCount: projectSummaries.length,
    };
  }, [projectSummaries]);

  // Filtered rows
  const filteredList = useMemo(() => {
    return projectSummaries.filter(({ project, summary }) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = project.name.toLowerCase().includes(q);
        const matchClient = (project.client || '').toLowerCase().includes(q);
        const matchGA = (project.gaNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchClient && !matchGA) return false;
      }

      // Status filter
      if (statusFilter === 'in-progress' && project.status === 'completed') return false;
      if (statusFilter === 'over-budget' && !summary.isOverBudget) return false;
      if (statusFilter === 'under-budget' && summary.isOverBudget) return false;

      return true;
    });
  }, [projectSummaries, searchQuery, statusFilter]);

  const handleStartEditBudget = (p: Project, currentVal: number) => {
    setEditingBudgetId(p.id);
    setBudgetInputVal(p.budgetCost ? String(p.budgetCost) : String(currentVal));
  };

  const handleSaveBudget = (p: Project) => {
    if (!onUpdateProject) return;
    const val = parseFloat(budgetInputVal) || 0;
    const updated = {
      ...p,
      budgetCost: val > 0 ? val : undefined,
    };
    onUpdateProject(updated);
    setEditingBudgetId(null);
  };

  return (
    <div className="space-y-6">
      {/* ── ENTERPRISE COST SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Portfolio Budget */}
        <div className="p-4 rounded-2xl bg-base-surface border border-base-border shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-base-muted font-condensed font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span>Total Plafon Anggaran (BAC)</span>
            </span>
            <span className="text-[10px] font-mono text-base-muted">{enterpriseTotals.projectCount} Proyek</span>
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-base-text">
            {fmt(enterpriseTotals.totalBudget)}
          </div>
          <div className="text-[11px] text-base-muted mt-1">
            Total alokasi pagu biaya seluruh proyek
          </div>
        </div>

        {/* Total Actual Labor Cost */}
        <div className="p-4 rounded-2xl bg-base-surface border border-base-border shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-base-muted font-condensed font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-500" />
              <span>Realisasi Tenaga Kerja (DLC)</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-500 font-bold">{enterpriseTotals.totalLaborHours} Jam</span>
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400">
            {fmt(enterpriseTotals.totalLaborCost)}
          </div>
          <div className="text-[11px] text-base-muted mt-1">
            Terekam presisi dari jam timesheet karyawan
          </div>
        </div>

        {/* Total Consumable & Wire Cost */}
        <div className="p-4 rounded-2xl bg-base-surface border border-base-border shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-base-muted font-condensed font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" />
              <span>Kawat Las & Consumables</span>
            </span>
            <span className="text-[10px] font-mono text-amber-500 font-bold">{enterpriseTotals.totalWireKg} kg wire</span>
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
            {fmt(enterpriseTotals.totalConsumableCost)}
          </div>
          <div className="text-[11px] text-base-muted mt-1">
            Wire: {fmtCompact(enterpriseTotals.totalWireCost)} + Consumables gudang
          </div>
        </div>

        {/* Total Actual Cost & Net Variance */}
        <div className={`p-4 rounded-2xl border shadow-card flex flex-col justify-between ${
          enterpriseTotals.totalVariance < 0 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div className="flex items-center justify-between font-condensed font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5 text-base-text">
              {enterpriseTotals.totalVariance < 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span>Total Pengeluaran (AC)</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
              enterpriseTotals.totalVariance < 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
            }`}>
              {enterpriseTotals.overallBurnRate}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-base-text">
            {fmt(enterpriseTotals.totalActualCost)}
          </div>
          <div className={`text-[11px] font-mono font-bold mt-1 flex items-center gap-1 ${
            enterpriseTotals.totalVariance < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {enterpriseTotals.totalVariance < 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>Net Variance: {enterpriseTotals.totalVariance < 0 ? `-${fmt(Math.abs(enterpriseTotals.totalVariance))}` : `+${fmt(enterpriseTotals.totalVariance)} (Hemat)`}</span>
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-base-surface p-3 rounded-2xl border border-base-border shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-base-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Proyek, Klien, atau GA Number..."
            className="w-full pl-9 pr-3 py-1.5 bg-base-surface2 border border-base-border rounded-xl text-xs text-base-text outline-none focus:ring-1 focus:ring-base-accent"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-between sm:justify-end">
          {/* Currency Switcher (IDR / USD / AUD) */}
          <CurrencySelector />

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-condensed font-bold uppercase tracking-wider">
          <span className="text-[10px] text-base-muted hidden md:inline mr-1">Filter:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-base-accent text-black font-extrabold'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
            }`}
          >
            Semua ({projectSummaries.length})
          </button>
          <button
            onClick={() => setStatusFilter('in-progress')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'in-progress'
                ? 'bg-base-accent text-black font-extrabold'
                : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
            }`}
          >
            Sedang Berjalan
          </button>
          <button
            onClick={() => setStatusFilter('over-budget')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              statusFilter === 'over-budget'
                ? 'bg-red-600 text-white font-extrabold'
                : 'text-red-500 hover:bg-red-500/10'
            }`}
          >
            <span>Over Budget</span>
            <span className="px-1 py-0.2 rounded-full text-[9px] bg-red-500/20 text-red-500">
              {enterpriseTotals.overBudgetCount}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('under-budget')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === 'under-budget'
                ? 'bg-emerald-600 text-white font-extrabold'
                : 'text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            Hemat / Aman
          </button>
        </div>
      </div>
    </div>

      {/* ── JOB ORDER COST TABLE ── */}
      <div className="bg-base-surface border border-base-border rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-base-surface2 border-b border-base-border text-base-muted font-bold font-condensed uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Proyek & Klien</th>
                <th className="py-3 px-4">GA Number</th>
                <th className="py-3 px-4 text-right">Plafon Anggaran (BAC)</th>
                <th className="py-3 px-4 text-right">Biaya Labor (DLC)</th>
                <th className="py-3 px-4 text-right">Kawat Las & Consumable</th>
                <th className="py-3 px-4 text-right">Total Aktual (AC)</th>
                <th className="py-3 px-4 text-right">Cost Variance (CV)</th>
                <th className="py-3 px-4 text-center w-32">Burn Rate %</th>
                <th className="py-3 px-4 text-center">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-base-muted italic">
                    Tidak ada proyek yang sesuai dengan kriteria filter biaya.
                  </td>
                </tr>
              ) : (
                filteredList.map(({ project, summary }) => {
                  const isEditingThisBudget = editingBudgetId === project.id;

                  return (
                    <tr 
                      key={project.id} 
                      className={`hover:bg-base-surface2/30 transition-all ${
                        summary.isOverBudget ? 'bg-red-500/[0.02]' : ''
                      }`}
                    >
                      {/* Project info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-sm text-base-text hover:text-base-accent cursor-pointer flex items-center gap-1.5"
                          onClick={() => onOpenSpotlight(project.id)}
                        >
                          <span>{project.name}</span>
                          <ExternalLink className="h-3 w-3 text-base-muted opacity-40 hover:opacity-100" />
                        </div>
                        <div className="text-[10px] text-base-muted flex items-center gap-2 mt-0.5">
                          <span>{project.client || 'No Client'}</span>
                          <span>•</span>
                          <span className="capitalize">{project.status}</span>
                        </div>
                      </td>

                      {/* GA Number */}
                      <td className="py-3 px-4 font-mono font-bold text-amber-500">
                        {project.gaNumber || '—'}
                      </td>

                      {/* Budget Cost (BAC) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-base-text">
                        {isEditingThisBudget ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[10px] text-base-muted">Rp</span>
                            <input
                              type="number"
                              step="500000"
                              min="0"
                              value={budgetInputVal}
                              onChange={(e) => setBudgetInputVal(e.target.value)}
                              className="w-24 text-right px-1.5 py-0.5 bg-base-surface2 border border-base-accent rounded text-xs outline-none font-bold"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveBudget(project)}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 cursor-pointer"
                              title="Simpan"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBudgetId(null)}
                              className="p-1 bg-base-surface2 text-base-muted rounded hover:text-base-text cursor-pointer"
                              title="Batal"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 group">
                            <span>{fmt(summary.budgetCost)}</span>
                            {onUpdateProject && (
                              <button
                                type="button"
                                onClick={() => handleStartEditBudget(project, summary.budgetCost)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-base-muted hover:text-base-accent transition cursor-pointer"
                                title="Edit Anggaran"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Labor Cost */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          {fmt(summary.totalLaborCost)}
                        </div>
                        <div className="text-[10px] text-base-muted font-normal">
                          {summary.totalLaborHours} jam
                        </div>
                      </td>

                      {/* Consumable & Wire Cost */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-amber-600 dark:text-amber-400">
                          {fmt(summary.totalConsumableCost)}
                        </div>
                        <div className="text-[10px] text-base-muted font-normal">
                          {summary.totalWireKg > 0 ? `${summary.totalWireKg} kg wire` : '0 kg'}
                        </div>
                      </td>

                      {/* Total Actual Cost */}
                      <td className="py-3 px-4 text-right font-mono font-black text-sm text-base-text">
                        {fmt(summary.totalActualCost)}
                      </td>

                      {/* Cost Variance */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          summary.isOverBudget
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {summary.isOverBudget ? (
                            <>
                              <TrendingUp className="h-3 w-3" />
                              <span>-{fmtCompact(Math.abs(summary.varianceCost))}</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-3 w-3" />
                              <span>+{fmtCompact(summary.varianceCost)}</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Burn Rate */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-base-muted">Burn</span>
                            <span className={`font-bold ${
                              summary.costBurnPct > 100 
                                ? 'text-red-500' 
                                : summary.costBurnPct > 80 
                                  ? 'text-amber-500' 
                                  : 'text-emerald-500'
                            }`}>
                              {summary.costBurnPct}%
                            </span>
                          </div>
                          <div className="h-2 bg-base-surface2 rounded-full overflow-hidden border border-base-border/50">
                            <div
                              className={`h-full rounded-full transition-all ${
                                summary.costBurnPct > 100
                                  ? 'bg-red-500'
                                  : summary.costBurnPct > 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, summary.costBurnPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenSpotlight(project.id)}
                          className="px-2.5 py-1 bg-base-surface2 hover:bg-base-accent hover:text-black border border-base-border rounded-lg text-[10px] font-condensed font-bold uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span>Rincian</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default ProjectCostSheetView;
