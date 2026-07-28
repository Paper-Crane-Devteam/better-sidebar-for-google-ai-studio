/**
 * useConversationMessages — Hook for non-intrusively reading conversation turns from DOM.
 *
 * Uses htmlToMarkdown to extract markdown-formatted text from both user and model
 * response DOM elements, then parses agent-specific markers (prompt markers,
 * tool result tags) from the markdown text.
 */

import { useState, useEffect, useCallback } from 'react';
import { extractPromptId, RESULT_TAG, findConversationScroller } from './constants';
import { useCurrentConversationId } from '@/entrypoints/overlay.content/shared/hooks/useCurrentConversationId';
import { parseAllToolCallsFromText, type ExtractedToolCall } from './helpers/tool-parser';
import { getAgentEntryById } from '../agent-entry';
import { htmlToMarkdown } from '@/shared/lib/utils/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single tool result section extracted from a user message */
export interface ToolResultEntry {
  toolName: string;
  /** Short description from the ### header line */
  description: string;
  /** Full content of this tool result section */
  content: string;
}

export interface DisplayMessageTurn {
  id: string;
  role: 'user' | 'model';
  rawText: string;
  /** Clean text for display (prompt content stripped, tool results stripped) */
  displayText: string;
  promptId?: string;
  promptTitle?: string;
  promptContent?: string;
  /** Parsed tool result entries (user message contains tool results sent back to AI) */
  toolResults: ToolResultEntry[];
  toolCalls: ExtractedToolCall[];
  isStreaming: boolean;
}

// ─── DOM Selectors ───────────────────────────────────────────────────────────

// Container lookup is shared with ConversationOverlay — see findConversationScroller()

// ─── DOM → Markdown Extraction ───────────────────────────────────────────────

/**
 * Extract markdown text from any conversation element (user-query or model-response).
 * Strips accessibility-only elements before conversion.
 */
function extractMarkdown(el: Element): string {
  // Find the most specific content container
  const contentEl =
    el.querySelector('.markdown, .model-response-text, .response-content') ||
    el.querySelector('.user-query-content, .query-text, .user-query-text') ||
    el;

  const clone = contentEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.cdk-visually-hidden').forEach((h) => h.remove());

  return htmlToMarkdown(clone);
}

// ─── Parsing Helpers ─────────────────────────────────────────────────────────

/**
 * Detect and extract prompt marker [#bs-agent:<id>#] from text.
 * If found, returns the prompt metadata and the user's own text (after "## User Request").
 * If the message is purely system/prompt content, cleanText is empty.
 */
