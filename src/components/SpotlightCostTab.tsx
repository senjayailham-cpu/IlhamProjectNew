import React, { useState, useMemo } from 'react';
import { Project, TimesheetEntry, WireLog, MaterialConsumptionLog } from '../types';
import { useAppStore } from '../store';
import { 
  calculateProjectCostSummary, 
  formatIDR, 
  formatCompactIDR 
} from '../utils/costEngine';
import { 
  DollarSign, 
  Users, 
  Flame, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  Save, 
  X,
  Layers,
  ArrowRight
} from 'lucide-react';

interface SpotlightCostTabProps {
  project: Project;
  timesheets: TimesheetEntry[];
  wireLogs: WireLog[];
  consumptionLogs: MaterialConsumptionLog[];
  onUpdateProject?: (updated: Project) => void;
}

export function SpotlightCostTab({
  project,
  timesheets,
  wireLogs,
  consumptionLogs,
  onUpdateProject,
}: SpotlightCostTabProps) {
  const employees = useAppStore((s) => s.employees);
  const materials = useAppStore((s) => s.materials);

  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>(
    project.budgetCost ? String(project.budgetCost) : ''
  );

  const costSummary = useMemo(() => {
    return calculateProjectCostSummary(
      project,
      timesheets,
      wireLogs,
      consumptionLogs,
      employees,
      materials
    );
  }, [project, timesheets, wireLogs, consumptionLogs, employees, materials]);

  const handleSaveBudget = () => {
    if (!onUpdateProject) return;
    const val = parseFloat(budgetInput) || 0;
    const updated = {
      ...project,
      budgetCost: val > 0 ? val : undefined,
    };
    onUpdateProject(updated);
    setIsEditingBudget(false);
  };

  const {
    budgetCost,
    totalLaborHours,
    totalLaborCost,
    totalWireKg,
    totalWireCost,
    otherConsumableCost,
    totalConsumableCost,
    totalActualCost,
    varianceCost,
    isOverBudget,
    costBurnPct,
    laborBreakdown,
    consumableBreakdown,
    assemblySummaries,
  } = costSummary;

  return (
    <div className="p-4 space-y-6 text-xs font-sans overflow-y-auto max-h-[calc(85vh-160px)]">
      {/* ── TOP KPI EXECUTIVE CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Budget At Completion (BAC) */}
        <div className="p-3.5 rounded-xl bg-base-surface border border-base-border relative group shadow-xs">
          <div className="flex items-center justify-between text-base-muted mb-1 font-condensed font-bold uppercase tracking-wider text-[10px]">
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-blue-500" />
              <span>Budget At Completion (BAC)</span>
            </span>
            {onUpdateProject && !isEditingBudget && (
              <button
                type="button"
                onClick={() => {
                  setBudgetInput(project.budgetCost ? String(project.budgetCost) : String(budgetCost));
                  setIsEditingBudget(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-base-accent text-base-muted transition cursor-pointer"
                title="Edit Plafon Anggaran Proyek"
              >
                <Edit3 className="h-3 w-3" />
              </button>
            )}
          </div>

          {isEditingBudget ? (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-base-muted font-bold">Rp</span>
                <input
                  type="number"
                  step="500000"
                  min="0"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="e.g. 50000000"
                  className="w-full pl-7 pr-2 py-1 text-xs bg-base-surface2 border border-base-accent rounded-lg font-mono font-bold outline-none"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleSaveBudget}
                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 cursor-pointer"
                title="Simpan Anggaran"
              >
                <Save className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="p-1.5 bg-base-surface2 border border-base-border text-base-muted rounded-lg hover:text-base-text cursor-pointer"
                title="Batal"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <div className="text-lg font-mono font-black text-base-text">
                {formatIDR(budgetCost)}
              </div>
              <div className="text-[10px] text-base-muted mt-0.5">
                {project.budgetCost ? 'Plafon Anggaran Ditentukan' : 'Estimasi Otomatis (Budget Hours × Rate)'}
              </div>
            </>
          )}
        </div>

        {/* Card 2: Actual Labor Cost */}
        <div className="p-3.5 rounded-xl bg-base-surface border border-base-border shadow-xs">
          <div className="flex items-center justify-between text-base-muted mb-1 font-condensed font-bold uppercase tracking-wider text-[10px]">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              <span>Actual Labor Cost (DLC)</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-500 font-bold">{totalLaborHours} Jam</span>
          </div>
          <div className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
            {formatIDR(totalLaborCost)}
          </div>
          <div className="text-[10px] text-base-muted mt-0.5">
            Dari {timesheets.filter(t => t.projectId === project.id || (t.workOrder && t.workOrder.toLowerCase() === (project.client || '').toLowerCase())).length} log timesheet karyawan
          </div>
        </div>

        {/* Card 3: Actual Consumables & Wire Cost */}
        <div className="p-3.5 rounded-xl bg-base-surface border border-base-border shadow-xs">
          <div className="flex items-center justify-between text-base-muted mb-1 font-condensed font-bold uppercase tracking-wider text-[10px]">
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>Consumable & Wire Cost</span>
            </span>
            <span className="text-[10px] font-mono text-amber-500 font-bold">{totalWireKg} kg wire</span>
          </div>
          <div className="text-lg font-mono font-black text-amber-600 dark:text-amber-400">
            {formatIDR(totalConsumableCost)}
          </div>
          <div className="text-[10px] text-base-muted mt-0.5">
            Wire: {formatIDR(totalWireCost)} | Lainnya: {formatIDR(otherConsumableCost)}
          </div>
        </div>

        {/* Card 4: Total Actual Cost & Variance */}
        <div className={`p-3.5 rounded-xl border shadow-xs ${
          isOverBudget 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-emerald-500/10 border-emerald-500/30'
        }`}>
          <div className="flex items-center justify-between mb-1 font-condensed font-bold uppercase tracking-wider text-[10px]">
            <span className="flex items-center gap-1.5 text-base-muted">
              {isOverBudget ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              <span>Total Actual (AC) & Variance</span>
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-black uppercase ${
              isOverBudget ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
            }`}>
              {isOverBudget ? 'OVER BUDGET' : 'UNDER BUDGET'}
            </span>
          </div>
          <div className="text-lg font-mono font-black text-base-text">
            {formatIDR(totalActualCost)}
          </div>
          <div className={`text-[10px] font-mono font-bold mt-0.5 flex items-center gap-1 ${
            isOverBudget ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {isOverBudget ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>Variance: {isOverBudget ? `-${formatIDR(Math.abs(varianceCost))}` : `+${formatIDR(varianceCost)} (Hemat)`}</span>
          </div>
        </div>
      </div>

      {/* ── BURN RATE PROGRESS BAR ── */}
      <div className="p-3.5 rounded-xl bg-base-surface border border-base-border space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base-text font-condensed uppercase tracking-wider">Penyerapan Anggaran (Cost Burn Rate)</span>
            <span className="text-[10px] text-base-muted">
              {formatIDR(totalActualCost)} terpakai dari plafon {formatIDR(budgetCost)}
            </span>
          </div>
          <span className={`font-mono font-black text-xs ${
            costBurnPct > 100 ? 'text-red-500' : costBurnPct > 80 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {costBurnPct}%
          </span>
        </div>

        <div className="h-3 bg-base-surface2 rounded-full overflow-hidden p-0.5 border border-base-border">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              costBurnPct > 100 
                ? 'bg-red-500 animate-pulse' 
                : costBurnPct > 80 
                  ? 'bg-amber-500' 
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, costBurnPct)}%` }}
          />
        </div>
      </div>

      {/* ── SECTION 1: SUB-ASSEMBLIES (WBS) COST BREAKDOWN ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-500" />
            <h4 className="font-bold text-sm text-base-text font-condensed uppercase tracking-wider">
              Rincian Biaya per Sub-Assembly ({assemblySummaries.length})
            </h4>
          </div>
          <span className="text-[10px] text-base-muted">Biaya diakumulasi langsung dari Timesheet & Wire Log per komponen</span>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-surface2 border-b border-base-border text-base-muted font-bold font-condensed uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Sub-Assembly</th>
                  <th className="py-2.5 px-3 text-right">Jam Kerja</th>
                  <th className="py-2.5 px-3 text-right">Biaya Labor</th>
                  <th className="py-2.5 px-3 text-right">Kawat Las</th>
                  <th className="py-2.5 px-3 text-right">Biaya Kawat</th>
                  <th className="py-2.5 px-3 text-right">Consumable Lain</th>
                  <th className="py-2.5 px-3 text-right">Total Aktual (AC)</th>
                  <th className="py-2.5 px-3 text-right">Status / Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border font-medium">
                {assemblySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 px-3 text-center text-base-muted italic">
                      Belum ada assembly pada proyek ini.
                    </td>
                  </tr>
                ) : (
                  assemblySummaries.map((asm) => (
                    <tr key={asm.assemblyId} className="hover:bg-base-surface2/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-base-text">
                        {asm.assemblyName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-base-muted">
                        {asm.laborHours} jam
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatIDR(asm.laborCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-base-muted">
                        {asm.wireKg > 0 ? `${asm.wireKg} kg` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {asm.wireCost > 0 ? formatIDR(asm.wireCost) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-base-muted">
                        {asm.otherConsumableCost > 0 ? formatIDR(asm.otherConsumableCost) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-base-text">
                        {formatIDR(asm.totalActualCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                        {asm.budgetCost > 0 ? (
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            asm.isOverBudget 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {asm.isOverBudget ? `Over ${formatCompactIDR(Math.abs(asm.varianceCost))}` : `Sisa ${formatCompactIDR(asm.varianceCost)}`}
                          </span>
                        ) : (
                          <span className="text-base-muted/60">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 & 3: LABOR BY POSITION & CONSUMABLES BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Labor Breakdown by Position */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <h4 className="font-bold text-sm text-base-text font-condensed uppercase tracking-wider">
              Biaya Tenaga Kerja per Posisi
            </h4>
          </div>

          <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-surface2 border-b border-base-border text-base-muted font-bold font-condensed uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3">Posisi</th>
                  <th className="py-2 px-3 text-right">Personel</th>
                  <th className="py-2 px-3 text-right">Jam Kerja</th>
                  <th className="py-2 px-3 text-right">Rata2 Tarif</th>
                  <th className="py-2 px-3 text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border font-medium">
                {laborBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-5 px-3 text-center text-base-muted italic">
                      Belum ada jam kerja tercatat pada proyek ini.
                    </td>
                  </tr>
                ) : (
                  laborBreakdown.map((row) => (
                    <tr key={row.position} className="hover:bg-base-surface2/30 transition-colors">
                      <td className="py-2 px-3 font-bold text-base-text">
                        {row.position}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-base-muted">
                        {row.workerCount} orang
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-base-text">
                        {row.hours} jam
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-base-muted text-[11px]">
                        {formatIDR(row.avgHourlyRate)}/j
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {formatIDR(row.cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Consumables & Wire Breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            <h4 className="font-bold text-sm text-base-text font-condensed uppercase tracking-wider">
              Pemakaian Consumables & Kawat Las
            </h4>
          </div>

          <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-base-surface2 border-b border-base-border text-base-muted font-bold font-condensed uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3">Item Consumable</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Satuan</th>
                  <th className="py-2 px-3 text-right">Rata2 Harga</th>
                  <th className="py-2 px-3 text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border font-medium">
                {consumableBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-5 px-3 text-center text-base-muted italic">
                      Belum ada pemakaian kawat las atau consumable pada proyek ini.
                    </td>
                  </tr>
                ) : (
                  consumableBreakdown.map((row) => (
                    <tr key={row.id} className="hover:bg-base-surface2/30 transition-colors">
                      <td className="py-2 px-3 font-bold text-base-text">
                        {row.name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-base-text">
                        {row.qty}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-base-muted text-[11px]">
                        {row.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-base-muted text-[11px]">
                        {formatIDR(row.avgUnitCost)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                        {formatIDR(row.totalCost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SpotlightCostTab;
