/**
 * AgentStatusPanel — Shown when an agent session is active or has just finished.
 * Order matters: whatever needs the user's decision comes first.
 */

import React from 'react';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { AgentStatusHeader } from './AgentStatusHeader';
import { AgentExecutionHistory } from './AgentExecutionHistory';
import { AgentApproval } from './AgentApproval';
import { AgentUserPrompt } from './AgentUserPrompt';
import { AgentContinuePrompt } from './AgentContinuePrompt';
import { AgentInterruptNotice } from './AgentInterruptNotice';
import { AgentSessionSummary } from './AgentSessionSummary';
import { AgentPolicyControls } from './AgentPolicyControls';
import { AgentInstructionInput } from './AgentInstructionInput';

export const AgentStatusPanel: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const pendingQuestion = useAgentLoopStore((s) => s.pendingQuestion);
  const isRunning = status !== 'idle';

  return (
    <div className="flex h-full flex-col">
      <AgentStatusHeader />

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {/* Decisions first */}
        <AgentUserPrompt />
        <AgentApproval />
        <AgentContinuePrompt />
        <AgentInterruptNotice />
        <AgentSessionSummary />

        <AgentExecutionHistory />

        {isRunning && <AgentPolicyControls />}
      </div>

      {/* The note input rides along with the next batch of tool results, and a round
          parked on a question produces none — so a note typed here would never be
          delivered. The question panel has its own input for that. */}
      {isRunning && !pendingQuestion && <AgentInstructionInput />}
    </div>
  );
};
