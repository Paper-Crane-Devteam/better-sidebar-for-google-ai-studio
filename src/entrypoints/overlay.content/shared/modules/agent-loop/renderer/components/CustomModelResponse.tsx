/**
 * CustomModelResponse — Renders model AI turn in custom overlay,
 * embedding Markdown content and interactive ToolCallWidgets.
 */

import React, { useState } from 'react';
import type { DisplayMessageTurn } from '../useConversationMessages';
import { Bot, Copy, Check, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { ToolCallWidget } from './ToolCallWidget';

interface CustomModelResponseProps {
  message: DisplayMessageTurn;
}

export const CustomModelResponse: React.FC<CustomModelResponseProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Split raw text by tool calls to interleave markdown text and ToolCallWidget components
  const renderContentWithTools = () => {
    if (!message.toolCalls || message.toolCalls.length === 0) {
      return (
        <MarkdownRenderer className="text-sm leading-relaxed">
          {message.displayText}
        </MarkdownRenderer>
      );
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    message.toolCalls.forEach((tc, idx) => {
      // Text before tool call
      const textBefore = message.rawText.slice(lastIndex, tc.startIndex);
      if (textBefore.trim()) {
        elements.push(
          <MarkdownRenderer key={`text-${idx}`} className="text-sm leading-relaxed mb-2">
            {textBefore}
          </MarkdownRenderer>,
        );
      }

      // Tool call widget
      elements.push(
        <ToolCallWidget
          key={`tool-${idx}`}
          toolName={tc.toolCall.name}
          description={tc.toolCall.description}
          query={tc.toolCall.params.query || tc.toolCall.params.summary}
          rawText={tc.matchString}
        />,
      );

      lastIndex = tc.endIndex;
    });

    // Text after last tool call
    const textAfter = message.rawText.slice(lastIndex);
    if (textAfter.trim()) {
      elements.push(
        <MarkdownRenderer key="text-last" className="text-sm leading-relaxed mt-2">
          {textAfter}
        </MarkdownRenderer>,
      );
    }

    return elements;
  };

  return (
    <div className="group relative my-4 flex gap-3 px-2">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Bot className="h-4 w-4" />
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-hidden">
        {/* Header line */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Gemini AI</span>
            {message.isStreaming && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                生成中...
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
            title="复制回答内容"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Message body */}
        <div className="rounded-xl bg-background/80 p-4 text-sm text-foreground border border-border/50 shadow-xs">
          {renderContentWithTools()}
        </div>
      </div>
    </div>
  );
};
