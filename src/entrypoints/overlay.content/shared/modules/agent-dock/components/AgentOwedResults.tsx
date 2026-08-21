/**
 * AgentOwedResults — work that happened, that the AI was never told about.
 *
 * The situation this exists for: a tool was approved and ran, its result was staged in
 * the chat input, and the page reloaded before the send. The tool's effects are real —
 * a write has been written — but the payload lived only in that composer, and the engine
 * waiting for the reply is gone too.
 *
 * So the offer is **send the results**, not run the steps again. That distinction is the
 * whole point: auto-pickup, seeing tool calls with no results after them, used to start
 * a fresh session and re-execute, which applied every write a second time and asked for
 * approval again on a statement the user had just approved.
 *
 * Unlike every other card here this one appears with **no session running** — it is a
 * message from a previous page life. The dock's visibility accounts for that.
 */

import React from 'react';
import { Send, Inbox, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentRecordStore } from '../../agent-loop/agent-record-store';
import { agentEventBus } from '../../agent-loop/event-bus';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';

export const AgentOwedResults: React.FC = () => {
  const { t } = useI18n();
  const owed = useAgentRecordStore((s) => s.owed);
  const dismissOwed = useAgentRecordStore((s) => s.dismissOwed);
  const status = useAgentLoopStore((s) => s.status);

  // A live session supersedes the offer: it either already delivered these or is about
  // to, and a second sender racing it would put the same payload in twice.
  if (!owed || status !== 'idle') return null;

  const steps = owed.rows.length;

  return (
    <div className="space-y-2 rounded-md bg-warning/10 p-3">
      <div className="flex items-center gap-2">
        <Inbox className="h-3 w-3 shrink-0 text-warning" />
        <span className="text-xs font-medium text-foreground">
          {t('agent.owed.title', {
            defaultValue: '{{count}} results never reached the AI',
            count: steps,
          })}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {owed.hadWrites
          ? t('agent.owed.descWrites', {
              defaultValue:
                'These steps ran before the page reloaded, and some of them changed your data — those changes are already saved. The AI never saw the results, so the task is stuck. Sending them lets it carry on without redoing the work.',
            })
          : t('agent.owed.desc', {
              defaultValue:
                'These steps ran before the page reloaded, but the AI never saw the results, so the task is stuck. Sending them lets it carry on without redoing the work.',
            })}
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() =>
            agentEventBus.emit('recovery:deliver-owed', {
              conversationId: owed.conversationId,
            })
          }
        >
          <Send className="h-3 w-3" />
          {t('agent.owed.send', { defaultValue: 'Send them' })}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => void dismissOwed()}
          title={t('agent.owed.discardTitle', {
            defaultValue:
              'Forget these results. Anything they already changed stays changed.',
          })}
        >
          <X className="h-3 w-3" />
          {t('agent.owed.discard', { defaultValue: 'Forget it' })}
        </Button>
      </div>
    </div>
  );
};
