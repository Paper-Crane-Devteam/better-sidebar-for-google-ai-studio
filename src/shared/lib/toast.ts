import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number, action?: ToastAction) => string;
  updateToast: (id: string, updates: Partial<Pick<Toast, 'message' | 'type' | 'action' | 'duration'>>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 3000, action) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, type, duration, action }] }));
    
    if (duration !== Infinity && duration > 0) {
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, duration);
    }
    return id;
  },
  updateToast: (id, updates) => set((state) => ({
    toasts: state.toasts.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'error', duration),
  info: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'info', duration),
  warning: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'warning', duration),
  /** Show a persistent toast with an action button. Returns the toast ID for later update/dismiss. */
  withAction: (msg: string, type: ToastType, action: ToastAction) =>
    useToastStore.getState().addToast(msg, type, Infinity, action),
  /** Update an existing toast's message/type/action. */
  update: (id: string, updates: Partial<Pick<Toast, 'message' | 'type' | 'action' | 'duration'>>) =>
    useToastStore.getState().updateToast(id, updates),
  /** Dismiss a specific toast. */
  dismiss: (id: string) => useToastStore.getState().removeToast(id),
  /** Dismiss all current toasts */
  dismissAll: () => useToastStore.setState({ toasts: [] }),
};
