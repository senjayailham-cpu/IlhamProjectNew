import { useState, useMemo } from 'react';
import { Project, TimesheetEntry, ProblemReport, InspectionRequest } from '../types';
import { 
  analyzeProjectScheduleDelay, 
  getPredictiveScheduleDelaySummary, 
  PredictiveDelayResult 
} from '../utils/predictiveDelay';
import { 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink, 
  X, 
  Layers, 
  TrendingDown, 
  Flame, 
  Info,
  Calendar,
  AlertCircle
} from 'lucide-react';

export interface PredictiveScheduleDelayAlertProps {
  projects: Project[];
  timesheets?: TimesheetEntry[];
  problemReports?: ProblemReport[];
  inspections?: InspectionRequest[];
  todayStr?: string;
  variant?: 'banner' | 'widget' | 'compact';
  openSpotlight?: (projectId: string) => void;
  onNavigateToSchedule?: (projectId?: string) => void;
  onNavigateToProblemCenter?: () => void;
  className?: string;
}

export function PredictiveScheduleDelayAlert({
  projects,
  timesheets = [],
  problemReports = [],
  inspections = [],
  todayStr,
  variant = 'banner',
  openSpotlight,
  onNavigateToSchedule,
  onNavigateToProblemCenter,
  className = ''
}: PredictiveScheduleDelayAlertProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<PredictiveDelayResult | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'critical' | 'high'>('all');

  const summary = useMemo(() => {
    return getPredictiveScheduleDelaySummary(
      projects,
      timesheets,
      problemReports,
      inspections,
      todayStr
    );
  }, [projects, timesheets, problemReports, inspections, todayStr]);

  // Projects to display based on filter
  const displayedProjects = useMemo(() => {
    if (activeTabFilter === 'critical') {
      return summary.flaggedProjects.filter(p => p.riskLevel === 'critical');
    }
    if (activeTabFilter === 'high') {
      return summary.flaggedProjects.filter(p => p.riskLevel === 'high');
    }
    return summary.flaggedProjects;
  }, [summary.flaggedProjects, activeTabFilter]);

  // If no projects are flagged and no high risk, show positive status or compact banner
  if (summary.flaggedCount === 0) {
    if (variant === 'compact') return null;

    return (
      <div className={`bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center justify-between gap-3 text-base-text ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Predictive Schedule Delay: Normal
            </h4>
            <p className="text-xs text-base-muted">
              Berdasarkan analisis data historis timesheet ({timesheets.length} entri) dan {problemReports.length} problem report, tidak terdeteksi proyek berisiko tinggi keterlambatan.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-500/15 rounded-full whitespace-nowrap">
          {projects.filter(p => !p.isArchived && p.status !== 'completed').length} Proyek On-Track
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-base-surface border-2 border-rose-500/35 rounded-2xl shadow-card overflow-hidden transition-all ${className}`}>
      {/* Top Banner Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-500/15 via-base-surface to-amber-500/10 border-b border-base-border/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 relative">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-condensed font-black uppercase tracking-wider bg-rose-500 text-white rounded-md shadow-xs">
                Predictive Schedule Delay Alert
              </span>
              <span className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400">
                {summary.flaggedCount} Proyek Berisiko Tinggi
              </span>
            </div>
            <p className="text-xs text-base-muted">
              Model prediksi mendeteksi risiko keterlambatan signifikan berdasarkan deviasi historis <strong>timesheet</strong> (burn rate man-hours) & <strong>problem reports</strong> terbuka.
            </p>
          </div>
        </div>

        {/* Action Controls & Metric Badges */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-600 dark:text-rose-400 font-mono text-xs font-extrabold">
            <Clock className="w-3.5 h-3.5" />
            <span>Maks. +{summary.maxDelayDays} Hari Delay</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-600 dark:text-amber-400 font-mono text-xs font-extrabold">
            <Flame className="w-3.5 h-3.5" />
            <span>{summary.criticalCount} Kritis</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
            title={isExpanded ? 'Sembunyikan rincian' : 'Tampilkan rincian'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Alert Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-base-surface">
          {/* Quick Filters */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-b border-base-border/50 pb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mr-1">
                Filter Risiko:
              </span>
              <button
                onClick={() => setActiveTabFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-condensed font-bold transition-colors cursor-pointer ${
                  activeTabFilter === 'all'
                    ? 'bg-rose-500 text-white'
                    : 'bg-base-surface2 text-base-muted hover:text-base-text'
                }`}
              >
                Semua ({summary.flaggedCount})
              </button>
              <button
                onClick={() => setActiveTabFilter('critical')}
                className={`px-2.5 py-1 rounded-lg text-xs font-condensed font-bold transition-colors cursor-pointer ${
                  activeTabFilter === 'critical'
                    ? 'bg-rose-600 text-white'
                    : 'bg-base-surface2 text-base-muted hover:text-base-text'
                }`}
              >
                Critical ({summary.criticalCount})
              </button>
              <button
                onClick={() => setActiveTabFilter('high')}
                className={`px-2.5 py-1 rounded-lg text-xs font-condensed font-bold transition-colors cursor-pointer ${
                  activeTabFilter === 'high'
                    ? 'bg-amber-600 text-white'
                    : 'bg-base-surface2 text-base-muted hover:text-base-text'
                }`}
              >
                High Risk ({summary.highCount})
              </button>
            </div>

            <div className="text-[11px] text-base-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>Prediksi otomatis diperbarui real-time dari log timesheet & kendala bengkel</span>
            </div>
          </div>

          {/* Cards Grid of Flagged Projects */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedProjects.map((p) => {
              const isCrit = p.riskLevel === 'critical';

              return (
                <div
                  key={p.projectId}
                  className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                    isCrit 
                      ? 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/60' 
                      : 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Header badge & title */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider mb-1 ${
                          isCrit 
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' 
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {isCrit ? 'CRITICAL DELAY' : 'HIGH RISK'} • SKOR {p.riskScore}
                        </span>
                        <h4 className="font-condensed font-extrabold text-sm sm:text-base text-base-text truncate leading-snug" title={p.projectName}>
                          {p.projectName}
                        </h4>
                        <p className="text-[11px] font-mono text-base-muted truncate">
                          WO: {p.client} {p.dueDate ? `• Due: ${p.dueDate}` : ''}
                        </p>
                      </div>

                      {/* Estimated delay badge */}
                      <div className="shrink-0 text-right">
                        <div className={`font-mono font-black text-sm sm:text-base ${isCrit ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          +{p.predictedDelayDays} Hari
                        </div>
                        <div className="text-[9px] font-condensed uppercase font-bold text-base-muted">
                          Prediksi Slip
                        </div>
                      </div>
                    </div>

                    {/* Progress & Timesheet Metric Bars */}
                    <div className="space-y-1.5 bg-base-surface/80 p-2.5 rounded-lg border border-base-border/60 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-base-muted">Progres Fisik:</span>
                        <span className="font-mono font-bold text-base-text">{p.currentProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-base-border/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-base-accent rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, p.currentProgress)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-base-muted pt-1">
                        <span>Jam Terpakai: <strong className="font-mono text-base-text">{p.loggedHours}h</strong> / {p.budgetHours || '—'}h ({p.burnPct}%)</span>
                        {p.burnPct > 100 && (
                          <span className="text-rose-500 font-bold">Overbudget!</span>
                        )}
                      </div>
                    </div>

                    {/* Key Drivers List */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-rose-500" /> Faktor Penyebab Delay:
                      </span>
                      {p.drivers.slice(0, 2).map((driver, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-base-text bg-base-surface/50 p-1.5 rounded border border-base-border/40">
                          <span className="text-rose-500 mt-0.5">•</span>
                          <span className="line-clamp-2 leading-tight">
                            <strong className="font-medium text-base-text">{driver.title}:</strong> {driver.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-3 mt-3 border-t border-base-border/50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedProjectForDetail(p)}
                      className="text-xs font-condensed font-bold uppercase tracking-wider text-base-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Analisis Detail</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {openSpotlight && (
                        <button
                          onClick={() => openSpotlight(p.projectId)}
                          className="px-2 py-1 bg-base-surface hover:bg-base-surface2 border border-base-border rounded-lg text-[10px] font-condensed font-bold uppercase tracking-wider text-base-text hover:text-base-accent transition-colors cursor-pointer"
                          title="Buka Project Spotlight"
                        >
                          Spotlight
                        </button>
                      )}
                      {onNavigateToSchedule && (
                        <button
                          onClick={() => onNavigateToSchedule(p.projectId)}
                          className="px-2 py-1 bg-base-surface hover:bg-base-surface2 border border-base-border rounded-lg text-[10px] font-condensed font-bold uppercase tracking-wider text-base-text hover:text-base-accent transition-colors cursor-pointer"
                          title="Buka Jadwal / Gantt"
                        >
                          Gantt
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAILED ANALYSIS & MITIGATION MODAL */}
      {selectedProjectForDetail && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[120] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setSelectedProjectForDetail(null)}
        >
          <div 
            className="bg-base-surface border border-base-border rounded-2xl shadow-modal w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-base-border bg-base-surface2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${
                  selectedProjectForDetail.riskLevel === 'critical'
                    ? 'bg-rose-500/20 text-rose-500 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-condensed font-black text-lg text-base-text uppercase tracking-wide">
                    Detail Prediksi Schedule Delay: {selectedProjectForDetail.projectName}
                  </h3>
                  <p className="text-xs text-base-muted font-mono">
                    WO: {selectedProjectForDetail.client} • Target Finish: {selectedProjectForDetail.dueDate || 'Belum Ditentukan'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedProjectForDetail(null)}
                className="p-1.5 rounded-lg hover:bg-base-surface text-base-muted hover:text-base-text transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-base-text text-xs">
              
              {/* Top Overview Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-base-surface2 border border-base-border text-center">
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted block">Risk Score</span>
                  <span className="text-2xl font-mono font-black text-rose-500">
                    {selectedProjectForDetail.riskScore}/100
                  </span>
                  <span className="text-[9px] font-mono text-base-muted block mt-0.5">
                    Level: {selectedProjectForDetail.riskLevel.toUpperCase()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-base-surface2 border border-base-border text-center">
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted block">Prediksi Delay</span>
                  <span className="text-2xl font-mono font-black text-rose-600 dark:text-rose-400">
                    +{selectedProjectForDetail.predictedDelayDays} Hari
                  </span>
                  <span className="text-[9px] font-mono text-base-muted block mt-0.5">
                    {selectedProjectForDetail.isOverdue ? 'Sudah Overdue' : 'Estimasi Mundur'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-base-surface2 border border-base-border text-center">
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted block">Jam Kerja (Burn)</span>
                  <span className="text-2xl font-mono font-black text-base-text">
                    {selectedProjectForDetail.burnPct}%
                  </span>
                  <span className="text-[9px] font-mono text-base-muted block mt-0.5">
                    {selectedProjectForDetail.loggedHours}h / {selectedProjectForDetail.budgetHours}h
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-base-surface2 border border-base-border text-center">
                  <span className="text-[10px] font-condensed font-bold uppercase text-base-muted block">Problem Open</span>
                  <span className="text-2xl font-mono font-black text-amber-500">
                    {selectedProjectForDetail.openProblemCount} Isu
                  </span>
                  <span className="text-[9px] font-mono text-base-muted block mt-0.5">
                    {selectedProjectForDetail.criticalBlockerCount} Kritis
                  </span>
                </div>
              </div>

              {/* 1. Historical Timesheet Analysis */}
              <div className="p-4 rounded-xl border border-base-border bg-base-surface2/50 space-y-2.5">
                <h4 className="font-condensed font-extrabold uppercase tracking-wider text-xs flex items-center gap-2 text-base-text">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Analisis Historis Timesheet & Man-Hours Burn Rate
                </h4>
                <p className="text-base-muted">
                  Perbandingan antara jam kerja aktual yang telah dicatatkan ({selectedProjectForDetail.loggedHours} jam) terhadap anggaran ({selectedProjectForDetail.budgetHours} jam) dan pencapaian fisik ({selectedProjectForDetail.currentProgress}%):
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-base-surface border border-base-border rounded-lg space-y-1">
                    <span className="text-[10px] font-condensed font-bold uppercase text-base-muted">Efisiensi Man-Hours vs Progres</span>
                    <div className="font-mono text-sm font-bold text-base-text">
                      Rasio Efisiensi: {selectedProjectForDetail.burnEfficiencyRatio}
                      <span className="text-[10px] text-base-muted ml-1">(Ideal &ge; 1.0)</span>
                    </div>
                    <p className="text-[11px] text-base-muted">
                      {selectedProjectForDetail.burnEfficiencyRatio < 0.7 
                        ? 'Penggunaan jam kerja lebih boros daripada laju progres aktual.'
                        : 'Laju pemakaian jam kerja seimbang dengan pertumbuhan progres.'}
                    </p>
                  </div>

                  <div className="p-3 bg-base-surface border border-base-border rounded-lg space-y-1">
                    <span className="text-[10px] font-condensed font-bold uppercase text-base-muted">Partisipasi Tim Historis</span>
                    <div className="font-mono text-sm font-bold text-base-text">
                      {selectedProjectForDetail.recentActivePersonnel} Tenaga Kerja Aktif
                    </div>
                    <p className="text-[11px] text-base-muted">
                      Jumlah mekanik, fitter, welder, dan supervisor yang tercatat di timesheet WO ini.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Historical Problem Reports Impact */}
              <div className="p-4 rounded-xl border border-base-border bg-base-surface2/50 space-y-2.5">
                <h4 className="font-condensed font-extrabold uppercase tracking-wider text-xs flex items-center gap-2 text-base-text">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Korelasi Problem Reports & Kendala Produksi Terbuka
                </h4>
                {selectedProjectForDetail.openProblemCount === 0 ? (
                  <p className="text-base-muted italic">Tidak ada problem report terbuka yang terhubung ke proyek ini.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-base-muted">
                      Ditemukan {selectedProjectForDetail.openProblemCount} kendala lapangan aktif yang menghambat kecepatan fabrikasi:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedProjectForDetail.problemCategories).map(([cat, count]) => (
                        <span key={cat} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold">
                          {cat}: {count} isu
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Delay Drivers Breakdown */}
              <div className="space-y-2">
                <h4 className="font-condensed font-extrabold uppercase tracking-wider text-xs flex items-center gap-2 text-base-text">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  Rincian Pendorong Risiko Keterlambatan (Root-Cause Breakdown)
                </h4>
                <div className="space-y-2">
                  {selectedProjectForDetail.drivers.map((driver, idx) => (
                    <div key={idx} className="p-3 bg-base-surface border border-base-border rounded-xl flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-condensed font-bold uppercase tracking-wider ${
                            driver.severity === 'critical' ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          }`}>
                            {driver.severity}
                          </span>
                          <strong className="text-sm font-condensed font-bold text-base-text">{driver.title}</strong>
                        </div>
                        <p className="text-xs text-base-muted">{driver.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-mono font-bold text-rose-500">+{driver.impactDays}d impact</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Actionable Mitigations */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <h4 className="font-condensed font-extrabold uppercase tracking-wider text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Rekomendasi Tindakan Mitigasi (PPC & Project Controller)
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-base-text">
                  {selectedProjectForDetail.recommendedMitigations.map((rec, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-base-border bg-base-surface2 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[10px] text-base-muted font-mono">
                Model: Predictive Delay Engine v2.0
              </span>

              <div className="flex items-center gap-2">
                {openSpotlight && (
                  <button
                    onClick={() => {
                      const id = selectedProjectForDetail.projectId;
                      setSelectedProjectForDetail(null);
                      openSpotlight(id);
                    }}
                    className="px-3 py-1.5 bg-base-surface hover:bg-base-surface3 border border-base-border text-base-text rounded-xl font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Buka Project Spotlight
                  </button>
                )}

                {onNavigateToSchedule && (
                  <button
                    onClick={() => {
                      const id = selectedProjectForDetail.projectId;
                      setSelectedProjectForDetail(null);
                      onNavigateToSchedule(id);
                    }}
                    className="px-3 py-1.5 bg-base-accent hover:bg-base-accent/90 text-white rounded-xl font-condensed font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Buka Jadwal & Gantt</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default PredictiveScheduleDelayAlert;
