import { Project, TimesheetEntry, ProblemReport, InspectionRequest } from '../types';
import { calcPct, getManHoursForWorkOrder, fmtHrs } from './projectUtils';

export interface DelayDriver {
  type: 'timesheet_burn' | 'problem_blocker' | 'velocity_deficit' | 'overdue_tasks' | 'deadline_proximity';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  impactDays: number;
}

export interface PredictiveDelayResult {
  projectId: string;
  projectName: string;
  client: string;
  status: string;
  dueDate?: string;
  currentProgress: number; // 0-100%
  daysRemaining: number;
  isOverdue: boolean;
  overdueDays: number;

  // Predictive scores
  riskScore: number; // 0-100
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  isFlagged: boolean; // true if critical or high
  confidence: 'High' | 'Medium' | 'Moderate';
  predictedDelayDays: number; // estimated days of delay beyond due date

  // Historical Timesheet metrics
  loggedHours: number;
  budgetHours: number;
  burnPct: number; // % of budget consumed
  hoursOverrun: number;
  burnEfficiencyRatio: number; // progress % / burn % (ideal >= 1.0)
  recentActivePersonnel: number;

  // Historical Problem Reports metrics
  openProblemCount: number;
  resolvedProblemCount: number;
  problemCategories: Record<string, number>;
  criticalBlockerCount: number;

  // Task analysis
  overdueTasksCount: number;
  totalTasksCount: number;
  completedTasksCount: number;

  // Drivers & Recommendations
  drivers: DelayDriver[];
  recommendedMitigations: string[];
}

export interface PredictiveDelaySummary {
  totalAnalyzed: number;
  flaggedCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  maxDelayDays: number;
  averageDelayDays: number;
  flaggedProjects: PredictiveDelayResult[];
  allProjects: PredictiveDelayResult[];
}

/**
 * Calculates predictive delay risks for a single project using historical
 * timesheets and problem reports alongside task milestones and due dates.
 */
