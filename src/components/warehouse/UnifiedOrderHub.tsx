import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Layers,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  BomTemplate,
  Employee,
  MaterialConsumptionLog,
  MaterialItem,
  MaterialRequest,
  MaterialRequestStatus,
  MaterialRequestUrgency,
  Project,
  User,
  WireLog,
} from '../../types';
import { can } from '../../utils/permissions';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../utils/costEngine';
import {
  buildCriticalRestockLines,
  buildProjectNeedsSuggestions,
  buildQuickPresetLines,
  buildUnifiedCatalog,
  calculateCartSummary,
  catalogItemToCartLine,
  filterUnifiedCatalog,
  mergeCartLines,
  OrderExecutionMode,
  QuickPresetKey,
  UnifiedCartLine,
  UnifiedCatalogCategory,
  UnifiedCatalogItem,
  validateCartForMode,
} from '../../utils/unifiedOrderEngine';

interface UnifiedOrderHubProps {
  materials: MaterialItem[];
  materialRequests: MaterialRequest[];
  projects: Project[];
  employees: Employee[];
  bomTemplates?: BomTemplate[];
  currentUser: User;
  onAddMaterialRequest: (req: Omit<MaterialRequest, 'id' | 'mrNo'>) => void | Promise<void>;
  onUpdateMaterialRequestStatus: (
    id: string,
    status: MaterialRequestStatus,
    extra?: { approvedBy?: string; rejectedReason?: string; issuedBy?: string }
  ) => void | Promise<void>;
  onAddConsumptionLog: (log: Omit<MaterialConsumptionLog, 'id'>) => Promise<void>;
  onAddWireLog?: (log: Omit<WireLog, 'id'>) => Promise<void>;
  onUpdateMaterialStock: (id: string, newStock: number) => void;
  onNavigateSubTab?: (tab: 'order' | 'materials' | 'consumable' | 'kpi') => void;
}

const CART_STORAGE_KEY = 'unified_order_hub_cart_v1';

const CATEGORY_FILTERS: Array<{
  id: UnifiedCatalogCategory;
  label: string;
}> = [
  { id: 'all', label: 'Semua Item' },
  { id: 'critical', label: 'Stok Kritis' },
  { id: 'project_material', label: 'Material Proyek' },
  { id: 'wire', label: 'Kawat Las' },
  { id: 'welding_consumable', label: 'Consumable Las' },
  { id: 'ppe', label: 'PPE / Safety' },
  { id: 'paint_chemical', label: 'Cat & Kimia' },
  { id: 'tools_other', label: 'Tools & Lainnya' },
];

const STOCK_STATUS_DISPLAY: Record<
  UnifiedCatalogItem['stockStatus'],
  { label: string; className: string }
