/**
 * AgentDockPill — the one line that is always there while a session runs.
 *
 * The dock only unfolds when something needs deciding, but it can't disappear
 * entirely: with `speedMode` on, nothing ever asks for approval, so a collapsed dock
 * would leave a runaway task with no brake and no way to take the blanket approval
 * back. Stop and the speed-mode toggle therefore live on the pill itself, not in the
 * expanded body.
 *
 * Deliberately not a progress report. Which step it's on and what each step did is
 * answered better by the chat, where the tool cards are.
 */

import React from 'react';
import { ChevronDown, ChevronUp, Settings2, Square, Zap } from 'lucide-react';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';
import type { AgentLoopStatus } from '../../agent-loop/types';

const STATUS_FALLBACK: Record<AgentLoopStatus, string> = {
  idle: 'Finished',
  waiting_ai: 'Thinking...',
  parsing: 'Reading response...',
  executing: 'Working...',
  awaiting_approval: 'Needs your approval',
  sending: 'Sending...',
  awaiting_send: 'Waiting for you',
  paused: 'Paused',
  error: 'Error',
};

const STATUS_COLORS: Record<AgentLoopStatus, string> = {
  idle: 'bg-muted-foreground',
  waiting_ai: 'bg-blue-500',
  parsing: 'bg-blue-500',
  executing: 'bg-green-500',
  awaiting_approval: 'bg-amber-500',
  sending: 'bg-blue-500',
  awaiting_send: 'bg-primary',
  paused: 'bg-orange-500',
  error: 'bg-red-500',
};

interface AgentDockPillProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

export const AgentDockPill: React.FC<AgentDockPillProps> = ({
  expanded,
  onToggleExpanded,
  settingsOpen,
  onToggleSettings,
}) => {
  const { t } = useI18n();
  const status = useAgentLoopStore((s) => s.status);
  const currentTool = useAgentLoopStore((s) => s.currentTool);
  const checkInSteps = useAgentLoopStore((s) => s.checkInSteps);
  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const setSpeedMode = useAgentLoopStore((s) => s.setSpeedMode);

  const isWorking =
    status === 'waiting_ai' ||
    status === 'parsing' ||
    status === 'executing' ||
    status === 'sending';

  const handleStop = () => {
    const engine = getActiveEngine();
    if (engine) engine.stop();
    else useAgentLoopStore.getState().stop();
    // User clicked stop — the session is over. Reset immediately so the dock
    // disappears rather than showing a summary card with a "New task" button that
    // does the same thing (vanish). The conversation content is already in the chat.
    useAgentLoopStore.getState().reset();
  };

  // A check-in is `paused` too, but calling it "Paused" next to a neutral "have a
  // look" card reads like two different things happened.
  const label =
    checkInSteps !== null
      ? t('agent.status.checkIn', { defaultValue: 'Waiting for your go-ahead' })
      : t(`agent.status.${status}`, { defaultValue: STATUS_FALLBACK[status] });

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="relative shrink-0">
        <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[status])} />
        {isWorking && (
          <div
            className={cn(
              'absolute inset-0 animate-ping rounded-full opacity-40',
              STATUS_COLORS[status],
            )}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="truncate text-xs font-medium text-foreground">{label}</span>
        {currentTool && (
          <span className="truncate font-mono text-xs text-muted-foreground">{currentTool}</span>
        )}
      </button>

      {/* Only surfaced once it's on, because the only place to turn it on is an
          approval prompt — and once it is on, no approval prompt will appear again. */}
      {speedMode && (
        <SimpleTooltip
          content={t('agent.dock.speedOff', {
            defaultValue: 'Approving everything for this task — click to stop',
          })}
        >
          <button
            type="button"
            onClick={() => setSpeedMode(false)}
            className="shrink-0 rounded p-1 text-orange-500 hover:bg-accent"
          >
            <Zap className="h-3 w-3" />
          </button>
        </SimpleTooltip>
      )}

      <SimpleTooltip content={t('agent.dock.settings', { defaultValue: 'What it may do' })}>
        <button
          type="button"
          onClick={onToggleSettings}
          className={cn(
            'shrink-0 rounded p-1 hover:bg-accent',
            settingsOpen ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Settings2 className="h-3 w-3" />
        </button>
      </SimpleTooltip>

      {status !== 'idle' && (
        <SimpleTooltip content={t('agent.actions.stop', { defaultValue: 'Stop' })}>
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Square className="h-3 w-3" />
          </button>
        </SimpleTooltip>
      )}

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-label={
          expanded
            ? t('agent.dock.collapse', { defaultValue: 'Collapse' })
            : t('agent.dock.expand', { defaultValue: 'Expand' })
        }
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </div>
  );
};
