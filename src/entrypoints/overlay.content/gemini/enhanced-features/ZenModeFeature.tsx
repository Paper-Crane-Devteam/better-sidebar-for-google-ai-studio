import React from 'react';
import { Icon } from '@iconify/react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { cn } from '@/shared/lib/utils/utils';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';

export const ZenModeFeature = () => {
  const { t } = useI18n();
  const zenMode = useSettingsStore((s) => s.enhancedFeatures.gemini.zenMode);
  const setGeminiFeature = useSettingsStore((s) => s.setGeminiFeature);

  if (!zenMode) return null;

  return (
    <div className="fixed top-4 right-4 z-[999999]">
      <SimpleTooltip content={t('geminiUI.exitZenMode')}>
        <button
          onClick={() => setGeminiFeature('zenMode', false)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl border border-border/50 bg-background/60 backdrop-blur-md transition-all hover:bg-accent hover:shadow-sm"
          )}
        >
          <Icon icon="tabler:layout-sidebar-left-expand" className="h-4 w-4 text-foreground" />
        </button>
      </SimpleTooltip>
    </div>
  );
};
