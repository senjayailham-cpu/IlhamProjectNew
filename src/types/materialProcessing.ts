/**
 * ============================================================================
 * MATERIAL PROCESSING, WORK ORDER BOM & OFFCUT MANAGEMENT DATA MODELS
 * Austin Batam Project Tracking Console - Industrial Fabrication MES
 * ============================================================================
 */

export type CuttingMachineType = 'cnc_plasma' | 'fiber_laser' | 'oxy_fuel' | 'bandsaw';

export interface CuttingMachineConfig {
  id: CuttingMachineType;
  name: string;
  code: string;
  bedSize: string; // e.g. "6000 x 2500 mm"
  maxThicknessMm: number;
  hourlyRateIdr: number;
  benchmarkScrapRatePct: number; // e.g. 5.5%
}

export const CUTTING_MACHINES: Record<CuttingMachineType, CuttingMachineConfig> = {
  cnc_plasma: {
    id: 'cnc_plasma',
    name: 'CNC Plasma Koike Master',
    code: 'PLAS-01',
    bedSize: '12000 x 3000 mm',
    maxThicknessMm: 40,
    hourlyRateIdr: 450000,
    benchmarkScrapRatePct: 7.0,
  },
  fiber_laser: {
    id: 'fiber_laser',
    name: 'High-Power Fiber Laser 6kW',
    code: 'LAS-02',
    bedSize: '6000 x 2000 mm',
    maxThicknessMm: 25,
    hourlyRateIdr: 650000,
    benchmarkScrapRatePct: 3.5,
  },
  oxy_fuel: {
    id: 'oxy_fuel',
    name: 'Heavy Duty Multi-Torch Oxy-Fuel',
    code: 'OXY-01',
    bedSize: '14000 x 3500 mm',
    maxThicknessMm: 150,
    hourlyRateIdr: 380000,
    benchmarkScrapRatePct: 8.5,
  },
  bandsaw: {
    id: 'bandsaw',
    name: 'Horizontal Bandsaw Hyd-Mech',
    code: 'SAW-01',
    bedSize: 'Pipe & Beam Gantry',
    maxThicknessMm: 300,
    hourlyRateIdr: 220000,
    benchmarkScrapRatePct: 2.0,
  },
};

/**
 * 1. BOM Items (Target Work Order BOM Requirements)
 */
export interface BOMItemEntity {
  id: string;
  bomTemplateId?: string;
  projectId: string;
  projectName: string;
  workOrder: string; // e.g. "WO-2026-001"
  partNumber: string; // e.g. "AB-FP-101"
  description: string;
  materialGrade: string; // e.g. "Hardox 450", "Bisalloy 400", "SS304", "S355JR", "A36"
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  nestingCode: string; // e.g. "NST-793-04A"
  requiredQty: number;
  processedQty: number;
  unit: 'pcs' | 'sheet' | 'meter' | 'kg';
  weightPerUnitKg: number;
  totalPlannedWeightKg: number;
  targetMachine: CuttingMachineType;
  subAssembly?: string;
  reservedMaterialId?: string; // Links to reserved prime plate or offcut
  status: 'pending' | 'in_progress' | 'completed';
  mtcRequired: boolean;
  notes?: string;
}

/**
 * 2. Material Reservation & Processing Orders
 */
export interface MaterialReservation {
  id: string;
  reservationNo: string; // e.g. "RES-2026-042"
  workOrder: string;
  projectId: string;
  projectName: string;
  bomItemId: string;
  partNumber: string;
  targetNestingCode: string;
  sourceType: 'prime_plate' | 'reusable_offcut' | 'pipe_beam';
  sourceMaterialId: string; // ID in materials collection or offcut_inventory
  sourceMaterialName: string;
  materialGrade: string;
  thicknessMm: number;
  heatNumber?: string;
  mtcNumber?: string;
  reservedQty: number;
  reservedWeightKg: number;
  assignedMachine: CuttingMachineType;
  operatorId?: string;
  operatorName?: string;
  status: 'reserved' | 'in_cutting' | 'completed' | 'cancelled';
  reservedAt: string;
  issuedAt?: string;
  completedAt?: string;
  notes?: string;
}

