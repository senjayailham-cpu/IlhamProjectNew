import { jsPDF } from 'jspdf';
import { Project, ActivityLog, InspectionRequest, TimesheetEntry, ProblemReport, OrgSettings } from '../types';
import { calcPct } from './projectUtils';

export interface DailyReportPdfOptions {
  reportDate: string; // ISO "YYYY-MM-DD"
  activityLogs: ActivityLog[];
  inspections: InspectionRequest[];
  projects: Project[];
  timesheets?: TimesheetEntry[];
  problemReports?: ProblemReport[];
  orgSettings?: OrgSettings;
  generatedBy?: string;
}

export function downloadDailyReportPDF({
  reportDate,
  activityLogs,
  inspections,
  projects,
  timesheets = [],
  problemReports = [],
  orgSettings,
  generatedBy = 'Site Coordinator'
}: DailyReportPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const printableWidth = pageWidth - (margin * 2); // 182mm
  let currentY = 16;

  // Filter logs for this specific report date
  const dayLogs = activityLogs
    .filter(log => log.date === reportDate)
    .sort((a, b) => (a.time || a.ts || '').localeCompare(b.time || b.ts || ''));

  // Format date nicely: e.g. "Monday, 05 October 2026"
  const dateObj = new Date(reportDate + 'T00:00:00');
  const formattedDateStr = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : reportDate;

  // Calculate day's stats
  const todayTimesheets = timesheets.filter(t => t.date === reportDate);
  const totalManHoursToday = todayTimesheets.reduce((acc, t) => acc + (t.totalHours || t.regularHours || 0), 0);
  const uniqueWorkersToday = new Set(todayTimesheets.map(t => t.empName || t.empId)).size;

  // Inspection stats
  // Include inspections requested/targeted for today, inspected today, or active
  const relevantInspections = inspections.filter(ins => {
    return (
      ins.requestedDate === reportDate ||
      ins.targetDate === reportDate ||
      ins.inspectedDate === reportDate ||
      (ins.status === 'Requested' || ins.status === 'Rejected / Punchlist')
    );
  });

  const approvedCount = relevantInspections.filter(i => i.status === 'Approved').length;
  const requestedCount = relevantInspections.filter(i => i.status === 'Requested').length;
  const punchlistCount = relevantInspections.filter(i => i.status === 'Rejected / Punchlist').length;

  // Open problem reports
  const openProblems = problemReports.filter(p => p.status === 'Open');

  // Page break checker helper
  function checkPageBreak(neededHeight: number): void {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 18;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. TOP CORPORATE HEADER / MASTHEAD
  // ─────────────────────────────────────────────────────────────
  doc.saveGraphicsState();
  // Deep Navy background banner
  doc.setFillColor(24, 38, 64);
  doc.rect(margin, currentY, printableWidth, 14, 'F');

  // Accent bar on left edge
  doc.setFillColor(240, 168, 50); // Gold/amber accent
  doc.rect(margin, currentY, 3, 14, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const orgName = 'AUSTIN BATAM FABRICATION';
  doc.text(orgName, margin + 6, currentY + 6);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 215, 235);
  doc.text("OFFICIAL DAILY SITE & QUALITY INSPECTION REPORT — OFF-SITE STAKEHOLDER BULLETIN", margin + 6, currentY + 10.5);

  // Document Badge on right
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(240, 168, 50);
  doc.text("FORM: DSR-QC-01", printableWidth + margin - 26, currentY + 6);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(180, 195, 215);
  doc.text("CONFIDENTIAL", printableWidth + margin - 24, currentY + 10.5);

  doc.restoreGraphicsState();
  currentY += 17;

  // ─────────────────────────────────────────────────────────────
  // 2. METADATA SUMMARY CARD
  // ─────────────────────────────────────────────────────────────
  checkPageBreak(28);
  doc.saveGraphicsState();
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, currentY, printableWidth, 24, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  // Column 1
  doc.text("REPORT DATE:", margin + 4, currentY + 6);
  doc.text("LOCATION:", margin + 4, currentY + 12);
  doc.text("DISTRIBUTION:", margin + 4, currentY + 18);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedDateStr, margin + 28, currentY + 6);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(orgSettings?.projectLocations?.[0] || "Batam Workshop 1 & 2 / Heavy Fabrication Yard", margin + 28, currentY + 12);
  doc.text("Off-Site Stakeholders, Project Directors, QA/QC Lead", margin + 28, currentY + 18);

  // Column 2
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("GENERATED BY:", margin + 105, currentY + 6);
  doc.text("PRINTED TIME:", margin + 105, currentY + 12);
  doc.text("SYSTEM REF:", margin + 105, currentY + 18);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(generatedBy, margin + 132, currentY + 6);
  doc.text(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), margin + 132, currentY + 12);
  doc.text("AI STUDIO FABRICATION v2.4", margin + 132, currentY + 18);

  doc.restoreGraphicsState();
  currentY += 28;

  // ─────────────────────────────────────────────────────────────
  // 3. EXECUTIVE KPI METRICS (4 BOXES)
  // ─────────────────────────────────────────────────────────────
  checkPageBreak(18);
  const cardW = (printableWidth - 9) / 4; // 4 cards with 3mm gaps
  const kpis = [
    { label: "SITE ACTIVITIES", val: `${dayLogs.length} Logged`, sub: "Shop floor updates", color: [30, 58, 138] },
    { label: "QC INSPECTIONS", val: `${relevantInspections.length} Total`, sub: `${approvedCount} Appr | ${requestedCount} Req | ${punchlistCount} Punch`, color: [13, 148, 136] },
    { label: "MANPOWER RECORD", val: `${uniqueWorkersToday} Men`, sub: `${totalManHoursToday.toFixed(1)} Man-Hours logged`, color: [99, 102, 241] },
    { label: "OPEN BLOCKERS / NCR", val: `${openProblems.length}`, sub: openProblems.length === 0 ? "Zero Active Blockers" : "Requires attention", color: openProblems.length > 0 ? [225, 29, 72] : [16, 185, 129] }
  ];

  doc.saveGraphicsState();
  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (cardW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(kpiX, currentY, cardW, 16, 'FD');

    // Colored top border line
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(kpiX, currentY, cardW, 1.2, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, kpiX + 3, currentY + 5.5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, kpiX + 3, currentY + 10.5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, kpiX + 3, currentY + 14);
  });
  doc.restoreGraphicsState();
  currentY += 21;

  // ─────────────────────────────────────────────────────────────
  // 4. SECTION: ACTIVE PROJECTS & SCHEDULE PROGRESS STATUS
  // ─────────────────────────────────────────────────────────────
  checkPageBreak(25);
  doc.saveGraphicsState();
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, printableWidth, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("1. WORK ORDER & FABRICATION SCHEDULE PROGRESS SNAPSHOT", margin + 3, currentY + 4.2);
  doc.restoreGraphicsState();
  currentY += 8;

  // Projects Table Header
  doc.saveGraphicsState();
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, currentY, printableWidth, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("NO", margin + 2, currentY + 4);
  doc.text("PROJECT NAME & DESCRIPTION", margin + 12, currentY + 4);
  doc.text("CLIENT / WO", margin + 85, currentY + 4);
  doc.text("LOCATION", margin + 115, currentY + 4);
  doc.text("PROGRESS", margin + 145, currentY + 4);
  doc.text("STATUS", margin + 165, currentY + 4);
  doc.restoreGraphicsState();
  currentY += 6;

  const activeProjects = projects.filter(p => !p.isArchived && p.status !== 'completed').slice(0, 10);
  if (activeProjects.length === 0) {
    checkPageBreak(8);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 140);
    doc.text("No active fabrication projects in workshop at this time.", margin + 4, currentY + 4.5);
    currentY += 7;
  } else {
    activeProjects.forEach((p, idx) => {
      checkPageBreak(6.5);
      const isEven = idx % 2 === 0;
      doc.saveGraphicsState();
      if (!isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, 6.5, 'F');
      }
      doc.setDrawColor(235, 240, 245);
      doc.line(margin, currentY + 6.5, margin + printableWidth, currentY + 6.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(String(idx + 1), margin + 2, currentY + 4.5);

      doc.setFont('Helvetica', 'bold');
      const projName = p.name.length > 36 ? p.name.slice(0, 34) + '..' : p.name;
      doc.text(projName, margin + 12, currentY + 4.5);

      doc.setFont('Helvetica', 'normal');
      doc.text(p.client || '—', margin + 85, currentY + 4.5);
      doc.text(p.location === 'workshop1' ? 'Workshop 1' : p.location === 'workshop2' ? 'Workshop 2' : (p.location || 'Yard'), margin + 115, currentY + 4.5);

      // Progress bar percentage
      const pct = calcPct(p);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${pct}%`, margin + 145, currentY + 4.5);

      // Status pill text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      if (p.status === 'completed') {
        doc.setTextColor(16, 185, 129);
        doc.text("COMPLETED", margin + 165, currentY + 4.5);
      } else if (p.status === 'on-hold') {
        doc.setTextColor(245, 158, 11);
        doc.text("ON HOLD", margin + 165, currentY + 4.5);
      } else {
        doc.setTextColor(59, 130, 246);
        doc.text("IN PROGRESS", margin + 165, currentY + 4.5);
      }

      doc.restoreGraphicsState();
      currentY += 6.5;
    });
  }
  currentY += 5;

  // ─────────────────────────────────────────────────────────────
  // 5. SECTION: QUALITY CONTROL (QC) INSPECTION STATUS
  // ─────────────────────────────────────────────────────────────
  checkPageBreak(25);
  doc.saveGraphicsState();
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, printableWidth, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("2. QUALITY CONTROL (QC) & RFI INSPECTION STATUS", margin + 3, currentY + 4.2);
  doc.restoreGraphicsState();
  currentY += 8;

  // Inspection Table Header
  doc.saveGraphicsState();
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, currentY, printableWidth, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("RFI NO", margin + 2, currentY + 4);
  doc.text("PROJECT / COMPONENT", margin + 28, currentY + 4);
  doc.text("INSPECTION TYPE", margin + 85, currentY + 4);
  doc.text("QC STATUS", margin + 128, currentY + 4);
  doc.text("INSPECTOR / DATE", margin + 155, currentY + 4);
  doc.restoreGraphicsState();
  currentY += 6;

  if (relevantInspections.length === 0) {
    checkPageBreak(8);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 140);
    doc.text("No active QC inspections recorded for this report date.", margin + 4, currentY + 4.5);
    currentY += 7;
  } else {
    relevantInspections.forEach((ins, idx) => {
      checkPageBreak(7);
      const isEven = idx % 2 === 0;
      doc.saveGraphicsState();
      if (!isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, 7, 'F');
      }
      doc.setDrawColor(235, 240, 245);
      doc.line(margin, currentY + 7, margin + printableWidth, currentY + 7);

      // RFI No
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(ins.rfiNo || `RFI-${idx + 1}`, margin + 2, currentY + 4.8);

      // Project & Assembly
      doc.setFont('Helvetica', 'bold');
      const pName = ins.projectName ? (ins.projectName.length > 24 ? ins.projectName.slice(0, 22) + '..' : ins.projectName) : 'Project';
      const aName = ins.assemblyName ? ` • ${ins.assemblyName.length > 15 ? ins.assemblyName.slice(0, 13) + '..' : ins.assemblyName}` : '';
      doc.text(pName + aName, margin + 28, currentY + 4.8);

      // Inspection Type
      doc.setFont('Helvetica', 'normal');
      doc.text(ins.inspectionType || 'Visual / Fit-up', margin + 85, currentY + 4.8);

      // QC Status with color
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      if (ins.status === 'Approved') {
        doc.setTextColor(16, 185, 129); // Emerald
        doc.text("PASSED / APPROVED", margin + 128, currentY + 4.8);
      } else if (ins.status === 'Rejected / Punchlist') {
        doc.setTextColor(225, 29, 72); // Rose
        doc.text("REJECTED / PUNCHLIST", margin + 128, currentY + 4.8);
      } else if (ins.status === 'Requested') {
        doc.setTextColor(217, 119, 6); // Amber
        doc.text("REQUESTED (PENDING)", margin + 128, currentY + 4.8);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(ins.status || 'Draft', margin + 128, currentY + 4.8);
      }

      // Inspector / Target Date
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const inspectorText = ins.assignedInspector || ins.inspectedBy || ins.requestedBy || 'QC Team';
      const dateText = ins.inspectedDate || ins.targetDate || ins.requestedDate || '';
      doc.text(`${inspectorText} (${dateText})`, margin + 155, currentY + 4.8);

      doc.restoreGraphicsState();
      currentY += 7;
    });
  }
  currentY += 5;

  // ─────────────────────────────────────────────────────────────
  // 6. SECTION: DETAILED SITE ACTIVITY & PROGRESS LOG
  // ─────────────────────────────────────────────────────────────
  checkPageBreak(25);
  doc.saveGraphicsState();
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, printableWidth, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("3. SHOP FLOOR DAILY ACTIVITY LOG (RECORDED CHRONOLOGICAL ACTIONS)", margin + 3, currentY + 4.2);
  doc.restoreGraphicsState();
  currentY += 8;

  // Activity Log Table Header
  doc.saveGraphicsState();
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, currentY, printableWidth, 6, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("TIME", margin + 2, currentY + 4);
  doc.text("PROJECT & SUB-ASSEMBLY", margin + 16, currentY + 4);
  doc.text("ACTIVITY DESCRIPTION", margin + 65, currentY + 4);
  doc.text("PROGRESS CHANGE", margin + 138, currentY + 4);
  doc.text("LOGGED BY", margin + 165, currentY + 4);
  doc.restoreGraphicsState();
  currentY += 6;

  if (dayLogs.length === 0) {
    checkPageBreak(8);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 140);
    doc.text("No specific shop floor changes or milestone toggles recorded on this date.", margin + 4, currentY + 4.5);
    currentY += 7;
  } else {
    dayLogs.forEach((log, idx) => {
      // Calculate needed height for description using splitTextToSize
      const descText = log.detail || log.action || log.taskName || 'Progress updated';
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      const descLines = doc.splitTextToSize(descText, 70);
      const rowHeight = Math.max(6.5, descLines.length * 3.5 + 2);

      checkPageBreak(rowHeight);
      const isEven = idx % 2 === 0;

      doc.saveGraphicsState();
      if (!isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, rowHeight, 'F');
      }
      doc.setDrawColor(235, 240, 245);
      doc.line(margin, currentY + rowHeight, margin + printableWidth, currentY + rowHeight);

      // Time
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(log.time || log.ts?.slice(11, 16) || '—', margin + 2, currentY + 4.2);

      // Project & Assembly
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const pHeader = log.projectName ? (log.projectName.length > 20 ? log.projectName.slice(0, 18) + '..' : log.projectName) : 'Project';
      const aHeader = log.assemblyName ? `\n${log.assemblyName.length > 22 ? log.assemblyName.slice(0, 20) + '..' : log.assemblyName}` : '';
      doc.text(pHeader + (aHeader ? aHeader : ''), margin + 16, currentY + 4);

      // Description (wrapped)
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(descLines, margin + 65, currentY + 4);

      // Progress Change
      doc.setFont('Helvetica', 'bold');
      if (log.oldPct !== undefined && log.newPct !== undefined) {
        const delta = log.newPct - log.oldPct;
        doc.setTextColor(delta >= 0 ? 16 : 225, delta >= 0 ? 185 : 29, delta >= 0 ? 129 : 72);
        doc.text(`${log.oldPct}% -> ${log.newPct}% (${delta >= 0 ? '+' : ''}${delta}%)`, margin + 138, currentY + 4.2);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text("Task Updated", margin + 138, currentY + 4.2);
      }

      // Logged By
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const userText = log.userName ? (log.userName.length > 14 ? log.userName.slice(0, 12) + '..' : log.userName) : 'Admin';
      doc.text(userText, margin + 165, currentY + 4.2);

      doc.restoreGraphicsState();
      currentY += rowHeight;
    });
  }
  currentY += 6;

  // ─────────────────────────────────────────────────────────────
  // 7. SECTION: OFF-SITE STAKEHOLDER VERIFICATION & ENDORSEMENT
  // ─────────────────────────────────────────────────────────────
  checkPageBreak(35);
  doc.saveGraphicsState();
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, printableWidth, 30, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("OFF-SITE STAKEHOLDER VERIFICATION & SITE ENDORSEMENT", margin + 4, currentY + 5);

  const colWidth = (printableWidth - 12) / 3;

  // Sign Column 1: Site Supervisor
  const col1X = margin + 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("PREPARED BY (SITE SUPERVISOR):", col1X, currentY + 11);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(generatedBy, col1X, currentY + 16);
  doc.setDrawColor(148, 163, 184);
  doc.line(col1X, currentY + 24, col1X + colWidth - 6, currentY + 24);
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text("Signature & Date", col1X, currentY + 27.5);

  // Sign Column 2: QC / Inspection Lead
  const col2X = margin + 4 + colWidth + 2;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("VERIFIED BY (QA/QC INSPECTOR):", col2X, currentY + 11);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("Lead QC Inspector", col2X, currentY + 16);
  doc.line(col2X, currentY + 24, col2X + colWidth - 6, currentY + 24);
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text("Signature & Date", col2X, currentY + 27.5);

  // Sign Column 3: Stakeholder / Client Rep
  const col3X = margin + 4 + (colWidth * 2) + 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("ACKNOWLEDGED BY (STAKEHOLDER / REP):", col3X, currentY + 11);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text("Client Representative / PM", col3X, currentY + 16);
  doc.line(col3X, currentY + 24, col3X + colWidth - 6, currentY + 24);
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text("Signature & Date", col3X, currentY + 27.5);

  doc.restoreGraphicsState();
  currentY += 34;

  // ─────────────────────────────────────────────────────────────
  // 8. FINAL PASS: DRAW FOOTERS ON EVERY PAGE
  // ─────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    // Bottom border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 11, margin + printableWidth, pageHeight - 11);

    // Left footer text
    doc.text(
      `${orgName.toUpperCase()} • Daily Progress & QC Inspection Report • ${reportDate}`,
      margin,
      pageHeight - 7
    );

    // Right footer pagination
    doc.setFont('Helvetica', 'bold');
    doc.text(`Page ${i} of ${totalPages}`, margin + printableWidth - 18, pageHeight - 7);
    doc.restoreGraphicsState();
  }

  // ─────────────────────────────────────────────────────────────
  // 9. TRIGGER DOWNLOAD
  // ─────────────────────────────────────────────────────────────
  const safeDate = reportDate.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `DAILY_REPORT_${safeDate}_QC_PROGRESS.pdf`;
  doc.save(filename);
}
export default downloadDailyReportPDF;
