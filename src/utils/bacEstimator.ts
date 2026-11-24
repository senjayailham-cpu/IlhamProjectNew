import { BomItem, BomTemplate, Employee, MaterialItem, Project } from '../types';
import { DEFAULT_POSITION_HOURLY_RATES, DEFAULT_WIRE_COST_PER_KG } from './costEngine';

export const DEFAULT_BOM_MATERIAL_RATES = {
  wearPlatePerKg: 42_000, // Bisalloy / Hardox / Abrasion Resistant
  stainlessPerKg: 68_000, // SS304 / SS316
  carbonSteelPerKg: 18_500, // Mild Steel / A36 / SS400 / Structural
  wirePerKg: DEFAULT_WIRE_COST_PER_KG, // 35.000 Rp/kg
  paintPerUnit: 85_000,
  hardwarePerUnit: 25_000,
  otherPerUnit: 25_000,
};

export const DEFAULT_WORKSHOP_AVG_HOURLY_RATE = 42_500;

export type BomPriceSource = 'bom_explicit' | 'master_material' | 'standard_estimate';

export interface BomCategoryEstimate {
  category: BomItem['category'];
  label: string;
  itemCount: number;
  weightKg: number;
  cost: number;
}

export interface BomItemCostPreview {
  itemId: string;
  partNumber: string;
  description: string;
  material: string;
  quantity: number;
  weightKg: number;
  unitPrice: number;
  pricingBasis: 'kg' | 'unit';
  totalCost: number;
  source: BomPriceSource;
}

export interface BomBacEstimate {
  matchedBom: BomTemplate | null;
  matchReason: 'explicit_id' | 'ga_number' | 'name_match' | 'manual_override' | 'none';
  multiplier: number;
  itemCount: number;
  totalWeightKg: number;
  pricedFromMasterCount: number;
  estimatedMaterialCost: number;
  targetBudgetHours: number;
  avgHourlyRate: number;
  estimatedLaborCost: number;
  recommendedBac: number;
  categoryBreakdown: BomCategoryEstimate[];
  itemPreviews: BomItemCostPreview[];
}

const CATEGORY_LABELS: Record<BomItem['category'], string> = {
  plate: 'Pelat Baja',
  structural: 'Struktural / Profil',
  hardware: 'Hardware & Fastener',
  welding_consumable: 'Kawat Las & Consumable',
  paint: 'Cat & Coating',
  other: 'Lainnya',
};

export function getPortfolioAvgHourlyRate(employees: Employee[] = []): number {
  const activeRates = employees
    .filter((e) => !e.isExEmployee && typeof e.hourlyRate === 'number' && e.hourlyRate > 0)
    .map((e) => e.hourlyRate as number);

  if (activeRates.length > 0) {
    const sum = activeRates.reduce((acc, r) => acc + r, 0);
    return Math.round(sum / activeRates.length);
  }

  const posRates = [
    DEFAULT_POSITION_HOURLY_RATES.welder,
    DEFAULT_POSITION_HOURLY_RATES.fitter,
    DEFAULT_POSITION_HOURLY_RATES.grinder,
    DEFAULT_POSITION_HOURLY_RATES.coordinator,
  ];
  return Math.round(posRates.reduce((a, b) => a + b, 0) / posRates.length) || DEFAULT_WORKSHOP_AVG_HOURLY_RATE;
}

export function findMatchingBomTemplate(
  project: Project,
  bomTemplates: BomTemplate[] = [],
  overrideBomId?: string | null
): { bom: BomTemplate | null; reason: BomBacEstimate['matchReason'] } {
  if (!bomTemplates || bomTemplates.length === 0) {
    return { bom: null, reason: 'none' };
  }

  if (overrideBomId) {
    const found = bomTemplates.find((b) => b.id === overrideBomId);
    if (found) return { bom: found, reason: 'manual_override' };
  }

  if (project.bomTemplateId) {
    const found = bomTemplates.find((b) => b.id === project.bomTemplateId);
    if (found) return { bom: found, reason: 'explicit_id' };
  }

  const nonArchived = bomTemplates.filter((b) => b.status !== 'archived');
  const pool = nonArchived.length > 0 ? nonArchived : bomTemplates;

  const pGa = (project.gaNumber || '').trim().toLowerCase();
  if (pGa) {
    const gaMatches = pool.filter(
      (b) => (b.gaNumber || '').trim().toLowerCase() === pGa
    );
    if (gaMatches.length > 0) {
      const activeMatch = gaMatches.find((b) => b.status === 'active') || gaMatches[0];
      return { bom: activeMatch, reason: 'ga_number' };
    }
  }

  const pName = (project.name || '').trim().toLowerCase();
  if (pName) {
    const nameMatch = pool.find((b) => {
      const bName = (b.name || '').trim().toLowerCase();
      const bTruck = (b.truckModel || '').trim().toLowerCase();
      return (
        (bName && (pName.includes(bName) || bName.includes(pName))) ||
        (bTruck && pName.includes(bTruck))
      );
    });
    if (nameMatch) {
      return { bom: nameMatch, reason: 'name_match' };
    }
  }

  return { bom: null, reason: 'none' };
}

