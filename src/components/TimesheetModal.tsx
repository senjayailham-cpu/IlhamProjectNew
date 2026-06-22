import React, { useState, useEffect, useRef } from 'react';
import { TimesheetEntry, Employee, Project, Assembly } from '../types';
import { esc } from '../utils/projectUtils';
import { ClipboardCheck, Loader2 } from 'lucide-react';

interface TimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  timesheetDate: string;
  setTimesheetDate: (date: string) => void;
  timesheets: TimesheetEntry[];
  employees: Employee[];
  projects: Project[];
  editingId?: string | null;
  onSave: (inputs: any[]) => void;
}

interface RowInput {
  empId: string;
  empName: string;
  position: string;
  workOrder: string;
  assemblyId: string;
  totalHours: string;
  status: 'present' | 'late' | 'absent' | 'leave';
  desc: string;
  included: boolean;
}

export default function TimesheetModal({
  isOpen,
  onClose,
  timesheetDate,
  setTimesheetDate,
  timesheets,
  employees,
  projects,
  editingId,
  onSave
}: TimesheetModalProps) {
  const [selectedCoord, setSelectedCoord] = useState<string>('');
  const [globalWo, setGlobalWo] = useState<string>('');
  const [globalAsm, setGlobalAsm] = useState<string>('');
  const [globalHrs, setGlobalHrs] = useState<string>('');
  const [globalStatus, setGlobalStatus] = useState<string>('');

  const [rowInputs, setRowInputs] = useState<RowInput[]>([]);

  // Autocomplete dropdown controllers
  const [showGlobalDropdown, setShowGlobalDropdown] = useState<boolean>(false);
  const [globalDropdownMatches, setGlobalDropdownMatches] = useState<Project[]>([]);
  const [focusedGlobalIdx, setGlobalFocusedIdx] = useState<number>(-1);

  const [rowDropdownOpen, setRowDropdownOpen] = useState<Record<string, boolean>>({});
  const [rowDropdownMatches, setRowDropdownMatches] = useState<Record<string, Project[]>>({});
  const [focusedRowIdx, setRowFocusedIdx] = useState<Record<string, number>>({});

  // Reset inputs when modal state opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingId) {
      // Single log edit
      const targetTs = timesheets.find(x => x.id === editingId);
      if (targetTs) {
        const emp = employees.find(x => x.id === targetTs.empId);
        const coord = (emp?.coordinator || '').trim();
        setSelectedCoord(coord);
        setGlobalWo(targetTs.workOrder || '');

        const rows: RowInput[] = [
          {
            empId: targetTs.empId,
            empName: targetTs.empName,
            position: emp?.position || 'Crew',
            workOrder: targetTs.workOrder || '',
            assemblyId: targetTs.assemblyId || '',
            totalHours: String(targetTs.totalHours),
            status: targetTs.status,
            desc: targetTs.desc || '',
            included: true
          }
        ];
        setRowInputs(rows);
      }
    } else {
      setSelectedCoord('');
      setGlobalWo('');
      setGlobalAsm('');
      setGlobalHrs('');
      setGlobalStatus('');
      setRowInputs([]);
    }
  }, [isOpen, editingId]);

  // Load manpower automatically when selectedCoordinator updates
  useEffect(() => {
    if (!isOpen || editingId || !selectedCoord) return;

    const matchedEmps = employees.filter(e => (e.coordinator || '').trim() === selectedCoord);
    const existingTimesheets = timesheets.filter(ts => ts.date === timesheetDate);

    const initialRows: RowInput[] = matchedEmps.map(e => {
      // Pre-fill existing entries if they logged hours today
      const pastLog = existingTimesheets.find(ts => ts.empId === e.id);
      return {
        empId: e.id,
        empName: e.name,
        position: e.position || 'Fitter',
        workOrder: pastLog?.workOrder || '',
        assemblyId: pastLog?.assemblyId || '',
        totalHours: pastLog ? String(pastLog.totalHours) : '',
        status: pastLog ? pastLog.status : 'present',
        desc: pastLog?.desc || '',
        included: true
      };
    });

    setRowInputs(initialRows);
  }, [selectedCoord, isOpen, timesheetDate]);

  if (!isOpen) return null;

  const validCoordinators = [...new Set(employees.map(e => (e.coordinator || '').trim()).filter(Boolean))].sort();

  // Autocomplete Work Orders (clients) globally
  const handleGlobalWoInput = (val: string) => {
    setGlobalWo(val);
    const q = val.toLowerCase();
    const activeProjects = projects.filter(p => p.client && p.status !== 'completed');
    const matches = q ? activeProjects.filter(p => (p.client + ' ' + p.name).toLowerCase().includes(q)) : activeProjects;
    setGlobalDropdownMatches(matches);
    setGlobalFocusedIdx(-1);
    setShowGlobalDropdown(matches.length > 0);
  };

  const selectGlobalWoValue = (client: string) => {
    setGlobalWo(client);
    setShowGlobalDropdown(false);
    setGlobalAsm(''); // Clear intermediate assembly selection
  };

  // Autocomplete Work order inside specific row
  const handleRowWoInput = (idx: number, val: string) => {
    const updated = [...rowInputs];
    updated[idx].workOrder = val;
    setRowInputs(updated);

    const q = val.toLowerCase();
    const activeProjects = projects.filter(p => p.client && p.status !== 'completed');
    const matches = q ? activeProjects.filter(p => (p.client + ' ' + p.name).toLowerCase().includes(q)) : activeProjects;

    const empId = updated[idx].empId;
    setRowDropdownMatches(prev => ({ ...prev, [empId]: matches }));
    setRowDropdownOpen(prev => ({ ...prev, [empId]: matches.length > 0 }));
    setRowFocusedIdx(prev => ({ ...prev, [empId]: -1 }));
  };

  const selectRowWoValue = (idx: number, client: string) => {
    const updated = [...rowInputs];
    updated[idx].workOrder = client;
    updated[idx].assemblyId = ''; // Reset sub-assembly
    setRowInputs(updated);

    const empId = updated[idx].empId;
    setRowDropdownOpen(prev => ({ ...prev, [empId]: false }));
  };

  // Bulk set action helpers
  const applyWoToAll = () => {
    if (!globalWo.trim()) return;
    setRowInputs(prev => prev.map(row => ({ ...row, workOrder: globalWo.trim(), assemblyId: '' })));
  };

  const applyAsmToAll = () => {
    if (!globalAsm) return;
    setRowInputs(prev => prev.map(row => ({ ...row, assemblyId: globalAsm })));
  };

  const applyHrsToAll = () => {
    if (!globalHrs) return;
    setRowInputs(prev => prev.map(row => ({ ...row, totalHours: globalHrs })));
  };

  const applyStatusToAll = () => {
    if (!globalStatus) return;
    setRowInputs(prev => prev.map(row => ({ ...row, status: globalStatus as any })));
  };

  const handleRowCheckToggle = (idx: number, checked: boolean) => {
    const updated = [...rowInputs];
    updated[idx].included = checked;
    setRowInputs(updated);
  };

  const handleCheckAllToggle = (checked: boolean) => {
    setRowInputs(prev => prev.map(row => ({ ...row, included: checked })));
  };

  const handleRowFieldChange = (idx: number, field: keyof RowInput, val: string) => {
    const updated = [...rowInputs];
    (updated[idx] as any)[field] = val;
    setRowInputs(updated);
  };

  // Compile and return matching assemblies for global selection
  const globalProj = projects.find(p => p.client.toLowerCase() === globalWo.trim().toLowerCase());
  const globalAsmList = (globalProj && globalProj.assemblies) || [];

  const handleSaveAll = () => {
    const checked = rowInputs.filter(r => r.included && r.workOrder.trim() && parseFloat(r.totalHours) > 0);
    if (editingId) {
      if (!checked.length) {
        alert('Hours or Work Order mapping is missing on the modified row.');
        return;
      }
    } else {
      if (!checked.length) {
        alert('No files included which contain mapped work orders or completed hour logs.');
        return;
      }
    }

    const payload = checked.map(r => {
      // Find matching assembly descriptor name
      const proj = projects.find(p => p.client.toLowerCase() === r.workOrder.trim().toLowerCase());
      const asm = proj && (proj.assemblies || []).find(a => a.id === r.assemblyId);
      return {
        empId: r.empId,
        empName: r.empName,
        workOrder: r.workOrder.trim(),
        assemblyId: r.assemblyId,
        assemblyName: asm ? asm.name : '',
        totalHours: parseFloat(r.totalHours),
        status: r.status,
        desc: r.desc.trim()
      };
    });

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in select-none">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border flex items-center justify-between flex-shrink-0 bg-linear-to-r from-base-accent-dim/30 to-transparent">
          <div>
            <h3 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
              {editingId ? 'Edit Timesheet' : 'Bulk Timesheet Entry'}
            </h3>
            <p className="text-xs text-base-muted mt-0.5" id="ts-modal-sub">
              {editingId ? 'Edit single employee day schedule log' : 'Select a coordinator to populate active workforce'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer font-bold text-sm">✕</button>
        </div>

        {/* Global Toolbar Panel */}
        <div className="p-4 bg-base-surface2 border-b border-base-border flex-shrink-0 flex items-end gap-4 flex-wrap">
          {/* Coordinator Dropdown */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Coordinator</label>
            <select
              value={selectedCoord}
              onChange={(e) => setSelectedCoord(e.target.value)}
              disabled={!!editingId}
              className="px-3 py-2 bg-base-bg text-base-text text-xs rounded border border-base-border focus:border-base-accent outline-none font-semibold cursor-pointer"
            >
              <option value="">— Select Coordinator —</option>
              {validCoordinators.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Timesheet Date selection picker replace Apply To All */}
          <div className="flex flex-col gap-1 w-52">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-[#9b1c2e] font-extrabold">Timesheet Date</label>
            <input
              type="date"
              value={timesheetDate}
              onChange={(e) => setTimesheetDate(e.target.value)}
              disabled={!!editingId}
              className="px-3 py-1.5 bg-base-bg text-base-text text-xs rounded border border-base-border focus:border-base-accent outline-none font-semibold cursor-pointer"
            />
          </div>
        </div>

        {/* Spreadsheet Area (Table grid content scrollable) */}
        <div className="flex-1 overflow-auto p-0">
          {rowInputs.length === 0 ? (
            <div className="text-center p-12 text-base-muted flex flex-col items-center justify-center">
              <ClipboardCheck className="h-10 w-10 text-base-border mb-3 animate-pulse" />
              <p className="text-sm font-semibold">Ready to draft timesheets. Select a coordinator to populate manpower list.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted sticky top-0 z-30">
                  <th className="py-2.5 px-4 scroll-m-1 min-w-[170px]">Name / Position</th>
                  <th className="py-2.5 px-3 min-w-[200px] text-base-blue">Work Order</th>
                  <th className="py-2.5 px-3 min-w-[180px] text-base-blue">Sub-Assembly</th>
                  <th className="py-2.5 px-3 w-20 text-center">Hours</th>
                  <th className="py-2.5 px-3 w-28">Status</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Description</th>
                  <th className="py-2.5 px-4 w-12 text-center">
                    {!editingId && (
                      <input
                        type="checkbox"
                        checked={rowInputs.every(r => r.included)}
                        onChange={(e) => handleCheckAllToggle(e.target.checked)}
                        className="h-3.5 w-3.5 accent-base-accent rounded cursor-pointer"
                        title="Include/Exclude All Rows"
                      />
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border/40 text-xs">
                {rowInputs.map((row, i) => {
                  const safeId = row.empId.replace(/[^a-z0-9]/gi, '_');
                  const targetProj = projects.find(p => p.client.toLowerCase() === row.workOrder.trim().toLowerCase());
                  const assemblyList = (targetProj && targetProj.assemblies) || [];

                  // Row matches autocomplete
                  const matches = rowDropdownMatches[row.empId] || [];
                  const showDropdown = !!rowDropdownOpen[row.empId];

                  return (
                    <tr
                      key={row.empId}
                      className={`hover:bg-base-surface2/25 transition-colors ${
                        row.included ? '' : 'opacity-40 line-through select-none grayscale'
                      }`}
                    >
                      {/* Name / Position */}
                      <td className="py-2.5 px-4 font-semibold text-base-text">
                        <div>
                          <div>{row.empName}</div>
                          <div className="text-[10px] text-base-muted font-normal mt-0.5">{row.position}</div>
                        </div>
                      </td>

                      {/* Work order autocompleter */}
                      <td className="py-2.5 px-3 relative">
                        <input
                          type="text"
                          value={row.workOrder}
                          disabled={!row.included}
                          onChange={(e) => handleRowWoInput(i, e.target.value)}
                          onFocus={() => handleRowWoInput(i, row.workOrder)}
                          placeholder="Type or select WO..."
                          className="w-full px-2.5 py-1 bg-base-bg text-base-blue border border-base-blue/20 hover:border-base-blue rounded text-xs font-condensed font-extrabold tracking-wide outline-none"
                        />

                        {showDropdown && (
                          <div className="absolute top-10 left-3 right-3 max-h-36 overflow-y-auto bg-base-surface border border-base-border rounded shadow-elevated z-50">
                            {matches.map((p, pIdx) => (
                              <div
                                key={p.id}
                                onMouseDown={() => selectRowWoValue(i, p.client)}
                                className="px-2.5 py-1.5 text-xs flex gap-2 border-b border-base-border/30 hover:bg-base-surface2/60 cursor-pointer"
                              >
                                <span className="font-condensed font-extrabold text-base-blue">{p.client}</span>
                                <span className="text-base-muted truncate">{p.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Sub assemblies */}
                      <td className="py-2.5 px-3">
                        <select
                          value={row.assemblyId}
                          disabled={!row.included}
                          onChange={(e) => handleRowFieldChange(i, 'assemblyId', e.target.value)}
                          className="w-full px-2 py-1 bg-base-bg text-base-blue border border-base-blue/20 rounded font-condensed font-bold text-xs outline-none cursor-pointer"
                        >
                          <option value="">— None —</option>
                          {assemblyList.map(asm => (
                            <option key={asm.id} value={asm.id}>{asm.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Hours */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={row.totalHours}
                          disabled={!row.included}
                          onChange={(e) => handleRowFieldChange(i, 'totalHours', e.target.value)}
                          placeholder="—"
                          min="0"
                          max="24"
                          step="0.5"
                          className="w-full px-1.5 py-1 bg-base-bg text-base-accent border border-base-border rounded text-center text-xs font-condensed font-extrabold outline-none"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <select
                          value={row.status}
                          disabled={!row.included}
                          onChange={(e) => handleRowFieldChange(i, 'status', e.target.value)}
                          className="w-full px-2 py-1 bg-base-bg text-base-text border border-base-border rounded text-xs font-condensed font-bold outline-none cursor-pointer"
                        >
                          <option value="present">Present</option>
                          <option value="late">Late</option>
                          <option value="absent">Absent</option>
                          <option value="leave">Leave</option>
                        </select>
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={row.desc}
                          disabled={!row.included}
                          onChange={(e) => handleRowFieldChange(i, 'desc', e.target.value)}
                          placeholder="What did they do today?"
                          className="w-full px-2 py-1 bg-base-bg text-base-text border border-base-border rounded text-xs outline-none"
                        />
                      </td>

                      {/* Row selection check box */}
                      <td className="py-2.5 px-4 text-center">
                        {!editingId && (
                          <input
                            type="checkbox"
                            checked={row.included}
                            onChange={(e) => handleRowCheckToggle(i, e.target.checked)}
                            className="h-3.5 w-3.5 accent-base-accent rounded cursor-pointer"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-base-border flex items-center justify-between flex-shrink-0 bg-base-surface2 text-xs">
          <div className="text-base-muted font-condensed font-bold uppercase tracking-wider text-xs">
            {rowInputs.length > 0
              ? `${rowInputs.filter(r => r.included && r.workOrder.trim() && parseFloat(r.totalHours) > 0).length} log rows verified to submit`
              : '—'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
            <button
              onClick={handleSaveAll}
              disabled={rowInputs.length === 0}
              className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{editingId ? 'Save Entry' : 'Submit All Logs'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
