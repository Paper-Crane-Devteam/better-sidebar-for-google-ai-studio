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
  open: <T = unknown>(options: {
    anchorRect: DOMRect;
    content: React.ReactNode;
    width?: number;
  }) => Promise<T | null>;
  close: () => void;
  /** Resolve the current open() promise with a value and close the popover */
  resolve: <T = unknown>(value: T) => void;
}

let _resolve: ((value: any) => void) | null = null;

export const usePopoverPickerStore = create<PopoverPickerStore>((set) => ({
  isOpen: false,
  anchorRect: null,
  content: null,
  width: undefined,
  open: ({ anchorRect, content, width }) => {
    // If a previous promise is pending, resolve it with null (dismissed)
    if (_resolve) {
      _resolve(null);
      _resolve = null;
    }
    return new Promise((resolve) => {
      _resolve = resolve;
      set({ isOpen: true, anchorRect, content, width });
    });
  },
  close: () => {
    // Resolve pending promise with null (user dismissed without selection)
    if (_resolve) {
      _resolve(null);
      _resolve = null;
    }
    set({ isOpen: false, anchorRect: null, content: null, width: undefined });
  },
  resolve: (value) => {
    if (_resolve) {
      _resolve(value);
      _resolve = null;
    }
    set({ isOpen: false, anchorRect: null, content: null, width: undefined });
  },
}));