function getStandardRateForBomItem(item: BomItem): { rate: number; basis: 'kg' | 'unit' } {
  const matText = `${item.material || ''} ${item.grade || ''} ${item.description || ''}`.toLowerCase();

  if (item.category === 'welding_consumable' || matText.includes('wire') || matText.includes('kawat')) {
    const hasWeight = Boolean((item.totalWeight && item.totalWeight > 0) || (item.weightPerUnit && item.weightPerUnit > 0));
    return {
      rate: DEFAULT_BOM_MATERIAL_RATES.wirePerKg,
      basis: item.unit === 'kg' || hasWeight ? 'kg' : 'unit',
    };
  }

  if (item.category === 'paint') {
    return { rate: DEFAULT_BOM_MATERIAL_RATES.paintPerUnit, basis: 'unit' };
  }

  if (item.category === 'hardware') {
    return { rate: DEFAULT_BOM_MATERIAL_RATES.hardwarePerUnit, basis: 'unit' };
  }

  if (item.category === 'plate' || item.category === 'structural') {
    const hasWeight =
      item.unit === 'kg' ||
      Boolean((item.totalWeight && item.totalWeight > 0) || (item.weightPerUnit && item.weightPerUnit > 0));

    let ratePerKg = DEFAULT_BOM_MATERIAL_RATES.carbonSteelPerKg;
    if (
      matText.includes('bisalloy') ||
      matText.includes('hardox') ||
      matText.includes('quard') ||
      matText.includes('abra') ||
      matText.includes('wear') ||
      matText.includes('nm400') ||
      matText.includes('nm450') ||
      matText.includes('ar400') ||
      matText.includes('ar450') ||
      matText.includes('ar500')
    ) {
      ratePerKg = DEFAULT_BOM_MATERIAL_RATES.wearPlatePerKg;
    } else if (matText.includes('ss304') || matText.includes('ss316') || matText.includes('stainless') || matText.includes('sus')) {
      ratePerKg = DEFAULT_BOM_MATERIAL_RATES.stainlessPerKg;
    }

    if (hasWeight) {
      return { rate: ratePerKg, basis: 'kg' };
    }
    return { rate: DEFAULT_BOM_MATERIAL_RATES.otherPerUnit, basis: 'unit' };
  }

  const hasWeight = item.unit === 'kg' || Boolean((item.totalWeight && item.totalWeight > 0) || (item.weightPerUnit && item.weightPerUnit > 0));
  return {
    rate: hasWeight ? DEFAULT_BOM_MATERIAL_RATES.carbonSteelPerKg : DEFAULT_BOM_MATERIAL_RATES.otherPerUnit,
    basis: hasWeight ? 'kg' : 'unit',
  };
}

export function matchBomItemPrice(
  item: BomItem,
  materials: MaterialItem[] = []
): { unitPrice: number; basis: 'kg' | 'unit'; source: BomPriceSource } {
  const fallback = getStandardRateForBomItem(item);

  if (typeof item.unitCost === 'number' && item.unitCost > 0) {
    return {
      unitPrice: item.unitCost,
      basis: fallback.basis,
      source: 'bom_explicit',
    };
  }

  const itemPart = (item.partNumber || '').trim().toLowerCase();
  const itemMat = (item.material || '').trim().toLowerCase();
  const itemDesc = (item.description || '').trim().toLowerCase();

  const matchedMat = materials.find((m) => {
    if (!m.unitCost || m.unitCost <= 0) return false;
    const mPart = (m.partNumber || '').trim().toLowerCase();
    const mName = (m.name || '').trim().toLowerCase();
    if (itemPart && mPart && itemPart === mPart) return true;
    if (itemPart && mName && mName.includes(itemPart)) return true;
    if (itemMat && mName && (mName === itemMat || mName.includes(itemMat))) return true;
    if (itemDesc && mName && mName === itemDesc) return true;
    return false;
  });

  if (matchedMat && matchedMat.unitCost) {
    const basis: 'kg' | 'unit' = matchedMat.unit === 'kg' ? 'kg' : fallback.basis;
    return {
      unitPrice: matchedMat.unitCost,
      basis,
      source: 'master_material',
    };
  }

  return {
    unitPrice: fallback.rate,
    basis: fallback.basis,
    source: 'standard_estimate',
  };
}

