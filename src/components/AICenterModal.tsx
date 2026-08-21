import React, { useState, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { Project, Employee, MaterialItem, MaterialRequest, ProblemReport, InspectionRequest, TimesheetEntry } from '../types';
import { calcPct } from '../utils/projectUtils';
import { 
  Sparkles, 
  BrainCircuit, 
  AlertTriangle, 
  Package, 
  UserX, 
  ClipboardCheck, 
  Flame, 
  CheckCircle, 
  Send, 
  ChevronRight,
  HelpCircle,
  X
} from 'lucide-react';
import { motion } from 'motion/react';

interface AICenterModalProps {
  projects: Project[];
  employees: Employee[];
  materials?: MaterialItem[];
  materialRequests?: MaterialRequest[];
  problemReports?: ProblemReport[];
  inspections?: InspectionRequest[];
  timesheets?: TimesheetEntry[];
  setActiveTab?: (tab: string) => void;
  onClose?: () => void;
  openSpotlight?: (id: string) => void;
}

interface InsightCardData {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  targetTab: string;
  buttonLabel: string;
}

export default function AICenterModal({
  projects = [],
  employees = [],
  materials = [],
  materialRequests = [],
  problemReports = [],
  inspections = [],
  timesheets = [],
  setActiveTab,
  onClose,
  openSpotlight
}: AICenterModalProps) {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string; projectIds?: string[] }>>([]);
  const [isTyping, setIsTyping] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  // -------------------------------------------------------------
  // DYNAMIC INSIGHTS CALCULATION (ENGLISH)
  // -------------------------------------------------------------
  const insights = useMemo(() => {
    const list: InsightCardData[] = [];

    // 1. Overdue Risk Projects
    const overdueRisk = projects.filter(p => {
      if (p.status === 'completed') return false;
      if (!p.due) return false;
      const dueDate = new Date(p.due);
      const today = new Date();
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const progress = calcPct(p);
      return diffDays <= 7 && progress < 85;
    });

    if (overdueRisk.length > 0) {
      list.push({
        id: 'overdue-risk',
        type: 'danger',
        icon: AlertTriangle,
        title: `${overdueRisk.length} Projects at Risk of Overdue`,
        description: `Project "${overdueRisk[0].name}" is approaching its due date (${overdueRisk[0].due}) with progress at only ${calcPct(overdueRisk[0])}%.`,
        targetTab: 'projects',
        buttonLabel: 'Monitor Project'
      });
    }

    // 2. Open Problem Reports
    const openProblems = problemReports.filter(pr => pr.status === 'Open');
    if (openProblems.length > 0) {
      list.push({
        id: 'open-problems',
        type: 'danger',
        icon: Flame,
        title: `${openProblems.length} Open Field Issues`,
        description: `Latest issue: "${openProblems[0].description}" reported by ${openProblems[0].reportedBy}.`,
        targetTab: 'projects',
        buttonLabel: 'View Projects & Issues'
      });
    }

    // 3. Low Stock Materials
    const lowStock = materials.filter(m => m.currentStock < m.minStock);
    if (lowStock.length > 0) {
      const outOfStockCount = lowStock.filter(m => m.currentStock === 0).length;
      list.push({
        id: 'low-stock',
        type: 'warning',
        icon: Package,
        title: `${lowStock.length} Materials Need Restock`,
        description: outOfStockCount > 0 
          ? `${outOfStockCount} materials are completely out of stock. Stock of ${lowStock[0].name} is critical at ${lowStock[0].currentStock} ${lowStock[0].unit}.`
          : `Stock of ${lowStock[0].name} is below the minimum safety stock level.`,
        targetTab: 'materials',
        buttonLabel: 'Check Inventory'
      });
    }

    // 4. Absent/Leave Employees
    let targetDate = todayStr;
    let todayTimesheets = timesheets.filter(t => t.date === targetDate);
    if (todayTimesheets.length === 0 && timesheets.length > 0) {
      const dates = [...timesheets].map(t => t.date).sort();
      targetDate = dates[dates.length - 1];
      todayTimesheets = timesheets.filter(t => t.date === targetDate);
    }
    const absentToday = todayTimesheets.filter(t => t.status === 'absent' || t.status === 'leave');
    if (absentToday.length > 0) {
      list.push({
        id: 'absent-today',
        type: 'warning',
        icon: UserX,
        title: `${absentToday.length} Absent Employees`,
        description: `Based on the latest timesheet records (${targetDate}), ${absentToday.length} workers are absent/on leave.`,
        targetTab: 'timesheet',
        buttonLabel: 'Open Timesheets'
      });
    }

    // 5. QC Inspections Pending Approval (status === 'Requested')
    const pendingQC = inspections.filter(ins => ins.status === 'Requested');
    if (pendingQC.length > 0) {
      list.push({
        id: 'pending-qc',
        type: 'info',
        icon: ClipboardCheck,
        title: `${pendingQC.length} QC Inspections Pending`,
        description: `Latest RFI "${pendingQC[0].inspectionType}" for sub-assembly ${pendingQC[0].assemblyName || 'main'} is awaiting QC verification.`,
        targetTab: 'inspections',
        buttonLabel: 'Process RFI'
      });
    }

    // Fallback card if everything is in perfect state
    if (list.length === 0) {
      list.push({
        id: 'all-clear',
        type: 'success',
        icon: CheckCircle,
        title: 'All Projects Healthy',
        description: 'No material delays, field issues, or critical timeline risks detected at the moment.',
        targetTab: 'projects',
        buttonLabel: 'View All Projects'
      });
    }

    return list;
  }, [projects, problemReports, materials, timesheets, inspections, todayStr]);

  // -------------------------------------------------------------
  // DYNAMIC LOCAL ANSWER GENERATOR (ENGLISH)
  // -------------------------------------------------------------
  const generateLocalAnswer = (query: string): { text: string; projectIds?: string[] } => {
    const lowerQuery = query.toLowerCase().trim();

    // Pattern 5: Completed Projects
    if (lowerQuery.includes('completed') || lowerQuery.includes('selesai') || lowerQuery.includes('history') || lowerQuery.includes('archive')) {
      const completed = projects.filter(p => p.status === 'completed');
      if (completed.length === 0) {
        return {
          text: "There are currently no completed projects stored in the system archive.",
          projectIds: []
        };
      }

      let answer = `✅ **Completed Projects Registry:**\n\nThere are **${completed.length} completed projects** recorded in your system archive. You can click **View Details** on any of the project cards below to inspect their structural assemblies, task breakdowns, historical timesheets, or export PDF completion reports:`;
      
      return {
        text: answer,
        projectIds: completed.map(p => p.id)
      };
    }

    // Pattern 1: Project risk / overdue
    if (lowerQuery.includes('risk') || lowerQuery.includes('overdue') || lowerQuery.includes('critical') || lowerQuery.includes('paling berisiko') || lowerQuery.includes('risiko') || lowerQuery.includes('kritis')) {
      const activeProjects = projects.filter(p => p.status !== 'completed');
      if (activeProjects.length === 0) {
        return {
          text: "There are currently no active projects registered in the system.",
          projectIds: []
        };
      }
      const riskSorted = [...activeProjects].map(p => {
        const progress = calcPct(p);
        const hasDue = !!p.due;
        let diffDays = 999;
        if (hasDue) {
          const dueDate = new Date(p.due!);
          diffDays = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        }
        const riskScore = (100 - progress) * (diffDays <= 0 ? 3 : diffDays <= 7 ? 2 : 1);
        return { project: p, progress, diffDays, riskScore };
      }).sort((a, b) => b.riskScore - a.riskScore);

      const topRisk = riskSorted[0];
      if (topRisk.riskScore < 20) {
        return {
          text: "Great! All active projects show healthy progress and secure timelines. No high-risk projects detected at this moment.",
          projectIds: []
        };
      }

      let answer = `⚠️ **Project Risk Analysis:**\n\nThe most at-risk project currently is **${topRisk.project.name}** (Client: ${topRisk.project.client}).\n`;
      answer += `- **Current Progress:** ${topRisk.progress}%\n`;
      if (topRisk.project.due) {
        if (topRisk.diffDays < 0) {
          answer += `- **Timeline Status:** Overdue by **${Math.abs(topRisk.diffDays)} days** (Due Date: ${topRisk.project.due})\n`;
        } else {
          answer += `- **Timeline Status:** **${topRisk.diffDays} days** remaining until due date (${topRisk.project.due})\n`;
        }
      } else {
        answer += `- **Timeline Status:** No official due date defined yet\n`;
      }
      answer += `\n*Recommendation:* Please allocate additional Manpower or conduct on-site coordination via the **Projects** tab to catch up on sub-assembly delays.`;
      return {
        text: answer,
        projectIds: [topRisk.project.id]
      };
    }

    // Pattern 2: Welder / productive / employee
    if (lowerQuery.includes('welder') || lowerQuery.includes('productive') || lowerQuery.includes('pekerja') || lowerQuery.includes('employee') || lowerQuery.includes('siapa') || lowerQuery.includes('who')) {
      if (timesheets.length === 0) {
        return {
          text: "No employee attendance or timesheet data has been registered yet.",
          projectIds: []
        };
      }

      const welderHours: Record<string, { name: string; hours: number; position: string }> = {};
      timesheets.forEach(t => {
        const emp = employees.find(e => e.id === t.empId || e.name === t.empName);
        const pos = emp?.position || 'Manpower';
        if (!welderHours[t.empId]) {
          welderHours[t.empId] = { name: t.empName, hours: 0, position: pos };
        }
        welderHours[t.empId].hours += t.totalHours || 0;
      });

      const sortedEmployees = Object.values(welderHours).sort((a, b) => b.hours - a.hours);
      const welders = sortedEmployees.filter(e => e.position.toLowerCase().includes('welder') || e.position.toLowerCase().includes('las'));
      
      const topMan = welders.length > 0 ? welders[0] : sortedEmployees[0];

      if (!topMan) {
        return {
          text: "Sorry, the system did not find any valid work hours in the timesheets.",
          projectIds: []
        };
      }

      let answer = `🏆 **Highest Labor Activity:**\n\nThe welder/worker with the highest work hours contribution is **${topMan.name}** (${topMan.position}).\n`;
      answer += `- **Total Logged Hours:** **${topMan.hours.toFixed(1)} hours** in the active period.\n`;
      if (welders.length > 1) {
        answer += `- **Runner-up (2nd):** ${welders[1].name} (${welders[1].hours.toFixed(1)} hours)\n`;
      }
      answer += `\n*Info:* This metric is dynamically calculated from daily timesheet entries. Accurate workspace tracking relies on diligent work logs from site teams.`;
      return {
        text: answer,
        projectIds: []
      };
    }

    // Pattern 3: Stock / restock / materials
    if (lowerQuery.includes('restock') || lowerQuery.includes('stock') || lowerQuery.includes('material') || lowerQuery.includes('habis') || lowerQuery.includes('stok') || lowerQuery.includes('barang')) {
      const lowStock = materials.filter(m => m.currentStock < m.minStock);
      if (lowStock.length === 0) {
        return {
          text: "Perfect! All materials in the inventory currently have safe levels above their minimum safety stock thresholds.",
          projectIds: []
        };
      }

      let answer = `📦 **Critical Materials & Inventory Status:**\n\nThere are **${lowStock.length} items** running below safety stock levels:\n\n`;
      lowStock.slice(0, 5).forEach((m, idx) => {
        const statusText = m.currentStock === 0 ? "⚠️ OUT OF STOCK" : "Critical";
        answer += `${idx + 1}. **${m.name}** — Remaining **${m.currentStock} ${m.unit}** (Min: ${m.minStock} ${m.unit}) — [${statusText}]\n`;
      });

      if (lowStock.length > 5) {
        answer += `\n...and ${lowStock.length - 5} other items.`;
      }
      answer += `\n\n*Recommendation:* Submit a material procurement request, or check remaining inventory details under the **Materials & Stock** section.`;
      return {
        text: answer,
        projectIds: []
      };
    }

    // Pattern 4: Total work hours / weekly hours
    if (lowerQuery.includes('total jam') || lowerQuery.includes('hours') || lowerQuery.includes('work hours') || lowerQuery.includes('jam kerja') || lowerQuery.includes('week') || lowerQuery.includes('minggu')) {
      if (timesheets.length === 0) {
        return {
          text: "No timesheet entries found in the system currently.",
          projectIds: []
        };
      }

      const dates = [...timesheets].map(t => t.date).sort();
      const latestDateStr = dates[dates.length - 1] || todayStr;
      const latestDate = new Date(latestDateStr);
      const oneWeekAgo = new Date(latestDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const thisWeekTimesheets = timesheets.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= oneWeekAgo && tDate <= latestDate;
      });

      const totalHoursThisWeek = thisWeekTimesheets.reduce((sum, t) => sum + (t.totalHours || 0), 0);

      let answer = `⏱️ **Accumulated Field Work Hours:**\n\nIn the last 7 days (up to ${latestDateStr}), the total recorded field work hours is **${totalHoursThisWeek.toFixed(1)} hours**.\n`;
      answer += `- **Attendance Logs Counted:** ${thisWeekTimesheets.length} daily logs.\n`;
      answer += `- **Average Hours per Entry:** ${(thisWeekTimesheets.length > 0 ? totalHoursThisWeek / thisWeekTimesheets.length : 0).toFixed(1)} hours.\n`;
      answer += `\n*Context:* These work hours represent active shop-floor operations at Workshop 1 & Workshop 2 for assemblies and welding.`;
      return {
        text: answer,
        projectIds: []
      };
    }

    return {
      text: "Full Q&A features are being developed. For now, you can ask about project statuses, completed projects, low-stock materials, and labor productivity.",
      projectIds: []
    };
  };

  const queryGemini = async (userMsg: string) => {
    setIsTyping(true);
    try {
      const context = {
        activeProjectsCount: projects.filter(p => p.status === 'active').length,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          client: p.client,
          status: p.status,
          due: p.due,
          budgetHours: p.budgetHours,
          assembliesCount: p.assemblies?.length || 0,
        })),
        employees: employees.map(e => ({
          id: e.id,
          name: e.name,
          position: e.position,
          isExEmployee: e.isExEmployee,
        })),
        lowStockMaterials: materials.filter(m => m.currentStock < m.minStock).map(m => ({
          name: m.name,
          stock: m.currentStock,
          min: m.minStock,
          unit: m.unit,
        })),
        openProblemReports: problemReports.filter(pr => pr.status === 'Open').map(pr => ({
          id: pr.id,
          description: pr.description,
          reportedBy: pr.reportedBy,
        })),
        pendingInspections: inspections.filter(i => i.status === 'Requested').length,
      };

      const user = getAuth().currentUser;
      const idToken = user ? await user.getIdToken(true).catch(() => null) : null;

      if (idToken) {
        const res = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({ prompt: userMsg, context }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            // Check if any projects mentioned in text
            const matchedIds = projects.filter(p => data.text.toLowerCase().includes(p.name.toLowerCase())).map(p => p.id);
            setChatHistory(prev => [...prev, { sender: 'ai', text: data.text, projectIds: matchedIds.length > 0 ? matchedIds : undefined }]);
            setIsTyping(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Server Gemini call failed, using local intelligence engine:", err);
    }

    // Fallback to local intelligent answer synthesis
    const localReply = generateLocalAnswer(userMsg);
    setChatHistory(prev => [...prev, { sender: 'ai', text: localReply.text, projectIds: localReply.projectIds }]);
    setIsTyping(false);
  };

  const handleSend = () => {
    if (!question.trim()) return;
    const userMsg = question;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setQuestion('');
    queryGemini(userMsg);
  };

  const handleQuickQuestion = (qText: string) => {
    setChatHistory(prev => [...prev, { sender: 'user', text: qText }]);
    setQuestion('');
    queryGemini(qText);
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  const getUrgencyClasses = (type: InsightCardData['type']) => {
    switch (type) {
      case 'danger':
        return {
          bg: 'bg-red-500/10 border-red-500/20 text-red-400',
          badge: 'bg-red-500/20 text-red-300 border-red-500/30',
          iconBg: 'bg-red-500/20 text-red-500 border border-red-500/30',
          btn: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40'
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          iconBg: 'bg-amber-500/20 text-amber-500 border border-amber-500/30',
          btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
        };
      case 'info':
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          iconBg: 'bg-blue-500/20 text-blue-500 border border-blue-500/30',
          btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/40'
        };
      case 'success':
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          iconBg: 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30',
          btn: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
        };
    }
  };

  return (
    <div className="bg-gradient-to-br from-base-surface to-base-surface2 border border-base-accent/20 rounded-2xl p-4 md:p-5 shadow-card space-y-4 relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-base-accent/5 rounded-full blur-2xl pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="flex flex-row items-center justify-between gap-2 border-b border-base-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-base-accent/10 flex items-center justify-center border border-base-accent/35">
            <Sparkles className="h-4.5 w-4.5 text-base-accent animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-condensed font-extrabold tracking-tight text-base-text uppercase">
                AI Command Center
              </h2>
              <span className="flex items-center gap-1 text-[8px] font-bold tracking-widest uppercase bg-base-green-dim text-base-green px-1.5 py-0.5 rounded-full border border-base-green/20 animate-pulse">
                <span className="h-1 w-1 rounded-full bg-base-green" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-base-muted2 mt-0.5">
              Automated summaries and smart insights compiled from your operational data
            </p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-base-surface3 transition-colors text-base-muted hover:text-base-text cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* INSIGHTS CARDS CAROUSEL / GRID */}
      <div className="space-y-1.5">
        <span className="block text-[9px] font-condensed font-bold uppercase tracking-wider text-base-muted select-none">
          Priority Alerts & Recommendations
        </span>

        {/* Horizontal scroll snap on mobile, responsive grid on desktop */}
        <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
          {insights.map((ins, index) => {
            const colors = getUrgencyClasses(ins.type);
            const Icon = ins.icon;
            return (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className={`min-w-[85%] sm:min-w-[45%] md:min-w-0 snap-center shrink-0 border rounded-xl p-3 flex flex-col justify-between gap-3 ${colors.bg}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`h-7 w-7 rounded-md flex items-center justify-center ${colors.iconBg}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${colors.badge}`}>
                      {ins.type === 'danger' ? 'High Urgent' : ins.type === 'warning' ? 'Warning' : ins.type === 'info' ? 'Info' : 'Clear'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold font-condensed text-base-text uppercase tracking-wide">
                      {ins.title}
                    </h4>
                    <p className="text-[11px] text-base-muted2 leading-relaxed font-normal">
                      {ins.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (setActiveTab) {
                      setActiveTab(ins.targetTab);
                    }
                  }}
                  className={`w-full py-1.5 px-2.5 rounded-lg text-[10px] font-condensed font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer border ${colors.btn}`}
                >
                  <span>{ins.buttonLabel}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* QUICK CHAT / INTERACTION PANEL */}
      <div className="bg-base-surface3/40 border border-base-border/50 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] font-condensed font-bold text-base-muted uppercase select-none">
          <BrainCircuit className="h-3.5 w-3.5 text-base-accent" />
          <span>Quick Q&A (Local Knowledge Base)</span>
        </div>

        {/* CHAT DISPLAY */}
        {chatHistory.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto border-b border-base-border/30 pb-3 scrollbar-thin">
            {chatHistory.map((chat, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col ${chat.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs shadow-sm leading-relaxed whitespace-pre-wrap ${
                    chat.sender === 'user' 
                      ? 'bg-base-accent text-white rounded-tr-none' 
                      : 'bg-base-surface border border-base-border text-base-text rounded-tl-none'
                  }`}
                >
                  {chat.text}

                  {chat.projectIds && chat.projectIds.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 w-full">
                      {chat.projectIds.map(pId => {
                        const proj = projects.find(x => x.id === pId);
                        if (!proj) return null;
                        const pct = calcPct(proj);
                        return (
                          <div 
                            key={proj.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-base-surface2 border border-base-border/80 hover:border-base-accent/30 transition-all gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${proj.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-base-accent shadow-[0_0_4px_var(--base-accent)]'}`} />
                                <span className="font-condensed font-bold text-xs text-base-text truncate block">{proj.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[9px] text-base-muted font-semibold mt-0.5">
                                <span className="font-mono uppercase shrink-0">{proj.client}</span>
                                <span>•</span>
                                <span>Progress: {pct}%</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                if (openSpotlight) {
                                  openSpotlight(proj.id);
                                  if (onClose) onClose();
                                }
                              }}
                              className="px-2 py-1 bg-base-accent hover:bg-base-accent/90 text-black text-[9px] font-condensed font-bold uppercase rounded-md cursor-pointer transition-colors whitespace-nowrap shadow-xs"
                            >
                              Detail
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-center gap-1 pl-2">
                <span className="text-[9px] text-base-muted italic animate-pulse">Analyzing real-time metrics...</span>
                <div className="flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-base-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1 w-1 rounded-full bg-base-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1 w-1 rounded-full bg-base-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* QUICK QUESTIONS CHIPS */}
        <div className="space-y-1">
          <span className="block text-[9px] font-bold text-base-muted2 uppercase tracking-wide">Suggested Queries:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleQuickQuestion("Which project is most at risk?")}
              className="px-2 py-1.5 rounded-lg border border-base-border bg-base-surface hover:border-base-accent/40 text-[11px] text-base-text hover:text-base-accent transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <HelpCircle className="h-3 w-3 text-red-400" />
              <span>At-Risk Project?</span>
            </button>
            <button
              onClick={() => handleQuickQuestion("Show completed projects details")}
              className="px-2 py-1.5 rounded-lg border border-base-border bg-base-surface hover:border-base-accent/40 text-[11px] text-base-text hover:text-base-accent transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <HelpCircle className="h-3 w-3 text-emerald-500" />
              <span>Completed Projects?</span>
            </button>
            <button
              onClick={() => handleQuickQuestion("Who is the most productive welder?")}
              className="px-2 py-1.5 rounded-lg border border-base-border bg-base-surface hover:border-base-accent/40 text-[11px] text-base-text hover:text-base-accent transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <HelpCircle className="h-3 w-3 text-amber-400" />
              <span>Top Welder?</span>
            </button>
            <button
              onClick={() => handleQuickQuestion("Which materials need to be restocked?")}
              className="px-2 py-1.5 rounded-lg border border-base-border bg-base-surface hover:border-base-accent/40 text-[11px] text-base-text hover:text-base-accent transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <HelpCircle className="h-3 w-3 text-blue-400" />
              <span>Restock Materials?</span>
            </button>
            <button
              onClick={() => handleQuickQuestion("What are the total work hours this week?")}
              className="px-2 py-1.5 rounded-lg border border-base-border bg-base-surface hover:border-base-accent/40 text-[11px] text-base-text hover:text-base-accent transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <HelpCircle className="h-3 w-3 text-emerald-450" />
              <span>Weekly Work Hours?</span>
            </button>
          </div>
        </div>

        {/* INPUT FORM */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about your projects..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-base-border bg-base-surface text-xs text-base-text focus:outline-none focus:border-base-accent placeholder:text-base-muted/70 shadow-sm"
          />
          <button
            onClick={handleSend}
            disabled={!question.trim()}
            className="h-8 w-8 rounded-lg bg-base-accent hover:bg-base-accent/90 disabled:bg-base-border disabled:cursor-not-allowed text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
          >
            <Send className="h-3 w-3" />
          </button>
          {chatHistory.length > 0 && (
            <button
              onClick={clearChat}
              className="px-2 py-1.5 rounded-lg border border-base-border hover:bg-base-surface text-[10px] text-base-muted hover:text-base-text transition-colors cursor-pointer"
              title="Clear Chat History"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
