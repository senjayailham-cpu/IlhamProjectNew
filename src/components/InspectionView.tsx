import React, { useState } from 'react';
import { Project, InspectionRequest, UserRoleType } from '../types';
import { 
  ClipboardCheck, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  User as UserIcon, 
  ArrowRight,
  MessageSquare,
  FileSpreadsheet,
  Check,
  RotateCcw
} from 'lucide-react';

interface InspectionViewProps {
  projects: Project[];
  inspections: InspectionRequest[];
  currentUser: { id: string; name: string; role: UserRoleType } | null;
  onAddInspection: (ins: Omit<InspectionRequest, 'id' | 'rfiNo'>) => void;
  onUpdateInspectionStatus: (
    id: string, 
    status: InspectionRequest['status'], 
    comments?: string, 
    assignedInspector?: string, 
    punchList?: string
  ) => void;
  onDeleteInspection?: (id: string) => void;
}

export default function InspectionView({
  projects,
  inspections,
  currentUser,
  onAddInspection,
  onUpdateInspectionStatus,
  onDeleteInspection
}: InspectionViewProps) {
  // Query filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Form states for creating RFI
  const [rfiFormOpen, setRfiFormOpen] = useState(false);
  const [formProjectId, setFormProjectId] = useState('');
  const [formAssemblyId, setFormAssemblyId] = useState('');
  const [formType, setFormType] = useState<InspectionRequest['inspectionType']>('Fit-up');
  const [formTargetDate, setFormTargetDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [formRComments, setFormRComments] = useState('');

  // Selected Detail RFI modal state
  const [selectedRfi, setSelectedRfi] = useState<InspectionRequest | null>(null);
  
  // QC Decision states
  const [showQcApprovalForm, setShowQcApprovalForm] = useState(false);
  const [showQcRejectForm, setShowQcRejectForm] = useState(false);
  
  const [qcComments, setQcComments] = useState('');
  const [qcInspector, setQcInspector] = useState(currentUser?.name || '');
  const [qcPunchlist, setQcPunchlist] = useState('');

  // Derive assemblies based on selected project in form
  const selectedFormProject = projects.find(p => p.id === formProjectId);
  const formAssemblies = selectedFormProject?.assemblies || [];

  // Allowed to create: Admin, Manager, Coordinator, Project Control
  const canRequest = currentUser && ['admin', 'manager', 'coordinator', 'project control'].includes(currentUser.role);
  // Allowed to inspect: Admin, Manager, Quality Control
  const canInspect = currentUser && ['admin', 'manager', 'quality control'].includes(currentUser.role);

  // Filter requests
  const filteredRequests = inspections.filter(r => {
    const matchesSearch = 
      r.rfiNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.assemblyName && r.assemblyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.requestedBy.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProject = !selectedProjectFilter || r.projectId === selectedProjectFilter;
    const matchesType = !selectedTypeFilter || r.inspectionType === selectedTypeFilter;
    const matchesStatus = !selectedStatusFilter || r.status === selectedStatusFilter;

    return matchesSearch && matchesProject && matchesType && matchesStatus;
  });

  // Calculate statistics
  const totalCount = inspections.length;
  const pendingCount = inspections.filter(r => r.status === 'Requested').length;
  const approvedCount = inspections.filter(r => r.status === 'Approved').length;
  const rejectedCount = inspections.filter(r => r.status === 'Rejected / Punchlist').length;

  const handleSubmitRfi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId) {
      alert('Please select a project.');
      return;
    }
    const proj = projects.find(p => p.id === formProjectId);
    if (!proj) return;

    let subAsmName = '';
    if (formAssemblyId) {
      const asm = proj.assemblies.find(a => a.id === formAssemblyId);
      if (asm) {
        subAsmName = asm.name;
      }
    }

    onAddInspection({
      projectId: formProjectId,
      projectName: proj.name,
      assemblyId: formAssemblyId || undefined,
      assemblyName: subAsmName || undefined,
      inspectionType: formType,
      status: 'Requested',
      requestedBy: currentUser?.name || 'Anonymous',
      requestedById: currentUser?.id || 'unknown',
      requestedDate: new Date().toISOString().slice(0, 10),
      targetDate: formTargetDate,
      rcomments: formRComments.trim()
    });

    // Reset Form
    setFormProjectId('');
    setFormAssemblyId('');
    setFormType('Fit-up');
    setFormRComments('');
    setRfiFormOpen(false);
  };

  const handleApplyQcApproval = (rfiId: string) => {
    onUpdateInspectionStatus(
      rfiId,
      'Approved',
      qcComments.trim(),
      qcInspector.trim() || currentUser?.name || 'QC Inspector'
    );
    // Reset states
    const updated = inspections.find(ins => ins.id === rfiId);
    if (updated) {
      setSelectedRfi({
        ...updated,
        status: 'Approved',
        comments: qcComments.trim(),
        assignedInspector: qcInspector.trim() || currentUser?.name || 'QC Inspector',
        inspectedDate: new Date().toISOString().slice(0, 10),
        inspectedBy: currentUser?.name || 'QC Inspector'
      });
    } else {
      setSelectedRfi(null);
    }
    setQcComments('');
    setShowQcApprovalForm(false);
  };

  const handleApplyQcReject = (rfiId: string) => {
    onUpdateInspectionStatus(
      rfiId,
      'Rejected / Punchlist',
      qcComments.trim(),
      qcInspector.trim() || currentUser?.name || 'QC Inspector',
      qcPunchlist.trim()
    );
    // Reset states
    const updated = inspections.find(ins => ins.id === rfiId);
    if (updated) {
      setSelectedRfi({
        ...updated,
        status: 'Rejected / Punchlist',
        comments: qcComments.trim(),
        assignedInspector: qcInspector.trim() || currentUser?.name || 'QC Inspector',
        punchList: qcPunchlist.trim(),
        inspectedDate: new Date().toISOString().slice(0, 10),
        inspectedBy: currentUser?.name || 'QC Inspector'
      });
    } else {
      setSelectedRfi(null);
    }
    setQcComments('');
    setQcPunchlist('');
    setShowQcRejectForm(false);
  };

  const handleResubmitRfi = (rfiId: string) => {
    onUpdateInspectionStatus(
      rfiId,
      'Requested',
      'Ready for re-inspection after punchlist correction.',
      currentUser?.name || 'Coordinator'
    );
    alert('RFI re-submitted successfully to QC queue!');
    setSelectedRfi(null);
  };

  return (
    <div className="space-y-6 px-1 py-2 sm:px-4">
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-border/40 pb-4">
        <div>
          <h1 className="text-xl font-condensed font-black uppercase text-base-text tracking-wide flex items-center gap-2.5">
            <ClipboardCheck className="text-base-accent w-6 h-6" />
            Request For <span className="text-base-accent">Inspection</span> (RFI)
          </h1>
          <p className="text-xs text-base-muted mt-1 leading-relaxed">
            Manage Quality Control milestones, register inspection sign-offs, and clear punchlists for structural sub-assemblies.
          </p>
        </div>

        {canRequest && (
          <button
            onClick={() => setRfiFormOpen(true)}
            className="flex items-center justify-center gap-2.5 px-4 py-2 bg-base-accent hover:bg-base-accent/95 text-white font-condensed font-bold uppercase text-xs tracking-wider rounded-lg transition-all shadow-md self-start sm:self-center"
          >
            <Plus className="w-4 h-4 text-white" />
            File New RFI
          </button>
        )}
      </div>

      {/* Numerical Metrics Summary Widget */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-base-surface border border-base-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-base-surface3 border border-base-border flex items-center justify-center text-base-text">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Total RFIs</div>
            <div className="text-2xl font-condensed font-black text-base-text leading-none mt-1">{totalCount}</div>
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Pending QC</div>
            <div className="text-2xl font-condensed font-black text-amber-500 leading-none mt-1">{pendingCount}</div>
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Approved / Passed</div>
            <div className="text-2xl font-condensed font-black text-emerald-500 leading-none mt-1">{approvedCount}</div>
          </div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#9b1c2e]/10 border border-[#9b1c2e]/20 flex items-center justify-center text-[#9b1c2e]">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Punchlist / Rejected</div>
            <div className="text-2xl font-condensed font-black text-[#9b1c2e] leading-none mt-1">{rejectedCount}</div>
          </div>
        </div>
      </div>

      {/* Query Filter and Selection controls */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-base-border/30 pb-2">
          <Filter className="w-3.5 h-3.5 text-base-muted" />
          <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Filter Inspections</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Text Search input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-3.5 h-3.5 text-base-muted" />
            </span>
            <input
              type="text"
              placeholder="Search RFI, Project, assembly..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-base-bg border border-base-border rounded-lg outline-none text-xs text-base-text transition-all focus:border-base-accent"
            />
          </div>

          {/* Project drop selection */}
          <select
            value={selectedProjectFilter}
            onChange={e => setSelectedProjectFilter(e.target.value)}
            className="px-3 py-1.5 bg-base-bg border border-base-border rounded-lg outline-none text-xs font-medium text-base-text cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.client})</option>
            ))}
          </select>

          {/* Inspection type dropdown */}
          <select
            value={selectedTypeFilter}
            onChange={e => setSelectedTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-base-bg border border-base-border rounded-lg outline-none text-xs font-medium text-base-text cursor-pointer"
          >
            <option value="">All Inspection Types</option>
            <option value="Fit-up">Fit-up check</option>
            <option value="Welding Visual">Welding Visual inspection</option>
            <option value="Dimensional Check">Dimensional Check</option>
            <option value="NDT">Non-Destructive Testing (NDT)</option>
            <option value="Painting / Blasting">Painting & Blasting coating</option>
            <option value="Final Inspection">Final visual inspection</option>
            <option value="FAT">Factory Acceptance Test (FAT)</option>
            <option value="Other">Other special parameters</option>
          </select>

          {/* Status selection */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-base-bg border border-base-border rounded-lg outline-none text-xs font-medium text-base-text cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Requested">Pending Inspection</option>
            <option value="Approved">Approved / Passed</option>
            <option value="Rejected / Punchlist">Rejected / Punchlist</option>
            <option value="Draft">Draft</option>
          </select>
        </div>

        {/* Clear Filters Helper Row */}
        {(searchQuery || selectedProjectFilter || selectedTypeFilter || selectedStatusFilter) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedProjectFilter('');
                setSelectedTypeFilter('');
                setSelectedStatusFilter('');
              }}
              className="text-[10px] font-condensed font-extrabold text-base-accent uppercase flex items-center gap-1 hover:opacity-85"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* RFI List Grid/Table Output */}
      {filteredRequests.length === 0 ? (
        <div className="bg-base-surface border border-base-border border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center">
          <div className="p-3 bg-base-surface3 rounded-full border border-base-border text-base-muted mb-3">
            <ClipboardCheck className="w-6 h-6 opacity-40" />
          </div>
          <h3 className="font-condensed font-bold text-sm tracking-wide text-base-text uppercase">No inspections found</h3>
          <p className="text-xs text-base-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search filters or create a new Request for Inspection if you have coordinator access.
          </p>
        </div>
      ) : (
        <div className="bg-base-surface border border-base-border rounded-xl shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold tracking-wider text-base-muted uppercase select-none">
                  <th className="py-3 px-4">RFI Code</th>
                  <th className="py-3 px-4">Project & Assembly</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Requested By & Date</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border/30 text-xs">
                {filteredRequests.map(r => {
                  return (
                    <tr 
                      key={r.id} 
                      onClick={() => setSelectedRfi(r)}
                      className="hover:bg-base-surface3/60 transition-colors cursor-pointer"
                    >
                      {/* RFI No Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-base-text">
                        {r.rfiNo}
                      </td>

                      {/* Project & Assembly Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-base-text line-clamp-1">{r.projectName}</div>
                        {r.assemblyName && (
                          <div className="text-[10px] text-base-muted mt-0.5 font-medium flex items-center gap-1">
                            <span className="px-1 py-0.5 rounded bg-base-surface3 border border-base-border/40 text-[9px]">
                              SUB-ASM
                            </span>
                            {r.assemblyName}
                          </div>
                        )}
                      </td>

                      {/* Inspection Type Badge */}
                      <td className="py-3.5 px-4 font-condensed font-extrabold uppercase text-[10px] tracking-wider text-base-accent">
                        {r.inspectionType}
                      </td>

                      {/* Requested By Display */}
                      <td className="py-3.5 px-4 text-base-muted2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3 h-3 text-base-muted" />
                          <span>{r.requestedBy}</span>
                        </div>
                        <div className="text-[10px] text-base-muted text-[10px] mt-0.5 pl-4.5">{r.requestedDate}</div>
                      </td>

                      {/* Target/Due Inspection Date */}
                      <td className="py-3.5 px-4 font-mono text-base-text">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-base-muted" />
                          <span>{r.targetDate}</span>
                        </div>
                      </td>

                      {/* Dynamic Status Badges */}
                      <td className="py-3.5 px-4">
                        {r.status === 'Approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-condensed font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Passed / Approved
                          </span>
                        )}
                        {r.status === 'Requested' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-condensed font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending QC
                          </span>
                        )}
                        {r.status === 'Rejected / Punchlist' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-condensed font-extrabold uppercase bg-[#9b1c2e]/10 text-[#9b1c2e] border border-[#9b1c2e]/20 tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#9b1c2e]" />
                            Punchlist Rework
                          </span>
                        )}
                        {r.status === 'Draft' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-condensed font-extrabold uppercase bg-base-surface3 text-base-muted border border-base-border/50 tracking-wider">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Simple Chevron Arrow triggers details */}
                      <td className="py-3.5 px-4 text-right">
                        <button className="p-1 px-2.5 font-condensed font-bold uppercase text-[10px] tracking-wider text-base-accent bg-base-surface3 hover:bg-base-accent hover:text-white rounded transition-all">
                          Overview
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacking Cards View */}
          <div className="block md:hidden divide-y divide-base-border/30">
            {filteredRequests.map(r => (
              <div 
                key={r.id} 
                onClick={() => setSelectedRfi(r)}
                className="p-4 space-y-3 hover:bg-base-surface2 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-base-text">{r.rfiNo}</span>
                  <div>
                    {r.status === 'Approved' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase border border-emerald-500/20 tracking-wider">
                        PASSED
                      </span>
                    )}
                    {r.status === 'Requested' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase border border-amber-500/20 tracking-wider">
                        PENDING QC
                      </span>
                    )}
                    {r.status === 'Rejected / Punchlist' && (
                      <span className="px-2 py-0.5 rounded bg-[#9b1c2e]/10 text-[#9b1c2e] text-[8px] font-black uppercase border border-[#9b1c2e]/20 tracking-wider">
                        REWORK REQUIRED
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-base-text">{r.projectName}</h4>
                  {r.assemblyName && (
                    <div className="text-[10px] text-base-muted mt-0.5">Asm: {r.assemblyName}</div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-base-muted pt-1">
                  <div className="flex items-center gap-1 font-condensed font-bold text-base-accent uppercase">
                    {r.inspectionType}
                  </div>
                  <div>Target: <span className="font-bold font-mono text-base-text">{r.targetDate}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Create New Request for Inspection Form */}
      {rfiFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-surface border border-base-border rounded-xl w-full max-w-lg shadow-card overflow-hidden">
            {/* Header */}
            <div className="bg-base-surface2 px-5 py-4 border-b border-base-border flex justify-between items-center">
              <h3 className="font-condensed font-black text-sm uppercase text-base-text tracking-wide flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-base-accent" />
                Register inspection request
              </h3>
              <button 
                onClick={() => setRfiFormOpen(false)}
                className="text-base-muted hover:text-base-text text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitRfi} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 block">
                  Select Project <span className="text-base-accent font-sans">*</span>
                </label>
                <select
                  required
                  value={formProjectId}
                  onChange={e => {
                    setFormProjectId(e.target.value);
                    setFormAssemblyId('');
                  }}
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded-lg text-xs outline-none focus:border-base-accent font-medium text-base-text"
                >
                  <option value="">-- Choose active project --</option>
                  {projects.filter(p => p.status !== 'completed').map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.client})</option>
                  ))}
                </select>
              </div>

              {/* Assembly selection (Filtered on selected project) */}
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 block">
                  Target Assembly (Optional)
                </label>
                <select
                  disabled={!formProjectId}
                  value={formAssemblyId}
                  onChange={e => setFormAssemblyId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded-lg text-xs outline-none focus:border-base-accent disabled:opacity-50 text-base-text"
                >
                  <option value="">-- Complete project block visual --</option>
                  {formAssemblies.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Inspection Category */}
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 block">
                    Inspection Class <span className="text-base-accent font-sans">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded-lg text-xs outline-none font-medium text-base-text"
                  >
                    <option value="Fit-up">Fit-up</option>
                    <option value="Welding Visual">Welding Visual</option>
                    <option value="Dimensional Check">Dimensional Check</option>
                    <option value="NDT">Non-Destructive Test (NDT)</option>
                    <option value="Painting / Blasting">Painting & Coating</option>
                    <option value="Final Inspection">Final visual</option>
                    <option value="FAT">Factory Acceptance (FAT)</option>
                    <option value="Other">Other customized check</option>
                  </select>
                </div>

                {/* Target inspection Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 block">
                    Target Inspection Date <span className="text-base-accent font-sans">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formTargetDate}
                    onChange={e => setFormTargetDate(e.target.value)}
                    className="w-full px-3 py-1 bg-base-bg border border-base-border rounded-lg text-xs outline-none focus:border-base-accent text-base-text"
                  />
                </div>
              </div>

              {/* Rcomments */}
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2 block">
                  Coordinator Instructions / Comments
                </label>
                <textarea
                  rows={3}
                  value={formRComments}
                  onChange={e => setFormRComments(e.target.value)}
                  placeholder="Specify welding joint list, dimensional tolerances or special fitment drawings codes..."
                  className="w-full px-3 py-2 bg-base-bg border border-base-border rounded-lg text-xs outline-none resize-none focus:border-base-accent text-base-text"
                />
              </div>

              {/* Submit / Cancel Actions Row */}
              <div className="flex gap-2 justify-end pt-2 border-t border-base-border/30">
                <button
                  type="button"
                  onClick={() => setRfiFormOpen(false)}
                  className="px-4 py-1.5 bg-base-surface3 hover:bg-base-surface2 border border-base-border text-base-muted font-condensed font-bold uppercase text-[10px] tracking-wider rounded-md"
                >
                  Discard Form
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-base-accent hover:opacity-90 text-white font-condensed font-bold uppercase text-[10px] tracking-wider rounded-md shadow"
                >
                  Submit RFI to QC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Inspection Details, Status, & QC Sign-Off Workboard Area */}
      {selectedRfi && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-base-surface border border-base-border rounded-xl w-full max-w-2xl shadow-card overflow-hidden">
            {/* Header block */}
            <div className="bg-base-surface2 px-5 py-4 border-b border-base-border flex justify-between items-center">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-base-muted">INSPECTION DOCUMENT PREVIEW</span>
                <h3 className="font-condensed font-black text-sm uppercase text-base-text tracking-wide flex items-center gap-1.5 mt-0.5">
                  Request Ref: <span className="text-base-accent select-all">{selectedRfi.rfiNo}</span>
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedRfi(null);
                  setShowQcApprovalForm(false);
                  setShowQcRejectForm(false);
                }}
                className="text-base-muted hover:text-base-text text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Status Banner */}
              <div className="rounded-xl p-4 flex items-center justify-between gap-4 border border-base-border/50">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider">Current Sign-off Status</div>
                  <div className="text-sm font-condensed font-black uppercase text-base-text mt-0.5 tracking-wider">
                    {selectedRfi.status === 'Approved' && <span className="text-emerald-500">Milestone Passed / Approved</span>}
                    {selectedRfi.status === 'Requested' && <span className="text-amber-500">Pending Quality Inspection</span>}
                    {selectedRfi.status === 'Rejected / Punchlist' && <span className="text-[#9b1c2e]">Rectification Required (Punchlist)</span>}
                  </div>
                </div>

                <div>
                  {selectedRfi.status === 'Approved' && (
                    <div className="p-2.5 bg-emerald-500/10 rounded-full text-emerald-500 border border-emerald-500/20">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  )}
                  {selectedRfi.status === 'Requested' && (
                    <div className="p-2.5 bg-amber-500/10 rounded-full text-amber-500 border border-amber-500/20 animate-pulse">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  )}
                  {selectedRfi.status === 'Rejected / Punchlist' && (
                    <div className="p-2.5 bg-[#9b1c2e]/10 rounded-full text-[#9b1c2e] border border-[#9b1c2e]/20">
                      <XCircle className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </div>

              {/* Meta information grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs border-b border-base-border/30 pb-5">
                <div>
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider block">Project Name</span>
                  <span className="font-bold text-base-text block mt-1">{selectedRfi.projectName}</span>
                </div>

                <div>
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider block">Assembly Block</span>
                  <span className="font-bold text-base-text block mt-1">{selectedRfi.assemblyName || 'Fully Integrated Scope'}</span>
                </div>

                <div>
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider block">Inspection Class</span>
                  <span className="font-condensed font-extrabold uppercase text-base-accent block mt-1 tracking-wider text-[11px]">{selectedRfi.inspectionType}</span>
                </div>

                <div>
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider block">Requested By</span>
                  <span className="font-medium text-base-text block mt-1">{selectedRfi.requestedBy}</span>
                </div>

                <div>
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider block">Filing Date</span>
                  <span className="font-mono text-base-text block mt-1">{selectedRfi.requestedDate}</span>
                </div>

                <div>
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider block">Target Audit Date</span>
                  <span className="font-mono text-base-text font-bold block mt-1 text-base-accent">{selectedRfi.targetDate}</span>
                </div>
              </div>

              {/* RComments */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-condensed font-bold uppercase text-base-muted tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Requestor Comments / Specifications
                </h4>
                <div className="bg-base-surface2 border border-base-border rounded-lg p-3 text-xs leading-relaxed text-base-text">
                  {selectedRfi.rcomments || <span className="italic opacity-60 text-[11px]">No specific technical comments filed in RFI.</span>}
                </div>
              </div>

              {/* IF APPROVED: SHOW INSPECTION CARD */}
              {selectedRfi.status === 'Approved' && (
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4.5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-emerald-500/15 pb-1.5 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-condensed font-black uppercase tracking-wider">Quality Sign-Off Certificate APPROVED</span>
                  </div>

                  <div className="text-xs space-y-2 leading-relaxed">
                    <div>
                      <span className="text-[10px] text-base-muted block">Inspector Assessment Report:</span>
                      <p className="text-base-text font-medium mt-1 font-sans">{selectedRfi.comments || 'No evaluation remarks saved.'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-emerald-500/10 text-[10px] text-base-muted">
                      <div>Signed by: <b className="text-base-text font-sans font-bold">{selectedRfi.inspectedBy || selectedRfi.assignedInspector}</b></div>
                      <div className="text-right">Inspection Date: <b className="text-base-text font-mono">{selectedRfi.inspectedDate}</b></div>
                    </div>
                  </div>
                </div>
              )}

              {/* IF REJECTED: SHOW PUNCHLIST WARNING */}
              {selectedRfi.status === 'Rejected / Punchlist' && (
                <div className="bg-[#9b1c2e]/5 border border-[#9b1c2e]/20 rounded-xl p-4.5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#9b1c2e]/15 pb-1.5 text-[#9b1c2e]">
                    <XCircle className="w-4 h-4" />
                    <span className="text-[10px] font-condensed font-black uppercase tracking-wider">Inspector Assessment Rejected (Punchlist Issued)</span>
                  </div>

                  <div className="text-xs space-y-3">
                    <div>
                      <span className="text-[10px] text-base-muted block">QC Inspector Fault Comments:</span>
                      <p className="text-base-text font-semibold mt-1 bg-base-surface border border-base-border/50 p-2.5 rounded-lg leading-relaxed">{selectedRfi.comments}</p>
                    </div>

                    {selectedRfi.punchList && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-[#9b1c2e] font-condensed font-extrabold uppercase tracking-wider">RECTIFICATION CHECKLIST RUN (PUNCHLIST):</span>
                        <div className="bg-base-surface border border-[#9b1c2e]/25 rounded-lg p-3 font-mono text-[11px] text-[#9b1c2e] whitespace-pre-line leading-relaxed">
                          {selectedRfi.punchList}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-1 text-[10px] text-base-muted border-t border-[#9b1c2e]/10">
                      <div>Rejected by: <b className="text-base-text">{selectedRfi.inspectedBy || selectedRfi.assignedInspector}</b></div>
                      <div className="text-right">Failed Date: <b className="text-base-text font-mono">{selectedRfi.inspectedDate}</b></div>
                    </div>
                  </div>
                </div>
              )}

              {/* INTERACTIVE BOARD AREA: QC Inspector Forms */}
              {canInspect && selectedRfi.status === 'Requested' && !showQcApprovalForm && !showQcRejectForm && (
                <div className="bg-base-surface2 border border-base-border rounded-xl p-4 space-y-3.5 text-center">
                  <div className="text-xs font-semibold text-base-muted leading-relaxed">
                    You have <b className="text-base-accent">Quality Auditor Operations Control</b>. Please conduct the physical checks, and record your final inspection decision.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        setQcComments('');
                        setQcPunchlist('');
                        setQcInspector(currentUser?.name || '');
                        setShowQcApprovalForm(true);
                      }}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      Approve & Sign-Off
                    </button>
                    <button
                      onClick={() => {
                        setQcComments('');
                        setQcPunchlist('');
                        setQcInspector(currentUser?.name || '');
                        setShowQcRejectForm(true);
                      }}
                      className="px-5 py-2 rounded-lg bg-[#9b1c2e] hover:opacity-90 text-white font-condensed font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 shadow"
                    >
                      <XCircle className="w-4 h-4 text-white" />
                      Issue Punchlist (Reject)
                    </button>
                  </div>
                </div>
              )}

              {/* Rework submit action for coordinators */}
              {canRequest && selectedRfi.status === 'Rejected / Punchlist' && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center space-y-3">
                  <p className="text-xs text-base-muted leading-relaxed">
                    Has the fabrication crew completed all rectification items listed in the punch checklist above? You can submit the RFI back to the inspection queue once ready.
                  </p>
                  <button
                    onClick={() => handleResubmitRfi(selectedRfi.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-condensed font-black uppercase text-xs tracking-wider shadow"
                  >
                    <RotateCcw className="w-4 h-4 text-white" />
                    Submit for Re-Inspection
                  </button>
                </div>
              )}

              {/* QC ACTION FORM: Approve Certificate Form */}
              {showQcApprovalForm && (
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4.5 space-y-4">
                  <div className="flex justify-between items-center border-b border-emerald-500/15 pb-2 text-emerald-500">
                    <h5 className="font-condensed font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Complete pass sign-off evaluation
                    </h5>
                    <button 
                      onClick={() => setShowQcApprovalForm(false)}
                      className="text-emerald-500 font-bold hover:text-emerald-600 text-xs uppercase font-condensed"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-emerald-500 block">
                        QC Sign-Off Evaluation Remarks *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={qcComments}
                        onChange={e => setQcComments(e.target.value)}
                        placeholder="Write audit dimensional outcomes, welding visually accepted remarks..."
                        className="w-full px-3 py-2 bg-base-bg border border-base-border rounded-lg outline-none text-base-text resize-none focus:border-emerald-500 font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block">
                        Certified Lead QC Inspector Signature Name
                      </label>
                      <input
                        type="text"
                        value={qcInspector}
                        onChange={e => setQcInspector(e.target.value)}
                        className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded-lg outline-none text-base-text font-bold"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => setShowQcApprovalForm(false)}
                        className="px-3.5 py-1 text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted hover:text-base-text bg-base-surface border border-base-border rounded"
                      >
                        Back
                      </button>
                      <button
                        disabled={!qcComments.trim()}
                        onClick={() => handleApplyQcApproval(selectedRfi.id)}
                        className="px-4 py-1.5 text-[10px] font-condensed font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed shadow"
                      >
                        Confirm Approved Sign-Off
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* QC ACTION FORM: Reject Request Form */}
              {showQcRejectForm && (
                <div className="bg-[#9b1c2e]/5 border border-[#9b1c2e]/25 rounded-xl p-4.5 space-y-4">
                  <div className="flex justify-between items-center border-b border-[#9b1c2e]/15 pb-2 text-[#9b1c2e]">
                    <h5 className="font-condensed font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      Issue rework punchlist
                    </h5>
                    <button 
                      onClick={() => setShowQcRejectForm(false)}
                      className="text-[#9b1c2e] font-bold hover:text-red-700 text-xs uppercase font-condensed"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-[#9b1c2e] block">
                        QC Rejection Fault Description *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={qcComments}
                        onChange={e => setQcComments(e.target.value)}
                        placeholder="Detail why the inspection failed: e.g. undercut, layout dimensional deviation..."
                        className="w-full px-3 py-2 bg-base-bg border border-base-border rounded-lg outline-none text-base-text resize-none focus:border-red-500 font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-[#9b1c2e] block">
                        Rectification Punchlist Checklist Core Items *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={qcPunchlist}
                        onChange={e => setQcPunchlist(e.target.value)}
                        placeholder="- Item 1 description&#10;- Item 2 description..."
                        className="w-full p-2.5 bg-base-bg border border-base-border rounded-lg outline-none text-base-text font-mono text-[11px] resize-none focus:border-red-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted block">
                        QC Inspector Name
                      </label>
                      <input
                        type="text"
                        value={qcInspector}
                        onChange={e => setQcInspector(e.target.value)}
                        className="w-full px-3 py-1.5 bg-base-bg border border-base-border rounded-lg outline-none text-base-text"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => setShowQcRejectForm(false)}
                        className="px-3.5 py-1 text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted hover:text-base-text bg-base-surface border border-base-border rounded"
                      >
                        Back
                      </button>
                      <button
                        disabled={!qcComments.trim() || !qcPunchlist.trim()}
                        onClick={() => handleApplyQcReject(selectedRfi.id)}
                        className="px-4 py-1.5 text-[10px] font-condensed font-black uppercase tracking-wider bg-[#9b1c2e] hover:bg-opacity-95 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed shadow"
                      >
                        Issue Punch Check
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer block */}
            <div className="bg-base-surface2 border-t border-base-border px-5 py-3.5 flex justify-between items-center">
              <div>
                {onDeleteInspection && currentUser && currentUser.role === 'admin' && (
                  <button
                    onClick={() => {
                      if (confirm('Delete this inspection record permanently?')) {
                        onDeleteInspection(selectedRfi.id);
                        setSelectedRfi(null);
                      }
                    }}
                    className="text-[10px] font-condensed font-bold uppercase tracking-wider text-[#9b1c2e] hover:underline"
                  >
                    Delete Record
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedRfi(null);
                  setShowQcApprovalForm(false);
                  setShowQcRejectForm(false);
                }}
                className="px-4 py-1.5 bg-base-surface3 border border-base-border hover:bg-base-surface2 text-base-text font-condensed font-bold uppercase text-[10px] tracking-wider rounded-md"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
