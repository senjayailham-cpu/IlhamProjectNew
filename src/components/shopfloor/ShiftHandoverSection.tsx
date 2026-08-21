import React, { useState } from 'react';
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
  Send,
  Sparkles,
  MapPin,
  Eye,
  CornerDownRight
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ShiftHandoverNote | null>(null);

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
  const hasUserAcknowledged = pinnedNote?.acknowledgedBy?.includes(currentUserName);

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

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-base-surface border-2 border-base-border rounded-2xl p-4 sm:p-6 shadow-md transition-all">
      {/* Card Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-base-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
            <Pin className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-condensed font-black text-lg uppercase tracking-wider text-base-text">
                Shift Handover <span className="text-amber-500">& Pinboard</span>
              </h3>
              {pinnedNote && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-condensed font-extrabold text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Active Pin
                </span>
              )}
            </div>
            <p className="text-xs text-base-muted mt-0.5">
              Catatan status & instruksi antar shift untuk koordinator dan operator lapangan
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="px-3 py-1.5 bg-base-surface2 hover:bg-base-surface3 border border-base-border text-base-muted hover:text-base-text rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Lihat riwayat catatan shift sebelumnya"
          >
            <History className="h-3.5 w-3.5" />
            <span>Riwayat ({notes.length})</span>
          </button>

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

      {/* Main Body: Active Pinned Note OR Empty State */}
      <div className="mt-4">
        {pinnedNote ? (
          <div className={`rounded-xl p-4 sm:p-5 border-2 transition-all ${
            pinnedNote.priority === 'urgent' 
              ? 'bg-red-500/5 border-red-500/40 shadow-red-500/5' 
              : pinnedNote.priority === 'important'
              ? 'bg-amber-500/5 border-amber-500/40 shadow-amber-500/5'
              : 'bg-blue-500/5 border-blue-500/30'
          }`}>
            {/* Top metadata tags */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-base-border/60">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Target Shift Badge */}
                <span className="px-2.5 py-1 rounded-md bg-base-surface border border-base-border font-condensed font-black text-xs uppercase tracking-wider text-base-text flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-base-accent" />
                  Target: {pinnedNote.targetShift}
                </span>

                {/* Priority Badge */}
                <span className={`px-2 py-0.5 rounded-md border font-condensed font-black text-[11px] uppercase tracking-wider flex items-center gap-1 ${getPriorityClasses(pinnedNote.priority)}`}>
                  {pinnedNote.priority === 'urgent' && <Flame className="h-3 w-3" />}
                  {pinnedNote.priority === 'important' && <AlertTriangle className="h-3 w-3" />}
                  {pinnedNote.priority.toUpperCase()}
                </span>

                {/* Optional Station */}
                {pinnedNote.station && (
                  <span className="px-2 py-0.5 rounded-md bg-base-surface/80 border border-base-border text-base-muted font-condensed font-bold text-[11px] flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-base-muted" />
                    {pinnedNote.station}
                  </span>
                )}
              </div>

              {/* Author and Relative Time */}
              <div className="text-right text-xs text-base-muted flex items-center gap-1.5">
                <span className="font-semibold text-base-text">{pinnedNote.authorName}</span>
                <span>•</span>
                <span className="font-mono text-[11px]">{formatRelativeTime(pinnedNote.createdAt)}</span>
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
                  disabled={hasUserAcknowledged}
                  className={`px-3 py-1.5 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    hasUserAcknowledged
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 cursor-default'
                      : 'bg-base-surface hover:bg-emerald-500 hover:text-white border border-base-border text-base-text shadow-xs active:scale-95'
                  }`}
                  title={hasUserAcknowledged ? 'Anda sudah mengonfirmasi membaca catatan ini' : 'Klik untuk konfirmasi bahwa Anda telah membaca catatan ini'}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{hasUserAcknowledged ? 'Sudah Dibaca ✓' : 'Konfirmasi Sudah Baca'}</span>
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
        ) : (
          /* Empty Pinned State */
          <div className="p-6 rounded-xl border-2 border-dashed border-base-border bg-base-surface2/30 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-base-surface3 border border-base-border flex items-center justify-center text-base-muted">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="font-condensed font-extrabold text-base uppercase text-base-text">
                Belum ada Catatan Handover yang Di-Pin
              </p>
              <p className="text-xs text-base-muted max-w-md mx-auto mt-0.5">
                Pin catatan penting, update status mesin, atau instruksi kerja agar langsung terbaca oleh koordinator shift berikutnya saat membuka portal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenCompose()}
              className="mt-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Catatan Handover Sekarang</span>
            </button>
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

      {/* MODAL 2: History of Shift Handovers */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-base-surface border border-base-border rounded-2xl shadow-modal w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in select-none">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-base-accent" />
                <h3 className="font-condensed font-black uppercase text-lg text-base-text">
                  Riwayat Catatan Shift Handover ({notes.length})
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-base-border/50 space-y-3">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-base-muted text-xs">
                  Belum ada riwayat catatan shift handover.
                </div>
              ) : (
                notes.map((note) => (
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
                            setIsHistoryOpen(false);
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
                        {new Date(note.createdAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
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
                Tersimpan di local storage browser
              </span>
              <button
                onClick={() => setIsHistoryOpen(false)}
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
