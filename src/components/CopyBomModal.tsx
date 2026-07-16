import React, { useState, useEffect } from 'react';
import { Project, MaterialProcessing, ProcessingStageKey, ProcessingStage, User, Assembly } from '../types';
import { X, Check, ArrowLeft, ArrowRight, ClipboardCopy, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { buildCopiedStructure } from '../utils/copyStructureUtils';

interface CopyBomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: Project;
  gaMatchCandidates: Project[];
  currentUser: User;
  onAdd: (projectId: string, item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCopyStructure: (targetProjectId: string, newAssemblies: Assembly[]) => Promise<void>;
  onSuccess: (message: string) => void;
}

export function CopyBomModal({
  isOpen,
  onClose,
  currentProject,
  gaMatchCandidates,
  currentUser,
  onAdd,
  onCopyStructure,
  onSuccess,
}: CopyBomModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSourceProject, setSelectedSourceProject] = useState<Project | null>(null);
  
  // Checklist and Copy configurations
  const [copyStructureChecked, setCopyStructureChecked] = useState(true);
  const [copyMaterialChecked, setCopyMaterialChecked] = useState(true);
  const [expandedAssemblyIds, setExpandedAssemblyIds] = useState<Record<string, boolean>>({});

  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({});

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedSourceProject(null);
      setCheckedItemIds([]);
      setEditedQtys({});
      setCopyStructureChecked(true);
      setCopyMaterialChecked(true);
      setExpandedAssemblyIds({});
    }
  }, [isOpen]);

  // When source project is selected, initialize the checklist and quantities
  const handleSelectSource = (proj: Project) => {
    setSelectedSourceProject(proj);
    setCopyStructureChecked(true);
    setCopyMaterialChecked(true);
    
    const items = proj.materialProcessing || [];
    setCheckedItemIds(items.map((item) => item.id));
    
    const qtys: Record<string, number> = {};
    items.forEach((item) => {
      qtys[item.id] = item.qty || 1;
    });
    setEditedQtys(qtys);
    
    // Initialize assemblies to be expanded
    const exp: Record<string, boolean> = {};
    (proj.assemblies || []).forEach(a => {
      exp[a.id] = true;
    });
    setExpandedAssemblyIds(exp);

    setStep(2);
  };

  const handleToggleItem = (id: string) => {
    setCheckedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!selectedSourceProject) return;
    const items = selectedSourceProject.materialProcessing || [];
    setCheckedItemIds(items.map((item) => item.id));
  };

  const handleDeselectAll = () => {
    setCheckedItemIds([]);
  };

  const handleQtyChange = (id: string, val: number) => {
    setEditedQtys((prev) => ({
      ...prev,
      [id]: Math.max(1, val),
    }));
  };

  const handleCopySubmit = async () => {
    if (!selectedSourceProject) return;

    const successMsgParts: string[] = [];
    let hasCopiedStructure = false;
    let copiedAssembliesCount = 0;
    let copiedTasksCount = 0;
    let copiedMaterialsCount = 0;

    // 1. Copy Structure
    if (copyStructureChecked) {
      try {
        const assembliesToCopy = buildCopiedStructure(selectedSourceProject, currentProject);
        await onCopyStructure(currentProject.id, assembliesToCopy);
        copiedAssembliesCount = assembliesToCopy.length;
        copiedTasksCount = assembliesToCopy.reduce((acc, a) => acc + (a.tasks?.length || 0), 0);
        hasCopiedStructure = true;
        successMsgParts.push(`menyalin ${copiedAssembliesCount} Sub-Assembly (${copiedTasksCount} Task)`);
      } catch (err) {
        console.error('Failed to copy structure in modal:', err);
        alert('Gagal menyalin struktur Sub-Assembly & Task.');
      }
    }

    // 2. Copy Material (BOM)
    if (copyMaterialChecked && checkedItemIds.length > 0) {
      try {
        const sourceItems = selectedSourceProject.materialProcessing || [];
        const itemsToCopy = sourceItems.filter((item) => checkedItemIds.includes(item.id));

        itemsToCopy.forEach((item) => {
          const initialStages: Partial<Record<ProcessingStageKey, ProcessingStage>> = {};
          
          if (item.activeStages) {
            item.activeStages.forEach((key) => {
              initialStages[key] = {
                pct: 0,
                status: 'pending',
                operator: '',
                notes: `Disalin dari project: ${selectedSourceProject.name}`,
              };
            });
          }

          const qty = editedQtys[item.id] || item.qty || 1;

          onAdd(currentProject.id, {
            projectId: currentProject.id,
            projectName: currentProject.name,
            workOrder: currentProject.client,
            gaNumber: currentProject.gaNumber || undefined,
            materialName: item.materialName,
            partNo: item.partNo || undefined,
            description: item.description || undefined,
            thickness: item.thickness || undefined,
            material: item.material,
            qty: qty,
            unit: item.unit,
            activeStages: item.activeStages || [],
            stages: initialStages,
            overallPct: 0,
            createdBy: currentUser.name,
            assemblyId: item.assemblyId || undefined,
            assemblyName: item.assemblyName || undefined,
            isCompleted: false,
          });
        });

        copiedMaterialsCount = itemsToCopy.length;
        successMsgParts.push(`menyalin ${copiedMaterialsCount} Material`);
      } catch (err) {
        console.error('Failed to copy materials in modal:', err);
        alert('Gagal menyalin daftar material.');
      }
    }

    if (successMsgParts.length > 0) {
      const msg = `Berhasil ${successMsgParts.join(' dan ')} dari ${selectedSourceProject.name}`;
      onSuccess(msg);
    }

    onClose();
  };

  const isSubmitDisabled = 
    (!copyStructureChecked && !copyMaterialChecked) ||
    (copyMaterialChecked && checkedItemIds.length === 0);

  if (!isOpen) return null;

  return (
    <div id="copy-bom-modal-root" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
          <div className="flex items-center gap-2">
            <ClipboardCopy className="h-5 w-5 text-base-accent" />
            <div>
              <h3 className="font-condensed font-black uppercase text-base text-base-text">
                Salin Struktur & BOM
              </h3>
              <p className="text-[10px] text-base-muted font-sans uppercase tracking-wider font-semibold">
                GA Number: {currentProject.gaNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {step === 1 ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-150">
              <div className="flex items-start gap-3 bg-base-accent-dim/10 border border-base-accent/20 p-3 rounded-lg text-base-text text-xs">
                <Info className="h-4 w-4 text-base-accent shrink-0 mt-0.5" />
                <p className="leading-relaxed text-base-muted">
                  Pilih salah satu project di bawah dengan GA Number yang sama (<span className="text-base-accent font-bold font-mono">{currentProject.gaNumber}</span>) untuk dijadikan sumber struktur (Sub-Assembly/Task) dan daftar material.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-condensed font-bold uppercase text-base-muted block">
                  Daftar Project Sumber:
                </label>
                <div className="border border-base-border rounded-lg bg-base-surface2 divide-y divide-base-border">
                  {gaMatchCandidates.map((proj) => {
                    const materialCount = proj.materialProcessing?.length || 0;
                    const assemblyCount = proj.assemblies?.length || 0;
                    return (
                      <div
                        key={proj.id}
                        onClick={() => handleSelectSource(proj)}
                        className="p-4 hover:bg-base-surface3/40 transition-colors cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-base-text block truncate">
                            {proj.name}
                          </h4>
                          <p className="text-[10px] text-base-muted font-sans mt-0.5 uppercase tracking-wider">
                            WO / Client: <span className="font-semibold text-base-text">{proj.client}</span> · Dibuat: {new Date(proj.created).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="px-2 py-1 bg-base-accent-dim/10 text-base-accent border border-base-accent/20 rounded-md text-[10px] font-bold font-mono">
                            {assemblyCount} Sub-Assy
                          </span>
                          <span className="px-2 py-1 bg-base-accent-dim/10 text-base-accent border border-base-accent/20 rounded-md text-[10px] font-bold font-mono">
                            {materialCount} Material
                          </span>
                          <ArrowRight className="h-4 w-4 text-base-muted" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-150">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1 bg-base-surface border border-base-border hover:bg-base-surface3 text-base-muted hover:text-base-text text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Pilihan Project</span>
                </button>
              </div>

              {/* Toggles */}
              <div className="flex flex-col sm:flex-row gap-4 p-3 bg-base-surface2 rounded-lg border border-base-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-base-text select-none">
                  <input
                    type="checkbox"
                    checked={copyStructureChecked}
                    onChange={(e) => setCopyStructureChecked(e.target.checked)}
                    className="h-4 w-4 rounded border-base-border text-base-accent focus:ring-base-accent cursor-pointer"
                  />
                  <span>Salin Struktur Sub-Assembly & Task</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-base-text select-none">
                  <input
                    type="checkbox"
                    checked={copyMaterialChecked}
                    onChange={(e) => setCopyMaterialChecked(e.target.checked)}
                    className="h-4 w-4 rounded border-base-border text-base-accent focus:ring-base-accent cursor-pointer"
                  />
                  <span>Salin Daftar Material (BOM)</span>
                </label>
              </div>

              {/* Structure Preview Section */}
              {copyStructureChecked && (
                <div className="space-y-2 border border-base-border rounded-lg bg-base-surface overflow-hidden p-3">
                  <h4 className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Pratinjau Sub-Assembly & Task ({selectedSourceProject?.assemblies?.length || 0} Sub-Assembly)
                  </h4>
                  <div className="divide-y divide-base-border/30 max-h-[220px] overflow-y-auto space-y-1 mt-2 pr-1">
                    {(!selectedSourceProject?.assemblies || selectedSourceProject.assemblies.length === 0) ? (
                      <p className="text-xs text-base-muted italic p-2 text-center">Tidak ada sub-assembly di project sumber</p>
                    ) : (
                      selectedSourceProject.assemblies.map((assembly) => {
                        const isExpanded = expandedAssemblyIds[assembly.id] !== false;
                        const taskCount = assembly.tasks?.length || 0;
                        return (
                          <div key={assembly.id} className="border border-base-border/40 rounded-lg bg-base-surface2 overflow-hidden mb-1">
                            <div
                              onClick={() => setExpandedAssemblyIds(prev => ({ ...prev, [assembly.id]: !isExpanded }))}
                              className="flex items-center justify-between px-3 py-1.5 hover:bg-base-surface3/40 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-base-muted" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-base-muted" />
                                )}
                                <span className="text-xs font-bold text-base-text">{assembly.name}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-base-surface3 border border-base-border text-[10px] font-semibold text-base-muted rounded-full">
                                {taskCount} Task
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-2 pt-1 bg-base-surface divide-y divide-base-border/20 text-[11px] text-base-muted">
                                {taskCount === 0 ? (
                                  <div className="py-1 text-center italic text-xs">Tidak ada task</div>
                                ) : (
                                  assembly.tasks.map((task) => (
                                    <div key={task.id} className="py-1 flex items-center justify-between">
                                      <span>{task.name}</span>
                                      {task.assigned && (
                                        <span className="text-[9px] bg-base-accent-dim/10 text-base-accent px-1.5 py-0.2 rounded-md font-medium">
                                          {task.assigned}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Material (BOM) Checklist Section */}
              {copyMaterialChecked && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-condensed font-bold uppercase text-base-muted block">
                      Daftar Material (BOM) untuk Disalin:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-[10px] uppercase font-bold text-base-accent hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-[10px] text-base-muted">•</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-[10px] uppercase font-bold text-base-muted hover:text-base-text hover:underline cursor-pointer"
                      >
                        Batalkan Semua
                      </button>
                    </div>
                  </div>

                  <div className="border border-base-border rounded-lg bg-base-surface overflow-hidden">
                    <div className="px-3 py-2 bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center">
                      <div className="w-8 text-center">Sel</div>
                      <div className="flex-1">Nama Material & Part No</div>
                      <div className="w-24 text-center">Qty Salin</div>
                    </div>

                    <div className="divide-y divide-base-border/50 max-h-[220px] overflow-y-auto">
                      {(!selectedSourceProject?.materialProcessing || selectedSourceProject.materialProcessing.length === 0) ? (
                        <div className="p-4 text-center text-xs text-base-muted italic">Tidak ada daftar material di project sumber</div>
                      ) : (
                        selectedSourceProject.materialProcessing.map((item) => {
                          const isChecked = checkedItemIds.includes(item.id);
                          const qtyVal = editedQtys[item.id] || item.qty || 1;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center px-3 py-2 transition-colors ${
                                isChecked ? 'bg-base-accent-dim/5' : ''
                              }`}
                            >
                              {/* Checkbox */}
                              <div className="w-8 flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleItem(item.id)}
                                  className="h-3.5 w-3.5 rounded border-base-border text-base-accent focus:ring-base-accent cursor-pointer"
                                />
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0 pr-4" onClick={() => handleToggleItem(item.id)}>
                                <div className="text-xs font-bold text-base-text truncate cursor-pointer">
                                  {item.materialName}
                                </div>
                                <div className="text-[10px] text-base-muted font-mono truncate cursor-pointer">
                                  {item.partNo ? `Part No: ${item.partNo}` : '—'} 
                                  {item.thickness ? ` · Thk: ${item.thickness}` : ''}
                                  {item.material ? ` · Mat: ${item.material}` : ''}
                                </div>
                              </div>

                              {/* Qty edit */}
                              <div className="w-24 flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={qtyVal}
                                  disabled={!isChecked}
                                  onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 1)}
                                  className="w-16 px-1.5 py-1 bg-base-surface2 text-base-text border border-base-border rounded-md text-xs font-semibold text-center focus:border-base-accent focus:outline-none disabled:opacity-50"
                                />
                                <span className="text-[10px] text-base-muted font-semibold">{item.unit || 'pcs'}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-base-border flex items-center justify-between bg-base-surface2">
          <div className="text-xs text-base-muted">
            {step === 2 && (
              <div className="flex flex-col gap-0.5">
                {copyStructureChecked && (
                  <span>Struktur: <strong className="text-base-accent">Disalin ({selectedSourceProject?.assemblies?.length || 0} Sub-Assy)</strong></span>
                )}
                {copyMaterialChecked && (
                  <span>Material: <strong className="text-base-accent">{checkedItemIds.length}</strong> dari {(selectedSourceProject?.materialProcessing || []).length} material</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-base-surface border border-base-border hover:bg-base-surface3 text-base-text text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer"
            >
              Batal
            </button>
            {step === 2 && (
              <button
                onClick={handleCopySubmit}
                disabled={isSubmitDisabled}
                className="px-4 py-2 bg-base-accent hover:bg-base-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Mulai Salin</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
