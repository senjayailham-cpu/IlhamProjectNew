import React from 'react';
import { BookOpen, LogOut, Save, Trash2, Key, Sparkles } from 'lucide-react';
import TimesheetModal from './TimesheetModal';
import DepModal from './DepModal';
import { can as canUtil } from '../utils/permissions';
import { calcPct } from '../utils/projectUtils';
import { useFirestore } from '../hooks';
import { ErrorBoundary } from './ErrorBoundary';
import { Project, MaterialConsumptionLog, MaterialProcessing, ProcessingStageKey, ProcessingStage, MasterDataEntry, OrgSettings, BomTemplate } from '../types';
import { MasterDataAutocomplete } from './MasterDataAutocomplete';
import SpotlightModal from './SpotlightModal';

interface FormsAndModalsProps {
  projects?: Project[];
  bomTemplates?: BomTemplate[];
  authHook: ReturnType<typeof import('../hooks/useAuth').useAuth>;
  projectsHook: ReturnType<typeof import('../hooks/useProjects').useProjects>;
  employeesHook: ReturnType<typeof import('../hooks/useEmployees').useEmployees>;
  timesheetsHook: ReturnType<typeof import('../hooks/useTimesheets').useTimesheets>;
  deleteConfirm: { isOpen: boolean; title: string; message: string; onConfirm: () => void };
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  timesheets: any[];
  wireLogs: any[];
  consumptionLogs?: MaterialConsumptionLog[];
  onAddMaterialProcessing?: (projectId: string, item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProcessingStage?: (projectId: string, mpId: string, stage: ProcessingStageKey, data: Partial<ProcessingStage>) => void;
  onDeleteMaterialProcessing?: (projectId: string, id: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<any[]>>;
  verifyMarkChanged: () => void;
  logActivity: any;
  selectedMonth?: string;
  masterDataEntries: MasterDataEntry[];
  onEnsureMasterData: (
    category: 'material' | 'partNo' | 'client' | 'subAssembly' | 'gaNumber',
    value: string,
    gaNumber?: string
  ) => Promise<void>;
  orgSettings?: OrgSettings;
}

export function FormsAndModals({
  projects,
  bomTemplates = [],
  authHook,
  projectsHook,
  employeesHook,
  timesheetsHook,
  deleteConfirm,
  setDeleteConfirm,
  timesheets,
  wireLogs,
  consumptionLogs = [],
  onAddMaterialProcessing,
  onUpdateProcessingStage,
  onDeleteMaterialProcessing,
  setProjects,
  verifyMarkChanged,
  logActivity,
  selectedMonth,
  masterDataEntries,
  onEnsureMasterData,
  orgSettings,
}: FormsAndModalsProps) {
  const { currentUser } = authHook;
  const can = (perm: any) => canUtil(currentUser, perm);
  const { saveItem } = useFirestore();

  const selectedBom = bomTemplates.find(b => b.id === projectsHook.pSelectedBomId);
  const selectedBomSummary = selectedBom ? (() => {
    const subAssies = new Set((selectedBom.items || []).map(i => (i.subAssembly || '').trim() || i.category || 'MAIN ASSEMBLY'));
    return {
      itemCount: selectedBom.items?.length || 0,
      subAssyCount: subAssies.size,
      taskCount: subAssies.size * 6
    };
  })() : null;

  const gaNumberLabel = orgSettings?.terminology?.gaNumberLabel || 'GA Number';
  const categoryOptions = React.useMemo(() => {
    if (orgSettings?.projectCategories && orgSettings.projectCategories.length > 0) {
      return orgSettings.projectCategories.map((item: any) => {
        if (typeof item === 'string') {
          return { key: item, label: item };
        }
        return {
          key: item.key || item.label || String(item),
          label: item.label || item.key || String(item)
        };
      });
    }
    return [
      { key: 'tray', label: 'Tray' },
      { key: 'nontray', label: 'Non-Tray' },
    ];
  }, [orgSettings]);

  const locationOptions = React.useMemo(() => {
    if (orgSettings?.projectLocations && orgSettings.projectLocations.length > 0) {
      return orgSettings.projectLocations.map((item: any) => {
        if (typeof item === 'string') {
          return { key: item, label: item };
        }
        return {
          key: item.key || item.label || String(item),
          label: item.label || item.key || String(item)
        };
      });
    }
    return [
      { key: 'workshop1', label: 'Workshop 1' },
      { key: 'workshop2', label: 'Workshop 2' },
    ];
  }, [orgSettings]);

  React.useEffect(() => {
    if (projectsHook.projectFormOpen) {
      if (categoryOptions.length > 0 && !categoryOptions.find(o => o.key === projectsHook.pCat)) {
        projectsHook.setPCat(categoryOptions[0].key);
      }
      if (locationOptions.length > 0 && !locationOptions.find(o => o.key === projectsHook.pLoc)) {
        projectsHook.setPLoc(locationOptions[0].key);
      }
    }
  }, [projectsHook.projectFormOpen, categoryOptions, locationOptions, projectsHook.pCat, projectsHook.pLoc]);

  return (
    <>
      {/* Project Form Modal */}
      {projectsHook.projectFormOpen && (
        <div className="modal-overlay">
          <div className="modal-panel space-y-4">
            <h3 className="modal-title">
              {projectsHook.editingProjectId ? 'Modify Project' : 'Configure Project'}
            </h3>
            
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="field-label">Project Name</label>
                <input
                  type="text" inputMode="text"
                  value={projectsHook.pName}
                  onChange={(e) => projectsHook.setPName(e.target.value)}
                  placeholder=""
                  className="input-field min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Work Order Code</label>
                  <input
                    type="text" inputMode="text"
                    value={projectsHook.pWorkOrder}
                    onChange={(e) => projectsHook.setPWorkOrder(e.target.value)}
                    placeholder=""
                    className="input-field min-h-[44px] uppercase font-mono font-bold tracking-wide"
                  />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Customer / Pelanggan</label>
                  <MasterDataAutocomplete
                    category="customer"
                    value={projectsHook.pCustomer}
                    onChange={(val) => projectsHook.setPCustomer(val)}
                    placeholder="e.g. Chevron / Total / PT Austin"
                    entries={masterDataEntries}
                    className="input-field min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="field-label">{gaNumberLabel}</label>
                <MasterDataAutocomplete
                  category="gaNumber"
                  value={projectsHook.pGaNumber}
                  onChange={(val) => projectsHook.setPGaNumber(val.toUpperCase())}
                  placeholder="e.g. GA17733"
                  entries={masterDataEntries}
                  className="input-field min-h-[44px] uppercase font-mono font-bold tracking-wide"
                />
                <p className="text-[10px] text-base-muted italic font-normal">
                  Identitas jenis produk/desain. Project dengan ID/GA sama = desain & material sama, walau nama project berbeda.
                </p>
              </div>

              {!projectsHook.editingProjectId && (
                <div className="space-y-1.5 p-3 rounded-xl bg-base-100/90 border border-base-accent/30 shadow-xs">
                  <label className="field-label flex items-center justify-between">
                    <span className="text-base-text font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-base-accent" /> Gunakan Template BOM (Auto-Generate Material & Task)
                    </span>
                    {projectsHook.pSelectedBomId && (
                      <span className="text-[10px] text-base-accent font-mono font-bold bg-base-accent/15 px-2 py-0.5 rounded-full">
                        BOM Selected
                      </span>
                    )}
                  </label>
                  <select
                    value={projectsHook.pSelectedBomId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      projectsHook.setPSelectedBomId(selectedId);
                      if (selectedId && bomTemplates) {
                        const foundBom = bomTemplates.find(b => b.id === selectedId);
                        if (foundBom) {
                          if (!projectsHook.pGaNumber && foundBom.gaNumber) {
                            projectsHook.setPGaNumber(foundBom.gaNumber);
                          }
                          if (!projectsHook.pName && foundBom.name) {
                            projectsHook.setPName(foundBom.name);
                          }
                        }
                      }
                    }}
                    className="select-field min-h-[44px]"
                  >
                    <option value="">-- Tanpa Template BOM (Kosong) --</option>
                    {(bomTemplates || []).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.gaNumber ? `[${b.gaNumber}] ` : ''}{b.name} ({b.items?.length || 0} items)
                      </option>
                    ))}
                  </select>
                  {selectedBomSummary ? (
                    <div className="p-2.5 rounded-lg bg-base-accent/10 border border-base-accent/25 text-[11px] text-base-text space-y-1">
                      <div className="font-bold flex items-center gap-1 text-base-accent">
                        ⚡ Generasi Otomatis dari BOM
                      </div>
                      <p className="text-[10.5px] text-base-muted leading-relaxed font-normal">
                        Memilih template ini akan otomatis membuat <strong className="text-base-text font-semibold">{selectedBomSummary.subAssyCount} Sub-Assembly</strong>, <strong className="text-base-text font-semibold">{selectedBomSummary.taskCount} Tasks</strong>, dan <strong className="text-base-text font-semibold">{selectedBomSummary.itemCount} Material Processing Items</strong> langsung di Project Spotlight!
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-base-muted italic font-normal">
                      Pilih BOM template untuk otomatis menghasilkan list material processing dan task per sub-assembly di Project Spotlight.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Status</label>
                  <select
                    value={projectsHook.pStatus}
                    onChange={(e: any) => projectsHook.setPStatus(e.target.value)}
                    className="select-field min-h-[44px]"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="field-label">Category</label>
                  <select
                    value={projectsHook.pCat}
                    onChange={(e: any) => projectsHook.setPCat(e.target.value)}
                    className="select-field min-h-[44px]"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Start Date</label>
                  <input
                    type="date"
                    value={projectsHook.pStart}
                    onChange={(e) => projectsHook.setPStart(e.target.value)}
                    className="input-field min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Due Date</label>
                  <input
                    type="date"
                    value={projectsHook.pDue}
                    onChange={(e) => projectsHook.setPDue(e.target.value)}
                    className="input-field min-h-[44px]"
                  />
                  <p className="text-[10px] text-base-muted italic">
                    Jika GA Number ditemukan sama dengan project lain, tanggal ini akan otomatis dihitung ulang berdasarkan durasi struktur yang disalin.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Location Workshop</label>
                  <select
                    value={projectsHook.pLoc}
                    onChange={(e: any) => projectsHook.setPLoc(e.target.value)}
                    className="select-field min-h-[44px]"
                  >
                    {locationOptions.map(loc => (
                      <option key={loc.key} value={loc.key}>{loc.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="field-label">Budget Hours</label>
                  <input
                    type="number" inputMode="decimal" pattern="[0-9]*"
                    value={projectsHook.pBudgetHours}
                    onChange={(e) => projectsHook.setPBudgetHours(e.target.value)}
                    placeholder="None"
                    min="0"
                    step="any"
                    className="input-field min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">Target Month</label>
                  <input
                    type="month"
                    value={projectsHook.pTargetMonth}
                    onChange={(e) => {
                      const val = e.target.value;
                      projectsHook.setPTargetMonth(val);
                      // Proactively auto-suggest project start date to be the month before the target month if start date is currently empty
                      if (val && !projectsHook.pStart) {
                        const [year, month] = val.split('-').map(Number);
                        const targetDateObj = new Date(year, month - 1, 1);
                        // Subtract one month
                        targetDateObj.setMonth(targetDateObj.getMonth() - 1);
                        const suggestedYStr = targetDateObj.getFullYear();
                        const suggestedMStr = String(targetDateObj.getMonth() + 1).padStart(2, '0');
                        projectsHook.setPStart(`${suggestedYStr}-${suggestedMStr}-01`);
                      }
                    }}
                    className="input-field min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Priority Level</label>
                  <select
                    value={projectsHook.pPriority || 'medium'}
                    onChange={(e: any) => projectsHook.setPPriority(e.target.value)}
                    className="select-field min-h-[44px]"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>
              </div>
              <p className="field-hint -mt-2">
                Reference month for Dashboard. Start date defaults to the month prior if blank.
              </p>

              <div className="space-y-1">
                <label className="field-label">Scope Notes</label>
                <textarea
                  value={projectsHook.pNotes}
                  onChange={(e) => projectsHook.setPNotes(e.target.value)}
                  className="textarea-field h-16"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {projectsHook.editingProjectId && can('deleteProject') ? (
                <button
                  type="button"
                  onClick={() => projectsHook.deleteProjectDetails(projectsHook.editingProjectId!)}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => projectsHook.setProjectFormOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="button" onClick={projectsHook.saveProjectForm} className="btn btn-primary btn-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assembly Add/Edit Form Modal */}
      {projectsHook.assemblyFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-base-surface border border-base-border2 rounded-2xl shadow-modal w-full max-w-xl max-h-[95vh] overflow-y-auto p-8 space-y-6 animate-in zoom-in-95 ease-out duration-150 relative">
            <div className="flex items-center gap-3 border-b border-base-border pb-4">
              <div className="h-10 w-10 rounded-lg bg-base-accent-dim border border-base-accent/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-base-accent" />
              </div>
              <div>
                <h3 className="font-condensed font-extrabold uppercase text-lg text-base-text tracking-wide leading-none">
                  {projectsHook.editingAssemblyId ? 'Edit Sub-Assembly' : 'Configure Sub-Assembly'}
                </h3>
                <p className="text-[11px] font-medium text-base-muted2 uppercase tracking-wider mt-1">Specify assembly parameters and initial tasks</p>
              </div>
            </div>

            <div className="space-y-5 text-sm font-semibold">
              <div className="space-y-1.5">
                <label className="text-[11px] font-condensed font-extrabold uppercase tracking-wider text-base-accent block">Assembly Name</label>
                <MasterDataAutocomplete
                  category="subAssembly"
                  value={projectsHook.aName}
                  onChange={(val) => projectsHook.setAName(val)}
                  placeholder="e.g. Electrical Panels wiring, framing structural..."
                  entries={masterDataEntries}
                  className="w-full px-4 py-2.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-sm font-semibold text-base-text transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Start Date</label>
                  <input
                    type="date"
                    value={projectsHook.aStart}
                    onChange={(e) => projectsHook.setAStart(e.target.value)}
                    className="w-full px-4 py-2 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-sm font-semibold text-base-text transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Finish Date</label>
                  <input
                    type="date"
                    value={projectsHook.aFinish}
                    onChange={(e) => projectsHook.setAFinish(e.target.value)}
                    className="w-full px-4 py-2 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-sm font-semibold text-base-text transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Budget Hours Limit</label>
                <input
                  type="number" inputMode="decimal" pattern="[0-9]*"
                  value={projectsHook.aBudgetHours}
                  onChange={(e) => projectsHook.setABudgetHours(e.target.value)}
                  placeholder="None (e.g. 40)"
                  min="0"
                  step="any"
                  className="w-full px-4 py-2.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-sm font-bold text-base-text transition-all"
                />
              </div>

              {!projectsHook.editingAssemblyId && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-t border-base-border/30 pt-4">
                    <label className="text-[11px] font-condensed font-extrabold uppercase tracking-wider text-base-accent">Initial Tasks Draft List</label>
                    <button
                      type="button"
                      onClick={projectsHook.addDraftTaskNode}
                      className="px-3 py-1 rounded bg-base-accent/10 border border-base-accent/20 text-base-accent hover:bg-base-accent hover:text-white leading-none text-[10px] uppercase font-condensed font-extrabold cursor-pointer transition-all"
                    >
                      + Add Task Inside Draft
                    </button>
                  </div>

                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {projectsHook.aTasksDraft.length === 0 ? (
                      <div className="text-xs text-base-muted italic text-center py-4 bg-base-surface2 border border-dashed border-base-border rounded-xl">
                        No draft tasks added yet. Click &quot;Add Task&quot; above to seed initial targets.
                      </div>
                    ) : (
                      projectsHook.aTasksDraft.map((t, idx) => (
                        <div key={t.id} className="flex flex-col gap-2.5 p-3.5 bg-base-surface2 border border-base-border hover:border-base-border2 rounded-xl relative transition-all shadow-xs">
                          <div className="flex gap-2 items-center">
                            <span className="text-[11px] font-condensed font-extrabold text-base-muted bg-base-border/30 h-5 w-5 rounded-full flex items-center justify-center shrink-0">{idx + 1}</span>
                            <input
                              type="text" inputMode="text"
                              value={t.name}
                              onChange={(e) => projectsHook.handleDraftTaskField(idx, 'name', e.target.value)}
                              placeholder="Task name... (e.g. Frame alignment check)"
                              className="flex-1 px-3 py-1.5 min-h-[44px] bg-base-bg border border-base-border rounded-lg text-xs font-semibold focus:border-base-accent outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => projectsHook.removeDraftTaskNode(idx)}
                              className="p-1.5 text-base-red hover:bg-base-red/10 rounded-lg cursor-pointer shrink-0 transition-colors"
                              title="Remove Task"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex gap-2.5 flex-wrap items-center">
                            <div className="flex items-center gap-1.5 bg-base-bg px-2 py-1 rounded-lg border border-base-border">
                              <span className="text-[9px] text-base-muted font-bold select-none uppercase tracking-wider font-condensed">Difficulty (1-20):</span>
                              <input
                                type="number" inputMode="decimal" pattern="[0-9]*"
                                min="1"
                                max="20"
                                value={typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  projectsHook.handleDraftTaskField(idx, 'difficulty', val);
                                }}
                                className="w-10 text-center bg-transparent border-0 outline-none text-xs text-base-text font-bold"
                              />
                            </div>
                            <div className="flex items-center gap-1" title="Start Date">
                              <span className="text-[9px] text-base-muted font-bold uppercase font-condensed">S:</span>
                              <input
                                type="date"
                                value={t.date || ''}
                                onChange={(e) => projectsHook.handleDraftTaskField(idx, 'date', e.target.value)}
                                className="px-2 py-1 min-h-[44px] bg-base-bg border border-base-border rounded-lg text-[10px] cursor-pointer text-base-text font-semibold outline-none focus:border-base-accent"
                              />
                            </div>
                            <div className="flex items-center gap-1" title="Finish Date">
                              <span className="text-[9px] text-emerald-500 font-bold uppercase font-condensed">F:</span>
                              <input
                                type="date"
                                value={t.finishDate || ''}
                                onChange={(e) => projectsHook.handleDraftTaskField(idx, 'finishDate', e.target.value)}
                                className="px-2 py-1 min-h-[44px] bg-base-bg border border-base-border rounded-lg text-[10px] cursor-pointer text-emerald-600 font-bold outline-none focus:border-base-accent"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-base-border/30 pt-4 mt-2">
              {projectsHook.editingAssemblyId && can('deleteAssembly') && projectsHook.targetAsmProjectId ? (
                <button
                  type="button"
                  onClick={() => { projectsHook.deleteAssemblyDetails(projectsHook.targetAsmProjectId!, projectsHook.editingAssemblyId!); projectsHook.setAssemblyFormOpen(false); }}
                  className="px-4 py-2 bg-base-red-dim border border-base-red/30 text-base-red hover:bg-base-red font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg hover:text-white transition-all cursor-pointer"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => projectsHook.setAssemblyFormOpen(false)} className="px-5 py-2 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all">Cancel</button>
                <button type="button" onClick={projectsHook.saveAssemblyForm} className="px-6 py-2 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all shadow-md">Save Assembly</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Modal */}
      {projectsHook.copyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel space-y-4">
            <h3 className="modal-title">Cloning project metadata</h3>
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="field-label">New Name</label>
                <input type="text" inputMode="text" value={projectsHook.copyName} onChange={(e) => projectsHook.setCopyName(e.target.value)} className="input-field min-h-[44px]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="field-label">New Start</label>
                  <input type="date" value={projectsHook.copyStart} onChange={(e) => projectsHook.setCopyStart(e.target.value)} className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">New Due</label>
                  <input type="date" value={projectsHook.copyDue} onChange={(e) => projectsHook.setCopyDue(e.target.value)} className="input-field min-h-[44px]" />
                </div>
              </div>
              <div className="bg-base-surface2 border border-base-border p-3.5 rounded-lg space-y-2">
                <label className="flex items-center gap-2 min-h-[44px] cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={projectsHook.copyAsm} onChange={(e) => projectsHook.setCopyAsm(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Clone sub-assemblies
                </label>
                <label className="flex items-center gap-2 min-h-[44px] cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={projectsHook.copyTasks} onChange={(e) => projectsHook.setCopyTasks(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Clone tasks details
                </label>
                <label className="flex items-center gap-2 min-h-[44px] cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={projectsHook.copyKeepClient} onChange={(e) => projectsHook.setCopyKeepClient(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Keep Work Order
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs pt-2">
              <button type="button" onClick={() => projectsHook.setCopyModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={projectsHook.confirmCopyMultiplier} className="btn btn-primary btn-sm">Clone</button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal Form Dialog */}
      {employeesHook.empModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel space-y-4 max-w-md">
            <h3 className="modal-title">
              {employeesHook.editingEmpId ? 'Modify Personnel' : 'Add Personnel'}
            </h3>
            <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="field-label">Full Name</label>
                  <input type="text" inputMode="text" value={employeesHook.empName} onChange={(e) => employeesHook.setEmpName(e.target.value)} placeholder="e.g. Budi Wijaya" className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Employee No</label>
                  <input type="text" inputMode="text" value={employeesHook.empNo} onChange={(e) => employeesHook.setEmpNo(e.target.value)} placeholder="e.g. 2110051" className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Shift</label>
                  <select value={employeesHook.shift} onChange={(e) => employeesHook.setShift(e.target.value)} className="select-field min-h-[44px]">
                    <option value="DAY SHIFT">DAY SHIFT</option>
                    <option value="NIGHT SHIFT">NIGHT SHIFT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="field-label">Position Role</label>
                  <input type="text" inputMode="text" value={employeesHook.empPosition} onChange={(e) => employeesHook.setEmpPosition(e.target.value)} placeholder="e.g. Fitter Class 1" className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Site Location</label>
                  <input type="text" inputMode="text" value={employeesHook.empLocation} onChange={(e) => employeesHook.setEmpLocation(e.target.value)} placeholder="e.g. Workshop 1, Batam" className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="field-label">Coordinator PPC</label>
                  <input type="text" inputMode="text" value={employeesHook.empCoordinator} onChange={(e) => employeesHook.setEmpCoordinator(e.target.value)} placeholder="e.g. Rizki PPC, Hasrad PPC" className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">Join Date</label>
                  <input type="date" value={employeesHook.joinDate} onChange={(e) => employeesHook.setJoinDate(e.target.value)} className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <label className="field-label">End of Contract (EOC)</label>
                  <input type="date" value={employeesHook.eoc} onChange={(e) => employeesHook.setEoc(e.target.value)} className="input-field min-h-[44px]" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="field-label">Employment Status</label>
                  <select value={employeesHook.employmentStatus} onChange={(e) => employeesHook.setEmploymentStatus(e.target.value)} className="select-field min-h-[44px]">
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="Finish Contract">Finish Contract</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs pt-2">
              <button type="button" onClick={() => employeesHook.setEmpModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={employeesHook.saveEmployeeForm} className="btn btn-primary btn-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Timesheet Modal Dialog viewport loader */}
      <TimesheetModal
        isOpen={timesheetsHook.timesheetModalOpen}
        onClose={() => timesheetsHook.setTimesheetModalOpen(false)}
        timesheetDate={timesheetsHook.timesheetDate}
        setTimesheetDate={timesheetsHook.setTimesheetDate}
        timesheets={timesheets}
        employees={employeesHook.employees}
        projects={projectsHook.projects}
        editingId={timesheetsHook.editingTsId}
        onSave={timesheetsHook.saveTimesheetsBulkImport}
      />

      {/* Project Spotlight Inspector */}
      <ErrorBoundary fallback={
        <div className="p-8 text-base-red text-red-500 font-bold">
          Failed to load project details. Please close and try again.
        </div>
      }>
        <SpotlightModal
          isOpen={projectsHook.spotlightOpen}
          onClose={() => projectsHook.setSpotlightOpen(false)}
          projectId={projectsHook.spotlightProjectId}
          projects={projects || projectsHook.projects}
          timesheets={timesheets}
          wireLogs={wireLogs}
          consumptionLogs={consumptionLogs}
          selectedMonth={selectedMonth}
          onEdit={(pid) => { projectsHook.setSpotlightOpen(false); projectsHook.openEditProjectForm(pid); }}
          onEditAssembly={(pid, aid) => { projectsHook.setSpotlightOpen(false); projectsHook.openAssemblyEditForm(pid, aid); }}
          onUpdateProject={(updatedProj, logParams) => {
            let nextProj = updatedProj;
            if (updatedProj.status !== 'completed' && calcPct(updatedProj) === 100) {
              nextProj = {
                ...updatedProj,
                status: 'completed' as any,
                completedDate: new Date().toISOString().slice(0, 10)
              };
            } else if (updatedProj.status === 'completed' && calcPct(updatedProj) < 100) {
              nextProj = {
                ...updatedProj,
                status: 'active' as any,
                completedDate: null
              };
            }
            setProjects(prev => prev.map(p => p.id === nextProj.id ? nextProj : p));
            saveItem('projects', nextProj);
            verifyMarkChanged();
            if (logParams) {
              logActivity(
                logParams.type,
                logParams.action,
                nextProj.id,
                nextProj.name,
                logParams.asmName,
                logParams.task,
                logParams.oldP,
                logParams.newP
              );
            }
          }}
          canUpdateTask={can('updateTask')}
          canAddTaskInline={can('addTaskInline')}
          canAddDifficulty={can('addDifficulty')}
          canDeleteTask={can('deleteTask')}
          currentUser={currentUser}
          canEditProjectParams={can('editProjectParams')}
          onOpenDepModal={(key) => { projectsHook.setDepModalRowKey(key); projectsHook.setDepModalOpen(true); }}
          onAddMaterialProcessing={onAddMaterialProcessing}
          onUpdateProcessingStage={onUpdateProcessingStage}
          onDeleteMaterialProcessing={onDeleteMaterialProcessing}
        />
      </ErrorBoundary>

      {/* Dependency Link Editor Modal */}
      <DepModal
        isOpen={projectsHook.depModalOpen}
        onClose={() => projectsHook.setDepModalOpen(false)}
        rowKey={projectsHook.depModalRowKey}
        projects={projectsHook.projects}
        onSave={projectsHook.saveDependenciesHandler}
        selectedMonth={selectedMonth}
      />

      {/* Custom Logout Confirmation Modal */}
      {authHook.logoutConfirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in animate-duration-200">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-full text-red-500 shrink-0">
                <LogOut className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1 select-none">
                <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">Confirm Log Out</h4>
                <p className="text-xs text-base-muted font-normal leading-relaxed">
                  Are you sure you want to end your session? Any unsaved project and manpower entries or edits may not be synced.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end text-xs pt-1">
              <button 
                type="button"
                onClick={() => authHook.setLogoutConfirmOpen(false)} 
                className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
              >
                Go Back
              </button>
              <button 
                type="button"
                onClick={authHook.executeLogout} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Yes, Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {authHook.changePasswordModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in animate-duration-200">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-base-border pb-3 select-none">
              <div className="p-2 bg-base-accent/10 rounded-full text-base-accent">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">Change Password</h4>
                <p className="text-[10px] text-base-muted font-normal uppercase tracking-wider">Update your account credentials</p>
              </div>
            </div>

            {authHook.changePasswordError && (
              <div className="p-2.5 text-xs bg-base-red-dim border border-base-red/25 rounded-lg text-base-red text-center font-semibold">
                {authHook.changePasswordError}
              </div>
            )}

            {authHook.changePasswordSuccess && (
              <div className="p-2.5 text-xs bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-500 text-center font-semibold">
                {authHook.changePasswordSuccess}
              </div>
            )}

            <form onSubmit={(e) => authHook.handleChangePasswordSubmit(e, logActivity)} className="space-y-3.5">
              <div className="space-y-1">
                <label className="field-label">Current Password</label>
                <input
                  type="password"
                  value={authHook.currentPasswordInput}
                  onChange={(e) => authHook.setCurrentPasswordInput(e.target.value)}
                  placeholder="Enter current password..."
                  required
                  className="input-field min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="field-label">New Password</label>
                <input
                  type="password"
                  value={authHook.newPasswordInput}
                  onChange={(e) => authHook.setNewPasswordInput(e.target.value)}
                  placeholder="At least 4 characters..."
                  required
                  className="input-field min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="field-label">Confirm New Password</label>
                <input
                  type="password"
                  value={authHook.confirmPasswordInput}
                  onChange={(e) => authHook.setConfirmPasswordInput(e.target.value)}
                  placeholder="Re-type new password..."
                  required
                  className="input-field min-h-[44px]"
                />
              </div>

              <div className="flex gap-2.5 justify-end text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    authHook.setChangePasswordModalOpen(false);
                    authHook.setCurrentPasswordInput('');
                    authHook.setNewPasswordInput('');
                    authHook.setConfirmPasswordInput('');
                    authHook.setChangePasswordError('');
                    authHook.setChangePasswordSuccess('');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in animate-duration-200">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-full text-red-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1 select-none">
                <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">{deleteConfirm.title}</h4>
                <p className="text-xs text-base-muted font-normal leading-relaxed">
                  {deleteConfirm.message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end text-xs pt-1">
              <button 
                type="button"
                onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))} 
                className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={deleteConfirm.onConfirm} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FormsAndModals;
