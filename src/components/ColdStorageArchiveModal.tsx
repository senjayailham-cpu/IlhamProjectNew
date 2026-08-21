import React, { useState } from 'react';
import { Archive, RefreshCw, Search, Calendar, Sparkles, Building, Layers, CheckCircle2, ShieldAlert, X, Database, Info, FileText } from 'lucide-react';
import { Project, User } from '../types';
import { useAppStore } from '../store/useAppStore';
import { can } from '../utils/permissions';

function getProjectWeightKg(p: Project): number {
  return (p.materialProcessing || []).reduce((sum, mp) => {
    const mass = typeof mp.massKg === 'number' ? mp.massKg : 0;
    const qty = typeof mp.qty === 'number' ? mp.qty : 0;
    return sum + mass * qty;
  }, 0);
}

interface ColdStorageArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedProjects: Project[];
  onRestoreProject: (projectId: string) => void;
  currentUser?: User | null;
}

export function ColdStorageArchiveModal({
  isOpen,
  onClose,
  archivedProjects: propArchivedProjects,
  onRestoreProject,
  currentUser: propCurrentUser,
}: ColdStorageArchiveModalProps) {
  const storeProjects = useAppStore((s) => s.projects);
  const storeArchived = storeProjects.filter((p) => p.isArchived === true);
  const storeCurrentUser = useAppStore((s) => s.currentUser);
  
  const archivedProjects = propArchivedProjects?.length ? propArchivedProjects : storeArchived;
  const currentUser = propCurrentUser || storeCurrentUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);

  const canRestore = can(currentUser ?? null, 'editProject');

  if (!isOpen) return null;

  const filtered = archivedProjects.filter(p => {
    const query = searchQuery.toLowerCase();
    const code = p.client || p.gaNumber || p.name || p.id;
    return (
      p.name.toLowerCase().includes(query) ||
      code.toLowerCase().includes(query) ||
      (p.client && p.client.toLowerCase().includes(query)) ||
      (p.customer && p.customer.toLowerCase().includes(query)) ||
      (p.gaNumber && p.gaNumber.toLowerCase().includes(query))
    );
  });

  const totalArchivedTon = archivedProjects.reduce((sum, p) => {
    const weightKg = getProjectWeightKg(p);
    return sum + (weightKg / 1000);
  }, 0);

  const handleRestore = async (p: Project) => {
    setIsRestoringId(p.id);
    try {
      await onRestoreProject(p.id);
      if (selectedProject?.id === p.id) {
        setSelectedProject(null);
        setShowAiAnalysis(false);
      }
    } catch (e) {
      console.error('Failed to restore project:', e);
    } finally {
      setIsRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-base-surface border border-base-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-base-border bg-base-surface2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-base-accent/15 border border-base-accent/30 flex items-center justify-center text-base-accent">
              <Archive className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black font-condensed uppercase tracking-wider text-base-text">
                  Cold Storage Archive
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-base-accent/10 border border-base-accent/20 text-base-accent text-[10px] font-condensed font-bold uppercase tracking-wider">
                  Data Historis Proyek Selesai
                </span>
              </div>
              <p className="text-xs text-base-muted font-sans mt-0.5">
                Penyimpanan proyek selesai jangka panjang untuk analisis histori, audit tonase, dan pembelajaran AI.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-base-muted hover:text-base-text hover:bg-base-surface rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="p-4 bg-base-surface border-b border-base-border grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="p-3 bg-base-surface2 border border-base-border rounded-xl flex items-center gap-3">
            <Database className="h-5 w-5 text-base-accent" />
            <div>
              <div className="text-[10px] font-condensed font-bold text-base-muted uppercase tracking-wider">Total Proyek Diarsip</div>
              <div className="text-base font-black text-base-text font-mono">{archivedProjects.length} Proyek</div>
            </div>
          </div>

          <div className="p-3 bg-base-surface2 border border-base-border rounded-xl flex items-center gap-3">
            <Layers className="h-5 w-5 text-base-accent" />
            <div>
              <div className="text-[10px] font-condensed font-bold text-base-muted uppercase tracking-wider">Total Tonase Historis</div>
              <div className="text-base font-black text-base-text font-mono">{totalArchivedTon.toFixed(2)} Ton</div>
            </div>
          </div>

          <div className="p-3 bg-base-surface2 border border-base-border rounded-xl flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-base-accent" />
            <div>
              <div className="text-[10px] font-condensed font-bold text-base-muted uppercase tracking-wider">Status Pembelajaran AI</div>
              <div className="text-xs font-bold text-base-accent font-condensed uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Ready for AI Training</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Content Area */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-base-muted" />
            <input
              type="text"
              placeholder="Cari proyek tersimpan berdasarkan nama, kode, client, atau customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-base-surface2 border border-base-border rounded-xl pl-10 pr-4 py-2 text-xs text-base-text focus:outline-none focus:ring-1 focus:ring-base-accent font-sans"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-base-border/50 rounded-2xl bg-base-surface2/30 my-4">
              <Archive className="h-10 w-10 text-base-muted/40 mb-3" />
              <h3 className="font-condensed font-bold text-sm uppercase text-base-text">Tidak Ada Proyek di Cold Storage</h3>
              <p className="text-xs text-base-muted max-w-sm mt-1">
                Proyek yang ditandai selesai (*COMPLETED*) dapat dipindahkan ke Cold Storage untuk pengarsipan jangka panjang.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((p) => {
                const projectCode = p.client || p.gaNumber || p.name || p.id;
                const weightKg = getProjectWeightKg(p);
                const isSelected = selectedProject?.id === p.id;

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-base-accent/5 border-base-accent/50 shadow-md'
                        : 'bg-base-surface2 border-base-border hover:border-base-border/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-base-accent px-2 py-0.5 rounded-md bg-base-accent/10 border border-base-accent/20">
                            {projectCode}
                          </span>
                          <h3 className="font-condensed font-extrabold text-base text-base-text uppercase tracking-wide mt-1.5">
                            {p.name}
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-base-green/10 text-base-green border border-base-green/20 text-[10px] font-condensed font-bold uppercase shrink-0">
                          COMPLETED
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-base-muted">
                        <div>
                          <span className="block text-[9px] font-condensed font-bold uppercase text-base-muted/70">Client / Cust</span>
                          <span className="font-semibold text-base-text truncate block">{p.client || p.customer || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-condensed font-bold uppercase text-base-muted/70">Total Tonase</span>
                          <span className="font-mono font-bold text-base-text">{(weightKg / 1000).toFixed(2)} Ton</span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-condensed font-bold uppercase text-base-muted/70">Diarsip Pada</span>
                          <span className="font-mono text-base-text">
                            {p.archivedAt ? new Date(p.archivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] font-condensed font-bold uppercase text-base-muted/70">Diarsip Oleh</span>
                          <span className="font-semibold text-base-text truncate block">{p.archivedBy || 'Manager'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-base-border/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedProject(p);
                          setShowAiAnalysis(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-base-surface hover:bg-base-surface2 border border-base-border text-base-accent hover:text-white rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Analisis AI</span>
                      </button>

                      {canRestore && (
                        <button
                          onClick={() => handleRestore(p)}
                          disabled={isRestoringId === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-base-accent/10 hover:bg-base-accent text-base-accent hover:text-white border border-base-accent/30 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isRestoringId === p.id ? 'animate-spin' : ''}`} />
                          <span>Restore Ke Aktif</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Analysis Modal / Card Detail */}
          {selectedProject && showAiAnalysis && (
            <div className="mt-4 p-5 bg-base-surface2 border border-base-accent/30 rounded-2xl relative shadow-lg">
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="absolute top-4 right-4 text-base-muted hover:text-base-text p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-base-accent animate-pulse" />
                <h4 className="font-condensed font-black text-sm uppercase tracking-wider text-base-text">
                  Rangkuman Pembelajaran AI — {selectedProject.name} ({selectedProject.client || selectedProject.gaNumber || selectedProject.name || selectedProject.id})
                </h4>
              </div>

              <div className="space-y-3 text-xs text-base-muted leading-relaxed font-sans">
                <div className="p-3 bg-base-surface border border-base-border rounded-xl">
                  <div className="font-bold text-base-text uppercase font-condensed mb-1">📊 Performa Jadwal & Tonase Historis</div>
                  <p>
                    Proyek ini diselesaikan dengan bobot total <strong>{(getProjectWeightKg(selectedProject) / 1000).toFixed(2)} Ton</strong> terbagi dalam {selectedProject.assemblies?.length || 0} sub-assembly. Data jadwal dan realisasi produksi proyek ini dapat dimanfaatkan oleh Gemini API untuk memprediksi risiko estimasi durasi proyek serupa di masa depan.
                  </p>
                </div>

                <div className="p-3 bg-base-surface border border-base-border rounded-xl">
                  <div className="font-bold text-base-text uppercase font-condensed mb-1">💡 Catatan Pengarsipan</div>
                  <p className="italic text-base-muted">
                    "{selectedProject.archivedReason || 'Proyek telah selesai diproduksi dan dipindahkan ke Cold Storage.'}"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-border bg-base-surface2 flex items-center justify-between shrink-0 text-xs text-base-muted">
          <span>Cold Storage Collection: <code className="font-mono text-base-accent">projects (isArchived: true)</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-base-surface hover:bg-base-surface2 border border-base-border text-base-text rounded-xl font-condensed font-bold uppercase tracking-wider cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
