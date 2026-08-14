/**
 * AgentCheckIn — the loop has run a long stretch unattended and wants a look.
 *
 * Deliberately not the fault notice. Both states are `paused`, but this one means
 * "still going fine, just checking" — showing it in orange with a warning triangle
 * read as "something broke", and the task had done nothing wrong. Neutral styling,
 * and the primary action is Continue rather than Retry.
 *
 * `checkInSteps` being non-null is what distinguishes the two; see the store.
 */

import React from 'react';
import { Eye, Play, Square } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';

export const AgentCheckIn: React.FC = () => {
  const { t } = useI18n();
  const status = useAgentLoopStore((s) => s.status);
  const checkInSteps = useAgentLoopStore((s) => s.checkInSteps);
  const history = useAgentLoopStore((s) => s.history);

  if (status !== 'paused' || checkInSteps === null) return null;

  const failed = history.reduce((sum, h) => sum + h.results.filter((r) => !r.success).length, 0);

  return (
    <div className="space-y-2 rounded-md bg-primary/10 p-3">
      <div className="flex items-center gap-2">
        <Eye className="h-3 w-3 shrink-0 text-primary" />
        <span className="text-xs font-medium text-foreground">
          {t('agent.checkIn.title', {
            defaultValue: '{{count}} steps done on its own',
            count: checkInSteps,
          })}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('agent.checkIn.desc', {
          defaultValue:
            'Nothing is wrong — the agent just paused so you can look over what it has done before it keeps going.',
        })}
      </p>

      {/* Points at the chat, not at a list here: the step list this used to say
          "below" was removed — the tool cards in the conversation say the same thing
          with the actual output attached. */}
      {failed > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('agent.checkIn.failedNote', {
            defaultValue: '{{count}} steps failed along the way — worth a look in the chat.',
            count: failed,
          })}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            const engine = getActiveEngine();
            if (engine) void engine.resume();
          }}
        >
          <Play className="h-3 w-3" />
          {t('agent.checkIn.continue', { defaultValue: 'Keep going' })}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => {
            const engine = getActiveEngine();
            if (engine) engine.stop();
            else useAgentLoopStore.getState().stop();
            useAgentLoopStore.getState().reset();
          }}
        >
          <Square className="h-3 w-3" />
          {t('agent.checkIn.stop', { defaultValue: 'Stop here' })}
        </Button>
      </div>
    </div>
  );
};
