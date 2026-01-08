# System Design in Action: Building a Production-Ready News Feed

## Part 3: Three-Layer Caching System

> **Deep dive into multi-tier caching architecture: Memory, IndexedDB, and Service Worker**

---

## Table of Contents (Part 3)

9. [Caching Architecture Overview](#caching-architecture)
10. [Layer 1: React Query (Memory Cache)](#layer-1-memory)
11. [Layer 2: IndexedDB (Persistent Cache)](#layer-2-indexeddb)
12. [Layer 3: Service Worker (Static Cache)](#layer-3-service-worker)
13. [Cache Coordination & Strategies](#cache-coordination)

---

## Caching Architecture Overview {#caching-architecture}

### The Problem: Network is the Bottleneck

**Reality of network requests:**
```
Memory access:     1 nanosecond   (baseline)
SSD access:        100 microseconds (100,000x slower)
Network request:   50 milliseconds   (50,000,000x slower!)
```

**User expectations:**
- < 100ms = Feels instant
- 100-300ms = Slight delay (acceptable)
- 300-1000ms = Noticeable lag
- > 1000ms = User loses focus

**Without caching:**
```
Every action → Network request (500ms+) → User waits → Poor UX
```

**With caching:**
```
First time:  Network request (500ms) → Cache → Show data
Next time:   Cache hit (<1ms) → Show instantly → Background refresh
```

### Three-Layer Strategy

```
┌────────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW                                │
└────────────────────────────────────────────────────────────────┘

User requests posts
        ↓
┌───────────────────────────────────────────┐
│ L1: Memory Cache (React Query)            │
│ Speed: < 1ms                               │
│ Lifetime: Until tab closed                 │
│ Size: ~10-50MB (browser limit)            │
│ Strategy: Stale-while-revalidate          │
└───────────────────────────────────────────┘
        ↓ MISS
┌───────────────────────────────────────────┐
│ L2: IndexedDB (Browser Storage)           │
│ Speed: 5-10ms                              │
│ Lifetime: 7 days                           │
│ Size: 50MB limit (configurable)           │
│ Strategy: Cache-first with expiration     │
└───────────────────────────────────────────┘
        ↓ MISS
┌───────────────────────────────────────────┐
│ L3: Service Worker (Network Layer)        │
│ Speed: 1-2ms (if cached)                   │
│ Lifetime: Until app update                │
│ Size: Unlimited (quota-managed)           │
│ Strategy: Network-first for API           │
└───────────────────────────────────────────┘
        ↓ MISS
┌───────────────────────────────────────────┐
│ Network Request                            │
│ Speed: 500ms average                       │
│ Updates all cache layers on success       │
└───────────────────────────────────────────┘
```

### Cache Hit Rates (Real Data)

**Scenario: User scrolls feed**
```
First visit today:
  L1 hit:  0%   (cold start)
  L2 hit:  0%   (no data yet)
  L3 hit:  100% (static assets only)
  Network: 100% (fetch posts)
  Time:    500ms

Return 30s later (same tab):
  L1 hit:  100% (fresh in memory)
  L2 hit:  0%   (L1 served)
  L3 hit:  0%   (L1 served)
  Network: 0%   (cached)
  Time:    <1ms

Return next day (new tab):
  L1 hit:  0%   (memory cleared)
  L2 hit:  95%  (most posts still valid)
  L3 hit:  5%   (some expired)
  Network: 5%   (only fresh data)
  Time:    10ms

Offline:
  L1 hit:  20%  (if tab still open)
  L2 hit:  75%  (valid cached data)
  L3 hit:  5%   (static assets)
  Network: 0%   (offline)
  Time:    5-10ms
  Result:  App works fully!
```

### Why Three Layers?

**Each layer solves different problems:**

**L1 (Memory):**
- ✅ Instant access
- ✅ No serialization overhead
- ✅ Automatic with React Query
- ❌ Lost on tab close
- ❌ Not shared between tabs
- **Use case:** Active session data

**L2 (IndexedDB):**
- ✅ Survives page refresh
- ✅ Shared between tabs
- ✅ Large storage (50MB+)
- ✅ Structured queries
- ❌ Async API (5-10ms)
- ❌ Requires management
- **Use case:** User-generated content

**L3 (Service Worker):**
- ✅ Intercepts network requests
- ✅ Works offline
- ✅ Version control
- ✅ Background sync
- ❌ Complex lifecycle
- ❌ Debugging harder
- **Use case:** Static assets, offline pages

### Cache Invalidation Strategy

> "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

**Our approach:**

**1. Time-Based (TTL):**
```typescript
Posts:     7 days    (IndexedDB) + 1 min (memory)
Users:     7 days    (IndexedDB) + 5 min (memory)
Comments:  7 days    (IndexedDB) + 30 sec (memory)
```

**2. Event-Based:**
```typescript
User likes post → Invalidate:
  - ['feed', 'infinite']
  - ['post', postId]
  - ['analytics']

User creates post → Invalidate:
  - ['feed', 'infinite']
  - ['userPosts', userId]
```

**3. Version-Based:**
```typescript
Service Worker version: 2.0.0
On new deploy → Clear old caches
```

---

## Layer 1: React Query (Memory Cache) {#layer-1-memory}

### How React Query Caches

**File:** [src/config/queryClient.ts](src/config/queryClient.ts)

```typescript
// React Query internal structure
{
  queries: {
    ['feed', 'infinite']: {
      data: { pages: [...], pageParams: [...] },
      dataUpdatedAt: 1704067200000,
      state: 'success',
      fetchStatus: 'idle',
    },
    ['post', 'p123']: {
      data: { id: 'p123', content: '...', ... },
      dataUpdatedAt: 1704067150000,
      state: 'success',
      fetchStatus: 'idle',
    },
  },

  mutations: {
    ['likePost']: {
      state: 'idle',
      variables: { postId: 'p123', isLiked: false },
    },
  },
}
```

### Cache States

```typescript
// Query states
type QueryState =
  | 'loading'    // Initial fetch
  | 'success'    // Data available
  | 'error';     // Fetch failed

type FetchStatus =
  | 'fetching'   // Currently fetching
  | 'paused'     // Paused (offline)
  | 'idle';      // Not fetching

// Data freshness
const isFresh = Date.now() - dataUpdatedAt < staleTime;
const isStale = Date.now() - dataUpdatedAt >= staleTime;
const isExpired = Date.now() - dataUpdatedAt >= gcTime;
```

### Stale-While-Revalidate Pattern

**The best caching strategy for dynamic data:**

```typescript
// User visits page
const { data, isLoading } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 60000, // Fresh for 1 minute
});

// Timeline:
// T=0s:    Fetch from network (isLoading: true)
// T=0.5s:  Data arrives, cache it
// T=30s:   User returns (data still fresh)
//          → Show cached data instantly (no fetch)
// T=90s:   User returns (data now stale)
//          → Show cached data instantly (stale)
//          → Fetch fresh data in background
//          → Update UI when fresh data arrives
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────┐
│ Time: 0s                                                     │
│ User requests data                                           │
│ Cache: EMPTY                                                 │
│ Action: Fetch from network                                   │
│ User sees: Loading spinner                                   │
└─────────────────────────────────────────────────────────────┘
                        ↓ (500ms)
┌─────────────────────────────────────────────────────────────┐
│ Time: 0.5s                                                   │
│ Data arrives                                                 │
│ Cache: FRESH (staleTime: 60s)                               │
│ User sees: Data displayed                                    │
└─────────────────────────────────────────────────────────────┘
                        ↓ (30s later)
┌─────────────────────────────────────────────────────────────┐
│ Time: 30s                                                    │
│ User returns to page                                         │
│ Cache: FRESH (30s old, < 60s staleTime)                     │
│ Action: Show cached data (no network)                        │
│ User sees: Instant data (<1ms)                              │
└─────────────────────────────────────────────────────────────┘
                        ↓ (60s later)
┌─────────────────────────────────────────────────────────────┐
│ Time: 90s                                                    │
│ User returns to page                                         │
│ Cache: STALE (90s old, > 60s staleTime)                     │
│ Action: Show cached data + refetch in background            │
│ User sees: Instant stale data + updates when fresh arrives  │
└─────────────────────────────────────────────────────────────┘
                        ↓ (10 minutes later)
┌─────────────────────────────────────────────────────────────┐
│ Time: 10 min                                                 │
│ Garbage collection runs                                      │
│ Cache: EXPIRED (> gcTime)                                    │
│ Action: Remove from memory                                   │
│ Next visit: Fresh fetch required                             │
└─────────────────────────────────────────────────────────────┘
```

### Optimistic Updates Deep Dive

**File:** [src/hooks/useOptimisticMutation.ts](src/hooks/useOptimisticMutation.ts)

```typescript
import { useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';

interface OptimisticMutationOptions<TData, TVariables> {
  mutationKey: string[];
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  onOptimistic: (oldData: any, variables: TVariables) => any;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables, context: any) => void;
}

export function useOptimisticMutation<TData, TVariables>({
  mutationKey,
  mutationFn,
  queryKey,
  onOptimistic,
  onSuccess,
  onError,
}: OptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey,
    mutationFn,

    // BEFORE network request (optimistic update)
    onMutate: async (variables: TVariables) => {
      // Cancel ongoing queries (prevent race conditions)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state (for rollback)
      const previousData = queryClient.getQueryData(queryKey);

      // Apply optimistic update
      queryClient.setQueryData(queryKey, (old: any) => {
        return onOptimistic(old, variables);
      });

      // Return context for rollback
      return { previousData };
    },

    // AFTER success
    onSuccess: (data, variables, context) => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey });

      // Call custom success handler
      onSuccess?.(data, variables);
    },

    // AFTER error (automatic rollback)
    onError: (error, variables, context) => {
      // Rollback to previous state
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }

      // Call custom error handler
      onError?.(error as Error, variables, context);
    },
  });
}
```

**Example: Like Post**
```typescript
const { mutate: likePost } = useOptimisticMutation({
  mutationKey: ['likePost'],
  queryKey: ['feed', 'infinite'],

  // Optimistic update (instant UI change)
  onOptimistic: (oldData, { postId }) => ({
    ...oldData,
    pages: oldData.pages.map(page => ({
      ...page,
      posts: page.posts.map(post =>
        post.id === postId
          ? { ...post, likeCount: post.likeCount + 1, isLiked: true }
          : post
      ),
    })),
  }),

  // Network call
  mutationFn: ({ postId, userId }) => feedApi.likePost(postId, userId),

  // Success: Keep changes, refetch for accuracy
  onSuccess: () => {
    toast.success('Post liked!');
  },

  // Error: Automatic rollback + error message
  onError: () => {
    toast.error('Failed to like post');
  },
});
```

### Cache Persistence to IndexedDB

**Automatic sync from memory to IndexedDB:**

```typescript
// File: src/config/queryClient.ts
queryClient.getQueryCache().config.onSuccess = (data, query) => {
  // Posts: Cache to IndexedDB
  if (query.queryKey[0] === 'feed' && query.queryKey[1] === 'infinite') {
    const pages = (data as InfiniteData<FeedResponse>).pages;
    const allPosts = pages.flatMap(page => page.posts);

    // Async write (fire and forget)
    cachePosts(allPosts, CACHE_CONFIG.posts.gcTime).catch(err => {
      console.warn('Failed to cache posts to IndexedDB:', err);
    });
  }

  // Users: Cache to IndexedDB
  if (query.queryKey[0] === 'user') {
    const user = data as User;
    cacheUser(user, CACHE_CONFIG.users.gcTime).catch(() => {});
  }

  // Comments: Cache to IndexedDB
  if (query.queryKey[0] === 'comments') {
    const comments = data as Comment[];
    cacheComments(comments, CACHE_CONFIG.comments.gcTime).catch(() => {});
  }
};
```

---

## Layer 2: IndexedDB (Persistent Cache) {#layer-2-indexeddb}

### Why IndexedDB?

**Comparison:**

| Storage | Size | Persistence | Performance | API | Use Case |
|---------|------|-------------|-------------|-----|----------|
| localStorage | 5-10MB | Permanent | Sync (slow) | Simple | Small config |
| sessionStorage | 5-10MB | Session only | Sync (slow) | Simple | Temporary |
| **IndexedDB** | **50MB-1GB** | **Permanent** | **Async (fast)** | **Complex** | **Large datasets** |
| Cache API | Quota-managed | Permanent | Async | Medium | HTTP responses |

**IndexedDB advantages:**
- ✅ Transactional (ACID)
- ✅ Indexed queries (fast lookups)
- ✅ Large storage (50MB default, more with permission)
- ✅ Async API (non-blocking)
- ✅ Structured data (objects, arrays)
- ✅ Works offline

### Database Schema

**File:** [src/utils/indexedDBCache.ts](src/utils/indexedDBCache.ts) (546 lines)

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema definition
interface NewsFeedDB extends DBSchema {
  // Posts store
  posts: {
    key: string; // Post ID
    value: CachedPost;
    indexes: {
      'by-date': string;        // Index on createdAt
      'by-author': string;      // Index on authorId
      'by-cached-date': number; // Index on cachedAt
    };
  };

  // Users store
  users: {
    key: string; // User ID
    value: CachedUser;
    indexes: {
      'by-cached-date': number;
    };
  };

  // Comments store
  comments: {
    key: string; // Comment ID
    value: CachedComment;
    indexes: {
      'by-post': string;        // Index on postId
      'by-cached-date': number;
    };
  };

  // Metadata store
  metadata: {
    key: string;
    value: CacheMetadata;
  };
}

// Enhanced types with cache metadata
interface CachedPost extends Post {
  cachedAt: number;   // When cached (timestamp)
  expiresAt: number;  // When expires (timestamp)
}

interface CacheMetadata {
  key: string;
  totalSize: number;     // Bytes
  lastCleanup: number;   // Timestamp
  hitCount: number;      // Cache hits
  missCount: number;     // Cache misses
}

// Constants
const DB_NAME = 'newsfeed-cache';
const DB_VERSION = 1;
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 50 * 1024 * 1024;     // 50MB
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
```

### Database Initialization

```typescript
let dbPromise: Promise<IDBPDatabase<NewsFeedDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<NewsFeedDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NewsFeedDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create posts store with indexes
        if (!db.objectStoreNames.contains('posts')) {
          const postsStore = db.createObjectStore('posts', { keyPath: 'id' });
          postsStore.createIndex('by-date', 'createdAt');
          postsStore.createIndex('by-author', 'authorId');
          postsStore.createIndex('by-cached-date', 'cachedAt');
        }

        // Create users store
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('by-cached-date', 'cachedAt');
        }

        // Create comments store
        if (!db.objectStoreNames.contains('comments')) {
          const commentsStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentsStore.createIndex('by-post', 'postId');
          commentsStore.createIndex('by-cached-date', 'cachedAt');
        }

        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
}
```

### CRUD Operations

**Create/Update (Put):**
```typescript
export async function cachePosts(posts: Post[], ttl = DEFAULT_TTL): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readwrite');
  const now = Date.now();

  // Batch write for performance
  await Promise.all(
    posts.map((post) => {
      const cachedPost: CachedPost = {
        ...post,
        cachedAt: now,
        expiresAt: now + ttl,
      };
      return tx.store.put(cachedPost);
    })
  );

  await tx.done;

  // Check cache size and evict if needed
  const size = await getCacheSize();
  if (size > MAX_CACHE_SIZE) {
    await evictOldestEntries();
  }

  // Update metadata
  await incrementHitCount('posts-write', posts.length);
}
```

**Read:**
```typescript
export async function getCachedPosts(limit = 20): Promise<Post[]> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readonly');
  const index = tx.store.index('by-date');
  const now = Date.now();

  // Get all posts, sorted by date
  const allPosts = await index.getAll();

  // Filter out expired, limit results
  const validPosts = allPosts
    .filter((post) => post.expiresAt > now)
    .slice(0, limit)
    .map(removeCacheMetadata); // Remove cachedAt, expiresAt

  // Update stats
  if (validPosts.length > 0) {
    await incrementHitCount('posts-read', validPosts.length);
  } else {
    await incrementMissCount('posts-read');
  }

  return validPosts;
}
```

**Query by Index:**
```typescript
export async function getCachedPostsByAuthor(authorId: string): Promise<Post[]> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readonly');
  const index = tx.store.index('by-author');
  const now = Date.now();

  // Use index for fast lookup
  const posts = await index.getAll(authorId);

  return posts
    .filter((post) => post.expiresAt > now)
    .map(removeCacheMetadata);
}
```

**Delete:**
```typescript
export async function deleteCachedPost(postId: string): Promise<void> {
  const db = await getDB();
  await db.delete('posts', postId);
}

