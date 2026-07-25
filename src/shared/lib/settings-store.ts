import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { detectPlatform, Platform } from '../types/platform';
import {
  syncGeminiTheme,
  syncAiStudioTheme,
  syncChatGPTTheme,
} from './utils/utils';
import type { ThemePresetId } from '@/themes/types';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  /** Custom theme preset ID, or null for default Gemini theme */
  customTheme: ThemePresetId | null;
  /** Gemini sidebar base style: 'default' (v2) or 'classic' (pre-v2 blue-tinted) */
  geminiStyle: 'default' | 'classic';
  newChatBehavior: 'current-tab' | 'new-tab';
  autoScanLibrary: boolean;
  overlayPosition: { x: number; y: number };
  lastSelectedGemId: string | null;
  lastSelectedNotebookId: string | null;
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
    images: boolean;
    apps: boolean;
    codex: boolean;
    myStuff: boolean;
    gems: boolean;
    notebooks: boolean;
    originalUI: boolean;
  };
  integrations: {
    notion: {
      apiKey: string;
      parentPageId: string;
      parentPageTitle: string;
      /** Cached connection status */
      connectionStatus: 'idle' | 'ok' | 'error';
      connectionName: string;
      connectionError: string;
      /** Cached pages list */
      cachedPages: { id: string; title: string }[];
      /** Timestamp of last successful fetch */
      lastFetchedAt: number | null;
    };
  };
  /** Persisted height of the outline panel in pixels */
  outlineHeight: number;
  /** Cached page index for the theme grid pagination (session-only, not persisted) */
  themeGridPage: number;

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCustomTheme: (themeId: ThemePresetId | null) => void;
  setGeminiStyle: (style: 'default' | 'classic') => void;
  setNewChatBehavior: (behavior: 'current-tab' | 'new-tab') => void;
  setAutoScanLibrary: (enabled: boolean) => void;
  setOverlayPosition: (position: { x: number; y: number }) => void;
  setExplorerViewMode: (mode: 'tree' | 'timeline') => void;
  setExplorerSortOrder: (order: 'alpha' | 'date') => void;
  setExplorerIgnoredFolders: (folders: string[]) => void;
  setExplorerEnableRightClickRename: (enabled: boolean) => void;
  setShortcutVisible: (
    key: keyof SettingsState['shortcuts'],
    visible: boolean,
  ) => void;
  setLastSelectedGemId: (id: string | null) => void;
  setLastSelectedNotebookId: (id: string | null) => void;
  setNotionConfig: (
    config: Partial<SettingsState['integrations']['notion']>,
  ) => void;
  setOutlineHeight: (height: number) => void;
  setThemeGridPage: (page: number) => void;
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

const platform = detectPlatform();

// Determine storage key
const getStorageName = () => {
  if (platform === Platform.GEMINI) {
    return 'better-sidebar-for-gemini-settings';
  }
  if (platform === Platform.AI_STUDIO) {
    return 'prompt-manager-for-google-ai-studio-settings';
  }
  if (platform === Platform.CHATGPT) {
    return 'prompt-manager-for-chatgpt-settings';
  }
  if (platform === Platform.CLAUDE) {
    return 'prompt-manager-for-claude-settings';
  }
  return 'better-sidebar-for-unknown-settings';
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      customTheme: null,
      geminiStyle: 'default',
      newChatBehavior: 'current-tab',
      autoScanLibrary: false,
      overlayPosition: { x: 16, y: 16 },
      lastSelectedGemId: null,
      lastSelectedNotebookId: null,
      explorer: {
        viewMode: 'tree',
        sortOrder: 'date',
        ignoredFolders: [],
        enableRightClickRename: true,
      },
      shortcuts: {
        favorites: false,
        build: true,
        dashboard: true,
        documentation: true,
        images: true,
        apps: true,
        codex: true,
        myStuff: true,
        gems: true,
        notebooks: true,
        originalUI: true,
      },
      integrations: {
        notion: {
          apiKey: '',
          parentPageId: '',
          parentPageTitle: '',
          connectionStatus: 'idle',
          connectionName: '',
          connectionError: '',
          cachedPages: [],
          lastFetchedAt: null,
        },
      },
      outlineHeight: 200,
      themeGridPage: 0,

      setTheme: (theme) => {
        set({ theme });
        if (platform === Platform.GEMINI) {
          syncGeminiTheme(theme);
        }
        if (platform === Platform.AI_STUDIO) {
          syncAiStudioTheme(theme);
        }
        if (platform === Platform.CHATGPT) {
          syncChatGPTTheme(theme);
        }
        // if(platform === Platform.CLAUDE) {
        //   syncClaudeTheme(theme)
        // }
      },
      setCustomTheme: (themeId) => {
        set({ customTheme: themeId });
        // Theme engine apply/remove is handled by the content script
        // that subscribes to this store change
      },
      setGeminiStyle: (style) => {
        set({ geminiStyle: style });
      },
      setNewChatBehavior: (newChatBehavior) => set({ newChatBehavior }),
      setAutoScanLibrary: (autoScanLibrary) => set({ autoScanLibrary }),
      setOverlayPosition: (overlayPosition) => set({ overlayPosition }),
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
      setLastSelectedGemId: (id) => set({ lastSelectedGemId: id }),
      setLastSelectedNotebookId: (id) => set({ lastSelectedNotebookId: id }),
      setNotionConfig: (config) =>
        set((state) => ({
          integrations: {
            ...state.integrations,
            notion: { ...state.integrations.notion, ...config },
          },
        })),
      setOutlineHeight: (height) => set({ outlineHeight: height }),
      setThemeGridPage: (page) => set({ themeGridPage: page }),
    }),
    {
      name: getStorageName(),
      storage: createJSONStorage(() => storage),
      version: 5,
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { themeGridPage, ...rest } = state;
        return rest;
      },
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Migrate old string position to {x, y} coordinates (bottom-left offset from bottom-left corner)
          const old = persistedState.overlayPosition;
          if (typeof old === 'string') {
            persistedState.overlayPosition =
              old === 'bottom-right'
                ? { x: window.innerWidth - 60, y: 16 }
                : { x: 16, y: 16 };
          }
        }
        if (version < 5) {
          // enhancedFeatures moved to pegasus-store; strip from persisted settings
          delete persistedState.enhancedFeatures;
          delete persistedState.enableResizableSidebar;
          delete persistedState.customSidebarWidth;
        }
        return persistedState;
      },
    },
  ),
);

// Listen to storage changes to sync state across contexts (e.g. from popup)
if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes) => {
    const storageName = getStorageName();
    if (changes[storageName]) {
      useSettingsStore.persist.rehydrate();
    }
  });
}
