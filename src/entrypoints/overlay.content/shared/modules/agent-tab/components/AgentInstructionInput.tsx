/**
 * AgentInstructionInput — Footer input for injecting mid-loop instructions.
 * Enter to send, Shift+Enter for newline.
 */

import React, { useState } from 'react';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';

const MAX_LENGTH = 2000;

export const AgentInstructionInput: React.FC = () => {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const setPendingInstruction = useAgentLoopStore((s) => s.setPendingInstruction);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setPendingInstruction(trimmed);
    setValue('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border/50 px-3 py-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Instruct the AI..."
          rows={1}
          className="w-full resize-none rounded-md border border-border/50 bg-muted/30 px-2 py-1
                     text-[10px] text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-1 focus:ring-primary/50
                     transition-colors"
        />
        {value.length > 1800 && (
          <span className="absolute bottom-0.5 right-2 text-[9px] text-muted-foreground">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
      {sent && <span className="mt-1 block text-[9px] text-green-500">✓ Instruction sent</span>}
    </div>
  );
};
