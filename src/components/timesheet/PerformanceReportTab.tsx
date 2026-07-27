import React from 'react';
import { Project } from '../../types';
import { fmtHrs } from '../../utils/projectUtils';
import { 
  ClipboardList, 
  Users, 
  AlertTriangle, 
  Download, 
  Printer 
} from 'lucide-react';

export interface PerformanceReportTabProps {
  reportRangeType: 'monthly' | 'weekly' | 'custom';
  setReportRangeType: (type: 'monthly' | 'weekly' | 'custom') => void;
  repMonth: number;
  setRepMonth: (m: number) => void;
  repYear: number;
  setRepYear: (y: number) => void;
  repWeekAnchor: string;
  setRepWeekAnchor: (d: string) => void;
  repCustomStart: string;
  setRepCustomStart: (d: string) => void;
  repCustomEnd: string;
  setRepCustomEnd: (d: string) => void;
  MONTHS_LIST: { value: number; label: string }[];
  yearsArray: number[];
  activePeriod: { startStr: string; endStr: string; label: string };
  rangeTotalHours: number;
  healthyProjectsCount: number;
  warningProjectsCount: number;
  dangerProjectsCount: number;
  reportProjectsData: {
    project: Project;
    budget: number;
    periodHrs: number;
    cumulativeHrs: number;
    variance: number;
    utilizationRate: number;
    statusGroup: 'healthy' | 'warning' | 'danger' | 'nobudget';
    crewNames: string[];
  }[];
  downloadExcelSheet: () => void;
  handlePrintPDF: () => void;
  openSpotlight?: (pid: string) => void;
}

