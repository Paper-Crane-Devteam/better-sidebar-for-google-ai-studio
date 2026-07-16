/**
 * ControlPanelContent — Panel body layout.
 * Fixed header + scrollable body + fixed footer (instruction input).
 * Shows execution history even when idle so users can review past sessions.
 */

import React from 'react';
import { PanelHeader } from './PanelHeader';
import { ConfirmationSection } from './ConfirmationSection';
import { SettingsSection } from './SettingsSection';
import { ToolManagementSection } from './ToolManagementSection';
import { ExecutionHistorySection } from './ExecutionHistorySection';
import { InstructionInput } from './InstructionInput';
import { useAgentLoopStore } from '../agent-loop-store';

export const ControlPanelContent: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const history = useAgentLoopStore((s) => s.history);
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const isRunning = status !== 'idle';
  const hasHistory = history.length > 0 || currentResults.length > 0;

  return (
    <div className="flex max-h-[60vh] flex-col overflow-hidden">
      {/* Fixed header */}
      <PanelHeader />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Confirmation (shown first when pending) */}
        <ConfirmationSection />

        {/* Execution history — always show if there's data (even when idle for reviewing) */}
        {hasHistory && <ExecutionHistorySection />}

        {/* Settings */}
        <SettingsSection />

        {/* Tool management (collapsible) */}
        <ToolManagementSection />
      </div>

      {/* Fixed footer — instruction input (only when running) */}
      {isRunning && <InstructionInput />}
    </div>
  );
};
