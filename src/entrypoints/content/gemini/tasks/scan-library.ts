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

function waitForContentChange(targetNode: Node, timeout = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    let hasChanged = false;
    const observer = new MutationObserver(() => {
      hasChanged = true;
      observer.disconnect();
      resolve(true);
    });

    observer.observe(targetNode, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(hasChanged);
    }, timeout);
  });
}

export async function scanLibrary() {
  console.log('Starting Gemini library scan...');
  
  // Ensure scanner is listening (idempotent check inside start)
  apiScanner.start();

  try {
    // 2. Find Container
    console.log('Waiting for .recent-conversations-container...');
    const container = (await waitForElement(
      '.recent-conversations-container',
      10000
    )) as HTMLElement;

    if (!container) {
      console.error('Gemini Scan: Could not find .recent-conversations-container');
      // Even if we can't scroll, we might have captured some initial items if the page loaded them.
    } else {
        // 3. Scroll Loop
        console.log('Found container, starting scroll loop...');
        let consecutiveNoLoad = 0;

        while (true) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const currentScrollBottom = scrollTop + clientHeight;

            // Check if we are close to the bottom
            if (Math.abs(scrollHeight - currentScrollBottom) < 50) {
                if (consecutiveNoLoad > 2) {
                    console.log('Gemini Scan: Reached end of list.');
                    break;
                }
            }

            // Scroll to bottom
            container.scrollTop = scrollHeight;

            // Wait for content change or timeout
            const changed = await waitForContentChange(container, 2000);
            
            if (changed) {
                consecutiveNoLoad = 0;
                // Tiny buffer
                await new Promise(r => setTimeout(r, 500));
            } else {
                consecutiveNoLoad++;
                // If no change, wait a bit longer just in case network is slow
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    
    // Wait a bit more for any final pending requests
    await new Promise((r) => setTimeout(r, 2000));

  } catch (err) {
      console.error('Gemini Scan: Error during scan', err);
  }

  // 4. Process and Send
  const items = apiScanner.getItems();
  console.log(`Gemini Scan: Collected ${items.length} raw items.`);
  
  const uniqueItems = new Map<string, any>();
  for (const item of items) {
      if (item && item.id) {
          const existing = uniqueItems.get(item.id);
          if (existing) {
              uniqueItems.set(item.id, {
                  ...existing,
                  ...item,
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

  console.log(`Sending ${payloadItems.length} scanned items to background...`);
  try {
    await browser.runtime.sendMessage({
      type: 'SAVE_SCANNED_ITEMS',
      payload: { items: payloadItems },
    });
    console.log('Gemini Scan: Sent items to background.');
  } catch (err) {
    console.error('Gemini Scan: Failed to send items:', err);
  }

  return payloadItems.length;
}
