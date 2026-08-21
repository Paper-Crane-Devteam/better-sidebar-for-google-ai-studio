import { useState, useEffect } from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { DismissibleTip } from '@/shared/components/DismissibleTip';
import { detectPlatform, Platform } from '@/shared/types/platform';

/**
 * Storage key pattern: `import_chatlist_tip_dismissed_<platform>`
 * Each platform (gemini, aistudio) tracks separately.
 */
const getDismissedKey = (platform: Platform) =>
  `import_chatlist_tip_dismissed_${platform}`;

/**
 * Storage key pattern: `import_chatlist_ever_triggered_<platform>`
 * Set to true once the user has triggered "Import Chat List" at least once.
 */
const getTriggeredKey = (platform: Platform) =>
  `import_chatlist_ever_triggered_${platform}`;

/**
 * Call this when the user triggers import chat list (scan library) so the tip
 * won't show up anymore.
 */
export const markImportChatListTriggered = async () => {
  const platform = detectPlatform();
  if (platform === Platform.UNKNOWN) return;
  try {
    await browser.storage.local.set({ [getTriggeredKey(platform)]: true });
  } catch {
    // silent
  }
};

export const ImportChatListTip = ({
  onImport,
}: {
  /**
   * When provided, the parent owns the scan trigger (so it can show its own
   * loading state). Otherwise the tip sends the scan message itself.
   */
  onImport?: () => void;
} = {}) => {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      const platform = detectPlatform();
      if (platform === Platform.UNKNOWN) return;

      try {
        const dismissedKey = getDismissedKey(platform);
        const triggeredKey = getTriggeredKey(platform);
        const result = await browser.storage.local.get([
          dismissedKey,
          triggeredKey,
        ]);

        const dismissed = result[dismissedKey] === true;
        const everTriggered = result[triggeredKey] === true;

        // Show tip only if user never imported AND never dismissed
        if (!dismissed && !everTriggered) {
          setVisible(true);
        }
      } catch {
        // silent
      }
    };
    check();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    const platform = detectPlatform();
    if (platform === Platform.UNKNOWN) return;
    try {
      await browser.storage.local.set({ [getDismissedKey(platform)]: true });
    } catch {
      // silent
    }
  };

  const handleImport = () => {
    setVisible(false);
    if (onImport) {
      // Parent handles marking + sending, and shows the scanning overlay
      onImport();
      return;
    }
    // Mark as triggered so tip won't appear again
    markImportChatListTriggered();
    // Trigger scan library
    browser.runtime.sendMessage({ type: 'SCAN_LIBRARY' });
  };

  if (!visible) return null;

  return (
    <DismissibleTip onDismiss={dismiss} align="start">
      <span className="block">
        {t('explorer.importTipText')}{' '}
        <a
          onClick={handleImport}
          className="text-primary hover:underline cursor-pointer font-medium"
        >
          {t('explorer.importTipAction')}
        </a>
      </span>
      <span className="block mt-1 opacity-70">
        {t('explorer.importTipHint')}
      </span>
    </DismissibleTip>
  );
};
