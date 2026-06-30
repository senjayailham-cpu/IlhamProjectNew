import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import GanttView from '../components/GanttView';
import { Briefcase, Calendar, AlertCircle, FileText, BarChart2 } from 'lucide-react';

interface GanttPageProps {
  projects: Project[];
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
}

export function GanttPage({ projects, onUpdateProject, onOpenDepModal }: GanttPageProps) {
  // Collect all available target months from projects
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    projects.forEach(p => {
      if (p.targetMonth) {
        months.add(p.targetMonth);
      } else {
        const dateStr = p.start || p.created || '';
        if (dateStr && dateStr.length >= 7) {
          months.add(dateStr.slice(0, 7));
        }
      }
    });
    // If empty, add current month
    if (months.size === 0) {
      months.add(new Date().toISOString().slice(0, 7));
    }
    return Array.from(months).sort();
  }, [projects]);

  // Default selected month to the active project's month, or first available target month, or current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const activeProj = projects.find(p => p.status === 'active');
    if (activeProj && activeProj.targetMonth) {
      return activeProj.targetMonth;
    }
    
    const available = Array.from(new Set(
      projects
        .map(p => p.targetMonth)
        .filter((m): m is string => !!m)
    )).sort();
    
    if (available.length > 0) {
      return available[0];
    }
    
    return new Date().toISOString().slice(0, 7);
  });

  // Filter projects by selected target month
  const projectsInMonth = useMemo(() => {
    return projects.filter(p => {
      if (p.targetMonth) {
        return p.targetMonth === selectedMonth;
      }
      const fallbackM = (p.start || p.created || '').slice(0, 7);
      return fallbackM === selectedMonth;
    });
  }, [projects, selectedMonth]);

  // Construct a combined virtual project if there are multiple, or use single project directly
  const virtualProject = useMemo<Project | null>(() => {
    if (projectsInMonth.length === 0) return null;

    if (projectsInMonth.length === 1) {
      return projectsInMonth[0];
    }

    const projectStarts = projectsInMonth.map(p => p.start).filter(Boolean) as string[];
    const projectDues = projectsInMonth.map(p => p.due).filter(Boolean) as string[];

    const minStart = projectStarts.length > 0 ? projectStarts.sort()[0] : `${selectedMonth}-01`;
    const maxDue = projectDues.length > 0 ? projectDues.sort().reverse()[0] : `${selectedMonth}-28`;

    // Combine assemblies, prefixes assembly names with project name for clarity
    const combinedAssemblies = projectsInMonth.flatMap(p => {
      return p.assemblies.map(asm => ({
        ...asm,
        name: `${p.name} - ${asm.name}`
      }));
    });

    return {
      id: `combined-${selectedMonth}`,
      name: `Combined Projects - ${selectedMonth}`,
      client: 'Multiple Clients',
      status: 'active',
      category: 'tray',
      location: 'workshop1' as any,
      created: new Date().toISOString(),
      start: minStart,
      due: maxDue,
      assemblies: combinedAssemblies,
    } as Project;
  }, [projectsInMonth, selectedMonth]);

  // Handle saving back from virtual project to original projects
  const handleUpdateProject = (updatedProj: Project) => {
    if (!onUpdateProject) return;

    if (projectsInMonth.length === 1) {
      onUpdateProject(updatedProj);
      return;
    }

    // For multiple projects, map updated assemblies back to each original project
    projectsInMonth.forEach(originalProj => {
      const updatedAssemblies = originalProj.assemblies.map(origAsm => {
        const match = updatedProj.assemblies.find(a => a.id === origAsm.id);
        if (match) {
          // Remove the project name prefix from assembly name before saving back
          const prefix = `${originalProj.name} - `;
          const restoredName = match.name.startsWith(prefix) 
            ? match.name.substring(prefix.length) 
            : match.name;

          return {
            ...match,
            name: restoredName
          };
        }
        return origAsm;
      });

      // Check if assemblies or tasks in this project changed
      const hasChanges = JSON.stringify(updatedAssemblies) !== JSON.stringify(originalProj.assemblies);

      if (hasChanges) {
        onUpdateProject({
          ...originalProj,
          assemblies: updatedAssemblies
        });
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col p-5 space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-surface border border-base-border p-5 rounded-xl shadow-xs">
        <div>
          <h1 className="font-condensed font-extrabold text-2xl tracking-tight text-base-text flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-base-accent" />
            <span>Timeline Gantt Schedules</span>
          </h1>
          <p className="text-xs text-base-muted font-sans mt-1">
            Analyze, monitor, and coordinate assembly tasks, dependencies, and critical milestones in real time.
          </p>
        </div>

        {/* Target Month Selector */}
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="month-select" className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wider">
              Target Month:
            </label>
            <div className="relative">
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-base-text font-condensed uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-base-accent transition-all"
              >
                {availableMonths.map((m) => {
                  const [yr, mo] = m.split('-').map(Number);
                  const date = new Date(yr, mo - 1, 1);
                  const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-base-muted">
                ▼
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Gantt View Section */}
      {virtualProject ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-xs">
          <GanttView 
            project={virtualProject} 
            onUpdateProject={handleUpdateProject} 
            onOpenDepModal={onOpenDepModal} 
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-base-border/50 rounded-xl p-12 text-center bg-base-surface/40">
          <div className="h-12 w-12 rounded-full bg-base-accent-dim flex items-center justify-center text-base-accent mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="font-condensed font-extrabold text-base text-base-text uppercase tracking-wider">No Projects Found</h3>
          <p className="text-xs text-base-muted font-sans mt-1 max-w-sm">
            There are currently no projects scheduled for {new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.
          </p>
        </div>
      )}
    </div>
  );
}
