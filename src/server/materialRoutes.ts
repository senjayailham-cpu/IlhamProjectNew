import { Router, Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  BOMItemEntity,
  MaterialReservation,
  ProcessingLog,
  OffcutInventoryItem,
  CuttingMachineType,
  MaterialVarianceKPIs,
  OffcutSuggestion,
  CUTTING_MACHINES,
  RawMaterialQRData,
  SpecValidationResponse
} from '../types/materialProcessing';

export const materialRouter = Router();

// In-memory persistent cache for quick response & offline/credential-less fallback
let offcutInventoryCache: OffcutInventoryItem[] = [
  {
    id: 'OFC-2026-001',
    qrCode: 'AB-OFC|OFC-2026-001|Hardox 450|12|1850x850|HT-99214|MTC-2026-0182',
    sourceWorkOrder: 'WO-2026-001',
    materialGrade: 'Hardox 450',
    thicknessMm: 12,
    lengthMm: 1850,
    widthMm: 850,
    shape: 'rectangular',
    approxWeightKg: 148,
    heatNumber: 'HT-99214',
    mtcNumber: 'MTC-2026-0182',
    rackLocation: 'RACK-A2-BAY1',
    status: 'available',
    costPerKg: 42000,
    estimatedValue: 6216000,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    registeredBy: 'Agus Setiawan (CNC Operator)',
    notes: 'Clean rectangular drop from floor plate nesting'
  },
  {
    id: 'OFC-2026-002',
    qrCode: 'AB-OFC|OFC-2026-002|Bisalloy 400|16|2100x600|HT-77312|MTC-2026-0144',
    sourceWorkOrder: 'WO-2026-002',
    materialGrade: 'Bisalloy 400',
    thicknessMm: 16,
    lengthMm: 2100,
    widthMm: 600,
    shape: 'rectangular',
    approxWeightKg: 158,
    heatNumber: 'HT-77312',
    mtcNumber: 'MTC-2026-0144',
    rackLocation: 'RACK-B1-BAY1',
    status: 'available',
    costPerKg: 46000,
    estimatedValue: 7268000,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    registeredBy: 'Budi Santoso',
    notes: 'Side beam remnant'
  },
  {
    id: 'OFC-2026-003',
    qrCode: 'AB-OFC|OFC-2026-003|SS304|6|1400x1100|HT-33109|MTC-2026-0099',
    sourceWorkOrder: 'WO-2026-003',
    materialGrade: 'SS304',
    thicknessMm: 6,
    lengthMm: 1400,
    widthMm: 1100,
    shape: 'rectangular',
    approxWeightKg: 73,
    heatNumber: 'HT-33109',
    mtcNumber: 'MTC-2026-0099',
    rackLocation: 'RACK-SS-BAY2',
    status: 'available',
    costPerKg: 78000,
    estimatedValue: 5694000,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    registeredBy: 'Hendrik Wijaya',
    notes: 'Chute liner remnant'
  },
  {
    id: 'OFC-2026-004',
    qrCode: 'AB-OFC|OFC-2026-004|S355JR|20|1200x950|HT-66120|MTC-2026-0210',
    sourceWorkOrder: 'WO-2026-001',
    materialGrade: 'S355JR',
    thicknessMm: 20,
    lengthMm: 1200,
    widthMm: 950,
    shape: 'rectangular',
    approxWeightKg: 179,
    heatNumber: 'HT-66120',
    mtcNumber: 'MTC-2026-0210',
    rackLocation: 'RACK-A1-BAY1',
    status: 'reserved',
    allocatedWorkOrder: 'WO-2026-004',
    costPerKg: 28000,
    estimatedValue: 5012000,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    registeredBy: 'Agus Setiawan',
    notes: 'Reserved for Lug plate cutting'
  }
];

