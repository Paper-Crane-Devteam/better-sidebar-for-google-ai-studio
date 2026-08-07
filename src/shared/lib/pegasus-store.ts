import { create } from 'zustand';
import {
  initPegasusZustandStoreBackend,
  pegasusZustandStoreReady,
} from '@webext-pegasus/store-zustand';
import type { ThemePresetId } from '@/themes/types';

// Get default language from browser
const getDefaultLanguage = ():
  | 'zh-CN'
  | 'zh-TW'
  | 'en'
  | 'ja'
  | 'pt'
  | 'es'
  | 'ru' => {
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

export interface SelectionToolbarConfig {
  enabled: boolean;
  reference: boolean;
  explain: boolean;
  saveAsSnippet: boolean;
  summarize: boolean;
  copy: boolean;
  saveAsPrompt: boolean;
  /** @deprecated use `copy` instead */
  copyAsMarkdown?: boolean;
}

export interface GeminiEnhancedFeatures {
  defaultModel: 'default' | 'flash-lite' | 'flash' | 'pro';
  sidebarWidth: number;
  chatWidth: number;
  inputWidth: number;
  hideBrand: boolean;
  hideDisclaimer: boolean;
  hideUpgrade: boolean;
  showTopBarTag: boolean;
  zenMode: boolean;
  showSmartScrollbar: boolean;
  autoHideInput: boolean;
  showHotkeyHelper: boolean;
  slashCommand: boolean;
  removeWatermark: boolean;
  tableAutoWidth: boolean;
  selectionToolbar: SelectionToolbarConfig;
}

export interface AIStudioEnhancedFeatures {
  sidebarWidth: number;
  autoHideInput: boolean;
  autoHideRunSettings: boolean;
  showHotkeyHelper: boolean;
  slashCommand: boolean;
}

interface PegasusState {
  language: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'pt' | 'es' | 'ru';
  gdriveAutoSync: boolean;
  gdriveSyncing: boolean;
  theme: 'light' | 'dark' | 'system';
  customTheme: ThemePresetId | null;
  backupEnabled: boolean;
  backupMaxSlots: number;
  enhancedFeatures: {
    gemini: GeminiEnhancedFeatures;
    aistudio: AIStudioEnhancedFeatures;
  };
  setGeminiEnhancedFeature: <K extends keyof GeminiEnhancedFeatures>(
    key: K,
    value: GeminiEnhancedFeatures[K],
  ) => void;
  setAIStudioEnhancedFeature: <K extends keyof AIStudioEnhancedFeatures>(
    key: K,
    value: AIStudioEnhancedFeatures[K],
  ) => void;
  setLanguage: (
    language: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'pt' | 'es' | 'ru',
  ) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCustomTheme: (themeId: ThemePresetId | null) => void;
  setGdriveAutoSync: (enabled: boolean) => void;
  setGdriveSyncing: (syncing: boolean) => void;
  setBackupEnabled: (enabled: boolean) => void;
  setBackupMaxSlots: (slots: number) => void;
}

export const usePegasusStore = create<PegasusState>()((set) => ({
  language: getDefaultLanguage(),
  gdriveAutoSync: true,
  gdriveSyncing: false,
  theme: 'system',
  customTheme: null,
  backupEnabled: true,
  backupMaxSlots: 5,
  enhancedFeatures: {
    gemini: {
      defaultModel: 'default',
      sidebarWidth: 360,
      chatWidth: 46,
      inputWidth: 42,
      hideBrand: false,
      hideDisclaimer: false,
      hideUpgrade: false,
      showTopBarTag: true,
      zenMode: false,
      showSmartScrollbar: true,
      autoHideInput: false,
      showHotkeyHelper: true,
      slashCommand: true,
      removeWatermark: true,
      tableAutoWidth: false,
      selectionToolbar: {
        enabled: true,
        reference: true,
        explain: true,
        saveAsSnippet: true,
        summarize: false,
        copy: true,
        saveAsPrompt: true,
      },
    },
    aistudio: {
      sidebarWidth: 320,
      autoHideInput: false,
      autoHideRunSettings: false,
      showHotkeyHelper: true,
      slashCommand: true,
    },
  },
  setGeminiEnhancedFeature: (key, value) =>
    set((state) => ({
      ...state,
      enhancedFeatures: {
        ...state.enhancedFeatures,
        gemini: {
          ...state.enhancedFeatures.gemini,
          [key]: value,
        },
      },
    })),
  setAIStudioEnhancedFeature: (key, value) =>
    set((state) => ({
      ...state,
      enhancedFeatures: {
        ...state.enhancedFeatures,
        aistudio: {
          ...state.enhancedFeatures.aistudio,
          [key]: value,
        },
      },
    })),
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
  setCustomTheme: (customTheme) => set({ customTheme }),
  setGdriveAutoSync: (gdriveAutoSync) => set({ gdriveAutoSync }),
  setGdriveSyncing: (gdriveSyncing) => set({ gdriveSyncing }),
  setBackupEnabled: (backupEnabled) => set({ backupEnabled }),
  setBackupMaxSlots: (backupMaxSlots) =>
    set({ backupMaxSlots: Math.min(Math.max(backupMaxSlots, 1), 20) }),
}));

export const STORE_NAME = 'pegasusGlobalStore';

/**
 * Default values for enhancedFeatures sub-objects.
 * Used to backfill missing keys when store is rehydrated from storage
 * (e.g. aistudio was added after a user already had gemini settings persisted).
 */
const DEFAULT_ENHANCED_FEATURES: PegasusState['enhancedFeatures'] = {
  gemini: {
    defaultModel: 'default',
    sidebarWidth: 360,
    chatWidth: 46,
    inputWidth: 42,
    hideBrand: false,
    hideDisclaimer: false,
    hideUpgrade: false,
    showTopBarTag: true,
    zenMode: false,
    showSmartScrollbar: true,
    autoHideInput: false,
    showHotkeyHelper: true,
    slashCommand: true,
    removeWatermark: true,
    tableAutoWidth: false,
    selectionToolbar: {
      enabled: true,
      reference: true,
      explain: true,
      saveAsSnippet: true,
      summarize: false,
      copy: true,
      saveAsPrompt: true,
    },
  },
  aistudio: {
    sidebarWidth: 320,
    autoHideInput: false,
    autoHideRunSettings: false,
    showHotkeyHelper: true,
    slashCommand: true,
  },
};

/**
 * Ensures enhancedFeatures has all expected platform sub-objects after rehydration.
 * `@webext-pegasus/store-zustand` uses shallow setState which can lose nested defaults
 * if the persisted state was created before a new platform key was introduced.
 */
function ensureEnhancedFeaturesDefaults() {
  const state = usePegasusStore.getState();
  const ef = state.enhancedFeatures;
  let patched = false;
  const updated = { ...ef };

  for (const [key, defaults] of Object.entries(DEFAULT_ENHANCED_FEATURES)) {
    const k = key as keyof typeof DEFAULT_ENHANCED_FEATURES;
    const persisted = updated[k];

    // Whole platform object missing — take defaults wholesale
    if (!persisted) {
      updated[k] = defaults as any;
      patched = true;
      continue;
    }

    // Platform object exists but may predate newly added feature keys.
    // Backfill only the missing ones so user choices are preserved.
    const merged = { ...(defaults as any) };
    let platformPatched = false;
    for (const featureKey of Object.keys(defaults as any)) {
      if ((persisted as any)[featureKey] === undefined) {
        platformPatched = true;
      } else {
        merged[featureKey] = (persisted as any)[featureKey];
      }
    }

    if (platformPatched) {
      updated[k] = merged;
      patched = true;
    }
  }

  if (patched) {
    usePegasusStore.setState({ enhancedFeatures: updated });
  }
}

export const initPegasusBackendStore = async () => {
  await initPegasusZustandStoreBackend(STORE_NAME, usePegasusStore, {
    storageStrategy: 'local',
  });
  ensureEnhancedFeaturesDefaults();
};

export const getPegasusStoreReady = async () => {
  await pegasusZustandStoreReady(STORE_NAME, usePegasusStore);
  ensureEnhancedFeaturesDefaults();
};
