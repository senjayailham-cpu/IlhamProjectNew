import { describe, it, expect } from 'vitest';
import {
  calculateProjectEvms,
  calculatePortfolioEvms,
  computeDerivedEvmsRatios,
  classifyEvmsHealth,
} from '../evmsEngine';
import type { Project, TimesheetEntry, WireLog, Employee, BomTemplate } from '../../types';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Fabrication Hopper A',
  client: 'WO-1001',
  category: 'Fabrication',
  location: 'workshop1',
  status: 'active',
  created: '2026-06-01',
  start: '2026-06-01',
  due: '2026-06-20',
  budgetCost: 100_000_000,
  budgetHours: 1000,
  assemblies: [
    {
      id: 'asm-1',
      name: 'Main Frame',
      start: '2026-06-01',
      finish: '2026-06-20',
      budgetCost: 60_000_000,
      budgetHours: 600,
      tasks: [
        {
          id: 't-1',
          name: 'Cutting & Fit-up',
          done: true,
          pct: 100,
          difficulty: 2,
          startDate: '2026-06-01',
          finishDate: '2026-06-10',
        },
        {
          id: 't-2',
          name: 'Welding',
          done: false,
          pct: 0,
          difficulty: 2,
          startDate: '2026-06-11',
          finishDate: '2026-06-20',
        },
      ],
    },
    {
      id: 'asm-2',
      name: 'Support Legs',
      start: '2026-06-01',
      finish: '2026-06-20',
      budgetCost: 40_000_000,
      budgetHours: 400,
      tasks: [
        {
          id: 't-3',
          name: 'Assembly',
          done: false,
          pct: 50,
          difficulty: 2,
          startDate: '2026-06-01',
          finishDate: '2026-06-20',
        },
      ],
    },
  ],
  ...overrides,
});

const employees: Employee[] = [
  { id: 'e-1', name: 'Budi', position: 'Welder', location: 'Workshop 1', hourlyRate: 50_000 },
];

const timesheets: TimesheetEntry[] = [
  {
    id: 'ts-1',
    empId: 'e-1',
    empName: 'Budi',
    position: 'Welder',
    date: '2026-06-05',
    totalHours: 100, // 8 regular + 92 OT in single entry calc, OR let's keep realistic: 8h * 50k = 400k
    workOrder: 'WO-1001',
    projectId: 'proj-1',
    assemblyId: 'asm-1',
    status: 'present',
  },
];

