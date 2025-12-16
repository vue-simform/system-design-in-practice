/**
 * LazyImage Component
 * 
 * Progressive image loading with blur placeholder and Intersection Observer.
 * Improves perceived performance by loading images only when visible.
 * 
 * System Design Concepts:
 * - Lazy Loading: Load images only when in viewport
 * - Intersection Observer: Efficient viewport detection
 * - Progressive Enhancement: Show blur → low-res → high-res
 * - Fade-in Animation: Smooth transition when loaded
 * - Error Handling: Fallback for failed images
 * - Accessibility: Proper alt text and ARIA attributes
 * 
 * Features:
 * - Blur placeholder before load
 * - Intersection Observer for viewport detection
 * - Fade-in animation on load
 * - Error fallback image
 * - Loading state indicator
 * - Responsive srcset support
 * 
 * Usage:
 * ```tsx
 * <LazyImage
 *   src="/image.jpg"
 *   alt="Description"
 *   placeholder="blur"
 *   className="w-full h-64 object-cover"
 * />
 * ```
 */

import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: 'blur' | 'shimmer' | 'none';
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'lazy' | 'eager';
  threshold?: number;
  rootMargin?: string;
}

export function LazyImage({
  src,
  alt,
  className = '',
  placeholder = 'blur',
  fallbackSrc = '/placeholder-image.svg',
  onLoad,
  onError,
  loading = 'lazy',
  threshold = 0.01,
  rootMargin = '50px',
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(loading === 'eager');
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'eager' || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loading, threshold, rootMargin]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  // Determine which src to use
  const imageSrc = hasError ? fallbackSrc : src;
  const shouldLoad = isInView || loading === 'eager';

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder */}
      {!isLoaded && placeholder !== 'none' && (
        <div
          className={`absolute inset-0 ${
            placeholder === 'blur'
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'skeleton-shimmer'
          }`}
          aria-hidden="true"
        />
      )}

      {/* Actual Image */}
      {shouldLoad && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={`
            w-full h-full object-cover transition-opacity duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
          `}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
        />
      )}

      {/* Loading Spinner (optional) */}
      {!isLoaded && !hasError && shouldLoad && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          <svg
            className="w-12 h-12 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">Image unavailable</span>
        </div>
      )}
    </div>
  );
}

/**
 * LazyImage with srcset for responsive images
 */
interface ResponsiveLazyImageProps extends Omit<LazyImageProps, 'src'> {
  srcSet: {
    src: string;
    width: number;
  }[];
  sizes?: string;
}

export function ResponsiveLazyImage({
  srcSet,
  sizes = '100vw',
  alt,
  className = '',
  placeholder = 'blur',
  fallbackSrc,
  onLoad,
  onError,
  loading = 'lazy',
  threshold = 0.01,
  rootMargin = '50px',
}: ResponsiveLazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(loading === 'eager');
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer
  useEffect(() => {
    if (loading === 'eager' || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loading, threshold, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  // Build srcset string
  const srcSetString = srcSet.map((s) => `${s.src} ${s.width}w`).join(', ');
  const defaultSrc = srcSet[0]?.src || fallbackSrc || '';

  const shouldLoad = isInView || loading === 'eager';

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder */}
      {!isLoaded && placeholder !== 'none' && (
        <div
          className={`absolute inset-0 ${
            placeholder === 'blur'
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'skeleton-shimmer'
          }`}
          aria-hidden="true"
        />
      )}

      {/* Responsive Image */}
      {shouldLoad && (
        <img
          ref={imgRef}
          src={hasError ? fallbackSrc : defaultSrc}
          srcSet={hasError ? undefined : srcSetString}
          sizes={sizes}
          alt={alt}
          className={`
            w-full h-full object-cover transition-opacity duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
          `}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
        />
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          <svg
            className="w-12 h-12 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">Image unavailable</span>
        </div>
      )}
    </div>
  );
}

/**
 * LazyBackgroundImage Component
 * For background images with lazy loading
 */
interface LazyBackgroundImageProps {
  src: string;
  children?: React.ReactNode;
  className?: string;
  placeholder?: 'blur' | 'shimmer' | 'none';
  loading?: 'lazy' | 'eager';
}

export function LazyBackgroundImage({
  src,
  children,
  className = '',
  placeholder = 'blur',
  loading = 'lazy',
}: LazyBackgroundImageProps) {
  const [isLoaded, setIsLoaded] = useState(loading === 'eager');
  const [isInView, setIsInView] = useState(loading === 'eager');
  const divRef = useRef<HTMLDivElement>(null);

  // Intersection Observer
  useEffect(() => {
    if (loading === 'eager' || !divRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.01,
        rootMargin: '50px',
      }
    );

    observer.observe(divRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  // Preload image
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [isInView, src]);

  return (
    <div
      ref={divRef}
      className={`relative ${className}`}
      style={
        isLoaded
          ? {
              backgroundImage: `url(${src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {/* Placeholder */}
      {!isLoaded && placeholder !== 'none' && (
        <div
          className={`absolute inset-0 ${
            placeholder === 'blur'
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'skeleton-shimmer'
          }`}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}
