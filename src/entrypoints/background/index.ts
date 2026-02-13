import type { ExtensionMessage } from '@/shared/types/messages';
import { handleMessage } from './message-handler';

console.log(
  'Better Sidebar for Gemini & AI Studio: Background Service Worker Starting...',
);

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: ExtensionMessage, sender, sendResponse) => {
      console.log(
        '[Background] Received message:',
        message.type,
        sender.tab ? `from tab ${sender.tab.id}` : 'from extension',
      );
      handleMessage(message, sender).then(sendResponse);
      return true;
    },
  );
});