export async function clearAllPosts(): Promise<void> {
  const db = await getDB();
  await db.clear('posts');
}
```

### Cache Eviction (LRU)

**Least Recently Used eviction when cache is full:**

```typescript
export async function evictOldestEntries(
  targetSize = MAX_CACHE_SIZE * 0.8 // Keep 80% after eviction
): Promise<number> {
  const db = await getDB();
  const currentSize = await getCacheSize();

  if (currentSize <= targetSize) {
    return 0; // No eviction needed
  }

  let deletedCount = 0;
  let deletedSize = 0;

  // Evict from posts (largest store)
  const postsTx = db.transaction('posts', 'readwrite');
  const postsIndex = postsTx.store.index('by-cached-date');
  const posts = await postsIndex.getAll(); // Oldest first

  for (const post of posts) {
    if (currentSize - deletedSize <= targetSize) {
      break; // Target reached
    }

    await postsTx.store.delete(post.id);
    deletedSize += estimatePostSize(post);
    deletedCount++;
  }

  await postsTx.done;

  console.log(`[Cache] Evicted ${deletedCount} posts (${formatBytes(deletedSize)})`);
  return deletedCount;
}

function estimatePostSize(post: Post): number {
  // Rough estimate: JSON string length
  return JSON.stringify(post).length;
}
```

### Automatic Cleanup

**Background task to remove expired entries:**

```typescript
export async function clearExpiredCache(): Promise<{
  posts: number;
  users: number;
  comments: number;
}> {
  const db = await getDB();
  const now = Date.now();
  const counts = { posts: 0, users: 0, comments: 0 };

  // Clean posts
  const postsTx = db.transaction('posts', 'readwrite');
  const posts = await postsTx.store.getAll();
  for (const post of posts) {
    if (post.expiresAt <= now) {
      await postsTx.store.delete(post.id);
      counts.posts++;
    }
  }
  await postsTx.done;

  // Clean users
  const usersTx = db.transaction('users', 'readwrite');
  const users = await usersTx.store.getAll();
  for (const user of users) {
    if (user.expiresAt <= now) {
      await usersTx.store.delete(user.id);
      counts.users++;
    }
  }
  await usersTx.done;

  // Clean comments
  const commentsTx = db.transaction('comments', 'readwrite');
  const comments = await commentsTx.store.getAll();
  for (const comment of comments) {
    if (comment.expiresAt <= now) {
      await commentsTx.store.delete(comment.id);
      counts.comments++;
    }
  }
  await commentsTx.done;

  // Update metadata
  await updateMetadata({ lastCleanup: now });

  console.log('[Cache] Cleanup complete:', counts);
  return counts;
}