let processingLogsCache: ProcessingLog[] = [
  {
    id: 'CLOG-2026-001',
    logNo: 'CLOG-2026-001',
    workOrder: 'WO-2026-001',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    partNumber: 'AB-FP-101',
    materialGrade: 'Hardox 450',
    thicknessMm: 12,
    heatNumber: 'HT-99214',
    mtcNumber: 'MTC-2026-0182',
    machine: 'cnc_plasma',
    operatorId: 'emp_5',
    operatorName: 'Agus Setiawan',
    rawMaterialQr: 'AB-MAT|PL-5524|Hardox 450|12|6000x2000|HT-99214|MTC-2026-0182',
    rawMaterialPlateNo: 'PL-5524',
    rawStockWeightKg: 1130,
    goodPartsQty: 8,
    goodPartsWeightKg: 910,
    scrapWeightKg: 72,
    usableOffcutsCount: 1,
    usableOffcutWeightKg: 148,
    yieldRatioPct: 93.6,
    scrapRatioPct: 6.4,
    producedOffcutIds: ['OFC-2026-001'],
    timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
    validationStatus: 'verified',
    notes: 'High nesting efficiency run on CNC Koike Plasma.'
  },
  {
    id: 'CLOG-2026-002',
    logNo: 'CLOG-2026-002',
    workOrder: 'WO-2026-002',
    projectId: 'proj_2',
    projectName: 'Exhaust Heat Shield Ducting System',
    partNumber: 'AB-SH-202',
    materialGrade: 'Bisalloy 400',
    thicknessMm: 16,
    heatNumber: 'HT-77312',
    mtcNumber: 'MTC-2026-0144',
    machine: 'fiber_laser',
    operatorId: 'emp_7',
    operatorName: 'Hendrik Wijaya',
    rawMaterialQr: 'AB-MAT|PL-8831|Bisalloy 400|16|6000x2000|HT-77312|MTC-2026-0144',
    rawMaterialPlateNo: 'PL-8831',
    rawStockWeightKg: 1507,
    goodPartsQty: 12,
    goodPartsWeightKg: 1305,
    scrapWeightKg: 44,
    usableOffcutsCount: 1,
    usableOffcutWeightKg: 158,
    yieldRatioPct: 97.1,
    scrapRatioPct: 2.9,
    producedOffcutIds: ['OFC-2026-002'],
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    validationStatus: 'verified',
    notes: 'Laser 6kW clean bevel cut. Negligible dross.'
  },
  {
    id: 'CLOG-2026-003',
    logNo: 'CLOG-2026-003',
    workOrder: 'WO-2026-001',
    projectId: 'proj_1',
    projectName: 'Main Deck Piping Structural Assembly',
    partNumber: 'AB-BR-105',
    materialGrade: 'S355JR',
    thicknessMm: 20,
    heatNumber: 'HT-66120',
    mtcNumber: 'MTC-2026-0210',
    machine: 'oxy_fuel',
    operatorId: 'emp_5',
    operatorName: 'Agus Setiawan',
    rawMaterialQr: 'AB-MAT|PL-3112|S355JR|20|6000x2000|HT-66120|MTC-2026-0210',
    rawMaterialPlateNo: 'PL-3112',
    rawStockWeightKg: 1884,
    goodPartsQty: 6,
    goodPartsWeightKg: 1585,
    scrapWeightKg: 120,
    usableOffcutsCount: 1,
    usableOffcutWeightKg: 179,
    yieldRatioPct: 93.6,
    scrapRatioPct: 6.4,
    producedOffcutIds: ['OFC-2026-004'],
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    validationStatus: 'verified',
    notes: 'Heavy torch gantry cutting for 20mm flange brackets.'
  }
];

let reservationsCache: MaterialReservation[] = [
  {
    id: 'RES-2026-001',
    reservationNo: 'RES-2026-001',
    workOrder: 'WO-2026-004',
    projectId: 'proj_4',
    projectName: 'Mining Dump Body Rear Gate Pivot',
    bomItemId: 'bom_req_004',
    partNumber: 'AB-PV-301',
    targetNestingCode: 'NST-PIVOT-01',
    sourceType: 'reusable_offcut',
    sourceMaterialId: 'OFC-2026-004',
    sourceMaterialName: 'S355JR 20mm Remnant',
    materialGrade: 'S355JR',
    thicknessMm: 20,
    heatNumber: 'HT-66120',
    mtcNumber: 'MTC-2026-0210',
    reservedQty: 2,
    reservedWeightKg: 179,
    assignedMachine: 'cnc_plasma',
    operatorId: 'emp_5',
    operatorName: 'Agus Setiawan',
    status: 'reserved',
    reservedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    notes: 'Utilizing offcut OFC-2026-004 to avoid pulling fresh prime plate'
  }
];

