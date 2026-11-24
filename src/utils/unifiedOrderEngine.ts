import {
  BomTemplate,
  MaterialCategory,
  MaterialItem,
  MaterialRequest,
  MaterialUnit,
  Project,
} from '../types';
import { getConsumableRate, DEFAULT_WIRE_COST_PER_KG } from './costEngine';
import { findMatchingBomTemplate } from './bacEstimator';

export type UnifiedCatalogCategory =
  | 'all'
  | 'critical'
  | 'project_material'
  | 'wire'
  | 'welding_consumable'
  | 'ppe'
  | 'paint_chemical'
  | 'tools_other';

export type CatalogItemSource = 'warehouse' | 'project_processing' | 'virtual_wire';

export type StockStatus = 'out' | 'low' | 'ok' | 'project_part';

export interface UnifiedCatalogItem {
  id: string;
  source: CatalogItemSource;
  name: string;
  partNumber?: string;
  category: MaterialCategory | 'Project Material';
  categoryGroup: Exclude<UnifiedCatalogCategory, 'all' | 'critical'>;
  categoryLabel: string;
  unit: MaterialUnit;
  currentStock: number;
  minStock: number;
  unitCost: number;
  location?: string;
  projectId?: string;
  projectName?: string;
  isWire: boolean;
  stockStatus: StockStatus;
  notes?: string;
}

export interface UnifiedCartLine {
  materialId: string;
  materialName: string;
  partNumber?: string;
  unit: MaterialUnit;
  qty: number;
  isWire: boolean;
  unitCost: number;
  currentStock: number;
  minStock: number;
  category: MaterialCategory | 'Project Material';
  source: CatalogItemSource;
}

export type OrderExecutionMode = 'request_mr' | 'direct_checkout';

export type QuickPresetKey = 'welder_shift' | 'fitter_shift' | 'painting_prep';

export interface CartValidationIssue {
  materialId: string;
  materialName: string;
  reason: string;
  availableStock: number;
  requestedQty: number;
}

export interface CartValidationResult {
  valid: boolean;
  issues: CartValidationIssue[];
}

export interface CartSummary {
  totalLines: number;
  totalQty: number;
  estimatedCostIdr: number;
  wireCount: number;
  projectMaterialCount: number;
  consumableCount: number;
}

export interface ProjectNeedSuggestion {
  catalogItem: UnifiedCatalogItem;
  suggestedQty: number;
  reason: string;
  sourceType: 'material_processing' | 'bom';
  matchedInWarehouse: boolean;
}

const VALID_MATERIAL_UNITS = new Set<MaterialUnit>([
  'kg',
  'pcs',
  'roll',
  'liter',
  'meter',
  'box',
  'set',
]);

function normalizeUnit(unit?: string): MaterialUnit {
  const clean = (unit || 'pcs').trim().toLowerCase();
  if (VALID_MATERIAL_UNITS.has(clean as MaterialUnit)) {
    return clean as MaterialUnit;
  }
  if (clean === 'm') return 'meter';
  if (clean === 'lt' || clean === 'l') return 'liter';
  if (clean === 'ea' || clean === 'unit' || clean === 'sheet' || clean === 'batang') return 'pcs';
  return 'pcs';
}

function mapCategoryToGroup(
  category: MaterialCategory
): {
  group: Exclude<UnifiedCatalogCategory, 'all' | 'critical'>;
  label: string;
} {
  switch (category) {
    case 'Wire':
      return { group: 'wire', label: 'Kawat Las' };
    case 'Welding Consumable':
      return { group: 'welding_consumable', label: 'Consumable Las' };
    case 'PPE':
      return { group: 'ppe', label: 'PPE / Safety' };
    case 'Paint & Chemical':
      return { group: 'paint_chemical', label: 'Cat & Kimia' };
    case 'Tools & Equipment':
      return { group: 'tools_other', label: 'Tools & Equipment' };
    case 'Other':
    default:
      if ((category as string) === 'Raw Material') {
        return { group: 'project_material', label: 'Material Gudang' };
      }
      return { group: 'tools_other', label: 'Lainnya' };
  }
}