export function estimateProjectBacFromBom(
  project: Project,
  bomTemplates: BomTemplate[] = [],
  materials: MaterialItem[] = [],
  employees: Employee[] = [],
  overrides?: {
    bomTemplateId?: string | null;
    multiplier?: number;
    hourlyRate?: number;
    budgetHours?: number;
  }
): BomBacEstimate {
  const { bom, reason } = findMatchingBomTemplate(project, bomTemplates, overrides?.bomTemplateId);
  const multiplier =
    overrides?.multiplier && overrides.multiplier > 0
      ? overrides.multiplier
      : project.bomMultiplier && project.bomMultiplier > 0
        ? project.bomMultiplier
        : 1;

  const sumAsmHours = (project.assemblies || []).reduce((acc, a) => acc + (a.budgetHours || 0), 0);
  const targetBudgetHours =
    overrides?.budgetHours !== undefined
      ? Math.max(0, overrides.budgetHours)
      : project.budgetHours && project.budgetHours > 0
        ? project.budgetHours
        : sumAsmHours;

  const avgHourlyRate =
    overrides?.hourlyRate && overrides.hourlyRate > 0
      ? overrides.hourlyRate
      : getPortfolioAvgHourlyRate(employees);

  const estimatedLaborCost = Math.round(targetBudgetHours * avgHourlyRate);

  if (!bom || !bom.items || bom.items.length === 0) {
    return {
      matchedBom: bom,
      matchReason: reason,
      multiplier,
      itemCount: 0,
      totalWeightKg: 0,
      pricedFromMasterCount: 0,
      estimatedMaterialCost: 0,
      targetBudgetHours,
      avgHourlyRate,
      estimatedLaborCost,
      recommendedBac: estimatedLaborCost,
      categoryBreakdown: [],
      itemPreviews: [],
    };
  }

  let totalWeightKg = 0;
  let estimatedMaterialCost = 0;
  let pricedFromMasterCount = 0;

  const catMap = new Map<BomItem['category'], BomCategoryEstimate>();
  const itemPreviews: BomItemCostPreview[] = [];

  bom.items.forEach((item) => {
    const qty = (item.quantity || 0) * multiplier;
    const rawTotalWeight =
      item.totalWeight !== undefined && item.totalWeight > 0
        ? item.totalWeight * multiplier
        : (item.weightPerUnit || 0) * qty;
    const weightKg = item.unit === 'kg' && rawTotalWeight === 0 ? qty : rawTotalWeight;

    const pricing = matchBomItemPrice(item, materials);
    if (pricing.source !== 'standard_estimate') {
      pricedFromMasterCount++;
    }

    const measure = pricing.basis === 'kg' && weightKg > 0 ? weightKg : qty;
    const itemCost = Math.round(measure * pricing.unitPrice);

    totalWeightKg += weightKg;
    estimatedMaterialCost += itemCost;

    const cat = item.category || 'other';
    if (!catMap.has(cat)) {
      catMap.set(cat, {
        category: cat,
        label: CATEGORY_LABELS[cat] || 'Lainnya',
        itemCount: 0,
        weightKg: 0,
        cost: 0,
      });
    }
    const catEntry = catMap.get(cat)!;
    catEntry.itemCount += 1;
    catEntry.weightKg += weightKg;
    catEntry.cost += itemCost;

    itemPreviews.push({
      itemId: item.id,
      partNumber: item.partNumber,
      description: item.description,
      material: item.material,
      quantity: Math.round(qty * 100) / 100,
      weightKg: Math.round(weightKg * 100) / 100,
      unitPrice: pricing.unitPrice,
      pricingBasis: pricing.basis,
      totalCost: itemCost,
      source: pricing.source,
    });
  });

  const categoryBreakdown = Array.from(catMap.values())
    .map((c) => ({ ...c, weightKg: Math.round(c.weightKg * 10) / 10 }))
    .sort((a, b) => b.cost - a.cost);

  const roundedMatCost = Math.round(estimatedMaterialCost);
  const recommendedBac = roundedMatCost + estimatedLaborCost;

  return {
    matchedBom: bom,
    matchReason: reason,
    multiplier,
    itemCount: bom.items.length,
    totalWeightKg: Math.round(totalWeightKg * 10) / 10,
    pricedFromMasterCount,
    estimatedMaterialCost: roundedMatCost,
    targetBudgetHours,
    avgHourlyRate,
    estimatedLaborCost,
    recommendedBac,
    categoryBreakdown,
    itemPreviews,
  };
}
