import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Project,
  User,
  MaterialProcessing,
  ProcessingStageKey,
  ProcessingStage,
  ProcessingStatus,
  PROCESSING_STAGES,
  MasterDataEntry,
  Assembly
} from '../types';
import { MasterDataAutocomplete } from './MasterDataAutocomplete';
import { ProjectSearchSelector } from './ProjectSearchSelector';
import { CopyBomModal } from './CopyBomModal';
import {
  Plus,
  Search,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ChevronDown,
  Calendar,
  User as UserIcon,
  Trash2,
  X,
  Sliders,
  CheckCircle,
  LayoutGrid,
  Table,
  Link2,
  Folder,
  FileText
} from 'lucide-react';

interface MaterialProcessingViewProps {
  projects: Project[];
  currentUser: User;
  onAdd: (projectId: string, item: Omit<MaterialProcessing, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateStage: (projectId: string, mpId: string, stage: ProcessingStageKey, data: Partial<ProcessingStage>) => void;
  onDelete: (projectId: string, id: string) => void;
  setDeleteConfirm?: (state: any) => void;
  masterDataEntries: MasterDataEntry[];
  onEnsureMasterData: (category: 'material' | 'partNo' | 'client' | 'subAssembly', value: string, gaNumber?: string) => Promise<void>;
  onCopyStructure: (targetProjectId: string, newAssemblies: Assembly[]) => Promise<void>;
  initialProjectId?: string;
}

export default function MaterialProcessingView({
  projects = [],
  currentUser,
  onAdd,
  onUpdateStage,
  onDelete,
  setDeleteConfirm,
  masterDataEntries = [],
  onEnsureMasterData,
  onCopyStructure,
  initialProjectId
}: MaterialProcessingViewProps) {
  // Derive materialProcessings from projects nested array
  const materialProcessings = useMemo(() => {
    return projects.flatMap(p => p.materialProcessing || []);
  }, [projects]);
  // View mode for grouped cards vs spreadsheet table
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('matProcessingViewMode');
    return (saved === 'card' || saved === 'table') ? saved : 'table';
  });

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(''); // empty means "All Months"

  // Sync with initialProjectId
  React.useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Extract unique target months from projects
  const uniqueTargetMonths = useMemo(() => {
    const months = projects
      .map(p => p.targetMonth)
      .filter((m): m is string => !!m);
    return Array.from(new Set(months)).sort();
  }, [projects]);

  // Filter projects for the dropdown selector depending on selected month
  const filteredProjectsForDropdown = useMemo(() => {
    if (!selectedMonthFilter) return projects;
    return projects.filter(p => p.targetMonth === selectedMonthFilter);
  }, [projects, selectedMonthFilter]);

  // Expandable projects state for "By Project" tab
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [updatingStageInfo, setUpdatingStageInfo] = useState<{
    mp: MaterialProcessing;
    stageKey: ProcessingStageKey;
  } | null>(null);

  // Add Form state
  const [formProjectId, setFormProjectId] = useState('');
  const [formAssemblyId, setFormAssemblyId] = useState('');
  const [formMaterialName, setFormMaterialName] = useState('');
  const [formPartNo, setFormPartNo] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formThickness, setFormThickness] = useState('');
  const [formMaterialType, setFormMaterialType] = useState('SS304');
  const [formQty, setFormQty] = useState(1);
  const [formUnit, setFormUnit] = useState('pcs');
  const [formGaNumber, setFormGaNumber] = useState('');
  const [formActiveStages, setFormActiveStages] = useState<ProcessingStageKey[]>([
    'nesting',
    'cnc',
    'bending',
    'machining'
  ]);

  // Stage Update Form state
  const [stagePct, setStagePct] = useState(0);
  const [stageStatus, setStageStatus] = useState<ProcessingStatus>('pending');
  const [stageStartDate, setStageStartDate] = useState('');
  const [stageDoneDate, setStageDoneDate] = useState('');
  const [stageOperator, setStageOperator] = useState('');
  const [stageNotes, setStageNotes] = useState('');

  // Authorization level helper
  const isReadOnly = useMemo(() => {
    return currentUser?.role !== 'admin' && currentUser?.role !== 'manager';
  }, [currentUser]);

  // Filtered materials
  const filteredProcessings = useMemo(() => {
    if (!selectedProjectId) return [];
    return materialProcessings.filter(mp => {
      const matchSearch =
        mp.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mp.partNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mp.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchProject = mp.projectId === selectedProjectId;
      
      let matchMonth = true;
      if (selectedMonthFilter) {
        const proj = projects.find(p => p.id === mp.projectId);
        matchMonth = proj ? proj.targetMonth === selectedMonthFilter : false;
      }
      
      return matchSearch && matchProject && matchMonth;
    });
  }, [materialProcessings, searchQuery, selectedProjectId, selectedMonthFilter, projects]);

  // Copy BOM From Same GA Number states and logic
  const [showCopyBomModal, setShowCopyBomModal] = useState(false);
  const [dismissedProjects, setDismissedProjects] = useState<Record<string, boolean>>({});

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const gaMatchCandidates = useMemo(() => {
    if (!currentProject?.gaNumber) return [];
    return projects.filter(p =>
      p.id !== currentProject.id &&
      p.gaNumber &&
      p.gaNumber.trim().toUpperCase() === currentProject.gaNumber!.trim().toUpperCase() &&
      ((p.materialProcessing?.length || 0) > 0 || (p.assemblies?.length || 0) > 0)
    );
  }, [projects, currentProject]);

  const currentProjectHasNoMaterials = currentProject
    ? (currentProject.materialProcessing?.length || 0) === 0 || (currentProject.assemblies?.length || 0) === 0
    : false;

  // Month & project filtered materials for KPIs
  const monthAndProjFilteredProcessings = useMemo(() => {
    if (!selectedProjectId) return [];
    return materialProcessings.filter(mp => {
      const matchProject = mp.projectId === selectedProjectId;
      let matchMonth = true;
      if (selectedMonthFilter) {
        const proj = projects.find(p => p.id === mp.projectId);
        matchMonth = proj ? proj.targetMonth === selectedMonthFilter : false;
      }
      return matchProject && matchMonth;
    });
  }, [materialProcessings, selectedProjectId, selectedMonthFilter, projects]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const items = monthAndProjFilteredProcessings;
    const total = items.length;
    const inProgress = items.filter(
      mp => !mp.isCompleted && mp.overallPct > 0
    ).length;
    const completed = items.filter(mp => mp.isCompleted).length;
    const avgProgress =
      total > 0
        ? Math.round(items.reduce((sum, mp) => sum + mp.overallPct, 0) / total)
        : 0;

    return { total, inProgress, completed, avgProgress };
  }, [monthAndProjFilteredProcessings]);

  // Check if a row has overdue stages (in progress & no update in 7 days)
  const isOverdue = (mp: MaterialProcessing) => {
    if (mp.isCompleted) return false;
    const hasInProgress = mp.activeStages.some(
      k => mp.stages[k]?.status === 'in-progress'
    );
    if (!hasInProgress) return false;
    const updatedDate = new Date(mp.updatedAt || mp.createdAt);
    const diffTime = Math.abs(new Date().getTime() - updatedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  };

  // Excel exporter
  const handleExportExcel = () => {
    const rows = filteredProcessings.map(mp => {
      return {
        Project: mp.projectName,
        WO: mp.workOrder,
        Material: mp.materialName,
        'Part No': mp.partNo || '',
        Qty: mp.qty,
        Unit: mp.unit,
        'Nesting %': mp.stages.nesting?.pct ?? 0,
        'Nesting Status': mp.stages.nesting?.status ?? 'pending',
        'CNC %': mp.stages.cnc?.pct ?? 0,
        'CNC Status': mp.stages.cnc?.status ?? 'pending',
        'Bending %': mp.stages.bending?.pct ?? 0,
        'Bending Status': mp.stages.bending?.status ?? 'pending',
        'Machining %': mp.stages.machining?.pct ?? 0,
        'Machining Status': mp.stages.machining?.status ?? 'pending',
        'Overall %': mp.overallPct,
        Completed: mp.isCompleted ? 'YES' : 'NO',
        'Last Updated': mp.updatedAt ? mp.updatedAt.slice(0, 10) : ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Processing');
    XLSX.writeFile(wb, `material-processing-${Date.now()}.xlsx`);
  };

  // Open add material processing modal
  const handleOpenAddModal = () => {
    setFormProjectId('');
    setFormAssemblyId('');
    setFormGaNumber('');
    setFormMaterialName('');
    setFormPartNo('');
    setFormDescription('');
    setFormThickness('');
    setFormMaterialType('SS304');
    setFormQty(1);
    setFormUnit('pcs');
    setFormActiveStages(['nesting', 'cnc', 'bending', 'machining']);
    setIsAddModalOpen(true);
  };

  // Dynamic assembly filter on project change
  const handleFormProjectChange = (projId: string) => {
    setFormProjectId(projId);
    const selectedProj = projects.find(p => p.id === projId);
    const assemblies = selectedProj?.assemblies || [];
    setFormAssemblyId(assemblies.length > 0 ? assemblies[0].id : '');
    setFormGaNumber(selectedProj?.gaNumber || '');
  };

  // Handle stage checkbox toggle
  const handleStageToggle = (stageKey: ProcessingStageKey) => {
    setFormActiveStages(prev =>
      prev.includes(stageKey) ? prev.filter(k => k !== stageKey) : [...prev, stageKey]
    );
  };

  // Submit new material processing
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId || !formMaterialName.trim() || formQty <= 0) {
      alert('Please fill out all required fields.');
      return;
    }

    const selectedProj = projects.find(p => p.id === formProjectId);
    if (!selectedProj) return;

    const selectedAsm = selectedProj.assemblies?.find(a => a.id === formAssemblyId);

    const initialStages: Partial<Record<ProcessingStageKey, ProcessingStage>> = {};
    formActiveStages.forEach(key => {
      initialStages[key] = {
        pct: 0,
        status: 'pending',
        operator: '',
        notes: ''
      };
    });

    try {
      await onEnsureMasterData('material', formMaterialName, formGaNumber || undefined);
      if (formPartNo.trim()) {
        await onEnsureMasterData('partNo', formPartNo, formGaNumber || undefined);
      }
    } catch (err) {
      console.error('Failed to ensure master data:', err);
    }

    onAdd(formProjectId, {
      projectId: formProjectId,
      projectName: selectedProj.name,
      workOrder: selectedProj.client,
      gaNumber: formGaNumber || undefined,
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
      createdBy: currentUser.name,
      assemblyId: formAssemblyId || undefined,
      assemblyName: selectedAsm?.name || undefined,
      isCompleted: false
    });

    setIsAddModalOpen(false);
  };

  // Open Update Stage modal
  const handleOpenUpdateStage = (mp: MaterialProcessing, stageKey: ProcessingStageKey) => {
    if (isReadOnly) return; // view-only
    const currentStage = mp.stages[stageKey] || {
      pct: 0,
      status: 'pending',
      startDate: '',
      doneDate: '',
      operator: '',
      notes: ''
    };

    setUpdatingStageInfo({ mp, stageKey });
    setStagePct(currentStage.pct ?? 0);
    setStageStatus(currentStage.status ?? 'pending');
    setStageStartDate(currentStage.startDate ?? '');
    setStageDoneDate(currentStage.doneDate ?? '');
    setStageOperator(currentStage.operator || currentUser.name);
    setStageNotes(currentStage.notes || '');
  };

  // Handle Stage Status change to prefill dates
  const handleStatusChange = (status: ProcessingStatus) => {
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

  // Submit updated stage data
  const handleSubmitStageUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingStageInfo) return;

    const { mp, stageKey } = updatingStageInfo;
    onUpdateStage(mp.projectId, mp.id, stageKey, {
      pct: Number(stagePct),
      status: stageStatus,
      startDate: stageStartDate || undefined,
      doneDate: stageStatus === 'done' ? stageDoneDate || new Date().toISOString().slice(0, 10) : stageDoneDate || undefined,
      operator: stageOperator.trim() || currentUser.name,
      notes: stageNotes.trim() || undefined
    });

    setUpdatingStageInfo(null);
  };

  // Toggle project expansion in "By Project" Tab
  const toggleProjectExpand = (projId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projId]: !prev[projId]
    }));
  };

  // Grouped by project data helper
  const groupedData = useMemo(() => {
    const map: Record<
      string,
      {
        project: Project;
        items: MaterialProcessing[];
        overallPct: number;
        stageAverages: Record<ProcessingStageKey, number>;
      }
    > = {};

    projects.forEach(p => {
      // Filter projects by target month
      if (selectedMonthFilter && p.targetMonth !== selectedMonthFilter) return;

      // Filter projects by selected project
      if (selectedProjectId && p.id !== selectedProjectId) return;

      const items = filteredProcessings.filter(mp => mp.projectId === p.id);
      if (items.length === 0) return;

      const avgOverall = Math.round(
        items.reduce((s, m) => s + m.overallPct, 0) / items.length
      );

      // Compute mini 4 stage averages
      const stageAverages = { nesting: 0, cnc: 0, bending: 0, machining: 0 };
      (['nesting', 'cnc', 'bending', 'machining'] as ProcessingStageKey[]).forEach(stage => {
        const stageItems = items.filter(mp => mp.activeStages.includes(stage));
        const sum = stageItems.reduce((s, m) => s + (m.stages[stage]?.pct ?? 0), 0);
        stageAverages[stage] = stageItems.length > 0 ? Math.round(sum / stageItems.length) : 0;
      });

      map[p.id] = {
        project: p,
        items,
        overallPct: avgOverall,
        stageAverages
      };
    });

    return map;
  }, [filteredProcessings, projects, selectedMonthFilter, selectedProjectId]);

  // Overall Ring color helper
  const getOverallColor = (pct: number) => {
    if (pct < 40) return 'text-red-500';
    if (pct < 80) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-base-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-text font-sans flex items-center gap-2">
            <Layers className="h-6 w-6 text-base-accent" />
            Material Processing
          </h1>
          <p className="text-sm text-base-muted font-condensed uppercase tracking-wider mt-0.5">
            Shop Floor Tracker & Stages Monitor
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-base-accent hover:bg-base-accent/80 text-black font-condensed font-bold uppercase rounded-lg shadow transition duration-200 flex items-center gap-1.5 cursor-pointer text-sm"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> Add Material
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-base-surface hover:bg-base-surface3 text-base-text font-condensed font-bold uppercase rounded-lg border border-base-border transition duration-200 flex items-center gap-1.5 cursor-pointer text-sm"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* PROJECT FILTER WORKSPACE SELECTOR */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-base-accent/10 rounded-lg text-base-accent">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-base-text font-sans flex items-center gap-2">
                Project Workspace Selector
              </h2>
              <p className="text-xs text-base-muted mt-0.5">
                Filter the entire tracking board and KPIs specifically by a single chosen project to declutter your view.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted whitespace-nowrap">
                Choose Project:
              </span>
              <ProjectSearchSelector
                projects={filteredProjectsForDropdown}
                selectedId={selectedProjectId}
                onChange={setSelectedProjectId}
                placeholder=""
                showAllProjectsOption={false}
                className="w-full sm:w-80"
              />
            </div>

            {selectedProjectId && (
              <button
                onClick={() => setSelectedProjectId('')}
                className="px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 text-base-text text-xs font-sans rounded-md border border-base-border transition cursor-pointer flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Selected Project Quick-Details bar */}
        {currentProject && (
          <div className="mt-4 pt-4 border-t border-base-border/50 flex flex-wrap gap-y-2 gap-x-6 text-xs text-base-muted font-sans items-center">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-base-text">Client:</span>
              <span>{currentProject.client || '—'}</span>
            </div>
            {currentProject.gaNumber && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-base-text">GA Number:</span>
                <span className="px-1.5 py-0.5 font-mono text-[10px] font-bold bg-base-surface3 border border-base-border text-base-accent rounded">
                  {currentProject.gaNumber}
                </span>
              </div>
            )}
            {currentProject.targetMonth && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-base-text">Target Month:</span>
                <span className="px-1.5 py-0.5 bg-base-accent/10 text-base-accent rounded text-[10px] font-bold">
                  {currentProject.targetMonth}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-base-text">Status:</span>
              <span className={`capitalize font-bold ${currentProject.status === 'active' ? 'text-emerald-500' : 'text-base-muted'}`}>
                {currentProject.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-4 bg-base-surface border border-base-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-base-muted font-condensed uppercase tracking-wider block">
              Total Tracked Materials
            </span>
            <span className="text-2xl font-bold font-sans text-base-text">
              {kpis.total}
            </span>
          </div>
          <div className="p-2.5 bg-base-surface2 rounded-lg text-base-accent">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-4 bg-base-surface border border-base-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-base-muted font-condensed uppercase tracking-wider block">
              In Progress Stages
            </span>
            <span className="text-2xl font-bold font-sans text-amber-500">
              {kpis.inProgress}
            </span>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500">
            <Sliders className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-4 bg-base-surface border border-base-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-base-muted font-condensed uppercase tracking-wider block">
              Processing Completed
            </span>
            <span className="text-2xl font-bold font-sans text-emerald-500">
              {kpis.completed}
            </span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-500">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-4 bg-base-surface border border-base-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-base-muted font-condensed uppercase tracking-wider block">
              Average Progress
            </span>
            <span className="text-2xl font-bold font-sans text-base-accent">
              {kpis.avgProgress}%
            </span>
          </div>
          <div className="p-2.5 bg-base-accent/10 rounded-lg text-base-accent">
            <span className="text-xl font-black font-sans leading-none">%</span>
          </div>
        </div>
      </div>

      {/* COPY BOM BANNER */}
      {selectedProjectId && currentProject && gaMatchCandidates.length > 0 && currentProjectHasNoMaterials && !dismissedProjects[selectedProjectId] && (
        <div className="bg-base-accent-dim/10 border border-base-accent/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-base-accent-dim/20 rounded-lg text-base-accent shrink-0 mt-0.5">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-base-text">Salin Struktur & BOM dari Project Lain</p>
              <p className="text-xs text-base-muted mt-1">
                Belum ada material untuk project ini. Anda bisa menyalin dari project dengan GA Number yang sama kapan saja.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCopyBomModal(true)}
              className="px-3 py-1.5 bg-base-accent hover:bg-base-accent/80 text-black text-xs font-bold font-sans uppercase rounded-lg shadow transition duration-200 cursor-pointer"
            >
              Lihat & Salin
            </button>
            <button
              onClick={() => setDismissedProjects(prev => ({ ...prev, [selectedProjectId]: true }))}
              className="p-1.5 hover:bg-base-surface3 rounded-full text-base-muted hover:text-base-text transition-all cursor-pointer"
              title="Sembunyikan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* FILTER & TABS SECTION */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-base-text font-bold font-sans text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-base-accent" />
            Active Trackings
          </div>

          {/* Search, Target Month and Project Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted" />
              <input
                type="text"
                placeholder="Search material or drawing..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-base-accent"
              />
            </div>

            {/* Target Month Selector */}
            <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border rounded-lg px-3 py-1.5 text-sm text-base-text font-condensed">
              <Calendar className="h-4 w-4 text-base-muted" />
              <select
                value={selectedMonthFilter}
                onChange={e => {
                  setSelectedMonthFilter(e.target.value);
                  setSelectedProjectId(''); // Reset project filter on month change
                }}
                className="bg-transparent border-none text-base-text focus:outline-none cursor-pointer pr-1"
              >
                <option value="" className="bg-base-surface text-base-text">All Months</option>
                {uniqueTargetMonths.map(m => {
                  let label = m;
                  try {
                    const [year, month] = m.split('-');
                    const date = new Date(Number(year), Number(month) - 1, 1);
                    label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  } catch (_) {}
                  return (
                    <option key={m} value={m} className="bg-base-surface text-base-text">
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {!selectedProjectId ? (
              <div className="p-12 text-center text-base-muted bg-base-surface border border-base-border rounded-xl shadow-sm max-w-xl mx-auto flex flex-col items-center gap-3">
                <div className="p-3 bg-base-accent/5 text-base-accent rounded-full border border-base-accent/10">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-sm text-base-text">No Project Selected</h3>
                <p className="text-xs text-base-muted max-w-md">
                  Please search or select a project in the <strong>Project Workspace Selector</strong> above to display and track its materials.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-lg border border-base-border bg-base-surface shadow-sm">
                <table className="w-full border-collapse text-left min-w-[1000px]">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted sticky top-0 z-10">
                      <th className="py-2.5 px-3 min-w-[150px]">Project</th>
                      <th className="py-2.5 px-3 min-w-[100px]">GA No</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Material Name & Part No</th>
                      <th className="py-2.5 px-3 text-center w-24">Qty</th>
                      {['nesting', 'cnc', 'bending', 'machining'].map(stageKey => {
                        const st = PROCESSING_STAGES[stageKey as ProcessingStageKey];
                        return (
                          <th key={stageKey} className="py-2.5 px-3 text-center w-28">
                            <div className="flex items-center justify-center gap-1">
                              <span>{st.icon}</span>
                              <span>{st.label}</span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-3 text-center w-28">Overall %</th>
                      {!isReadOnly && <th className="py-2.5 px-3 text-center w-12">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border/40 text-xs">
                    {filteredProcessings.length === 0 ? (
                       <tr>
                        <td colSpan={11} className="py-12 text-center text-base-muted">
                           No materials found matching filters.
                         </td>
                       </tr>
                     ) : (
                       filteredProcessings.map((mp) => {
                         return (
                           <tr key={mp.id} className="hover:bg-base-surface2/25 transition-colors h-[38px]">
                             {/* Project Column */}
                             <td className="py-1 px-3 max-w-[150px] truncate" title={mp.projectName}>
                               <div className="font-semibold text-base-text truncate">
                                 {mp.projectName}
                               </div>
                               <div className="text-[10px] text-base-muted font-mono truncate">
                                 WO: {mp.workOrder}
                               </div>
                             </td>

                             {/* GA No Column */}
                             <td className="py-1 px-3 font-mono text-[10px] text-base-muted font-bold">
                               {mp.gaNumber || '—'}
                             </td>

                            {/* Material Name + Part No Column */}
                            <td className="py-1 px-3">
                              <div className="font-bold text-base-text truncate" title={mp.materialName}>
                                {mp.materialName}
                              </div>
                              <div className="text-[10px] text-base-muted font-mono truncate">
                                {mp.partNo ? `Part: ${mp.partNo}` : 'No Part No'}
                              </div>
                            </td>

                            {/* Qty Column */}
                            <td className="py-1 px-3 text-center font-bold text-base-text font-mono">
                              {mp.qty} <span className="text-[10px] font-normal text-base-muted">{mp.unit}</span>
                            </td>

                            {/* Stage Columns */}
                            {(['nesting', 'cnc', 'bending', 'machining'] as ProcessingStageKey[]).map(stageKey => {
                              const isApp = mp.activeStages.includes(stageKey);
                              const sd = mp.stages[stageKey];
                              if (!isApp) {
                                return (
                                  <td
                                    key={stageKey}
                                    className="py-1 px-3 text-center text-base-muted bg-base-surface2/20 text-xs select-none"
                                  >
                                    —
                                  </td>
                                );
                              }

                              const pct = sd?.pct ?? 0;
                              const status = sd?.status ?? 'pending';

                              let cellBgClass = "";
                              if (status === 'done') {
                                cellBgClass = "bg-emerald-500/10 text-emerald-500";
                              } else if (status === 'in-progress') {
                                cellBgClass = "bg-amber-500/10 text-amber-500";
                              } else if (status === 'skipped') {
                                cellBgClass = "bg-neutral-800/10 text-base-muted";
                              }

                              return (
                                <td key={stageKey} className={`py-1 px-3 text-center transition-colors ${cellBgClass}`}>
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={pct}
                                      disabled={isReadOnly}
                                      onChange={(e) => {
                                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                        let nextStatus: ProcessingStatus = 'in-progress';
                                        if (val === 100) nextStatus = 'done';
                                        else if (val === 0) nextStatus = 'pending';
                                        
                                        onUpdateStage(mp.projectId, mp.id, stageKey, {
                                          pct: val,
                                          status: nextStatus,
                                          operator: sd?.operator || currentUser.name
                                        });
                                      }}
                                      className="w-12 px-1 py-0.5 bg-base-bg text-base-text border border-base-border hover:border-base-border2 rounded text-xs font-semibold text-center focus:border-base-accent focus:outline-none"
                                    />
                                    <span className="text-[10px] text-base-muted font-bold mr-1">%</span>
                                    
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUpdateStage(mp, stageKey)}
                                      className="p-1 text-base-muted hover:text-base-accent hover:bg-base-surface3 rounded transition cursor-pointer"
                                      title="Edit Operator, Dates & Remarks"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              );
                            })}

                            {/* Overall % Column */}
                            <td className="py-1 px-3">
                              <div className="text-center font-bold font-mono text-base-text text-xs">
                                {mp.overallPct}%
                              </div>
                              <div className="w-full bg-base-surface3 rounded-full h-1 overflow-hidden mt-1">
                                <div
                                  className="h-full bg-base-accent rounded-full transition-all duration-300"
                                  style={{ width: `${mp.overallPct}%` }}
                                />
                              </div>
                            </td>

                            {/* Action Column */}
                            {!isReadOnly && (
                              <td className="py-1 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (setDeleteConfirm) {
                                      setDeleteConfirm({
                                        isOpen: true,
                                        title: 'Delete Material Processing',
                                        message: `Are you sure you want to permanently delete the tracking for "${mp.materialName}"?`,
                                        onConfirm: () => {
                                          onDelete(mp.projectId, mp.id);
                                          setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
                                        }
                                      });
                                    } else if (confirm('Are you sure you want to delete this material processing tracking?')) {
                                      onDelete(mp.projectId, mp.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-red-500/10 text-base-muted hover:text-red-500 rounded transition cursor-pointer"
                                  title="Delete Material"
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
            )}
          </div>

      {/* ================= ADD MATERIAL MODAL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-base-surface border border-base-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-border bg-base-surface2">
              <h2 className="text-lg font-bold font-sans text-base-text flex items-center gap-2">
                <Plus className="h-5 w-5 text-base-accent" />
                Track Material Processing
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-base-surface3 rounded-lg transition text-base-muted hover:text-base-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Project selector */}
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Project *
                  </label>
                  <ProjectSearchSelector
                    projects={projects}
                    selectedId={formProjectId}
                    onChange={handleFormProjectChange}
                    placeholder=""
                    required={true}
                    showAllProjectsOption={false}
                  />
                </div>

                {/* Assembly Link */}
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Assembly Link (Optional)
                  </label>
                  <select
                    value={formAssemblyId}
                    onChange={e => setFormAssemblyId(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent font-sans"
                  >
                    <option value="">No Assembly Link</option>
                    {(projects.find(p => p.id === formProjectId)?.assemblies || []).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Material Name */}
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                      Material Name *
                    </label>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-base-surface3 border border-base-border text-base-text rounded-md">
                      GA: {formGaNumber || '—'}
                    </span>
                  </div>
                  <MasterDataAutocomplete
                    category="material"
                    value={formMaterialName}
                    onChange={setFormMaterialName}
                    placeholder="e.g. Plate SS304 6mm"
                    entries={masterDataEntries}
                    required
                    className="bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  />
                </div>

                {/* Part No */}
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Part / Drawing No
                  </label>
                  <MasterDataAutocomplete
                    category="partNo"
                    value={formPartNo}
                    onChange={setFormPartNo}
                    placeholder="e.g. DWG-002-PT4"
                    entries={masterDataEntries}
                    className="bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  />
                </div>

                {/* Thickness */}
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Thickness (e.g. 6mm)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6mm"
                    value={formThickness}
                    onChange={e => setFormThickness(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  />
                </div>

                {/* Material Type selector */}
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Material Type
                  </label>
                  <select
                    value={formMaterialType}
                    onChange={e => setFormMaterialType(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  >
                    <option value="SS304">SS304</option>
                    <option value="SS316">SS316</option>
                    <option value="CS A36">CS A36</option>
                    <option value="Aluminium">Aluminium</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Description / Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cover plates, CNC cut"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formQty}
                    onChange={e => setFormQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  />
                </div>

                {/* Unit */}
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                    Unit *
                  </label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                  >
                    <option value="pcs">pcs</option>
                    <option value="sheet">sheet</option>
                    <option value="kg">kg</option>
                    <option value="m">m</option>
                    <option value="set">set</option>
                  </select>
                </div>

                {/* Active Stages Checkboxes */}
                <div className="col-span-2 space-y-2 border-t border-base-border pt-3 mt-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider block">
                    Active Shop-Floor Stages *
                  </label>
                  <div className="grid grid-cols-2 gap-3 bg-base-surface2 p-3 rounded-lg border border-base-border">
                    {(['nesting', 'cnc', 'bending', 'machining'] as ProcessingStageKey[]).map(
                      key => {
                        const info = PROCESSING_STAGES[key];
                        const isChecked = formActiveStages.includes(key);

                        return (
                          <label
                            key={key}
                            className="flex items-center gap-2 text-sm text-base-text cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleStageToggle(key)}
                              className="accent-base-accent h-4 w-4"
                            />
                            <span className="flex items-center gap-1">
                              <span>{info.icon}</span>
                              <span className="font-medium">{info.label}</span>
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-base-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-transparent text-base-muted hover:text-base-text font-condensed font-bold uppercase text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-base-accent hover:bg-base-accent/80 text-black font-condensed font-bold uppercase text-xs rounded-lg shadow cursor-pointer transition"
                >
                  Confirm & Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= STAGE UPDATE MODAL ================= */}
      {updatingStageInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-base-surface border border-base-border rounded-xl shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-border bg-base-surface2">
              <h2 className="text-base font-bold font-sans text-base-text flex items-center gap-2">
                <span>{PROCESSING_STAGES[updatingStageInfo.stageKey].icon}</span>
                Update {PROCESSING_STAGES[updatingStageInfo.stageKey].label} Stage
              </h2>
              <button
                onClick={() => setUpdatingStageInfo(null)}
                className="p-1 hover:bg-base-surface3 rounded-lg transition text-base-muted hover:text-base-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitStageUpdate} className="p-6 space-y-4">
              <div className="text-xs text-base-muted bg-base-surface2 border border-base-border rounded-lg p-2.5">
                <span className="font-bold uppercase font-condensed tracking-wider text-base-accent block">
                  Material Details
                </span>
                <span className="font-bold text-sm text-base-text block mt-0.5">
                  {updatingStageInfo.mp.materialName}
                </span>
                <span className="block mt-0.5">
                  Project: {updatingStageInfo.mp.projectName} (WO:{' '}
                  {updatingStageInfo.mp.workOrder})
                </span>
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                  Processing Status
                </label>
                <select
                  value={stageStatus}
                  onChange={e => handleStatusChange(e.target.value as ProcessingStatus)}
                  className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent font-sans"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done ✓</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>

              {/* Progress Slider */}
              {stageStatus !== 'skipped' && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                      Completion Progress
                    </label>
                    <span className="font-mono text-sm font-bold text-base-accent">
                      {stagePct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={stagePct}
                    onChange={e => setStagePct(Number(e.target.value))}
                    disabled={stageStatus === 'pending'}
                    className="w-full accent-base-accent bg-base-surface3 rounded-lg appearance-none h-2 cursor-pointer disabled:opacity-50"
                  />
                </div>
              )}

              {/* Dates Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={stageStartDate}
                    onChange={e => setStageStartDate(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Completion Date
                  </label>
                  <input
                    type="date"
                    value={stageDoneDate}
                    onChange={e => setStageDoneDate(e.target.value)}
                    disabled={stageStatus !== 'done'}
                    className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Operator */}
              <div className="space-y-1">
                <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> Operator Name
                </label>
                <input
                  type="text"
                  placeholder="Who is working on this?"
                  value={stageOperator}
                  onChange={e => setStageOperator(e.target.value)}
                  className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs text-base-muted font-condensed font-bold uppercase tracking-wider">
                  Remarks / Internal Notes
                </label>
                <textarea
                  placeholder="Add details, issue notes, machine specs..."
                  rows={2}
                  value={stageNotes}
                  onChange={e => setStageNotes(e.target.value)}
                  className="w-full bg-base-surface2 border border-base-border text-base-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent"
                />
              </div>

              {/* Save Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-base-border pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setUpdatingStageInfo(null)}
                  className="px-4 py-2 bg-transparent text-base-muted hover:text-base-text font-condensed font-bold uppercase text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-base-accent hover:bg-base-accent/80 text-black font-condensed font-bold uppercase text-xs rounded-lg shadow cursor-pointer transition"
                >
                  Save Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COPY BOM MODAL */}
      {selectedProjectId && currentProject && (
        <CopyBomModal
          isOpen={showCopyBomModal}
          onClose={() => setShowCopyBomModal(false)}
          currentProject={currentProject}
          gaMatchCandidates={gaMatchCandidates}
          currentUser={currentUser}
          onAdd={onAdd}
          onCopyStructure={onCopyStructure}
          onSuccess={(message) => {
            alert(message);
          }}
        />
      )}
    </div>
  );
}
