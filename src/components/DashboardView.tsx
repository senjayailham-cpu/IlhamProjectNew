import React, { useState, useMemo, useEffect } from 'react';
import {
  Project,
  TimesheetEntry,
  Employee,
  MaterialItem,
  MaterialRequest,
  ProblemReport,
  InspectionRequest,
  WireLog,
  MaterialConsumptionLog,
  BomTemplate,
} from '../types';
import { useAppStore, useUIStore } from '../store';
import { getTotalManHours } from '../utils/projectUtils';
import { calculatePortfolioEvms, EvmsUnitMode } from '../utils/evmsEngine';
import { EvmsScorecardRow } from './evms/EvmsScorecardRow';
import { EvmsChartsSection } from './evms/EvmsChartsSection';
import { EvmsPortfolioTable } from './evms/EvmsPortfolioTable';
import { OperationalAlertStrip } from './evms/OperationalAlertStrip';
import {
  EvmsOperationalModals,
  EditBacModal,
  ActiveOperationalModal,
} from './evms/EvmsOperationalModals';
import { PredictiveScheduleDelayAlert } from './PredictiveScheduleDelayAlert';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Wallet,
  Clock,
  Info,
} from 'lucide-react';

interface DashboardViewProps {
  projects?: Project[];
  timesheets?: TimesheetEntry[];
  wireLogs?: WireLog[];
  consumptionLogs?: MaterialConsumptionLog[];
  employees?: Employee[];
  selectedMonth?: string;
  setSelectedMonth?: (val: string) => void;
  openSpotlight?: (id: string) => void;
  materials?: MaterialItem[];
  materialRequests?: MaterialRequest[];
  problemReports?: ProblemReport[];
  inspections?: InspectionRequest[];
  setActiveTab?: (tab: string) => void;
  bomTemplates?: BomTemplate[];
  onUpdateProject?: (updated: Project) => void;
}

