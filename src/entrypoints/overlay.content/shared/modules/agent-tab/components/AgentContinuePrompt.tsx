/**
 * AgentContinuePrompt — shown when the loop is at its normal per-round
 * checkpoint (`awaiting_send`): tool results are staged in the input box and
 * need to be sent back to the AI.
 *
 * Previously this state was indistinguishable from an error ("Paused"), and the
 * only way forward was to know you had to press Enter in the chat input.
 */

import React, { useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';

export const AgentContinuePrompt: React.FC = () => {
  const { t } = useI18n();
  const status = useAgentLoopStore((s) => s.status);
  const [sending, setSending] = useState(false);

  if (status !== 'awaiting_send') return null;

  const handleContinue = async () => {
    const engine = getActiveEngine();
    if (!engine) return;
    setSending(true);
    try {
      await engine.continueNow();
    } finally {
      setSending(false);
    }
  };

  const handleStop = () => {
    const engine = getActiveEngine();
    if (engine) engine.stop();
    else useAgentLoopStore.getState().stop();
  };

  return (
    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs text-foreground">
        {t('agent.continue.title', {
          defaultValue: 'Results ready. Continue to the next step?',
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          disabled={sending}
          onClick={handleContinue}
        >
          <CornerDownLeft className="h-3 w-3" />
          {t('agent.actions.continue', { defaultValue: 'Continue' })}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleStop}>
          {t('agent.actions.stop', { defaultValue: 'Stop' })}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('agent.continue.hint', {
          defaultValue: 'Pressing Enter in the chat input does the same thing.',
        })}
      </p>
    </div>
  );
};
