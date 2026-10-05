import { 
  Project, 
  TimesheetEntry, 
  WireLog, 
  MaterialConsumptionLog, 
  Employee, 
  MaterialItem, 
  ProjectCostSummary, 
  AssemblyCostSummary, 
  LaborPositionCostBreakdown, 
  ConsumableItemCostBreakdown 
} from '../types';

/**
 * Standard Position Hourly Rates (Rp / Jam) for Fabrication & Workshop
 * Used as default fallback when employee does not have a customized rate.
 */
export const DEFAULT_POSITION_HOURLY_RATES: Record<string, number> = {
  welder: 45000,
  fitter: 40000,
  grinder: 30000,
  coordinator: 55000,
  supervisor: 65000,
  operator: 35000,
  helper: 25000,
  default: 35000,
};

export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
export const DEFAULT_WIRE_COST_PER_KG = 35000; // Standar Kawat Las Flux-Cored / Mig Wire (Rp/kg)

/**
 * Default consumable unit costs in IDR
 */
export const DEFAULT_CONSUMABLE_UNIT_COSTS: Record<string, number> = {
  gerinda: 12000, // Batu gerinda cutting/grinding
  cutting: 12000,
  sarung: 15000, // Sarung tangan kulit/las
  glove: 15000,
  kacamata: 25000, // Safety glasses
  shield: 45000, // Face shield
  cat: 85000, // Cat primer per liter
  primer: 85000,
  thinner: 30000, // Thinner per liter
  nozzle: 35000, // Contact tip / nozzle
  tip: 25000,
};

/**
 * Formats a number into Indonesian Rupiah currency string (e.g. "Rp 4.500.000")
 */
export function formatIDR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rp 0';
  const rounded = Math.round(amount);
  return 'Rp ' + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formats a compact currency representation (e.g. "Rp 4.5 jt" or "Rp 500 rb")
 */
export function formatCompactIDR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rp 0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
  }
  return `${sign}Rp ${abs.toFixed(0)}`;
}

/**
 * Resolve hourly rate for an employee
 */
export function getEmployeeRate(
  empId?: string,
  position?: string,
  employees: Employee[] = []
): number {
  if (empId) {
    const emp = employees.find((e) => e.id === empId);
    if (emp && typeof emp.hourlyRate === 'number' && emp.hourlyRate > 0) {
      return emp.hourlyRate;
    }
    if (emp && emp.position && !position) {
      position = emp.position;
    }
  }

  const posKey = (position || '').trim().toLowerCase();
  for (const [key, rate] of Object.entries(DEFAULT_POSITION_HOURLY_RATES)) {
    if (posKey.includes(key)) {
      return rate;
    }
  }

  return DEFAULT_POSITION_HOURLY_RATES.default;
}

/**
 * Resolve unit cost for consumable material
 */
export function getConsumableRate(
  materialId?: string,
  materialName?: string,
  materials: MaterialItem[] = []
): number {
  if (materialId) {
    const mat = materials.find((m) => m.id === materialId);
    if (mat && typeof mat.unitCost === 'number' && mat.unitCost > 0) {
      return mat.unitCost;
    }
    if (mat && mat.name && !materialName) {
      materialName = mat.name;
    }
  }

  const nameKey = (materialName || '').trim().toLowerCase();
  if (nameKey.includes('wire') || nameKey.includes('kawat')) {
    return DEFAULT_WIRE_COST_PER_KG;
  }

  for (const [key, cost] of Object.entries(DEFAULT_CONSUMABLE_UNIT_COSTS)) {
    if (nameKey.includes(key)) {
      return cost;
    }
  }

  return 25000; // Generic fallback
}

/**
 * Calculate cost breakdown for a single timesheet entry
 */
export function calculateTimesheetEntryCost(
  entry: TimesheetEntry,
  employees: Employee[] = []
): {
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
} {
  const totalHours = entry.totalHours || 0;
  const rate = entry.hourlyRate || getEmployeeRate(entry.empId, entry.position, employees);

  // Split into regular (up to 8 hours) and overtime (>8 hours)
  const regularHours = Math.min(totalHours, 8);
  const overtimeHours = Math.max(0, totalHours - 8);

  const regularCost = regularHours * rate;
  const overtimeCost = overtimeHours * rate * DEFAULT_OVERTIME_MULTIPLIER;
  const totalCost = regularCost + overtimeCost;

  return {
    regularHours,
    overtimeHours,
    hourlyRate: rate,
    regularCost,
    overtimeCost,
    totalCost,
  };
}

/**
 * Check if a timesheet entry belongs to a specific project
 */
