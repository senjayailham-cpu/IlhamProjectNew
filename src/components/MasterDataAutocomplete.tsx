import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MasterDataEntry } from '../types';

interface MasterDataAutocompleteProps {
  category: MasterDataEntry['category'];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  entries: MasterDataEntry[];
  className?: string;
  required?: boolean;
}

export function MasterDataAutocomplete({
  category,
  value,
  onChange,
  placeholder = 'Type to search...',
  entries,
  className = '',
  required = false
}: MasterDataAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute suggestions based on category and current input value
  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase().trim();
    return entries
      .filter((e) => e.category === category && e.value.toLowerCase().includes(q))
      .sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
      })
      .slice(0, 8);
  }, [category, value, entries]);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    setIsOpen(false);
  };

  return (
    <div id={`md-autocomplete-container-${category}`} ref={containerRef} className="relative w-full">
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`input-field w-full ${className}`}
      />
      {isOpen && value.trim().length >= 1 && suggestions.length > 0 && (
        <div 
          id={`md-autocomplete-dropdown-${category}`}
          className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-base-surface border border-base-border rounded-lg shadow-xl z-50 divide-y divide-base-border/50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s.value)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-base-surface2/80 transition-colors flex items-center justify-between gap-4 text-base-text font-medium"
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate">{s.value}</span>
                {s.gaNumber && (
                  <span className="text-[9px] font-mono font-bold text-base-accent mt-0.5">
                    GA: {s.gaNumber}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-base-muted bg-base-surface3 border border-base-border/40 px-1.5 py-0.5 rounded-md shrink-0">
                {s.usageCount}x
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MasterDataAutocomplete;
