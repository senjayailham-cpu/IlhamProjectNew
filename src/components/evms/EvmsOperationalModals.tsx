import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  UserX,
  Clock,
  AlertTriangle,
  Siren,
  CheckCircle2,
  ArrowRight,
  Package,
  AlertCircle,
  Wallet,
  Calculator,
  Layers,
  ShoppingCart,
} from 'lucide-react';
import { useUIStore } from '../../store';
import {
  Project,
  TimesheetEntry,
  Employee,
  MaterialItem,
  ProblemReport,
  InspectionRequest,
  MaterialProcessing,
  CurrencyCode,
  ExchangeRates,
  BomTemplate,
} from '../../types';
import { calcPct } from '../../utils/projectUtils';
import { formatCurrency, convertFromIDR, convertToIDR } from '../../utils/costEngine';
import {
  estimateProjectBacFromBom,
  findMatchingBomTemplate,
  getPortfolioAvgHourlyRate,
} from '../../utils/bacEstimator';

export type ActiveOperationalModal =
  | 'present'
  | 'absent'
  | 'man-hours'
  | 'overdue'
  | 'problem-center'
  | null;

interface EvmsOperationalModalsProps {
  activeModal: ActiveOperationalModal;
  onClose: () => void;
  todayStr: string;
  employees: Employee[];
  presentPersonnelToday: TimesheetEntry[];
  absentPersonnelToday: TimesheetEntry[];
  scopedTimesheets: TimesheetEntry[];
  overdueProjectsList: Project[];
  overdueTasksList: Array<{
    id: string;
    taskName: string;
    projectName: string;
    projectId: string;
    assemblyName: string;
    assigned: string;
    finishDate: string;
    progress: number;
  }>;
  outOfStockItems: MaterialItem[];
  lowStockItems: MaterialItem[];
  openProblemReports: ProblemReport[];
  punchlistInspections: InspectionRequest[];
  overdueProcList: MaterialProcessing[];
  totalActiveProblems: number;
  openSpotlight?: (id: string) => void;
  onNavigate?: (tab: string) => void;
}

