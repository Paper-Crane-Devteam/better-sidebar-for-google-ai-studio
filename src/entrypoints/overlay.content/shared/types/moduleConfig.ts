import type { ExplorerTypeFilter } from './filter';
export interface ModuleConfig {
  general: {
    menuActions?: {
      onViewHistory?: () => void;
      onSwitchToOriginalUI?: () => void;
    };
  },
  explorer: {
    onNewChat: () => void;
    filterTypes?: ExplorerTypeFilter[];
    extraHeaderButtons?: React.ReactNode;
    visibleFilters?: ('search' | 'tags' | 'type' | 'favorites')[];
  };
  prompts: {
    enabled: boolean;
    menuActions?: {
      onImportAiStudioSystem?: () => void;
    };
  };
  search: {
    extraHeaderButtons?: React.ReactNode[];
    onNavigate?: (match: {
      id: string;
      conversation_id: string;
      external_url?: string;
      scroll_index?: number;
    }) => void;
  };
  favorites: {
    visibleFilters?: ('search' | 'tags' | 'type' | 'favorites')[];
  };
}