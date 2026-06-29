import { useState } from 'react';
import { Project, Assembly, Task } from '../types';
import { uid, calcPct } from '../utils';
import { useFirestore } from './useFirestore';
import { propagateAllSchedules } from '../utils/projectUtils';

export function useProjects(
  logActivity: (type: any, action: string, projId?: string, projName?: string, asmName?: string, task?: string, oldP?: number, newP?: number, details?: string) => void,
  verifyMarkChanged: () => void,
  setDeleteConfirm: (confirm: any) => void
) {
  const [projects, setProjects] = useState<Project[]>([]);

  // Modals / forms states
  const [projectFormOpen, setProjectFormOpen] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [assemblyFormOpen, setAssemblyFormOpen] = useState<boolean>(false);
  const [editingAssemblyId, setEditingAssemblyId] = useState<string | null>(null);
  const [targetAsmProjectId, setTargetAsmProjectId] = useState<string | null>(null);

  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);
  const [copySourceId, setCopySourceId] = useState<string | null>(null);

  const [spotlightOpen, setSpotlightOpen] = useState<boolean>(false);
  const [spotlightProjectId, setSpotlightProjectId] = useState<string | null>(null);

  const [depModalOpen, setDepModalOpen] = useState<boolean>(false);
  const [depModalRowKey, setDepModalRowKey] = useState<string | null>(null);

  // Form fields
  const [pName, setPName] = useState<string>('');
  const [pWorkOrder, setPWorkOrder] = useState<string>('');
  const [pStatus, setPStatus] = useState<'active' | 'pending' | 'completed' | 'on-hold'>('active');
  const [pStart, setPStart] = useState<string>('');
  const [pDue, setPDue] = useState<string>('');
  const [pCat, setPCat] = useState<'tray' | 'nontray'>('tray');
  const [pLoc, setPLoc] = useState<'workshop1' | 'workshop2'>('workshop1');
  const [pNotes, setPNotes] = useState<string>('');
  const [pBudgetHours, setPBudgetHours] = useState<string>('');
  const [pTargetMonth, setPTargetMonth] = useState<string>('');

  const [aName, setAName] = useState<string>('');
  const [aStart, setAStart] = useState<string>('');
  const [aFinish, setAFinish] = useState<string>('');
  const [aNotes, setANotes] = useState<string>('');
  const [aBudgetHours, setABudgetHours] = useState<string>('');
  const [aTasksDraft, setATasksDraft] = useState<{ id: string; name: string; difficulty: number; pct: number; done: boolean; date?: string; finishDate?: string }[]>([]);

  const [copyName, setCopyName] = useState<string>('');
  const [copyStart, setCopyStart] = useState<string>('');
  const [copyDue, setCopyDue] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<string>('active');
  const [copyAsm, setCopyAsm] = useState<boolean>(true);
  const [copyTasks, setCopyTasks] = useState<boolean>(true);
  const [copyKeepClient, setCopyKeepClient] = useState<boolean>(true);

  const { saveItem, removeItem, saveBatch } = useFirestore();

  const openAddProject = () => {
    setEditingProjectId(null);
    setPName('');
    setPWorkOrder('');
    setPStatus('active');
    setPStart('');
    setPDue('');
    setPCat('tray');
    setPLoc('workshop1');
    setPNotes('');
    setPBudgetHours('');
    setPTargetMonth('');
    setProjectFormOpen(true);
  };

  const openEditProjectForm = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setEditingProjectId(pid);
    setPName(p.name);
    setPWorkOrder(p.client);
    setPStatus(p.status as any);
    setPStart(p.start || '');
    setPDue(p.due || '');
    setPCat(p.category || 'tray');
    setPLoc(p.location || 'workshop1');
    setPNotes(p.notes || '');
    setPBudgetHours(p.budgetHours !== undefined ? String(p.budgetHours) : '');
    setPTargetMonth(p.targetMonth || '');
    setProjectFormOpen(true);
  };

  const saveProjectForm = () => {
    if (!pName.trim()) return alert('Insert project name.');
    const wo = pWorkOrder.trim() || 'WO-' + uid().toUpperCase();
    const parsedBudget = pBudgetHours.trim() ? parseFloat(pBudgetHours) : undefined;

    if (editingProjectId) {
      const p = projects.find(x => x.id === editingProjectId);
      if (p) {
        const wasCompleted = p.status === 'completed';
        const completedDate = pStatus === 'completed' && !wasCompleted ? new Date().toISOString().slice(0, 10) : p.completedDate;
        const updatedProj = {
          ...p,
          name: pName.trim(),
          client: wo,
          status: pStatus,
          start: pStart,
          due: pDue,
          category: pCat,
          location: pLoc,
          notes: pNotes.trim(),
          budgetHours: parsedBudget,
          completedDate: pStatus === 'completed' ? completedDate : null,
          targetMonth: pTargetMonth || ''
        };
        setProjects(prev => prev.map(item => item.id === editingProjectId ? updatedProj : item));
        saveItem('projects', updatedProj);
      }
      logActivity('project_edit', 'Edited project details', editingProjectId, pName.trim(), undefined, undefined, undefined, undefined, `Budget Hours: ${parsedBudget ?? 'N/A'}`);
    } else {
      const addedProj: Project = {
        id: uid(),
        name: pName.trim(),
        client: wo,
        status: pStatus,
        start: pStart,
        due: pDue,
        category: pCat,
        location: pLoc,
        created: new Date().toISOString().slice(0, 10),
        assemblies: [],
        notes: pNotes.trim(),
        budgetHours: parsedBudget,
        completedDate: pStatus === 'completed' ? new Date().toISOString().slice(0, 10) : null,
        targetMonth: pTargetMonth || ''
      };

      setProjects(prev => [...prev, addedProj]);
      saveItem('projects', addedProj);
      logActivity('project_add', 'Added new project', addedProj.id, addedProj.name, undefined, undefined, undefined, undefined, `Loc: ${addedProj.location}, Budget: ${parsedBudget ?? 'N/A'}`);
    }

    setProjectFormOpen(false);
    verifyMarkChanged();
  };

  const deleteProjectDetails = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Project Details',
      message: `Are you sure you want to permanently delete project "${p.name}"? This will delete all sub-assemblies and tasks inside.`,
      onConfirm: () => {
        setProjects(prev => prev.filter(x => x.id !== pid));
        removeItem('projects', pid);
        logActivity('project_delete', 'Deleted project', pid, p.name);
        setProjectFormOpen(false);
        verifyMarkChanged();
        setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const archiveProject = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    const updated = { ...p, isArchived: true };
    setProjects(prev => prev.map(x => x.id === pid ? updated : x));
    saveItem('projects', updated);
    logActivity('project_edit', 'Archived project', pid, p.name, undefined, undefined, undefined, undefined, 'Project moved to historical archive');
    verifyMarkChanged();
  };

  const unarchiveProject = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    const updated = { ...p, isArchived: false };
    setProjects(prev => prev.map(x => x.id === pid ? updated : x));
    saveItem('projects', updated);
    logActivity('project_edit', 'Restored project from archive', pid, p.name, undefined, undefined, undefined, undefined, 'Project moved back to active boards');
    verifyMarkChanged();
  };

  const openAssemblyAddForm = (pid: string) => {
    setTargetAsmProjectId(pid);
    setEditingAssemblyId(null);
    setAName('');
    setAStart('');
    setAFinish('');
    setANotes('');
    setABudgetHours('');
    setATasksDraft([]);
    setAssemblyFormOpen(true);
  };

  const openAssemblyEditForm = (pid: string, aid: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    if (!a) return;

    setTargetAsmProjectId(pid);
    setEditingAssemblyId(aid);
    setAName(a.name);
    setAStart(a.start || '');
    setAFinish(a.finish || '');
    setANotes(a.notes || '');
    setABudgetHours(a.budgetHours !== undefined ? String(a.budgetHours) : '');
    setAssemblyFormOpen(true);
  };

  const addDraftTaskNode = () => {
    setATasksDraft(prev => [...prev, { id: uid(), name: '', difficulty: 1, pct: 0, done: false, date: '', finishDate: '' }]);
  };

  const removeDraftTaskNode = (idx: number) => {
    setATasksDraft(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDraftTaskField = (idx: number, field: string, val: any) => {
    setATasksDraft(prev => prev.map((t, i) => {
      if (i === idx) {
        return { ...t, [field]: val };
      }
      return t;
    }));
  };

  const saveAssemblyForm = () => {
    if (!aName.trim()) return alert('Assembly name required.');
    const p = projects.find(x => x.id === targetAsmProjectId);
    if (!p) return;
    const parsedAsmBudget = aBudgetHours.trim() ? parseFloat(aBudgetHours) : undefined;

    if (editingAssemblyId) {
      const updatedProj = {
        ...p,
        assemblies: p.assemblies.map(a => {
          if (a.id === editingAssemblyId) {
            return { ...a, name: aName.trim(), start: aStart, finish: aFinish, notes: aNotes.trim(), budgetHours: parsedAsmBudget };
          }
          return a;
        })
      };
      setProjects(prev => prev.map(proj => proj.id === targetAsmProjectId ? updatedProj : proj));
      saveItem('projects', updatedProj);
      logActivity('assembly_edit', 'Edited sub-assembly characteristics', p.id, p.name, aName.trim());
    } else {
      const createdAsm: Assembly = {
        id: uid(),
        name: aName.trim(),
        start: aStart,
        finish: aFinish,
        notes: aNotes.trim(),
        budgetHours: parsedAsmBudget,
        tasks: aTasksDraft
          .filter(t => t.name.trim())
          .map(t => ({ id: uid(), name: t.name.trim(), difficulty: typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1, pct: 0, done: false, date: t.date?.trim() || undefined, finishDate: t.finishDate?.trim() || undefined }))
      };

      const updatedProj = { ...p, assemblies: [...p.assemblies, createdAsm] };
      setProjects(prev => prev.map(proj => proj.id === targetAsmProjectId ? updatedProj : proj));
      saveItem('projects', updatedProj);
      logActivity('assembly_add', 'Added new sub-assembly', p.id, p.name, aName.trim(), undefined, undefined, undefined, `${createdAsm.tasks.length} initial tasks appended`);
    }

    setAssemblyFormOpen(false);
    verifyMarkChanged();
  };

  const deleteAssemblyDetails = (pid: string, aid: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    if (!a || !p) return;

    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Sub-Assembly',
      message: `Are you sure you want to permanently delete the sub-assembly "${a.name}" from "${p?.name || ''}"?`,
      onConfirm: () => {
        const updated = { ...p, assemblies: p.assemblies.filter(x => x.id !== aid) };
        let updatedProj: Project;
        if (updated.status !== 'completed' && calcPct(updated) === 100) {
          updatedProj = {
            ...updated,
            status: 'completed' as any,
            completedDate: new Date().toISOString().slice(0, 10)
          };
        } else if (updated.status === 'completed' && calcPct(updated) < 100) {
          updatedProj = {
            ...updated,
            status: 'active' as any,
            completedDate: null
          };
        } else {
          updatedProj = updated;
        }

        setProjects(prev => prev.map(proj => proj.id === pid ? updatedProj : proj));
        saveItem('projects', updatedProj);

        logActivity('assembly_delete', 'Deleted sub-assembly', pid, p?.name, a.name);
        verifyMarkChanged();
        setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const editTaskParameters = (pid: string, aid: string, tid: string, action: string, field: 'name' | 'difficulty' | 'pct', value: any) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    const t = a && a.tasks.find(x => x.id === tid);
    if (!t || !p) return;

    const oldPct = t.pct;

    const updated = {
      ...p,
      assemblies: p.assemblies.map(asm => {
        if (asm.id === aid) {
          return {
            ...asm,
            tasks: asm.tasks.map(tsk => {
              if (tsk.id === tid) {
                const next = { ...tsk, [field]: value };
                if (field === 'pct') {
                  next.done = value >= 100;
                }
                return next;
              }
              return tsk;
            })
          };
        }
        return asm;
      })
    };

    let updatedProj: Project;
    if (updated.status !== 'completed' && calcPct(updated) === 100) {
      updatedProj = {
        ...updated,
        status: 'completed' as any,
        completedDate: new Date().toISOString().slice(0, 10)
      };
    } else if (updated.status === 'completed' && calcPct(updated) < 100) {
      updatedProj = {
        ...updated,
        status: 'active' as any,
        completedDate: null
      };
    } else {
      updatedProj = updated;
    }

    setProjects(prev => prev.map(proj => proj.id === pid ? updatedProj : proj));
    saveItem('projects', updatedProj);

    if (field === 'pct') {
      logActivity('task_progress', action, pid, p?.name, a?.name, t.name, oldPct, value);
    }
    verifyMarkChanged();
  };

  const addNewTaskNode = (pid: string, aid: string, name: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    if (!a || !p) return;

    const added: Task = { id: uid(), name: name.trim(), difficulty: 1, pct: 0, done: false };

    const updated = {
      ...p,
      assemblies: p.assemblies.map(asm => {
        if (asm.id === aid) {
          return { ...asm, tasks: [...asm.tasks, added] };
        }
        return asm;
      })
    };

    let updatedProj: Project;
    if (updated.status === 'completed' && calcPct(updated) < 100) {
      updatedProj = {
        ...updated,
        status: 'active' as any,
        completedDate: null
      };
    } else {
      updatedProj = updated;
    }

    setProjects(prev => prev.map(proj => proj.id === pid ? updatedProj : proj));
    saveItem('projects', updatedProj);

    logActivity('task_add', 'Added new task', pid, p?.name, a.name, added.name);
    verifyMarkChanged();
  };

  const removeTaskNode = (pid: string, aid: string, tid: string) => {
    const p = projects.find(x => x.id === pid);
    const a = p && p.assemblies.find(x => x.id === aid);
    const t = a && a.tasks.find(x => x.id === tid);
    if (!p) return;

    const updated = {
      ...p,
      assemblies: p.assemblies.map(asm => {
        if (asm.id === aid) {
          return { ...asm, tasks: asm.tasks.filter(x => x.id !== tid) };
        }
        return asm;
      })
    };

    let updatedProj: Project;
    if (updated.status !== 'completed' && calcPct(updated) === 100) {
      updatedProj = {
        ...updated,
        status: 'completed' as any,
        completedDate: new Date().toISOString().slice(0, 10)
      };
    } else if (updated.status === 'completed' && calcPct(updated) < 100) {
      updatedProj = {
        ...updated,
        status: 'active' as any,
        completedDate: null
      };
    } else {
      updatedProj = updated;
    }

    setProjects(prev => prev.map(proj => proj.id === pid ? updatedProj : proj));
    saveItem('projects', updatedProj);

    logActivity('task_delete', 'Deleted task record', pid, p?.name, a?.name, t?.name);
    verifyMarkChanged();
  };

  const openCopyModalLauncher = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setCopySourceId(pid);
    setCopyName('Copy of ' + p.name);
    setCopyStart(p.start || '');
    setCopyDue(p.due || '');
    setCopyStatus('active');
    setCopyModalOpen(true);
  };

  const confirmCopyMultiplier = () => {
    const src = projects.find(x => x.id === copySourceId);
    if (!src) return;
    if (!copyName.trim()) return alert('Name project copy.');

    const copiedProj: Project = {
      id: uid(),
      name: copyName.trim(),
      client: copyKeepClient ? src.client : '',
      start: copyStart,
      due: copyDue,
      status: copyStatus as any,
      category: src.category || 'tray',
      location: src.location || 'workshop1',
      created: new Date().toISOString().slice(0, 10),
      assemblies: copyAsm ? (src.assemblies || []).map(a => ({
        id: uid(),
        name: a.name,
        notes: a.notes,
        tasks: copyTasks ? (a.tasks || []).map(t => ({ id: uid(), name: t.name, difficulty: t.difficulty || 1, pct: 0, done: false })) : []
      })) : []
    };

    setProjects(prev => [...prev, copiedProj]);
    saveItem('projects', copiedProj);
    setCopyModalOpen(false);
    verifyMarkChanged();
    alert('Project cloned!');
  };

  const saveDependenciesHandler = (targetKey: string, preds: any[], succs: any[]) => {
    const targetId = targetKey.split(':')[1];
    const p = projects.find(proj => proj.id === targetId || `p:${proj.id}` === targetKey);
    if (!p) return;

    let nextP: Project;
    if (targetKey === `p:${p.id}`) {
      nextP = { ...p, predecessors: preds, successors: succs };
    } else if (targetKey.startsWith('a:') && targetKey.split(':')[1] === p.id) {
      const aid = targetKey.split(':')[2];
      nextP = {
        ...p,
        assemblies: (p.assemblies || []).map(a => a.id === aid ? { ...a, predecessors: preds, successors: succs } : a)
      };
    } else if (targetKey.startsWith('t:') && targetKey.split(':')[1] === p.id) {
      const aid = targetKey.split(':')[2];
      const tid = targetKey.split(':')[3];
      nextP = {
        ...p,
        assemblies: (p.assemblies || []).map(a => a.id === aid ? {
          ...a,
          tasks: (a.tasks || []).map(t => t.id === tid ? { ...t, predecessors: preds, successors: succs } : t)
        } : a)
      };
    } else {
      nextP = p;
    }

    if (nextP !== p) {
      const updatedProjects = projects.map(proj => proj.id === p.id ? nextP : proj);
      const finalProjects = propagateAllSchedules(updatedProjects, targetKey);
      
      setProjects(finalProjects);
      
      finalProjects.forEach(proj => {
        const orig = projects.find(x => x.id === proj.id);
        if (orig && JSON.stringify(orig) !== JSON.stringify(proj)) {
          saveItem('projects', proj);
        }
      });
    }

    verifyMarkChanged();
    setDepModalOpen(false);
  };

  const importProjectsExcel = (imported: Project[]) => {
    setProjects(prev => {
      const copy = [...prev];
      imported.forEach(p => {
        const existingIdx = copy.findIndex(x => x.id === p.id || (x.client && p.client && x.client.toLowerCase() === p.client.toLowerCase()));
        if (existingIdx > -1) {
          copy[existingIdx] = {
            ...p,
            id: copy[existingIdx].id // Keep existing database ID
          };
        } else {
          copy.push(p);
        }
      });
      return copy;
    });

    saveBatch('projects', imported);
    logActivity('project_add', 'Imported projects from Excel', undefined, undefined, undefined, undefined, undefined, undefined, `Imported ${imported.length} project records successfully`);
    verifyMarkChanged();
  };

  return {
    saveDependenciesHandler,
    projects,
    setProjects,
    projectFormOpen,
    setProjectFormOpen,
    editingProjectId,
    setEditingProjectId,
    assemblyFormOpen,
    setAssemblyFormOpen,
    editingAssemblyId,
    setEditingAssemblyId,
    targetAsmProjectId,
    setTargetAsmProjectId,
    copyModalOpen,
    setCopyModalOpen,
    copySourceId,
    setCopySourceId,
    spotlightOpen,
    setSpotlightOpen,
    spotlightProjectId,
    setSpotlightProjectId,
    depModalOpen,
    setDepModalOpen,
    depModalRowKey,
    setDepModalRowKey,
    pName,
    setPName,
    pWorkOrder,
    setPWorkOrder,
    pStatus,
    setPStatus,
    pStart,
    setPStart,
    pDue,
    setPDue,
    pCat,
    setPCat,
    pLoc,
    setPLoc,
    pNotes,
    setPNotes,
    pBudgetHours,
    setPBudgetHours,
    pTargetMonth,
    setPTargetMonth,
    aName,
    setAName,
    aStart,
    setAStart,
    aFinish,
    setAFinish,
    aNotes,
    setANotes,
    aBudgetHours,
    setABudgetHours,
    aTasksDraft,
    setATasksDraft,
    copyName,
    setCopyName,
    copyStart,
    setCopyStart,
    copyDue,
    setCopyDue,
    copyStatus,
    setCopyStatus,
    copyAsm,
    setCopyAsm,
    copyTasks,
    setCopyTasks,
    copyKeepClient,
    setCopyKeepClient,
    openAddProject,
    openEditProjectForm,
    saveProjectForm,
    deleteProjectDetails,
    archiveProject,
    unarchiveProject,
    openAssemblyAddForm,
    openAssemblyEditForm,
    addDraftTaskNode,
    removeDraftTaskNode,
    handleDraftTaskField,
    saveAssemblyForm,
    deleteAssemblyDetails,
    editTaskParameters,
    addNewTaskNode,
    removeTaskNode,
    openCopyModalLauncher,
    confirmCopyMultiplier,
    importProjectsExcel
  };
}
export default useProjects;