export function createVirtualWireItem(): UnifiedCatalogItem {
  return {
    id: 'wire',
    source: 'virtual_wire',
    name: 'Welding Wire AWS A5.18 ER70S-6',
    partNumber: 'WIRE-STD-1.2',
    category: 'Wire',
    categoryGroup: 'wire',
    categoryLabel: 'Kawat Las',
    unit: 'kg',
    currentStock: 1000,
    minStock: 20,
    unitCost: DEFAULT_WIRE_COST_PER_KG,
    location: 'Workshop Wire Rack',
    isWire: true,
    stockStatus: 'ok',
    notes: 'Standar kawat las workshop',
  };
}

/**
 * Normalizes warehouse Materials, optional virtual Wire fallback, and selected Project's MaterialProcessing items
 * into a single searchable catalog.
 */
export function buildUnifiedCatalog(
  materials: MaterialItem[] = [],
  selectedProject?: Project | null,
  includeVirtualWireFallback = true
): UnifiedCatalogItem[] {
  const catalog: UnifiedCatalogItem[] = [];
  let hasWireItem = false;

  for (const mat of materials) {
    const isWire =
      mat.category === 'Wire' ||
      mat.id === 'wire' ||
      mat.name.toLowerCase().includes('wire') ||
      mat.name.toLowerCase().includes('kawat las');
    if (mat.category === 'Wire' || mat.id === 'wire') {
      hasWireItem = true;
    }

    const { group, label } = mapCategoryToGroup(mat.category);
    const stockStatus: StockStatus =
      mat.currentStock <= 0
        ? 'out'
        : mat.currentStock <= mat.minStock
        ? 'low'
        : 'ok';

    const resolvedUnitCost =
      typeof mat.unitCost === 'number' && mat.unitCost > 0
        ? mat.unitCost
        : getConsumableRate(mat.id, mat.name, materials);

    catalog.push({
      id: mat.id,
      source: 'warehouse',
      name: mat.name,
      partNumber: mat.partNumber,
      category: mat.category,
      categoryGroup: group,
      categoryLabel: label,
      unit: mat.unit,
      currentStock: mat.currentStock,
      minStock: mat.minStock,
      unitCost: resolvedUnitCost,
      location: mat.location,
      projectId: mat.projectId,
      projectName: mat.projectName,
      isWire,
      stockStatus,
      notes: mat.notes,
    });
  }

  if (includeVirtualWireFallback && !hasWireItem) {
    catalog.unshift(createVirtualWireItem());
  }

  if (selectedProject?.materialProcessing && selectedProject.materialProcessing.length > 0) {
    for (const mp of selectedProject.materialProcessing) {
      catalog.push({
        id: `mp_${mp.id}`,
        source: 'project_processing',
        name: mp.materialName || mp.description || 'Project Material Part',
        partNumber: mp.partNo,
        category: 'Project Material',
        categoryGroup: 'project_material',
        categoryLabel: 'Part Proyek',
        unit: normalizeUnit(mp.unit),
        currentStock: 0,
        minStock: 0,
        unitCost: getConsumableRate(undefined, mp.materialName || mp.material, materials),
        location: selectedProject.location || 'Workshop',
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        isWire: false,
        stockStatus: 'project_part',
        notes: [mp.dimensions, mp.grade].filter(Boolean).join(' • ') || undefined,
      });
    }
  }

  // Sort: out/low critical warehouse items first? Better: keep warehouse sorted by critical then name, then project parts
  return catalog;
}

