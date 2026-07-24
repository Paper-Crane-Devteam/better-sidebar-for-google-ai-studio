import { useState, useEffect, useCallback } from 'react';
import { browser } from 'wxt/browser';

interface GeminiSettings {
  sidebarWidth: number;
  chatWidth: number;
  inputWidth: number;
  hideBrand: boolean;
  hideDisclaimer: boolean;
  hideUpgrade: boolean;
  zenMode: boolean;
  showSmartScrollbar: boolean;
  autoHideInput: boolean;
  showHotkeyHelper: boolean;
  slashCommand: boolean;
}

const STORAGE_KEY = 'better-sidebar-for-gemini-settings';

export const usePopupGeminiSettings = () => {
  const [settings, setSettings] = useState<GeminiSettings | null>(null);

  // Initial load
  useEffect(() => {
    browser.storage.local.get(STORAGE_KEY).then((res) => {
      if (res[STORAGE_KEY]) {
        try {
          const parsed = JSON.parse(res[STORAGE_KEY]);
          if (parsed.state?.enhancedFeatures?.gemini) {
            setSettings(parsed.state.enhancedFeatures.gemini);
          }
        } catch (e) {
          console.error('Failed to parse gemini settings', e);
        }
      }
    });

    // Listen for changes (e.g. if updated elsewhere)
    const listener = (changes: any) => {
      if (changes[STORAGE_KEY]?.newValue) {
        try {
          const parsed = JSON.parse(changes[STORAGE_KEY].newValue);
          if (parsed.state?.enhancedFeatures?.gemini) {
            setSettings(parsed.state.enhancedFeatures.gemini);
          }
        } catch (e) {}
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof GeminiSettings>(key: K, value: GeminiSettings[K]) => {
      // Optimistic update
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

      // Save to storage
      const res = await browser.storage.local.get(STORAGE_KEY);
      if (res[STORAGE_KEY]) {
        try {
          const parsed = JSON.parse(res[STORAGE_KEY]);
          parsed.state.enhancedFeatures.gemini[key] = value;
          await browser.storage.local.set({
            [STORAGE_KEY]: JSON.stringify(parsed),
          });
        } catch (e) {
          console.error('Failed to update gemini settings', e);
        }
      }
    },
    []
  );

  return { settings, updateSetting };
};
