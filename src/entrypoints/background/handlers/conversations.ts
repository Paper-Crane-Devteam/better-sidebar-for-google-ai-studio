import {
  folderRepo,
  conversationRepo,
  messageRepo,
} from '@/shared/db/operations';
import i18n from '@/locale/i18n';
import type { ExtensionMessage, ExtensionResponse } from '@/shared/types/messages';
import type { MessageSender } from '../types';
import { notifyDataUpdated } from '../notify';

export async function handleConversations(
  message: ExtensionMessage,
  _sender: MessageSender
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'GET_CONVERSATIONS': {
      const { folderId } = message.payload || {};
      const conversations =
        folderId === undefined
          ? await conversationRepo.getAll()
          : await conversationRepo.getByFolderId(folderId);
      return { success: true, data: conversations };
    }
    case 'SAVE_CONVERSATION': {
      const { messages, ...convoData } = message.payload;
      const platform = convoData.platform ?? 'aistudio';
      await conversationRepo.save({ ...convoData, platform });
      if (messages?.length) {
        await messageRepo.deleteByConversationId(convoData.id);
        await messageRepo.bulkInsert(convoData.id, messages);
      }
      return { success: true };
    }
    case 'DELETE_CONVERSATION': {
      await conversationRepo.delete(message.payload.id);
      await notifyDataUpdated();
      return { success: true };
    }
    case 'DELETE_ITEMS': {
      const { conversationIds, folderIds } = message.payload;
      if (conversationIds?.length) await conversationRepo.deleteMultiple(conversationIds);
      if (folderIds?.length) await folderRepo.deleteMultiple(folderIds);
      await notifyDataUpdated();
      return { success: true };
    }
    case 'UPDATE_CONVERSATION': {
      const { id, title, updated_at } = message.payload;
      const updates: { title?: string; updated_at: number } = {
        updated_at: updated_at ?? Math.floor(Date.now() / 1000),
      };
      if (title) updates.title = title;
      await conversationRepo.update(id, updates);
      await notifyDataUpdated();
      return { success: true };
    }
    case 'CREATE_CONVERSATION': {
      const {
        id,
        title,
        created_at,
        prompt_metadata,
        external_id,
        external_url: providedExternalUrl,
        folderId: providedFolderId,
        type,
        platform = 'aistudio',
      } = message.payload;
      let folderId = providedFolderId;
      if (!folderId) {
        const folders = await folderRepo.getAll();
        const importedName = i18n.t('explorer.imported');
        folderId = folders.find((f) => f.name === importedName || f.name === 'Imported')?.id;
        if (!folderId) {
          folderId = crypto.randomUUID();
          await folderRepo.create({ id: folderId, name: importedName });
        }
      }
      const external_url =
        providedExternalUrl ??
        (platform === 'gemini'
          ? `https://gemini.google.com/app/${id}`
          : `https://aistudio.google.com/prompts/${id}`);
      await conversationRepo.save({
        id,
        title,
        folder_id: folderId,
        external_id,
        external_url,
        updated_at: Math.floor(Date.now() / 1000),
        created_at,
        prompt_metadata: prompt_metadata ? JSON.stringify(prompt_metadata) : null,
        type: type || 'conversation',
        platform,
      });
      await notifyDataUpdated();
      return { success: true };
    }
    case 'MOVE_CONVERSATION': {
      await conversationRepo.move(message.payload.id, message.payload.folderId);
      return { success: true };
    }
    case 'MOVE_CONVERSATIONS': {
      await conversationRepo.moveMultiple(message.payload.ids, message.payload.folderId);
      return { success: true };
    }
    default:
      return null;
  }
}
