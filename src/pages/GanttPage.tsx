import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import GanttView from '../components/GanttView';
import { Briefcase, Calendar, AlertCircle, FileText, BarChart2 } from 'lucide-react';

interface GanttPageProps {
  projects: Project[];
  onUpdateProject?: (project: Project) => void;
  onOpenDepModal?: (rowKey: string) => void;
}

export function GanttPage({ projects, onUpdateProject, onOpenDepModal }: GanttPageProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Default to selecting the first active project or any project available
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      const activeProj = projects.find(p => p.status === 'active') || projects[0];
      setSelectedProjectId(activeProj.id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

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

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="project-select" className="text-xs font-condensed font-bold text-base-muted uppercase tracking-wider">
              Select Project:
            </label>
            <div className="relative">
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="appearance-none bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-base-text font-condensed uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-base-accent transition-all"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client || 'Internal'})
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-base-muted">
                ▼
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Gantt View Section */}
      {selectedProject ? (
        <div className="bg-base-surface border border-base-border rounded-xl p-5 shadow-xs">
          <GanttView project={selectedProject} onUpdateProject={onUpdateProject} onOpenDepModal={onOpenDepModal} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-base-border/50 rounded-xl p-12 text-center bg-base-surface/40">
          <div className="h-12 w-12 rounded-full bg-base-accent-dim flex items-center justify-center text-base-accent mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="font-condensed font-extrabold text-base text-base-text uppercase tracking-wider">No Projects Found</h3>
          <p className="text-xs text-base-muted font-sans mt-1 max-w-sm">
            There are currently no active or pending projects configured in the system. Create or assign a project to view its Gantt timeline.
          </p>
        </div>
      )}
    </div>
  );
}