describe('evmsEngine', () => {
  it('computes derived EVMS ratios safely with division-by-zero protection', () => {
    const zeroCase = computeDerivedEvmsRatios(100_000_000, 0, 0, 0);
    expect(zeroCase.cpi).toBe(1);
    expect(zeroCase.spi).toBe(1);
    expect(zeroCase.cv).toBe(0);
    expect(zeroCase.sv).toBe(0);
    expect(zeroCase.eac).toBe(100_000_000);

    const normal = computeDerivedEvmsRatios(100_000_000, 50_000_000, 40_000_000, 50_000_000);
    expect(normal.cv).toBe(-10_000_000);
    expect(normal.sv).toBe(-10_000_000);
    expect(normal.cpi).toBe(0.8);
    expect(normal.spi).toBe(0.8);
    expect(normal.eac).toBe(125_000_000);
    expect(normal.etc).toBe(75_000_000);
    expect(normal.vac).toBe(-25_000_000);
  });

  it('calculates project EVMS metrics accurately in cost mode', () => {
    const proj = makeProject();
    const simpleTs: TimesheetEntry[] = [
      {
        id: 'ts-1',
        empId: 'e-1',
        empName: 'Budi',
        position: 'Welder',
        date: '2026-06-05',
        totalHours: 8,
        hourlyRate: 50_000,
        workOrder: 'WO-1001',
        projectId: 'proj-1',
        assemblyId: 'asm-1',
        status: 'present',
      },
    ];
    const wireLogs: WireLog[] = [
      {
        id: 'wl-1',
        welderId: 'e-1',
        welderName: 'Budi',
        projectId: 'proj-1',
        projectName: 'Fabrication Hopper A',
        assemblyId: 'asm-1',
        assemblyName: 'Main Frame',
        date: '2026-06-06',
        amountKg: 100,
        unitCost: 35_000,
        totalCost: 3_500_000,
      },
    ];

    const metrics = calculateProjectEvms(proj, {
      unitMode: 'cost',
      evalDate: '2026-06-10',
      timesheets: simpleTs,
      wireLogs,
      employees,
    });

    // Overall calcPct: tasks (100*2 + 0*2 + 50*2) / (2+2+2) = 300/6 = 50%
    expect(metrics.actualPct).toBe(50);
    expect(metrics.bac).toBe(100_000_000);
    expect(metrics.isEstimatedBac).toBe(false);
    expect(metrics.ev).toBe(50_000_000);
    // Planned at 2026-06-10: t-1=100%, t-2=0%, t-3=50% => 50%
    expect(metrics.plannedPct).toBe(50);
    expect(metrics.pv).toBe(50_000_000);
    // AC: labor (8 * 50,000 = 400,000) + wire (3,500,000) = 3,900,000
    expect(metrics.ac).toBe(3_900_000);
    expect(metrics.cv).toBe(46_100_000);
    expect(metrics.sv).toBe(0);
    expect(metrics.spi).toBe(1);
    expect(metrics.cpi).toBeGreaterThan(1);
    expect(metrics.assemblies).toHaveLength(2);
  });

  it('switches cleanly to man-hours mode and flags estimated BAC when unset', () => {
    const proj = makeProject({ budgetCost: undefined, budgetHours: undefined, assemblies: [] });
    const metrics = calculateProjectEvms(proj, {
      unitMode: 'hours',
      evalDate: '2026-06-10',
      timesheets: [
        {
          ...timesheets[0],
          totalHours: 80,
        },
      ],
    });

    expect(metrics.isEstimatedBac).toBe(true);
    expect(metrics.bac).toBe(100); // max(100, round(80 * 1.25)) = 100
    expect(metrics.ac).toBe(80);
  });

  it('aligns portfolio S-curve end-point on evalDate exactly with portfolio total EV and AC', () => {
    const proj = makeProject();
    const ts: TimesheetEntry[] = [
      {
        id: 'ts-a',
        empId: 'e-1',
        empName: 'Budi',
        position: 'Welder',
        date: '2026-06-04',
        totalHours: 8,
        hourlyRate: 50_000,
        projectId: 'proj-1',
        status: 'present',
      },
      {
        id: 'ts-b',
        empId: 'e-1',
        empName: 'Budi',
        position: 'Welder',
        date: '2026-06-09',
        totalHours: 8,
        hourlyRate: 50_000,
        projectId: 'proj-1',
        status: 'present',
      },
    ];

    const summary = calculatePortfolioEvms([proj], {
      unitMode: 'cost',
      selectedMonth: '2026-06',
      evalDate: '2026-06-10',
      timesheets: ts,
      employees,
    });

    expect(summary.evalDayNum).toBe(10);
    expect(summary.scurveSeries).toHaveLength(30);
    const evalPoint = summary.scurveSeries[summary.evalDayNum - 1];
    expect(evalPoint.ev).toBe(summary.totalEv);
    expect(evalPoint.ac).toBe(summary.totalAc);
    expect(evalPoint.pv).toBe(summary.totalPv);
    // Future days must have null EV and AC, non-null PV
    expect(summary.scurveSeries[15].ev).toBeNull();
    expect(summary.scurveSeries[15].ac).toBeNull();
    expect(summary.scurveSeries[15].pv).toBeGreaterThan(0);
  });

  it('classifies EVMS health quadrants accurately', () => {
    expect(classifyEvmsHealth(1.05, 1.02, 100, 102, 97).status).toBe('optimal');
    expect(classifyEvmsHealth(1.08, 0.85, 100, 85, 78).status).toBe('efficient_behind');
    expect(classifyEvmsHealth(0.82, 1.1, 100, 110, 134).status).toBe('overbudget_ahead');
    expect(classifyEvmsHealth(0.75, 0.78, 100, 78, 104).status).toBe('critical');
    expect(classifyEvmsHealth(1, 1, 0, 0, 0).status).toBe('unstarted');
  });

  it('automatically derives BAC from matching BOM + Man-Hours when budgetCost is unset', () => {
    const proj = makeProject({
      budgetCost: undefined,
      budgetHours: 200,
      gaNumber: 'GA-HOPPER',
      assemblies: [],
    });

    const bomTemplates: BomTemplate[] = [
      {
        id: 'bom-hopper',
        name: 'Hopper Plate Spec',
        model: 'Standard',
        version: 'v1',
        status: 'active',
        gaNumber: 'GA-HOPPER',
        createdBy: 'u1',
        createdByName: 'Admin',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        items: [
          {
            id: 'bi-1',
            partNumber: 'PL-10',
            description: 'Mild Steel Plate',
            material: 'SS400',
            quantity: 1,
            unit: 'pcs',
            totalWeight: 1000, // 1000 * 18,500 = 18,500,000
            category: 'plate',
          },
        ],
      },
    ];

    const metrics = calculateProjectEvms(proj, {
      unitMode: 'cost',
      evalDate: '2026-06-10',
      employees, // Budi hourlyRate 50,000 -> labor = 200 * 50,000 = 10,000,000
      bomTemplates,
    });

    expect(metrics.isEstimatedBac).toBe(true);
    expect(metrics.bacSource).toBe('bom_auto');
    expect(metrics.bac).toBe(28_500_000);
  });
});
