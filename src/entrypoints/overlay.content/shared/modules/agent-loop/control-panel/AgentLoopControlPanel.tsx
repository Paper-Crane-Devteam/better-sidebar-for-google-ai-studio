/**
 * AgentLoopControlPanel — Root component.
 * Wraps the existing StatusBar as a Popover trigger, opens control panel above it.
 * StatusBar persists after loop ends so users can review session history.
 */

import React, { useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useAgentLoopStore } from '../agent-loop-store';
import { AgentLoopStatusBar } from '../AgentLoopStatusBar';
import { ControlPanelContent } from './ControlPanelContent';

interface AgentLoopControlPanelProps {
  onStop: () => void;
  onRetry: () => void;
}

export const AgentLoopControlPanel: React.FC<AgentLoopControlPanelProps> = ({
  onStop,
  onRetry,
}) => {
  const panelOpen = useAgentLoopStore((s) => s.panelOpen);
  const setPanelOpen = useAgentLoopStore((s) => s.setPanelOpen);
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);

  // Auto-open when confirmation arrives
  useEffect(() => {
    if (pendingConfirmation && !panelOpen) {
      setPanelOpen(true);
    }
  }, [pendingConfirmation, panelOpen, setPanelOpen]);

  return (
    <Popover.Root open={panelOpen} onOpenChange={setPanelOpen}>
      <Popover.Trigger asChild>
        <AgentLoopStatusBar onStop={onStop} onRetry={onRetry} />
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        sideOffset={8}
        onEscapeKeyDown={() => setPanelOpen(false)}
        className="z-[99999] w-[480px] max-w-[calc(100vw-32px)] min-w-[320px]
                   rounded-lg border border-border bg-popover shadow-xl
                   animate-in fade-in-0 slide-in-from-bottom-2
                   data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      >
        <ControlPanelContent />
      </Popover.Content>
    </Popover.Root>
  );
};
