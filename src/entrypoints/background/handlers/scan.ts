import { conversationRepo } from '@/shared/db/operations';
import { navigate } from '@/shared/lib/navigation';
import type { ExtensionMessage, ExtensionResponse } from '@/shared/types/messages';
import type { MessageSender } from '../types';
import { Platform } from '@/shared/types/platform';
import { resolveGemNotebookFolderId } from './resolve-sync-folder';

// Track which tab initiated the library scan so SCAN_COMPLETE
// notification is only sent back to that tab (not all tabs).
let scanOriginTabId: number | null = null;

function getPageLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function handleScan(
  message: ExtensionMessage,
  sender: MessageSender
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'GET_PAGE_LOCAL_STORAGE': {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        return { success: false, error: 'No tab' };
      }
      try {
        const results = await browser.scripting.executeScript({
          target: { tabId },
          func: getPageLocalStorage,
          args: [message.payload.key],
          world: 'MAIN',
        });
        const value = results?.[0]?.result ?? null;
        return { success: true, data: value };
      } catch (err) {
        console.error('GET_PAGE_LOCAL_STORAGE failed:', err);
        return { success: false, error: (err as Error).message };
      }
    }
    case 'SCAN_LIBRARY': {
      const platform = message.platform || 'aistudio';
      // Gemini's `/search` history page no longer lazy-loads on scroll, so its
      // scan drives the native sidebar in place — no navigation needed.
      const url =
        platform === Platform.GEMINI
          ? null
          : platform === Platform.CHATGPT
          ? 'https://chatgpt.com/'
          : 'https://aistudio.google.com/library';

      console.log(
        `[BS Scan] SCAN_LIBRARY platform=${platform} navigateTo=${url ?? '(stay on current page)'}`,
      );

      // Always scan in the tab that initiated the request so that
      // isScanning UI state and SCAN_COMPLETE stay on the same tab.
      const originTabId = sender.tab?.id;
      if (originTabId != null) {
        scanOriginTabId = originTabId;
        if (url) {
          await browser.scripting.executeScript({
            target: { tabId: originTabId },
            func: navigate,
            args: [url],
            world: 'MAIN',
          });
        }
        setTimeout(
          () => {
            browser.tabs
              .sendMessage(originTabId, { type: 'START_LIBRARY_SCAN' })
              .catch((e) => console.error('Failed to start library scan:', e));
          },
          url ? 2000 : 0,
        );
        return { success: true };
      }

      // Fallback: no sender tab (e.g. triggered from popup) — open a new tab
      scanOriginTabId = null;
      const tab = await browser.tabs.create({
        url: url ?? 'https://gemini.google.com/app',
        active: true,
      });
      const listener = (tabId: number, changeInfo: { status?: string }) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(listener);
          scanOriginTabId = tabId;
          setTimeout(() => {
            browser.tabs
              .sendMessage(tabId, { type: 'START_LIBRARY_SCAN' })
              .catch((e) => console.error('Failed to start library scan:', e));
          }, 2000);
        }
      };
      browser.tabs.onUpdated.addListener(listener);
      return { success: true };
    }
    case 'START_GEM_SCAN': {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        return { success: false, error: 'No active tab' };
      }
      try {
        const response = await browser.tabs.sendMessage(tabId, {
          type: 'START_GEM_SCAN',
        });
        return response ?? { success: true };
      } catch (e) {
        console.error('Failed to start gem scan:', e);
        return { success: false, error: (e as Error).message };
      }
    }
    case 'START_NOTEBOOK_SCAN': {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        return { success: false, error: 'No active tab' };
      }
      try {
        const response = await browser.tabs.sendMessage(tabId, {
          type: 'START_NOTEBOOK_SCAN',
        });
        return response ?? { success: true };
      } catch (e) {
        console.error('Failed to start notebook scan:', e);
        return { success: false, error: (e as Error).message };
      }
    }
    case 'SAVE_SCANNED_ITEMS': {
      const items = message.payload.items || [];
      const platform = message.platform || items[0]?.platform || 'aistudio';

      let newCount = 0;
      if (items.length > 0) {
        const allExisting = await conversationRepo.getAll(platform);
        const existingMap = new Map(allExisting.map((c) => [c.external_id, c]));
        newCount = items.filter((item) => !existingMap.has(item.external_id)).length;
        console.log(
          `[BS Scan] SAVE_SCANNED_ITEMS platform=${platform} scanned=${items.length} alreadyInDb=${
            items.length - newCount
          } new=${newCount}`,
        );

        const conversationsToSave = await Promise.all(
          items.map(async (item) => {
            const existing = existingMap.get(item.external_id);
            let targetFolderId: string | null;
            if (existing) {
              targetFolderId = existing.folder_id;
            } else {
              // For new items, check gem/notebook default folder, fallback to inbox
              targetFolderId = await resolveGemNotebookFolderId(
                platform,
                item.gem_id,
                item.notebook_id,
              );
            }
            return { ...item, folder_id: targetFolderId, platform };
          }),
        );

        if (conversationsToSave.length > 0) {
          await conversationRepo.bulkSave(conversationsToSave);
        }
      }

      // Notify only the tab that initiated the scan.
      // Other same-profile tabs will refresh on visibility change.
      const originTabId = scanOriginTabId;
      scanOriginTabId = null;
      if (originTabId != null) {
        browser.tabs.sendMessage(originTabId, {
          type: 'DATA_UPDATED',
          updateType: 'SCAN_COMPLETE',
          payload: { count: newCount },
        }).catch(() => {});
      }
      return { success: true, data: { count: newCount } };
    }
    default:
      return null;
  }
}