export function analyzeProjectScheduleDelay(
  project: Project,
  timesheets: TimesheetEntry[] = [],
  problemReports: ProblemReport[] = [],
  inspections: InspectionRequest[] = [],
  todayStr?: string
): PredictiveDelayResult {
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const currentProgress = calcPct(project);
  const pName = (project.name || '').trim().toLowerCase();
  const pClient = (project.client || '').trim().toLowerCase();

  // 1. Task counts & overdue tasks
  let totalTasksCount = 0;
  let completedTasksCount = 0;
  let overdueTasksCount = 0;
  let maxTaskOverdueDays = 0;

  (project.assemblies || []).forEach(asm => {
    (asm.tasks || []).forEach(t => {
      totalTasksCount++;
      if (t.done || (t.pct || 0) >= 100) {
        completedTasksCount++;
      } else if (t.finishDate && t.finishDate < today) {
        overdueTasksCount++;
        const diffMs = new Date(today + 'T00:00:00').getTime() - new Date(t.finishDate + 'T00:00:00').getTime();
        const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        if (days > maxTaskOverdueDays) {
          maxTaskOverdueDays = days;
        }
      }
    });
  });

  // 2. Schedule Due Date calculations
  let isOverdue = false;
  let overdueDays = 0;
  let daysRemaining = 999;

  if (project.due) {
    const diffMs = new Date(project.due + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
    daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) {
      isOverdue = true;
      overdueDays = Math.abs(daysRemaining);
    }
  }

  // 3. Historical Timesheet Analysis
  const loggedHours = getManHoursForWorkOrder(project.client, timesheets);
  const budgetHours = project.budgetHours || 0;
  const burnPct = budgetHours > 0 ? Math.round((loggedHours / budgetHours) * 100) : 0;

  // Unique personnel who worked on this work order
  const personnelSet = new Set<string>();
  timesheets.forEach(ts => {
    if ((ts.workOrder || '').trim().toLowerCase() === pClient && ts.empName) {
      personnelSet.add(ts.empName);
    }
  });
  const recentActivePersonnel = personnelSet.size;

  // Burn vs Progress efficiency (e.g. if 90% budget burned but only 30% progress, ratio is ~0.33)
  const burnEfficiencyRatio = burnPct > 0 
    ? Math.round((currentProgress / burnPct) * 100) / 100
    : 1;

  // Projected hours overrun
  const projectedHoursNeeded = currentProgress > 5
    ? (loggedHours / (currentProgress / 100))
    : budgetHours > 0 ? budgetHours : loggedHours;
  const hoursOverrun = budgetHours > 0 ? Math.max(0, Math.round(projectedHoursNeeded - budgetHours)) : 0;

  // 4. Historical Problem Reports Analysis
  const linkedProblems = problemReports.filter(pr => {
    if (pr.projectId && pr.projectId === project.id) return true;
    if (pr.projectName) {
      const prName = pr.projectName.trim().toLowerCase();
      return prName === pName || (pClient && prName === pClient);
    }
    return false;
  });

  const openProblems = linkedProblems.filter(pr => pr.status === 'Open');
  const resolvedProblems = linkedProblems.filter(pr => pr.status === 'Resolved');

  const problemCategories: Record<string, number> = {};
  let criticalBlockerCount = 0;
  let estimatedProblemDelayDays = 0;

  openProblems.forEach(pr => {
    const cat = pr.category || 'Other';
    problemCategories[cat] = (problemCategories[cat] || 0) + 1;

    // Estimate delay impact based on issue severity
    if (cat === 'Drawing Issue') {
      estimatedProblemDelayDays += 3.5;
      criticalBlockerCount++;
    } else if (cat === 'Material Issue') {
      estimatedProblemDelayDays += 4.0;
      criticalBlockerCount++;
    } else if (cat === 'Equipment Issue') {
      estimatedProblemDelayDays += 2.5;
      criticalBlockerCount++;
    } else if (cat === 'Safety Issue') {
      estimatedProblemDelayDays += 2.5;
      criticalBlockerCount++;
    } else {
      estimatedProblemDelayDays += 1.5;
    }

    // Age penalty: if problem was reported > 4 days ago and is still open
    if (pr.date) {
      const pDiffMs = new Date(today + 'T00:00:00').getTime() - new Date(pr.date + 'T00:00:00').getTime();
      const openAgeDays = Math.floor(pDiffMs / (1000 * 60 * 60 * 24));
      if (openAgeDays > 4) {
        estimatedProblemDelayDays += Math.min(4, Math.floor(openAgeDays / 3));
      }
    }
  });

  // Inspections impact (punchlists)
  const linkedInspections = inspections.filter(ins => {
    if (ins.projectId && ins.projectId === project.id) return true;
    if (ins.projectName) {
      const insName = ins.projectName.trim().toLowerCase();
      return insName === pName || (pClient && insName === pClient);
    }
    return false;
  });
  const openPunchlists = linkedInspections.filter(ins => ins.status === 'Rejected / Punchlist');
  if (openPunchlists.length > 0) {
    estimatedProblemDelayDays += openPunchlists.length * 2.0;
  }

  // 5. Predictive Delay Estimation & Drivers Compilation
  const drivers: DelayDriver[] = [];
  const recommendedMitigations: string[] = [];
  let rawRiskScore = 0;
  let predictedDelayDays = 0;

  // Factor A: Already Overdue or Overdue Tasks
  if (isOverdue) {
    rawRiskScore += Math.min(45, 30 + overdueDays * 2);
    predictedDelayDays += overdueDays;
    drivers.push({
      type: 'overdue_tasks',
      title: `Project Overdue ${overdueDays} Hari`,
      description: `Target finish date (${project.due}) telah terlampaui dengan sisa progres ${100 - currentProgress}%.`,
      severity: 'critical',
      impactDays: overdueDays
    });
    recommendedMitigations.push(`Prioritaskan penyelesaian task kritis dan lakukan penjadwalan ulang (reschedule) target serah terima.`);
  } else if (overdueTasksCount > 0) {
    const taskScore = Math.min(25, overdueTasksCount * 8);
    rawRiskScore += taskScore;
    const taskDelayEst = Math.min(14, Math.max(2, Math.round(overdueTasksCount * 1.5)));
    predictedDelayDays += taskDelayEst;
    drivers.push({
      type: 'overdue_tasks',
      title: `${overdueTasksCount} Sub-Task Melewati Target Tanggal`,
      description: `${overdueTasksCount} aktivitas fabrikasi/assembly tertunda dari jadwal aslinya.`,
      severity: overdueTasksCount >= 3 ? 'critical' : 'high',
      impactDays: taskDelayEst
    });
    recommendedMitigations.push(`Fokuskan tenaga kerja pada ${overdueTasksCount} task tertunda sebelum memulai sub-assembly hilir.`);
  }

  // Factor B: Historical Timesheet Burn vs Progress Discrepancy
  if (budgetHours > 0) {
    if (burnPct >= 115) {
      const burnScore = Math.min(30, 18 + Math.round((burnPct - 100) / 3));
      rawRiskScore += burnScore;
      const burnDelay = Math.min(10, Math.max(2, Math.round((loggedHours - budgetHours) / 8)));
      predictedDelayDays += burnDelay;
      drivers.push({
        type: 'timesheet_burn',
        title: `Man-Hours Overbudget (${fmtHrs(loggedHours)}h / ${budgetHours}h — ${burnPct}%)`,
        description: `Jam kerja telah menyerap ${burnPct}% dari anggaran sementara progres baru mencapai ${currentProgress}%.`,
        severity: burnPct > 130 ? 'critical' : 'high',
        impactDays: burnDelay
      });
      recommendedMitigations.push(`Evaluasi rework atau inefisiensi jam kerja; sesuaikan shift atau tambah personel berpengalaman.`);
    } else if (burnPct >= 85 && currentProgress < 60) {
      rawRiskScore += 16;
      predictedDelayDays += 3;
      drivers.push({
        type: 'timesheet_burn',
        title: `Konsumsi Jam Kerja Tidak Seimbang (${burnPct}% vs ${currentProgress}%)`,
        description: `Penggunaan man-hours (${fmtHrs(loggedHours)}h) berjalan jauh lebih cepat dibanding pertumbuhan fisik progres.`,
        severity: 'high',
        impactDays: 3
      });
      recommendedMitigations.push(`Lakukan audit harian kesesuaian timesheet terhadap hasil fisik di workshop.`);
    }
  }

  // Factor C: Open Problem Reports & Quality Punchlists
  if (openProblems.length > 0 || openPunchlists.length > 0) {
    const probScore = Math.min(30, openProblems.length * 10 + openPunchlists.length * 8);
    rawRiskScore += probScore;
    const roundedProbDelay = Math.round(estimatedProblemDelayDays);
    predictedDelayDays += roundedProbDelay;

    const blockerNames = Object.entries(problemCategories)
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ');

    drivers.push({
      type: 'problem_blocker',
      title: `${openProblems.length} Problem Report Terbuka (${blockerNames})`,
      description: `Hambatan operasional yang belum terselesaikan memicu potensi bottle-neck dan stoppage lini perakitan.`,
      severity: criticalBlockerCount > 0 ? 'critical' : 'high',
      impactDays: roundedProbDelay
    });

    if (problemCategories['Drawing Issue']) {
      recommendedMitigations.push(`Segera koordinasikan revisi gambar / klarifikasi RFI dengan Engineering/Client.`);
    }
    if (problemCategories['Material Issue']) {
      recommendedMitigations.push(`Eskalasi pengadaan atau relokasi material antar-bay untuk mencegah idle time.`);
    }
    if (problemCategories['Equipment Issue']) {
      recommendedMitigations.push(`Panggil tim Maintenance untuk perbaikan alat mesin segera.`);
    }
  }

  // Factor D: Deadline Proximity vs Remaining Progress (Velocity Deficit)
  if (!isOverdue && project.due && daysRemaining >= 0 && daysRemaining <= 14) {
    const remainingPct = 100 - currentProgress;
    const requiredDailyRate = remainingPct / Math.max(1, daysRemaining);

    // If more than 35% progress remains in less than 7 days, or daily required pace is unrealistic (> 6%/day)
    if (daysRemaining <= 7 && remainingPct > 30) {
      rawRiskScore += 25;
      const velocityDelay = Math.max(3, Math.round(remainingPct / 8));
      predictedDelayDays += velocityDelay;
      drivers.push({
        type: 'velocity_deficit',
        title: `Batas Waktu Sangat Dekat (${daysRemaining} Hari Lagi, Sisa ${remainingPct}%)`,
        description: `Dibutuhkan kecepatan progres ${requiredDailyRate.toFixed(1)}%/hari untuk mencapai deadline, jauh melebihi rata-rata historis.`,
        severity: 'critical',
        impactDays: velocityDelay
      });
      recommendedMitigations.push(`Terapkan lembur terkontrol (overtime shift) dan relokasi helper tambahan.`);
    } else if (daysRemaining <= 14 && remainingPct > 50) {
      rawRiskScore += 16;
      const velocityDelay = Math.max(2, Math.round(remainingPct / 12));
      predictedDelayDays += velocityDelay;
      drivers.push({
        type: 'deadline_proximity',
        title: `Progres Terlalu Rendah Menjelang Deadline (${daysRemaining} Hari Lagi)`,
        description: `Progres proyek baru ${currentProgress}% dengan waktu sisa ${daysRemaining} hari kalender.`,
        severity: 'high',
        impactDays: velocityDelay
      });
      recommendedMitigations.push(`Pecah pekerjaan menjadi paralel batch di Workshop 1 dan Workshop 2.`);
    }
  }

  // Final score clamping & level
  const riskScore = Math.min(100, Math.max(0, Math.round(rawRiskScore)));
  const finalDelayDays = Math.max(0, Math.round(predictedDelayDays));

  let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
  if (riskScore >= 65 || finalDelayDays >= 6 || isOverdue) {
    riskLevel = 'critical';
  } else if (riskScore >= 40 || finalDelayDays >= 3) {
    riskLevel = 'high';
  } else if (riskScore >= 20 || finalDelayDays >= 1) {
    riskLevel = 'medium';
  }

  const isFlagged = riskLevel === 'critical' || riskLevel === 'high';

  // Confidence assessment based on data completeness
  const dataPointsCount = timesheets.length + linkedProblems.length + (project.assemblies || []).length;
  const confidence: 'High' | 'Medium' | 'Moderate' = dataPointsCount >= 10 ? 'High' : dataPointsCount >= 4 ? 'Medium' : 'Moderate';

  if (recommendedMitigations.length === 0) {
    recommendedMitigations.push(`Pertahankan ritme harian dan pastikan absensi timesheet di-input secara rutin.`);
  }

  return {
    projectId: project.id,
    projectName: project.name,
    client: project.client || 'Internal',
    status: project.status,
    dueDate: project.due,
    currentProgress,
    daysRemaining,
    isOverdue,
    overdueDays,
    riskScore,
    riskLevel,
    isFlagged,
    confidence,
    predictedDelayDays: finalDelayDays,
    loggedHours,
    budgetHours,
    burnPct,
    hoursOverrun,
    burnEfficiencyRatio,
    recentActivePersonnel,
    openProblemCount: openProblems.length,
    resolvedProblemCount: resolvedProblems.length,
    problemCategories,
    criticalBlockerCount,
    overdueTasksCount,
    totalTasksCount,
    completedTasksCount,
    drivers,
    recommendedMitigations: Array.from(new Set(recommendedMitigations)).slice(0, 3)
  };
}