export function isTimesheetForProject(entry: TimesheetEntry, project: Project): boolean {
  if (entry.projectId && entry.projectId === project.id) return true;
  if (!entry.workOrder) return false;
  
  const wo = entry.workOrder.trim().toLowerCase();
  const client = (project.client || '').trim().toLowerCase();
  const name = (project.name || '').trim().toLowerCase();
  const pid = (project.id || '').trim().toLowerCase();

  return wo === client || wo === name || wo === pid || (client.length > 0 && wo.includes(client));
}

/**
 * Check if a wire log belongs to a specific project
 */
export function isWireLogForProject(log: WireLog, project: Project): boolean {
  if (log.projectId && log.projectId === project.id) return true;
  if (log.projectName) {
    const pn = log.projectName.trim().toLowerCase();
    const client = (project.client || '').trim().toLowerCase();
    const name = (project.name || '').trim().toLowerCase();
    return pn === client || pn === name;
  }
  return false;
}

/**
 * Check if a material consumption log belongs to a specific project
 */
export function isConsumptionLogForProject(log: MaterialConsumptionLog, project: Project): boolean {
  if (log.projectId && log.projectId === project.id) return true;
  if (log.projectName) {
    const pn = log.projectName.trim().toLowerCase();
    const client = (project.client || '').trim().toLowerCase();
    const name = (project.name || '').trim().toLowerCase();
    return pn === client || pn === name;
  }
  return false;
}

/**
 * Calculate comprehensive Project Cost Summary
 * Captures Labor Cost, Wire/Consumables Cost, Assembly Breakdowns, Position Breakdown.
 */
