import type { AppState, SetState } from '../types';

export function createFavoritesActions(set: SetState): Pick<
  AppState,
  'setFavoritesSearch' | 'setFavoritesTags' | 'setFavoritesTypeFilter'
> {
  return {
    setFavoritesSearch: (isOpen, query) =>
      set((state) => ({
        ui: {
          ...state.ui,
          favorites: {
            ...state.ui.favorites,
            search: {
              isOpen,
              query: query ?? state.ui.favorites.search.query,
            },
            tags: isOpen ? { ...state.ui.favorites.tags, isOpen: false } : state.ui.favorites.tags,
          },
        },
      })),
    setFavoritesTags: (isOpen, selected) =>
      set((state) => ({
        ui: {
          ...state.ui,
          favorites: {
            ...state.ui.favorites,
            tags: {
              isOpen,
              selected: selected ?? state.ui.favorites.tags.selected,
            },
            search: isOpen ? { ...state.ui.favorites.search, isOpen: false } : state.ui.favorites.search,
          },
        },
      })),
    setFavoritesTypeFilter: (typeFilter) =>
      set((state) => ({
        ui: { ...state.ui, favorites: { ...state.ui.favorites, typeFilter } },
      })),
  };
}
