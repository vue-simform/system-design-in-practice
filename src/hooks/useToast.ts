/**
 * useToast Hook
 * 
 * Global toast notification management hook.
 * Provides methods to add and remove toast notifications.
 * 
 * System Design Concepts:
 * - Centralized State: Single source of truth for all toasts
 * - Queue Management: Handle multiple toasts efficiently
 * - Auto-cleanup: Remove toasts after display
 * - Type Safety: TypeScript for error prevention
 * 
 * Features:
 * - Add toast with type and message
 * - Auto-generate unique IDs
 * - Remove toast by ID
 * - Type-safe toast types
 * 
 * Usage:
 * ```tsx
 * const { addToast } = useToast();
 * 
 * // Success toast
 * addToast({ type: 'success', message: 'Post liked!' });
 * 
 * // Error toast
 * addToast({ type: 'error', message: 'Already liked' });
 * 
 * // Custom duration
 * addToast({ 
 *   type: 'warning', 
 *   message: 'Connection slow', 
 *   duration: 5000 
 * });
 * ```
 */

import { create } from 'zustand';
import type { Toast } from '../components/common/Toast';

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));

// Convenience hook for easier usage
export function useToast() {
  const { addToast, removeToast } = useToastStore();

  const toast = {
    success: (message: string, duration?: number) => {
      addToast({ type: 'success', message, duration });
    },
    error: (message: string, duration?: number) => {
      addToast({ type: 'error', message, duration });
    },
    warning: (message: string, duration?: number) => {
      addToast({ type: 'warning', message, duration });
    },
    info: (message: string, duration?: number) => {
      addToast({ type: 'info', message, duration });
    },
  };

  return {
    toast,
    addToast,
    removeToast,
  };
}
