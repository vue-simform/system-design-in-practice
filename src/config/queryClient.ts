/**
 * React Query Configuration
 * 
 * This file configures the React Query client with optimal settings for:
 * - Caching strategies
 * - Retry logic with exponential backoff
 * - Background refetching
 * - Comprehensive error handling
 * - Network-aware refetching
 * - Multi-layer cache integration (L1 Memory → L2 IndexedDB → L3 Network)
 * - Cache persistence to IndexedDB
 */

import { QueryClient } from '@tanstack/react-query';
import { classifyError, logError, isRetryableError } from '../utils/errorHandling';
import { cachePosts } from '../utils/indexedDBCache';
import type { Post } from '../types';

/**
 * Global error handler for all queries
 * 
 * Note: Only logs errors to console/monitoring.
 * Toasts are handled by individual mutations/queries for better control
 * and to avoid duplicate notifications.
 */
function handleQueryError(error: unknown): void {
  const appError = classifyError(error);
  
  // Log error with context
  logError(appError, {
    source: 'ReactQuery',
    retryable: appError.retryable,
  });

  // Note: Toast notifications are handled by individual queries/mutations
  // This prevents duplicate toasts when mutations have their own error handlers
}

/**
 * Custom retry logic based on error type
 */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry more than 3 times
  if (failureCount >= 3) return false;

  const appError = classifyError(error);
  
  // Use our error classification to determine if retryable
  return isRetryableError(appError);
}

/**
 * Entity-specific cache timings optimized for multi-layer cache
 * - Posts: Moderate freshness (1min stale, 10min GC)
 * - Users: Long freshness (5min stale, 30min GC)
 * - Comments: Short freshness (30s stale, 5min GC)
 */
export const CACHE_CONFIG = {
  posts: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  users: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  comments: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default cache data for 1 minute (optimized for multi-layer caching)
      staleTime: CACHE_CONFIG.posts.staleTime,
      
      // Keep unused data in cache for 10 minutes (L1 memory cache)
      gcTime: CACHE_CONFIG.posts.gcTime,
      
      // Custom retry logic based on error type
      retry: shouldRetryQuery,
      
      // Exponential backoff: 1s, 2s, 4s, 8s (max 30s)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Don't refetch on window focus by default (can be overridden per query)
      refetchOnWindowFocus: false,
      
      // Refetch when network reconnects (for offline recovery)
      refetchOnReconnect: true,
      
      // Don't refetch on mount by default (rely on cache-first strategy)
      refetchOnMount: false,
      
      // Enable network mode for better offline support
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations only for network/server errors
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const appError = classifyError(error);
        return appError.type === 'NETWORK' || appError.type === 'SERVER';
      },
      
      // Shorter retry delay for mutations
      retryDelay: 1000,
      
      // Enable offline mutations queue
      networkMode: 'offlineFirst',
    },
  },
});

// Set up global error handling in query cache
queryClient.getQueryCache().config = {
  ...queryClient.getQueryCache().config,
  onError: handleQueryError,
  
  // Persist successful query results to IndexedDB (L2 cache)
  onSuccess: (data, query) => {
    // Only persist posts data
    if (query.queryKey[0] === 'posts' && Array.isArray(data)) {
      cachePosts(data as Post[]).catch(() => {
      });
    }
  },
};

queryClient.getMutationCache().config = {
  ...queryClient.getMutationCache().config,
  onError: handleQueryError,
};

/**
 * Cache statistics are tracked internally
 * Use getCacheStats() to retrieve statistics when needed
 */