export default function DashboardView({
  projects: propProjects,
  timesheets: propTimesheets,
  wireLogs: propWireLogs,
  consumptionLogs: propConsumptionLogs,
  employees: propEmployees,
  selectedMonth: propSelectedMonth,
  setSelectedMonth: propSetSelectedMonth,
  openSpotlight: propOpenSpotlight,
  materials: propMaterials = [],
  materialRequests: propMaterialRequests = [],
  problemReports: propProblemReports = [],
  inspections: propInspections = [],
  setActiveTab: propSetActiveTab,
  bomTemplates: propBomTemplates,
  onUpdateProject,
}: DashboardViewProps) {
  const storeProjects = useAppStore((s) => s.projects);
  const storeTimesheets = useAppStore((s) => s.timesheets);
  const storeWireLogs = useAppStore((s) => s.wireLogs);
  const storeConsumptionLogs = useAppStore((s) => s.consumptionLogs);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeMaterials = useAppStore((s) => s.materials);
  const storeMaterialRequests = useAppStore((s) => s.materialRequests);
  const storeProblemReports = useAppStore((s) => s.problemReports);
  const storeInspections = useAppStore((s) => s.inspections);
  const storeBomTemplates = useAppStore((s) => s.bomTemplates);
  const currency = useAppStore((s) => s.currency);
  const exchangeRates = useAppStore((s) => s.exchangeRates);

  const storeSelectedMonth = useUIStore((s) => s.selectedMonth);
  const storeSetSelectedMonth = useUIStore((s) => s.setSelectedMonth);
  const storeOpenSpotlight = useUIStore((s) => s.openSpotlight);
  const storeSetActiveTab = useUIStore((s) => s.setActiveTab);

  const projects = propProjects?.length ? propProjects : storeProjects;
  const timesheets = propTimesheets?.length ? propTimesheets : storeTimesheets;
  const wireLogs = propWireLogs?.length ? propWireLogs : storeWireLogs;
  const consumptionLogs = propConsumptionLogs?.length ? propConsumptionLogs : storeConsumptionLogs;
  const employees = propEmployees?.length ? propEmployees : storeEmployees;
  const materials = propMaterials?.length ? propMaterials : storeMaterials;
  const materialRequests = propMaterialRequests?.length ? propMaterialRequests : storeMaterialRequests;
  const problemReports = propProblemReports?.length ? propProblemReports : storeProblemReports;
  const inspections = propInspections?.length ? propInspections : storeInspections;
  const bomTemplates = propBomTemplates?.length ? propBomTemplates : storeBomTemplates;

  const selectedMonth = propSelectedMonth || storeSelectedMonth;
  const setSelectedMonth = propSetSelectedMonth || storeSetSelectedMonth;
  const openSpotlight = propOpenSpotlight || storeOpenSpotlight;
  const setActiveTab = propSetActiveTab || storeSetActiveTab;

  // Global Cockpit Controls
  const [dashLoc, setDashLoc] = useState<'all' | 'workshop1' | 'workshop2'>('all');
  const [scopeMode, setScopeMode] = useState<'month' | 'all_active'>('month');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [unitMode, setUnitMode] = useState<EvmsUnitMode>('cost');

  // Modals
  const [activeModal, setActiveModal] = useState<ActiveOperationalModal>(null);
  const [editingBacProject, setEditingBacProject] = useState<Project | null>(null);

  const getDefaultDashDate = (monthYM: string): string => {
    const today = new Date();
    const curYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = monthYM.split('-').map(Number);
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    if (monthYM === curYM) {
      return `${curYM}-${String(today.getDate()).padStart(2, '0')}`;
    }
    return `${monthYM}-${String(lastDayOfMonth).padStart(2, '0')}`;
  };

  const [dashDate, setDashDate] = useState<string>(() => getDefaultDashDate(selectedMonth));

  useEffect(() => {
    setDashDate(getDefaultDashDate(selectedMonth));
  }, [selectedMonth]);

  const { minMonthDate, maxMonthDate } = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const y = parseInt(yStr, 10) || 2026;
    const m = parseInt(mStr, 10) || 6;
    const days = new Date(y, m, 0).getDate();
    return {
      minMonthDate: `${selectedMonth}-01`,
      maxMonthDate: `${selectedMonth}-${String(days).padStart(2, '0')}`,
    };
  }, [selectedMonth]);

  const isCurrentMonth = () => {
    const today = new Date();
    const curYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === curYM;
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const jumpToToday = () => {
    const today = new Date();
    const curYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const todayIso = `${curYM}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedMonth(curYM);
    setDashDate(todayIso);
  };

  const handleDateChange = (val: string) => {
    if (!val) return;
    if (val < minMonthDate) setDashDate(minMonthDate);
    else if (val > maxMonthDate) setDashDate(maxMonthDate);
    else setDashDate(val);
  };

  const formatMonthLabel = (ym?: string | null) => {
    if (!ym) return '';
    const [y, m] = ym.trim().slice(0, 7).split('-').map(Number);
    if (!y || !m) return ym;
    const d = new Date(y, m - 1, 1);
    return isNaN(d.getTime())
      ? ym
      : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Filtered projects for selected scope & workshop
  const scopedProjects = useMemo(() => {
    return projects.filter((p) => {
      if (p.isArchived) return false;
      if (dashLoc !== 'all' && p.location !== dashLoc) return false;

      if (scopeMode === 'all_active') {
        return p.status !== 'completed';
      }

      if (p.targetMonth) {
        return p.targetMonth === selectedMonth;
      }
      if (p.status === 'completed' && p.completedDate) {
        return p.completedDate.slice(0, 7) === selectedMonth;
      }
      const createdYM = (p.start || p.created || '').slice(0, 7);
      const dueYM = (p.due || '').slice(0, 7);
      return (
        createdYM === selectedMonth ||
        dueYM === selectedMonth ||
        (createdYM === '' && isCurrentMonth()) ||
        (p.start && p.due && p.start <= `${selectedMonth}-31` && p.due >= `${selectedMonth}-01`)
      );
    });
  }, [projects, dashLoc, scopeMode, selectedMonth]);

  // Reset specific project selector if project falls outside current scope
  useEffect(() => {
    if (
      selectedProjectId !== 'all' &&
      !scopedProjects.some((p) => p.id === selectedProjectId)
    ) {
      setSelectedProjectId('all');
    }
  }, [scopedProjects, selectedProjectId]);

  const evmsTargetProjects = useMemo(() => {
    if (selectedProjectId === 'all') return scopedProjects;
    return scopedProjects.filter((p) => p.id === selectedProjectId);
  }, [scopedProjects, selectedProjectId]);

  // Core EVMS Engine Calculation
  const evmsSummary = useMemo(() => {
    return calculatePortfolioEvms(evmsTargetProjects, {
      unitMode,
      selectedMonth,
      evalDate: dashDate,
      timesheets,
      wireLogs,
      consumptionLogs,
      employees,
      materials,
      bomTemplates,
    });
  }, [
    evmsTargetProjects,
    unitMode,
    selectedMonth,
    dashDate,
    timesheets,
    wireLogs,
    consumptionLogs,
    employees,
    materials,
    bomTemplates,
  ]);

  // Operational Readiness Data (Zone 3)
  const todayStr = new Date().toISOString().slice(0, 10);

  const todayTimesheets = useMemo(
    () => timesheets.filter((ts) => ts.date === todayStr),
    [timesheets, todayStr]
  );

  const presentPersonnelToday = useMemo(
    () => todayTimesheets.filter((ts) => ts.status === 'present' || ts.status === 'late'),
    [todayTimesheets]
  );

  const absentPersonnelToday = useMemo(
    () => todayTimesheets.filter((ts) => ts.status === 'absent' || ts.status === 'leave'),
    [todayTimesheets]
  );

  const scopedTimesheets = useMemo(() => {
    return timesheets.filter((ts) => {
      if (!ts.date || ts.date.slice(0, 7) !== selectedMonth) return false;
      if (dashLoc !== 'all') {
        const targetProj = projects.find(
          (p) =>
            p.client &&
            p.client.trim().toLowerCase() === (ts.workOrder || '').trim().toLowerCase()
        );
        if (!targetProj || targetProj.location !== dashLoc) return false;
      }
      return true;
    });
  }, [timesheets, selectedMonth, dashLoc, projects]);

  const totalManHours = useMemo(() => getTotalManHours(scopedTimesheets), [scopedTimesheets]);

  const overdueProjectsList = useMemo(
    () =>
      scopedProjects.filter(
        (p) => p.due && p.due < todayStr && p.status !== 'completed'
      ),
    [scopedProjects, todayStr]
  );

  const overdueTasksList = useMemo(() => {
    const list: Array<{
      id: string;
      taskName: string;
      projectName: string;
      projectId: string;
      assemblyName: string;
      assigned: string;
      finishDate: string;
      progress: number;
    }> = [];
    scopedProjects.forEach((p) => {
      (p.assemblies || []).forEach((asm) => {
        (asm.tasks || []).forEach((t) => {
          if (!t.done && t.pct < 100 && t.finishDate && t.finishDate < todayStr) {
            list.push({
              id: t.id,
              taskName: t.name,
              projectName: p.name,
              projectId: p.id,
              assemblyName: asm.name,
              assigned: t.assigned || 'Belum Ditugaskan',
              finishDate: t.finishDate,
              progress: t.pct,
            });
          }
        });
      });
    });
    return list;
  }, [scopedProjects, todayStr]);

  const lowStockItems = useMemo(
    () => materials.filter((m) => m.currentStock > 0 && m.currentStock < m.minStock),
    [materials]
  );

  const outOfStockItems = useMemo(
    () => materials.filter((m) => m.currentStock === 0),
    [materials]
  );

  const pendingMrCount = useMemo(
    () => materialRequests.filter((mr) => mr.status === 'Submitted').length,
    [materialRequests]
  );

  const openProblemReports = useMemo(
    () => problemReports.filter((pr) => pr.status === 'Open'),
    [problemReports]
  );

  const pendingInspectionsCount = useMemo(
    () => inspections.filter((ir) => ['Draft', 'Requested'].includes(ir.status)).length,
    [inspections]
  );

  const punchlistInspections = useMemo(
    () => inspections.filter((ins) => ins.status === 'Rejected / Punchlist'),
    [inspections]
  );

  const overdueProcList = useMemo(() => {
    const procs = scopedProjects.flatMap((p) => p.materialProcessing || []);
    return procs.filter((mp) => {
      if (mp.isCompleted) return false;
      const inProg = mp.activeStages?.some((k) => mp.stages[k]?.status === 'in-progress');
      if (!inProg) return false;
      const updated = new Date(mp.updatedAt || mp.createdAt);
      const diffDays = Math.ceil(Math.abs(Date.now() - updated.getTime()) / 86400000);
      return diffDays > 7;
    });
  }, [scopedProjects]);

  const totalActiveProblems =
    outOfStockItems.length +
    lowStockItems.length +
    overdueProjectsList.length +
    overdueProcList.length +
    openProblemReports.length +
    punchlistInspections.length;

  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <div className="space-y-5 pb-10">
      {/* HEADER & GLOBAL EVMS CONTROL BAR */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="font-condensed font-black text-xl sm:text-2xl uppercase tracking-tight text-base-text">
              Kokpit Manajemen Nilai Hasil (EVMS)
            </h1>
            <p className="text-xs text-base-muted mt-0.5">
              Kontrol anggaran, nilai hasil kerja, biaya aktual, dan proyeksi akhir portofolio proyek · Evaluasi {dashDate}
            </p>
          </div>

          {/* Unit Basis Switcher: Currency vs Man-Hours */}
          <div className="flex items-center gap-1 bg-base-surface2 p-1 rounded-lg border border-base-border self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setUnitMode('cost')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                unitMode === 'cost'
                  ? 'bg-base-surface text-base-text border border-base-border shadow-2xs'
                  : 'text-base-muted hover:text-base-text'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-base-accent" />
              <span>Basis Biaya ({currency})</span>
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('hours')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                unitMode === 'hours'
                  ? 'bg-base-surface text-base-text border border-base-border shadow-2xs'
                  : 'text-base-muted hover:text-base-text'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-base-blue" />
              <span>Basis Jam Kerja</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="pt-3 border-t border-base-border flex flex-wrap items-center justify-between gap-3">
          {/* Period & Evaluation Date */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 hover:bg-base-surface rounded-md text-base-muted hover:text-base-text cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-condensed font-bold uppercase tracking-wider text-base-text whitespace-nowrap">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 hover:bg-base-surface rounded-md text-base-muted hover:text-base-text cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-base-muted shrink-0" />
              <input
                type="date"
                value={dashDate}
                min={minMonthDate}
                max={maxMonthDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-xs font-mono text-base-text focus:outline-none"
                title="Tanggal Cut-Off Evaluasi EVMS"
              />
            </div>

            <button
              type="button"
              onClick={jumpToToday}
              className="px-2.5 py-1.5 rounded-lg border border-base-border bg-base-surface2 hover:bg-base-surface3 text-xs font-condensed font-bold uppercase tracking-wider text-base-text whitespace-nowrap shrink-0 cursor-pointer"
            >
              Hari Ini
            </button>

            <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setScopeMode('month')}
                className={`px-2.5 py-1 rounded-md text-xs font-condensed font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeMode === 'month'
                    ? 'bg-base-surface text-base-text border border-base-border'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                Periode Bulan
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('all_active')}
                className={`px-2.5 py-1 rounded-md text-xs font-condensed font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeMode === 'all_active'
                    ? 'bg-base-surface text-base-text border border-base-border'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                Semua Aktif
              </button>
            </div>
          </div>

          {/* Workshop & Project Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-base-surface2 border border-base-border rounded-lg p-0.5">
              {(
                [
                  { id: 'all', label: 'Semua Workshop' },
                  { id: 'workshop1', label: 'Workshop 1' },
                  { id: 'workshop2', label: 'Workshop 2' },
                ] as const
              ).map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setDashLoc(loc.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-condensed font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer ${
                    dashLoc === loc.id
                      ? 'bg-base-surface text-base-text border border-base-border'
                      : 'text-base-muted hover:text-base-text'
                  }`}
                >
                  {loc.id === 'all' && <MapPin className="w-3 h-3 text-base-muted" />}
                  <span>{loc.label}</span>
                </button>
              ))}
            </div>

            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-base-surface2 border border-base-border text-xs text-base-text focus:outline-none focus:border-base-accent max-w-[240px]"
            >
              <option value="all">Semua Proyek ({scopedProjects.length})</option>
              {scopedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client ? `[${p.client}] ` : ''}
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {evmsSummary.estimatedBacCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-base-muted bg-base-surface2/80 border border-base-border rounded-lg px-3 py-2">
            <Info className="w-4 h-4 text-base-accent shrink-0" />
            <span>
              <strong>{evmsSummary.estimatedBacCount} proyek</strong> belum memiliki BAC eksplisit dan menggunakan estimasi otomatis. Klik ikon pensil di tabel untuk mengisi anggaran BAC kontrak.
            </span>
          </div>
        )}
      </div>

      {/* ZONE 1: 4 EXECUTIVE EVMS SCORECARDS + CHARTS (S-CURVE & QUADRANT) */}
      <EvmsScorecardRow
        summary={evmsSummary}
        currency={currency}
        exchangeRates={exchangeRates}
      />

      <EvmsChartsSection
        summary={evmsSummary}
        currency={currency}
        exchangeRates={exchangeRates}
        monthLabel={monthLabel}
        openSpotlight={openSpotlight}
      />

      {/* ZONE 2: HIGH-DENSITY EVMS PORTFOLIO & ASSEMBLY TABLE */}
      <EvmsPortfolioTable
        projectsMetrics={evmsSummary.projects}
        rawProjects={evmsTargetProjects}
        unitMode={unitMode}
        currency={currency}
        exchangeRates={exchangeRates}
        openSpotlight={openSpotlight}
        onEditBac={onUpdateProject ? (proj) => setEditingBacProject(proj) : undefined}
      />

      {/* ZONE 3: UNIFIED OPERATIONAL ALERT STRIP & PREDICTIVE DELAY ALERT */}
      <OperationalAlertStrip
        presentCount={presentPersonnelToday.length}
        totalEmployees={employees.length}
        absentCount={absentPersonnelToday.length}
        totalManHours={totalManHours}
        openProblemsCount={openProblemReports.length}
        pendingInspectionsCount={pendingInspectionsCount}
        criticalMaterialCount={outOfStockItems.length + lowStockItems.length}
        pendingMrCount={pendingMrCount}
        overdueProjectsCount={overdueProjectsList.length}
        overdueTasksCount={overdueTasksList.length}
        totalActiveProblems={totalActiveProblems}
        onOpenModal={(modal) => setActiveModal(modal)}
        onNavigate={setActiveTab}
      />

      <PredictiveScheduleDelayAlert
        projects={scopedProjects}
        timesheets={timesheets}
        problemReports={problemReports}
        inspections={inspections}
        todayStr={dashDate}
        variant="banner"
        openSpotlight={openSpotlight}
        onNavigateToSchedule={() => setActiveTab?.('gantt')}
        onNavigateToProblemCenter={() => setActiveModal('problem-center')}
      />

      {/* ZONE 4: OPERATIONAL DETAIL & BAC EDITOR MODALS */}
      <EvmsOperationalModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        todayStr={todayStr}
        employees={employees}
        presentPersonnelToday={presentPersonnelToday}
        absentPersonnelToday={absentPersonnelToday}
        scopedTimesheets={scopedTimesheets}
        overdueProjectsList={overdueProjectsList}
        overdueTasksList={overdueTasksList}
        outOfStockItems={outOfStockItems}
        lowStockItems={lowStockItems}
        openProblemReports={openProblemReports}
        punchlistInspections={punchlistInspections}
        overdueProcList={overdueProcList}
        totalActiveProblems={totalActiveProblems}
        openSpotlight={openSpotlight}
        onNavigate={setActiveTab}
      />

      <EditBacModal
        project={editingBacProject}
        bomTemplates={bomTemplates}
        materials={materials}
        employees={employees}
        currency={currency}
        exchangeRates={exchangeRates}
        onClose={() => setEditingBacProject(null)}
        onSave={(updatedProj) => {
          onUpdateProject?.(updatedProj);
          setEditingBacProject(null);
        }}
      />
    </div>
  );
}
