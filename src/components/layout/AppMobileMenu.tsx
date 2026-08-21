import React from 'react';
import { User, Project, ProblemReport, InspectionRequest } from '../../types';
import { useAppStore, useUIStore } from '../../store';
import ThemeToggle from '../ThemeToggle';
import { 
  Menu, X, Folder, Key, LogOut,
  LayoutGrid, AlertTriangle, Clock, CheckCircle, Archive, ClipboardCheck, Flame, FileText, FileBadge, ListTree, Users, ShieldCheck, BarChart2, Package, Layers, Database, Trophy, Calendar, TrendingUp, Factory
} from 'lucide-react';

const IconMap: Record<string, React.ComponentType<any>> = {
  LayoutGrid,
  AlertTriangle,
  Folder,
  Clock,
  CheckCircle,
  Archive,
  ClipboardCheck,
  Flame,
  FileText,
  FileBadge,
  ListTree,
  Users,
  ShieldCheck,
  BarChart2,
  Package,
  Layers,
  Database,
  Trophy,
  Calendar,
  TrendingUp
};

interface AppMobileMenuProps {
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  allowedTabs: { id: string; label: string; icon: string; access: any }[];
  activeTab?: string;
  setActiveTab?: (id: string) => void;
  sectionGroups: { title: string; items: string[] }[];
  projects?: Project[];
  problemReports?: ProblemReport[];
  inspections?: InspectionRequest[];
  currentUser: User;
  onLogout: () => void;
  onChangePassword: () => void;
}

