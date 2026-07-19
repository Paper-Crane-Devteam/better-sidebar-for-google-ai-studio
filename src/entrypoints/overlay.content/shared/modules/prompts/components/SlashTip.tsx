import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';

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
    <div className="flex items-center gap-2 px-3 py-2 mx-2 mb-2 rounded-md bg-muted/50 text-muted-foreground text-xs border border-border/50">
      <span className="flex-1">{t('prompts.slashTip')}</span>
      <button
        onClick={dismiss}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        title={t('prompts.slashTipDismiss')}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};