> = {
  out: {
    label: 'Habis',
    className: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/30',
  },
  low: {
    label: 'Tipis',
    className: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  ok: {
    label: 'Aman',
    className: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  project_part: {
    label: 'Part Proyek',
    className: 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
};

const MR_STATUS_DISPLAY: Record<
  MaterialRequestStatus,
  { label: string; className: string }
> = {
  Draft: {
    label: 'Draft',
    className: 'text-base-muted bg-base-surface2 border-base-border',
  },
  Submitted: {
    label: 'Menunggu',
    className: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  Approved: {
    label: 'Disetujui',
    className: 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  Issued: {
    label: 'Dikeluarkan',
    className: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  Rejected: {
    label: 'Ditolak',
    className: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/30',
  },
};

export default function UnifiedOrderHub({
  materials,
  materialRequests,
  projects,
  employees,
  bomTemplates: propBomTemplates,
  currentUser,
  onAddMaterialRequest,
  onUpdateMaterialRequestStatus,
  onAddConsumptionLog,
  onAddWireLog,
  onUpdateMaterialStock,
  onNavigateSubTab,
}: UnifiedOrderHubProps) {
  const currency = useAppStore((s) => s.currency);
  const exchangeRates = useAppStore((s) => s.exchangeRates);
  const storeBomTemplates = useAppStore((s) => s.bomTemplates);
  const bomTemplates = propBomTemplates?.length ? propBomTemplates : storeBomTemplates;

  const canRequestMr = can(currentUser, 'requestMaterial');
  const canDirectCheckout =
    can(currentUser, 'issueMaterial') ||
    can(currentUser, 'manageMaterials') ||
    can(currentUser, 'manageWireLog');
  const canApproveOrIssueMr = can(currentUser, 'issueMaterial');

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isArchived && p.status !== 'completed'),
    [projects]
  );
  const activeEmployees = useMemo(
    () => employees.filter((e) => !e.isExEmployee),
    [employees]
  );

  // Filter & Catalog States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<UnifiedCatalogCategory>('all');
  const [showProjectBomPanel, setShowProjectBomPanel] = useState(false);

  // Cart State (persisted across tab switches in session)
  const [cartLines, setCartLines] = useState<UnifiedCartLine[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore invalid storage
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
    } catch {
      // ignore storage quota
    }
  }, [cartLines]);

  // Execution & Context States
  const [executionMode, setExecutionMode] = useState<OrderExecutionMode>(
    canRequestMr ? 'request_mr' : 'direct_checkout'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [urgency, setUrgency] = useState<MaterialRequestUrgency>('Normal');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');

  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // Inline reject state for mini MR queue (avoids window.prompt)
  const [rejectingMrId, setRejectingMrId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedAssembly = useMemo(
    () => selectedProject?.assemblies?.find((a) => a.id === selectedAssemblyId) || null,
    [selectedProject, selectedAssemblyId]
  );

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => e.id === selectedEmployeeId) || null,
    [activeEmployees, selectedEmployeeId]
  );

  // Build unified catalog including selected project's MaterialProcessing items
  const unifiedCatalog = useMemo(
    () => buildUnifiedCatalog(materials, selectedProject, true),
    [materials, selectedProject]
  );

  const filteredCatalog = useMemo(
    () => filterUnifiedCatalog(unifiedCatalog, searchQuery, categoryFilter),
    [unifiedCatalog, searchQuery, categoryFilter]
  );

  // Quick KPI counts
  const criticalLines = useMemo(() => buildCriticalRestockLines(materials), [materials]);
  const pendingMrCount = useMemo(
    () =>
      materialRequests.filter((mr) => mr.status === 'Submitted' || mr.status === 'Approved').length,
    [materialRequests]
  );

  // Project / BOM smart suggestions for the currently selected project
  const projectSuggestions = useMemo(
    () => buildProjectNeedsSuggestions(selectedProject, bomTemplates, materials, materialRequests),
    [selectedProject, bomTemplates, materials, materialRequests]
  );

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cartLines.forEach((l) => map.set(l.materialId, l.qty));
    return map;
  }, [cartLines]);

  const cartSummary = useMemo(() => calculateCartSummary(cartLines), [cartLines]);

  const cartValidation = useMemo(
    () => validateCartForMode(cartLines, executionMode, materials),
    [cartLines, executionMode, materials]
  );

  const validationIssueMap = useMemo(() => {
    const map = new Map<string, string>();
    cartValidation.issues.forEach((i) => map.set(i.materialId, i.reason));
    return map;
  }, [cartValidation]);

  const recentMRs = useMemo(
    () =>
      [...materialRequests]
        .sort((a, b) => (b.requestedDate || '').localeCompare(a.requestedDate || ''))
        .slice(0, 4),
    [materialRequests]
  );

  const flashBanner = (msg: string, isError = false) => {
    if (isError) {
      setSubmitSuccess('');
      setSubmitError(msg);
    } else {
      setSubmitError('');
      setSubmitSuccess(msg);
      setTimeout(() => setSubmitSuccess(''), 4500);
    }
  };

  // Cart manipulation helpers
  const handleAddItem = (item: UnifiedCatalogItem, delta = 1) => {
    setSubmitError('');
    setCartLines((prev) => mergeCartLines(prev, [catalogItemToCartLine(item, delta)], 'add_qty'));
  };

  const handleSetItemQty = (materialId: string, nextQty: number) => {
    setSubmitError('');
    if (nextQty <= 0) {
      setCartLines((prev) => prev.filter((l) => l.materialId !== materialId));
      return;
    }
    setCartLines((prev) =>
      prev.map((l) => (l.materialId === materialId ? { ...l, qty: nextQty } : l))
    );
  };

  const handleRemoveLine = (materialId: string) => {
    setSubmitError('');
    setCartLines((prev) => prev.filter((l) => l.materialId !== materialId));
  };

  const handleClearCart = () => {
    setCartLines([]);
    setSubmitError('');
  };

  // 1-Click Accelerator Actions
  const handleAutoFillCritical = () => {
    if (criticalLines.length === 0) {
      flashBanner('Semua stok gudang saat ini dalam kondisi aman.');
      return;
    }
    setCartLines((prev) => mergeCartLines(prev, criticalLines, 'ensure_min'));
    setExecutionMode('request_mr');
    flashBanner(
      `${criticalLines.length} item stok kritis ditambahkan ke keranjang (Mode Ajukan Order / MR).`
    );
  };

  const handleApplyPreset = (presetKey: QuickPresetKey, label: string) => {
    const presetLines = buildQuickPresetLines(presetKey, materials);
    if (presetLines.length === 0) {
      flashBanner(`Tidak ditemukan item katalog yang cocok untuk ${label}.`, true);
      return;
    }
    setCartLines((prev) => mergeCartLines(prev, presetLines, 'add_qty'));
    flashBanner(`${presetLines.length} item ${label} ditambahkan ke keranjang.`);
  };

  const handleDuplicateLastMr = () => {
    const lastMr = recentMRs[0];
    if (!lastMr || lastMr.items.length === 0) {
      flashBanner('Belum ada riwayat Material Request untuk diduplikasi.', true);
      return;
    }
    const restoredLines: UnifiedCartLine[] = lastMr.items.map((line) => {
      const catItem = unifiedCatalog.find((c) => c.id === line.materialId);
      if (catItem) {
        return catalogItemToCartLine(catItem, line.qtyRequested);
      }
      return {
        materialId: line.materialId,
        materialName: line.materialName,
        unit: line.unit,
        qty: line.qtyRequested,
        isWire: Boolean(line.isWire || line.materialId === 'wire'),
        unitCost: 0,
        currentStock: 0,
        minStock: 0,
        category: line.materialId.startsWith('mp_') ? 'Project Material' : 'Other',
        source: line.materialId.startsWith('mp_') ? 'project_processing' : 'warehouse',
      };
    });

    setCartLines((prev) => mergeCartLines(prev, restoredLines, 'ensure_min'));
    if (lastMr.projectId && projects.some((p) => p.id === lastMr.projectId)) {
      setSelectedProjectId(lastMr.projectId);
    }
    setExecutionMode('request_mr');
    flashBanner(`Item dari ${lastMr.mrNo} berhasil dimuat ke keranjang.`);
  };

  const handleInjectAllProjectNeeds = () => {
    if (!selectedProject) {
      flashBanner('Pilih proyek terlebih dahulu untuk menarik kebutuhan BOM & Material.', true);
      return;
    }
    if (projectSuggestions.length === 0) {
      flashBanner(`Tidak ada kekurangan item baru untuk proyek ${selectedProject.name}.`);
      return;
    }
    const lines = projectSuggestions.map((s) =>
      catalogItemToCartLine(s.catalogItem, s.suggestedQty)
    );
    setCartLines((prev) => mergeCartLines(prev, lines, 'ensure_min'));
    setExecutionMode('request_mr');
    setShowProjectBomPanel(false);
    flashBanner(
      `${lines.length} item kebutuhan proyek ${selectedProject.name} ditambahkan ke keranjang.`
    );
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setSubmitError('');
    setSubmitSuccess('');

    if (cartLines.length === 0) {
      setSubmitError('Keranjang order masih kosong. Pilih minimal 1 item dari katalog.');
      return;
    }

    if (!cartValidation.valid) {
      setSubmitError(
        cartValidation.issues[0]?.reason || 'Periksa kembali kuantitas dan ketersediaan stok item.'
      );
      return;
    }

    if (executionMode === 'request_mr') {
      if (!canRequestMr) {
        setSubmitError('Akun Anda tidak memiliki izin mengajukan Material Request.');
        return;
      }

      submitLockRef.current = true;
      setIsSubmitting(true);
      try {
        const targetProjectId = selectedProject ? selectedProject.id : 'general_stock';
        const targetProjectName = selectedProject ? selectedProject.name : 'Stok Umum Gudang';

        await onAddMaterialRequest({
          projectId: targetProjectId,
          projectName: targetProjectName,
          assemblyId: selectedAssembly?.id || undefined,
          assemblyName: selectedAssembly?.name || undefined,
          urgency,
          status: 'Submitted',
          forEmployeeId: selectedEmployee?.id || undefined,
          forEmployeeName: selectedEmployee?.name || undefined,
          forEmployeePosition: selectedEmployee?.position || undefined,
          items: cartLines.map((line) => ({
            materialId: line.materialId,
            materialName: line.materialName,
            unit: line.unit,
            qtyRequested: line.qty,
            isWire: line.isWire || undefined,
            amountKg: line.isWire ? line.qty : undefined,
          })),
          requestedBy: currentUser.name,
          requestedById: currentUser.id,
          requestedDate: orderDate || new Date().toISOString().slice(0, 10),
          notes: notes.trim() || undefined,
        });

        setCartLines([]);
        setNotes('');
        setUrgency('Normal');
        flashBanner(
          `Material Request berhasil diajukan (${cartLines.length} item) ke antrian approval.`
        );
      } catch (err: any) {
        setSubmitError(err?.message || 'Gagal mengirim Material Request.');
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    // Direct Checkout mode (Ambil Pakai Langsung)
    if (!canDirectCheckout) {
      setSubmitError(
        'Akun Anda hanya dapat mengajukan MR. Pindah ke mode Ajukan Order / MR untuk mengirim permintaan.'
      );
      return;
    }
    if (!selectedProject) {
      setSubmitError('Pilih Proyek aktif untuk pembebanan biaya pemakaian langsung.');
      return;
    }
    if (!selectedEmployee) {
      setSubmitError('Pilih Penerima / Karyawan yang mengambil material atau consumable.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const targetDate = orderDate || new Date().toISOString().slice(0, 10);
      const asmId = selectedAssembly?.id || selectedProject.assemblies?.[0]?.id || '';
      const asmName = selectedAssembly?.name || selectedProject.assemblies?.[0]?.name || '';

      for (const line of cartLines) {
        const lineUnitCost = line.unitCost || 0;
        const lineTotalCost = Math.round(line.qty * lineUnitCost);

        if (line.isWire) {
          if (onAddWireLog) {
            await onAddWireLog({
              date: targetDate,
              welderId: selectedEmployee.id,
              welderName: selectedEmployee.name,
              welderPosition: selectedEmployee.position,
              projectId: selectedProject.id,
              projectName: selectedProject.name,
              assemblyId: asmId,
              assemblyName: asmName,
              amountKg: line.qty,
              unitCost: lineUnitCost > 0 ? lineUnitCost : undefined,
              totalCost: lineTotalCost > 0 ? lineTotalCost : undefined,
              notes: notes.trim() || `Checkout terpadu (${line.materialName})`,
            });
          } else {
            await onAddConsumptionLog({
              date: targetDate,
              materialId: line.materialId,
              materialName: line.materialName,
              unit: line.unit,
              qtyUsed: line.qty,
              unitCost: lineUnitCost > 0 ? lineUnitCost : undefined,
              totalCost: lineTotalCost > 0 ? lineTotalCost : undefined,
              projectId: selectedProject.id,
              projectName: selectedProject.name,
              assemblyId: asmId || undefined,
              assemblyName: asmName || undefined,
              issuedBy: currentUser.name,
              employeeId: selectedEmployee.id,
              employeeName: selectedEmployee.name,
              employeePosition: selectedEmployee.position,
              category: 'Wire',
              notes: notes.trim() || 'Checkout terpadu',
            });
          }

          // Deduct stock if backed by real warehouse MaterialItem and not already deducted by onAddConsumptionLog
          if (onAddWireLog && line.source === 'warehouse' && line.materialId !== 'wire') {
            const liveMat = materials.find((m) => m.id === line.materialId);
            if (liveMat) {
              onUpdateMaterialStock(
                liveMat.id,
                Math.max(0, Number((liveMat.currentStock - line.qty).toFixed(2)))
              );
            }
          }
        } else {
          await onAddConsumptionLog({
            date: targetDate,
            materialId: line.materialId,
            materialName: line.materialName,
            unit: line.unit,
            qtyUsed: line.qty,
            unitCost: lineUnitCost > 0 ? lineUnitCost : undefined,
            totalCost: lineTotalCost > 0 ? lineTotalCost : undefined,
            projectId: selectedProject.id,
            projectName: selectedProject.name,
            assemblyId: asmId || undefined,
            assemblyName: asmName || undefined,
            issuedBy: currentUser.name,
            employeeId: selectedEmployee.id,
            employeeName: selectedEmployee.name,
            employeePosition: selectedEmployee.position,
            category:
              line.category === 'Project Material' ? 'Other' : line.category,
            notes: notes.trim() || 'Checkout terpadu',
          });
        }
      }

      const issuedCount = cartLines.length;
      setCartLines([]);
      setNotes('');
      flashBanner(
        `${issuedCount} item berhasil dikeluarkan untuk ${selectedEmployee.name} & tercatat ke biaya proyek ${selectedProject.name}.`
      );
    } catch (err: any) {
      setSubmitError(err?.message || 'Gagal mencatat pengambilan langsung.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Operational Summary Strip */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[#9b1c2e]" />
            <h2 className="text-base font-condensed font-bold uppercase tracking-wide text-base-text">
              Order Terpadu Material & Consumable
            </h2>
          </div>
          <p className="text-xs text-base-muted">
            Pilih material proyek, kawat las, consumable, &amp; PPE dalam satu keranjang — lalu ajukan MR atau keluarkan langsung ke workshop.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => setCategoryFilter('critical')}
            className="text-left px-3 py-2 rounded-lg bg-base-surface2 border border-base-border hover:border-amber-500/40 transition-colors cursor-pointer"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-base-muted">
              Stok Kritis
            </div>
            <div className="text-base font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {criticalLines.length} item
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateSubTab?.('materials')}
            className="text-left px-3 py-2 rounded-lg bg-base-surface2 border border-base-border hover:border-base-text/30 transition-colors cursor-pointer"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-base-muted">
              MR Aktif
            </div>
            <div className="text-base font-mono font-bold tabular-nums text-base-text">
              {pendingMrCount} dok
            </div>
          </button>

          <div className="px-3 py-2 rounded-lg bg-base-surface2 border border-base-border">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-base-muted">
              Keranjang
            </div>
            <div className="text-base font-mono font-bold tabular-nums text-[#9b1c2e] dark:text-rose-400">
              {cartSummary.totalLines} item
            </div>
          </div>
        </div>
      </div>

      {/* Main Split-View: Left 8 Cols Catalog + Accelerators | Right 4 Cols Cart + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN — UNIFIED CATALOG & 1-CLICK ACCELERATORS */}
        <div className="lg:col-span-8 space-y-3">
          {/* 1-Click Accelerator Toolbar */}
          <div className="bg-base-surface border border-base-border rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#9b1c2e]" />
                Isi Cepat 1-Klik
              </span>
              <span className="text-[11px] text-base-muted hidden sm:inline">
                Otomatis isi keranjang berdasarkan kebutuhan gudang, BOM proyek, atau paket shift
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoFillCritical}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Auto-Isi Stok Kritis ({criticalLines.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowProjectBomPanel((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showProjectBomPanel
                    ? 'border-[#9b1c2e] bg-[#9b1c2e] text-white'
                    : 'border-base-border bg-base-surface2 text-base-text hover:bg-base-surface'
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Tarik Kebutuhan Proyek / BOM</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('welder_shift', 'Paket Shift Welder')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-base-border bg-base-surface2 text-base-text hover:border-[#9b1c2e]/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="h-3 w-3 text-[#9b1c2e]" />
                <span>Paket Welder</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('fitter_shift', 'Paket Shift Fitter')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-base-border bg-base-surface2 text-base-text hover:border-[#9b1c2e]/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="h-3 w-3 text-[#9b1c2e]" />
                <span>Paket Fitter</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('painting_prep', 'Paket Painting')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-base-border bg-base-surface2 text-base-text hover:border-[#9b1c2e]/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="h-3 w-3 text-[#9b1c2e]" />
                <span>Paket Painting</span>
              </button>

              <button
                type="button"
                onClick={handleDuplicateLastMr}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-base-border bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Copy className="h-3 w-3" />
                <span>Duplikat MR Terakhir</span>
              </button>
            </div>

            {/* Expandable Smart Project/BOM Need Drawer */}
            {showProjectBomPanel && (
              <div className="mt-2 pt-3 border-t border-base-border space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs font-semibold text-base-muted shrink-0">
                      Proyek Target:
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => {
                        setSelectedProjectId(e.target.value);
                        setSelectedAssemblyId('');
                      }}
                      className="flex-1 max-w-sm bg-base-surface2 border border-base-border rounded-lg px-2.5 py-1.5 text-xs text-base-text focus:outline-none focus:border-[#9b1c2e]"
                    >
                      <option value="">-- Pilih Proyek Aktif --</option>
                      {activeProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.client})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProject && projectSuggestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleInjectAllProjectNeeds}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#9b1c2e] text-white hover:bg-[#821625] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Masukkan Semua ({projectSuggestions.length} item)</span>
                    </button>
                  )}
                </div>

                {!selectedProject ? (
                  <p className="text-xs text-base-muted">
                    Pilih proyek di atas untuk melihat daftar part Material Processing &amp; kebutuhan BOM yang belum dipenuhi MR.
                  </p>
                ) : projectSuggestions.length === 0 ? (
                  <p className="text-xs text-base-muted">
                    Tidak ada part Material Processing atau item BOM gudang yang masih kurang untuk proyek ini.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-base-border rounded-lg divide-y divide-base-border">
                    {projectSuggestions.map((s) => (
                      <div
                        key={s.catalogItem.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-base-surface2/50"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-base-text truncate">
                            {s.catalogItem.name}
                          </div>
                          <div className="text-[11px] text-base-muted truncate">{s.reason}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-semibold tabular-nums text-base-text">
                            +{s.suggestedQty} {s.catalogItem.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItem(s.catalogItem, s.suggestedQty)}
                            className="px-2 py-1 rounded border border-[#9b1c2e]/40 text-[#9b1c2e] dark:text-rose-400 hover:bg-[#9b1c2e]/10 font-semibold cursor-pointer whitespace-nowrap"
                          >
                            + Tambah
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unified Search + Category Filter Strip + Dense Catalog Table */}
          <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden">
            {/* Search & Category Header */}
            <div className="p-3 border-b border-base-border space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-base-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama material, kawat las, consumable, kode part, atau lokasi rak..."
                    className="w-full bg-base-surface2 border border-base-border rounded-lg pl-9 pr-3 py-2 text-xs text-base-text placeholder:text-base-muted focus:outline-none focus:border-[#9b1c2e]"
                  />
                </div>
                {onNavigateSubTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateSubTab('materials')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-base-border bg-base-surface2 text-base-text hover:bg-base-surface transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>Kelola Master Stok</span>
                  </button>
                )}
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {CATEGORY_FILTERS.map((cat) => {
                  const isActive = categoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-[#9b1c2e] text-white border-[#9b1c2e]'
                          : 'bg-base-surface2 text-base-muted border-base-border hover:text-base-text'
                      }`}
                    >
                      {cat.label}
                      {cat.id === 'critical' && criticalLines.length > 0 ? ` (${criticalLines.length})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Catalog Table */}
            {filteredCatalog.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Package className="h-8 w-8 text-base-muted mx-auto opacity-60" />
                <div className="text-sm font-semibold text-base-text">
                  Tidak ada item yang cocok dengan filter
                </div>
                <p className="text-xs text-base-muted">
                  {categoryFilter === 'project_material' && !selectedProject
                    ? 'Pilih Proyek target di keranjang sebelah kanan untuk menampilkan daftar part Material Processing proyek.'
                    : 'Ubah kata kunci pencarian atau pilih kategori lain.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-base-border bg-base-surface2 text-base-text hover:bg-base-surface cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                    <tr>
                      <th className="py-2.5 px-3">Item &amp; Kode</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-right">Stok / Min</th>
                      <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                      <th className="py-2.5 px-3 text-right w-36">Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border text-xs">
                    {filteredCatalog.map((item) => {
                      const inCartQty = cartQtyMap.get(item.id) || 0;
                      const statusCfg = STOCK_STATUS_DISPLAY[item.stockStatus];

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-base-surface2/60 transition-colors ${
                            inCartQty > 0 ? 'bg-[#9b1c2e]/[0.03]' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-base-text leading-snug">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-base-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {item.partNumber && (
                                <span className="font-mono">{item.partNumber}</span>
                              )}
                              {item.location && <span>• {item.location}</span>}
                              {item.notes && <span>• {item.notes}</span>}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="text-base-text font-medium">{item.categoryLabel}</div>
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusCfg.className}`}
                            >
                              {statusCfg.label}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                            {item.source === 'project_processing' ? (
                              <span className="text-base-muted">Non-stok</span>
                            ) : (
                              <div>
                                <span
                                  className={`font-bold ${
                                    item.stockStatus === 'out'
                                      ? 'text-red-600 dark:text-red-400'
                                      : item.stockStatus === 'low'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-base-text'
                                  }`}
                                >
                                  {item.currentStock}
                                </span>{' '}
                                <span className="text-base-muted">
                                  / {item.minStock} {item.unit}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono tabular-nums text-base-text">
                            {item.unitCost > 0
                              ? formatCurrency(item.unitCost, currency, exchangeRates)
                              : '—'}
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {inCartQty > 0 ? (
                              <div className="inline-flex items-center border border-[#9b1c2e]/40 rounded-lg bg-base-surface2 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleSetItemQty(item.id, inCartQty - 1)}
                                  className="p-1.5 hover:bg-base-surface text-base-text cursor-pointer"
                                  title="Kurangi"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="px-2 font-mono font-bold tabular-nums text-base-text min-w-[2.25rem] text-center">
                                  {inCartQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddItem(item, 1)}
                                  className="p-1.5 hover:bg-base-surface text-[#9b1c2e] dark:text-rose-400 cursor-pointer"
                                  title="Tambah"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddItem(item, 1)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#9b1c2e]/40 text-[#9b1c2e] dark:text-rose-400 hover:bg-[#9b1c2e] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Order</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — PERSISTENT UNIFIED CART + MINI APPROVAL QUEUE */}
        <div className="lg:col-span-4 space-y-4">
          <form
            onSubmit={handleSubmitOrder}
            className="bg-base-surface border border-base-border rounded-xl overflow-hidden"
          >
            {/* Cart Header */}
            <div className="px-4 py-3 border-b border-base-border flex items-center justify-between gap-2 bg-base-surface2/60">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#9b1c2e]" />
                <h3 className="text-sm font-condensed font-bold uppercase tracking-wider text-base-text">
                  Keranjang Order ({cartSummary.totalLines})
                </h3>
              </div>
              {cartLines.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-[11px] font-semibold text-base-muted hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            <div className="p-4 space-y-3.5">
              {/* Mode Switcher */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-base-muted">
                  Mode Eksekusi
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-base-surface2 border border-base-border">
                  <button
                    type="button"
                    onClick={() => {
                      setExecutionMode('request_mr');
                      setSubmitError('');
                    }}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      executionMode === 'request_mr'
                        ? 'bg-[#9b1c2e] text-white'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    Ajukan Order / MR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExecutionMode('direct_checkout');
                      setSubmitError('');
                    }}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      executionMode === 'direct_checkout'
                        ? 'bg-[#9b1c2e] text-white'
                        : 'text-base-muted hover:text-base-text'
                    }`}
                  >
                    Ambil Pakai Langsung
                  </button>
                </div>
                <p className="text-[11px] text-base-muted leading-snug">
                  {executionMode === 'request_mr'
                    ? 'Membuat dokumen Material Request (bisa untuk restock stok 0 atau part proyek).'
                    : 'Langsung memotong stok gudang & mencatat biaya ke Wire / Consumption Log.'}
                </p>
              </div>

              {/* Project, Assembly, Receiver Metadata */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-base-muted mb-1">
                    Proyek / Work Order{' '}
                    {executionMode === 'direct_checkout' ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      '(Opsional)'
                    )}
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setSelectedAssemblyId('');
                    }}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-2.5 py-2 text-xs text-base-text focus:outline-none focus:border-[#9b1c2e]"
                  >
                    <option value="">
                      {executionMode === 'request_mr'
                        ? 'Stok Umum Gudang (Non-Proyek)'
                        : '-- Pilih Proyek Aktif --'}
                    </option>
                    {activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.client}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProject && selectedProject.assemblies && selectedProject.assemblies.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-base-muted mb-1">
                      Sub-Assembly / Pekerjaan
                    </label>
                    <select
                      value={selectedAssemblyId}
                      onChange={(e) => setSelectedAssemblyId(e.target.value)}
                      className="w-full bg-base-surface2 border border-base-border rounded-lg px-2.5 py-2 text-xs text-base-text focus:outline-none focus:border-[#9b1c2e]"
                    >
                      <option value="">-- Umum / Semua Assembly --</option>
                      {selectedProject.assemblies.map((asm) => (
                        <option key={asm.id} value={asm.id}>
                          {asm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-base-muted mb-1">
                      Penerima{' '}
                      {executionMode === 'direct_checkout' ? (
                        <span className="text-red-500">*</span>
                      ) : (
                        '(Opsional)'
                      )}
                    </label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-base-surface2 border border-base-border rounded-lg px-2.5 py-2 text-xs text-base-text focus:outline-none focus:border-[#9b1c2e]"
                    >
                      <option value="">
                        {executionMode === 'direct_checkout'
                          ? '-- Pilih Karyawan --'
                          : 'Pemohon sendiri'}
                      </option>
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.position})
                        </option>
                      ))}
                    </select>
                  </div>

                  {executionMode === 'request_mr' ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-base-muted mb-1">
                        Urgensi MR
                      </label>
                      <select
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value as MaterialRequestUrgency)}
                        className="w-full bg-base-surface2 border border-base-border rounded-lg px-2.5 py-2 text-xs text-base-text focus:outline-none focus:border-[#9b1c2e]"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Critical">Kritis</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-base-muted mb-1">
                        Tanggal Pakai
                      </label>
                      <input
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        className="w-full bg-base-surface2 border border-base-border rounded-lg px-2.5 py-2 text-xs font-mono text-base-text focus:outline-none focus:border-[#9b1c2e]"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan singkat (misal: kebutuhan shift 1 / untuk repair floor)"
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-2.5 py-1.5 text-xs text-base-text placeholder:text-base-muted focus:outline-none focus:border-[#9b1c2e]"
                  />
                </div>
              </div>

              {/* Cart Items List */}
              <div className="border-t border-base-border pt-3">
                {cartLines.length === 0 ? (
                  <div className="py-6 text-center space-y-1.5 bg-base-surface2/50 rounded-lg border border-dashed border-base-border px-3">
                    <Layers className="h-6 w-6 text-base-muted mx-auto opacity-60" />
                    <div className="text-xs font-semibold text-base-text">
                      Keranjang masih kosong
                    </div>
                    <p className="text-[11px] text-base-muted">
                      Klik tombol <span className="font-semibold text-base-text">+ Order</span> di katalog kiri atau gunakan tombol Isi Cepat 1-Klik.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                    {cartLines.map((line) => {
                      const lineIssue = validationIssueMap.get(line.materialId);
                      const lineSubtotal = Math.round(line.qty * (line.unitCost || 0));

                      return (
                        <div
                          key={line.materialId}
                          className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                            lineIssue
                              ? 'border-red-500/40 bg-red-500/5'
                              : 'border-base-border bg-base-surface2/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-base-text truncate">
                                {line.materialName}
                              </div>
                              <div className="text-[11px] text-base-muted flex items-center gap-1.5">
                                <span>{line.category}</span>
                                {line.partNumber && (
                                  <span className="font-mono">• {line.partNumber}</span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.materialId)}
                              className="text-base-muted hover:text-red-600 dark:hover:text-red-400 p-0.5 cursor-pointer shrink-0"
                              title="Hapus item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0.1}
                                step="any"
                                value={line.qty}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleSetItemQty(
                                    line.materialId,
                                    isNaN(val) ? 0 : val
                                  );
                                }}
                                className="w-20 bg-base-surface border border-base-border rounded px-2 py-1 text-xs font-mono font-bold tabular-nums text-base-text focus:outline-none focus:border-[#9b1c2e]"
                              />
                              <span className="text-[11px] text-base-muted font-medium">
                                {line.unit}
                              </span>
                            </div>

                            <div className="text-right font-mono tabular-nums text-base-text font-semibold">
                              {lineSubtotal > 0
                                ? formatCurrency(lineSubtotal, currency, exchangeRates)
                                : '—'}
                            </div>
                          </div>

                          {lineIssue && (
                            <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                              {lineIssue}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mode Validation Hint to switch back to MR */}
              {!cartValidation.valid &&
                executionMode === 'direct_checkout' &&
                cartLines.length > 0 && (
                  <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                    <span>Ada item non-stok / stok kurang untuk ambil langsung.</span>
                    <button
                      type="button"
                      onClick={() => setExecutionMode('request_mr')}
                      className="px-2 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Pindah ke MR
                    </button>
                  </div>
                )}

              {/* Error / Success Alerts */}
              {submitError && (
                <div className="p-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              {/* Totals & Primary CTA */}
              <div className="border-t border-base-border pt-3 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-base-muted">
                    Total ({cartSummary.totalLines} jenis •{' '}
                    <span className="font-mono tabular-nums">{cartSummary.totalQty}</span> unit)
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums text-base-text">
                    {formatCurrency(cartSummary.estimatedCostIdr, currency, exchangeRates)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || cartLines.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider bg-[#9b1c2e] text-white hover:bg-[#821625] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {executionMode === 'request_mr' ? (
                    <>
                      <FileText className="h-4 w-4" />
                      <span>
                        {isSubmitting ? 'Mengirim...' : 'Ajukan Material Request'}
                      </span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      <span>
                        {isSubmitting ? 'Memproses...' : 'Keluarkan & Catat Pemakaian'}
                      </span>
                    </>
                  )}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>

          {/* Mini Approval & MR History Queue */}
          <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-base-border flex items-center justify-between gap-2 bg-base-surface2/60">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-base-muted" />
                <h4 className="text-xs font-condensed font-bold uppercase tracking-wider text-base-text">
                  Antrian MR Terbaru
                </h4>
              </div>
              {onNavigateSubTab && (
                <button
                  type="button"
                  onClick={() => onNavigateSubTab('materials')}
                  className="text-[11px] font-semibold text-[#9b1c2e] dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Lihat Semua
                </button>
              )}
            </div>

            {recentMRs.length === 0 ? (
              <div className="p-4 text-center text-xs text-base-muted">
                Belum ada Material Request tercatat.
              </div>
            ) : (
              <div className="divide-y divide-base-border">
                {recentMRs.map((mr) => {
                  const mrStatusCfg = MR_STATUS_DISPLAY[mr.status] || MR_STATUS_DISPLAY.Submitted;
                  const isRejecting = rejectingMrId === mr.id;

                  return (
                    <div key={mr.id} className="p-3 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-base-text">
                            {mr.mrNo}
                          </div>
                          <div className="text-[11px] text-base-muted truncate">
                            {mr.projectName} • {mr.items.length} item
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${mrStatusCfg.className}`}
                        >
                          {mrStatusCfg.label}
                        </span>
                      </div>

                      {canApproveOrIssueMr &&
                        (mr.status === 'Submitted' || mr.status === 'Approved') && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {mr.status === 'Submitted' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateMaterialRequestStatus(mr.id, 'Approved', {
                                    approvedBy: currentUser.name,
                                  })
                                }
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 cursor-pointer"
                              >
                                Setujui
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMaterialRequestStatus(mr.id, 'Issued', {
                                  approvedBy: mr.approvedBy || currentUser.name,
                                  issuedBy: currentUser.name,
                                })
                              }
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer"
                            >
                              Keluarkan Stok
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingMrId(isRejecting ? null : mr.id);
                                setRejectReasonInput('');
                              }}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30 hover:bg-red-500/20 cursor-pointer"
                            >
                              Tolak
                            </button>
                          </div>
                        )}

                      {isRejecting && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={rejectReasonInput}
                            onChange={(e) => setRejectReasonInput(e.target.value)}
                            placeholder="Alasan penolakan..."
                            className="flex-1 bg-base-surface2 border border-base-border rounded px-2 py-1 text-[11px] text-base-text focus:outline-none focus:border-red-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateMaterialRequestStatus(mr.id, 'Rejected', {
                                rejectedReason: rejectReasonInput.trim() || 'Ditolak gudang',
                              });
                              setRejectingMrId(null);
                              setRejectReasonInput('');
                            }}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                          >
                            Kirim
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingMrId(null)}
                            className="p-1 text-base-muted hover:text-base-text cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