// Helper to normalize grade strings
function normalizeGrade(g: string): string {
  if (!g) return '';
  const s = g.trim().toUpperCase().replace(/[\s\-_]/g, '');
  if (s.includes('HARDOX450')) return 'HARDOX450';
  if (s.includes('HARDOX500')) return 'HARDOX500';
  if (s.includes('BISALLOY400') || s.includes('BIS400')) return 'BISALLOY400';
  if (s.includes('BISALLOY450') || s.includes('BIS450')) return 'BISALLOY450';
  if (s.includes('SS304') || s.includes('AISI304') || s.includes('SUS304')) return 'SS304';
  if (s.includes('SS316') || s.includes('AISI316')) return 'SS316';
  if (s.includes('S355') || s.includes('S355JR')) return 'S355JR';
  if (s.includes('A36') || s.includes('SS400') || s.includes('MS')) return 'A36/SS400';
  return s;
}

// Parse Raw QR Code payload (JSON or Pipe-delimited string)
export function parseRawMaterialQR(qrString: string): RawMaterialQRData {
  const trimmed = (qrString || '').trim();
  if (!trimmed) {
    return { grade: '', thicknessMm: 0, heatNumber: '', mtcNumber: '' };
  }

  // Try JSON first
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        plateNo: obj.plateNo || obj.plateId || obj.id,
        grade: obj.grade || obj.materialGrade || obj.material || '',
        thicknessMm: Number(obj.thicknessMm || obj.thickness || 0),
        heatNumber: obj.heatNumber || obj.heatNo || '',
        mtcNumber: obj.mtcNumber || obj.mtcNo || '',
        dimensions: obj.dimensions || `${obj.lengthMm || 0}x${obj.widthMm || 0}`,
        supplier: obj.supplier,
        rawString: trimmed
      };
    } catch (e) {
      // Fallback to text parsing
    }
  }

  // Format: "AB-MAT|PLATE_NO|GRADE|THICKNESS|DIMENSIONS|HEAT_NO|MTC_NO"
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    if (parts.length >= 4) {
      const plateNo = parts[1] || '';
      const grade = parts[2] || '';
      const thkMatch = parts[3].match(/(\d+(\.\d+)?)/);
      const thicknessMm = thkMatch ? parseFloat(thkMatch[1]) : 0;
      const dimensions = parts[4] || '';
      const heatNumber = parts[5] || '';
      const mtcNumber = parts[6] || '';
      return {
        plateNo,
        grade,
        thicknessMm,
        dimensions,
        heatNumber,
        mtcNumber,
        rawString: trimmed
      };
    }
  }

  // Simple comma or dash delimited fallback
  const segments = trimmed.split(/[,;\t]/).map(s => s.trim());
  return {
    plateNo: segments[0] || 'RAW-STOCK',
    grade: segments[1] || '',
    thicknessMm: parseFloat(segments[2]) || 0,
    heatNumber: segments[3] || '',
    mtcNumber: segments[4] || '',
    rawString: trimmed
  };
}

/**
 * 1. Validate Scanned Raw Material QR against Work Order BOM Requirements
 * Instant Discrepancy & MTC/Heat Mismatch Detection
 */
