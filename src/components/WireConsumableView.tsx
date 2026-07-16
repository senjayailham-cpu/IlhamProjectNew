import React, { useState, useMemo } from 'react';
import { WireLog, Employee, Project, Assembly, User } from '../types';
import { Flame, Trash2, Search, Plus, Calendar, UserCheck, Folder, AlertCircle, TrendingUp, Sparkles, Filter, Download, Wrench } from 'lucide-react';
import { can } from '../utils/permissions';

interface WireConsumableViewProps {
  wireLogs: WireLog[];
  employees: Employee[];
  projects: Project[];
  currentUser: User;
  onAddWireLog: (newLog: Omit<WireLog, 'id'>) => void;
  onDeleteWireLog: (id: string) => void;
}

export default function WireConsumableView({
  wireLogs = [],
  employees = [],
  projects = [],
  currentUser,
  onAddWireLog,
  onDeleteWireLog
}: WireConsumableViewProps) {
  const canManageWireLog = can(currentUser, 'manageWireLog');
  const canDeleteWireLog = can(currentUser, 'deleteWireLog');

  // Local active states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
  const [selectedWelderFilter, setSelectedWelderFilter] = useState('');

  // Typing-to-search filter states for wire logs history
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [isProjectFilterFocused, setIsProjectFilterFocused] = useState(false);
  const [welderFilterSearch, setWelderFilterSearch] = useState('');
  const [isWelderFilterFocused, setIsWelderFilterFocused] = useState(false);

  // Form states
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState('');
  const [amountInputStr, setAmountInputStr] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Search states for typing selection
  const [welderSearch, setWelderSearch] = useState('');
  const [isWelderFocused, setIsWelderFocused] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [isProjectFocused, setIsProjectFocused] = useState(false);

  // Dynamic lists for the dropdowns
  const activeProjects = useMemo(() => {
    return projects.filter(p => !p.isArchived && p.status !== 'completed');
  }, [projects]);

  const selectedProjectObj = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const welderEmployees = useMemo(() => {
    // Return employees with a "welder" position first, or anyone as fallback
    const welderList = employees.filter(e => 
      e.position?.toLowerCase().includes('welder') || 
      e.position?.toLowerCase().includes('fit')
    );
    return welderList.length > 0 ? welderList : employees;
  }, [employees]);

  const selectedWelderObj = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const filteredWelders = useMemo(() => {
    const q = welderSearch.toLowerCase().trim();
    if (!q) return welderEmployees;
    return welderEmployees.filter(emp => 
      emp.name.toLowerCase().includes(q) || 
      (emp.position && emp.position.toLowerCase().includes(q))
    );
  }, [welderEmployees, welderSearch]);

  const filteredProjectsForSelect = useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    if (!q) return activeProjects;
    return activeProjects.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.client && p.client.toLowerCase().includes(q))
    );
  }, [activeProjects, projectSearch]);

  const selectedProjectFilterObj = useMemo(() => {
    return projects.find(p => p.id === selectedProjectFilter);
  }, [projects, selectedProjectFilter]);

  const selectedWelderFilterObj = useMemo(() => {
    return employees.find(e => e.id === selectedWelderFilter);
  }, [employees, selectedWelderFilter]);

  const filteredProjectsForFilter = useMemo(() => {
    const q = projectFilterSearch.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.client && p.client.toLowerCase().includes(q))
    );
  }, [projects, projectFilterSearch]);

  const filteredWeldersForFilter = useMemo(() => {
    const q = welderFilterSearch.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(q) || 
      (emp.position && emp.position.toLowerCase().includes(q))
    );
  }, [employees, welderFilterSearch]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedEmployeeId) {
      setFormError('Please select a welder personnel.');
      return;
    }
    if (!selectedProjectId) {
      setFormError('Please select an active project.');
      return;
    }
    if (!selectedAssemblyId) {
      setFormError('Please select a target sub-assembly.');
      return;
    }
    const amountVal = parseFloat(amountInputStr);
    if (isNaN(amountVal) || amountVal <= 0) {
      setFormError('Please key in a valid amount of wire in kilograms (e.g. 5.5).');
      return;
    }

    const welder = employees.find(emp => emp.id === selectedEmployeeId);
    const proj = projects.find(p => p.id === selectedProjectId);
    const asm = proj?.assemblies.find(a => a.id === selectedAssemblyId);

    if (!welder || !proj || !asm) {
      setFormError('Associated entities not found or mismatch.');
      return;
    }

    onAddWireLog({
      date: dateStr,
      welderId: welder.id,
      welderName: welder.name,
      projectId: proj.id,
      projectName: proj.name,
      assemblyId: asm.id,
      assemblyName: asm.name,
      amountKg: amountVal,
      notes: remarks.trim() || undefined
    });

    // Reset states
    setAmountInputStr('');
    setRemarks('');
    setSelectedEmployeeId('');
    setSelectedProjectId('');
    setSelectedAssemblyId('');
    setWelderSearch('');
    setProjectSearch('');
    setFormSuccess(`Consumable wire (${amountVal} kg) logged successfully for ${welder.name}!`);
    setTimeout(() => setFormSuccess(''), 4000);
  };

  // Filter logs for displaying
  const filteredLogs = useMemo(() => {
    return wireLogs.filter(log => {
      const matchSearch = searchQuery.trim() === '' || 
        log.welderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.assemblyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.notes && log.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchProj = !selectedProjectFilter || log.projectId === selectedProjectFilter;
      const matchWelder = !selectedWelderFilter || log.welderId === selectedWelderFilter;

      return matchSearch && matchProj && matchWelder;
    });
  }, [wireLogs, searchQuery, selectedProjectFilter, selectedWelderFilter]);

  // Aggregate stats
  const totalWireKg = useMemo(() => {
    return wireLogs.reduce((sum, log) => sum + log.amountKg, 0);
  }, [wireLogs]);

  const uniqueWeldersWithWire = useMemo(() => {
    const list = new Set(wireLogs.map(log => log.welderId));
    return list.size;
  }, [wireLogs]);

  // Top consumers aggregation
  const welderTotals = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    wireLogs.forEach(l => {
      if (!map[l.welderId]) {
        map[l.welderId] = { name: l.welderName, amount: 0, count: 0 };
      }
      map[l.welderId].amount += l.amountKg;
      map[l.welderId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [wireLogs]);

  // Subassembly totals aggregation
  const projectAssemblyTotals = useMemo(() => {
    const map: Record<string, { projName: string; asmName: string; amount: number }> = {};
    wireLogs.forEach(l => {
      const key = `${l.projectId}-${l.assemblyId}`;
      if (!map[key]) {
        map[key] = { projName: l.projectName, asmName: l.assemblyName, amount: 0 };
      }
      map[key].amount += l.amountKg;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [wireLogs]);

  // Export current list to CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Welder Name', 'Project', 'Sub-Assembly', 'Amount (kg)', 'Remarks/Notes'];
    const rows = filteredLogs.map(l => [
      l.date,
      `"${l.welderName.replace(/"/g, '""')}"`,
      `"${l.projectName.replace(/"/g, '""')}"`,
      `"${l.assemblyName.replace(/"/g, '""')}"`,
      l.amountKg,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `austin_wire_consumables_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Banner header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/15 p-6 rounded-2xl shadow-card relative overflow-hidden backdrop-blur-md">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/25 rounded-xl border border-amber-500/40 text-amber-500 animate-pulse-highlight">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-condensed font-black uppercase text-2xl tracking-wider text-base-text flex items-center gap-2">
                Wire Consumables Registry
              </h1>
              <p className="text-xs text-base-muted2 font-medium">
                Track and monitor daily welding wire consumption logged to task-specific sub-assemblies.
              </p>
            </div>
          </div>
        </div>
        
        {/* Dynamic Highlights / Stat Counters */}
        <div className="flex grid grid-cols-2 gap-3 shrink-0">
          <div className="bg-base-surface2 border border-base-border p-3.5 rounded-xl min-w-[125px]">
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Total Consumed</span>
            <span className="text-xl font-mono font-black text-amber-600 dark:text-amber-400">{totalWireKg.toFixed(1)} <span className="font-sans text-xs font-semibold">kg</span></span>
          </div>
          <div className="bg-base-surface2 border border-base-border p-3.5 rounded-xl min-w-[125px]">
            <span className="block text-[10px] font-condensed font-bold text-base-muted uppercase tracking-widest">Active Welders</span>
            <span className="text-xl font-mono font-black text-amber-500 dark:text-amber-300">{uniqueWeldersWithWire} <span className="font-sans text-xs font-semibold">men</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Entry Form */}
        {canManageWireLog && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-base-surface border border-base-border p-5 rounded-2xl shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-base-border pb-3">
                <Plus className="h-4 w-4 text-amber-500" />
                <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider">Key In Daily Wire Taken</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
                
                {/* DATE */}
                <div className="space-y-1.5">
                  <label className="text-base-muted2 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-base-muted" />
                    <span>Date Taken</span>
                  </label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-3.5 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none focus:ring-1 focus:ring-amber-500 transition-all font-semibold"
                    required
                  />
                </div>

                {/* WELDER DROPDOWN */}
                <div className="space-y-1.5 relative">
                  <label className="text-base-muted2 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-base-muted" />
                    <span>Welder / Fitter (Type to search)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type name or position to search..."
                      value={isWelderFocused ? welderSearch : (selectedWelderObj ? `${selectedWelderObj.name} ${selectedWelderObj.position ? `(${selectedWelderObj.position})` : ''}` : '')}
                      onChange={(e) => {
                        setWelderSearch(e.target.value);
                        if (!e.target.value.trim()) {
                          setSelectedEmployeeId('');
                        }
                      }}
                      onFocus={() => {
                        setIsWelderFocused(true);
                        setWelderSearch('');
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setIsWelderFocused(false);
                        }, 250);
                      }}
                      className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none focus:ring-1 focus:ring-amber-500 transition-all font-semibold text-xs"
                      required
                    />
                    {selectedEmployeeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeId('');
                          setWelderSearch('');
                        }}
                        className="absolute right-2.5 top-2 text-[10px] bg-base-surface3 hover:bg-red-500/10 hover:text-red-500 px-1.5 py-0.5 rounded border border-base-border text-base-muted font-bold transition-all"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {isWelderFocused && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border">
                      {filteredWelders.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-base-muted italic">No matching personnel found</div>
                      ) : (
                        filteredWelders.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onMouseDown={() => {
                              setSelectedEmployeeId(emp.id);
                              setWelderSearch(emp.name);
                              setIsWelderFocused(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex flex-col"
                          >
                            <span className="font-bold">{emp.name}</span>
                            {emp.position && <span className="text-[10px] opacity-85">{emp.position} {emp.location ? `• ${emp.location}` : ''}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* PROJECT DROPDOWN */}
                <div className="space-y-1.5 relative">
                  <label className="text-base-muted2 flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-base-muted" />
                    <span>Project (Type to search)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type client or project name..."
                      value={isProjectFocused ? projectSearch : (selectedProjectObj ? `[${selectedProjectObj.client}] ${selectedProjectObj.name}` : '')}
                      onChange={(e) => {
                        setProjectSearch(e.target.value);
                        if (!e.target.value.trim()) {
                          setSelectedProjectId('');
                          setSelectedAssemblyId('');
                        }
                      }}
                      onFocus={() => {
                        setIsProjectFocused(true);
                        setProjectSearch('');
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setIsProjectFocused(false);
                        }, 250);
                      }}
                      className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none focus:ring-1 focus:ring-amber-500 transition-all font-semibold text-xs"
                      required
                    />
                    {selectedProjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProjectId('');
                          setSelectedAssemblyId('');
                          setProjectSearch('');
                        }}
                        className="absolute right-2.5 top-2 text-[10px] bg-base-surface3 hover:bg-red-500/10 hover:text-red-500 px-1.5 py-0.5 rounded border border-base-border text-base-muted font-bold transition-all"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {isProjectFocused && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border">
                      {filteredProjectsForSelect.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-base-muted italic">No matching projects found</div>
                      ) : (
                        filteredProjectsForSelect.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => {
                              setSelectedProjectId(p.id);
                              setSelectedAssemblyId(''); // Reset sub-assembly
                              setProjectSearch(`[${p.client}] ${p.name}`);
                              setIsProjectFocused(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex flex-col"
                          >
                            <span className="font-bold">{p.name}</span>
                            <span className="text-[10px] opacity-85">Client: {p.client}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* SUB-ASSEMBLY DROPDOWN (CONNECTED TO THE PROJECT) */}
                <div className="space-y-1.5">
                  <label className="text-base-muted2 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-base-muted" />
                    <span>Sub-Assembly</span>
                  </label>
                  <select
                    value={selectedAssemblyId}
                    onChange={(e) => setSelectedAssemblyId(e.target.value)}
                    disabled={!selectedProjectId}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                  >
                    <option value="" className="bg-base-surface2 text-base-text font-sans">-- Select Connected Sub-Assembly --</option>
                    {selectedProjectObj?.assemblies.map(asm => (
                      <option key={asm.id} value={asm.id} className="bg-base-surface2 text-base-text font-sans">
                        {asm.name}
                      </option>
                    ))}
                  </select>
                  {!selectedProjectId && (
                    <span className="text-[10px] text-base-muted italic block mt-0.5">Select a project first to load connected sub-assemblies.</span>
                  )}
                </div>

                {/* AMOUNT IN KILOGRAMS */}
                <div className="space-y-1.5">
                  <label className="text-base-muted2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-base-muted" />
                    <span>Amount Taken (in kg)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.05"
                      placeholder="e.g. 5.5"
                      value={amountInputStr}
                      onChange={(e) => setAmountInputStr(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none font-mono font-black focus:ring-1 focus:ring-amber-500 text-sm"
                      required
                    />
                    <div className="absolute right-3.5 top-2 text-xs font-bold text-base-muted uppercase select-none">kg</div>
                  </div>
                </div>

                {/* REMARKS */}
                <div className="space-y-1.5">
                  <label className="text-base-muted2">Remarks / Wire Type (Optional)</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. AWS A5.18 ER70S-6 spool, joint reinforcement..."
                    rows={2}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-base-text outline-none focus:ring-1 focus:ring-amber-500 transition-all text-xs"
                  />
                </div>

                {/* ERRORS / SUCCESS */}
                {formError && (
                  <div className="flex items-start gap-2 text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed font-semibold">{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="flex items-start gap-2 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg animate-fade-in">
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed font-semibold">{formSuccess}</span>
                  </div>
                )}

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 dark:bg-amber-500 hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  Submit Wire Log
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Column 2 & 3: History & Aggregated Analysis */}
        <div className={`${canManageWireLog ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6`}>

          {/* Aggregated Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Top Welders Card */}
            <div className="bg-base-surface border border-base-border p-4 rounded-xl space-y-3">
              <h3 className="text-[11px] font-condensed font-extrabold uppercase text-base-muted tracking-wider flex items-center gap-1.5 pb-2 border-b border-base-border">
                <UserCheck className="h-3.5 w-3.5 text-amber-500" />
                <span>Top Welders (By Kg Taken)</span>
              </h3>
              {welderTotals.length === 0 ? (
                <span className="text-[11px] text-base-muted italic block py-2">No consumables recorded yet.</span>
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-none pr-1">
                  {welderTotals.slice(0, 4).map((item, index) => (
                    <div key={item.name + index} className="flex items-center justify-between text-xs py-1">
                      <span className="text-base-text font-semibold">{item.name}</span>
                      <span className="font-mono font-black text-base-accent">
                        {item.amount.toFixed(1)} kg <span className="text-[10px] font-sans font-medium text-base-muted">({item.count} logs)</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-Assembly Cumulative Totals */}
            <div className="bg-base-surface border border-base-border p-4 rounded-xl space-y-3">
              <h3 className="text-[11px] font-condensed font-extrabold uppercase text-base-muted tracking-wider flex items-center gap-1.5 pb-2 border-b border-base-border">
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                <span>Cumulative Wire per Sub-Assembly</span>
              </h3>
              {projectAssemblyTotals.length === 0 ? (
                <span className="text-[11px] text-base-muted italic block py-2">No consumables recorded yet.</span>
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-none pr-1">
                  {projectAssemblyTotals.slice(0, 4).map((item, index) => (
                    <div key={item.asmName + index} className="text-xs space-y-0.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-base-text font-bold truncate max-w-[180px]">{item.asmName}</span>
                        <span className="font-mono font-black text-base-accent">{item.amount.toFixed(1)} kg</span>
                      </div>
                      <span className="text-[9px] text-base-muted block truncate max-w-[240px]">{item.projName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Toolbar row */}
          <div className="bg-base-surface border border-base-border p-5 rounded-2xl shadow-card space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-base-border pb-3.5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-amber-500" />
                <span className="font-condensed font-extrabold uppercase text-xs text-base-text tracking-wider">Wire Logs History</span>
                <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-md">
                  {filteredLogs.length} Records
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={filteredLogs.length === 0}
                  className="px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-text transition-all cursor-pointer font-condensed font-bold text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-xs disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Log CSV</span>
                </button>
              </div>
            </div>

            {/* Filters dashboard inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Search text inputs */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-base-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search welder, project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:border-amber-400 text-base-text font-medium"
                />
              </div>

              {/* Project select filter */}
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter by Project (Type)..."
                    value={isProjectFilterFocused ? projectFilterSearch : (selectedProjectFilterObj ? `[${selectedProjectFilterObj.client}] ${selectedProjectFilterObj.name}` : '')}
                    onChange={(e) => {
                      setProjectFilterSearch(e.target.value);
                      if (!e.target.value.trim()) {
                        setSelectedProjectFilter('');
                      }
                    }}
                    onFocus={() => {
                      setIsProjectFilterFocused(true);
                      setProjectFilterSearch('');
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setIsProjectFilterFocused(false);
                      }, 250);
                    }}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:border-amber-400 text-base-text font-semibold placeholder:font-normal"
                  />
                  {selectedProjectFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectFilter('');
                        setProjectFilterSearch('');
                      }}
                      className="absolute right-2.5 top-2 text-[10px] bg-base-surface3 hover:bg-red-500/10 hover:text-red-500 px-1.5 py-0.5 rounded border border-base-border text-base-muted font-bold transition-all"
                    >
                      All
                    </button>
                  )}
                </div>

                {isProjectFilterFocused && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border">
                    <button
                      type="button"
                      onMouseDown={() => {
                        setSelectedProjectFilter('');
                        setProjectFilterSearch('');
                        setIsProjectFilterFocused(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors font-bold text-base-muted"
                    >
                      -- All Projects --
                    </button>
                    {filteredProjectsForFilter.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-base-muted italic">No matching projects found</div>
                    ) : (
                      filteredProjectsForFilter.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedProjectFilter(p.id);
                            setProjectFilterSearch(`[${p.client}] ${p.name}`);
                            setIsProjectFilterFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex flex-col"
                        >
                          <span className="font-bold">{p.name}</span>
                          <span className="text-[10px] opacity-85">Client: {p.client}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Welder employee filter */}
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter by Welder (Type)..."
                    value={isWelderFilterFocused ? welderFilterSearch : (selectedWelderFilterObj ? `${selectedWelderFilterObj.name} ${selectedWelderFilterObj.position ? `(${selectedWelderFilterObj.position})` : ''}` : '')}
                    onChange={(e) => {
                      setWelderFilterSearch(e.target.value);
                      if (!e.target.value.trim()) {
                        setSelectedWelderFilter('');
                      }
                    }}
                    onFocus={() => {
                      setIsWelderFilterFocused(true);
                      setWelderFilterSearch('');
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setIsWelderFilterFocused(false);
                      }, 250);
                    }}
                    className="w-full px-3 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs outline-none focus:border-amber-400 text-base-text font-semibold placeholder:font-normal"
                  />
                  {selectedWelderFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWelderFilter('');
                        setWelderFilterSearch('');
                      }}
                      className="absolute right-2.5 top-2 text-[10px] bg-base-surface3 hover:bg-red-500/10 hover:text-red-500 px-1.5 py-0.5 rounded border border-base-border text-base-muted font-bold transition-all"
                    >
                      All
                    </button>
                  )}
                </div>

                {isWelderFilterFocused && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-30 divide-y divide-base-border">
                    <button
                      type="button"
                      onMouseDown={() => {
                        setSelectedWelderFilter('');
                        setWelderFilterSearch('');
                        setIsWelderFilterFocused(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors font-bold text-base-muted"
                    >
                      -- All Welders --
                    </button>
                    {filteredWeldersForFilter.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-base-muted italic">No matching personnel found</div>
                    ) : (
                      filteredWeldersForFilter.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedWelderFilter(emp.id);
                            setWelderFilterSearch(emp.name);
                            setIsWelderFilterFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500 hover:text-slate-950 transition-colors flex flex-col"
                        >
                          <span className="font-bold">{emp.name}</span>
                          {emp.position && <span className="text-[10px] opacity-85">{emp.position} {emp.location ? `• ${emp.location}` : ''}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* List Table of Logs */}
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] rounded-xl border border-base-border bg-base-surface">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-base-surface2">
                  <tr className="bg-base-surface2 text-base-muted font-condensed font-bold uppercase tracking-wider border-b border-base-border">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Welder</th>
                    <th className="px-4 py-2.5">Connected Project / Sub-Assembly</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Remarks</th>
                    <th className="px-4 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-border text-base-text text-[11px] font-semibold">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-base-muted italic">
                        No consumable wire logs match current filters or search query.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-base-surface2/40 transition-colors">
                        {/* Date column */}
                        <td className="px-4 py-1.5 font-mono text-base-muted whitespace-nowrap">
                          {log.date}
                        </td>
                        {/* Welder Name column */}
                        <td className="px-4 py-1.5 text-base-text font-extrabold whitespace-nowrap">
                          {log.welderName}
                        </td>
                        {/* Connected Sub-Assembly column */}
                        <td className="px-4 py-1.5 space-y-0.5">
                          <span className="block font-bold text-base-text">{log.assemblyName}</span>
                          <span className="block text-[10px] text-base-muted font-medium truncate max-w-[200px]" title={log.projectName}>
                            {log.projectName}
                          </span>
                        </td>
                        {/* Amount in kg column */}
                        <td className="px-4 py-1.5 text-right font-mono font-black text-base-accent whitespace-nowrap">
                          {log.amountKg.toFixed(2)} kg
                        </td>
                        {/* Remarks column */}
                        <td className="px-4 py-1.5 max-w-[140px] truncate text-base-muted font-normal italic" title={log.notes || 'No remarks'}>
                          {log.notes || '-'}
                        </td>
                        {/* Action delete column */}
                        <td className="px-4 py-1.5 text-center">
                          {canDeleteWireLog && (
                            <button
                              onClick={() => onDeleteWireLog(log.id)}
                              className="p-1 px-1.5 rounded bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all cursor-pointer inline-flex items-center"
                              title="Delete wire consumable entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
