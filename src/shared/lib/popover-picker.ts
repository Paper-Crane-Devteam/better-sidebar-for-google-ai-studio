import { create } from 'zustand';
import React from 'react';

export interface PopoverPickerState {
  isOpen: boolean;
  /** The anchor element's bounding rect (used for positioning) */
  anchorRect: DOMRect | null;
  /** Content to render inside the popover */
  content: React.ReactNode;
  /** Optional width constraint */
  width?: number;
}

interface PopoverPickerStore extends PopoverPickerState {
  open: (options: {
    anchorRect: DOMRect;
    content: React.ReactNode;
    width?: number;
  }) => void;
  close: () => void;
}

export const usePopoverPickerStore = create<PopoverPickerStore>((set) => ({
  isOpen: false,
  anchorRect: null,
  content: null,
  width: undefined,
  open: ({ anchorRect, content, width }) =>
    set({ isOpen: true, anchorRect, content, width }),
  close: () =>
    set({ isOpen: false, anchorRect: null, content: null, width: undefined }),
}));
