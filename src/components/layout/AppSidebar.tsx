import React from 'react';
import { User, Project, ProblemReport, InspectionRequest } from '../../types';
import { 
  ChevronLeft, ChevronRight, Folder, Key, LogOut,
  LayoutGrid, AlertTriangle, Clock, CheckCircle, Archive, ClipboardCheck, Flame, FileText, Users, ShieldCheck, BarChart2, Package, Layers, Database
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
  BarChart2,
  Package,
  Layers,
  Database
};

interface AppSidebarProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
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

export function AppSidebar({
  sidebarCollapsed,
  toggleSidebar,
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
}: AppSidebarProps) {
  return (
    <aside className={`hidden md:flex flex-col bg-base-surface border-r border-base-border fixed top-0 bottom-0 left-0 z-40 select-none transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
      
      {/* Header Branding Logo */}
      <div className="h-14 border-b border-base-border flex items-center justify-between px-4 shrink-0">
        {!sidebarCollapsed ? (
          <>
            <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]">
              AUSTIN <span className="text-base-text">BATAM</span>
            </div>
            <button 
              onClick={toggleSidebar} 
              className="p-1 rounded-md hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center relative">
            <div className="font-condensed font-black text-lg tracking-widest text-[#9b1c2e]" title="Austin Batam">
              AB
            </div>
            <button 
              onClick={toggleSidebar} 
              className="absolute -right-1 p-1 rounded-md hover:bg-base-surface2 text-base-muted hover:text-base-text transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Nav Items list grouped inside Sections */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-3 scrollbar-none">
        {sectionGroups.map((group, grpIdx) => {
          const groupTabs = allowedTabs.filter(t => group.items.includes(t.id));
          if (groupTabs.length === 0) return null;

          return (
            <div key={grpIdx} className="space-y-1">
              {!sidebarCollapsed ? (
                <div className="px-3 text-[9px] font-condensed font-bold uppercase tracking-widest text-base-muted/50 py-1 select-none">
                  {group.title}
                </div>
              ) : (
                <div className="border-t border-base-border/50 my-2" />
              )}
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
                    onClick={() => setActiveTab(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all group relative cursor-pointer ${
                      isTabActive
                        ? 'bg-base-accent/10 text-base-accent font-extrabold'
                        : 'text-base-muted hover:text-base-text hover:bg-base-surface2'
                    }`}
                  >
                    {isTabActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-base-accent rounded-r-full" />
                    )}
                    <div className="relative flex items-center">
                      <IconComponent className="h-4 w-4 shrink-0" />
                      {sidebarCollapsed && badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 border border-base-surface animate-pulse" />
                      )}
                    </div>

                    {!sidebarCollapsed && (
                      <span className="flex-1 text-left truncate">{t.label}</span>
                    )}

                    {!sidebarCollapsed && badgeCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded font-condensed font-extrabold text-[9px] ${badgeBg}`}>
                        {badgeCount}
                      </span>
                    )}

                    {/* Hover Tooltip for Collapsed Sidebar */}
                    {sidebarCollapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-base-surface border border-base-border text-[11px] font-condensed font-bold uppercase tracking-wider text-base-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-lg">
                        <span className="flex items-center gap-2">
                          {t.label}
                          {badgeCount > 0 && (
                            <span className={`px-1 rounded text-[8px] font-condensed font-extrabold ${badgeBg}`}>
                              {badgeCount}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Profile User Card */}
      <div className="border-t border-base-border p-3 space-y-2 shrink-0">
        {!sidebarCollapsed ? (
          <div className="flex flex-col space-y-2 bg-base-surface2 p-3 rounded-xl border border-base-border2/40">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-xs uppercase shadow-[0_2px_4px_rgba(0,0,0,0.15)] shrink-0">
                {currentUser.name.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0 leading-none">
                <h4 className="text-xs font-bold text-base-text truncate">{currentUser.name}</h4>
                <span className="text-[9px] font-condensed font-semibold text-base-accent uppercase tracking-wider block mt-0.5">{currentUser.role}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-base-border/50 pt-2 text-[10px] font-condensed uppercase tracking-wider font-extrabold select-none">
              <button 
                onClick={onChangePassword} 
                className="flex items-center gap-1 text-base-muted hover:text-base-accent cursor-pointer"
                title="Change Security Configuration"
              >
                <Key className="h-3 w-3" />
                <span>Config Key</span>
              </button>
              <button 
                onClick={onLogout} 
                className="flex items-center gap-1 text-base-muted hover:text-base-red cursor-pointer"
                title="Disconnect Workspace"
              >
                <LogOut className="h-3 w-3" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3 py-1">
            <div className="h-8 w-8 rounded-full bg-[#9b1c2e] text-white flex items-center justify-center font-black text-xs uppercase cursor-help group relative shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
              {currentUser.name.slice(0, 2)}
              <div className="absolute left-full ml-3 px-2.5 py-1 rounded bg-base-surface border border-base-border text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                <span className="font-condensed font-bold uppercase tracking-wider text-base-accent block">{currentUser.name}</span>
                <span className="text-[10px] text-base-muted block">{currentUser.role}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 select-none">
              <button 
                onClick={onChangePassword} 
                className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-accent transition-colors cursor-pointer" 
                title="Change Password"
              >
                <Key className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={onLogout} 
                className="p-1.5 rounded-lg hover:bg-base-surface2 text-base-muted hover:text-base-red transition-colors cursor-pointer" 
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