/**
 * 3. Shop-Floor Processing Run Log
 */
export interface ProcessingLog {
  id: string;
  logNo: string; // e.g. "CLOG-2026-0089"
  reservationId?: string;
  workOrder: string;
  projectId: string;
  projectName?: string;
  bomItemId?: string;
  partNumber: string;
  materialGrade: string;
  thicknessMm: number;
  heatNumber: string;
  mtcNumber: string;
  machine: CuttingMachineType;
  operatorId: string;
  operatorName: string;
  rawMaterialQr: string;
  rawMaterialPlateNo?: string;
  rawStockWeightKg: number;
  goodPartsQty: number;
  goodPartsWeightKg: number;
  scrapWeightKg: number; // Dross, kerf loss, and scrap skeleton
  usableOffcutsCount: number;
  usableOffcutWeightKg: number;
  yieldRatioPct: number; // (goodPartsWeightKg + usableOffcutWeightKg) / rawStockWeightKg * 100
  scrapRatioPct: number; // scrapWeightKg / rawStockWeightKg * 100
  producedOffcutIds: string[];
  timestamp: string;
  validationStatus: 'verified' | 'mismatch_override';
  notes?: string;
}

/**
 * 4. Usable Offcut Inventory Entity
 */
export interface OffcutInventoryItem {
  id: string; // e.g. "OFC-2026-0042"
  qrCode: string; // Compact encoded QR payload
  sourceWorkOrder: string;
  sourceLogId?: string;
  materialGrade: string;
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  shape: 'rectangular' | 'l_shaped' | 'triangular' | 'irregular';
  approxWeightKg: number;
  heatNumber: string;
  mtcNumber: string;
  rackLocation: string; // e.g. "RACK-A3-BAY1", "RACK-B-SHELF2"
  status: 'available' | 'reserved' | 'consumed' | 'scrapped';
  allocatedWorkOrder?: string;
  costPerKg: number; // e.g. 38000 (IDR)
  estimatedValue: number; // approxWeightKg * costPerKg
  createdAt: string;
  consumedAt?: string;
  consumedByWO?: string;
  registeredBy: string;
  notes?: string;
}

/**
 * QR Validation Types
 */
export interface RawMaterialQRData {
  plateNo?: string;
  grade: string;
  thicknessMm: number;
  heatNumber: string;
  mtcNumber: string;
  dimensions?: string;
  supplier?: string;
  rawString?: string;
}

export interface SpecValidationResponse {
  isValid: boolean;
  status: 'MATCH' | 'MISMATCH' | 'WARNING';
  discrepancies: string[];
  parsedData: RawMaterialQRData;
  suggestions?: {
    matchingOffcutsCount: number;
    recommendedOffcutId?: string;
  };
}

/**
 * Offcut Reusability Suggestion
 */
export interface OffcutSuggestion {
  offcut: OffcutInventoryItem;
  fitScorePct: number; // 0 - 100%
  areaUtilizationPct: number;
  potentialCostSavedIdr: number;
  dimensionalFit: {
    lengthDeltaMm: number;
    widthDeltaMm: number;
    sufficient: boolean;
  };
}

/**
 * Material Variance Analytics KPI
 */
export interface MaterialVarianceKPIs {
  overallYieldPct: number;
  targetYieldPct: number;
  totalRawConsumedKg: number;
  totalGoodPartsKg: number;
  totalScrapKg: number;
  totalOffcutsReusedKg: number;
  cumulativeCostSavedIdr: number;
  varianceRatePct: number; // (actual - planned) / planned * 100
  machineMetrics: {
    machine: CuttingMachineType;
    name: string;
    runsCount: number;
    totalRawKg: number;
    goodPartsKg: number;
    scrapKg: number;
    yieldRatioPct: number;
    scrapRatioPct: number;
    targetScrapPct: number;
  }[];
  monthlySavings: {
    month: string;
    offcutsReusedKg: number;
    savingsIdr: number;
  }[];
  consumptionVarianceByWO: {
    workOrder: string;
    projectName: string;
    plannedKg: number;
    actualKg: number;
    varianceKg: number;
    variancePct: number;
    yieldPct: number;
  }[];
}
