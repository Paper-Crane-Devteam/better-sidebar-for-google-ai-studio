/**
 * AgentStatusPanel — Shown when an agent session is active or completed.
 * Displays status header, execution controls, history, and instruction input.
 */

import React from 'react';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { AgentStatusHeader } from './AgentStatusHeader';
import { AgentExecutionHistory } from './AgentExecutionHistory';
import { AgentConfirmation } from './AgentConfirmation';
import { AgentInstructionInput } from './AgentInstructionInput';

export const AgentStatusPanel: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const isRunning = status !== 'idle';

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header — status + controls */}
      <AgentStatusHeader />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* Inline confirmation (shown when pending) */}
        <AgentConfirmation />

        {/* Execution history */}
        <AgentExecutionHistory />
      </div>

      {/* Fixed footer — instruction input (only when running) */}
      {isRunning && <AgentInstructionInput />}
    </div>
  );
};
