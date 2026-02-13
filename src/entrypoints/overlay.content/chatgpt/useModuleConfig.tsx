import { navigate } from '@/shared/lib/navigation';
import type { ExplorerTypeFilter } from '../shared/types/filter';
import React from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { useAppStore } from '@/shared/lib/store';
import { useI18n } from '@/shared/hooks/useI18n';
import type { ModuleConfig } from '../shared/types/moduleConfig';
import { handleSearchNavigation } from '../shared/utils';

export const useModuleConfig = (): ModuleConfig => {
  const newChatBehavior = useSettingsStore((state) => state.newChatBehavior);
  const { setOverlayOpen } = useAppStore();
  const { t } = useI18n();

  return {
    general: {
      menuActions: {
        onViewHistory: () => {
          // TODO: Navigate to ChatGPT history page
        },
        onSwitchToOriginalUI: () => {
          setOverlayOpen(false);
        },
      },
    },
    explorer: {
      onNewChat: () => {
        // TODO: Implement new chat for ChatGPT
        const url = '/';
        if (newChatBehavior === 'new-tab') {
          window.open(url, '_blank');
        } else {
          navigate(url);
        }
      },
      filterTypes: ['all', 'conversation'],
      visibleFilters: ['search', 'tags', 'favorites'],
    },
    favorites: {},
    search: {
      onNavigate: handleSearchNavigation,
    },
    prompts: {
      enabled: true,
    },
  };
};