materialRouter.post('/validate-spec', (req: Request, res: Response) => {
  try {
    const {
      rawQrData,
      expectedGrade,
      expectedThicknessMm,
      expectedHeatNumber,
      expectedMtcNumber,
      bomItemPartNumber
    } = req.body;

    if (!rawQrData) {
      res.status(400).json({ error: 'Raw material QR code data is required.' });
      return;
    }

    const parsed = parseRawMaterialQR(rawQrData);
    const discrepancies: string[] = [];

    // 1. Grade Verification
    const expNorm = normalizeGrade(expectedGrade || '');
    const actNorm = normalizeGrade(parsed.grade);

    if (expectedGrade && expNorm && actNorm && expNorm !== actNorm) {
      discrepancies.push(
        `CRITICAL GRADE MISMATCH: Scanned "${parsed.grade}" does NOT match BOM requirement "${expectedGrade}". Cutting wrong steel will compromise structural rating!`
      );
    }

    // 2. Thickness Verification (tolerance +/- 0.5 mm)
    if (expectedThicknessMm && parsed.thicknessMm > 0) {
      const diff = Math.abs(parsed.thicknessMm - expectedThicknessMm);
      if (diff > 0.5) {
        discrepancies.push(
          `THICKNESS DISCREPANCY: Scanned ${parsed.thicknessMm}mm plate, but BOM requires ${expectedThicknessMm}mm (Delta: ${diff.toFixed(1)}mm).`
        );
      }
    }

    // 3. MTC / Heat Number Traceability Warning
    if (!parsed.heatNumber) {
      discrepancies.push('TRACEABILITY WARNING: Scanned material QR does not contain Heat / Melt Number.');
    } else if (expectedHeatNumber && parsed.heatNumber.trim().toUpperCase() !== expectedHeatNumber.trim().toUpperCase()) {
      discrepancies.push(
        `HEAT NUMBER MISMATCH: Scanned Heat #${parsed.heatNumber} differs from reserved Heat #${expectedHeatNumber}.`
      );
    }

    if (!parsed.mtcNumber) {
      discrepancies.push('QUALITY WARNING: Mill Test Certificate (MTC) number missing from raw material tag.');
    }

    // Determine status
    let status: 'MATCH' | 'MISMATCH' | 'WARNING' = 'MATCH';
    const hasCritical = discrepancies.some(d => d.includes('CRITICAL') || d.includes('MISMATCH'));
    if (hasCritical) {
      status = 'MISMATCH';
    } else if (discrepancies.length > 0) {
      status = 'WARNING';
    }

    // Query if matching reusable offcuts exist for this BOM requirement
    const matchingOffcuts = offcutInventoryCache.filter(
      o => o.status === 'available' &&
           normalizeGrade(o.materialGrade) === expNorm &&
           Math.abs(o.thicknessMm - (expectedThicknessMm || 0)) <= 0.5
    );

    const responsePayload: SpecValidationResponse = {
      isValid: status === 'MATCH',
      status,
      discrepancies,
      parsedData: parsed,
      suggestions: {
        matchingOffcutsCount: matchingOffcuts.length,
        recommendedOffcutId: matchingOffcuts[0]?.id
      }
    };

    res.json(responsePayload);
  } catch (err: any) {
    console.error('Error validating material spec:', err);
    res.status(500).json({ error: 'Failed to validate material spec', details: err?.message || String(err) });
  }
});

/**
 * 2. Record Cutting / Processing Log with Yield & Offcut Registration
 */
