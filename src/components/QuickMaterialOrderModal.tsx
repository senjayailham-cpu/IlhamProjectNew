import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Employee,
  MaterialItem,
  MaterialRequest,
  MaterialRequestUrgency,
  MaterialUnit,
  Project,
  User,
} from '../types';
import { QuickOrderOptions } from '../store';
import {
  buildLowStockRestockCart,
  buildQuickOrderCatalog,
  buildQuickOrderPayload,
  filterQuickOrderCatalog,
  isConsumableCategory,
  QuickOrderCartLine,
  QuickOrderCatalogItem,
  QuickOrderFilter,
} from '../utils/quickOrderUtils';
import { showToast } from './Toast';
import {
  AlertTriangle,
  Check,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';

interface QuickMaterialOrderModalProps {
  isOpen: boolean;
  options: QuickOrderOptions | null;
  onClose: () => void;
  materials: MaterialItem[];
  projects: Project[];
  employees: Employee[];
  materialRequests: MaterialRequest[];
  currentUser: User;
  onAddMaterialRequest: (mr: Omit<MaterialRequest, 'id' | 'mrNo'>) => Promise<void> | void;
}

const CUSTOM_UNITS: MaterialUnit[] = ['pcs', 'kg', 'roll', 'liter', 'meter', 'box', 'set'];

export const QuickMaterialOrderModal: React.FC<QuickMaterialOrderModalProps> = ({
  isOpen,
  options,
  onClose,
  materials,
  projects,
  employees,
  materialRequests,
  currentUser,
  onAddMaterialRequest,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuickOrderFilter>('all');
  const [cart, setCart] = useState<QuickOrderCartLine[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [urgency, setUrgency] = useState<MaterialRequestUrgency>('Normal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick inline custom item creator (for non-catalog urgent orders)
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState<MaterialUnit>('pcs');
  const [customQty, setCustomQty] = useState('1');
  const [customGroup, setCustomGroup] = useState<'consumable' | 'material'>('consumable');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isArchived && p.status !== 'completed'),
    [projects]
  );

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((e) => !e.isExEmployee)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  const catalog = useMemo(
    () => buildQuickOrderCatalog(materials, projects, selectedProjectId || undefined),
    [materials, projects, selectedProjectId]
  );

  const lowStockCount = useMemo(
    () => catalog.filter((c) => c.isOutOfStock || c.isLowStock).length,
    [catalog]
  );

  const filteredCatalog = useMemo(
    () => filterQuickOrderCatalog(catalog, { query: searchQuery, filter: activeFilter }),
    [catalog, searchQuery, activeFilter]
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const recentOrders = useMemo(
    () => materialRequests.filter((mr) => mr.items && mr.items.length > 0).slice(0, 3),
    [materialRequests]
  );

  // Sync modal defaults & prefill items whenever opened
  useEffect(() => {
    if (!isOpen) return;

    setSearchQuery('');
    setActiveFilter(options?.category || 'all');
    setSelectedProjectId(options?.projectId || '');
    setSelectedAssemblyId('');
    setSelectedEmployeeId('');
    setUrgency('Normal');
    setNotes('');
    setShowCustomAdd(false);

    if (options?.items && options.items.length > 0) {
      const fullCatalog = buildQuickOrderCatalog(materials, projects, options.projectId);
      const prefilled: QuickOrderCartLine[] = [];
      options.items.forEach((reqItem) => {
        const found = fullCatalog.find((c) => c.id === reqItem.materialId);
        if (found) {
          prefilled.push({
            id: found.id,
            name: found.name,
            partNumber: found.partNumber,
            category: String(found.category),
            group: found.group,
            unit: found.unit,
            qty: reqItem.qty && reqItem.qty > 0 ? reqItem.qty : 1,
            currentStock: found.currentStock,
            minStock: found.minStock,
            isWire: found.isWire,
          });
        }
      });
      setCart(prefilled);
    } else {
      setCart([]);
    }

    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [isOpen, options, materials, projects]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cartQtyMap = new Map<string, number>();
  cart.forEach((line) => cartQtyMap.set(line.id, line.qty));

  const addCatalogItem = (item: QuickOrderCatalogItem, delta = 1) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.id === item.id
            ? { ...line, qty: Math.max(1, Number((line.qty + delta).toFixed(2))) }
            : line
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          partNumber: item.partNumber,
          category: String(item.category),
          group: item.group,
          unit: item.unit,
          qty: Math.max(1, delta),
          currentStock: item.currentStock,
          minStock: item.minStock,
          isWire: item.isWire,
        },
      ];
    });
  };

  const updateCartQty = (id: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((line) => line.id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((line) => (line.id === id ? { ...line, qty: nextQty } : line))
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  };

  const handleLoadLowStock = () => {
    const restockLines = buildLowStockRestockCart(materials);
    if (restockLines.length === 0) {
      showToast('Semua stok material & consumable saat ini aman.', 'info');
      return;
    }
    setCart((prev) => {
      const map = new Map<string, QuickOrderCartLine>();
      prev.forEach((item) => map.set(item.id, item));
      restockLines.forEach((item) => {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      });
      return Array.from(map.values());
    });
    setUrgency('Urgent');
    showToast(`${restockLines.length} item stok menipis dimasukkan ke keranjang.`, 'info');
  };

  const handleRepeatRecentOrder = (mr: MaterialRequest) => {
    const mapped: QuickOrderCartLine[] = mr.items.map((item) => {
      const matchedMat = materials.find((m) => m.id === item.materialId);
      const isWire = Boolean(item.isWire || item.materialId === 'wire' || matchedMat?.category === 'Wire');
      const category = matchedMat?.category || (isWire ? 'Wire' : 'Welding Consumable');
      return {
        id: item.materialId,
        name: item.materialName,
        partNumber: matchedMat?.partNumber,
        category,
        group: isConsumableCategory(category) ? 'consumable' : 'material',
        unit: item.unit,
        qty: item.qtyRequested || 1,
        currentStock: matchedMat?.currentStock ?? 0,
        minStock: matchedMat?.minStock ?? 0,
        isWire,
      };
    });
    setCart(mapped);
    if (mr.projectId && projects.some((p) => p.id === mr.projectId)) {
      setSelectedProjectId(mr.projectId);
      setSelectedAssemblyId(mr.assemblyId || '');
    }
    if (mr.forEmployeeId && employees.some((e) => e.id === mr.forEmployeeId)) {
      setSelectedEmployeeId(mr.forEmployeeId);
    }
    setUrgency(mr.urgency || 'Normal');
    showToast(`Item dari ${mr.mrNo} dimuat ulang ke keranjang.`, 'info');
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;
    const qty = Math.max(0.1, parseFloat(customQty) || 1);
    const customId = `custom_${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        id: customId,
        name: trimmed,
        category: customGroup === 'consumable' ? 'Welding Consumable' : 'Other',
        group: customGroup,
        unit: customUnit,
        qty,
        currentStock: 0,
        minStock: 0,
        isWire: false,
        isCustom: true,
      },
    ]);
    setCustomName('');
    setCustomQty('1');
    setShowCustomAdd(false);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      showToast('Pilih minimal 1 item material atau consumable terlebih dahulu.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildQuickOrderPayload({
        cart,
        project: selectedProject,
        assemblyId: selectedAssemblyId || undefined,
        employee: selectedEmployee,
        currentUser,
        urgency,
        notes,
      });
      await onAddMaterialRequest(payload);
      showToast(
        `Order berhasil dikirim (${cart.length} item · ${payload.projectName}).`,
        'success'
      );
      onClose();
    } catch (err) {
      console.error('Quick order submit failed:', err);
      showToast('Gagal mengirim order. Silakan coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQtySummary = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-order-modal-title"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-base-surface border border-base-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-base-border bg-base-surface2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="quick-order-modal-title"
              className="font-condensed font-black text-lg sm:text-xl uppercase tracking-wide text-base-text flex items-center gap-2"
            >
              <ShoppingCart className="h-5 w-5 text-base-accent shrink-0" />
              <span>Order Cepat Material &amp; Consumable</span>
            </h2>
            <p className="text-xs text-base-muted mt-0.5">
              Klik barang di kiri untuk masuk keranjang, cek tujuan di kanan, lalu kirim dalam 1 klik.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={handleLoadLowStock}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-slate-950 text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Isi Stok Menipis ({lowStockCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
              aria-label="Tutup Order Cepat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2-COLUMN BODY */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT PANE: CATALOG PICKER */}
          <div className="w-full lg:w-[58%] flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-base-border">
            {/* Search & Segmented Filter */}
            <div className="p-4 border-b border-base-border space-y-3 bg-base-surface shrink-0">
              <div className="relative">
                <Search className="h-4 w-4 text-base-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kawat las, batu gerinda, PPE, pelat, atau part number..."
                  className="w-full pl-9 pr-8 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs font-medium text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-muted hover:text-base-text cursor-pointer"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-base-surface2 border border-base-border rounded-lg overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'consumable', label: 'Consumable' },
                      { id: 'material', label: 'Material' },
                      { id: 'low_stock', label: `Menipis (${lowStockCount})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3 py-1 rounded-md text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeFilter === tab.id
                          ? 'bg-base-surface text-base-text border border-base-border shadow-2xs'
                          : 'text-base-muted hover:text-base-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomAdd((v) => !v)}
                  className="text-xs font-condensed font-bold uppercase tracking-wider text-base-accent hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {showCustomAdd ? 'Tutup Form Custom' : '+ Barang Lain (Custom)'}
                </button>
              </div>

              {/* Optional Quick Custom Item Form */}
              {showCustomAdd && (
                <form
                  onSubmit={handleAddCustomItem}
                  className="p-3 rounded-xl bg-base-surface2 border border-base-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                >
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] text-base-muted font-semibold mb-1">
                      Nama Barang Custom
                    </label>
                    <input
                      type="text"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Misal: Mata Bor 12mm HSS"
                      className="w-full px-2.5 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-base-muted font-semibold mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs font-mono text-base-text focus:outline-none focus:border-base-accent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-base-muted font-semibold mb-1">
                      Satuan
                    </label>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as MaterialUnit)}
                      className="w-full px-2 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                    >
                      {CUSTOM_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 flex gap-1.5">
                    <select
                      value={customGroup}
                      onChange={(e) =>
                        setCustomGroup(e.target.value as 'consumable' | 'material')
                      }
                      className="flex-1 px-2 py-1.5 bg-base-surface border border-base-border rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                    >
                      <option value="consumable">Consumable</option>
                      <option value="material">Material</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-base-accent text-white rounded-lg text-xs font-condensed font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer hover:bg-base-accent/90"
                    >
                      Tambah
                    </button>
                  </div>
                </form>
              )}

              {/* 1-Click Repeat Recent Orders */}
              {recentOrders.length > 0 && !searchQuery && (
                <div className="flex items-center gap-2 overflow-x-auto pt-1 text-xs">
                  <span className="text-[11px] font-semibold text-base-muted flex items-center gap-1 whitespace-nowrap shrink-0">
                    <RotateCcw className="h-3 w-3" />
                    Ulangi terakhir:
                  </span>
                  {recentOrders.map((mr) => (
                    <button
                      key={mr.id}
                      type="button"
                      onClick={() => handleRepeatRecentOrder(mr)}
                      className="px-2.5 py-1 rounded-md border border-base-border bg-base-surface2 hover:border-base-accent text-[11px] font-medium text-base-text transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      title={`Muat ${mr.items.length} item dari ${mr.mrNo}`}
                    >
                      {mr.mrNo} · {mr.items.length} item
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Catalog List */}
            <div className="flex-1 overflow-y-auto divide-y divide-base-border min-h-[220px]">
              {filteredCatalog.length === 0 ? (
                <div className="py-12 px-6 text-center space-y-2">
                  <Package className="h-8 w-8 text-base-muted mx-auto opacity-60" />
                  <p className="text-sm font-semibold text-base-text">
                    Item tidak ditemukan di katalog
                  </p>
                  <p className="text-xs text-base-muted max-w-sm mx-auto">
                    Coba kata kunci lain atau gunakan tombol "+ Barang Lain (Custom)" di atas untuk order item mendadak.
                  </p>
                  {!showCustomAdd && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomName(searchQuery.trim());
                        setShowCustomAdd(true);
                      }}
                      className="mt-2 px-3.5 py-1.5 rounded-lg bg-base-accent text-white text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
                    >
                      + Tambah "{searchQuery.trim() || 'Item Custom'}"
                    </button>
                  )}
                </div>
              ) : (
                filteredCatalog.map((item) => {
                  const qtyInCart = cartQtyMap.get(item.id) || 0;
                  const stockText = item.isProjectItem
                    ? `Kebutuhan Proyek: ${item.currentStock} ${item.unit}`
                    : item.isWire && item.currentStock === 0
                      ? 'Input per Kg'
                      : item.isOutOfStock
                        ? `Stok Habis (0 ${item.unit})`
                        : item.isLowStock
                          ? `Stok Tipis (${item.currentStock} ${item.unit})`
                          : `Stok ${item.currentStock} ${item.unit}`;

                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                        qtyInCart > 0 ? 'bg-base-accent/5' : 'hover:bg-base-surface2/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-base-text truncate">
                            {item.name}
                          </span>
                          {qtyInCart > 0 && (
                            <span className="text-[11px] font-mono font-bold text-base-accent whitespace-nowrap shrink-0">
                              ✓ Di keranjang
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-base-muted mt-0.5">
                          <span>{item.group === 'consumable' ? 'Consumable' : 'Material'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.category}</span>
                          {item.partNumber && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{item.partNumber}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-mono tabular-nums font-medium ${
                              item.isOutOfStock && !item.isWire
                                ? 'text-base-red'
                                : item.isLowStock
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-base-muted'
                            }`}
                          >
                            {stockText}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {qtyInCart > 0 ? (
                          <div className="flex items-center border border-base-accent/40 rounded-lg bg-base-surface overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, qtyInCart - 1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-base-surface2 text-base-text cursor-pointer"
                              aria-label={`Kurangi ${item.name}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-2.5 text-xs font-mono font-bold tabular-nums text-base-text min-w-[2.2rem] text-center">
                              {qtyInCart}
                            </span>
                            <button
                              type="button"
                              onClick={() => addCatalogItem(item, 1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-base-surface2 text-base-accent cursor-pointer"
                              aria-label={`Tambah ${item.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => addCatalogItem(item, 5)}
                              className="hidden sm:inline-flex items-center justify-center px-2 py-1.5 rounded-lg border border-base-border bg-base-surface2 hover:bg-base-surface3 text-[11px] font-mono font-bold text-base-muted hover:text-base-text transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              title={`Langsung tambah 5 ${item.unit}`}
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => addCatalogItem(item, 1)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-base-surface2 hover:bg-base-accent text-base-text hover:text-white border border-base-border hover:border-base-accent text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Pilih</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: CART & MINIMAL ORDER FORM */}
          <div className="w-full lg:w-[42%] flex flex-col min-h-0 bg-base-surface2/40">
            {/* Cart Metadata Form (Defaults Filled Automatically) */}
            <div className="p-4 border-b border-base-border space-y-3 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                    Untuk Proyek / Work Order
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setSelectedAssemblyId('');
                    }}
                    className="w-full px-2.5 py-2 bg-base-surface border border-base-border rounded-lg text-xs font-medium text-base-text focus:outline-none focus:border-base-accent"
                  >
                    <option value="">Stok Umum Workshop</option>
                    {activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.client ? `[${p.client}] ` : ''}
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                    Penerima / Pemesan
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-surface border border-base-border rounded-lg text-xs font-medium text-base-text focus:outline-none focus:border-base-accent"
                  >
                    <option value="">Saya Sendiri ({currentUser.name})</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                        {emp.position ? ` · ${emp.position}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedProject && (selectedProject.assemblies?.length || 0) > 0 && (
                <div>
                  <label className="block text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
                    Sub-Assembly (Opsional)
                  </label>
                  <select
                    value={selectedAssemblyId}
                    onChange={(e) => setSelectedAssemblyId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-surface border border-base-border rounded-lg text-xs font-medium text-base-text focus:outline-none focus:border-base-accent"
                  >
                    <option value="">Semua Bagian Proyek</option>
                    {selectedProject.assemblies.map((asm) => (
                      <option key={asm.id} value={asm.id}>
                        {asm.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Prioritas
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-base-surface border border-base-border rounded-lg">
                  {(['Normal', 'Urgent', 'Critical'] as MaterialRequestUrgency[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setUrgency(level)}
                      className={`px-2.5 py-1 rounded-md text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        urgency === level
                          ? level === 'Critical'
                            ? 'bg-base-red text-white'
                            : level === 'Urgent'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-base-accent text-white'
                          : 'text-base-muted hover:text-base-text'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[160px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Keranjang Order ({cart.length} item · {totalQtySummary} total qty)
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] text-base-muted hover:text-base-red cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-10 px-4 text-center border border-dashed border-base-border rounded-xl bg-base-surface/60">
                  <ShoppingCart className="h-7 w-7 text-base-muted mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-semibold text-base-text">Keranjang masih kosong</p>
                  <p className="text-[11px] text-base-muted mt-1">
                    Klik <strong>"+ Pilih"</strong> pada material atau consumable di panel kiri untuk langsung menambahkan.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-base-border border border-base-border rounded-xl bg-base-surface overflow-hidden">
                  {cart.map((line) => (
                    <div key={line.id} className="p-3 flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-base-text truncate">
                          {line.name}
                        </div>
                        <div className="text-[11px] text-base-muted flex items-center gap-1.5 mt-0.5">
                          <span>{line.category}</span>
                          {!line.isWire && !line.isCustom && line.currentStock === 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-600 dark:text-amber-400">
                                Stok gudang 0 (pengadaan)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center border border-base-border rounded-lg bg-base-surface2">
                          <button
                            type="button"
                            onClick={() => updateCartQty(line.id, Number((line.qty - 1).toFixed(2)))}
                            className="w-7 h-7 flex items-center justify-center hover:bg-base-surface3 text-base-text cursor-pointer"
                            aria-label={`Kurangi jumlah ${line.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={line.qty}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!isNaN(parsed) && parsed > 0) {
                                updateCartQty(line.id, parsed);
                              }
                            }}
                            className="w-12 h-7 text-center bg-transparent text-xs font-mono font-bold tabular-nums text-base-text focus:outline-none"
                            aria-label={`Jumlah ${line.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQty(line.id, Number((line.qty + 1).toFixed(2)))}
                            className="w-7 h-7 flex items-center justify-center hover:bg-base-surface3 text-base-text cursor-pointer"
                            aria-label={`Tambah jumlah ${line.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-[11px] font-mono text-base-muted w-8 truncate">
                          {line.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.id)}
                          className="p-1.5 rounded-lg text-base-muted hover:text-base-red hover:bg-base-red/10 cursor-pointer"
                          aria-label={`Hapus ${line.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Submit Area */}
            <div className="p-4 border-t border-base-border bg-base-surface space-y-3 shrink-0">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan singkat (opsional, misal: ambil di gudang pagi)..."
                className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-base-border bg-base-surface2 hover:bg-base-surface3 text-xs font-condensed font-bold uppercase tracking-wider text-base-text cursor-pointer whitespace-nowrap shrink-0"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={cart.length === 0 || isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-base-accent hover:bg-base-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-condensed font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span>Mengirim Order...</span>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Kirim Order ({cart.length} Item)</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
