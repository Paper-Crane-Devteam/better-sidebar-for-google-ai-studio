/**
 * One-off hints for things the UI cannot show by itself (persisted).
 *
 * The kind of hint this is for: a capability the user could never guess from what is
 * on screen. "The task ended, but you can just keep talking" is the first one — the
 * conversation ends with a divider and nothing about it suggests a follow-up will be
 * picked up, so the mechanism was invisible until someone tried it by accident.
 *
 * ## Why retire-on-learned rather than a plain "show it N times"
 *
 * A counter alone gets both ends wrong: it keeps nagging someone who understood on
 * the first read, and it gives up on someone who has not looked at that corner of
 * the UI yet. So there are two exits and the counter is only the backstop:
 *
 * - `retire(id)` — the user closed it, *or* they did the thing it was teaching.
 *   Callers are expected to report the second case; it is the honest signal, and it
 *   is usually one line at the site that already knows (see `AgentLoopFeature`'s
 *   auto-pickup, which retires the follow-up hint the moment a follow-up is picked up).
 * - `maxShows`   — a ceiling, so a hint whose "learned" signal never fires cannot
 *   nag forever.
 *
 * ## Counting
 *
 * `noteShown` is called once per mount of the hint. That is a rough count of
 * "times seen" rather than an exact one — remounting the same divider by switching
 * conversations and back counts twice. Deliberately not made exact: the primary exit
 * is dismiss-or-learned, so the ceiling only has to be the right order of magnitude,
 * and tracking occasions precisely would mean persisting a key per occasion forever.
 */

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

/**
 * Every hint in the product, named in one place.
 *
 * A union rather than free-form strings so a typo can't silently create a second,
 * permanently-unseen hint, and so removing a hint surfaces its leftover callers.
 */
export type OnboardingHintId =
  /** Shown under the session-end divider: a follow-up keeps the agent going */
  | 'agentContinueAfterEnd';

/** How many times a hint may be shown before it gives up on its own */
const DEFAULT_MAX_SHOWS = 5;

export interface OnboardingState {
  /** hint id → times it has been put on screen */
  shown: Partial<Record<OnboardingHintId, number>>;
  /** Hints the user closed by hand, or proved they already understand */
  retired: OnboardingHintId[];
  /**
   * Whether the persisted state has arrived yet.
   *
   * Lives in the store rather than being read from `persist.hasHydrated()` at render
   * time because that function is not reactive — nothing re-renders when hydration
   * finishes, so a hint would stay hidden until something else happened to update the
   * component. Kept out of what gets written back (see `partialize`).
   */
  hydrated: boolean;

  noteShown: (id: OnboardingHintId) => void;
  retire: (id: OnboardingHintId) => void;
  /** Forget everything, so hints come back. For the settings page and for testing. */
  resetHints: () => void;
}

const storage: StateStorage = {
  getItem: async (name) => {
    try {
      const result = await browser?.storage?.local?.get(name);
      return (result?.[name] as string) ?? null;
    } catch (e) {
      console.error('[Onboarding] read failed:', e);
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await browser.storage.local.set({ [name]: value });
    } catch (e) {
      console.error('[Onboarding] write failed:', e);
    }
  },
  removeItem: async (name) => {
    try {
      await browser.storage.local.remove(name);
    } catch (e) {
      console.error('[Onboarding] remove failed:', e);
    }
  },
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      shown: {},
      retired: [],
      hydrated: false,

      noteShown: (id) =>
        set((state) => ({ shown: { ...state.shown, [id]: (state.shown[id] ?? 0) + 1 } })),

      retire: (id) => {
        if (get().retired.includes(id)) return;
        set((state) => ({ retired: [...state.retired, id] }));
      },

      resetHints: () => set({ shown: {}, retired: [] }),
    }),
    {
      name: 'better-sidebar-onboarding',
      storage: createJSONStorage(() => storage),
      version: 1,
      partialize: ({ shown, retired }) => ({ shown, retired }),
      // Fires whether or not anything was stored, so a fresh profile also gets here.
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hydrated: true });
      },
    },
  ),
);

/**
 * Retire a hint from outside React — for the code that witnesses the user doing the
 * thing the hint was teaching.
 */
export function retireOnboardingHint(id: OnboardingHintId): void {
  useOnboardingStore.getState().retire(id);
}

/**
 * Whether to show `id` right now, plus the way to put it away.
 *
 * Counts the showing on mount, once. Returns `visible: false` while the persisted
 * state is still loading, so a hint can't flash on screen and then vanish on a
 * profile that retired it long ago.
 */
export function useOnboardingHint(
  id: OnboardingHintId,
  maxShows: number = DEFAULT_MAX_SHOWS,
): { visible: boolean; dismiss: () => void } {
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const retired = useOnboardingStore((s) => s.retired.includes(id));
  const shownCount = useOnboardingStore((s) => s.shown[id] ?? 0);

  const visible = hydrated && !retired && shownCount < maxShows;

  // Guarded by a ref, not by `visible`: without it the count keeps climbing on every
  // re-render of the host component, and the hint burns its budget in one sitting.
  const counted = useRef(false);
  useEffect(() => {
    if (!visible || counted.current) return;
    counted.current = true;
    useOnboardingStore.getState().noteShown(id);
  }, [visible, id]);

  return {
    visible,
    dismiss: () => useOnboardingStore.getState().retire(id),
  };
}
