import React, { useState } from 'react';
import { ProblemReport, Project, Employee, UserRoleType } from '../types';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2, 
  Search, 
  Check, 
  X, 
  Compass, 
  Hammer, 
  ShieldAlert, 
  Box, 
  Sliders, 
  Eye, 
  MessageSquare, 
  UserCheck,
  Briefcase,
  HelpCircle,
  TrendingUp,
  Camera,
  Image
} from 'lucide-react';

interface Focus24ViewProps {
  problemReports: ProblemReport[];
  projects: Project[];
  employees: Employee[];
  currentUser: { name: string; role: UserRoleType } | null;
  onAddProblemReport: (report: Omit<ProblemReport, 'id' | 'date'>) => void;
  onUpdateProblemStatus: (id: string, status: 'Open' | 'Resolved', resolutionNote?: string) => void;
  onDeleteProblemReport: (id: string) => void;
  openSpotlight?: (pid: string) => void;
}

const CATEGORY_STYLES = {
  'Drawing Issue': {
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-850',
    accent: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40',
    title: 'text-blue-900 dark:text-blue-200',
    icon: Compass,
    border: 'border-blue-500/20'
  },
  'Safety Issue': {
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/35',
    accent: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40',
    title: 'text-red-900 dark:text-red-200',
    icon: ShieldAlert,
    border: 'border-red-500/20'
  },
  'Facility Issue': {
    bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/35',
    accent: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40',
    title: 'text-purple-900 dark:text-purple-200',
    icon: Hammer,
    border: 'border-purple-500/20'
  },
  'Material Issue': {
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/35',
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
    title: 'text-amber-900 dark:text-amber-200',
    icon: Box,
    border: 'border-amber-500/20'
  },
  'Equipment Issue': {
    bg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-900/35',
    accent: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/40',
    title: 'text-cyan-900 dark:text-cyan-200',
    icon: Sliders,
    border: 'border-cyan-500/20'
  },
  'Other': {
    bg: 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800',
    accent: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
    title: 'text-slate-900 dark:text-slate-200',
    icon: HelpCircle,
    border: 'border-slate-500/20'
  }
};