// Schedule cleanup every 24 hours
export function scheduleCleanup(): void {
  setInterval(async () => {
    await clearExpiredCache();

    const size = await getCacheSize();
    if (size > MAX_CACHE_SIZE) {
      await evictOldestEntries();
    }
  }, CLEANUP_INTERVAL);
}
```

### Cache Statistics

```typescript
export async function getCacheStats(): Promise<CacheMetadata> {
  const db = await getDB();
  const stats = await db.get('metadata', 'cache-stats');

  return stats || {
    key: 'cache-stats',
    totalSize: 0,
    lastCleanup: Date.now(),
    hitCount: 0,
    missCount: 0,
  };
}

export async function getCacheHitRate(): Promise<number> {
  const stats = await getCacheStats();
  const total = stats.hitCount + stats.missCount;
  return total > 0 ? (stats.hitCount / total) * 100 : 0;
}

export async function getCacheSize(): Promise<number> {
  const db = await getDB();

  const postsSize = await estimateStoreSize(db, 'posts');
  const usersSize = await estimateStoreSize(db, 'users');
  const commentsSize = await estimateStoreSize(db, 'comments');

  const totalSize = postsSize + usersSize + commentsSize;

  await updateMetadata({ totalSize });

  return totalSize;
}

async function estimateStoreSize(
  db: IDBPDatabase<NewsFeedDB>,
  storeName: 'posts' | 'users' | 'comments'
): Promise<number> {
  const tx = db.transaction(storeName, 'readonly');
  const items = await tx.store.getAll();
  return items.reduce((sum, item) => sum + JSON.stringify(item).length, 0);
}
```

---

## Layer 3: Service Worker (Static Cache) {#layer-3-service-worker}

### Service Worker Lifecycle

**File:** [public/service-worker.js](public/service-worker.js) (359 lines)

```javascript
// Service Worker v2.0.0
const CACHE_VERSION = '2.0.0';
const STATIC_CACHE_NAME = `newsfeed-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `newsfeed-runtime-v${CACHE_VERSION}`;

// Assets to pre-cache during install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ═══════════════════════════════════════════════════════════
// INSTALL: Pre-cache static assets
// ═══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Force activation (don't wait for old SW to close)
      return self.skipWaiting();
    })
  );
});

// ═══════════════════════════════════════════════════════════
// ACTIVATE: Clean up old caches
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old versions
          if (cacheName !== STATIC_CACHE_NAME &&
              cacheName !== RUNTIME_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// ═══════════════════════════════════════════════════════════
// FETCH: Intercept network requests
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome extensions, non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Route by request type
  if (url.pathname.startsWith('/api/')) {
    // API requests: Network-first
    event.respondWith(networkFirst(request));
  } else if (request.destination === 'image') {
    // Images: Cache-first
    event.respondWith(cacheFirst(request));
  } else if (request.destination === 'script' ||
             request.destination === 'style') {
    // JS/CSS: Cache-first
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    // HTML pages: Stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Default: Network-first
    event.respondWith(networkFirst(request));
  }
});
```

