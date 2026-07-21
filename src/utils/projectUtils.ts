import { Project, TimesheetEntry, Dependency, WireLog, MaterialConsumptionLog } from '../types';

export function calcTaskCounts(project: Project) {
  let total = 0;
  let done = 0;
  (project.assemblies || []).forEach(a => {
    (a.tasks || []).forEach(t => {
      total++;
      if (t.pct >= 100 || t.done) {
        done++;
      }
    });
  });
  return { total, done };
}

export function calcPct(project: Project): number {
  let totalWeight = 0;
  let accumulatedWeightedPct = 0;
  (project.assemblies || []).forEach(a => {
    (a.tasks || []).forEach(t => {
      const difficulty = typeof t.difficulty === 'number' && t.difficulty > 0 ? t.difficulty : 1;
      totalWeight += difficulty;
      accumulatedWeightedPct += (t.pct || 0) * difficulty;
    });
  });
  if (totalWeight === 0) return 0;
  return Math.round(accumulatedWeightedPct / totalWeight);
}

export function calcDuration(startStr?: string, endStr?: string) {
  if (!startStr || !endStr) return null;
  const s = new Date(startStr);
  const e = new Date(endStr);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diffMs = e.getTime() - s.getTime();
  if (diffMs < 0) return null;

  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return { days: 0, label: 'Same day', weeks: 0, months: 0 };
  }
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30.44);
  let label = '';
  if (months >= 2) {
    label = `${months} months`;
  } else if (weeks >= 2) {
    label = `${weeks} weeks`;
  } else if (days === 1) {
    label = '1 day';
  } else {
    label = `${days} days`;
  }
  return { days, weeks, months, label };
}

export function getManHoursForWorkOrder(client: string, timesheets: TimesheetEntry[]): number {
  if (!client) return 0;
  const target = client.trim().toLowerCase();
  return timesheets.reduce((sum, e) => {
    if ((e.workOrder || '').trim().toLowerCase() === target) {
      sum += e.totalHours || 0;
    }
    return sum;
  }, 0);
}

export function getManHoursForAssembly(client: string, assemblyId: string, timesheets: TimesheetEntry[]): number {
  if (!client || !assemblyId) return 0;
  const target = client.trim().toLowerCase();
  return timesheets.reduce((sum, e) => {
    if ((e.workOrder || '').trim().toLowerCase() === target && e.assemblyId === assemblyId) {
      sum += e.totalHours || 0;
    }
    return sum;
  }, 0);
}

export function getTotalManHours(timesheets: TimesheetEntry[]): number {
  return timesheets.reduce((sum, e) => sum + (e.totalHours || 0), 0);
}

