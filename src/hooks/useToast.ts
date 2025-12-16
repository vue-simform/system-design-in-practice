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
 * toast.success('Post created!');
 * 
 * // Error toast
 * toast.error('Failed to create post');
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
    success: (message: string) => {
      toastStore.success('Success', message);
    },
    error: (message: string) => {
      toastStore.error('Error', message);
    },
    warning: (message: string) => {
      toastStore.warning('Warning', message);
    },
    info: (message: string) => {
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
