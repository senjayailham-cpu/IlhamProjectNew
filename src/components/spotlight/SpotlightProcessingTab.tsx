import React, { useState, useMemo } from 'react';
import {
  Project,
  User,
  MaterialProcessing,
  ProcessingStageKey,
  ProcessingStage,
  ProcessingStatus,
  PROCESSING_STAGES
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
  User as UserIcon
} from 'lucide-react';

interface SpotlightProcessingTabProps {
  project: Project;
  materialProcessings: MaterialProcessing[];
  currentUser: User | null;
  onAdd: (item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateStage: (mpId: string, stage: ProcessingStageKey, data: Partial<ProcessingStage>) => void;
  onDelete: (id: string) => void;
  setDeleteConfirm?: (state: any) => void;
}

export function SpotlightProcessingTab({
  project,
  materialProcessings = [],
  currentUser,
  onAdd,
  onUpdateStage,
  onDelete,
  setDeleteConfirm
}: SpotlightProcessingTabProps) {
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

    onUpdateStage(updatingStage.mp.id, updatingStage.stageKey, {
      pct: Number(stagePct),
      status: stageStatus,
      startDate: stageStartDate || undefined,
      doneDate: stageStatus === 'done' ? stageDoneDate || new Date().toISOString().slice(0, 10) : stageDoneDate || undefined,
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
              {(['nesting', 'cnc', 'bending', 'machining'] as ProcessingStageKey[]).map(key => {
                const info = PROCESSING_STAGES[key];
                const checked = formActiveStages.includes(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-1.5 text-xs text-base-text cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleStageToggle(key)}
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

      {/* TRACKED MATERIALS LIST */}
      <div className="overflow-x-auto rounded-lg border border-base-border bg-base-surface shadow-sm">
        <table className="w-full text-left border-collapse min-w-[750px]">
          <thead>
            <tr className="bg-base-surface2 text-base-muted font-condensed font-bold text-[10px] uppercase tracking-wider border-b border-base-border">
              <th className="px-3 py-2.5 text-center w-10">#</th>
              <th className="px-3 py-2.5">Material Details</th>
              <th className="px-3 py-2.5 text-center w-20">Qty</th>
              {['nesting', 'cnc', 'bending', 'machining'].map(stageKey => {
                const s = PROCESSING_STAGES[stageKey as ProcessingStageKey];
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
            {projectMaterials.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-base-muted">
                  No materials tracked for this project's shop floor yet.
                </td>
              </tr>
            ) : (
              projectMaterials.map((mp, idx) => {
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
                    {(['nesting', 'cnc', 'bending', 'machining'] as ProcessingStageKey[]).map(
                      stageKey => {
                        const isApp = mp.activeStages.includes(stageKey);
                        const sData = mp.stages[stageKey];

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
                            onClick={() => handleOpenStageEdit(mp, stageKey)}
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
                <span>{PROCESSING_STAGES[updatingStage.stageKey].icon}</span>
                Update {PROCESSING_STAGES[updatingStage.stageKey].label} Stage
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
