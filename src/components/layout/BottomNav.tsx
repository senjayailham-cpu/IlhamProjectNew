import React from 'react';
import { LayoutGrid, Folder, Calendar, Package, Menu, Factory, Clock, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { useUIStore } from '../../store';
import { User, UserRole } from '../../types';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  totalMenuCount?: number;
  currentUser?: User | null;
}

export default function BottomNav({
  activeTab,
  setActiveTab,
  setMobileMenuOpen,
  totalMenuCount = 0,
  currentUser
}: BottomNavProps) {
  const shopFloorMode = useUIStore((s) => s.shopFloorMode);

  // Role-adaptive mobile items
  const items = React.useMemo(() => {
    if (shopFloorMode) {
      return [
        { id: 'shopfloor', label: 'Shop Floor', icon: Factory },
        { id: 'timesheet', label: 'Timesheet', icon: Clock },
        { id: 'projects', label: 'Progress', icon: Folder },
        { id: 'materials', label: 'Materials', icon: Package },
        { id: 'inspections', label: 'QC', icon: ClipboardCheck },
        { id: 'more', label: 'More', icon: Menu, isMenuTrigger: true }
      ];
    }

    if (currentUser?.role === 'coordinator' || (currentUser?.role as string) === 'coordinator') {
      return [
        { id: 'shopfloor', label: 'Shop Floor', icon: Factory },
        { id: 'timesheet', label: 'Timesheet', icon: Clock },
        { id: 'projects', label: 'Projects', icon: Folder },
        { id: 'materials', label: 'Materials', icon: Package },
        { id: 'inspections', label: 'QC', icon: ClipboardCheck },
        { id: 'more', label: 'More', icon: Menu, isMenuTrigger: true }
      ];
    }

    if (currentUser?.role === 'quality control' || (currentUser?.role as string) === 'qc') {
      return [
        { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
        { id: 'focus24', label: '24h Focus', icon: AlertTriangle },
        { id: 'projects', label: 'Projects', icon: Folder },
        { id: 'materials', label: 'Materials', icon: Package },
        { id: 'more', label: 'More', icon: Menu, isMenuTrigger: true }
      ];
    }

    // Default for Admin, Manager, PC, Viewer
    return [
      { id: 'dash', label: 'Dashboard', icon: LayoutGrid },
      { id: 'projects', label: 'Projects', icon: Folder },
      { id: 'schedule', label: 'Schedule', icon: Calendar },
      { id: 'materials', label: 'Materials', icon: Package },
      { id: 'more', label: 'More', icon: Menu, isMenuTrigger: true }
    ];
  }, [shopFloorMode, currentUser?.role]);

  const hiddenMenuCount = Math.max(0, totalMenuCount - (items.length - 1));

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-base-surface/95 backdrop-blur-md border-t border-base-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-all"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div className="flex items-center justify-around h-[58px] px-1 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = !item.isMenuTrigger && (
            activeTab === item.id || 
            (item.id === 'schedule' && (activeTab === 'gantt' || activeTab === 'timeline')) ||
            (item.id === 'projects' && (activeTab === 'current' || activeTab === 'completed' || activeTab === 'archived'))
          );

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isMenuTrigger) {
                  setMobileMenuOpen(true);
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer touch-manipulation relative rounded-lg ${
                isActive 
                  ? 'text-base-accent font-black' 
                  : 'text-base-muted hover:text-base-text'
              }`}
              style={{ minHeight: '48px' }}
            >
              {/* Active top pill indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-base-accent shadow-xs" />
              )}
              
              <div className="relative mt-1">
                <Icon className={isActive ? 'h-[22px] w-[22px] text-base-accent stroke-[2.5]' : 'h-[20px] w-[20px] stroke-[1.75]'} />
                {item.isMenuTrigger && hiddenMenuCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-base-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center font-mono leading-none shadow-xs">
                    {hiddenMenuCount > 9 ? '9+' : hiddenMenuCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-condensed tracking-tight mt-0.5 whitespace-nowrap leading-none ${isActive ? 'text-base-accent font-extrabold' : 'text-base-muted font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
