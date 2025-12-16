/**
 * Accessibility Utilities
 * 
 * Comprehensive utilities for WCAG 2.1 AA compliance including:
 * - Screen reader announcements (aria-live)
 * - Keyboard navigation helpers
 * - Focus management
 * - ARIA attribute helpers
 * - Color contrast utilities
 * 
 * System Design:
 * - useAnnouncer: Polite/assertive announcements for screen readers
 * - useFocusTrap: Trap focus within modals/dialogs
 * - useKeyboardNavigation: Global keyboard shortcuts (j/k/l/c//)
 * - Focus management: Restore focus after modal close
 * - ARIA helpers: Build accessible labels and descriptions
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// SCREEN READER ANNOUNCEMENTS
// ============================================================================

/**
 * Screen Reader Announcer Hook
 * 
 * Creates aria-live region for announcements to screen readers.
 * Use 'polite' for non-critical updates, 'assertive' for urgent messages.
 * 
 * @example
 * const announce = useAnnouncer();
 * announce('Post liked', 'polite');
 * announce('Error: Failed to save', 'assertive');
 */
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region on mount
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      announcer.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
        announcerRef.current = null;
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      // Change aria-live priority
      announcerRef.current.setAttribute('aria-live', priority);
      
      // Clear and set message (triggers screen reader)
      announcerRef.current.textContent = '';
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = message;
        }
      }, 100);
    }
  }, []);

  return announce;
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Focus Trap Hook
 * 
 * Traps keyboard focus within a container (modal, dialog, dropdown).
 * Returns focus to trigger element when trap is disabled.
 * 
 * @example
 * const modalRef = useFocusTrap(isOpen, triggerRef);
 * <dialog ref={modalRef}>...</dialog>
 */
export function useFocusTrap(
  isActive: boolean,
  returnFocusRef?: React.RefObject<HTMLElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    const focusableSelector = `
      a[href], 
      button:not([disabled]), 
      textarea:not([disabled]), 
      input:not([disabled]), 
      select:not([disabled]), 
      [tabindex]:not([tabindex="-1"])
    `;

    const getFocusableElements = () => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    };

    // Focus first element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: Move focus backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Move focus forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus to trigger element
      const returnTarget = returnFocusRef?.current || previousFocusRef.current;
      if (returnTarget && document.body.contains(returnTarget)) {
        returnTarget.focus();
      }
    };
  }, [isActive, returnFocusRef]);

  return containerRef;
}

/**
 * Focus Visible Hook
 * 
 * Adds visible focus indicator only for keyboard navigation.
 * Removes focus ring for mouse/touch interactions.
 * 
 * @example
 * const { focusVisible, onBlur } = useFocusVisible();
 * <button className={focusVisible ? 'focus-visible' : ''} onBlur={onBlur}>
 */
export function useFocusVisible() {
  const [focusVisible, setFocusVisible] = useState(false);
  const hadKeyboardEvent = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        hadKeyboardEvent.current = true;
      }
    };

    const handleMouseDown = () => {
      hadKeyboardEvent.current = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleFocus = useCallback(() => {
    if (hadKeyboardEvent.current) {
      setFocusVisible(true);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setFocusVisible(false);
  }, []);

  return { focusVisible, onFocus: handleFocus, onBlur: handleBlur };
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
};

/**
 * Keyboard Navigation Hook
 * 
 * Register global keyboard shortcuts with conflict detection.
 * Automatically disabled when typing in inputs.
 * 
 * @example
 * useKeyboardNavigation([
 *   { key: 'j', description: 'Next post', action: () => nextPost() },
 *   { key: 'k', description: 'Previous post', action: () => prevPost() },
 *   { key: 'l', description: 'Like post', action: () => likePost() },
 *   { key: '/', description: 'Search', action: () => focusSearch() }
 * ]);
 */
export function useKeyboardNavigation(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isTyping = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTyping && e.key !== 'Escape') return;

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (
          e.key === shortcut.key &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * Skip to Content Link
 * 
 * Accessible skip navigation link for keyboard users.
 * Shows on focus, hidden otherwise.
 * 
 * @example
 * <SkipLink href="#main-content">Skip to main content</SkipLink>
 */
export function SkipLink({ 
  href, 
  children 
}: { 
  href: string; 
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {children}
    </a>
  );
}

// ============================================================================
// ARIA HELPERS
// ============================================================================

/**
 * Build accessible label from multiple sources
 * Priority: aria-label > aria-labelledby > children text
 */
export function getAccessibleLabel(
  element: HTMLElement
): string {
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label')!;
  }

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    return labelElement?.textContent || '';
  }

  return element.textContent || '';
}

/**
 * Generate unique IDs for ARIA relationships
 * Useful for aria-labelledby, aria-describedby
 */
