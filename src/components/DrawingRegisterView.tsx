import React, { useState, useMemo } from 'react';
import { DrawingRevision, Project, User } from '../types';
import { 
  Search, Plus, Eye, CornerUpRight, Ban, Trash2, X, FileText, 
  ExternalLink, Layers, CheckCircle2, Clock, AlertTriangle, FileBadge,
  Filter, Calendar, User as UserIcon, Building2, Tag, ChevronRight
} from 'lucide-react';

interface DrawingRegisterViewProps {
  drawings?: DrawingRevision[];
  projects?: Project[];
  currentUser?: User | null;
  onAddDrawing: (drawing: Omit<DrawingRevision, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByName' | 'status'> & { revision: string }) => Promise<void>;
  onReviseDrawing: (oldDrawingId: string, newDrawing: Omit<DrawingRevision, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByName' | 'status'> & { revision: string }) => Promise<void>;
  onVoidDrawing: (id: string) => Promise<void>;
  onDeleteDrawing?: (id: string) => Promise<void>;
}

export default function DrawingRegisterView({
  drawings = [],
  projects = [],
  currentUser,
  onAddDrawing,
  onReviseDrawing,
  onVoidDrawing,
  onDeleteDrawing
}: DrawingRegisterViewProps) {
  // Permission Check
  const normalizedRole = (currentUser?.role || '').toLowerCase();
  const canEdit = ['admin', 'manager', 'coordinator', 'project control', 'project_control'].includes(normalizedRole);
  const canDeletePermanent = normalizedRole === 'admin';

  // State Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'superseded' | 'void'>('active');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingRevision | null>(null);
  
  // Revise Mode State
  const [reviseSourceDrawing, setReviseSourceDrawing] = useState<DrawingRevision | null>(null);

  // Duplicate Warning Modal
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isOpen: boolean;
    existingDrawing: DrawingRevision | null;
    pendingData: Omit<DrawingRevision, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByName' | 'status'> & { revision: string } | null;
  }>({
    isOpen: false,
    existingDrawing: null,
    pendingData: null
  });

  // Void Confirm Modal
  const [voidConfirmModal, setVoidConfirmModal] = useState<{
    isOpen: boolean;
    drawing: DrawingRevision | null;
  }>({
    isOpen: false,
    drawing: null
  });

  // Form Fields
  const [formData, setFormData] = useState({
    drawingNumber: '',
    title: '',
    revision: '',
    discipline: 'structural' as DrawingRevision['discipline'],
    projectId: '',
    notes: '',
    fileUrl: '',
    fileName: ''
  });

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeDrawings = Array.isArray(drawings) ? drawings : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  // Unique Drawing Numbers for Autocomplete
  const existingDrawingNumbers = useMemo(() => {
    const set = new Set<string>();
    safeDrawings.forEach(d => {
      if (d?.drawingNumber) set.add(d.drawingNumber);
    });
    return Array.from(set).sort();
  }, [safeDrawings]);

  // Unique Drawing Titles map by Drawing Number
  const existingTitleByNumber = useMemo(() => {
    const map = new Map<string, string>();
    safeDrawings.forEach(d => {
      if (d?.drawingNumber) {
        if (!map.has(d.drawingNumber) || d.status === 'active') {
          map.set(d.drawingNumber, d.title || '');
        }
      }
    });
    return map;
  }, [safeDrawings]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalDrawings = safeDrawings.length;
    const activeCount = safeDrawings.filter(d => d.status === 'active').length;
    
    // Superseded this month
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const supersededThisMonth = safeDrawings.filter(
      d => d.status === 'superseded' && d.uploadedAt && d.uploadedAt.startsWith(currentMonthPrefix)
    ).length;

    // Projects with active drawings
    const activeProjects = new Set(
      safeDrawings.filter(d => d.status === 'active' && d.projectId).map(d => d.projectId)
    );

    return {
      totalDrawings,
      activeCount,
      supersededThisMonth,
      activeProjectsCount: activeProjects.size
    };
  }, [safeDrawings]);

