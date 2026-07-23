/**
 * AgentTab — Root component for the Agent sidebar tab.
 *
 * Two states:
 * 1. Active session (agent loop running or completed) → status panel + controls
 * 2. Idle / non-agent conversation → empty state with premium aesthetics
 */

import React from 'react';
import { useAgentLoopStore } from '../agent-loop/agent-loop-store';
import { AgentStatusPanel } from './components/AgentStatusPanel';
import { AgentEmptyState } from './components/AgentEmptyState';

export const AgentTab: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const history = useAgentLoopStore((s) => s.history);
  const currentResults = useAgentLoopStore((s) => s.currentResults);

  const hasSession = status !== 'idle' || history.length > 0 || currentResults.length > 0;

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-gradient-to-b from-transparent to-primary/[0.02]">
      {hasSession ? <AgentStatusPanel /> : <AgentEmptyState />}
    </div>
  );
};
