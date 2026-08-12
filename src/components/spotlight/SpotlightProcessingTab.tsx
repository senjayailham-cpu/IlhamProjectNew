import React, { useState, useMemo } from 'react';
import {
  Project,
  User,
  MaterialProcessing,
  ProcessingStageKey,
  ProcessingStage,
  ProcessingStatus,
  PROCESSING_STAGES,
  OrgSettings
} from '../../types';
import {
  Plus,
  Trash2,
  X,
  Sliders,
  CheckCircle,
  AlertCircle,
  Layers,
  Calendar,
  User as UserIcon,
  Package,
  CheckCircle2,
  Clock,
  PieChart,
  TrendingUp
} from 'lucide-react';

interface SpotlightProcessingTabProps {
  project: Project;
  materialProcessings: MaterialProcessing[];
  currentUser: User | null;
  onAdd: (item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateStage: (mpId: string, stage: ProcessingStageKey, data: Partial<ProcessingStage>) => void;
  onDelete: (id: string) => void;
  setDeleteConfirm?: (state: any) => void;
  orgSettings?: OrgSettings;
}

export function SpotlightProcessingTab({
  project,
  materialProcessings = [],
  currentUser,
  onAdd,
  onUpdateStage,
  onDelete,
  setDeleteConfirm,
  orgSettings
}: SpotlightProcessingTabProps) {
  const configuredStages = useMemo(() => {
    if (orgSettings?.processingStages && orgSettings.processingStages.length > 0) {
      return orgSettings.processingStages;
    }
    return [
      { key: 'nesting', label: 'Nesting', color: 'var(--green)', order: 1 },
      { key: 'cnc', label: 'CNC', color: 'var(--accent)', order: 2 },
      { key: 'bending', label: 'Bending', color: 'var(--blue)', order: 3 },
      { key: 'machining', label: 'Machining', color: '#8b5cf6', order: 4 },
    ];
  }, [orgSettings]);

  const stageKeys = useMemo(() => configuredStages.map(s => s.key), [configuredStages]);

  const getStageDisplay = (key: string) => {
    const found = configuredStages.find(s => s.key === key);
    if (found) return { key, label: found.label, color: found.color, icon: '⚙️' };
    const fallback = PROCESSING_STAGES[key as keyof typeof PROCESSING_STAGES];
    if (fallback) return { key, label: fallback.label, color: fallback.color, icon: fallback.icon };
    return { key, label: key.toUpperCase(), color: 'var(--muted)', icon: '📋' };
  };
  // Filters and Add State
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Add Form state
  const [formAssemblyId, setFormAssemblyId] = useState('');
  const [formMaterialName, setFormMaterialName] = useState('');
  const [formPartNo, setFormPartNo] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formThickness, setFormThickness] = useState('');
  const [formMaterialType, setFormMaterialType] = useState('SS304');
  const [formQty, setFormQty] = useState(1);
  const [formUnit, setFormUnit] = useState('pcs');
  const [formActiveStages, setFormActiveStages] = useState<ProcessingStageKey[]>([
    'nesting',
    'cnc',
    'bending',
    'machining'
  ]);

  // Editing stage state
  const [updatingStage, setUpdatingStage] = useState<{
    mp: MaterialProcessing;
    stageKey: ProcessingStageKey;
  } | null>(null);

  // Stage form states
  const [stagePct, setStagePct] = useState(0);
  const [stageStatus, setStageStatus] = useState<ProcessingStatus>('pending');
  const [stageStartDate, setStageStartDate] = useState('');
  const [stageDoneDate, setStageDoneDate] = useState('');
  const [stageOperator, setStageOperator] = useState('');
  const [stageNotes, setStageNotes] = useState('');

  const isReadOnly = useMemo(() => {
    return currentUser?.role !== 'admin' && currentUser?.role !== 'manager';
  }, [currentUser]);

  // Filter materials for this project only
  const projectMaterials = useMemo(() => {
    return materialProcessings.filter(mp => mp.projectId === project.id);
  }, [materialProcessings, project.id]);

  // Assembly Filter State
  const [selectedAssemblyFilter, setSelectedAssemblyFilter] = useState<string>('all');

