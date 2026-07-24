import { useState, useEffect, useCallback } from 'react';
import { browser } from 'wxt/browser';

interface AIStudioSettings {
  sidebarWidth: number;
  autoHideInput: boolean;
  autoHideRunSettings: boolean;
  showHotkeyHelper: boolean;
  slashCommand: boolean;
}

const STORAGE_KEY = 'prompt-manager-for-google-ai-studio-settings';

export const usePopupAIStudioSettings = () => {
  const [settings, setSettings] = useState<AIStudioSettings | null>(null);

  // Initial load
  useEffect(() => {
    browser.storage.local.get(STORAGE_KEY).then((res) => {
      if (res[STORAGE_KEY]) {
        try {
          const parsed = JSON.parse(res[STORAGE_KEY]);
          if (parsed.state?.enhancedFeatures?.aistudio) {
            setSettings(parsed.state.enhancedFeatures.aistudio);
          }
        } catch (e) {
          console.error('Failed to parse aistudio settings', e);
        }
      }
    });

    // Listen for changes
    const listener = (changes: any) => {
      if (changes[STORAGE_KEY]?.newValue) {
        try {
          const parsed = JSON.parse(changes[STORAGE_KEY].newValue);
          if (parsed.state?.enhancedFeatures?.aistudio) {
            setSettings(parsed.state.enhancedFeatures.aistudio);
          }
        } catch (e) {}
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AIStudioSettings>(key: K, value: AIStudioSettings[K]) => {
      // Optimistic update
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

      // Save to storage
      const res = await browser.storage.local.get(STORAGE_KEY);
      if (res[STORAGE_KEY]) {
        try {
          const parsed = JSON.parse(res[STORAGE_KEY]);
          parsed.state.enhancedFeatures.aistudio[key] = value;
          await browser.storage.local.set({
            [STORAGE_KEY]: JSON.stringify(parsed),
          });
        } catch (e) {
          console.error('Failed to update aistudio settings', e);
        }
      }
    },
    []
  );

  return { settings, updateSetting };
};
