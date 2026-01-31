import { folderRepo, conversationRepo } from '@/shared/db/operations';
import { navigate } from '@/shared/lib/navigation';
import i18n from '@/locale/i18n';
import type { ExtensionMessage, ExtensionResponse } from '@/shared/types/messages';
import type { MessageSender } from '../types';
import { notifyDataUpdated } from '../notify';

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
      const url = 'https://aistudio.google.com/library';
      const [existingTab] = await browser.tabs.query({
        url: 'https://aistudio.google.com/*',
        currentWindow: true,
      });

      if (existingTab?.id) {
        await browser.tabs.update(existingTab.id, { active: true });
        await browser.scripting.executeScript({
          target: { tabId: existingTab.id },
          func: navigate,
          args: [url],
          world: 'MAIN',
        });
        setTimeout(() => {
          browser.tabs
            .sendMessage(existingTab.id!, { type: 'START_LIBRARY_SCAN' })
            .catch((e) => console.error('Failed to start library scan:', e));
        }, 2000);
        return { success: true };
      }

      const tab = await browser.tabs.create({ url, active: true });
      const listener = (tabId: number, changeInfo: { status?: string }) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(listener);
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
    case 'SAVE_SCANNED_ITEMS': {
      const items = message.payload.items;
      if (!items?.length) return { success: true, data: { count: 0 } };

      const allExisting = await conversationRepo.getAll();
      const existingMap = new Map(allExisting.map((c) => [c.external_id, c]));

      const importedFolderName = i18n.t('explorer.imported');
      const folders = await folderRepo.getAll();
      let importedFolderId = folders.find(
        (f) => f.name === importedFolderName || f.name === 'Imported'
      )?.id;

      if (!importedFolderId) {
        importedFolderId = crypto.randomUUID();
        await folderRepo.create({ id: importedFolderId, name: importedFolderName });
      }

      const conversationsToSave = items.map((item) => {
        const existing = existingMap.get(item.external_id);
        const targetFolderId = existing?.folder_id ?? importedFolderId;
        return { ...item, folder_id: targetFolderId };
      });

      if (conversationsToSave.length > 0) {
        await conversationRepo.bulkSave(conversationsToSave);
      }

      await notifyDataUpdated('SCAN_COMPLETE', { count: items.length });
      return { success: true, data: { count: items.length } };
    }
    default:
      return null;
  }
}