  // Assembly BOM Summaries calculation
  const assemblySummaries = useMemo(() => {
    const asms = project.assemblies || [];
    const asmMap = new Map<string, MaterialProcessing[]>();
    const unlinkedItems: MaterialProcessing[] = [];

    projectMaterials.forEach(mp => {
      const matchedAsm = asms.find(
        a => (mp.assemblyId && a.id === mp.assemblyId) ||
             (mp.assemblyName && a.name.trim().toLowerCase() === mp.assemblyName.trim().toLowerCase())
      );
      if (matchedAsm) {
        const existing = asmMap.get(matchedAsm.id) || [];
        existing.push(mp);
        asmMap.set(matchedAsm.id, existing);
      } else {
        unlinkedItems.push(mp);
      }
    });

    const list = asms.map(asm => {
      const items = asmMap.get(asm.id) || [];
      const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
      const completedCount = items.filter(item => item.isCompleted || item.overallPct >= 100).length;
      const avgProgress = items.length > 0
        ? Math.round(items.reduce((sum, item) => sum + (item.overallPct || 0), 0) / items.length)
        : 0;

      return {
        id: asm.id,
        name: asm.name,
        itemCount: items.length,
        totalQty,
        completedCount,
        avgProgress
      };
    });

    if (unlinkedItems.length > 0) {
      const totalQty = unlinkedItems.reduce((sum, item) => sum + (item.qty || 0), 0);
      const completedCount = unlinkedItems.filter(item => item.isCompleted || item.overallPct >= 100).length;
      const avgProgress = Math.round(
        unlinkedItems.reduce((sum, item) => sum + (item.overallPct || 0), 0) / unlinkedItems.length
      );

      list.push({
        id: 'unlinked',
        name: 'General / Unlinked',
        itemCount: unlinkedItems.length,
        totalQty,
        completedCount,
        avgProgress
      });
    }

    return list;
  }, [project.assemblies, projectMaterials]);

  // Filtered materials based on selected assembly
  const filteredMaterials = useMemo(() => {
    if (selectedAssemblyFilter === 'all') return projectMaterials;
    const asms = project.assemblies || [];
    return projectMaterials.filter(mp => {
      const matched = asms.find(
        a => (mp.assemblyId && a.id === mp.assemblyId) ||
             (mp.assemblyName && a.name.trim().toLowerCase() === mp.assemblyName.trim().toLowerCase())
      );
      if (selectedAssemblyFilter === 'unlinked') {
        return !matched;
      }
      return matched?.id === selectedAssemblyFilter;
    });
  }, [projectMaterials, selectedAssemblyFilter, project.assemblies]);

  // Overall Processing Statistics (% Selesai, % Sedang Proses, % Total Progress)
  const overallStats = useMemo(() => {
    const totalItems = projectMaterials.length;
    if (totalItems === 0) {
      return {
        overallPct: 0,
        completedCount: 0,
        completedPct: 0,
        inProgressCount: 0,
        inProgressPct: 0,
        pendingCount: 0,
        pendingPct: 0,
        totalQty: 0
      };
    }

    const totalPctSum = projectMaterials.reduce((sum, item) => sum + (item.overallPct || 0), 0);
    const overallPct = Math.round(totalPctSum / totalItems);

    const completedCount = projectMaterials.filter(
      item => item.isCompleted || (item.overallPct || 0) >= 100
    ).length;
    const inProgressCount = projectMaterials.filter(
      item => !item.isCompleted && (item.overallPct || 0) > 0 && (item.overallPct || 0) < 100
    ).length;
    const pendingCount = projectMaterials.filter(
      item => (item.overallPct || 0) === 0
    ).length;
    const totalQty = projectMaterials.reduce((sum, item) => sum + (item.qty || 0), 0);

    return {
      overallPct,
      completedCount,
      completedPct: Math.round((completedCount / totalItems) * 100),
      inProgressCount,
      inProgressPct: Math.round((inProgressCount / totalItems) * 100),
      pendingCount,
      pendingPct: Math.round((pendingCount / totalItems) * 100),
      totalQty
    };
  }, [projectMaterials]);