### Caching Strategies

**1. Cache-First (for static assets):**
```javascript
async function cacheFirst(request) {
  // Check cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse; // Return immediately
  }

  // Cache miss: Fetch from network
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses only
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, no cache available
    console.error('[SW] Cache-first failed:', error);
    throw error;
  }
}
```

**Flow:**
```
Request → Cache → Hit? Return immediately
                ↓ Miss
              Network → Success? Cache + Return
                      ↓ Fail
                      Error
```

**Use cases:** Images, fonts, JS bundles, CSS (immutable assets)

**2. Network-First (for API calls):**
```javascript
async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful API responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed: Try cache
    console.log('[SW] Network failed, trying cache');
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse; // Return stale data
    }

    // No cache: Return offline page for navigation
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}
```

**Flow:**
```
Request → Network → Success? Cache + Return
                  ↓ Fail
                  Cache → Hit? Return (stale)
                        ↓ Miss
                        Offline page or Error
```

**Use cases:** API calls (want fresh data, but work offline)

**3. Stale-While-Revalidate (for HTML pages):**
```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);

  // Fetch from network (don't await)
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached version immediately (if available)
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse; // Instant response with stale data
    // Network fetch continues in background
  }

  // No cache: Wait for network
  return networkFetch || caches.match('/offline.html');
}
```

