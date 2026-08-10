/**
 * CustomUserMessage — Renders user conversation turn.
 *
 * Layout rules:
 * - Regular user text: gray bubble, right-aligned
 * - System prompt (e.g. "Auto-Classify Conversations"): gray bubble with
 *   a subtle system indicator (icon), clickable → modal to see full prompt
 * - Tool results: gray bubble with each result as a compact entry inside,
 *   clickable → modal to see full result content
 * - All bubbles are gray to distinguish from AI responses (which are full-width markdown)
 */

import React from 'react';
import type { DisplayMessageTurn } from '../useConversationMessages';
import { Sparkles, Terminal } from 'lucide-react';
import { showCapsuleDetailModal } from '@/entrypoints/overlay.content/shared/lib/capsule-modal';

interface CustomUserMessageProps {
  message: DisplayMessageTurn;
}

export const CustomUserMessage: React.FC<CustomUserMessageProps> = ({ message }) => {
  const hasToolResults = message.toolResults.length > 0;
  const hasPrompt = Boolean(message.promptId);
  const hasUserText = Boolean(message.displayText?.trim());

  // ─── Tool Result Message ─────────────────────────────────────────────
  // Gray bubble containing each result as a clickable entry
  if (hasToolResults) {
    return (
      <div className="my-6 flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-[rgb(var(--muted))] px-4 py-2">
          {/* Optional user text above results */}
          {hasUserText && (
            <p className="text-[rgb(var(--foreground))] mb-2 whitespace-pre-wrap break-words">
              {message.displayText}
            </p>
          )}

          {/* Each tool result as a clickable row */}
          <div className="flex flex-col gap-1">
            {message.toolResults.map((result, i) => (
              <div
                key={`result-${i}`}
                className="flex items-center gap-1 min-w-0 text-xs text-[rgb(var(--muted-foreground))] cursor-pointer hover:text-[rgb(var(--foreground))] transition-colors py-1 px-2 rounded-md hover:bg-[rgb(var(--background)/0.5)]"
                onClick={() =>
                  showCapsuleDetailModal(
                    result.description,
                    result.content,
                  )
                }
                title="点击查看完整返回结果"
              >
                <Terminal className="h-3 w-3 shrink-0 text-emerald-500" />
                <span className="min-w-0 truncate">{result.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── System Prompt Message ───────────────────────────────────────────
  // Gray bubble with sparkle icon, clickable to see full prompt content
  if (hasPrompt) {
    return (
      <div className="my-6 flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-tr-md bg-[rgb(var(--muted))] px-4 py-2 cursor-pointer hover:bg-[rgb(var(--muted)/0.8)] transition-colors"
          onClick={() =>
            showCapsuleDetailModal(
              message.promptTitle || 'System Prompt',
              message.promptContent || message.rawText,
            )
          }
          title="点击查看完整 Prompt"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--highlight))]" />
            <span className="font-medium text-[rgb(var(--foreground))]">
              {message.promptTitle}
            </span>
          </div>
          {hasUserText && (
            <p className="mt-1 text-[rgb(var(--muted-foreground))] whitespace-pre-wrap break-words line-clamp-3">
              {message.displayText}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Regular User Message ────────────────────────────────────────────
  // Plain gray bubble, not clickable
  if (!hasUserText) return null;

  return (
    <div className="my-6 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-[rgb(var(--muted))] px-4 py-2 leading-relaxed text-[rgb(var(--foreground))]">
        <span className="whitespace-pre-wrap break-words">{message.displayText}</span>
      </div>
    </div>
  );
};
