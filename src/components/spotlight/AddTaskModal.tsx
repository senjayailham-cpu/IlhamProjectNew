import React from 'react';
import { Assembly } from '../../types';
import { Plus } from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTargetAssembly: Assembly | null;
  taskName: string;
  setTaskName: (name: string) => void;
  taskDifficulty: number;
  setTaskDifficulty: (diff: number) => void;
  taskStart: string;
  setTaskStart: (start: string) => void;
  taskFinish: string;
  setTaskFinish: (finish: string) => void;
  onSave: () => void;
  canAddDifficulty: boolean;
}

export function AddTaskModal({
  isOpen,
  onClose,
  activeTargetAssembly,
  taskName,
  setTaskName,
  taskDifficulty,
  setTaskDifficulty,
  taskStart,
  setTaskStart,
  taskFinish,
  setTaskFinish,
  onSave,
  canAddDifficulty,
}: AddTaskModalProps) {
  if (!isOpen || !activeTargetAssembly) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-100">
      <div className="bg-base-surface border border-base-border2 rounded-2xl shadow-modal w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 ease-out duration-150 relative text-base-text select-text">
        <div className="flex items-center gap-2.5 border-b border-base-border pb-3.5">
          <div className="h-9 w-9 rounded-lg bg-base-accent-dim border border-base-accent/20 flex items-center justify-center shrink-0">
            <Plus className="h-5 w-5 text-base-accent" />
          </div>
          <div>
            <h3 className="font-condensed font-extrabold uppercase text-sm tracking-wide text-base-text leading-none">Add Task to Assembly</h3>
            <p className="text-[10px] font-medium text-base-muted2 uppercase tracking-wider mt-1.5 truncate max-w-[280px]" title={activeTargetAssembly.name}>
              For: {activeTargetAssembly.name}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs font-semibold">
          <div className="space-y-1.5">
            <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-accent block">Task Name</label>
            <input
              type="text"
              autoFocus
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Panel structural check"
              className="w-full px-3.5 py-2.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-xs font-semibold text-base-text transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
          </div>

          {canAddDifficulty ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Difficulty (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={taskDifficulty}
                onChange={(e) => setTaskDifficulty(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-full px-3.5 py-2 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-xs font-bold text-base-text transition-all"
              />
            </div>
          ) : (
            <input type="hidden" value={taskDifficulty} />
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Start Date (S)</label>
              <input
                type="date"
                value={taskStart}
                onChange={(e) => setTaskStart(e.target.value)}
                className="w-full px-3 py-1.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-[11px] font-semibold text-base-text transition-all cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-condensed font-extrabold uppercase tracking-wider text-base-muted2 block">Finish Date (F)</label>
              <input
                type="date"
                value={taskFinish}
                onChange={(e) => setTaskFinish(e.target.value)}
                className="w-full px-3 py-1.5 bg-base-bg border border-base-border hover:border-base-border2 rounded-lg outline-none focus:border-base-accent text-[11px] font-semibold text-emerald-600 transition-all cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-base-border/30 pt-3.5 mt-1 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!taskName.trim()}
            className="px-5 py-2 bg-base-accent text-white hover:bg-base-accent2 disabled:opacity-55 disabled:cursor-not-allowed rounded-lg font-condensed font-extrabold uppercase tracking-wider cursor-pointer transition-all shadow-md"
          >
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
}