materialRouter.post('/process-log', (req: Request, res: Response) => {
  try {
    const {
      workOrder,
      projectId,
      projectName,
      bomItemId,
      partNumber,
      materialGrade,
      thicknessMm,
      heatNumber,
      mtcNumber,
      machine,
      operatorId,
      operatorName,
      rawMaterialQr,
      rawMaterialPlateNo,
      rawStockWeightKg,
      goodPartsQty,
      goodPartsWeightKg,
      scrapWeightKg,
      usableOffcut, // Optional offcut generation details
      validationOverrideNote
    } = req.body;

    if (!workOrder || !partNumber || !rawStockWeightKg) {
      res.status(400).json({ error: 'Missing required cutting run parameters (workOrder, partNumber, rawStockWeightKg).' });
      return;
    }

    const rawWeight = Number(rawStockWeightKg) || 1;
    const goodPartsWt = Number(goodPartsWeightKg) || 0;
    const scrapWt = Number(scrapWeightKg) || 0;
    const offcutWt = usableOffcut ? Number(usableOffcut.approxWeightKg || 0) : 0;

    // Yield ratio formula: (Good Parts Weight + Usable Offcut Remnant Weight) / Raw Stock Weight * 100
    const yieldRatioPct = Math.min(100, Math.max(0, Number((((goodPartsWt + offcutWt) / rawWeight) * 100).toFixed(1))));
    const scrapRatioPct = Math.min(100, Math.max(0, Number(((scrapWt / rawWeight) * 100).toFixed(1))));

    const now = new Date().toISOString();
    const logId = `CLOG-2026-${String(processingLogsCache.length + 101).padStart(3, '0')}`;
    const producedOffcutIds: string[] = [];

    let createdOffcut: OffcutInventoryItem | null = null;

    // Register usable offcut into offcut inventory if provided
    if (usableOffcut && usableOffcut.lengthMm > 100 && usableOffcut.widthMm > 100) {
      const offcutId = `OFC-2026-${String(offcutInventoryCache.length + 1).padStart(3, '0')}`;
      producedOffcutIds.push(offcutId);

      const qrPayload = `AB-OFC|${offcutId}|${materialGrade}|${thicknessMm}|${usableOffcut.lengthMm}x${usableOffcut.widthMm}|${heatNumber || 'HT-NA'}|${mtcNumber || 'MTC-NA'}`;

      const costPerKg = usableOffcut.costPerKg || 38000;
      createdOffcut = {
        id: offcutId,
        qrCode: qrPayload,
        sourceWorkOrder: workOrder,
        sourceLogId: logId,
        materialGrade: materialGrade || 'Steel',
        thicknessMm: Number(thicknessMm) || 0,
        lengthMm: Number(usableOffcut.lengthMm) || 0,
        widthMm: Number(usableOffcut.widthMm) || 0,
        shape: usableOffcut.shape || 'rectangular',
        approxWeightKg: offcutWt,
        heatNumber: heatNumber || 'N/A',
        mtcNumber: mtcNumber || 'N/A',
        rackLocation: usableOffcut.rackLocation || 'RACK-BAY1-REMNANTS',
        status: 'available',
        costPerKg,
        estimatedValue: Math.round(offcutWt * costPerKg),
        createdAt: now,
        registeredBy: operatorName || 'Shop Operator',
        notes: usableOffcut.notes || `Generated from ${partNumber} cutting run`
      };

      offcutInventoryCache.unshift(createdOffcut);
    }

    const logEntry: ProcessingLog = {
      id: logId,
      logNo: logId,
      workOrder,
      projectId: projectId || 'proj_1',
      projectName: projectName || workOrder,
      bomItemId,
      partNumber,
      materialGrade,
      thicknessMm: Number(thicknessMm) || 0,
      heatNumber: heatNumber || 'N/A',
      mtcNumber: mtcNumber || 'N/A',
      machine: (machine as CuttingMachineType) || 'cnc_plasma',
      operatorId: operatorId || 'emp_1',
      operatorName: operatorName || 'Operator',
      rawMaterialQr: rawMaterialQr || '',
      rawMaterialPlateNo: rawMaterialPlateNo || 'PL-GEN',
      rawStockWeightKg: rawWeight,
      goodPartsQty: Number(goodPartsQty) || 1,
      goodPartsWeightKg: goodPartsWt,
      scrapWeightKg: scrapWt,
      usableOffcutsCount: producedOffcutIds.length,
      usableOffcutWeightKg: offcutWt,
      yieldRatioPct,
      scrapRatioPct,
      producedOffcutIds,
      timestamp: now,
      validationStatus: validationOverrideNote ? 'mismatch_override' : 'verified',
      notes: validationOverrideNote || 'Processing run completed successfully.'
    };

    processingLogsCache.unshift(logEntry);

    // Sync to Firestore if admin app initialized
    if (getApps().length > 0) {
      try {
        const firestore = getFirestore();
        firestore.collection('processing_logs').doc(logId).set(logEntry).catch(e => {
          console.warn('Background Firestore log write failed:', e?.message || e);
        });
        if (createdOffcut) {
          firestore.collection('offcut_inventory').doc(createdOffcut.id).set(createdOffcut).catch(e => {
            console.warn('Background Firestore offcut write failed:', e?.message || e);
          });
        }
      } catch (err) {
        console.warn('Firestore sync skipped in serverless environment.');
      }
    }

    res.json({
      success: true,
      logId,
      log: logEntry,
      createdOffcut,
      yieldRatioPct,
      scrapRatioPct
    });
  } catch (err: any) {
    console.error('Error logging processing run:', err);
    res.status(500).json({ error: 'Failed to record processing log', details: err?.message || String(err) });
  }
});

/**
 * 3. List Offcut Inventory with Filtering & Search
 */
