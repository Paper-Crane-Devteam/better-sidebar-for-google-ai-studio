/**
 * useConversationMessages — Hook for non-intrusively reading conversation turns from DOM.
 *
 * Reads user-query and model-response elements without mutating them,
 * and maintains reactive React state synced with streaming updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { extractPromptId, RESULT_TAG } from './constants';
import { parseAllToolCallsFromText, type ExtractedToolCall } from './helpers/tool-parser';
import { getBuiltInPromptById } from '../prompts/built-in-registry';

export interface DisplayMessageTurn {
  id: string;
  role: 'user' | 'model';
  rawText: string;
  displayText: string;
  promptId?: string;
  promptTitle?: string;
  isToolResult?: boolean;
  resultToolName?: string;
  toolCalls: ExtractedToolCall[];
  isStreaming: boolean;
}

const SCROLLER_SELECTOR = 'infinite-scroller.chat-history, .conversation-container, chat-window';

export function useConversationMessages(): DisplayMessageTurn[] {
  const [messages, setMessages] = useState<DisplayMessageTurn[]>([]);

  const parseConversationDOM = useCallback(() => {
    const container = document.querySelector(SCROLLER_SELECTOR);
    if (!container) {
      setMessages([]);
      return;
    }

    const elements = container.querySelectorAll('user-query, model-response');
    const turns: DisplayMessageTurn[] = [];

    elements.forEach((el, index) => {
      const isUser = el.tagName === 'USER-QUERY';
      const text = el.textContent || '';
      const id = `${isUser ? 'user' : 'model'}-${index}`;

      if (isUser) {
        let promptId: string | undefined = undefined;
        let promptTitle: string | undefined = undefined;
        let isToolResult = false;
        let resultToolName: string | undefined = undefined;
        let displayText = text;

        // Check if this user query is a tool execution result returned to AI
        if (text.includes(`<${RESULT_TAG}>`) || text.includes(RESULT_TAG)) {
          isToolResult = true;
          const matchTool = text.match(/###\s*([a-zA-Z0-9_-]+)/);
          if (matchTool) {
            resultToolName = matchTool[1];
          }

          // Strip RESULT_TAG tags for cleaner text display
          const tagRegex = new RegExp(`<${RESULT_TAG}>([\\s\\S]*?)<\\/${RESULT_TAG}>`);
          const resMatch = text.match(tagRegex);
          if (resMatch) {
            displayText = resMatch[1].trim();
          }
        } else {
          // Extract prompt marker line if present
          const lines = text.split('\n');
          const firstLine = lines[0]?.trim() || '';
          const pid = extractPromptId(firstLine);

          if (pid) {
            promptId = pid;
            const promptObj = getBuiltInPromptById(pid);
            promptTitle = promptObj?.title || pid;

            // Strip marker line and system prompt for clean display
            displayText = lines.slice(1).join('\n').trim();
          }
        }

        turns.push({
          id,
          role: 'user',
          rawText: text,
          displayText: displayText || text,
          promptId,
          promptTitle,
          isToolResult,
          resultToolName,
          toolCalls: [],
          isStreaming: false,
        });
      } else {
        const markdownEl = el.querySelector('.markdown, .model-response-text, .response-content');
        const rawContent = markdownEl?.textContent || text;
        const isBusy = el.getAttribute('aria-busy') === 'true' || markdownEl?.getAttribute('aria-busy') === 'true';

        const toolCalls = parseAllToolCallsFromText(rawContent);

        turns.push({
          id,
          role: 'model',
          rawText: rawContent,
          displayText: rawContent,
          toolCalls,
          isStreaming: isBusy,
        });
      }
    });

    setMessages((prev) => {
      // Prevent unnecessary state updates if JSON representation hasn't changed
      if (JSON.stringify(prev) === JSON.stringify(turns)) return prev;
      return turns;
    });
  }, []);

  useEffect(() => {
    parseConversationDOM();

    const observer = new MutationObserver(() => {
      parseConversationDOM();
    });

    const targetContainer = document.querySelector(SCROLLER_SELECTOR) || document.body;
    observer.observe(targetContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [parseConversationDOM]);

  return messages;
}
