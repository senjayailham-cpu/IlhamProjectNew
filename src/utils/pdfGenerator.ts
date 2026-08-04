import { jsPDF } from 'jspdf';
import { Project, TimesheetEntry, WireLog, MaterialConsumptionLog } from '../types';
import { fmtHrs } from './projectUtils';

export function downloadProjectPDF(
  project: Project,
  timesheets: TimesheetEntry[],
  wireLogs: WireLog[],
  consumptionLogs?: MaterialConsumptionLog[]
) {
  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageHeight = 297;
  const margin = 15;
  const printableWidth = 180;
  let currentY = 18;

  // Header helper function (runs per page)
  function drawPageFooter() {
    doc.saveGraphicsState();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    // Bottom border line above footer
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, 210 - margin, pageHeight - 12);

    doc.text(
      `AUSTIN BATAM — Project Summary Report [WO: ${project.client}]`,
      margin,
      pageHeight - 8
    );
    const pageNum = doc.getNumberOfPages();
    doc.text(`Page ${pageNum}`, 210 - margin - 15, pageHeight - 8);
    doc.restoreGraphicsState();
  }

  function checkPageBreak(neededHeight: number) {
    if (currentY + neededHeight > pageHeight - 15) {
      doc.addPage();
      currentY = 18;
      // Drawing footer for previous page is done automatically by jsPDF on save or dynamic count,
      // but we will apply footing decoration manually per page at the end of generation.
    }
  }

  // --- Title & Decent Header ---
  doc.saveGraphicsState();
  // Primary visual accent band
  doc.setFillColor(34, 43, 69); // Dark blue header accent
  doc.rect(margin, currentY, printableWidth, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("PROJECT COMPLETION & PERFORMANCE REPORT", margin + 6, currentY + 7.5);
  doc.restoreGraphicsState();

  currentY += 18;

  // --- Project Metadata Grid ---
  checkPageBreak(55);
  
  // Grey background for metadata box (taller box: 45mm height to fit 5 rows)
  doc.saveGraphicsState();
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(218, 224, 233);
  doc.rect(margin, currentY, printableWidth, 45, 'FD');
  
  // Grid labels and values
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 90, 110);
  
  // Line 1: PROJECT NAME (occupies entire width, preventing any overlap)
  doc.text("PROJECT NAME:", margin + 5, currentY + 7);
  
  // Line 2: WORK ORDER (left) & PROJECT STATUS (right)
  doc.text("WORK ORDER:", margin + 5, currentY + 14);
  doc.text("PROJECT STATUS:", margin + 95, currentY + 14);
  
  // Line 3: START DATE (left) & COMPLETED DATE (right)
  doc.text("START DATE:", margin + 5, currentY + 21);
  doc.text("COMPLETED DATE:", margin + 95, currentY + 21);

  // Line 4: LOCATION (left) & CATEGORY (right)
  doc.text("LOCATION:", margin + 5, currentY + 28);
  doc.text("CATEGORY:", margin + 95, currentY + 28);

  // Line 5: BUDGET HOURS (left)
  doc.text("BUDGET HOURS:", margin + 5, currentY + 35);

  // Values
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(20, 25, 35);
  doc.setFontSize(9.5);
  
  // Line 1 Value: Project Name (with maximum printable width of 140 to prevent any border spillover)
  doc.text(project.name || 'N/A', margin + 35, currentY + 7, { maxWidth: 140 });
  
  // Line 2 Values: Work Order (bold) & Completed Status Badge (right)
  doc.setFont('Helvetica', 'bold');
  doc.text(project.client || 'N/A', margin + 35, currentY + 14);
  doc.setFont('Helvetica', 'normal');
  
  // Completed status badge
  doc.saveGraphicsState();
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(margin + 130, currentY + 10.5, 24, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text("COMPLETED", margin + 134, currentY + 14);
  doc.restoreGraphicsState();
  
  // Line 3 Values: Start Date & Completed Date
  doc.text(project.start || 'N/A', margin + 35, currentY + 21);
  doc.text(project.completedDate || 'N/A', margin + 130, currentY + 21);
  
  // Line 4 Values: Location & Category
  doc.text(String(project.location || 'N/A').toUpperCase(), margin + 35, currentY + 28);
  doc.text(String(project.category || 'N/A').toUpperCase(), margin + 130, currentY + 28);
  
  // Line 5 Value: Budget Hours
  doc.text(`${project.budgetHours || 'Not Assigned'} Hours`, margin + 35, currentY + 35);
  
  // Project description / notes
  if (project.notes) {
    const splitNotes = doc.splitTextToSize(`Notes: ${project.notes}`, printableWidth - 10);
    const notesHeight = splitNotes.length * 4.5 + 4;
    checkPageBreak(notesHeight + 10);
    
    doc.setFont('Helvetica', 'oblique');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 125);
    
    let tempY = currentY + 41;
    splitNotes.forEach((line: string) => {
      doc.text(line, margin + 5, tempY);
      tempY += 4;
    });
  }

  // Adjust Y offset dynamically based on notes presence to avoid overlapping with any notes
  let gridOffset = 52;
  if (project.notes) {
    const splitNotes = doc.splitTextToSize(`Notes: ${project.notes}`, printableWidth - 10);
    const notesHeight = splitNotes.length * 4;
    gridOffset = Math.max(52, 41 + notesHeight + 5);
  }
  currentY += gridOffset;

  // --- Aggregate totals & calculations ---
  const projectTimesheets = timesheets.filter(
    e => (e.workOrder || '').trim().toLowerCase() === (project.client || '').trim().toLowerCase()
  );
  const totalActualHours = projectTimesheets.reduce((sum, e) => sum + (e.totalHours || 0), 0);
  const budgetHours = project.budgetHours || 0;
  const hoursVariance = budgetHours > 0 ? budgetHours - totalActualHours : null;

  const projectWireLogs = wireLogs.filter(wl => wl.projectId === project.id);
  const totalWireKg = projectWireLogs.reduce((sum, wl) => sum + (wl.amountKg || 0), 0);

  // --- Overall Performance Summary Cards ---
  checkPageBreak(30);

  doc.saveGraphicsState();
  
  const projectConsumption = (consumptionLogs || []).filter(
    log => log.projectId === project.id
  );

  // Total Man-Hours Card
  doc.setFillColor(245, 248, 255);
  doc.setDrawColor(190, 210, 250);
  doc.rect(margin, currentY, 42, 20, 'FD');
  
  doc.setTextColor(70, 90, 120);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text("ACTUAL LABOR", margin + 3, currentY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(34, 43, 69);
  doc.text(`${fmtHrs(totalActualHours)} hrs`, margin + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(110, 120, 135);
  doc.text(budgetHours > 0 ? `Limit: ${budgetHours} hrs` : "No limit set", margin + 3, currentY + 17);

  // Variance Card
  const varColor = (hoursVariance !== null && hoursVariance < 0) ? [185, 28, 28] : [5, 150, 105];
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 225, 230);
  doc.rect(margin + 46, currentY, 42, 20, 'FD');
  
  doc.setTextColor(70, 90, 120);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text("BUDGET VARIANCE", margin + 46 + 3, currentY + 5);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(varColor[0], varColor[1], varColor[2]);
  if (hoursVariance === null) {
    doc.text("N/A", margin + 46 + 3, currentY + 12);
  } else {
    doc.text(`${hoursVariance >= 0 ? '+' : ''}${fmtHrs(hoursVariance)} hrs`, margin + 46 + 3, currentY + 12);
  }
  doc.setFontSize(6.5);
  doc.setTextColor(110, 120, 135);
  doc.text(
    hoursVariance === null 
      ? "Specify project budget" 
      : hoursVariance >= 0 
        ? "Under budget" 
        : "Over budget", 
    margin + 46 + 3, 
    currentY + 17
  );

  // Wire Consumables Card
  doc.setFillColor(254, 251, 237); // Light amber
  doc.setDrawColor(245, 220, 160);
  doc.rect(margin + 92, currentY, 42, 20, 'FD');
  
  doc.setTextColor(150, 100, 30);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text("WELDING WIRE", margin + 92 + 3, currentY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6);
  doc.text(`${totalWireKg.toFixed(1)} kg`, margin + 92 + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(150, 110, 50);
  doc.text("From welder logs", margin + 92 + 3, currentY + 17);

  // Other Materials Usage Card
  doc.setFillColor(243, 244, 246); // Light gray
  doc.setDrawColor(209, 213, 219);
  doc.rect(margin + 138, currentY, 42, 20, 'FD');
  
  doc.setTextColor(55, 65, 81);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text("OTHER MATERIALS", margin + 138 + 3, currentY + 5);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(`${projectConsumption.length} logs`, margin + 138 + 3, currentY + 12);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  const distinctTypes = new Set(projectConsumption.map(c => c.materialId)).size;
  doc.text(`${distinctTypes} distinct types`, margin + 138 + 3, currentY + 17);

  doc.restoreGraphicsState();
  currentY += 28;

  // --- Sub-Assemblies Performance Section ---
  checkPageBreak(35);

  doc.saveGraphicsState();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 43, 69);
  doc.text("SUB-ASSEMBLY ANALYSIS & PERFORMANCE BREAKDOWN", margin, currentY);
  
  // Underline
  doc.setDrawColor(34, 43, 69);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY + 2, 210 - margin, currentY + 2);
  doc.restoreGraphicsState();

  currentY += 7;

  // Sub-assemblies Table Headers
  checkPageBreak(12);
  doc.saveGraphicsState();
  doc.setFillColor(240, 243, 246);
  doc.rect(margin, currentY, printableWidth, 7, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 85);
  doc.text("SUB-ASSEMBLY NAME", margin + 3, currentY + 5);
  doc.text("TASKS STATUS", margin + 65, currentY + 5);
  doc.text("ACTUAL MAN-HOURS (HRS)", margin + 105, currentY + 5);
  doc.text("WIRE CONSUMPTION (KG)", margin + 150, currentY + 5);
  
  doc.restoreGraphicsState();
  currentY += 7.5;

  const assemblies = project.assemblies || [];
  if (assemblies.length === 0) {
    checkPageBreak(10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No sub-assemblies defined for this project.", margin + 3, currentY + 5);
    currentY += 10;
  } else {
    assemblies.forEach((asm, index) => {
      // Calculate assembly tasks accomplished
      const tasks = asm.tasks || [];
      const totalTasks = tasks.length;
      const doneTasks = tasks.filter(t => t.pct >= 100 || t.done).length;

      // Calculate localized actual hours and wire weight
      const asmHours = timesheets
        .filter(e => (e.workOrder || '').trim().toLowerCase() === (project.client || '').trim().toLowerCase() && e.assemblyId === asm.id)
        .reduce((sum, e) => sum + (e.totalHours || 0), 0);

      const asmWire = projectWireLogs
        .filter(wl => wl.assemblyId === asm.id)
        .reduce((sum, wl) => sum + (wl.amountKg || 0), 0);

      checkPageBreak(8);

      // Zebra striping for table rows
      doc.saveGraphicsState();
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 252);
        doc.rect(margin, currentY - 1, printableWidth, 8, 'F');
      }
      doc.setDrawColor(235, 238, 243);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + 7, 210 - margin, currentY + 7);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 45, 55);
      
      // Cut sub-assembly name if too long
      const textToDraw = asm.name.length > 25 ? asm.name.substring(0, 24) + '...' : asm.name;
      doc.text(textToDraw, margin + 3, currentY + 4.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${doneTasks} / ${totalTasks} Completed`, margin + 65, currentY + 4.5);
      doc.text(`${fmtHrs(asmHours)} hrs`, margin + 115, currentY + 4.5);
      doc.text(`${asmWire.toFixed(1)} kg`, margin + 155, currentY + 4.5);

      doc.restoreGraphicsState();
      currentY += 8;
    });
  }

  currentY += 5;

  // --- Welder Wire Consumption Logs Table ---
  checkPageBreak(35);
  doc.saveGraphicsState();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 43, 69);
  doc.text("WELDER WIRE CONSUMABLES AUDIT LOG", margin, currentY);
  
  doc.setDrawColor(34, 43, 69);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY + 2, 210 - margin, currentY + 2);
  doc.restoreGraphicsState();

  currentY += 7;

  // Headers
  checkPageBreak(12);
  doc.saveGraphicsState();
  doc.setFillColor(240, 243, 246);
  doc.rect(margin, currentY, printableWidth, 7, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 85);
  doc.text("DATE", margin + 3, currentY + 5);
  doc.text("WELDER NAME", margin + 25, currentY + 5);
  doc.text("SUB-ASSEMBLY WORKED", margin + 65, currentY + 5);
  doc.text("WIRE WEIGHT", margin + 115, currentY + 5);
  doc.text("WELDER NOTES / COMMENTS", margin + 138, currentY + 5);
  
  doc.restoreGraphicsState();
  currentY += 7.5;

  if (projectWireLogs.length === 0) {
    checkPageBreak(10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No wire consumable records logged for this project by welders.", margin + 3, currentY + 5);
    currentY += 10;
  } else {
    // Sort project wire logs by date descending
    const sortedWireLogs = [...projectWireLogs].sort((a, b) => b.date.localeCompare(a.date));
    sortedWireLogs.forEach((wl, index) => {
      checkPageBreak(8);

      doc.saveGraphicsState();
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 252);
        doc.rect(margin, currentY - 1, printableWidth, 8, 'F');
      }
      doc.setDrawColor(235, 238, 243);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + 7, 210 - margin, currentY + 7);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 45, 55);

      doc.text(wl.date || '', margin + 3, currentY + 4.5);
      
      const welderToDraw = wl.welderName.length > 18 ? wl.welderName.substring(0, 17) + '.' : wl.welderName;
      doc.text(welderToDraw, margin + 25, currentY + 4.5);

      const subAsmToDraw = wl.assemblyName.length > 22 ? wl.assemblyName.substring(0, 21) + '.' : wl.assemblyName;
      doc.text(subAsmToDraw, margin + 65, currentY + 4.5);

      doc.setFont('Helvetica', 'bold');
      doc.text(`${wl.amountKg.toFixed(1)} kg`, margin + 115, currentY + 4.5);
      
      doc.setFont('Helvetica', 'normal');
      const notesToDraw = wl.notes 
        ? wl.notes.length > 25 ? wl.notes.substring(0, 24) + '...' : wl.notes
        : '-';
      doc.text(notesToDraw, margin + 138, currentY + 4.5);

      doc.restoreGraphicsState();
      currentY += 8;
    });
  }

  currentY += 5;

  // --- Other Materials Consumption Logs Table ---
  checkPageBreak(35);
  doc.saveGraphicsState();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 43, 69);
  doc.text("OTHER MATERIALS CONSUMPTION & USAGE LOG", margin, currentY);
  
  doc.setDrawColor(34, 43, 69);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY + 2, 210 - margin, currentY + 2);
  doc.restoreGraphicsState();

  currentY += 7;

  // Headers
  checkPageBreak(12);
  doc.saveGraphicsState();
  doc.setFillColor(240, 243, 246);
  doc.rect(margin, currentY, printableWidth, 7, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 85);
  doc.text("DATE", margin + 3, currentY + 5);
  doc.text("MATERIAL ITEM", margin + 25, currentY + 5);
  doc.text("QTY USED", margin + 85, currentY + 5);
  doc.text("SUB-ASSEMBLY", margin + 110, currentY + 5);
  doc.text("ISSUED BY / MR", margin + 150, currentY + 5);
  
  doc.restoreGraphicsState();
  currentY += 7.5;

  if (projectConsumption.length === 0) {
    checkPageBreak(10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No other material consumption records logged for this project.", margin + 3, currentY + 5);
    currentY += 10;
  } else {
    // Sort project consumption logs by date descending
    const sortedConsumption = [...projectConsumption].sort((a, b) => b.date.localeCompare(a.date));
    sortedConsumption.forEach((cl, index) => {
      checkPageBreak(8);

      doc.saveGraphicsState();
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 252);
        doc.rect(margin, currentY - 1, printableWidth, 8, 'F');
      }
      doc.setDrawColor(235, 238, 243);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + 7, 210 - margin, currentY + 7);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 45, 55);

      doc.text(cl.date || '', margin + 3, currentY + 4.5);
      
      const matToDraw = cl.materialName.length > 32 ? cl.materialName.substring(0, 31) + '.' : cl.materialName;
      doc.text(matToDraw, margin + 25, currentY + 4.5);

      doc.setFont('Helvetica', 'bold');
      doc.text(`${cl.qtyUsed} ${cl.unit}`, margin + 85, currentY + 4.5);
      
      doc.setFont('Helvetica', 'normal');
      const subAsmName = cl.assemblyName || 'General Project';
      const subAsmToDraw = subAsmName.length > 20 ? subAsmName.substring(0, 19) + '.' : subAsmName;
      doc.text(subAsmToDraw, margin + 110, currentY + 4.5);

      const issuerAndMr = cl.mrNo ? `${cl.issuedBy} (${cl.mrNo})` : cl.issuedBy;
      const issuerToDraw = issuerAndMr.length > 18 ? issuerAndMr.substring(0, 17) + '.' : issuerAndMr;
      doc.text(issuerToDraw, margin + 150, currentY + 4.5);

      doc.restoreGraphicsState();
      currentY += 8;
    });
  }

  currentY += 5;

  // --- Timesheet Labor Logs Table ---
  checkPageBreak(35);
  doc.saveGraphicsState();
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(34, 43, 69);
  doc.text("TIMESHEET LABOR & MAN-HOURS AUDIT LOG", margin, currentY);
  
  doc.setDrawColor(34, 43, 69);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY + 2, 210 - margin, currentY + 2);
  doc.restoreGraphicsState();

  currentY += 7;

  // Table Headers
  checkPageBreak(12);
  doc.saveGraphicsState();
  doc.setFillColor(240, 243, 246);
  doc.rect(margin, currentY, printableWidth, 7, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 85);
  doc.text("DATE", margin + 3, currentY + 5);
  doc.text("CRAFTSMAN", margin + 25, currentY + 5);
  doc.text("SUB-ASSEMBLY", margin + 65, currentY + 5);
  doc.text("HOURS", margin + 115, currentY + 5);
  doc.text("RECORDED LABOR DESCRIPTION", margin + 130, currentY + 5);
  
  doc.restoreGraphicsState();
  currentY += 7.5;

  if (projectTimesheets.length === 0) {
    checkPageBreak(10);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No labor timesheets logged for this project's work order.", margin + 3, currentY + 5);
    currentY += 10;
  } else {
    // Sort project timesheets by date descending
    const sortedTimesheets = [...projectTimesheets].sort((a, b) => b.date.localeCompare(a.date));
    
    // Limits the list in PDF to top 50 to prevent infinite page counts, mentioning count if truncated
    const displayTimesheets = sortedTimesheets.slice(0, 60);
    
    displayTimesheets.forEach((ts, index) => {
      checkPageBreak(8);

      doc.saveGraphicsState();
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 252);
        doc.rect(margin, currentY - 1, printableWidth, 8, 'F');
      }
      doc.setDrawColor(235, 238, 243);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + 7, 210 - margin, currentY + 7);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 45, 55);

      doc.text(ts.date || '', margin + 3, currentY + 4.5);
      
      const empToDraw = ts.empName.length > 18 ? ts.empName.substring(0, 17) + '.' : ts.empName;
      doc.text(empToDraw, margin + 25, currentY + 4.5);

      const asmNameVal = ts.assemblyName || 'General Project';
      const subAsmToDraw = asmNameVal.length > 22 ? asmNameVal.substring(0, 21) + '.' : asmNameVal;
      doc.text(subAsmToDraw, margin + 65, currentY + 4.5);

      doc.setFont('Helvetica', 'bold');
      doc.text(`${fmtHrs(ts.totalHours)}h`, margin + 115, currentY + 4.5);
      
      doc.setFont('Helvetica', 'normal');
      const descToDraw = ts.desc 
        ? ts.desc.length > 28 ? ts.desc.substring(0, 27) + '...' : ts.desc
        : '-';
      doc.text(descToDraw, margin + 130, currentY + 4.5);

      doc.restoreGraphicsState();
      currentY += 8;
    });

    if (sortedTimesheets.length > 60) {
      checkPageBreak(10);
      doc.setFont('Helvetica', 'oblique');
      doc.setFontSize(8);
      doc.setTextColor(110, 120, 130);
      doc.text(`... and ${sortedTimesheets.length - 60} more older labor records omitted for document brevity.`, margin + 3, currentY + 5);
      currentY += 10;
    }
  }

  // Draw Page headers & footers dynamically on all formatted pages
  const totalDownloadedPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalDownloadedPages; i++) {
    doc.setPage(i);
    drawPageFooter();
  }

  // Save the PDF
  const filename = `PROJECT_REPORT_${project.client || 'COMPLETED'}_${project.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
