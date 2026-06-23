import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { useAppStore } from '@/shared/lib/store';
import { toast } from '@/shared/lib/toast';
import i18n from '@/locale/i18n';
import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
import { SaveSnippetButton } from './SaveSnippetButton';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';

const PROCESSED_ATTR = 'data-bs-snippet-processed';
const MARKDOWN_CACHE_ATTR = 'data-bs-markdown-content';

/**
 * SaveSnippetFeature — injects a shadow-DOM "save snippet" button next to each
 * model-response element in Gemini. Click = save to inbox. Hold = drag to sidebar (also saves to inbox).
 *
 * Markdown content is captured from Gemini API intercepted events (BETTER_SIDEBAR_PROMPT_CREATE
 * and GEMINI_CHAT_CONTENT_RESPONSE) and stored as a data attribute on model-response elements,
 * so that saved snippets preserve the original markdown formatting.
 */
export const SaveSnippetFeature = () => {
  const previousTabRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const dragDataRef = useRef<{ title: string; content: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDragRef = useRef(false);
  const reactRootsRef = useRef<ReactDOM.Root[]>([]);
  // Cache: maps model message content (rc_ id) to its markdown string
  const markdownCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const injectButtons = () => {
      const modelResponses = document.querySelectorAll(
        `model-response:not([${PROCESSED_ATTR}])`,
      );

      modelResponses.forEach((modelResponse) => {
        const markdown = modelResponse.querySelector('.markdown');
        if (markdown && markdown.getAttribute('aria-busy') === 'true') return;

        modelResponse.setAttribute(PROCESSED_ATTR, 'true');

        const modelEl = modelResponse as HTMLElement;
        if (getComputedStyle(modelEl).position === 'static') {
          modelEl.style.position = 'relative';
        }

        // Create shadow DOM host
        const host = document.createElement('div');
        host.className = 'bs-snippet-btn-host';
        host.style.cssText =
          'position:absolute;top:8px;left:-36px;z-index:10;opacity:0;transition:opacity 0.15s;';

        const shadow = host.attachShadow({ mode: 'open' });
        applyShadowStyles(shadow, mainStyles);

        const rootContainer = document.createElement('div');
        rootContainer.className = 'shadow-body';
        shadow.appendChild(rootContainer);

        // Sync dark mode
        const syncTheme = () => {
          const themeValue = localStorage.getItem('Bard-Color-Theme');
          const isDark = themeValue
            ? themeValue === 'Bard-Dark-Theme'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (isDark) rootContainer.classList.add('dark');
          else rootContainer.classList.remove('dark');
        };
        syncTheme();

        // Render React component inside shadow
        const reactRoot = ReactDOM.createRoot(rootContainer);
        reactRootsRef.current.push(reactRoot);

        reactRoot.render(
          <ShadowRootProvider container={rootContainer}>
            <SaveSnippetButton
              onSave={() => {
                const data = extractSnippetData(modelEl);
                if (data) saveToInbox(data.title, data.content);
              }}
              onDragStart={(e) => {
                const data = extractSnippetData(modelEl);
                if (data) {
                  didDragRef.current = true;
                  dragDataRef.current = data;
                  startDragMode(e, data);
                }
              }}
              onMouseDown={() => {
                didDragRef.current = false;
                longPressTimerRef.current = setTimeout(() => {
                  // Will be handled by onDragStart
                }, 300);
              }}
              getLongPressActive={() => !didDragRef.current}
            />
          </ShadowRootProvider>,
        );

        // Show/hide on model-response hover
        modelEl.addEventListener('mouseenter', () => {
          host.style.opacity = '1';
        });
        modelEl.addEventListener('mouseleave', () => {
          if (!isDraggingRef.current) {
            host.style.opacity = '0';
          }
        });

        modelEl.appendChild(host);
      });
    };

    function cleanTitle(raw: string): string {
      let cleaned = raw.replace(/^(you said[:\s]*)/i, '').trim();
      cleaned = cleaned.replace(/^["'"']/, '').replace(/["'"']$/, '');
      return cleaned;
    }

    function extractSnippetData(
      modelResponse: HTMLElement,
    ): { title: string; content: string } | null {
      // Prefer cached markdown from API response (stored via data attribute or cache map)
      let content = modelResponse.getAttribute(MARKDOWN_CACHE_ATTR) || '';

      // Fallback: try to get from the markdown element's textContent
      if (!content) {
        const markdown = modelResponse.querySelector('.markdown');
        content = markdown?.textContent?.trim() || '';
      }
      if (!content) return null;

      let title = '';
      const turn = modelResponse.closest('.conversation-turn, [class*="turn"]');
      if (turn) {
        const userQuery = turn.querySelector('user-query, user-query-content');
        if (userQuery) {
          title = userQuery.textContent?.trim() || '';
        }
      }
      if (!title) {
        let prev: Element | null = modelResponse.previousElementSibling;
        while (prev) {
          if (prev.matches('user-query') || prev.querySelector('user-query')) {
            const uq = prev.matches('user-query')
              ? prev
              : prev.querySelector('user-query');
            title = uq?.textContent?.trim() || '';
            break;
          }
          const innerUq = prev.querySelector('user-query, user-query-content');
          if (innerUq) {
            title = innerUq.textContent?.trim() || '';
            break;
          }
          prev = prev.previousElementSibling;
        }
      }

      title = cleanTitle(title);
      if (!title) {
        title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      }
      if (title.length > 100) {
        title = title.substring(0, 100) + '...';
      }

      return { title, content };
    }

    async function saveToInbox(title: string, content: string) {
      try {
        const inboxRes = await browser.runtime.sendMessage({
          type: 'RESOLVE_SNIPPET_INBOX',
        });
        const folderId = inboxRes?.success ? inboxRes.data : null;

        await browser.runtime.sendMessage({
          type: 'CREATE_SNIPPET',
          payload: {
            id: crypto.randomUUID(),
            title,
            content,
            sourceUrl: window.location.href,
            sourcePlatform: 'gemini',
            folderId,
          },
        });

        useAppStore.getState().fetchData(true);
        toast.success(i18n.t('snippets.savedToInbox'), 1500);
      } catch (err) {
        console.error('[SaveSnippet] Failed to save:', err);
      }
    }

    async function saveToFolder(title: string, content: string, folderId: string | null) {
      try {
        // If no specific folder targeted, resolve inbox
        let targetFolderId = folderId;
        if (!targetFolderId) {
          const inboxRes = await browser.runtime.sendMessage({
            type: 'RESOLVE_SNIPPET_INBOX',
          });
          targetFolderId = inboxRes?.success ? inboxRes.data : null;
        }

        await browser.runtime.sendMessage({
          type: 'CREATE_SNIPPET',
          payload: {
            id: crypto.randomUUID(),
            title,
            content,
            sourceUrl: window.location.href,
            sourcePlatform: 'gemini',
            folderId: targetFolderId,
          },
        });

        useAppStore.getState().fetchData(true);
        toast.success(i18n.t('snippets.savedToInbox'), 1500);
      } catch (err) {
        console.error('[SaveSnippet] Failed to save:', err);
      }
    }

    function startDragMode(e: MouseEvent | React.MouseEvent, data: { title: string; content: string }) {
      isDraggingRef.current = true;

      // Switch sidebar to snippets tab
      previousTabRef.current = useAppStore.getState().ui.overlay.activeTab;
      useAppStore.getState().setActiveTab('snippets');

      // Notify sidebar that snippet drag is active
      window.dispatchEvent(new CustomEvent('SNIPPET_DRAG_START'));

      // Create drag ghost
      const ghost = document.createElement('div');
      ghost.style.cssText =
        'position:fixed;pointer-events:none;z-index:99999;padding:6px 12px;background:var(--gem-sys-color--surface, #fff);border:1px solid var(--gem-sys-color--outline-variant, #dadce0);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.9;';
      ghost.textContent = `📋 ${data.title.substring(0, 30)}`;
      ghost.style.left = `${e.clientX + 10}px`;
      ghost.style.top = `${e.clientY + 10}px`;
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;

      toast.info(i18n.t('snippets.dragToFolder'), 2000);

      document.addEventListener('mousemove', handleDragMove, true);
      document.addEventListener('mouseup', handleDragEnd, true);
    }

    function handleDragMove(e: MouseEvent) {
      if (dragGhostRef.current) {
        dragGhostRef.current.style.left = `${e.clientX + 10}px`;
        dragGhostRef.current.style.top = `${e.clientY + 10}px`;
      }
    }

    function handleDragEnd(_e: MouseEvent) {
      document.removeEventListener('mousemove', handleDragMove, true);
      document.removeEventListener('mouseup', handleDragEnd, true);

      if (dragGhostRef.current) {
        dragGhostRef.current.remove();
        dragGhostRef.current = null;
      }

      isDraggingRef.current = false;

      // Determine target folder: check if there's a pending drop target from the sidebar
      const dropTargetId = (window as any).__snippetDropTargetFolderId || null;
      (window as any).__snippetDropTargetFolderId = null;

      // Dispatch event to end drag state in sidebar
      window.dispatchEvent(new CustomEvent('SNIPPET_DRAG_END'));

      // Only save if dropped inside the sidebar area (i.e. a folder target was hovered)
      if (dragDataRef.current && dropTargetId) {
        saveToFolder(dragDataRef.current.title, dragDataRef.current.content, dropTargetId);
        dragDataRef.current = null;
      } else {
        // Dropped outside sidebar — discard
        dragDataRef.current = null;
      }

      // Restore previous tab
      if (previousTabRef.current) {
        const prevTab = previousTabRef.current;
        previousTabRef.current = null;
        setTimeout(() => {
          useAppStore.getState().setActiveTab(prevTab as any);
        }, 600);
      }
    }

    // Listen for API-intercepted markdown content and cache it on model-response elements
    function handleMarkdownEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail?.messages) return;

      const modelMessages = detail.messages.filter(
        (m: any) => m.role === 'model' && m.content,
      );
      for (const msg of modelMessages) {
        // Cache the markdown content by message ID
        if (msg.id) {
          markdownCacheRef.current.set(msg.id, msg.content);
        }
      }

      // Try to stamp model-response elements with their markdown content
      // Each model-response may have a matching rc_ id in the DOM or by order
      requestAnimationFrame(() => {
        stampMarkdownOnResponses();
      });
    }

    function stampMarkdownOnResponses() {
      const modelResponses = document.querySelectorAll('model-response');
      const cache = markdownCacheRef.current;
      if (cache.size === 0) return;

      modelResponses.forEach((mr) => {
        // Skip if already stamped
        if (mr.getAttribute(MARKDOWN_CACHE_ATTR)) return;

        // Try to find by message-content-id attribute on descendant elements
        const messageContentEl = mr.querySelector('[data-content-id]');
        if (messageContentEl) {
          const contentId = messageContentEl.getAttribute('data-content-id');
          if (contentId && cache.has(contentId)) {
            mr.setAttribute(MARKDOWN_CACHE_ATTR, cache.get(contentId)!);
            return;
          }
        }

        // Fallback: match by the latest cache entry if only one response is untagged
        // This handles the "just generated" case where the most recent response matches the last cache entry
      });
    }

    // Also stamp when content finishes generating (aria-busy -> false)
    function stampLatestResponse() {
      const cache = markdownCacheRef.current;
      if (cache.size === 0) return;

      // Get the last cached markdown (most recently generated)
      const entries = Array.from(cache.entries());
      const lastEntry = entries[entries.length - 1];
      if (!lastEntry) return;

      // Find the last model-response that doesn't have a stamp yet
      const allResponses = document.querySelectorAll('model-response');
      for (let i = allResponses.length - 1; i >= 0; i--) {
        const mr = allResponses[i];
        if (!mr.getAttribute(MARKDOWN_CACHE_ATTR)) {
          const markdown = mr.querySelector('.markdown');
          if (markdown && markdown.getAttribute('aria-busy') !== 'true') {
            mr.setAttribute(MARKDOWN_CACHE_ATTR, lastEntry[1]);
            break;
          }
        }
      }
    }

    window.addEventListener('BETTER_SIDEBAR_PROMPT_CREATE', handleMarkdownEvent);
    window.addEventListener('GEMINI_CHAT_CONTENT_RESPONSE', handleMarkdownEvent);

    // MutationObserver for new model-response elements
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'aria-busy'
        ) {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('aria-busy') === 'false') {
            const modelResp = target.closest('model-response');
            if (modelResp) {
              modelResp.removeAttribute(PROCESSED_ATTR);
              shouldCheck = true;
              // Stamp markdown content from cache when generation finishes
              stampLatestResponse();
            }
          }
        }
      }
      if (shouldCheck) injectButtons();
    });

    const startObserving = () => {
      const container = document.querySelector(
        'infinite-scroller.chat-history, .conversation-container, chat-window',
      );
      if (container) {
        observer.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-busy'],
        });
        injectButtons();
        return true;
      }
      return false;
    };

    if (!startObserving()) {
      const pollInterval = setInterval(() => {
        if (startObserving()) clearInterval(pollInterval);
      }, 1000);
      setTimeout(() => clearInterval(pollInterval), 60000);
    }

    const handleUrlChange = () => setTimeout(injectButtons, 1000);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('BETTER_SIDEBAR_PROMPT_CREATE', handleMarkdownEvent);
      window.removeEventListener('GEMINI_CHAT_CONTENT_RESPONSE', handleMarkdownEvent);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      document.removeEventListener('mousemove', handleDragMove, true);
      document.removeEventListener('mouseup', handleDragEnd, true);
      // Cleanup React roots
      reactRootsRef.current.forEach((root) => root.unmount());
      reactRootsRef.current = [];
    };
  }, []);

  return null;
};
