import React, { useState } from 'react';
import { Employee } from '../types';
import { esc } from '../utils/projectUtils';
import { Search, UserPlus, Upload, ShieldCheck, Heart, User, Trash2, Edit, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  openAddEmployee: () => void;
  openEditEmployee: (id: string) => void;
  deleteEmployee: (id: string) => void;
  onImportExcel: (imported: Omit<Employee, 'id'>[]) => void;
}

const COLORS = ['#e8a020', '#4a90d9', '#4caf7d', '#d65c4f', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#3498db'];

function getEmpColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return COLORS[h % COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function EmployeesView({
  employees,
  openAddEmployee,
  openEditEmployee,
  deleteEmployee,
  onImportExcel
}: EmployeesViewProps) {
  const [q, setQ] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (coord: string) => {
    setCollapsedGroups(prev => ({ ...prev, [coord]: !prev[coord] }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value);
  };

  const filtered = q
    ? employees.filter(e => (e.name + (e.position || '') + (e.location || '') + (e.coordinator || '')).toLowerCase().includes(q.toLowerCase()))
    : employees;

  // Group employees by Coordinator
  const coordGroups: Record<string, Employee[]> = {};
  filtered.forEach(e => {
    const c = (e.coordinator || '').trim() || '— No coordinator —';
    if (!coordGroups[c]) {
      coordGroups[c] = [];
    }
    coordGroups[c].push(e);
  });

  const coordNames = Object.keys(coordGroups).sort((a, b) => {
    if (a === '— No coordinator —') return 1;
    if (b === '— No coordinator —') return -1;
    return a.localeCompare(b);
  });

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    coordNames.forEach(c => {
      next[c] = true;
    });
    setCollapsedGroups(next);
  };

  const expandAll = () => {
    setCollapsedGroups({});
  };

  // Lazy-load SheetJS on-demand for spreadsheet uploading
  const triggerExcelUpload = () => {
    const loaderFn = () => {
      const inputEl = document.getElementById('emp-excel-input-file') as HTMLInputElement | null;
      if (inputEl) inputEl.click();
    };

    if ((window as any).XLSX) {
      loaderFn();
      return;
    }

    const s = document.createElement('script');
    s.crossOrigin = 'anonymous';
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    s.onload = loaderFn;
    s.onerror = () => alert('Could not load Excel reader. Please check your internet connection.');
    document.head.appendChild(s);
  };

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        const wb = XLSX.read(dataArr, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) {
          alert('No logs found inside spreadsheet document template.');
          return;
        }

        const norm = (s: any) => s.toString().trim().toLowerCase();
        const findKey = (row: any, ...variants: string[]) => {
          const keys = Object.keys(row);
          for (const v of variants) {
            const f = keys.find(k => norm(k) === norm(v));
            if (f) return f;
          }
          return null;
        };

        const first = rows[0] as any;
        const kName = findKey(first, 'name', 'full name', 'employee name', 'nama');
        const kPos = findKey(first, 'position', 'jabatan', 'role', 'job title');
        const kLoc = findKey(first, 'location', 'lokasi', 'site', 'area');
        const kCoord = findKey(first, 'coordinator', 'koordinator', 'supervisor', 'managed by');

        if (!kName) {
          alert('Could not map "Name" headers. Ensure Column 1 or headers contains Full Name, Position, Location, etc.');
          return;
        }

        const validImport: Omit<Employee, 'id'>[] = [];
        rows.forEach((row: any) => {
          const name = row[kName]?.toString().trim();
          if (!name) return;
          validImport.push({
            name,
            position: kPos ? row[kPos]?.toString().trim() : '',
            location: kLoc ? row[kLoc]?.toString().trim() : '',
            coordinator: kCoord ? row[kCoord]?.toString().trim() : ''
          });
        });

        if (validImport.length > 0) {
          onImportExcel(validImport);
          alert(`Success! Imported ${validImport.length} employee records.`);
        } else {
          alert('No valid employees found to import.');
        }
      } catch (err: any) {
        alert('Parsing spreadsheet documents crashed: ' + err.message);
      }
      ev.target.value = '';
    };
    r.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      {/* Header bar and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-condensed font-extrabold uppercase text-lg tracking-wider text-base-text">
            Employee <span className="text-base-accent">Directory</span>
          </h2>

          {/* Search bar input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-muted" />
            <input
              type="text"
              value={q}
              onChange={handleSearchChange}
              placeholder="Search name, position, location, manager..."
              className="pl-9 pr-4 py-1.5 bg-base-surface text-base-text text-xs rounded-lg border border-base-border focus:border-base-accent outline-none w-64 transition-all"
            />
          </div>

          {/* Collapse / Uncollapse All buttons */}
          <div id="employee-collapse-controls" className="flex items-center gap-1 bg-base-surface border border-base-border rounded-lg p-0.5 shadow-sm">
            <button
              id="emp-collapse-all-btn"
              onClick={collapseAll}
              title="Collapse All Groups"
              className="px-2 py-1 rounded hover:bg-base-surface3 hover:text-base-text text-base-muted flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronsDownUp className="h-3.5 w-3.5 text-base-accent" />
              <span className="font-condensed font-bold uppercase text-[10px] tracking-wider">Collapse All</span>
            </button>
            <div className="h-4 w-px bg-base-border" />
            <button
              id="emp-expand-all-btn"
              onClick={expandAll}
              title="Uncollapse All Groups"
              className="px-2 py-1 rounded hover:bg-base-surface3 hover:text-base-text text-base-muted flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-base-accent" />
              <span className="font-condensed font-bold uppercase text-[10px] tracking-wider">Uncollapse All</span>
            </button>
          </div>
        </div>

        {/* Action button panel */}
        <div className="flex items-center gap-2">
          {/* File input invisible */}
          <input
            type="file"
            id="emp-excel-input-file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={triggerExcelUpload}
            className="btn btn-sm btn-ghost border border-base-border flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider text-base-muted2 hover:text-base-text hover:bg-base-surface3 transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4 text-base-blue animate-bounce" />
            <span>Import Excel</span>
          </button>
          <button
            onClick={openAddEmployee}
            className="btn btn-accent btn-sm flex items-center gap-1.5 font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Primary listings */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-base-surface border border-base-border rounded-xl p-12 text-center text-base-muted flex flex-col items-center justify-center shadow-card">
            <User className="h-10 w-10 text-base-border/80 mb-3" />
            <p className="text-sm font-semibold">No active employee found matching search parameters.</p>
          </div>
        ) : (
          coordNames.map(coord => {
            const list = coordGroups[coord];
            const isColl = !!collapsedGroups[coord];

            return (
              <div key={coord} className="bg-base-surface border border-base-border rounded-xl shadow-card overflow-hidden">
                {/* Collapsible header */}
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
                      {list.length} employee{list.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Employee listing table */}
                {!isColl && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-base-surface2/30 text-left text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted border-b border-base-border/50">
                          <th className="py-2.5 px-4">Name</th>
                          <th className="py-2.5 px-3">Position</th>
                          <th className="py-2.5 px-3">Location</th>
                          <th className="py-2.5 px-3">Coordinator</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-base-border/30 text-xs">
                        {list.map(emp => {
                          const col = getEmpColor(emp.name);
                          const initials = getInitials(emp.name);
                          return (
                            <tr key={emp.id} className="hover:bg-base-surface2/20 transition-colors">
                              <td className="py-3 px-4 font-semibold text-base-text">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="h-7 w-7 rounded-full flex items-center justify-center font-condensed font-extrabold text-[10px]"
                                    style={{ backgroundColor: `${col}18`, color: col }}
                                  >
                                    {initials}
                                  </div>
                                  <span>{emp.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-base-muted2 font-medium">{emp.position || '—'}</td>
                              <td className="py-3 px-3 text-base-muted2 font-medium">{emp.location || '—'}</td>
                              <td className="py-3 px-3 text-base-muted2 font-medium">{emp.coordinator || '—'}</td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => openEditEmployee(emp.id)}
                                  className="p-1 rounded text-base-muted hover:text-base-accent hover:bg-base-surface3 transition-all cursor-pointer inline-flex items-center justify-center mr-1"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteEmployee(emp.id)}
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
    </div>
  );
}
