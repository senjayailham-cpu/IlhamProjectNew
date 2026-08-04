import React from 'react';
import { LayoutGrid, Flame, Calendar, Layers, Menu } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  totalMenuCount?: number;
}

export default function BottomNav({
  activeTab,
  setActiveTab,
  setMobileMenuOpen,
  totalMenuCount = 0
}: BottomNavProps) {
  const items = [
    { id: 'dash', label: 'Dashboard', icon: LayoutGrid },
    { id: 'focus24', label: 'Focus 24h', icon: Flame },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'matprocessing', label: 'Mat. Process', icon: Layers },
    { id: 'more', label: 'More', icon: Menu, isMenuTrigger: true }
  ];

  const hiddenMenuCount = Math.max(0, totalMenuCount - 4);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-base-surface border-t border-base-border shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-[56px] px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = !item.isMenuTrigger && (activeTab === item.id || (item.id === 'schedule' && (activeTab === 'gantt' || activeTab === 'timeline')));

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
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 transition-all cursor-pointer ${
                isActive ? 'text-base-accent font-bold' : 'text-base-muted hover:text-base-text'
              }`}
            >
              <div className="relative">
                <Icon className={isActive ? 'h-[22px] w-[22px] text-base-accent' : 'h-[20px] w-[20px]'} />
                {item.isMenuTrigger && hiddenMenuCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-base-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center font-mono leading-none shadow-xs">
                    {hiddenMenuCount > 9 ? '9+' : hiddenMenuCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-condensed tracking-tight mt-0.5 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
