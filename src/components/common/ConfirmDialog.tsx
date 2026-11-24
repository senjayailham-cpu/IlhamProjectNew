import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const badgeClass =
    tone === 'danger'
      ? 'bg-red-500/12 text-red-500 border-red-500/30'
      : tone === 'warning'
        ? 'bg-amber-500/12 text-amber-500 border-amber-500/30'
        : 'bg-base-accent/12 text-base-accent border-base-accent/30';

  const confirmBtnClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : tone === 'warning'
        ? 'bg-amber-500 hover:bg-amber-600 text-black font-black'
        : 'bg-base-accent hover:bg-base-accent2 text-white';

  const Icon = tone === 'danger' ? Trash2 : tone === 'warning' ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-md bg-base-surface border border-base-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-base-border flex items-center justify-between bg-base-surface2/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${badgeClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <h3
              id="confirm-dialog-title"
              className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup dialog"
            className="p-1 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-base-muted leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        <div className="px-5 py-3 border-t border-base-border bg-base-surface2/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface3 text-xs font-condensed font-bold uppercase tracking-wider text-base-text transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-condensed font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
