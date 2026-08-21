import { Project, TimesheetEntry, InspectionRequest, ProblemReport, MaterialProcessing } from '../types';
import { calcPct, fmtHrs, getManHoursForWorkOrder } from './projectUtils';

export interface RiskScoreContext {
  timesheets?: TimesheetEntry[];
  inspections?: InspectionRequest[];
  problemReports?: ProblemReport[];
  materialProcessing?: MaterialProcessing[];
  today?: string; // YYYY-MM-DD format
}

export interface RiskScoreResult {
  score: number;
  reasons: string[];
  level: 'low' | 'medium' | 'high';
}

/**
 * Calculates a project risk score (0-100) based on real operational rules.
 * 
 * Factors (total ~100):
 * - Overdue due date / delayed tasks (large, ~30-40 pts)
 * - Open inspections punchlist / open problem reports (~20-25 pts)
 * - Low progress with approaching deadline (< 14 days) (~15-25 pts)
 * - Hours burn: logged hours > budgetHours * 1.1 (~15-20 pts)
 * - Material processing overallPct lag (~10 pts)
 */
export function calcProjectRiskScore(project: Project, ctx: RiskScoreContext = {}): RiskScoreResult {
  if (!project || project.status === 'completed' || project.isArchived) {
    return {
      score: 0,
      reasons: [],
      level: 'low'
    };
  }

  const todayStr = ctx.today || new Date().toISOString().slice(0, 10);
  const reasons: string[] = [];
  let rawScore = 0;

  // --------------------------------------------------------------------------
  // Factor 1: Overdue Due Date or Overdue Tasks (~30-40 pts)
  // --------------------------------------------------------------------------
  let isOverdue = false;
  if (project.due && project.due < todayStr) {
    isOverdue = true;
    const diffMs = new Date(todayStr + 'T00:00:00').getTime() - new Date(project.due + 'T00:00:00').getTime();
    const overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    if (overdueDays >= 14) {
      rawScore += 40;
      reasons.push(`Overdue ${overdueDays} hari (due: ${project.due})`);
    } else {
      rawScore += 30;
      reasons.push(`Overdue ${overdueDays} hari`);
    }
  } else {
    // Check overdue tasks if the project itself isn't past due date yet
    let overdueTasksCount = 0;
    (project.assemblies || []).forEach(asm => {
      (asm.tasks || []).forEach(t => {
        if (!t.done && (t.pct || 0) < 100 && t.finishDate && t.finishDate < todayStr) {
          overdueTasksCount++;
        }
      });
    });

    if (overdueTasksCount >= 3) {
      rawScore += 25;
      reasons.push(`${overdueTasksCount} task overdue`);
    } else if (overdueTasksCount > 0) {
      rawScore += 15;
      reasons.push(`${overdueTasksCount} task overdue`);
    }
  }

  // --------------------------------------------------------------------------
  // Factor 2: Open Inspections (Punchlist) & Problem Reports (~20-25 pts)
  // --------------------------------------------------------------------------
  const pName = (project.name || '').trim().toLowerCase();
  const pClient = (project.client || '').trim().toLowerCase();

  // Problem reports linked to this project
  const linkedProblems = (ctx.problemReports || []).filter(pr => {
    if (pr.status !== 'Open') return false;
    if (pr.projectId && pr.projectId === project.id) return true;
    if (pr.projectName) {
      const prName = pr.projectName.trim().toLowerCase();
      return prName === pName || (pClient && prName === pClient);
    }
    return false;
  });

  // Inspections linked to this project
  const linkedInspections = (ctx.inspections || []).filter(ins => {
    if (ins.projectId && ins.projectId === project.id) return true;
    if (ins.projectName) {
      const insName = ins.projectName.trim().toLowerCase();
      return insName === pName || (pClient && insName === pClient);
    }
    return false;
  });

  const openPunchlists = linkedInspections.filter(ins => ins.status === 'Rejected / Punchlist');
  const pendingOverdueInspections = linkedInspections.filter(ins => 
    ['Draft', 'Requested'].includes(ins.status) && ins.targetDate && ins.targetDate < todayStr
  );

  let issuePoints = 0;
  if (openPunchlists.length > 0) {
    issuePoints += Math.min(20, openPunchlists.length * 15);
    reasons.push(`${openPunchlists.length} inspection punchlist open`);
  }
  if (linkedProblems.length > 0) {
    issuePoints += Math.min(15, linkedProblems.length * 10);
    reasons.push(`${linkedProblems.length} problem report open`);
  } else if (pendingOverdueInspections.length > 0) {
    issuePoints += 10;
    reasons.push(`${pendingOverdueInspections.length} inspection overdue`);
  }
  rawScore += Math.min(25, issuePoints);

  // --------------------------------------------------------------------------
  // Factor 3: Progress Rendah + Due Dekat (< 14 hari) (~15-25 pts)
  // --------------------------------------------------------------------------
  if (!isOverdue && project.due && project.due >= todayStr) {
    const diffMs = new Date(project.due + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime();
    const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const currentPct = calcPct(project);

    if (daysLeft <= 7 && currentPct < 50) {
      rawScore += 25;
      reasons.push(`Due ${daysLeft} hari lagi, progres ${currentPct}%`);
    } else if (daysLeft <= 14 && currentPct < 60) {
      rawScore += 18;
      reasons.push(`Due ${daysLeft} hari lagi, progres ${currentPct}%`);
    } else if (daysLeft <= 7 && currentPct < 80) {
      rawScore += 12;
      reasons.push(`Due ${daysLeft} hari lagi (progres ${currentPct}%)`);
    }
  }

  // --------------------------------------------------------------------------
  // Factor 4: Hours Burn > Budget * 1.1 (~15-20 pts)
  // --------------------------------------------------------------------------
  if (project.budgetHours && project.budgetHours > 0 && ctx.timesheets && ctx.timesheets.length > 0) {
    const usedHours = getManHoursForWorkOrder(project.client, ctx.timesheets);
    if (usedHours > project.budgetHours * 1.3) {
      rawScore += 20;
      reasons.push(`Hours overbudget (${fmtHrs(usedHours)}h / ${project.budgetHours}h)`);
    } else if (usedHours > project.budgetHours * 1.1) {
      rawScore += 15;
      reasons.push(`Hours mendekati/lewat budget (${fmtHrs(usedHours)}h / ${project.budgetHours}h)`);
    }
  }

  // --------------------------------------------------------------------------
  // Factor 5: Material Processing Lag (~10 pts)
  // --------------------------------------------------------------------------
  const processings = project.materialProcessing && project.materialProcessing.length > 0
    ? project.materialProcessing
    : (ctx.materialProcessing || []).filter(mp => mp.projectId === project.id);

  if (processings.length > 0) {
    const incompleted = processings.filter(mp => !mp.isCompleted);
    if (incompleted.length > 0) {
      const avgProcPct = incompleted.reduce((acc, mp) => acc + (mp.overallPct || 0), 0) / incompleted.length;
      if (avgProcPct < 50) {
        rawScore += 10;
        reasons.push(`Material processing lambat (${Math.round(avgProcPct)}%)`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Clamp & Finalize
  // --------------------------------------------------------------------------
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));
  const level: 'low' | 'medium' | 'high' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    score,
    reasons: reasons.slice(0, 3),
    level
  };
}

/**
 * Returns Tailwind CSS styling classes for the risk score badge.
 */
export function getRiskBadgeClasses(score: number): string {
  if (score >= 70) {
    return 'bg-red-500/10 text-red-500 border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40';
  }
  if (score >= 40) {
    return 'bg-amber-500/10 text-amber-500 border-amber-500/25 hover:bg-amber-500/20 hover:border-amber-500/40';
  }
  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40';
}
