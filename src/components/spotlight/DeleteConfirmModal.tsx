import React from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title,
  message,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] z-[60] animate-fade-in animate-duration-200">
      <div className="bg-base-surface border border-base-border shadow-modal rounded-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 ease-out duration-150 p-6 space-y-5 text-left">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-500/10 rounded-full text-red-600 shrink-0">
            <Trash2 className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 flex-1 select-none">
            <h4 className="text-sm font-bold text-base-text uppercase font-condensed tracking-wider">{title}</h4>
            <p className="text-xs text-base-muted font-normal leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 justify-end text-xs pt-1">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 border border-base-border text-base-muted font-condensed font-bold uppercase tracking-wider rounded-lg hover:bg-base-surface2 hover:text-base-text transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-condensed font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
