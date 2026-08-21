import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

/**
 * Rating prompt round. Increase by 1 whenever you want to ask existing users
 * for a review again (e.g. after a big release).
 */
export const RATING_PROMPT_ROUND = 2;

interface RatingState {
  hasPrompted: boolean;
  installedAt: number | null;
  openCount: number;
  setHasPrompted: (prompted: boolean) => void;
  incrementOpenCount: () => void;
  setInstalledAt: (time: number) => void;
}

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const result = await browser?.storage?.local?.get(name);
      return (result?.[name] as string) || null;
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await browser.storage.local.set({ [name]: value });
    } catch (e) {
      console.error('Error writing to storage:', e);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await browser.storage.local.remove(name);
    } catch (e) {
      console.error('Error removing from storage:', e);
    }
  },
};

export const useRatingStore = create<RatingState>()(
  persist(
    (set) => ({
      hasPrompted: false,
      installedAt: null,
      openCount: 0,
      setHasPrompted: (prompted) => set({ hasPrompted: prompted }),
      incrementOpenCount: () => set((state) => ({ openCount: state.openCount + 1 })),
      setInstalledAt: (time) => set({ installedAt: time }),
    }),
    {
      name: 'better-sidebar-rating-settings',
      storage: createJSONStorage(() => storage),
      // Bump this version to re-run the rating prompt for existing users.
      // Each bump clears `hasPrompted` while keeping installedAt/openCount,
      // so users who already meet the usage thresholds get asked again.
      version: RATING_PROMPT_ROUND,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<RatingState>;
        return {
          ...state,
          hasPrompted: false,
        } as RatingState;
      },
    }
  )
);
