/**
 * Toast Notification Store
 * Zustand store for managing toast notifications
 */

import { create } from 'zustand';

// ============================================================================
// Toast Types
// ============================================================================

export const ToastType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type ToastType = typeof ToastType[keyof typeof ToastType];

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// Toast Store
// ============================================================================

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
  
  // Convenience methods
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      ...toast,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, newToast.duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),

  // Convenience methods
  success: (title, message) =>
    set((state) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        type: ToastType.SUCCESS,
        title,
        message,
        duration: 5000,
        dismissible: true,
      };
      return { toasts: [...state.toasts, newToast] };
    }),

  error: (title, message) =>
    set((state) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        type: ToastType.ERROR,
        title,
        message,
        duration: 7000,
        dismissible: true,
      };
      return { toasts: [...state.toasts, newToast] };
    }),

  warning: (title, message) =>
    set((state) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        type: ToastType.WARNING,
        title,
        message,
        duration: 6000,
        dismissible: true,
      };
      return { toasts: [...state.toasts, newToast] };
    }),

  info: (title, message) =>
    set((state) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        type: ToastType.INFO,
        title,
        message,
        duration: 5000,
        dismissible: true,
      };
      return { toasts: [...state.toasts, newToast] };
    }),
}));
