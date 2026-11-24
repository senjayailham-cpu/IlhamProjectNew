import { describe, expect, it } from 'vitest';
import {
  buildCriticalRestockLines,
  buildProjectNeedsSuggestions,
  buildQuickPresetLines,
  buildUnifiedCatalog,
  calculateCartSummary,
  filterUnifiedCatalog,
  mergeCartLines,
  validateCartForMode,
} from '../unifiedOrderEngine';
import type { BomTemplate, MaterialItem, MaterialRequest, Project } from '../../types';

const sampleMaterials: MaterialItem[] = [
  {
    id: 'mat_wire',
    name: 'Welding Wire ER70S-6 1.2mm',
    partNumber: 'WR-12',
    category: 'Wire',
    unit: 'kg',
    currentStock: 120,
    minStock: 30,
    unitCost: 35000,
    location: 'Rack A1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'mat_grinda',
    name: 'Batu Gerinda Potong 4 Inch',
    partNumber: 'GC-04',
    category: 'Welding Consumable',
    unit: 'pcs',
    currentStock: 4,
    minStock: 20,
    unitCost: 12000,
    location: 'Rack B2',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'mat_glove',
    name: 'Sarung Tangan Kulit Las',
    partNumber: 'PPE-GLV',
    category: 'PPE',
    unit: 'pcs',
    currentStock: 0,
    minStock: 10,
    unitCost: 18000,
    location: 'Rack C1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'mat_paint',
    name: 'Cat Primer Epoxy Grey',
    partNumber: 'PNT-EPX',
    category: 'Paint & Chemical',
    unit: 'liter',
    currentStock: 40,
    minStock: 10,
    unitCost: 85000,
    location: 'Chem Store',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const sampleProject: Project = {
  id: 'proj_1',
  name: 'Dump Body Komatsu 930E',
  client: 'PT Mining Jaya',
  gaNumber: 'GA-930E',
  status: 'active',
  category: 'Tray',
  location: 'workshop1',
  created: '2026-01-01',
  start: '2026-01-01',
  due: '2026-03-01',
  budgetHours: 1200,
  assemblies: [
    {
      id: 'asm_1',
      name: 'Main Floor Assembly',
      tasks: [],
    },
  ],
  materialProcessing: [
    {
      id: 'mp_1',
      projectId: 'proj_1',
      projectName: 'PT Mining Jaya',
      workOrder: 'PT Mining Jaya',
      materialName: 'Floor Plate Bisalloy 400 12mm',
      partNo: 'AB-FP-001',
      qty: 6,
      unit: 'pcs',
      activeStages: ['nesting', 'cnc'],
      stages: {},
      overallPct: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      createdBy: 'Admin',
      isCompleted: false,
    },
  ],
};

const sampleBoms: BomTemplate[] = [
  {
    id: 'bom_1',
    name: 'Austin Ultima 930E',
    model: 'Ultima',
    gaNumber: 'GA-930E',
    version: 'v1',
    status: 'active',
    createdBy: 'u1',
    createdByName: 'Eng',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    items: [
      {
        id: 'bi_1',
        partNumber: 'WR-12',
        description: 'Welding Wire ER70S-6 1.2mm',
        material: 'ER70S-6',
        quantity: 60,
        unit: 'kg',
        category: 'welding_consumable',
      },
      {
        id: 'bi_2',
        partNumber: 'PNT-EPX',
        description: 'Cat Primer Epoxy Grey',
        material: 'Epoxy',
        quantity: 25,
        unit: 'pcs',
        category: 'paint',
      },
    ],
  },
];

describe('unifiedOrderEngine', () => {
  it('merges warehouse materials and selected project processing parts without duplicating wire', () => {
    const catalog = buildUnifiedCatalog(sampleMaterials, sampleProject);
    expect(catalog).toHaveLength(5); // 4 materials + 1 project part (no virtual wire since Wire exists)
    expect(catalog.some((c) => c.id === 'mp_mp_1' && c.categoryGroup === 'project_material')).toBe(true);
    expect(catalog.some((c) => c.id === 'wire')).toBe(false);

    const criticalOnly = filterUnifiedCatalog(catalog, '', 'critical');
    expect(criticalOnly.map((c) => c.id)).toEqual(['mat_grinda', 'mat_glove']);
  });

  it('builds critical restock quantities to double minStock minus currentStock', () => {
    const lines = buildCriticalRestockLines(sampleMaterials);
    expect(lines).toHaveLength(2);
    const grinda = lines.find((l) => l.materialId === 'mat_grinda');
    const glove = lines.find((l) => l.materialId === 'mat_glove');
    expect(grinda?.qty).toBe(36); // minStock 20 * 2 - 4 = 36
    expect(glove?.qty).toBe(20); // minStock 10 * 2 - 0 = 20
  });

  it('suggests project material processing & matched BOM needs minus pending MR quantities', () => {
    const openMRs: MaterialRequest[] = [
      {
        id: 'mr_open',
        mrNo: 'MR-2026-001',
        projectId: 'proj_1',
        projectName: 'Dump Body Komatsu 930E',
        urgency: 'Normal',
        status: 'Submitted',
        requestedBy: 'Budi',
        requestedById: 'u2',
        requestedDate: '2026-01-10',
        items: [
          {
            materialId: 'mp_mp_1',
            materialName: 'Floor Plate Bisalloy 400 12mm',
            unit: 'pcs',
            qtyRequested: 2,
          },
          {
            materialId: 'mat_wire',
            materialName: 'Welding Wire ER70S-6 1.2mm',
            unit: 'kg',
            qtyRequested: 20,
            isWire: true,
          },
        ],
      },
    ];

    const suggestions = buildProjectNeedsSuggestions(sampleProject, sampleBoms, sampleMaterials, openMRs);
    const mpNeed = suggestions.find((s) => s.catalogItem.id === 'mp_mp_1');
    const wireNeed = suggestions.find((s) => s.catalogItem.id === 'mat_wire');
    const paintNeed = suggestions.find((s) => s.catalogItem.id === 'mat_paint');

    expect(mpNeed?.suggestedQty).toBe(4); // 6 - 2 open MR
    expect(wireNeed?.suggestedQty).toBe(40); // 60 - 20 open MR
    expect(paintNeed?.suggestedQty).toBe(25);
  });

  it('matches welder_shift preset against warehouse materials and calculates cost summary', () => {
    const lines = buildQuickPresetLines('welder_shift', sampleMaterials);
    expect(lines.some((l) => l.materialId === 'mat_wire' && l.qty === 15)).toBe(true);
    expect(lines.some((l) => l.materialId === 'mat_grinda' && l.qty === 4)).toBe(true);
    expect(lines.some((l) => l.materialId === 'mat_glove' && l.qty === 1)).toBe(true);

    const summary = calculateCartSummary(lines);
    expect(summary.totalLines).toBe(3);
    expect(summary.wireCount).toBe(1);
    expect(summary.consumableCount).toBe(2);
    expect(summary.estimatedCostIdr).toBe(15 * 35000 + 4 * 12000 + 1 * 18000);
  });

  it('blocks zero-stock and project-part lines in direct_checkout mode but allows them in request_mr mode', () => {
    const catalog = buildUnifiedCatalog(sampleMaterials, sampleProject);
    const gloveItem = catalog.find((c) => c.id === 'mat_glove')!;
    const mpItem = catalog.find((c) => c.id === 'mp_mp_1')!;

    const cart = mergeCartLines([], [
      {
        materialId: gloveItem.id,
        materialName: gloveItem.name,
        unit: gloveItem.unit,
        qty: 2,
        isWire: false,
        unitCost: gloveItem.unitCost,
        currentStock: gloveItem.currentStock,
        minStock: gloveItem.minStock,
        category: gloveItem.category,
        source: gloveItem.source,
      },
      {
        materialId: mpItem.id,
        materialName: mpItem.name,
        unit: mpItem.unit,
        qty: 3,
        isWire: false,
        unitCost: mpItem.unitCost,
        currentStock: mpItem.currentStock,
        minStock: mpItem.minStock,
        category: mpItem.category,
        source: mpItem.source,
      },
    ]);

    const checkoutCheck = validateCartForMode(cart, 'direct_checkout', sampleMaterials);
    expect(checkoutCheck.valid).toBe(false);
    expect(checkoutCheck.issues).toHaveLength(2);

    const mrCheck = validateCartForMode(cart, 'request_mr', sampleMaterials);
    expect(mrCheck.valid).toBe(true);
    expect(mrCheck.issues).toHaveLength(0);
  });
});