**Flow:**
```
Request → Cache → Hit? Return (stale) + Fetch in background
                ↓ Miss
              Network → Cache + Return
```

**Use cases:** HTML pages (instant load with potentially stale content)

### Message Handling

**Communication with main thread:**
```javascript
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // Force update
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      // Clear all caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      });
      break;

    case 'CACHE_URLS':
      // Pre-cache specific URLs
      caches.open(RUNTIME_CACHE_NAME).then((cache) => {
        return cache.addAll(data.urls);
      });
      break;

    case 'GET_CACHE_SIZE':
      // Return cache statistics
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ size });
      });
      break;
  }
});

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }

  return totalSize;
}
```

---

## Cache Coordination & Strategies {#cache-coordination}

### Multi-Layer Coordination

**File:** [src/utils/cacheCoordinator.ts](src/utils/cacheCoordinator.ts) (439 lines)

```typescript
import { QueryClient } from '@tanstack/react-query';
import { getCachedPosts, cachePosts } from './indexedDBCache';

export type CacheStrategy =
  | 'cache-first'             // L2 → L3 → Network
  | 'network-first'           // Network → L2 → L3
  | 'cache-only'              // L2 only (no network)
  | 'network-only'            // Network only (no cache)
  | 'stale-while-revalidate'; // L2 instant + Network background

/**
 * Cache-First Strategy
 * Use when: Data doesn't change often, speed is critical
 */
export async function cacheFirstStrategy<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  ttl = 7 * 24 * 60 * 60 * 1000
): Promise<{ data: T; source: 'cache' | 'network' | 'indexeddb' }> {

  // Try L2: IndexedDB
  const cachedData = await getCachedPosts();
  if (cachedData.length > 0) {
    return {
      data: cachedData as unknown as T,
      source: 'indexeddb',
    };
  }

  // L2 miss: Fetch from network
  const networkData = await fetchFn();

  // Update L2 cache
  if (Array.isArray(networkData)) {
    await cachePosts(networkData, ttl);
  }

  return {
    data: networkData,
    source: 'network',
  };
}

/**
 * Network-First Strategy
 * Use when: Data changes frequently, freshness is critical
 */
export async function networkFirstStrategy<T>(
  fetchFn: () => Promise<T>,
  fallbackFn: () => Promise<T | null>,
  ttl = 7 * 24 * 60 * 60 * 1000
): Promise<{ data: T; source: 'network' | 'cache' }> {

  try {
    // Try network first
    const networkData = await fetchFn();

    // Update cache in background
    if (Array.isArray(networkData)) {
      cachePosts(networkData, ttl).catch(() => {});
    }

    return {
      data: networkData,
      source: 'network',
    };
  } catch (error) {
    // Network failed: Try cache
    const cachedData = await fallbackFn();

    if (cachedData) {
      return {
        data: cachedData,
        source: 'cache',
      };
    }

    throw error; // No cache available
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Use when: Want instant response + fresh data
 */
export async function staleWhileRevalidateStrategy<T>(
  fetchFn: () => Promise<T>,
  getCacheFn: () => Promise<T | null>,
  updateCacheFn: (data: T) => Promise<void>
): Promise<{ data: T; source: 'cache' | 'network'; isStale?: boolean }> {

  // Get cached data immediately
  const cachedData = await getCacheFn();

  // Start network fetch (don't await)
  const networkPromise = fetchFn().then(async (data) => {
    await updateCacheFn(data);
    return data;
  });

  if (cachedData) {
    // Return cache immediately
    // Network fetch continues in background
    return {
      data: cachedData,
      source: 'cache',
      isStale: true,
    };
  }

  // No cache: Wait for network
  const networkData = await networkPromise;
  return {
    data: networkData,
    source: 'network',
    isStale: false,
  };
}
```

