import { useAppStore } from '@/shared/lib/store';
import { modal } from '@/shared/lib/modal';
import { useI18n } from '@/shared/hooks/useI18n';

export function useDeleteHandler() {
  const { t } = useI18n();

  const handleDelete = async (ids: string[]) => {
    const confirmed = await modal.confirmDelete({
      title: t('common.delete'),
      content: t('common.delete') + '?',
    });

    if (confirmed) {
      await useAppStore.getState().deleteSnippetItems(ids);
    }
  };

  return { handleDelete };
}
