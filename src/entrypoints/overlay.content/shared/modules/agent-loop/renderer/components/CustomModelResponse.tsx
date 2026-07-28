/**
 * CustomModelResponse — Renders model AI turn as full-width markdown content.
 * No bubble — flat layout similar to Gemini's native style.
 * Embeds ToolCallWidgets inline within markdown content.
 */

import React from 'react';
import type { DisplayMessageTurn } from '../useConversationMessages';
import { Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { ToolCallWidget } from './ToolCallWidget';

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

    message.toolCalls.forEach((tc, idx) => {
      // Text before tool call
      const textBefore = message.rawText.slice(lastIndex, tc.startIndex);
      if (textBefore.trim()) {
        elements.push(
          <MarkdownRenderer key={`text-${idx}`} className="leading-relaxed mb-2">
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
          isLatestResponse={isLatestResponse}
        />,
      );

      lastIndex = tc.endIndex;
    });

    // Text after last tool call
    const textAfter = message.rawText.slice(lastIndex);
    if (textAfter.trim()) {
      elements.push(
        <MarkdownRenderer key="text-last" className="leading-relaxed mt-2">
          {textAfter}
        </MarkdownRenderer>,
      );
    }

    return elements;
  };

  return (
    <div className="my-6 w-full">
      {/* Streaming indicator */}
      {message.isStreaming && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--highlight)/0.12)] px-2 py-0.5 text-xs font-medium text-[rgb(var(--highlight))]">
            <Loader2 className="h-3 w-3 animate-spin" />
            生成中...
          </span>
        </div>
      )}

      {/* Content — full-width, no bubble */}
      <div className="text-[rgb(var(--foreground))]">
        {renderContentWithTools()}
      </div>
    </div>
  );
};
