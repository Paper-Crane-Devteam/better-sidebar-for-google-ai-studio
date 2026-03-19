import { useState, useEffect, useCallback, useRef } from 'react';
import { useUrl } from '@/shared/hooks/useUrl';
import { useAppStore } from '@/shared/lib/store';
import { browser } from 'wxt/browser';

export interface ConversationNode {
  id: string; // user message id (e.g. r_xxx)
  conversationId: string;
  content: string; // user message text
  role: 'user' | 'model';
  timestamp?: number;
  orderIndex?: number; // from DB, used for stable sorting
  isActive?: boolean;
  inDom: boolean; // whether the message element exists in the DOM
}

/**
 * Hook that builds conversation nodes from TWO sources simultaneously:
 *
 * 1. Local DB — queried immediately on page switch. Provides the full
 *    conversation history including old messages the user scrolled past
 *    in previous sessions. These may not be in the DOM yet (Gemini
 *    lazy-loads on scroll-up), so they render as grayed-out / disabled.
 *
 * 2. HTTP interceptor events — fired when Gemini actually fetches data
 *    from the network. Provides the freshest data for the current view.
 *
 * Both sources feed into a single merged node list, de-duped by message id.
 * A MutationObserver watches for Gemini lazy-loading older messages into
 * the DOM, flipping `inDom` from false → true so they become clickable.
 */