export function filterUnifiedCatalog(
  catalog: UnifiedCatalogItem[],
  query: string,
  categoryFilter: UnifiedCatalogCategory
): UnifiedCatalogItem[] {
  const q = query.trim().toLowerCase();

  return catalog.filter((item) => {
    if (categoryFilter === 'critical') {
      if (item.source !== 'warehouse') return false;
      if (item.stockStatus !== 'out' && item.stockStatus !== 'low') return false;
    } else if (categoryFilter !== 'all') {
      if (item.categoryGroup !== categoryFilter) return false;
    }

    if (!q) return true;

    const haystack = [
      item.name,
      item.partNumber || '',
      item.categoryLabel,
      item.location || '',
      item.projectName || '',
      item.notes || '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function catalogItemToCartLine(
  item: UnifiedCatalogItem,
  qty = 1
): UnifiedCartLine {
  return {
    materialId: item.id,
    materialName: item.name,
    partNumber: item.partNumber,
    unit: item.unit,
    qty: Math.max(1, qty),
    isWire: item.isWire,
    unitCost: item.unitCost,
    currentStock: item.currentStock,
    minStock: item.minStock,
    category: item.category,
    source: item.source,
  };
}

/**
 * Generates suggested restock quantities for all warehouse items whose currentStock <= minStock.
 */
export function buildCriticalRestockLines(
  materials: MaterialItem[] = []
): UnifiedCartLine[] {
  const catalog = buildUnifiedCatalog(materials, null, false);
  return catalog
    .filter((item) => item.source === 'warehouse' && (item.stockStatus === 'out' || item.stockStatus === 'low'))
    .map((item) => {
      const targetStock = item.minStock > 0 ? Math.ceil(item.minStock * 2) : 5;
      const suggestedQty = Math.max(1, targetStock - Math.max(0, item.currentStock));
      return catalogItemToCartLine(item, suggestedQty);
    });
}

function getPendingMrQuantityMap(
  materialRequests: MaterialRequest[] = [],
  projectId?: string
): { byId: Map<string, number>; byName: Map<string, number> } {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  for (const mr of materialRequests) {
    if (mr.status === 'Rejected' || mr.status === 'Issued') continue;
    if (projectId && mr.projectId !== projectId) continue;

    for (const line of mr.items) {
      byId.set(line.materialId, (byId.get(line.materialId) || 0) + line.qtyRequested);
      const normName = line.materialName.trim().toLowerCase();
      byName.set(normName, (byName.get(normName) || 0) + line.qtyRequested);
    }
  }

  return { byId, byName };
}

/**
 * Extracts needed materials for a Project from both its MaterialProcessing list and matched BOM template,
 * deducting any already-submitted/approved MR quantities.
 */
export function buildProjectNeedsSuggestions(
  project: Project | null | undefined,
  bomTemplates: BomTemplate[] = [],
  materials: MaterialItem[] = [],
  materialRequests: MaterialRequest[] = []
): ProjectNeedSuggestion[] {
  if (!project) return [];

  const suggestions: ProjectNeedSuggestion[] = [];
  const seenKeys = new Set<string>();
  const warehouseCatalog = buildUnifiedCatalog(materials, project, true);
  const { byId, byName } = getPendingMrQuantityMap(materialRequests, project.id);

  // 1. Project Material Processing parts not yet fully requested
  for (const mp of project.materialProcessing || []) {
    const mpCatalogId = `mp_${mp.id}`;
    const mpItem = warehouseCatalog.find((c) => c.id === mpCatalogId);
    if (!mpItem) continue;

    const alreadyRequested = byId.get(mpCatalogId) || 0;
    const needed = Math.max(0, Math.ceil((mp.qty || 1) - alreadyRequested));
    if (needed <= 0) continue;

    seenKeys.add(mpItem.name.trim().toLowerCase());
    suggestions.push({
      catalogItem: mpItem,
      suggestedQty: needed,
      reason: `Material Processing (${mp.partNo || mp.thickness || mp.material || 'Part Proyek'})`,
      sourceType: 'material_processing',
      matchedInWarehouse: false,
    });
  }

  // 2. Matched BOM Template items (matched against warehouse materials first, or synthesized as project item)
  const { bom } = findMatchingBomTemplate(project, bomTemplates);
  if (bom && bom.items.length > 0) {
    const multiplier = project.bomMultiplier && project.bomMultiplier > 0 ? project.bomMultiplier : 1;

    for (const bomItem of bom.items) {
      const descLower = (bomItem.description || '').trim().toLowerCase();
      const partLower = (bomItem.partNumber || '').trim().toLowerCase();
      const matLower = (bomItem.material || '').trim().toLowerCase();

      if (descLower && seenKeys.has(descLower)) continue;

      const matchedWarehouse = warehouseCatalog.find((c) => {
        if (c.source === 'project_processing') return false;
        const cName = c.name.toLowerCase();
        const cPart = (c.partNumber || '').toLowerCase();
        if (partLower && cPart && cPart === partLower) return true;
        if (descLower && (cName.includes(descLower) || descLower.includes(cName))) return true;
        if (bomItem.category === 'welding_consumable' && c.isWire && (matLower.includes('wire') || descLower.includes('wire'))) {
          return true;
        }
        return false;
      });

      const targetQty = Math.max(1, Math.ceil((bomItem.quantity || 1) * multiplier));
      const pendingQty = matchedWarehouse
        ? (byId.get(matchedWarehouse.id) || byName.get(matchedWarehouse.name.toLowerCase()) || 0)
        : (byName.get(descLower) || 0);

      const remainingNeed = Math.max(0, targetQty - pendingQty);
      if (remainingNeed <= 0) continue;

      if (matchedWarehouse) {
        // Prioritize items where stock is below needed quantity or consumable/wire
        seenKeys.add(matchedWarehouse.name.trim().toLowerCase());
        suggestions.push({
          catalogItem: matchedWarehouse,
          suggestedQty: remainingNeed,
          reason: `BOM ${bom.name} • Stok ${matchedWarehouse.currentStock} ${matchedWarehouse.unit}`,
          sourceType: 'bom',
          matchedInWarehouse: true,
        });
      }
    }
  }

  return suggestions;
}

interface PresetRule {
  keywords: string[];
  categories?: MaterialCategory[];
  qty: number;
  allowVirtualWire?: boolean;
}

const PRESET_RULES: Record<QuickPresetKey, PresetRule[]> = {
  welder_shift: [
    { keywords: ['wire', 'kawat', 'er70s'], categories: ['Wire'], qty: 15, allowVirtualWire: true },
    { keywords: ['gerinda', 'grinding', 'batu', 'disc'], categories: ['Welding Consumable'], qty: 4 },
    { keywords: ['nozzle', 'contact tip', 'tip', 'gas'], categories: ['Welding Consumable'], qty: 2 },
    { keywords: ['sarung', 'glove', 'welding'], categories: ['PPE'], qty: 1 },
  ],
  fitter_shift: [
    { keywords: ['cutting', 'potong', 'disc', 'gerinda'], categories: ['Welding Consumable'], qty: 5 },
    { keywords: ['kacamata', 'glasses', 'safety'], categories: ['PPE'], qty: 1 },
    { keywords: ['sarung', 'glove'], categories: ['PPE'], qty: 1 },
  ],
  painting_prep: [
    { keywords: ['cat', 'paint', 'primer', 'epoxy'], categories: ['Paint & Chemical'], qty: 5 },
    { keywords: ['thinner', 'solvent'], categories: ['Paint & Chemical'], qty: 5 },
    { keywords: ['kuas', 'roller', 'amplas', 'brush'], categories: ['Welding Consumable', 'Paint & Chemical', 'Tools & Equipment', 'Other'], qty: 2 },
  ],
};

/**
 * Matches real items from `materials` against workshop shift presets (with virtual wire fallback).
 */
export function buildQuickPresetLines(
  presetKey: QuickPresetKey,
  materials: MaterialItem[] = []
): UnifiedCartLine[] {
  const catalog = buildUnifiedCatalog(materials, null, true);
  const rules = PRESET_RULES[presetKey] || [];
  const addedIds = new Set<string>();
  const lines: UnifiedCartLine[] = [];

  for (const rule of rules) {
    const match = catalog.find((item) => {
      if (addedIds.has(item.id)) return false;
      if (item.source === 'project_processing') return false;
      if (item.source === 'virtual_wire' && !rule.allowVirtualWire) return false;
      if (rule.categories && !rule.categories.includes(item.category as MaterialCategory)) {
        return false;
      }
      const text = `${item.name} ${item.partNumber || ''} ${item.notes || ''}`.toLowerCase();
      return rule.keywords.some((kw) => text.includes(kw));
    });

    if (match) {
      addedIds.add(match.id);
      lines.push(catalogItemToCartLine(match, rule.qty));
    }
  }

  return lines;
}

/**
 * Merges incoming lines into an existing cart without duplicating materialId.
 */
export function mergeCartLines(
  existing: UnifiedCartLine[],
  incoming: UnifiedCartLine[],
  strategy: 'add_qty' | 'ensure_min' = 'add_qty'
): UnifiedCartLine[] {
  const next = existing.map((line) => ({ ...line }));

  for (const inc of incoming) {
    const idx = next.findIndex((l) => l.materialId === inc.materialId);
    if (idx >= 0) {
      if (strategy === 'add_qty') {
        next[idx].qty = Number((next[idx].qty + inc.qty).toFixed(2));
      } else {
        next[idx].qty = Math.max(next[idx].qty, inc.qty);
      }
    } else {
      next.push({ ...inc });
    }
  }

  return next;
}

/**
 * Validates cart items for the chosen execution mode.
 * - `request_mr`: permits 0-stock items (procurement/restock) and project parts (`mp_...`), only requiring qty > 0.
 * - `direct_checkout`: requires sufficient warehouse stock (`currentStock >= qty`) and excludes non-stocked project parts.
 */
export function validateCartForMode(
  cartLines: UnifiedCartLine[],
  mode: OrderExecutionMode,
  materials: MaterialItem[] = []
): CartValidationResult {
  const issues: CartValidationIssue[] = [];

  for (const line of cartLines) {
    if (!line.qty || isNaN(line.qty) || line.qty <= 0) {
      issues.push({
        materialId: line.materialId,
        materialName: line.materialName,
        reason: 'Jumlah order harus lebih dari 0.',
        availableStock: line.currentStock,
        requestedQty: line.qty,
      });
      continue;
    }

    if (mode === 'direct_checkout') {
      if (line.source === 'project_processing' || line.materialId.startsWith('mp_')) {
        issues.push({
          materialId: line.materialId,
          materialName: line.materialName,
          reason: 'Part proyek (non-stok gudang) hanya bisa dipesan lewat Ajukan Order / MR.',
          availableStock: 0,
          requestedQty: line.qty,
        });
        continue;
      }

      if (line.source === 'virtual_wire' || line.materialId === 'wire') {
        continue;
      }

      const liveMat = materials.find((m) => m.id === line.materialId);
      const liveStock = liveMat ? liveMat.currentStock : line.currentStock;
      if (liveStock <= 0) {
        issues.push({
          materialId: line.materialId,
          materialName: line.materialName,
          reason: 'Stok gudang habis (0) — gunakan mode Ajukan Order / MR untuk restock.',
          availableStock: liveStock,
          requestedQty: line.qty,
        });
      } else if (line.qty > liveStock) {
        issues.push({
          materialId: line.materialId,
          materialName: line.materialName,
          reason: `Melebihi stok tersedia (${liveStock} ${line.unit}).`,
          availableStock: liveStock,
          requestedQty: line.qty,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function calculateCartSummary(cartLines: UnifiedCartLine[]): CartSummary {
  let totalQty = 0;
  let estimatedCostIdr = 0;
  let wireCount = 0;
  let projectMaterialCount = 0;
  let consumableCount = 0;

  for (const line of cartLines) {
    const q = Math.max(0, Number(line.qty) || 0);
    totalQty += q;
    estimatedCostIdr += q * (line.unitCost || 0);
    if (line.isWire) {
      wireCount += 1;
    } else if (line.source === 'project_processing' || line.category === 'Project Material') {
      projectMaterialCount += 1;
    } else {
      consumableCount += 1;
    }
  }

  return {
    totalLines: cartLines.length,
    totalQty: Number(totalQty.toFixed(2)),
    estimatedCostIdr: Math.round(estimatedCostIdr),
    wireCount,
    projectMaterialCount,
    consumableCount,
  };
}
