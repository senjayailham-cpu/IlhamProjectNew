import React, { useState, useEffect } from 'react';
import { Project, Dependency } from '../types';
import { esc } from '../utils/projectUtils';
import { Link2, Trash2 } from 'lucide-react';

interface DepModalProps {
  isOpen: boolean;
  onClose: () => void;
  rowKey: string | null; // 'p:pid' or 'a:pid:aid'
  projects: Project[];
  onSave: (rowKey: string, preds: Dependency[], succs: Dependency[]) => void;
}

export default function DepModal({
  isOpen,
  onClose,
  rowKey,
  projects,
  onSave
}: DepModalProps) {
  const [preds, setPreds] = useState<Dependency[]>([]);
  const [succs, setSuccs] = useState<Dependency[]>([]);

  const [addPredTarget, setAddPredTarget] = useState<string>('');
  const [addPredType, setAddPredType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [addPredLag, setAddPredLag] = useState<string>('');

  const [addSuccTarget, setAddSuccTarget] = useState<string>('');
  const [addSuccType, setAddSuccType] = useState<'FS' | 'SS' | 'FF' | 'SF'>('FS');
  const [addSuccLag, setAddSuccLag] = useState<string>('');

  // Assemble full row mappings
  const allRows: { key: string; label: string; type: 'project' | 'assembly' | 'task' }[] = [];
  projects.forEach(p => {
    allRows.push({ key: `p:${p.id}`, label: `[P] ${p.name}`, type: 'project' });
    (p.assemblies || []).forEach(a => {
      allRows.push({ key: `a:${p.id}:${a.id}`, label: `[A] ${a.name} (${p.name})`, type: 'assembly' });
      (a.tasks || []).forEach(t => {
        allRows.push({ key: `t:${p.id}:${a.id}:${t.id}`, label: `[T] ${t.name} (${a.name})`, type: 'task' });
      });
    });
  });

  const getRowObj = (key: string) => {
    if (key.startsWith('p:')) {
      return projects.find(x => x.id === key.slice(2));
    } else if (key.startsWith('a:')) {
      const [, pid, aid] = key.split(':');
      const proj = projects.find(x => x.id === pid);
      return proj ? (proj.assemblies || []).find(a => a.id === aid) : null;
    } else {
      const [, pid, aid, tid] = key.split(':');
      const proj = projects.find(x => x.id === pid);
      const ass = proj ? (proj.assemblies || []).find(a => a.id === aid) : null;
      return ass ? (ass.tasks || []).find(t => t.id === tid) : null;
    }
  };

  useEffect(() => {
    if (!isOpen || !rowKey) return;
    const obj = getRowObj(rowKey);
    if (obj) {
      setPreds(JSON.parse(JSON.stringify(obj.predecessors || [])));
      setSuccs(JSON.parse(JSON.stringify(obj.successors || [])));
    }
    setAddPredTarget('');
    setAddPredType('FS');
    setAddPredLag('');
    setAddSuccTarget('');
    setAddSuccType('FS');
    setAddSuccLag('');
  }, [isOpen, rowKey]);

  if (!isOpen || !rowKey) return null;

  const currentInfo = allRows.find(r => r.key === rowKey);
  if (!currentInfo) return null;

  const addLink = (dir: 'pred' | 'succ') => {
    const isPred = dir === 'pred';
    const target = isPred ? addPredTarget : addSuccTarget;
    const type = isPred ? addPredType : addSuccType;
    const lagStr = isPred ? addPredLag : addSuccLag;

    if (!target) {
      alert('Please select a task constraint option.');
      return;
    }

    const lag = parseInt(lagStr) || 0;
    const targetArr = isPred ? preds : succs;

    if (targetArr.some(x => x.key === target)) {
      alert('A dependency layout connection already exists or is duplicated.');
      return;
    }

    const newItem: Dependency = { key: target, type, lag };
    if (isPred) {
      setPreds([...preds, newItem]);
      setAddPredTarget('');
      setAddPredLag('');
    } else {
      setSuccs([...succs, newItem]);
      setAddSuccTarget('');
      setAddSuccLag('');
    }
  };

  const removeLink = (dir: 'pred' | 'succ', idx: number) => {
    if (dir === 'pred') {
      setPreds(prev => prev.filter((_, i) => i !== idx));
    } else {
      setSuccs(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const changeLinkType = (dir: 'pred' | 'succ', idx: number, type: 'FS' | 'SS' | 'FF' | 'SF') => {
    if (dir === 'pred') {
      const next = [...preds];
      next[idx].type = type;
      setPreds(next);
    } else {
      const next = [...succs];
      next[idx].type = type;
      setSuccs(next);
    }
  };

  const changeLinkLag = (dir: 'pred' | 'succ', idx: number, lag: number) => {
    if (dir === 'pred') {
      const next = [...preds];
      next[idx].lag = lag;
      setPreds(next);
    } else {
      const next = [...succs];
      next[idx].lag = lag;
      setSuccs(next);
    }
  };

  const getRowLabel = (key: string) => {
    const r = allRows.find(x => x.key === key);
    return r ? r.label : key;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-base-surface border border-base-border2 rounded-xl shadow-modal w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 ease-out duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border flex items-center justify-between flex-shrink-0 bg-linear-to-b from-base-accent-dim/15 to-transparent">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-base-accent" />
            <div>
              <h3 className="font-condensed font-extrabold uppercase text-base tracking-wider text-base-text">Task Dependencies Map</h3>
              <p className="text-[11px] text-base-muted mt-0.5 max-w-[240px] sm:max-w-[380px] truncate" title={currentInfo.label}>
                Editing: {currentInfo.label}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer font-bold text-sm">✕</button>
        </div>

        {/* Body content (Predecessors on top, Successors bottom) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5 text-xs">
          
          {/* Predecessors list management */}
          <div className="space-y-2">
            <h4 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-blue flex items-center gap-1">
              ← Predecessors <span className="text-[10px] text-base-muted capitalize font-normal">(this depends on other rows)</span>
            </h4>
            
            <div className="space-y-1.5 max-h-32 overflow-y-auto border border-base-border/50 rounded-lg p-2.5 bg-base-surface2/40">
              {preds.length === 0 ? (
                <div className="text-base-muted italic p-2 text-center">No predecessors configured yet.</div>
              ) : (
                preds.map((p, pIdx) => (
                  <div key={p.key} className="flex items-center justify-between gap-3 bg-base-surface border border-base-border p-2 rounded-md shadow-xs">
                    <span className="flex-1 truncate text-base-text font-semibold">{esc(getRowLabel(p.key))}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={p.type || 'FS'}
                        onChange={(e) => changeLinkType('pred', pIdx, e.target.value as any)}
                        className="px-2 py-1 bg-base-surface2 border border-base-border rounded text-[10px] font-condensed font-extrabold cursor-pointer outline-none"
                      >
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                        <option value="FF">FF</option>
                        <option value="SF">SF</option>
                      </select>
                      <input
                        type="number"
                        value={p.lag || 0}
                        onChange={(e) => changeLinkLag('pred', pIdx, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-12 px-1.5 py-1 bg-base-surface2 border border-base-border rounded text-center text-[10px] font-condensed font-bold outline-none"
                      />
                      <span className="text-[10px] text-base-muted">days</span>
                      <button
                        onClick={() => removeLink('pred', pIdx)}
                        className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Predecessor selector */}
            <div className="flex gap-2 items-center pt-1">
              <select
                value={addPredTarget}
                onChange={(e) => setAddPredTarget(e.target.value)}
                className="flex-1 min-w-0 w-0 px-2.5 py-2 bg-base-bg text-base-text border border-base-border rounded outline-none text-xs font-condensed font-bold cursor-pointer truncate"
              >
                <option value="">— Select Predecessor —</option>
                {allRows.filter(r => r.key !== rowKey).map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <select
                value={addPredType}
                onChange={(e) => setAddPredType(e.target.value as any)}
                className="px-2.5 py-2 bg-base-bg text-base-text border border-base-border rounded outline-none text-xs font-condensed font-extrabold cursor-pointer w-16"
              >
                <option value="FS">FS</option>
                <option value="SS">SS</option>
                <option value="FF">FF</option>
                <option value="SF">SF</option>
              </select>
              <input
                type="number"
                value={addPredLag}
                onChange={(e) => setAddPredLag(e.target.value)}
                placeholder="Lag"
                className="w-14 px-2 py-1.5 bg-base-bg text-base-text border border-base-border rounded text-center text-xs outline-none"
              />
              <button
                onClick={() => addLink('pred')}
                className="px-3.5 py-2 bg-base-accent text-white font-condensed font-bold uppercase tracking-wider rounded-lg text-xs hover:bg-base-accent2 cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Successors list management */}
          <div className="space-y-2">
            <h4 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-green flex items-center gap-1">
              Successors → <span className="text-[10px] text-base-muted capitalize font-normal">(others depend on this row)</span>
            </h4>

            <div className="space-y-1.5 max-h-32 overflow-y-auto border border-base-border/50 rounded-lg p-2.5 bg-base-surface2/40">
              {succs.length === 0 ? (
                <div className="text-base-muted italic p-2 text-center">No successors configured yet (this is a root/leaf node).</div>
              ) : (
                succs.map((s, sIdx) => (
                  <div key={s.key} className="flex items-center justify-between gap-3 bg-base-surface border border-base-border p-2 rounded-md shadow-xs">
                    <span className="flex-1 truncate text-base-text font-semibold">{esc(getRowLabel(s.key))}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={s.type || 'FS'}
                        onChange={(e) => changeLinkType('succ', sIdx, e.target.value as any)}
                        className="px-2 py-1 bg-base-surface2 border border-base-border rounded text-[10px] font-condensed font-extrabold cursor-pointer outline-none"
                      >
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                        <option value="FF">FF</option>
                        <option value="SF">SF</option>
                      </select>
                      <input
                        type="number"
                        value={s.lag || 0}
                        onChange={(e) => changeLinkLag('succ', sIdx, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-12 px-1.5 py-1 bg-base-surface2 border border-base-border rounded text-center text-[10px] font-condensed font-bold outline-none"
                      />
                      <span className="text-[10px] text-base-muted">days</span>
                      <button
                        onClick={() => removeLink('succ', sIdx)}
                        className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Successor selector */}
            <div className="flex gap-2 items-center pt-1">
              <select
                value={addSuccTarget}
                onChange={(e) => setAddSuccTarget(e.target.value)}
                className="flex-1 min-w-0 w-0 px-2.5 py-2 bg-base-bg text-base-text border border-base-border rounded outline-none text-xs font-condensed font-bold cursor-pointer truncate"
              >
                <option value="">— Select Successor —</option>
                {allRows.filter(r => r.key !== rowKey).map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <select
                value={addSuccType}
                onChange={(e) => setAddSuccType(e.target.value as any)}
                className="px-2.5 py-2 bg-base-bg text-base-text border border-base-border rounded outline-none text-xs font-condensed font-extrabold cursor-pointer w-16"
              >
                <option value="FS">FS</option>
                <option value="SS">SS</option>
                <option value="FF">FF</option>
                <option value="SF">SF</option>
              </select>
              <input
                type="number"
                value={addSuccLag}
                onChange={(e) => setAddSuccLag(e.target.value)}
                placeholder="Lag"
                className="w-14 px-2 py-1.5 bg-base-bg text-base-text border border-base-border rounded text-center text-xs outline-none"
              />
              <button
                onClick={() => addLink('succ')}
                className="px-3.5 py-2 bg-base-accent text-white font-condensed font-bold uppercase tracking-wider rounded-lg text-xs hover:bg-base-accent2 cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

        </div>

        {/* Global actions row */}
        <div className="px-5 py-3.5 border-t border-base-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 bg-base-surface2 text-xs">
          <div className="text-[10px] text-base-muted font-condensed font-semibold leading-relaxed">
            <b>FS</b>=Finish→Start | <b>SS</b>=Start→Start | <b>FF</b>=Finish→Finish | <b>SF</b>=Start→Finish
          </div>
          <div className="flex gap-2 justify-end self-end sm:self-auto">
            <button onClick={onClose} className="px-3.5 py-1.5 border border-base-border text-base-muted2 hover:text-base-text rounded-lg font-condensed font-bold uppercase tracking-wider cursor-pointer">Cancel</button>
            <button
              onClick={() => onSave(rowKey, preds, succs)}
              className="px-4 py-1.5 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
            >
              Save dependencies
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
