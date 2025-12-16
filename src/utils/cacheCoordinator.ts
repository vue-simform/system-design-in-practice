/**
 * Cache Hierarchy Coordinator
 * 
 * Manages multi-layer caching strategy:
 * L1 (Memory Cache - React Query) → L2 (IndexedDB) → L3 (Network)
 * 
 * System Design Concepts:
 * - Cache Hierarchy: Multiple cache layers with fallback
 * - Stale-While-Revalidate: Serve cached data while fetching fresh data
 * - Cache-First Strategy: Check cache before network
 * - Network-First Strategy: Prioritize fresh data for critical operations
 * - Performance Monitoring: Track cache hits, misses, latencies
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCachedPosts,
  getCachedPost,
  getCachedUser,
  getCachedComments,
  cachePosts,
  cacheUsers,
  cacheComments,
  getCacheStats,
  getCacheHitRate,
} from './indexedDBCache';
import type { Post, User, Comment, FeedResponse } from '../types';

// ============================================================================
// Cache Strategy Types
// ============================================================================

export type CacheStrategy =
  | 'cache-first' // Check cache first, fallback to network
  | 'network-first' // Check network first, fallback to cache
  | 'cache-only' // Only use cache, no network
  | 'network-only' // Only use network, no cache
  | 'stale-while-revalidate'; // Use cache immediately, update in background

interface CacheOptions {
  strategy?: CacheStrategy;
  ttl?: number;
  forceRefresh?: boolean;
}

interface CacheResult<T> {
  data: T | null;
  source: 'memory' | 'indexeddb' | 'network';
  timestamp: number;
  fromCache: boolean;
}

// ============================================================================
// Cache Coordinator
// ============================================================================

/**
 * Fetch posts with cache hierarchy
 */
export async function fetchPostsWithCache(
  fetchFn: () => Promise<FeedResponse>,
  options: CacheOptions = {}
): Promise<CacheResult<Post[]>> {
  const { strategy = 'cache-first', ttl } = options;

  try {
    // L1: Check React Query cache (handled by React Query automatically)

    // Strategy-based execution
    switch (strategy) {
      case 'cache-first':
        return await cacheFirstStrategy(fetchFn, ttl);

      case 'network-first':
        return await networkFirstStrategy(fetchFn, ttl);

      case 'cache-only':
        return await cacheOnlyStrategy();

      case 'network-only':
        return await networkOnlyStrategy(fetchFn, ttl);

      case 'stale-while-revalidate':
        return await staleWhileRevalidateStrategy(fetchFn, ttl);

      default:
        return await cacheFirstStrategy(fetchFn, ttl);
    }
  } finally {
    // Performance tracking available if needed
    // const startTime = performance.now();
    // const duration = performance.now() - startTime;
  }
}

// ============================================================================
// Cache Strategies
// ============================================================================

/**
 * Cache-First Strategy: L2 (IndexedDB) → L3 (Network)
 */
async function cacheFirstStrategy(
  fetchFn: () => Promise<FeedResponse>,
  ttl?: number
): Promise<CacheResult<Post[]>> {
  // Try L2: IndexedDB
  const cachedPosts = await getCachedPosts();

  if (cachedPosts.length > 0) {
    return {
      data: cachedPosts,
      source: 'indexeddb',
      timestamp: Date.now(),
      fromCache: true,
    };
  }

  // L3: Network
  const response = await fetchFn();
  const posts = response.posts;

  // Cache in L2
  await cachePosts(posts, ttl);

  return {
    data: posts,
    source: 'network',
    timestamp: Date.now(),
    fromCache: false,
  };
}

/**
 * Network-First Strategy: L3 (Network) → L2 (IndexedDB)
 */
async function networkFirstStrategy(
  fetchFn: () => Promise<FeedResponse>,
  ttl?: number
): Promise<CacheResult<Post[]>> {
  try {
    // Try L3: Network first
    const response = await fetchFn();
    const posts = response.posts;

    // Update L2 cache
    await cachePosts(posts, ttl);

    return {
      data: posts,
      source: 'network',
      timestamp: Date.now(),
      fromCache: false,
    };
  } catch (error) {
    // Fallback to L2: IndexedDB
    const cachedPosts = await getCachedPosts();

    return {
      data: cachedPosts,
      source: 'indexeddb',
      timestamp: Date.now(),
      fromCache: true,
    };
  }
}

/**
 * Cache-Only Strategy: Only L2 (IndexedDB)
 */
async function cacheOnlyStrategy(): Promise<CacheResult<Post[]>> {
  const cachedPosts = await getCachedPosts();

  return {
    data: cachedPosts,
    source: 'indexeddb',
    timestamp: Date.now(),
    fromCache: true,
  };
}

/**
 * Network-Only Strategy: Only L3 (Network)
 */
async function networkOnlyStrategy(
  fetchFn: () => Promise<FeedResponse>,
  ttl?: number
): Promise<CacheResult<Post[]>> {
  const response = await fetchFn();
  const posts = response.posts;

  // Still cache for future use
  await cachePosts(posts, ttl);

  return {
    data: posts,
    source: 'network',
    timestamp: Date.now(),
    fromCache: false,
  };
}

