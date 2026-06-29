import React from 'react';
import { User, Project, ProblemReport, InspectionRequest } from '../../types';
import ThemeToggle from '../ThemeToggle';
import { 
  Menu, X, Folder, Key, LogOut,
  LayoutGrid, AlertTriangle, Clock, CheckCircle, Archive, ClipboardCheck, Flame, FileText, Users, ShieldCheck, BarChart2 
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
  Users,
  ShieldCheck,
  BarChart2
};

interface AppMobileMenuProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  allowedTabs: { id: string; label: string; icon: string; access: any }[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  sectionGroups: { title: string; items: string[] }[];
  projects: Project[];
  problemReports: ProblemReport[];
  inspections: InspectionRequest[];
  currentUser: User;
  onLogout: () => void;
  onChangePassword: () => void;
}

export function AppMobileMenu({
  mobileMenuOpen,
  setMobileMenuOpen,
  allowedTabs,
  activeTab,
  setActiveTab,
  sectionGroups,
  projects,
  problemReports,
  inspections,
  currentUser,
  onLogout,
  onChangePassword,
}: AppMobileMenuProps) {
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
          <aside className="fixed inset-y-0 left-0 w-64 bg-base-surface border-r border-base-border flex flex-col z-[100] select-none md:hidden transition-transform duration-300 shadow-2xl">
            <div className="h-14 border-b border-base-border flex items-center justify-between px-4 shrink-0">
              <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]">
                AUSTIN <span className="text-base-text">BATAM</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
              {sectionGroups.map((group, grpIdx) => {
                const groupTabs = allowedTabs.filter(t => group.items.includes(t.id));
                if (groupTabs.length === 0) return null;

                return (
                  <div key={grpIdx} className="space-y-1">
                    <div className="px-3 text-[9px] font-condensed font-bold uppercase tracking-widest text-base-muted/50 py-1">
                      {group.title}
                    </div>
                    {groupTabs.map(t => {
                      const IconComponent = IconMap[t.icon] || Folder;
                      const isTabActive = activeTab === t.id;

                      const hasCountsComp = t.id === 'completed';
                      const compCount = projects.filter(p => p.status === 'completed' && !p.isArchived).length;
                      const hasCountsArc = t.id === 'archive';
                      const arcCount = projects.filter(p => p.isArchived).length;
                      const hascountsProb = t.id === 'focus24';
                      const openProbCount = problemReports.filter(r => r.status === 'Open').length;
                      const hasCountsInsp = t.id === 'inspections';
                      const pendingInspCount = inspections.filter(ins => ins.status === 'Requested').length;

                      let badgeCount = 0;
                      let badgeBg = 'bg-base-accent-dim text-base-accent border border-base-accent/10';
                      if (hasCountsComp) {
                        badgeCount = compCount;
                        badgeBg = 'bg-base-green/10 text-base-green border border-base-green/20';
                      } else if (hasCountsArc) {
                        badgeCount = arcCount;
                      } else if (hascountsProb) {
                        badgeCount = openProbCount;
                        badgeBg = 'bg-red-500 text-white animate-pulse';
                      } else if (hasCountsInsp) {
                        badgeCount = pendingInspCount;
                        badgeBg = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                      }

                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTab(t.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isTabActive
                              ? 'bg-base-accent-dim/15 text-base-accent border-l-2 border-base-accent font-extrabold pl-2.5'
                              : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
                          }`}
                        >
                          <IconComponent className="h-4.5 w-4.5 shrink-0" />
                          <span className="flex-1 text-left truncate">{t.label}</span>
                          {badgeCount > 0 && (
                            <span className={`px-1.5 py-0.5 rounded font-condensed font-extrabold text-[9px] ${badgeBg}`}>
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

            <div className="border-t border-base-border p-4 bg-base-surface2 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-sm uppercase">
                  {currentUser.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0 leading-none">
                  <h4 className="text-xs font-bold text-base-text truncate">{currentUser.name}</h4>
                  <span className="text-[9px] font-condensed font-semibold text-base-accent uppercase tracking-wider block mt-0.5">{currentUser.role}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-condensed uppercase tracking-wider font-extrabold text-base-muted">
                <button 
                  onClick={() => { onChangePassword(); setMobileMenuOpen(false); }} 
                  className="flex items-center gap-1 hover:text-base-accent cursor-pointer"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>Update Key</span>
                </button>
                <button 
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }} 
                  className="flex items-center gap-1 hover:text-base-red cursor-pointer"
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
