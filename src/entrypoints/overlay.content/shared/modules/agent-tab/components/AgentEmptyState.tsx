/**
 * AgentEmptyState — Shown when no agent session is active.
 * Premium aesthetic: large semi-transparent icon, gradient title, helpful guidance.
 */

import React from 'react';
import { Bot, ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';

export const AgentEmptyState: React.FC = () => {
  const { t } = useI18n();
  const setIsSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center">
      {/* Large semi-transparent icon */}
      <div className="relative mb-6">
        <Bot className="h-16 w-16 text-primary/20" strokeWidth={1.2} />
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl" />
      </div>

      {/* Title with subtle gradient */}
      <h2 className="text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
        Agent Mode
      </h2>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px] mb-6">
        {t('agent.emptyState.description', {
          defaultValue: 'Type > in the input box to start an Agent session',
        })}
      </p>

      {/* Keyboard hint */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50 mb-4">
        <kbd className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-muted-foreground">
          &gt;
        </kbd>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Select a Skill</span>
      </div>

      {/* Settings link */}
      <Button
        variant="ghost"
        size="sm"
        className="text-[10px] text-muted-foreground gap-1"
        onClick={() => setIsSettingsOpen(true)}
      >
        <Settings className="h-3 w-3" />
        {t('agent.emptyState.configure', { defaultValue: 'Configure Agent' })}
      </Button>
    </div>
  );
};
