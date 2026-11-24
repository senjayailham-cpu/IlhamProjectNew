import {
  Project,
  TimesheetEntry,
  WireLog,
  MaterialConsumptionLog,
  Employee,
  MaterialItem,
  Assembly,
  BomTemplate,
} from '../types';
import {
  calculateTimesheetEntryCost,
  isTimesheetForProject,
  isWireLogForProject,
  isConsumptionLogForProject,
  getConsumableRate,
  DEFAULT_WIRE_COST_PER_KG,
} from './costEngine';
import { calcPct } from './projectUtils';
import { estimateProjectBacFromBom } from './bacEstimator';

export type EvmsUnitMode = 'cost' | 'hours';

export type EvmsHealthStatus =
  | 'optimal'
  | 'efficient_behind'
  | 'overbudget_ahead'
  | 'critical'
  | 'unstarted';

export interface EvmsAssemblyMetrics {
  assemblyId: string;
  assemblyName: string;
  bac: number;
  isEstimatedBac: boolean;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  eac: number;
  vac: number;
  actualPct: number;
  plannedPct: number;
  laborHours: number;
  laborCost: number;
  consumableCost: number;
  healthStatus: EvmsHealthStatus;
  healthLabel: string;
}

export interface EvmsProjectMetrics {
  projectId: string;
  projectName: string;
  client: string;
  location: string;
  status: Project['status'];
  due: string;
  isOverdue: boolean;
  bac: number;
  isEstimatedBac: boolean;
  bacSource?: 'explicit' | 'bom_auto' | 'hours_fallback' | 'actual_fallback';
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  eac: number;
  etc: number;
  vac: number;
  tcpi: number;
  actualPct: number;
  plannedPct: number;
  laborHours: number;
  laborCost: number;
  wireCost: number;
  otherConsumableCost: number;
  totalActualCost: number;
  explicitBudgetCost?: number;
  explicitBudgetHours?: number;
  healthStatus: EvmsHealthStatus;
  healthLabel: string;
  assemblies: EvmsAssemblyMetrics[];
}

export interface EvmsSCurvePoint {
  day: string;
  dayNum: number;
  dateStr: string;
  pv: number;
  ev: number | null;
  ac: number | null;
  cv: number | null;
  sv: number | null;
  cpi: number | null;
  spi: number | null;
}

export interface EvmsPortfolioSummary {
  unitMode: EvmsUnitMode;
  evalDate: string;
  selectedMonth: string;
  evalDayNum: number;
  daysInMonth: number;
  isCurrentSelectedMonth: boolean;
  projectCount: number;
  activeCount: number;
  completedCount: number;
  estimatedBacCount: number;
  totalBac: number;
  totalPv: number;
  totalEv: number;
  totalAc: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  eac: number;
  etc: number;
  vac: number;
  tcpi: number;
  overallActualPct: number;
  overallPlannedPct: number;
  healthStatus: EvmsHealthStatus;
  healthLabel: string;
  healthCounts: {
    optimal: number;
    efficient_behind: number;
    overbudget_ahead: number;
    critical: number;
    unstarted: number;
  };
  projects: EvmsProjectMetrics[];
  scurveSeries: EvmsSCurvePoint[];
}

export interface CalculateEvmsOptions {
  unitMode?: EvmsUnitMode;
  evalDate?: string;
  selectedMonth?: string;
  timesheets?: TimesheetEntry[];
  wireLogs?: WireLog[];
  consumptionLogs?: MaterialConsumptionLog[];
  employees?: Employee[];
  materials?: MaterialItem[];
  bomTemplates?: BomTemplate[];
}

const DEFAULT_HOURLY_BUDGET_FACTOR = 40_000;

