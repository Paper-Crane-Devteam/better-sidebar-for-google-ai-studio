/**
 * AgentPolicyControls — what the agent may do without asking.
 *
 * One switch per kind of tool call, which is the whole model: queries and changes.
 * Everything else about approval is a scope chosen at the moment of asking (this
 * call / the rest of this response / the rest of this task), so it belongs on the
 * approval prompt, not here.
 *
 * Plus "keep going on its own", which is a different axis: whether the loop may run
 * unattended at all. It intersects with the two above rather than overriding them
 * (see `shouldAutoSend`), so it can only ever make things more manual. The note under
 * it spells out the part the labels don't: approving a step also hands you the send.
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { Switch } from '@/shared/components/ui/switch';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { useAgentPolicyStore } from '../../agent-loop/agent-policy-store';

export const AgentPolicyControls: React.FC = () => {
  const { t } = useI18n();
  const autoRunReads = useAgentPolicyStore((s) => s.autoRunReads);
  const setAutoRunReads = useAgentPolicyStore((s) => s.setAutoRunReads);
  const autoRunWrites = useAgentPolicyStore((s) => s.autoRunWrites);
  const setAutoRunWrites = useAgentPolicyStore((s) => s.setAutoRunWrites);
  const autoContinue = useAgentPolicyStore((s) => s.autoContinue);
  const setAutoContinue = useAgentPolicyStore((s) => s.setAutoContinue);

  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const setSpeedMode = useAgentLoopStore((s) => s.setSpeedMode);

  return (
    <div className="space-y-2 rounded-md border border-border/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label className="text-xs text-foreground">
            {t('agent.policy.autoReads', { defaultValue: 'Run queries without asking' })}
          </label>
        </div>
        <Switch checked={autoRunReads} onCheckedChange={setAutoRunReads} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label className="text-xs text-foreground">
            {t('agent.policy.autoWrites', { defaultValue: 'Change data without asking' })}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('agent.policy.autoWritesHint', { defaultValue: 'Changes cannot be undone yet' })}
          </p>
        </div>
        <Switch checked={autoRunWrites} onCheckedChange={setAutoRunWrites} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label className="text-xs text-foreground">
            {t('agent.policy.autoContinue', { defaultValue: 'Keep going on its own' })}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('agent.policy.autoContinueHint', {
              defaultValue: 'Off means you press Enter after every step',
            })}
          </p>
        </div>
        <Switch checked={autoContinue} onCheckedChange={setAutoContinue} />
      </div>

      {/* The consequence of the switches above that isn't visible in their labels:
          approving something also hands you the send. */}
      {autoContinue && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('agent.policy.sendHint', {
            defaultValue:
              'A step you approve still waits for you to press Enter — only unattended steps send themselves.',
          })}
        </p>
      )}

      {/* Only surfaced once it's on, because the only way to turn it on is the
          approval prompt — this is where you take it back. */}
      {speedMode && (
        <button
          type="button"
          onClick={() => setSpeedMode(false)}
          className="flex w-full items-center gap-1 rounded border border-orange-500/30 bg-orange-500/5 px-2 py-1 text-xs text-orange-600 dark:text-orange-400"
        >
          <Zap className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate">
            {t('agent.policy.taskApproved', {
              defaultValue: 'Approving everything for this task — click to stop',
            })}
          </span>
        </button>
      )}
    </div>
  );
};
