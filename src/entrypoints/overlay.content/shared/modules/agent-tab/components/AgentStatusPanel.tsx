/**
 * AgentStatusPanel — Shown when an agent session is active or has just finished.
 * Order matters: whatever needs the user's decision comes first.
 */

import React from 'react';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { AgentStatusHeader } from './AgentStatusHeader';
import { AgentExecutionHistory } from './AgentExecutionHistory';
import { AgentApproval } from './AgentApproval';
import { AgentContinuePrompt } from './AgentContinuePrompt';
import { AgentCheckIn } from './AgentCheckIn';
import { AgentInterruptNotice } from './AgentInterruptNotice';
import { AgentSessionSummary } from './AgentSessionSummary';
import { AgentPolicyControls } from './AgentPolicyControls';
import { AgentInstructionInput } from './AgentInstructionInput';

export const AgentStatusPanel: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const isRunning = status !== 'idle';

  return (
    <div className="flex h-full flex-col">
      <AgentStatusHeader />

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {/* Decisions first */}
        <AgentApproval />
        <AgentContinuePrompt />
        <AgentCheckIn />
        <AgentInterruptNotice />
        <AgentSessionSummary />

        <AgentExecutionHistory />

        {isRunning && <AgentPolicyControls />}
      </div>

      {/* Rides along with the next batch of tool results, so it only makes sense
          while a round is still coming. */}
      {isRunning && <AgentInstructionInput />}
    </div>
  );
};
