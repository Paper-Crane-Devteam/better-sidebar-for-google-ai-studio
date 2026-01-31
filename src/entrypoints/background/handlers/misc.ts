import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';

export async function handleMisc(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  if (message.type !== 'OPEN_URL') return null;
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
