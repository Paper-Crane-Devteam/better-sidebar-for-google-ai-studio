import { folderRepo } from '@/shared/db/operations';
import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';
import { triggerAutoSync } from './gdrive-sync';

export async function handleFolders(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  switch (message.type) {
    case 'GET_FOLDERS': {
      const folders = await folderRepo.getAll(message.platform);
      return { success: true, data: folders };
    }
    case 'CREATE_FOLDER': {
      await folderRepo.create({ ...message.payload, platform: message.platform });
      triggerAutoSync();
      return { success: true };
    }
    case 'UPDATE_FOLDER': {
      await folderRepo.update(message.payload.id, message.payload.updates);
      triggerAutoSync();
      return { success: true };
    }
    case 'DELETE_FOLDER': {
      await folderRepo.delete(message.payload.id);
      triggerAutoSync();
      return { success: true };
    }
    default:
      return null;
  }
}
