/**
 * Toast Component
 * 
 * A lightweight toast notification system for displaying temporary messages.
 * Shows success, error, warning, and info messages with auto-dismiss.
 * 
 * System Design Concepts:
 * - User Feedback: Clear, non-intrusive notifications
 * - Portal Rendering: Renders outside DOM hierarchy for proper z-index
 * - Auto-dismiss: Configurable timeout for better UX
 * - Animation: Smooth enter/exit transitions
 * 
 * Features:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-dismiss after configured duration
 * - Manual dismiss with close button
 * - Smooth animations (slide + fade)
 * - Stack multiple toasts vertically
 * - Portal-based rendering (fixed positioning)
 * 
 * Usage:
 * ```tsx
 * const { addToast } = useToast();
 * 
 * addToast({
 *   type: 'error',
 *   message: 'Failed to like post',
 *   duration: 3000
 * });
 * ```
 */

import { createPortal } from 'react-dom';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const TOAST_COLORS = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

export function ToastItem({ toast, onDismiss }: ToastProps) {
  const { id, type, message, duration = 3000 } = toast;

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      className="flex items-center gap-3 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[320px] max-w-[480px] animate-slide-in"
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className={`shrink-0 w-8 h-8 ${TOAST_COLORS[type]} rounded-full flex items-center justify-center text-white font-bold text-lg`}
      >
        {TOAST_ICONS[type]}
      </div>

      {/* Message */}
      <p className="flex-1 text-gray-800 text-sm font-medium wrap-break-word">
        {message}
      </p>

      {/* Close Button */}
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss notification"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return createPortal(
    <div
      className="fixed top-20 right-6 z-9999 flex flex-col gap-3 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body
  );
}
