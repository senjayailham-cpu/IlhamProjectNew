import React, { useState, useMemo } from 'react';
import { ShiftHandoverNote, UserRoleType } from '../../types';
import { useShiftHandover } from '../../hooks/useShiftHandover';
import { 
  Pin, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Flame, 
  Plus, 
  History, 
  Edit3, 
  Trash2, 
  X, 
  UserCheck, 
  Sparkles,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Send
} from 'lucide-react';

interface ShiftHandoverSectionProps {
  currentUser?: { name: string; role: UserRoleType } | null;
}

export default function ShiftHandoverSection({ currentUser }: ShiftHandoverSectionProps) {
  const {
    notes,
    pinnedNote,
    pinNote,
    unpinNote,
    togglePin,
    acknowledgeNote,
    updateNote,
    deleteNote
  } = useShiftHandover(currentUser);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ShiftHandoverNote | null>(null);
  const [isHistorySectionExpanded, setIsHistorySectionExpanded] = useState(true);
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');

  // Compose form states
  const [formText, setFormText] = useState('');
  const [formTargetShift, setFormTargetShift] = useState('Night Shift');
  const [formPriority, setFormPriority] = useState<'normal' | 'important' | 'urgent'>('important');
  const [formStation, setFormStation] = useState('');
  const [formAuthor, setFormAuthor] = useState('');

  // Quick preset templates for shop floor coordinators
  const QUICK_TEMPLATES = [
    { label: '🔥 Prioritas WO', text: 'Mohon prioritaskan perakitan dan pengelasan Work Order ' },
    { label: '⚠️ Kendala Mesin / Tool', text: 'Perhatian: Mesin / peralatan sedang dalam pengecekan, harap ' },
    { label: '📦 Menunggu Material / QC', text: 'Menunggu approval QC inspeksi / kedatangan material untuk ' },
    { label: '✅ Progress Selesai', text: 'Shift sebelumnya telah menyelesaikan 100% target untuk ' }
  ];

  // Sort notes chronologically (newest first)
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes]);

  // Last 5 notes for the inline history display
  const last5Notes = useMemo(() => {
    let list = sortedNotes;
    if (selectedShiftFilter !== 'all') {
      list = list.filter(n => n.targetShift.toLowerCase().includes(selectedShiftFilter.toLowerCase()));
    }
    return list.slice(0, 5);
  }, [sortedNotes, selectedShiftFilter]);

  const handleOpenCompose = (noteToEdit?: ShiftHandoverNote) => {
    if (noteToEdit) {
      setEditingNote(noteToEdit);
      setFormText(noteToEdit.note);
      setFormTargetShift(noteToEdit.targetShift);
      setFormPriority(noteToEdit.priority);
      setFormStation(noteToEdit.station || '');
      setFormAuthor(noteToEdit.authorName);
    } else {
      setEditingNote(null);
      setFormText('');
      setFormTargetShift('Night Shift');
      setFormPriority('important');
      setFormStation('');
      setFormAuthor(currentUser?.name || 'Coordinator Lapangan');
    }
    setIsComposeOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    if (editingNote) {
      updateNote(editingNote.id, {
        note: formText.trim(),
        targetShift: formTargetShift,
        priority: formPriority,
        station: formStation.trim(),
        authorName: formAuthor.trim() || currentUser?.name || 'Coordinator Lapangan'
      });
    } else {
      pinNote({
        note: formText.trim(),
        targetShift: formTargetShift,
        priority: formPriority,
        station: formStation.trim(),
        authorName: formAuthor.trim() || currentUser?.name || 'Coordinator Lapangan',
        authorRole: currentUser?.role || 'coordinator'
      });
    }

    setIsComposeOpen(false);
  };

  const currentUserName = currentUser?.name || 'Staff Lapangan';

  // Helper for priority badge colors
  const getPriorityClasses = (priority: 'normal' | 'important' | 'urgent') => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/15 text-red-500 border-red-500/30';
      case 'important':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
      case 'normal':
      default:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
  };

  const formatFullTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return isoString;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      return `${diffDays} hari lalu`;
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-base-surface border-2 border-base-border rounded-2xl p-4 sm:p-6 shadow-md transition-all space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-base-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Pin className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-condensed font-black text-lg sm:text-xl uppercase tracking-wider text-base-text">
                Shift Handover <span className="text-amber-500">& Multi-Shift Log</span>
              </h3>
              {pinnedNote && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-condensed font-extrabold text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Active Pin
                </span>
              )}
            </div>
            <p className="text-xs text-base-muted mt-0.5">
              Komunikasi instruksi kerja, status station & kendala antar shift untuk koordinasi berkelanjutan
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {notes.length > 5 && (
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Lihat seluruh arsip catatan shift"
            >
              <History className="h-3.5 w-3.5" />
              <span>Semua Arsip ({notes.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenCompose()}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-condensed font-black rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Pin Catatan Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Active Pinned Note (Prominently Highlighted if Exists) */}
      {pinnedNote && (
        <div className={`rounded-xl p-4 sm:p-5 border-2 transition-all shadow-sm ${
          pinnedNote.priority === 'urgent' 
            ? 'bg-red-500/5 border-red-500/40 shadow-red-500/5' 
            : pinnedNote.priority === 'important'
            ? 'bg-amber-500/5 border-amber-500/40 shadow-amber-500/5'
            : 'bg-blue-500/5 border-blue-500/30'
        }`}>
          {/* Top metadata tags */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-base-border/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-condensed font-black text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Pin className="h-3 w-3 fill-current" />
                PIN UTAMA
              </span>

              {/* Target Shift Badge */}
              <span className="px-2.5 py-0.5 rounded-md bg-base-surface border border-base-border font-condensed font-black text-xs uppercase tracking-wider text-base-text flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-base-accent" />
                Target: {pinnedNote.targetShift}
              </span>

              {/* Priority Badge */}
              <span className={`px-2 py-0.5 rounded-md border font-condensed font-black text-[11px] uppercase tracking-wider flex items-center gap-1 ${getPriorityClasses(pinnedNote.priority)}`}>
                {pinnedNote.priority === 'urgent' && <Flame className="h-3 w-3" />}
                {pinnedNote.priority === 'important' && <AlertTriangle className="h-3 w-3" />}
                {pinnedNote.priority.toUpperCase()}
              </span>

              {/* Station */}
              {pinnedNote.station && (
                <span className="px-2 py-0.5 rounded-md bg-base-surface/80 border border-base-border text-base-muted font-condensed font-bold text-[11px] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-base-muted" />
                  {pinnedNote.station}
                </span>
              )}
            </div>

            {/* Author and Full/Relative Timestamp */}
            <div className="text-right text-xs text-base-muted flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-base-text">{pinnedNote.authorName}</span>
              <span>•</span>
              <span className="font-mono text-[11px] text-base-muted" title={pinnedNote.createdAt}>
                {formatFullTimestamp(pinnedNote.createdAt)}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-base-surface2 text-base-muted2 font-mono">
                {formatRelativeTime(pinnedNote.createdAt)}
              </span>
            </div>
          </div>

          {/* Note text content */}
          <div className="py-3 text-sm text-base-text leading-relaxed whitespace-pre-wrap font-medium">
            {pinnedNote.note}
          </div>

          {/* Bottom acknowledgement & controls */}
          <div className="pt-3 border-t border-base-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Acknowledgement Status */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() => acknowledgeNote(pinnedNote.id)}
                disabled={pinnedNote.acknowledgedBy?.includes(currentUserName)}
                className={`px-3 py-1.5 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  pinnedNote.acknowledgedBy?.includes(currentUserName)
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 cursor-default'
                    : 'bg-base-surface hover:bg-emerald-500 hover:text-white border border-base-border text-base-text shadow-xs active:scale-95'
                }`}
                title={pinnedNote.acknowledgedBy?.includes(currentUserName) ? 'Anda sudah mengonfirmasi membaca catatan ini' : 'Klik untuk konfirmasi bahwa Anda telah membaca catatan ini'}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{pinnedNote.acknowledgedBy?.includes(currentUserName) ? 'Sudah Dibaca ✓' : 'Konfirmasi Sudah Baca'}</span>
              </button>

              {pinnedNote.acknowledgedBy && pinnedNote.acknowledgedBy.length > 0 && (
                <div className="text-xs text-base-muted flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Dibaca oleh:</span>
                  <span className="font-semibold text-base-text truncate max-w-[200px] sm:max-w-[320px]">
                    {pinnedNote.acknowledgedBy.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Edit / Unpin controls */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleOpenCompose(pinnedNote)}
                className="px-2.5 py-1 text-xs text-base-muted hover:text-base-text hover:bg-base-surface rounded font-condensed font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                title="Edit isi catatan"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => unpinNote(pinnedNote.id)}
                className="px-2.5 py-1 text-xs text-base-muted hover:text-base-red hover:bg-base-surface rounded font-condensed font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                title="Lepas pin dari tampilan utama"
              >
                <X className="h-3.5 w-3.5" />
                <span>Lepas Pin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Section: Riwayat 5 Catatan Shift Terakhir (Multi-Shift History) */}
      <div className="bg-base-surface2/60 border border-base-border rounded-xl p-4 sm:p-5 space-y-4">
        {/* Section Header & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-base-border/70">
          <div className="flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-base-accent" />
            <h4 className="font-condensed font-black text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
              <span>Riwayat 5 Catatan Shift Terakhir</span>
              <span className="px-2 py-0.2 rounded-full bg-base-surface border border-base-border text-base-muted font-mono text-[11px]">
                {last5Notes.length} Catatan
              </span>
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {/* Shift Filter Pills */}
            <div className="flex items-center bg-base-surface border border-base-border rounded-lg p-0.5 text-xs font-condensed font-bold">
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  selectedShiftFilter === 'all'
                    ? 'bg-base-surface3 text-base-text font-black'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('Day')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  selectedShiftFilter === 'Day'
                    ? 'bg-base-surface3 text-base-text font-black'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                Day Shift
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftFilter('Night')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  selectedShiftFilter === 'Night'
                    ? 'bg-base-surface3 text-base-text font-black'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                Night Shift
              </button>
            </div>

            {/* Collapse/Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsHistorySectionExpanded(!isHistorySectionExpanded)}
              className="p-1 text-base-muted hover:text-base-text hover:bg-base-surface rounded-lg transition-colors cursor-pointer"
              title={isHistorySectionExpanded ? 'Sembunyikan log' : 'Tampilkan log'}
            >
              {isHistorySectionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* List of 5 Recent Shift Notes */}
        {isHistorySectionExpanded && (
          <div className="space-y-3">
            {last5Notes.length === 0 ? (
              <div className="text-center py-6 text-base-muted text-xs bg-base-surface rounded-lg border border-base-border border-dashed">
                Tidak ada catatan handover untuk filter ini.
              </div>
            ) : (
              last5Notes.map((note, index) => {
                const isAcked = note.acknowledgedBy?.includes(currentUserName);
                return (
                  <div
                    key={note.id}
                    className={`bg-base-surface rounded-xl p-3.5 sm:p-4 border transition-all hover:border-base-border/80 ${
                      note.isPinned 
                        ? 'border-amber-500/50 bg-amber-500/[0.02]' 
                        : 'border-base-border/70'
                    }`}
                  >
                    {/* Header line: Sequence, Shift, Priority, Timestamp & Author */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-base-border/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Index marker */}
                        <span className="w-5 h-5 rounded-md bg-base-surface2 border border-base-border text-base-muted font-mono font-bold text-[10px] flex items-center justify-center">
                          #{index + 1}
                        </span>

                        {note.isPinned && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40 font-condensed font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <Pin className="h-2.5 w-2.5" />
                            PINNED
                          </span>
                        )}

                        {/* Shift Badge */}
                        <span className="px-2 py-0.5 rounded bg-base-surface2 border border-base-border font-condensed font-extrabold text-[11px] uppercase tracking-wider text-base-text flex items-center gap-1">
                          <Clock className="h-3 w-3 text-base-accent" />
                          {note.targetShift}
                        </span>

                        {/* Priority Badge */}
                        <span className={`px-2 py-0.5 rounded border font-condensed font-bold text-[10px] uppercase ${getPriorityClasses(note.priority)}`}>
                          {note.priority}
                        </span>

                        {/* Station */}
                        {note.station && (
                          <span className="text-[11px] text-base-muted flex items-center gap-1 font-mono">
                            <MapPin className="h-3 w-3 text-base-muted" />
                            {note.station}
                          </span>
                        )}
                      </div>

                      {/* Author and Timestamp (Explicitly clearly shown) */}
                      <div className="flex items-center gap-2 text-xs text-base-muted flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-base-text">{note.authorName}</span>
                          {note.authorRole && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-base-surface2 font-condensed uppercase tracking-wider text-base-muted">
                              {note.authorRole}
                            </span>
                          )}
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-base-text" title={note.createdAt}>
                          <Calendar className="h-3 w-3 text-base-muted" />
                          <span>{formatFullTimestamp(note.createdAt)}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-base-surface2 text-base-muted font-mono">
                          {formatRelativeTime(note.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Note Content */}
                    <div className="py-2.5 text-xs sm:text-sm text-base-text leading-relaxed whitespace-pre-wrap">
                      {note.note}
                    </div>

                    {/* Footer / Actions */}
                    <div className="pt-2 border-t border-base-border/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {/* Readers info */}
                      <div className="flex items-center gap-2">
                        {note.acknowledgedBy && note.acknowledgedBy.length > 0 ? (
                          <div className="text-[11px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Dibaca oleh: <strong className="font-semibold">{note.acknowledgedBy.join(', ')}</strong></span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-base-muted italic">Belum ada konfirmasi baca</span>
                        )}
                      </div>

                      {/* Item Action Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => acknowledgeNote(note.id)}
                          disabled={isAcked}
                          className={`px-2 py-1 rounded text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            isAcked
                              ? 'text-emerald-500 bg-emerald-500/10 cursor-default'
                              : 'text-base-muted hover:text-base-text hover:bg-base-surface2 border border-base-border'
                          }`}
                          title="Tandai telah dibaca"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isAcked ? 'Dibaca ✓' : 'Baca'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => togglePin(note.id)}
                          className={`px-2 py-1 rounded text-xs font-condensed font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            note.isPinned 
                              ? 'bg-amber-500 text-black' 
                              : 'text-base-muted hover:text-amber-500 hover:bg-base-surface2 border border-base-border'
                          }`}
                          title={note.isPinned ? 'Lepas Pin' : 'Pin catatan ini ke paling atas'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                          <span>{note.isPinned ? 'Pinned' : 'Pin'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenCompose(note)}
                          className="p-1 text-base-muted hover:text-base-text hover:bg-base-surface2 rounded text-xs transition-colors cursor-pointer"
                          title="Edit Catatan"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Hapus catatan handover ini?')) {
                              deleteNote(note.id);
                            }
                          }}
                          className="p-1 text-base-muted hover:text-base-red hover:bg-base-surface2 rounded text-xs transition-colors cursor-pointer"
                          title="Hapus Catatan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Compose / Edit Shift Handover */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-2xl shadow-modal w-full max-w-xl overflow-hidden animate-in fade-in select-none">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2">
              <div className="flex items-center gap-2">
                <Pin className="h-5 w-5 text-amber-500" />
                <h3 className="font-condensed font-black uppercase text-lg text-base-text">
                  {editingNote ? 'Edit Catatan Shift Handover' : 'Pin Catatan Shift Handover Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveForm} className="p-5 space-y-4 text-xs">
              {/* Quick Template Chips */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Template Cepat:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormText(prev => prev ? `${prev}\n${tmpl.text}` : tmpl.text)}
                      className="px-2.5 py-1 rounded bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-muted2 hover:text-base-text font-condensed font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Content Textarea */}
              <div className="space-y-1">
                <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Isi Catatan / Status Handover <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="Contoh: Mesin Cutting 1 pisau tumpul, shift berikutnya mohon ganti spare cutter di tool room. Lanjutkan pengelasan WO-102 section C..."
                  className="w-full p-3 bg-base-bg text-base-text rounded-xl border border-base-border focus:border-amber-500 outline-none text-xs leading-relaxed resize-y"
                  required
                  autoFocus
                />
              </div>

              {/* Row: Target Shift & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Target Shift
                  </label>
                  <select
                    value={formTargetShift}
                    onChange={(e) => setFormTargetShift(e.target.value)}
                    className="w-full px-3 py-2 bg-base-bg text-base-text rounded-lg border border-base-border focus:border-amber-500 outline-none font-semibold cursor-pointer"
                  >
                    <option value="Night Shift">Night Shift</option>
                    <option value="Day Shift">Day Shift</option>
                    <option value="Next Shift (All)">Next Shift (Semua)</option>
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-base-bg text-base-text rounded-lg border border-base-border focus:border-amber-500 outline-none font-semibold cursor-pointer"
                  >
                    <option value="normal">Normal (Informasi Rutin)</option>
                    <option value="important">Important (Perhatian Khusus)</option>
                    <option value="urgent">Urgent (Kritis / Perlu Tindakan Segera)</option>
                  </select>
                </div>
              </div>

              {/* Row: Area/Station & Author Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Lokasi / Station (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formStation}
                    onChange={(e) => setFormStation(e.target.value)}
                    placeholder="Contoh: Workshop 1 - Bay 2"
                    className="w-full px-3 py-2 bg-base-bg text-base-text rounded-lg border border-base-border focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                    Nama Pembuat
                  </label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="Nama Koordinator"
                    className="w-full px-3 py-2 bg-base-bg text-base-text rounded-lg border border-base-border focus:border-amber-500 outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-base-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 border border-base-border text-base-muted hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!formText.trim()}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Pin className="h-4 w-4" />
                  <span>{editingNote ? 'Simpan Perubahan' : 'Pin Catatan ke Shop Floor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Full History Archive Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-2xl shadow-modal w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in select-none">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-base-accent" />
                <h3 className="font-condensed font-black uppercase text-lg text-base-text">
                  Seluruh Riwayat Catatan Shift Handover ({notes.length})
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-base-border/50 space-y-3">
              {sortedNotes.length === 0 ? (
                <div className="text-center py-8 text-base-muted text-xs">
                  Belum ada riwayat catatan shift handover.
                </div>
              ) : (
                sortedNotes.map((note) => (
                  <div key={note.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {note.isPinned && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40 font-condensed font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <Pin className="h-3 w-3" />
                            PINNED
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-base-surface2 border border-base-border font-condensed font-bold text-xs uppercase text-base-text">
                          {note.targetShift}
                        </span>
                        <span className={`px-2 py-0.5 rounded border font-condensed font-bold text-[10px] uppercase ${getPriorityClasses(note.priority)}`}>
                          {note.priority}
                        </span>
                        {note.station && (
                          <span className="text-[11px] text-base-muted flex items-center gap-1 font-mono">
                            <MapPin className="h-3 w-3" />
                            {note.station}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => togglePin(note.id)}
                          className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                            note.isPinned 
                              ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' 
                              : 'text-base-muted hover:text-amber-500 hover:bg-base-surface2'
                          }`}
                          title={note.isPinned ? 'Lepas Pin' : 'Jadikan Pinned Note'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsHistoryModalOpen(false);
                            handleOpenCompose(note);
                          }}
                          className="p-1.5 text-base-muted hover:text-base-text hover:bg-base-surface2 rounded text-xs transition-colors cursor-pointer"
                          title="Edit Catatan"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Hapus catatan handover ini?')) {
                              deleteNote(note.id);
                            }
                          }}
                          className="p-1.5 text-base-muted hover:text-base-red hover:bg-base-surface2 rounded text-xs transition-colors cursor-pointer"
                          title="Hapus Catatan"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-base-text leading-relaxed whitespace-pre-wrap">
                      {note.note}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-base-muted pt-1">
                      <div>
                        Dibuat oleh: <span className="font-semibold text-base-muted2">{note.authorName}</span>
                      </div>
                      <div className="font-mono">
                        {formatFullTimestamp(note.createdAt)} ({formatRelativeTime(note.createdAt)})
                      </div>
                    </div>

                    {note.acknowledgedBy && note.acknowledgedBy.length > 0 && (
                      <div className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Dibaca oleh: {note.acknowledgedBy.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-base-border flex items-center justify-between bg-base-surface2 flex-shrink-0 text-xs">
              <span className="text-base-muted font-mono text-[11px]">
                Tersimpan di storage browser
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 bg-base-surface border border-base-border text-base-text hover:bg-base-surface3 rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
