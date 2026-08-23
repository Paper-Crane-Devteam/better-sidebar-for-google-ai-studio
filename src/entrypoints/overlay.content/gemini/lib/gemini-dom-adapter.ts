/**
 * Gemini Platform DOM Adapter
 *
 * Wraps existing dom-utils to conform to the PlatformDomAdapter interface.
 */

import type { PlatformDomAdapter } from '@/shared/lib/platform-dom-adapter';
import type { ConversationMessage } from '@/shared/lib/conversation-messages-store';
import {
  findMessageElement,
  getChatScrollContainer,
  looksLikeGeminiId,
} from '../enhanced-features/SmartScrollbar/dom-utils';

const EXTERNAL_ID_RE = /\/app\/([a-zA-Z0-9_-]+)/;
const GEM_CONVO_ID_RE = /\/gem\/[^/]+\/([a-zA-Z0-9_-]+)/;

export const geminiDomAdapter: PlatformDomAdapter = {
  extractExternalId(path: string): string | null {
    return EXTERNAL_ID_RE.exec(path)?.[1] || GEM_CONVO_ID_RE.exec(path)?.[1] || null;
  },

  findMessageElement(messageId: string): HTMLElement | null {
    return findMessageElement(messageId);
  },

  getChatScrollContainer(): HTMLElement | null {
    return getChatScrollContainer();
  },

  interceptorEvents: [
    'GEMINI_CHAT_CONTENT_RESPONSE',
    'BETTER_SIDEBAR_PROMPT_CREATE',
  ],

  parseInterceptorEvent(detail: any) {
    const messages = detail?.messages;
    if (!messages || !Array.isArray(messages)) return null;

    const conversationId = detail?.conversationId ?? detail?.id;
    if (!conversationId) return null;

    const parsed: ConversationMessage[] = messages
      .filter((msg: any) => (msg.role === 'user' || msg.role === 'model') && msg.content)
      .map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'model',
        timestamp: msg.created_at,
        orderIndex: msg.order_index,
        inDom: !!findMessageElement(msg.id),
      }));

    return {
      conversationId,
      messages: parsed,
      replaceAfterMessageId: detail?.replaceAfterMessageId,
    };
  },
};
