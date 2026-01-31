import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from './types';
import { dbReady } from './db';
import {
  handleFolders,
  handleConversations,
  handleScan,
  handleDbAdmin,
  handleFavorites,
  handleTags,
  handleMessages,
  handlePrompts,
  handleMisc,
} from './handlers';

const handlers = [
  handleFolders,
  handleConversations,
  handleScan,
  handleDbAdmin,
  handleFavorites,
  handleTags,
  handleMessages,
  handlePrompts,
  handleMisc,
];

export async function handleMessage(
  message: ExtensionMessage,
  sender: MessageSender,
): Promise<ExtensionResponse> {
  try {
    await dbReady;

    for (const handler of handlers) {
      const result = await handler(message, sender);
      if (result !== null) return result;
    }

    return { success: false, error: 'Unknown message type' };
  } catch (err: unknown) {
    console.error('Error handling message:', message, err);
    return { success: false, error: (err as Error).message };
  }
}
