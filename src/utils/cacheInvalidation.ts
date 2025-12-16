/**
 * Cache Invalidation Utilities
 * 
 * Provides intelligent cache invalidation strategies for keeping
 * multi-layer cache (L1/L2/L3) synchronized with server state.
 * 
 * System Design Concepts:
 * - Time-based invalidation (TTL)
 * - Event-based invalidation (mutations)
 * - Dependency tracking (related entities)
 * - Partial invalidation (specific keys)
 * - Cascade invalidation (related caches)
 * 
 * Cache Layers Affected:
 * - L1: React Query (Memory) - Invalidated via queryClient
 * - L2: IndexedDB (Persistent) - Invalidated via cache functions
 * - L3: Service Worker (Static) - Not invalidated (static assets)
 */

import { QueryClient } from '@tanstack/react-query';
import {
  deleteCachedPost,
  clearExpiredCache,
  getCacheStats,
} from './indexedDBCache';

// ============================================================================
// Cache Invalidation Strategies
// ============================================================================

/**
 * Invalidate all post-related caches
 * 
 * Use when:
 * - User creates a new post
 * - User deletes a post
 * - Feed needs complete refresh
 */
export async function invalidatePostCaches(
  queryClient: QueryClient,
  options?: {
    postId?: string; // Specific post to invalidate
    authorId?: string; // Invalidate posts by specific author
  }
): Promise<void> {

  // L1: Invalidate React Query caches
  await Promise.all([
    // Invalidate feed queries (all pages) - using consistent key structure
    queryClient.invalidateQueries({
      queryKey: ['feed', 'infinite'],
    }),

    // Invalidate search results
    queryClient.invalidateQueries({
      queryKey: ['search'],
    }),

    // If specific post, invalidate that post query
    options?.postId &&
      queryClient.invalidateQueries({
        queryKey: ['post', options.postId],
      }),

    // If specific author, invalidate their posts
    options?.authorId &&
      queryClient.invalidateQueries({
        queryKey: ['posts', 'author', options.authorId],
      }),
  ]);

  // L2: Invalidate IndexedDB cache if specific post
  if (options?.postId) {
    await deleteCachedPost(options.postId);
  }

}

/**
 * Invalidate user-related caches
 * 
 * Use when:
 * - User updates profile
 * - User authentication changes
 */
export async function invalidateUserCaches(
  queryClient: QueryClient,
  userId: string
): Promise<void> {

  // L1: Invalidate React Query caches
  await Promise.all([
    // Invalidate specific user
    queryClient.invalidateQueries({
      queryKey: ['user', userId],
    }),

    // Invalidate user's posts
    queryClient.invalidateQueries({
      queryKey: ['posts', 'author', userId],
    }),

    // Invalidate user's profile
    queryClient.invalidateQueries({
      queryKey: ['profile', userId],
    }),
  ]);

  // L2: User cache will auto-expire based on TTL
  // No need to manually delete as it will refetch on next access

}

/**
 * Invalidate comment-related caches
 * 
 * Use when:
 * - User adds/deletes a comment
 * - Comment count changes
 */
export async function invalidateCommentCaches(
  queryClient: QueryClient,
  postId: string
): Promise<void> {

  // L1: Invalidate React Query caches
  await Promise.all([
    // Invalidate comments for this post
    queryClient.invalidateQueries({
      queryKey: ['comments', postId],
    }),

    // Invalidate the post itself (comment count might have changed)
    queryClient.invalidateQueries({
      queryKey: ['post', postId],
    }),

    // Invalidate feed (post with updated comment count) - using consistent key structure
    queryClient.invalidateQueries({
      queryKey: ['feed', 'infinite'],
    }),
  ]);

  // L2: Comments cache will auto-refresh on next fetch

}

/**
 * Invalidate like-related caches
 * 
 * Use when:
 * - User likes/unlikes a post
 * - Like count changes
 */
export async function invalidateLikeCaches(
  queryClient: QueryClient,
  postId: string
): Promise<void> {

  // L1: Invalidate React Query caches
  await Promise.all([
    // Invalidate specific post (like count/status changed)
    queryClient.invalidateQueries({
      queryKey: ['post', postId],
    }),

    // Invalidate feed (post with updated like count) - using consistent key structure
    queryClient.invalidateQueries({
      queryKey: ['feed', 'infinite'],
    }),
  ]);

  // L2: Post cache will auto-refresh on next fetch

}

