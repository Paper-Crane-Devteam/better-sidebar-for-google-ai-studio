import React, { useMemo } from 'react';
import { UIcon } from '@/shared/components/ui/icon';
import { useI18n } from '@/shared/hooks/useI18n';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { useAppStore } from '@/shared/lib/store';
import { usePopoverPickerStore } from '@/shared/lib/popover-picker';
import { navigateToGem, navigateToNotebook, navigateToNewChat } from '@/shared/lib/navigation';
import { GemPickerContent } from '../../shared/modules/gems/components/GemPickerContent';
import { NotebookPickerContent } from '../../shared/modules/notebooks/components/NotebookPickerContent';
import { SplitNewChatButton } from '@/shared/components/ui/split-new-chat-button';

interface NewChatButtonProps {
  onPrivateChat?: () => void;
}

export const NewChatButton = ({ onPrivateChat }: NewChatButtonProps) => {
  const { t } = useI18n();

  const lastSelectedGemId = useSettingsStore((s) => s.lastSelectedGemId);
  const lastSelectedNotebookId = useSettingsStore((s) => s.lastSelectedNotebookId);
  const newChatBehavior = useSettingsStore((s) => s.newChatBehavior);
  const { gems, notebooks } = useAppStore();

  const lastGem = useMemo(
    () => (lastSelectedGemId ? gems.find((g) => g.id === lastSelectedGemId) : null),
    [gems, lastSelectedGemId],
  );
  const lastNotebook = useMemo(
    () => (lastSelectedNotebookId ? notebooks.find((n) => n.id === lastSelectedNotebookId) : null),
    [notebooks, lastSelectedNotebookId],
  );

  const handleNewChat = () => {
    if (newChatBehavior === 'new-tab') {
      window.open('https://gemini.google.com/app', '_blank');
    } else {
      navigateToNewChat();
    }
  };

  const handleNewGemChat = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    usePopoverPickerStore.getState().open({
      anchorRect: rect,
      content: <GemPickerContent lastSelectedGemId={lastSelectedGemId} />,
      width: 280,
    });
  };

  const handleNewNotebookChat = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    usePopoverPickerStore.getState().open({
      anchorRect: rect,
      content: <NotebookPickerContent lastSelectedNotebookId={lastSelectedNotebookId} />,
      width: 280,
    });
  };

  // Gem tooltip: explains left/right click behavior
  const gemTooltip = lastGem
    ? t('newChatButton.gemItemTooltipWithLast', { name: lastGem.name })
    : t('newChatButton.gemItemTooltip');

  // Notebook tooltip: explains left/right click behavior
  const notebookTooltip = lastNotebook
    ? t('newChatButton.notebookItemTooltipWithLast', { name: lastNotebook.name })
    : t('newChatButton.notebookItemTooltip');

  return (
    <div className="px-3 py-2">
      <SplitNewChatButton
        icon={<UIcon icon="tabler:message-plus" className="h-4 w-4" />}
        label={t('explorerHeader.newChat')}
        tooltip={onPrivateChat ? t('tooltip.newChatCta') : t('tooltip.newChat')}
        onClick={handleNewChat}
        onContextMenu={onPrivateChat ? () => onPrivateChat() : undefined}
        dropdownTooltip={t('newChatButton.dropdownTooltip')}
        dropdownItems={[
          {
            label: t('newChatButton.newGemChat'),
            icon: <UIcon icon="tabler:diamond" className="h-4 w-4" />,
            tooltip: gemTooltip,
            // Left click: navigate to last gem, or open picker if no last gem
            onClick: (e) => {
              e.preventDefault();
              if (lastGem) {
                navigateToGem(lastGem.id);
              } else {
                handleNewGemChat(e);
              }
            },
            // Right click: always open popover picker
            onContextMenu: (e) => {
              e.preventDefault();
              handleNewGemChat(e);
            },
          },
          {
            label: t('newChatButton.newNotebookChat'),
            icon: <UIcon icon="tabler:notebook" className="h-4 w-4" />,
            tooltip: notebookTooltip,
            // Left click: navigate to last notebook, or open picker if none
            onClick: (e) => {
              e.preventDefault();
              if (lastNotebook) {
                navigateToNotebook(lastNotebook.id);
              } else {
                handleNewNotebookChat(e);
              }
            },
            // Right click: always open popover picker
            onContextMenu: (e) => {
              e.preventDefault();
              handleNewNotebookChat(e);
            },
          },
        ]}
      />
    </div>
  );
};
