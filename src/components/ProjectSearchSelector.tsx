import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project } from '../types';
import { Search, Check, X } from 'lucide-react';

interface ProjectSearchSelectorProps {
  projects: Project[];
  selectedId: string;
  onChange: (id: string) => void;
  placeholder?: string;
  showAllProjectsOption?: boolean; // If true, includes an "All Projects (Global View)" option
  required?: boolean;
  className?: string;
}

export function ProjectSearchSelector({
  projects = [],
  selectedId,
  onChange,
  placeholder = '',
  showAllProjectsOption = false,
  required = false,
  className = ''
}: ProjectSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Find currently selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedId);
  }, [projects, selectedId]);

  // Determine what value to show inside the input field
  const displayValue = useMemo(() => {
    if (isFocused) {
      return searchQuery;
    }
    if (selectedProject) {
      return selectedProject.name;
    }
    if (showAllProjectsOption) {
      return 'All Projects (Global View)';
    }
    return '';
  }, [isFocused, searchQuery, selectedProject, showAllProjectsOption]);

  // Filter projects based on typing query
  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(query);
      const clientMatch = p.client?.toLowerCase().includes(query);
      const gaMatch = p.gaNumber?.toLowerCase().includes(query);
      const targetMonthMatch = p.targetMonth?.toLowerCase().includes(query);
      return nameMatch || clientMatch || gaMatch || targetMonthMatch;
    });
  }, [projects, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setSearchQuery('');
    setIsOpen(false);
    setIsFocused(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange('');
    setSearchQuery('');
    setIsOpen(false);
    setIsFocused(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-muted">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange(''); // clear selection if input is completely cleared
            }
          }}
          onFocus={() => {
            setSearchQuery(''); // Make sure input is empty when user starts typing/focusing
            setIsFocused(true);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required && !selectedId}
          className="w-full bg-base-surface2 border border-base-border hover:border-base-border2 text-base-text text-sm rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:ring-1 focus:ring-base-accent font-sans transition duration-150"
        />
        {(displayValue || selectedId) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-muted hover:text-base-text transition cursor-pointer z-10"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Autocomplete / Typing Suggestion Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 bg-base-surface border border-base-border rounded-lg shadow-xl z-[100] overflow-y-auto divide-y divide-base-border/40 animate-in fade-in slide-in-from-top-1 duration-150">
          {showAllProjectsOption && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full text-left px-3.5 py-2.5 text-xs font-sans transition-colors flex items-center justify-between ${
                !selectedId
                  ? 'bg-base-accent/5 text-base-accent font-bold'
                  : 'text-base-text hover:bg-base-surface2/60'
              }`}
            >
              <span>All Projects (Global View)</span>
              {!selectedId && <Check className="h-3.5 w-3.5 text-base-accent" />}
            </button>
          )}

          {filteredProjects.length > 0 ? (
            filteredProjects.map((p) => {
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-base-accent/5 text-base-accent font-semibold'
                      : 'text-base-text hover:bg-base-surface2/60'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate text-base-text">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-base-muted truncate mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>WO: {p.client || '—'}</span>
                      {p.gaNumber && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 bg-base-surface3 border border-base-border text-base-text rounded shrink-0">
                            GA: {p.gaNumber}
                          </span>
                        </>
                      )}
                      {p.targetMonth && (
                        <>
                          <span>·</span>
                          <span className="text-base-accent font-bold text-[9px] shrink-0">{p.targetMonth}</span>
                        </>
                      )}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-base-accent" />}
                </button>
              );
            })
          ) : (
            <div className="px-3.5 py-4 text-center text-xs text-base-muted font-sans">
              No matching projects found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectSearchSelector;
