import { Project, TimesheetEntry } from '../types';

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

function csvEsc(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportProjectsCSV(projects: Project[], timesheets: TimesheetEntry[]) {
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
    'Archived'
  ];

  const csvRows = [headers.join(',')];

  projects.forEach(p => {
    const actualHours = getManHoursForWorkOrder(p.client, timesheets);
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

