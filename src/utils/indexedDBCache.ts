/**
 * IndexedDB Cache Layer (L2 Cache)
 * 
 * Persistent client-side storage for posts, users, and media.
 * Provides offline support and reduces server load.
 * 
 * System Design Concepts:
 * - Multi-layer Caching: L2 layer between memory (React Query) and network
 * - TTL Strategy: 7-day expiration for cached data
 * - Normalized Storage: Separate stores for posts, users, media
 * - LRU Eviction: Automatic cleanup when storage limits reached
 * - Atomic Transactions: Ensure data consistency
 * - Index Optimization: Fast queries by date, author, etc.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Post, User, Comment } from '../types';

// ============================================================================
// Database Schema
// ============================================================================

interface NewsFeedDB extends DBSchema {
  posts: {
    key: string;
    value: CachedPost;
    indexes: {
      'by-date': string;
      'by-author': string;
      'by-cached-date': number;
    };
  };
  users: {
    key: string;
    value: CachedUser;
    indexes: {
      'by-cached-date': number;
    };
  };
  comments: {
    key: string;
    value: CachedComment;
    indexes: {
      'by-post': string;
      'by-cached-date': number;
    };
  };
  metadata: {
    key: string;
    value: CacheMetadata;
  };
}

interface CachedPost extends Post {
  cachedAt: number;
  expiresAt: number;
}

interface CachedUser extends User {
  cachedAt: number;
  expiresAt: number;
}

interface CachedComment extends Comment {
  cachedAt: number;
  expiresAt: number;
}

interface CacheMetadata {
  key: string;
  totalSize: number;
  lastCleanup: number;
  hitCount: number;
  missCount: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DB_NAME = 'newsfeed-cache';
const DB_VERSION = 1;
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Database Initialization
// ============================================================================

let dbInstance: IDBPDatabase<NewsFeedDB> | null = null;

/**
 * Initialize IndexedDB with schema
 */
async function getDB(): Promise<IDBPDatabase<NewsFeedDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<NewsFeedDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Posts store
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', { keyPath: 'id' });
        postStore.createIndex('by-date', 'createdAt');
        postStore.createIndex('by-author', 'author.id');
        postStore.createIndex('by-cached-date', 'cachedAt');
      }

      // Users store
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-cached-date', 'cachedAt');
      }

      // Comments store
      if (!db.objectStoreNames.contains('comments')) {
        const commentStore = db.createObjectStore('comments', { keyPath: 'id' });
        commentStore.createIndex('by-post', 'postId');
        commentStore.createIndex('by-cached-date', 'cachedAt');
      }

      // Metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
  });

  // Initialize metadata if not exists
  const metadata = await dbInstance.get('metadata', 'cache-stats');
  if (!metadata) {
    await dbInstance.put('metadata', {
      key: 'cache-stats',
      totalSize: 0,
      lastCleanup: Date.now(),
      hitCount: 0,
      missCount: 0,
    });
  }

  // Schedule periodic cleanup
  scheduleCleanup();

  return dbInstance;
}

// ============================================================================
// Posts Cache Operations
// ============================================================================

/**
 * Cache posts in IndexedDB
 */
export async function cachePosts(posts: Post[], ttl = DEFAULT_TTL): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readwrite');
  const now = Date.now();

  await Promise.all(
    posts.map((post) =>
      tx.store.put({
        ...post,
        cachedAt: now,
        expiresAt: now + ttl,
      })
    )
  );

  await tx.done;
}

/**
 * Get posts from cache
 */
export async function getCachedPosts(limit = 20): Promise<Post[]> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readonly');
  const index = tx.store.index('by-date');
  const now = Date.now();

  // Get all posts sorted by date
  const allPosts = await index.getAll();

  // Filter expired and limit
  const validPosts = allPosts
    .filter((post) => post.expiresAt > now)
    .slice(0, limit)
    .map(removeCacheMetadata);

  await tx.done;

  // Update cache stats
  await updateCacheStats(validPosts.length > 0);

  return validPosts;
}

/**
 * Get single post from cache
 */
export async function getCachedPost(postId: string): Promise<Post | null> {
  const db = await getDB();
  const post = await db.get('posts', postId);

  if (!post || post.expiresAt < Date.now()) {
    await updateCacheStats(false);
    return null;
  }

  await updateCacheStats(true);
  return removeCacheMetadata(post);
}

/**
 * Get posts by author
 */
export async function getCachedPostsByAuthor(
  authorId: string,
  limit = 10
): Promise<Post[]> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readonly');
  const index = tx.store.index('by-author');
  const now = Date.now();

  const posts = await index.getAll(authorId);

  const validPosts = posts
    .filter((post) => post.expiresAt > now)
    .slice(0, limit)
    .map(removeCacheMetadata);

  await tx.done;
  await updateCacheStats(validPosts.length > 0);

  return validPosts;
}

/**
 * Delete specific post from cache
 */
export async function deleteCachedPost(postId: string): Promise<void> {
  const db = await getDB();
  await db.delete('posts', postId);
}

// ============================================================================
// Users Cache Operations
// ============================================================================

/**
 * Cache users in IndexedDB
 */
export async function cacheUsers(users: User[], ttl = DEFAULT_TTL): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('users', 'readwrite');
  const now = Date.now();

  await Promise.all(
    users.map((user) =>
      tx.store.put({
        ...user,
        cachedAt: now,
        expiresAt: now + ttl,
      })
    )
  );

  await tx.done;
}

/**
 * Get user from cache
 */
export async function getCachedUser(userId: string): Promise<User | null> {
  const db = await getDB();
  const user = await db.get('users', userId);

  if (!user || user.expiresAt < Date.now()) {
    await updateCacheStats(false);
    return null;
  }

  await updateCacheStats(true);
  return removeCacheMetadata(user);
}

