import { Platform } from '@/shared/types/platform';
import { apiScanner } from './scan-api';
import { scrollHistoryToEnd, waitForHistoryScroller } from './history-scroller';
import i18n from '@/locale/i18n';

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
    // The sidebar history list is the surface that pages through older chats.
    const scroller = await waitForHistoryScroller();

    if (!scroller) {
      console.error('Gemini Sync: Could not find sidebar history scroller');
    } else {
        // Always sync whatever is already loaded (first page)
        totalSynced += await processAndSendItems();

        if (!scroll) {
          console.log('Gemini Sync: scroll=false, synced first page only.');
        } else {
          await scrollHistoryToEnd(scroller, {
            logPrefix: 'Gemini Sync',
            onBatchLoaded: async () => {
              totalSynced += await processAndSendItems();
            },
          });
        }
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
