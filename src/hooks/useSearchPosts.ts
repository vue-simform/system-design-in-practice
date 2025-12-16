import { useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import type { FeedResponse } from '../types';

export interface SearchParams {
  query: string;
  filter: 'all' | 'following' | 'liked';
  sort: 'newest' | 'popular' | 'trending';
}

/**
 * Hook for searching posts with infinite scroll support
 * 
 * System Design Concepts Demonstrated:
 * 1. **Query Caching**: Results cached for 5 minutes to reduce API calls
 * 2. **Debouncing**: Search executes only when query stable for 300ms
 * 3. **Pagination**: Cursor-based infinite scroll for search results
 * 4. **Stale-While-Revalidate**: Show cached data while fetching fresh results
 * 
 * @param params - Search parameters (query, filter, sort)
 * @param enabled - Whether to execute the search (controlled externally for debouncing)
 */
export function useSearchPosts(params: SearchParams, enabled: boolean = true) {
  const { query, filter, sort } = params;

  return useInfiniteQuery<FeedResponse, Error>({
    queryKey: ['search', query, filter, sort],
    queryFn: ({ pageParam }) => 
      feedApi.searchPosts(query, filter, sort, pageParam as string | undefined),
    
    // Pagination
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined;
    },
    
    // Initial page param
    initialPageParam: undefined,
    
    // Caching strategy
    staleTime: 5 * 60 * 1000, // 5 minutes - results stay fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for reuse
    
    // Only run query when enabled (for debouncing control)
    enabled: enabled && query.trim().length > 0,
    
    // Performance optimizations
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    
    // Network optimization
    networkMode: 'online',
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Get flattened list of posts from paginated results with intersection observer
 */
export function useSearchResults(params: SearchParams, enabled: boolean = true) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const query = useSearchPosts(params, enabled);
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = query;

  // Intersection observer for infinite scroll
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      
      if (isFetchingNextPage || !hasNextPage) return;
      
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            fetchNextPage();
          }
        },
        { rootMargin: '200px' }
      );
      
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );
  
  const posts = data?.pages.flatMap(page => page.posts) ?? [];
  const totalResults = posts.length;
  
  return {
    posts,
    lastPostRef,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
    totalResults,
  };
}
