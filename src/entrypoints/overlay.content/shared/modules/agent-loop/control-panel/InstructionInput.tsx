/**
 * InstructionInput — Multi-line textarea for injecting user instructions mid-loop.
 * Enter sends, Shift+Enter for newline, 2000 char limit.
 */

import React, { useState, useCallback } from 'react';
import { useAgentLoopStore } from '../agent-loop-store';

const MAX_LENGTH = 2000;

export const InstructionInput: React.FC = () => {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const status = useAgentLoopStore((s) => s.status);
  const setPendingInstruction = useAgentLoopStore((s) => s.setPendingInstruction);
  const disabled = status === 'idle';

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled) return;
    setPendingInstruction(value.trim());
    setValue('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }, [value, disabled, setPendingInstruction]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入指令引导 AI..."
          rows={1}
          className="w-full resize-none rounded-md border border-border bg-muted/50 px-3 py-2
                     text-xs text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-1 focus:ring-primary
                     disabled:cursor-not-allowed disabled:opacity-50"
        />
        {value.length > 1800 && (
          <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
      {sent && (
        <span className="mt-1 block text-[10px] text-green-500">✓ 指令已发送</span>
      )}
    </div>
  );
};
