import React from 'react';
import { UIcon } from '@/shared/components/ui/icon';
import { useI18n } from '@/shared/hooks/useI18n';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { navigate } from '@/shared/lib/navigation';
import { SplitNewChatButton } from '@/shared/components/ui/split-new-chat-button';

export const NewChatButton = () => {
  const { t } = useI18n();
  const newChatBehavior = useSettingsStore((s) => s.newChatBehavior);

  const handleNewChat = () => {
    const url = 'https://aistudio.google.com/prompts/new_chat';
    if (newChatBehavior === 'new-tab') {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  };

  return (
    <div className="px-3 py-2">
      <SplitNewChatButton
        icon={<UIcon icon="tabler:message-plus" className="h-4 w-4" />}
        label={t('explorerHeader.newChat')}
        onClick={handleNewChat}
      />
    </div>
  );
};