/**
 * Stale-While-Revalidate: Serve cached, fetch fresh in background
 */
async function staleWhileRevalidateStrategy(
  fetchFn: () => Promise<FeedResponse>,
  ttl?: number
): Promise<CacheResult<Post[]>> {
  // Return cached data immediately
  const cachedPosts = await getCachedPosts();

  // Fetch fresh data in background (don't await)
  fetchFn()
    .then((response) => {
      cachePosts(response.posts, ttl);
    })
    .catch(() => {
    });

  return {
    data: cachedPosts,
    source: 'indexeddb',
    timestamp: Date.now(),
    fromCache: true,
  };
}

// ============================================================================
// React Query Integration
// ============================================================================

/**
 * Custom hook with integrated cache hierarchy
 */
export function useCachedPosts(
  fetchFn: () => Promise<FeedResponse>,
  options: CacheOptions = {}
) {
  return useQuery({
    queryKey: ['posts', 'cached'],
    queryFn: async () => {
      const result = await fetchPostsWithCache(fetchFn, options);
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook for single post with cache
 */
export function useCachedPost(postId: string, fetchFn: () => Promise<Post>) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      // Try L2: IndexedDB
      const cached = await getCachedPost(postId);
      if (cached) {
        return cached;
      }

      // L3: Network
      const post = await fetchFn();

      // Cache in L2
      await cachePosts([post]);

      return post;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for user with cache
 */
export function useCachedUser(userId: string, fetchFn: () => Promise<User>) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      // Try L2: IndexedDB
      const cached = await getCachedUser(userId);
      if (cached) {
        return cached;
      }

      // L3: Network
      const user = await fetchFn();

      // Cache in L2
      await cacheUsers([user]);

      return user;
    },
    staleTime: 10 * 60 * 1000, // Users change less frequently
  });
}

/**
 * Hook for comments with cache
 */
export function useCachedComments(postId: string, fetchFn: () => Promise<Comment[]>) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      // Try L2: IndexedDB
      const cached = await getCachedComments(postId);
      if (cached.length > 0) {
        return cached;
      }

      // L3: Network
      const comments = await fetchFn();

      // Cache in L2
      await cacheComments(comments);

      return comments;
    },
    staleTime: 3 * 60 * 1000, // Comments change more frequently
  });
}

// ============================================================================
// Cache Warming & Prefetching
// ============================================================================

/**
 * Warm cache with initial data
 */
export async function warmCache(initialPosts: Post[]): Promise<void> {

  // Extract users from posts
  const users = initialPosts.map((post) => post.author).filter((author): author is User => author !== undefined);

  // Cache everything
  await Promise.all([cachePosts(initialPosts), cacheUsers(users)]);

}

/**
 * Prefetch related data
 */
export async function prefetchRelatedData(post: Post): Promise<void> {
  // Check if author exists
  if (!post.author) return;

  const queryClient = useQueryClient();

  // Prefetch author profile
  queryClient.prefetchQuery({
    queryKey: ['user', post.author.id],
    queryFn: async () => {
      const cached = await getCachedUser(post.author!.id);
      if (cached) return cached;

      // Would fetch from network in real app
      return post.author;
    },
  });

  // Prefetch comments
  if (post.commentCount > 0) {
    queryClient.prefetchQuery({
      queryKey: ['comments', post.id],
      queryFn: async () => {
        return await getCachedComments(post.id);
      },
    });
  }
}

// ============================================================================
// Cache Metrics & Monitoring
// ============================================================================

/**
 * Hook to monitor cache performance
 */
export function useCacheMetrics() {
  return useQuery({
    queryKey: ['cache-metrics'],
    queryFn: async () => {
      const stats = await getCacheStats();
      const hitRate = await getCacheHitRate();

      return {
        ...stats,
        hitRate,
        hitRatePercentage: (hitRate * 100).toFixed(2),
      };
    },
    refetchInterval: 60000, // Update every minute
  });
}

/**
 * Get cache performance summary
 */
export async function getCachePerformanceSummary() {
  const stats = await getCacheStats();
  const hitRate = await getCacheHitRate();

  return {
    totalRequests: stats.hitCount + stats.missCount,
    hits: stats.hitCount,
    misses: stats.missCount,
    hitRate: hitRate,
    hitRatePercentage: `${(hitRate * 100).toFixed(2)}%`,
    lastCleanup: new Date(stats.lastCleanup).toLocaleString(),
  };
}

// ============================================================================
// Cache Control
// ============================================================================

/**
 * Force refresh all cached data
 */
export async function forceRefreshCache(fetchFn: () => Promise<FeedResponse>): Promise<void> {

  const response = await fetchFn();

  await cachePosts(response.posts);

}

/**
 * Invalidate specific cache entries
 */
export function invalidateCache(queryClient: ReturnType<typeof useQueryClient>, keys: string[]) {
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}
