import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Project, TimesheetEntry, ActivityLog, Employee, MaterialItem, BomTemplate } from '../../types';
import { useAppStore, useUIStore } from '../../store';
import ThemeToggle from '../ThemeToggle';
import { 
  Download, 
  Search, 
  X, 
  Folder, 
  Users, 
  Package, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  CheckCircle,
  AlertCircle,
  Command,
  Layers,
  Sparkles,
  Award,
  ListTree
} from 'lucide-react';

interface AppTopBarProps {
  activeTabLabel: string;
  currentUser: User | null;
  onLogout?: () => void;
  onDownload?: () => void;
  onChangePassword?: () => void;
  sidebarCollapsed?: boolean;
  isOffline: boolean;
  canExport: boolean;
  onExportCSV: () => void;
  projects: Project[];
  activities: ActivityLog[];
  employees?: Employee[];
  materials?: MaterialItem[];
  bomTemplates?: BomTemplate[];
  setActiveTab?: (tab: string) => void;
  openSpotlight?: (id: string) => void;
  readNotificationIds?: string[];
  onMarkRead?: (ids: string[]) => void;
}

type SearchCategory = 'all' | 'projects' | 'personnel' | 'materials' | 'bom';

interface SearchResultItem {
  id: string;
  type: 'project' | 'employee' | 'material' | 'bom';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  data: any;
}

