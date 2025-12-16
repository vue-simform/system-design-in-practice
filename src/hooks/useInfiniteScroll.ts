/**
 * Custom Hook: useInfiniteScroll
 * 
 * Implements infinite scroll with React Query's useInfiniteQuery
 * and Intersection Observer API for automatic pagination.
 * 
 * System Design Concepts:
 * - Cursor-based pagination (scalable for large datasets)
 * - Intersection Observer (efficient scroll detection)
 * - React Query infinite queries (automatic page management)
 * - Memory optimization (only fetches visible data)
 * - Multi-layer caching (L1 Memory → L2 IndexedDB → L3 Network)
 * - Cache-first strategy for instant loading
 * 
 * How it works:
 * 1. useInfiniteQuery manages multiple pages of data
 * 2. Intersection Observer detects when last item is visible
 * 3. Automatically fetches next page when scrolling near bottom
 * 4. Uses cursor from previous page for pagination
 * 5. Cache coordinator checks IndexedDB before network
 * 6. Posts automatically persisted to IndexedDB on success
 * 
 * Usage:
 * ```tsx
 * const { data, lastPostRef, isFetchingNextPage, hasNextPage } = useInfiniteScroll();
 * 
 * // Attach ref to last post
 * <PostCard ref={lastPostRef} post={lastPost} />
 * ```
 */

import { useCallback, useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import { warmCache } from '../utils/cacheCoordinator';
import type { FeedResponse } from '../types';

interface UseInfiniteScrollOptions {
  limit?: number;
  enabled?: boolean;
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions = {}) {
  const { limit = 10, enabled = true } = options;
  
  // Observer reference for cleanup
  const observerRef = useRef<IntersectionObserver | null>(null);

  // React Query infinite query for paginated data
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery<FeedResponse, Error>({
    queryKey: ['feed', 'infinite', { limit }],
    
    // Fetch function receives pageParam (cursor from previous page)
    queryFn: ({ pageParam }) => feedApi.getFeed(pageParam as string | undefined, limit),
    
    // Extract cursor for next page from response
    getNextPageParam: (lastPage) => {
      return lastPage.pagination?.hasMore ? lastPage.pagination.nextCursor : undefined;
    },
    
    // Initial page param is undefined (no cursor)
    initialPageParam: undefined,
    
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  /**
   * Callback ref for the last post in the list
   * 
   * This ref is attached to the last rendered post.
   * When that post becomes visible (enters viewport),
   * the Intersection Observer triggers fetchNextPage().
   * 
   * Benefits:
   * - Automatic: No manual "Load More" button needed
   * - Efficient: Uses native browser API (Intersection Observer)
   * - Smooth UX: Loads before user reaches bottom
   */
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Don't observe if already fetching or no more pages
      if (isFetchingNextPage || !hasNextPage) return;

      // Create new observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          // If last post is visible, fetch next page
          if (entries[0].isIntersecting) {
            fetchNextPage();
          }
        },
        {
          // Start fetching 200px before reaching the element
          // This provides smooth UX - data loads before user sees loading state
          rootMargin: '200px',
        }
      );

      // Start observing the last post
      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  // Flatten all pages into a single array of posts
  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  // Warm cache when posts are loaded
  // This pre-caches posts and users for offline access
  useEffect(() => {
    if (posts.length > 0) {
      warmCache(posts).catch(() => {
      });
    }
  }, [posts]);

  // Cleanup: Disconnect observer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return {
    posts,              // All posts from all pages
    lastPostRef,        // Ref to attach to last post
    hasNextPage,        // Are there more pages to load?
    isFetchingNextPage, // Is next page currently loading?
    isLoading,          // Is initial load happening?
    error,              // Any errors?
    refetch,            // Manual refetch function
  };
}
