import React from 'react';
import { Project, TimesheetEntry, InspectionRequest, MaterialRequest, OrgSettings, ProblemReport, Employee, UserRoleType } from '../types';
import { useAppStore, useUIStore } from '../store';
import { calcPct, calcTaskCounts } from '../utils/projectUtils';
import { calcProjectRiskScore, getRiskBadgeClasses } from '../utils/riskScore';
import Focus24View from './Focus24View';
import ShiftHandoverSection from './shopfloor/ShiftHandoverSection';
import { 
  Clock, 
  TrendingUp, 
  Package, 
  ClipboardCheck, 
  Folder, 
  ArrowRight, 
  Sparkles, 
  X, 
  Factory, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  Users,
  Layers
} from 'lucide-react';

interface ShopFloorViewProps {
  projects?: Project[];
  timesheets?: TimesheetEntry[];
  inspections?: InspectionRequest[];
  materialRequests?: MaterialRequest[];
  orgSettings?: OrgSettings;
  problemReports?: ProblemReport[];
  employees?: Employee[];
  currentUser?: { name: string; role: UserRoleType } | null;
  onAddProblemReport?: (report: Omit<ProblemReport, 'id' | 'date'>) => void;
  onUpdateProblemStatus?: (id: string, status: 'Open' | 'Resolved', resolutionNote?: string) => void;
  onDeleteProblemReport?: (id: string) => void;
  openSpotlight?: (pid: string) => void;
}

