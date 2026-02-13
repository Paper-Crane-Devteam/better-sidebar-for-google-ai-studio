import React from 'react';
import { useAppStore } from '@/shared/lib/store';
import { useI18n } from '@/shared/hooks/useI18n';
import { modal } from '@/shared/lib/modal';

export const useDeleteHandler = () => {
  const { t } = useI18n();
  const { promptFolders, deletePromptItem, prompts } = useAppStore();

  const handleDelete = async (ids: string[]) => {
    if (!ids.length) return;

    // Simplify: Assume single item or treat as single for message
    const id = ids[0];
    const isFolder = promptFolders.some((f) => f.id === id);

    const name = isFolder
      ? promptFolders.find((f) => f.id === id)?.name
      : prompts.find((c) => c.id === id)?.title || t('common.untitled');

    const confirmMessage = isFolder
      ? t('node.deleteFolderConfirm', { name })
      : t('node.deleteConfirm', { name });

    const confirmed = await modal.confirm({
      title: t('node.deleteItem'),
      content: (
        <div className="space-y-2">
          <p>{confirmMessage}</p>
        </div>
      ),
      confirmText: t('node.delete'),
      cancelText: t('common.cancel'),
    });

    if (confirmed) {
      // Loop just in case multiple IDs were somehow passed, but logic is simplified
      for (const itemId of ids) {
        const type = promptFolders.some((f) => f.id === itemId) ? 'folder' : 'file';
        await deletePromptItem(itemId, type);
      }
    }
  };

  return { handleDelete };
};
