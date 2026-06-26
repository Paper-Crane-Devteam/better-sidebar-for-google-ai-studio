import { useEffect, useCallback } from 'react';
import { CURRENT_VERSION } from './changelog';
import { useWhatsNewStore } from './whats-new-store';

const STORAGE_KEY = 'last_seen_version';

export const useWhatsNew = () => {
  const isOpen = useWhatsNewStore((s) => s.isOpen);
  const open = useWhatsNewStore((s) => s.open);
  const close = useWhatsNewStore((s) => s.close);

  useEffect(() => {
    const checkVersion = async () => {
      // debug
      // open();
      try {
        const result = await browser.storage.local.get(STORAGE_KEY);
        const lastSeenVersion = result[STORAGE_KEY];

        if (lastSeenVersion !== CURRENT_VERSION) {
          open();
        }
      } catch (error) {
        console.error('Failed to check version for WhatsNew:', error);
      }
    };

    checkVersion();
  }, []);

  const markAsSeen = useCallback(async () => {
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: CURRENT_VERSION });
    } catch (error) {
      console.error('Failed to save version:', error);
    }
  }, []);

  return {
    isOpen,
    setIsOpen: (val: boolean) => val ? open() : close(),
    markAsSeen,
    openWhatsNew: open,
    closeWhatsNew: () => {
      close();
      markAsSeen();
    },
  };
};
