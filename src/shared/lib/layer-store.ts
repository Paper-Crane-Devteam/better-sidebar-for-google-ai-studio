import { create } from 'zustand';

/**
 * Controls the z-index of the enhanced-features wrapper.
 *
 * When any overlay (SnippetReaderDrawer, GlobalModal, etc.) needs to render
 * above the enhanced features layer, it calls `suppress()`.
 * When it closes, it calls `restore()`.
 *
 * Uses reference counting so multiple overlays can suppress simultaneously
 * without conflicting.
 */
interface LayerStore {
  /** Number of active suppressors. When > 0, enhanced features z-index is lowered. */
  suppressCount: number;
  /** Whether the enhanced features layer should be suppressed (z-index lowered) */
  isSuppressed: boolean;
  /** Call when an overlay opens that needs to be above enhanced features */
  suppress: () => void;
  /** Call when the overlay closes */
  restore: () => void;
}

export const useLayerStore = create<LayerStore>((set) => ({
  suppressCount: 0,
  isSuppressed: false,
  suppress: () =>
    set((state) => {
      const next = state.suppressCount + 1;
      return { suppressCount: next, isSuppressed: next > 0 };
    }),
  restore: () =>
    set((state) => {
      const next = Math.max(0, state.suppressCount - 1);
      return { suppressCount: next, isSuppressed: next > 0 };
    }),
}));
