/**
 * CustomModelResponse — Renders model AI turn as full-width markdown content.
 * No bubble — flat layout similar to Gemini's native style.
 * Embeds ToolCallWidgets inline within markdown content.
 */

import React from 'react';
import type { DisplayMessageTurn } from '../useConversationMessages';

import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { ToolCallWidget } from './ToolCallWidget';
import { isHiddenTool } from '../constants';

interface CustomModelResponseProps {
  message: DisplayMessageTurn;
  /** True for the newest model turn — only there can tools be run manually */
  isLatestResponse?: boolean;
}

export const CustomModelResponse: React.FC<CustomModelResponseProps> = ({
  message,
  isLatestResponse = false,
}) => {
  // Split raw text by tool calls to interleave markdown text and ToolCallWidget components
  const renderContentWithTools = () => {
    if (!message.toolCalls || message.toolCalls.length === 0) {
      return (
        <MarkdownRenderer className="leading-relaxed">
          {message.displayText}
        </MarkdownRenderer>
      );
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    /**
     * Drop a fence marker left stranded by lifting a tool call out of the prose.
     *
     * The prompt asks for bare `<bs_agent_tool>` tags, but models like to wrap
     * them in a code block anyway. Cutting the tag out of the middle then leaves
     * the opening fence at the tail of one segment and the closing fence at the
     * head of the next, which would swallow everything after it as code.
     * Only an odd fence count can be stranded, so a balanced segment is left be.
     */
    const stripOrphanFence = (text: string) => {
      const fences = text.match(/^ *`{3,}[^\n]*$/gm)?.length ?? 0;
      if (fences % 2 === 0) return text;
      // Exactly one marker goes: the stranded closing fence always leads the
      // segment after a tool call, the stranded opening fence always trails the
      // segment before it. Removing both would unbalance a real code block that
      // happens to sit in the same segment.
      const leading = /^\n* *`{3,}[^\n]*\n*/;
      return leading.test(text)
        ? text.replace(leading, '\n')
        : text.replace(/\n* *`{3,}[^\n]*\n*$/, '\n');
    };

    // Prose is buffered rather than flushed per tool call, so a hidden tool leaves
    // no seam: the text on either side of it merges back into one markdown block
    // instead of two with a gap where the card would have been.
    let pending = '';
    const flushText = (key: string, className: string) => {
      const text = stripOrphanFence(pending);
      pending = '';
      if (!text.trim()) return;
      elements.push(
        <MarkdownRenderer key={key} className={`leading-relaxed ${className}`}>
          {text}
        </MarkdownRenderer>,
      );
    };

    message.toolCalls.forEach((tc, idx) => {
      pending += message.rawText.slice(lastIndex, tc.startIndex);
      lastIndex = tc.endIndex;

      // A hidden tool consumes its span (so the raw block never leaks into the
      // markdown) but contributes no card.
      if (isHiddenTool(tc.toolCall.name)) return;

      flushText(`text-${idx}`, 'mb-2');

      elements.push(
        <ToolCallWidget
          key={`tool-${idx}`}
          toolName={tc.toolCall.name}
          description={tc.toolCall.description}
          query={tc.toolCall.params.query || tc.toolCall.params.summary}
          rawText={tc.matchString}
          isLatestResponse={isLatestResponse}
          outcome={message.toolOutcomes[idx] ?? null}
        />,
      );
    });

    pending += message.rawText.slice(lastIndex);
    flushText('text-last', elements.length > 0 ? 'mt-2' : '');

    return elements;
  };

  return (
    <div className="my-6 w-full">
      {/* Streaming indicator — removed: the dock pill already shows "Thinking…"
          and the spinning dot, so the per-turn tag was redundant visual noise. */}

      {/* Content — full-width, no bubble */}
      <div className="text-[rgb(var(--foreground))]">
        {renderContentWithTools()}
      </div>
    </div>
  );
};