  // Filtered List for Table
  const filteredDrawings = useMemo(() => {
    return safeDrawings.filter(d => {
      // Search Filter
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchNo = (d.drawingNumber || '').toLowerCase().includes(q);
        const matchTitle = (d.title || '').toLowerCase().includes(q);
        const matchProj = (d.projectName || '').toLowerCase().includes(q);
        if (!matchNo && !matchTitle && !matchProj) return false;
      }

      // Status Filter
      if (statusFilter !== 'all' && d.status !== statusFilter) {
        return false;
      }

      // Discipline Filter
      if (disciplineFilter !== 'all' && d.discipline !== disciplineFilter) {
        return false;
      }

      // Project Filter
      if (projectFilter !== 'all' && d.projectId !== projectFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  }, [safeDrawings, searchQuery, statusFilter, disciplineFilter, projectFilter]);

  // Helpers for Revision Badge Color
  const getRevisionBadgeStyle = (rev: string) => {
    const firstChar = rev.trim().toUpperCase().charAt(0);
    if (firstChar === 'A') return 'bg-base-blue-dim text-base-blue border-base-blue/30';
    if (firstChar === 'B') return 'bg-base-accent-dim text-base-accent border-base-accent/30';
    return 'bg-base-red-dim text-base-red border-base-red/30';
  };

  // Open Modal to Add
  const handleOpenAddModal = () => {
    setReviseSourceDrawing(null);
    setFormData({
      drawingNumber: '',
      title: '',
      revision: 'A',
      discipline: 'structural',
      projectId: '',
      notes: '',
      fileUrl: '',
      fileName: ''
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Open Modal to Revise
  const handleOpenReviseModal = (drawing: DrawingRevision, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviseSourceDrawing(drawing);

    // Increment revision letter if standard single char, or append .1
    let nextRev = 'B';
    const currentRev = drawing.revision.trim().toUpperCase();
    if (currentRev.length === 1 && currentRev >= 'A' && currentRev < 'Z') {
      nextRev = String.fromCharCode(currentRev.charCodeAt(0) + 1);
    } else {
      nextRev = currentRev + '.1';
    }

    setFormData({
      drawingNumber: drawing.drawingNumber,
      title: drawing.title,
      revision: nextRev,
      discipline: drawing.discipline,
      projectId: drawing.projectId || '',
      notes: '',
      fileUrl: drawing.fileUrl || '',
      fileName: drawing.fileName || ''
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Handle Autocomplete selection of Drawing Number
  const handleDrawingNumberChange = (num: string) => {
    const upperNum = num.toUpperCase();
    const existingTitle = existingTitleByNumber.get(upperNum) || existingTitleByNumber.get(num);
    
    // Find latest active drawing with this number to prefill discipline/project
    const existing = safeDrawings.find(d => (d.drawingNumber || '').toUpperCase() === upperNum && d.status === 'active');

    setFormData(prev => ({
      ...prev,
      drawingNumber: upperNum,
      title: existingTitle || prev.title,
      discipline: existing ? existing.discipline : prev.discipline,
      projectId: existing?.projectId || prev.projectId
    }));
  };

  // Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanNumber = formData.drawingNumber.trim().toUpperCase();
    const cleanTitle = formData.title.trim();
    const cleanRev = formData.revision.trim().toUpperCase();

    if (!cleanNumber) {
      setFormError('Drawing Number is required');
      return;
    }
    if (!cleanTitle) {
      setFormError('Drawing Title is required');
      return;
    }
    if (!cleanRev) {
      setFormError('Revision identifier is required');
      return;
    }

    const selectedProj = safeProjects.find(p => p.id === formData.projectId);

    const payload = {
      drawingNumber: cleanNumber,
      title: cleanTitle,
      revision: cleanRev,
      discipline: formData.discipline,
      projectId: formData.projectId || undefined,
      projectName: selectedProj ? selectedProj.name : undefined,
      notes: formData.notes.trim() || undefined,
      fileUrl: formData.fileUrl.trim() || undefined,
      fileName: formData.fileName.trim() || undefined,
    };

    // Check if drawingNumber + revision already exists as 'active'
    const activeDuplicate = safeDrawings.find(
      d => (d.drawingNumber || '').toUpperCase() === cleanNumber &&
           (d.revision || '').toUpperCase() === cleanRev &&
           d.status === 'active'
    );

    if (activeDuplicate) {
      // If revising the same drawing source, prompt warning
      setDuplicateWarning({
        isOpen: true,
        existingDrawing: activeDuplicate,
        pendingData: payload
      });
      return;
    }

    // If this is a revision of an existing active drawing with the same drawingNumber
    const currentActiveDrawing = safeDrawings.find(
      d => (d.drawingNumber || '').toUpperCase() === cleanNumber && d.status === 'active'
    );

    setIsSubmitting(true);
    try {
      if (reviseSourceDrawing) {
        await onReviseDrawing(reviseSourceDrawing.id, payload);
      } else if (currentActiveDrawing) {
        // Automatically supersede previous active version
        await onReviseDrawing(currentActiveDrawing.id, payload);
      } else {
        await onAddDrawing(payload);
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save drawing revision');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Duplicate Overwrite / Revise
  const handleConfirmDuplicateRevise = async () => {
    if (!duplicateWarning.pendingData || !duplicateWarning.existingDrawing) return;
    setIsSubmitting(true);
    try {
      await onReviseDrawing(duplicateWarning.existingDrawing.id, duplicateWarning.pendingData);
      setDuplicateWarning({ isOpen: false, existingDrawing: null, pendingData: null });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to execute revision override');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Void
  const handleConfirmVoid = async () => {
    if (!voidConfirmModal.drawing) return;
    try {
      await onVoidDrawing(voidConfirmModal.drawing.id);
      setVoidConfirmModal({ isOpen: false, drawing: null });
    } catch (err) {
      console.error('Failed to void drawing:', err);
    }
  };

  // Revision History for Detail View
  const revisionHistory = useMemo(() => {
    if (!selectedDrawing) return [];
    return safeDrawings
      .filter(d => (d.drawingNumber || '').toUpperCase() === (selectedDrawing.drawingNumber || '').toUpperCase())
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  }, [safeDrawings, selectedDrawing]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      
      {/* ════════════════════════════════════════════════════════════════════
          PANEL KIRI — SIDEBAR FILTER & MINI STATS (~260px)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-5">
        
        {/* Header Action / Search */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
              <Filter className="h-4 w-4 text-base-accent" />
              Drawing Control
            </h2>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-base-muted" />
            <input
              type="text"
              placeholder="Search Drawing No / Title..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-base-bg border border-base-border pl-9 pr-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-base-muted hover:text-base-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Toggle Pills */}
          <div>
            <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-2 block">
              Status Filter
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-base-bg p-1 rounded-lg border border-base-border text-[11px] font-condensed font-bold uppercase">
              {(['active', 'all', 'superseded', 'void'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`py-1.5 px-2 rounded-md transition-all text-center cursor-pointer ${
                    statusFilter === st
                      ? 'bg-base-accent text-white shadow-sm'
                      : 'text-base-muted hover:text-base-text hover:bg-base-surface'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Discipline Filter */}
          <div>
            <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1.5 block">
              Discipline
            </label>
            <select
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value)}
              className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
            >
              <option value="all">All Disciplines</option>
              <option value="structural">Structural</option>
              <option value="mechanical">Mechanical</option>
              <option value="welding">Welding</option>
              <option value="assembly">Assembly</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1.5 block">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mini Stats (4 items) */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="bg-base-surface border border-base-border p-3.5 rounded-xl shadow-card flex items-center justify-between">
            <div>
              <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Total Drawings</p>
              <p className="text-xl font-condensed font-black text-base-text">{stats.totalDrawings}</p>
            </div>
            <FileBadge className="h-6 w-6 text-base-accent opacity-80" />
          </div>

          <div className="bg-base-surface border border-base-border p-3.5 rounded-xl shadow-card flex items-center justify-between border-l-4 border-l-base-green">
            <div>
              <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Active Drawings</p>
              <p className="text-xl font-condensed font-black text-base-green">{stats.activeCount}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-base-green opacity-80" />
          </div>

          <div className="bg-base-surface border border-base-border p-3.5 rounded-xl shadow-card flex items-center justify-between">
            <div>
              <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Superseded Mo.</p>
              <p className="text-xl font-condensed font-black text-base-muted">{stats.supersededThisMonth}</p>
            </div>
            <Clock className="h-6 w-6 text-base-muted opacity-80" />
          </div>

          <div className="bg-base-surface border border-base-border p-3.5 rounded-xl shadow-card flex items-center justify-between">
            <div>
              <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">Projects Linked</p>
              <p className="text-xl font-condensed font-black text-base-blue">{stats.activeProjectsCount}</p>
            </div>
            <Building2 className="h-6 w-6 text-base-blue opacity-80" />
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          PANEL KANAN — MAIN CONTENT (DRAWING REGISTER TABLE)
         ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* Top Action Bar */}
        <div className="bg-base-surface border border-base-border p-4 rounded-xl shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-condensed font-extrabold text-base-text uppercase tracking-wide flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-base-accent" />
              Engineering Drawing Register
            </h1>
            <p className="text-xs text-base-muted">
              Revision control & PDF drawing records for dump truck fabrication
            </p>
          </div>

          {canEdit && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-base-accent hover:bg-base-accent-hover text-white font-condensed font-bold uppercase tracking-wider text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Drawing
            </button>
          )}
        </div>

        {/* Table Container */}
        <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  <th className="py-3 px-4">Drawing No.</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 text-center">Rev</th>
                  <th className="py-3 px-4">Discipline</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-border text-xs">
                {filteredDrawings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-base-muted">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40 text-base-muted" />
                      <p className="font-condensed font-bold uppercase tracking-wider">No drawings found</p>
                      <p className="text-[11px] mt-1">Try adjusting search query or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredDrawings.map(d => {
                    const isSupersededOrVoid = d.status === 'superseded' || d.status === 'void';

                    return (
                      <tr 
                        key={d.id}
                        onClick={() => {
                          setSelectedDrawing(d);
                          setIsDetailModalOpen(true);
                        }}
                        className={`hover:bg-base-surface2/80 transition-colors cursor-pointer ${
                          isSupersededOrVoid ? 'opacity-60 bg-base-surface2/30' : ''
                        }`}
                      >
                        {/* Drawing No */}
                        <td className="py-3 px-4 font-mono font-bold text-base-accent whitespace-nowrap">
                          {d.drawingNumber}
                        </td>

                        {/* Title */}
                        <td className="py-3 px-4 font-medium text-base-text max-w-[220px] truncate" title={d.title}>
                          <span className={d.status === 'superseded' ? 'line-through text-base-muted' : ''}>
                            {d.title}
                          </span>
                        </td>

                        {/* Revision Badge */}
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-condensed font-extrabold border ${getRevisionBadgeStyle(d.revision)}`}>
                            {d.revision}
                          </span>
                        </td>

                        {/* Discipline */}
                        <td className="py-3 px-4 font-condensed font-bold uppercase tracking-wider text-[11px] text-base-muted">
                          {d.discipline}
                        </td>

                        {/* Project */}
                        <td className="py-3 px-4 text-base-muted truncate max-w-[140px]">
                          {d.projectName || '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {d.status === 'active' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-base-green-dim text-base-green border border-base-green/20 text-[10px] font-condensed font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-base-green animate-pulse" />
                              ACTIVE
                            </span>
                          )}
                          {d.status === 'superseded' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-base-surface2 text-base-muted border border-base-border text-[10px] font-condensed font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-base-muted" />
                              SUPERSEDED
                            </span>
                          )}
                          {d.status === 'void' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-base-red-dim text-base-red border border-base-red/20 text-[10px] font-condensed font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-base-red" />
                              VOID
                            </span>
                          )}
                        </td>

                        {/* Uploaded By */}
                        <td className="py-3 px-4 text-base-muted text-[11px]">
                          {d.uploadedByName}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-base-muted text-[11px] whitespace-nowrap">
                          {d.uploadedAt ? d.uploadedAt.slice(0, 10) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            
                            {/* View File / Details */}
                            {d.fileUrl ? (
                              <a
                                href={d.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open Drawing File"
                                className="p-1.5 rounded hover:bg-base-surface2 text-base-accent hover:text-base-accent-hover transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedDrawing(d);
                                  setIsDetailModalOpen(true);
                                }}
                                title="View Details"
                                className="p-1.5 rounded hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}

                            {/* Revise Button */}
                            {canEdit && d.status === 'active' && (
                              <button
                                onClick={(e) => handleOpenReviseModal(d, e)}
                                title="Create New Revision"
                                className="p-1.5 rounded hover:bg-base-accent-dim text-base-accent transition-colors cursor-pointer"
                              >
                                <CornerUpRight className="h-4 w-4" />
                              </button>
                            )}

                            {/* Void Button */}
                            {canEdit && d.status !== 'void' && (
                              <button
                                onClick={() => setVoidConfirmModal({ isOpen: true, drawing: d })}
                                title="Void Drawing"
                                className="p-1.5 rounded hover:bg-base-red-dim text-base-red transition-colors cursor-pointer"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}

                            {/* Admin Permanent Delete */}
                            {canDeletePermanent && onDeleteDrawing && (
                              <button
                                onClick={() => onDeleteDrawing(d.id)}
                                title="Delete Permanently"
                                className="p-1.5 rounded hover:bg-base-red-dim text-base-red transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 1: ADD / REVISE DRAWING
         ════════════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text flex items-center gap-2">
                <FileBadge className="h-5 w-5 text-base-accent" />
                {reviseSourceDrawing ? `New Revision for ${reviseSourceDrawing.drawingNumber}` : 'Register New Drawing'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-base-muted hover:text-base-text p-1 rounded-md cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-base-red-dim border border-base-red/30 text-base-red rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Drawing Number */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Drawing Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. AB-DT-001"
                  value={formData.drawingNumber}
                  onChange={e => handleDrawingNumberChange(e.target.value)}
                  disabled={!!reviseSourceDrawing}
                  list="drawing-numbers-list"
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono font-bold text-base-text focus:outline-none focus:border-base-accent disabled:opacity-60"
                  required
                />
                <datalist id="drawing-numbers-list">
                  {existingDrawingNumbers.map(num => (
                    <option key={num} value={num} />
                  ))}
                </datalist>
                <p className="text-[10px] text-base-muted mt-1">
                  Use standard format e.g. AB-DT-001. Select existing drawing number to automatically create revision.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Drawing Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Floor Plate Assembly - Ultima 793"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                  required
                />
              </div>

              {/* Revision & Discipline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Revision *
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="e.g. A, B, C1"
                    value={formData.revision}
                    onChange={e => setFormData({ ...formData, revision: e.target.value.toUpperCase() })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs font-mono font-extrabold uppercase text-base-text focus:outline-none focus:border-base-accent"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                    Discipline *
                  </label>
                  <select
                    value={formData.discipline}
                    onChange={e => setFormData({ ...formData, discipline: e.target.value as any })}
                    className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                  >
                    <option value="structural">Structural</option>
                    <option value="mechanical">Mechanical</option>
                    <option value="welding">Welding</option>
                    <option value="assembly">Assembly</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              {/* Project */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Link to Project (Optional)
                </label>
                <select
                  value={formData.projectId}
                  onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent cursor-pointer"
                >
                  <option value="">-- Unlinked / General --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Revision Notes */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Revision Notes / Scope of Change
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe what was modified in this revision..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-base-bg border border-base-border p-3 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                />
              </div>

              {/* File Storage URL (Drive/SharePoint) */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  File Storage Link (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or SharePoint link"
                  value={formData.fileUrl}
                  onChange={e => setFormData({ ...formData, fileUrl: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                />
                <p className="text-[10px] text-base-muted mt-1">
                  Paste Google Drive / SharePoint shareable PDF link for quick view.
                </p>
              </div>

              {/* File Name */}
              <div>
                <label className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 block">
                  Original File Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AB-DT-001-RevB_FloorPlate.pdf"
                  value={formData.fileName}
                  onChange={e => setFormData({ ...formData, fileName: e.target.value })}
                  className="w-full bg-base-bg border border-base-border px-3 py-2 rounded-lg text-xs text-base-text focus:outline-none focus:border-base-accent"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-base-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-base-accent hover:bg-base-accent-hover text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wider shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Saving...' : 'Save Drawing'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 2: DUPLICATE REVISION WARNING
         ════════════════════════════════════════════════════════════════════ */}
      {duplicateWarning.isOpen && duplicateWarning.existingDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-base-accent">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text">
                Active Revision Exists
              </h3>
            </div>

            <p className="text-xs text-base-muted leading-relaxed">
              Drawing <strong className="text-base-accent">{duplicateWarning.existingDrawing.drawingNumber}</strong> Rev <strong className="text-base-accent">{duplicateWarning.existingDrawing.revision}</strong> already exists and is currently <span className="text-base-green font-bold">ACTIVE</span>.
            </p>

            <div className="p-3 bg-base-surface2 border border-base-border rounded-lg text-xs space-y-1">
              <p><span className="text-base-muted">Title:</span> {duplicateWarning.existingDrawing.title}</p>
              <p><span className="text-base-muted">Uploaded By:</span> {duplicateWarning.existingDrawing.uploadedByName}</p>
            </div>

            <p className="text-xs text-base-text">
              Do you want to create this new revision anyway? The existing revision will automatically be marked as <strong className="text-base-muted">SUPERSEDED</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-border">
              <button
                onClick={() => setDuplicateWarning({ isOpen: false, existingDrawing: null, pendingData: null })}
                className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDuplicateRevise}
                disabled={isSubmitting}
                className="px-4 py-2 bg-base-accent hover:bg-base-accent-hover text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
              >
                {isSubmitting ? 'Processing...' : 'Confirm New Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 3: DRAWING DETAIL & REVISION HISTORY
         ════════════════════════════════════════════════════════════════════ */}
      {isDetailModalOpen && selectedDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Detail Header */}
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <div>
                <span className="font-mono font-bold text-base-accent text-sm">
                  {selectedDrawing.drawingNumber}
                </span>
                <h3 className="font-condensed font-extrabold text-base text-base-text mt-0.5">
                  {selectedDrawing.title}
                </h3>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="text-base-muted hover:text-base-text p-1 rounded-md cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Detail Content */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-base-surface2 border border-base-border rounded-xl text-xs">
                <div>
                  <p className="text-[10px] font-condensed font-bold uppercase text-base-muted">Current Status</p>
                  <p className="font-bold text-base-text mt-0.5 uppercase">{selectedDrawing.status}</p>
                </div>
                <div>
                  <p className="text-[10px] font-condensed font-bold uppercase text-base-muted">Discipline</p>
                  <p className="font-bold text-base-text mt-0.5 uppercase">{selectedDrawing.discipline}</p>
                </div>
                <div>
                  <p className="text-[10px] font-condensed font-bold uppercase text-base-muted">Revision</p>
                  <p className="font-mono font-extrabold text-base-accent mt-0.5">{selectedDrawing.revision}</p>
                </div>
                <div>
                  <p className="text-[10px] font-condensed font-bold uppercase text-base-muted">Project</p>
                  <p className="font-bold text-base-text mt-0.5 truncate">{selectedDrawing.projectName || '—'}</p>
                </div>
              </div>

              {/* File Storage View */}
              {selectedDrawing.fileUrl ? (
                <div className="p-4 bg-base-bg border border-base-border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-base-accent" />
                    <div>
                      <p className="text-xs font-bold text-base-text">{selectedDrawing.fileName || 'Drawing Document PDF'}</p>
                      <p className="text-[10px] text-base-muted truncate max-w-sm">{selectedDrawing.fileUrl}</p>
                    </div>
                  </div>
                  <a
                    href={selectedDrawing.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-base-accent hover:bg-base-accent-hover text-white font-condensed font-bold text-xs uppercase rounded-lg shadow-sm flex items-center gap-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open PDF
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-base-surface2/50 border border-dashed border-base-border rounded-xl text-center text-base-muted text-xs">
                  <p className="font-condensed font-bold uppercase">File storage link coming soon</p>
                  <p className="text-[11px] mt-0.5">No direct Google Drive or SharePoint URL provided for this drawing revision.</p>
                </div>
              )}

              {/* Revision History Vertical Timeline */}
              <div>
                <h4 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-base-accent" />
                  Revision History Timeline
                </h4>

                <div className="relative pl-6 border-l-2 border-base-border space-y-6">
                  {revisionHistory.map((rev) => (
                    <div key={rev.id} className="relative">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-base-surface ${
                        rev.status === 'active' ? 'bg-base-green' : 'bg-base-muted'
                      }`} />

                      <div className="bg-base-bg border border-base-border p-3.5 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-xs text-base-accent">
                              Rev {rev.revision}
                            </span>
                            <span className={`px-2 py-0.2 rounded text-[9px] font-condensed font-bold uppercase ${
                              rev.status === 'active' ? 'bg-base-green-dim text-base-green' : 'bg-base-surface2 text-base-muted'
                            }`}>
                              {rev.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-base-muted">
                            {rev.uploadedAt ? rev.uploadedAt.slice(0, 10) : ''}
                          </span>
                        </div>

                        <p className="text-xs text-base-text font-medium">
                          Uploaded by <strong className="text-base-text">{rev.uploadedByName}</strong>
                        </p>

                        {rev.notes && (
                          <p className="text-xs text-base-muted italic mt-1 bg-base-surface p-2 rounded border border-base-border/50">
                            "{rev.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-base-border bg-base-surface2 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-base-surface border border-base-border text-base-text hover:bg-base-surface2 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 4: VOID CONFIRMATION
         ════════════════════════════════════════════════════════════════════ */}
      {voidConfirmModal.isOpen && voidConfirmModal.drawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-base-red">
              <Ban className="h-6 w-6 shrink-0" />
              <h3 className="font-condensed font-extrabold text-base uppercase tracking-wider text-base-text">
                Void Drawing
              </h3>
            </div>

            <p className="text-xs text-base-muted leading-relaxed">
              Are you sure you want to set drawing <strong className="text-base-text">{voidConfirmModal.drawing.drawingNumber}</strong> Rev <strong className="text-base-text">{voidConfirmModal.drawing.revision}</strong> to <span className="text-base-red font-bold">VOID</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-border">
              <button
                onClick={() => setVoidConfirmModal({ isOpen: false, drawing: null })}
                className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-base-red hover:bg-red-700 text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wider cursor-pointer"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
