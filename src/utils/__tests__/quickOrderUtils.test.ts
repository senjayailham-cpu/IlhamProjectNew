import { describe, expect, it } from 'vitest';
import { Employee, MaterialItem, Project, User } from '../../types';
import {
  buildLowStockRestockCart,
  buildQuickOrderCatalog,
  buildQuickOrderPayload,
  filterQuickOrderCatalog,
  isConsumableCategory,
} from '../quickOrderUtils';

const mockUser: User = {
  id: 'u1',
  name: 'Budi Foreman',
  passHash: 'hash',
  role: 'coordinator',
};

const mockMaterials: MaterialItem[] = [
  {
    id: 'mat_1',
    name: 'Batu Gerinda Potong 4 Inch',
    partNumber: 'BG-004',
    category: 'Welding Consumable',
    unit: 'pcs',
    currentStock: 3,
    minStock: 10,
    location: 'Rak A-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'mat_2',
    name: 'Pelat Baja SS400 10mm',
    partNumber: 'PLT-SS400-10',
    category: 'Other',
    unit: 'pcs',
    currentStock: 15,
    minStock: 5,
    location: 'Yard Plate',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'mat_3',
    name: 'Sarung Tangan Las Kulit',
    partNumber: 'PPE-GLV-01',
    category: 'PPE',
    unit: 'pcs',
    currentStock: 0,
    minStock: 6,
    location: 'Lemari Safety',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const mockProject: Project = {
  id: 'proj_1',
  name: 'Hopper Coal Unit 2',
  client: 'WO-2026-011',
  category: 'nontray',
  location: 'workshop1',
  status: 'active',
  priority: 'high',
  start: '2026-05-01',
  due: '2026-06-01',
  created: '2026-05-01',
  assemblies: [
    {
      id: 'asm_1',
      name: 'Main Frame',
      tasks: [],
    },
  ],
  materialProcessing: [
    {
      id: 'mp_99',
      projectId: 'proj_1',
      projectName: 'Hopper Coal Unit 2',
      workOrder: 'WO-2026-011',
      materialName: 'Channel UNP 150 x 6m',
      qty: 8,
      unit: 'pcs',
      activeStages: ['cutting'],
      stages: {
        cutting: { status: 'pending' },
      },
      overallPct: 0,
      isCompleted: false,
      createdBy: 'u1',
      createdAt: '2026-05-01',
      updatedAt: '2026-05-01',
    },
  ],
};

const mockEmployee: Employee = {
  id: 'emp_1',
  empNo: 'EMP-001',
  name: 'Andi Welder',
  position: 'Welder 3G',
  location: 'workshop1',
  shift: 'pagi',
  employmentStatus: 'permanent',
  joinDate: '2024-01-10',
};

describe('quickOrderUtils', () => {
  it('distinguishes consumable categories from general materials', () => {
    expect(isConsumableCategory('Welding Consumable')).toBe(true);
    expect(isConsumableCategory('PPE')).toBe(true);
    expect(isConsumableCategory('Wire')).toBe(true);
    expect(isConsumableCategory('Other')).toBe(false);
  });

  it('builds catalog with automatic fallback welding wire and optional project BOM items', () => {
    const catalog = buildQuickOrderCatalog(mockMaterials, [mockProject], 'proj_1');
    expect(catalog.some((c) => c.id === 'wire' && c.isWire)).toBe(true);
    expect(catalog.some((c) => c.id === 'mp_mp_99' && c.isProjectItem)).toBe(true);
  });

  it('filters catalog accurately by group, low_stock, and query', () => {
    const catalog = buildQuickOrderCatalog(mockMaterials, [mockProject]);

    const consumables = filterQuickOrderCatalog(catalog, { filter: 'consumable' });
    expect(consumables.every((c) => c.group === 'consumable')).toBe(true);

    const lowStock = filterQuickOrderCatalog(catalog, { filter: 'low_stock' });
    expect(lowStock.map((i) => i.id)).toEqual(['mat_3', 'mat_1']);

    const byPartNo = filterQuickOrderCatalog(catalog, { query: 'BG-004' });
    expect(byPartNo).toHaveLength(1);
    expect(byPartNo[0].id).toBe('mat_1');
  });

  it('calculates suggested restock quantities for out-of-stock and low-stock items', () => {
    const restock = buildLowStockRestockCart(mockMaterials);
    expect(restock).toHaveLength(2);

    const batuGerinda = restock.find((r) => r.id === 'mat_1');
    expect(batuGerinda?.qty).toBe(17); // minStock 10 * 2 - 3

    const sarungTangan = restock.find((r) => r.id === 'mat_3');
    expect(sarungTangan?.qty).toBe(12); // minStock 6 * 2 - 0
  });

  it('builds valid MaterialRequest payload with wire metadata and optional defaults', () => {
    const payload = buildQuickOrderPayload({
      cart: [
        {
          id: 'wire',
          name: 'Welding Wire AWS A5.18 ER70S-6',
          category: 'Wire',
          group: 'consumable',
          unit: 'kg',
          qty: 15,
          currentStock: 0,
          minStock: 0,
          isWire: true,
        },
        {
          id: 'mat_1',
          name: 'Batu Gerinda Potong 4 Inch',
          category: 'Welding Consumable',
          group: 'consumable',
          unit: 'pcs',
          qty: 10,
          currentStock: 3,
          minStock: 10,
          isWire: false,
        },
      ],
      project: mockProject,
      assemblyId: 'asm_1',
      employee: mockEmployee,
      currentUser: mockUser,
      urgency: 'Urgent',
      notes: 'Butuh segera untuk shift siang',
      requestedDate: '2026-05-15',
    });

    expect(payload.projectId).toBe('proj_1');
    expect(payload.projectName).toBe('Hopper Coal Unit 2');
    expect(payload.assemblyId).toBe('asm_1');
    expect(payload.assemblyName).toBe('Main Frame');
    expect(payload.forEmployeeId).toBe('emp_1');
    expect(payload.forEmployeeName).toBe('Andi Welder');
    expect(payload.forEmployeePosition).toBe('Welder 3G');
    expect(payload.status).toBe('Submitted');
    expect(payload.items[0]).toMatchObject({
      materialId: 'wire',
      qtyRequested: 15,
      isWire: true,
      amountKg: 15,
    });
    expect(payload.items[1]).toMatchObject({
      materialId: 'mat_1',
      qtyRequested: 10,
    });
    expect(payload.items[1].isWire).toBeUndefined();
  });

  it('defaults safely to Stok Umum Workshop and currentUser when project/employee omitted', () => {
    const payload = buildQuickOrderPayload({
      cart: [
        {
          id: 'mat_2',
          name: 'Pelat Baja SS400 10mm',
          category: 'Other',
          group: 'material',
          unit: 'pcs',
          qty: 2,
          currentStock: 15,
          minStock: 5,
          isWire: false,
        },
      ],
      currentUser: mockUser,
      urgency: 'Normal',
      requestedDate: '2026-05-15',
    });

    expect(payload.projectId).toBe('');
    expect(payload.projectName).toBe('Stok Umum Workshop');
    expect(payload.forEmployeeId).toBe('u1');
    expect(payload.forEmployeeName).toBe('Budi Foreman');
  });
});
