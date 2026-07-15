/**
 * SettingsSection — Auto-execute switch, speed mode (with risk confirmation), breakpoint input.
 */

import React, { useCallback } from 'react';
import { Switch } from '@/shared/components/ui/switch';
import { useAgentLoopStore } from '../agent-loop-store';
import { useControlPanelStore } from '../control-panel-store';

export const SettingsSection: React.FC = () => {
  const autoExecuteReads = useControlPanelStore((s) => s.autoExecuteReads);
  const setAutoExecuteReads = useControlPanelStore((s) => s.setAutoExecuteReads);

  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const setSpeedMode = useAgentLoopStore((s) => s.setSpeedMode);
  const speedModeWarningShown = useAgentLoopStore((s) => s.speedModeWarningShown);
  const setSpeedModeWarningShown = useAgentLoopStore((s) => s.setSpeedModeWarningShown);
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);

  const breakpointRound = useAgentLoopStore((s) => s.breakpointRound);
  const setBreakpointRound = useAgentLoopStore((s) => s.setBreakpointRound);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const maxRounds = useAgentLoopStore((s) => s.maxRounds);

  const handleSpeedModeToggle = useCallback(
    (checked: boolean) => {
      if (checked && !speedModeWarningShown) {
        const confirmed = window.confirm(
          '⚠️ 极速模式将自动批准所有操作（包括写操作），不再弹出确认。\n\n确定启用？',
        );
        if (!confirmed) return;
        setSpeedModeWarningShown();
      }
      setSpeedMode(checked);
      // Auto-approve pending confirmation when enabling speed mode
      if (checked && pendingConfirmation) {
        pendingConfirmation.resolve(true);
      }
    },
    [speedModeWarningShown, setSpeedModeWarningShown, setSpeedMode, pendingConfirmation],
  );

  const handleBreakpointChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) {
        setBreakpointRound(null);
        return;
      }
      const num = Number(val);
      if (num > currentRound && num <= maxRounds) {
        setBreakpointRound(num);
      }
    },
    [currentRound, maxRounds, setBreakpointRound],
  );

  return (
    <div className="space-y-3">
      {/* Auto-execute reads */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground">自动执行读操作</label>
        <Switch checked={autoExecuteReads} onCheckedChange={setAutoExecuteReads} />
      </div>

      {/* Speed mode */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground">极速模式</label>
        <Switch checked={speedMode} onCheckedChange={handleSpeedModeToggle} />
      </div>

      {/* Breakpoint */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground">断点轮次</label>
        <input
          type="number"
          min={currentRound + 1}
          max={maxRounds}
          value={breakpointRound ?? ''}
          onChange={handleBreakpointChange}
          placeholder="无"
          className="w-16 rounded border border-border bg-muted px-2 py-1 text-xs text-foreground"
        />
      </div>
    </div>
  );
};