export function AppTopBar({
  activeTabLabel,
  currentUser: propUser,
  onLogout,
  onDownload,
  onChangePassword,
  sidebarCollapsed,
  isOffline: propIsOffline,
  canExport,
  onExportCSV,
  projects: propProjects,
  activities: propActivities,
  employees: propEmployees,
  materials: propMaterials,
  bomTemplates: propBomTemplates,
  setActiveTab: propSetActiveTab,
  openSpotlight: propOpenSpotlight,
  readNotificationIds,
  onMarkRead,
}: AppTopBarProps) {
  // Pull fallback values directly from Zustand stores
  const storeProjects = useAppStore((s) => s.projects);
  const storeActivities = useAppStore((s) => s.activities);
  const storeEmployees = useAppStore((s) => s.employees);
  const storeMaterials = useAppStore((s) => s.materials);
  const storeBomTemplates = useAppStore((s) => s.bomTemplates);
  const storeCurrentUser = useAppStore((s) => s.currentUser);
  const storeIsOffline = useAppStore((s) => s.isOffline);

  const storeSetActiveTab = useUIStore((s) => s.setActiveTab);
  const storeOpenSpotlight = useUIStore((s) => s.openSpotlight);

  const projects = propProjects?.length ? propProjects : storeProjects;
  const activities = propActivities?.length ? propActivities : storeActivities;
  const employees = propEmployees?.length ? propEmployees : storeEmployees;
  const materials = propMaterials?.length ? propMaterials : storeMaterials;
  const bomTemplates = propBomTemplates?.length ? propBomTemplates : storeBomTemplates;
  const currentUser = propUser || storeCurrentUser;
  const isOffline = propIsOffline !== undefined ? propIsOffline : storeIsOffline;

  const setActiveTab = propSetActiveTab || storeSetActiveTab;
  const openSpotlight = propOpenSpotlight || storeOpenSpotlight;

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input field when search modal is opened
  useEffect(() => {
    if (isSearchOpen) {
      setSearchQuery('');
      setSelectedItem(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  // Combined Search List generator
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const list: SearchResultItem[] = [];

    // 1. Projects search
    if (activeCategory === 'all' || activeCategory === 'projects') {
      projects.forEach(p => {
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesClient = (p.client || '').toLowerCase().includes(query);
        const matchesGa = (p.gaNumber || '').toLowerCase().includes(query);
        const matchesAssemblies = p.assemblies?.some(a => (a.name || '').toLowerCase().includes(query));
        
        if (matchesName || matchesClient || matchesGa || matchesAssemblies) {
          list.push({
            id: `proj_${p.id}`,
            type: 'project',
            title: p.name,
            subtitle: `Work Order: ${p.client} ${p.gaNumber ? `• GA: ${p.gaNumber}` : ''} • ${p.assemblies?.length || 0} Assemblies`,
            badge: (p.status || '').toUpperCase(),
            badgeColor: p.status === 'completed' ? 'bg-base-green-dim text-base-green' : p.status === 'active' ? 'bg-base-blue-dim text-base-blue' : 'bg-base-accent-dim text-base-accent',
            data: p
          });
        }
      });
    }

    // 2. Personnel search
    if (activeCategory === 'all' || activeCategory === 'personnel') {
      employees.forEach(e => {
        const matchesName = (e.name || '').toLowerCase().includes(query);
        const matchesPosition = e.position?.toLowerCase().includes(query);
        const matchesLoc = e.location?.toLowerCase().includes(query);
        const matchesNo = e.empNo?.toLowerCase().includes(query);

        if (matchesName || matchesPosition || matchesLoc || matchesNo) {
          list.push({
            id: `emp_${e.id}`,
            type: 'employee',
            title: e.name,
            subtitle: `${e.position || 'Personnel'} • Site: ${e.location || 'N/A'}`,
            badge: e.isExEmployee ? 'EX-EMPLOYEE' : 'ACTIVE',
            badgeColor: e.isExEmployee ? 'bg-base-red-dim text-base-red' : 'bg-base-green-dim text-base-green',
            data: e
          });
        }
      });
    }

    // 3. Materials search
    if (activeCategory === 'all' || activeCategory === 'materials') {
      materials.forEach(m => {
        const matchesName = (m.name || '').toLowerCase().includes(query);
        const matchesCategory = (m.category || '').toLowerCase().includes(query);
        const matchesLoc = m.location?.toLowerCase().includes(query);
        const matchesNotes = m.notes?.toLowerCase().includes(query);

        if (matchesName || matchesCategory || matchesLoc || matchesNotes) {
          const isLowStock = m.currentStock <= m.minStock;
          list.push({
            id: `mat_${m.id}`,
            type: 'material',
            title: m.name,
            subtitle: `${m.category} • Loc: ${m.location || 'Main Storage'}`,
            badge: isLowStock ? 'LOW STOCK' : 'IN STOCK',
            badgeColor: isLowStock ? 'bg-base-red-dim text-base-red animate-pulse' : 'bg-base-green-dim text-base-green',
            data: m
          });
        }
      });
    }

    // 4. BOM Templates & Items search
    if (activeCategory === 'all' || activeCategory === 'bom') {
      bomTemplates.forEach(t => {
        const matchesName = (t.name || '').toLowerCase().includes(query);
        const matchesGa = (t.gaNumber || '').toLowerCase().includes(query);
        const matchesModel = (t.model || '').toLowerCase().includes(query);
        const matchesDesc = (t.notes || '').toLowerCase().includes(query);
        const matchesItems = t.items?.some(i => 
          (i.partNumber || '').toLowerCase().includes(query) ||
          (i.description || '').toLowerCase().includes(query) ||
          (i.material || '').toLowerCase().includes(query) ||
          (i.subAssembly || '').toLowerCase().includes(query)
        );

        if (matchesName || matchesGa || matchesModel || matchesDesc || matchesItems) {
          list.push({
            id: `bom_${t.id}`,
            type: 'bom',
            title: t.name,
            subtitle: `GA: ${t.gaNumber || 'N/A'} • Model: ${t.model || 'Standard'} • ${t.items?.length || 0} Parts`,
            badge: `${t.items?.length || 0} ITEMS`,
            badgeColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
            data: t
          });
        }
      });
    }

    return list;
  }, [searchQuery, activeCategory, projects, employees, materials, bomTemplates]);

  // Auto-select first item on search change
  useEffect(() => {
    if (searchResults.length > 0) {
      setSelectedItem(searchResults[0]);
    } else {
      setSelectedItem(null);
    }
  }, [searchResults]);

  // Keyboard navigation inside search dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K toggle
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen(open => !open);
        return;
      }

      if (!isSearchOpen) return;

      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        return;
      }

      if (searchResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedItem(prev => {
          if (!prev) return searchResults[0];
          const currentIndex = searchResults.findIndex(item => item.id === prev.id);
          const nextIndex = (currentIndex + 1) % searchResults.length;
          return searchResults[nextIndex];
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedItem(prev => {
          if (!prev) return searchResults[searchResults.length - 1];
          const currentIndex = searchResults.findIndex(item => item.id === prev.id);
          const prevIndex = (currentIndex - 1 + searchResults.length) % searchResults.length;
          return searchResults[prevIndex];
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedItem) {
          if (selectedItem.type === 'project' && openSpotlight) {
            openSpotlight(selectedItem.data.id);
            setIsSearchOpen(false);
          } else if (selectedItem.type === 'employee' && setActiveTab) {
            setActiveTab('employees');
            setIsSearchOpen(false);
          } else if (selectedItem.type === 'material' && setActiveTab) {
            setActiveTab('materials');
            setIsSearchOpen(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, searchResults, selectedItem, openSpotlight, setActiveTab]);

  return (
    <>
      <header className="hidden md:flex h-14 bg-base-surface/85 backdrop-blur-md border-b border-base-border px-6 items-center justify-between sticky top-0 z-30 select-none shadow-card shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-condensed font-extrabold uppercase tracking-widest text-base-accent bg-base-accent-dim px-3 py-1 rounded-lg border border-base-accent/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-base-accent animate-pulse" />
            {activeTabLabel}
          </span>

          {/* System Status HUD Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-base-surface2 border border-base-border text-[11px] font-condensed font-bold text-base-muted">
            <div className="flex items-center gap-1 text-base-text">
              <span className="w-1.5 h-1.5 rounded-full bg-base-green" />
              <span>{projects.filter(p => p.status === 'active').length} Active Proj</span>
            </div>
            <span className="text-base-border">|</span>
            <div className="flex items-center gap-1 text-base-text">
              <Users className="h-3 w-3 text-base-blue" />
              <span>{employees.filter(e => !e.isExEmployee).length} Workforce</span>
            </div>
          </div>

          {isOffline && (
            <span className="px-2 py-0.5 rounded-full font-condensed font-extrabold text-[9px] uppercase bg-red-500/15 text-red-500 border border-red-500/30 tracking-wider animate-pulse">
              OFFLINE (CACHE ACTIVE)
            </span>
          )}

          {/* Inline Search Bar Trigger */}
          <div 
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center bg-base-surface3 hover:bg-base-surface2 border border-base-border rounded-xl px-3.5 py-1.5 gap-2.5 text-base-muted hover:text-base-text hover:border-base-border2 cursor-pointer transition-all duration-150 w-64 shadow-xs"
          >
            <Search className="h-3.5 w-3.5 text-base-accent" />
            <span className="text-xs text-base-muted select-none flex-1 font-sans">Quick search or CMD+K...</span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-base-surface border border-base-border text-[9px] font-mono font-bold text-base-muted select-none shadow-xs">
              <span>⌘</span>K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-base-surface2 border border-base-border">
              <div className="w-6 h-6 rounded-full bg-base-accent-dim text-base-accent font-condensed font-extrabold text-xs flex items-center justify-center border border-base-accent/30">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[11px] font-condensed font-bold text-base-text leading-tight">{currentUser.name}</p>
                <p className="text-[9px] font-condensed uppercase tracking-wider text-base-muted leading-none">{currentUser.role}</p>
              </div>
            </div>
          )}

          <ThemeToggle />
          
          {canExport && (
            <button 
              onClick={onExportCSV} 
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-500 transition-all font-condensed font-extrabold text-xs rounded-xl uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Download consolidated spreadsheets"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>
      </header>

      {/* GLOBAL SEARCH DIALOG OVERLAY */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsSearchOpen(false)}
        >
          <div 
            className="bg-base-surface border border-base-border rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar Header */}
            <div className="px-6 py-4 border-b border-base-border flex items-center gap-3 bg-base-surface2">
              <Search className="h-5 w-5 text-base-accent shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search projects, personnel, or material inventory..."
                className="bg-transparent border-0 ring-0 focus:ring-0 focus:outline-hidden text-base-text placeholder-base-muted text-sm flex-1 font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full hover:bg-base-surface3 text-base-muted hover:text-base-text transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="text-[10px] font-condensed font-bold bg-base-surface3 border border-base-border text-base-muted px-2 py-1 rounded select-none uppercase tracking-wider shrink-0">
                ESC to close
              </div>
            </div>

            {/* Category Tabs */}
            <div className="px-6 py-2.5 border-b border-base-border bg-base-surface/50 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
              {(['all', 'projects', 'personnel', 'materials', 'bom'] as SearchCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setSelectedItem(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-condensed font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    activeCategory === cat
                      ? 'bg-base-accent text-white border-base-accent shadow-sm'
                      : 'bg-base-surface2 border-base-border text-base-muted hover:text-base-text hover:bg-base-surface3'
                  }`}
                >
                  {cat === 'all' && 'All Results'}
                  {cat === 'projects' && 'Projects'}
                  {cat === 'personnel' && 'Personnel'}
                  {cat === 'materials' && 'Material Inventory'}
                  {cat === 'bom' && 'BOM / Templates'}
                </button>
              ))}
            </div>

            {/* Split Screen Search View */}
            <div className="flex-1 flex min-h-0 bg-base-surface">
              
              {/* Left Side: Search List Results */}
              <div className="w-1/2 border-r border-base-border overflow-y-auto flex flex-col">
                {!searchQuery.trim() ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
                    <div className="w-12 h-12 rounded-full bg-base-accent-dim/10 border border-base-accent/20 flex items-center justify-center text-base-accent animate-bounce">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-condensed font-black uppercase text-sm tracking-wider text-base-text">Search Workspace</p>
                      <p className="text-xs text-base-muted max-w-xs mx-auto">
                        Search dynamically for projects, specific WO clients, personnel records, position titles, or material inventory stock logs.
                      </p>
                    </div>
                    
                    {/* Handy shortcuts */}
                    <div className="pt-2 text-left max-w-xs mx-auto space-y-2 border-t border-base-border/50 w-full mt-2">
                      <p className="text-[10px] font-condensed font-bold uppercase tracking-wider text-base-muted mb-1 text-center">Try typing</p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {['WO', 'Tray', 'Welder', 'Shift', 'Safety', 'Plate'].map((term) => (
                          <button
                            key={term}
                            onClick={() => setSearchQuery(term)}
                            className="px-2 py-0.5 bg-base-surface2 hover:bg-base-surface3 border border-base-border rounded text-[10px] font-mono text-base-text transition-colors"
                          >
                            "{term}"
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
                    <div className="w-10 h-10 rounded-full bg-base-surface2 border border-base-border flex items-center justify-center text-base-muted">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-condensed font-bold text-xs uppercase tracking-wider text-base-text">No matches found</p>
                      <p className="text-[11px] text-base-muted">We couldn't find anything matching "{searchQuery}" under this scope.</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-base-border">
                    {searchResults.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                            isSelected 
                              ? 'bg-base-accent-dim/15 border-l-4 border-l-base-accent' 
                              : 'hover:bg-base-surface2 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-base-border ${
                              isSelected ? 'bg-base-accent/10 text-base-accent' : 'bg-base-surface3 text-base-muted'
                            }`}>
                              {item.type === 'project' && <Folder className="h-4 w-4" />}
                              {item.type === 'employee' && <Users className="h-4 w-4" />}
                              {item.type === 'material' && <Package className="h-4 w-4" />}
                              {item.type === 'bom' && <ListTree className="h-4 w-4 text-purple-400" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-base-text truncate">{item.title}</p>
                              <p className="text-[10px] text-base-muted truncate mt-0.5">{item.subtitle}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span className={`text-[9px] font-condensed font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${item.badgeColor || 'bg-base-surface3 text-base-muted'}`}>
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-base-muted shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Side: "Actual Contents" detailed popup view panel */}
              <div className="w-1/2 bg-base-surface2/50 overflow-y-auto p-6">
                {!selectedItem ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-base-muted">
                    <Command className="h-8 w-8 text-base-muted/40 mb-2" />
                    <p className="font-condensed font-bold uppercase text-xs tracking-wider">Inspect Item Dossier</p>
                    <p className="text-[10px] text-base-muted max-w-xs">Select an item from the search results list to view its complete record details directly.</p>
                  </div>
                ) : (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* Entity Icon, Title, and Badges */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-base-surface border border-base-border flex items-center justify-center text-base-accent shadow-sm shrink-0">
                        {selectedItem.type === 'project' && <Folder className="h-6 w-6 text-base-accent" />}
                        {selectedItem.type === 'employee' && <Users className="h-6 w-6 text-base-blue" />}
                        {selectedItem.type === 'material' && <Package className="h-6 w-6 text-emerald-500" />}
                        {selectedItem.type === 'bom' && <ListTree className="h-6 w-6 text-purple-400" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-[9px] font-condensed font-black tracking-widest text-base-muted uppercase bg-base-surface border border-base-border px-2 py-0.5 rounded-md">
                          {selectedItem.type.toUpperCase()} Record
                        </span>
                        <h4 className="font-condensed font-black text-lg text-base-text uppercase leading-tight tracking-wide">
                          {selectedItem.title}
                        </h4>
                        {selectedItem.badge && (
                          <span className={`inline-block text-[9px] font-condensed font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider mt-1 ${selectedItem.badgeColor}`}>
                            {selectedItem.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed Properties list */}
                    <div className="bg-base-surface border border-base-border rounded-xl p-4 space-y-4">
                      
                      {/* 1. PROJECT SPECIFIC VIEW */}
                      {selectedItem.type === 'project' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3.5 text-xs">
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Client / Work Order</p>
                              <p className="font-mono font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 truncate">
                                {selectedItem.data.client}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Facility Location</p>
                              <p className="font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 capitalize">
                                {selectedItem.data.location || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Start Date</p>
                              <p className="font-mono text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.start || 'No start date'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Due Date</p>
                              <p className="font-mono text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.due || 'No due date'}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-base-border pt-3.5">
                            <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted mb-2">Scope Assemblies ({selectedItem.data.assemblies?.length || 0})</p>
                            {selectedItem.data.assemblies && selectedItem.data.assemblies.length > 0 ? (
                              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                {selectedItem.data.assemblies.map((asm: any) => (
                                  <div key={asm.id} className="flex items-center justify-between p-2 bg-base-surface2 border border-base-border rounded text-[11px] font-medium text-base-text">
                                    <span className="truncate flex-1">{asm.name}</span>
                                    <span className="font-mono font-bold text-base-muted text-xs bg-base-surface3 border border-base-border rounded px-1.5 py-0.5">
                                      {asm.tasks?.length || 0} tasks
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-base-muted italic">No assemblies added to this project yet.</p>
                            )}
                          </div>

                          {selectedItem.data.notes && (
                            <div className="border-t border-base-border pt-3.5 space-y-1">
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Project Remarks</p>
                              <p className="text-xs text-base-text bg-base-surface3 border border-base-border p-2 rounded-lg italic">
                                "{selectedItem.data.notes}"
                              </p>
                            </div>
                          )}

                          {openSpotlight && (
                            <button
                              onClick={() => {
                                openSpotlight(selectedItem.data.id);
                                setIsSearchOpen(false);
                              }}
                              className="w-full py-2.5 bg-base-accent hover:bg-base-accent/90 text-white font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span>Enter Project Spotlight</span>
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 2. EMPLOYEE/PERSONNEL SPECIFIC VIEW */}
                      {selectedItem.type === 'employee' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3.5 text-xs">
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Employee No.</p>
                              <p className="font-mono font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.empNo || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Position / Role</p>
                              <p className="font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.position || 'Personnel'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Assigned Site</p>
                              <p className="font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 capitalize">
                                {selectedItem.data.location || 'Not Specified'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Shift</p>
                              <p className="font-mono text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 uppercase">
                                {selectedItem.data.shift || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Status</p>
                              <p className="font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 capitalize">
                                {selectedItem.data.employmentStatus || 'Contract'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Join Date</p>
                              <p className="font-mono text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.joinDate || 'N/A'}
                              </p>
                            </div>
                          </div>

                          {selectedItem.data.coordinator && (
                            <div className="border-t border-base-border pt-3.5 space-y-1">
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Coordinator / Supervisor</p>
                              <p className="font-bold text-xs text-base-text bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.coordinator}
                              </p>
                            </div>
                          )}

                          {selectedItem.data.isExEmployee && (
                            <div className="border-t border-base-border pt-3.5 p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-1.5">
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-red-500">Resignation Dossier</p>
                              <p className="text-[11px] text-base-text font-semibold">Resigned Date: <span className="font-mono">{selectedItem.data.resignDate || 'N/A'}</span></p>
                              <p className="text-xs text-base-muted italic">Reason: "{selectedItem.data.resignReason || 'Not detailed.'}"</p>
                            </div>
                          )}

                          {setActiveTab && (
                            <button
                              onClick={() => {
                                setActiveTab('employees');
                                setIsSearchOpen(false);
                              }}
                              className="w-full py-2.5 bg-base-blue hover:bg-base-blue/90 text-white font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                              <span>Navigate to Employees Management</span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 3. MATERIAL SPECIFIC VIEW */}
                      {selectedItem.type === 'material' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3.5 text-xs">
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Material Category</p>
                              <p className="font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.category}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Unit of Measure</p>
                              <p className="font-mono text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Current Stock Level</p>
                              <p className={`font-mono font-bold text-sm mt-1 bg-base-surface2 border rounded px-2 py-1 ${
                                selectedItem.data.currentStock <= selectedItem.data.minStock ? 'text-base-red border-base-red/20' : 'text-base-green border-base-border'
                              }`}>
                                {selectedItem.data.currentStock} {selectedItem.data.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Safety Reorder Stock</p>
                              <p className="font-mono text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.minStock} {selectedItem.data.unit}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-base-border pt-3.5">
                            <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Storage Location</p>
                            <p className="font-bold text-xs text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 capitalize">
                              {selectedItem.data.location || 'Workshop Storage Room'}
                            </p>
                          </div>

                          {selectedItem.data.notes && (
                            <div className="border-t border-base-border pt-3.5 space-y-1">
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Inventory Remarks / Specs</p>
                              <p className="text-xs text-base-text bg-base-surface3 border border-base-border p-2 rounded-lg italic">
                                "{selectedItem.data.notes}"
                              </p>
                            </div>
                          )}

                          {setActiveTab && (
                            <button
                              onClick={() => {
                                setActiveTab('materials');
                                setIsSearchOpen(false);
                              }}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                              <span>Navigate to Material inventory</span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* 4. BOM SPECIFIC VIEW */}
                      {selectedItem.type === 'bom' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3.5 text-xs">
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">GA Number</p>
                              <p className="font-mono font-bold text-purple-400 mt-1 bg-base-surface2 border border-purple-500/20 rounded px-2 py-1">
                                {selectedItem.data.gaNumber || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Model Type</p>
                              <p className="font-bold text-base-text mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1">
                                {selectedItem.data.model || 'Standard'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Total Parts / Items</p>
                              <p className="font-mono font-bold text-sm mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 text-base-text">
                                {selectedItem.data.items?.length || 0} items
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Estimated Total Mass</p>
                              <p className="font-mono font-bold text-sm mt-1 bg-base-surface2 border border-base-border rounded px-2 py-1 text-base-accent">
                                {(selectedItem.data.items || []).reduce((acc: number, cur: any) => acc + (Number(cur.weightPerUnit || 0) * Number(cur.quantity || 1)), 0).toLocaleString()} kg
                              </p>
                            </div>
                          </div>

                          {selectedItem.data.notes && (
                            <div className="border-t border-base-border pt-3.5 space-y-1">
                              <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">BOM Remarks / Notes</p>
                              <p className="text-xs text-base-text bg-base-surface3 border border-base-border p-2 rounded-lg italic">
                                "{selectedItem.data.notes}"
                              </p>
                            </div>
                          )}

                          {/* BOM Items Preview */}
                          {selectedItem.data.items?.length > 0 && (
                            <div className="border-t border-base-border pt-3.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-condensed font-extrabold uppercase tracking-widest text-base-muted">Sample Parts Preview</p>
                                <span className="text-[9px] text-base-muted font-mono">Top {Math.min(5, selectedItem.data.items.length)} of {selectedItem.data.items.length}</span>
                              </div>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {selectedItem.data.items.slice(0, 5).map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-[11px] p-2 bg-base-surface3 border border-base-border rounded-lg">
                                    <div className="min-w-0 flex-1 pr-2">
                                      <p className="font-mono font-bold text-base-text truncate">{item.partNumber}</p>
                                      <p className="text-[10px] text-base-muted truncate">{item.description} ({item.subAssembly || 'General'})</p>
                                    </div>
                                    <div className="text-right shrink-0 font-mono">
                                      <p className="font-bold text-base-accent">{item.quantity} {item.unit || 'pcs'}</p>
                                      <p className="text-[9px] text-base-muted">{item.material || 'N/A'}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {setActiveTab && (
                            <button
                              onClick={() => {
                                setActiveTab('bom');
                                setIsSearchOpen(false);
                              }}
                              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-condensed font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
                            >
                              <span>Navigate to BOM Master Templates</span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-base-border bg-base-surface2 flex items-center justify-between shrink-0 text-[10px] text-base-muted uppercase tracking-wider font-condensed font-bold">
              <div className="flex items-center gap-4">
                <span>⚡ Use Up/Down arrows to select</span>
                <span>⏎ to inspect</span>
              </div>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="px-4 py-2 bg-base-surface border border-base-border hover:bg-base-surface3 text-base-text transition-colors rounded-lg font-condensed font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
