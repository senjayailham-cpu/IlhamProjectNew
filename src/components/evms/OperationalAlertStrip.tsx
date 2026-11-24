import React from 'react';
import {
  Users,
  UserX,
  AlertTriangle,
  ClipboardCheck,
  Package,
  Siren,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import { useUIStore } from '../../store';

interface OperationalAlertStripProps {
  presentCount: number;
  totalEmployees: number;
  absentCount: number;
  totalManHours: number;
  openProblemsCount: number;
  pendingInspectionsCount: number;
  criticalMaterialCount: number;
  pendingMrCount: number;
  overdueProjectsCount: number;
  overdueTasksCount: number;
  totalActiveProblems: number;
  onOpenModal: (modal: 'present' | 'absent' | 'man-hours' | 'overdue' | 'problem-center') => void;
  onNavigate?: (tab: string) => void;
}

export const OperationalAlertStrip: React.FC<OperationalAlertStripProps> = ({
  presentCount,
  totalEmployees,
  absentCount,
  totalManHours,
  openProblemsCount,
  pendingInspectionsCount,
  criticalMaterialCount,
  pendingMrCount,
  overdueProjectsCount,
  overdueTasksCount,
  totalActiveProblems,
  onOpenModal,
  onNavigate,
}) => {
  const attendancePct = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;
  const openQuickOrder = useUIStore((s) => s.openQuickOrder);

  return (
    <div className="bg-base-surface border border-base-border rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="font-condensed font-extrabold text-xs uppercase tracking-wider text-base-muted">
          Kesiapan Operasional &amp; Eskalasi Lapangan
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openQuickOrder({ category: criticalMaterialCount > 0 ? 'low_stock' : 'all' })}
            className="inline-flex items-center gap-1.5 text-xs font-condensed font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-base-accent/30 bg-base-accent/10 text-base-accent hover:bg-base-accent hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Order Material</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('problem-center')}
            className={`inline-flex items-center gap-1.5 text-xs font-condensed font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              totalActiveProblems > 0
                ? 'border-base-red/30 bg-base-red-dim text-base-red hover:bg-base-red hover:text-white'
                : 'border-base-border bg-base-surface2 text-base-muted hover:text-base-text'
            }`}
          >
            <Siren className="w-3.5 h-3.5" />
            <span>Pusat Masalah ({totalActiveProblems})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Hadir Hari Ini */}
        <button
          type="button"
          onClick={() => onOpenModal('present')}
          className="text-left p-3 rounded-lg border border-base-border bg-base-surface2/60 hover:bg-base-surface2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
            <span>Hadir Hari Ini</span>
            <Users className="w-3.5 h-3.5 text-base-green shrink-0" />
          </div>
          <div className="font-mono font-bold text-base text-base-text tabular-nums">
            {presentCount}/{totalEmployees}
          </div>
          <div className="text-[11px] text-base-muted tabular-nums">{attendancePct}% kehadiran</div>
        </button>

        {/* Absen / Izin */}
        <button
          type="button"
          onClick={() => onOpenModal('absent')}
          className="text-left p-3 rounded-lg border border-base-border bg-base-surface2/60 hover:bg-base-surface2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
            <span>Absen / Izin</span>
            <UserX className="w-3.5 h-3.5 text-base-muted shrink-0" />
          </div>
          <div className={`font-mono font-bold text-base tabular-nums ${absentCount > 0 ? 'text-base-red' : 'text-base-text'}`}>
            {absentCount} Orang
          </div>
          <div className="text-[11px] text-base-muted">Lihat rincian</div>
        </button>

        {/* Jam Kerja Periode */}
        <button
          type="button"
          onClick={() => onOpenModal('man-hours')}
          className="text-left p-3 rounded-lg border border-base-border bg-base-surface2/60 hover:bg-base-surface2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
            <span>Log Man-Hours</span>
            <Clock className="w-3.5 h-3.5 text-base-blue shrink-0" />
          </div>
          <div className="font-mono font-bold text-base text-base-text tabular-nums">
            {Math.round(totalManHours).toLocaleString('id-ID')} Jam
          </div>
          <div className="text-[11px] text-base-muted">Periode terpilih</div>
        </button>

        {/* Proyek & Task Overdue */}
        <button
          type="button"
          onClick={() => onOpenModal('overdue')}
          className="text-left p-3 rounded-lg border border-base-border bg-base-surface2/60 hover:bg-base-surface2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
            <span>Keterlambatan</span>
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${overdueProjectsCount > 0 ? 'text-base-red' : 'text-base-muted'}`} />
          </div>
          <div className={`font-mono font-bold text-base tabular-nums ${overdueProjectsCount > 0 ? 'text-base-red' : 'text-base-text'}`}>
            {overdueProjectsCount} Proyek
          </div>
          <div className="text-[11px] text-base-muted tabular-nums">{overdueTasksCount} task overdue</div>
        </button>

        {/* Antrean QC / RFI */}
        <button
          type="button"
          onClick={() => onNavigate?.('inspections')}
          className="text-left p-3 rounded-lg border border-base-border bg-base-surface2/60 hover:bg-base-surface2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
            <span>Antrean QC / RFI</span>
            <ClipboardCheck className="w-3.5 h-3.5 text-base-accent shrink-0" />
          </div>
          <div className={`font-mono font-bold text-base tabular-nums ${pendingInspectionsCount > 0 ? 'text-base-accent' : 'text-base-text'}`}>
            {pendingInspectionsCount} Pending
          </div>
          <div className="text-[11px] text-base-muted">
            {openProblemsCount} problem terbuka
          </div>
        </button>

        {/* Material Kritis & MR */}
        <button
          type="button"
          onClick={() => onNavigate?.('materials')}
          className="text-left p-3 rounded-lg border border-base-border bg-base-surface2/60 hover:bg-base-surface2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1">
            <span>Material &amp; MR</span>
            <Package className={`w-3.5 h-3.5 shrink-0 ${criticalMaterialCount > 0 ? 'text-base-red' : 'text-base-muted'}`} />
          </div>
          <div className={`font-mono font-bold text-base tabular-nums ${criticalMaterialCount > 0 ? 'text-base-red' : 'text-base-text'}`}>
            {criticalMaterialCount} Kritis
          </div>
          <div className="text-[11px] text-base-muted tabular-nums">{pendingMrCount} MR menunggu</div>
        </button>
      </div>
    </div>
  );
};