### Prefetching Strategy

**Warm cache before user needs data:**

```typescript
export async function prefetchRelatedData(post: Post): Promise<void> {
  const queryClient = useQueryClient();

  // Prefetch author profile (will be needed when clicked)
  if (post.author) {
    queryClient.prefetchQuery({
      queryKey: ['user', post.author.id],
      queryFn: async () => {
        // Try cache first
        const cached = await getCachedUser(post.author!.id);
        if (cached) return cached;

        // Fetch from network
        const user = await userApi.getProfile(post.author!.id);
        await cacheUser(user);
        return user;
      },
    });
  }

  // Prefetch comments (if post has any)
  if (post.commentCount > 0) {
    queryClient.prefetchQuery({
      queryKey: ['comments', post.id],
      queryFn: async () => {
        const cached = await getCachedComments(post.id);
        if (cached.length > 0) return cached;

        const comments = await feedApi.getComments(post.id);
        await cacheComments(comments);
        return comments;
      },
    });
  }
}

// Usage: Prefetch on hover
<PostCard
  post={post}
  onMouseEnter={() => prefetchRelatedData(post)}
  onClick={() => navigate(`/post/${post.id}`)}
/>
```

### Cache Warming (on app load)

```typescript
export async function warmCaches(): Promise<void> {
  console.log('[Cache] Warming caches...');

  // Warm React Query cache from IndexedDB
  const cachedPosts = await getCachedPosts(20);
  if (cachedPosts.length > 0) {
    queryClient.setQueryData(['feed', 'infinite'], {
      pages: [{ posts: cachedPosts, pagination: { hasMore: true, nextCursor: null } }],
      pageParams: [null],
    });
    console.log(`[Cache] Warmed React Query with ${cachedPosts.length} posts from IndexedDB`);
  }

  // Warm user cache
  const cachedUsers = await getCachedUsers(50);
  cachedUsers.forEach((user) => {
    queryClient.setQueryData(['user', user.id], user);
  });

  console.log('[Cache] Cache warming complete');
}

// Call on app initialization
warmCaches();
```

---

**End of Part 3**

**Next:** Part 4 will cover Infinite Scroll implementation, Cursor vs Offset pagination, and Search/Filtering.

**Files to study before Part 4:**
1. `src/hooks/useInfiniteScroll.ts` - Infinite scroll hook (156 lines)
2. `server/server.js` - Backend pagination logic (lines 120-200)
3. `src/store/searchFilterStore.ts` - Search/filter state (123 lines)
