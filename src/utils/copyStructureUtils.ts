import { Project, Assembly, Task, Dependency } from '../types';
import { uid } from './helpers';

export function shiftDate(dateStr: string | undefined, days: number): string | undefined {
  if (!dateStr) return undefined;
  // Parse YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const yr = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10) - 1;
  const dy = parseInt(parts[2], 10);
  const d = new Date(yr, mo, dy);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildCopiedStructure(sourceProject: Project, targetProject: Project): Assembly[] {
  // a. Hitung offset hari:
  const sourceStart = new Date(sourceProject.start || sourceProject.assemblies?.[0]?.tasks?.[0]?.date || new Date());
  const targetStart = new Date(targetProject.start || new Date());
  const offsetDays = Math.round((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

  // c. PENTING — remap ID dependency: buat Map<string, string> (oldTaskId -> newTaskId) SEBELUM membangun ulang task
  const assemblyIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();

  // Loop pertama: untuk setiap assembly & task di sourceProject.assemblies, generate ID baru
  (sourceProject.assemblies || []).forEach(assembly => {
    assemblyIdMap.set(assembly.id, uid());
    (assembly.tasks || []).forEach(task => {
      taskIdMap.set(task.id, uid());
    });
  });

  const mapDependencies = (deps: Dependency[] | undefined, idMap: Map<string, string>): Dependency[] | undefined => {
    if (!deps) return undefined;
    return deps
      .map(dep => {
        const newKey = idMap.get(dep.key);
        if (!newKey) return null;
        return {
          ...dep,
          key: newKey,
        };
      })
      .filter((dep): dep is Dependency => dep !== null);
  };

  // Loop kedua: bangun ulang assemblies baru
  const newAssemblies: Assembly[] = (sourceProject.assemblies || []).map(assembly => {
    const newAssemblyId = assemblyIdMap.get(assembly.id) || uid();
    
    const newTasks: Task[] = (assembly.tasks || []).map(task => {
      const newTaskId = taskIdMap.get(task.id) || uid();
      return {
        id: newTaskId,
        name: task.name,
        assigned: task.assigned,
        difficulty: task.difficulty,
        pct: 0,
        done: false,
        date: shiftDate(task.date, offsetDays),
        finishDate: shiftDate(task.finishDate, offsetDays),
        // baselineDate/baselineFinish TIDAK disalin
        isMilestone: task.isMilestone,
        predecessors: mapDependencies(task.predecessors, taskIdMap),
        successors: mapDependencies(task.successors, taskIdMap),
      };
    });

    return {
      id: newAssemblyId,
      name: assembly.name,
      notes: assembly.notes,
      budgetHours: assembly.budgetHours,
      start: shiftDate(assembly.start, offsetDays),
      finish: shiftDate(assembly.finish, offsetDays),
      // baselineStart/baselineFinish TIDAK disalin
      predecessors: mapDependencies(assembly.predecessors, assemblyIdMap),
      successors: mapDependencies(assembly.successors, assemblyIdMap),
      tasks: newTasks,
    };
  });

  return newAssemblies;
}

export function calculateProjectDuration(project: Project): number {
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;

  (project.assemblies || []).forEach(asm => {
    (asm.tasks || []).forEach(task => {
      if (task.date) {
        const d = new Date(task.date);
        if (!isNaN(d.getTime())) {
          if (!earliestDate || d < earliestDate) earliestDate = d;
        }
      }
      if (task.finishDate) {
        const d = new Date(task.finishDate);
        if (!isNaN(d.getTime())) {
          if (!latestDate || d > latestDate) latestDate = d;
        }
      }
    });
  });

  // Fallback to project-level dates if no tasks have dates
  if (!earliestDate && project.start) earliestDate = new Date(project.start);
  if (!latestDate && project.due) latestDate = new Date(project.due);

  if (!earliestDate || !latestDate) return 0;

  const diffMs = latestDate.getTime() - earliestDate.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

export function calculateFinishFromStart(
  startDateStr: string,
  durationDays: number
): string {
  if (!startDateStr) return '';
  // Parse YYYY-MM-DD to avoid timezone shifting
  const parts = startDateStr.split('-');
  if (parts.length !== 3) return startDateStr;
  const yr = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10) - 1;
  const dy = parseInt(parts[2], 10);
  
  const start = new Date(yr, mo, dy);
  if (isNaN(start.getTime())) return startDateStr;
  
  start.setDate(start.getDate() + durationDays);
  
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

