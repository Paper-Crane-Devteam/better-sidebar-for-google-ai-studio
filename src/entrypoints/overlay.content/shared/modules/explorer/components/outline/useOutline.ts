/**
 * Hook: useOutline
 *
 * Builds outline section data from conversation nodes.
 * Uses useUrl to detect URL changes (same pattern as SmartScrollbar).
 * Fetches messages from DB and interceptor events.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUrl } from '@/shared/hooks/useUrl';
import { useAppStore } from '@/shared/lib/store';
import { browser } from 'wxt/browser';
import { parseOutlineFromContent } from './parse-outline';
import type { OutlineSection, OutlineFilter } from './types';
import {
  findMessageElement,
  getChatScrollContainer,
} from '@/entrypoints/overlay.content/gemini/enhanced-features/SmartScrollbar/dom-utils';

// ── URL helpers ──────────────────────────────────────────────────────
const EXTERNAL_ID_RE = /\/app\/([a-zA-Z0-9_-]+)/;
const GEM_CONVO_ID_RE = /\/gem\/[^/]+\/([a-zA-Z0-9_-]+)/;

function extractExternalId(path: string): string | null {
  return EXTERNAL_ID_RE.exec(path)?.[1] || GEM_CONVO_ID_RE.exec(path)?.[1] || null;
}

interface RawMessage {
  id: string;
  content: string;
  role: 'user' | 'model';
  timestamp?: number;
  order_index?: number;
  message_type?: string;
}

export function useOutline() {
  const { url, path } = useUrl();
  const conversations = useAppStore((s) => s.conversations);

  const [sections, setSections] = useState<OutlineSection[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OutlineFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pathRef = useRef(path);
  const prevUrlRef = useRef(url);

  useEffect(() => { pathRef.current = path; }, [path]);

  // ── Build sections from messages ─────────────────────────────────
  const buildSections = useCallback((messages: RawMessage[]): OutlineSection[] => {
    const result: OutlineSection[] = [];
    let turnIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== 'user') continue;

      turnIndex++;
      const userContent = msg.content.trim();
      const userLabel =
        userContent.length > 80
          ? userContent.substring(0, 80) + '…'
          : userContent;

      const modelMsg = messages[i + 1]?.role === 'model' ? messages[i + 1] : undefined;
      const children = modelMsg
        ? parseOutlineFromContent(modelMsg.content, modelMsg.id)
        : [];

      result.push({
        id: `section-${msg.id}`,
        userQuery: userLabel,
        userQueryFull: userContent,
        userMessageId: msg.id,
        userInDom: !!findMessageElement(msg.id),
        modelMessageId: modelMsg?.id,
        modelContent: modelMsg?.content,
        modelInDom: modelMsg ? !!findMessageElement(modelMsg.id) : false,
        children,
        turnIndex,
        timestamp: msg.timestamp,
      });
    }

    return result;
  }, []);

  // ── Fetch messages on URL change ─────────────────────────────────
  useEffect(() => {
    const isUrlChange = url !== prevUrlRef.current;
    if (isUrlChange) {
      prevUrlRef.current = url;
      setSections([]);
      setActiveMessageId(null);
    }

    const externalId = extractExternalId(path);
    if (!externalId) {
      setSections([]);
      return;
    }

    const convo = conversations.find((c) => c.external_id === externalId);
    if (!convo) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await browser.runtime.sendMessage({
          type: 'GET_MESSAGES_BY_CONVERSATION_ID',
          payload: { conversationId: convo.id },
        });
        if (cancelled || !response?.success || !Array.isArray(response.data)) return;
        if (extractExternalId(pathRef.current) !== externalId) return;

        const messages: RawMessage[] = response.data
          .filter(
            (msg: any) =>
              (msg.role === 'user' || msg.role === 'model') &&
              msg.content &&
              msg.message_type !== 'thought',
          )
          .sort((a: any, b: any) => {
            if (a.order_index != null && b.order_index != null)
              return a.order_index - b.order_index;
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
          });

        const built = buildSections(messages);
        setSections(built);
      } catch (e) {
        console.error('Outline: DB fetch failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url, conversations, buildSections]);

  // ── Live updates from interceptor ────────────────────────────────
  useEffect(() => {
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const messages = detail?.messages;
      if (!messages || !Array.isArray(messages)) return;

      const eventConvoId = detail?.conversationId ?? detail?.id;
      const urlConvoId = extractExternalId(pathRef.current);
      if (!urlConvoId || !eventConvoId || eventConvoId !== urlConvoId) return;

      const sorted = [...messages]
        .filter(
          (msg: any) =>
            (msg.role === 'user' || msg.role === 'model') && msg.content,
        )
        .sort((a: any, b: any) => {
          if (a.order_index != null && b.order_index != null)
            return a.order_index - b.order_index;
          return (a.created_at ?? 0) - (b.created_at ?? 0);
        })
        .map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'model',
          timestamp: msg.created_at,
          order_index: msg.order_index,
        }));

      const built = buildSections(sorted);
      setSections(built);
    };

    globalThis.addEventListener('GEMINI_CHAT_CONTENT_RESPONSE', handleEvent);
    globalThis.addEventListener('BETTER_SIDEBAR_PROMPT_CREATE', handleEvent);
    return () => {
      globalThis.removeEventListener('GEMINI_CHAT_CONTENT_RESPONSE', handleEvent);
      globalThis.removeEventListener('BETTER_SIDEBAR_PROMPT_CREATE', handleEvent);
    };
  }, [buildSections]);

  // ── Active section detection (scroll tracking) ───────────────────
  useEffect(() => {
    const detect = () => {
      if (sections.length === 0) return;
      const center = window.innerHeight / 2;
      let bestId: string | null = null;
      let bestDist = Infinity;

      for (const section of sections) {
        const el = findMessageElement(section.userMessageId);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        const dist = Math.abs(top - center);
        if (top <= center && dist < bestDist) {
          bestDist = dist;
          bestId = section.userMessageId;
        } else if (!bestId && dist < bestDist) {
          bestDist = dist;
          bestId = section.userMessageId;
        }
      }

      if (bestId && bestId !== activeMessageId) {
        setActiveMessageId(bestId);
      }
    };

    detect();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(detect, 100);
    };

    const target = getChatScrollContainer() || window;
    target.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [sections, activeMessageId]);

  // ── Navigation ───────────────────────────────────────────────────
  const scrollToMessage = useCallback((messageId: string) => {
    const el = findMessageElement(messageId);
    if (!el) return;
    const container = el.closest('.conversation-container') || el;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveMessageId(messageId);
  }, []);

  // ── Filtered sections ────────────────────────────────────────────
  const filteredSections = useMemo(() => {
    let result = sections;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result
        .map((section) => {
          const matchesQuery = section.userQuery.toLowerCase().includes(q);
          const matchingChildren = section.children.filter(
            (child) =>
              child.label.toLowerCase().includes(q) ||
              child.children.some((c) => c.label.toLowerCase().includes(q)),
          );
          if (matchesQuery || matchingChildren.length > 0) {
            return {
              ...section,
              children: matchesQuery ? section.children : matchingChildren,
            };
          }
          return null;
        })
        .filter(Boolean) as OutlineSection[];
    }

    if (filter !== 'all') {
      const allowedTypes: Record<Exclude<OutlineFilter, 'all'>, string[]> = {
        headings: ['heading'],
        code: ['code-block'],
        images: ['image'],
        tables: ['table'],
        links: ['link'],
        math: ['math'],
      };
      const types = allowedTypes[filter];
      result = result
        .map((section) => {
          const filtered = section.children.filter((c) =>
            types.includes(c.type),
          );
          if (filtered.length > 0) {
            return { ...section, children: filtered };
          }
          return null;
        })
        .filter(Boolean) as OutlineSection[];
    }

    return result;
  }, [sections, filter, searchQuery]);

  // ── Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let headings = 0;
    let codeBlocks = 0;
    let images = 0;
    let tables = 0;
    let links = 0;
    let math = 0;
    const countNodes = (nodes: OutlineSection['children']) => {
      for (const node of nodes) {
        if (node.type === 'heading') headings++;
        if (node.type === 'code-block') codeBlocks++;
        if (node.type === 'image') images++;
        if (node.type === 'table') tables++;
        if (node.type === 'link') links++;
        if (node.type === 'math') math++;
        countNodes(node.children);
      }
    };
    sections.forEach((s) => countNodes(s.children));
    return { turns: sections.length, headings, codeBlocks, images, tables, links, math };
  }, [sections]);

  return {
    sections: filteredSections,
    allSections: sections,
    activeMessageId,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    scrollToMessage,
    isLoading,
    stats,
    isOnConversation: !!extractExternalId(path),
  };
}
