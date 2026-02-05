import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { detectPlatform, Platform } from '../types/platform';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  layoutDensity: 'compact' | 'relaxed';
  newChatBehavior: 'current-tab' | 'new-tab';
  autoScanLibrary: boolean;
  overlayPosition: 'bottom-left' | 'bottom-right';
  language: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'pt' | 'es' | 'ru';
  explorer: {
    viewMode: 'tree' | 'timeline';
    sortOrder: 'alpha' | 'date';
    ignoredFolders: string[];
    enableRightClickRename: boolean;
  };
  shortcuts: {
    favorites: boolean;
    build: boolean;
    dashboard: boolean;
    documentation: boolean;
    myStuff: boolean;
    gems: boolean;
    originalUI: boolean;
  };

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLayoutDensity: (density: 'compact' | 'relaxed') => void;
  setNewChatBehavior: (behavior: 'current-tab' | 'new-tab') => void;
  setAutoScanLibrary: (enabled: boolean) => void;
  setOverlayPosition: (position: 'bottom-left' | 'bottom-right') => void;
  setLanguage: (
    language: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'pt' | 'es' | 'ru',
  ) => void;
  setExplorerViewMode: (mode: 'tree' | 'timeline') => void;
  setExplorerSortOrder: (order: 'alpha' | 'date') => void;
  setExplorerIgnoredFolders: (folders: string[]) => void;
  setExplorerEnableRightClickRename: (enabled: boolean) => void;
  setShortcutVisible: (
    key: keyof SettingsState['shortcuts'],
    visible: boolean,
  ) => void;
}

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const result = await browser?.storage?.local?.get(name);
      return (result?.[name] as string) || null;
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await browser.storage.local.set({ [name]: value });
    } catch (e) {
      console.error('Error writing to storage:', e);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await browser.storage.local.remove(name);
    } catch (e) {
      console.error('Error removing from storage:', e);
    }
  },
};

// Get default language from browser
const getDefaultLanguage = (): 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'pt' | 'es' | 'ru' => {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-Hant')) {
    return 'zh-TW';
  }
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  if (browserLang.startsWith('ja')) {
    return 'ja';
  }
  if (browserLang.startsWith('pt')) {
    return 'pt';
  }
  if (browserLang.startsWith('es')) {
    return 'es';
  }
  if (browserLang.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};

const platform = detectPlatform();

// Determine storage key
const getStorageName = () => {
  if (platform === Platform.GEMINI) {
    return 'better-sidebar-for-gemini-settings';
  }
  return 'prompt-manager-for-google-ai-studio-settings';
};

// Determine localStorage key for theme preference sync
const getLocalStorageKey = () => {
  if (platform === Platform.GEMINI) {
    return 'geminiUserPreference';
  }
  return 'aiStudioUserPreference';
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      layoutDensity: 'relaxed',
      newChatBehavior: 'current-tab',
      autoScanLibrary: false,
      overlayPosition: 'bottom-left',
      language: getDefaultLanguage(),
      explorer: {
        viewMode: 'tree',
        sortOrder: 'date',
        ignoredFolders: [],
        enableRightClickRename: false,
      },
      shortcuts: {
        favorites: true,
        build: true,
        dashboard: true,
        documentation: true,
        myStuff: true,
        gems: true,
        originalUI: true,
      },

      setTheme: (theme) => {
        set({ theme });
        try {
          if (typeof localStorage !== 'undefined') {
            const key = getLocalStorageKey();
            const stored = localStorage.getItem(key);
            if (stored) {
              const prefs = JSON.parse(stored);
              prefs.theme = theme;
              localStorage.setItem(key, JSON.stringify(prefs));
            }
          }
        } catch (e) {
          // ignore
        }
      },
      setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
      setNewChatBehavior: (newChatBehavior) => set({ newChatBehavior }),
      setAutoScanLibrary: (autoScanLibrary) => set({ autoScanLibrary }),
      setOverlayPosition: (overlayPosition) => set({ overlayPosition }),
      setLanguage: (language) => set({ language }),
      setExplorerViewMode: (viewMode) =>
        set((state) => ({ explorer: { ...state.explorer, viewMode } })),
      setExplorerSortOrder: (sortOrder) =>
        set((state) => ({ explorer: { ...state.explorer, sortOrder } })),
      setExplorerIgnoredFolders: (ignoredFolders) =>
        set((state) => ({ explorer: { ...state.explorer, ignoredFolders } })),
      setExplorerEnableRightClickRename: (enableRightClickRename) =>
        set((state) => ({
          explorer: { ...state.explorer, enableRightClickRename },
        })),
      setShortcutVisible: (key, visible) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [key]: visible },
        })),
    }),
    {
      name: getStorageName(),
      storage: createJSONStorage(() => storage),
    },
  ),
);
