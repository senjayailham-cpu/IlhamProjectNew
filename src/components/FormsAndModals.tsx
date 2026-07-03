import React, { lazy, Suspense } from 'react';
import { BookOpen, LogOut, Save, Trash2, Key } from 'lucide-react';
import TimesheetModal from './TimesheetModal';
import DepModal from './DepModal';
import { can as canUtil } from '../utils/permissions';
import { calcPct } from '../utils/projectUtils';
import { useFirestore } from '../hooks';
import { ErrorBoundary } from './ErrorBoundary';
import { MaterialConsumptionLog } from '../types';

const SpotlightModal = lazy(() => import('./SpotlightModal'));

interface FormsAndModalsProps {
  authHook: ReturnType<typeof import('../hooks/useAuth').useAuth>;
  projectsHook: ReturnType<typeof import('../hooks/useProjects').useProjects>;
  employeesHook: ReturnType<typeof import('../hooks/useEmployees').useEmployees>;
  timesheetsHook: ReturnType<typeof import('../hooks/useTimesheets').useTimesheets>;
  deleteConfirm: { isOpen: boolean; title: string; message: string; onConfirm: () => void };
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  timesheets: any[];
  wireLogs: any[];
  consumptionLogs?: MaterialConsumptionLog[];
  setProjects: React.Dispatch<React.SetStateAction<any[]>>;
  verifyMarkChanged: () => void;
  logActivity: any;
  selectedMonth?: string;
}