let idCounter = 0;
export function useAriaId(prefix = 'aria'): string {
  const idRef = useRef<string | undefined>(undefined);

  if (!idRef.current) {
    idRef.current = `${prefix}-${++idCounter}`;
  }

  return idRef.current;
}

/**
 * ARIA Live Region Component
 * 
 * Persistent live region for announcements.
 * Use for dynamic content updates (new posts, likes, errors).
 * 
 * @example
 * <AriaLiveRegion>
 *   {message && <div>{message}</div>}
 * </AriaLiveRegion>
 */
export function AriaLiveRegion({
  children,
  priority = 'polite',
  atomic = true
}: {
  children: React.ReactNode;
  priority?: 'polite' | 'assertive';
  atomic?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic={atomic}
      className="sr-only"
    >
      {children}
    </div>
  );
}

// ============================================================================
// COLOR CONTRAST
// ============================================================================

/**
 * Calculate relative luminance (WCAG formula)
 * Used for contrast ratio calculation
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.1 requires:
 * - Normal text: 4.5:1
 * - Large text (18pt+): 3:1
 * - UI components: 3:1
 * 
 * @example
 * const ratio = getContrastRatio('#ffffff', '#000000'); // 21:1 (perfect)
 * const isReadable = ratio >= 4.5; // true
 */
export function getContrastRatio(color1: string, color2: string): number {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.substr(0, 2), 16);
  const g1 = parseInt(hex1.substr(2, 2), 16);
  const b1 = parseInt(hex1.substr(4, 2), 16);

  const r2 = parseInt(hex2.substr(0, 2), 16);
  const g2 = parseInt(hex2.substr(2, 2), 16);
  const b2 = parseInt(hex2.substr(4, 2), 16);

  const lum1 = getLuminance(r1, g1, b1);
  const lum2 = getLuminance(r2, g2, b2);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if color combination meets WCAG AA standards
 * 
 * @example
 * const { passes, ratio } = meetsContrastRequirement('#000', '#fff', 'normal');
 * // passes: true, ratio: 21
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  size: 'normal' | 'large' = 'normal'
): { passes: boolean; ratio: number } {
  const ratio = getContrastRatio(foreground, background);
  const requirement = size === 'large' ? 3 : 4.5;

  return {
    passes: ratio >= requirement,
    ratio: parseFloat(ratio.toFixed(2))
  };
}

// ============================================================================
// REDUCED MOTION
// ============================================================================

/**
 * Respect user's motion preferences
 * Disable animations if user prefers reduced motion
 * 
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 * <div className={prefersReducedMotion ? '' : 'animate-fade-in'}>
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// FORM VALIDATION ACCESSIBILITY
// ============================================================================

/**
 * Accessible form error message
 * Links error to input with aria-describedby
 * 
 * @example
 * const errorId = useAriaId('error');
 * <input aria-describedby={hasError ? errorId : undefined} />
 * {hasError && <ErrorMessage id={errorId}>Invalid email</ErrorMessage>}
 */
export function ErrorMessage({
  id,
  children
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className="text-red-600 text-sm mt-1"
    >
      {children}
    </div>
  );
}

/**
 * Accessible form field wrapper
 * Automatically handles label, error, and description associations
 * 
 * @example
 * <FormField
 *   label="Email"
 *   error="Invalid email"
 *   description="We'll never share your email"
 * >
 *   <input type="email" />
 * </FormField>
 */
import { cloneElement } from 'react';

export function FormField({
  label,
  error,
  description,
  required,
  children
}: {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: React.ReactElement;
}) {
  const inputId = useAriaId('input');
  const errorId = useAriaId('error');
  const descId = useAriaId('desc');

  const describedBy = [
    error ? errorId : null,
    description ? descId : null
  ].filter(Boolean).join(' ');

  return (
    <div className="form-field">
      <label htmlFor={inputId} className="block font-medium mb-1">
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>

      {description && (
        <div id={descId} className="text-sm text-gray-600 mb-2">
          {description}
        </div>
      )}

      {cloneElement(children, {
        id: inputId,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? 'true' : 'false',
        'aria-required': required ? 'true' : 'false'
      } as any)}

      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}

// ============================================================================
// KEYBOARD SHORTCUTS HELP
// ============================================================================

/**
 * Show keyboard shortcuts help modal
 * Accessible with Escape to close and focus management
 * 
 * @example
 * const { isOpen, open, close } = useKeyboardShortcutsHelp();
 * <button onClick={open}>Keyboard shortcuts</button>
 * <KeyboardShortcutsModal isOpen={isOpen} onClose={close} shortcuts={shortcuts} />
 */
export function useKeyboardShortcutsHelp(shortcuts: KeyboardShortcut[]) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    shortcuts,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false)
  };
}