export function calculateProjectCostSummary(
  project: Project,
  timesheets: TimesheetEntry[] = [],
  wireLogs: WireLog[] = [],
  consumptionLogs: MaterialConsumptionLog[] = [],
  employees: Employee[] = [],
  materials: MaterialItem[] = []
): ProjectCostSummary {
  // 1. Filter project records
  const projTimesheets = timesheets.filter((t) => isTimesheetForProject(t, project));
  const projWireLogs = wireLogs.filter((w) => isWireLogForProject(w, project));
  const projConsumptionLogs = consumptionLogs.filter((c) => isConsumptionLogForProject(c, project));

  // 2. Calculate Labor Cost & Breakdown by Position
  let totalLaborHours = 0;
  let totalLaborCost = 0;
  const positionMap = new Map<string, { hours: number; cost: number; workerIds: Set<string>; rates: number[] }>();

  projTimesheets.forEach((ts) => {
    const { regularHours, overtimeHours, hourlyRate, totalCost } = calculateTimesheetEntryCost(ts, employees);
    totalLaborHours += ts.totalHours || 0;
    totalLaborCost += totalCost;

    const rawPos = (ts.position || 'Other').trim();
    const posKey = rawPos.charAt(0).toUpperCase() + rawPos.slice(1).toLowerCase();

    if (!positionMap.has(posKey)) {
      positionMap.set(posKey, { hours: 0, cost: 0, workerIds: new Set(), rates: [] });
    }
    const posData = positionMap.get(posKey)!;
    posData.hours += ts.totalHours || 0;
    posData.cost += totalCost;
    if (ts.empId) posData.workerIds.add(ts.empId);
    posData.rates.push(hourlyRate);
  });

  const laborBreakdown: LaborPositionCostBreakdown[] = Array.from(positionMap.entries()).map(([position, data]) => ({
    position,
    hours: data.hours,
    cost: data.cost,
    workerCount: data.workerIds.size || 1,
    avgHourlyRate: data.hours > 0 ? Math.round(data.cost / data.hours) : DEFAULT_POSITION_HOURLY_RATES.default,
  })).sort((a, b) => b.cost - a.cost);

  // 3. Calculate Wire Consumable Cost
  let totalWireKg = 0;
  let totalWireCost = 0;

  projWireLogs.forEach((wl) => {
    const kg = wl.amountKg || 0;
    const rate = wl.unitCost || DEFAULT_WIRE_COST_PER_KG;
    const cost = wl.totalCost !== undefined ? wl.totalCost : kg * rate;
    totalWireKg += kg;
    totalWireCost += cost;
  });

  // 4. Calculate Other Consumables from Consumption Logs
  let otherConsumableCost = 0;
  const consumableItemMap = new Map<string, { name: string; category: string; unit: string; qty: number; cost: number }>();

  // Include Wire in consumable breakdown
  if (totalWireKg > 0) {
    consumableItemMap.set('c_wire_main', {
      name: 'Welding Wire (Flux-Cored / MIG)',
      category: 'Wire',
      unit: 'kg',
      qty: totalWireKg,
      cost: totalWireCost,
    });
  }

  projConsumptionLogs.forEach((cl) => {
    const qty = cl.qtyUsed || 0;
    const unitRate = cl.unitCost || getConsumableRate(cl.materialId, cl.materialName, materials);
    const cost = cl.totalCost !== undefined ? cl.totalCost : qty * unitRate;
    otherConsumableCost += cost;

    const key = cl.materialId || cl.materialName;
    if (!consumableItemMap.has(key)) {
      consumableItemMap.set(key, {
        name: cl.materialName || 'Consumable Item',
        category: cl.category || 'Welding Consumable',
        unit: cl.unit || 'pcs',
        qty: 0,
        cost: 0,
      });
    }
    const item = consumableItemMap.get(key)!;
    item.qty += qty;
    item.cost += cost;
  });

  const consumableBreakdown: ConsumableItemCostBreakdown[] = Array.from(consumableItemMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    category: data.category,
    unit: data.unit,
    qty: data.qty,
    avgUnitCost: data.qty > 0 ? Math.round(data.cost / data.qty) : 0,
    totalCost: data.cost,
  })).sort((a, b) => b.totalCost - a.totalCost);

  const totalConsumableCost = totalWireCost + otherConsumableCost;
  const totalActualCost = totalLaborCost + totalConsumableCost;

  // 5. Calculate Budget Cost (BAC)
  // If explicitly set, use project.budgetCost.
  // Otherwise estimate: (project.budgetHours || sum of assembly budgetHours || 100) * 40000 + (totalWireKg * 35000)
  const explicitBudget = project.budgetCost;
  const estimatedBudgetFromHours = (project.budgetHours || 0) * 40000;
  const budgetCost = explicitBudget && explicitBudget > 0 
    ? explicitBudget 
    : estimatedBudgetFromHours > 0 
      ? estimatedBudgetFromHours 
      : Math.max(10_000_000, Math.round((totalActualCost * 1.25) / 1_000_000) * 1_000_000);

  const varianceCost = budgetCost - totalActualCost;
  const isOverBudget = varianceCost < 0;
  const costBurnPct = budgetCost > 0 ? Math.round((totalActualCost / budgetCost) * 100) : 0;

  // 6. Calculate Assembly Level Breakdowns
  const assemblySummaries: AssemblyCostSummary[] = (project.assemblies || []).map((asm) => {
    // Timesheets for this assembly
    const asmTs = projTimesheets.filter((t) => t.assemblyId === asm.id);
    let asmHours = 0;
    let asmLaborCost = 0;
    asmTs.forEach((t) => {
      const { totalCost } = calculateTimesheetEntryCost(t, employees);
      asmHours += t.totalHours || 0;
      asmLaborCost += totalCost;
    });

    // Wire logs for this assembly
    const asmWire = projWireLogs.filter((w) => w.assemblyId === asm.id);
    let asmWireKg = 0;
    let asmWireCost = 0;
    asmWire.forEach((w) => {
      const kg = w.amountKg || 0;
      const rate = w.unitCost || DEFAULT_WIRE_COST_PER_KG;
      asmWireKg += kg;
      asmWireCost += w.totalCost !== undefined ? w.totalCost : kg * rate;
    });

    // Other consumables for this assembly
    const asmCons = projConsumptionLogs.filter((c) => c.assemblyId === asm.id);
    let asmOtherCost = 0;
    asmCons.forEach((c) => {
      const qty = c.qtyUsed || 0;
      const unitRate = c.unitCost || getConsumableRate(c.materialId, c.materialName, materials);
      asmOtherCost += c.totalCost !== undefined ? c.totalCost : qty * unitRate;
    });

    const asmConsumableCost = asmWireCost + asmOtherCost;
    const asmActualCost = asmLaborCost + asmConsumableCost;

    // Budget for assembly
    const asmBudget = asm.budgetCost && asm.budgetCost > 0 
      ? asm.budgetCost 
      : (asm.budgetHours || 0) * 40000;

    const asmVariance = asmBudget > 0 ? asmBudget - asmActualCost : 0;

    return {
      assemblyId: asm.id,
      assemblyName: asm.name,
      budgetCost: asmBudget,
      laborHours: asmHours,
      laborCost: asmLaborCost,
      wireKg: asmWireKg,
      wireCost: asmWireCost,
      otherConsumableCost: asmOtherCost,
      totalConsumableCost: asmConsumableCost,
      totalActualCost: asmActualCost,
      varianceCost: asmVariance,
      isOverBudget: asmBudget > 0 && asmVariance < 0,
      costBurnPct: asmBudget > 0 ? Math.round((asmActualCost / asmBudget) * 100) : 0,
    };
  });

  return {
    projectId: project.id,
    projectName: project.name,
    client: project.client,
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
  };
}