export const PerformanceReportTab: React.FC<PerformanceReportTabProps> = ({
  reportRangeType,
  setReportRangeType,
  repMonth,
  setRepMonth,
  repYear,
  setRepYear,
  repWeekAnchor,
  setRepWeekAnchor,
  repCustomStart,
  setRepCustomStart,
  repCustomEnd,
  setRepCustomEnd,
  MONTHS_LIST,
  yearsArray,
  activePeriod,
  rangeTotalHours,
  healthyProjectsCount,
  warningProjectsCount,
  dangerProjectsCount,
  reportProjectsData,
  downloadExcelSheet,
  handlePrintPDF,
  openSpotlight
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* SEARCH & CONTROLS HEADER */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Type Switcher */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1">
            <button
              onClick={() => setReportRangeType('monthly')}
              className={`px-3 py-1.5 rounded-md font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                reportRangeType === 'monthly'
                  ? 'bg-base-accent text-white shadow-sm'
                  : 'text-base-muted hover:text-base-text'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setReportRangeType('weekly')}
              className={`px-3 py-1.5 rounded-md font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                reportRangeType === 'weekly'
                  ? 'bg-base-accent text-white shadow-sm'
                  : 'text-base-muted hover:text-base-text'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setReportRangeType('custom')}
              className={`px-3 py-1.5 rounded-md font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                reportRangeType === 'custom'
                  ? 'bg-base-accent text-white shadow-sm'
                  : 'text-base-muted hover:text-base-text'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Dynamic Period Dropdowns */}
          {reportRangeType === 'monthly' && (
            <div className="flex items-center gap-1.5 bg-base-surface2 border border-base-border rounded-lg p-1 text-xs font-bold font-condensed">
              <select
                id="month-select"
                value={repMonth}
                onChange={(e) => setRepMonth(parseInt(e.target.value, 10))}
                className="bg-transparent text-base-text py-1 px-2 w-[58px] cursor-pointer outline-none rounded hover:bg-base-surface3 transition-colors uppercase text-center font-bold"
              >
                {MONTHS_LIST.map(m => (
                  <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>
              <span className="text-base-muted/40">/</span>
              <select
                value={repYear}
                onChange={(e) => setRepYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-base-text py-1 px-2 cursor-pointer outline-none rounded hover:bg-base-surface3 transition-colors text-center font-bold"
              >
                {yearsArray.map(y => (
                  <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportRangeType === 'weekly' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wide">Base Week Date:</span>
              <input
                type="date"
                value={repWeekAnchor}
                onChange={(e) => setRepWeekAnchor(e.target.value)}
                className="px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs font-bold font-mono outline-none text-base-text"
              />
            </div>
          )}

          {reportRangeType === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={repCustomStart}
                onChange={(e) => setRepCustomStart(e.target.value)}
                className="px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs font-bold font-mono outline-none text-base-text"
              />
              <span className="text-xs text-base-muted uppercase font-condensed font-bold">to</span>
              <input
                type="date"
                value={repCustomEnd}
                onChange={(e) => setRepCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 bg-base-surface2 border border-base-border rounded-lg text-xs font-bold font-mono outline-none text-base-text"
              />
            </div>
          )}
        </div>

        {/* Print and Excel Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto">
          <button
            onClick={downloadExcelSheet}
            className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel (CSV)</span>
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex-1 md:flex-none px-4 py-2 border border-base-accent/30 bg-base-accent-dim/10 hover:bg-base-accent text-base-accent hover:text-white font-condensed font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF Report</span>
          </button>
        </div>
      </div>

      {/* PERIOD HEADER DESCRIPTION */}
      <div className="bg-base-accent-dim/10 border border-base-accent/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-[10px] tracking-widest font-condensed font-black uppercase text-base-accent">ACTIVE PERMANENT TIME PERIOD</div>
          <h3 className="text-lg font-condensed font-black text-base-text mt-0.5 tracking-wide">{activePeriod.label}</h3>
          <p className="text-xs text-base-muted mt-1 leading-normal font-medium">
            Showing all projects with labor entries tracked between <span className="font-mono text-base-text font-bold bg-base-surface3 px-1.5 py-0.2 rounded">{activePeriod.startStr}</span> and <span className="font-mono text-base-text font-bold bg-base-surface3 px-1.5 py-0.2 rounded">{activePeriod.endStr}</span>.
          </p>
        </div>
        
        <div className="bg-base-surface border border-base-border/50 rounded-lg px-4 py-2 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-base-accent animate-pulse" />
          <div className="text-right">
            <div className="text-[10px] text-base-muted uppercase font-condensed font-bold">TOTAL PERIOD WORK</div>
            <div className="text-sm font-condensed font-extrabold text-base-text">{fmtHrs(rangeTotalHours)}h logged</div>
          </div>
        </div>
      </div>

      {/* DYNAMIC BENTO METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
          <div className="text-2xl font-condensed font-black text-base-accent">{fmtHrs(rangeTotalHours)}h</div>
          <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1">Sum actual hours</div>
        </div>
        
        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
          <div className="text-2xl font-condensed font-black text-base-bold text-base-green">{healthyProjectsCount}</div>
          <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1">Healthy projects</div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card">
          <div className="text-2xl font-condensed font-black text-yellow-600 dark:text-yellow-400">{warningProjectsCount}</div>
          <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1">Near budget warnings (&gt;85%)</div>
        </div>

        <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card border-b-2 border-b-base-red">
          <div className="text-2xl font-condensed font-black text-base-red">{dangerProjectsCount}</div>
          <div className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mt-1 font-bold">OVER BUDGET PROJECTS</div>
        </div>
      </div>

      {/* CORE PERFORMANCE METRIC DATA GRID */}
      <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-base-border bg-base-surface2 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-base-accent" />
          <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Project Performance Sheet</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-base-surface2/40 text-left text-[10px] font-condensed font-bold uppercase tracking-wider border-b border-base-border/70 text-base-muted">
                <th className="py-3 px-4 font-condensed tracking-wider">Work Order</th>
                <th className="py-3 px-3 font-condensed tracking-wider">Project Description</th>
                <th className="py-3 px-3 font-condensed tracking-wider">Budget Hours</th>
                <th className="py-3 px-3 font-condensed tracking-wider text-base-blue">Period Hours</th>
                <th className="py-3 px-3 font-condensed tracking-wider">All-Time Cumulative</th>
                <th className="py-3 px-3 font-condensed tracking-wider">Remaining Variance</th>
                <th className="py-3 px-3 font-condensed tracking-wider">Utilization</th>
                <th className="py-3 px-3 font-condensed tracking-wider">Health Status</th>
                <th className="py-3 px-4 font-condensed tracking-wider">Active Crew (Period)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border/30 text-xs">
              {reportProjectsData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-base-muted">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 text-base-border/60 mb-2" />
                      <p className="font-semibold text-sm">No project timesheet entries identified in this time period.</p>
                      <p className="text-xs text-base-muted2 mt-1">Please select another date range or log hours into daily logs.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                reportProjectsData.map(d => {
                  const proj = d.project;
                  
                  // Status styling classes
                  let badgeStyle = 'bg-base-surface3 text-base-muted border border-base-border';
                  let labelText = 'No Budget';
                  if (d.statusGroup === 'healthy') {
                    badgeStyle = 'bg-base-green-dim text-base-green border border-base-green/20';
                    labelText = 'On Track';
                  } else if (d.statusGroup === 'warning') {
                    badgeStyle = 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20';
                    labelText = 'Near Budget';
                  } else if (d.statusGroup === 'danger') {
                    badgeStyle = 'bg-base-red-dim text-base-red border border-base-red/20';
                    labelText = 'Budget Exceeded';
                  }

                  return (
                    <tr key={proj.id} className="hover:bg-base-surface2/20 transition-colors">
                      <td className="py-3.5 px-4 font-condensed font-black text-sm text-base-blue uppercase">
                        {proj.client || '—'}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-base-text hover:text-base-accent hover:underline cursor-pointer transition-all" onClick={() => openSpotlight?.(proj.id)}>
                          {proj.name}
                        </div>
                        <div className="text-[9px] uppercase font-condensed font-bold text-base-muted2 tracking-wider mt-0.5">
                          {proj.location === 'workshop1' ? 'Workshop 1 Batam' : 'Workshop 2 Batam'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-base-text">
                        {d.budget > 0 ? `${fmtHrs(d.budget)}h` : '—'}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-base-blue">
                        {fmtHrs(d.periodHrs)}h
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-base-text">
                        {fmtHrs(d.cumulativeHrs)}h
                      </td>
                      <td className="py-3.5 px-3">
                        {d.budget > 0 ? (
                          <span className={`font-mono font-bold ${d.variance < 0 ? 'text-base-red' : 'text-base-green'}`}>
                            {d.variance < 0 ? '-' : ''}{fmtHrs(Math.abs(d.variance))}h
                          </span>
                        ) : (
                          <span className="text-base-muted2">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {d.budget > 0 ? (
                          <div className="space-y-1 w-20">
                            <div className="text-[10px] font-bold text-base-text">{d.utilizationRate.toFixed(1)}%</div>
                            <div className="h-1.5 bg-base-border/20 rounded-full overflow-hidden w-20">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  d.statusGroup === 'danger' 
                                    ? 'bg-base-red' 
                                    : d.statusGroup === 'warning' 
                                      ? 'bg-yellow-500' 
                                      : 'bg-base-green'
                                }`} 
                                style={{ width: `${Math.min(100, d.utilizationRate)}%` }} 
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-base-muted2">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded font-condensed font-black text-[9px] uppercase tracking-wider ${badgeStyle}`}>
                          {labelText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {d.crewNames.length === 0 ? (
                          <span className="text-base-muted2 italic">No labor entries</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {d.crewNames.map(name => (
                              <span key={name} className="px-1.5 py-0.5 rounded bg-base-surface3 border border-base-border text-[9px] text-base-muted font-bold font-sans">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-base-surface2/30 px-4 py-3.5 border-t border-base-border text-[11px] text-base-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
            <span>
              <strong>Performance Notice:</strong> Variance is computed relative to all-time cumulative man-hours submitted to general databases.
            </span>
          </div>
          <span className="italic font-bold">Total analyzed items count: {reportProjectsData.length}</span>
        </div>
      </div>

    </div>
  );
};