export function FormsAndModals({
  authHook,
  projectsHook,
  employeesHook,
  timesheetsHook,
  deleteConfirm,
  setDeleteConfirm,
  timesheets,
  wireLogs,
  consumptionLogs = [],
  setProjects,
  verifyMarkChanged,
  logActivity,
  selectedMonth,
}: FormsAndModalsProps) {
  const { currentUser } = authHook;
  const can = (perm: any) => canUtil(currentUser, perm);
  const { saveItem } = useFirestore();

  return (
    <>
      {/* Project Form Modal */}
      {projectsHook.projectFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150 relative">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">
              {projectsHook.editingProjectId ? 'Modify Project' : 'Configure Project'}
            </h3>
            
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Project Name</label>
                <input
                  type="text"
                  value={projectsHook.pName}
                  onChange={(e) => projectsHook.setPName(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Work Order Code</label>
                <input
                  type="text"
                  value={projectsHook.pWorkOrder}
                  onChange={(e) => projectsHook.setPWorkOrder(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none uppercase font-mono font-bold tracking-wide"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Status</label>
                  <select
                    value={projectsHook.pStatus}
                    onChange={(e: any) => projectsHook.setPStatus(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Category</label>
                  <select
                    value={projectsHook.pCat}
                    onChange={(e: any) => projectsHook.setPCat(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                  >
                    <option value="tray">Tray</option>
                    <option value="nontray">Non-Tray</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Start Date</label>
                  <input
                    type="date"
                    value={projectsHook.pStart}
                    onChange={(e) => projectsHook.setPStart(e.target.value)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Due Date</label>
                  <input
                    type="date"
                    value={projectsHook.pDue}
                    onChange={(e) => projectsHook.setPDue(e.target.value)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Location Workshop</label>
                  <select
                    value={projectsHook.pLoc}
                    onChange={(e: any) => projectsHook.setPLoc(e.target.value)}
                    className="w-full px-2.5 py-2 bg-base-bg border border-base-border rounded outline-none font-bold"
                  >
                    <option value="workshop1">Workshop 1</option>
                    <option value="workshop2">Workshop 2</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Budget Hours</label>
                  <input
                    type="number"
                    value={projectsHook.pBudgetHours}
                    onChange={(e) => projectsHook.setPBudgetHours(e.target.value)}
                    placeholder="None"
                    min="0"
                    step="any"
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Target Month</label>
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
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none font-bold text-base-text"
                />
                <p className="text-[9px] text-base-muted font-normal leading-tight">
                  Reference month for Dashboard. Start date defaults to the month prior if blank.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Scope Notes</label>
                <textarea
                  value={projectsHook.pNotes}
                  onChange={(e) => projectsHook.setPNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded outline-none h-16 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {projectsHook.editingProjectId && can('deleteProject') ? (
                <button
                  type="button"
                  onClick={() => projectsHook.deleteProjectDetails(projectsHook.editingProjectId!)}
                  className="px-2.5 py-1.5 bg-base-red-dim border border-base-red/30 text-base-red hover:bg-base-red font-condensed font-bold text-xs uppercase tracking-wider rounded-lg hover:text-white"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => projectsHook.setProjectFormOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
                <button type="button" onClick={projectsHook.saveProjectForm} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Save</button>
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
                <input
                  type="text"
                  value={projectsHook.aName}
                  onChange={(e) => projectsHook.setAName(e.target.value)}
                  placeholder="e.g. Electrical Panels wiring, framing structural..."
                  className="w-full px-4 py-2.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-sm font-semibold text-base-text transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  type="number"
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
                              type="text"
                              value={t.name}
                              onChange={(e) => projectsHook.handleDraftTaskField(idx, 'name', e.target.value)}
                              placeholder="Task name... (e.g. Frame alignment check)"
                              className="flex-1 px-3 py-1.5 bg-base-bg border border-base-border rounded-lg text-xs font-semibold focus:border-base-accent outline-none"
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
                                type="number"
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
                                className="px-2 py-1 bg-base-bg border border-base-border rounded-lg text-[10px] cursor-pointer text-base-text font-semibold outline-none focus:border-base-accent"
                              />
                            </div>
                            <div className="flex items-center gap-1" title="Finish Date">
                              <span className="text-[9px] text-emerald-500 font-bold uppercase font-condensed">F:</span>
                              <input
                                type="date"
                                value={t.finishDate || ''}
                                onChange={(e) => projectsHook.handleDraftTaskField(idx, 'finishDate', e.target.value)}
                                className="px-2 py-1 bg-base-bg border border-base-border rounded-lg text-[10px] cursor-pointer text-emerald-600 font-bold outline-none focus:border-base-accent"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150 relative">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">Cloning project metadata</h3>
            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Name</label>
                <input type="text" value={projectsHook.copyName} onChange={(e) => projectsHook.setCopyName(e.target.value)} className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Start</label>
                  <input type="date" value={projectsHook.copyStart} onChange={(e) => projectsHook.setCopyStart(e.target.value)} className="w-full px-3 py-1.5 bg-base-bg border-base-border border rounded outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Due</label>
                  <input type="date" value={projectsHook.copyDue} onChange={(e) => projectsHook.setCopyDue(e.target.value)} className="w-full px-3 py-1.5 bg-base-bg border-base-border border rounded outline-none" />
                </div>
              </div>
              <div className="bg-base-surface2 border border-base-border p-3.5 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={projectsHook.copyAsm} onChange={(e) => projectsHook.setCopyAsm(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Clone sub-assemblies
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={projectsHook.copyTasks} onChange={(e) => projectsHook.setCopyTasks(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Clone tasks details
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold font-condensed uppercase text-xs tracking-wider text-base-muted2">
                  <input type="checkbox" checked={projectsHook.copyKeepClient} onChange={(e) => projectsHook.setCopyKeepClient(e.target.checked)} className="h-3.5 w-3.5 accent-base-accent" /> Keep Work Order
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs pt-2">
              <button type="button" onClick={() => projectsHook.setCopyModalOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
              <button type="button" onClick={projectsHook.confirmCopyMultiplier} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Clone</button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal Form Dialog */}
      {employeesHook.empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 ease-out duration-150">
            <h3 className="font-condensed font-extrabold uppercase text-base text-base-text border-b border-base-border pb-2">
              {employeesHook.editingEmpId ? 'Modify Personnel' : 'Add Personnel'}
            </h3>
            <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Full Name</label>
                  <input type="text" value={employeesHook.empName} onChange={(e) => employeesHook.setEmpName(e.target.value)} placeholder="e.g. Budi Wijaya" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Employee No</label>
                  <input type="text" value={employeesHook.empNo} onChange={(e) => employeesHook.setEmpNo(e.target.value)} placeholder="e.g. 2110051" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Shift</label>
                  <select value={employeesHook.shift} onChange={(e) => employeesHook.setShift(e.target.value)} className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none text-base-text">
                    <option value="DAY SHIFT">DAY SHIFT</option>
                    <option value="NIGHT SHIFT">NIGHT SHIFT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Position Role</label>
                  <input type="text" value={employeesHook.empPosition} onChange={(e) => employeesHook.setEmpPosition(e.target.value)} placeholder="e.g. Fitter Class 1" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Site Location</label>
                  <input type="text" value={employeesHook.empLocation} onChange={(e) => employeesHook.setEmpLocation(e.target.value)} placeholder="e.g. Workshop 1, Batam" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Coordinator PPC</label>
                  <input type="text" value={employeesHook.empCoordinator} onChange={(e) => employeesHook.setEmpCoordinator(e.target.value)} placeholder="e.g. Rizki PPC, Hasrad PPC" className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Join Date</label>
                  <input type="date" value={employeesHook.joinDate} onChange={(e) => employeesHook.setJoinDate(e.target.value)} className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none text-base-text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">End of Contract (EOC)</label>
                  <input type="date" value={employeesHook.eoc} onChange={(e) => employeesHook.setEoc(e.target.value)} className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none text-base-text" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Employment Status</label>
                  <select value={employeesHook.employmentStatus} onChange={(e) => employeesHook.setEmploymentStatus(e.target.value)} className="w-full px-3 py-2 bg-base-bg border border-base-border rounded outline-none text-base-text">
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="Finish Contract">Finish Contract</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-xs pt-2">
              <button type="button" onClick={() => employeesHook.setEmpModalOpen(false)} className="px-3 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
              <button type="button" onClick={employeesHook.saveEmployeeForm} className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Save</button>
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
      <Suspense fallback={null}>
        <ErrorBoundary fallback={
          <div className="p-8 text-base-red text-red-500 font-bold">
            Failed to load project details. Please close and try again.
          </div>
        }>
          <SpotlightModal
            isOpen={projectsHook.spotlightOpen}
            onClose={() => projectsHook.setSpotlightOpen(false)}
            projectId={projectsHook.spotlightProjectId}
            projects={projectsHook.projects}
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
          />
        </ErrorBoundary>
      </Suspense>

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
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Current Password</label>
                <input
                  type="password"
                  value={authHook.currentPasswordInput}
                  onChange={(e) => authHook.setCurrentPasswordInput(e.target.value)}
                  placeholder="Enter current password..."
                  required
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded text-xs focus:border-base-accent outline-none text-base-text font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">New Password</label>
                <input
                  type="password"
                  value={authHook.newPasswordInput}
                  onChange={(e) => authHook.setNewPasswordInput(e.target.value)}
                  placeholder="At least 4 characters..."
                  required
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded text-xs focus:border-base-accent outline-none text-base-text font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Confirm New Password</label>
                <input
                  type="password"
                  value={authHook.confirmPasswordInput}
                  onChange={(e) => authHook.setConfirmPasswordInput(e.target.value)}
                  placeholder="Re-type new password..."
                  required
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded text-xs focus:border-base-accent outline-none text-base-text font-medium"
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
                  className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-base-accent hover:bg-base-accent2 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
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