export function fmtHrs(h: number): string {
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

export function esc(s?: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getSequenceNumber(rowKey: string, projects: Project[], selectedMonth?: string): string {
  if (!rowKey) return '';
  const parts = rowKey.split(':');
  const typeLetter = parts[0];
  const pId = parts[1];

  let filtered = projects.filter(p => !p.isArchived);
  if (selectedMonth) {
    filtered = filtered.filter(p => {
      if (p.targetMonth) {
        return p.targetMonth === selectedMonth;
      }
      if (p.due) {
        const d = new Date(p.due + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return k === selectedMonth;
        }
      }
      const [yr, mo] = selectedMonth.split('-').map(Number);
      const mStart = new Date(yr, mo - 1, 1);
      const mEnd = new Date(yr, mo, 0);
      const pS = p.start ? new Date(p.start + 'T00:00:00') : mStart;
      const pE = p.due ? new Date(p.due + 'T00:00:00') : mEnd;
      return (pS <= mEnd && pE >= mStart);
    });
  }

  const activeProjects = filtered.length > 0 ? filtered : projects.filter(p => !p.isArchived);

  const pi = activeProjects.findIndex(x => x.id === pId);
  if (pi === -1) {
    const fallbackPi = projects.filter(p => !p.isArchived).findIndex(x => x.id === pId);
    if (fallbackPi === -1) return '';
    const pSeq = `${fallbackPi + 1}`;
    if (typeLetter === 'p') return pSeq;
    const pObj = projects.find(x => x.id === pId);
    if (!pObj) return pSeq;
    if (typeLetter === 'a') {
      const aId = parts[2];
      const ai = (pObj.assemblies || []).findIndex(x => x.id === aId);
      return ai !== -1 ? `${pSeq}.${ai + 1}` : pSeq;
    }
    if (typeLetter === 't') {
      const aId = parts[2];
      const tId = parts[3];
      const aObj = (pObj.assemblies || []).find(x => x.id === aId);
      if (!aObj) return pSeq;
      const ai = (pObj.assemblies || []).findIndex(x => x.id === aId);
      const ti = (aObj.tasks || []).findIndex(x => x.id === tId);
      return ai !== -1 && ti !== -1 ? `${pSeq}.${ai + 1}.${ti + 1}` : pSeq;
    }
    return pSeq;
  }

  const pSeq = `${pi + 1}`;
  if (typeLetter === 'p') return pSeq;

  const pObj = activeProjects[pi];
  if (typeLetter === 'a') {
    const aId = parts[2];
    const ai = (pObj.assemblies || []).findIndex(x => x.id === aId);
    return ai !== -1 ? `${pSeq}.${ai + 1}` : pSeq;
  }

  if (typeLetter === 't') {
    const aId = parts[2];
    const tId = parts[3];
    const aObj = (pObj.assemblies || []).find(x => x.id === aId);
    if (!aObj) return pSeq;
    const ai = (pObj.assemblies || []).findIndex(x => x.id === aId);
    const ti = (aObj.tasks || []).findIndex(x => x.id === tId);
    return ai !== -1 && ti !== -1 ? `${pSeq}.${ai + 1}.${ti + 1}` : pSeq;
  }

  return pSeq;
}

function csvEsc(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportProjectsCSV(
  projects: Project[],
  timesheets: TimesheetEntry[],
  wireLogs: WireLog[] = [],
  consumptionLogs: MaterialConsumptionLog[] = []
) {
  const headers = [
    'Project ID',
    'Project Name',
    'Work Order',
    'Status',
    'Category',
    'Location',
    'Start Date',
    'Due Date',
    'Completed Date',
    'Budget Hours',
    'Actual Man-Hours Used',
    'Total Wire Consumed (kg)',
    'PPE Items Issued',
    'Welding Consumables Used',
    'Other Materials Used',
    'Assemblies Count',
    'Total Tasks',
    'Completed Tasks',
    'Overall Progress (%)',
    'Archived'
  ];

  const csvRows = [headers.join(',')];

  projects.forEach(p => {
    const actualHours = getManHoursForWorkOrder(p.client, timesheets);
    
    // Wire logs per project
    const projWireLogs = wireLogs.filter(w => w.projectId === p.id);
    const totalWire = projWireLogs.reduce((sum, w) => sum + (w.amountKg || 0), 0);

    // Consumption logs per project
    const projCons = consumptionLogs.filter(c => c.projectId === p.id);
    const totalPPE = projCons
      .filter(c => c.category === 'PPE')
      .reduce((sum, c) => sum + (c.qtyUsed || 0), 0);
    const totalWeldingCons = projCons
      .filter(c => c.category === 'Welding Consumable')
      .reduce((sum, c) => sum + (c.qtyUsed || 0), 0);
    const totalOtherMat = projCons
      .filter(c => c.category !== 'PPE' && c.category !== 'Welding Consumable')
      .reduce((sum, c) => sum + (c.qtyUsed || 0), 0);

    const taskCounts = calcTaskCounts(p);
    const progress = calcPct(p);

    const row = [
      csvEsc(p.id),
      csvEsc(p.name),
      csvEsc(p.client),
      csvEsc(p.status),
      csvEsc(p.category),
      csvEsc(p.location === 'workshop1' ? 'Workshop 1' : 'Workshop 2'),
      csvEsc(p.start || ''),
      csvEsc(p.due || ''),
      csvEsc(p.completedDate || ''),
      csvEsc(p.budgetHours !== undefined ? p.budgetHours : ''),
      csvEsc(actualHours),
      csvEsc(totalWire),
      csvEsc(totalPPE),
      csvEsc(totalWeldingCons),
      csvEsc(totalOtherMat),
      csvEsc((p.assemblies || []).length),
      csvEsc(taskCounts.total),
      csvEsc(taskCounts.done),
      csvEsc(progress),
      csvEsc(p.isArchived ? 'Yes' : 'No')
    ];
    csvRows.push(row.join(','));
  });

  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10);
  link.setAttribute('download', `austin_batam_projects_${dateStr}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface FlatItem {
  key: string;
  type: 'project' | 'assembly' | 'task';
  name: string;
  start: string;
  due: string;
  predecessors: Dependency[];
  successors: Dependency[];
  duration: number;
  isMilestone: boolean;
  pId: string;
  aId?: string;
  tId?: string;
}

function getDaysBetween(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 1;
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const diffTime = e.getTime() - s.getTime();
  if (isNaN(diffTime)) return 1;
  return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Edge {
  toKey: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
}

function getOutgoingEdges(itemKey: string, flatItems: FlatItem[]): Edge[] {
  const edges: Edge[] = [];
  const currentItem = flatItems.find(x => x.key === itemKey);
  if (!currentItem) return edges;

  // 1. Direct successors declared on currentItem
  (currentItem.successors || []).forEach(s => {
    edges.push({ toKey: s.key, type: s.type || 'FS', lag: s.lag || 0 });
  });

  // 2. Predecessor links declared on other items pointing to currentItem
  flatItems.forEach(other => {
    (other.predecessors || []).forEach(p => {
      if (p.key === itemKey) {
        edges.push({ toKey: other.key, type: p.type || 'FS', lag: p.lag || 0 });
      }
    });
  });

  return edges;
}

export function propagateAllSchedules(projects: Project[], changedKey: string): Project[] {
  const flatItems: FlatItem[] = [];
  projects.forEach(p => {
    const pKey = `p:${p.id}`;
    const pStart = p.start || '';
    const pDue = p.due || '';
    const pDur = getDaysBetween(pStart, pDue);
    
    flatItems.push({
      key: pKey,
      type: 'project',
      name: p.name,
      start: pStart,
      due: pDue,
      predecessors: p.predecessors || [],
      successors: p.successors || [],
      duration: pDur,
      isMilestone: false,
      pId: p.id
    });

    (p.assemblies || []).forEach(a => {
      const aKey = `a:${p.id}:${a.id}`;
      const aStart = a.start || '';
      const aDue = a.finish || '';
      const aDur = getDaysBetween(aStart, aDue);

      flatItems.push({
        key: aKey,
        type: 'assembly',
        name: a.name,
        start: aStart,
        due: aDue,
        predecessors: a.predecessors || [],
        successors: a.successors || [],
        duration: aDur,
        isMilestone: false,
        pId: p.id,
        aId: a.id
      });

      (a.tasks || []).forEach(t => {
        const tKey = `t:${p.id}:${a.id}:${t.id}`;
        const tStart = t.date || '';
        const tDue = t.finishDate || '';
        const tDur = getDaysBetween(tStart, tDue);
        const isMilestone = !!(t.isMilestone || (tStart && tDue && tStart === tDue));

        flatItems.push({
          key: tKey,
          type: 'task',
          name: t.name,
          start: tStart,
          due: tDue,
          predecessors: t.predecessors || [],
          successors: t.successors || [],
          duration: tDur,
          isMilestone,
          pId: p.id,
          aId: a.id,
          tId: t.id
        });
      });
    });
  });

  const queue = [changedKey];
  const visitCount: Record<string, number> = {};

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    visitCount[currentKey] = (visitCount[currentKey] || 0) + 1;
    if (visitCount[currentKey] > 15) {
      continue;
    }

    const currentItem = flatItems.find(x => x.key === currentKey);
    if (!currentItem) continue;

    const edges = getOutgoingEdges(currentKey, flatItems);
    edges.forEach(edge => {
      const successor = flatItems.find(x => x.key === edge.toKey);
      if (!successor) return;

      let proposedStart = successor.start;
      let proposedDue = successor.due;

      if (edge.type === 'FS') {
        proposedStart = addDaysToDateStr(currentItem.due, 1 + edge.lag);
        proposedDue = addDaysToDateStr(proposedStart, successor.duration - 1);
      } else if (edge.type === 'SS') {
        proposedStart = addDaysToDateStr(currentItem.start, edge.lag);
        proposedDue = addDaysToDateStr(proposedStart, successor.duration - 1);
      } else if (edge.type === 'FF') {
        proposedDue = addDaysToDateStr(currentItem.due, edge.lag);
        proposedStart = addDaysToDateStr(proposedDue, -(successor.duration - 1));
      } else if (edge.type === 'SF') {
        proposedDue = addDaysToDateStr(currentItem.start, -1 + edge.lag);
        proposedStart = addDaysToDateStr(proposedDue, -(successor.duration - 1));
      }

      if (proposedStart !== successor.start || proposedDue !== successor.due) {
        successor.start = proposedStart;
        successor.due = proposedDue;
        queue.push(successor.key);
      }
    });
  }

  return projects.map(p => {
    const pFlat = flatItems.find(x => x.key === `p:${p.id}`);
    const nextP = pFlat ? { ...p, start: pFlat.start, due: pFlat.due } : p;

    const nextAssemblies = (nextP.assemblies || []).map(a => {
      const aFlat = flatItems.find(x => x.key === `a:${p.id}:${a.id}`);
      const nextA = aFlat ? { ...a, start: aFlat.start, finish: aFlat.due } : a;

      const nextTasks = (nextA.tasks || []).map(t => {
        const tFlat = flatItems.find(x => x.key === `t:${p.id}:${a.id}:${t.id}`);
        return tFlat ? { ...t, date: tFlat.start, finishDate: tFlat.due } : t;
      });

      return { ...nextA, tasks: nextTasks };
    });

    return { ...nextP, assemblies: nextAssemblies };
  });
}