/**
 * Evaluates all active projects and returns overall predictive delay summary
 * sorted with highest risk projects first.
 */
export function getPredictiveScheduleDelaySummary(
  projects: Project[],
  timesheets: TimesheetEntry[] = [],
  problemReports: ProblemReport[] = [],
  inspections: InspectionRequest[] = [],
  todayStr?: string
): PredictiveDelaySummary {
  const activeProjects = projects.filter(p => !p.isArchived && p.status !== 'completed');

  const analyzed = activeProjects.map(p => 
    analyzeProjectScheduleDelay(p, timesheets, problemReports, inspections, todayStr)
  );

  // Sort descending by risk score, then predicted delay days
  analyzed.sort((a, b) => {
    if (b.riskScore !== a.riskScore) {
      return b.riskScore - a.riskScore;
    }
    return b.predictedDelayDays - a.predictedDelayDays;
  });

  const flaggedProjects = analyzed.filter(r => r.isFlagged);
  const criticalCount = analyzed.filter(r => r.riskLevel === 'critical').length;
  const highCount = analyzed.filter(r => r.riskLevel === 'high').length;
  const mediumCount = analyzed.filter(r => r.riskLevel === 'medium').length;
  const lowCount = analyzed.filter(r => r.riskLevel === 'low').length;

  const maxDelayDays = analyzed.length > 0 
    ? Math.max(0, ...analyzed.map(r => r.predictedDelayDays))
    : 0;

  const totalDelays = analyzed.reduce((acc, r) => acc + r.predictedDelayDays, 0);
  const averageDelayDays = analyzed.length > 0 
    ? Math.round((totalDelays / analyzed.length) * 10) / 10 
    : 0;

  return {
    totalAnalyzed: analyzed.length,
    flaggedCount: flaggedProjects.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    maxDelayDays,
    averageDelayDays,
    flaggedProjects,
    allProjects: analyzed
  };
}
