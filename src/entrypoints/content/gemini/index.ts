// Gemini specific content script initialization
// TODO: Implement Gemini content script logic

import { Platform } from '@/shared/types/platform';
import { ExtensionMessage } from '@/shared/types/messages';
import { scanLibrary } from './tasks/scan-library';
import { apiScanner } from './tasks/scan-api';
import { chatContentScanner } from './tasks/scan-chat-content';

import { syncConversations } from './tasks/sync-conversations';

/**
 * Initialize Gemini content script
 * This handles all Gemini specific logic
 */
export function initGemini() {
  console.log('Better Sidebar: Gemini Content Script Initialized');

  // Start API Scanner immediately to catch early requests
  apiScanner.start();
  chatContentScanner.start();

  // Inject Main World Script
  const script = document.createElement('script');
  script.src = browser.runtime.getURL('/main-world.js');
  script.type = 'module';
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).prepend(script);

  // Auto-start sync when page is fully loaded
  const startSync = () => {
    syncConversations().catch((err) => {
      console.error('Better Sidebar: Auto-sync failed', err);
    });
  };

  if (document.readyState === 'complete') {
    startSync();
  } else {
    window.addEventListener('load', startSync);
  }

  window.addEventListener('GEMINI_CHAT_DELETE', async (event: any) => {
    const { id } = event.detail;
    console.log(
      'Better Sidebar: Content Script received GEMINI_CHAT_DELETE',
      id
    );
    try {
      await browser.runtime.sendMessage({
        type: 'DELETE_CONVERSATION',
        payload: { id },
      });
    } catch (e) {
      console.error('Better Sidebar: Failed to handle GEMINI_CHAT_DELETE', e);
    }
  });

  // Message listener for library scan
  browser.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse) => {
      if (message.type === 'START_LIBRARY_SCAN') {
        scanLibrary()
          .then((count) => {
            sendResponse({ success: true, data: { count } });
          })
          .catch((err) => {
            sendResponse({ success: false, error: err.message });
          });
        return true;
      }
      if (message.type === 'START_SYNC_CONVERSATIONS') {
        syncConversations()
          .then((count) => {
            sendResponse({ success: true, data: { count } });
          })
          .catch((err) => {
            sendResponse({ success: false, error: err.message });
          });
        return true;
      }
    }
  );
}
