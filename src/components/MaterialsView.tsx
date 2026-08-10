import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { can } from '../utils/permissions';
import {
  MaterialItem,
  MaterialRequest,
  MaterialConsumptionLog,
  Project,
  User,
  MaterialCategory,
  MaterialUnit,
  MaterialRequestStatus,
  MaterialRequestUrgency,
  MaterialRequestLine
} from '../types';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  ListFilter,
  Layers,
  ArrowRight,
  TrendingDown,
  Clock,
  Send,
  Activity,
  Download,
  Upload
} from 'lucide-react';

interface MaterialsViewProps {
  materials: MaterialItem[];
  materialRequests: MaterialRequest[];
  projects: Project[];
  currentUser: User;
  onAddMaterial: (item: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateMaterialStock: (id: string, newStock: number) => void;
  onUpdateMaterial?: (id: string, updates: Partial<MaterialItem>) => void;
  onDeleteMaterial: (id: string) => void;
  onAddMaterialRequest: (mr: Omit<MaterialRequest, 'id' | 'mrNo'>) => void;
  onUpdateMaterialRequestStatus: (
    id: string,
    status: MaterialRequestStatus,
    extra?: { approvedBy?: string; rejectedReason?: string; issuedBy?: string }
  ) => void;
  onDeleteMaterialRequest: (id: string) => void;
}

const CATEGORIES: MaterialCategory[] = [
  'Welding Consumable',
  'PPE',
  'Wire',
  'Tools & Equipment',
  'Paint & Chemical',
  'Other'
];

const UNITS: MaterialUnit[] = [
  'kg',
  'pcs',
  'roll',
  'liter',
  'meter',
  'box',
  'set'
];

export default function MaterialsView({
  materials = [],
  materialRequests = [],
  projects = [],
  currentUser,
  onAddMaterial,
  onUpdateMaterialStock,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddMaterialRequest,
  onUpdateMaterialRequestStatus,
  onDeleteMaterialRequest
}: MaterialsViewProps) {
  const isSubmittingRef = useRef<boolean>(false);
  const [isBusy, setIsBusy] = useState(false);
  const consumptionLogs: any[] = [];

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'stock' | 'requests' | 'logs'>('stock');

  // Authorization helper
  const isAdminOrManager = useMemo(() => {
    return currentUser?.role === 'admin' || currentUser?.role === 'manager';
  }, [currentUser]);

  const canManageMaterials = useMemo(() => {
    return can(currentUser, 'manageMaterials');
  }, [currentUser]);

  const canRequestMaterial = useMemo(() => {
    return can(currentUser, 'requestMaterial');
  }, [currentUser]);

  const canIssueMaterial = useMemo(() => {
    return can(currentUser, 'issueMaterial');
  }, [currentUser]);

  // Tab 1 — Stock State & Filters
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState<string>('');
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Add material form state
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<MaterialCategory>('Other');
  const [newMatUnit, setNewMatUnit] = useState<MaterialUnit>('pcs');
  const [newMatCurrentStock, setNewMatCurrentStock] = useState('0');
  const [newMatMinStock, setNewMatMinStock] = useState('0');
  const [newMatLocation, setNewMatLocation] = useState('');
  const [newMatNotes, setNewMatNotes] = useState('');
  const [addMaterialError, setAddMaterialError] = useState('');

  // Tab 2 — Material Requests State & Filters
  const [mrStatusFilter, setMrStatusFilter] = useState<string>('All');
  const [mrProjectFilter, setMrProjectFilter] = useState<string>('All');
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  
  // Create MR state
  const [mrProjectId, setMrProjectId] = useState('');
  const [mrAssemblyId, setMrAssemblyId] = useState('');
  const [mrUrgency, setMrUrgency] = useState<MaterialRequestUrgency>('Normal');
  const [mrNotes, setMrNotes] = useState('');
  const [mrLines, setMrLines] = useState<Array<{ materialId: string; qty: string }>>([]);
  const [mrError, setMrError] = useState('');

  // Rejection state
  const [rejectingMrId, setRejectingMrId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Tab 3 — Consumption Logs State & Filters
  const [logSearch, setLogSearch] = useState('');
  const [isAddingLog, setIsAddingLog] = useState(false);

  // Manual Log Entry form state
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logMaterialId, setLogMaterialId] = useState('');
  const [logQty, setLogQty] = useState('');
  const [logProjectId, setLogProjectId] = useState('');
  const [logAssemblyId, setLogAssemblyId] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logError, setLogError] = useState('');

  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [stockWarningPending, setStockWarningPending] = useState<boolean>(false);

  // Clear stock warning states when log form is closed
  React.useEffect(() => {
    if (!isAddingLog) {
      setStockWarning(null);
      setStockWarningPending(false);
    }
  }, [isAddingLog]);

  // Dynamic Assemblies list for MR creation
  const selectedMrProjectObj = useMemo(() => {
    return projects.find(p => p.id === mrProjectId);
  }, [projects, mrProjectId]);

  const activeProjects = useMemo(() => {
    return projects.filter(p => !p.isArchived && p.status !== 'completed');
  }, [projects]);

  // Dynamic Assemblies list for manual logs
  const selectedLogProjectObj = useMemo(() => {
    return projects.find(p => p.id === logProjectId);
  }, [projects, logProjectId]);

  // Stock Summary calculations for category 'Other'
  const stockSummary = useMemo(() => {
    const list = materials.filter(m => m.category === 'Other');
    const total = list.length;
    let low = 0;
    let out = 0;
    list.forEach(m => {
      if (m.currentStock === 0) {
        out++;
      } else if (m.currentStock < m.minStock) {
        low++;
      }
    });
    return { total, low, out };
  }, [materials]);