export function AppMobileMenu({
  mobileMenuOpen: propMobileMenuOpen,
  setMobileMenuOpen: propSetMobileMenuOpen,
  allowedTabs,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  sectionGroups,
  projects: propProjects,
  problemReports: propProblemReports,
  inspections: propInspections,
  currentUser,
  onLogout,
  onChangePassword,
}: AppMobileMenuProps) {
  // Read state directly from Zustand stores with fallback to props (dual-read)
  const storeMobileMenuOpen = useUIStore((s) => s.mobileMenuOpen);
  const storeSetMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const storeActiveTab = useUIStore((s) => s.activeTab);
  const storeSetActiveTab = useUIStore((s) => s.setActiveTab);
  const shopFloorMode = useUIStore((s) => s.shopFloorMode);
  const toggleShopFloorMode = useUIStore((s) => s.toggleShopFloorMode);

  const storeProjects = useAppStore((s) => s.projects);
  const storeProblemReports = useAppStore((s) => s.problemReports);
  const storeInspections = useAppStore((s) => s.inspections);

  const mobileMenuOpen = propMobileMenuOpen !== undefined ? propMobileMenuOpen : storeMobileMenuOpen;
  const setMobileMenuOpen = propSetMobileMenuOpen || storeSetMobileMenuOpen;
  const activeTab = propActiveTab || storeActiveTab;
  const setActiveTab = propSetActiveTab || storeSetActiveTab;

  const projects = propProjects?.length ? propProjects : storeProjects;
  const problemReports = propProblemReports?.length ? propProblemReports : storeProblemReports;
  const inspections = propInspections?.length ? propInspections : storeInspections;
  return (
    <>
      {/* MOBILE TOP HEADER BAR */}
      <header className="md:hidden h-14 bg-base-surface border-b border-base-border px-4 flex items-center justify-between sticky top-0 z-40 select-none shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer" 
            title="Open Workspace Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]">
            AUSTIN <span className="text-base-text">BATAM</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Shop Floor Mode Toggle */}
          {(currentUser.role === 'coordinator' || currentUser.role === 'admin' || currentUser.allowedFeatures?.includes('shopfloor')) && (
            <button 
              onClick={() => {
                toggleShopFloorMode();
                if (!shopFloorMode) {
                  setActiveTab('shopfloor');
                }
              }} 
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-condensed font-extrabold uppercase ${
                shopFloorMode ? 'bg-base-warn text-white' : 'hover:bg-base-surface2 text-base-warn'
              }`}
              title={shopFloorMode ? "Exit Shop Floor Mode" : "Switch to Shop Floor Tablet Mode"}
            >
              <Factory className="h-4 w-4" />
              {shopFloorMode && <span className="text-[10px]">SF ON</span>}
            </button>
          )}
          <ThemeToggle />
          <div className="h-7 w-7 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-xs uppercase" title={`${currentUser.name} (${currentUser.role})`}>
            {currentUser.name.slice(0, 2)}
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER SLIDE-IN PANEL */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)} 
            className="fixed inset-0 bg-black/60 z-50 md:hidden transition-opacity duration-300" 
          />
          
          {/* Drawer content frame */}
          <aside 
            className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-base-surface border-r border-base-border flex flex-col z-[100] select-none md:hidden transition-transform duration-300 shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="h-14 border-b border-base-border flex items-center justify-between px-4 shrink-0 bg-base-surface">
              <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e] flex items-center gap-1.5">
                <span>AUSTIN</span> <span className="text-base-text">BATAM</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="p-2 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer touch-manipulation"
                aria-label="Close Menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4 overscroll-contain">
              {sectionGroups.map((group, grpIdx) => {
                const groupTabs = allowedTabs.filter(t => group.items.includes(t.id));
                if (groupTabs.length === 0) return null;

                return (
                  <div key={grpIdx} className="space-y-1">
                    <div className="px-3 text-[10px] font-condensed font-bold uppercase tracking-widest text-base-muted/60 py-1">
                      {group.title}
                    </div>
                    {groupTabs.map(t => {
                      const IconComponent = IconMap[t.icon] || Folder;
                      const isTabActive = activeTab === t.id;

                      const hasCountsComp = t.id === 'completed';
                      const compCount = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
                      const hasCountsArc = t.id === 'archive';
                      const arcCount = projects.filter(p => p.isArchived).length;
                      const hasCountsInsp = t.id === 'inspections';
                      const pendingInspCount = inspections.filter(ins => ins.status === 'Requested').length;

                      let badgeCount = 0;
                      let badgeBg = 'bg-base-accent-dim text-base-accent border border-base-accent/10';
                      if (hasCountsComp) {
                        badgeCount = compCount;
                        badgeBg = 'bg-base-ok-dim text-base-ok border border-base-ok/20';
                      } else if (hasCountsArc) {
                        badgeCount = arcCount;
                      } else if (hasCountsInsp) {
                        badgeCount = pendingInspCount;
                        badgeBg = 'bg-base-warn-dim text-base-warn border border-base-warn/20';
                      }

                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTab(t.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-manipulation min-h-[44px] ${
                            isTabActive
                              ? 'bg-base-accent/10 text-base-accent border-l-3 border-base-accent font-black pl-3 shadow-xs'
                              : 'text-base-muted hover:text-base-text hover:bg-base-surface2 active:bg-base-surface3'
                          }`}
                        >
                          <IconComponent className={`h-4.5 w-4.5 shrink-0 ${isTabActive ? 'text-base-accent' : 'text-base-muted'}`} />
                          <span className="flex-1 text-left truncate font-condensed tracking-wide text-sm">{t.label}</span>
                          {badgeCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full font-condensed font-black text-[10px] ${badgeBg}`}>
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-base-border p-4 bg-base-surface2/80 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-sm uppercase shadow-xs shrink-0">
                  {currentUser.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0 leading-tight">
                  <h4 className="text-xs font-bold text-base-text truncate">{currentUser.name}</h4>
                  <span className="text-[10px] font-condensed font-extrabold text-base-accent uppercase tracking-wider block mt-0.5">{currentUser.role}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-condensed uppercase tracking-wider font-extrabold text-base-muted pt-1 border-t border-base-border/40">
                {(currentUser.role === 'coordinator' || currentUser.role === 'admin' || currentUser.allowedFeatures?.includes('shopfloor')) && (
                  <button 
                    onClick={() => { 
                      toggleShopFloorMode(); 
                      if (!shopFloorMode) {
                        setActiveTab('shopfloor');
                      }
                      setMobileMenuOpen(false); 
                    }} 
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer touch-manipulation ${
                      shopFloorMode ? 'text-base-warn font-black' : 'hover:text-base-warn'
                    }`}
                  >
                    <Factory className="h-3.5 w-3.5" />
                    <span>{shopFloorMode ? 'Exit SF' : 'Shop Floor'}</span>
                  </button>
                )}
                <button 
                  onClick={() => { onChangePassword(); setMobileMenuOpen(false); }} 
                  className="flex items-center gap-1.5 p-1.5 rounded-lg hover:text-base-accent cursor-pointer touch-manipulation"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>Password</span>
                </button>
                <button 
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }} 
                  className="flex items-center gap-1.5 p-1.5 rounded-lg hover:text-base-danger text-base-danger/80 cursor-pointer touch-manipulation"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
