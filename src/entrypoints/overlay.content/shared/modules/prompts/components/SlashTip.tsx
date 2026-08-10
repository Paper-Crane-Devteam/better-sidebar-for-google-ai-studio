import { useState, useEffect } from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { DismissibleTip } from '@/shared/components/DismissibleTip';

const STORAGE_KEY = 'prompts_slash_tip_dismissed';

export const SlashTip = () => {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const result = await browser.storage.local.get(STORAGE_KEY);
        if (!result[STORAGE_KEY]) {
          setVisible(true);
        }
      } catch {
        // If storage access fails, don't show to avoid errors
      }
    };
    check();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: true });
    } catch {
      // silent
    }
  };

  if (!visible) return null;

  return (
    <DismissibleTip onDismiss={dismiss}>
      {t('prompts.slashTip')}
    </DismissibleTip>
  );
};
