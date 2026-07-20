/**
 * CustomUserMessage — Renders user conversation turn in custom overlay.
 * Also handles tool result turns sent back to AI during Agent executions.
 */

import React, { useState } from 'react';
import type { DisplayMessageTurn } from '../useConversationMessages';
import { User, Sparkles, Copy, Check, Wrench } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface CustomUserMessageProps {
  message: DisplayMessageTurn;
}

export const CustomUserMessage: React.FC<CustomUserMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.displayText || message.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (message.isToolResult) {
    return (
      <div className="group relative my-3 flex gap-3 px-2">
        {/* Tool Icon */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Wrench className="h-3.5 w-3.5" />
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-hidden">
          {/* Header */}
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Tool Result
              </span>
              {message.resultToolName && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                  {message.resultToolName}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
              title="复制工具返回内容"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Result Content Body */}
          <div className="rounded-lg bg-amber-500/5 p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap max-h-[250px] overflow-y-auto border border-amber-500/20">
            {message.displayText}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative my-4 flex gap-3 px-2">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <User className="h-4 w-4" />
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden">
        {/* Header line */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">User</span>
            {message.promptTitle && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                <Sparkles className="h-3 w-3" />
                {message.promptTitle}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
            title="复制消息内容"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Message body */}
        <div className="rounded-xl bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap border border-border/40">
          {message.displayText}
        </div>
      </div>
    </div>
  );
};