  // Handle stage checkbox toggle in add form
  const handleStageToggle = (stageKey: ProcessingStageKey) => {
    setFormActiveStages(prev =>
      prev.includes(stageKey) ? prev.filter(k => k !== stageKey) : [...prev, stageKey]
    );
  };

  // Submit quick add form
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMaterialName.trim() || formQty <= 0) {
      alert('Please fill out the material name and quantity.');
      return;
    }

    const selectedAsm = project.assemblies?.find(a => a.id === formAssemblyId);

    const initialStages: Partial<Record<ProcessingStageKey, ProcessingStage>> = {};
    formActiveStages.forEach(key => {
      initialStages[key] = {
        pct: 0,
        status: 'pending',
        operator: '',
        notes: ''
      };
    });

    onAdd({
      projectId: project.id,
      projectName: project.name,
      workOrder: project.client || '',
      gaNumber: project.gaNumber || undefined,
      materialName: formMaterialName.trim(),
      partNo: formPartNo.trim() || undefined,
      description: formDescription.trim() || undefined,
      thickness: formThickness.trim() || undefined,
      material: formMaterialType,
      qty: formQty,
      unit: formUnit,
      activeStages: formActiveStages,
      stages: initialStages,
      overallPct: 0,
      createdBy: currentUser?.name || 'Unknown',
      assemblyId: formAssemblyId || undefined,
      assemblyName: selectedAsm?.name || undefined,
      isCompleted: false
    });

    // Reset Form
    setFormMaterialName('');
    setFormPartNo('');
    setFormDescription('');
    setFormThickness('');
    setFormMaterialType('SS304');
    setFormQty(1);
    setFormUnit('pcs');
    setFormActiveStages(['nesting', 'cnc', 'bending', 'machining']);
    setShowQuickAdd(false);
  };

  // Open inline stage editing
  const handleOpenStageEdit = (mp: MaterialProcessing, stageKey: ProcessingStageKey) => {
    if (isReadOnly) return;
    const current = mp.stages[stageKey] || {
      pct: 0,
      status: 'pending',
      startDate: '',
      doneDate: '',
      operator: '',
      notes: ''
    };

    setUpdatingStage({ mp, stageKey });
    setStagePct(current.pct ?? 0);
    setStageStatus(current.status ?? 'pending');
    setStageStartDate(current.startDate ?? '');
    setStageDoneDate(current.doneDate ?? '');
    setStageOperator(current.operator || currentUser?.name || '');
    setStageNotes(current.notes || '');
  };

  // Prefill dates on stage status changes
  const handleStageStatusChange = (status: ProcessingStatus) => {
    setStageStatus(status);
    const today = new Date().toISOString().slice(0, 10);
    if (status === 'in-progress' && !stageStartDate) {
      setStageStartDate(today);
    } else if (status === 'done' || status === 'skipped') {
      if (!stageStartDate) setStageStartDate(today);
      if (!stageDoneDate) setStageDoneDate(today);
      setStagePct(100);
    } else if (status === 'pending') {
      setStagePct(0);
    }
  };

  // Save stage progress
  const handleStageFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingStage) return;

    let finalPct = Number(stagePct);
    let finalStatus = stageStatus;

    if (finalPct >= 100) {
      finalPct = 100;
      if (finalStatus !== 'skipped') finalStatus = 'done';
    } else if (finalStatus === 'done') {
      finalPct = 100;
    }

    onUpdateStage(updatingStage.mp.id, updatingStage.stageKey, {
      pct: finalPct,
      status: finalStatus,
      startDate: stageStartDate || undefined,
      doneDate: finalStatus === 'done' ? stageDoneDate || new Date().toISOString().slice(0, 10) : stageDoneDate || undefined,
      operator: stageOperator.trim() || currentUser?.name || 'Operator',
      notes: stageNotes.trim() || undefined
    });

    setUpdatingStage(null);
  };

  // Check if material processing has an overdue stage
  const isOverdue = (mp: MaterialProcessing) => {
    if (mp.isCompleted) return false;
    const hasInProgress = mp.activeStages.some(
      k => mp.stages[k]?.status === 'in-progress'
    );
    if (!hasInProgress) return false;
    const updated = new Date(mp.updatedAt || mp.createdAt);
    const diffTime = Math.abs(Date.now() - updated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Tab Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-muted flex items-center gap-1.5 ml-1">
            <Layers className="h-4.5 w-4.5 text-base-accent" />
            <span>Project Material Processing Tracker ({projectMaterials.length} items)</span>
          </h4>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="px-3 py-1 bg-base-accent hover:bg-base-accent/80 text-black font-condensed font-bold uppercase rounded text-xs transition duration-200 flex items-center gap-1 cursor-pointer"
          >
            {showQuickAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{showQuickAdd ? 'Hide Quick Form' : 'Quick Add Material'}</span>
          </button>
        )}
      </div>

      {/* OVERALL MATERIAL PROCESSING PROGRESS KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Total Overall Progress Card */}
        <div className="sm:col-span-1 bg-base-surface2 border border-base-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-base-accent" /> Total Progress MP
            </span>
            <span className="text-[10px] font-mono text-base-muted">{projectMaterials.length} items</span>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-base-text">
              {overallStats.overallPct}<span className="text-sm font-bold text-base-accent">%</span>
            </div>
            <div className="w-full bg-base-surface3 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="h-full bg-base-accent rounded-full transition-all duration-300"
                style={{ width: `${overallStats.overallPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Selesai / Siap (100%) Card */}
        <div className="bg-base-surface2 border border-base-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Selesai / Siap
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {overallStats.completedPct}%
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-base-text">
            {overallStats.completedCount} <span className="text-xs font-normal text-base-muted">item</span>
          </div>
          <p className="text-[9.5px] text-base-muted">Telah mencapai 100% progress</p>
        </div>

        {/* Sedang Proses Card */}
        <div className="bg-base-surface2 border border-base-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Sedang Proses
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              {overallStats.inProgressPct}%
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-base-text">
            {overallStats.inProgressCount} <span className="text-xs font-normal text-base-muted">item</span>
          </div>
          <p className="text-[9.5px] text-base-muted">Dalam tahap pengerjaan (1% - 99%)</p>
        </div>

        {/* Belum Mulai Card */}
        <div className="bg-base-surface2 border border-base-border/80 rounded-xl p-3.5 flex flex-col justify-between space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted flex items-center gap-1">
              <PieChart className="h-3.5 w-3.5" /> Belum Mulai
            </span>
            <span className="text-[10px] font-mono font-bold text-base-muted bg-base-surface3 px-1.5 py-0.5 rounded border border-base-border/50">
              {overallStats.pendingPct}%
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-base-text">
            {overallStats.pendingCount} <span className="text-xs font-normal text-base-muted">item</span>
          </div>
          <p className="text-[9.5px] text-base-muted">Masih 0% / belum diproses</p>
        </div>
      </div>

      {/* QUICK INLINE FORM */}
      {showQuickAdd && (
        <form
          onSubmit={handleQuickAddSubmit}
          className="bg-base-surface border border-base-border rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
            <div className="col-span-2 sm:col-span-2 space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Material Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Flange SS304 4inch"
                value={formMaterialName}
                onChange={e => setFormMaterialName(e.target.value)}
                className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Part / Drawing No
              </label>
              <input
                type="text"
                placeholder="e.g. FLG-102"
                value={formPartNo}
                onChange={e => setFormPartNo(e.target.value)}
                className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Assembly Link (Optional)
              </label>
              <select
                value={formAssemblyId}
                onChange={e => setFormAssemblyId(e.target.value)}
                className="w-full px-2 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs font-sans"
              >
                <option value="">No Link</option>
                {(project.assemblies || []).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Thickness
              </label>
              <input
                type="text"
                placeholder="e.g. 10mm"
                value={formThickness}
                onChange={e => setFormThickness(e.target.value)}
                className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Material Grade
              </label>
              <select
                value={formMaterialType}
                onChange={e => setFormMaterialType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs font-sans"
              >
                <option value="SS304">SS304</option>
                <option value="SS316">SS316</option>
                <option value="CS A36">CS A36</option>
                <option value="Aluminium">Aluminium</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                required
                value={formQty}
                onChange={e => setFormQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                Unit *
              </label>
              <select
                value={formUnit}
                onChange={e => setFormUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded outline-none text-base-text text-xs font-sans"
              >
                <option value="pcs">pcs</option>
                <option value="sheet">sheet</option>
                <option value="kg">kg</option>
                <option value="m">m</option>
                <option value="set">set</option>
              </select>
            </div>
          </div>

          {/* Active Stages checkboxes row */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 block">
              Active Processing Stages *
            </label>
            <div className="flex flex-wrap gap-4 bg-base-surface2 p-2.5 rounded-lg border border-base-border">
              {stageKeys.map(key => {
                const info = getStageDisplay(key);
                const checked = formActiveStages.includes(key as ProcessingStageKey);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-1.5 text-xs text-base-text cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleStageToggle(key as ProcessingStageKey)}
                      className="accent-base-accent"
                    />
                    <span>{info.icon}</span>
                    <span className="font-medium">{info.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-base-border text-xs">
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="px-3 py-1.5 text-base-muted hover:text-base-text font-condensed font-bold uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-base-accent hover:bg-base-accent/80 text-black font-condensed font-bold uppercase rounded transition cursor-pointer"
            >
              Confirm Add
            </button>
          </div>
        </form>
      )}

      {/* ASSEMBLY BOM PROCESSING SUMMARY */}
      <div className="bg-base-surface2 border border-base-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4.5 w-4.5 text-base-accent" />
            <div>
              <h5 className="font-condensed font-extrabold text-xs uppercase tracking-wider text-base-text">
                Assembly BOM Processing Summary ({assemblySummaries.length} Assemblies)
              </h5>
              <p className="text-[10px] text-base-muted">
                Jumlah item material dan total progress pengerjaan per assembly
              </p>
            </div>
          </div>
          {selectedAssemblyFilter !== 'all' && (
            <button
              onClick={() => setSelectedAssemblyFilter('all')}
              className="text-[10px] font-condensed font-bold uppercase text-base-accent hover:underline flex items-center gap-1 cursor-pointer bg-base-accent/10 border border-base-accent/20 px-2.5 py-1 rounded-md"
            >
              <span>✕ Show All ({projectMaterials.length} Items)</span>
            </button>
          )}
        </div>

        {assemblySummaries.length === 0 ? (
          <div className="text-xs text-base-muted italic py-3 text-center bg-base-surface rounded-lg border border-base-border/40">
            Belum ada assembly / data material processing untuk project ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {assemblySummaries.map(asm => {
              const isSelected = selectedAssemblyFilter === asm.id;
              const progressColor =
                asm.avgProgress >= 100
                  ? 'bg-emerald-500'
                  : asm.avgProgress > 0
                  ? 'bg-amber-500'
                  : 'bg-base-border';

              return (
                <div
                  key={asm.id}
                  onClick={() => setSelectedAssemblyFilter(prev => (prev === asm.id ? 'all' : asm.id))}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                    isSelected
                      ? 'bg-base-accent/10 border-base-accent ring-1 ring-base-accent'
                      : 'bg-base-surface border-base-border/60 hover:border-base-border hover:bg-base-surface3/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-base-text truncate block leading-tight" title={asm.name}>
                        {asm.name}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 bg-base-surface2 text-base-muted border border-base-border/50">
                      {asm.itemCount} item{asm.itemCount !== 1 ? 's' : ''} ({asm.totalQty} pcs)
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-base-muted font-sans text-[9.5px]">
                        Selesai: <strong className="text-base-text font-mono">{asm.completedCount}/{asm.itemCount}</strong>
                      </span>
                      <span
                        className={`font-bold ${
                          asm.avgProgress >= 100
                            ? 'text-emerald-500'
                            : asm.avgProgress > 0
                            ? 'text-amber-500'
                            : 'text-base-muted'
                        }`}
                      >
                        {asm.avgProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-base-surface3 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                        style={{ width: `${asm.avgProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TRACKED MATERIALS LIST */}
      <div className="overflow-x-auto rounded-lg border border-base-border bg-base-surface shadow-sm">
        <table className="w-full text-left border-collapse min-w-[750px]">
          <thead>
            <tr className="bg-base-surface2 text-base-muted font-condensed font-bold text-[10px] uppercase tracking-wider border-b border-base-border">
              <th className="px-3 py-2.5 text-center w-10">#</th>
              <th className="px-3 py-2.5">Material Details</th>
              <th className="px-3 py-2.5 text-center w-20">Qty</th>
              {stageKeys.map(stageKey => {
                const s = getStageDisplay(stageKey);
                return (
                  <th key={stageKey} className="px-3 py-2.5 text-center w-32 font-condensed">
                    <div className="flex items-center justify-center gap-1">
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-center w-16">Overall</th>
              {!isReadOnly && <th className="px-3 py-2.5 text-center w-12"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-border text-xs">
            {filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan={5 + stageKeys.length} className="px-3 py-8 text-center text-base-muted">
                  {projectMaterials.length === 0
                    ? "No materials tracked for this project's shop floor yet."
                    : "No materials match the selected assembly filter."}
                </td>
              </tr>
            ) : (
              filteredMaterials.map((mp, idx) => {
                const compl = mp.isCompleted;
                const overdue = isOverdue(mp);

                let rowBg = 'hover:bg-base-surface3/30';
                if (compl) {
                  rowBg = 'bg-emerald-950/5 hover:bg-emerald-950/10';
                } else if (overdue) {
                  rowBg = 'bg-red-950/5 hover:bg-red-950/10';
                }

                return (
                  <tr key={mp.id} className={`transition-colors ${rowBg}`}>
                    <td className="px-3 py-3 text-center font-semibold text-base-muted">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-base-text text-xs leading-tight">
                        {mp.materialName}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-base-muted mt-0.5 font-mono">
                        {mp.partNo && <span>Part: {mp.partNo}</span>}
                        {mp.thickness && <span>Thk: {mp.thickness}</span>}
                        {mp.material && <span>Mat: {mp.material}</span>}
                        {mp.assemblyName && (
                          <span className="text-base-accent">Link: {mp.assemblyName}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-base-text font-mono">
                      {mp.qty} <span className="text-[10px] text-base-muted font-normal">{mp.unit}</span>
                    </td>

                    {/* Stage cells */}
                    {stageKeys.map(
                      stageKey => {
                        const isApp = mp.activeStages.includes(stageKey as ProcessingStageKey);
                        const sData = mp.stages[stageKey as ProcessingStageKey];

                        if (!isApp) {
                          return (
                            <td
                              key={stageKey}
                              className="px-3 py-3 text-center text-base-muted bg-base-surface2/20 text-[10px] select-none"
                            >
                              —
                            </td>
                          );
                        }

                        const pct = sData?.pct ?? 0;
                        const status = sData?.status ?? 'pending';

                        let statusColor = 'text-base-muted';
                        if (status === 'in-progress') statusColor = 'text-amber-500';
                        else if (status === 'done') statusColor = 'text-emerald-500';
                        else if (status === 'skipped') statusColor = 'text-base-muted line-through';

                        return (
                          <td
                            key={stageKey}
                            onClick={() => handleOpenStageEdit(mp, stageKey as ProcessingStageKey)}
                            className={`px-3 py-3 text-center ${
                              isReadOnly
                                ? 'cursor-default'
                                : 'cursor-pointer hover:bg-base-surface3/40 transition-colors'
                            }`}
                            title={isReadOnly ? undefined : 'Click to edit stage'}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                                <span className="font-bold text-base-text">{pct}%</span>
                                <span className={`font-bold uppercase tracking-wider ${statusColor}`}>
                                  {status === 'done' ? '✓' : status === 'in-progress' ? 'IP' : status === 'skipped' ? 'SK' : 'PE'}
                                </span>
                              </div>
                              <div className="w-full bg-base-surface3 rounded-full h-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    status === 'done'
                                      ? 'bg-emerald-500'
                                      : status === 'in-progress'
                                      ? 'bg-amber-500'
                                      : status === 'skipped'
                                      ? 'bg-neutral-600'
                                      : 'bg-base-border'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        );
                      }
                    )}

                    {/* Overall Progress */}
                    <td className="px-3 py-3 text-center font-bold font-mono text-xs">
                      <span
                        className={
                          mp.overallPct < 40
                            ? 'text-red-500'
                            : mp.overallPct < 80
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }
                      >
                        {mp.overallPct}%
                      </span>
                      {overdue && (
                        <span className="block text-[8px] text-red-500 font-bold uppercase mt-0.5">
                          Overdue
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    {!isReadOnly && (
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => {
                            if (setDeleteConfirm) {
                              setDeleteConfirm({
                                isOpen: true,
                                title: 'Remove Tracking',
                                message: `Are you sure you want to remove material processing tracking for "${mp.materialName}"?`,
                                onConfirm: () => {
                                  onDelete(mp.id);
                                  setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
                                }
                              });
                            } else if (confirm('Remove material processing tracker for this item?')) {
                              onDelete(mp.id);
                            }
                          }}
                          className="p-1 text-base-muted hover:text-red-500 rounded transition"
                          title="Remove Tracking"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* STAGE EDIT INLINE DIALOGUE */}
      {updatingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-base-surface border border-base-border rounded-xl shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-surface2">
              <h4 className="text-xs font-bold font-sans text-base-text flex items-center gap-1.5 uppercase tracking-wide">
                <span>{getStageDisplay(updatingStage.stageKey).icon}</span>
                Update {getStageDisplay(updatingStage.stageKey).label} Stage
              </h4>
              <button
                type="button"
                onClick={() => setUpdatingStage(null)}
                className="p-1 hover:bg-base-surface3 rounded transition text-base-muted hover:text-base-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStageFormSubmit} className="p-4 space-y-3.5 text-xs">
              <div className="text-[11px] text-base-muted bg-base-surface2 border border-base-border rounded p-2">
                <span className="font-bold text-xs text-base-text block">
                  {updatingStage.mp.materialName}
                </span>
                <span className="block font-mono mt-0.5">
                  Part: {updatingStage.mp.partNo || '—'} · WO: {updatingStage.mp.workOrder}
                </span>
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                  Processing Status
                </label>
                <select
                  value={stageStatus}
                  onChange={e => handleStageStatusChange(e.target.value as ProcessingStatus)}
                  className="w-full bg-base-surface2 border border-base-border text-base-text text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-base-accent font-sans"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done ✓</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>

              {/* Slider */}
              {stageStatus !== 'skipped' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <label className="font-condensed font-bold uppercase tracking-wider text-base-muted2">
                      Progress
                    </label>
                    <span className="font-mono font-bold text-base-accent">{stagePct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={stagePct}
                    onChange={e => setStagePct(Number(e.target.value))}
                    disabled={stageStatus === 'pending'}
                    className="w-full accent-base-accent bg-base-surface3 rounded-lg appearance-none h-1.5 cursor-pointer disabled:opacity-50"
                  />
                </div>
              )}

              {/* Start & End Dates */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 flex items-center gap-0.5">
                    <Calendar className="h-3 w-3" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={stageStartDate}
                    onChange={e => setStageStartDate(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-xs rounded px-2 py-1 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 flex items-center gap-0.5">
                    <Calendar className="h-3 w-3" /> Done Date
                  </label>
                  <input
                    type="date"
                    value={stageDoneDate}
                    onChange={e => setStageDoneDate(e.target.value)}
                    disabled={stageStatus !== 'done'}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-xs rounded px-2 py-1 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Operator */}
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 flex items-center gap-0.5">
                  <UserIcon className="h-3 w-3" /> Operator
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={stageOperator}
                  onChange={e => setStageOperator(e.target.value)}
                  className="w-full bg-base-surface2 border border-base-border text-base-text text-xs rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-base-accent"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
                  Remarks / Notes
                </label>
                <textarea
                  placeholder="Remarks..."
                  rows={2}
                  value={stageNotes}
                  onChange={e => setStageNotes(e.target.value)}
                  className="w-full bg-base-surface2 border border-base-border text-base-text text-xs rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-base-accent"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-base-border">
                <button
                  type="button"
                  onClick={() => setUpdatingStage(null)}
                  className="px-3 py-1 text-base-muted hover:text-base-text font-condensed font-bold uppercase text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-base-accent hover:bg-base-accent/80 text-black font-condensed font-bold uppercase rounded shadow text-[11px] cursor-pointer"
                >
                  Save Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
