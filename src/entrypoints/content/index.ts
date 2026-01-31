import { ExtensionMessage } from '@/shared/types/messages';
// import { initSingleChatScanner } from './tasks/scan-single-chat';
import { scanLibrary } from './tasks/scan-library';
import { apiScanner } from './tasks/scan-library/scan-api';

export default defineContentScript({
  matches: ["https://aistudio.google.com/*"],
  main() {
    console.log(
      'Better Sidebar for Google AI Studio: Content Script Initialized'
    );

    // Start API Scanner immediately to catch early requests
    apiScanner.start();

    // Theme synchronization
    const syncTheme = () => {
      const isDark = document.body.classList.contains('dark-theme');
      const theme = isDark ? 'dark' : 'light';
      browser.storage.local.set({ theme });
    };

    // Initial sync
    if (document.body) {
      syncTheme();
      // Observe body class changes
      const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            syncTheme();
          }
        });
      });
      themeObserver.observe(document.body, { attributes: true });
    } else {
      // Fallback if body is not yet ready (though at document_end it should be)
      document.addEventListener('DOMContentLoaded', () => {
        syncTheme();
        const themeObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
              syncTheme();
            }
          });
        });
        themeObserver.observe(document.body, { attributes: true });
      });
    }

    // Inject Main World Script
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('/main-world.js');
    script.type = 'module';
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).prepend(script);

    // New Event Listener for parsed chat data
    window.addEventListener('AI_STUDIO_RESPONSE', async (event: any) => {
        const data = event.detail;
        console.log(
            'Better Sidebar for Google AI Studio: Content Script received AI_STUDIO_RESPONSE',
            data
        );

        try {
            await browser.runtime.sendMessage({
                type: 'SAVE_CONVERSATION',
                payload: {
                    id: data.id,
                    title: data.title,
                    external_id: data.id,
                    external_url: `https://aistudio.google.com/prompts/${data.id}`,
                    model_name: data.model_name,
                    updated_at: data.updated_at,
                    messages: data.messages,
                    // Pass created_at/prompt_metadata if supported by SAVE_CONVERSATION or needed
                }
            });
        } catch (e) {
            console.error(
                'Better Sidebar for Google AI Studio: Failed to handle AI_STUDIO_RESPONSE',
                e
            );
        }
    });

    window.addEventListener('AI_STUDIO_PROMPT_UPDATE', async (event: any) => {
      const { id, title, updated_at } = event.detail;
      console.log(
        'Better Sidebar for Google AI Studio: Content Script received AI_STUDIO_PROMPT_UPDATE',
        id,
        title,
        updated_at
      );
      try {
        await browser.runtime.sendMessage({
          type: 'UPDATE_CONVERSATION',
          payload: { id, title, updated_at },
        });
      } catch (e) {
        console.error(
          'Better Sidebar for Google AI Studio: Failed to handle AI_STUDIO_PROMPT_UPDATE',
          e
        );
      }
    });

    window.addEventListener('AI_STUDIO_PROMPT_DELETE', async (event: any) => {
      const { id } = event.detail;
      console.log(
        'Better Sidebar for Google AI Studio: Content Script received AI_STUDIO_PROMPT_DELETE',
        id
      );
      try {
        await browser.runtime.sendMessage({
          type: 'DELETE_CONVERSATION',
          payload: { id },
        });
      } catch (e) {
        console.error(
          'Better Sidebar for Google AI Studio: Failed to handle AI_STUDIO_PROMPT_DELETE',
          e
        );
      }
    });

    // if (document.readyState === 'loading') {
    //   document.addEventListener('DOMContentLoaded', () => {
    //     initSingleChatScanner();
    //   });
    // } else {
    //   initSingleChatScanner();
    // }

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
      }
    );
  }
});
