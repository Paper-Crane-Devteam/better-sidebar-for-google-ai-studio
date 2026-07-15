/**
 * ControlPanelContent — Panel body layout.
 * Fixed header + scrollable body + fixed footer (instruction input).
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
  const isRunning = status !== 'idle';

  return (
    <div className="flex max-h-[60vh] flex-col overflow-hidden">
      {/* Fixed header */}
      <PanelHeader />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Confirmation (shown first when pending) */}
        <ConfirmationSection />

        {/* Settings */}
        <SettingsSection />

        {/* Tool management (collapsible) */}
        <ToolManagementSection />

        {/* Execution history (collapsible, only when running or has history) */}
        {isRunning && <ExecutionHistorySection />}
      </div>

      {/* Fixed footer — instruction input */}
      {isRunning && <InstructionInput />}
    </div>
  );
};
