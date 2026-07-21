import { create } from 'zustand';

interface WhatsNewStore {
  isOpen: boolean;
  showAll: boolean;
  isToastOpen: boolean;
  open: (options?: { showAll?: boolean }) => void;
  close: () => void;
  openToast: () => void;
  closeToast: () => void;
  setShowAll: (showAll: boolean) => void;
}

export const useWhatsNewStore = create<WhatsNewStore>((set) => ({
  isOpen: false,
  showAll: false,
  isToastOpen: false,
  open: (options) =>
    set({
      isOpen: true,
      showAll: options?.showAll ?? false,
      isToastOpen: false,
    }),
  close: () => set({ isOpen: false }),
  openToast: () => set({ isToastOpen: true }),
  closeToast: () => set({ isToastOpen: false }),
  setShowAll: (showAll: boolean) => set({ showAll }),
}));

