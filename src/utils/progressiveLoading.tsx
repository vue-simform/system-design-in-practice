/**
 * Progressive Loading Utilities
 * 
 * Utilities for staggered animations, progressive content loading,
 * and perceived performance optimizations.
 * 
 * System Design Concepts:
 * - Staggered Animations: Sequential appearance for natural feel
 * - Progressive Disclosure: Reveal content gradually
 * - Perceived Performance: Make app feel faster than it is
 * - Animation Timing: Choreographed delays for polished UX
 * - Performance Budget: Respect reduced-motion preferences
 */

import { useEffect, useState, useRef } from 'react';

// ============================================================================
// Staggered Animation Hook
// ============================================================================

interface UseStaggeredAnimationOptions {
  delay?: number; // Delay between items (ms)
  enabled?: boolean; // Enable/disable animation
}

/**
 * Hook for staggered list animations
 * 
 * Usage:
 * ```tsx
 * const items = ['a', 'b', 'c'];
 * const getDelay = useStaggeredAnimation(items.length, { delay: 100 });
 * 
 * {items.map((item, index) => (
 *   <div style={{ animationDelay: getDelay(index) }}>
 *     {item}
 *   </div>
 * ))}
 * ```
 */
export function useStaggeredAnimation(
  _itemCount: number,
  options: UseStaggeredAnimationOptions = {}
) {
  const { delay = 100, enabled = true } = options;
  const prefersReducedMotion = usePrefersReducedMotion();

  // Return delay calculator function
  return (index: number): string => {
    if (!enabled || prefersReducedMotion) return '0ms';
    return `${index * delay}ms`;
  };
}

// ============================================================================
// Progressive Reveal Hook
// ============================================================================

interface UseProgressiveRevealOptions {
  batchSize?: number; // Number of items to reveal at once
  interval?: number; // Time between batches (ms)
  enabled?: boolean;
}

/**
 * Hook for progressive content reveal
 * Reveals items in batches for better perceived performance
 * 
 * Usage:
 * ```tsx
 * const posts = [...]; // Array of 100 posts
 * const visibleCount = useProgressiveReveal(posts.length, {
 *   batchSize: 10,
 *   interval: 100,
 * });
 * 
 * const visiblePosts = posts.slice(0, visibleCount);
 * ```
 */
export function useProgressiveReveal(
  totalItems: number,
  options: UseProgressiveRevealOptions = {}
): number {
  const { batchSize = 10, interval = 100, enabled = true } = options;
  const [visibleCount, setVisibleCount] = useState(enabled ? batchSize : totalItems);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Skip progressive reveal if disabled or prefers reduced motion
    if (!enabled || prefersReducedMotion || totalItems <= batchSize) {
      setVisibleCount(totalItems);
      return;
    }

    let currentCount = batchSize;
    const timer = setInterval(() => {
      currentCount += batchSize;
      if (currentCount >= totalItems) {
        setVisibleCount(totalItems);
        clearInterval(timer);
      } else {
        setVisibleCount(currentCount);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [totalItems, batchSize, interval, enabled, prefersReducedMotion]);

  return visibleCount;
}

// ============================================================================
// Intersection Observer Hook
// ============================================================================

interface UseInViewOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook to detect when element enters viewport
 * 
 * Usage:
 * ```tsx
 * const [ref, isInView] = useInView({ threshold: 0.5 });
 * 
 * <div ref={ref}>
 *   {isInView && <ExpensiveComponent />}
 * </div>
 * ```
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewOptions = {}
): [React.RefObject<T | null>, boolean] {
  const { threshold = 0, rootMargin = '0px', triggerOnce = false } = options;
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;
        setIsInView(inView);

        if (inView && triggerOnce) {
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce]);

  return [ref, isInView];
}

// ============================================================================
// Prefers Reduced Motion Hook
// ============================================================================

