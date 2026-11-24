import {
  Employee,
  MaterialCategory,
  MaterialItem,
  MaterialRequest,
  MaterialRequestUrgency,
  MaterialUnit,
  Project,
  User,
} from '../types';

export type QuickOrderFilter = 'all' | 'consumable' | 'material' | 'low_stock';

export interface QuickOrderCatalogItem {
  id: string;
  name: string;
  partNumber?: string;
  category: MaterialCategory | string;
  group: 'consumable' | 'material';
  unit: MaterialUnit;
  currentStock: number;
  minStock: number;
  location?: string;
  notes?: string;
  isWire: boolean;
  isOutOfStock: boolean;
  isLowStock: boolean;
  isProjectItem?: boolean;
  projectId?: string;
  assemblyId?: string;
}

export interface QuickOrderCartLine {
  id: string;
  name: string;
  partNumber?: string;
  category: string;
  group: 'consumable' | 'material';
  unit: MaterialUnit;
  qty: number;
  currentStock: number;
  minStock: number;
  isWire: boolean;
  isCustom?: boolean;
}

export interface QuickOrderPrefillItem {
  materialId: string;
  qty?: number;
}

const CONSUMABLE_CATEGORIES = new Set<string>([
  'Welding Consumable',
  'PPE',
  'Wire',
  'Tools & Equipment',
  'Paint & Chemical',
]);

export function isConsumableCategory(category?: string): boolean {
  if (!category) return false;
  return CONSUMABLE_CATEGORIES.has(category);
}

export function buildQuickOrderCatalog(
  materials: MaterialItem[],
  projects: Project[] = [],
  selectedProjectId?: string
): QuickOrderCatalogItem[] {
  const catalog: QuickOrderCatalogItem[] = materials.map((mat) => {
    const isWire = mat.category === 'Wire' || mat.id === 'wire';
    const isOutOfStock = mat.currentStock <= 0;
    const isLowStock = mat.currentStock > 0 && mat.minStock > 0 && mat.currentStock < mat.minStock;
    return {
      id: mat.id,
      name: mat.name,
      partNumber: mat.partNumber,
      category: mat.category,
      group: isConsumableCategory(mat.category) ? 'consumable' : 'material',
      unit: mat.unit,
      currentStock: mat.currentStock,
      minStock: mat.minStock,
      location: mat.location,
      notes: mat.notes,
      isWire,
      isOutOfStock,
      isLowStock,
      projectId: mat.projectId,
    };
  });

  // Ensure standard Welding Wire is always available in Quick Order even if not explicitly listed in stock
  const hasWire = catalog.some((item) => item.isWire || item.id === 'wire');
  if (!hasWire) {
    catalog.unshift({
      id: 'wire',
      name: 'Welding Wire AWS A5.18 ER70S-6',
      category: 'Wire',
      group: 'consumable',
      unit: 'kg',
      currentStock: 0,
      minStock: 0,
      location: 'Gudang Consumable',
      isWire: true,
      isOutOfStock: false,
      isLowStock: false,
    });
  }

  // Optionally include project material processing items when a project is chosen
  if (selectedProjectId) {
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj?.materialProcessing?.length) {
      proj.materialProcessing.forEach((mp) => {
        catalog.push({
          id: `mp_${mp.id}`,
          name: mp.materialName,
          category: 'Material Proyek (BOM)',
          group: 'material',
          unit: (mp.unit as MaterialUnit) || 'pcs',
          currentStock: mp.qty || 1,
          minStock: 0,
          location: proj.name,
          isWire: false,
          isOutOfStock: false,
          isLowStock: false,
          isProjectItem: true,
          projectId: proj.id,
          assemblyId: mp.assemblyId,
        });
      });
    }
  }

  return catalog;
}

export function filterQuickOrderCatalog(
  catalog: QuickOrderCatalogItem[],
  options: { query?: string; filter?: QuickOrderFilter }
): QuickOrderCatalogItem[] {
  const q = (options.query || '').trim().toLowerCase();
  const filter = options.filter || 'all';

  const filtered = catalog.filter((item) => {
    if (filter === 'consumable' && item.group !== 'consumable') return false;
    if (filter === 'material' && item.group !== 'material') return false;
    if (filter === 'low_stock' && !item.isOutOfStock && !item.isLowStock) return false;

    if (!q) return true;
    const haystack = [
      item.name,
      item.partNumber || '',
      item.category,
      item.location || '',
      item.notes || '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  if (filter === 'low_stock') {
    return [...filtered].sort((a, b) => {
      if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
      return a.currentStock - b.currentStock;
    });
  }

  return filtered;
}

export function buildLowStockRestockCart(materials: MaterialItem[]): QuickOrderCartLine[] {
  return materials
    .filter((m) => m.currentStock <= 0 || (m.minStock > 0 && m.currentStock < m.minStock))
    .map((m) => {
      const target = m.minStock > 0 ? m.minStock * 2 : 5;
      const suggestedQty = Math.max(1, target - Math.max(0, m.currentStock));
      const isWire = m.category === 'Wire' || m.id === 'wire';
      return {
        id: m.id,
        name: m.name,
        partNumber: m.partNumber,
        category: m.category,
        group: isConsumableCategory(m.category) ? 'consumable' : 'material',
        unit: m.unit,
        qty: suggestedQty,
        currentStock: m.currentStock,
        minStock: m.minStock,
        isWire,
      };
    });
}

export function buildQuickOrderPayload(params: {
  cart: QuickOrderCartLine[];
  project?: Project | null;
  assemblyId?: string;
  employee?: Employee | null;
  currentUser: User;
  urgency: MaterialRequestUrgency;
  notes?: string;
  requestedDate?: string;
}): Omit<MaterialRequest, 'id' | 'mrNo'> {
  const {
    cart,
    project,
    assemblyId,
    employee,
    currentUser,
    urgency,
    notes,
    requestedDate,
  } = params;

  const assembly =
    project && assemblyId
      ? project.assemblies?.find((a) => a.id === assemblyId)
      : undefined;

  const dateStr = requestedDate || new Date().toISOString().slice(0, 10);

  return {
    projectId: project?.id || '',
    projectName: project?.name || 'Stok Umum Workshop',
    ...(assembly
      ? {
          assemblyId: assembly.id,
          assemblyName: assembly.name,
        }
      : {}),
    urgency,
    status: 'Submitted',
    items: cart.map((line) => ({
      materialId: line.id,
      materialName: line.name,
      unit: line.unit,
      qtyRequested: Math.max(0.1, Number(line.qty) || 1),
      ...(line.isWire
        ? {
            isWire: true,
            amountKg: Math.max(0.1, Number(line.qty) || 1),
          }
        : {}),
    })),
    requestedBy: currentUser.name,
    requestedById: currentUser.id,
    requestedDate: dateStr,
    forEmployeeId: employee?.id || currentUser.id,
    forEmployeeName: employee?.name || currentUser.name,
    ...(employee?.position ? { forEmployeePosition: employee.position } : {}),
    ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
  };
}