export const EvmsOperationalModals: React.FC<EvmsOperationalModalsProps> = ({
  activeModal,
  onClose,
  todayStr,
  employees,
  presentPersonnelToday,
  absentPersonnelToday,
  scopedTimesheets,
  overdueProjectsList,
  overdueTasksList,
  outOfStockItems,
  lowStockItems,
  openProblemReports,
  punchlistInspections,
  overdueProcList,
  totalActiveProblems,
  openSpotlight,
  onNavigate,
}) => {
  const [overdueTab, setOverdueTab] = useState<'projects' | 'tasks'>('projects');

  if (!activeModal) return null;

  const daysDiff = (d1Str: string, d2Str: string) => {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    return Math.max(0, Math.ceil((d1.getTime() - d2.getTime()) / 86400000));
  };

  const titles: Record<Exclude<ActiveOperationalModal, null>, { label: string; count: number; icon: React.ReactNode }> = {
    present: {
      label: 'Personel Hadir Hari Ini',
      count: presentPersonnelToday.length,
      icon: <Users className="w-5 h-5 text-base-green" />,
    },
    absent: {
      label: 'Personel Absen / Izin Hari Ini',
      count: absentPersonnelToday.length,
      icon: <UserX className="w-5 h-5 text-base-red" />,
    },
    'man-hours': {
      label: 'Log Jam Kerja (Man-Hours)',
      count: scopedTimesheets.length,
      icon: <Clock className="w-5 h-5 text-base-blue" />,
    },
    overdue: {
      label: 'Proyek & Pekerjaan Terlambat',
      count: overdueProjectsList.length + overdueTasksList.length,
      icon: <AlertTriangle className="w-5 h-5 text-base-red" />,
    },
    'problem-center': {
      label: 'Pusat Kendala Operasional',
      count: totalActiveProblems,
      icon: <Siren className={`w-5 h-5 ${totalActiveProblems > 0 ? 'text-base-red' : 'text-base-green'}`} />,
    },
  };

  const currentMeta = titles[activeModal];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-base-surface border border-base-border rounded-2xl shadow-modal w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-base-border bg-base-surface2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {currentMeta.icon}
            <h3 className="font-condensed font-black text-lg uppercase tracking-wider text-base-text">
              {currentMeta.label}
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-base-surface3 border border-base-border text-xs font-mono font-bold text-base-muted">
              {currentMeta.count}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeModal === 'overdue' && (
          <div className="px-5 py-2.5 bg-base-surface2 border-b border-base-border flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOverdueTab('projects')}
              className={`px-3.5 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-lg border transition-colors cursor-pointer ${
                overdueTab === 'projects'
                  ? 'bg-base-red text-white border-base-red'
                  : 'bg-base-surface border-base-border text-base-muted hover:text-base-text'
              }`}
            >
              Proyek Overdue ({overdueProjectsList.length})
            </button>
            <button
              type="button"
              onClick={() => setOverdueTab('tasks')}
              className={`px-3.5 py-1.5 text-xs font-condensed font-bold uppercase tracking-wider rounded-lg border transition-colors cursor-pointer ${
                overdueTab === 'tasks'
                  ? 'bg-base-red text-white border-base-red'
                  : 'bg-base-surface border-base-border text-base-muted hover:text-base-text'
              }`}
            >
              Task Overdue ({overdueTasksList.length})
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-5 text-xs text-base-text">
          {activeModal === 'present' && (
            presentPersonnelToday.length === 0 ? (
              <EmptyState label="Belum ada catatan kehadiran untuk hari ini." />
            ) : (
              <div className="border border-base-border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                      <th className="py-2.5 px-4">Nama</th>
                      <th className="py-2.5 px-4">Posisi</th>
                      <th className="py-2.5 px-4">Lokasi</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Work Order</th>
                      <th className="py-2.5 px-4 text-right">Jam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border">
                    {presentPersonnelToday.map((ts) => {
                      const emp = employees.find((e) => e.id === ts.empId);
                      return (
                        <tr key={ts.id} className="hover:bg-base-surface2/50">
                          <td className="py-2.5 px-4 font-semibold">{ts.empName}</td>
                          <td className="py-2.5 px-4 text-base-muted">{emp?.position || ts.position || '—'}</td>
                          <td className="py-2.5 px-4 text-base-muted">{emp?.location || '—'}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-condensed font-bold uppercase ${ts.status === 'late' ? 'bg-base-accent-dim text-base-accent' : 'bg-base-green-dim text-base-green'}`}>
                              {ts.status === 'late' ? 'Terlambat' : 'Hadir'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">{ts.workOrder || '—'}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">{ts.totalHours} Jam</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeModal === 'absent' && (
            absentPersonnelToday.length === 0 ? (
              <EmptyState label="Tidak ada personel absen/izin pada hari ini." />
            ) : (
              <div className="border border-base-border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                      <th className="py-2.5 px-4">Nama</th>
                      <th className="py-2.5 px-4">Posisi</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border">
                    {absentPersonnelToday.map((ts) => {
                      const emp = employees.find((e) => e.id === ts.empId);
                      return (
                        <tr key={ts.id} className="hover:bg-base-surface2/50">
                          <td className="py-2.5 px-4 font-semibold">{ts.empName}</td>
                          <td className="py-2.5 px-4 text-base-muted">{emp?.position || ts.position || '—'}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-condensed font-bold uppercase bg-base-red-dim text-base-red">
                              {ts.status === 'leave' ? 'Izin / Cuti' : 'Absen'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-base-muted">{ts.desc || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeModal === 'man-hours' && (
            scopedTimesheets.length === 0 ? (
              <EmptyState label="Belum ada catatan man-hours pada periode & lokasi terpilih." />
            ) : (
              <div className="border border-base-border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4">Nama</th>
                      <th className="py-2.5 px-4">Work Order</th>
                      <th className="py-2.5 px-4">Assembly</th>
                      <th className="py-2.5 px-4 text-right">Jam</th>
                      <th className="py-2.5 px-4">Aktivitas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border">
                    {scopedTimesheets.slice(0, 100).map((ts) => (
                      <tr key={ts.id} className="hover:bg-base-surface2/50">
                        <td className="py-2.5 px-4 font-mono text-base-muted whitespace-nowrap">{ts.date}</td>
                        <td className="py-2.5 px-4 font-semibold whitespace-nowrap">{ts.empName}</td>
                        <td className="py-2.5 px-4 font-mono">{ts.workOrder || '—'}</td>
                        <td className="py-2.5 px-4 text-base-muted max-w-[160px] truncate">{ts.assemblyName || '—'}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-base-blue tabular-nums">{ts.totalHours} Jam</td>
                        <td className="py-2.5 px-4 text-base-muted max-w-[220px] truncate">{ts.desc || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeModal === 'overdue' && (
            overdueTab === 'projects' ? (
              overdueProjectsList.length === 0 ? (
                <EmptyState label="Tidak ada proyek melewati target selesai." />
              ) : (
                <div className="border border-base-border rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                        <th className="py-2.5 px-4">WO</th>
                        <th className="py-2.5 px-4">Proyek</th>
                        <th className="py-2.5 px-4">Target Selesai</th>
                        <th className="py-2.5 px-4 text-center">Terlambat</th>
                        <th className="py-2.5 px-4 text-center">Progres</th>
                        <th className="py-2.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-border">
                      {overdueProjectsList.map((p) => (
                        <tr key={p.id} className="hover:bg-base-surface2/50">
                          <td className="py-2.5 px-4 font-mono text-base-muted">{p.client || '—'}</td>
                          <td className="py-2.5 px-4 font-semibold">{p.name}</td>
                          <td className="py-2.5 px-4 font-mono text-base-red">{p.due}</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-base-red">
                            {daysDiff(todayStr, p.due || '')} hari
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold">{calcPct(p)}%</td>
                          <td className="py-2.5 px-4 text-right">
                            {openSpotlight && (
                              <button
                                type="button"
                                onClick={() => {
                                  openSpotlight(p.id);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base-red-dim text-base-red hover:bg-base-red hover:text-white font-condensed font-bold uppercase text-[11px] cursor-pointer"
                              >
                                Detail <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : overdueTasksList.length === 0 ? (
              <EmptyState label="Tidak ada task melewati tanggal selesai." />
            ) : (
              <div className="border border-base-border rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-base-surface2 border-b border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                      <th className="py-2.5 px-4">Task</th>
                      <th className="py-2.5 px-4">Proyek · Assembly</th>
                      <th className="py-2.5 px-4">PIC</th>
                      <th className="py-2.5 px-4">Target</th>
                      <th className="py-2.5 px-4 text-center">Progres</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border">
                    {overdueTasksList.map((t) => (
                      <tr key={t.id} className="hover:bg-base-surface2/50">
                        <td className="py-2.5 px-4 font-semibold">{t.taskName}</td>
                        <td className="py-2.5 px-4 text-base-muted">
                          {t.projectName} · {t.assemblyName}
                        </td>
                        <td className="py-2.5 px-4">{t.assigned}</td>
                        <td className="py-2.5 px-4 font-mono text-base-red">{t.finishDate}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold">{t.progress}%</td>
                        <td className="py-2.5 px-4 text-right">
                          {openSpotlight && (
                            <button
                              type="button"
                              onClick={() => {
                                openSpotlight(t.projectId);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base-red-dim text-base-red hover:bg-base-red hover:text-white font-condensed font-bold uppercase text-[11px] cursor-pointer"
                            >
                              Detail <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeModal === 'problem-center' && (
            totalActiveProblems === 0 ? (
              <div className="py-14 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-base-green mx-auto" />
                <div className="font-condensed font-bold text-base">Semua Operasional Normal</div>
                <p className="text-base-muted">Tidak ada masalah terbuka, stok habis, atau keterlambatan proses aktif.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(outOfStockItems.length > 0 || lowStockItems.length > 0) && (
                  <div className="border border-base-border rounded-xl p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-condensed font-bold uppercase tracking-wider text-base-red flex items-center gap-1.5">
                        <Package className="w-4 h-4" /> Stok Habis &amp; Minimum ({outOfStockItems.length + lowStockItems.length})
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const items = [...outOfStockItems, ...lowStockItems].map((m) => ({
                              materialId: m.id,
                              qty: Math.max(1, (m.minStock > 0 ? m.minStock * 2 : 5) - Math.max(0, m.currentStock)),
                            }));
                            onClose();
                            useUIStore.getState().openQuickOrder({ category: 'low_stock', items });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base-accent text-white text-xs font-condensed font-bold uppercase tracking-wider hover:bg-base-accent/90 cursor-pointer whitespace-nowrap"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Order Restock Cepat</span>
                        </button>
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onNavigate('materials');
                            }}
                            className="text-xs font-condensed font-bold uppercase text-base-accent hover:underline cursor-pointer"
                          >
                            Buka Modul Material
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...outOfStockItems, ...lowStockItems].slice(0, 8).map((m) => (
                        <div key={m.id} className="p-2.5 rounded-lg border border-base-border bg-base-surface2 flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{m.name}</div>
                            <div className="text-[11px] text-base-muted">{m.category}</div>
                          </div>
                          <span className={`font-mono font-bold ${m.currentStock === 0 ? 'text-base-red' : 'text-base-accent'}`}>
                            {m.currentStock} {m.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {openProblemReports.length > 0 && (
                  <div className="border border-base-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-condensed font-bold uppercase tracking-wider text-base-accent">
                        Laporan Problem Lapangan Terbuka ({openProblemReports.length})
                      </span>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigate('shopfloor');
                          }}
                          className="text-xs font-condensed font-bold uppercase text-base-accent hover:underline cursor-pointer"
                        >
                          Buka Shop Floor
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {openProblemReports.slice(0, 8).map((pr) => (
                        <div key={pr.id} className="p-2.5 rounded-lg border border-base-border bg-base-surface2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{pr.description}</div>
                            <div className="text-[11px] text-base-muted font-mono">
                              {pr.projectName || 'Umum'} · {pr.category} · PIC: {pr.assignedPosition}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-base-muted shrink-0">{pr.date?.slice(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {punchlistInspections.length > 0 && (
                  <div className="border border-base-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-condensed font-bold uppercase tracking-wider text-base-red">
                        Inspeksi QC Punchlist / Ditolak ({punchlistInspections.length})
                      </span>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onNavigate('inspections');
                          }}
                          className="text-xs font-condensed font-bold uppercase text-base-accent hover:underline cursor-pointer"
                        >
                          Buka Modul QC
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {overdueProcList.length > 0 && (
                  <div className="border border-base-border rounded-xl p-4">
                    <span className="font-condensed font-bold uppercase tracking-wider text-base-muted">
                      Proses Material Stagnan &gt; 7 Hari: <strong className="text-base-text">{overdueProcList.length} item</strong>
                    </span>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-14 text-center space-y-2">
      <AlertCircle className="w-8 h-8 text-base-muted mx-auto" />
      <p className="text-xs text-base-muted">{label}</p>
    </div>
  );
}

interface EditBacModalProps {
  project: Project | null;
  bomTemplates?: BomTemplate[];
  materials?: MaterialItem[];
  employees?: Employee[];
  currency: CurrencyCode;
  exchangeRates: ExchangeRates;
  onClose: () => void;
  onSave: (updated: Project) => void;
}

export const EditBacModal: React.FC<EditBacModalProps> = ({
  project,
  bomTemplates = [],
  materials = [],
  employees = [],
  currency,
  exchangeRates,
  onClose,
  onSave,
}) => {
  const [budgetCostDisplay, setBudgetCostDisplay] = useState('');
  const [budgetHoursInput, setBudgetHoursInput] = useState('');
  const [budgetMaterialDisplay, setBudgetMaterialDisplay] = useState('');
  const [budgetLaborDisplay, setBudgetLaborDisplay] = useState('');
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [multiplierInput, setMultiplierInput] = useState<string>('1');
  const [hourlyRateInput, setHourlyRateInput] = useState<string>('');

  const defaultAvgRate = useMemo(() => getPortfolioAvgHourlyRate(employees), [employees]);

  useEffect(() => {
    if (project) {
      const converted = project.budgetCost
        ? Math.round(convertFromIDR(project.budgetCost, currency, exchangeRates))
        : '';
      setBudgetCostDisplay(converted === '' ? '' : String(converted));
      setBudgetHoursInput(project.budgetHours ? String(project.budgetHours) : '');

      const convMat = project.budgetMaterialCost
        ? Math.round(convertFromIDR(project.budgetMaterialCost, currency, exchangeRates))
        : '';
      const convLab = project.budgetLaborCost
        ? Math.round(convertFromIDR(project.budgetLaborCost, currency, exchangeRates))
        : '';
      setBudgetMaterialDisplay(convMat === '' ? '' : String(convMat));
      setBudgetLaborDisplay(convLab === '' ? '' : String(convLab));

      const matched = findMatchingBomTemplate(project, bomTemplates);
      setSelectedBomId(matched.bom?.id || '');
      setMultiplierInput(String(project.bomMultiplier || 1));
      setHourlyRateInput(String(defaultAvgRate));
    }
  }, [project, bomTemplates, currency, exchangeRates, defaultAvgRate]);

  const parsedHours = parseFloat(budgetHoursInput);
  const parsedMult = parseFloat(multiplierInput);
  const parsedRate = parseFloat(hourlyRateInput);

  const liveEstimate = useMemo(() => {
    if (!project) return null;
    return estimateProjectBacFromBom(project, bomTemplates, materials, employees, {
      bomTemplateId: selectedBomId || null,
      multiplier: !isNaN(parsedMult) && parsedMult > 0 ? parsedMult : 1,
      budgetHours: !isNaN(parsedHours) && parsedHours >= 0 ? parsedHours : undefined,
      hourlyRate: !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : defaultAvgRate,
    });
  }, [project, bomTemplates, materials, employees, selectedBomId, parsedMult, parsedHours, parsedRate, defaultAvgRate]);

  if (!project) return null;

  const handleApplyRecommendation = () => {
    if (!liveEstimate) return;
    const convTotal = Math.round(convertFromIDR(liveEstimate.recommendedBac, currency, exchangeRates));
    const convMat = Math.round(convertFromIDR(liveEstimate.estimatedMaterialCost, currency, exchangeRates));
    const convLab = Math.round(convertFromIDR(liveEstimate.estimatedLaborCost, currency, exchangeRates));
    setBudgetCostDisplay(String(convTotal));
    setBudgetMaterialDisplay(String(convMat));
    setBudgetLaborDisplay(String(convLab));
    if (!budgetHoursInput && liveEstimate.targetBudgetHours > 0) {
      setBudgetHoursInput(String(liveEstimate.targetBudgetHours));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCostNum = parseFloat(budgetCostDisplay);
    const budgetCostIdr =
      !isNaN(rawCostNum) && rawCostNum > 0
        ? Math.round(convertToIDR(rawCostNum, currency, exchangeRates))
        : undefined;

    const rawMatNum = parseFloat(budgetMaterialDisplay);
    const budgetMaterialIdr =
      !isNaN(rawMatNum) && rawMatNum > 0
        ? Math.round(convertToIDR(rawMatNum, currency, exchangeRates))
        : undefined;

    const rawLabNum = parseFloat(budgetLaborDisplay);
    const budgetLaborIdr =
      !isNaN(rawLabNum) && rawLabNum > 0
        ? Math.round(convertToIDR(rawLabNum, currency, exchangeRates))
        : undefined;

    const hoursNum = parseFloat(budgetHoursInput);
    const budgetHoursVal = !isNaN(hoursNum) && hoursNum > 0 ? hoursNum : undefined;

    const multVal = !isNaN(parsedMult) && parsedMult > 0 ? parsedMult : undefined;

    onSave({
      ...project,
      budgetCost: budgetCostIdr,
      budgetHours: budgetHoursVal,
      budgetMaterialCost: budgetMaterialIdr,
      budgetLaborCost: budgetLaborIdr,
      bomTemplateId: selectedBomId || undefined,
      bomMultiplier: selectedBomId ? multVal : undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-base-surface border border-base-border rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-base-border bg-base-surface2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-base-accent" />
            <h3 className="font-condensed font-black text-base uppercase tracking-wider text-base-text">
              Atur Anggaran BAC &amp; Estimasi BOM Proyek
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-base-surface3 text-base-muted hover:text-base-text cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          <div className="p-3 rounded-lg bg-base-surface2 border border-base-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm text-base-text">{project.name}</div>
              <div className="text-base-muted font-mono">
                {project.client || '—'} {project.gaNumber ? `· GA: ${project.gaNumber}` : ''}
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-[11px] text-base-muted">BAC Tersimpan</div>
              <div className="font-bold text-base-text">
                {project.budgetCost ? formatCurrency(project.budgetCost, currency, exchangeRates) : 'Belum Ditetapkan'}
              </div>
            </div>
          </div>

          {/* KALKULATOR OTOMATIS BOM + MAN-HOURS */}
          <div className="p-4 rounded-xl border border-base-border bg-base-surface2/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-condensed font-extrabold uppercase tracking-wider text-base-text flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-base-accent" />
                Kalkulator BAC Otomatis (Material BOM + Man-Hours)
              </div>
              {liveEstimate && liveEstimate.recommendedBac > 0 && (
                <button
                  type="button"
                  onClick={handleApplyRecommendation}
                  className="px-3 py-1 rounded-lg bg-base-accent text-white font-condensed font-bold uppercase tracking-wider text-[11px] hover:opacity-90 cursor-pointer whitespace-nowrap"
                >
                  Terapkan Rekomendasi ke Form
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[11px] font-condensed font-bold uppercase text-base-muted">
                  Template BOM
                </label>
                <select
                  value={selectedBomId}
                  onChange={(e) => setSelectedBomId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-base-surface border border-base-border text-base-text focus:outline-none focus:border-base-accent"
                >
                  <option value="">— Tanpa BOM / Manual —</option>
                  {bomTemplates.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.gaNumber ? `(GA: ${b.gaNumber})` : ''} · {b.items?.length || 0} item
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-condensed font-bold uppercase text-base-muted">
                  Multiplier Unit
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={multiplierInput}
                  onChange={(e) => setMultiplierInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-base-surface border border-base-border font-mono text-base-text focus:outline-none focus:border-base-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-condensed font-bold uppercase text-base-muted">
                  Tarif Jam (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={hourlyRateInput}
                  onChange={(e) => setHourlyRateInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-base-surface border border-base-border font-mono text-base-text focus:outline-none focus:border-base-accent"
                />
              </div>
            </div>

            {liveEstimate && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-base-border font-mono tabular-nums">
                <div className="p-2.5 rounded-lg bg-base-surface border border-base-border">
                  <div className="text-[10px] font-sans text-base-muted">Estimasi Material BOM</div>
                  <div className="text-sm font-bold text-base-text mt-0.5">
                    {formatCurrency(liveEstimate.estimatedMaterialCost, currency, exchangeRates)}
                  </div>
                  <div className="text-[10px] font-sans text-base-muted">
                    {liveEstimate.itemCount} item · {liveEstimate.totalWeightKg.toLocaleString('id-ID')} kg
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-base-surface border border-base-border">
                  <div className="text-[10px] font-sans text-base-muted">Estimasi Tenaga Kerja</div>
                  <div className="text-sm font-bold text-base-text mt-0.5">
                    {formatCurrency(liveEstimate.estimatedLaborCost, currency, exchangeRates)}
                  </div>
                  <div className="text-[10px] font-sans text-base-muted">
                    {liveEstimate.targetBudgetHours} Jam × {formatCurrency(liveEstimate.avgHourlyRate, currency, exchangeRates)}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-base-surface border border-base-accent/40">
                  <div className="text-[10px] font-sans text-base-accent font-semibold">Rekomendasi Total BAC</div>
                  <div className="text-sm font-black text-base-accent mt-0.5">
                    {formatCurrency(liveEstimate.recommendedBac, currency, exchangeRates)}
                  </div>
                  <div className="text-[10px] font-sans text-base-muted">
                    {liveEstimate.pricedFromMasterCount}/{liveEstimate.itemCount} harga dari Master
                  </div>
                </div>
              </div>
            )}

            {liveEstimate && liveEstimate.categoryBreakdown.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-base-muted pt-1">
                <span className="inline-flex items-center gap-1 font-semibold text-base-text">
                  <Layers className="w-3 h-3" /> Rincian BOM:
                </span>
                {liveEstimate.categoryBreakdown.map((cat) => (
                  <span key={cat.category} className="font-mono tabular-nums">
                    {cat.label}: <strong className="text-base-text">{formatCurrency(cat.cost, currency, exchangeRates)}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* FORM INPUT NILAI BAC FINAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-condensed font-bold uppercase tracking-wider text-base-muted">
                Target Anggaran Total / BAC ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={budgetCostDisplay}
                onChange={(e) => setBudgetCostDisplay(e.target.value)}
                placeholder="Contoh: 150000000"
                className="w-full px-3 py-2 rounded-lg bg-base-surface2 border border-base-border text-base-text font-mono font-bold focus:outline-none focus:border-base-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-condensed font-bold uppercase tracking-wider text-base-muted">
                Target Anggaran Jam Kerja (Jam)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={budgetHoursInput}
                onChange={(e) => setBudgetHoursInput(e.target.value)}
                placeholder="Contoh: 1200"
                className="w-full px-3 py-2 rounded-lg bg-base-surface2 border border-base-border text-base-text font-mono font-bold focus:outline-none focus:border-base-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-condensed font-bold uppercase tracking-wider text-base-muted">
                Alokasi Anggaran Material ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={budgetMaterialDisplay}
                onChange={(e) => setBudgetMaterialDisplay(e.target.value)}
                placeholder="Opsional"
                className="w-full px-3 py-2 rounded-lg bg-base-surface2 border border-base-border text-base-text font-mono focus:outline-none focus:border-base-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-condensed font-bold uppercase tracking-wider text-base-muted">
                Alokasi Anggaran Tenaga Kerja ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={budgetLaborDisplay}
                onChange={(e) => setBudgetLaborDisplay(e.target.value)}
                placeholder="Opsional"
                className="w-full px-3 py-2 rounded-lg bg-base-surface2 border border-base-border text-base-text font-mono focus:outline-none focus:border-base-accent"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-base-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-base-border text-base-muted hover:text-base-text font-condensed font-bold uppercase tracking-wider cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-base-accent text-white font-condensed font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer"
            >
              Simpan BAC Proyek
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