  // Filtered Stock Items (Strictly Material Stock where category is 'Other')
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      if (m.category !== 'Other') return false;
      const matchSearch = m.name.toLowerCase().includes(stockSearch.toLowerCase()) || 
                          (m.location && m.location.toLowerCase().includes(stockSearch.toLowerCase())) ||
                          (m.notes && m.notes.toLowerCase().includes(stockSearch.toLowerCase()));
      return matchSearch;
    });
  }, [materials, stockSearch]);

  // Filtered Requests (newest first)
  const filteredRequests = useMemo(() => {
    let sorted = [...materialRequests].sort((a, b) => b.requestedDate.localeCompare(a.requestedDate));
    if (mrStatusFilter !== 'All') {
      sorted = sorted.filter(r => r.status === mrStatusFilter);
    }
    if (mrProjectFilter !== 'All') {
      sorted = sorted.filter(r => r.projectId === mrProjectFilter);
    }
    return sorted;
  }, [materialRequests, mrStatusFilter, mrProjectFilter]);

  // Filtered Consumption Logs (newest first)
  const filteredLogs = useMemo(() => {
    const sorted = [...consumptionLogs].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.filter(l => {
      const matchMat = l.materialName.toLowerCase().includes(logSearch.toLowerCase());
      const matchProj = l.projectName.toLowerCase().includes(logSearch.toLowerCase());
      return matchMat || matchProj;
    });
  }, [consumptionLogs, logSearch]);

  const handleDownloadTemplate = () => {
    try {
      const headers = ['Name', 'Category', 'Unit', 'Current Stock', 'Min Stock', 'Location', 'Notes'];
      const sampleRows = [
        ['Welding Wire ER70S-6 1.2mm', 'Welding Consumable', 'kg', 50, 10, 'Rack A-1', 'For MIG welding'],
        ['Safety Helmet', 'PPE', 'pcs', 20, 5, 'Storage Room', 'Full face shield type'],
        ['Thinner NC', 'Paint & Chemical', 'liter', 15, 3, 'Chemical Cabinet', 'Flammable — store safely'],
      ];
      const cols = [{ wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 35 }];

      const guideHeaders = ['Column', 'Required', 'Format', 'Description'];
      const guideRows = [
        ['Name', 'Yes', 'Text', 'Material name, must be unique'],
        ['Category', 'Yes', 'Text', 'Must be one of: Welding Consumable, PPE, Tools & Equipment, Paint & Chemical, Other'],
        ['Unit', 'Yes', 'Text', 'Must be one of: kg, pcs, roll, liter, meter, box, set'],
        ['Current Stock', 'Yes', 'Number', 'Current quantity in stock (number only, no unit)'],
        ['Min Stock', 'Yes', 'Number', 'Minimum stock threshold for low-stock alert'],
        ['Location', 'No', 'Text', 'Storage location (e.g. Rack A-1, Shelf B)'],
        ['Notes', 'No', 'Text', 'Additional notes about this material'],
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      ws['!cols'] = cols;
      XLSX.utils.book_append_sheet(wb, ws, 'Template Import');

      const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);
      wsGuide['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan');

      XLSX.writeFile(wb, 'Material_Stock_Template.xlsx');
    } catch (err: any) {
      alert('Error creating template: ' + err.message);
    }
  };

  const triggerExcelUpload = () => {
    const inputEl = document.getElementById('mat-excel-input-file') as HTMLInputElement | null;
    if (inputEl) inputEl.click();
  };

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(dataArr, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) {
          alert('No data found in the spreadsheet.');
          return;
        }

        // Flexible column header matching (case-insensitive, trimmed)
        const norm = (s: any) => s.toString().trim().toLowerCase();
        const findKey = (row: any, ...variants: string[]) => {
          const keys = Object.keys(row);
          for (const v of variants) {
            const f = keys.find(k => norm(k) === norm(v));
            if (f) return f;
          }
          return null;
        };

        const first = rows[0] as any;
        const kName     = findKey(first, 'name', 'material name', 'nama', 'item');
        const kCat      = findKey(first, 'category', 'kategori', 'type', 'tipe');
        const kUnit     = findKey(first, 'unit', 'satuan', 'uom');
        const kCurrent  = findKey(first, 'current stock', 'currentstock', 'stock', 'qty', 'quantity', 'stok');
        const kMin      = findKey(first, 'min stock', 'minstock', 'minimum', 'min', 'minimum stock');
        const kLocation = findKey(first, 'location', 'lokasi', 'shelf', 'rack');
        const kNotes    = findKey(first, 'notes', 'catatan', 'remarks', 'keterangan');

        if (!kName) {
          alert('Could not find "Name" column. Please use the provided template.');
          return;
        }

        // Valid values for category and unit
        const validCategories = ['Welding Consumable', 'PPE', 'Tools & Equipment', 'Paint & Chemical', 'Other'];
        const validUnits = ['kg', 'pcs', 'roll', 'liter', 'meter', 'box', 'set'];

        const validImport: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];
        const errors: string[] = [];

        rows.forEach((row: any, idx: number) => {
          const rowNum = idx + 2; // +2 because row 1 is header
          const name = row[kName]?.toString().trim();
          if (!name) return; // skip empty rows silently

          const rawCat = kCat ? row[kCat]?.toString().trim() : 'Other';
          const rawUnit = kUnit ? row[kUnit]?.toString().trim() : 'pcs';
          const rawCurrent = kCurrent ? Number(row[kCurrent]) : 0;
          const rawMin = kMin ? Number(row[kMin]) : 0;

          // Fuzzy match category
          const matchedCat = validCategories.find(c => norm(c) === norm(rawCat)) || 'Other';
          // Fuzzy match unit
          const matchedUnit = validUnits.find(u => norm(u) === norm(rawUnit)) || 'pcs';

          if (isNaN(rawCurrent)) {
            errors.push(`Row ${rowNum}: "${name}" — Current Stock is not a valid number.`);
            return;
          }
          if (isNaN(rawMin)) {
            errors.push(`Row ${rowNum}: "${name}" — Min Stock is not a valid number.`);
            return;
          }

          validImport.push({
            name,
            category: matchedCat as MaterialCategory,
            unit: matchedUnit as MaterialUnit,
            currentStock: rawCurrent,
            minStock: rawMin,
            location: kLocation ? row[kLocation]?.toString().trim() : '',
            notes: kNotes ? row[kNotes]?.toString().trim() : '',
          });
        });

        if (errors.length > 0) {
          alert(`Import completed with ${errors.length} error(s):\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more.` : ''}`);
        }

        if (validImport.length > 0) {
          // Call onAddMaterial for each valid item
          validImport.forEach(item => onAddMaterial(item));
          setImportMsg(`✓ Successfully imported ${validImport.length} material records.`);
          setTimeout(() => {
            setImportMsg(null);
          }, 3000);
        } else {
          alert('No valid material records found to import.');
        }
      } catch (err: any) {
        alert('Failed to parse spreadsheet: ' + err.message);
      }
      ev.target.value = ''; // reset input
    };
    r.readAsArrayBuffer(file);
  };

  // Form handlers
  const handleCreateMaterialSubmit = () => {
    if (isSubmittingRef.current) return;

    if (!newMatName.trim()) {
      setAddMaterialError('Material Name is required');
      return;
    }
    const currentStockNum = Number(newMatCurrentStock);
    const minStockNum = Number(newMatMinStock);
    if (isNaN(currentStockNum) || currentStockNum < 0) {
      setAddMaterialError('Current Stock must be a non-negative number');
      return;
    }
    if (isNaN(minStockNum) || minStockNum < 0) {
      setAddMaterialError('Minimum Stock must be a non-negative number');
      return;
    }

    isSubmittingRef.current = true;
    setIsBusy(true);

    onAddMaterial({
      name: newMatName.trim(),
      category: 'Other',
      unit: newMatUnit,
      currentStock: currentStockNum,
      minStock: minStockNum,
      location: newMatLocation.trim() || undefined,
      notes: newMatNotes.trim() || undefined
    });

    // Reset Form
    setNewMatName('');
    setNewMatCategory('Other');
    setNewMatUnit('pcs');
    setNewMatCurrentStock('0');
    setNewMatMinStock('0');
    setNewMatLocation('');
    setNewMatNotes('');
    setAddMaterialError('');
    setIsAddingMaterial(false);

    setTimeout(() => {
      isSubmittingRef.current = false;
      setIsBusy(false);
    }, 800);
  };

  const handleEditStockSave = (id: string) => {
    const val = Number(editingStockVal);
    if (isNaN(val) || val < 0) {
      alert('Stock quantity must be a non-negative number');
      return;
    }
    onUpdateMaterialStock(id, val);
    setEditingStockId(null);
    setEditingStockVal('');
  };

  const handleCreateMRSubmit = () => {
    if (isSubmittingRef.current) return;

    if (!mrProjectId) {
      setMrError('Please select a project');
      return;
    }
    if (mrLines.length === 0) {
      setMrError('Please add at least one material to the request list');
      return;
    }

    const proj = projects.find(p => p.id === mrProjectId);

    // Verify lines
    const validLines: MaterialRequestLine[] = [];
    for (const line of mrLines) {
      if (!line.materialId) {
        setMrError('Please select a material for all items');
        return;
      }
      const qtyNum = Number(line.qty);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setMrError('Requested quantities must be greater than zero');
        return;
      }

      let matName = '';
      let matUnit: MaterialUnit = 'pcs';
      let realMatId = line.materialId;

      if (line.materialId.startsWith('mp_')) {
        const mpId = line.materialId.replace('mp_', '');
        const mpItem = proj?.materialProcessing?.find(m => m.id === mpId);
        if (mpItem) {
          matName = mpItem.materialName || mpItem.description || 'Project Part';
          matUnit = (mpItem.unit as MaterialUnit) || 'pcs';
        } else {
          setMrError('Selected project material item not found');
          return;
        }
      } else {
        const mat = materials.find(m => m.id === line.materialId);
        if (mat) {
          matName = mat.name;
          matUnit = mat.unit;
        } else {
          setMrError('Selected material not found');
          return;
        }
      }

      validLines.push({
        materialId: realMatId,
        materialName: matName,
        unit: matUnit,
        qtyRequested: qtyNum
      });
    }

    const assem = proj?.assemblies.find(a => a.id === mrAssemblyId);

    isSubmittingRef.current = true;
    setIsBusy(true);

    onAddMaterialRequest({
      projectId: mrProjectId,
      projectName: proj?.name || 'Unknown Project',
      assemblyId: mrAssemblyId || undefined,
      assemblyName: assem?.name || undefined,
      urgency: mrUrgency,
      status: 'Submitted',
      items: validLines,
      requestedBy: currentUser?.name || 'Anonymous',
      requestedById: currentUser?.id || 'guest',
      requestedDate: new Date().toISOString().slice(0, 10),
      notes: mrNotes.trim() || undefined
    });

    // Reset Form
    setMrProjectId('');
    setMrAssemblyId('');
    setMrUrgency('Normal');
    setMrNotes('');
    setMrLines([]);
    setMrError('');
    setIsCreatingRequest(false);

    setTimeout(() => {
      isSubmittingRef.current = false;
      setIsBusy(false);
    }, 800);
  };

  const handleManualLogSubmit = () => {
    if (isSubmittingRef.current) return;

    if (!logDate) {
      setLogError('Date is required');
      return;
    }
    if (!logMaterialId) {
      setLogError('Please select a material');
      return;
    }
    const qtyNum = Number(logQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setLogError('Quantity used must be greater than zero');
      return;
    }
    if (!logProjectId) {
      setLogError('Please select a project');
      return;
    }

    const mat = materials.find(m => m.id === logMaterialId);
    if (!mat) {
      setLogError('Selected material not found');
      return;
    }

    if (qtyNum > mat.currentStock && !stockWarningPending) {
      setStockWarning(`Stock insufficient: requested ${qtyNum} ${mat.unit} but only ${mat.currentStock} ${mat.unit} available. Click "Save Anyway" to proceed.`);
      setStockWarningPending(true);
      return; // Stop here, wait for user confirmation
    }
    // If stockWarningPending is true, user already confirmed — proceed normally
    setStockWarning(null);
    setStockWarningPending(false);

    isSubmittingRef.current = true;
    setIsBusy(true);

    // Optional stock warning - proceed directly, append to notes if warning applies
    let finalNotes = logNotes.trim();
    if (qtyNum > mat.currentStock) {
      const warningNote = `Warning: Quantity used (${qtyNum} ${mat.unit}) exceeds current stock in hand (${mat.currentStock} ${mat.unit}) at registration.`;
      finalNotes = finalNotes ? `${finalNotes} | ${warningNote}` : warningNote;
    }

    const proj = projects.find(p => p.id === logProjectId);
    const assem = proj?.assemblies.find(a => a.id === logAssemblyId);

    // Manual log tracking is now handled in ConsumableView
    console.log('Manual consumption logged locally in console:', {
      date: logDate,
      materialId: logMaterialId,
      materialName: mat.name,
      unit: mat.unit,
      qtyUsed: qtyNum,
      projectId: logProjectId,
      projectName: proj?.name || 'Unknown Project',
      assemblyId: logAssemblyId || undefined,
      assemblyName: assem?.name || undefined,
      issuedBy: currentUser?.name || 'Admin',
      notes: finalNotes || undefined
    });

    // Reset Form
    setLogMaterialId('');
    setLogQty('');
    setLogProjectId('');
    setLogAssemblyId('');
    setLogNotes('');
    setLogError('');
    setStockWarning(null);
    setStockWarningPending(false);
    setIsAddingLog(false);

    setTimeout(() => {
      isSubmittingRef.current = false;
      setIsBusy(false);
    }, 800);
  };

  const handleApproveMR = (mrId: string) => {
    onUpdateMaterialRequestStatus(mrId, 'Approved', {
      approvedBy: currentUser?.name || 'Manager'
    });
  };

  const handleRejectMRSubmit = () => {
    if (!rejectReason.trim()) {
      alert('Please state a reason for rejection.');
      return;
    }
    if (rejectingMrId) {
      onUpdateMaterialRequestStatus(rejectingMrId, 'Rejected', {
        rejectedReason: rejectReason.trim()
      });
      setRejectingMrId(null);
      setRejectReason('');
    }
  };

  const handleIssueMR = (mr: MaterialRequest) => {
    // Reduce stock automatically for each approved item when marked as issued
    mr.items.forEach(item => {
      const mat = materials.find(m => m.id === item.materialId);
      const curStock = mat ? mat.currentStock : 0;
      onUpdateMaterialStock(item.materialId, Math.max(0, curStock - item.qtyRequested));
    });

    onUpdateMaterialRequestStatus(mr.id, 'Issued', {
      issuedBy: currentUser?.name || 'Admin'
    });
  };

  const handleExportLogsCSV = () => {
    try {
      const headers = [
        'Date', 'Material Name', 'Qty Used', 'Unit',
        'Project', 'Sub-Assembly', 'Issued By', 'MR No', 'Notes'
      ];
      const rows = filteredLogs.map(log => [
        log.date,
        log.materialName,
        log.qtyUsed,
        log.unit,
        log.projectName,
        log.assemblyName || '-',
        log.issuedBy,
        log.mrNo || 'Manual Entry',
        log.notes || ''
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 8 },
        { wch: 25 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Consumption Log');

      // Summary sheet by material
      const summaryMap: Record<string, { name: string; unit: string; total: number }> = {};
      filteredLogs.forEach(log => {
        if (!summaryMap[log.materialId]) {
          summaryMap[log.materialId] = { name: log.materialName, unit: log.unit, total: 0 };
        }
        summaryMap[log.materialId].total += log.qtyUsed;
      });
      const summaryHeaders = ['Material Name', 'Unit', 'Total Used'];
      const summaryRows = Object.values(summaryMap)
        .sort((a, b) => b.total - a.total)
        .map(s => [s.name, s.unit, s.total]);
      const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary by Material');

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Material_Consumption_Log_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-0">
      {/* NOTICE BANNER */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4 text-sm text-blue-400 flex items-center gap-2">
        <span>ℹ</span>
        <span>Raw Materials are managed inside Mat. Processing — linked directly to each project.</span>
      </div>

      {/* HEADER TITLE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-base-border pb-4 gap-4">
        <div>
          <h2 className="text-xl font-condensed font-black uppercase tracking-tight text-base-text flex items-center gap-2">
            <Package className="h-5 w-5 text-base-accent" />
            <span>Material Management</span>
          </h2>
          <p className="text-xs text-base-muted font-sans font-medium mt-1">
            Track material stock level and handle assembly material requests.
          </p>
        </div>

        {/* TABS CONTROLLER */}
        <div className="flex bg-base-surface2 border border-base-border p-1 rounded-xl shadow-xs self-start">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all ${
              activeTab === 'stock'
                ? 'bg-base-accent text-white shadow-xs'
                : 'text-base-muted hover:text-base-text'
            }`}
          >
            Stock Inventory
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-1.5 rounded-lg text-xs font-condensed font-bold uppercase transition-all ${
              activeTab === 'requests'
                ? 'bg-base-accent text-white shadow-xs'
                : 'text-base-muted hover:text-base-text'
            }`}
          >
            Material Requests
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1 — STOCK INVENTORY                    */}
      {/* ========================================== */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* STATS SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-base-accent-dim/20 text-base-accent">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold font-condensed uppercase text-base-muted tracking-wider">
                  Total Items
                </span>
                <span className="text-xl font-mono font-black text-base-text">
                  {stockSummary.total}
                </span>
              </div>
            </div>

            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold font-condensed uppercase text-base-muted tracking-wider">
                  Low Stock
                </span>
                <span className="text-xl font-mono font-black text-amber-500">
                  {stockSummary.low}
                </span>
              </div>
            </div>

            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-500/10 text-red-500">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold font-condensed uppercase text-base-muted tracking-wider">
                  Out of Stock
                </span>
                <span className="text-xl font-mono font-black text-red-500">
                  {stockSummary.out}
                </span>
              </div>
            </div>

            <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-base-accent/10 text-base-accent">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold font-condensed uppercase text-base-muted tracking-wider">
                  Pending Requests
                </span>
                <span className="text-xl font-mono font-black text-base-accent">
                  {materialRequests.filter(mr => mr.status === 'Submitted').length}
                </span>
              </div>
            </div>
          </div>

          {/* ADD MATERIAL DIALOG/COLLAPSIBLE FORM */}
          {isAddingMaterial && (
            <div className="bg-base-surface border border-base-accent rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-base-border pb-2">
                <h3 className="font-condensed font-black uppercase text-sm text-base-accent tracking-wide flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span>Add New Stock Item</span>
                </h3>
                <button
                  onClick={() => setIsAddingMaterial(false)}
                  className="p-1 rounded hover:bg-base-surface2 text-base-muted hover:text-base-text cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {addMaterialError && (
                <div className="p-2 text-xs text-red-500 bg-red-500/10 rounded-lg font-medium">
                  {addMaterialError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Material Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lincoln Welding Wire 1.2mm"
                    value={newMatName}
                    onChange={e => setNewMatName(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Category
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Raw Material (Other)"
                    className="w-full bg-base-surface2/50 border border-base-border rounded-lg px-3 py-2 text-xs outline-none font-semibold text-base-muted"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Stock Unit
                  </label>
                  <select
                    value={newMatUnit}
                    onChange={e => setNewMatUnit(e.target.value as MaterialUnit)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  >
                    {UNITS.map(un => (
                      <option key={un} value={un}>
                        {un}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Current Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newMatCurrentStock}
                    onChange={e => setNewMatCurrentStock(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Min Stock Threshold (Low Alert)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newMatMinStock}
                    onChange={e => setNewMatMinStock(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text font-mono"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Storage Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shelf A-3, Workshop 1"
                    value={newMatLocation}
                    onChange={e => setNewMatLocation(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Internal Specifications / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Specification codes, supplier notes, shelf heights..."
                    value={newMatNotes}
                    onChange={e => setNewMatNotes(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  />
                </div>

                <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t border-base-border">
                  <button
                    type="button"
                    onClick={() => setIsAddingMaterial(false)}
                    className="px-4 py-2 border border-base-border hover:bg-base-surface2 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateMaterialSubmit}
                    disabled={isBusy}
                    className="px-4 py-2 bg-base-accent text-white hover:bg-base-accent/90 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Material</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STOCK FILTER BAR */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-base-surface border border-base-border p-3.5 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter stock by name..."
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                  className="w-full bg-base-surface2 border border-base-border rounded-lg pl-9 pr-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                />
              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <input
                type="file"
                id="mat-excel-input-file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full sm:w-auto px-4 py-2 bg-base-surface2 border border-base-border text-base-text hover:bg-base-surface3 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Template</span>
              </button>

              {canManageMaterials && (
                <>
                  <button
                    type="button"
                    onClick={triggerExcelUpload}
                    className="w-full sm:w-auto px-4 py-2 bg-base-surface2 border border-base-border text-base-text hover:bg-base-surface3 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingMaterial(true)}
                    className="w-full md:w-auto px-4 py-2 bg-base-accent text-white hover:bg-base-accent/90 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Material</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* IMPORT SUCCESS MESSAGE */}
          {importMsg && (
            <div className="p-3 text-xs text-green-600 bg-green-500/10 border border-green-500/20 rounded-xl font-semibold animate-fade-in">
              {importMsg}
            </div>
          )}

          {/* STOCK INVENTORY DATA TABLE (SPREADSHEET VIEW) */}
          <div className="overflow-x-auto rounded-xl border border-base-border bg-base-surface shadow-xs">
            <table className="w-full text-left border-collapse text-xs min-w-[900px]">
              <thead>
                <tr className="bg-base-surface2 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                  <th className="px-3 py-2.5 w-[30%]">Material Name</th>
                  <th className="px-3 py-2.5 w-[12%]">Unit</th>
                  <th className="px-3 py-2.5 w-[12%] text-right">Current Stock</th>
                  <th className="px-3 py-2.5 w-[12%] text-right">Min Stock Threshold</th>
                  <th className="px-3 py-2.5 w-[15%]">Location</th>
                  <th className="px-3 py-2.5 w-[19%]">Notes</th>
                  <th className="px-3 py-2.5 w-[8%] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border text-base-text text-[11px] font-semibold">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-base-muted italic">
                      No stock materials found matching current filters. Click "Add Material" above to initialize stock items.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map(m => {
                    const isLow = m.currentStock > 0 && m.currentStock < m.minStock;
                    const isOut = m.currentStock === 0;

                    const handleFieldChange = (field: keyof MaterialItem, val: any) => {
                      if (!onUpdateMaterial) return;
                      
                      // For numbers, parse it safely
                      let parsedVal = val;
                      if (field === 'currentStock' || field === 'minStock') {
                        parsedVal = parseFloat(val);
                        if (isNaN(parsedVal) || parsedVal < 0) return;
                      }
                      
                      onUpdateMaterial(m.id, { [field]: parsedVal });
                    };

                    return (
                      <tr key={m.id} className="hover:bg-amber-500/[0.01] transition-colors focus-within:bg-amber-500/[0.03]">
                        {/* 1. Name */}
                        <td className="p-0 border-r border-base-border">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            placeholder="Material Name"
                            className="w-full h-9 px-3 py-1 bg-transparent hover:bg-base-surface2/40 focus:bg-base-surface border-none outline-none font-bold text-base-text text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        {/* 2. Unit */}
                        <td className="p-0 border-r border-base-border">
                          <select
                            value={m.unit}
                            onChange={(e) => handleFieldChange('unit', e.target.value)}
                            className="w-full h-9 px-3 py-1 bg-transparent hover:bg-base-surface2/40 focus:bg-base-surface border-none outline-none text-base-muted text-xs cursor-pointer focus:ring-1 focus:ring-amber-500 appearance-none font-mono"
                          >
                            {UNITS.map(u => (
                              <option key={u} value={u} className="bg-base-surface text-base-text">{u}</option>
                            ))}
                          </select>
                        </td>

                        {/* 3. Current Stock */}
                        <td className="p-0 border-r border-base-border">
                          <input
                            type="number"
                            min="0"
                            value={m.currentStock}
                            onChange={(e) => handleFieldChange('currentStock', e.target.value)}
                            className={`w-full h-9 px-3 py-1 bg-transparent text-right hover:bg-base-surface2/40 focus:bg-base-surface border-none outline-none font-mono font-black text-xs focus:ring-1 focus:ring-amber-500 ${
                              isOut ? 'text-red-500 font-extrabold' : isLow ? 'text-amber-500 font-extrabold' : 'text-emerald-500'
                            }`}
                          />
                        </td>

                        {/* 4. Min Stock */}
                        <td className="p-0 border-r border-base-border">
                          <input
                            type="number"
                            min="0"
                            value={m.minStock}
                            onChange={(e) => handleFieldChange('minStock', e.target.value)}
                            className="w-full h-9 px-3 py-1 bg-transparent text-right hover:bg-base-surface2/40 focus:bg-base-surface border-none outline-none font-mono text-base-muted text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        {/* 5. Location */}
                        <td className="p-0 border-r border-base-border">
                          <input
                            type="text"
                            value={m.location || ''}
                            onChange={(e) => handleFieldChange('location', e.target.value)}
                            placeholder="Storage Location..."
                            className="w-full h-9 px-3 py-1 bg-transparent hover:bg-base-surface2/40 focus:bg-base-surface border-none outline-none text-base-text text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        {/* 6. Notes */}
                        <td className="p-0 border-r border-base-border">
                          <input
                            type="text"
                            value={m.notes || ''}
                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                            placeholder="Specification codes, supplier info..."
                            className="w-full h-9 px-3 py-1 bg-transparent hover:bg-base-surface2/40 focus:bg-base-surface border-none outline-none text-base-muted text-xs focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        {/* 7. Actions */}
                        <td className="p-0 text-center">
                          {canManageMaterials && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${m.name}?`)) {
                                  onDeleteMaterial(m.id);
                                }
                              }}
                              className="p-1 hover:bg-red-500/10 text-base-muted hover:text-red-500 rounded transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2 — MATERIAL REQUESTS (MR)             */}
      {/* ========================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* CREATE NEW REQUEST DIALOG */}
          {isCreatingRequest && (
            <div className="bg-base-surface border border-base-accent rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-base-border pb-2">
                <h3 className="font-condensed font-black uppercase text-sm text-base-accent tracking-wide flex items-center gap-1.5">
                  <Send className="h-4 w-4" />
                  <span>Draft New Material Request (MR)</span>
                </h3>
                <button
                  onClick={() => setIsCreatingRequest(false)}
                  className="p-1 rounded hover:bg-base-surface2 text-base-muted hover:text-base-text cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {mrError && (
                <div className="p-2 text-xs text-red-500 bg-red-500/10 rounded-lg font-medium">
                  {mrError}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                      Target Project <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={mrProjectId}
                      onChange={e => {
                        setMrProjectId(e.target.value);
                        setMrAssemblyId('');
                      }}
                      className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                    >
                      <option value="">-- Select Active Project --</option>
                      {activeProjects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.client})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                      Connected Sub-Assembly (Optional)
                    </label>
                    <select
                      value={mrAssemblyId}
                      onChange={e => setMrAssemblyId(e.target.value)}
                      disabled={!mrProjectId}
                      className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text disabled:opacity-50"
                    >
                      <option value="">-- Select Assembly --</option>
                      {selectedMrProjectObj?.assemblies.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                      Urgency Priority
                    </label>
                    <select
                      value={mrUrgency}
                      onChange={e => setMrUrgency(e.target.value as MaterialRequestUrgency)}
                      className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* LINE ITEMS GENERATOR */}
                <div className="bg-base-surface2 rounded-xl p-4 border border-base-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-base-muted font-condensed tracking-wider">
                      Request Items List
                    </span>
                    <button
                      type="button"
                      onClick={() => setMrLines(prev => [...prev, { materialId: '', qty: '1' }])}
                      className="px-2.5 py-1 bg-base-surface border border-base-border hover:bg-base-surface3 transition-all rounded text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Item Row</span>
                    </button>
                  </div>

                  {mrLines.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-base-muted italic">
                      No material items added yet. Click "Add Item Row" to start adding requested items.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mrLines.map((line, idx) => {
                        let selectedUnit = 'pcs';
                        if (line.materialId.startsWith('mp_') && selectedMrProjectObj) {
                          const mpId = line.materialId.replace('mp_', '');
                          const mpItem = selectedMrProjectObj.materialProcessing?.find(m => m.id === mpId);
                          if (mpItem && mpItem.unit) selectedUnit = mpItem.unit;
                        } else {
                          const currentMat = materials.find(m => m.id === line.materialId);
                          if (currentMat) selectedUnit = currentMat.unit;
                        }

                        return (
                          <div key={idx} className="flex items-center gap-3 bg-base-surface p-2 border border-base-border rounded-lg animate-fade-in">
                            <div className="flex-1">
                              <select
                                value={line.materialId}
                                onChange={e => {
                                  const val = e.target.value;
                                  const updated = [...mrLines];
                                  updated[idx].materialId = val;
                                  if (val.startsWith('mp_') && selectedMrProjectObj) {
                                    const mpId = val.replace('mp_', '');
                                    const mpItem = selectedMrProjectObj.materialProcessing?.find(m => m.id === mpId);
                                    if (mpItem && mpItem.qty) {
                                      updated[idx].qty = String(mpItem.qty);
                                    }
                                  }
                                  setMrLines(updated);
                                }}
                                className="w-full bg-base-surface2 border border-base-border rounded px-2.5 py-1 text-xs outline-none focus:border-base-accent font-semibold text-base-text"
                              >
                                <option value="">-- Select Material Item --</option>
                                {selectedMrProjectObj && selectedMrProjectObj.materialProcessing && selectedMrProjectObj.materialProcessing.length > 0 && (
                                  <optgroup label={`📦 Project Items (${selectedMrProjectObj.name})`}>
                                    {selectedMrProjectObj.materialProcessing.map(mp => (
                                      <option key={'mp_' + mp.id} value={'mp_' + mp.id}>
                                        {mp.materialName || mp.description} (WO: {mp.workOrder || selectedMrProjectObj.client || 'General'} — Req: {mp.qty} {mp.unit || 'pcs'})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="🏭 General Material Stock">
                                  {materials.map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.category} — Stock: {m.currentStock} {m.unit})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>

                            <div className="w-24 flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                value={line.qty}
                                onChange={e => {
                                  const updated = [...mrLines];
                                  updated[idx].qty = e.target.value;
                                  setMrLines(updated);
                                }}
                                className="w-full bg-base-surface2 border border-base-border rounded px-2 py-1 text-xs outline-none text-right font-bold text-base-text font-mono"
                              />
                              <span className="text-[10px] font-bold uppercase text-base-muted select-none w-8">
                                {selectedUnit}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setMrLines(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 rounded text-base-muted hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Additional Instructions / Purpose remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide details about the work order, specific welder allocations, assembly stages..."
                    value={mrNotes}
                    onChange={e => setMrNotes(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-base-border">
                  <button
                    type="button"
                    onClick={() => setIsCreatingRequest(false)}
                    className="px-4 py-2 border border-base-border hover:bg-base-surface2 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateMRSubmit}
                    disabled={isBusy}
                    className="px-4 py-2 bg-base-accent text-white hover:bg-base-accent/90 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Request</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REJECT MODAL FORM BLOCK */}
          {rejectingMrId && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3 animate-fade-in">
              <h4 className="font-condensed font-black text-xs text-red-500 uppercase tracking-wide">
                Reject Material Request
              </h4>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  required
                  placeholder="Specify reason for rejection..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="flex-1 bg-base-surface border border-base-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-red-500 font-semibold text-base-text"
                />
                <button
                  onClick={handleRejectMRSubmit}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                >
                  Confirm Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingMrId(null);
                    setRejectReason('');
                  }}
                  className="px-3 py-1.5 bg-base-surface border border-base-border text-xs font-condensed font-bold uppercase rounded-lg cursor-pointer hover:bg-base-surface2 text-base-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* REQUESTS LIST FILTER BAR */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-base-surface border border-base-border p-3.5 rounded-xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <ListFilter className="h-4 w-4 text-base-muted" />
              <select
                value={mrStatusFilter}
                onChange={e => setMrStatusFilter(e.target.value)}
                className="w-full sm:w-40 bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted (Pending)</option>
                <option value="Approved">Approved</option>
                <option value="Issued">Issued</option>
                <option value="Rejected">Rejected</option>
              </select>

              <select
                value={mrProjectFilter}
                onChange={e => setMrProjectFilter(e.target.value)}
                className="w-full sm:w-52 bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
              >
                <option value="All">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client})
                  </option>
                ))}
              </select>
            </div>

            {canRequestMaterial && (
              <button
                onClick={() => setIsCreatingRequest(true)}
                className="w-full md:w-auto px-4 py-2 bg-base-accent text-white hover:bg-base-accent/95 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>New Request</span>
              </button>
            )}
          </div>

          {/* REQUESTS GRAPH CARDS */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="bg-base-surface border border-base-border rounded-xl p-8 text-center text-base-muted italic text-xs">
                No material requests matched current filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[65vh] rounded-xl border border-base-border bg-base-surface shadow-xs">
                <table className="w-full border-collapse text-left text-xs min-w-[1100px]">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted sticky top-0 z-10">
                      <th className="py-2.5 px-4">MR No</th>
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4">WO No</th>
                      <th className="py-2.5 px-4">Project & Assembly</th>
                      <th className="py-2.5 px-4">Requested Materials</th>
                      <th className="py-2.5 px-4">Requestor</th>
                      <th className="py-2.5 px-4 text-center">Urgency</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border text-base-text bg-base-surface">
                    {filteredRequests.map(mr => {
                      const isNormal = mr.urgency === 'Normal';
                      const isUrgent = mr.urgency === 'Urgent';
                      const isCritical = mr.urgency === 'Critical';
                      const matchingProject = projects.find(p => p.id === mr.projectId);
                      const workOrderNo = matchingProject?.client || '—';

                      return (
                        <tr key={mr.id} className="hover:bg-base-surface2/40 transition-colors">
                          <td className="py-1.5 px-4 font-mono font-black text-base-accent">
                            {mr.mrNo}
                          </td>
                          <td className="py-1.5 px-4 font-mono text-base-muted">
                            {mr.requestedDate}
                          </td>
                          <td className="py-1.5 px-4 font-mono font-bold text-base-text">
                            {workOrderNo}
                          </td>
                          <td className="py-1.5 px-4">
                            <div className="font-bold text-base-text truncate max-w-[200px]" title={mr.projectName}>
                              {mr.projectName}
                            </div>
                            {mr.assemblyName && (
                              <div className="text-[10px] font-bold text-base-accent truncate max-w-[200px]" title={mr.assemblyName}>
                                {mr.assemblyName}
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-4 min-w-[220px] max-w-[300px]">
                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                              {mr.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[11px] py-0.5 border-b border-base-border/30 last:border-0">
                                  <span className="font-medium text-base-text truncate pr-2" title={it.materialName}>
                                    {it.materialName}
                                  </span>
                                  <span className="font-mono font-bold text-base-accent shrink-0">
                                    {it.qtyRequested} <span className="text-[9px] font-normal uppercase text-base-muted">{it.unit}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-1.5 px-4 text-base-text font-medium">
                            {mr.requestedBy}
                          </td>
                          <td className="py-1.5 px-4 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-condensed inline-block ${
                                isCritical
                                  ? 'bg-red-500 text-white'
                                  : isUrgent
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-base-surface2 text-base-muted border border-base-border'
                              }`}
                            >
                              {mr.urgency}
                            </span>
                          </td>
                          <td className="py-1.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider inline-block ${
                                mr.status === 'Submitted'
                                  ? 'bg-blue-500/15 text-blue-500 border border-blue-500/20'
                                  : mr.status === 'Approved'
                                  ? 'bg-green-500/15 text-green-500 border border-green-500/20'
                                  : mr.status === 'Issued'
                                  ? 'bg-teal-500/15 text-teal-500 border border-teal-500/20'
                                  : mr.status === 'Rejected'
                                  ? 'bg-red-500/15 text-red-500 border border-red-500/20'
                                  : 'bg-base-surface3 text-base-muted'
                              }`}
                            >
                              {mr.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {canIssueMaterial && (
                                <>
                                  {mr.status === 'Submitted' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveMR(mr.id)}
                                        className="py-1 px-2 bg-green-600 hover:bg-green-700 text-white font-condensed font-black uppercase text-[10px] rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                        title="Approve MR"
                                      >
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setRejectingMrId(mr.id)}
                                        className="py-1 px-2 bg-red-500/15 hover:bg-red-500 hover:text-white text-red-500 font-condensed font-black uppercase text-[10px] rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                        title="Reject MR"
                                      >
                                        <X className="h-3 w-3" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}

                                  {mr.status === 'Approved' && (
                                    <button
                                      type="button"
                                      onClick={() => handleIssueMR(mr)}
                                      className="py-1 px-2 bg-teal-600 hover:bg-teal-700 text-white font-condensed font-black uppercase text-[10px] rounded transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                      title="Issue MR"
                                    >
                                      <Layers className="h-3 w-3 animate-pulse" />
                                      <span>Issue</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteMaterialRequest(mr.id);
                                    }}
                                    className="p-1 text-base-muted hover:text-red-500 rounded hover:bg-red-500/10 cursor-pointer"
                                    title="Delete MR"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
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
      )}

      {/* ========================================== */}
      {/* TAB 3 — CONSUMPTION LOG                    */}
      {/* ========================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* MANUAL LOG DIALOG */}
          {isAddingLog && (
            <div className="bg-base-surface border border-base-accent rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-base-border pb-2">
                <h3 className="font-condensed font-black uppercase text-sm text-base-accent tracking-wide flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  <span>Log Manual Stock Consumption Entry</span>
                </h3>
                <button
                  onClick={() => setIsAddingLog(false)}
                  className="p-1 rounded hover:bg-base-surface2 text-base-muted hover:text-base-text cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {logError && (
                <div className="p-2 text-xs text-red-500 bg-red-500/10 rounded-lg font-medium">
                  {logError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Consumption Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Select Material <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={logMaterialId}
                    onChange={e => setLogMaterialId(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  >
                    <option value="">-- Choose Material --</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit} — Current Stock: {m.currentStock})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Quantity Used <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    placeholder="e.g. 5"
                    value={logQty}
                    onChange={e => setLogQty(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Project Allocation <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={logProjectId}
                    onChange={e => {
                      setLogProjectId(e.target.value);
                      setLogAssemblyId('');
                    }}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  >
                    <option value="">-- Choose Target Project --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Connected Sub-Assembly (Optional)
                  </label>
                  <select
                    value={logAssemblyId}
                    onChange={e => setLogAssemblyId(e.target.value)}
                    disabled={!logProjectId}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text disabled:opacity-50"
                  >
                    <option value="">-- Select Assembly --</option>
                    {selectedLogProjectObj?.assemblies.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Authorized Signatory / Staff
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.name || 'Staff'}
                    className="w-full bg-base-surface3 border border-base-border rounded-lg px-3 py-2 text-xs outline-none font-semibold text-base-text opacity-70"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] uppercase font-bold text-base-muted mb-1 font-condensed">
                    Specific Allocation Notes / Purpose
                  </label>
                  <input
                    type="text"
                    placeholder="Specific joint weld-outs, workshop storage replacements..."
                    value={logNotes}
                    onChange={e => setLogNotes(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
                  />
                </div>

                <div className="md:col-span-3 pt-2 border-t border-base-border">
                  {stockWarning && (
                    <div className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3 animate-fade-in flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{stockWarning}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    {stockWarningPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setStockWarning(null); setStockWarningPending(false); }}
                          className="px-4 py-2 border border-base-border hover:bg-base-surface2 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer text-base-text"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleManualLogSubmit}
                          disabled={isBusy}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="h-4 w-4" />
                          <span>Save Anyway</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsAddingLog(false)}
                          className="px-4 py-2 border border-base-border hover:bg-base-surface2 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer text-base-text"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleManualLogSubmit}
                          disabled={isBusy}
                          className="px-4 py-2 bg-base-accent text-white hover:bg-base-accent/90 rounded-lg text-xs font-condensed font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="h-4 w-4" />
                          <span>Save Log Entry</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGS FILTER BAR */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-base-surface border border-base-border p-3.5 rounded-xl shadow-xs">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Filter logs by material or project..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                className="w-full bg-base-surface2 border border-base-border rounded-lg pl-9 pr-3 py-2 text-xs focus:border-base-accent outline-none font-semibold text-base-text"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={handleExportLogsCSV}
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Export list as Excel spreadsheet (.xlsx)"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Excel</span>
              </button>

              {canManageMaterials && (
                <button
                  onClick={() => setIsAddingLog(true)}
                  className="flex-1 md:flex-none px-4 py-2 bg-base-accent text-white hover:bg-base-accent/95 rounded-lg text-xs font-condensed font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Log Entry</span>
                </button>
              )}
            </div>
          </div>

          {/* AUDITED LOG TABLE */}
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh] rounded-xl border border-base-border bg-base-surface shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-base-surface2">
                <tr className="bg-base-surface2 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Material Name</th>
                  <th className="px-4 py-3 text-right">Qty Dispensed</th>
                  <th className="px-4 py-3">Allocated Project & Assembly</th>
                  <th className="px-4 py-3">Issued By</th>
                  <th className="px-4 py-3">MR Reference</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border text-base-text text-[11px] font-semibold">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-base-muted italic">
                      No consumption audit logs found matching current search.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-base-surface2/30 transition-colors">
                      <td className="px-4 py-1.5 font-mono text-base-muted whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="px-4 py-1.5 font-bold text-base-text">
                        {log.materialName}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono font-black text-amber-500 whitespace-nowrap">
                        -{log.qtyUsed} <span className="text-[9px] font-normal uppercase text-base-muted">{log.unit}</span>
                      </td>
                      <td className="px-4 py-1.5">
                        <span className="block font-bold text-base-text">{log.projectName}</span>
                        {log.assemblyName && (
                          <span className="block text-[10px] text-base-accent font-medium">
                            {log.assemblyName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-base-text">
                        {log.issuedBy}
                      </td>
                      <td className="px-4 py-1.5">
                        {log.mrNo ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-base-accent-dim text-base-accent">
                            {log.mrNo}
                          </span>
                        ) : (
                          <span className="text-base-muted italic text-[10px]">Manual Entry</span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 max-w-xs truncate text-base-muted font-normal italic" title={log.notes}>
                        {log.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
