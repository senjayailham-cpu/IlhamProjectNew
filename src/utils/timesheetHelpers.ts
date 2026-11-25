import { Project, TimesheetEntry } from '../types';

/**
 * Normalizes a string for case-insensitive trimmed comparison.
 */
function norm(v?: string | null): string {
  return (v || '').trim().toLowerCase();
}

/**
 * Checks if a TimesheetEntry belongs to a given Project by projectId, client (WO), gaNumber, or name.
 */
export function matchesProjectEntry(entry: TimesheetEntry, project: Project): boolean {
  if (entry.projectId && entry.projectId === project.id) return true;
  const wo = norm(entry.workOrder);
  if (!wo) return false;
  const candidates = [project.client, project.gaNumber, project.name]
    .map(norm)
    .filter(Boolean);
  return candidates.includes(wo);
}

/**
 * Resolves the matching Project for a workOrder string (checks client, gaNumber, then name).
 */
export function findProjectByWoQuery(wo: string | undefined | null, projects: Project[]): Project | null {
  const q = norm(wo);
  if (!q) return null;
  return (
    projects.find(p => norm(p.client) === q) ||
    projects.find(p => norm(p.gaNumber) === q) ||
    projects.find(p => norm(p.name) === q) ||
    null
  );
}

/**
 * Resolves the matching Project for a TimesheetEntry (prefers projectId, then WO matching).
 */
export function findProjectForTimesheet(entry: TimesheetEntry, projects: Project[]): Project | null {
  if (entry.projectId) {
    const byId = projects.find(p => p.id === entry.projectId);
    if (byId) return byId;
  }
  return findProjectByWoQuery(entry.workOrder, projects);
}

/**
 * Validates a draft row in TimesheetModal.
 * - Absent & Leave rows are valid with 0 hours and empty workOrder.
 * - Present & Late rows require a non-empty workOrder and positive hours (<= 24).
 */
export function isTimesheetDraftRowValid(row: {
  included: boolean;
  status: 'present' | 'late' | 'absent' | 'leave';
  workOrder: string;
  totalHours: string | number;
}): boolean {
  if (!row.included) return false;
  const rawHrs = typeof row.totalHours === 'string' ? row.totalHours.trim() : String(row.totalHours);
  const parsedHrs = rawHrs === '' ? 0 : Number(rawHrs);
  if (!Number.isFinite(parsedHrs) || parsedHrs < 0 || parsedHrs > 24) return false;

  if (row.status === 'absent' || row.status === 'leave') {
    return true;
  }
  return row.workOrder.trim().length > 0 && parsedHrs > 0;
}

/**
 * Finds the most recent date strictly before `targetDate` that has timesheet entries
 * for any employee in `empIds`, returning all matching entries on that date.
 */
export function findPreviousCrewTimesheets(
  targetDate: string,
  empIds: string[],
  timesheets: TimesheetEntry[]
): { sourceDate: string | null; logs: TimesheetEntry[] } {
  if (!targetDate || empIds.length === 0 || timesheets.length === 0) {
    return { sourceDate: null, logs: [] };
  }
  const empSet = new Set(empIds);
  let latestDate: string | null = null;

  for (const ts of timesheets) {
    if (!empSet.has(ts.empId)) continue;
    if (!ts.date || ts.date >= targetDate) continue;
    if (!latestDate || ts.date > latestDate) {
      latestDate = ts.date;
    }
  }

  if (!latestDate) {
    return { sourceDate: null, logs: [] };
  }

  return {
    sourceDate: latestDate,
    logs: timesheets.filter(ts => ts.date === latestDate && empSet.has(ts.empId)),
  };
}

/**
 * Computes remaining hours against a standard 8h shift when adding a split WO row.
 */
export function calculateSplitRemainingHours(usedHours: number, standardShiftHours = 8): string {
  const safeUsed = Number.isFinite(usedHours) && usedHours > 0 ? usedHours : 0;
  const remaining = Math.round(Math.max(0, standardShiftHours - safeUsed) * 10) / 10;
  return remaining > 0 ? String(remaining) : '';
}
