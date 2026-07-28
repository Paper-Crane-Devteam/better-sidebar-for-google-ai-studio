/**
 * AgentStatusPanel — Shown when an agent session is active or has just finished.
 * Order matters: whatever needs the user's decision comes first.
 */

import React from 'react';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { AgentStatusHeader } from './AgentStatusHeader';
import { AgentExecutionHistory } from './AgentExecutionHistory';
import { AgentConfirmation } from './AgentConfirmation';
import { AgentContinuePrompt } from './AgentContinuePrompt';
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
        <AgentConfirmation />
        <AgentContinuePrompt />
        <AgentInterruptNotice />
        <AgentSessionSummary />

        <AgentExecutionHistory />

        {isRunning && <AgentPolicyControls />}
      </div>

      {isRunning && <AgentInstructionInput />}
    </div>
  );
};
