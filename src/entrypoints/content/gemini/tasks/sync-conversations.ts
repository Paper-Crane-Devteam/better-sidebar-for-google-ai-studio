import { Platform } from '@/shared/types/platform';
import { apiScanner } from './scan-api';
import i18n from '@/locale/i18n';

function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver((_mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function waitForSpinnerStopLoading(selector: string, timeout = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    // If element doesn't exist, we consider it "not loading"
    if (!el) return resolve(true);
    // If element exists but doesn't have class, it's not loading
    if (!el.classList.contains('is-loading')) return resolve(true);

    const observer = new MutationObserver((mutations) => {
      const el = document.querySelector(selector);
      // If element is gone, good
      if (!el) {
        observer.disconnect();
        resolve(true);
        return;
      }
      // If element exists but lost the class
      if (!el.classList.contains('is-loading')) {
        observer.disconnect();
        resolve(true);
      }
    });

    observer.observe(el, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Fallback: observe parent for removal just in case
    observer.observe(el.parentElement || document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      const finalEl = document.querySelector(selector);
      resolve(!finalEl || !finalEl.classList.contains('is-loading'));
    }, timeout);
  });
}

async function processAndSendItems() {
    const items = apiScanner.getItems();
    if (items.length === 0) return 0;

    const notebookItems = items.filter((i) => i.notebook_id);
    console.log(`Gemini Sync: Processing ${items.length} raw items (${notebookItems.length} notebook conversations).`);
    
    // Deduplicate items based on ID, merging fields so later data doesn't
    // clobber already-known metadata (e.g. notebook_id, gem_id, type).
    const uniqueItems = new Map<string, any>();
    for (const item of items) {
        if (item && item.id) {
            const existing = uniqueItems.get(item.id);
            if (existing) {
                // Merge: prefer non-null/non-default values from either copy
                uniqueItems.set(item.id, {
                    ...existing,
                    ...item,
                    // Preserve richer metadata that may come from a different response
                    gem_id: item.gem_id || existing.gem_id,
                    notebook_id: item.notebook_id || existing.notebook_id,
                    type: (item.notebook_id ? 'notebook' : item.gem_id ? 'gem' : null)
                        || (existing.notebook_id ? 'notebook' : existing.gem_id ? 'gem' : null)
                        || item.type || existing.type || 'conversation',
                });
            } else {
                uniqueItems.set(item.id, item);
            }
        }
    }

    // Transform to Conversation format
    const payloadItems = Array.from(uniqueItems.values()).map((item) => ({
        id: item.id,
        title: item.title || i18n.t('common.untitled'),
        external_id: item.id,
        external_url: `https://gemini.google.com/app/${item.id}`,
        // The list endpoint only exposes a last-active timestamp (already in
        // seconds). `created_at` is intentionally omitted so the DB upsert's
        // COALESCE keeps any real creation time captured on the create path.
        updated_at: item.last_active_at ?? Math.floor(Date.now() / 1000),
        last_active_at: item.last_active_at ?? Math.floor(Date.now() / 1000),
        platform: Platform.GEMINI,
        type: item.type || 'conversation',
        gem_id: item.gem_id || null,
        notebook_id: item.notebook_id || null,
    }));

    if (payloadItems.length > 0) {
        console.log(`Gemini Sync: Sending ${payloadItems.length} items to background...`);
        try {
            await browser.runtime.sendMessage({
                type: 'SYNC_CONVERSATIONS',
                platform: Platform.GEMINI,
                payload: { items: payloadItems },
            });
            // Clear items from scanner after successful send so we don't send them again
            // apiScanner.clear();
        } catch (err) {
            console.error('Gemini Sync: Failed to send items:', err);
        }
    }
    return payloadItems.length;
}

export interface SyncConversationsOptions {
  /** Whether to scroll through the entire list. Defaults to false (first page only). */
  scroll?: boolean;
}

