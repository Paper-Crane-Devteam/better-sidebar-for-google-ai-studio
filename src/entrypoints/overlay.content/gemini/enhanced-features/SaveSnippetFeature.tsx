import { useEffect, useRef } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { toast } from '@/shared/lib/toast';
import i18n from '@/locale/i18n';

const BUTTON_ATTR = 'data-bs-snippet-btn';
const PROCESSED_ATTR = 'data-bs-snippet-processed';

/**
 * SaveSnippetFeature — injects a "save snippet" button next to each
 * model-response element in Gemini. Clicking saves to the inbox folder.
 * Holding mousedown switches sidebar to snippets tab and enables drag-to-folder.
 */
export const SaveSnippetFeature = () => {
  const previousTabRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const dragDataRef = useRef<{ title: string; content: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const injectButtons = () => {
      const modelResponses = document.querySelectorAll(
        `model-response:not([${PROCESSED_ATTR}])`,
      );

      modelResponses.forEach((modelResponse) => {
        // Skip if still streaming
        const markdown = modelResponse.querySelector('.markdown');
        if (markdown && markdown.getAttribute('aria-busy') === 'true') return;

        modelResponse.setAttribute(PROCESSED_ATTR, 'true');

        // Create button container
        const btnHost = document.createElement('div');
        btnHost.setAttribute(BUTTON_ATTR, 'true');
        btnHost.style.cssText =
          'position:absolute;top:8px;left:-36px;z-index:10;opacity:0;transition:opacity 0.15s;';

        // Button element
        const btn = document.createElement('button');
        btn.style.cssText =
          'width:28px;height:28px;border-radius:6px;border:1px solid var(--gem-sys-color--outline-variant, #dadce0);background:var(--gem-sys-color--surface, #fff);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s,box-shadow 0.15s;';
        btn.title = i18n.t('snippets.saveSnippet');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'var(--gem-sys-color--surface-container, #f1f3f4)';
          btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'var(--gem-sys-color--surface, #fff)';
          btn.style.boxShadow = 'none';
        });

        // Show on hover of model-response
        const modelEl = modelResponse as HTMLElement;
        // Ensure position relative for absolute button
        if (getComputedStyle(modelEl).position === 'static') {
          modelEl.style.position = 'relative';
        }

        modelEl.addEventListener('mouseenter', () => {
          btnHost.style.opacity = '1';
        });
        modelEl.addEventListener('mouseleave', () => {
          if (!isDraggingRef.current) {
            btnHost.style.opacity = '0';
          }
        });

        // Click handler: save to inbox immediately
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const data = extractSnippetData(modelEl);
          if (data) {
            saveToInbox(data.title, data.content);
          }
        });

        // Mousedown: start long-press detection for drag mode
        btn.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          const data = extractSnippetData(modelEl);
          if (!data) return;
          dragDataRef.current = data;

          longPressTimerRef.current = setTimeout(() => {
            startDragMode(e, data);
          }, 300);
        });

        btn.addEventListener('mouseup', () => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        });

        btnHost.appendChild(btn);
        modelEl.appendChild(btnHost);
      });
    };

    // Extract title (user query) and content (AI response) from a model-response
    function extractSnippetData(
      modelResponse: HTMLElement,
    ): { title: string; content: string } | null {
      // Get AI response content
      const markdown = modelResponse.querySelector('.markdown');
      const content = markdown?.textContent?.trim() || '';
      if (!content) return null;

      // Get paired user query (previous sibling or conversation-turn parent)
      let title = '';
      const turn = modelResponse.closest('.conversation-turn, [class*="turn"]');
      if (turn) {
        const userQuery = turn.querySelector('user-query, user-query-content');
        if (userQuery) {
          title = userQuery.textContent?.trim() || '';
        }
      }
      if (!title) {
        // Walk backwards in DOM to find preceding user-query
        let prev: Element | null = modelResponse.previousElementSibling;
        while (prev) {
          if (prev.matches('user-query') || prev.querySelector('user-query')) {
            const uq = prev.matches('user-query')
              ? prev
              : prev.querySelector('user-query');
            title = uq?.textContent?.trim() || '';
            break;
          }
          // Also check for conversation-turn containing user-query
          const innerUq = prev.querySelector('user-query, user-query-content');
          if (innerUq) {
            title = innerUq.textContent?.trim() || '';
            break;
          }
          prev = prev.previousElementSibling;
        }
      }

      if (!title) {
        title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      }

      // Truncate title to reasonable length
      if (title.length > 100) {
        title = title.substring(0, 100) + '...';
      }

      return { title, content };
    }

    // Save snippet to inbox folder
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

        // Refresh store data
        useAppStore.getState().fetchData(true);
        toast.success(i18n.t('snippets.savedToInbox'), 1500);
      } catch (err) {
        console.error('[SaveSnippet] Failed to save:', err);
      }
    }

    // Start drag mode: switch tab, show ghost
    function startDragMode(
      e: MouseEvent,
      data: { title: string; content: string },
    ) {
      isDraggingRef.current = true;

      // Remember current tab and switch to snippets
      previousTabRef.current = useAppStore.getState().ui.overlay.activeTab;
      useAppStore.getState().setActiveTab('snippets');

      // Create drag ghost
      const ghost = document.createElement('div');
      ghost.style.cssText =
        'position:fixed;pointer-events:none;z-index:99999;padding:6px 12px;background:var(--gem-sys-color--surface, #fff);border:1px solid var(--gem-sys-color--outline-variant, #dadce0);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.9;';
      ghost.textContent = `📋 ${data.title.substring(0, 30)}`;
      ghost.style.left = `${e.clientX + 10}px`;
      ghost.style.top = `${e.clientY + 10}px`;
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;

      // Toast hint
      toast.info(i18n.t('snippets.dragToFolder'), 2000);

      // Listen for mouse move and up
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }

    function handleDragMove(e: MouseEvent) {
      if (dragGhostRef.current) {
        dragGhostRef.current.style.left = `${e.clientX + 10}px`;
        dragGhostRef.current.style.top = `${e.clientY + 10}px`;
      }
    }

    function handleDragEnd(e: MouseEvent) {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);

      // Remove ghost
      if (dragGhostRef.current) {
        dragGhostRef.current.remove();
        dragGhostRef.current = null;
      }

      isDraggingRef.current = false;

      // Check if dropped on a folder in the sidebar
      // The sidebar tree uses react-arborist which handles drop via its own DnD.
      // Since we can't integrate with react-arborist's internal DnD easily,
      // we'll just save to inbox on drag-end and let the user move it after.
      if (dragDataRef.current) {
        saveToInbox(dragDataRef.current.title, dragDataRef.current.content);
        dragDataRef.current = null;
      }

      // Restore previous tab
      if (previousTabRef.current) {
        setTimeout(() => {
          useAppStore.getState().setActiveTab(previousTabRef.current as any);
          previousTabRef.current = null;
        }, 500);
      }
    }

    // Observe for new model-response elements
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
        // Also watch for aria-busy changes (streaming complete)
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
            }
          }
        }
      }
      if (shouldCheck) {
        injectButtons();
      }
    });

    // Wait for chat container and start observing
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
      // Poll until container appears
      const pollInterval = setInterval(() => {
        if (startObserving()) {
          clearInterval(pollInterval);
        }
      }, 1000);

      // Stop polling after 60s
      setTimeout(() => clearInterval(pollInterval), 60000);
    }

    // Re-inject on URL changes (SPA navigation)
    const handleUrlChange = () => {
      setTimeout(injectButtons, 1000);
    };
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', handleUrlChange);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);

  return null;
};
