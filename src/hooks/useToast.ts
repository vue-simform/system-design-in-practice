/**
 * useToast Hook
 * 
 * Re-exports toast store and provides convenience methods.
 * The actual store implementation is in src/store/toastStore.ts
 * 
 * This consolidates the two previous toast implementations into one.
 * 
 * Usage:
 * ```tsx
 * const { toast } = useToast();
 * 
 * // Success toast
 * toast.success('Post created!', 2000);
 * 
 * // Error toast
 * toast.error('Failed to create post', 3000);
 * 
 * // Other methods
 * toast.warning('Connection slow');
 * toast.info('New features available');
 * ```
 */

import { useToastStore as useToastStoreImport } from '../store/toastStore';

// Re-export the main store
export { useToastStore } from '../store/toastStore';

// Convenience hook for easier usage
export function useToast() {
  const toastStore = useToastStoreImport();

  const toast = {
    success: (message: string, duration?: number) => {
      toastStore.success('Success', message);
    },
    error: (message: string, duration?: number) => {
      toastStore.error('Error', message);
    },
    warning: (message: string, duration?: number) => {
      toastStore.warning('Warning', message);
    },
    info: (message: string, duration?: number) => {
      toastStore.info('Info', message);
    },
  };

  return {
    toast,
    addToast: toastStore.addToast,
    removeToast: toastStore.removeToast,
    toasts: toastStore.toasts,
  };
}
