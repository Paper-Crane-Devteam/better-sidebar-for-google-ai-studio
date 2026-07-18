import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';

export async function handleMisc(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  if (message.type === 'OPEN_URL') {
    const { url } = message.payload;
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await browser.tabs.update(tab.id, { url });
    } else {
      await browser.tabs.create({ url });
    }
    return { success: true };
  }

  if (message.type === 'OPEN_PERMISSION_PAGE') {
    const { origin } = message.payload;
    const permUrl = browser.runtime.getURL(
      `/permissions.html?origins=${encodeURIComponent(origin)}`,
    );
    // Open as a popup window to avoid popup blocker (content script can't use window.open)
    await browser.windows.create({
      url: permUrl,
      type: 'popup',
      width: 500,
      height: 600,
    });
    return { success: true };
  }

  return null;
}
