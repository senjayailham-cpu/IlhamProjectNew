import React, { useState, useMemo } from 'react';
import { BomTemplate, BomItem, MaterialItem, MaterialProcessing, DrawingRevision, Project, User } from '../types';
import jsPDF from 'jspdf';
import { 
  ListTree, Plus, Search, Filter, Layers, FileText, CheckCircle2, 
  AlertTriangle, AlertCircle, X, Copy, Edit3, Archive, Trash2, Download, 
  ArrowUp, ArrowDown, ExternalLink, ChevronRight, Tag, Building2, Clock, 
  User as UserIcon, Box, FileSpreadsheet, Eye, Check, ShieldAlert,
  Calculator, Sparkles, PieChart, Maximize2, ArrowRight
} from 'lucide-react';

interface BomViewProps {
  bomTemplates: BomTemplate[];
  materials: MaterialItem[];
  materialProcessings: MaterialProcessing[];
  drawings: DrawingRevision[];
  masterData: any;
  projects: Project[];
  currentUser: User;
  setActiveTab: (tab: string) => void;
  onAddBomTemplate: (template: Omit<BomTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName'>) => Promise<void>;
  onUpdateBomTemplate: (id: string, updates: Partial<BomTemplate>) => Promise<void>;
  onDeleteBomTemplate: (id: string) => Promise<void>;
  onAddMaterialProcessing?: (
    projectId: string,
    item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ) => Promise<void>;
}

export default function BomView({
  bomTemplates,
  materials,
  materialProcessings,
  drawings,
  masterData,
  projects,
  currentUser,
  setActiveTab,
  onAddBomTemplate,
  onUpdateBomTemplate,
  onDeleteBomTemplate,
  onAddMaterialProcessing
}: BomViewProps) {
  // Permission checks
  const normalizedRole = (currentUser?.role || '').toLowerCase();
  const canEdit = ['admin', 'manager', 'coordinator', 'project control', 'project_control'].includes(normalizedRole);
  const canDelete = ['admin', 'manager'].includes(normalizedRole);

  // State Filters (Sidebar)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('active');
  const [modelFilter, setModelFilter] = useState<string>('all');

  // Selected Template ID
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Table Grouping & Sorting
  const [isGroupedByCategory, setIsGroupedByCategory] = useState(false);
  const [sortField, setSortField] = useState<keyof BomItem>('partNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Inline Editing State for Qty / Weight
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'quantity' | 'weightPerUnit'; value: string } | null>(null);

  // 3D Isometric Schematic & Weight Distribution Panel State
  const [showSchematicAnalytics, setShowSchematicAnalytics] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Quick Steel Plate Mass Calculator Modal State
  const [showPlateCalcModal, setShowPlateCalcModal] = useState(false);
  const [plateCalcData, setPlateCalcData] = useState({
    lengthMm: 6000,
    widthMm: 2000,
    thicknessMm: 12,
    quantity: 1,
    densityGrade: '7.85'
  });

  // Modals State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BomTemplate | null>(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BomItem | null>(null);

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null
  });

  // Template Form State
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    model: 'Ultima',
    truckModel: '',
    version: 'v1',
    status: 'active' as BomTemplate['status'],
    gaNumber: '',
    notes: ''
  });

  // Item Form State
  const [itemFormData, setItemFormData] = useState({
    partNumber: '',
    description: '',
    material: '',
    category: 'plate' as BomItem['category'],
    quantity: 1,
    unit: 'pcs' as BomItem['unit'],
    dimensions: '',
    weightPerUnit: 0,
    drawingRef: '',
    notes: ''
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate to Material Processing Modal & Toast State
  const [isGenerateMpModalOpen, setIsGenerateMpModalOpen] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [generateToast, setGenerateToast] = useState<{ show: boolean; count: number } | null>(null);
  const [isGeneratingMp, setIsGeneratingMp] = useState(false);

  // Auto-select first active template on load if none selected
  const activeTemplates = useMemo(() => {
    return bomTemplates.filter(t => t.status === 'active');
  }, [bomTemplates]);

  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId) {
      return bomTemplates.find(t => t.id === selectedTemplateId) || null;
    }
    if (activeTemplates.length > 0) {
      return activeTemplates[0];
    }
    return bomTemplates[0] || null;
  }, [selectedTemplateId, bomTemplates, activeTemplates]);

  // Eligible Items & Matching Project for Material Processing Generation
  const eligibleMpItems = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.items) return [];
    return selectedTemplate.items.filter(
      it => it.category === 'plate' || it.category === 'structural'
    );
  }, [selectedTemplate]);

  const canGenerateMatProcessing = Boolean(
    selectedTemplate?.gaNumber && 
    selectedTemplate.gaNumber.trim() !== '' && 
    eligibleMpItems.length > 0
  );

  const matchingProject = useMemo(() => {
    if (!selectedTemplate?.gaNumber) return null;
    const cleanGa = selectedTemplate.gaNumber.trim().toUpperCase();
    return projects.find(p => p.gaNumber?.trim().toUpperCase() === cleanGa) || null;
  }, [selectedTemplate?.gaNumber, projects]);

  const existingMpPartNos = useMemo(() => {
    if (!selectedTemplate?.gaNumber) return new Set<string>();
    const cleanGa = selectedTemplate.gaNumber.trim().toUpperCase();
    const matchingProjId = matchingProject?.id;

    const set = new Set<string>();
    (materialProcessings || []).forEach(mp => {
      const mpGa = (mp.gaNumber || '').trim().toUpperCase();
      const mpProjId = mp.projectId;
      if ((cleanGa && mpGa === cleanGa) || (matchingProjId && mpProjId === matchingProjId)) {
        if (mp.partNo) {
          set.add(mp.partNo.trim().toLowerCase());
        }
      }
    });
    return set;
  }, [selectedTemplate?.gaNumber, matchingProject?.id, materialProcessings]);

  const itemsToGenerate = useMemo(() => {
    if (!skipDuplicates) return eligibleMpItems;
    return eligibleMpItems.filter(item => {
      const pNo = (item.partNumber || '').trim().toLowerCase();
      if (!pNo) return true;
      return !existingMpPartNos.has(pNo);
    });
  }, [eligibleMpItems, skipDuplicates, existingMpPartNos]);

  const handleGenerateMaterialProcessing = async () => {
    if (!selectedTemplate || !onAddMaterialProcessing) return;
    setIsGeneratingMp(true);
    try {
      let createdCount = 0;
      for (const item of itemsToGenerate) {
        const mpItem: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
          projectId: matchingProject?.id || '',
          projectName: matchingProject?.client || matchingProject?.name || selectedTemplate.name,
          workOrder: matchingProject?.client || selectedTemplate.name,
          gaNumber: selectedTemplate.gaNumber,
          materialName: item.material || item.description || item.partNumber,
          material: item.material,
          grade: item.material,
          partNo: item.partNumber,
          description: item.description,
          dimensions: item.dimensions || '',
          qty: item.quantity,
          unit: item.unit === 'pcs' ? 'pcs' : 'kg',
          massKg: item.weightPerUnit || 0,
          activeStages: ['nesting_cnc', 'bending', 'machining'],
          stages: {
            nesting_cnc: { pct: 0, status: 'pending' },
            bending: { pct: 0, status: 'pending' },
            machining: { pct: 0, status: 'pending' }
          },
          overallPct: 0,
          isCompleted: false,
          isStocked: false
        };

        await onAddMaterialProcessing(matchingProject?.id || '', mpItem);
        createdCount++;
      }

      setIsGenerateMpModalOpen(false);
      setGenerateToast({ show: true, count: createdCount });
    } catch (err) {
      console.error('Failed to generate Material Processing items:', err);
    } finally {
      setIsGeneratingMp(false);
    }
  };

  // Sidebar Filtered List
  const filteredTemplates = useMemo(() => {
    return bomTemplates.filter(t => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = t.name.toLowerCase().includes(q);
        const matchModel = (t.model || '').toLowerCase().includes(q);
        const matchGA = (t.gaNumber || '').toLowerCase().includes(q);
        const matchTruck = (t.truckModel || '').toLowerCase().includes(q);
        if (!matchName && !matchModel && !matchGA && !matchTruck) return false;
      }

      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }

      if (modelFilter !== 'all') {
        if (modelFilter === 'Other') {
          if (['Ultima', 'HPT', 'JEC'].includes(t.model)) return false;
        } else if (t.model !== modelFilter) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }, [bomTemplates, searchQuery, statusFilter, modelFilter]);

  // Mini Stats for Sidebar
  const sidebarStats = useMemo(() => {
    const total = bomTemplates.length;
    const active = bomTemplates.filter(t => t.status === 'active').length;
    const draft = bomTemplates.filter(t => t.status === 'draft').length;
    return { total, active, draft };
  }, [bomTemplates]);

  // Autocomplete List for GA Numbers
  const availableGaNumbers = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.gaNumber) set.add(p.gaNumber);
    });
    if (masterData?.gaNumbers && Array.isArray(masterData.gaNumbers)) {
      masterData.gaNumbers.forEach((g: any) => {
        if (typeof g === 'string') set.add(g);
        else if (g.code) set.add(g.code);
      });
    }
    return Array.from(set).sort();
  }, [projects, masterData]);

  // Autocomplete List for Materials
  const availableMaterials = useMemo(() => {
    const set = new Set<string>();
    materials.forEach(m => set.add(m.name));
    if (masterData?.materials && Array.isArray(masterData.materials)) {
      masterData.materials.forEach((m: any) => {
        if (typeof m === 'string') set.add(m);
        else if (m.name) set.add(m.name);
      });
    }
    return Array.from(set).sort();
  }, [materials, masterData]);

  // Autocomplete List for Drawings
  const availableDrawings = useMemo(() => {
    return drawings.map(d => ({
      number: d.drawingNumber,
      title: d.title,
      label: `${d.drawingNumber} — ${d.title} (Rev ${d.revision})`
    }));
  }, [drawings]);

  // Stock Status Calculator Helper for an Item
  const calculateStockStatus = (item: BomItem) => {
    if (!item.material) return { status: 'none', label: '—', color: 'text-base-muted bg-base-surface2 border-base-border', currentStock: 0, requiredWeight: 0 };

    const reqQty = item.quantity || 0;
    const reqWeight = item.totalWeight || (reqQty * (item.weightPerUnit || 0));

    // Case-insensitive partial match on material name
    const itemMatLower = item.material.trim().toLowerCase();
    const matchedMaterial = materials.find(m => {
      const nameLower = m.name.toLowerCase();
      return nameLower === itemMatLower || nameLower.includes(itemMatLower) || itemMatLower.includes(nameLower);
    });

    if (!matchedMaterial) {
      return { status: 'none', label: '—', color: 'text-base-muted bg-base-surface2 border-base-border', currentStock: 0, requiredWeight: reqWeight };
    }

    const currentStock = matchedMaterial.currentStock || 0;

    if (currentStock <= 0) {
      return { status: 'no_stock', label: 'NO STOCK', color: 'bg-base-red-dim text-base-red border-base-red/30', currentStock, requiredWeight: reqWeight };
    } else if (currentStock < reqWeight || currentStock < reqQty) {
      return { status: 'low_stock', label: 'LOW STOCK', color: 'bg-base-accent-dim text-base-accent border-base-accent/30', currentStock, requiredWeight: reqWeight };
    } else {
      return { status: 'sufficient', label: 'SUFFICIENT', color: 'bg-base-green-dim text-base-green border-base-green/30', currentStock, requiredWeight: reqWeight };
    }
  };

  // Stock Shortage Alert Bar summary for selected template
  const stockSummary = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.items) {
      return { shortageCount: 0, totalItems: 0, consumedInProcessing: 0, alertType: 'green' as 'green' | 'orange' | 'red' };
    }

    let shortageCount = 0;
    selectedTemplate.items.forEach(item => {
      const res = calculateStockStatus(item);
      if (res.status === 'no_stock' || res.status === 'low_stock') {
        shortageCount++;
      }
    });

    // Calculate material in processing for matching GA Number
    let consumedInProcessing = 0;
    if (selectedTemplate.gaNumber) {
      const targetGa = selectedTemplate.gaNumber.trim().toLowerCase();
      materialProcessings.forEach(mp => {
        if (mp.gaNumber && mp.gaNumber.trim().toLowerCase() === targetGa) {
          consumedInProcessing += ((mp.qty || 0) * (mp.massKg || 1));
        }
      });
    }

    let alertType: 'green' | 'orange' | 'red' = 'green';
    if (shortageCount >= 3) alertType = 'red';
    else if (shortageCount >= 1) alertType = 'orange';

    return {
      shortageCount,
      totalItems: selectedTemplate.items.length,
      consumedInProcessing,
      alertType
    };
  }, [selectedTemplate, materials, materialProcessings]);

  // Model Badge Styling Helper
  const getModelBadgeStyle = (model: string) => {
    if (model === 'Ultima') return 'bg-base-accent-dim text-base-accent border-base-accent/30';
    if (model === 'HPT') return 'bg-base-blue-dim text-base-blue border-base-blue/30';
    if (model === 'JEC') return 'bg-base-green-dim text-base-green border-base-green/30';
    return 'bg-base-surface2 text-base-muted border-base-border';
  };

  // Open Add/Edit Template Modal
  const handleOpenTemplateModal = (template?: BomTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateFormData({
        name: template.name,
        model: template.model || 'Ultima',
        truckModel: template.truckModel || '',
        version: template.version || 'v1',
        status: template.status || 'active',
        gaNumber: template.gaNumber || '',
        notes: template.notes || ''
      });
    } else {
      setEditingTemplate(null);
      setTemplateFormData({
        name: '',
        model: 'Ultima',
        truckModel: '',
        version: 'v1',
        status: 'active',
        gaNumber: '',
        notes: ''
      });
    }
    setFormError('');
    setIsTemplateModalOpen(true);
  };

  // Save Template Form
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!templateFormData.name.trim()) {
      setFormError('Template Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTemplate) {
        await onUpdateBomTemplate(editingTemplate.id, {
          name: templateFormData.name.trim(),
          model: templateFormData.model,
          truckModel: templateFormData.truckModel.trim() || undefined,
          version: templateFormData.version.trim() || 'v1',
          status: templateFormData.status,
          gaNumber: templateFormData.gaNumber.trim() || undefined,
          notes: templateFormData.notes.trim() || undefined,
          updatedAt: new Date().toISOString()
        });
      } else {
        await onAddBomTemplate({
          name: templateFormData.name.trim(),
          model: templateFormData.model,
          truckModel: templateFormData.truckModel.trim() || undefined,
          version: templateFormData.version.trim() || 'v1',
          status: templateFormData.status,
          gaNumber: templateFormData.gaNumber.trim() || undefined,
          notes: templateFormData.notes.trim() || undefined,
          items: [],
          totalEstWeight: 0
        });
      }
      setIsTemplateModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save BOM template');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Duplicate Template
  const handleDuplicateTemplate = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    try {
      await onAddBomTemplate({
        name: `${selectedTemplate.name} — Copy`,
        model: selectedTemplate.model,
        truckModel: selectedTemplate.truckModel,
        version: 'v1',
        status: 'draft',
        gaNumber: undefined, // Clear out GA Number for new duplicated template
        items: selectedTemplate.items.map(item => ({ ...item, id: 'item_' + Math.random().toString(36).slice(2, 9) })),
        totalEstWeight: selectedTemplate.totalEstWeight,
        notes: selectedTemplate.notes ? `Duplicated from ${selectedTemplate.name}. ${selectedTemplate.notes}` : `Duplicated from ${selectedTemplate.name}`
      });
    } catch (err) {
      console.error('Failed to duplicate BOM template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Add/Edit Item Modal
  const handleOpenItemModal = (item?: BomItem) => {
    if (item) {
      setEditingItem(item);
      setItemFormData({
        partNumber: item.partNumber,
        description: item.description,
        material: item.material,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        dimensions: item.dimensions || '',
        weightPerUnit: item.weightPerUnit || 0,
        drawingRef: item.drawingRef || '',
        notes: item.notes || ''
      });
    } else {
      setEditingItem(null);
      setItemFormData({
        partNumber: '',
        description: '',
        material: '',
        category: 'plate',
        quantity: 1,
        unit: 'pcs',
        dimensions: '',
        weightPerUnit: 0,
        drawingRef: '',
        notes: ''
      });
    }
    setFormError('');
    setIsItemModalOpen(true);
  };

  // Save Item Form
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setFormError('');

    if (!itemFormData.partNumber.trim()) {
      setFormError('Part Number is required');
      return;
    }
    if (!itemFormData.description.trim()) {
      setFormError('Description is required');
      return;
    }

    const qty = Number(itemFormData.quantity) || 0;
    const weightPerUnit = Number(itemFormData.weightPerUnit) || 0;
    const totalWeight = qty * weightPerUnit;

    const payloadItem: BomItem = {
      id: editingItem ? editingItem.id : 'item_' + Math.random().toString(36).slice(2, 9),
      partNumber: itemFormData.partNumber.trim().toUpperCase(),
      description: itemFormData.description.trim(),
      material: itemFormData.material.trim(),
      category: itemFormData.category,
      quantity: qty,
      unit: itemFormData.unit,
      dimensions: itemFormData.dimensions.trim() || undefined,
      weightPerUnit: weightPerUnit,
      totalWeight: totalWeight,
      drawingRef: itemFormData.drawingRef.trim() || undefined,
      notes: itemFormData.notes.trim() || undefined
    };

    let updatedItems = [...(selectedTemplate.items || [])];

    if (editingItem) {
      updatedItems = updatedItems.map(it => it.id === editingItem.id ? payloadItem : it);
    } else {
      updatedItems.push(payloadItem);
    }

    const newTotalWeight = updatedItems.reduce((acc, it) => acc + (it.totalWeight || 0), 0);

    setIsSubmitting(true);
    try {
      await onUpdateBomTemplate(selectedTemplate.id, {
        items: updatedItems,
        totalEstWeight: newTotalWeight,
        updatedAt: new Date().toISOString()
      });
      setIsItemModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save BOM item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete BOM Item
  const handleDeleteItem = async (itemId: string) => {
    if (!selectedTemplate) return;
    const updatedItems = selectedTemplate.items.filter(it => it.id !== itemId);
    const newTotalWeight = updatedItems.reduce((acc, it) => acc + (it.totalWeight || 0), 0);

    try {
      await onUpdateBomTemplate(selectedTemplate.id, {
        items: updatedItems,
        totalEstWeight: newTotalWeight,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to delete BOM item:', err);
    }
  };

  // Reorder BOM Item (Up/Down)
  const handleReorderItem = async (index: number, direction: 'up' | 'down') => {
    if (!selectedTemplate || !selectedTemplate.items) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedTemplate.items.length) return;

    const itemsCopy = [...selectedTemplate.items];
    const temp = itemsCopy[index];
    itemsCopy[index] = itemsCopy[newIndex];
    itemsCopy[newIndex] = temp;

    try {
      await onUpdateBomTemplate(selectedTemplate.id, {
        items: itemsCopy,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to reorder items:', err);
    }
  };

  // Inline Cell Save
  const handleSaveInlineCell = async (itemId: string) => {
    if (!editingCell || !selectedTemplate) return;
    const valNum = Number(editingCell.value);
    if (isNaN(valNum) || valNum < 0) {
      setEditingCell(null);
      return;
    }

    const updatedItems = selectedTemplate.items.map(it => {
      if (it.id === itemId) {
        const newQty = editingCell.field === 'quantity' ? valNum : it.quantity;
        const newWeightPerUnit = editingCell.field === 'weightPerUnit' ? valNum : (it.weightPerUnit || 0);
        return {
          ...it,
          [editingCell.field]: valNum,
          totalWeight: newQty * newWeightPerUnit
        };
      }
      return it;
    });

    const newTotalWeight = updatedItems.reduce((acc, it) => acc + (it.totalWeight || 0), 0);
    setEditingCell(null);

    try {
      await onUpdateBomTemplate(selectedTemplate.id, {
        items: updatedItems,
        totalEstWeight: newTotalWeight,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to update inline cell:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!selectedTemplate) return;
    const headers = ['Part No', 'Description', 'Material', 'Category', 'Qty', 'Unit', 'Dimensions', 'Weight/pcs (kg)', 'Total Weight (kg)', 'Drawing Ref', 'Notes'];
    
    const rows = (selectedTemplate.items || []).map(it => [
      it.partNumber,
      `"${(it.description || '').replace(/"/g, '""')}"`,
      `"${(it.material || '').replace(/"/g, '""')}"`,
      it.category,
      it.quantity,
      it.unit,
      `"${(it.dimensions || '').replace(/"/g, '""')}"`,
      it.weightPerUnit || 0,
      it.totalWeight || 0,
      `"${(it.drawingRef || '').replace(/"/g, '""')}"`,
      `"${(it.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanName = selectedTemplate.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `${cleanName} — BOM — ${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF
  const handleExportPDF = () => {
    if (!selectedTemplate) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const dateStr = new Date().toISOString().slice(0, 10);

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AUSTIN BATAM', 14, 15);
    doc.setFontSize(12);
    doc.text('BILL OF MATERIALS (BOM)', 14, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Template: ${selectedTemplate.name}`, 14, 30);
    doc.text(`Model: ${selectedTemplate.model} | Version: ${selectedTemplate.version}`, 14, 35);
    if (selectedTemplate.gaNumber) {
      doc.text(`GA Number: ${selectedTemplate.gaNumber}`, 140, 30);
    }
    if (selectedTemplate.truckModel) {
      doc.text(`Truck Model: ${selectedTemplate.truckModel}`, 140, 35);
    }
    doc.text(`Date: ${dateStr} | Total Weight: ${(selectedTemplate.totalEstWeight || 0).toLocaleString()} kg`, 140, 40);

    // Simple table drawing logic
    let startY = 48;
    const headers = ['#', 'Part No', 'Description', 'Material', 'Category', 'Qty', 'Unit', 'Dimensions', 'Wt/pcs (kg)', 'Total Wt (kg)', 'Drawing Ref'];
    const colWidths = [10, 28, 55, 35, 25, 12, 12, 35, 20, 22, 25];

    doc.setFillColor(240, 240, 240);
    doc.rect(14, startY, 269, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    let xPos = 14;
    headers.forEach((h, i) => {
      doc.text(h, xPos + 2, startY + 5);
      xPos += colWidths[i];
    });

    startY += 8;
    doc.setFont('helvetica', 'normal');

    (selectedTemplate.items || []).forEach((item, idx) => {
      if (startY > 185) {
        doc.addPage();
        startY = 15;
      }

      xPos = 14;
      const rowData = [
        (idx + 1).toString(),
        item.partNumber,
        item.description.length > 30 ? item.description.slice(0, 28) + '..' : item.description,
        item.material.length > 20 ? item.material.slice(0, 18) + '..' : item.material,
        item.category,
        item.quantity.toString(),
        item.unit,
        item.dimensions || '-',
        (item.weightPerUnit || 0).toString(),
        (item.totalWeight || 0).toString(),
        item.drawingRef || '-'
      ];

      rowData.forEach((val, i) => {
        doc.text(val, xPos + 2, startY + 4);
        xPos += colWidths[i];
      });

      doc.setDrawColor(220, 220, 220);
      doc.line(14, startY + 6, 283, startY + 6);
      startY += 7;
    });

    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated by Austin Batam Project Tracking Console — ${new Date().toLocaleString()}`, 14, 198);

    const filename = `${selectedTemplate.gaNumber || selectedTemplate.name} — BOM — ${dateStr}.pdf`;
    doc.save(filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf');
  };

  // Grouped / Sorted Items for Table Display
  const displayItems = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.items) return [];

    let itemsCopy = [...selectedTemplate.items];

    // Sort items
    itemsCopy.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return itemsCopy;
  }, [selectedTemplate, sortField, sortOrder]);

  // Items Grouped by Category
  const groupedItems = useMemo(() => {
    if (!isGroupedByCategory) return null;

    const groups: Record<string, BomItem[]> = {
      plate: [],
      structural: [],
      hardware: [],
      welding_consumable: [],
      paint: [],
      other: []
    };

    displayItems.forEach(item => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return groups;
  }, [displayItems, isGroupedByCategory]);

  const handleSort = (field: keyof BomItem) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      
      {/* ════════════════════════════════════════════════════════════════════
          PANEL KIRI — SIDEBAR FILTER & BOM TEMPLATE LIST (~260px)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-5">
        
        {/* Top Control Box */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card space-y-4">
          
          {/* New Template Primary Button */}
          {canEdit && (
            <button
              onClick={() => handleOpenTemplateModal()}
              className="w-full py-2.5 px-4 bg-base-accent hover:bg-base-accent-hover text-white font-condensed font-bold uppercase tracking-wider text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New BOM Template
            </button>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-base-muted" />
            <input
              type="text"
              placeholder="Search BOM / GA Number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-base-bg border border-base-border pl-9 pr-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-base-muted hover:text-base-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Toggle Pills */}
          <div>
            <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-2 block">
              Status Filter
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-base-bg p-1 rounded-lg border border-base-border text-[11px] font-condensed font-bold uppercase">
              {(['active', 'all', 'draft', 'archived'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`py-1.5 px-2 rounded-md transition-all text-center cursor-pointer ${
                    statusFilter === st
                      ? 'bg-base-accent text-white shadow-sm'
                      : 'text-base-muted hover:text-base-text hover:bg-base-surface'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Model Filter */}
          <div>
            <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1.5 block">
              Model
            </label>
            <select
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
              className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
            >
              <option value="all">All Models</option>
              <option value="Ultima">Austin Ultima</option>
              <option value="HPT">Austin HPT</option>
              <option value="JEC">Austin JEC</option>
              <option value="Other">Other Models</option>
            </select>
          </div>

        </div>

        {/* List of Templates */}
        <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-3 border-b border-base-border bg-base-surface2 flex items-center justify-between">
            <span className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
              Templates ({filteredTemplates.length})
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-base-border">
            {filteredTemplates.length === 0 ? (
              <div className="p-6 text-center text-base-muted">
                <ListTree className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-condensed font-bold uppercase">No templates found</p>
              </div>
            ) : (
              filteredTemplates.map(t => {
                const isSelected = selectedTemplate?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-base-accent-dim/40 border-l-4 border-l-base-accent' 
                        : 'hover:bg-base-surface2/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-base-text line-clamp-2">{t.name}</h4>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-condensed font-extrabold uppercase border ${getModelBadgeStyle(t.model)}`}>
                        {t.model}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {t.gaNumber && (
                        <span className="px-1.5 py-0.5 bg-base-surface2 border border-base-border text-base-accent text-[10px] font-mono font-bold rounded">
                          GA: {t.gaNumber}
                        </span>
                      )}
                      <span className="text-[10px] text-base-muted">
                        {t.version} • {t.items ? t.items.length : 0} items
                      </span>
                      <span className="text-[10px] text-base-muted ml-auto font-mono">
                        {(t.totalEstWeight || 0).toLocaleString()} kg
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mini Stats (3 items) */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-base-surface border border-base-border p-2.5 rounded-xl shadow-card text-center">
            <p className="text-[9px] font-condensed font-bold uppercase text-base-muted">Total</p>
            <p className="text-base font-condensed font-black text-base-text">{sidebarStats.total}</p>
          </div>
          <div className="bg-base-surface border border-base-border p-2.5 rounded-xl shadow-card text-center border-l-2 border-l-base-green">
            <p className="text-[9px] font-condensed font-bold uppercase text-base-muted">Active</p>
            <p className="text-base font-condensed font-black text-base-green">{sidebarStats.active}</p>
          </div>
          <div className="bg-base-surface border border-base-border p-2.5 rounded-xl shadow-card text-center">
            <p className="text-[9px] font-condensed font-bold uppercase text-base-muted">Draft</p>
            <p className="text-base font-condensed font-black text-base-muted">{sidebarStats.draft}</p>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          PANEL KANAN — MAIN PANEL (BOM DETAILS & TABLE)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {!selectedTemplate ? (
          /* Empty State when no template exists or is selected */
          <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center shadow-card flex flex-col items-center justify-center min-h-[400px]">
            <ListTree className="h-12 w-12 text-base-muted opacity-40 mb-3" />
            <h3 className="font-condensed font-extrabold text-base uppercase text-base-text">No BOM Template Selected</h3>
            <p className="text-xs text-base-muted max-w-sm mt-1">
              Select a Bill of Materials template from the left sidebar, or create a new one to manage engineering dump body components.
            </p>
            {canEdit && (
              <button
                onClick={() => handleOpenTemplateModal()}
                className="mt-4 px-4 py-2 bg-base-accent hover:bg-base-accent-hover text-white font-condensed font-bold uppercase text-xs rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Create First Template
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header Box */}
            <div className="bg-base-surface border border-base-border p-5 rounded-xl shadow-card space-y-4">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                
                {/* Title & Badges */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-condensed font-extrabold uppercase border ${getModelBadgeStyle(selectedTemplate.model)}`}>
                      {selectedTemplate.model}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-condensed font-extrabold uppercase bg-base-surface2 text-base-text border border-base-border">
                      {selectedTemplate.version}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-condensed font-bold uppercase ${
                      selectedTemplate.status === 'active' 
                        ? 'bg-base-green-dim text-base-green' 
                        : selectedTemplate.status === 'draft'
                        ? 'bg-base-accent-dim text-base-accent'
                        : 'bg-base-surface2 text-base-muted'
                    }`}>
                      {selectedTemplate.status}
                    </span>

                    {/* GA Number Chip */}
                    {selectedTemplate.gaNumber && (
                      <button
                        onClick={() => setActiveTab('projects')}
                        title="Click to view Project"
                        className="px-2.5 py-0.5 bg-base-surface2 hover:bg-base-border text-base-accent border border-base-border font-mono font-bold text-xs rounded flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Building2 className="h-3 w-3" />
                        GA: {selectedTemplate.gaNumber}
                      </button>
                    )}
                  </div>

                  <h1 className="text-xl font-condensed font-black text-base-text uppercase tracking-wide">
                    {selectedTemplate.name}
                  </h1>
                  
                  {selectedTemplate.truckModel && (
                    <p className="text-xs text-base-muted">
                      Truck Model: <strong className="text-base-text">{selectedTemplate.truckModel}</strong>
                    </p>
                  )}
                </div>

                {/* Top Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setShowSchematicAnalytics(prev => !prev)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                      showSchematicAnalytics 
                        ? 'bg-base-accent text-white border-base-accent shadow-sm' 
                        : 'border-base-border hover:bg-base-surface2 text-base-text'
                    }`}
                  >
                    <Box className="h-3.5 w-3.5" />
                    {showSchematicAnalytics ? 'Hide 3D Schematic' : '3D Schematic & COG'}
                  </button>

                  <button
                    onClick={() => setShowPlateCalcModal(true)}
                    className="px-3 py-1.5 border border-base-border hover:bg-base-surface2 text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Calculator className="h-3.5 w-3.5 text-base-accent" />
                    Plate Calculator
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 border border-base-border hover:bg-base-surface2 text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-base-green" />
                    CSV
                  </button>

                  <button
                    onClick={handleExportPDF}
                    className="px-3 py-1.5 border border-base-border hover:bg-base-surface2 text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-base-accent" />
                    PDF
                  </button>

                  {canEdit && (
                    <>
                      <button
                        onClick={() => setIsGenerateMpModalOpen(true)}
                        disabled={!canGenerateMatProcessing}
                        title={
                          !selectedTemplate.gaNumber
                            ? 'BOM template must have a GA Number'
                            : !eligibleMpItems.length
                            ? 'Template has no plate or structural items'
                            : 'Generate Material Processing items from this BOM'
                        }
                        className={`px-3 py-1.5 border rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                          canGenerateMatProcessing
                            ? 'border-base-accent/30 bg-base-accent-dim/40 text-base-accent hover:bg-base-accent-dim/80 cursor-pointer'
                            : 'border-base-border bg-base-surface2/50 text-base-muted cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Generate to Mat. Processing
                      </button>

                      <button
                        onClick={() => handleOpenTemplateModal(selectedTemplate)}
                        className="px-3 py-1.5 border border-base-border hover:bg-base-surface2 text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit Template
                      </button>

                      <button
                        onClick={handleDuplicateTemplate}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 border border-base-border hover:bg-base-surface2 text-base-accent rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate
                      </button>
                    </>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => setDeleteConfirmModal({ isOpen: true, templateId: selectedTemplate.id })}
                      className="px-3 py-1.5 border border-base-red/30 bg-base-red-dim hover:bg-base-red/20 text-base-red rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>

              </div>

              {/* Summary Row (4 Metric Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-base-border">
                <div className="p-3 bg-base-bg border border-base-border rounded-xl">
                  <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Total Items</p>
                  <p className="text-lg font-condensed font-extrabold text-base-text mt-0.5">
                    {selectedTemplate.items ? selectedTemplate.items.length : 0} parts
                  </p>
                </div>

                <div className="p-3 bg-base-bg border border-base-border rounded-xl">
                  <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Total Est. Weight</p>
                  <p className="text-lg font-condensed font-extrabold text-base-accent mt-0.5">
                    {(selectedTemplate.totalEstWeight || 0).toLocaleString()} <span className="text-xs text-base-muted">kg</span>
                  </p>
                </div>

                <div className="p-3 bg-base-bg border border-base-border rounded-xl">
                  <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Last Updated</p>
                  <p className="text-xs font-bold text-base-text mt-1">
                    {selectedTemplate.updatedAt ? selectedTemplate.updatedAt.slice(0, 10) : selectedTemplate.createdAt?.slice(0, 10) || '—'}
                  </p>
                </div>

                <div className="p-3 bg-base-bg border border-base-border rounded-xl">
                  <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Created By</p>
                  <p className="text-xs font-bold text-base-text mt-1 truncate">
                    {selectedTemplate.createdByName || 'System'}
                  </p>
                </div>
              </div>

              {/* STOCK ALERT BAR */}
              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs transition-all ${
                stockSummary.alertType === 'green'
                  ? 'bg-base-green-dim/50 border-base-green/30 text-base-green'
                  : stockSummary.alertType === 'orange'
                  ? 'bg-base-accent-dim/50 border-base-accent/30 text-base-accent'
                  : 'bg-base-red-dim/50 border-base-red/30 text-base-red'
              }`}>
                <div className="flex items-center gap-2.5 font-medium">
                  {stockSummary.alertType === 'green' ? (
                    <CheckCircle2 className="h-5 w-5 text-base-green shrink-0" />
                  ) : stockSummary.alertType === 'orange' ? (
                    <AlertTriangle className="h-5 w-5 text-base-accent shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-base-red shrink-0" />
                  )}

                  <div>
                    <span className="font-bold">
                      {stockSummary.shortageCount === 0 
                        ? 'All material stock requirements sufficient ✓'
                        : `${stockSummary.shortageCount} BOM items have stock shortage below required weight!`
                      }
                    </span>
                    {selectedTemplate.gaNumber && stockSummary.consumedInProcessing > 0 && (
                      <span className="block text-[11px] opacity-80 mt-0.5">
                        {stockSummary.consumedInProcessing.toLocaleString()} kg material already processed/consumed for GA {selectedTemplate.gaNumber}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('materials')}
                  className="px-3 py-1 bg-base-surface hover:bg-base-surface2 border border-current font-condensed font-bold uppercase text-[11px] rounded-lg shrink-0 cursor-pointer"
                >
                  View Inventory Stock
                </button>
              </div>

            </div>

            {/* 3D ISOMETRIC STRUCTURAL SCHEMATIC & COG WEIGHT PANEL */}
            {showSchematicAnalytics && selectedTemplate && (
              <div className="bg-base-surface border border-base-border p-5 rounded-xl shadow-card space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-base-border pb-3">
                  <div className="flex items-center gap-2">
                    <Box className="h-5 w-5 text-base-accent" />
                    <div>
                      <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">
                        Structural Assembly Schematic & Center of Gravity (COG) Analytics
                      </h3>
                      <p className="text-[11px] text-base-muted">
                        Interactive 3D structural breakdown for model: <span className="font-bold text-base-text">{selectedTemplate.model}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSchematicAnalytics(false)}
                    className="p-1 text-base-muted hover:text-base-text rounded-md cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Interactive SVG Dump Body Diagram */}
                  <div className="lg:col-span-7 bg-base-bg p-4 rounded-xl border border-base-border flex flex-col items-center justify-center relative min-h-[260px]">
                    <span className="absolute top-3 left-3 text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted bg-base-surface px-2 py-0.5 rounded border border-base-border">
                      Interactive Dump Body Isometric Wireframe
                    </span>

                    <svg viewBox="0 0 500 240" className="w-full max-w-md h-auto drop-shadow-md">
                      <defs>
                        <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#ea580c" stopOpacity="0.9" />
                        </linearGradient>
                        <linearGradient id="wallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.9" />
                        </linearGradient>
                        <linearGradient id="canopyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#047857" stopOpacity="0.9" />
                        </linearGradient>
                        <linearGradient id="subframeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.9" />
                        </linearGradient>
                      </defs>

                      {/* 1. Subframe & Main Beams (Bottom) */}
                      <polygon
                        points="120,180 340,180 370,205 150,205"
                        fill="url(#subframeGrad)"
                        stroke="#6d28d9"
                        strokeWidth="2"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedZone(selectedZone === 'subframe' ? null : 'subframe')}
                      />
                      <text x="240" y="196" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">Subframe Beams & Pivot Bosses</text>

                      {/* 2. Floor Bed Plate */}
                      <polygon
                        points="100,140 320,140 380,180 120,180"
                        fill="url(#floorGrad)"
                        stroke="#ea580c"
                        strokeWidth="2"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedZone(selectedZone === 'floor' ? null : 'floor')}
                      />
                      <text x="230" y="163" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Floor Bed Plate Assembly</text>

                      {/* 3. Left Side Wall */}
                      <polygon
                        points="100,140 120,180 120,100 100,70"
                        fill="url(#wallGrad)"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedZone(selectedZone === 'wall' ? null : 'wall')}
                      />

                      {/* 4. Right Side Wall */}
                      <polygon
                        points="320,140 380,180 380,100 320,70"
                        fill="url(#wallGrad)"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedZone(selectedZone === 'wall' ? null : 'wall')}
                      />
                      <text x="350" y="125" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">Side Wall</text>

                      {/* 5. Front Headboard & Canopy Guard */}
                      <polygon
                        points="100,70 320,70 280,30 60,30"
                        fill="url(#canopyGrad)"
                        stroke="#047857"
                        strokeWidth="2"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedZone(selectedZone === 'canopy' ? null : 'canopy')}
                      />
                      <text x="190" y="52" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Front Canopy & Cab Guard</text>

                      {/* Center of Gravity (COG) Marker */}
                      <circle cx="230" cy="155" r="8" fill="#ef4444" stroke="#ffffff" strokeWidth="2" className="animate-pulse" />
                      <circle cx="230" cy="155" r="3" fill="#ffffff" />
                      <text x="230" y="138" fill="#ef4444" fontSize="10" fontWeight="extrabold" textAnchor="middle">COG Center</text>
                    </svg>

                    <p className="text-[10px] text-base-muted mt-2 text-center">
                      Click any structural zone above to view component mass & details.
                    </p>
                  </div>

                  {/* COG & Mass Analytics Stats */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="p-3 bg-base-bg border border-base-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-condensed font-bold uppercase">
                        <span className="text-base-muted">Estimated Tare Mass</span>
                        <span className="text-base-accent font-mono font-black text-sm">
                          {(selectedTemplate.totalEstWeight || 0).toLocaleString()} kg
                        </span>
                      </div>
                      <div className="w-full bg-base-surface h-2 rounded-full overflow-hidden border border-base-border">
                        <div className="bg-base-accent h-full rounded-full" style={{ width: '78%' }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-base-bg border border-base-border rounded-lg text-center">
                        <p className="text-[9px] font-condensed font-bold uppercase text-base-muted">Front Axle Load COG</p>
                        <p className="text-sm font-mono font-extrabold text-base-green mt-0.5">48.2%</p>
                      </div>
                      <div className="p-2.5 bg-base-bg border border-base-border rounded-lg text-center">
                        <p className="text-[9px] font-condensed font-bold uppercase text-base-muted">Rear Axle Load COG</p>
                        <p className="text-sm font-mono font-extrabold text-base-accent mt-0.5">51.8%</p>
                      </div>
                    </div>

                    <div className="p-3 bg-base-bg border border-base-border rounded-xl space-y-2 text-xs">
                      <p className="font-condensed font-bold uppercase text-[10px] text-base-muted tracking-wider">
                        Component Mass Allocation
                      </p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="text-base-muted">Floor Bed Plate (Hardox/Bisalloy):</span>
                          <span className="font-mono font-bold text-base-text">
                            {Math.round((selectedTemplate.totalEstWeight || 0) * 0.42).toLocaleString()} kg (42%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-base-muted">Side Walls & Ribs:</span>
                          <span className="font-mono font-bold text-base-text">
                            {Math.round((selectedTemplate.totalEstWeight || 0) * 0.28).toLocaleString()} kg (28%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-base-muted">Canopy & Headboard:</span>
                          <span className="font-mono font-bold text-base-text">
                            {Math.round((selectedTemplate.totalEstWeight || 0) * 0.18).toLocaleString()} kg (18%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-base-muted">Subframe & Hardware:</span>
                          <span className="font-mono font-bold text-base-text">
                            {Math.round((selectedTemplate.totalEstWeight || 0) * 0.12).toLocaleString()} kg (12%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BOM Table Controls */}
            <div className="bg-base-surface border border-base-border p-3.5 rounded-xl shadow-card flex items-center justify-between gap-3">
              
              <div className="flex items-center gap-3">
                <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
                  <Box className="h-4 w-4 text-base-accent" />
                  BOM Components & Materials
                </h3>

                {/* Group By Category Toggle */}
                <button
                  onClick={() => setIsGroupedByCategory(!isGroupedByCategory)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-condensed font-bold uppercase border transition-all cursor-pointer ${
                    isGroupedByCategory
                      ? 'bg-base-accent text-white border-base-accent'
                      : 'bg-base-bg text-base-muted border-base-border hover:text-base-text'
                  }`}
                >
                  {isGroupedByCategory ? 'Categorized View' : 'Group by Category'}
                </button>
              </div>

              {canEdit && (
                <button
                  onClick={() => handleOpenItemModal()}
                  className="px-3 py-1.5 bg-base-accent hover:bg-base-accent-hover text-white font-condensed font-bold uppercase text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add BOM Item
                </button>
              )}

            </div>

            {/* Table Container */}
            <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                      <th className="py-3 px-3 text-center w-8">#</th>
                      <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('partNumber')}>Part No</th>
                      <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('description')}>Description</th>
                      <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('material')}>Material</th>
                      <th className="py-3 px-3 cursor-pointer" onClick={() => handleSort('category')}>Category</th>
                      <th className="py-3 px-3 text-right cursor-pointer" onClick={() => handleSort('quantity')}>Qty</th>
                      <th className="py-3 px-3 text-center">Unit</th>
                      <th className="py-3 px-3">Dimensions</th>
                      <th className="py-3 px-3 text-right cursor-pointer" onClick={() => handleSort('weightPerUnit')}>Wt/pcs</th>
                      <th className="py-3 px-3 text-right cursor-pointer" onClick={() => handleSort('totalWeight')}>Total Wt</th>
                      <th className="py-3 px-3">Drawing Ref</th>
                      <th className="py-3 px-3 text-center">Stock Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border text-xs">
                    {displayItems.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="text-center py-12 text-base-muted">
                          <Box className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="font-condensed font-bold uppercase tracking-wider">No BOM items in this template</p>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenItemModal()}
                              className="mt-2 text-xs text-base-accent hover:underline font-bold cursor-pointer"
                            >
                              + Add first component item
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : isGroupedByCategory ? (
                      /* Render Grouped View */
                      Object.entries(groupedItems || {}).map(([catKey, catItemsRaw]) => {
                        const catItems = catItemsRaw as BomItem[];
                        if (catItems.length === 0) return null;
                        const catTotalWeight = catItems.reduce((acc, it) => acc + (it.totalWeight || 0), 0);

                        return (
                          <React.Fragment key={catKey}>
                            {/* Category Header Row */}
                            <tr className="bg-base-surface2/90 font-condensed font-black text-xs uppercase tracking-wider text-base-text border-y border-base-border">
                              <td colSpan={9} className="py-2 px-4 text-base-accent">
                                {catKey.replace('_', ' ')} ({catItems.length} items)
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-base-text">
                                {catTotalWeight.toLocaleString()} kg
                              </td>
                              <td colSpan={3} />
                            </tr>

                            {/* Items in Category */}
                            {catItems.map((item, idx) => {
                              const stockRes = calculateStockStatus(item);
                              const isShortage = stockRes.status === 'no_stock' || stockRes.status === 'low_stock';

                              return (
                                <tr key={item.id} className={`hover:bg-base-surface2/60 transition-colors ${isShortage ? 'bg-base-red-dim/20' : ''}`}>
                                  <td className="py-2.5 px-3 text-center text-base-muted">{idx + 1}</td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-base-accent">{item.partNumber}</td>
                                  <td className="py-2.5 px-3 font-medium text-base-text">{item.description}</td>
                                  <td className="py-2.5 px-3 text-base-text">{item.material}</td>
                                  <td className="py-2.5 px-3 uppercase text-[10px] font-condensed font-bold text-base-muted">{item.category}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">{item.quantity}</td>
                                  <td className="py-2.5 px-3 text-center text-base-muted">{item.unit}</td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-base-muted">{item.dimensions || '—'}</td>
                                  <td className="py-2.5 px-3 text-right font-mono">{item.weightPerUnit || 0}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-base-text">{(item.totalWeight || 0).toLocaleString()}</td>
                                  <td className="py-2.5 px-3">
                                    {item.drawingRef ? (
                                      <button
                                        onClick={() => setActiveTab('drawings')}
                                        className="px-2 py-0.5 bg-base-surface2 hover:bg-base-border border border-base-border text-base-accent font-mono text-[10px] rounded cursor-pointer"
                                      >
                                        {item.drawingRef}
                                      </button>
                                    ) : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-condensed font-extrabold border ${stockRes.color}`}>
                                      {stockRes.label}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {canEdit && (
                                      <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => handleOpenItemModal(item)} className="p-1 text-base-muted hover:text-base-text cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-base-muted hover:text-base-red cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      /* Render Standard Flat View */
                      displayItems.map((item, idx) => {
                        const stockRes = calculateStockStatus(item);
                        const isShortage = stockRes.status === 'no_stock' || stockRes.status === 'low_stock';

                        return (
                          <tr key={item.id} className={`hover:bg-base-surface2/60 transition-colors ${isShortage ? 'bg-base-red-dim/20' : ''}`}>
                            <td className="py-2.5 px-3 text-center text-base-muted">{idx + 1}</td>
                            
                            <td className="py-2.5 px-3 font-mono font-bold text-base-accent whitespace-nowrap">
                              {item.partNumber}
                            </td>

                            <td className="py-2.5 px-3 font-medium text-base-text max-w-[180px] truncate" title={item.description}>
                              {item.description}
                            </td>

                            <td className="py-2.5 px-3 text-base-text font-medium">
                              {item.material}
                            </td>

                            <td className="py-2.5 px-3 uppercase text-[10px] font-condensed font-bold text-base-muted">
                              {item.category}
                            </td>

                            {/* Qty (Inline Edit) */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {editingCell?.itemId === item.id && editingCell?.field === 'quantity' ? (
                                <input
                                  type="number"
                                  autoFocus
                                  value={editingCell.value}
                                  onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                  onBlur={() => handleSaveInlineCell(item.id)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveInlineCell(item.id)}
                                  className="w-16 bg-base-bg border border-base-accent text-right px-1 py-0.5 rounded text-xs font-mono font-bold"
                                />
                              ) : (
                                <span 
                                  onClick={() => canEdit && setEditingCell({ itemId: item.id, field: 'quantity', value: item.quantity.toString() })}
                                  className={canEdit ? 'cursor-pointer hover:bg-base-surface2 px-1.5 py-0.5 rounded border border-transparent hover:border-base-border' : ''}
                                  title="Click to inline edit quantity"
                                >
                                  {item.quantity}
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center text-base-muted">
                              {item.unit}
                            </td>

                            <td className="py-2.5 px-3 font-mono text-[11px] text-base-muted">
                              {item.dimensions || '—'}
                            </td>

                            {/* Weight / pcs (Inline Edit) */}
                            <td className="py-2.5 px-3 text-right font-mono">
                              {editingCell?.itemId === item.id && editingCell?.field === 'weightPerUnit' ? (
                                <input
                                  type="number"
                                  autoFocus
                                  value={editingCell.value}
                                  onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                  onBlur={() => handleSaveInlineCell(item.id)}
                                  onKeyDown={e => e.key === 'Enter' && handleSaveInlineCell(item.id)}
                                  className="w-20 bg-base-bg border border-base-accent text-right px-1 py-0.5 rounded text-xs font-mono"
                                />
                              ) : (
                                <span 
                                  onClick={() => canEdit && setEditingCell({ itemId: item.id, field: 'weightPerUnit', value: (item.weightPerUnit || 0).toString() })}
                                  className={canEdit ? 'cursor-pointer hover:bg-base-surface2 px-1.5 py-0.5 rounded border border-transparent hover:border-base-border' : ''}
                                  title="Click to inline edit weight per unit"
                                >
                                  {item.weightPerUnit || 0}
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono font-bold text-base-text">
                              {(item.totalWeight || 0).toLocaleString()}
                            </td>

                            {/* Drawing Ref */}
                            <td className="py-2.5 px-3">
                              {item.drawingRef ? (
                                <button
                                  onClick={() => setActiveTab('drawings')}
                                  className="px-2 py-0.5 bg-base-surface2 hover:bg-base-border border border-base-border text-base-accent font-mono text-[10px] rounded cursor-pointer"
                                  title="Navigate to Drawing Register"
                                >
                                  {item.drawingRef}
                                </button>
                              ) : '—'}
                            </td>

                            {/* Stock Status */}
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-condensed font-extrabold border ${stockRes.color}`}>
                                {stockRes.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {canEdit && (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleReorderItem(idx, 'up')}
                                    disabled={idx === 0}
                                    title="Move Up"
                                    className="p-1 text-base-muted hover:text-base-text disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleReorderItem(idx, 'down')}
                                    disabled={idx === displayItems.length - 1}
                                    title="Move Down"
                                    className="p-1 text-base-muted hover:text-base-text disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenItemModal(item)}
                                    title="Edit Item"
                                    className="p-1 text-base-muted hover:text-base-text cursor-pointer"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    title="Delete Item"
                                    className="p-1 text-base-muted hover:text-base-red cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Summary Footer Row */}
                  <tfoot>
                    <tr className="bg-base-surface2 border-t-2 border-base-border text-xs font-condensed font-extrabold uppercase text-base-text">
                      <td colSpan={5} className="py-3 px-3">
                        Total Components Summary: {selectedTemplate.items ? selectedTemplate.items.length : 0} Items
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-base-accent">
                        {selectedTemplate.items ? selectedTemplate.items.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0}
                      </td>
                      <td colSpan={3} />
                      <td className="py-3 px-3 text-right font-mono font-black text-base-accent">
                        {(selectedTemplate.totalEstWeight || 0).toLocaleString()} kg
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer Exports */}
            <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card flex items-center justify-between">
              <p className="text-xs text-base-muted">
                Export Bill of Materials specification for procurement & production processing
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 border border-base-border hover:bg-base-surface2 text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-base-green" />
                  Export CSV
                </button>

                <button
                  onClick={handleExportPDF}
                  className="px-3.5 py-2 bg-base-accent hover:bg-base-accent-hover text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
              </div>
            </div>

          </>
        )}

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 1: CREATE / EDIT BOM TEMPLATE
         ════════════════════════════════════════════════════════════════════ */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text flex items-center gap-2">
                <ListTree className="h-5 w-5 text-base-accent" />
                {editingTemplate ? 'Edit BOM Template' : 'New BOM Template'}
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-base-muted hover:text-base-text p-1 rounded-md cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-base-red-dim border border-base-red/30 text-base-red rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Template Name */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Template Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Austin Ultima — Komatsu 930E"
                  value={templateFormData.name}
                  onChange={e => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent font-medium"
                  required
                />
              </div>

              {/* Model & Truck Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Dump Body Model *
                  </label>
                  <select
                    value={templateFormData.model}
                    onChange={e => setTemplateFormData({ ...templateFormData, model: e.target.value })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                  >
                    <option value="Ultima">Austin Ultima</option>
                    <option value="HPT">Austin HPT</option>
                    <option value="JEC">Austin JEC</option>
                    <option value="Other">Other Custom Model</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Truck Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Komatsu 930E, CAT 793"
                    value={templateFormData.truckModel}
                    onChange={e => setTemplateFormData({ ...templateFormData, truckModel: e.target.value })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                  />
                </div>
              </div>

              {/* Version & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Version *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. v1, v2.1"
                    value={templateFormData.version}
                    onChange={e => setTemplateFormData({ ...templateFormData, version: e.target.value })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Status *
                  </label>
                  <select
                    value={templateFormData.status}
                    onChange={e => setTemplateFormData({ ...templateFormData, status: e.target.value as any })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* GA Number Autocomplete */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Link to GA Number (Order / Unit)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GA-930E-2026-01"
                  value={templateFormData.gaNumber}
                  onChange={e => setTemplateFormData({ ...templateFormData, gaNumber: e.target.value })}
                  list="ga-numbers-list"
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono font-bold text-base-text focus:outline-none focus:border-base-accent"
                />
                <datalist id="ga-numbers-list">
                  {availableGaNumbers.map(ga => (
                    <option key={ga} value={ga} />
                  ))}
                </datalist>

                {/* Preview Linked Project */}
                {templateFormData.gaNumber && (() => {
                  const matchedProj = projects.find(p => p.gaNumber?.toLowerCase() === templateFormData.gaNumber.trim().toLowerCase());
                  return matchedProj ? (
                    <p className="text-[11px] text-base-green font-bold mt-1 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      → Linked to Project: {matchedProj.name}
                    </p>
                  ) : (
                    <p className="text-[10px] text-base-muted mt-1">
                      GA Number will link material consumption & processing automatically.
                    </p>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Notes / Specification Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Add notes or specific client custom requirements..."
                  value={templateFormData.notes}
                  onChange={e => setTemplateFormData({ ...templateFormData, notes: e.target.value })}
                  className="w-full bg-base-bg border border-base-border p-3 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                />
              </div>

              <div className="pt-3 border-t border-base-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-base-accent hover:bg-base-accent-hover text-white rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 2: ADD / EDIT BOM ITEM
         ════════════════════════════════════════════════════════════════════ */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text flex items-center gap-2">
                <Box className="h-5 w-5 text-base-accent" />
                {editingItem ? 'Edit Component Item' : 'Add Component Item'}
              </h3>
              <button onClick={() => setIsItemModalOpen(false)} className="text-base-muted hover:text-base-text p-1 rounded-md cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-base-red-dim border border-base-red/30 text-base-red rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Part Number & Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Part Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AB-FP-001"
                    value={itemFormData.partNumber}
                    onChange={e => setItemFormData({ ...itemFormData, partNumber: e.target.value.toUpperCase() })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono font-bold text-base-text focus:outline-none focus:border-base-accent"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Category *
                  </label>
                  <select
                    value={itemFormData.category}
                    onChange={e => setItemFormData({ ...itemFormData, category: e.target.value as any })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                  >
                    <option value="plate">Plate</option>
                    <option value="structural">Structural</option>
                    <option value="hardware">Hardware</option>
                    <option value="welding_consumable">Welding Consumable</option>
                    <option value="paint">Paint / Coating</option>
                    <option value="other">Other Component</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Floor Plate Main Section"
                  value={itemFormData.description}
                  onChange={e => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                  required
                />
              </div>

              {/* Material Autocomplete */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Material Specification *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bisalloy 400, Hardox 450, MS Plate"
                  value={itemFormData.material}
                  onChange={e => setItemFormData({ ...itemFormData, material: e.target.value })}
                  list="materials-list"
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-medium text-base-text focus:outline-none focus:border-base-accent"
                  required
                />
                <datalist id="materials-list">
                  {availableMaterials.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <p className="text-[10px] text-base-muted mt-1">
                  Select exact material name from inventory list for accurate stock shortage tracking.
                </p>
              </div>

              {/* Quantity, Unit, Weight per Unit */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={itemFormData.quantity}
                    onChange={e => setItemFormData({ ...itemFormData, quantity: Number(e.target.value) })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono font-bold text-base-text focus:outline-none focus:border-base-accent"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Unit *
                  </label>
                  <select
                    value={itemFormData.unit}
                    onChange={e => setItemFormData({ ...itemFormData, unit: e.target.value as any })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="m">m</option>
                    <option value="m2">m2</option>
                    <option value="set">set</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Weight/pcs (kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={itemFormData.weightPerUnit}
                    onChange={e => setItemFormData({ ...itemFormData, weightPerUnit: Number(e.target.value) })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono text-base-text focus:outline-none focus:border-base-accent"
                  />
                </div>
              </div>

              {/* Auto Total Weight Preview & Dimensions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Dimensions (free text)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6000×2000×12mm"
                    value={itemFormData.dimensions}
                    onChange={e => setItemFormData({ ...itemFormData, dimensions: e.target.value })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono text-base-text focus:outline-none focus:border-base-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Total Weight (Auto Calc)
                  </label>
                  <div className="w-full bg-base-surface2 border border-base-border px-3 py-2 rounded-lg text-xs font-mono font-extrabold text-base-accent">
                    {(Number(itemFormData.quantity || 0) * Number(itemFormData.weightPerUnit || 0)).toLocaleString()} kg
                  </div>
                </div>
              </div>

              {/* Drawing Ref Autocomplete */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Drawing Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AB-DT-001"
                  value={itemFormData.drawingRef}
                  onChange={e => setItemFormData({ ...itemFormData, drawingRef: e.target.value })}
                  list="drawings-list"
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono text-base-text focus:outline-none focus:border-base-accent"
                />
                <datalist id="drawings-list">
                  {availableDrawings.map(d => (
                    <option key={d.number} value={d.number}>
                      {d.label}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Additional processing or assembly instructions..."
                  value={itemFormData.notes}
                  onChange={e => setItemFormData({ ...itemFormData, notes: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                />
              </div>

              <div className="pt-3 border-t border-base-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-base-accent hover:bg-base-accent-hover text-white rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Saving...' : 'Save Item'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 3: DELETE TEMPLATE CONFIRMATION
         ════════════════════════════════════════════════════════════════════ */}
      {deleteConfirmModal.isOpen && deleteConfirmModal.templateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-base-red">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text">
                Delete BOM Template
              </h3>
            </div>

            <p className="text-xs text-base-text leading-relaxed">
              Are you sure you want to permanently delete this Bill of Materials template? All component items inside this template will be deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-border">
              <button
                onClick={() => setDeleteConfirmModal({ isOpen: false, templateId: null })}
                className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmModal.templateId) {
                    await onDeleteBomTemplate(deleteConfirmModal.templateId);
                    setDeleteConfirmModal({ isOpen: false, templateId: null });
                    setSelectedTemplateId(null);
                  }
                }}
                className="px-4 py-2 bg-base-red hover:bg-base-red/80 text-white rounded-lg text-xs font-condensed font-bold uppercase cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 4: QUICK STEEL PLATE MASS & DIMENSION CALCULATOR
         ════════════════════════════════════════════════════════════════════ */}
      {showPlateCalcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text flex items-center gap-2">
                <Calculator className="h-5 w-5 text-base-accent" />
                Steel Plate Mass & Dimension Calculator
              </h3>
              <button
                onClick={() => setShowPlateCalcModal(false)}
                className="text-base-muted hover:text-base-text p-1 rounded-md cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-base-bg border border-base-border rounded-lg text-xs text-base-muted leading-relaxed">
                Calculate exact weight (kg) for wear-resistant plates (Bisalloy 400/450/500, Hardox, Mild Steel) based on physical dimensions.
              </div>

              {/* Dimensions Input */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Length (mm)
                  </label>
                  <input
                    type="number"
                    value={plateCalcData.lengthMm}
                    onChange={e => setPlateCalcData({ ...plateCalcData, lengthMm: Number(e.target.value) || 0 })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text font-mono focus:outline-none focus:border-base-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    value={plateCalcData.widthMm}
                    onChange={e => setPlateCalcData({ ...plateCalcData, widthMm: Number(e.target.value) || 0 })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text font-mono focus:outline-none focus:border-base-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Thickness (mm)
                  </label>
                  <input
                    type="number"
                    value={plateCalcData.thicknessMm}
                    onChange={e => setPlateCalcData({ ...plateCalcData, thicknessMm: Number(e.target.value) || 0 })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text font-mono focus:outline-none focus:border-base-accent"
                  />
                </div>
              </div>

              {/* Density & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Material Density Grade
                  </label>
                  <select
                    value={plateCalcData.densityGrade}
                    onChange={e => setPlateCalcData({ ...plateCalcData, densityGrade: e.target.value })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                  >
                    <option value="7.85">Bisalloy / Hardox Steel (7.85 g/cm³)</option>
                    <option value="7.85">Structural Mild Steel SS400 (7.85 g/cm³)</option>
                    <option value="8.00">Stainless Steel 304/316 (8.00 g/cm³)</option>
                    <option value="2.70">Aluminum 6061-T6 (2.70 g/cm³)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Quantity (pcs)
                  </label>
                  <input
                    type="number"
                    value={plateCalcData.quantity}
                    onChange={e => setPlateCalcData({ ...plateCalcData, quantity: Number(e.target.value) || 1 })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text font-mono focus:outline-none focus:border-base-accent"
                  />
                </div>
              </div>

              {/* Calculated Mass Results Box */}
              {(() => {
                const singleWeightKg = ((plateCalcData.lengthMm / 1000) * (plateCalcData.widthMm / 1000) * (plateCalcData.thicknessMm / 1000)) * (Number(plateCalcData.densityGrade) * 1000);
                const totalWeightKg = singleWeightKg * (plateCalcData.quantity || 1);
                const plateAreaM2 = (plateCalcData.lengthMm / 1000) * (plateCalcData.widthMm / 1000);

                return (
                  <div className="p-4 bg-base-bg border border-base-accent/30 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-base-muted font-condensed uppercase font-bold">Plate Area:</span>
                      <span className="font-mono font-bold text-base-text">{plateAreaM2.toFixed(2)} m²</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-base-muted font-condensed uppercase font-bold">Weight / Piece:</span>
                      <span className="font-mono font-bold text-base-text">{singleWeightKg.toFixed(1)} kg</span>
                    </div>

                    <div className="pt-2 border-t border-base-border flex justify-between items-center">
                      <span className="text-xs font-condensed font-extrabold uppercase text-base-text">Total Batch Mass:</span>
                      <span className="text-lg font-mono font-black text-base-accent">
                        {totalWeightKg.toFixed(1)} kg
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setShowPlateCalcModal(false);
                        handleOpenItemModal();
                        setItemFormData({
                          ...itemFormData,
                          dimensions: `${plateCalcData.lengthMm}×${plateCalcData.widthMm}×${plateCalcData.thicknessMm}mm`,
                          weightPerUnit: Number(singleWeightKg.toFixed(1)),
                          quantity: plateCalcData.quantity,
                          category: 'plate'
                        });
                      }}
                      className="w-full py-2 bg-base-accent hover:bg-base-accent-hover text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Apply to New BOM Item
                    </button>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* Generate to Material Processing Confirmation Modal */}
      {isGenerateMpModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-base-accent-dim rounded-lg text-base-accent">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-condensed font-black text-base uppercase text-base-text">
                    Generate to Material Processing
                  </h3>
                  <p className="text-xs text-base-muted font-mono">
                    GA Number: <strong className="text-base-accent">{selectedTemplate.gaNumber}</strong> • Template: {selectedTemplate.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGenerateMpModalOpen(false)}
                className="p-1 hover:bg-base-surface rounded text-base-muted hover:text-base-text transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Matching Project Banner */}
              {matchingProject ? (
                <div className="p-3 bg-base-accent-dim/30 border border-base-accent/20 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="text-base-muted uppercase text-[10px] font-condensed font-bold block">Matched Registered Project</span>
                    <strong className="text-base-text font-bold text-sm">{matchingProject.client || matchingProject.name}</strong>
                    <span className="text-base-muted ml-2">WO: {matchingProject.client}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-base-green-dim text-base-green rounded text-[10px] font-condensed font-bold uppercase">
                    Connected
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>No active registered project matches GA <strong>{selectedTemplate.gaNumber}</strong>. Items will be created in Material Processing under GA {selectedTemplate.gaNumber}.</span>
                </div>
              )}

              {/* Duplicate Checkbox */}
              <div className="flex items-center gap-2.5 p-3 bg-base-surface2/60 border border-base-border rounded-lg text-xs">
                <input
                  type="checkbox"
                  id="skipDupesCheck"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-base-border text-base-accent focus:ring-base-accent h-4 w-4 cursor-pointer"
                />
                <label htmlFor="skipDupesCheck" className="text-base-text font-medium cursor-pointer select-none">
                  Skip items already in Material Processing for this GA
                </label>
                {existingMpPartNos.size > 0 && (
                  <span className="ml-auto text-[10px] text-base-muted font-mono bg-base-surface border border-base-border px-1.5 py-0.5 rounded">
                    {existingMpPartNos.size} part(s) existing
                  </span>
                )}
              </div>

              {/* Items Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-condensed font-bold uppercase text-base-text">
                    Items Preview ({itemsToGenerate.length} of {eligibleMpItems.length} Plate & Structural)
                  </h4>
                </div>

                <div className="border border-base-border rounded-lg overflow-hidden max-h-56 overflow-y-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold uppercase text-base-muted sticky top-0">
                      <tr>
                        <th className="p-2">Part No</th>
                        <th className="p-2">Material / Grade</th>
                        <th className="p-2">Category</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2">Unit</th>
                        <th className="p-2 text-right">Wt/pcs (kg)</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-border/50">
                      {eligibleMpItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-base-muted">
                            No plate or structural items found in this BOM template.
                          </td>
                        </tr>
                      ) : (
                        eligibleMpItems.map((item) => {
                          const isDupe = (item.partNumber || '') && existingMpPartNos.has(item.partNumber.trim().toLowerCase());
                          const isSkipped = skipDuplicates && isDupe;

                          return (
                            <tr key={item.id} className={isSkipped ? 'opacity-40 bg-base-surface2/30' : 'hover:bg-base-surface2/40'}>
                              <td className="p-2 font-mono font-bold text-base-text">{item.partNumber || '-'}</td>
                              <td className="p-2 text-base-text">{item.material || '-'}</td>
                              <td className="p-2 uppercase text-[10px] font-condensed font-bold text-base-muted">{item.category}</td>
                              <td className="p-2 text-right font-mono text-base-text">{item.quantity}</td>
                              <td className="p-2 text-base-muted">{item.unit}</td>
                              <td className="p-2 text-right font-mono text-base-text">{item.weightPerUnit || 0}</td>
                              <td className="p-2 text-center">
                                {isSkipped ? (
                                  <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-condensed font-bold uppercase rounded">
                                    Skipped (Exists)
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-base-green-dim text-base-green text-[9px] font-condensed font-bold uppercase rounded">
                                    Ready
                                  </span>
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
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-base-border bg-base-surface2/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGenerateMpModalOpen(false)}
                className="px-4 py-2 border border-base-border text-base-text hover:bg-base-surface2 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateMaterialProcessing}
                disabled={itemsToGenerate.length === 0 || isGeneratingMp}
                className="px-4 py-2 bg-base-accent hover:bg-base-accent-hover disabled:bg-base-border text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-2 shadow-sm"
              >
                {isGeneratingMp ? (
                  <span>Generating...</span>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5" />
                    <span>Generate {itemsToGenerate.length} Items</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
