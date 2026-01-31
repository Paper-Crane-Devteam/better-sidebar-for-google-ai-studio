import type { UIState } from './types';

export const initialUIState: UIState = {
  overlay: {
    isOpen: true,
    activeTab: 'files',
    isScanning: false,
    isSettingsOpen: false,
    showSqlInterface: false,
    tempHiddenToken: null,
  },
  explorer: {
    search: { isOpen: false, query: '' },
    tags: { isOpen: false, selected: [] },
    typeFilter: 'all',
    onlyFavorites: false,
    sortOrder: 'alpha',
    viewMode: 'tree',
    batch: { isBatchMode: false, selectedIds: [] },
  },
  favorites: {
    search: { isOpen: false, query: '' },
    tags: { isOpen: false, selected: [] },
    typeFilter: 'all',
  },
  prompts: {
    search: { isOpen: false, query: '' },
    typeFilter: 'all',
    onlyFavorites: false,
    sortOrder: 'alpha',
    batch: { isBatchMode: false, selectedIds: [] },
  },
  search: {
    query: '',
    activeQuery: '',
    results: [],
    isSearching: false,
    options: {
      caseSensitive: false,
      wholeWord: false,
      include: '',
      exclude: '',
      roleFilter: 'all',
      showOptions: false,
    },
    activeOptions: {
      caseSensitive: false,
      wholeWord: false,
      include: '',
      exclude: '',
      roleFilter: 'all',
    },
  },
};
