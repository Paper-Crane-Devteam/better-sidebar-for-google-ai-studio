/**
 * Hook: useConversationNodes
 *
 * Provides SmartScrollbar with conversation nodes + active-node tracking.
 * Data is sourced from the shared conversation-messages-store (initialized
 * by useInitConversationMessages at the app root).
 *
 * This hook only adds scroll-based active-node detection on top of the store.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  useConversationMessagesStore,
  type ConversationMessage,
} from '@/shared/lib/conversation-messages-store';
import {
  findMessageElement,
  getChatScrollContainer,
} from './dom-utils';
import type { ConversationNode } from './types';
import { extractHeadings } from './types';

export type { ConversationNode } from './types';

// ── Constants ────────────────────────────────────────────────────────
const SCROLL_DEBOUNCE_MS = 80;
const INITIAL_DETECT_DELAY_MS = 500;

// ── Message → Node mapper ────────────────────────────────────────────
function messageToNode(msg: ConversationMessage): ConversationNode {
  return {
    id: msg.id,
    conversationId: '',
    content: msg.content,
    role: msg.role,
    timestamp: msg.timestamp,
    orderIndex: msg.orderIndex,
    inDom: msg.inDom,
    headings: msg.role === 'model' ? extractHeadings(msg.content) : undefined,
  };
}

// ── The hook ─────────────────────────────────────────────────────────

export function useConversationNodes() {
  const messages = useConversationMessagesStore((s) => s.messages);

  // Map messages to ConversationNode format
  const nodes: ConversationNode[] = messages.map(messageToNode);

  // ── Active-node detection (scroll tracking) ─────────────────────
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  const activeRef = useRef<string | null>(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { activeRef.current = activeNodeId; }, [activeNodeId]);

  const detectActiveNode = useCallback(() => {
    const current = nodesRef.current;
    if (!current.length) return;

    const scrollContainer = getChatScrollContainer();
    if (!scrollContainer) return;

    const center = window.innerHeight / 2;
    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const node of current) {
      if (!node.inDom) continue;
      const el = findMessageElement(node.id);
      if (!el) continue;

      const top = el.getBoundingClientRect().top;
      const dist = Math.abs(top - center);

      if (top <= center) {
        if (dist < bestDist) { bestDist = dist; bestId = node.id; }
      } else if (!bestId && dist < bestDist) {
        bestDist = dist; bestId = node.id;
      }
    }

    if (bestId && bestId !== activeRef.current) setActiveNodeId(bestId);
  }, []);

  // Re-detect whenever nodes change
  useEffect(() => {
    detectActiveNode();
  }, [nodes, detectActiveNode]);

  // Scroll listener
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(detectActiveNode, SCROLL_DEBOUNCE_MS);
    };

    const target = getChatScrollContainer() || window;
    target.addEventListener('scroll', onScroll, { passive: true });

    const initTimer = setTimeout(detectActiveNode, INITIAL_DETECT_DELAY_MS);

    return () => {
      target.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
      clearTimeout(initTimer);
    };
  }, [detectActiveNode]);

  // ── Public API ───────────────────────────────────────────────────
  const scrollToNode = useCallback((nodeId: string) => {
    const el = findMessageElement(nodeId);
    if (!el) return;
    const container = el.closest('.conversation-container') || el;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNodeId(nodeId);
  }, []);

  return { nodes, activeNodeId, scrollToNode };
}