/**
 * Clear expired caches across all layers
 * 
 * Use when:
 * - App initialization
 * - Periodic cleanup (e.g., every hour)
 * - User manually clears cache
 */
export async function clearExpiredCaches(
  _queryClient: QueryClient
): Promise<void> {

  // L1: React Query handles this automatically via gcTime
  // No action needed

  // L2: Clear expired IndexedDB entries
  await clearExpiredCache();

  // Get stats after cleanup
  await getCacheStats();
}

/**
 * Invalidate all caches (nuclear option)
 * 
 * Use when:
 * - User logs out
 * - Critical data corruption detected
 * - Manual cache reset requested
 */
export async function invalidateAllCaches(
  queryClient: QueryClient
): Promise<void> {

  // L1: Clear React Query cache
  queryClient.clear();

  // L2: Clear IndexedDB cache
  const { clearAllCache } = await import('./indexedDBCache');
  await clearAllCache();

  // L3: Clear Service Worker caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }

}

// ============================================================================
// Smart Invalidation Helpers
// ============================================================================

/**
 * Invalidate caches based on mutation type
 * 
 * Automatically determines which caches to invalidate based on
 * the mutation that was performed.
 */
export async function invalidateCachesForMutation(
  queryClient: QueryClient,
  mutation: {
    type: 'CREATE_POST' | 'UPDATE_POST' | 'DELETE_POST' | 'LIKE_POST' | 'UNLIKE_POST' | 'CREATE_COMMENT' | 'DELETE_COMMENT' | 'UPDATE_USER';
    postId?: string;
    userId?: string;
    authorId?: string;
  }
): Promise<void> {

  switch (mutation.type) {
    case 'CREATE_POST':
    case 'UPDATE_POST':
    case 'DELETE_POST':
      await invalidatePostCaches(queryClient, {
        postId: mutation.postId,
        authorId: mutation.authorId,
      });
      break;

    case 'LIKE_POST':
    case 'UNLIKE_POST':
      if (mutation.postId) {
        await invalidateLikeCaches(queryClient, mutation.postId);
      }
      break;

    case 'CREATE_COMMENT':
    case 'DELETE_COMMENT':
      if (mutation.postId) {
        await invalidateCommentCaches(queryClient, mutation.postId);
      }
      break;

    case 'UPDATE_USER':
      if (mutation.userId) {
        await invalidateUserCaches(queryClient, mutation.userId);
      }
      break;

    default:
  }
}

/**
 * Optimistic update helper
 * 
 * Updates cache immediately for better UX, then reconciles with server.
 * Automatically rolls back if mutation fails.
 */
export function createOptimisticUpdate<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return {
    // Before mutation runs
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData<TData>(queryKey, (old) =>
        updateFn(old, variables)
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },

    // If mutation fails, roll back
    onError: (
      _error: unknown,
      _variables: TVariables,
      context?: { previousData?: TData }
    ) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Schedule periodic cache cleanup
 * 
 * Runs cleanup every hour to remove expired entries and free up space.
 */
export function schedulePeriodicCleanup(queryClient: QueryClient): () => void {

  const intervalId = setInterval(
    async () => {
      await clearExpiredCaches(queryClient);
    },
    60 * 60 * 1000 // 1 hour
  );

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Track cache dependencies
 * 
 * Maintains a map of which caches depend on each other.
 * When one cache is invalidated, cascade to dependent caches.
 */
const cacheDependencies: Map<string, Set<string>> = new Map([
  // When post changes, these also need to invalidate
  // Note: Using base keys - React Query will match all variants (e.g., ['feed', 'infinite'])
  ['post', new Set(['feed', 'search'])],
  
  // When user changes, these also need to invalidate
  ['user', new Set(['feed', 'post'])],
  
  // When comment changes, these also need to invalidate
  ['comment', new Set(['post', 'feed'])],
]);

/**
 * Cascade invalidation to dependent caches
 */
export async function cascadeInvalidation(
  queryClient: QueryClient,
  cacheType: string,
  id?: string
): Promise<void> {

  const queryKey = id ? [cacheType, id] : [cacheType];

  // Invalidate primary cache
  await queryClient.invalidateQueries({ queryKey });

  // Invalidate dependent caches
  const dependents = cacheDependencies.get(cacheType);
  if (dependents) {
    for (const dependent of dependents) {
      await queryClient.invalidateQueries({ queryKey: [dependent] });
    }
  }
}
