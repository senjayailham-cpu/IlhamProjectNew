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

  // QR Action Panel State
  qrProjectId: string | null;
  isQrPanelOpen: boolean;
  openQrPanel: (projectId: string) => void;
  closeQrPanel: () => void;
  isQrScannerOpen: boolean;
  setQrScannerOpen: (open: boolean) => void;

  // Shop Floor Mode (Tablet-Friendly)
  shopFloorMode: boolean;
  setShopFloorMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  toggleShopFloorMode: () => void;

  // Dark / Light Theme
  theme: 'dark' | 'light' | 'system';
  isDark: boolean;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleTheme: () => void;

  // Custom App Background
  backgroundImage: string;
  backgroundOpacity: number;
  setBackgroundImage: (image: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
  resetBackground: () => void;
}

const getInitialTheme = (): 'dark' | 'light' | 'system' => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {}
  return 'dark';
};

const resolveIsDark = (theme: 'dark' | 'light' | 'system'): boolean => {
  if (typeof window === 'undefined') return true;
  if (theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
};

const applyThemeToDOM = (theme: 'dark' | 'light' | 'system', isDark: boolean) => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  try {
    localStorage.setItem('theme', theme);
  } catch {}

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#0b0f17' : '#f1f5f9');
  }
};

const DEFAULT_BG = '';
const DEFAULT_BG_OPACITY = 0;

const getInitialBackground = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('app_background_image') || '';
  } catch {}
  return '';
};

const getInitialBackgroundOpacity = (): number => {
  if (typeof window === 'undefined') return DEFAULT_BG_OPACITY;
  try {
    const stored = localStorage.getItem('app_background_opacity');
    if (stored !== null) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
    }
  } catch {}
  return DEFAULT_BG_OPACITY;
};

const initialTheme = getInitialTheme();
const initialIsDark = resolveIsDark(initialTheme);
if (typeof window !== 'undefined') {
  applyThemeToDOM(initialTheme, initialIsDark);
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
  closeSpotlight: () => set({ isSpotlightOpen: false, spotlightProjectId: null }),

  // QR Action Panel State
  qrProjectId: null,
  isQrPanelOpen: false,
  openQrPanel: (qrProjectId) => set({ qrProjectId, isQrPanelOpen: true }),
  closeQrPanel: () => set({ isQrPanelOpen: false, qrProjectId: null }),
  isQrScannerOpen: false,
  setQrScannerOpen: (isQrScannerOpen) => set({ isQrScannerOpen }),

  // Dark / Light Theme
  theme: initialTheme,
  isDark: initialIsDark,
  setTheme: (theme) => {
    const isDark = resolveIsDark(theme);
    applyThemeToDOM(theme, isDark);
    set({ theme, isDark });
  },
  toggleTheme: () => {
    const currentIsDark = get().isDark;
    const nextTheme = currentIsDark ? 'light' : 'dark';
    const nextIsDark = !currentIsDark;
    applyThemeToDOM(nextTheme, nextIsDark);
    set({ theme: nextTheme, isDark: nextIsDark });
  },

  // Custom App Background
  backgroundImage: getInitialBackground(),
  backgroundOpacity: getInitialBackgroundOpacity(),
  setBackgroundImage: (backgroundImage) => {
    try {
      localStorage.setItem('app_background_image', backgroundImage);
    } catch {}
    set({ backgroundImage });
  },
  setBackgroundOpacity: (backgroundOpacity) => {
    try {
      localStorage.setItem('app_background_opacity', String(backgroundOpacity));
    } catch {}
    set({ backgroundOpacity });
  },
  resetBackground: () => {
    try {
      localStorage.removeItem('app_background_image');
      localStorage.setItem('app_background_opacity', String(DEFAULT_BG_OPACITY));
    } catch {}
    set({ backgroundImage: DEFAULT_BG, backgroundOpacity: DEFAULT_BG_OPACITY });
  }
}));