export default function Focus24View({
  problemReports,
  projects,
  employees,
  currentUser,
  onAddProblemReport,
  onUpdateProblemStatus,
  onDeleteProblemReport,
  openSpotlight
}: Focus24ViewProps) {
  // Navigation & Search/Filter states
  const [showSubmitForm, setShowSubmitForm] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  // Form submission local states
  const [formCategory, setFormCategory] = useState<ProblemReport['category']>('Facility Issue');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formPosition, setFormPosition] = useState<string>('');
  const [customPosition, setCustomPosition] = useState<string>('');
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formReporter, setFormReporter] = useState<string>(currentUser?.name || '');
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Direct toggle states for inline resolutions
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Delete Action Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Prepopulate standard department options
  const standardDepartments = [
    'Project Control',
    'Production',
    'Facility & Maintanance',
    'Lifting',
    'Blasting & Painting',
    'Quality Control',
    'Human resources',
    'HSE',
    'Material Procces'
  ];

  // Extract unique projects with issues for dropdown filter
  const projectsInIssues = Array.from(new Set(problemReports.map(r => r.projectId).filter(Boolean))) as string[];

  // Form validation & processing
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formDesc.trim()) errors.desc = 'Description is required';
    
    if (!formPosition.trim()) {
      errors.position = 'Please select the department';
    }
    if (!formReporter.trim()) errors.reporter = 'Your name is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsUploading(true);
    let uploadedPhotoUrl = undefined;

    if (formPhotoFile) {
      try {
        const fileExt = formPhotoFile.name.split('.').pop() || 'jpg';
        const uniquePath = `problems/photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const imageRef = ref(storage, uniquePath);
        const snapshot = await uploadBytes(imageRef, formPhotoFile);
        uploadedPhotoUrl = await getDownloadURL(snapshot.ref);
      } catch (err) {
        console.error("Firebase Storage Upload Error:", err);
        alert("Photo upload to Firebase Storage failed. Please check your Firebase rules and internet connection.");
        setIsUploading(false);
        return;
      }
    }

    const selectedProj = projects.find(p => p.id === formProjectId);

    onAddProblemReport({
      projectId: formProjectId || undefined,
      projectName: selectedProj ? selectedProj.name : undefined,
      category: formCategory,
      description: formDesc.trim(),
      assignedPosition: formPosition.trim(),
      reportedBy: formReporter.trim(),
      status: 'Open',
      photo: uploadedPhotoUrl || undefined
    });

    // Reset fields
    setFormDesc('');
    setFormPosition('');
    setCustomPosition('');
    setFormProjectId('');
    setFormReporter(currentUser?.name || '');
    setFormPhoto(null);
    setFormPhotoFile(null);
    setFormErrors({});
    setIsUploading(false);
    setShowSubmitForm(false);
  };

  // Perform filtering
  const filteredReports = problemReports.filter(r => {
    // 1. Search Query Match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = (r.description + r.reportedBy + r.assignedPosition + (r.projectName || '')).toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    // 2. Category Match
    if (filterCategory !== 'All' && r.category !== filterCategory) return false;

    // 3. Status Match
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;

    // 4. Project Match
    if (filterProject !== 'All' && r.projectId !== filterProject) return false;

    return true;
  });

  // KPI Calculations
  const totalCount = problemReports.length;
  const openCount = problemReports.filter(r => r.status === 'Open').length;
  const resolvedCount = problemReports.filter(r => r.status === 'Resolved').length;
  const drawingOpen = problemReports.filter(r => r.category === 'Drawing Issue' && r.status === 'Open').length;
  const safetyOpen = problemReports.filter(r => r.category === 'Safety Issue' && r.status === 'Open').length;
  const facilityOpen = problemReports.filter(r => r.category === 'Facility Issue' && r.status === 'Open').length;
  const materialOpen = problemReports.filter(r => r.category === 'Material Issue' && r.status === 'Open').length;

  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  return (
    <div id="focus24-root" className="space-y-6">
      
      {/* View Header with description and Call to Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-base-border pb-4">
        <div>
          <h2 className="font-condensed font-extrabold text-2xl uppercase tracking-wider text-base-text flex items-center gap-2">
            <span className="text-[#9b1c2e]">24 Hours</span> Focus
            <span className="text-xs font-sans font-bold bg-amber-500/10 text-amber-500 py-1 px-2.5 rounded-full uppercase tracking-wider border border-amber-500/20">
              Live Escalation
            </span>
          </h2>
          <p className="text-xs text-base-muted2 font-medium mt-1">
            Real-time shopfloor impediment logs, drawing corrections, safety flags, and rapid supervisor coordination.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitForm(!showSubmitForm)}
          className={`px-4 py-2.5 rounded-lg font-condensed font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
            showSubmitForm 
              ? 'bg-base-surface border border-base-border text-base-text hover:bg-base-surface3' 
              : 'bg-[#9b1c2e] hover:bg-[#b02236] text-white'
          }`}
        >
          {showSubmitForm ? (
            <>
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Report a Problem</span>
            </>
          )}
        </button>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Active Open */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Active Blockers</span>
            <div className="text-3xl font-condensed font-black text-[#9b1c2e] leading-none">{openCount}</div>
            <p className="text-[10px] text-base-muted2 font-medium">Unresolved floor bugs</p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 text-[#9b1c2e] border border-red-500/15">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Drawing Issues Open */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Drawing Issues</span>
            <div className="text-3xl font-condensed font-black text-blue-600 dark:text-blue-400 leading-none">{drawingOpen}</div>
            <p className="text-[10px] text-base-muted2 font-medium">Assigned to PPC Draft</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/15">
            <Compass className="w-5 h-5" />
          </div>
        </div>

        {/* Safety Issues Open */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">Safety Concerns</span>
            <div className="text-3xl font-condensed font-black text-red-500 dark:text-red-400 leading-none">{safetyOpen}</div>
            <p className="text-[10px] text-base-muted2 font-medium">HSE compliance focus</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/15">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Resolved Scorecard */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Resolution Rate</span>
            <div className="text-3xl font-condensed font-black text-base-green leading-none">{resolutionRate}%</div>
            <p className="text-[10px] text-base-muted2 font-medium">{resolvedCount} of {totalCount} resolved</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dynamic Slide-down Problem Report Form */}
      {showSubmitForm && (
        <form 
          onSubmit={handleCreateReport} 
          className="bg-base-surface border-2 border-dashed border-[#9b1c2e]/40 p-5 rounded-xl shadow-elevated grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn"
        >
          <div className="md:col-span-2 pb-2 border-b border-base-border flex justify-between items-center">
            <h3 className="font-condensed font-bold text-sm uppercase tracking-wide text-base-text flex items-center gap-1.5">
              <span className="p-1 rounded bg-[#9b1c2e]/10 text-[#9b1c2e]"><AlertTriangle className="w-4 h-4" /></span>
              Intake Problem Reporter Form
            </h3>
            <span className="text-[10px] text-base-muted uppercase font-bold">Anyone can report — All roles welcome</span>
          </div>

          {/* Category SELECTOR */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              Problem Category <span className="text-[#9b1c2e]">*</span>
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as any)}
              className="px-3 py-2 bg-base-surface2 text-base-text border border-base-border rounded-md text-xs font-semibold outline-none focus:border-[#9b1c2e] cursor-pointer"
            >
              <option value="Drawing Issue">Drawing Issue</option>
              <option value="Safety Issue">Safety Issue</option>
              <option value="Facility Issue">Facility Issue</option>
              <option value="Material Issue">Material Issue</option>
              <option value="Equipment Issue">Equipment Issue</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Department Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              Department <span className="text-[#9b1c2e]">*</span>
            </label>
            <select
              value={formPosition}
              onChange={(e) => setFormPosition(e.target.value)}
              className="px-3 py-2 bg-base-surface2 text-base-text border border-base-border rounded-md text-xs font-semibold outline-none focus:border-[#9b1c2e] cursor-pointer"
            >
              <option value="">— Select Department —</option>
              {standardDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            {formErrors.position && <span className="text-[10px] text-[#9b1c2e] font-semibold">{formErrors.position}</span>}
          </div>

          {/* Associated Project / Work order mapping */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              Associated Project / Work Order (Optional)
            </label>
            <select
              value={formProjectId}
              onChange={(e) => setFormProjectId(e.target.value)}
              className="px-3 py-2 bg-base-surface2 text-base-text border border-base-border rounded-md text-xs font-semibold outline-none focus:border-[#9b1c2e] cursor-pointer"
            >
              <option value="">— Globally Applicable (No Single Project) —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.client} — {p.name}</option>
              ))}
            </select>
          </div>

          {/* Your Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              Your Name / Reported By <span className="text-[#9b1c2e]">*</span>
            </label>
            <input
              type="text"
              value={formReporter}
              onChange={(e) => setFormReporter(e.target.value)}
              placeholder="Enter your name"
              className="px-3 py-2 bg-base-bg text-base-text border border-base-border rounded-md text-xs font-semibold outline-none focus:border-[#9b1c2e]"
            />
            {formErrors.reporter && <span className="text-[10px] text-[#9b1c2e] font-semibold">{formErrors.reporter}</span>}
          </div>

          {/* Description Textarea */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              Full Description of Blocker / Impediment <span className="text-[#9b1c2e]">*</span>
            </label>
            <textarea
              rows={3}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="State clearly what is wrong, which structural member or workbench is affected, and what coordinates. Provide numeric details if applicable."
              className="px-3 py-2 bg-base-bg text-base-text border border-base-border rounded-md text-xs font-semibold outline-none focus:border-[#9b1c2e]"
            />
            {formErrors.desc && <span className="text-[10px] text-[#9b1c2e] font-semibold">{formErrors.desc}</span>}
          </div>

          {/* Photo Upload Option */}
          <div className="md:col-span-2 flex flex-col gap-1.5 pt-1">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted2">
              Attach Reference Photo (Optional)
            </label>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              {/* Box upload zone */}
              <div 
                className="flex-1 min-h-[100px] border-2 border-dashed border-base-border hover:border-[#9b1c2e]/65 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer bg-base-bg/35 transition-all duration-150 select-none"
                onClick={() => document.getElementById('photo-upload-input')?.click()}
              >
                <input 
                  id="photo-upload-input"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormPhotoFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormPhoto(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Camera className="w-6 h-6 text-base-muted mb-1.5" />
                <span className="text-xs font-bold text-base-text">Click to choose image file</span>
                <span className="text-[10px] text-base-muted2 mt-0.5">Capture on smartphone or select drawing screenshot</span>
              </div>

              {/* Photo Preview Zone if loaded */}
              {formPhoto && (
                <div className="w-full sm:w-[150px] flex-shrink-0 bg-base-surface border border-base-border p-2 rounded-xl flex flex-col items-center justify-between gap-1.5">
                  <div className="relative w-full h-20 rounded-lg overflow-hidden border border-base-border/50 bg-base-surface3">
                    <img 
                      src={formPhoto} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormPhoto(null);
                        setFormPhotoFile(null);
                        const inp = document.getElementById('photo-upload-input') as HTMLInputElement;
                        if (inp) inp.value = '';
                      }}
                      className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer"
                      title="Remove attached photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-condensed font-black uppercase text-base-accent bg-base-accent-dim/15 px-1.5 py-0.5 rounded">
                    Photo Attached
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="md:col-span-2 flex justify-end gap-3 pt-2 border-t border-base-border/50">
            <button
              type="button"
              onClick={() => {
                setShowSubmitForm(false);
                setFormErrors({});
              }}
              className="px-4 py-2 border border-base-border hover:bg-base-surface3 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className={`px-5 py-2 text-white rounded-lg text-xs font-condensed font-extrabold uppercase tracking-wider transition-all ${
                isUploading 
                  ? 'bg-base-muted cursor-not-allowed animate-pulse' 
                  : 'bg-[#9b1c2e] hover:bg-[#b02236] cursor-pointer'
              }`}
            >
              {isUploading ? 'Uploading Reference Foto...' : 'Submit Escalation'}
            </button>
          </div>
        </form>
      )}

      {/* Filters Toolbar */}
      <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Simple keyword search */}
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-base-muted">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search problems, assignments, text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-base-bg border border-base-border rounded-lg text-xs outline-none focus:border-[#9b1c2e] text-base-text font-medium"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-muted hover:text-base-text"
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category select filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-condensed font-bold uppercase text-base-muted2">Category:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1 bg-base-surface2 border border-base-border text-[11px] rounded-lg font-bold text-base-text outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Drawing Issue">Drawing Issues</option>
              <option value="Safety Issue">Safety Concerns</option>
              <option value="Facility Issue">Facility Glitches</option>
              <option value="Material Issue">Material Shortages</option>
              <option value="Equipment Issue">Equipment Breakdowns</option>
              <option value="Other">Others</option>
            </select>
          </div>

          {/* Project mappings filter */}
          {projectsInIssues.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-condensed font-bold uppercase text-base-muted2">Project:</span>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-2.5 py-1 bg-base-surface2 border border-base-border text-[11px] rounded-lg font-bold text-base-text outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="All">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.client}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status select filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-condensed font-bold uppercase text-base-muted2">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1 bg-base-surface2 border border-base-border text-[11px] rounded-lg font-bold text-base-text outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Open">● Active Open</option>
              <option value="Resolved">✓ Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Problems log list view */}
      <div className="space-y-3">
        {filteredReports.length === 0 ? (
          <div className="bg-base-surface border border-base-border/55 rounded-xl p-8 text-center text-base-muted py-14">
            <div className="max-w-md mx-auto space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-base-green opacity-40" />
              <h4 className="font-condensed font-bold text-base text-base-text uppercase tracking-wide">No Active Blockers Found</h4>
              <p className="text-xs text-base-muted2 leading-relaxed">
                Matches the filters or the floor is 100% issue-free check. Report any physical, drawing, structural, or HSE problems by clicking "Report a Problem" above.
              </p>
            </div>
          </div>
        ) : (
          filteredReports.map((r) => {
            const style = CATEGORY_STYLES[r.category] || CATEGORY_STYLES['Other'];
            const CatIcon = style.icon;
            const isUnresolved = r.status === 'Open';

            return (
              <div
                key={r.id}
                className={`border bg-base-surface rounded-xl shadow-card transition-all duration-200 hover:shadow-md relative overflow-hidden ${
                  !isUnresolved ? 'opacity-85 border-base-border bg-base-surface/50' : `border-l-4 border-l-[#9b1c2e] ${style.bg}`
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  {/* Problem Details */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Category Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-condensed font-black uppercase tracking-wider flex items-center gap-1 ${style.accent}`}>
                        <CatIcon className="w-3.5 h-3.5" />
                        <span>{r.category}</span>
                      </span>

                      {/* Associated Project / Work Order Clickable Badge */}
                      {r.projectId && (
                        <button
                          onClick={() => openSpotlight?.(r.projectId!)}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-condensed font-extrabold uppercase bg-base-blue-dim text-base-blue border border-base-blue/20 hover:bg-base-blue hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                          title="Click to inspect project spotlight"
                        >
                          <Briefcase className="w-3 h-3" />
                          <span>{r.projectName || r.projectId}</span>
                        </button>
                      )}

                      {/* Created Date Badge */}
                      <span className="text-[10px] text-base-muted font-bold bg-base-surface3 border border-base-border px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{r.date}</span>
                      </span>

                      {/* Status indicator */}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-condensed font-extrabold uppercase tracking-wide ${
                        isUnresolved 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/20' 
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/20'
                      }`}>
                        {isUnresolved ? '● Active' : '✓ Resolved'}
                      </span>
                    </div>

                    {/* Desc */}
                    <div className="text-sm text-base-text font-medium leading-relaxed break-words whitespace-pre-wrap">
                      {r.description}
                    </div>

                    {/* Attached photo container */}
                    {r.photo && (
                      <div className="my-3 max-w-[280px] sm:max-w-xs">
                        <div 
                          className="relative group overflow-hidden rounded-lg border border-base-border/70 hover:border-[#9b1c2e]/40 shadow-xs bg-base-surface cursor-zoom-in transition-all duration-200"
                          onClick={() => setZoomedPhoto(r.photo || null)}
                          title="Click to view enlarged reference photo"
                        >
                          <img 
                            src={r.photo} 
                            alt="Reference photo" 
                            className="max-h-48 w-auto object-cover rounded-lg group-hover:scale-[1.03] transition-transform duration-200"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 bg-black/60 text-white rounded-lg px-2.5 py-1 text-[11px] font-condensed font-extrabold uppercase tracking-wide flex items-center gap-1 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0">
                              <Camera className="w-3.5 h-3.5" />
                              <span>Enlarge Photo</span>
                            </div>
                          </div>
                          <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-white font-condensed font-semibold uppercase tracking-wider">
                            Reference Photo
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Meta info block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 pt-1 text-xs text-base-muted2 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base-muted text-[10px] uppercase font-condensed font-bold">Reported By:</span>
                        <span className="text-base-text font-bold">{r.reportedBy}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base-muted text-[10px] uppercase font-condensed font-bold">Department:</span>
                        <span className="bg-[#9b1c2e]/10 text-[#9b1c2e] dark:text-red-400 dark:bg-red-950/30 px-1.5 py-0.5 rounded text-[11px] font-condensed font-extrabold uppercase tracking-wide">
                          {r.assignedPosition}
                        </span>
                      </div>
                    </div>

                    {/* Resolution Note if resolved */}
                    {!isUnresolved && (
                      <div className="mt-2.5 p-3 bg-emerald-500/10 dark:bg-emerald-950/20 rounded-lg border border-emerald-500/15">
                        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-xs font-condensed font-bold uppercase tracking-wider mb-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolution Summary</span>
                        </div>
                        <p className="text-xs text-base-text font-medium">
                          {r.resolutionNote || 'The issue has been completed and verified.'}
                        </p>
                        {r.resolvedAt && (
                          <div className="text-[10px] text-base-muted2 font-semibold mt-1 flex items-center gap-1">
                            <span>Resolved on:</span>
                            <span className="font-mono">{r.resolvedAt}</span>
                            {r.resolvedBy && (
                              <>
                                <span className="mx-1">•</span>
                                <span>Resolved by:</span>
                                <span>{r.resolvedBy}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Area */}
                  <div className="flex items-center gap-2.5 self-end md:self-center flex-shrink-0">
                    
                    {/* Toggle / Resolve Issue Form section */}
                    {isUnresolved ? (
                      resolvingId === r.id ? (
                        <div className="p-2 border border-emerald-500/30 bg-emerald-500/5 rounded-lg flex flex-col gap-2 min-w-[210px] sm:min-w-[250px] animate-fadeIn">
                          <span className="text-[10px] font-condensed font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            Enter Resolution Notes:
                          </span>
                          <input
                            type="text"
                            placeholder="Describe how it was fixed..."
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            className="px-2 py-1 bg-base-bg text-xs border border-base-border focus:border-base-green rounded outline-none w-full"
                          />
                          <div className="flex justify-end gap-1.5 text-[10px]">
                            <button
                              onClick={() => { setResolvingId(null); setResolutionNote(''); }}
                              className="px-2 py-1 border border-base-border bg-base-surface hover:bg-base-surface3 rounded font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                onUpdateProblemStatus(r.id, 'Resolved', resolutionNote.trim());
                                setResolvingId(null);
                                setResolutionNote('');
                              }}
                              className="px-2 py-1 bg-base-green hover:bg-emerald-600 text-white rounded font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResolvingId(r.id);
                            setResolutionNote('');
                          }}
                          className="px-3.5 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-base-green hover:text-white rounded-lg text-xs font-condensed font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-emerald-500/25 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Resolve Issue</span>
                        </button>
                      )
                    ) : (
                      // Toggle back to Open status
                      <button
                        onClick={() => {
                          if (confirm('Re-open this reported problem? This resets the completed log.')) {
                            onUpdateProblemStatus(r.id, 'Open');
                          }
                        }}
                        className="px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-600 hover:text-white rounded-lg text-xs font-condensed font-extrabold uppercase tracking-wide flex items-center gap-1.5 cursor-pointer border border-amber-500/25 transition-all"
                        title="Re-open issue"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Re-open Case</span>
                      </button>
                    )}

                    {/* Delete Report option for Admins and Managers */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                      <button
                        onClick={() => {
                          setDeleteConfirm({
                            isOpen: true,
                            title: 'Delete Reported Issue',
                            message: `Are you sure you want to permanently delete the reported issue belonging to category "${r.category}" for project "${r.projectName || ''}"? This action is irreversible.`,
                            onConfirm: () => {
                              onDeleteProblemReport(r.id);
                              setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        className="p-2 text-base-muted hover:text-[#9b1c2e] hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete reported issue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Photo Lightbox Modal */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setZoomedPhoto(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] overflow-hidden bg-base-surface border border-base-border rounded-xl shadow-elevated flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-base-surface border-b border-base-border p-3.5 flex justify-between items-center">
              <span className="text-xs font-condensed font-extrabold uppercase tracking-wider text-base-text flex items-center gap-1.5">
                <Image className="w-4 h-4 text-[#9b1c2e]" />
                Escalation Reference Panel
              </span>
              <button 
                onClick={() => setZoomedPhoto(null)}
                className="p-1 text-base-muted hover:text-base-text rounded-full hover:bg-base-surface3 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-neutral-950 flex justify-center items-center overflow-auto max-h-[75vh]">
              <img 
                src={zoomedPhoto} 
                alt="Enlarged Reference" 
                className="max-w-full max-h-[68vh] object-contain rounded-lg" 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in animate-duration-200">
          <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5 text-left">
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
                onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))} 
                className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={deleteConfirm.onConfirm} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
