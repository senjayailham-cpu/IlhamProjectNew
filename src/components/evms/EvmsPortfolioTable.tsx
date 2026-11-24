import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  ArrowUpDown,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { CurrencyCode, ExchangeRates, Project } from '../../types';
import { EvmsProjectMetrics, EvmsUnitMode } from '../../utils/evmsEngine';
import { formatEvmsDelta, formatEvmsValue, getHealthBadgeStyle } from './evmsFormatters';

interface EvmsPortfolioTableProps {
  projectsMetrics: EvmsProjectMetrics[];
  rawProjects: Project[];
  unitMode: EvmsUnitMode;
  currency: CurrencyCode;
  exchangeRates: ExchangeRates;
  openSpotlight?: (projectId: string) => void;
  onEditBac?: (project: Project) => void;
}

type HealthFilter = 'all' | 'cpi_low' | 'spi_low' | 'optimal' | 'critical';
type SortKey = 'bac' | 'pv' | 'ev' | 'ac' | 'spi' | 'cpi' | 'eac' | 'vac' | 'name';

export const EvmsPortfolioTable: React.FC<EvmsPortfolioTableProps> = ({
  projectsMetrics,
  rawProjects,
  unitMode,
  currency,
  exchangeRates,
  openSpotlight,
  onEditBac,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('bac');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedProjectIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projectsMetrics
      .filter((p) => {
        if (q) {
          const hit =
            p.projectName.toLowerCase().includes(q) ||
            p.client.toLowerCase().includes(q) ||
            p.location.toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (healthFilter === 'cpi_low') return p.cpi < 0.98;
        if (healthFilter === 'spi_low') return p.spi < 0.98;
        if (healthFilter === 'optimal') return p.healthStatus === 'optimal';
        if (healthFilter === 'critical') return p.healthStatus === 'critical';
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === 'name') {
          diff = a.projectName.localeCompare(b.projectName);
        } else {
          diff = (a[sortKey] as number) - (b[sortKey] as number);
        }
        return sortAsc ? diff : -diff;
      });
  }, [projectsMetrics, searchQuery, healthFilter, sortKey, sortAsc]);

  const filterButtons: Array<{ key: HealthFilter; label: string }> = [
    { key: 'all', label: `Semua (${projectsMetrics.length})` },
    { key: 'cpi_low', label: 'CPI < 0.98' },
    { key: 'spi_low', label: 'SPI < 0.98' },
    { key: 'optimal', label: 'Optimal' },
    { key: 'critical', label: 'Kritis' },
  ];

  const SortHeader = ({ label, k, align = 'right' }: { label: string; k: SortKey; align?: 'left' | 'right' | 'center' }) => (
    <th
      onClick={() => handleSort(k)}
      className={`py-2.5 px-3 font-condensed font-bold text-[11px] uppercase tracking-wider text-base-muted cursor-pointer select-none hover:text-base-text transition-colors whitespace-nowrap ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? 'text-base-accent' : 'opacity-40'}`} />
      </span>
    </th>
  );

  return (
    <div className="bg-base-surface border border-base-border rounded-xl overflow-hidden">
      {/* Table Controls Toolbar */}
      <div className="p-4 sm:px-5 border-b border-base-border flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text flex items-center gap-2">
            <Layers className="w-4 h-4 text-base-accent" />
            Matriks Kinerja EVMS per Proyek &amp; Assembly
          </h3>
          <p className="text-xs text-base-muted">
            Klik baris untuk rincian per assembly · Klik ikon pensil untuk mengatur anggaran BAC proyek
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-base-surface2 p-1 rounded-lg border border-base-border overflow-x-auto">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setHealthFilter(btn.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-condensed font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  healthFilter === btn.key
                    ? 'bg-base-surface text-base-text border border-base-border shadow-2xs'
                    : 'text-base-muted hover:text-base-text'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-base-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari proyek atau WO..."
              className="pl-8 pr-3 py-1.5 text-xs bg-base-surface2 border border-base-border rounded-lg text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent w-48"
            />
          </div>
        </div>
      </div>

      {/* High-Density EVMS Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-base-border bg-base-surface2">
              <SortHeader label="Proyek / WO" k="name" align="left" />
              <th className="py-2.5 px-3 font-condensed font-bold text-[11px] uppercase tracking-wider text-base-muted text-center whitespace-nowrap">
                Fisik / Plan
              </th>
              <SortHeader label="BAC" k="bac" />
              <SortHeader label="PV" k="pv" />
              <SortHeader label="EV" k="ev" />
              <SortHeader label="AC" k="ac" />
              <SortHeader label="SPI" k="spi" align="center" />
              <SortHeader label="CPI" k="cpi" align="center" />
              <SortHeader label="EAC" k="eac" />
              <SortHeader label="VAC" k="vac" />
              <th className="py-2.5 px-3 font-condensed font-bold text-[11px] uppercase tracking-wider text-base-muted text-center whitespace-nowrap">
                Status
              </th>
              <th className="py-2.5 px-3 font-condensed font-bold text-[11px] uppercase tracking-wider text-base-muted text-right whitespace-nowrap">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-base-border text-xs text-base-text">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-base-muted">
                  Tidak ada proyek yang sesuai dengan filter EVMS saat ini.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((pm) => {
                const isExpanded = !!expandedProjectIds[pm.projectId];
                const badge = getHealthBadgeStyle(pm.healthStatus);
                const rawProj = rawProjects.find((rp) => rp.id === pm.projectId);

                return (
                  <React.Fragment key={pm.projectId}>
                    <tr
                      onClick={() => pm.assemblies.length > 0 && toggleExpand(pm.projectId)}
                      className={`hover:bg-base-surface2/60 transition-colors ${
                        pm.assemblies.length > 0 ? 'cursor-pointer' : ''
                      }`}
                    >
                      <td className="py-3 px-3 max-w-[230px]">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-base-muted shrink-0 w-4">
                            {pm.assemblies.length > 0 ? (
                              isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )
                            ) : null}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-base-text truncate" title={pm.projectName}>
                              {pm.projectName}
                            </div>
                            <div className="text-[11px] text-base-muted font-mono truncate">
                              {pm.client} · {pm.location === 'workshop1' ? 'WS 1' : pm.location === 'workshop2' ? 'WS 2' : pm.location}
                              {pm.isOverdue ? ' · Lewat Jatuh Tempo' : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                        <span className="font-bold text-base-text">{pm.actualPct}%</span>
                        <span className="text-base-muted"> / {pm.plannedPct}%</span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className="font-semibold"
                          title={formatEvmsValue(pm.bac, unitMode, currency, exchangeRates, false)}
                        >
                          {formatEvmsValue(pm.bac, unitMode, currency, exchangeRates, true)}
                        </span>
                        {pm.isEstimatedBac && (
                          <span className="block text-[10px] font-sans text-base-muted">
                            {pm.bacSource === 'bom_auto' ? 'Estimasi BOM' : 'Estimasi'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-base-muted">
                        {formatEvmsValue(pm.pv, unitMode, currency, exchangeRates, true)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-base-green">
                        {formatEvmsValue(pm.ev, unitMode, currency, exchangeRates, true)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-base-accent">
                        {formatEvmsValue(pm.ac, unitMode, currency, exchangeRates, true)}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold tabular-nums whitespace-nowrap">
                        <span className={pm.spi >= 0.98 ? 'text-base-green' : pm.spi >= 0.85 ? 'text-base-accent' : 'text-base-red'}>
                          {pm.spi.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold tabular-nums whitespace-nowrap">
                        <span className={pm.cpi >= 0.98 ? 'text-base-green' : pm.cpi >= 0.85 ? 'text-base-accent' : 'text-base-red'}>
                          {pm.cpi.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatEvmsValue(pm.eac, unitMode, currency, exchangeRates, true)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                        <span className={pm.vac >= 0 ? 'text-base-green' : 'text-base-red'}>
                          {formatEvmsDelta(pm.vac, unitMode, currency, exchangeRates, true)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-condensed font-bold uppercase tracking-wider ${badge.bgClass} ${badge.textClass}`}
                        >
                          {pm.healthLabel}
                        </span>
                      </td>

                      <td
                        className="py-3 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          {rawProj && onEditBac && (
                            <button
                              type="button"
                              onClick={() => onEditBac(rawProj)}
                              className="p-1.5 rounded-lg border border-base-border hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors cursor-pointer"
                              title="Atur Anggaran BAC Proyek"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {openSpotlight && (
                            <button
                              type="button"
                              onClick={() => openSpotlight(pm.projectId)}
                              className="p-1.5 rounded-lg border border-base-border hover:bg-base-surface3 text-base-muted hover:text-base-accent transition-colors cursor-pointer"
                              title="Buka Detail Proyek (Spotlight)"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Assembly EVMS Breakdown */}
                    {isExpanded && pm.assemblies.length > 0 && (
                      <tr className="bg-base-surface2/50">
                        <td colSpan={12} className="p-0">
                          <div className="px-6 py-3 border-y border-base-border">
                            <div className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-2">
                              Rincian EVMS Assembly ({pm.assemblies.length})
                            </div>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border">
                                  <th className="py-1.5 pr-3">Nama Assembly</th>
                                  <th className="py-1.5 px-2 text-center">Fisik / Plan</th>
                                  <th className="py-1.5 px-2 text-right">BAC</th>
                                  <th className="py-1.5 px-2 text-right">PV</th>
                                  <th className="py-1.5 px-2 text-right">EV</th>
                                  <th className="py-1.5 px-2 text-right">AC</th>
                                  <th className="py-1.5 px-2 text-center">SPI</th>
                                  <th className="py-1.5 px-2 text-center">CPI</th>
                                  <th className="py-1.5 pl-2 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-base-border/60 font-mono tabular-nums">
                                {pm.assemblies.map((asm) => {
                                  const asmBadge = getHealthBadgeStyle(asm.healthStatus);
                                  return (
                                    <tr key={asm.assemblyId}>
                                      <td className="py-2 pr-3 font-sans font-medium text-base-text">
                                        {asm.assemblyName}
                                      </td>
                                      <td className="py-2 px-2 text-center text-base-muted">
                                        {asm.actualPct}% / {asm.plannedPct}%
                                      </td>
                                      <td className="py-2 px-2 text-right">
                                        {formatEvmsValue(asm.bac, unitMode, currency, exchangeRates, true)}
                                      </td>
                                      <td className="py-2 px-2 text-right text-base-muted">
                                        {formatEvmsValue(asm.pv, unitMode, currency, exchangeRates, true)}
                                      </td>
                                      <td className="py-2 px-2 text-right text-base-green">
                                        {formatEvmsValue(asm.ev, unitMode, currency, exchangeRates, true)}
                                      </td>
                                      <td className="py-2 px-2 text-right text-base-accent">
                                        {formatEvmsValue(asm.ac, unitMode, currency, exchangeRates, true)}
                                      </td>
                                      <td className="py-2 px-2 text-center">{asm.spi.toFixed(2)}</td>
                                      <td className="py-2 px-2 text-center">{asm.cpi.toFixed(2)}</td>
                                      <td className="py-2 pl-2 text-right font-sans">
                                        <span className={`text-[11px] font-condensed font-bold uppercase ${asmBadge.textClass}`}>
                                          {asm.healthLabel}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