// ============================================================================
// Comments Cache Operations
// ============================================================================

/**
 * Cache comments in IndexedDB
 */
export async function cacheComments(comments: Comment[], ttl = DEFAULT_TTL): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('comments', 'readwrite');
  const now = Date.now();

  await Promise.all(
    comments.map((comment) =>
      tx.store.put({
        ...comment,
        cachedAt: now,
        expiresAt: now + ttl,
      })
    )
  );

  await tx.done;
}

/**
 * Get comments for a post
 */
export async function getCachedComments(postId: string): Promise<Comment[]> {
  const db = await getDB();
  const tx = db.transaction('comments', 'readonly');
  const index = tx.store.index('by-post');
  const now = Date.now();

  const comments = await index.getAll(postId);

  const validComments = comments
    .filter((comment) => comment.expiresAt > now)
    .map(removeCacheMetadata);

  await tx.done;
  await updateCacheStats(validComments.length > 0);

  return validComments;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Update cache statistics
 */
async function updateCacheStats(isHit: boolean): Promise<void> {
  const db = await getDB();
  const metadata = await db.get('metadata', 'cache-stats');

  if (metadata) {
    await db.put('metadata', {
      ...metadata,
      hitCount: metadata.hitCount + (isHit ? 1 : 0),
      missCount: metadata.missCount + (isHit ? 0 : 1),
    });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheMetadata> {
  const db = await getDB();
  const metadata = await db.get('metadata', 'cache-stats');

  return (
    metadata || {
      key: 'cache-stats',
      totalSize: 0,
      lastCleanup: Date.now(),
      hitCount: 0,
      missCount: 0,
    }
  );
}

/**
 * Calculate cache hit rate
 */
export async function getCacheHitRate(): Promise<number> {
  const stats = await getCacheStats();
  const total = stats.hitCount + stats.missCount;
  return total > 0 ? stats.hitCount / total : 0;
}

/**
 * Get estimated cache size
 */
export async function getCacheSize(): Promise<number> {
  const db = await getDB();

  let totalSize = 0;

  // Estimate posts size
  const posts = await db.getAll('posts');
  totalSize += posts.length * 5000; // ~5KB per post estimate

  // Estimate users size
  const users = await db.getAll('users');
  totalSize += users.length * 1000; // ~1KB per user estimate

  // Estimate comments size
  const comments = await db.getAll('comments');
  totalSize += comments.length * 500; // ~500B per comment estimate

  return totalSize;
}

/**
 * Clear expired items from cache
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await getDB();
  const now = Date.now();
  let deletedCount = 0;

  // Clear expired posts
  const postsTx = db.transaction('posts', 'readwrite');
  const postsIndex = postsTx.store.index('by-cached-date');
  const posts = await postsIndex.getAll();

  for (const post of posts) {
    if (post.expiresAt < now) {
      await postsTx.store.delete(post.id);
      deletedCount++;
    }
  }
  await postsTx.done;

  // Clear expired users
  const usersTx = db.transaction('users', 'readwrite');
  const usersIndex = usersTx.store.index('by-cached-date');
  const users = await usersIndex.getAll();

  for (const user of users) {
    if (user.expiresAt < now) {
      await usersTx.store.delete(user.id);
      deletedCount++;
    }
  }
  await usersTx.done;

  // Clear expired comments
  const commentsTx = db.transaction('comments', 'readwrite');
  const commentsIndex = commentsTx.store.index('by-cached-date');
  const comments = await commentsIndex.getAll();

  for (const comment of comments) {
    if (comment.expiresAt < now) {
      await commentsTx.store.delete(comment.id);
      deletedCount++;
    }
  }
  await commentsTx.done;

  // Update metadata
  const metadata = await db.get('metadata', 'cache-stats');
  if (metadata) {
    await db.put('metadata', {
      ...metadata,
      lastCleanup: now,
    });
  }

  return deletedCount;
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  const db = await getDB();

  await db.clear('posts');
  await db.clear('users');
  await db.clear('comments');

  // Reset metadata
  await db.put('metadata', {
    key: 'cache-stats',
    totalSize: 0,
    lastCleanup: Date.now(),
    hitCount: 0,
    missCount: 0,
  });
}

/**
 * Evict oldest cache entries when size limit reached
 */
export async function evictOldestEntries(targetSize = MAX_CACHE_SIZE * 0.8): Promise<void> {
  const currentSize = await getCacheSize();

  if (currentSize <= targetSize) return;

  const db = await getDB();

  // Get all items sorted by cache date
  const postsTx = db.transaction('posts', 'readwrite');
  const postsIndex = postsTx.store.index('by-cached-date');
  const posts = await postsIndex.getAll();

  // Delete oldest posts until under target
  let deletedSize = 0;
  for (const post of posts) {
    if (currentSize - deletedSize <= targetSize) break;
    await postsTx.store.delete(post.id);
    deletedSize += 5000; // Estimated post size
  }
  await postsTx.done;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Remove cache metadata from cached items
 */
function removeCacheMetadata<T extends { cachedAt?: number; expiresAt?: number }>(
  item: T
): Omit<T, 'cachedAt' | 'expiresAt'> {
  const { cachedAt, expiresAt, ...cleanItem } = item;
  return cleanItem;
}

/**
 * Schedule periodic cache cleanup
 */
function scheduleCleanup(): void {
  setInterval(async () => {
    await clearExpiredCache();

    // Evict if over size limit
    const size = await getCacheSize();
    if (size > MAX_CACHE_SIZE) {
      await evictOldestEntries();
    }
  }, CLEANUP_INTERVAL);
}

// ============================================================================
// Export All
// ============================================================================

export {
  getDB,
  DEFAULT_TTL,
  MAX_CACHE_SIZE,
};
