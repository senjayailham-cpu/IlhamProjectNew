import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  BOMItemEntity,
  CuttingMachineType,
  CUTTING_MACHINES,
  SpecValidationResponse,
  OffcutInventoryItem,
  OffcutSuggestion,
  User,
  Project
} from '../types';
import {
  Scan,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Printer,
  RotateCcw,
  Layers,
  Sparkles,
  ArrowRight,
  Maximize2,
  Tag,
  Factory,
  Cpu,
  Scissors,
  PackageCheck,
  Search,
  Camera,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';

interface MaterialProcessingKioskProps {
  currentUser: User;
  projects?: Project[];
  onNavigateToVariance?: () => void;
  onNavigateToStock?: () => void;
}

export const MaterialProcessingKiosk: React.FC<MaterialProcessingKioskProps> = ({
  currentUser,
  projects = [],
  onNavigateToVariance,
  onNavigateToStock
}) => {
  // Step State: 1 = Scan & Verify, 2 = Execution & Output, 3 = Offcut Label & Complete
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Available Work Order BOM items
  const [bomItems, setBomItems] = useState<BOMItemEntity[]>([]);
  const [selectedBomItem, setSelectedBomItem] = useState<BOMItemEntity | null>(null);
  const [isLoadingBoms, setIsLoadingBoms] = useState(true);

  // Step 1: Raw Material QR Verification State
  const [qrInput, setQrInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<SpecValidationResponse | null>(null);
  const [overrideSupervisorNote, setOverrideSupervisorNote] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  // Offcut Suggestion (prioritize reusable drops)
  const [reusableSuggestions, setReusableSuggestions] = useState<OffcutSuggestion[]>([]);
  const [isQueryingSuggestions, setIsQueryingSuggestions] = useState(false);
  const [selectedReusableOffcut, setSelectedReusableOffcut] = useState<OffcutInventoryItem | null>(null);

  // Step 2: Cutting Run Output Log State
  const [selectedMachine, setSelectedMachine] = useState<CuttingMachineType>('cnc_plasma');
  const [rawStockWeightKg, setRawStockWeightKg] = useState<number>(0);
  const [goodPartsQty, setGoodPartsQty] = useState<number>(1);
  const [goodPartsWeightKg, setGoodPartsWeightKg] = useState<number>(0);
  const [scrapWeightKg, setScrapWeightKg] = useState<number>(0);

  // Remnant / Usable Offcut Toggle & Details
  const [hasUsableOffcut, setHasUsableOffcut] = useState<boolean>(true);
  const [offcutLengthMm, setOffcutLengthMm] = useState<number>(1600);
  const [offcutWidthMm, setOffcutWidthMm] = useState<number>(750);
  const [offcutShape, setOffcutShape] = useState<'rectangular' | 'l_shaped' | 'triangular' | 'irregular'>('rectangular');
  const [offcutRackLocation, setOffcutRackLocation] = useState<string>('RACK-A2-BAY1');

  // Step 3: Generated Offcut & QR Label
  const [generatedOffcut, setGeneratedOffcut] = useState<OffcutInventoryItem | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [completedLogId, setCompletedLogId] = useState<string | null>(null);

  // Printable tag ref
  const labelPrintRef = useRef<HTMLDivElement>(null);

  // Fetch target BOM items on mount
  useEffect(() => {
    fetchBomItems();
  }, []);

  const fetchBomItems = async () => {
    setIsLoadingBoms(true);
    try {
      const res = await fetch('/api/materials/bom-items');
      if (res.ok) {
        const data = await res.json();
        if (data.bomItems && data.bomItems.length > 0) {
          setBomItems(data.bomItems);
          setSelectedBomItem(data.bomItems[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load BOM items:', err);
    } finally {
      setIsLoadingBoms(false);
    }
  };

  // Whenever a BOM item is selected, query offcut suggestions and auto-fill defaults
  useEffect(() => {
    if (!selectedBomItem) return;

    // Reset step 1 verification
    setQrInput('');
    setValidationResult(null);
    setSelectedReusableOffcut(null);
    setShowOverrideInput(false);
    setOverrideSupervisorNote('');

    // Pre-calculate estimated part weight based on density 7.85g/cm³: L * W * T * 7.85e-6
    const calculatedPartWeight = selectedBomItem.weightPerUnitKg ||
      Number(((selectedBomItem.lengthMm * selectedBomItem.widthMm * selectedBomItem.thicknessMm * 7.85) / 1000000).toFixed(1));

    const remainingQty = Math.max(1, selectedBomItem.requiredQty - selectedBomItem.processedQty);
    setGoodPartsQty(remainingQty);
    setGoodPartsWeightKg(Number((calculatedPartWeight * remainingQty).toFixed(1)));
    setSelectedMachine(selectedBomItem.targetMachine || 'cnc_plasma');

    // Default full plate weight for 6000x2000mm standard plate
    const standardPlateWeight = Number(((6000 * 2000 * selectedBomItem.thicknessMm * 7.85) / 1000000).toFixed(1));
    setRawStockWeightKg(standardPlateWeight);
    setScrapWeightKg(Math.round(standardPlateWeight * 0.05)); // 5% nominal scrap

    // Query offcut suggestions
    queryOffcutSuggestions(selectedBomItem);
  }, [selectedBomItem]);

  const queryOffcutSuggestions = async (bom: BOMItemEntity) => {
    setIsQueryingSuggestions(true);
    try {
      const params = new URLSearchParams({
        grade: bom.materialGrade,
        thicknessMm: String(bom.thicknessMm),
        lengthMm: String(bom.lengthMm),
        widthMm: String(bom.widthMm),
        requiredQty: String(Math.max(1, bom.requiredQty - bom.processedQty))
      });
      const res = await fetch(`/api/materials/offcuts/suggest?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReusableSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.warn('Error querying offcut suggestions:', e);
    } finally {
      setIsQueryingSuggestions(false);
    }
  };

  // Calculate offcut weight automatically from dimensions
  const calculatedOffcutWeight = React.useMemo(() => {
    if (!selectedBomItem || !hasUsableOffcut) return 0;
    const factor = offcutShape === 'triangular' ? 0.5 : offcutShape === 'l_shaped' ? 0.75 : 1.0;
    const wt = (offcutLengthMm * offcutWidthMm * selectedBomItem.thicknessMm * 7.85 * factor) / 1000000;
    return Number(wt.toFixed(1));
  }, [offcutLengthMm, offcutWidthMm, selectedBomItem, hasUsableOffcut, offcutShape]);

  // Handle Verify QR
  const handleVerifyQR = async (codeToVerify?: string) => {
    const rawData = codeToVerify || qrInput;
    if (!rawData.trim() || !selectedBomItem) return;

    setIsValidating(true);
    try {
      const res = await fetch('/api/materials/validate-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawQrData: rawData,
          expectedGrade: selectedBomItem.materialGrade,
          expectedThicknessMm: selectedBomItem.thicknessMm,
          bomItemPartNumber: selectedBomItem.partNumber
        })
      });

      if (res.ok) {
        const data: SpecValidationResponse = await res.json();
        setValidationResult(data);

        // If matched, extract heat/mtc and apply plate details
        if (data.isValid || data.status === 'WARNING') {
          if (data.parsedData.thicknessMm && data.parsedData.thicknessMm > 0) {
            // Adjust raw stock weight
            const plateWt = Number(((6000 * 2000 * data.parsedData.thicknessMm * 7.85) / 1000000).toFixed(1));
            setRawStockWeightKg(plateWt);
          }
        }
      }
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // Quick preset loader for scanner demo
  const handleSelectPreset = (presetType: 'valid_hardox' | 'mismatch_ss304' | 'valid_bisalloy' | 'valid_s355') => {
    let payload = '';
    if (presetType === 'valid_hardox') {
      payload = 'AB-MAT|PL-5524|Hardox 450|12|6000x2000|HT-99214|MTC-2026-0182';
    } else if (presetType === 'mismatch_ss304') {
      payload = 'AB-MAT|PL-1092|SS304|6|3000x1500|HT-22019|MTC-2026-0044';
    } else if (presetType === 'valid_bisalloy') {
      payload = 'AB-MAT|PL-8831|Bisalloy 400|16|6000x2000|HT-77312|MTC-2026-0144';
    } else if (presetType === 'valid_s355') {
      payload = 'AB-MAT|PL-3112|S355JR|20|6000x2000|HT-66120|MTC-2026-0210';
    }
    setQrInput(payload);
    handleVerifyQR(payload);
  };

  // Use Reusable Offcut directly
  const handleSelectReusableOffcut = (suggestion: OffcutSuggestion) => {
    const o = suggestion.offcut;
    setSelectedReusableOffcut(o);
    const mockQr = o.qrCode || `AB-OFC|${o.id}|${o.materialGrade}|${o.thicknessMm}|${o.lengthMm}x${o.widthMm}|${o.heatNumber}|${o.mtcNumber}`;
    setQrInput(mockQr);
    setRawStockWeightKg(o.approxWeightKg);
    setValidationResult({
      isValid: true,
      status: 'MATCH',
      discrepancies: [],
      parsedData: {
        plateNo: o.id,
        grade: o.materialGrade,
        thicknessMm: o.thicknessMm,
        heatNumber: o.heatNumber,
        mtcNumber: o.mtcNumber,
        dimensions: `${o.lengthMm}x${o.widthMm}mm`,
        supplier: 'Shop Remnant Inventory'
      }
    });
  };

  // Transition from Step 1 to Step 2
  const handleProceedToExecution = () => {
    if (!validationResult) return;
    if (!validationResult.isValid && !overrideSupervisorNote) {
      setShowOverrideInput(true);
      return;
    }
    setCurrentStep(2);
  };

  // Submit Cutting Log & Register Offcut (Step 2 -> Step 3)
  const handleSubmitProcessingRun = async () => {
    if (!selectedBomItem) return;
    setIsSubmittingLog(true);

    try {
      const parsed = validationResult?.parsedData || {
        grade: selectedBomItem.materialGrade,
        thicknessMm: selectedBomItem.thicknessMm,
        heatNumber: 'HT-VERIFIED',
        mtcNumber: 'MTC-VERIFIED',
        plateNo: selectedReusableOffcut ? selectedReusableOffcut.id : 'PL-RAW-STOCK'
      };

      const usableOffcutPayload = hasUsableOffcut
        ? {
            lengthMm: offcutLengthMm,
            widthMm: offcutWidthMm,
            shape: offcutShape,
            approxWeightKg: calculatedOffcutWeight,
            rackLocation: offcutRackLocation,
            costPerKg: selectedBomItem.materialGrade.toLowerCase().includes('ss304') ? 78000 : 42000,
            notes: `Usable remnant from ${selectedBomItem.partNumber} cutting run (${selectedMachine.toUpperCase()})`
          }
        : undefined;

      const payload = {
        workOrder: selectedBomItem.workOrder,
        projectId: selectedBomItem.projectId,
        projectName: selectedBomItem.projectName,
        bomItemId: selectedBomItem.id,
        partNumber: selectedBomItem.partNumber,
        materialGrade: parsed.grade || selectedBomItem.materialGrade,
        thicknessMm: parsed.thicknessMm || selectedBomItem.thicknessMm,
        heatNumber: parsed.heatNumber || 'HT-SHOP-FLOOR',
        mtcNumber: parsed.mtcNumber || 'MTC-CERTIFIED',
        machine: selectedMachine,
        operatorId: currentUser?.id || 'emp_1',
        operatorName: currentUser?.name || 'Shop Operator',
        rawMaterialQr: qrInput,
        rawMaterialPlateNo: parsed.plateNo || 'PL-5524',
        rawStockWeightKg: rawStockWeightKg,
        goodPartsQty: goodPartsQty,
        goodPartsWeightKg: goodPartsWeightKg,
        scrapWeightKg: scrapWeightKg,
        usableOffcut: usableOffcutPayload,
        validationOverrideNote: overrideSupervisorNote || undefined
      };

      const res = await fetch('/api/materials/process-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setCompletedLogId(data.logId);

        if (data.createdOffcut) {
          setGeneratedOffcut(data.createdOffcut);
          // Generate visual QR Code
          try {
            const qrData = await QRCode.toDataURL(data.createdOffcut.qrCode, {
              width: 256,
              margin: 1,
              color: { dark: '#000000', light: '#ffffff' }
            });
            setGeneratedQrDataUrl(qrData);
          } catch (qrErr) {
            console.error('Failed to generate QR data URL:', qrErr);
          }
        }

        setCurrentStep(3);
      } else {
        const err = await res.json();
        alert(`Failed to save log: ${err?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Submit log error:', err);
      alert('Network or server error while submitting cutting log.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Reset Kiosk for new run
  const handleResetKiosk = () => {
    setCurrentStep(1);
    setQrInput('');
    setValidationResult(null);
    setGeneratedOffcut(null);
    setGeneratedQrDataUrl('');
    setCompletedLogId(null);
    setShowOverrideInput(false);
    setOverrideSupervisorNote('');
    setSelectedReusableOffcut(null);
    fetchBomItems();
  };

  // Print Label Action
  const handlePrintLabel = () => {
    window.print();
  };

  // Live Yield Ratio calculation
  const liveYieldRatioPct = React.useMemo(() => {
    if (!rawStockWeightKg || rawStockWeightKg <= 0) return 0;
    const effectiveOffcutWt = hasUsableOffcut ? calculatedOffcutWeight : 0;
    const yieldRatio = ((goodPartsWeightKg + effectiveOffcutWt) / rawStockWeightKg) * 100;
    return Math.min(100, Math.max(0, Number(yieldRatio.toFixed(1))));
  }, [rawStockWeightKg, goodPartsWeightKg, calculatedOffcutWeight, hasUsableOffcut]);

  return (
    <div className="space-y-6">
      {/* Top Industrial Header & Workflow Tracker */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-condensed font-black uppercase tracking-wider bg-red-600 text-white">
                SHOP-FLOOR MES
              </span>
              <span className="text-xs text-base-muted font-mono font-medium">
                Terminal ID: KIOSK-CUT-01 (Bay 1)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-condensed font-black tracking-wide text-base-text uppercase">
              Material Cutting & BOM Processing Kiosk
            </h1>
            <p className="text-xs sm:text-sm text-base-muted">
              Operator verification station: Validate steel grade & heat certificates, log cutting outputs, and register usable offcuts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToVariance && (
              <button
                onClick={onNavigateToVariance}
                className="px-3.5 py-2 rounded-lg bg-base-surface2 hover:bg-neutral-800 border border-base-border text-xs font-condensed font-bold uppercase tracking-wider text-base-text transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="h-4 w-4 text-amber-500" />
                <span>Yield & Variance Dashboard</span>
              </button>
            )}
            {onNavigateToStock && (
              <button
                onClick={onNavigateToStock}
                className="px-3.5 py-2 rounded-lg bg-base-surface2 hover:bg-neutral-800 border border-base-border text-xs font-condensed font-bold uppercase tracking-wider text-base-text transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Tag className="h-4 w-4 text-emerald-500" />
                <span>Offcut Stock</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Step Industrial Stepper */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-base-border pt-4">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              currentStep === 1
                ? 'bg-red-500/10 border-red-500/40 text-red-500 font-bold'
                : currentStep > 1
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-base-surface2/50 border-base-border text-base-muted'
            }`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-condensed font-black text-sm ${
              currentStep === 1 ? 'bg-red-600 text-white' : currentStep > 1 ? 'bg-emerald-600 text-white' : 'bg-base-surface2 text-base-muted'
            }`}>
              {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <div>
              <div className="text-xs font-condensed font-black uppercase tracking-wider">Step 1: Scan & Verify</div>
              <div className="text-[11px] opacity-80">QR Grade, Thickness & MTC Check</div>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              currentStep === 2
                ? 'bg-red-500/10 border-red-500/40 text-red-500 font-bold'
                : currentStep > 2
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-base-surface2/50 border-base-border text-base-muted'
            }`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-condensed font-black text-sm ${
              currentStep === 2 ? 'bg-red-600 text-white' : currentStep > 2 ? 'bg-emerald-600 text-white' : 'bg-base-surface2 text-base-muted'
            }`}>
              {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
            </div>
            <div>
              <div className="text-xs font-condensed font-black uppercase tracking-wider">Step 2: Output Logging</div>
              <div className="text-[11px] opacity-80">Good Parts, Scrap & Offcut Drop</div>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              currentStep === 3
                ? 'bg-red-500/10 border-red-500/40 text-red-500 font-bold'
                : 'bg-base-surface2/50 border-base-border text-base-muted'
            }`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-condensed font-black text-sm ${
              currentStep === 3 ? 'bg-red-600 text-white' : 'bg-base-surface2 text-base-muted'
            }`}>
              3
            </div>
            <div>
              <div className="text-xs font-condensed font-black uppercase tracking-wider">Step 3: Offcut QR Label</div>
              <div className="text-[11px] opacity-80">Rack Assignment & Tag Print</div>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: SCAN & VERIFICATION */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: WO BOM Requirement Selector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-red-500" />
                  Target Work Order BOM Item
                </span>
                <span className="text-[11px] font-mono text-base-muted">
                  {bomItems.length} Requirements Active
                </span>
              </div>

              {/* BOM Requirement Cards */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {isLoadingBoms ? (
                  <div className="p-6 text-center text-xs text-base-muted">Loading BOM requirements...</div>
                ) : bomItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-base-muted">No active BOM cutting items found.</div>
                ) : (
                  bomItems.map((bom) => {
                    const isSelected = selectedBomItem?.id === bom.id;
                    return (
                      <div
                        key={bom.id}
                        onClick={() => setSelectedBomItem(bom)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-red-500/10 border-red-500/60 shadow-xs ring-1 ring-red-500/30'
                            : 'bg-base-surface2/60 hover:bg-base-surface2 border-base-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-base-text">{bom.partNumber}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-condensed font-black uppercase bg-neutral-800 text-neutral-300">
                                {bom.workOrder}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-base-text mt-0.5">{bom.description}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {bom.nestingCode}
                          </span>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-base-border/50 flex flex-wrap items-center justify-between text-[11px] text-base-muted font-mono">
                          <div>
                            <span className="text-base-text font-bold">{bom.materialGrade}</span> — {bom.thicknessMm}mm
                          </div>
                          <div>
                            Req: <span className="text-base-text font-bold">{bom.requiredQty - bom.processedQty}</span> / {bom.requiredQty} {bom.unit}
                          </div>
                          <div>
                            {bom.lengthMm}×{bom.widthMm}mm
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected BOM Spec Details Card */}
              {selectedBomItem && (
                <div className="bg-base-surface2 p-4 rounded-lg border border-base-border/80 space-y-2 text-xs">
                  <div className="font-condensed font-black uppercase tracking-wider text-base-text flex items-center justify-between">
                    <span>Target Spec Checklist</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      MTC Required: {selectedBomItem.mtcRequired ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-base-surface p-2 rounded border border-base-border">
                      <div className="text-[10px] text-base-muted uppercase font-sans">Grade</div>
                      <div className="font-black text-red-500 text-sm">{selectedBomItem.materialGrade}</div>
                    </div>
                    <div className="bg-base-surface p-2 rounded border border-base-border">
                      <div className="text-[10px] text-base-muted uppercase font-sans">Thickness</div>
                      <div className="font-black text-base-text text-sm">{selectedBomItem.thicknessMm} mm</div>
                    </div>
                    <div className="bg-base-surface p-2 rounded border border-base-border">
                      <div className="text-[10px] text-base-muted uppercase font-sans">Dimensions</div>
                      <div className="font-bold text-base-text">{selectedBomItem.lengthMm} × {selectedBomItem.widthMm} mm</div>
                    </div>
                    <div className="bg-base-surface p-2 rounded border border-base-border">
                      <div className="text-[10px] text-base-muted uppercase font-sans">Unit Weight</div>
                      <div className="font-bold text-base-text">~{selectedBomItem.weightPerUnitKg || 65} kg / pc</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reusable Offcut Suggestion Banner (ENGINE) */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-condensed font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
                  Reusable Offcut Suggestion Engine
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                  {reusableSuggestions.length} Available in Rack
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Prioritize using existing offcuts before requesting or cutting fresh prime raw plates.
              </p>

              {isQueryingSuggestions ? (
                <div className="text-xs text-base-muted py-2">Searching offcut inventory...</div>
              ) : reusableSuggestions.length === 0 ? (
                <div className="text-xs text-base-muted bg-base-surface2 p-3 rounded border border-base-border">
                  No matching offcut found with sufficient dimensions. Prime stock required.
                </div>
              ) : (
                <div className="space-y-2">
                  {reusableSuggestions.slice(0, 2).map((sugg) => (
                    <div
                      key={sugg.offcut.id}
                      className="bg-base-surface border border-emerald-500/40 p-3 rounded-lg flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-emerald-400">{sugg.offcut.id}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">
                            Fit: {sugg.fitScorePct}%
                          </span>
                        </div>
                        <div className="text-xs text-base-text font-mono mt-0.5">
                          {sugg.offcut.materialGrade} {sugg.offcut.thicknessMm}mm — {sugg.offcut.lengthMm}×{sugg.offcut.widthMm}mm (~{sugg.offcut.approxWeightKg}kg)
                        </div>
                        <div className="text-[11px] text-base-muted mt-0.5">
                          Location: <strong className="text-base-text">{sugg.offcut.rackLocation}</strong> | Heat: {sugg.offcut.heatNumber}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectReusableOffcut(sugg)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded transition-colors shrink-0 cursor-pointer shadow-xs"
                      >
                        Use Offcut
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Scan & Real-time Spec Validation */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                  <Scan className="h-4 w-4 text-red-500" />
                  Raw Material QR / Barcode Scanner
                </span>
                <span className="text-[11px] text-base-muted">Hardware scanner or manual entry</span>
              </div>

              {/* QR Input / Scanner Field */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyQR();
                    }}
                    placeholder="Scan Plate QR Barcode or Paste Data (e.g. AB-MAT|PL-5524|Hardox 450|12|...)"
                    className="w-full bg-base-surface2 border-2 border-base-border focus:border-red-500 rounded-lg px-4 py-3 pl-11 text-xs sm:text-sm font-mono text-base-text outline-none transition-all placeholder:text-neutral-500"
                  />
                  <Scan className="absolute left-3.5 top-3.5 h-4 w-4 text-base-muted" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-base-muted uppercase font-condensed">Simulation Presets:</span>
                    <button
                      onClick={() => handleSelectPreset('valid_hardox')}
                      className="px-2 py-1 text-[11px] font-mono rounded bg-base-surface2 hover:bg-neutral-800 border border-base-border text-base-text cursor-pointer transition-colors"
                      title="Load Hardox 450 12mm QR"
                    >
                      Plate PL-5524 (Hardox 12mm)
                    </button>
                    <button
                      onClick={() => handleSelectPreset('valid_bisalloy')}
                      className="px-2 py-1 text-[11px] font-mono rounded bg-base-surface2 hover:bg-neutral-800 border border-base-border text-base-text cursor-pointer transition-colors"
                      title="Load Bisalloy 400 16mm QR"
                    >
                      Plate PL-8831 (Bisalloy 16mm)
                    </button>
                    <button
                      onClick={() => handleSelectPreset('mismatch_ss304')}
                      className="px-2 py-1 text-[11px] font-mono rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 cursor-pointer transition-colors font-bold"
                      title="Simulate Wrong Plate Grade Mismatch"
                    >
                      ⚠️ Test Mismatch (SS304 6mm)
                    </button>
                  </div>

                  <button
                    onClick={() => handleVerifyQR()}
                    disabled={!qrInput.trim() || isValidating}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isValidating ? (
                      <span className="animate-spin">⌛</span>
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>Verify Material</span>
                  </button>
                </div>
              </div>

              {/* Validation Status & Discrepancies Alert Screen */}
              {validationResult ? (
                <div
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    validationResult.status === 'MATCH'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : validationResult.status === 'WARNING'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-red-500/15 border-red-500/60 text-red-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {validationResult.status === 'MATCH' ? (
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        </div>
                      ) : validationResult.status === 'WARNING' ? (
                        <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-amber-400" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 animate-pulse">
                          <ShieldAlert className="h-5 w-5 text-red-500" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-condensed font-black uppercase text-sm sm:text-base tracking-wide">
                          {validationResult.status === 'MATCH'
                            ? 'BOM SPECIFICATION VERIFIED — READY FOR CUT'
                            : validationResult.status === 'WARNING'
                            ? 'SPECIFICATION WARNINGS DETECTED'
                            : 'CRITICAL MATERIAL MISMATCH BLOCKED'}
                        </h4>
                        <div className="text-xs opacity-90 font-mono">
                          Plate: {validationResult.parsedData.plateNo || 'RAW-STOCK'} | Grade: {validationResult.parsedData.grade || 'Unknown'} | Thk: {validationResult.parsedData.thicknessMm}mm
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900 border border-neutral-700">
                      {validationResult.status}
                    </span>
                  </div>

                  {/* Discrepancies List */}
                  {validationResult.discrepancies.length > 0 && (
                    <div className="bg-neutral-950/50 p-3 rounded-lg border border-neutral-800 space-y-1.5 text-xs font-mono">
                      <div className="font-sans font-bold text-[10px] uppercase tracking-wider text-neutral-400">
                        Discrepancy Details:
                      </div>
                      {validationResult.discrepancies.map((disc, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-red-400">
                          <span className="text-red-500 font-bold">•</span>
                          <span>{disc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Scanned Traceability Metadata Table */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
                    <div className="bg-neutral-900/60 p-2 rounded border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 uppercase font-sans block">Heat / Melt #</span>
                      <strong className="text-base-text">{validationResult.parsedData.heatNumber || 'N/A'}</strong>
                    </div>
                    <div className="bg-neutral-900/60 p-2 rounded border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 uppercase font-sans block">MTC Certificate #</span>
                      <strong className="text-base-text">{validationResult.parsedData.mtcNumber || 'N/A'}</strong>
                    </div>
                    <div className="bg-neutral-900/60 p-2 rounded border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 uppercase font-sans block">Plate Dimensions</span>
                      <strong className="text-base-text">{validationResult.parsedData.dimensions || '6000x2000'}</strong>
                    </div>
                    <div className="bg-neutral-900/60 p-2 rounded border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 uppercase font-sans block">Traceability</span>
                      <strong className="text-emerald-400">Class-1 Verified</strong>
                    </div>
                  </div>

                  {/* Supervisor Override Input if Mismatched */}
                  {!validationResult.isValid && (
                    <div className="pt-2 border-t border-red-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs text-red-300">
                        <span>Do not cut mismatched material without authorized engineering approval!</span>
                        <button
                          type="button"
                          onClick={() => setShowOverrideInput(!showOverrideInput)}
                          className="text-[11px] font-bold underline hover:text-white cursor-pointer"
                        >
                          {showOverrideInput ? 'Hide Override' : 'Supervisor Override'}
                        </button>
                      </div>

                      {showOverrideInput && (
                        <div className="space-y-1.5 bg-red-950/40 p-3 rounded-lg border border-red-500/40">
                          <label className="text-[11px] font-bold uppercase text-red-200 block">
                            Supervisor Engineering Sign-Off Note:
                          </label>
                          <input
                            type="text"
                            value={overrideSupervisorNote}
                            onChange={(e) => setOverrideSupervisorNote(e.target.value)}
                            placeholder="Enter engineering change note or concession reference (e.g. Approved per ECN-401 by Lead Eng)"
                            className="w-full bg-neutral-900 border border-red-500/50 rounded px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-base-border rounded-xl space-y-2 text-base-muted">
                  <Camera className="h-8 w-8 mx-auto text-base-muted opacity-50" />
                  <div className="text-sm font-condensed font-bold uppercase tracking-wider text-base-text">
                    Waiting for Material QR Scan
                  </div>
                  <p className="text-xs max-w-sm mx-auto">
                    Scan the barcode label physically affixed to the raw steel plate or pallet to verify grade, thickness, and MTC certificate.
                  </p>
                </div>
              )}

              {/* Action Buttons to Proceed */}
              <div className="flex items-center justify-between pt-2 border-t border-base-border">
                <span className="text-xs text-base-muted font-mono">
                  Operator: <strong>{currentUser?.name || 'Operator'}</strong>
                </span>

                <button
                  onClick={handleProceedToExecution}
                  disabled={!validationResult || (!validationResult.isValid && !overrideSupervisorNote)}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>Proceed to Cutting Execution</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CUTTING EXECUTION & OUTPUT LOGGING */}
      {currentStep === 2 && (
        <div className="bg-base-surface border border-base-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-condensed font-black bg-red-600 text-white uppercase">
                  ACTIVE CUTTING RUN
                </span>
                <span className="font-mono text-xs text-base-muted">
                  WO: <strong>{selectedBomItem?.workOrder}</strong> | Part: <strong>{selectedBomItem?.partNumber}</strong>
                </span>
              </div>
              <h3 className="text-lg font-condensed font-black text-base-text uppercase tracking-wide mt-1">
                Cutting Execution & Material Output Logging
              </h3>
            </div>

            {/* Live Yield Ratio Gauge */}
            <div className="flex items-center gap-3 bg-base-surface2 p-3 rounded-lg border border-base-border">
              <div className="text-right">
                <div className="text-[10px] text-base-muted uppercase font-condensed">Live Material Yield</div>
                <div className={`font-mono font-black text-lg ${
                  liveYieldRatioPct >= 90 ? 'text-emerald-400' : liveYieldRatioPct >= 80 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {liveYieldRatioPct}%
                </div>
              </div>
              <div className="h-10 w-1 bg-base-border rounded" />
              <div className="text-xs text-base-muted font-mono">
                <div>Good: {goodPartsWeightKg} kg</div>
                <div>Offcut: {hasUsableOffcut ? calculatedOffcutWeight : 0} kg</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Machine Selector */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted">
                Assigned Workstation / Cutting Machine
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(CUTTING_MACHINES) as CuttingMachineType[]).map((mKey) => {
                  const m = CUTTING_MACHINES[mKey];
                  const isSel = selectedMachine === mKey;
                  return (
                    <button
                      key={mKey}
                      type="button"
                      onClick={() => setSelectedMachine(mKey)}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-red-500/10 border-red-500 text-red-500 font-bold shadow-xs'
                          : 'bg-base-surface2 hover:bg-neutral-800 border-base-border text-base-muted'
                      }`}
                    >
                      <div className="font-condensed font-black text-xs uppercase">{m.code}</div>
                      <div className="text-[11px] truncate font-sans text-base-text">{m.name}</div>
                      <div className="text-[10px] text-base-muted font-mono mt-1">Scrap: ~{m.benchmarkScrapRatePct}%</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Raw Stock Ingot / Plate Weight */}
            <div className="space-y-1.5">
              <label className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted">
                Raw Stock Plate Weight (Kg)
              </label>
              <input
                type="number"
                min="1"
                value={rawStockWeightKg}
                onChange={(e) => setRawStockWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full bg-base-surface2 border border-base-border focus:border-red-500 rounded-lg p-2.5 font-mono text-sm font-bold text-base-text outline-none"
              />
              <span className="text-[10px] text-base-muted">Loaded plate mass on cutting bed</span>
            </div>

            {/* Scrap / Dross Weight */}
            <div className="space-y-1.5">
              <label className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted">
                Skeleton Scrap & Dross (Kg)
              </label>
              <input
                type="number"
                min="0"
                value={scrapWeightKg}
                onChange={(e) => setScrapWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full bg-base-surface2 border border-base-border focus:border-red-500 rounded-lg p-2.5 font-mono text-sm font-bold text-red-400 outline-none"
              />
              <span className="text-[10px] text-base-muted">Unusable skeleton and kerf slag</span>
            </div>
          </div>

          {/* Good Parts Cut Output */}
          <div className="bg-base-surface2 p-4 rounded-xl border border-base-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-text flex items-center gap-1.5">
                <PackageCheck className="h-4 w-4 text-emerald-400" />
                Good Finished Parts Produced
              </span>
              <span className="text-[11px] font-mono text-base-muted">
                BOM Target: {selectedBomItem?.partNumber} ({selectedBomItem?.materialGrade} {selectedBomItem?.thicknessMm}mm)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-base-muted uppercase">Good Parts Count (Pcs)</label>
                <input
                  type="number"
                  min="1"
                  value={goodPartsQty}
                  onChange={(e) => {
                    const q = parseInt(e.target.value) || 1;
                    setGoodPartsQty(q);
                    if (selectedBomItem) {
                      const calculatedPartWeight = selectedBomItem.weightPerUnitKg ||
                        Number(((selectedBomItem.lengthMm * selectedBomItem.widthMm * selectedBomItem.thicknessMm * 7.85) / 1000000).toFixed(1));
                      setGoodPartsWeightKg(Number((calculatedPartWeight * q).toFixed(1)));
                    }
                  }}
                  className="w-full bg-base-surface border border-base-border rounded-lg p-2 font-mono text-sm font-bold text-base-text"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-base-muted uppercase">Total Good Parts Mass (Kg)</label>
                <input
                  type="number"
                  min="0"
                  value={goodPartsWeightKg}
                  onChange={(e) => setGoodPartsWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full bg-base-surface border border-base-border rounded-lg p-2 font-mono text-sm font-bold text-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Usable Remnant / Offcut Drop Details */}
          <div className="bg-base-surface2 p-4 rounded-xl border border-base-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasOffcut"
                  checked={hasUsableOffcut}
                  onChange={(e) => setHasUsableOffcut(e.target.checked)}
                  className="h-4 w-4 rounded border-base-border text-red-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="hasOffcut" className="text-xs font-condensed font-black uppercase tracking-wider text-base-text cursor-pointer">
                  Usable Offcut Remnant Saved? (Do not scrap usable drops)
                </label>
              </div>

              {hasUsableOffcut && (
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Estimated Drop Mass: ~{calculatedOffcutWeight} Kg
                </span>
              )}
            </div>

            {hasUsableOffcut && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-base-muted uppercase">Remnant Length (mm)</label>
                  <input
                    type="number"
                    value={offcutLengthMm}
                    onChange={(e) => setOffcutLengthMm(parseInt(e.target.value) || 0)}
                    className="w-full bg-base-surface border border-base-border rounded p-2 text-xs font-mono font-bold text-base-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-base-muted uppercase">Remnant Width (mm)</label>
                  <input
                    type="number"
                    value={offcutWidthMm}
                    onChange={(e) => setOffcutWidthMm(parseInt(e.target.value) || 0)}
                    className="w-full bg-base-surface border border-base-border rounded p-2 text-xs font-mono font-bold text-base-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-base-muted uppercase">Geometry / Shape</label>
                  <select
                    value={offcutShape}
                    onChange={(e: any) => setOffcutShape(e.target.value)}
                    className="w-full bg-base-surface border border-base-border rounded p-2 text-xs font-mono font-bold text-base-text"
                  >
                    <option value="rectangular">Rectangular Drop</option>
                    <option value="l_shaped">L-Shaped Corner</option>
                    <option value="triangular">Triangular</option>
                    <option value="irregular">Irregular Plate Remnant</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-base-muted uppercase">Storage Rack Location</label>
                  <input
                    type="text"
                    value={offcutRackLocation}
                    onChange={(e) => setOffcutRackLocation(e.target.value)}
                    placeholder="e.g. RACK-A2-BAY1"
                    className="w-full bg-base-surface border border-base-border rounded p-2 text-xs font-mono font-bold text-base-text uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stepper Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-base-border">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 bg-base-surface2 hover:bg-neutral-800 border border-base-border text-xs font-condensed font-bold uppercase tracking-wider text-base-text rounded-lg transition-colors cursor-pointer"
            >
              Back to Verification
            </button>

            <button
              onClick={handleSubmitProcessingRun}
              disabled={isSubmittingLog}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              {isSubmittingLog ? (
                <span>Recording Cutting Output...</span>
              ) : (
                <>
                  <span>Commit Cutting Log & Generate Offcut QR</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: OFFCUT QR LABEL GENERATION & STORAGE REGISTRY */}
      {currentStep === 3 && (
        <div className="bg-base-surface border border-base-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-condensed font-black bg-emerald-600 text-white uppercase">
                  RUN COMPLETED & LOGGED
                </span>
                <span className="font-mono text-xs text-base-muted">
                  Log Reference: <strong>{completedLogId || 'CLOG-2026-0099'}</strong>
                </span>
              </div>
              <h3 className="text-lg font-condensed font-black text-base-text uppercase tracking-wide mt-1">
                Material Output Registered & Offcut Barcode Label
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintLabel}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print QR Label</span>
              </button>

              <button
                onClick={handleResetKiosk}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Start Next Run</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Industrial Printable QR Tag Badge */}
            <div className="lg:col-span-6 flex justify-center">
              {generatedOffcut ? (
                <div
                  ref={labelPrintRef}
                  className="w-full max-w-md bg-white text-black p-5 rounded-xl border-4 border-black shadow-lg font-mono space-y-3"
                  style={{ minHeight: '340px' }}
                >
                  <div className="border-b-2 border-black pb-2 flex items-center justify-between">
                    <div>
                      <div className="font-black text-xs tracking-widest text-red-700">AUSTIN BATAM FABRICATION</div>
                      <div className="text-[10px] font-bold text-neutral-600 uppercase">Usable Remnant / Offcut Inventory</div>
                    </div>
                    <span className="px-2 py-0.5 bg-black text-white text-[11px] font-black rounded">
                      CLASS-1 TRACEABLE
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Visual QR Code */}
                    <div className="shrink-0 bg-white p-1 border-2 border-black rounded">
                      {generatedQrDataUrl ? (
                        <img src={generatedQrDataUrl} alt="Offcut QR" className="h-28 w-28" />
                      ) : (
                        <div className="h-28 w-28 bg-neutral-200 flex items-center justify-center text-[10px]">
                          QR Processing
                        </div>
                      )}
                    </div>

                    {/* Bold Spec Info */}
                    <div className="space-y-1 text-xs">
                      <div className="text-[10px] text-neutral-500 uppercase">Offcut ID</div>
                      <div className="font-black text-base tracking-tight">{generatedOffcut.id}</div>

                      <div className="text-[10px] text-neutral-500 uppercase mt-1">Grade & Thickness</div>
                      <div className="font-black text-base text-red-700">
                        {generatedOffcut.materialGrade} — {generatedOffcut.thicknessMm}mm
                      </div>

                      <div className="text-[10px] text-neutral-500 uppercase mt-1">Dimensions</div>
                      <div className="font-bold text-sm">
                        {generatedOffcut.lengthMm} × {generatedOffcut.widthMm} mm
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] border-t-2 border-black pt-2">
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase">Heat / Melt #</span>
                      <strong className="text-black">{generatedOffcut.heatNumber}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase">MTC Cert #</span>
                      <strong className="text-black">{generatedOffcut.mtcNumber}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase">Rack Location</span>
                      <strong className="text-black bg-neutral-200 px-1 rounded">{generatedOffcut.rackLocation}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[9px] uppercase">Approx Mass</span>
                      <strong className="text-black">~{generatedOffcut.approxWeightKg} Kg</strong>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-neutral-400 pt-1 text-[9px] text-neutral-600 flex justify-between">
                    <span>Source WO: {generatedOffcut.sourceWorkOrder}</span>
                    <span>Date: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-base-surface2 p-8 rounded-xl border border-base-border text-center space-y-2 text-base-muted">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                  <div className="font-condensed font-black text-base text-base-text uppercase">
                    Run Completed Without Remnant
                  </div>
                  <p className="text-xs">
                    All material consumed into good parts and skeleton scrap. Stock deducted successfully.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Run Summary Statistics */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-base-surface2 p-5 rounded-xl border border-base-border space-y-3">
                <span className="text-xs font-condensed font-black uppercase tracking-wider text-base-muted">
                  Material Balance Reconciliation
                </span>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded bg-base-surface border border-base-border">
                    <span className="text-base-muted">Initial Raw Stock Mass:</span>
                    <strong className="text-base-text">{rawStockWeightKg} Kg</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-base-surface border border-base-border">
                    <span className="text-emerald-400 font-bold">Good Finished Parts:</span>
                    <strong className="text-emerald-400">{goodPartsQty} pcs ({goodPartsWeightKg} Kg)</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-base-surface border border-base-border">
                    <span className="text-blue-400 font-bold">Usable Remnant Offcut:</span>
                    <strong className="text-blue-400">{hasUsableOffcut ? calculatedOffcutWeight : 0} Kg</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-base-surface border border-base-border">
                    <span className="text-red-400 font-bold">Dross & Skeleton Scrap:</span>
                    <strong className="text-red-400">{scrapWeightKg} Kg</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-base-border flex items-center justify-between text-xs">
                  <span className="text-base-muted font-mono">Realized Material Yield:</span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    {liveYieldRatioPct}%
                  </span>
                </div>
              </div>

              {generatedOffcut && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl space-y-2 text-xs text-emerald-300">
                  <div className="font-condensed font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    Offcut Registered in Inventory
                  </div>
                  <p>
                    Item <strong>{generatedOffcut.id}</strong> is now cataloged in <strong>{generatedOffcut.rackLocation}</strong>. The Suggestion Engine will automatically prioritize this remnant for upcoming Work Orders requiring {generatedOffcut.materialGrade} {generatedOffcut.thicknessMm}mm steel!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
