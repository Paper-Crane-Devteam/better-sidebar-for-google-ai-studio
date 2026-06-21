import { useAppStore } from '@/shared/lib/store';
import { useModalStore } from '@/shared/lib/modal';
import { useI18n } from '@/shared/hooks/useI18n';

export function useDeleteHandler() {
  const { t } = useI18n();

  const handleDelete = async (ids: string[]) => {
    return new Promise<void>((resolve) => {
      useModalStore.getState().open({
        type: 'confirm',
        title: t('common.confirm'),
        content: t('common.delete') + '?',
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        onConfirm: async () => {
          useModalStore.getState().close();
          await useAppStore.getState().deleteSnippetItems(ids);
          resolve();
        },
        onCancel: () => {
          useModalStore.getState().close();
          resolve();
        },
      });
    });
  };

  return { handleDelete };
}
