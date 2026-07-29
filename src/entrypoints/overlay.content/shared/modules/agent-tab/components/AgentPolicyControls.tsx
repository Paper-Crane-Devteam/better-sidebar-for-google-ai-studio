/**
 * AgentPolicyControls — the two switches that decide how much the agent may do
 * without asking.
 *
 * Both settings were already wired into execute-sql via execution-policy, but
 * their only UI lived in the (now removed) control panel, so they had become
 * unreachable.
 *
 * - Auto-run reads   : persisted, default on
 * - Auto-approve writes : session-scoped (resets when a new task starts)
 * - Auto-continue    : persisted, default on — the engine sends each round's
 *   results back to the AI itself instead of waiting for Enter
 */

import React from 'react';
import { Switch } from '@/shared/components/ui/switch';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { useAgentPolicyStore } from '../../agent-loop/agent-policy-store';

export const AgentPolicyControls: React.FC = () => {
  const { t } = useI18n();
  const autoExecuteReads = useAgentPolicyStore((s) => s.autoExecuteReads);
  const setAutoExecuteReads = useAgentPolicyStore((s) => s.setAutoExecuteReads);
  const autoContinue = useAgentPolicyStore((s) => s.autoContinue);
  const setAutoContinue = useAgentPolicyStore((s) => s.setAutoContinue);

  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const setSpeedMode = useAgentLoopStore((s) => s.setSpeedMode);
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);

  const handleSpeedMode = (checked: boolean) => {
    setSpeedMode(checked);
    // If a confirmation is already on screen, honour the new policy right away
    if (checked && pendingConfirmation) {
      pendingConfirmation.resolve(true);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-foreground">
          {t('agent.policy.autoReads', { defaultValue: 'Run reads automatically' })}
        </label>
        <Switch checked={autoExecuteReads} onCheckedChange={setAutoExecuteReads} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label className="text-xs text-foreground">
            {t('agent.policy.autoWrites', { defaultValue: 'Auto-approve writes' })}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('agent.policy.autoWritesHint', { defaultValue: 'This task only' })}
          </p>
        </div>
        <Switch checked={speedMode} onCheckedChange={handleSpeedMode} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label className="text-xs text-foreground">
            {t('agent.policy.autoContinue', { defaultValue: 'Continue automatically' })}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('agent.policy.autoContinueHint', {
              defaultValue: 'Send each round of results without asking',
            })}
          </p>
        </div>
        <Switch checked={autoContinue} onCheckedChange={setAutoContinue} />
      </div>
    </div>
  );
};
