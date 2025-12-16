/**
 * Custom Hook: useFeedPosts
 * 
 * Fetches posts from the feed API using React Query.
 * Provides loading, error, and data states with automatic caching.
 * 
 * Features:
 * - Automatic caching (5 min stale time)
 * - Smart retry logic with exponential backoff
 * - Error handling with classification
 * - Loading states
 * - Type-safe responses
 * 
 * Retry Strategy:
 * - Network/timeout errors: 3 retries with exponential backoff
 * - Server errors (5xx): 2 retries with backoff
 * - Client errors (4xx): No retries
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, error, refetch } = useFeedPosts();
 * // Use refetch() for manual retry
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import type { FeedResponse } from '../types';
import { classifyError } from '../utils/errorHandling';

interface UseFeedPostsOptions {
  limit?: number;
  enabled?: boolean;
}

export function useFeedPosts(options: UseFeedPostsOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useQuery<FeedResponse, Error>({
    queryKey: ['feed', { limit }],
    queryFn: () => feedApi.getFeed(undefined, limit),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    
    // Smart retry configuration
    retry: (failureCount, error) => {
      const appError = classifyError(error);
      
      // Don't retry client errors (4xx)
      if (appError.type === 'VALIDATION' || 
          appError.type === 'AUTHENTICATION' || 
          appError.type === 'AUTHORIZATION' ||
          appError.type === 'NOT_FOUND') {
        return false;
      }
      
      // Retry network/timeout errors up to 3 times
      if (appError.type === 'NETWORK' || appError.type === 'TIMEOUT') {
        return failureCount < 3;
      }
      
      // Retry server errors up to 2 times
      if (appError.type === 'SERVER') {
        return failureCount < 2;
      }
      
      // Default: 1 retry
      return failureCount < 1;
    },
    
    // Exponential backoff with jitter
    retryDelay: (attemptIndex) => {
      // Base delay: 1s, 2s, 4s, 8s...
      const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
      // Add jitter: ±25% randomness to prevent thundering herd
      const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
      return baseDelay + jitter;
    },
  });
}
