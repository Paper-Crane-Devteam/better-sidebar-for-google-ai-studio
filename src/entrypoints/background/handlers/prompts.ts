import { promptRepo, promptFolderRepo } from '@/shared/db/operations';
import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';
import { notifyDataUpdated } from '../notify';

export async function handlePrompts(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'GET_PROMPT_FOLDERS': {
      const folders = await promptFolderRepo.getAll();
      return { success: true, data: folders };
    }
    case 'CREATE_PROMPT_FOLDER': {
      await promptFolderRepo.create(message.payload);
      return { success: true };
    }
    case 'UPDATE_PROMPT_FOLDER': {
      await promptFolderRepo.update(
        message.payload.id,
        message.payload.updates,
      );
      return { success: true };
    }
    case 'DELETE_PROMPT_FOLDER': {
      await promptFolderRepo.delete(message.payload.id);
      return { success: true };
    }
    case 'GET_PROMPTS': {
      const { folderId } = message.payload || {};
      const prompts =
        folderId === undefined
          ? await promptRepo.getAll()
          : await promptRepo.getByFolderId(folderId);
      return { success: true, data: prompts };
    }
    case 'CREATE_PROMPT': {
      const { id, title, content, type, icon, folderId, orderIndex } =
        message.payload;
      await promptRepo.create({
        id,
        title,
        content,
        type,
        icon,
        folder_id: folderId,
        order_index: orderIndex,
      });
      await notifyDataUpdated();
      return { success: true };
    }
    case 'UPDATE_PROMPT': {
      await promptRepo.update(message.payload.id, message.payload.updates);
      await notifyDataUpdated();
      return { success: true };
    }
    case 'DELETE_PROMPT': {
      await promptRepo.delete(message.payload.id);
      await notifyDataUpdated();
      return { success: true };
    }
    case 'DELETE_PROMPT_ITEMS': {
      const { promptIds, folderIds } = message.payload;
      if (promptIds?.length) await promptRepo.deleteMultiple(promptIds);
      if (folderIds?.length) await promptFolderRepo.deleteMultiple(folderIds);
      await notifyDataUpdated();
      return { success: true };
    }
    case 'MOVE_PROMPT': {
      await promptRepo.move(message.payload.id, message.payload.folderId);
      return { success: true };
    }
    case 'MOVE_PROMPTS': {
      await promptRepo.moveMultiple(
        message.payload.ids,
        message.payload.folderId,
      );
      return { success: true };
    }
    default:
      return null;
  }
}
