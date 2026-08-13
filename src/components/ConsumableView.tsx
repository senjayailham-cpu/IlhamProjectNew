import React, { useState, useMemo } from 'react';
import { 
  WireLog, 
  Employee, 
  Project, 
  User, 
  MaterialConsumptionLog, 
  MaterialItem, 
  MaterialUnit,
  MaterialCategory,
  MaterialRequest,
  MaterialRequestUrgency
} from '../types';
import { 
  Flame, 
  Trash2, 
  Search, 
  Plus, 
  Calendar, 
  UserCheck, 
  Folder, 
  AlertCircle, 
  Sparkles, 
  Filter, 
  Download, 
  Wrench, 
  Package, 
  ShieldAlert, 
  Activity, 
  ChevronUp, 
  ChevronDown, 
  X,
  ShoppingCart,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { can } from '../utils/permissions';
import { useAppStore } from '../store';

interface ConsumableViewProps {
  wireLogs?: WireLog[];
  consumptionLogs?: MaterialConsumptionLog[];
  materials?: MaterialItem[];
  projects?: Project[];
  employees?: Employee[];
  currentUser?: User;
  materialRequests?: MaterialRequest[];
  onDeleteWireLog: (id: string) => void;
  onAddMaterialRequest?: (mr: Omit<MaterialRequest, 'id' | 'mrNo'>) => void;
  onUpdateMaterialRequestStatus?: (
    id: string,
    status: 'Draft' | 'Submitted' | 'Approved' | 'Issued' | 'Rejected',
    extra?: { approvedBy?: string; rejectedReason?: string; issuedBy?: string }
  ) => void;
  onNavigateToKPI?: () => void;
  onNavigateToMaterials?: () => void;
  onAddMaterial?: (item: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateMaterial?: (id: string, updates: Partial<MaterialItem>) => void;
  onDeleteMaterial?: (id: string) => void;
  orgSettings?: any;
  setDeleteConfirm?: (state: any) => void;
}

const getPositionColorClass = (position?: string) => {
  const pos = (position || '').toLowerCase();
  if (pos.includes('welder')) return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
  if (pos.includes('fitter')) return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
  if (pos.includes('grinder')) return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
  if (pos.includes('coordinator')) return 'bg-purple-500/10 text-purple-500 border border-purple-500/20';
  if (pos.includes('supervisor')) return 'bg-teal-500/10 text-teal-500 border border-teal-500/20';
  return 'bg-base-surface2 text-base-muted border border-base-border';
};

export default function ConsumableView({
  wireLogs: propWireLogs = [],
  consumptionLogs: propConsumptionLogs = [],
  materials: propMaterials = [],
  projects: propProjects = [],
  employees: propEmployees = [],
  currentUser: propUser,
  materialRequests: propMaterialRequests = [],
  onDeleteWireLog,
  onAddMaterialRequest,
  onUpdateMaterialRequestStatus,
  onNavigateToKPI,
  onNavigateToMaterials,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  orgSettings,
  setDeleteConfirm
}: ConsumableViewProps) {
  const storeWireLogs = useAppStore((s) => s.wireLogs);
  const storeConsumptionLogs = useAppStore((s) => s.consumptionLogs);
  const storeMaterials = useAppStore((s) => s.materials);
  const storeProjects = useAppStore((s) => s.projects);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeCurrentUser = useAppStore((s) => s.currentUser);
  const storeMaterialRequests = useAppStore((s) => s.materialRequests);

  const wireLogs = propWireLogs?.length ? propWireLogs : storeWireLogs;
  const consumptionLogs = propConsumptionLogs?.length ? propConsumptionLogs : storeConsumptionLogs;
  const materials = propMaterials?.length ? propMaterials : storeMaterials;
  const projects = propProjects?.length ? propProjects : storeProjects;
  const employees = propEmployees?.length ? propEmployees : storeEmployees;
  const currentUser = propUser || storeCurrentUser || { id: '', name: 'Guest', role: 'Viewer' as any };
  const materialRequests = propMaterialRequests?.length ? propMaterialRequests : storeMaterialRequests;

  const canManageConsumables = can(currentUser, 'manageWireLog'); 
  const canDeleteConsumable = can(currentUser, 'deleteWireLog');

  // Navigation for Consumable Sub-Tabs
  const [mainTab, setMainTab] = useState<'checkout' | 'stock'>('checkout');

  // Consumable Stock Tab States
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('all');
  
  // Inline edit state
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<Partial<MaterialItem>>({});

  // Add Consumable modal/form state
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [newStockForm, setNewStockForm] = useState({
    name: '',
    category: 'Welding Consumable' as MaterialCategory,
    unit: 'pcs' as MaterialUnit,
    currentStock: 0,
    minStock: 0,
    location: '',
    notes: ''
  });

  const startEditing = (m: MaterialItem) => {
    setEditingStockId(m.id);
    setEditingFields(m);
  };

  const consumableMaterials = useMemo(() => {
    let list = materials.filter(m => m.category !== 'Other');
    
    if (stockSearchQuery.trim()) {
      const q = stockSearchQuery.toLowerCase().trim();
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) || 
        (m.location && m.location.toLowerCase().includes(q)) ||
        (m.notes && m.notes.toLowerCase().includes(q))
      );
    }
    
    if (stockCategoryFilter !== 'all') {
      list = list.filter(m => m.category === stockCategoryFilter);
    }
    
    return list;
  }, [materials, stockSearchQuery, stockCategoryFilter]);

  // ========================================================
  // 1. ORDER CONSUMABLE FORM STATE (Part 3)
  // ========================================================
  const [mainOrderDate, setMainOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mainOrderEmployeeId, setMainOrderEmployeeId] = useState('');
  const [mainOrderEmployeeSearch, setMainOrderEmployeeSearch] = useState('');
  const [isMainOrderEmployeeFocused, setIsMainOrderEmployeeFocused] = useState(false);

  const [mainOrderMaterialId, setMainOrderMaterialId] = useState('');
  const [mainOrderMaterialSearch, setMainOrderMaterialSearch] = useState('');
  const [isMainOrderMaterialFocused, setIsMainOrderMaterialFocused] = useState(false);

  const [mainOrderQtyValue, setMainOrderQtyValue] = useState('');
  const [mainOrderProjectId, setMainOrderProjectId] = useState('');
  const [mainOrderProjectSearch, setMainOrderProjectSearch] = useState('');
  const [isMainOrderProjectFocused, setIsMainOrderProjectFocused] = useState(false);
  const [mainOrderAssemblyId, setMainOrderAssemblyId] = useState('');

  const [mainOrderUrgency, setMainOrderUrgency] = useState<MaterialRequestUrgency>('Normal');
  const [mainOrderNotes, setMainOrderNotes] = useState('');
  
  // Multiple items state for main order form
  const [mainOrderItems, setMainOrderItems] = useState<{
    materialId: string;
    materialName: string;
    unit: string;
    qtyRequested: number;
    isWire: boolean;
    amountKg?: number;
    currentStock: number;
    minStock: number;
  }[]>([]);

  // Add item helper
  const handleAddMainOrderItem = () => {
    setMainOrderError('');
    setMainOrderSuccess('');

    if (!mainOrderMaterialId) {
      setMainOrderError('Please select a material first.');
      return;
    }

    const selectedMat = selectedMainMaterialObj;
    if (!selectedMat) {
      setMainOrderError('Material not found.');
      return;
    }

    const qty = parseFloat(mainOrderQtyValue);
    if (isNaN(qty) || qty <= 0) {
      setMainOrderError('Please input a valid quantity.');
      return;
    }

    const isWire = selectedMat.category === 'Wire' || selectedMat.id === 'wire';

    if (!isWire && selectedMat.currentStock === 0) {
      setMainOrderError('Cannot add an out of stock item.');
      return;
    }

    // Check if already in list
    if (mainOrderItems.some(item => item.materialId === selectedMat.id)) {
      setMainOrderError('This item is already added to the request list.');
      return;
    }

    setMainOrderItems(prev => [...prev, {
      materialId: selectedMat.id,
      materialName: selectedMat.name,
      unit: selectedMat.unit,
      qtyRequested: qty,
      isWire,
      amountKg: isWire ? qty : undefined,
      currentStock: selectedMat.currentStock,
      minStock: selectedMat.minStock
    }]);

    // Clear item inputs for next addition
    setMainOrderMaterialId('');
    setMainOrderMaterialSearch('');
    setMainOrderQtyValue('');
  };

  const handleRemoveMainOrderItem = (materialId: string) => {
    setMainOrderItems(prev => prev.filter(item => item.materialId !== materialId));
  };
  
  // Feedback states
  const [mainOrderError, setMainOrderError] = useState('');
  const [mainOrderSuccess, setMainOrderSuccess] = useState('');

  // Combined Logs Registry filters
  const [registrySearchQuery, setRegistrySearchQuery] = useState('');
  const [registryProjectFilter, setRegistryProjectFilter] = useState('');
  const [registryEmployeeFilter, setRegistryEmployeeFilter] = useState('');
  const [registryStatusFilter, setRegistryStatusFilter] = useState<string>('');
  const [registryConsumableTypeFilter, setRegistryConsumableTypeFilter] = useState<string>('all');
  const [registryStartDate, setRegistryStartDate] = useState('');
  const [registryEndDate, setRegistryEndDate] = useState('');

  // ========================================================
  // 2. QUICK ORDER STATES & FILTERING
  // ========================================================
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [orderItems, setOrderItems] = useState<{
    materialId: string;
    materialName: string;
    unit: MaterialUnit;
    qtyRequested: number;
    currentStock: number;
    minStock: number;
  }[]>([]);
  const [orderProject, setOrderProject] = useState('');
  const [orderUrgency, setOrderUrgency] = useState<MaterialRequestUrgency>('Normal');
  const [orderNotes, setOrderNotes] = useState('');

  // Quick Add Item select inside slide drawer panel
  const [addingSearch, setAddingSearch] = useState('');
  const [showAddSelector, setShowAddSelector] = useState(false);
  
  // Collapsible Recent Requests state
  const [isRecentOrdersExpanded, setIsRecentOrdersExpanded] = useState(false);

  // Custom dialog state for Cancel/Reject actions (to bypass iframe sandboxed alert/prompt/confirm limitations)
  const [statusDialog, setStatusDialog] = useState<{
    isOpen: boolean;
    mrId: string;
    mrNo: string;
    actionType: 'Cancel' | 'Reject';
    rejectReason: string;
    error: string;
  }>({
    isOpen: false,
    mrId: '',
    mrNo: '',
    actionType: 'Reject',
    rejectReason: '',
    error: ''
  });

  // Filter low stock and out of stock items
  const lowStockItems = useMemo(() => {
    return materials.filter(m => m.currentStock < m.minStock && m.currentStock > 0);
  }, [materials]);

  const outOfStockItems = useMemo(() => {
    return materials.filter(m => m.currentStock === 0);
  }, [materials]);

  // Available items for manual quick addition in order drawer
  const addableMaterials = useMemo(() => {
    const existingIds = new Set(orderItems.map(i => i.materialId));
    return materials.filter(m => 
      !existingIds.has(m.id) && 
      (!addingSearch.trim() || m.name.toLowerCase().includes(addingSearch.toLowerCase()))
    );
  }, [materials, orderItems, addingSearch]);

  const recentRequests = useMemo(() => {
    return [...materialRequests]
      .filter(mr => {
        const isRaw = mr.projectName === 'Raw Materials' || mr.items.some(item => {
          const m = materials.find(mat => mat.id === item.materialId);
          return m?.category === 'Raw Material' as any;
        });
        return !isRaw;
      })
      .sort((a, b) => b.requestedDate.localeCompare(a.requestedDate))
      .slice(0, 5);
  }, [materialRequests, materials]);

  // ========================================================
  // 3. DATA MEMOIZATION & SEARCH FILTERS
  // ========================================================
  const activeProjects = useMemo(() => {
    return projects.filter(p => !p.isArchived && p.status !== 'completed');
  }, [projects]);

  const selectedMainProjectObj = useMemo(() => {
    return projects.find(p => p.id === mainOrderProjectId);
  }, [projects, mainOrderProjectId]);

  // Filters for Select Lists in Main Order form
  const filteredEmployeesForMainOrder = useMemo(() => {
    const q = mainOrderEmployeeSearch.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(q) || 
      (emp.position && emp.position.toLowerCase().includes(q))
    );
  }, [employees, mainOrderEmployeeSearch]);

  const filteredProjectsForMainOrder = useMemo(() => {
    const q = mainOrderProjectSearch.toLowerCase().trim();
    if (!q) return activeProjects;
    return activeProjects.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.client && p.client.toLowerCase().includes(q))
    );
  }, [activeProjects, mainOrderProjectSearch]);

  // Unified material object selection
  const selectedMainMaterialObj = useMemo(() => {
    if (mainOrderMaterialId === 'wire') {
      return {
        id: 'wire',
        name: 'Welding Wire AWS A5.18 ER70S-6',
        category: 'Wire' as const,
        unit: 'kg' as const,
        currentStock: 1000,
        minStock: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return materials.find(m => m.id === mainOrderMaterialId);
  }, [materials, mainOrderMaterialId]);

  const isWireSelected = useMemo(() => {
    return selectedMainMaterialObj?.category === 'Wire' || selectedMainMaterialObj?.id === 'wire';
  }, [selectedMainMaterialObj]);

  const filteredMaterialsForMainOrder = useMemo(() => {
    // Collect all materials that are consumables
    let matList = materials.filter(m => ['PPE', 'Welding Consumable', 'Wire'].includes(m.category));
    
    // Fallback to ensure 'Welding Wire' is always in the options
    const hasWire = matList.some(m => m.category === 'Wire' || m.id === 'wire');
    if (!hasWire) {
      matList.push({
        id: 'wire',
        name: 'Welding Wire AWS A5.18 ER70S-6',
        category: 'Wire',
        unit: 'kg',
        currentStock: 1000,
        minStock: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const q = mainOrderMaterialSearch.toLowerCase().trim();
    if (!q) return matList;
    return matList.filter(m => m.name.toLowerCase().includes(q));
  }, [materials, mainOrderMaterialSearch]);

  // Overall Consumable Card Summary totals (display summary of system-issued KPIs)
  const summaryTotals = useMemo(() => {
    const totalWire = wireLogs.reduce((s, w) => s + w.amountKg, 0);
    const totalPpe = consumptionLogs.filter(c => c.category === 'PPE').reduce((s, c) => s + c.qtyUsed, 0);
    const totalAcc = consumptionLogs.filter(c => c.category === 'Welding Consumable').reduce((s, c) => s + c.qtyUsed, 0);
    const uniqueEmployeesCount = new Set([
      ...wireLogs.map(w => w.welderId),
      ...consumptionLogs.filter(c => c.employeeId).map(c => c.employeeId!)
    ]).size;

    return {
      totalWire,
      totalPpe,
      totalAcc,
      uniqueEmployeesCount
    };
  }, [wireLogs, consumptionLogs]);

  // Filter consumable requests for the bottom registry
  const filteredConsumableRequests = useMemo(() => {
    return materialRequests.filter(mr => {
      // Exclude raw material requests
      const isRaw = mr.projectName === 'Raw Materials' || mr.items.some(item => {
        const m = materials.find(mat => mat.id === item.materialId);
        return m?.category === 'Raw Material' as any;
      });
      if (isRaw) return false;

      // Filter controls:
      // - Search by employee name or MR number
      const search = registrySearchQuery.toLowerCase().trim();
      if (search) {
        const matchSearch = 
          mr.mrNo.toLowerCase().includes(search) ||
          (mr.forEmployeeName && mr.forEmployeeName.toLowerCase().includes(search)) ||
          (mr.requestedBy && mr.requestedBy.toLowerCase().includes(search)) ||
          mr.projectName.toLowerCase().includes(search) ||
          (mr.notes && mr.notes.toLowerCase().includes(search));
        if (!matchSearch) return false;
      }

      // - Filter by status
      if (registryStatusFilter && mr.status !== registryStatusFilter) return false;

      // - Filter by consumable type (Wire/PPE/Welding Consumable)
      if (registryConsumableTypeFilter && registryConsumableTypeFilter !== 'all') {
        const matchType = mr.items.some(item => {
          if (registryConsumableTypeFilter === 'wire') {
            return item.isWire || item.materialId === 'wire';
          }
          const m = materials.find(mat => mat.id === item.materialId);
          if (registryConsumableTypeFilter === 'ppe') {
            return m?.category === 'PPE';
          }
          if (registryConsumableTypeFilter === 'welding_consumable') {
            return m?.category === 'Welding Consumable';
          }
          return false;
        });
        if (!matchType) return false;
      }

      // - Filter by project
      if (registryProjectFilter && mr.projectId !== registryProjectFilter) return false;

      // - Date range
      if (registryStartDate && mr.requestedDate < registryStartDate) return false;
      if (registryEndDate && mr.requestedDate > registryEndDate) return false;

      return true;
    }).sort((a, b) => b.requestedDate.localeCompare(a.requestedDate));
  }, [materialRequests, materials, registrySearchQuery, registryStatusFilter, registryConsumableTypeFilter, registryProjectFilter, registryStartDate, registryEndDate]);

  // Stock check warning/error helper for the main order form
  const mainOrderMaterialWarningError = useMemo(() => {
    if (isWireSelected) return null;
    if (!selectedMainMaterialObj) return null;
    if (selectedMainMaterialObj.currentStock === 0) {
      return {
        type: 'error',
        message: '⚠ This item is OUT OF STOCK — cannot order'
      };
    }
    if (selectedMainMaterialObj.currentStock < selectedMainMaterialObj.minStock) {
      return {
        type: 'warning',
        message: `⚠ Low stock (${selectedMainMaterialObj.currentStock} left) — order will be fulfilled when restocked`
      };
    }
    return null;
  }, [isWireSelected, selectedMainMaterialObj]);

  // ========================================================
  // 5. EVENT HANDLERS
  // ========================================================
  const handleMainOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMainOrderError('');
    setMainOrderSuccess('');

    if (!mainOrderEmployeeId) {
      setMainOrderError('Please select a receiver employee.');
      return;
    }
    const emp = employees.find(e => e.id === mainOrderEmployeeId);
    if (!emp) {
      setMainOrderError('Receiver employee not found.');
      return;
    }

    if (!mainOrderProjectId) {
      setMainOrderError('Please select a project.');
      return;
    }
    const proj = projects.find(p => p.id === mainOrderProjectId);
    if (!proj) {
      setMainOrderError('Project not found.');
      return;
    }

    if (!mainOrderAssemblyId) {
      setMainOrderError('Please select an assembly.');
      return;
    }
    const asm = proj.assemblies?.find(a => a.id === mainOrderAssemblyId);
    if (!asm) {
      setMainOrderError('Assembly not found.');
      return;
    }

    // Determine current items list
    let finalItems = [...mainOrderItems];

    // If list is empty but they have filled in the material inputs, auto-add it to finalItems
    if (finalItems.length === 0 && mainOrderMaterialId && mainOrderQtyValue) {
      const qty = parseFloat(mainOrderQtyValue);
      const selectedMat = selectedMainMaterialObj;
      if (selectedMat && !isNaN(qty) && qty > 0) {
        const isWire = selectedMat.category === 'Wire' || selectedMat.id === 'wire';
        if (isWire || selectedMat.currentStock > 0) {
          finalItems.push({
            materialId: selectedMat.id,
            materialName: selectedMat.name,
            unit: selectedMat.unit,
            qtyRequested: qty,
            isWire,
            amountKg: isWire ? qty : undefined,
            currentStock: selectedMat.currentStock,
            minStock: selectedMat.minStock
          });
        }
      }
    }

    if (finalItems.length === 0) {
      setMainOrderError('Please select and add at least one material item to the list.');
      return;
    }

    const payload = {
      projectId: proj.id,
      projectName: proj.name,
      assemblyId: asm.id,
      assemblyName: asm.name,
      urgency: mainOrderUrgency,
      status: 'Submitted' as const,
      forEmployeeId: emp.id,
      forEmployeeName: emp.name,
      forEmployeePosition: emp.position,
      items: finalItems.map(item => ({
        materialId: item.materialId,
        materialName: item.materialName,
        unit: item.unit as any,
        qtyRequested: item.qtyRequested,
        isWire: item.isWire,
        amountKg: item.amountKg,
      })),
      requestedBy: currentUser.name,
      requestedById: currentUser.id,
      requestedDate: mainOrderDate,
      notes: mainOrderNotes,
    };

    onAddMaterialRequest?.(payload);

    setMainOrderSuccess('Order submitted — pending approval ✓');
    
    // Reset form but keep employee and project selected for fast consecutive orders
    setMainOrderItems([]);
    setMainOrderQtyValue('');
    setMainOrderMaterialId('');
    setMainOrderMaterialSearch('');
    setMainOrderNotes('');
    setMainOrderUrgency('Normal');

    setTimeout(() => setMainOrderSuccess(''), 4000);
  };

  const handleExportCSV = () => {
    const headers = [
      'MR No',
      'Date',
      'For Employee',
      'Position',
      'Items Requested',
      'Project',
      'Assembly',
      'Urgency',
      'Status',
      'Notes'
    ];
    
    const rows = filteredConsumableRequests.map(mr => {
      const itemsText = mr.items.map(i => `${i.qtyRequested} ${i.unit} of ${i.materialName}`).join('; ');
      return [
        mr.mrNo,
        mr.requestedDate,
        `"${(mr.forEmployeeName || mr.requestedBy || '').replace(/"/g, '""')}"`,
        `"${(mr.forEmployeePosition || '').replace(/"/g, '""')}"`,
        `"${itemsText.replace(/"/g, '""')}"`,
        `"${mr.projectName.replace(/"/g, '""')}"`,
        `"${(mr.assemblyName || '').replace(/"/g, '""')}"`,
        mr.urgency,
        mr.status,
        `"${(mr.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `austin_consumables_orders_registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ========================================================
  // 6. QUICK ORDER METHODS
  // ========================================================
  const handleRemoveOrderItem = (materialId: string) => {
    setOrderItems(prev => prev.filter(i => i.materialId !== materialId));
  };

  const handleUpdateOrderQty = (materialId: string, val: number) => {
    setOrderItems(prev => prev.map(i => {
      if (i.materialId !== materialId) return i;
      let newQty = Math.max(1, val);
      if (i.currentStock > 0 && newQty > i.currentStock) {
        newQty = i.currentStock;
      }
      return { ...i, qtyRequested: newQty };
    }));
  };

  const handleManualAddMaterialToOrder = (mat: MaterialItem) => {
    const isAlreadyAdded = orderItems.some(i => i.materialId === mat.id);
    if (isAlreadyAdded) return;

    let initialQty = Math.max(mat.minStock * 2 - mat.currentStock, 1);
    if (mat.currentStock > 0 && initialQty > mat.currentStock) {
      initialQty = mat.currentStock;
    }

    setOrderItems(prev => [...prev, {
      materialId: mat.id,
      materialName: mat.name,
      unit: mat.unit,
      qtyRequested: initialQty,
      currentStock: mat.currentStock,
      minStock: mat.minStock
    }]);
    setAddingSearch('');
    setShowAddSelector(false);
  };

  const handleOrderSubmit = () => {
    if (orderItems.length === 0) {
      alert('Please select at least 1 item to request!');
      return;
    }

    const hasOutOfStockItem = orderItems.some(i => i.currentStock === 0);
    if (hasOutOfStockItem) {
      alert('Cannot submit request: some items are OUT OF STOCK. Please remove them or contact purchasing.');
      return;
    }

    const payload = {
      projectId: orderProject || '',
      projectName: projects.find(p => p.id === orderProject)?.name || 'General',
      urgency: orderUrgency,
      status: 'Submitted' as const,
      items: orderItems.map(i => ({
        materialId: i.materialId,
        materialName: i.materialName,
        unit: i.unit,
        qtyRequested: Number(i.qtyRequested) || 1
      })),
      requestedBy: currentUser.name,
      requestedById: currentUser.id,
      requestedDate: new Date().toISOString().slice(0,10),
      notes: orderNotes,
    };

    onAddMaterialRequest?.(payload);
    
    // Reset and Close panel
    setOrderItems([]);
    setOrderProject('');
    setOrderUrgency('Normal');
    setOrderNotes('');
    setShowOrderPanel(false);
    
    alert("Order request submitted successfully ✓");
  };

  const activeEmployeeFilterObj = useMemo(() => {
    return employees.find(e => e.id === registryEmployeeFilter);
  }, [employees, registryEmployeeFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-0 relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-border pb-4">
        <div>
          <h2 className="text-xl font-condensed font-black uppercase tracking-tight text-base-text flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" />
            <span>{orgSettings?.terminology?.wireConsumableLabel || 'Consumables'} & PPE Unified Registry</span>
          </h2>
          <p className="text-xs text-base-muted font-sans font-medium mt-1">
            Shopfloor checkout logging for flux-core welding spools, PPE items, and handtools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Standalone New Order Button */}
          <button
            onClick={() => {
              setOrderItems([]);
              setOrderProject('');
              setOrderUrgency('Normal');
              setOrderNotes('');
              setShowOrderPanel(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.8 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-xs"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ New Order</span>
          </button>

          {/* Shortcut View KPI Button */}
          {onNavigateToKPI && (
            <button
              onClick={onNavigateToKPI}
              className="flex items-center gap-1.5 px-3.5 py-1.8 bg-base-surface2 border border-base-border hover:bg-base-surface3 text-base-text rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
            >
              <span>View KPI →</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-TABS SWITCHER */}
      <div className="flex border-b border-base-border mb-4">
        <button
          type="button"
          onClick={() => setMainTab('checkout')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            mainTab === 'checkout'
              ? 'border-amber-500 text-amber-500 font-extrabold'
              : 'border-transparent text-base-muted hover:text-base-text'
          }`}
        >
          Checkout & Registry
        </button>
        <button
          type="button"
          onClick={() => setMainTab('stock')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            mainTab === 'stock'
              ? 'border-amber-500 text-amber-500 font-extrabold'
              : 'border-transparent text-base-muted hover:text-base-text'
          }`}
        >
          Consumable Stock
        </button>
      </div>

      {mainTab === 'checkout' ? (
        <>
          {/* QUICK ORDER BANNERS */}
      {/* 1. OUT OF STOCK BANNER */}
      {outOfStockItems.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start sm:items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="text-xs font-bold text-red-600 dark:text-red-400 block sm:inline mr-2">
                {outOfStockItems.length} item(s) OUT OF STOCK!
              </span>
              <span className="text-[10px] text-base-muted font-medium">
                {outOfStockItems.map(m => m.name).join(', ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              alert(`Purchasing team has been notified about ${outOfStockItems.length} out-of-stock item(s).`);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Notify Purchasing
          </button>
        </div>
      )}

      {/* 2. LOW STOCK BANNER */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start sm:items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block sm:inline mr-2">
                {lowStockItems.length} Consumable item(s) running low
              </span>
              <span className="text-[10px] text-base-muted font-medium">
                {lowStockItems.map(m => m.name).join(', ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setOrderItems(lowStockItems.map(m => ({
                materialId: m.id,
                materialName: m.name,
                unit: m.unit,
                qtyRequested: Math.max(m.minStock * 2, 1),
                currentStock: m.currentStock,
                minStock: m.minStock,
              })));
              setOrderUrgency('Urgent');
              setShowOrderPanel(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-slate-950 hover:bg-amber-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-3 h-3" />
            Order Now
          </button>
        </div>
      )}

      {mainOrderSuccess && (
        <div className="flex items-start gap-2 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg animate-fade-in shadow-xs">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="text-[11px] leading-relaxed font-semibold">{mainOrderSuccess}</span>
        </div>
      )}

      {/* STATS OVERVIEW GRIDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs">
          <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Total Wire Consumed</span>
          <span className="text-lg font-mono font-black text-amber-500 block mt-1">{summaryTotals.totalWire.toFixed(1)} <span className="font-sans text-xs font-normal text-base-muted">kg</span></span>
        </div>
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs">
          <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">PPE Kits Checked Out</span>
          <span className="text-lg font-mono font-black text-amber-500 block mt-1">{summaryTotals.totalPpe} <span className="font-sans text-xs font-normal text-base-muted">pcs</span></span>
        </div>
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs">
          <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Welding Accessories Taken</span>
          <span className="text-lg font-mono font-black text-amber-500 block mt-1">{summaryTotals.totalAcc} <span className="font-sans text-xs font-normal text-base-muted">items</span></span>
        </div>
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs">
          <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Active Personnel Tracker</span>
          <span className="text-lg font-mono font-black text-amber-500 block mt-1">{summaryTotals.uniqueEmployeesCount} <span className="font-sans text-xs font-normal text-base-muted">men</span></span>
        </div>
      </div>

      {/* MAIN SINGLE COLUMN STACKED CONTENT */}
      <div className="space-y-6">
        
        {/* ORDER CONSOLIDATED FORM VIEW (Part 3 & Part 5) */}
        <div className="bg-base-surface border border-base-border p-5 rounded-2xl shadow-card">
          <div className="flex items-center gap-2 border-b border-base-border pb-3 mb-4">
            <ShoppingCart className="h-4.5 w-4.5 text-amber-500" />
            <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider">Order Consumable & PPE Request Form</span>
          </div>

          <form onSubmit={handleMainOrderSubmit} className="space-y-5 text-xs font-medium">
            
            {/* General Request Info Grid */}
            <div className="bg-base-surface2/30 p-4 rounded-xl border border-base-border/50">
              <p className="text-[10px] font-bold text-base-muted uppercase tracking-wider mb-3">General Request Info</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* REQ DATE */}
                <div className="space-y-1.5">
                  <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
                    <Calendar className="h-3.5 w-3.5 text-base-muted" />
                    <span>Request Date</span>
                  </label>
                  <input
                    type="date"
                    value={mainOrderDate}
                    onChange={e => setMainOrderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none text-xs font-semibold focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* RECEIVER EMPLOYEE (Auto-complete) */}
                <div className="space-y-1.5 relative">
                  <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
                    <UserCheck className="h-3.5 w-3.5 text-base-muted" />
                    <span>Receiver Employee *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type employee name..."
                      value={isMainOrderEmployeeFocused ? mainOrderEmployeeSearch : (employees.find(e => e.id === mainOrderEmployeeId)?.name || '')}
                      onChange={e => {
                        setMainOrderEmployeeSearch(e.target.value);
                        if (!e.target.value.trim()) {
                          setMainOrderEmployeeId('');
                        }
                      }}
                      onFocus={() => {
                        setIsMainOrderEmployeeFocused(true);
                        setMainOrderEmployeeSearch('');
                      }}
                      onBlur={() => setTimeout(() => setIsMainOrderEmployeeFocused(false), 250)}
                      className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold placeholder:font-normal"
                    />
                  </div>

                  {isMainOrderEmployeeFocused && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border animate-fade-in">
                      {filteredEmployeesForMainOrder.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-base-muted italic">No matching employee found</div>
                      ) : (
                        filteredEmployeesForMainOrder.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onMouseDown={() => {
                              setMainOrderEmployeeId(emp.id);
                              setMainOrderEmployeeSearch(emp.name);
                              setIsMainOrderEmployeeFocused(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex flex-col"
                          >
                            <span className="font-bold">{emp.name}</span>
                            <span className="text-[10px] opacity-80">{emp.position || 'Manpower'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* CONNECTED PROJECT */}
                <div className="space-y-1.5 relative">
                  <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
                    <Folder className="h-3.5 w-3.5 text-base-muted" />
                    <span>Allocated Project *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search active project..."
                      value={isMainOrderProjectFocused ? mainOrderProjectSearch : (selectedMainProjectObj ? `[${selectedMainProjectObj.client}] ${selectedMainProjectObj.name}` : '')}
                      onChange={e => {
                        setMainOrderProjectSearch(e.target.value);
                        if (!e.target.value.trim()) {
                          setMainOrderProjectId('');
                          setMainOrderAssemblyId('');
                        }
                      }}
                      onFocus={() => {
                        setIsMainOrderProjectFocused(true);
                        setMainOrderProjectSearch('');
                      }}
                      onBlur={() => setTimeout(() => setIsMainOrderProjectFocused(false), 250)}
                      className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold placeholder:font-normal"
                    />
                  </div>

                  {isMainOrderProjectFocused && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border animate-fade-in">
                      {filteredProjectsForMainOrder.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-base-muted italic">No matching projects found</div>
                      ) : (
                        filteredProjectsForMainOrder.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => {
                              setMainOrderProjectId(p.id);
                              setMainOrderProjectSearch(`[${p.client}] ${p.name}`);
                              setIsMainOrderProjectFocused(false);
                              setMainOrderAssemblyId(''); 
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex flex-col"
                          >
                            <span className="font-bold">{p.name}</span>
                            <span className="text-[10px] opacity-80">Client: {p.client}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* TARGET SUB-ASSEMBLY */}
                <div className="space-y-1.5">
                  <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
                    <Wrench className="h-3.5 w-3.5 text-base-muted" />
                    <span>Target Sub-Assembly *</span>
                  </label>
                  <select
                    value={mainOrderAssemblyId}
                    onChange={e => setMainOrderAssemblyId(e.target.value)}
                    disabled={!mainOrderProjectId}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none text-xs font-semibold focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                  >
                    <option value="">-- Choose Sub-Assembly --</option>
                    {selectedMainProjectObj?.assemblies?.map(asm => (
                      <option key={asm.id} value={asm.id}>
                        {asm.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* URGENCY LEVEL */}
                <div className="space-y-1.5">
                  <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider">
                    <AlertTriangle className="h-3.5 w-3.5 text-base-muted" />
                    <span>Urgency Level *</span>
                  </label>
                  <select
                    value={mainOrderUrgency}
                    onChange={e => setMainOrderUrgency(e.target.value as MaterialRequestUrgency)}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none text-xs font-semibold focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Normal">Normal (Routine)</option>
                    <option value="Urgent">Urgent (Restricted)</option>
                    <option value="Critical">Critical (Immediate Stop)</option>
                  </select>
                </div>

                {/* NOTES / REMARKS */}
                <div className="space-y-1.5">
                  <label className="text-base-muted flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider font-bold">
                    <span>Special Instructions / Notes</span>
                  </label>
                  <input
                    type="text"
                    value={mainOrderNotes}
                    onChange={e => setMainOrderNotes(e.target.value)}
                    placeholder="Additional order context, replacement details, etc."
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none focus:ring-1 focus:ring-amber-500 text-xs font-semibold"
                  />
                </div>

              </div>
            </div>

            {/* ITEMS LIST SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-base-border pb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500" />
                  <span className="font-condensed font-bold uppercase text-[11px] text-base-text tracking-wider">
                    Requested Consumables & PPE Items
                  </span>
                </div>
                {mainOrderItems.length > 0 && (
                  <span className="bg-amber-500/15 text-amber-500 font-mono text-[10px] font-black px-2 py-0.5 rounded-full">
                    {mainOrderItems.length} item(s) to request
                  </span>
                )}
              </div>

              {/* Item Adder Inputs */}
              <div className="bg-base-surface2/40 border border-base-border/60 rounded-xl p-4">
                <p className="text-[10px] font-bold text-base-muted uppercase tracking-wider mb-3">Add Item to List</p>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  
                  {/* Choose Material Item Input */}
                  <div className="md:col-span-6 relative">
                    <label className="text-base-muted uppercase font-bold text-[9px] tracking-wider block mb-1">
                      Choose Material Item *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search wire, PPE, or consumable catalog..."
                        value={isMainOrderMaterialFocused ? mainOrderMaterialSearch : (selectedMainMaterialObj?.name || '')}
                        onChange={e => {
                          setMainOrderMaterialSearch(e.target.value);
                          if (!e.target.value.trim()) {
                            setMainOrderMaterialId('');
                          }
                        }}
                        onFocus={() => {
                          setIsMainOrderMaterialFocused(true);
                          setMainOrderMaterialSearch('');
                        }}
                        onBlur={() => setTimeout(() => setIsMainOrderMaterialFocused(false), 250)}
                        className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold placeholder:font-normal"
                      />
                    </div>

                    {isMainOrderMaterialFocused && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border animate-fade-in">
                        {filteredMaterialsForMainOrder.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-base-muted italic">No items found in catalog</div>
                        ) : (
                          filteredMaterialsForMainOrder.map(mat => {
                            const isOutOfStock = mat.currentStock === 0;
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onMouseDown={() => {
                                  setMainOrderMaterialId(mat.id);
                                  setMainOrderMaterialSearch(mat.name);
                                  setIsMainOrderMaterialFocused(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex items-center justify-between ${
                                  isOutOfStock ? 'text-red-500' : ''
                                }`}
                              >
                                <span className="font-bold truncate max-w-[220px]">
                                  {mat.name} {isOutOfStock && <span className="text-[9px] font-extrabold uppercase ml-1.5">(OUT OF STOCK)</span>}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                  isOutOfStock ? 'bg-red-500/10 text-red-500' : 'bg-base-surface3'
                                }`}>
                                  Stock: {mat.currentStock} {mat.unit}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {selectedMainMaterialObj && (
                      <div className="mt-1 flex items-center justify-between text-[10px] text-base-muted font-semibold bg-base-surface2/60 px-2 py-1 rounded">
                        <span>
                          Current Stock: <span className="font-mono font-bold text-base-text">{selectedMainMaterialObj.currentStock}</span> / Min: {selectedMainMaterialObj.minStock} {selectedMainMaterialObj.unit}
                        </span>
                        {mainOrderMaterialWarningError && (
                          <span className={`${
                            mainOrderMaterialWarningError.type === 'error' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'
                          }`}>
                            {mainOrderMaterialWarningError.message}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity Input */}
                  <div className="md:col-span-3">
                    <label className="text-base-muted uppercase font-bold text-[9px] tracking-wider block mb-1">
                      {isWireSelected ? 'Amount (kg) *' : `Qty (${selectedMainMaterialObj?.unit || 'pcs'}) *`}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={isWireSelected ? 'e.g. 15.0' : 'e.g. 2'}
                      value={mainOrderQtyValue}
                      onChange={e => setMainOrderQtyValue(e.target.value)}
                      className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text font-mono font-black outline-none text-xs focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Action Button */}
                  <div className="md:col-span-3 pt-4">
                    <button
                      type="button"
                      onClick={handleAddMainOrderItem}
                      disabled={!mainOrderMaterialId || !mainOrderQtyValue || parseFloat(mainOrderQtyValue) <= 0 || (!isWireSelected && selectedMainMaterialObj?.currentStock === 0)}
                      className="w-full h-9 bg-base-surface3 border border-base-border hover:bg-amber-500 hover:border-amber-500 hover:text-slate-950 disabled:opacity-40 disabled:hover:bg-base-surface3 disabled:hover:text-base-text text-base-text font-bold uppercase tracking-wider rounded-lg transition-all text-[10px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to List</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Display Added Items List */}
              <div className="border border-base-border rounded-xl overflow-x-auto bg-base-surface shadow-xs">
                {mainOrderItems.length === 0 ? (
                  <div className="p-6 text-center italic text-base-muted text-xs">
                    No items added to request list yet. Select a material and qty above, then click "+ Add to List".
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-base-surface2/50 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border text-[10px]">
                        <th className="px-4 py-2.5">Item Name</th>
                        <th className="px-4 py-2.5 text-center">Request Qty</th>
                        <th className="px-4 py-2.5 text-center">Unit</th>
                        <th className="px-4 py-2.5 text-center">Stock Info</th>
                        <th className="px-4 py-2.5 text-center w-16">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-border text-base-text font-medium">
                      {mainOrderItems.map(item => {
                        const isOutOfStock = item.currentStock === 0;
                        const isLowStock = item.currentStock < item.minStock;
                        return (
                          <tr key={item.materialId} className="hover:bg-base-surface2/20">
                            <td className="px-4 py-3 font-semibold">
                              {item.materialName}
                              {isLowStock && !isOutOfStock && (
                                <span className="text-[9px] text-amber-500 font-bold ml-2 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  Low Stock
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-amber-500">
                              {item.qtyRequested}
                            </td>
                            <td className="px-4 py-3 text-center uppercase text-base-muted text-[10px] font-bold">
                              {item.unit}
                            </td>
                            <td className="px-4 py-3 text-center text-[10px] text-base-muted">
                              Stock: {item.currentStock} / Min: {item.minStock}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMainOrderItem(item.materialId)}
                                className="p-1 hover:bg-base-surface2 rounded text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                                title="Remove from list"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>

            {mainOrderError && (
              <div className="flex items-start gap-2 text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-lg animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed font-semibold">{mainOrderError}</span>
              </div>
            )}

            {/* SUBMIT ROW */}
            <div className="pt-2 border-t border-base-border/50 flex justify-end">
              <button
                type="submit"
                disabled={
                  !mainOrderEmployeeId ||
                  !mainOrderProjectId ||
                  !mainOrderAssemblyId ||
                  (mainOrderItems.length === 0 && (!mainOrderMaterialId || !mainOrderQtyValue || parseFloat(mainOrderQtyValue) <= 0))
                }
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 text-slate-950 font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
              >
                Submit Order Request ({mainOrderItems.length > 0 ? mainOrderItems.length : (mainOrderMaterialId && mainOrderQtyValue ? 1 : 0)} Items)
              </button>
            </div>

          </form>
        </div>

        {/* RECENT MATERIAL REQUESTS COLLAPSIBLE MINI SECTION */}
        <div className="bg-base-surface border border-base-border rounded-2xl shadow-card overflow-hidden">
          <button
            onClick={() => setIsRecentOrdersExpanded(prev => !prev)}
            className="w-full px-5 py-4 flex items-center justify-between bg-base-surface2/30 hover:bg-base-surface2/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-amber-500" />
              <span className="font-condensed font-black uppercase text-xs text-base-text tracking-wider">
                Recent Material Requests
              </span>
              <span className="bg-base-surface3 border border-base-border text-[9px] font-mono px-2 py-0.5 rounded-full text-base-text font-black">
                {materialRequests.length} requests
              </span>
            </div>
            {isRecentOrdersExpanded ? (
              <ChevronUp className="h-4 w-4 text-base-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-base-muted" />
            )}
          </button>

          {isRecentOrdersExpanded && (
            <div className="p-5 border-t border-base-border space-y-4 animate-slide-down">
              {recentRequests.length === 0 ? (
                <p className="text-xs text-base-muted italic py-2">No material requests submitted yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-base-border bg-base-surface2/10">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-base-surface2/50 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                        <th className="px-4 py-3">MR No</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Requested Items</th>
                        <th className="px-4 py-3 text-center">Urgency</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-border text-base-text">
                      {recentRequests.map(req => {
                        // Urgency pill styling
                        let urgencyColor = 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
                        if (req.urgency === 'Urgent') urgencyColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                        if (req.urgency === 'Critical') urgencyColor = 'bg-red-500/10 text-red-500 border-red-500/20';

                        // Status pill styling
                        let statusColor = 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
                        if (req.status === 'Submitted') statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                        if (req.status === 'Approved') statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        if (req.status === 'Issued') statusColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                        if (req.status === 'Rejected') statusColor = 'bg-red-500/10 text-red-500 border-red-500/20';

                        const itemsTextSummary = req.items.map(i => `${i.qtyRequested}x ${i.materialName}`).join(', ');

                        return (
                          <tr key={req.id} className="hover:bg-base-surface2/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-black text-amber-500">{req.mrNo}</td>
                            <td className="px-4 py-3 font-mono text-base-muted whitespace-nowrap">{req.requestedDate}</td>
                            <td className="px-4 py-3 font-medium text-base-text max-w-xs truncate" title={itemsTextSummary}>
                              {itemsTextSummary}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${urgencyColor}`}>
                                {req.urgency}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${statusColor}`}>
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {onNavigateToMaterials && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={onNavigateToMaterials}
                    className="text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All Orders</span>
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ======================================================== */}
      {/* CONSOLIDATED HISTORICAL LOG REGISTRY SECTION              */}
      {/* ======================================================== */}
      <div id="consumables-registry-section" className="bg-base-surface border border-base-border p-5 rounded-2xl shadow-card space-y-4">
        
        {/* Registry header controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-base-border pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-amber-500" />
              <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider">Consumable Orders & KPI Status Registry</span>
              <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-md">
                {filteredConsumableRequests.length} Orders
              </span>
            </div>
            
            {activeEmployeeFilterObj && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 w-fit">
                <span>Filtering for: {activeEmployeeFilterObj.name}</span>
                <button 
                  onClick={() => setRegistryEmployeeFilter('')}
                  className="hover:text-red-500 p-0.5 cursor-pointer" 
                  title="Clear employee filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredConsumableRequests.length === 0}
              className="px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-text transition-all cursor-pointer font-condensed font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-xs disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export filtered CSV</span>
            </button>
          </div>
        </div>

        {/* REGISTRY FILTERS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          
          {/* SEARCH BAR */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-base-muted" />
            <input
              type="text"
              placeholder="Search MR, employee..."
              value={registrySearchQuery}
              onChange={e => setRegistrySearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:border-amber-400 text-base-text font-semibold placeholder:font-normal"
            />
          </div>

          {/* PROJECT FILTER */}
          <div>
            <select
              value={registryProjectFilter}
              onChange={e => setRegistryProjectFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text font-semibold focus:border-amber-400"
            >
              <option value="">-- All Projects --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* EMPLOYEES FILTER */}
          <div>
            <select
              value={registryEmployeeFilter}
              onChange={e => setRegistryEmployeeFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text font-semibold focus:border-amber-400"
            >
              <option value="">-- All Employees --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.position ? `(${emp.position})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* CONSUMABLE GROUP TYPE FILTER */}
          <div>
            <select
              value={registryConsumableTypeFilter}
              onChange={e => setRegistryConsumableTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text font-semibold focus:border-amber-400"
            >
              <option value="all">-- All Groups --</option>
              <option value="wire">Welding Wire (kg)</option>
              <option value="ppe">PPE Kits</option>
              <option value="welding_consumable">Welding Accessories</option>
            </select>
          </div>

          {/* STATUS FILTER */}
          <div>
            <select
              value={registryStatusFilter}
              onChange={e => setRegistryStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text font-semibold focus:border-amber-400"
            >
              <option value="">-- All Statuses --</option>
              <option value="Submitted">Submitted (Pending)</option>
              <option value="Approved">Approved (Ready)</option>
              <option value="Issued">Issued (KPI Counted)</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* START DATE */}
          <div>
            <input
              type="date"
              placeholder="Start Date"
              value={registryStartDate}
              onChange={e => setRegistryStartDate(e.target.value)}
              className="w-full px-3 py-1.2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text font-semibold focus:border-amber-400"
            />
          </div>

          {/* END DATE */}
          <div>
            <input
              type="date"
              placeholder="End Date"
              value={registryEndDate}
              onChange={e => setRegistryEndDate(e.target.value)}
              className="w-full px-3 py-1.2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text font-semibold focus:border-amber-400"
            />
          </div>

        </div>

        {/* REGISTRY TABLE */}
        <div className="overflow-x-auto rounded-xl border border-base-border bg-base-surface">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-base-surface2">
              <tr className="text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                <th className="px-4 py-2.5">MR No</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Receiver / Employee</th>
                <th className="px-4 py-2.5">Requested Items</th>
                <th className="px-4 py-2.5">Allocated Project & Assembly</th>
                <th className="px-4 py-2.5 text-center">Urgency</th>
                <th className="px-4 py-2.5 text-center">Status (KPI)</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border text-base-text text-[11px] font-semibold">
              {filteredConsumableRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-base-muted italic">
                    No consumable orders match current filters or search query.
                  </td>
                </tr>
              ) : (
                filteredConsumableRequests.map(mr => {
                  // Urgency pill styling
                  let urgencyColor = 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
                  if (mr.urgency === 'Urgent') urgencyColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                  if (mr.urgency === 'Critical') urgencyColor = 'bg-red-500/10 text-red-500 border-red-500/20';

                  // Status pill styling
                  let statusColor = 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
                  if (mr.status === 'Submitted') statusColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                  if (mr.status === 'Approved') statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  if (mr.status === 'Issued') statusColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                  if (mr.status === 'Rejected') statusColor = 'bg-red-500/10 text-red-500 border-red-500/20';

                  return (
                    <tr key={mr.id} className="hover:bg-base-surface2/40 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-black text-amber-500 whitespace-nowrap">
                        {mr.mrNo}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-base-muted whitespace-nowrap">
                        {mr.requestedDate}
                      </td>
                      <td className="px-4 py-2.5 space-y-1">
                        <span className="block text-base-text font-extrabold">
                          {mr.forEmployeeName || mr.requestedBy}
                        </span>
                        {mr.forEmployeePosition && (
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${getPositionColorClass(mr.forEmployeePosition)}`}>
                            {mr.forEmployeePosition}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 min-w-[200px] space-y-1">
                        {mr.items.map((item, idx) => {
                          let itemBadge = null;
                          const isWireItem = item.isWire || item.materialId === 'wire';
                          const mat = materials.find(m => m.id === item.materialId);
                          const cat = isWireItem ? 'Wire' : (mat?.category || 'Accessory');

                          if (isWireItem) {
                            itemBadge = (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">
                                <Flame className="h-2 w-2" />
                                <span>WIRE</span>
                              </span>
                            );
                          } else if (cat === 'PPE') {
                            itemBadge = (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                                <ShieldAlert className="h-2 w-2" />
                                <span>PPE KIT</span>
                              </span>
                            );
                          } else {
                            itemBadge = (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                <Package className="h-2 w-2" />
                                <span>ACCESSORY</span>
                              </span>
                            );
                          }

                          return (
                            <div key={idx} className="flex items-center justify-between gap-2 py-0.5 border-b border-base-border/20 last:border-0">
                              <span className="flex items-center gap-1 font-semibold text-base-text">
                                {itemBadge}
                                <span className="truncate max-w-[120px]" title={item.materialName}>{item.materialName}</span>
                              </span>
                              <span className="font-mono font-black text-amber-500 whitespace-nowrap">
                                {item.qtyRequested} {item.unit}
                              </span>
                            </div>
                          );
                        })}
                      </td>
                      <td className="px-4 py-2.5 space-y-0.5">
                        <span className="block font-bold text-base-text">{mr.assemblyName || '-'}</span>
                        <span className="block text-[10px] text-base-muted truncate max-w-[180px]" title={mr.projectName}>
                          {mr.projectName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${urgencyColor}`}>
                          {mr.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center space-y-1">
                        <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${statusColor}`}>
                          {mr.status}
                        </span>
                        {mr.status === 'Issued' && (
                          <div className="text-[9px] text-emerald-500/80 font-semibold block">KPI Recorded ✓</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {mr.status === 'Submitted' && (
                            <>
                              <button
                                onClick={() => {
                                  onUpdateMaterialRequestStatus?.(mr.id, 'Approved', { approvedBy: currentUser.name });
                                }}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-condensed font-bold text-[10px] uppercase tracking-wider rounded transition-all cursor-pointer"
                                title="Approve Order"
                              >
                                Approve Order
                              </button>
                              <button
                                onClick={() => {
                                  setStatusDialog({
                                    isOpen: true,
                                    mrId: mr.id,
                                    mrNo: mr.mrNo,
                                    actionType: 'Reject',
                                    rejectReason: '',
                                    error: ''
                                  });
                                }}
                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-condensed font-bold text-[10px] uppercase tracking-wider rounded transition-all cursor-pointer"
                                title="Reject Order"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {mr.status === 'Approved' && (
                            <>
                              <button
                                onClick={() => {
                                  onUpdateMaterialRequestStatus?.(mr.id, 'Issued', { issuedBy: currentUser.name });
                                }}
                                className="px-2.5 py-1 bg-teal-500 hover:bg-teal-600 text-slate-950 font-condensed font-bold text-[10px] uppercase tracking-wider rounded transition-all cursor-pointer animate-pulse"
                                title="Issue Material"
                              >
                                Issue Material
                              </button>
                              <button
                                onClick={() => {
                                  setStatusDialog({
                                    isOpen: true,
                                    mrId: mr.id,
                                    mrNo: mr.mrNo,
                                    actionType: 'Cancel',
                                    rejectReason: '',
                                    error: ''
                                  });
                                }}
                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-condensed font-bold text-[10px] uppercase tracking-wider rounded transition-all cursor-pointer"
                                title="Cancel Order"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {mr.status === 'Issued' && (
                            <span className="text-[9px] text-emerald-500 font-extrabold uppercase bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 whitespace-nowrap">
                              MATERIAL ISSUED (KPI COUNTED)
                            </span>
                          )}
                          {mr.status === 'Rejected' && (
                            <span className="text-[9px] text-red-500 font-extrabold uppercase bg-red-500/10 px-2 py-1 rounded border border-red-500/20 whitespace-nowrap" title={mr.rejectedReason}>
                              REJECTED
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* QUICK ORDER DRAWER PANEL (Slide-over) */}
      {showOrderPanel && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300"
          onClick={() => setShowOrderPanel(false)}
        />
      )}
      
      <div 
        className={`fixed top-0 right-0 h-full w-96 z-50 bg-base-surface2 border-l border-base-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          showOrderPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* PANEL HEADER */}
        <div className="h-14 px-4 border-b border-base-border flex items-center justify-between gap-2 bg-base-surface">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-500" />
            <h3 className="font-condensed font-extrabold uppercase text-sm tracking-wider text-base-text">
              Quick Order Request
            </h3>
          </div>
          <button 
            onClick={() => setShowOrderPanel(false)}
            className="p-1 hover:bg-base-surface2 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5 text-base-muted" />
          </button>
        </div>

        {/* PANEL BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          
          {/* SECTION A — ORDER ITEMS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="uppercase font-bold text-[10px] tracking-wider text-base-muted">Items to Order</span>
              <span className="bg-amber-500/15 text-amber-500 font-mono text-[9px] font-black px-2 py-0.5 rounded-full">
                {orderItems.length} types
              </span>
            </div>

            {orderItems.length === 0 ? (
              <div className="border border-dashed border-base-border p-5 rounded-xl text-center italic text-base-muted">
                No items added yet. Search below to add items.
              </div>
            ) : (
              <div className="space-y-2.5">
                {orderItems.map((item, idx) => {
                  const isOutOfStock = item.currentStock === 0;
                  const isLowStock = item.currentStock < item.minStock;
                  const isCapped = item.currentStock > 0 && item.qtyRequested > item.currentStock;
                  const displayQty = isOutOfStock ? 0 : (isCapped ? item.currentStock : item.qtyRequested);

                  return (
                    <div key={item.materialId} className={`bg-base-surface rounded-xl p-3 border relative space-y-2.5 ${
                      isOutOfStock ? 'border-red-500/30 bg-red-500/5' : 'border-base-border'
                    }`}>
                      {/* Remove Button */}
                      <button 
                        type="button"
                        onClick={() => handleRemoveOrderItem(item.materialId)}
                        className="absolute top-2.5 right-2.5 p-1 hover:bg-base-surface2 rounded text-red-500 hover:text-red-600 cursor-pointer"
                        title="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="block font-bold text-xs text-base-text truncate">{item.materialName}</span>
                          {isOutOfStock && (
                            <span className="bg-red-500 text-white font-extrabold uppercase text-[8px] px-1.5 py-0.2 rounded">
                              OUT OF STOCK
                            </span>
                          )}
                        </div>
                        <span className={`inline-block text-[9px] font-semibold mt-0.5 ${
                          isOutOfStock ? 'text-red-500 font-black' : isLowStock ? 'text-amber-500' : 'text-base-muted'
                        }`}>
                          Stock: {item.currentStock} / Min: {item.minStock} {item.unit}
                        </span>
                      </div>

                      {isOutOfStock ? (
                        <div className="text-[10px] text-red-500 font-bold bg-red-500/10 p-1.5 rounded-lg border border-red-500/20">
                          ⚠ Cannot order — no stock available, contact purchasing
                        </div>
                      ) : (
                        <>
                          {/* Qty Input Row */}
                          <div className="flex items-center gap-2 border-t border-base-border/40 pt-2">
                            <span className="text-base-muted2 font-bold uppercase text-[9px]">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              max={item.currentStock > 0 ? item.currentStock : undefined}
                              value={displayQty}
                              onChange={e => {
                                let val = Number(e.target.value) || 1;
                                if (item.currentStock > 0 && val > item.currentStock) {
                                  val = item.currentStock;
                                }
                                handleUpdateOrderQty(item.materialId, val);
                              }}
                              className="w-20 px-2 py-1 bg-base-surface2 border border-base-border rounded text-center text-xs font-mono font-black"
                            />
                            <span className="text-base-muted uppercase text-[10px] font-bold">{item.unit}</span>
                          </div>

                          {/* Amber warning for adjustment */}
                          {item.currentStock > 0 && item.qtyRequested > item.currentStock && (
                            <div className="text-[9px] text-amber-500 font-bold bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                              ⚠ Only {item.currentStock} available — qty adjusted to available stock
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual Add Items Selector Trigger */}
            <div className="pt-1.5 relative">
              {showAddSelector ? (
                <div className="bg-base-surface border border-base-border p-3 rounded-xl space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border px-2 py-1 rounded-lg">
                    <Search className="w-3.5 h-3.5 text-base-muted" />
                    <input
                      type="text"
                      placeholder="Search consumable catalog..."
                      value={addingSearch}
                      onChange={e => setAddingSearch(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-xs text-base-text font-semibold"
                    />
                    <button onClick={() => setShowAddSelector(false)}>
                      <X className="w-3.5 h-3.5 text-base-muted hover:text-red-500" />
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-base-border/50 text-[11px]">
                    {addableMaterials.length === 0 ? (
                      <p className="p-2 italic text-base-muted text-center">No addable items found</p>
                    ) : (
                      addableMaterials.map(m => {
                        const isOutOfStock = m.currentStock === 0;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleManualAddMaterialToOrder(m)}
                            className={`w-full text-left px-2 py-1.8 hover:bg-amber-500 hover:text-slate-950 flex justify-between items-center transition-colors font-bold ${
                              isOutOfStock ? 'text-red-500' : ''
                            }`}
                          >
                            <span className="truncate max-w-[180px]">
                              {m.name} {isOutOfStock && <span className="text-[9px] font-extrabold uppercase ml-1.5">(OUT OF STOCK)</span>}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              isOutOfStock ? 'bg-red-500/10 text-red-500' : 'bg-base-surface3'
                            }`}>
                              Stock: {m.currentStock} {m.unit}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddSelector(true)}
                  className="w-full py-2 bg-base-surface border border-dashed border-base-border rounded-xl text-[10px] font-bold uppercase tracking-wider text-amber-500 hover:border-amber-500 hover:bg-base-surface/50 transition-all cursor-pointer"
                >
                  + Add Another Item
                </button>
              )}
            </div>

          </div>

          {/* SECTION B — ORDER DETAILS */}
          <div className="space-y-3.5 border-t border-base-border/50 pt-4">
            
            {/* Searchable/Selector project */}
            <div className="space-y-1.5">
              <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Allocated Project (Optional)</label>
              <select
                value={orderProject}
                onChange={e => setOrderProject(e.target.value)}
                className="w-full p-2.5 bg-base-surface border border-base-border rounded-xl text-xs text-base-text outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
              >
                <option value="">-- General Storehouse --</option>
                {activeProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client})
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency Pill buttons */}
            <div className="space-y-1.5">
              <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Urgency Level</label>
              <div className="grid grid-cols-3 gap-1 bg-base-surface border border-base-border p-1 rounded-xl">
                {(['Normal', 'Urgent', 'Critical'] as const).map(lvl => {
                  const isSelected = orderUrgency === lvl;
                  let btnClass = 'text-base-muted hover:text-base-text';
                  if (isSelected) {
                    if (lvl === 'Normal') btnClass = 'bg-neutral-500/10 text-neutral-400 font-extrabold border border-neutral-500/20 shadow-xs';
                    if (lvl === 'Urgent') btnClass = 'bg-amber-500/10 text-amber-500 font-extrabold border border-amber-500/20 shadow-xs';
                    if (lvl === 'Critical') btnClass = 'bg-red-500/10 text-red-500 font-extrabold border border-red-500/20 shadow-xs';
                  }
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setOrderUrgency(lvl)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${btnClass}`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Order Notes */}
            <div className="space-y-1.5">
              <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Order Purpose & Remarks</label>
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Reason for order, special instructions..."
                rows={3}
                className="w-full px-3 py-2 bg-base-surface border border-base-border rounded-xl text-base-text outline-none focus:ring-1 focus:ring-amber-500 text-xs font-semibold"
              />
            </div>

          </div>

          {/* SECTION C — PREVIEW */}
          {orderItems.length > 0 && (
            <div className="bg-base-surface border border-base-border p-3.5 rounded-2xl space-y-1.5 animate-fade-in shadow-xs">
              <span className="block font-condensed font-black uppercase text-[9px] text-base-muted tracking-widest">Request Preview</span>
              <p className="font-medium text-[11px] text-base-text leading-tight">
                Requesting <span className="font-black text-amber-500">{orderItems.length}</span> item type(s) with total <span className="font-black font-mono">{orderItems.reduce((s,i) => s + i.qtyRequested, 0)}</span> units.
              </p>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase mt-1">
                <span className="text-base-muted">Destination:</span>
                <span className="text-base-text truncate max-w-[180px]">
                  {projects.find(p => p.id === orderProject)?.name || 'General Stock'}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* PANEL FOOTER */}
        <div className="p-4 border-t border-base-border bg-base-surface flex gap-2">
          <button
            type="button"
            onClick={() => setShowOrderPanel(false)}
            className="flex-1 py-2 border border-base-border text-base-text font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 text-[10px] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOrderSubmit}
            disabled={orderItems.length === 0}
            className="flex-1 py-2 bg-amber-500 text-slate-950 font-black uppercase tracking-wider rounded-lg hover:bg-amber-600 text-[10px] cursor-pointer disabled:opacity-40"
          >
            Submit Request
          </button>
        </div>

      </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* STATS SECTION FOR STOCK */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs flex items-center gap-3">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Out of Stock</span>
                <span className="text-xl font-mono font-black text-red-500 block">
                  {materials.filter(m => m.category !== 'Other' && m.currentStock === 0).length} <span className="font-sans text-xs font-normal text-base-muted">items</span>
                </span>
              </div>
            </div>
            <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Low Stock Alert</span>
                <span className="text-xl font-mono font-black text-amber-500 block">
                  {materials.filter(m => m.category !== 'Other' && m.currentStock > 0 && m.currentStock < m.minStock).length} <span className="font-sans text-xs font-normal text-base-muted">items</span>
                </span>
              </div>
            </div>
            <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Total Consumables Listed</span>
                <span className="text-xl font-mono font-black text-blue-500 block">
                  {materials.filter(m => m.category !== 'Other').length} <span className="font-sans text-xs font-normal text-base-muted">types</span>
                </span>
              </div>
            </div>
          </div>

          {/* ACTIONS AND FILTERS */}
          <div className="bg-base-surface border border-base-border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted" />
                <input
                  type="text"
                  placeholder="Search consumable stock..."
                  value={stockSearchQuery}
                  onChange={e => setStockSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-base-surface2 border border-base-border rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold placeholder:font-normal"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <select
                  value={stockCategoryFilter}
                  onChange={e => setStockCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold appearance-none pr-8 cursor-pointer"
                >
                  <option value="all">All Consumable Categories</option>
                  <option value="Welding Consumable">Welding Consumable</option>
                  <option value="PPE">PPE</option>
                  <option value="Wire">Wire</option>
                  <option value="Tools & Equipment">Tools & Equipment</option>
                  <option value="Paint & Chemical">Paint & Chemical</option>
                </select>
                <Filter className="absolute right-3 top-3 h-3.5 w-3.5 text-base-muted pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddStockOpen(!isAddStockOpen)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>{isAddStockOpen ? 'Close Form' : 'Add Consumable'}</span>
            </button>
          </div>

          {/* ADD CONSUMABLE STOCK FORM */}
          {isAddStockOpen && (
            <div className="bg-base-surface border border-base-border p-5 rounded-xl shadow-card animate-fade-in space-y-4">
              <div className="flex items-center gap-2 border-b border-base-border pb-2">
                <Package className="h-4.5 w-4.5 text-amber-500" />
                <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider">Add New Consumable Item</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Item Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., Welding Glove Leather Red"
                    value={newStockForm.name}
                    onChange={e => setNewStockForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Category *</label>
                  <select
                    value={newStockForm.category}
                    onChange={e => setNewStockForm(p => ({ ...p, category: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold cursor-pointer"
                  >
                    <option value="Welding Consumable">Welding Consumable</option>
                    <option value="PPE">PPE</option>
                    <option value="Wire">Wire</option>
                    <option value="Tools & Equipment">Tools & Equipment</option>
                    <option value="Paint & Chemical">Paint & Chemical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Unit *</label>
                  <select
                    value={newStockForm.unit}
                    onChange={e => setNewStockForm(p => ({ ...p, unit: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold cursor-pointer"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="roll">roll</option>
                    <option value="liter">liter</option>
                    <option value="meter">meter</option>
                    <option value="box">box</option>
                    <option value="set">set</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Current Stock *</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newStockForm.currentStock === 0 ? '' : newStockForm.currentStock}
                    onChange={e => setNewStockForm(p => ({ ...p, currentStock: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Min Stock Limit *</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={newStockForm.minStock === 0 ? '' : newStockForm.minStock}
                    onChange={e => setNewStockForm(p => ({ ...p, minStock: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Storage Location</label>
                  <input
                    type="text"
                    placeholder="Shelf A-3, Bin 12"
                    value={newStockForm.location}
                    onChange={e => setNewStockForm(p => ({ ...p, location: e.target.value }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold"
                  />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <label className="text-base-muted uppercase font-bold text-[10px] tracking-wider">Specification / Notes</label>
                  <input
                    type="text"
                    placeholder="Brand, size, heat number, or safety standard info..."
                    value={newStockForm.notes}
                    onChange={e => setNewStockForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-base-text font-semibold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStockOpen(false)}
                  className="px-4 py-2 border border-base-border text-base-text font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newStockForm.name.trim()) {
                      alert('Please enter an item name.');
                      return;
                    }
                    onAddMaterial?.(newStockForm);
                    setIsAddStockOpen(false);
                    setNewStockForm({
                      name: '',
                      category: 'Welding Consumable' as MaterialCategory,
                      unit: 'pcs' as MaterialUnit,
                      currentStock: 0,
                      minStock: 0,
                      location: '',
                      notes: ''
                    });
                    alert('Consumable item added successfully ✓');
                  }}
                  className="px-4 py-2 bg-amber-500 text-slate-950 hover:bg-amber-600 font-condensed font-black uppercase tracking-wider rounded-lg text-[10px] cursor-pointer"
                >
                  Create Consumable
                </button>
              </div>
            </div>
          )}

          {/* STOCK GRID TABLE */}
          <div className="bg-base-surface border border-base-border rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-base-surface2 border-b border-base-border text-base-muted font-bold font-condensed uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Consumable Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Min Threshold</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border font-medium">
                  {consumableMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 px-4 text-center text-base-muted italic">
                        No consumable items match your search/filter criteria.
                      </td>
                    </tr>
                  ) : (
                    consumableMaterials.map(m => {
                      const isEditing = editingStockId === m.id;
                      const isLowStock = m.currentStock > 0 && m.currentStock < m.minStock;
                      const isOut = m.currentStock === 0;

                      let statusBadge = (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          OK
                        </span>
                      );
                      if (isOut) {
                        statusBadge = (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                            Out of Stock
                          </span>
                        );
                      } else if (isLowStock) {
                        statusBadge = (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Low Stock
                          </span>
                        );
                      }

                      return (
                        <tr 
                          key={m.id} 
                          className={`hover:bg-base-surface2/30 transition-all ${
                            isOut ? 'bg-red-500/[0.02]' : isLowStock ? 'bg-amber-500/[0.01]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-base-text">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingFields.name || ''}
                                onChange={e => setEditingFields(p => ({ ...p, name: e.target.value }))}
                                className="w-full px-2 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                              />
                            ) : (
                              m.name
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <select
                                value={editingFields.category}
                                onChange={e => setEditingFields(p => ({ ...p, category: e.target.value as any }))}
                                className="px-2 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                              >
                                <option value="Welding Consumable">Welding Consumable</option>
                                <option value="PPE">PPE</option>
                                <option value="Wire">Wire</option>
                                <option value="Tools & Equipment">Tools & Equipment</option>
                                <option value="Paint & Chemical">Paint & Chemical</option>
                              </select>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] bg-base-surface2 border border-base-border rounded text-base-muted font-bold">
                                {m.category}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-base-muted">
                            {isEditing ? (
                              <select
                                value={editingFields.unit}
                                onChange={e => setEditingFields(p => ({ ...p, unit: e.target.value as any }))}
                                className="px-2 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                              >
                                <option value="pcs">pcs</option>
                                <option value="kg">kg</option>
                                <option value="roll">roll</option>
                                <option value="liter">liter</option>
                                <option value="meter">meter</option>
                                <option value="box">box</option>
                                <option value="set">set</option>
                              </select>
                            ) : (
                              m.unit
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editingFields.currentStock ?? 0}
                                onChange={e => setEditingFields(p => ({ ...p, currentStock: parseFloat(e.target.value) || 0 }))}
                                className="w-20 text-center px-1 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                              />
                            ) : (
                              <span className={isOut ? 'text-red-500 font-black' : isLowStock ? 'text-amber-500 font-black' : 'text-base-text'}>
                                {m.currentStock}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-base-muted">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editingFields.minStock ?? 0}
                                onChange={e => setEditingFields(p => ({ ...p, minStock: parseFloat(e.target.value) || 0 }))}
                                className="w-20 text-center px-1 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                              />
                            ) : (
                              m.minStock
                            )}
                          </td>
                          <td className="py-3 px-4 text-base-muted">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingFields.location || ''}
                                onChange={e => setEditingFields(p => ({ ...p, location: e.target.value }))}
                                className="w-full px-2 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            ) : (
                              m.location || '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-base-muted max-w-xs truncate">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingFields.notes || ''}
                                onChange={e => setEditingFields(p => ({ ...p, notes: e.target.value }))}
                                className="w-full px-2 py-1 bg-base-surface border border-base-border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            ) : (
                              m.notes || '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {statusBadge}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onUpdateMaterial) {
                                        onUpdateMaterial(m.id, editingFields);
                                      }
                                      setEditingStockId(null);
                                    }}
                                    className="px-2 py-1 bg-emerald-500 text-slate-950 font-bold uppercase text-[9px] rounded-md hover:bg-emerald-600 cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingStockId(null)}
                                    className="px-2 py-1 bg-base-surface2 border border-base-border text-base-text font-bold uppercase text-[9px] rounded-md hover:bg-base-surface3 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditing(m)}
                                    className="p-1 hover:bg-amber-500/10 text-amber-500 hover:text-amber-600 rounded transition-colors cursor-pointer"
                                    title="Edit Consumable Item"
                                  >
                                    <Sparkles className="h-4 w-4" />
                                  </button>
                                  {onDeleteMaterial && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (setDeleteConfirm) {
                                          setDeleteConfirm({
                                            isOpen: true,
                                            title: 'Delete Consumable Item',
                                            message: `Are you sure you want to delete "${m.name}"?`,
                                            onConfirm: () => {
                                              onDeleteMaterial(m.id);
                                              setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
                                            }
                                          });
                                        } else {
                                          onDeleteMaterial(m.id);
                                        }
                                      }}
                                      className="p-1 hover:bg-red-500/10 text-red-500 hover:text-red-600 rounded transition-colors cursor-pointer"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM STATUS DIALOG (for Cancel / Reject to avoid sandboxed iframe native dialog blocks) */}
      {statusDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in text-xs">
            {/* Header */}
            <div className="px-4 py-3 border-b border-base-border bg-base-surface2 flex items-center justify-between">
              <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>{statusDialog.actionType === 'Reject' ? `Reject Order ${statusDialog.mrNo}` : `Cancel Order ${statusDialog.mrNo}`}</span>
              </span>
              <button 
                onClick={() => setStatusDialog(prev => ({ ...prev, isOpen: false, error: '' }))}
                className="p-1 hover:bg-base-surface3 rounded cursor-pointer text-base-muted hover:text-base-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {statusDialog.actionType === 'Reject' ? (
                <div className="space-y-3">
                  <p className="text-base-text font-medium leading-relaxed">
                    Please provide a reason for rejecting the consumable order request <strong className="text-amber-500 font-black">{statusDialog.mrNo}</strong>.
                  </p>
                  <div className="space-y-1">
                    <label className="text-base-muted block uppercase font-bold text-[10px] tracking-wider">
                      Rejection Reason *
                    </label>
                    <textarea
                      placeholder="e.g., Requested item is currently unavailable or incorrect size chosen."
                      value={statusDialog.rejectReason}
                      onChange={e => setStatusDialog(prev => ({ ...prev, rejectReason: e.target.value, error: '' }))}
                      className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:border-red-500 text-base-text font-semibold min-h-[80px]"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-base-text font-medium leading-relaxed">
                  Are you sure you want to cancel and reject order <strong className="text-amber-500 font-black">{statusDialog.mrNo}</strong>? This will release any reserved materials.
                </p>
              )}

              {statusDialog.error && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{statusDialog.error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-base-surface2 border-t border-base-border flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setStatusDialog(prev => ({ ...prev, isOpen: false, error: '' }))}
                className="px-4 py-2 border border-base-border text-base-text font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface3 text-[10px] cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (statusDialog.actionType === 'Reject') {
                    if (!statusDialog.rejectReason.trim()) {
                      setStatusDialog(prev => ({ ...prev, error: 'Please enter a rejection reason.' }));
                      return;
                    }
                    onUpdateMaterialRequestStatus?.(statusDialog.mrId, 'Rejected', { rejectedReason: statusDialog.rejectReason.trim() });
                  } else {
                    onUpdateMaterialRequestStatus?.(statusDialog.mrId, 'Rejected', { rejectedReason: 'Cancelled by supervisor' });
                  }
                  setStatusDialog(prev => ({ ...prev, isOpen: false, error: '' }));
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-condensed font-black uppercase tracking-wider rounded-lg text-[10px] cursor-pointer"
              >
                {statusDialog.actionType === 'Reject' ? 'Reject Order' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