export async function syncConversations(options: SyncConversationsOptions = {}) {
  const { scroll = false } = options;
  console.log(`Starting Gemini conversation sync (scroll=${scroll})...`);
  
  // Start scanner to capture API responses
  apiScanner.start();

  let totalSynced = 0;

  try {
    // Find the infinite scroller element
    // User mentioned "element is infinite-scroller", so we try tag name first, then class
    let scroller = (await waitForElement('infinite-scroller')) as HTMLElement;
    if (!scroller) {
      console.log('Could not find <infinite-scroller>, trying .infinite-scroller');
      scroller = (await waitForElement('.infinite-scroller')) as HTMLElement;
    }

    if (!scroller) {
      console.error('Gemini Sync: Could not find infinite-scroller element');
    } else {
        // Always sync whatever is already loaded (first page)
        totalSynced += await processAndSendItems();

        if (!scroll) {
          console.log('Gemini Sync: scroll=false, synced first page only.');
        } else {
        console.log('Found infinite-scroller, starting scroll loop...');
        
        let previousScrollHeight = 0;
        let noChangeCount = 0;

        // Scroll loop
        while (true) {
            const { scrollHeight } = scroller;
            
            // Scroll to bottom
            scroller.scrollTop = scrollHeight;

            // Wait a bit for the spinner state to update or scroll to happen
            await new Promise(r => setTimeout(r, 800));

            // Check if spinner exists and has is-loading class
            const spinner = scroller.querySelector('.loading-history-spinner-container');
            const isLoading = spinner && spinner.classList.contains('is-loading');

            if (isLoading) {
                console.log('Gemini Sync: Spinner is loading, waiting for completion...');
                // Wait for is-loading class to be removed (max 20s)
                await waitForSpinnerStopLoading('.loading-history-spinner-container', 20000);
                
                // Reset no change count since we were loading
                noChangeCount = 0;
                
                // Give a small buffer for DOM to settle
                await new Promise(r => setTimeout(r, 500));

                // Process items after each successful load
                totalSynced += await processAndSendItems();

            } else {
                // Not loading.
                // Check if scroll height has changed since last check
                const currentScrollHeight = scroller.scrollHeight;
                
                if (currentScrollHeight === previousScrollHeight) {
                    // Height didn't change and not loading
                    noChangeCount++;
                    console.log(`Gemini Sync: Not loading and no height change (count: ${noChangeCount})`);
                    
                    if (noChangeCount >= 2) {
                        // Double check with a longer delay
                        await new Promise(r => setTimeout(r, 1500));
                        const finalSpinner = scroller.querySelector('.loading-history-spinner-container');
                        const finalIsLoading = finalSpinner && finalSpinner.classList.contains('is-loading');
                        const finalScrollHeight = scroller.scrollHeight;
                        
                        if (!finalIsLoading && finalScrollHeight === currentScrollHeight) {
                            console.log('Gemini Sync: Reached end of list.');
                            break;
                        }
                    }
                } else {
                     // Height changed (content loaded fast?)
                     noChangeCount = 0;
                     console.log('Gemini Sync: Height changed without seeing loading state, continuing...');
                     
                     // Even if we didn't see the spinner, if height changed, new content might have loaded
                     totalSynced += await processAndSendItems();
                }
                
                previousScrollHeight = currentScrollHeight;
            }
        }
        } // end if (scroll)
    }
    
    // Wait a bit more for any final pending requests
    await new Promise((r) => setTimeout(r, 2000));
    // Final sync
    totalSynced += await processAndSendItems();

  } catch (err) {
      console.error('Gemini Sync: Error during scrolling', err);
  }

  // Stop scanner
  // apiScanner.stop();
  // apiScanner.clear();

  // Register a debounced auto-flush for late-arriving items (e.g. notebook chats
  // whose list-chat response arrives after the main sync loop finishes).
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSentCount = apiScanner.getItems().length;
  apiScanner.setOnNewItems(() => {
    // Only flush if there are genuinely new items since last send
    if (apiScanner.getItems().length <= lastSentCount) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(async () => {
      console.log('Gemini Sync: Auto-flushing late-arriving items...');
      const sent = await processAndSendItems();
      if (sent > 0) {
        lastSentCount = apiScanner.getItems().length;
        console.log(`Gemini Sync: Auto-flush sent ${sent} items.`);
      }
    }, 1500);
  });

  return totalSynced;
}