function parseDateUtc(dateStr: string): number | null {
  const clean = String(dateStr || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

function calcDateWindowPct(startRaw: string | undefined, finishRaw: string | undefined, evalDate: string): number | null {
  const sStr = String(startRaw || '').trim().slice(0, 10);
  const fStr = String(finishRaw || '').trim().slice(0, 10);
  if (!sStr || !fStr) return null;

  if (evalDate < sStr) return 0;
  if (evalDate >= fStr) return 100;

  const sUtc = parseDateUtc(sStr);
  const fUtc = parseDateUtc(fStr);
  const cUtc = parseDateUtc(evalDate);
  if (sUtc === null || fUtc === null || cUtc === null) return null;

  const totalDays = Math.max(1, Math.round((fUtc - sUtc) / 86400000) + 1);
  const elapsedDays = Math.max(1, Math.round((cUtc - sUtc) / 86400000) + 1);
  return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
}

export function calcAssemblyActualPct(asm: Assembly): number {
  if (!asm.tasks || asm.tasks.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  asm.tasks.forEach((t) => {
    const w = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
    totalWeight += w;
    weightedSum += (typeof t.pct === 'number' ? t.pct : 0) * w;
  });
  return totalWeight === 0 ? 0 : Math.round((weightedSum / totalWeight) * 10) / 10;
}

export function calcAssemblyPlannedPct(asm: Assembly, project: Project, evalDate: string): number {
  const pStart = project.baselineStart || project.start;
  const pFinish = project.baselineFinish || project.due;
  const aStart = asm.baselineStart || asm.start || pStart;
  const aFinish = asm.baselineFinish || asm.finish || pFinish;

  const tasks = asm.tasks || [];
  if (tasks.length === 0) {
    const asmWindow = calcDateWindowPct(aStart, aFinish, evalDate);
    if (asmWindow !== null) return Math.round(asmWindow * 10) / 10;
    return project.status === 'completed' ? 100 : 0;
  }

  let totalWeight = 0;
  let weightedPlanned = 0;
  let datedTaskCount = 0;

  tasks.forEach((t) => {
    const w = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
    totalWeight += w;

    const tStart = t.baselineStart || t.startDate || t.date || aStart;
    const tFinish = t.baselineFinish || t.finishDate || t.endDate || aFinish;
    const pct = calcDateWindowPct(tStart, tFinish, evalDate);
    if (pct !== null) {
      datedTaskCount++;
      weightedPlanned += pct * w;
    } else if (project.status === 'completed') {
      weightedPlanned += 100 * w;
    }
  });

  if (totalWeight === 0) return 0;
  if (datedTaskCount === 0) {
    const fallbackWindow = calcDateWindowPct(aStart, aFinish, evalDate);
    if (fallbackWindow !== null) return Math.round(fallbackWindow * 10) / 10;
    return project.status === 'completed' ? 100 : 0;
  }

  return Math.round((weightedPlanned / totalWeight) * 10) / 10;
}

export function calcProjectPlannedPct(project: Project, evalDate: string): number {
  if (project.status === 'completed' && project.completedDate && evalDate >= project.completedDate.slice(0, 10)) {
    return 100;
  }

  const assemblies = project.assemblies || [];
  let totalWeight = 0;
  let weightedPlanned = 0;
  let datedTasks = 0;

  const pStart = project.baselineStart || project.start;
  const pFinish = project.baselineFinish || project.due;

  assemblies.forEach((asm) => {
    const aStart = asm.baselineStart || asm.start || pStart;
    const aFinish = asm.baselineFinish || asm.finish || pFinish;

    (asm.tasks || []).forEach((t) => {
      const w = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
      totalWeight += w;
      const tStart = t.baselineStart || t.startDate || t.date || aStart;
      const tFinish = t.baselineFinish || t.finishDate || t.endDate || aFinish;
      const pct = calcDateWindowPct(tStart, tFinish, evalDate);
      if (pct !== null) {
        datedTasks++;
        weightedPlanned += pct * w;
      } else if (project.status === 'completed') {
        datedTasks++;
        weightedPlanned += 100 * w;
      }
    });
  });

  if (totalWeight > 0 && datedTasks > 0) {
    return Math.min(100, Math.max(0, Math.round((weightedPlanned / totalWeight) * 10) / 10));
  }

  const projWindow = calcDateWindowPct(pStart, pFinish, evalDate);
  if (projWindow !== null) {
    return Math.round(projWindow * 10) / 10;
  }

  return project.status === 'completed' ? 100 : 0;
}

export function classifyEvmsHealth(
  cpi: number,
  spi: number,
  pv: number,
  ev: number,
  ac: number
): { status: EvmsHealthStatus; label: string } {
  if (pv === 0 && ev === 0 && ac === 0) {
    return { status: 'unstarted', label: 'Belum Dimulai' };
  }

  const onCost = cpi >= 0.98;
  const onSchedule = spi >= 0.98;

  if (onCost && onSchedule) {
    return { status: 'optimal', label: 'Optimal' };
  }
  if (onCost && !onSchedule) {
    return { status: 'efficient_behind', label: 'Hemat, Terlambat' };
  }
  if (!onCost && onSchedule) {
    return { status: 'overbudget_ahead', label: 'Boros, Cepat' };
  }
  return { status: 'critical', label: 'Kritis' };
}

export function computeDerivedEvmsRatios(bac: number, pv: number, ev: number, ac: number) {
  const cv = Math.round(ev - ac);
  const sv = Math.round(ev - pv);

  const rawCpi = ac > 0 ? ev / ac : ev > 0 ? 1.2 : 1;
  const rawSpi = pv > 0 ? ev / pv : ev > 0 ? 1.1 : 1;

  const cpi = Math.round(rawCpi * 100) / 100;
  const spi = Math.round(rawSpi * 100) / 100;

  const eac = rawCpi > 0 ? Math.round(bac / rawCpi) : bac;
  const etc = Math.max(0, Math.round(eac - ac));
  const vac = Math.round(bac - eac);

  const remainingBudget = bac - ac;
  const remainingWork = bac - ev;
  let tcpi = 1;
  if (remainingWork <= 0) {
    tcpi = 1;
  } else if (remainingBudget > 0) {
    tcpi = Math.round((remainingWork / remainingBudget) * 100) / 100;
  } else {
    tcpi = 9.99;
  }

  return { cv, sv, cpi, spi, eac, etc, vac, tcpi };
}

function getRecordDateStr(raw: string | undefined): string {
  return String(raw || '').trim().slice(0, 10);
}

export function calculateProjectEvms(
  project: Project,
  options: CalculateEvmsOptions = {}
): EvmsProjectMetrics {
  const {
    unitMode = 'cost',
    evalDate = new Date().toISOString().slice(0, 10),
    timesheets = [],
    wireLogs = [],
    consumptionLogs = [],
    employees = [],
    materials = [],
    bomTemplates = [],
  } = options;

  // Filter project logs up to evalDate (inclusive)
  const projTs = timesheets.filter((t) => {
    if (!isTimesheetForProject(t, project)) return false;
    const d = getRecordDateStr(t.date);
    return !d || d <= evalDate;
  });

  const projWire = wireLogs.filter((w) => {
    if (!isWireLogForProject(w, project)) return false;
    const d = getRecordDateStr(w.date);
    return !d || d <= evalDate;
  });

  const projCons = consumptionLogs.filter((c) => {
    if (!isConsumptionLogForProject(c, project)) return false;
    const d = getRecordDateStr(c.date);
    return !d || d <= evalDate;
  });

  let laborHours = 0;
  let laborCost = 0;
  projTs.forEach((ts) => {
    laborHours += ts.totalHours || 0;
    laborCost += calculateTimesheetEntryCost(ts, employees).totalCost;
  });

  let wireCost = 0;
  projWire.forEach((wl) => {
    const kg = wl.amountKg || 0;
    const rate = wl.unitCost || DEFAULT_WIRE_COST_PER_KG;
    wireCost += wl.totalCost !== undefined ? wl.totalCost : kg * rate;
  });

  let otherConsumableCost = 0;
  projCons.forEach((cl) => {
    const qty = cl.qtyUsed || 0;
    const rate = cl.unitCost || getConsumableRate(cl.materialId, cl.materialName, materials);
    otherConsumableCost += cl.totalCost !== undefined ? cl.totalCost : qty * rate;
  });

  const totalActualCost = Math.round(laborCost + wireCost + otherConsumableCost);

  // Determine BAC in chosen unit mode
  const sumAsmHours = (project.assemblies || []).reduce((acc, a) => acc + (a.budgetHours || 0), 0);
  const sumAsmCost = (project.assemblies || []).reduce((acc, a) => acc + (a.budgetCost || 0), 0);

  let bac = 0;
  let isEstimatedBac = false;
  let bacSource: EvmsProjectMetrics['bacSource'] = 'explicit';

  if (unitMode === 'cost') {
    if (project.budgetCost && project.budgetCost > 0) {
      bac = project.budgetCost;
      isEstimatedBac = false;
      bacSource = 'explicit';
    } else if (sumAsmCost > 0) {
      bac = sumAsmCost;
      isEstimatedBac = false;
      bacSource = 'explicit';
    } else {
      const bomEst =
        bomTemplates.length > 0
          ? estimateProjectBacFromBom(project, bomTemplates, materials, employees)
          : null;
      if (bomEst && bomEst.matchedBom && bomEst.recommendedBac > 0) {
        bac = bomEst.recommendedBac;
        isEstimatedBac = true;
        bacSource = 'bom_auto';
      } else if (project.budgetHours && project.budgetHours > 0) {
        bac = project.budgetHours * DEFAULT_HOURLY_BUDGET_FACTOR;
        isEstimatedBac = true;
        bacSource = 'hours_fallback';
      } else if (sumAsmHours > 0) {
        bac = sumAsmHours * DEFAULT_HOURLY_BUDGET_FACTOR;
        isEstimatedBac = true;
        bacSource = 'hours_fallback';
      } else {
        bac = Math.max(10_000_000, Math.round((totalActualCost * 1.25) / 1_000_000) * 1_000_000);
        isEstimatedBac = true;
        bacSource = 'actual_fallback';
      }
    }
  } else {
    if (project.budgetHours && project.budgetHours > 0) {
      bac = project.budgetHours;
      isEstimatedBac = false;
      bacSource = 'explicit';
    } else if (sumAsmHours > 0) {
      bac = sumAsmHours;
      isEstimatedBac = false;
      bacSource = 'explicit';
    } else if (project.budgetCost && project.budgetCost > 0) {
      bac = Math.max(10, Math.round(project.budgetCost / DEFAULT_HOURLY_BUDGET_FACTOR));
      isEstimatedBac = true;
      bacSource = 'hours_fallback';
    } else {
      bac = Math.max(100, Math.round(laborHours * 1.25));
      isEstimatedBac = true;
      bacSource = 'actual_fallback';
    }
  }

  const actualPct = calcPct(project);
  const plannedPct = calcProjectPlannedPct(project, evalDate);

  const ac = unitMode === 'cost' ? totalActualCost : Math.round(laborHours * 10) / 10;
  const pv = Math.round((bac * plannedPct) / 100);
  const ev = Math.round((bac * actualPct) / 100);

  const { cv, sv, cpi, spi, eac, etc, vac, tcpi } = computeDerivedEvmsRatios(bac, pv, ev, ac);
  const health = classifyEvmsHealth(cpi, spi, pv, ev, ac);

  const todayStr = evalDate;
  const isOverdue = Boolean(project.due && project.due < todayStr && project.status !== 'completed');

  // Assembly level EVMS breakdown
  const assembliesList = project.assemblies || [];
  const totalTaskWeight = Math.max(
    1,
    assembliesList.reduce(
      (sum, asm) =>
        sum +
        (asm.tasks || []).reduce(
          (tsum, t) => tsum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1),
          0
        ),
      0
    )
  );

  const assemblies: EvmsAssemblyMetrics[] = assembliesList.map((asm) => {
    const asmWeight = Math.max(
      1,
      (asm.tasks || []).reduce(
        (tsum, t) => tsum + (typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1),
        0
      )
    );

    const asmTs = projTs.filter((t) => t.assemblyId === asm.id);
    let asmHours = 0;
    let asmLaborCost = 0;
    asmTs.forEach((t) => {
      asmHours += t.totalHours || 0;
      asmLaborCost += calculateTimesheetEntryCost(t, employees).totalCost;
    });

    const asmWire = projWire.filter((w) => w.assemblyId === asm.id);
    let asmWireCost = 0;
    asmWire.forEach((w) => {
      const kg = w.amountKg || 0;
      const rate = w.unitCost || DEFAULT_WIRE_COST_PER_KG;
      asmWireCost += w.totalCost !== undefined ? w.totalCost : kg * rate;
    });

    const asmCons = projCons.filter((c) => c.assemblyId === asm.id);
    let asmOtherCost = 0;
    asmCons.forEach((c) => {
      const qty = c.qtyUsed || 0;
      const rate = c.unitCost || getConsumableRate(c.materialId, c.materialName, materials);
      asmOtherCost += c.totalCost !== undefined ? c.totalCost : qty * rate;
    });

    const asmConsumableCost = Math.round(asmWireCost + asmOtherCost);
    const asmActualCost = Math.round(asmLaborCost + asmConsumableCost);

    let asmBac = 0;
    let asmEst = false;
    if (unitMode === 'cost') {
      if (asm.budgetCost && asm.budgetCost > 0) {
        asmBac = asm.budgetCost;
      } else if (asm.budgetHours && asm.budgetHours > 0) {
        asmBac = asm.budgetHours * DEFAULT_HOURLY_BUDGET_FACTOR;
        asmEst = true;
      } else {
        asmBac = Math.round((bac * asmWeight) / totalTaskWeight);
        asmEst = true;
      }
    } else {
      if (asm.budgetHours && asm.budgetHours > 0) {
        asmBac = asm.budgetHours;
      } else if (asm.budgetCost && asm.budgetCost > 0) {
        asmBac = Math.max(1, Math.round(asm.budgetCost / DEFAULT_HOURLY_BUDGET_FACTOR));
        asmEst = true;
      } else {
        asmBac = Math.max(1, Math.round((bac * asmWeight) / totalTaskWeight));
        asmEst = true;
      }
    }

    const asmActualPct = calcAssemblyActualPct(asm);
    const asmPlannedPct = calcAssemblyPlannedPct(asm, project, evalDate);
    const asmAc = unitMode === 'cost' ? asmActualCost : Math.round(asmHours * 10) / 10;
    const asmPv = Math.round((asmBac * asmPlannedPct) / 100);
    const asmEv = Math.round((asmBac * asmActualPct) / 100);
    const asmDerived = computeDerivedEvmsRatios(asmBac, asmPv, asmEv, asmAc);
    const asmHealth = classifyEvmsHealth(asmDerived.cpi, asmDerived.spi, asmPv, asmEv, asmAc);

    return {
      assemblyId: asm.id,
      assemblyName: asm.name,
      bac: asmBac,
      isEstimatedBac: asmEst,
      pv: asmPv,
      ev: asmEv,
      ac: asmAc,
      cv: asmDerived.cv,
      sv: asmDerived.sv,
      cpi: asmDerived.cpi,
      spi: asmDerived.spi,
      eac: asmDerived.eac,
      vac: asmDerived.vac,
      actualPct: asmActualPct,
      plannedPct: asmPlannedPct,
      laborHours: Math.round(asmHours * 10) / 10,
      laborCost: Math.round(asmLaborCost),
      consumableCost: asmConsumableCost,
      healthStatus: asmHealth.status,
      healthLabel: asmHealth.label,
    };
  });

  return {
    projectId: project.id,
    projectName: project.name,
    client: project.client || '—',
    location: project.location || 'workshop1',
    status: project.status,
    due: project.due || '',
    isOverdue,
    bac,
    isEstimatedBac,
    bacSource,
    pv,
    ev,
    ac,
    cv,
    sv,
    cpi,
    spi,
    eac,
    etc,
    vac,
    tcpi,
    actualPct,
    plannedPct,
    laborHours: Math.round(laborHours * 10) / 10,
    laborCost: Math.round(laborCost),
    wireCost: Math.round(wireCost),
    otherConsumableCost: Math.round(otherConsumableCost),
    totalActualCost,
    explicitBudgetCost: project.budgetCost,
    explicitBudgetHours: project.budgetHours,
    healthStatus: health.status,
    healthLabel: health.label,
    assemblies,
  };
}

export function calculatePortfolioEvms(
  projects: Project[],
  options: CalculateEvmsOptions = {}
): EvmsPortfolioSummary {
  const {
    unitMode = 'cost',
    selectedMonth: rawMonth,
    evalDate: rawEvalDate,
    timesheets = [],
    wireLogs = [],
    consumptionLogs = [],
    employees = [],
    materials = [],
    bomTemplates = [],
  } = options;

  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const cleanYM = (rawMonth || rawEvalDate?.slice(0, 7) || currentYM).trim().slice(0, 7);
  const [yStr, mStr] = cleanYM.split('-');
  const year = parseInt(yStr, 10) || today.getFullYear();
  const month = parseInt(mStr, 10) || today.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  let evalDayNum = daysInMonth;
  let isCurrentSelectedMonth = false;
  if (cleanYM === currentYM) {
    evalDayNum = Math.min(today.getDate(), daysInMonth);
    isCurrentSelectedMonth = true;
  } else if (cleanYM > currentYM) {
    evalDayNum = 0;
  } else {
    evalDayNum = daysInMonth;
  }

  // If explicit evalDate inside cleanYM is supplied, clamp evalDayNum to it
  let evalDate = rawEvalDate ? rawEvalDate.slice(0, 10) : '';
  if (evalDate && evalDate.slice(0, 7) === cleanYM) {
    const dayPart = parseInt(evalDate.slice(8, 10), 10);
    if (!isNaN(dayPart) && dayPart >= 1 && dayPart <= daysInMonth) {
      evalDayNum = dayPart;
    }
  } else {
    const safeDay = Math.max(1, evalDayNum || 1);
    evalDate = `${cleanYM}-${String(safeDay).padStart(2, '0')}`;
  }

  const scopedProjects = projects.filter((p) => !p.isArchived);

  const projectMetrics = scopedProjects.map((p) =>
    calculateProjectEvms(p, {
      unitMode,
      evalDate,
      timesheets,
      wireLogs,
      consumptionLogs,
      employees,
      materials,
      bomTemplates,
    })
  );

  let totalBac = 0;
  let totalPv = 0;
  let totalEv = 0;
  let totalAc = 0;
  let activeCount = 0;
  let completedCount = 0;
  let estimatedBacCount = 0;

  const healthCounts = {
    optimal: 0,
    efficient_behind: 0,
    overbudget_ahead: 0,
    critical: 0,
    unstarted: 0,
  };

  projectMetrics.forEach((pm) => {
    totalBac += pm.bac;
    totalPv += pm.pv;
    totalEv += pm.ev;
    totalAc += pm.ac;
    if (pm.status === 'active') activeCount++;
    if (pm.status === 'completed') completedCount++;
    if (pm.isEstimatedBac) estimatedBacCount++;
    healthCounts[pm.healthStatus]++;
  });

  totalAc = Math.round(totalAc * 10) / 10;
  const derived = computeDerivedEvmsRatios(totalBac, totalPv, totalEv, totalAc);
  const overallHealth = classifyEvmsHealth(derived.cpi, derived.spi, totalPv, totalEv, totalAc);

  const overallActualPct = totalBac > 0 ? Math.round((totalEv / totalBac) * 1000) / 10 : 0;
  const overallPlannedPct = totalBac > 0 ? Math.round((totalPv / totalBac) * 1000) / 10 : 0;

  // Build Daily EVMS S-Curve across daysInMonth
  // Pre-index project transactions by date for fast cumulative AC
  const txByDate = new Map<string, number>();
  let preMonthAc = 0;
  const monthStartStr = `${cleanYM}-01`;

  scopedProjects.forEach((proj) => {
    const pTs = timesheets.filter((t) => isTimesheetForProject(t, proj));
    pTs.forEach((ts) => {
      const val =
        unitMode === 'cost'
          ? calculateTimesheetEntryCost(ts, employees).totalCost
          : ts.totalHours || 0;
      const dStr = getRecordDateStr(ts.date);
      if (!dStr || dStr < monthStartStr) {
        preMonthAc += val;
      } else if (dStr <= evalDate) {
        txByDate.set(dStr, (txByDate.get(dStr) || 0) + val);
      }
    });

    if (unitMode === 'cost') {
      const pWire = wireLogs.filter((w) => isWireLogForProject(w, proj));
      pWire.forEach((wl) => {
        const kg = wl.amountKg || 0;
        const rate = wl.unitCost || DEFAULT_WIRE_COST_PER_KG;
        const val = wl.totalCost !== undefined ? wl.totalCost : kg * rate;
        const dStr = getRecordDateStr(wl.date);
        if (!dStr || dStr < monthStartStr) {
          preMonthAc += val;
        } else if (dStr <= evalDate) {
          txByDate.set(dStr, (txByDate.get(dStr) || 0) + val);
        }
      });

      const pCons = consumptionLogs.filter((c) => isConsumptionLogForProject(c, proj));
      pCons.forEach((cl) => {
        const qty = cl.qtyUsed || 0;
        const rate = cl.unitCost || getConsumableRate(cl.materialId, cl.materialName, materials);
        const val = cl.totalCost !== undefined ? cl.totalCost : qty * rate;
        const dStr = getRecordDateStr(cl.date);
        if (!dStr || dStr < monthStartStr) {
          preMonthAc += val;
        } else if (dStr <= evalDate) {
          txByDate.set(dStr, (txByDate.get(dStr) || 0) + val);
        }
      });
    }
  });

  // Compute daily PV and daily AC up to evalDayNum, plus progressive EV trajectory
  const scurveSeries: EvmsSCurvePoint[] = [];
  let runningAc = preMonthAc;

  // Build daily activity weights for EV curve so earned progress follows realistic work cadence
  const dailyActivityWeights: number[] = [];
  let sumActivityWeight = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${cleanYM}-${String(d).padStart(2, '0')}`;
    if (d <= evalDayNum) {
      const txVal = txByDate.get(dateStr) || 0;
      const w = txVal > 0 ? txVal : 1; // Minimum baseline progression weight
      dailyActivityWeights.push(w);
      sumActivityWeight += w;
    } else {
      dailyActivityWeights.push(0);
    }
  }

  let runningActivityWeight = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${cleanYM}-${String(d).padStart(2, '0')}`;

    // PV(d) = sum over projects of BAC_p * plannedPct_p(dateStr) / 100
    let dayPv = 0;
    scopedProjects.forEach((proj, idx) => {
      const bac = projectMetrics[idx].bac;
      const pPct = calcProjectPlannedPct(proj, dateStr);
      dayPv += (bac * pPct) / 100;
    });
    const roundedPv = Math.round(dayPv);

    if (evalDayNum > 0 && d <= evalDayNum) {
      runningAc += txByDate.get(dateStr) || 0;
      const roundedAc = unitMode === 'cost' ? Math.round(runningAc) : Math.round(runningAc * 10) / 10;

      runningActivityWeight += dailyActivityWeights[d - 1];
      let dayEv = 0;
      if (d === evalDayNum) {
        dayEv = totalEv;
      } else if (sumActivityWeight > 0) {
        dayEv = Math.round((totalEv * runningActivityWeight) / sumActivityWeight);
      }

      const dayDerived = computeDerivedEvmsRatios(totalBac, roundedPv, dayEv, roundedAc);

      scurveSeries.push({
        day: `${d}`,
        dayNum: d,
        dateStr,
        pv: roundedPv,
        ev: dayEv,
        ac: roundedAc,
        cv: dayDerived.cv,
        sv: dayDerived.sv,
        cpi: dayDerived.cpi,
        spi: dayDerived.spi,
      });
    } else {
      scurveSeries.push({
        day: `${d}`,
        dayNum: d,
        dateStr,
        pv: roundedPv,
        ev: null,
        ac: null,
        cv: null,
        sv: null,
        cpi: null,
        spi: null,
      });
    }
  }

  return {
    unitMode,
    evalDate,
    selectedMonth: cleanYM,
    evalDayNum,
    daysInMonth,
    isCurrentSelectedMonth,
    projectCount: projectMetrics.length,
    activeCount,
    completedCount,
    estimatedBacCount,
    totalBac,
    totalPv,
    totalEv,
    totalAc,
    cv: derived.cv,
    sv: derived.sv,
    cpi: derived.cpi,
    spi: derived.spi,
    eac: derived.eac,
    etc: derived.etc,
    vac: derived.vac,
    tcpi: derived.tcpi,
    overallActualPct,
    overallPlannedPct,
    healthStatus: overallHealth.status,
    healthLabel: overallHealth.label,
    healthCounts,
    projects: projectMetrics,
    scurveSeries,
  };
}
