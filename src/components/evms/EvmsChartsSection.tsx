import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import { TrendingUp, Crosshair } from 'lucide-react';
import { CurrencyCode, ExchangeRates } from '../../types';
import { EvmsPortfolioSummary, EvmsProjectMetrics } from '../../utils/evmsEngine';
import { formatEvmsDelta, formatEvmsValue, getHealthBadgeStyle } from './evmsFormatters';

interface EvmsChartsSectionProps {
  summary: EvmsPortfolioSummary;
  currency: CurrencyCode;
  exchangeRates: ExchangeRates;
  monthLabel: string;
  openSpotlight?: (projectId: string) => void;
}

export const EvmsChartsSection: React.FC<EvmsChartsSectionProps> = ({
  summary,
  currency,
  exchangeRates,
  monthLabel,
  openSpotlight,
}) => {
  const { unitMode, scurveSeries, evalDayNum, isCurrentSelectedMonth, projects } = summary;

  // Scatter quadrant points (clamp extreme values nicely to keep quadrant balanced)
  const scatterData = useMemo(() => {
    return projects
      .filter((p) => p.pv > 0 || p.ev > 0 || p.ac > 0)
      .map((p) => ({
        projectId: p.projectId,
        name: p.projectName,
        client: p.client,
        spi: Math.min(1.6, Math.max(0.4, p.spi)),
        cpi: Math.min(1.6, Math.max(0.4, p.cpi)),
        rawSpi: p.spi,
        rawCpi: p.cpi,
        bac: p.bac,
        healthStatus: p.healthStatus,
        healthLabel: p.healthLabel,
        fill: getHealthBadgeStyle(p.healthStatus).dotColor,
      }));
  }, [projects]);

  const formatAxisVal = (v: number) => {
    if (unitMode === 'hours') {
      if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
      return `${v}`;
    }
    return formatEvmsValue(v, 'cost', currency, exchangeRates, true);
  };

  const renderSCurveTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0].payload;
    const hasActual = pt.ev !== null && pt.ac !== null;

    return (
      <div className="bg-base-surface border border-base-border rounded-xl p-3.5 shadow-modal text-xs min-w-[220px] space-y-2">
        <div className="flex items-center justify-between gap-3 border-b border-base-border pb-1.5">
          <span className="font-condensed font-bold uppercase tracking-wider text-base-text">
            Hari {pt.day} · {monthLabel}
          </span>
          {pt.dayNum === evalDayNum && (
            <span className="text-[10px] font-condensed font-bold uppercase text-base-accent">
              Evaluasi
            </span>
          )}
        </div>

        <div className="space-y-1 font-mono tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className="text-base-muted font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              PV (Rencana)
            </span>
            <span className="font-bold text-base-text">
              {formatEvmsValue(pt.pv, unitMode, currency, exchangeRates, true)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-base-muted font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              EV (Nilai Hasil)
            </span>
            <span className="font-bold text-base-green">
              {hasActual ? formatEvmsValue(pt.ev, unitMode, currency, exchangeRates, true) : 'Mendatang'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-base-muted font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              AC (Biaya Aktual)
            </span>
            <span className="font-bold text-base-accent">
              {hasActual ? formatEvmsValue(pt.ac, unitMode, currency, exchangeRates, true) : 'Mendatang'}
            </span>
          </div>
        </div>

        {hasActual && (
          <div className="pt-1.5 border-t border-base-border grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
            <div className="flex justify-between">
              <span className="text-base-muted font-sans">SPI:</span>
              <span className={pt.spi >= 1 ? 'text-base-green font-bold' : 'text-base-red font-bold'}>
                {pt.spi.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-muted font-sans">CPI:</span>
              <span className={pt.cpi >= 1 ? 'text-base-green font-bold' : 'text-base-red font-bold'}>
                {pt.cpi.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-base-muted font-sans">SV / CV:</span>
              <span className="text-base-text">
                {formatEvmsDelta(pt.sv, unitMode, currency, exchangeRates, true)} /{' '}
                {formatEvmsDelta(pt.cv, unitMode, currency, exchangeRates, true)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    const style = getHealthBadgeStyle(item.healthStatus);

    return (
      <div className="bg-base-surface border border-base-border rounded-xl p-3 shadow-modal text-xs min-w-[200px] space-y-1.5">
        <div className="font-condensed font-bold text-sm text-base-text truncate max-w-[220px]">
          {item.name}
        </div>
        <div className="text-[11px] font-mono text-base-muted">
          {item.client} · {formatEvmsValue(item.bac, unitMode, currency, exchangeRates, true)}
        </div>
        <div className="pt-1 border-t border-base-border flex items-center justify-between font-mono text-xs tabular-nums">
          <span>SPI: <strong>{item.rawSpi.toFixed(2)}</strong></span>
          <span>CPI: <strong>{item.rawCpi.toFixed(2)}</strong></span>
        </div>
        <div className={`text-[11px] font-condensed font-bold uppercase ${style.textClass}`}>
          Status: {item.healthLabel} · Klik titik untuk Spotlight
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {/* Left 7 Cols: 3-Line EVMS S-Curve */}
      <div className="xl:col-span-7 bg-base-surface border border-base-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-base-accent" />
              Kurva-S EVMS (PV vs EV vs AC)
            </h3>
            <p className="text-xs text-base-muted">
              Akumulasi nilai rencana, hasil pekerjaan, dan biaya aktual · {monthLabel}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-base-muted shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-500 inline-block" />
              PV Rencana
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
              EV Hasil
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-500 inline-block" />
              AC Aktual
            </span>
          </div>
        </div>

        <div className="h-[290px] w-full">
          {summary.projectCount === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-base-muted border border-dashed border-base-border rounded-lg">
              Tidak ada proyek aktif pada periode &amp; lokasi yang dipilih.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scurveSeries} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisVal}
                  width={68}
                />
                <Tooltip content={renderSCurveTooltip} />

                {evalDayNum > 0 && (
                  <ReferenceLine
                    x={`${evalDayNum}`}
                    stroke="var(--accent)"
                    strokeDasharray="4 4"
                    label={{
                      value: isCurrentSelectedMonth ? 'Hari Ini' : `H-${evalDayNum}`,
                      position: 'top',
                      fill: 'var(--accent)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="pv"
                  name="PV (Rencana)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ev"
                  name="EV (Nilai Hasil)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="ac"
                  name="AC (Biaya Aktual)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Right 5 Cols: Portfolio Quadrant (CPI vs SPI) */}
      <div className="xl:col-span-5 bg-base-surface border border-base-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-base-accent" />
              Kuadran Kinerja Portofolio
            </h3>
            <p className="text-xs text-base-muted">
              Sumbu X: SPI (Jadwal) · Sumbu Y: CPI (Biaya)
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-base-muted shrink-0">
            {scatterData.length} proyek
          </div>
        </div>

        <div className="relative h-[240px] w-full">
          {/* Quadrant Corner Labels */}
          <div className="pointer-events-none absolute inset-x-10 top-1 flex justify-between text-[10px] font-condensed font-bold uppercase tracking-wider opacity-75">
            <span className="text-base-accent">Hemat · Terlambat</span>
            <span className="text-base-green">Optimal (Hemat · Cepat)</span>
          </div>
          <div className="pointer-events-none absolute inset-x-10 bottom-7 flex justify-between text-[10px] font-condensed font-bold uppercase tracking-wider opacity-75">
            <span className="text-base-red">Kritis (Boros · Terlambat)</span>
            <span className="text-base-blue">Boros · Cepat</span>
          </div>

          {scatterData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-base-muted border border-dashed border-base-border rounded-lg">
              Belum ada proyek dengan metrik EVMS aktif.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 22, right: 16, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="spi"
                  name="SPI"
                  domain={[0.4, 1.6]}
                  ticks={[0.5, 0.75, 1.0, 1.25, 1.5]}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="cpi"
                  name="CPI"
                  domain={[0.4, 1.6]}
                  ticks={[0.5, 0.75, 1.0, 1.25, 1.5]}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  width={40}
                />
                <ZAxis type="number" dataKey="bac" range={[70, 260]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={renderScatterTooltip} />
                <ReferenceLine x={1} stroke="var(--border2)" strokeWidth={1.5} strokeDasharray="4 4" />
                <ReferenceLine y={1} stroke="var(--border2)" strokeWidth={1.5} strokeDasharray="4 4" />
                <Scatter
                  data={scatterData}
                  onClick={(node: any) => {
                    if (node?.projectId && openSpotlight) {
                      openSpotlight(node.projectId);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {scatterData.map((entry) => (
                    <Cell key={entry.projectId} fill={entry.fill} fillOpacity={0.88} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Concise Quadrant Distribution Summary */}
        <div className="pt-2 border-t border-base-border grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
          <div>
            <div className="font-mono font-bold text-base-green">{summary.healthCounts.optimal}</div>
            <div className="text-[11px] text-base-muted">Optimal</div>
          </div>
          <div>
            <div className="font-mono font-bold text-base-accent">{summary.healthCounts.efficient_behind}</div>
            <div className="text-[11px] text-base-muted">Terlambat</div>
          </div>
          <div>
            <div className="font-mono font-bold text-base-blue">{summary.healthCounts.overbudget_ahead}</div>
            <div className="text-[11px] text-base-muted">Boros</div>
          </div>
          <div>
            <div className="font-mono font-bold text-base-red">{summary.healthCounts.critical}</div>
            <div className="text-[11px] text-base-muted">Kritis</div>
          </div>
        </div>
      </div>
    </div>
  );
};
