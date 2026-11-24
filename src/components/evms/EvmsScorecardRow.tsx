import React from 'react';
import { Wallet, CalendarClock, TrendingUp, Target } from 'lucide-react';
import { CurrencyCode, ExchangeRates } from '../../types';
import { EvmsPortfolioSummary } from '../../utils/evmsEngine';
import { formatEvmsDelta, formatEvmsValue, getIndexStatusMeta } from './evmsFormatters';

interface EvmsScorecardRowProps {
  summary: EvmsPortfolioSummary;
  currency: CurrencyCode;
  exchangeRates: ExchangeRates;
}

export const EvmsScorecardRow: React.FC<EvmsScorecardRowProps> = ({
  summary,
  currency,
  exchangeRates,
}) => {
  const { unitMode } = summary;
  const spiMeta = getIndexStatusMeta(summary.spi);
  const cpiMeta = getIndexStatusMeta(summary.cpi);

  const spiTextLabel =
    summary.spi >= 1.02
      ? 'Lebih Cepat'
      : summary.spi >= 0.95
        ? 'Sesuai Jadwal'
        : 'Terlambat';

  const cpiTextLabel =
    summary.cpi >= 1.02
      ? 'Hemat Biaya'
      : summary.cpi >= 0.95
        ? 'Sesuai Anggaran'
        : 'Over Budget';

  const vacStatusLabel = summary.vac >= 0 ? 'Proyeksi Hemat' : 'Proyeksi Defisit';
  const vacPositive = summary.vac >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: BAC (Budget at Completion) */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            Anggaran Total (BAC)
          </span>
          <Wallet className="w-4 h-4 text-base-muted shrink-0" />
        </div>

        <div className="space-y-1">
          <div
            className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-base-text tabular-nums"
            title={formatEvmsValue(summary.totalBac, unitMode, currency, exchangeRates, false)}
          >
            {formatEvmsValue(summary.totalBac, unitMode, currency, exchangeRates, true)}
          </div>
          <div className="text-xs text-base-muted flex items-center gap-1.5 flex-wrap">
            <span>{summary.projectCount} proyek dalam cakupan</span>
            <span>·</span>
            <span>{summary.activeCount} aktif</span>
          </div>
        </div>

        <div className="pt-2.5 border-t border-base-border flex items-center justify-between text-xs text-base-muted tabular-nums">
          <span>Progres Nilai Hasil</span>
          <span className="font-mono font-semibold text-base-text">
            {summary.overallActualPct}% fisik · {summary.overallPlannedPct}% rencana
          </span>
        </div>
      </div>

      {/* Card 2: Schedule Performance (PV vs EV, SV & SPI) */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            Kinerja Jadwal (SPI)
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-condensed font-bold uppercase tracking-wider whitespace-nowrap ${spiMeta.bgClass} ${spiMeta.textClass}`}
          >
            {spiTextLabel}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <div className={`text-2xl sm:text-3xl font-mono font-bold tabular-nums ${spiMeta.textClass}`}>
            {summary.spi.toFixed(2)}
          </div>
          <div className="text-right">
            <div className="text-[11px] text-base-muted">Selisih Jadwal (SV)</div>
            <div
              className={`text-sm font-mono font-bold tabular-nums ${
                summary.sv >= 0 ? 'text-base-green' : 'text-base-red'
              }`}
            >
              {formatEvmsDelta(summary.sv, unitMode, currency, exchangeRates, true)}
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-base-border flex items-center justify-between text-xs tabular-nums">
          <span className="text-base-muted">
            PV: <strong className="font-mono text-base-text">{formatEvmsValue(summary.totalPv, unitMode, currency, exchangeRates, true)}</strong>
          </span>
          <span className="text-base-muted">
            EV: <strong className="font-mono text-base-text">{formatEvmsValue(summary.totalEv, unitMode, currency, exchangeRates, true)}</strong>
          </span>
        </div>
      </div>

      {/* Card 3: Cost Performance (AC vs EV, CV & CPI) */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            Efisiensi Biaya (CPI)
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-condensed font-bold uppercase tracking-wider whitespace-nowrap ${cpiMeta.bgClass} ${cpiMeta.textClass}`}
          >
            {cpiTextLabel}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <div className={`text-2xl sm:text-3xl font-mono font-bold tabular-nums ${cpiMeta.textClass}`}>
            {summary.cpi.toFixed(2)}
          </div>
          <div className="text-right">
            <div className="text-[11px] text-base-muted">Selisih Biaya (CV)</div>
            <div
              className={`text-sm font-mono font-bold tabular-nums ${
                summary.cv >= 0 ? 'text-base-green' : 'text-base-red'
              }`}
            >
              {formatEvmsDelta(summary.cv, unitMode, currency, exchangeRates, true)}
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-base-border flex items-center justify-between text-xs tabular-nums">
          <span className="text-base-muted">
            EV: <strong className="font-mono text-base-text">{formatEvmsValue(summary.totalEv, unitMode, currency, exchangeRates, true)}</strong>
          </span>
          <span className="text-base-muted">
            AC: <strong className="font-mono text-base-text">{formatEvmsValue(summary.totalAc, unitMode, currency, exchangeRates, true)}</strong>
          </span>
        </div>
      </div>

      {/* Card 4: Forecast at Completion (EAC, VAC & TCPI) */}
      <div className="bg-base-surface border border-base-border rounded-xl p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-condensed font-bold uppercase tracking-wider text-base-muted">
            Proyeksi Akhir (EAC)
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-condensed font-bold uppercase tracking-wider whitespace-nowrap ${
              vacPositive ? 'bg-base-green-dim text-base-green' : 'bg-base-red-dim text-base-red'
            }`}
          >
            {vacStatusLabel}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <div
            className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-base-text tabular-nums"
            title={formatEvmsValue(summary.eac, unitMode, currency, exchangeRates, false)}
          >
            {formatEvmsValue(summary.eac, unitMode, currency, exchangeRates, true)}
          </div>
          <div className="text-right">
            <div className="text-[11px] text-base-muted">Varians Akhir (VAC)</div>
            <div
              className={`text-sm font-mono font-bold tabular-nums ${
                vacPositive ? 'text-base-green' : 'text-base-red'
              }`}
            >
              {formatEvmsDelta(summary.vac, unitMode, currency, exchangeRates, true)}
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-base-border flex items-center justify-between text-xs tabular-nums">
          <span className="text-base-muted flex items-center gap-1">
            <Target className="w-3.5 h-3.5" />
            TCPI: <strong className={`font-mono ${summary.tcpi > 1.1 ? 'text-base-red' : 'text-base-text'}`}>{summary.tcpi.toFixed(2)}</strong>
          </span>
          <span className="text-base-muted">
            Sisa ETC: <strong className="font-mono text-base-text">{formatEvmsValue(summary.etc, unitMode, currency, exchangeRates, true)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
