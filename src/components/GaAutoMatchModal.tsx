import React, { useState, useEffect, useMemo } from 'react';
import { Project, Assembly } from '../types';
import { Copy, Calendar } from 'lucide-react';
import { calculateProjectDuration, calculateFinishFromStart } from '../utils/copyStructureUtils';

interface GaAutoMatchModalProps {
  isOpen: boolean;
  gaNumber: string;
  matchedProjects: Project[];       // projects with same GA Number
  pendingProjectData: Omit<Project, 'id' | 'assemblies' | 'materialProcessing'> | null;
  onConfirmCopy: (sourceProject: Project, calculatedFinish: string) => void;   // create + copy
  onCreateEmpty: () => void;                          // create without copy
  onCancel: () => void;                               // cancel entirely
}

export function GaAutoMatchModal({
  isOpen,
  gaNumber,
  matchedProjects,
  pendingProjectData,
  onConfirmCopy,
  onCreateEmpty,
  onCancel,
}: GaAutoMatchModalProps) {
  const [selectedSource, setSelectedSource] = useState<Project | null>(null);

  useEffect(() => {
    if (isOpen && matchedProjects.length > 0) {
      setSelectedSource(matchedProjects[0]);
    } else {
      setSelectedSource(null);
    }
  }, [isOpen, matchedProjects]);

  const sourceDuration = useMemo(() => {
    if (!selectedSource) return 0;
    return calculateProjectDuration(selectedSource);
  }, [selectedSource]);

  const calculatedFinish = useMemo(() => {
    if (!selectedSource || !pendingProjectData?.start) return null;
    return calculateFinishFromStart(pendingProjectData.start, sourceDuration);
  }, [selectedSource, pendingProjectData, sourceDuration]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-base-surface border border-base-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border bg-base-surface2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-base-accent-dim border border-base-accent/20 flex items-center justify-center flex-shrink-0">
            <Copy className="h-5 w-5 text-base-accent" />
          </div>
          <div>
            <h3 className="font-condensed font-black uppercase text-sm text-base-text">
              GA Number Terdeteksi Sama
            </h3>
            <p className="text-[10px] text-base-muted mt-0.5">
              {gaNumber} sudah digunakan {matchedProjects.length} project lain
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-base-accent-dim/10 border border-base-accent/20 rounded-lg p-3 text-xs text-base-muted leading-relaxed">
            Project dengan GA Number yang sama dianggap produk/desain sejenis.
            Untuk konsistensi, struktur <strong className="text-base-text">
            Sub-Assembly, Task, dan daftar Material Processing (BOM)</strong> akan disalin otomatis dari salah satu project berikut.
            Progress akan dimulai dari 0% (bukan disalin).
          </div>

          {/* Source project selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted">
              Salin struktur dari:
            </label>
            <div className="border border-base-border rounded-lg divide-y divide-base-border max-h-52 overflow-y-auto bg-base-surface">
              {matchedProjects.map(p => {
                const asmCount = p.assemblies?.length || 0;
                const taskCount = (p.assemblies || []).reduce((s, a) => s + (a.tasks?.length || 0), 0);
                const matCount = p.materialProcessing?.length || 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedSource(p)}
                    className={`w-full text-left p-3 hover:bg-base-surface2 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      selectedSource?.id === p.id ? 'bg-base-accent/15 border-l-2 border-base-accent' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-base-text truncate">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-base-muted mt-0.5">
                        {p.client} · dibuat {p.created ? new Date(p.created).toLocaleDateString('id-ID') : 'N/A'}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-base-surface3 text-base-muted font-mono">
                        {asmCount} Asm
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-base-surface3 text-base-muted font-mono">
                        {taskCount} Task
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-base-surface3 text-base-muted font-mono">
                        {matCount} Mat
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedSource && calculatedFinish && (
            <div className="bg-base-accent-dim/10 border border-base-accent/20 rounded-lg p-3 flex items-center gap-3">
              <Calendar className="h-4 w-4 text-base-accent flex-shrink-0" />
              <div className="text-xs text-base-text">
                <span className="text-base-muted">Total durasi struktur:</span>{' '}
                <strong className="font-mono text-base-text">{sourceDuration} hari</strong>
                <br />
                <span className="text-base-muted">Finish Date otomatis:</span>{' '}
                <strong className="font-mono text-base-accent">
                  {new Date(calculatedFinish).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-base-border bg-base-surface2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-base-muted hover:text-base-text font-condensed font-bold uppercase cursor-pointer"
          >
            Batal
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCreateEmpty}
              className="px-3 py-2 border border-base-border rounded-lg text-xs font-condensed font-bold uppercase text-base-muted hover:text-base-text cursor-pointer"
            >
              Buat Tanpa Menyalin
            </button>
            <button
              type="button"
              onClick={() => selectedSource && calculatedFinish && onConfirmCopy(selectedSource, calculatedFinish)}
              disabled={!selectedSource || !calculatedFinish}
              className="px-4 py-2 bg-base-accent text-white rounded-lg text-xs font-condensed font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-base-accent2 transition-colors"
            >
              Buat & Salin Struktur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