/**
 * Hook to detect if user prefers reduced motion
 * Respects system accessibility settings
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// Lazy Component Wrapper
// ============================================================================

interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

/**
 * Component wrapper for lazy loading heavy components
 * Only renders children when in viewport
 * 
 * Usage:
 * ```tsx
 * <LazyComponent fallback={<Skeleton />}>
 *   <ExpensiveChart />
 * </LazyComponent>
 * ```
 */
export function LazyComponent({
  children,
  fallback = null,
  threshold = 0.01,
  rootMargin = '50px',
}: LazyComponentProps) {
  const [ref, isInView] = useInView({ threshold, rootMargin, triggerOnce: true });

  return <div ref={ref}>{isInView ? children : fallback}</div>;
}

// ============================================================================
// Animation Timing Functions
// ============================================================================

/**
 * Calculate stagger delay for item index
 */
export function getStaggerDelay(index: number, delayMs: number = 100): string {
  return `${index * delayMs}ms`;
}

/**
 * Calculate ease-out timing function
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Calculate ease-in-out timing function
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================================
// Content Priority Hook
// ============================================================================

type Priority = 'high' | 'medium' | 'low';

interface ContentItem {
  priority: Priority;
  render: () => React.ReactNode;
}

/**
 * Hook for priority-based content loading
 * Loads high-priority content first, then medium, then low
 * 
 * Usage:
 * ```tsx
 * const content = [
 *   { priority: 'high', render: () => <CriticalContent /> },
 *   { priority: 'medium', render: () => <ImportantContent /> },
 *   { priority: 'low', render: () => <NiceToHave /> },
 * ];
 * 
 * const { shouldRender } = usePriorityLoading(content);
 * 
 * {content.map((item, index) => (
 *   shouldRender(index) && item.render()
 * ))}
 * ```
 */
export function usePriorityLoading(items: ContentItem[]) {
  const [loadedPriorities, setLoadedPriorities] = useState<Set<Priority>>(
    new Set(['high'])
  );

  useEffect(() => {
    // Load medium priority after 100ms
    const mediumTimer = setTimeout(() => {
      setLoadedPriorities((prev) => new Set([...prev, 'medium']));
    }, 100);

    // Load low priority after 300ms
    const lowTimer = setTimeout(() => {
      setLoadedPriorities((prev) => new Set([...prev, 'low']));
    }, 300);

    return () => {
      clearTimeout(mediumTimer);
      clearTimeout(lowTimer);
    };
  }, []);

  const shouldRender = (index: number): boolean => {
    const item = items[index];
    return item ? loadedPriorities.has(item.priority) : false;
  };

  return { shouldRender, loadedPriorities };
}

// ============================================================================
// Performance Observer Hook
// ============================================================================

/**
 * Hook to measure component render performance
 * Useful for identifying slow components
 * 
 * Usage:
 * ```tsx
 * usePerformanceObserver('MyComponent', () => {
 *   // Component code
 * });
 * ```
 */
export function usePerformanceObserver(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current++;
    const duration = performance.now() - startTime.current;

    if (import.meta.env.DEV && duration > 16) {
      // Log if render takes > 16ms (60fps threshold)
      console.log(
        `[Performance] ${componentName} render #${renderCount.current} took ${duration.toFixed(2)}ms`
      );
    }

    startTime.current = performance.now();
  });
}

// ============================================================================
// Viewport Height Hook
// ============================================================================

/**
 * Hook to get viewport height
 * Updates on window resize
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  useEffect(() => {
    const handleResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return height;
}

/**
 * Check if element is above the fold
 */
export function useIsAboveFold<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T | null>,
  boolean
] {
  const [ref] = useInView<T>({ threshold: 0, rootMargin: '0px' });
  const viewportHeight = useViewportHeight();
  const [isAboveFold, setIsAboveFold] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    setIsAboveFold(rect.top < viewportHeight);
  }, [ref, viewportHeight]);

  return [ref, isAboveFold];
}