function parsePromptMarker(text: string): {
  promptId: string | null;
  promptTitle: string | null;
  promptContent: string | null;
  cleanText: string;
} {
  const promptId = extractPromptId(text);
  if (!promptId) {
    return { promptId: null, promptTitle: null, promptContent: null, cleanText: text };
  }

  // Resolve against the current agent entries (auto entry + skills). The old
  // built-in prompt registry doesn't know skill ids, so titles fell back to raw ids.
  const entry = getAgentEntryById(promptId);
  const promptTitle = entry?.title || promptId;
  const promptContent = entry?.skill?.promptContent || '';

  // Extract user's additional input from "## User Request" section if present
  let cleanText = '';
  if (text.includes('## User Request')) {
    const parts = text.split(/## User Request\s*/i);
    cleanText = parts[1]?.trim() || '';
  }

  return { promptId, promptTitle, promptContent, cleanText };
}

/**
 * Parse all <bs_agent_result> blocks from text.
 * Each block may contain multiple sections separated by "---".
 * Description = the ### header line only (up to newline).
 */
function parseToolResults(text: string): { results: ToolResultEntry[]; cleanText: string } {
  const tagRegex = new RegExp(`<${RESULT_TAG}>([\\s\\S]*?)<\\/${RESULT_TAG}>`, 'g');
  const results: ToolResultEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    const inner = match[1].trim();
    const body = inner.replace(/^## Tool Execution Results\s*\n+/, '');
    const sections = body.split(/\n\n---\n\n/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const headerMatch = trimmed.match(/^###\s+(.+)\n([\s\S]*)$/);
      if (headerMatch) {
        const description = headerMatch[1].trim();
        const toolNameMatch = description.match(/^([a-zA-Z0-9_-]+)/);
        results.push({
          toolName: toolNameMatch ? toolNameMatch[1] : 'tool_result',
          description,
          content: trimmed,
        });
      } else {
        const firstLineEnd = trimmed.indexOf('\n');
        results.push({
          toolName: 'tool_result',
          description: firstLineEnd > 0 ? trimmed.slice(0, firstLineEnd).trim() : trimmed.slice(0, 60),
          content: trimmed,
        });
      }
    }
  }

  // Strip all result tags from text
  const cleanText = text.replace(new RegExp(`<${RESULT_TAG}>[\\s\\S]*?<\\/${RESULT_TAG}>`, 'g'), '').trim();
  return { results, cleanText };
}

/**
 * Parse a user message: detect tool results, prompt markers, extract clean display text.
 */
function parseUserMessage(text: string) {
  let displayText = text;
  let promptId: string | undefined;
  let promptTitle: string | undefined;
  let promptContent: string | undefined;
  let toolResults: ToolResultEntry[] = [];

  // 1. Check for tool result tags
  if (text.includes(`<${RESULT_TAG}>`)) {
    const parsed = parseToolResults(text);
    toolResults = parsed.results;
    displayText = parsed.cleanText;
  }

  // 2. Check remaining text for prompt markers
  const markerParsed = parsePromptMarker(displayText);
  if (markerParsed.promptId) {
    promptId = markerParsed.promptId;
    promptTitle = markerParsed.promptTitle || undefined;
    promptContent = markerParsed.promptContent || undefined;
    displayText = markerParsed.cleanText;
  }

  return { displayText, promptId, promptTitle, promptContent, toolResults };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useConversationMessages(): DisplayMessageTurn[] {
  const [messages, setMessages] = useState<DisplayMessageTurn[]>([]);
  // Navigating between conversations must force a re-parse and re-bind
  const conversationId = useCurrentConversationId();

  const parseConversationDOM = useCallback(() => {
    const container = findConversationScroller();
    if (!container) {
      setMessages([]);
      return;
    }

    const elements = container.querySelectorAll('user-query, model-response');
    const turns: DisplayMessageTurn[] = [];

    elements.forEach((el, index) => {
      const isUser = el.tagName === 'USER-QUERY';
      const id = `${isUser ? 'user' : 'model'}-${index}`;
      const text = extractMarkdown(el);

      if (isUser) {
        const { displayText, promptId, promptTitle, promptContent, toolResults } = parseUserMessage(text);

        turns.push({
          id,
          role: 'user',
          rawText: text,
          displayText,
          promptId,
          promptTitle,
          promptContent,
          toolResults,
          toolCalls: [],
          isStreaming: false,
        });
      } else {
        const markdownEl = el.querySelector('.markdown, .model-response-text, .response-content');
        const isBusy = el.getAttribute('aria-busy') === 'true' || markdownEl?.getAttribute('aria-busy') === 'true';
        const toolCalls = parseAllToolCallsFromText(text);

        turns.push({
          id,
          role: 'model',
          rawText: text,
          displayText: text,
          toolResults: [],
          toolCalls,
          isStreaming: isBusy,
        });
      }
    });

    setMessages((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(turns)) return prev;
      return turns;
    });
  }, []);

  useEffect(() => {
    // Starting from a clean slate matters: message ids are index-based, so
    // leftovers from the previous conversation would be reused by React.
    setMessages([]);

    let observed: HTMLElement | null = null;
    const observer = new MutationObserver(() => parseConversationDOM());

    /**
     * (Re)bind to the current scroll container.
     *
     * Gemini swaps this element out on SPA navigation. The observer used to be
     * bound once on mount, so after switching conversations it was watching a
     * detached node — no more mutations arrived and the overlay kept showing the
     * previous conversation forever.
     */
    const bind = () => {
      const next = findConversationScroller();
      if (next === observed) return;

      observed = next;
      observer.disconnect();
      if (next) {
        observer.observe(next, { childList: true, subtree: true, characterData: true });
      }
      parseConversationDOM();
    };

    bind();
    const interval = setInterval(bind, 1000);

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [conversationId, parseConversationDOM]);

  return messages;
}
