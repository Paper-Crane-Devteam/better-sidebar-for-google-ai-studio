import { messageRepo } from '@/shared/db/operations';
import type { ExtensionMessage, ExtensionResponse } from '@/shared/types/messages';
import type { MessageSender } from '../types';

export async function handleMessages(
  message: ExtensionMessage,
  _sender: MessageSender
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'SEARCH_MESSAGES': {
      try {
        const { query, options } = message.payload;
        const results = await messageRepo.search(query, options);
        return { success: true, data: results };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'GET_MESSAGES_BY_CONVERSATION_ID': {
      try {
        const { conversationId } = message.payload;
        const messages = await messageRepo.getByConversationId(conversationId);
        return { success: true, data: messages };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'DELETE_MESSAGES_BY_CONVERSATION_ID': {
      try {
        const { conversationId } = message.payload;
        await messageRepo.deleteByConversationId(conversationId);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'BULK_INSERT_MESSAGES': {
      try {
        const { conversationId, messages } = message.payload;
        await messageRepo.bulkInsert(conversationId, messages);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'REPLACE_MESSAGES': {
      try {
        const { conversationId, messages } = message.payload;
        await messageRepo.replace(conversationId, messages);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'GET_MESSAGE_SCROLL_INDEX': {
      try {
        const { messageId, conversationId } = message.payload;
        const index = await messageRepo.getScrollIndex(messageId, conversationId);
        return { success: true, data: index };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    case 'GET_ADJACENT_MESSAGE': {
      try {
        const { messageId, conversationId, currentRole } = message.payload;
        const adjacentMessage = await messageRepo.getAdjacentMessage(
          messageId,
          conversationId,
          currentRole
        );
        return { success: true, data: adjacentMessage };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    }
    default:
      return null;
  }
}
