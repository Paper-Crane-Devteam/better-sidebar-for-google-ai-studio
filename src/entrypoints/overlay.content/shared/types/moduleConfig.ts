import type { ExplorerTypeFilter } from './filter';
export interface ModuleConfig {
  general: {
    menuActions?: {
      onViewHistory?: () => void;
      onSwitchToOriginalUI?: () => void;
      onImportAiStudioSystem?: () => void;
    };
  },
  explorer: {
    onNewChat: () => void;
    filterTypes?: ExplorerTypeFilter[];
    extraHeaderButtons?: React.ReactNode;
    visibleFilters?: ('search' | 'tags' | 'type' | 'favorites')[];
  };
  prompts: {
    // Placeholder for future prompts module customization
    enabled: boolean;
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
}