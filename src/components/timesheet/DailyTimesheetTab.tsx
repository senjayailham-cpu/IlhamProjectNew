import React from 'react';
import { TimesheetEntry, Employee, Project } from '../../types';
import { fmtHrs } from '../../utils/projectUtils';
import { 
  Clock, 
  Calendar, 
  ClipboardList, 
  Trash2, 
  Edit, 
  ExternalLink,
  Search,
  X,
  Filter
} from 'lucide-react';

const STATUS_PILLS = {
  present: 'bg-base-green-dim text-base-green border border-base-green/20',
  late: 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
  absent: 'bg-base-red-dim text-base-red border border-base-red/20',
  leave: 'bg-base-blue-dim text-base-blue border border-base-blue/20'
};

export interface DailyTimesheetTabProps {
  timesheets: TimesheetEntry[];
  employees: Employee[];
  projects: Project[];
  timesheetDate: string;
  curDay: number;
  curMonth: number;
  curYear: number;
  daysArray: number[];
  MONTHS_LIST: { value: number; label: string }[];
  yearsArray: number[];
  dayEntries: TimesheetEntry[];
  unfilteredDayEntriesCount: number;
  counts: { present: number; late: number; absent: number; leave: number };
  totalHrsToday: number;
  sortedWOs: [string, { hrs: number; list: Set<string> }][];
  coordNames: string[];
  coordGroups: Record<string, TimesheetEntry[]>;
  tsGroupCollapsed: Record<string, boolean>;
  shiftDate: (d: number) => void;
  handleDayChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleMonthChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleYearChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  jumpToday: () => void;
  exportTimesheetDaily: () => void;
  openAddTimesheet: () => void;
  openEditTimesheet: (id: string) => void;
  deleteTsEntry: (id: string) => void;
  toggleGroup: (coord: string) => void;
  openSpotlight?: (pid: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  projectFilter: string;
  setProjectFilter: (filter: string) => void;
  employeeFilter: string;
  setEmployeeFilter: (filter: string) => void;
}

export const DailyTimesheetTab: React.FC<DailyTimesheetTabProps> = ({
  employees,
  projects,
  timesheetDate,
  curDay,
  curMonth,
  curYear,
  daysArray,
  MONTHS_LIST,
  yearsArray,
  dayEntries,
  unfilteredDayEntriesCount,
  counts,
  totalHrsToday,
  sortedWOs,
  coordNames,
  coordGroups,
  tsGroupCollapsed,
  shiftDate,
  handleDayChange,
  handleMonthChange,
  handleYearChange,
  jumpToday,
  exportTimesheetDaily,
  openAddTimesheet,
  openEditTimesheet,
  deleteTsEntry,
  toggleGroup,
  openSpotlight,
  searchQuery,
  setSearchQuery,
  projectFilter,
  setProjectFilter,
  employeeFilter,
  setEmployeeFilter
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
            Daily <span className="text-base-accent">Timesheets</span>
          </h2>

          {/* Date Picker Switcher */}
          <div className="flex items-center bg-base-surface2 border border-base-border rounded-lg p-1 gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
              title="Previous Day"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="flex items-center gap-0.5 font-condensed font-bold text-xs">
              {/* Day Dropdown */}
              <select
                value={curDay}
                onChange={handleDayChange}
                className="bg-transparent text-base-text py-0.5 px-1 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center"
              >
                {daysArray.map(d => (
                  <option key={d} value={d} className="bg-base-surface2 text-base-text font-sans">
                    {String(d).padStart(2, '0')}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Month Dropdown */}
              <select
                value={curMonth}
                onChange={handleMonthChange}
                className="bg-transparent text-base-text py-0.5 px-1 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors uppercase text-center"
              >
                {MONTHS_LIST.map(m => (
                  <option key={m.value} value={m.value} className="bg-base-surface2 text-base-text font-sans">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>

              <span className="text-base-muted/40">/</span>

              {/* Year Dropdown */}
              <select
                value={curYear}
                onChange={handleYearChange}
                className="bg-transparent text-base-text py-0.5 px-0.5 cursor-pointer outline-none hover:bg-base-surface3 rounded transition-colors text-center"
              >
                {yearsArray.map(y => (
                  <option key={y} value={y} className="bg-base-surface2 text-base-text font-sans">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="p-1 rounded hover:bg-base-surface3 transition-colors text-base-muted"
              title="Next Day"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button
            onClick={jumpToday}
            className="px-2.5 py-1.5 border border-base-accent/25 hover:bg-base-accent-dim text-base-accent rounded-lg font-condensed font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Global Action Handlers */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportTimesheetDaily}
            className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
          >
            <ClipboardList className="h-4 w-4 text-base-blue animate-pulse" />
            <span>Export Daily</span>
          </button>
          <button
            onClick={openAddTimesheet}
            className="btn btn-accent btn-sm flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            <Clock className="h-4 w-4" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-base-surface border border-base-border rounded-xl p-4 shadow-card space-y-3 animate-fade-in">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-muted" />
            <input
              type="text"
              placeholder="Search employee name, work order, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text placeholder:text-base-muted focus:outline-none focus:border-base-accent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-base-surface3 text-base-muted transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Project Filter Dropdown */}
          <div className="relative min-w-[200px]">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text appearance-none focus:outline-none focus:border-base-accent transition-all cursor-pointer font-sans"
            >
              <option value="">All Projects / Work Orders</option>
              {projects.map(p => (
                <option key={p.id} value={p.client || ''}>
                  {p.client ? `[${p.client}] ` : ''}{p.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-2.5 pointer-events-none text-base-muted">
              <Filter className="h-4 w-4" />
            </div>
          </div>

          {/* Employee Filter Dropdown */}
          <div className="relative min-w-[200px]">
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-base-surface2 border border-base-border rounded-lg text-xs text-base-text appearance-none focus:outline-none focus:border-base-accent transition-all cursor-pointer font-sans"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.position || 'Crew'})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-2.5 pointer-events-none text-base-muted">
              <Filter className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Active Filters / Reset Indicator */}
        {(searchQuery || projectFilter || employeeFilter) && (
          <div className="flex items-center justify-between border-t border-base-border/50 pt-2 text-xs">
            <div className="text-base-muted flex items-center gap-1.5">
              <span>Showing <strong>{dayEntries.length}</strong> of <strong>{unfilteredDayEntriesCount}</strong> entries</span>
              <span className="h-1 w-1 rounded-full bg-base-muted/40"></span>
              <span className="text-[10px] bg-base-accent/10 text-base-accent font-semibold px-1.5 py-0.5 rounded">Filter active</span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setProjectFilter('');
                setEmployeeFilter('');
              }}
              className="text-[11px] font-bold text-base-red hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Dashboard widget cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 animate-fade-in">
        <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-border">
          <div className="text-[26px] font-condensed font-extrabold text-base-text leading-none">{dayEntries.length}</div>
          <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Total entries</div>
        </div>
        <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-accent">
          <div className="text-[26px] font-condensed font-extrabold text-base-accent leading-none">{fmtHrs(totalHrsToday)}h</div>
          <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Man-hours today</div>
        </div>
        <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-green">
          <div className="text-[26px] font-condensed font-extrabold text-base-green leading-none">{counts.present + counts.late}</div>
          <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Present/Late</div>
        </div>
        <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-red">
          <div className="text-[26px] font-condensed font-extrabold text-base-red leading-none">{counts.absent}</div>
          <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Absent</div>
        </div>
        <div className="bg-base-surface border border-base-border rounded-xl p-4 text-center shadow-card border-b-2 border-b-base-blue">
          <div className="text-[26px] font-condensed font-extrabold text-base-blue leading-none">{counts.leave}</div>
          <div className="text-[9px] font-condensed font-bold text-base-muted uppercase tracking-wider mt-2">Leave</div>
        </div>
      </div>

      {/* Cumulative Work order statistics */}
      {sortedWOs.length > 0 && (
        <div className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden animate-fade-in">
          <div className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-base-accent" />
            <h3 className="font-condensed font-extrabold uppercase text-xs tracking-wider text-base-text">Project Hours (All Time)</h3>
          </div>
          <div className="divide-y divide-base-border/50">
            {sortedWOs.map(([wo, info]) => {
              const proj = projects.find(x => (x.client || '').trim().toLowerCase() === (wo || '').trim().toLowerCase());
              return (
                <div
                  key={wo}
                  onClick={() => proj && openSpotlight?.(proj.id)}
                  className={`flex px-4 py-3 items-center justify-between gap-4 text-xs group transition-all duration-150 ${
                    proj ? 'hover:bg-base-surface2/60 cursor-pointer' : ''
                  }`}
                  title={proj ? `Click to view project: ${proj.name}` : undefined}
                >
                  <div className="font-condensed font-extrabold text-sm text-base-blue flex-shrink-0 min-w-[100px] uppercase tracking-wide flex items-center gap-1.5">
                    <span>{wo}</span>
                    {proj && (
                      <ExternalLink className="h-3 w-3 text-base-blue opacity-50 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div className="flex-1 font-medium text-base-muted2 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-base-text transition-colors">
                    {proj ? proj.name : 'Unassociated work order scope'}
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-[10px] text-base-muted">{info.list.size} manpower</span>
                    <span className="font-condensed font-extrabold text-base text-base-accent bg-base-accent-dim/20 px-2 py-0.5 rounded-sm">
                      {fmtHrs(info.hrs)}h
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main timesheet groups by Coordinator */}
      <div className="space-y-4 animate-fade-in">
        {dayEntries.length === 0 ? (
          <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
            <Calendar className="h-10 w-10 text-base-border/80 mb-3" />
            <p className="text-sm font-semibold">No timesheet records submitted for this date.</p>
            <button
              onClick={openAddTimesheet}
              className="mt-4 px-4 py-2 bg-base-accent text-white hover:bg-base-accent2 rounded-lg font-condensed font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Log hours now
            </button>
          </div>
        ) : (
          coordNames.map(coord => {
            const list = coordGroups[coord];
            const isColl = !!tsGroupCollapsed[coord];
            const coordHrs = list.reduce((s, e) => s + (e.totalHours || 0), 0);

            return (
              <div key={coord} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
                {/* Collapsible Coordinator header */}
                <div
                  onClick={() => toggleGroup(coord)}
                  className="px-4 py-3 bg-base-surface2 border-b border-base-border flex items-center justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-base-surface3/40"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 text-base-muted transition-transform ${isColl ? '-rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span className="font-condensed font-extrabold text-sm uppercase tracking-wider text-base-text">{coord}</span>
                    <span className="px-2 py-0.5 text-[10px] bg-base-border/20 rounded font-semibold text-base-muted leading-none">
                      {list.length} log{list.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="font-condensed font-extrabold text-sm text-base-accent">{fmtHrs(coordHrs)}h logged</span>
                </div>

                {/* Timesheets log list */}
                {!isColl && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-base-surface2/30 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border/50">
                          <th className="py-2.5 px-4 font-condensed uppercase tracking-wider">Employee</th>
                          <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Work Order</th>
                          <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Hours</th>
                          <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Description</th>
                          <th className="py-2.5 px-3 font-condensed uppercase tracking-wider">Status</th>
                          <th className="py-2.5 px-4 text-right font-condensed uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/30 text-xs">
                        {list.map(e => {
                          const emp = employees.find(x => x.id === e.empId);
                          return (
                            <tr key={e.id} className="hover:bg-base-surface2/20 transition-colors">
                              <td className="py-3 px-4">
                                <div>
                                  <div className="font-bold text-base-text">{e.empName}</div>
                                  <div className="text-[10px] text-base-muted mt-0.5">{emp?.position || 'Crew'}</div>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                {(() => {
                                  const proj = projects.find(
                                    x => (x.client || '').trim().toLowerCase() === (e.workOrder || '').trim().toLowerCase()
                                  );
                                  return (
                                    <div>
                                      {proj ? (
                                        <button
                                          onClick={() => openSpotlight?.(proj.id)}
                                          className="font-condensed font-extrabold text-sm text-base-blue uppercase tracking-wide hover:underline hover:text-base-accent cursor-pointer flex items-center gap-1 group text-left"
                                          title={`View Project Spotlight: ${proj.name}`}
                                        >
                                          <span>{e.workOrder || '—'}</span>
                                          <ExternalLink className="h-3 w-3 inline text-base-blue opacity-50 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                      ) : (
                                        <div className="font-condensed font-extrabold text-sm text-base-blue uppercase tracking-wide">
                                          {e.workOrder || '—'}
                                        </div>
                                      )}
                                      {e.assemblyName && (
                                        <div className="text-[10px] text-base-muted2 font-medium mt-0.5">{e.assemblyName}</div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-3 px-3 font-condensed font-extrabold text-sm text-base-accent">
                                {fmtHrs(e.totalHours || 0)}h
                              </td>
                              <td className="py-3 px-3 max-w-[200px] truncate text-base-muted2" title={e.desc}>
                                {e.desc || '—'}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2.5 py-0.5 rounded font-condensed font-extrabold text-[10px] uppercase tracking-wider ${STATUS_PILLS[e.status as keyof typeof STATUS_PILLS] || ''}`}>
                                  {e.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => openEditTimesheet(e.id)}
                                  className="p-1 rounded text-base-muted hover:text-base-accent hover:bg-base-surface3 transition-all cursor-pointer inline-flex items-center justify-center mr-1"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteTsEntry(e.id)}
                                  className="p-1 rounded text-base-muted hover:text-base-red hover:bg-base-red/10 transition-all cursor-pointer inline-flex items-center justify-center"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
