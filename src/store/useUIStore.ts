import { create } from 'zustand';

export interface DeleteConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface UIStore {
  // Navigation & Tabs
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Mobile Menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobileMenu: () => void;

  // Filters & Search
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  reportDate: string;
  setReportDate: (date: string) => void;
  projectSearchQuery: string;
  setProjectSearchQuery: (query: string) => void;
  currentTabMonthFilter: string;
  setCurrentTabMonthFilter: (filter: string) => void;

  // Modals & Dialogs
  deleteConfirm: DeleteConfirmState;
  setDeleteConfirm: (confirmState: DeleteConfirmState | ((prev: DeleteConfirmState) => DeleteConfirmState)) => void;
  closeDeleteConfirm: () => void;

  // Spotlight Modal State
  spotlightProjectId: string | null;
  isSpotlightOpen: boolean;
  openSpotlight: (projectId: string) => void;
  closeSpotlight: () => void;

  // Shop Floor Mode (Tablet-Friendly)
  shopFloorMode: boolean;
  setShopFloorMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  toggleShopFloorMode: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  // Navigation & Tabs
  activeTab: 'dash',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Mobile Menu
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) =>
    set((state) => ({
      mobileMenuOpen: typeof open === 'function' ? open(state.mobileMenuOpen) : open
    })),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

  // Shop Floor Mode
  shopFloorMode: typeof window !== 'undefined' ? localStorage.getItem('austin_shopfloor_mode') === 'true' : false,
  setShopFloorMode: (mode) =>
    set((state) => {
      const nextMode = typeof mode === 'function' ? mode(state.shopFloorMode) : mode;
      try {
        localStorage.setItem('austin_shopfloor_mode', nextMode ? 'true' : 'false');
      } catch {}
      return { shopFloorMode: nextMode };
    }),
  toggleShopFloorMode: () =>
    set((state) => {
      const nextMode = !state.shopFloorMode;
      try {
        localStorage.setItem('austin_shopfloor_mode', nextMode ? 'true' : 'false');
      } catch {}
      return { shopFloorMode: nextMode };
    }),

  // Filters & Search
  selectedMonth: new Date().toISOString().slice(0, 7),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  reportDate: new Date().toISOString().slice(0, 10),
  setReportDate: (reportDate) => set({ reportDate }),
  projectSearchQuery: '',
  setProjectSearchQuery: (projectSearchQuery) => set({ projectSearchQuery }),
  currentTabMonthFilter: '',
  setCurrentTabMonthFilter: (currentTabMonthFilter) => set({ currentTabMonthFilter }),

  // Modals & Dialogs
  deleteConfirm: {
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  },
  setDeleteConfirm: (confirmState) =>
    set((state) => ({
      deleteConfirm: typeof confirmState === 'function' ? confirmState(state.deleteConfirm) : confirmState
    })),
  closeDeleteConfirm: () =>
    set({
      deleteConfirm: {
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
      }
    }),

  // Spotlight Modal State
  spotlightProjectId: null,
  isSpotlightOpen: false,
  openSpotlight: (spotlightProjectId) => set({ spotlightProjectId, isSpotlightOpen: true }),
  closeSpotlight: () => set({ isSpotlightOpen: false, spotlightProjectId: null })
}));
