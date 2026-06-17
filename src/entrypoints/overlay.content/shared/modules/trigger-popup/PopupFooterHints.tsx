/**
 * PopupFooterHints — Shared footer for trigger popups (slash command `/` and agent trigger `>`).
 * Displays keyboard navigation hints: ↑↓ navigate, ↵ select, Esc dismiss.
 */

import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';

export const PopupFooterHints: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/50 bg-muted/20">
      <span className="text-[10px] text-muted-foreground">
        <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">↑↓</kbd>
        {' '}{t('slashCommand.navigate')}
      </span>
      <span className="text-[10px] text-muted-foreground">
        <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">↵</kbd>
        {' '}{t('slashCommand.select')}
      </span>
      <span className="text-[10px] text-muted-foreground">
        <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Esc</kbd>
        {' '}{t('slashCommand.dismiss')}
      </span>
    </div>
  );
};
