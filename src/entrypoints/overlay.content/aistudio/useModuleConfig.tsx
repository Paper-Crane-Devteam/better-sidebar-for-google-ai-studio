import { navigate } from '@/shared/lib/navigation';
import type { ExplorerTypeFilter } from '../shared/types/filter';
import React from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { useAppStore } from '@/shared/lib/store';
import { ImportHistoryDialog } from './modules/search/components/ImportHistoryDialog';

export interface ModuleConfig {
  explorer: {
    onNewChat: () => void;
    filterTypes?: ExplorerTypeFilter[];
    extraHeaderButtons?: React.ReactNode;
    visibleFilters?: ('search' | 'tags' | 'type' | 'favorites')[];
    menuActions?: {
      onViewHistory?: () => void;
      onSwitchToOriginalUI?: () => void;
    };
  };
  prompts: {
    enabled: boolean;
  };
  search: {
    extraHeaderButtons?: React.ReactNode[];
    ImportComponent?: React.ComponentType<{isOpen: boolean; onClose: () => void}>;
  };
}

export const useModuleConfig = (): ModuleConfig => {
  const newChatBehavior = useSettingsStore((state) => state.newChatBehavior);
  const setOverlayOpen = useAppStore((state) => state.setOverlayOpen);

  return {
    explorer: {
      onNewChat: () => {
        const url = 'https://aistudio.google.com/prompts/new_chat';
        if (newChatBehavior === 'new-tab') {
          window.open(url, '_blank');
        } else {
          navigate(url);
        }
      },
      filterTypes: ['all', 'conversation', 'text-to-image'],
      visibleFilters: ['search', 'tags', 'type', 'favorites'],
      extraHeaderButtons: null,
      menuActions: {
        onViewHistory: () => {
          navigate('https://aistudio.google.com/library');
        },
        onSwitchToOriginalUI: () => {
          setOverlayOpen(false);
        },
      },
    },
    prompts: {
      enabled: true,
    },
    search: {
      ImportComponent: ImportHistoryDialog,
    },
  };
};
