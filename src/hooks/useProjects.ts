import { useState } from 'react';
import { Project, Assembly, Task, MaterialProcessing, BomTemplate } from '../types';
import { uid, calcPct } from '../utils';
import { buildCopiedStructure, buildStructureFromBomTemplate } from '../utils/copyStructureUtils';
import { useFirestore } from './useFirestore';
import { propagateAllSchedules } from '../utils/projectUtils';

export function useProjects(
  logActivity: (type: any, action: string, projId?: string, projName?: string, asmName?: string, task?: string, oldP?: number, newP?: number, details?: string) => void,
  verifyMarkChanged: () => void,
  setDeleteConfirm: (confirm: any) => void,
  onEnsureMasterData?: (category: 'material' | 'partNo' | 'client' | 'customer' | 'subAssembly' | 'gaNumber', value: string, gaNumber?: string) => Promise<void>,
  bomTemplates?: BomTemplate[]
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

  // GA Match auto-flow states
  const [gaMatchModalOpen, setGaMatchModalOpen] = useState<boolean>(false);
  const [gaMatchCandidates, setGaMatchCandidates] = useState<Project[]>([]);
  const [pendingNewProjectData, setPendingNewProjectData] = useState<any>(null);

  // Form fields
  const [pName, setPName] = useState<string>('');
  const [pWorkOrder, setPWorkOrder] = useState<string>('');
  const [pCustomer, setPCustomer] = useState<string>('');
  const [pGaNumber, setPGaNumber] = useState<string>('');
  const [pStatus, setPStatus] = useState<'active' | 'pending' | 'completed' | 'on-hold'>('active');
  const [pStart, setPStart] = useState<string>('');
  const [pDue, setPDue] = useState<string>('');
  const [pCat, setPCat] = useState<string>('tray');
  const [pLoc, setPLoc] = useState<string>('workshop1');
  const [pNotes, setPNotes] = useState<string>('');
  const [pBudgetHours, setPBudgetHours] = useState<string>('');
  const [pTargetMonth, setPTargetMonth] = useState<string>('');
  const [pPriority, setPPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [pSelectedBomId, setPSelectedBomId] = useState<string>('');

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
    setPCustomer('');
    setPGaNumber('');
    setPStatus('active');
    setPStart('');
    setPDue('');
    setPCat('tray');
    setPLoc('workshop1');
    setPNotes('');
    setPBudgetHours('');
    setPTargetMonth('');
    setPPriority('medium');
    setPSelectedBomId('');
    setProjectFormOpen(true);
  };

  const openEditProjectForm = (pid: string) => {
    const p = projects.find(x => x.id === pid);
    if (!p) return;
    setEditingProjectId(pid);
    setPName(p.name);
    setPWorkOrder(p.client);
    setPCustomer(p.customer || '');
    setPGaNumber(p.gaNumber || '');
    setPStatus(p.status as any);
    setPStart(p.start || '');
    setPDue(p.due || '');
    setPCat(p.category || 'tray');
    setPLoc(p.location || 'workshop1');
    setPNotes(p.notes || '');
    setPBudgetHours(p.budgetHours !== undefined ? String(p.budgetHours) : '');
    setPTargetMonth(p.targetMonth || '');
    setPPriority(p.priority || 'medium');
    setPSelectedBomId('');
    setProjectFormOpen(true);
  };

  const createProjectNow = (
    baseData: any,
    copiedAssemblies: Assembly[],
    copiedMaterials: MaterialProcessing[] = []
  ) => {
    const newProjId = uid();
    // Ensure all copied/generated materials carry correct projectId and metadata
    const fixedMaterials = copiedMaterials.map(m => ({
      ...m,
      id: m.id || ('mp_' + uid()),
      projectId: newProjId,
      projectName: baseData.name,
      workOrder: baseData.client,
      gaNumber: baseData.gaNumber || m.gaNumber || ''
    }));

    const addedProj: Project = {
      id: newProjId,
      ...baseData,
      created: new Date().toISOString().slice(0, 10),
      assemblies: copiedAssemblies,
      materialProcessing: fixedMaterials,
      completedDate: baseData.status === 'completed'
        ? new Date().toISOString().slice(0, 10) : null,
      originalDue: baseData.due || undefined,
    };
    setProjects(prev => [...prev, addedProj]);
    saveItem('projects', addedProj);
    setSpotlightProjectId(addedProj.id);

    // Register GA Number to Master Data for future autocomplete
    if (addedProj.gaNumber && onEnsureMasterData) {
      onEnsureMasterData('gaNumber', addedProj.gaNumber).catch(err =>
        console.error('Failed to register GA Number to master data:', err)
      );
    }
    // Register Customer to Master Data for future autocomplete
    if (addedProj.customer && onEnsureMasterData) {
      onEnsureMasterData('customer', addedProj.customer).catch(err =>
        console.error('Failed to register customer to master data:', err)
      );
    }
    logActivity('project_add',
      copiedAssemblies.length > 0
        ? `Added new project (${fixedMaterials.length} MP items & ${copiedAssemblies.length} assemblies generated from BOM/GA)`
        : 'Added new project',
      addedProj.id, addedProj.name, undefined, undefined, undefined, undefined,
      `Loc: ${addedProj.location}, Budget: ${baseData.budgetHours ?? 'N/A'}`
    );
    setProjectFormOpen(false);
    // Reset individual form fields:
    setPName('');
    setPWorkOrder('');
    setPCustomer('');
    setPGaNumber('');
    setPStatus('active');
    setPStart('');
    setPDue('');
    setPCat('tray');
    setPLoc('workshop1');
    setPNotes('');
    setPBudgetHours('');
    setPTargetMonth('');
    setPPriority('medium');
    setPSelectedBomId('');
    verifyMarkChanged();
    return addedProj;
  };

  const handleGaConfirmCopy = (sourceProject: Project, calculatedFinish: string) => {
    if (!pendingNewProjectData) return;

    // Override the due date with the auto-calculated finish
    const finalProjectData = {
      ...pendingNewProjectData,
      due: calculatedFinish,
    };

    // Build a temp target for date-offset calculation
    const tempTarget = { ...finalProjectData, id: 'temp', assemblies: [] } as Project;
    const copiedAssemblies = buildCopiedStructure(sourceProject, tempTarget);

    // Copy material processing items (reset stage progress)
    const copiedMaterials: MaterialProcessing[] = (sourceProject.materialProcessing || [])
      .map(item => {
        const resetStages: any = {};
        (item.activeStages || []).forEach(key => {
          resetStages[key] = { pct: 0, status: 'pending', operator: '', notes: '' };
        });
        return {
          ...item,
          id: 'mp_' + uid(),
          stages: resetStages,
          overallPct: 0,
          isCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

    const newProj = createProjectNow(finalProjectData, copiedAssemblies, copiedMaterials);
    // Fix projectId/projectName/workOrder references in copied materials
    if (newProj) {
      const fixedMaterials = copiedMaterials.map(m => ({
        ...m, projectId: newProj.id, projectName: newProj.name, workOrder: newProj.client,
      }));
      setProjects(prev => prev.map(p =>
        p.id === newProj.id ? { ...p, materialProcessing: fixedMaterials } : p
      ));
      saveItem('projects', { id: newProj.id, materialProcessing: fixedMaterials });
    }

    setGaMatchModalOpen(false);
    setGaMatchCandidates([]);
    setPendingNewProjectData(null);
  };

  const handleGaCreateEmpty = () => {
    if (!pendingNewProjectData) return;
    createProjectNow(pendingNewProjectData, []);
    setGaMatchModalOpen(false);
    setGaMatchCandidates([]);
    setPendingNewProjectData(null);
  };

  const handleGaCancel = () => {
    setGaMatchModalOpen(false);
    setGaMatchCandidates([]);
    setPendingNewProjectData(null);
    // Keep form open so user can edit GA number or cancel manually
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
          customer: pCustomer.trim() || undefined,
          gaNumber: pGaNumber.trim().toUpperCase() || undefined,
          status: pStatus,
          start: pStart,
          due: pDue,
          category: pCat,
          location: pLoc,
          notes: pNotes.trim(),
          budgetHours: parsedBudget,
          completedDate: pStatus === 'completed' ? completedDate : null,
          targetMonth: pTargetMonth || '',
          priority: pPriority
        };
        setProjects(prev => prev.map(item => item.id === editingProjectId ? updatedProj : item));
        saveItem('projects', updatedProj);

        // Register GA Number to Master Data for future autocomplete
        if (updatedProj.gaNumber && onEnsureMasterData) {
          onEnsureMasterData('gaNumber', updatedProj.gaNumber).catch(err =>
            console.error('Failed to register GA Number to master data:', err)
          );
        }
        // Register Customer to Master Data for future autocomplete
        if (updatedProj.customer && onEnsureMasterData) {
          onEnsureMasterData('customer', updatedProj.customer).catch(err =>
            console.error('Failed to register customer to master data:', err)
          );
        }
      }
      logActivity('project_edit', 'Edited project details', editingProjectId, pName.trim(), undefined, undefined, undefined, undefined, `Budget Hours: ${parsedBudget ?? 'N/A'}`);
      setProjectFormOpen(false);
      verifyMarkChanged();
      return;
    }

    // NEW project — check GA Number match first
    const normalizedGa = pGaNumber.trim().toUpperCase();
    const baseProjectData = {
      name: pName.trim(), client: wo,
      customer: pCustomer.trim() || undefined,
      gaNumber: normalizedGa || undefined,
      status: pStatus, start: pStart, due: pDue,
      category: pCat, location: pLoc,
      notes: pNotes.trim(), budgetHours: parsedBudget,
      targetMonth: pTargetMonth || '', priority: pPriority,
    };

    // NEW project — check if BOM template selected
    const chosenBom = pSelectedBomId && bomTemplates ? bomTemplates.find(b => b.id === pSelectedBomId) : null;
    let generatedAsms: Assembly[] = [];
    let generatedMaterials: MaterialProcessing[] = [];

    if (chosenBom) {
      const result = buildStructureFromBomTemplate(
        chosenBom,
        'temp',
        pName.trim(),
        wo,
        normalizedGa || chosenBom.gaNumber || '',
        pStart,
        pDue
      );
      generatedAsms = result.assemblies;
      generatedMaterials = result.materials;
    }

    if (normalizedGa) {
      const matches = projects.filter(p =>
        p.gaNumber && p.gaNumber.trim().toUpperCase() === normalizedGa
      );
      if (matches.length > 0) {
        // Show modal instead of creating immediately
        setGaMatchCandidates(matches);
        setPendingNewProjectData(baseProjectData);
        setGaMatchModalOpen(true);
        return; // STOP — wait for user decision
      }
    }

    // No GA match — create immediately with generated assemblies & materials from BOM if selected
    createProjectNow(baseProjectData, generatedAsms, generatedMaterials);
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

  const deleteProjectsExceptTarget = (targetWorkOrder: string) => {
    const nonTargetProjects = projects.filter(x => {
      const wo = (x.client || '').trim().toUpperCase();
      return wo !== targetWorkOrder.trim().toUpperCase();
    });

    if (nonTargetProjects.length === 0) {
      alert(`No other projects found to delete. Remaining projects have Work Order: ${targetWorkOrder}`);
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Non-Target Projects',
      message: `Are you sure you want to permanently delete all ${nonTargetProjects.length} projects EXCEPT Work Order "${targetWorkOrder}"? This action is irreversible and will delete all sub-assemblies and tasks within those projects.`,
      onConfirm: async () => {
        // Filter out non-target projects from local state
        setProjects(prev => prev.filter(x => (x.client || '').trim().toUpperCase() === targetWorkOrder.trim().toUpperCase()));
        
        // Remove from Firestore
        for (const p of nonTargetProjects) {
          try {
            await removeItem('projects', p.id);
            logActivity('project_delete', 'Deleted project during bulk cleanup', p.id, p.name);
          } catch (err) {
            console.error(`Failed to delete project ${p.id}:`, err);
          }
        }
        
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
      if (onEnsureMasterData) {
        onEnsureMasterData('subAssembly', aName.trim()).catch(() => {});
      }
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
      if (onEnsureMasterData) {
        onEnsureMasterData('subAssembly', aName.trim()).catch(() => {});
      }
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

      // Propagate from each predecessor of the target so the target's own
      // start/finish dates recalculate based on its new predecessor links.
      // Then propagate from the target itself so its successors also shift.
      let finalProjects = updatedProjects;
      const seedKeys = preds.length > 0 ? preds.map((pr: any) => pr.key) : [targetKey];
      seedKeys.forEach((seedKey: string) => {
        finalProjects = propagateAllSchedules(finalProjects, seedKey);
      });
      finalProjects = propagateAllSchedules(finalProjects, targetKey);

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
    pCustomer,
    setPCustomer,
    pGaNumber,
    setPGaNumber,
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
    pPriority,
    setPPriority,
    pSelectedBomId,
    setPSelectedBomId,
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
    deleteProjectsExceptTarget,
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
    importProjectsExcel,
    gaMatchModalOpen,
    gaMatchCandidates,
    pendingNewProjectData,
    handleGaConfirmCopy,
    handleGaCreateEmpty,
    handleGaCancel
  };
}
export default useProjects;
