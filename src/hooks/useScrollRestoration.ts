/**
 * Hook for automatic scroll position restoration
 * 
 * System Design Concepts:
 * 1. State Persistence - Maintain scroll position across navigation
 * 2. Debouncing - Limit write frequency (150ms) to reduce storage writes
 * 3. Session Storage - Temporary persistence that clears on tab close
 * 4. Per-Route Tracking - Different scroll positions for different pages
 * 5. Smooth Restoration - Optional smooth scroll animation
 * 6. Performance - Passive event listeners, throttled saves
 * 7. Multi-Tab Support - Each tab maintains its own scroll state
 * 
 * Features:
 * - Auto-save scroll position every 150ms (debounced)
 * - Auto-restore on mount with optional smooth scrolling
 * - Per-route tracking (feed, profile, search results)
 * - Clean up on unmount
 * - Manual save/restore functions
 * - Threshold-based saving (only save if scrolled >50px)
 * 
 * @example
 * ```tsx
 * // Automatic restoration
 * useScrollRestoration('feed-page', { autoRestore: true, smooth: true });
 * 
 * // Manual control
 * const { savePosition, restorePosition } = useScrollRestoration('profile', { 
 *   autoSave: false 
 * });
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { sessionPersistentStorage } from '../utils/statePersistence';

const SCROLL_SAVE_DELAY = 150; // 150ms debouncing as documented
const SCROLL_THRESHOLD = 50; // Only save if scrolled more than 50px

interface ScrollPosition {
  x: number;
  y: number;
  timestamp: number;
  route: string;
}

interface UseScrollRestorationOptions {
  /**
   * Automatically save scroll position on scroll events
   * @default true
   */
  autoSave?: boolean;

  /**
   * Automatically restore scroll position on mount
   * @default true
   */
  autoRestore?: boolean;

  /**
   * Use smooth scrolling when restoring
   * @default false
   */
  smooth?: boolean;

  /**
   * Delay before considering restoration (useful for loading states)
   * @default 0
   */
  restoreDelay?: number;

  /**
   * Only save if scrolled past this threshold (prevents saving trivial scrolls)
   * @default 50
   */
  threshold?: number;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

interface UseScrollRestorationReturn {
  /**
   * Manually save current scroll position
   */
  savePosition: () => void;

  /**
   * Manually restore saved scroll position
   */
  restorePosition: (smooth?: boolean) => void;

  /**
   * Get saved scroll position without restoring
   */
  getSavedPosition: () => ScrollPosition | null;

  /**
   * Clear saved scroll position
   */
  clearPosition: () => void;

  /**
   * Check if a saved position exists
   */
  hasPosition: () => boolean;
}

/**
 * Custom hook for automatic scroll position restoration
 * 
 * Saves scroll position to session storage with debouncing and
 * restores it on component mount. Supports per-route tracking.
 * 
 * @param routeKey - Unique identifier for this route/page (e.g., 'feed', 'profile-123')
 * @param options - Configuration options
 * @returns Object with manual save/restore functions
 */