materialRouter.get('/offcuts', (req: Request, res: Response) => {
  try {
    const { status, grade, search, rackLocation } = req.query;

    let items = [...offcutInventoryCache];

    if (status && typeof status === 'string' && status !== 'all') {
      items = items.filter(i => i.status.toLowerCase() === status.toLowerCase());
    }

    if (grade && typeof grade === 'string' && grade !== 'all') {
      const gNorm = normalizeGrade(grade);
      items = items.filter(i => normalizeGrade(i.materialGrade) === gNorm);
    }

    if (rackLocation && typeof rackLocation === 'string' && rackLocation !== 'all') {
      items = items.filter(i => i.rackLocation.toLowerCase().includes(rackLocation.toLowerCase()));
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.id.toLowerCase().includes(q) ||
        i.materialGrade.toLowerCase().includes(q) ||
        i.heatNumber.toLowerCase().includes(q) ||
        i.rackLocation.toLowerCase().includes(q) ||
        i.sourceWorkOrder.toLowerCase().includes(q)
      );
    }

    res.json({ offcuts: items, totalCount: items.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve offcuts', details: err?.message || String(err) });
  }
});

/**
 * 4. Reusable Offcut Suggestion Engine
 * Prioritizes offcut inventory before cutting fresh full raw plates!
 */
materialRouter.get('/offcuts/suggest', (req: Request, res: Response) => {
  try {
    const { grade, thicknessMm, lengthMm, widthMm, requiredQty } = req.query;

    const targetGrade = typeof grade === 'string' ? grade : '';
    const targetThk = parseFloat(String(thicknessMm)) || 0;
    const targetLen = parseFloat(String(lengthMm)) || 0;
    const targetWid = parseFloat(String(widthMm)) || 0;
    const qty = parseInt(String(requiredQty)) || 1;

    const normTargetGrade = normalizeGrade(targetGrade);

    // Filter available offcuts with matching grade & thickness
    const candidates = offcutInventoryCache.filter(o => {
      if (o.status !== 'available') return false;
      if (normTargetGrade && normalizeGrade(o.materialGrade) !== normTargetGrade) return false;
      if (targetThk > 0 && Math.abs(o.thicknessMm - targetThk) > 0.5) return false;

      // Check if candidate can contain at least 1 part (either orientation)
      const fitsNormal = o.lengthMm >= targetLen && o.widthMm >= targetWid;
      const fitsRotated = o.lengthMm >= targetWid && o.widthMm >= targetLen;
      return fitsNormal || fitsRotated;
    });

    // Score candidates by nesting efficiency and fit
    const suggestions: OffcutSuggestion[] = candidates.map(offcut => {
      const partArea = (targetLen * targetWid) * qty;
      const offcutArea = offcut.lengthMm * offcut.widthMm;
      const areaUtilizationPct = Math.min(100, Math.round((partArea / offcutArea) * 100));

      // Calculate dimensional margin
      const lenDelta = offcut.lengthMm - targetLen;
      const widDelta = offcut.widthMm - targetWid;

      // Fit score favors high utilization with minimal leftover scrap
      let fitScorePct = Math.round(areaUtilizationPct * 0.7 + (100 - Math.min(100, (lenDelta + widDelta) / 20)) * 0.3);
      if (fitScorePct > 98) fitScorePct = 98;
      if (fitScorePct < 15) fitScorePct = 15;

      // Potential cost saved vs buying/cutting a fresh prime 6000x2000mm plate
      const potentialCostSavedIdr = Math.round(offcut.approxWeightKg * offcut.costPerKg);

      return {
        offcut,
        fitScorePct,
        areaUtilizationPct,
        potentialCostSavedIdr,
        dimensionalFit: {
          lengthDeltaMm: Math.round(lenDelta),
          widthDeltaMm: Math.round(widDelta),
          sufficient: true
        }
      };
    });

    // Sort by best fit score descending
    suggestions.sort((a, b) => b.fitScorePct - a.fitScorePct);

    res.json({
      targetCriteria: {
        grade: targetGrade,
        thicknessMm: targetThk,
        lengthMm: targetLen,
        widthMm: targetWid,
        qty
      },
      matchCount: suggestions.length,
      suggestions
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute offcut suggestions', details: err?.message || String(err) });
  }
});

/**
 * 5. Reserve Material / Offcut for a Work Order
 */
materialRouter.post('/reserve', (req: Request, res: Response) => {
  try {
    const {
      workOrder,
      projectId,
      projectName,
      bomItemId,
      partNumber,
      sourceType,
      sourceMaterialId,
      materialGrade,
      thicknessMm,
      reservedQty,
      reservedWeightKg,
      assignedMachine,
      operatorName,
      notes
    } = req.body;

    if (!workOrder || !sourceMaterialId) {
      res.status(400).json({ error: 'workOrder and sourceMaterialId are required for reservation.' });
      return;
    }

    const reservationId = `RES-2026-${String(reservationsCache.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    // If source is offcut, mark offcut as reserved
    if (sourceType === 'reusable_offcut') {
      const offcut = offcutInventoryCache.find(o => o.id === sourceMaterialId);
      if (offcut) {
        offcut.status = 'reserved';
        offcut.allocatedWorkOrder = workOrder;
      }
    }

    const reservation: MaterialReservation = {
      id: reservationId,
      reservationNo: reservationId,
      workOrder,
      projectId: projectId || 'proj_1',
      projectName: projectName || workOrder,
      bomItemId: bomItemId || 'bom_item_1',
      partNumber: partNumber || 'PART-01',
      targetNestingCode: `NST-${workOrder.slice(-3)}`,
      sourceType: sourceType || 'prime_plate',
      sourceMaterialId,
      sourceMaterialName: `${materialGrade} ${thicknessMm}mm`,
      materialGrade: materialGrade || 'Steel',
      thicknessMm: Number(thicknessMm) || 0,
      reservedQty: Number(reservedQty) || 1,
      reservedWeightKg: Number(reservedWeightKg) || 100,
      assignedMachine: assignedMachine || 'cnc_plasma',
      operatorName: operatorName || 'Assigned Operator',
      status: 'reserved',
      reservedAt: now,
      notes
    };

    reservationsCache.unshift(reservation);

    res.json({
      success: true,
      reservationId,
      reservation
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reserve material', details: err?.message || String(err) });
  }
});

/**
 * 6. Material Variance & Yield Analytics Metrics (Recharts Data Source)
 */
materialRouter.get('/analytics/variance', (_req: Request, res: Response) => {
  try {
    const totalRaw = processingLogsCache.reduce((sum, l) => sum + l.rawStockWeightKg, 0);
    const totalGood = processingLogsCache.reduce((sum, l) => sum + l.goodPartsWeightKg, 0);
    const totalScrap = processingLogsCache.reduce((sum, l) => sum + l.scrapWeightKg, 0);
    const totalOffcut = processingLogsCache.reduce((sum, l) => sum + l.usableOffcutWeightKg, 0);

    const overallYield = totalRaw > 0 ? Number((((totalGood + totalOffcut) / totalRaw) * 100).toFixed(1)) : 92.4;

    // Cumulative Offcut Reuse Cost Savings
    const offcutSavings = offcutInventoryCache
      .filter(o => o.status === 'consumed' || o.status === 'reserved' || o.status === 'available')
      .reduce((sum, o) => sum + o.estimatedValue, 0);

    // Machine performance metrics
    const machinesList: CuttingMachineType[] = ['cnc_plasma', 'fiber_laser', 'oxy_fuel', 'bandsaw'];
    const machineMetrics = machinesList.map(mType => {
      const cfg = CUTTING_MACHINES[mType];
      const mLogs = processingLogsCache.filter(l => l.machine === mType);
      const mRaw = mLogs.reduce((acc, l) => acc + l.rawStockWeightKg, 0);
      const mGood = mLogs.reduce((acc, l) => acc + l.goodPartsWeightKg, 0);
      const mScrap = mLogs.reduce((acc, l) => acc + l.scrapWeightKg, 0);
      const mOffcut = mLogs.reduce((acc, l) => acc + l.usableOffcutWeightKg, 0);

      const yieldRatioPct = mRaw > 0 ? Number((((mGood + mOffcut) / mRaw) * 100).toFixed(1)) : (100 - cfg.benchmarkScrapRatePct);
      const scrapRatioPct = mRaw > 0 ? Number(((mScrap / mRaw) * 100).toFixed(1)) : cfg.benchmarkScrapRatePct;

      return {
        machine: mType,
        name: cfg.name,
        runsCount: mLogs.length || 4,
        totalRawKg: mRaw || 2500,
        goodPartsKg: mGood || 2280,
        scrapKg: mScrap || 120,
        yieldRatioPct,
        scrapRatioPct,
        targetScrapPct: cfg.benchmarkScrapRatePct
      };
    });

    // Monthly Savings Trend
    const monthlySavings = [
      { month: 'Jan', offcutsReusedKg: 420, savingsIdr: 16800000 },
      { month: 'Feb', offcutsReusedKg: 580, savingsIdr: 23200000 },
      { month: 'Mar', offcutsReusedKg: 790, savingsIdr: 31600000 },
      { month: 'Apr', offcutsReusedKg: 650, savingsIdr: 26000000 },
      { month: 'May', offcutsReusedKg: 910, savingsIdr: 36400000 },
      { month: 'Jun (MTD)', offcutsReusedKg: 1050, savingsIdr: 42000000 }
    ];

    // WO Consumption Variance
    const consumptionVarianceByWO = [
      {
        workOrder: 'WO-2026-001',
        projectName: 'Main Deck Piping Structural Assembly',
        plannedKg: 3100,
        actualKg: 3014,
        varianceKg: -86,
        variancePct: -2.8,
        yieldPct: 93.6
      },
      {
        workOrder: 'WO-2026-002',
        projectName: 'Exhaust Heat Shield Ducting',
        plannedKg: 1550,
        actualKg: 1507,
        varianceKg: -43,
        variancePct: -2.7,
        yieldPct: 97.1
      },
      {
        workOrder: 'WO-2026-003',
        projectName: 'Heavy Chute Wear Liner Replacement',
        plannedKg: 2200,
        actualKg: 2280,
        varianceKg: 80,
        variancePct: +3.6,
        yieldPct: 89.2
      },
      {
        workOrder: 'WO-2026-004',
        projectName: 'Mining Dump Body Rear Gate Pivot',
        plannedKg: 4800,
        actualKg: 4620,
        varianceKg: -180,
        variancePct: -3.7,
        yieldPct: 94.5
      }
    ];

    const kpiResponse: MaterialVarianceKPIs = {
      overallYieldPct: overallYield,
      targetYieldPct: 90.0,
      totalRawConsumedKg: totalRaw || 4521,
      totalGoodPartsKg: totalGood || 3800,
      totalScrapKg: totalScrap || 236,
      totalOffcutsReusedKg: 485,
      cumulativeCostSavedIdr: offcutSavings || 68250000,
      varianceRatePct: -1.9,
      machineMetrics,
      monthlySavings,
      consumptionVarianceByWO
    };

    res.json(kpiResponse);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute variance analytics', details: err?.message || String(err) });
  }
});

/**
 * 7. Query Target BOM Items for Material Cutting
 */
materialRouter.get('/bom-items', (_req: Request, res: Response) => {
  const sampleBomItems: BOMItemEntity[] = [
    {
      id: 'BOM-001',
      projectId: 'proj_1',
      projectName: 'Main Deck Piping Structural Assembly',
      workOrder: 'WO-2026-001',
      partNumber: 'AB-FP-101',
      description: 'Floor Plate Main Stiffener 12mm',
      materialGrade: 'Hardox 450',
      thicknessMm: 12,
      lengthMm: 1650,
      widthMm: 420,
      nestingCode: 'NST-793-04A',
      requiredQty: 12,
      processedQty: 8,
      unit: 'pcs',
      weightPerUnitKg: 65.3,
      totalPlannedWeightKg: 783.6,
      targetMachine: 'cnc_plasma',
      status: 'in_progress',
      mtcRequired: true,
      notes: 'Critical wear plate for body floor'
    },
    {
      id: 'BOM-002',
      projectId: 'proj_1',
      projectName: 'Main Deck Piping Structural Assembly',
      workOrder: 'WO-2026-001',
      partNumber: 'AB-BR-105',
      description: 'Heavy Flange Bracket 20mm',
      materialGrade: 'S355JR',
      thicknessMm: 20,
      lengthMm: 950,
      widthMm: 380,
      nestingCode: 'NST-BRK-02',
      requiredQty: 8,
      processedQty: 6,
      unit: 'pcs',
      weightPerUnitKg: 56.7,
      totalPlannedWeightKg: 453.6,
      targetMachine: 'oxy_fuel',
      status: 'in_progress',
      mtcRequired: true,
      notes: 'Structural gusset plates'
    },
    {
      id: 'BOM-003',
      projectId: 'proj_2',
      projectName: 'Exhaust Heat Shield Ducting System',
      workOrder: 'WO-2026-002',
      partNumber: 'AB-SH-202',
      description: 'Side Liner Heat Deflector 16mm',
      materialGrade: 'Bisalloy 400',
      thicknessMm: 16,
      lengthMm: 1800,
      widthMm: 500,
      nestingCode: 'NST-DEF-01',
      requiredQty: 16,
      processedQty: 12,
      unit: 'pcs',
      weightPerUnitKg: 113.0,
      totalPlannedWeightKg: 1808.0,
      targetMachine: 'fiber_laser',
      status: 'in_progress',
      mtcRequired: true
    },
    {
      id: 'BOM-004',
      projectId: 'proj_4',
      projectName: 'Mining Dump Body Rear Gate Pivot',
      workOrder: 'WO-2026-004',
      partNumber: 'AB-PV-301',
      description: 'Pivot Arm Lug Plate 20mm',
      materialGrade: 'S355JR',
      thicknessMm: 20,
      lengthMm: 1100,
      widthMm: 450,
      nestingCode: 'NST-PIVOT-01',
      requiredQty: 4,
      processedQty: 0,
      unit: 'pcs',
      weightPerUnitKg: 77.7,
      totalPlannedWeightKg: 310.8,
      targetMachine: 'cnc_plasma',
      status: 'pending',
      mtcRequired: true,
      notes: 'Candidate for remnant OFC-2026-004'
    }
  ];

  res.json({ bomItems: sampleBomItems });
});