export default function ShopFloorView({
  projects: propProjects,
  timesheets: propTimesheets,
  inspections: propInspections,
  materialRequests: propMaterialRequests,
  orgSettings,
  problemReports: propProblemReports,
  employees: propEmployees,
  currentUser: propCurrentUser,
  onAddProblemReport,
  onUpdateProblemStatus,
  onDeleteProblemReport,
  openSpotlight: propOpenSpotlight
}: ShopFloorViewProps) {
  const storeProjects = useAppStore((s) => s.projects);
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeInspections = useAppStore((s) => s.inspections);
  const storeMaterialRequests = useAppStore((s) => s.materialRequests);
  const storeProblemReports = useAppStore((s) => s.problemReports);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeCurrentUser = useAppStore((s) => s.currentUser);

  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const storeOpenSpotlight = useUIStore((s) => s.openSpotlight);
  const setShopFloorMode = useUIStore((s) => s.setShopFloorMode);

  const projects = propProjects || storeProjects;
  const timesheets = propTimesheets || storeTimesheets;
  const inspections = propInspections || storeInspections;
  const materialRequests = propMaterialRequests || storeMaterialRequests;
  const problemReports = propProblemReports || storeProblemReports;
  const employees = propEmployees || storeEmployees;
  const currentUser = propCurrentUser || storeCurrentUser;
  const openSpotlight = propOpenSpotlight || storeOpenSpotlight;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Active projects list
  const activeProjects = React.useMemo(() => {
    return projects
      .filter(p => !p.isArchived && (p.status === 'active' || p.status === 'pending'))
      .slice(0, 6);
  }, [projects]);

  // Statistics for badges
  const presentCount = React.useMemo(() => {
    return new Set(
      timesheets
        .filter(t => t.date === todayStr && (t.status === 'present' || t.status === 'late'))
        .map(t => t.empId)
    ).size;
  }, [timesheets, todayStr]);

  const urgentMRCount = React.useMemo(() => {
    return materialRequests.filter(
      mr => (mr.urgency === 'Critical' || mr.urgency === 'Urgent') && ['Submitted', 'Approved'].includes(mr.status)
    ).length;
  }, [materialRequests]);

  const openInspectionsCount = React.useMemo(() => {
    return inspections.filter(ir => ['Draft', 'Requested'].includes(ir.status)).length;
  }, [inspections]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      
      {/* 1. Header Banner with Tablet-friendly Exit Toggle */}
      <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shadow-md shrink-0">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-condensed font-black text-xs uppercase tracking-wider">
                Shop Floor Mode
              </span>
              <span className="text-xs text-base-muted font-mono">{todayStr}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-condensed font-black text-base-text uppercase tracking-wide mt-1">
              Station Fabrikasi & Operasional Lapangan
            </h1>
          </div>
        </div>

        <button
          onClick={() => setShopFloorMode(false)}
          className="w-full sm:w-auto px-5 py-3 bg-base-surface hover:bg-base-surface2 border-2 border-base-border text-base-text hover:text-base-red font-condensed font-black text-sm uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0"
          title="Keluar dari Shop Floor Mode"
        >
          <X className="h-4 w-4 text-base-red" />
          <span>Exit Shop Floor</span>
        </button>
      </div>

      {/* Shift Handover Pinboard Banner (Coordinators note & status for next shift) */}
      <ShiftHandoverSection currentUser={currentUser} />

      {/* 2. Four Big Action Touch Cards (min-h ~64-80px, high contrast, tablet-friendly) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Card 1: Timesheet */}
        <button
          onClick={() => setActiveTab('timesheet')}
          className="group relative flex flex-col justify-between p-6 rounded-2xl bg-base-surface border-2 border-base-border hover:border-blue-500/80 shadow-md hover:shadow-xl transition-all duration-150 text-left cursor-pointer min-h-[140px] active:scale-[0.98] bg-linear-to-br hover:from-blue-500/5 hover:to-transparent"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0">
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-condensed font-black uppercase text-base-text tracking-wide group-hover:text-blue-500 transition-colors">
                  1. Timesheet
                </h2>
                <p className="text-sm text-base-muted mt-0.5">
                  Input jam kerja & kehadiran personil
                </p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-base-muted group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          <div className="mt-4 pt-3 border-t border-base-border flex items-center justify-between text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            <span className="flex items-center gap-1.5 text-blue-500">
              <Users className="h-3.5 w-3.5" />
              {presentCount} Hadir Hari Ini
            </span>
            <span className="text-base-accent font-black">Buka Modul →</span>
          </div>
        </button>

        {/* Card 2: Update Progress */}
        <button
          onClick={() => setActiveTab('projects')}
          className="group relative flex flex-col justify-between p-6 rounded-2xl bg-base-surface border-2 border-base-border hover:border-emerald-500/80 shadow-md hover:shadow-xl transition-all duration-150 text-left cursor-pointer min-h-[140px] active:scale-[0.98] bg-linear-to-br hover:from-emerald-500/5 hover:to-transparent"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
                <TrendingUp className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-condensed font-black uppercase text-base-text tracking-wide group-hover:text-emerald-500 transition-colors">
                  2. Update Progress
                </h2>
                <p className="text-sm text-base-muted mt-0.5">
                  Update % task & assembly proyek
                </p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-base-muted group-hover:text-emerald-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          <div className="mt-4 pt-3 border-t border-base-border flex items-center justify-between text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <Folder className="h-3.5 w-3.5" />
              {activeProjects.length} Proyek Aktif
            </span>
            <span className="text-base-accent font-black">Buka Proyek →</span>
          </div>
        </button>

        {/* Card 3: Materials */}
        <button
          onClick={() => setActiveTab('materials')}
          className="group relative flex flex-col justify-between p-6 rounded-2xl bg-base-surface border-2 border-base-border hover:border-amber-500/80 shadow-md hover:shadow-xl transition-all duration-150 text-left cursor-pointer min-h-[140px] active:scale-[0.98] bg-linear-to-br hover:from-amber-500/5 hover:to-transparent"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all shrink-0">
                <Package className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-condensed font-black uppercase text-base-text tracking-wide group-hover:text-amber-500 transition-colors">
                  3. Materials
                </h2>
                <p className="text-sm text-base-muted mt-0.5">
                  Request material & stok inventori
                </p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-base-muted group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          <div className="mt-4 pt-3 border-t border-base-border flex items-center justify-between text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            <span className={`flex items-center gap-1.5 ${urgentMRCount > 0 ? 'text-amber-500' : 'text-base-muted'}`}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {urgentMRCount} Request Urgent
            </span>
            <span className="text-base-accent font-black">Buka Material →</span>
          </div>
        </button>

        {/* Card 4: QC Inspections */}
        <button
          onClick={() => setActiveTab('inspections')}
          className="group relative flex flex-col justify-between p-6 rounded-2xl bg-base-surface border-2 border-base-border hover:border-purple-500/80 shadow-md hover:shadow-xl transition-all duration-150 text-left cursor-pointer min-h-[140px] active:scale-[0.98] bg-linear-to-br hover:from-purple-500/5 hover:to-transparent"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-500 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all shrink-0">
                <ClipboardCheck className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-condensed font-black uppercase text-base-text tracking-wide group-hover:text-purple-500 transition-colors">
                  4. QC Inspection
                </h2>
                <p className="text-sm text-base-muted mt-0.5">
                  Cek punchlist kualitas & request QC
                </p>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-base-muted group-hover:text-purple-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          <div className="mt-4 pt-3 border-t border-base-border flex items-center justify-between text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            <span className="flex items-center gap-1.5 text-purple-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {openInspectionsCount} Request Terbuka
            </span>
            <span className="text-base-accent font-black">Buka QC →</span>
          </div>
        </button>

      </div>

      {/* 3. Quick Touch List: Top Active Projects for Instant Spotlight Access */}
      <div className="bg-base-surface border-2 border-base-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Folder className="h-5 w-5 text-base-accent" />
            <h3 className="font-condensed font-black text-lg uppercase tracking-wider text-base-text">
              Pilih Proyek Aktif — <span className="text-base-accent">Update Cepat (1-Tap Spotlight)</span>
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('projects')}
            className="text-xs font-condensed font-bold uppercase tracking-wider text-base-accent hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Semua Proyek</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs text-base-muted">
          Ketuk kartu proyek di bawah ini untuk langsung membuka jendela Spotlight interaktif (update progress, log jam kerja, cek drawing & assembly):
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeProjects.map((p) => {
            const pct = calcPct(p);
            const risk = calcProjectRiskScore(p, {
              timesheets,
              inspections,
              problemReports: storeProblemReports,
              today: todayStr,
              materialProcessing: p.materialProcessing,
            });
            const riskBadge = getRiskBadgeClasses(risk.score);

            return (
              <button
                key={p.id}
                onClick={() => openSpotlight(p.id)}
                className="p-4 rounded-xl bg-base-surface2 hover:bg-base-surface3 border-2 border-base-border hover:border-base-accent transition-all text-left flex flex-col justify-between gap-3 cursor-pointer active:scale-98 shadow-xs group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold text-base-muted uppercase truncate">
                      {p.gaNumber || p.client || 'WO-PROJ'}
                    </span>
                    <span className={`text-[9px] font-condensed font-extrabold uppercase px-1.5 py-0.5 rounded border ${riskBadge}`}>
                      Risk: {risk.score}
                    </span>
                  </div>
                  <h4 className="font-condensed font-black text-base text-base-text uppercase line-clamp-1 group-hover:text-base-accent transition-colors">
                    {p.name}
                  </h4>
                  <p className="text-[11px] text-base-muted truncate mt-0.5">
                    {p.client ? `Client: ${p.client}` : 'Standar Fabrikasi'} • Due: {p.due || 'TBD'}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-base-border/70">
                  <div className="flex justify-between items-center text-[10px] font-condensed font-bold uppercase">
                    <span className="text-base-muted">Progress</span>
                    <span className="text-base-accent font-mono">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-base-surface3 border border-base-border overflow-hidden">
                    <div
                      className="h-full bg-base-accent transition-all duration-300 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Section: 24 Hours Focus (Problem Reports & Impediments) */}
      <div className="bg-base-surface border-2 border-base-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-md">
        <Focus24View
          orgSettings={orgSettings}
          problemReports={problemReports}
          projects={projects}
          employees={employees}
          currentUser={currentUser}
          onAddProblemReport={onAddProblemReport}
          onUpdateProblemStatus={onUpdateProblemStatus}
          onDeleteProblemReport={onDeleteProblemReport}
          openSpotlight={openSpotlight}
        />
      </div>

    </div>
  );
}