export function useScrollRestoration(
  routeKey: string,
  options: UseScrollRestorationOptions = {}
): UseScrollRestorationReturn {
  const {
    autoSave = true,
    autoRestore = true,
    smooth = false,
    restoreDelay = 0,
    threshold = SCROLL_THRESHOLD,
    debug = false,
  } = options;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasRestoredRef = useRef(false);
  const storageKey = `scroll-${routeKey}`;

  /**
   * Log debug messages
   */
  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[ScrollRestoration:${routeKey}]`, message, data || '');
      }
    },
    [debug, routeKey]
  );

  /**
   * Get saved scroll position from storage
   */
  const getSavedPosition = useCallback((): ScrollPosition | null => {
    const saved = sessionPersistentStorage.get<ScrollPosition>(storageKey);
    log('Get saved position', saved);
    return saved;
  }, [storageKey, log]);

  /**
   * Save current scroll position to storage (with debouncing)
   */
  const savePosition = useCallback(() => {
    const x = window.scrollX;
    const y = window.scrollY;

    // Only save if scrolled past threshold
    if (y < threshold && x === 0) {
      log('Skipping save (below threshold)', { x, y, threshold });
      return;
    }

    const position: ScrollPosition = {
      x,
      y,
      timestamp: Date.now(),
      route: routeKey,
    };

    // Save to session storage (no TTL - clears on tab close)
    sessionPersistentStorage.set(storageKey, position);
    log('Saved position', position);
  }, [storageKey, routeKey, threshold, log]);

  /**
   * Restore scroll position from storage
   */
  const restorePosition = useCallback(
    (smoothScroll: boolean = smooth) => {
      const saved = getSavedPosition();

      if (!saved) {
        log('No saved position to restore');
        return;
      }

      // Check if position is for current route
      if (saved.route !== routeKey) {
        log('Position is for different route', { saved: saved.route, current: routeKey });
        return;
      }

      log('Restoring position', { x: saved.x, y: saved.y, smooth: smoothScroll });

      // Restore scroll position
      if (smoothScroll) {
        window.scrollTo({
          left: saved.x,
          top: saved.y,
          behavior: 'smooth',
        });
      } else {
        window.scrollTo(saved.x, saved.y);
      }

      hasRestoredRef.current = true;
    },
    [getSavedPosition, smooth, routeKey, log]
  );

  /**
   * Clear saved scroll position
   */
  const clearPosition = useCallback(() => {
    sessionPersistentStorage.remove(storageKey);
    log('Cleared position');
  }, [storageKey, log]);

  /**
   * Check if saved position exists
   */
  const hasPosition = useCallback((): boolean => {
    return sessionPersistentStorage.has(storageKey);
  }, [storageKey]);

  /**
   * Debounced scroll handler
   */
  const handleScroll = useCallback(() => {
    if (!autoSave) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce: save after 150ms of no scrolling
    timeoutRef.current = setTimeout(() => {
      savePosition();
    }, SCROLL_SAVE_DELAY);
  }, [autoSave, savePosition]);

  /**
   * Auto-restore on mount
   */
  useEffect(() => {
    if (!autoRestore || hasRestoredRef.current) return;

    const restore = () => {
      restorePosition(smooth);
    };

    if (restoreDelay > 0) {
      // Delay restoration (useful for loading states)
      const timer = setTimeout(restore, restoreDelay);
      return () => clearTimeout(timer);
    } else {
      // Restore immediately
      restore();
    }
  }, [autoRestore, restorePosition, smooth, restoreDelay]);

  /**
   * Auto-save on scroll
   */
  useEffect(() => {
    if (!autoSave) return;

    // Use passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      // Clear pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Save final position before unmount
      savePosition();
    };
  }, [autoSave, handleScroll, savePosition]);

  return {
    savePosition,
    restorePosition,
    getSavedPosition,
    clearPosition,
    hasPosition,
  };
}

/**
 * Hook to save scroll position only (no auto-restore)
 * Useful for scenarios where you want manual restoration control
 * 
 * @example
 * ```tsx
 * useSaveScrollPosition('search-results');
 * ```
 */
export function useSaveScrollPosition(routeKey: string): void {
  useScrollRestoration(routeKey, {
    autoSave: true,
    autoRestore: false,
  });
}

/**
 * Hook to restore scroll position only (no auto-save)
 * Useful for one-time restoration scenarios
 * 
 * @example
 * ```tsx
 * useRestoreScrollPosition('profile', { smooth: true });
 * ```
 */
export function useRestoreScrollPosition(
  routeKey: string,
  options: Pick<UseScrollRestorationOptions, 'smooth' | 'restoreDelay'> = {}
): void {
  useScrollRestoration(routeKey, {
    autoSave: false,
    autoRestore: true,
    ...options,
  });
}
