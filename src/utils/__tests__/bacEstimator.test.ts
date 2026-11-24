import { describe, it, expect } from 'vitest';
import {
  estimateProjectBacFromBom,
  findMatchingBomTemplate,
  getPortfolioAvgHourlyRate,
  DEFAULT_BOM_MATERIAL_RATES,
} from '../bacEstimator';
import type { BomTemplate, Employee, MaterialItem, Project } from '../../types';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p-1',
  name: 'Dump Body 930E',
  client: 'WO-2026-01',
  gaNumber: 'GA-930E',
  category: 'Tray',
  location: 'workshop1',
  status: 'active',
  created: '2026-06-01',
  budgetHours: 500,
  assemblies: [],
  ...overrides,
});

const bomTemplates: BomTemplate[] = [
  {
    id: 'bom-1',
    name: 'Ultima 930E Standard',
    model: 'Ultima',
    truckModel: 'Komatsu 930E',
    version: 'v1',
    status: 'active',
    gaNumber: 'GA-930E',
    createdBy: 'u-1',
    createdByName: 'Admin',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    items: [
      {
        id: 'i-1',
        partNumber: 'FP-01',
        description: 'Floor Plate',
        material: 'Hardox 450',
        quantity: 2,
        unit: 'pcs',
        weightPerUnit: 500,
        totalWeight: 1000, // 1000 kg -> 42,000/kg fallback OR matched from MaterialItem
        category: 'plate',
      },
      {
        id: 'i-2',
        partNumber: 'ST-01',
        description: 'Main Rib',
        material: 'SS400 A36',
        quantity: 4,
        unit: 'pcs',
        weightPerUnit: 250,
        totalWeight: 1000, // 1000 kg * 18,500 = 18,500,000
        category: 'structural',
      },
      {
        id: 'i-3',
        partNumber: 'WR-01',
        description: 'Flux Core Wire',
        material: 'Flux-Cored Wire 1.2mm',
        quantity: 100,
        unit: 'kg',
        category: 'welding_consumable',
      },
    ],
  },
];

const employees: Employee[] = [
  { id: 'e-1', name: 'A', hourlyRate: 40_000 },
  { id: 'e-2', name: 'B', hourlyRate: 60_000 },
  { id: 'e-3', name: 'Ex', hourlyRate: 100_000, isExEmployee: true },
];

const materials: MaterialItem[] = [
  {
    id: 'm-1',
    name: 'Hardox 450 Plate',
    partNumber: 'FP-01',
    category: 'Other',
    unit: 'kg',
    currentStock: 10,
    minStock: 2,
    unitCost: 45_000, // Overrides fallback 42,000 for FP-01
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

describe('bacEstimator', () => {
  it('computes active portfolio average hourly rate ignoring ex-employees', () => {
    expect(getPortfolioAvgHourlyRate(employees)).toBe(50_000);
  });

  it('matches BOM automatically by GA Number', () => {
    const match = findMatchingBomTemplate(makeProject(), bomTemplates);
    expect(match.bom?.id).toBe('bom-1');
    expect(match.reason).toBe('ga_number');
  });

  it('estimates BOM material cost + man-hours labor cost into recommended BAC', () => {
    const est = estimateProjectBacFromBom(makeProject(), bomTemplates, materials, employees);

    // FP-01 matched from Master Material: 1000 kg * 45,000 = 45,000,000
    // ST-01 fallback carbon steel: 1000 kg * 18,500 = 18,500,000
    // WR-01 fallback wire: 100 kg * 35,000 = 3,500,000
    const expectedMat =
      1000 * 45_000 +
      1000 * DEFAULT_BOM_MATERIAL_RATES.carbonSteelPerKg +
      100 * DEFAULT_BOM_MATERIAL_RATES.wirePerKg;

    // Labor: 500 hours * 50,000 = 25,000,000
    const expectedLabor = 500 * 50_000;

    expect(est.estimatedMaterialCost).toBe(expectedMat);
    expect(est.estimatedLaborCost).toBe(expectedLabor);
    expect(est.recommendedBac).toBe(expectedMat + expectedLabor);
    expect(est.pricedFromMasterCount).toBe(1);
    expect(est.totalWeightKg).toBe(2100);
  });

  it('applies unit multiplier cleanly when ordering multiple sets', () => {
    const est = estimateProjectBacFromBom(makeProject({ bomMultiplier: 2 }), bomTemplates, materials, employees);
    const singleEst = estimateProjectBacFromBom(makeProject(), bomTemplates, materials, employees);
    expect(est.estimatedMaterialCost).toBe(singleEst.estimatedMaterialCost * 2);
  });
});