export const useConversationNodes = () => {
  const [nodes, setNodes] = useState<ConversationNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const nodesRef = useRef<ConversationNode[]>([]);
  const { url } = useUrl();
  const prevUrlRef = useRef<string>(url);
  const conversations = useAppStore((s) => s.conversations);

  // Keep ref in sync
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // --- Helper: extract Gemini conversation external_id from current URL ---
  const getExternalIdFromUrl = useCallback((): string | null => {
    const match = /\/app\/([a-zA-Z0-9_-]+)/.exec(
      globalThis.location?.pathname || '',
    );
    return match?.[1] || null;
  }, []);

  // --- Core merge function ---
  // De-dups by content text (trimmed), because DB messages stored via
  // bulkInsert have random hex IDs while interceptor messages use Gemini's
  // original IDs (e.g. r_xxx). Same message, different IDs.
  // Content is the reliable dedup key within a single conversation.
  const mergeIntoNodes = useCallback(
    (incoming: ConversationNode[]) => {
      if (incoming.length === 0) return;

      setNodes((prev) => {
        // Use trimmed content as dedup key
        const byContent = new Map<string, ConversationNode>();

        for (const n of prev) {
          const key = n.content.trim();
          byContent.set(key, n);
        }

        for (const n of incoming) {
          const key = n.content.trim();
          const existing = byContent.get(key);
          if (!existing) {
            byContent.set(key, n);
          } else {
            // Merge: prefer DB orderIndex, union inDom.
            // For id: prefer the interceptor id (matches DOM element ids).
            // Interceptor ids look like "r_xxx", DB bulkInsert ids are hex.
            // We pick whichever id looks like a Gemini native id, or
            // fall back to the incoming one if both are hex.
            const pickId = looksLikeGeminiId(n.id)
              ? n.id
              : looksLikeGeminiId(existing.id)
                ? existing.id
                : n.id;
            byContent.set(key, {
              ...existing,
              id: pickId,
              inDom: existing.inDom || n.inDom,
              orderIndex: existing.orderIndex ?? n.orderIndex,
              timestamp: existing.timestamp ?? n.timestamp,
            });
          }
        }

        const merged = Array.from(byContent.values());

        // Sort by DB orderIndex (authoritative).
        // Nodes without orderIndex go to the end, sorted by timestamp.
        merged.sort((a, b) => {
          const aHas = a.orderIndex != null;
          const bHas = b.orderIndex != null;
          if (aHas && bHas) return a.orderIndex! - b.orderIndex!;
          if (aHas) return -1;
          if (bHas) return 1;
          return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        });

        if (
          merged.length === prev.length &&
          merged.every(
            (n, i) => n.id === prev[i].id && n.inDom === prev[i].inDom,
          )
        ) {
          return prev;
        }

        return merged;
      });
    },
    [],
  );

  // --- Helper: refresh inDom status for all nodes ---
  const refreshDomPresence = useCallback(() => {
    setNodes((prev) => {
      let changed = false;
      const updated = prev.map((node) => {
        const nowInDom = !!findMessageElement(node.id);
        if (nowInDom !== node.inDom) {
          changed = true;
          return { ...node, inDom: nowInDom };
        }
        return node;
      });
      return changed ? updated : prev;
    });
  }, []);

  // --- Source 1: DB fetch — fires on page switch AND initial load ---
  const dbFetchedForUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const isUrlChange = url !== prevUrlRef.current;
    if (isUrlChange) {
      prevUrlRef.current = url;
      // Reset for new page
      setNodes([]);
      setActiveNodeId(null);
      dbFetchedForUrlRef.current = null;
    }

    // Skip if we already fetched DB for this exact URL
    if (dbFetchedForUrlRef.current === url) return;

    const externalId = getExternalIdFromUrl();
    if (!externalId) return;

    const convo = conversations.find((c) => c.external_id === externalId);
    if (!convo) return;

    dbFetchedForUrlRef.current = url;
    let cancelled = false;

    (async () => {
      try {
        const response = await browser.runtime.sendMessage({
          type: 'GET_MESSAGES_BY_CONVERSATION_ID',
          payload: { conversationId: convo.id },
        });

        if (cancelled || !response?.success || !Array.isArray(response.data))
          return;

        const dbNodes: ConversationNode[] = response.data
          .filter(
            (msg: any) =>
              msg.role === 'user' &&
              msg.content &&
              msg.message_type !== 'thought',
          )
          .map((msg: any) => ({
            id: msg.id,
            conversationId: convo.id,
            content: msg.content,
            role: 'user' as const,
            timestamp: msg.timestamp,
            orderIndex: msg.order_index,
            inDom: !!findMessageElement(msg.id),
          }));

        mergeIntoNodes(dbNodes);
      } catch (e) {
        console.error('SmartScrollbar: DB fetch failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, conversations, getExternalIdFromUrl, mergeIntoNodes]);

  // --- Source 2: HTTP interceptor events ---
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const messages = (event as CustomEvent).detail?.messages;
      if (!messages || !Array.isArray(messages)) return;

      // Gemini returns messages in reverse chronological order (newest first),
      // so we reverse to get oldest-first before merging.
      const reversed = [...messages].reverse();

      const userNodes: ConversationNode[] = reversed
        .filter((msg: any) => msg.role === 'user' && msg.content)
        .map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversation_id,
          content: msg.content,
          role: 'user' as const,
          timestamp: msg.created_at,
          // No orderIndex — only DB provides authoritative order.
          // These nodes sort by timestamp among themselves,
          // and after any DB nodes in the final list.
          inDom: !!findMessageElement(msg.id),
        }));

      mergeIntoNodes(userNodes);
    };

    globalThis.addEventListener('GEMINI_CHAT_CONTENT_RESPONSE', handleEvent);
    globalThis.addEventListener('BETTER_SIDEBAR_PROMPT_CREATE', handleEvent);

    return () => {
      globalThis.removeEventListener(
        'GEMINI_CHAT_CONTENT_RESPONSE',
        handleEvent,
      );
      globalThis.removeEventListener(
        'BETTER_SIDEBAR_PROMPT_CREATE',
        handleEvent,
      );
    };
  }, [mergeIntoNodes]);

  // --- Observe DOM mutations to update inDom status ---
  useEffect(() => {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;

    const observer = new MutationObserver(() => {
      refreshDomPresence();
    });

    observer.observe(chatHistory, { childList: true, subtree: true });
    refreshDomPresence();

    return () => observer.disconnect();
  }, [nodes.length, refreshDomPresence]);

  // --- Track which node is currently visible (scroll detection) ---
  const activeNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    const detectActiveNode = () => {
      const currentNodes = nodesRef.current;
      if (currentNodes.length === 0) return;

      const chatHistory = document.getElementById('chat-history');
      if (!chatHistory) return;

      const viewportCenter = window.innerHeight / 2;
      let bestNode: string | null = null;
      let bestDistance = Infinity;

      for (const node of currentNodes) {
        if (!node.inDom) continue;
        const el = findMessageElement(node.id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - viewportCenter);

        if (rect.top <= viewportCenter) {
          if (distance < bestDistance) {
            bestDistance = distance;
            bestNode = node.id;
          }
        } else if (bestNode === null && distance < bestDistance) {
          bestDistance = distance;
          bestNode = node.id;
        }
      }

      if (bestNode && bestNode !== activeNodeIdRef.current) {
        setActiveNodeId(bestNode);
      }
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(detectActiveNode, 80);
    };

    const chatHistory = document.getElementById('chat-history');
    const scrollTarget = chatHistory || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    setTimeout(detectActiveNode, 500);

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const scrollToNode = useCallback((nodeId: string) => {
    const el = findMessageElement(nodeId);
    if (!el) return;

    const container = el.closest('.conversation-container') || el;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNodeId(nodeId);
  }, []);

  return {
    nodes,
    activeNodeId,
    scrollToNode,
  };
};

/**
 * Gemini native message IDs typically start with "r_" or similar prefixes.
 * DB bulkInsert IDs are 32-char uppercase hex strings.
 * We use this to pick the right id for DOM lookups.
 */
function looksLikeGeminiId(id: string): boolean {
  // Hex-only IDs from randomblob(16) are 32 uppercase hex chars
  return !/^[0-9A-F]{32}$/i.test(id);
}

/**
 * Find a message element in the DOM by its ID.
 * Pattern: message-content-id-r_xxx
 */
function findMessageElement(messageId: string): HTMLElement | null {
  const el = document.querySelector(
    `[id*="message-content-id-${messageId}"]`,
  ) as HTMLElement;
  if (el) return el;

  const allMessageEls = document.querySelectorAll('[id*="message-content-id"]');
  for (const candidate of allMessageEls) {
    if (candidate.id.includes(messageId)) {
      return candidate as HTMLElement;
    }
  }
  return null;
}
