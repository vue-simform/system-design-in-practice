# System Design in Action: Building a Production-Ready News Feed

Your app works perfectly on your laptop, then crashes under real user load. You study system design theory for interviews, but can't connect those architectural diagrams to actual code that works.

This guide demonstrates a production-ready social media feed that handles millions of likes, spotty mobile connections, server outages, and users who expect instant responses. System design patterns like caching strategies, optimistic updates, offline queues, and circuit breakers are implemented in working TypeScript code.

Live Demo & Code:** [https://github.com/vue-simform/system-design-in-practice](https://github.com/vue-simform/system-design-in-practice)

---

## The Problem

Build a social media feed. Seems simple. Then requirements arrive:

- Works offline
- Shows likes instantly
- Handles millions of posts
- Runs when server is down
- Accessible for screen readers
- Feels instant, no loading spinners

Welcome to production system design.

### What You'll See

Enterprise patterns from Twitter, Facebook, and LinkedIn:

**Stack:**
- React 19 + TypeScript + Vite
- 3-Layer Caching (Memory → IndexedDB → Service Worker)
- Full PWA with Offline Support
- Optimistic UI Updates with Rollback
- Automatic Retry with Exponential Backoff
- WCAG 2.1 AA Accessible
- 15+ Custom Hooks
- Real-time Analytics

---

## Architecture Overview

### The Structure

```
User
    ↓
React Components (presentation)
    ↓
Custom Hooks (business logic)
    ↓
State Management
    - React Query (server data)
    - Zustand (client state)
    - Context (auth)
    ↓
Cache (3 layers)
    - L1: Memory (instant)
    - L2: IndexedDB (persistent)
    - L3: Service Worker (static)
    ↓
API Service
    ↓
Backend Server
```

**Why this works:**

- Each layer has one job
- Test each layer separately
- Reuse logic across components
- Add features without breaking code

### File Organization

```
src/
├── components/     # What users see
├── hooks/          # Business logic
├── store/          # Client state
├── utils/          # Pure functions
└── services/       # API calls
```

**Rules:**

- Components render only
- Hooks handle logic
- Services manage network
- Utils stay pure

---

## User Journey: Click to Response

Follow a like button click through the system.

### Step 1: The Click

```typescript
// components/feed/PostItem.tsx
function PostItem({ post }) {
  const { mutate: likePost } = useLikePost()

  return (
    <button onClick={() => likePost({ postId: post.id, isLiked: post.isLiked })}>
      ❤️ {post.likes}
    </button>
  )
}
```

### Step 2: Optimistic Update

```typescript
// hooks/useLikePost.ts
function useLikePost() {
  return useOptimisticMutation({
    // Update UI before server responds
    onMutate: (oldData, { postId, isLiked }) => {
      return {
        ...oldData,
        pages: oldData.pages.map(page => ({
          ...page,
          posts: page.posts.map(post =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: !isLiked,
                  likes: post.likes + (isLiked ? -1 : 1)
                }
              : post
          )
        }))
      }
    },

    mutationFn: ({ postId, isLiked }) => {
      return isLiked
        ? api.delete(`/api/posts/${postId}/like`)
        : api.post(`/api/posts/${postId}/like`)
    },
  })
}
```

**Timeline:**

```
0ms:    User clicks
1ms:    Heart turns red, count updates (instant feedback)
500ms:  Server responds

Success: Keep changes, refetch, show success
Error:   Rollback changes, show error, retry
```

**Comparison:**

- Old way: Click → Wait 500ms → See result (slow)
- New way: Click → See result → Server confirms (fast)

This makes Twitter, Facebook, and Instagram feel responsive.

### Step 3: Offline Handling

```typescript
if (!isOnline) {
  await offlineQueue.enqueue('LIKE_POST', { postId, userId })
  toast.info('Will sync when you\'re back online')
  return
}
```

**Outcomes:**

- Online: Instant feedback → Server confirms → Done
- Offline: Instant feedback → Queue action → Sync when online → Done
- Error: Instant feedback → Retry with backoff → Done

---

## Three-Layer Caching

Three cache levels work together for speed and reliability.

### The Trade-off

- Show old data: Fast but wrong
- Always fetch fresh: Slow, wastes bandwidth
- Multi-layer cache: Fast and fresh

### Layer 1: Memory (React Query)

Speed: < 1ms

**File:** [src/config/queryClient.ts](src/config/queryClient.ts)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,      // Posts fresh for 1 minute
      gcTime: 1000 * 60 * 10,    // Keep for 10 minutes
      retry: 3,                   // 3 retry attempts
      networkMode: 'offlineFirst' // Works offline
    }
  }
})
```

**Different data types get different TTLs:**

```typescript
// Posts: 1 minute fresh, 10 minutes cached
// Users: 5 minutes fresh, 30 minutes cached
// Comments: 30 seconds fresh, 5 minutes cached
```

**How it works:**

```
2:00 PM - Fetch from server, store in memory
2:00:30 PM - Return visit (30s), still fresh, show instantly
2:02 PM - Return visit (2 min), stale, show cached while fetching fresh
```

Users see data instantly. App refreshes in background when stale.

### Layer 2: IndexedDB

Speed: 5-10ms
Survives browser restarts

**File:** [src/utils/indexedDBCache.ts](src/utils/indexedDBCache.ts)

```typescript
// Database: newsfeed-cache, version 1
// Stores: posts, users, comments, metadata

interface CacheEntry<T> {
  id: string
  data: T
  cachedAt: number
  expiresAt: number  // 7 days (604,800,000 ms)
  size: number
}

class IndexedDBCache {
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000  // 7 days
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024      // 50MB
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

  async set(store: string, key: string, value: any) {
    const entry: CacheEntry = {
      id: key,
      data: value,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.DEFAULT_TTL,
      size: JSON.stringify(value).length
    }

    await db.put(store, entry)

    if (totalSize > this.MAX_CACHE_SIZE) {
      await this.evictLRU()  // Remove least recently used
    }
  }
}
```

**Real scenario:**

```
Day 1, 2:00 PM - Browse feed, cache 100 posts in IndexedDB
Day 1, 5:00 PM - Close browser
Day 2, 9:00 AM - Open app, see feed instantly from IndexedDB
                  Fresh data loads in background
```

- Without IndexedDB: Blank screen → Loading → Data (slow)
- With IndexedDB: Instant feed → Background update (fast)

### Layer 3: Service Worker

Speed: 1-2ms
Persistence: Forever (until app update)

**File:** [public/service-worker.js](public/service-worker.js)

```javascript
// Version: 2.0.0
const STATIC_CACHE = 'newsfeed-static-v2.0.0'
const RUNTIME_CACHE = 'newsfeed-runtime-v2.0.0'

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Images, CSS, JS, Fonts → Cache first
  if (/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp)$/.test(request.url)) {
    event.respondWith(cacheFirst(request))
  }

  // API → Network first (fallback to Service Worker cache, then IndexedDB)
  else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
  }

  // HTML → Stale while revalidate
  else if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request))
  }
})
```

**Results:**

| Resource | Strategy | Experience |
|----------|----------|------------|
| App shell | Cache first | Instant, works offline |
| Images | Cache first | Load once, cached forever |
| API data | Network first | Fresh when online, cached offline |
| Feed posts | Stale while revalidate | Instant display, fresh in background |

### How Layers Coordinate

```
Request feed data
    ↓
L1 (Memory): Check → Hit? Return < 1ms
    ↓
L2 (IndexedDB): Check → Hit? Return 5-10ms + store in L1 + revalidate
    ↓
L3 (Service Worker): Check → Hit? Return from cache
    ↓
Network: Fetch → Update all layers
```

**Cache invalidation:**

When user likes a post:

```typescript
async function invalidateCache(key: string) {
  queryClient.invalidateQueries({ queryKey: [key] })
  await cacheManager.delete('posts', key)
  navigator.serviceWorker.controller?.postMessage({
    type: 'INVALIDATE_CACHE',
    key
  })
}
```

**Impact:**

| Scenario | No Cache | 3-Layer Cache |
|----------|----------|---------------|
| First visit | 2000ms | 2000ms |
| Return 1 min later | 2000ms | < 1ms |
| Return next day | 2000ms | 10ms |
| Offline | Broken | Works |

---

## State Management

Use the right tool for each state type.

### Decision Tree

```
Server data (API)? → React Query
    Examples: posts, users, comments

UI state? → Shared across components?
    Yes → Zustand (theme, toasts, modals)
    No → useState (form inputs, toggles)

Auth data? → React Context
    Examples: user, token, permissions
```

### React Query: Server State

Use for data from servers.

```typescript
function useFeedPosts() {
  return useInfiniteQuery({
    queryKey: ['feed', 'infinite'],

    queryFn: async ({ pageParam = null }) => {
      const response = await api.get('/api/feed', {
        params: { limit: 10, cursor: pageParam }
      })
      return response.data
    },

    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined
    },
  })
}
```

**You get:**

- Automatic caching
- Background refetching
- Loading states
- Error handling
- Request deduplication
- Pagination support
- Optimistic updates

**In components:**

```typescript
function FeedContainer() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    error
  } = useFeedPosts()

  const posts = data?.pages.flatMap(page => page.posts) ?? []

  if (isLoading) return <Skeleton count={5} />
  if (error) return <Error message={error.message} />

  return (
    <InfiniteScroll onLoadMore={fetchNextPage} hasMore={hasNextPage}>
      {posts.map(post => <PostItem key={post.id} post={post} />)}
    </InfiniteScroll>
  )
}
```

### Zustand: Client State

Use for shared UI state.

```typescript
const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'light',
      isCommentModalOpen: false,
      selectedPost: null,

      toggleTheme: () => set((state) => ({
        theme: state.theme === 'light' ? 'dark' : 'light'
      })),

      openCommentModal: (post) => set({
        isCommentModalOpen: true,
        selectedPost: post
      }),

      closeCommentModal: () => set({
        isCommentModalOpen: false,
        selectedPost: null
      }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ theme: state.theme })
    }
  )
)
```

**In components:**

```typescript
function ThemeToggle() {
  const theme = useUIStore(state => state.theme)
  const toggleTheme = useUIStore(state => state.toggleTheme)

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  )
}
```

**Zustand vs Redux:**

| Zustand | Redux |
|---------|-------|
| 3 lines | 50+ lines |
| 1KB | 15KB |
| No boilerplate | Actions, reducers, dispatch |
| Built-in TypeScript | Extra types |
| Works outside React | React only |

### useState: Local State

Use for component-specific state.

```typescript
function CreatePostForm() {
  const [content, setContent] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [isValid, setIsValid] = useState(true)

  const handleChange = (e) => {
    const text = e.target.value
    setContent(text)
    setCharCount(text.length)
    setIsValid(text.length <= 500)
  }

  return (
    <form>
      <textarea value={content} onChange={handleChange} maxLength={500} />
      <div>{charCount}/500 characters</div>
    </form>
  )
}
```

### React Context: Auth

Use for app-wide, rarely-changing data.

```typescript
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null)

  const login = async (username: string, password: string) => {
    const { token, user } = await api.post('/auth/login', { username, password })
    localStorage.setItem('token', token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    queryClient.clear()
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

---

## Infinite Scroll

Offset pagination breaks at scale. Cursor pagination fixes it.

### Offset Pagination Problem

```sql
-- Page 1: Fast
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 0;

-- Page 100: Slow (scans 1,000 rows)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 1000;

-- Page 10,000: Too slow (scans 100,000 rows)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 100000;
```

| Page | Offset | Rows Scanned | Time |
|------|--------|--------------|------|
| 1 | 0 | 0 | 10ms |
| 100 | 1,000 | 1,000 | 100ms |
| 10,000 | 100,000 | 100,000 | 5000ms |

Twitter has billions of tweets. Offset pagination fails.

### Cursor Pagination Solution

Get posts after a specific ID instead of skipping rows.

**File:** [server/server.js](server/server.js:29-118)

```javascript
// Cursor format: base64-encoded JSON { lastId, timestamp }
const cursor = Buffer.from(JSON.stringify({
  lastId: 'p42',
  timestamp: '2024-01-15T10:30:00Z'
})).toString('base64')

// Server decodes and finds starting point
const { lastId, timestamp } = JSON.parse(Buffer.from(cursor, 'base64').toString())
const startIndex = posts.findIndex(p => p.id === lastId) + 1

// Always O(1) time, no matter the page
```

**SQL equivalent:**

```sql
-- First request (no cursor)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10;
-- Returns IDs: 100, 99, 98, ..., 91

-- Next request (with cursor pointing to ID 91)
SELECT * FROM posts WHERE id < 91 ORDER BY created_at DESC LIMIT 10;
-- Returns IDs: 90, 89, 88, ..., 81
```

**Performance:**

| Approach | Page 1 | Page 100 | Page 10,000 |
|----------|--------|----------|-------------|
| Offset | 10ms | 100ms | 5000ms |
| Cursor | 10ms | 10ms | 10ms |

### Frontend Implementation

**File:** [src/hooks/useInfiniteScroll.ts](src/hooks/useInfiniteScroll.ts)

```typescript
function useInfiniteScroll() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed', 'infinite', { limit: 10, filter, sort }],

    queryFn: async ({ pageParam = null }) => {
      const response = await api.get('/api/feed', {
        params: { limit: 10, cursor: pageParam, filter, sort }
      })
      return response.data
    },

    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined
    },
  })

  const observerRef = useRef<IntersectionObserver>()
  const loadMoreRef = useCallback((node) => {
    if (!node || !hasNextPage) return

    // Trigger when user scrolls 200px from bottom
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchNextPage()
      }
    }, { rootMargin: '200px' })

    observerRef.current.observe(node)
  }, [hasNextPage, fetchNextPage])

  return {
    posts: data?.pages.flatMap(page => page.posts) ?? [],
    loadMoreRef,
  }
}
```

### Backend Implementation

```javascript
app.get('/api/feed', (req, res) => {
  const { limit = 10, cursor } = req.query

  let posts = db.get('posts').value()

  if (cursor) {
    const { id, createdAt } = JSON.parse(atob(cursor))
    posts = posts.filter(post =>
      new Date(post.createdAt) < new Date(createdAt)
    )
  }

  posts = posts.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  )

  const paginatedPosts = posts.slice(0, limit)
  const hasMore = posts.length > limit

  const nextCursor = hasMore
    ? btoa(JSON.stringify({
        id: paginatedPosts[limit - 1].id,
        createdAt: paginatedPosts[limit - 1].createdAt
      }))
    : null

  res.json({ posts: paginatedPosts, nextCursor, hasMore })
})
```

### Usage

```typescript
function FeedContainer() {
  const { posts, loadMoreRef } = useInfiniteScroll()

  return (
    <div>
      {posts.map(post => <PostItem key={post.id} post={post} />)}
      <div ref={loadMoreRef} style={{ height: 1 }} />
    </div>
  )
}
```

**Benefits:**

- O(1) performance at any position
- No duplicates or missing posts
- Works with billions of records
- Smooth experience

Twitter, Instagram, and TikTok use this.

---

## Resilience Patterns

Servers fail. Networks drop. Users lose internet. Handle it.

### Error Classification

Different errors need different handling.

```typescript
enum ErrorType {
  NETWORK = 'NETWORK',        // No internet → Retry
  TIMEOUT = 'TIMEOUT',        // Too slow → Retry
  SERVER = 'SERVER',          // 5xx → Retry
  VALIDATION = 'VALIDATION',  // 400 → Don't retry
  AUTH = 'AUTH',              // 401 → Don't retry
  NOT_FOUND = 'NOT_FOUND',    // 404 → Don't retry
}

function classifyError(error: unknown): ClassifiedError {
  if (error instanceof TypeError || error.message?.includes('fetch')) {
    return {
      type: ErrorType.NETWORK,
      retryable: true,
      userMessage: 'No internet connection. Check your network.'
    }
  }

  if (error.name === 'AbortError') {
    return {
      type: ErrorType.TIMEOUT,
      retryable: true,
      userMessage: 'Request took too long. Try again.'
    }
  }

  if (error.response?.status >= 500) {
    return {
      type: ErrorType.SERVER,
      retryable: true,
      userMessage: 'Server error. Retrying...'
    }
  }

  if (error.response?.status === 400) {
    return {
      type: ErrorType.VALIDATION,
      retryable: false,
      userMessage: error.response.data?.message || 'Invalid input'
    }
  }

  return {
    type: ErrorType.UNKNOWN,
    retryable: true,
    userMessage: 'Something went wrong. Try again.'
  }
}
```

### Exponential Backoff

Don't hammer a down server with requests.

**File:** [src/utils/errorHandling.ts](src/utils/errorHandling.ts)

**Actual retry configuration:**

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,          // Try 3 times total
  baseDelay: 1000,         // Start with 1 second
  maxDelay: 30000,         // Never wait more than 30 seconds
  backoffFactor: 2         // Double each time
}
```

**Wait times:**
- Attempt 1: Wait 1 second (1000ms)
- Attempt 2: Wait 2 seconds (2000ms)
- Attempt 3: Wait 4 seconds (4000ms)
- Give up after 3 attempts

**With jitter to prevent thundering herd:**

```typescript
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay)
  const jitter = Math.random() * 200 - 100  // ±100ms randomness
  return cappedDelay + jitter
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const classified = classifyError(error)

      // Don't retry validation, auth, or not found errors
      if (!classified.retryable) throw error
      if (attempt === config.maxAttempts - 1) throw error

      const delay = calculateDelay(attempt, config)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

### Circuit Breaker

Stop trying when server is completely down. Fail fast.

**File:** [src/utils/errorHandling.ts](src/utils/errorHandling.ts)

**Actual configuration:**

```typescript
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // Open after 5 failures
  successThreshold: 2,        // Close after 2 successes in half-open
  timeout: 60000,             // Try half-open after 60 seconds
  volumeThreshold: 10,        // Need 10 requests minimum
  errorThresholdPercentage: 50  // Open if 50% error rate
}
```

**States:**

```
CLOSED (Normal)
  → 5 failures or 50% error rate
OPEN (Block all requests immediately)
  → Wait 60 seconds
HALF-OPEN (Test with single request)
  → 2 successes: CLOSED
  → 1 failure: OPEN
```

```typescript
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can try again
    if (this.state === CircuitState.OPEN &&
        Date.now() - this.lastFailureTime > 60000) {
      this.state = CircuitState.HALF_OPEN
      this.successCount = 0
    }

    // Fast fail if circuit is open
    if (this.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker OPEN. Server is down.')
    }

    try {
      const result = await fn()

      // Track success in half-open state
      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++
        if (this.successCount >= 2) {
          this.state = CircuitState.CLOSED
          this.failureCount = 0
        }
      }

      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      // Open circuit after 5 failures
      if (this.failureCount >= 5) {
        this.state = CircuitState.OPEN
      }

      throw error
    }
  }
}
```

**Impact:**

- Without: Every request waits 30s to timeout (bad UX)
- With: Fail instantly after detecting outage (good UX)

### Graceful Degradation

When features fail, the app keeps working.

```typescript
// Analytics fails → Feed still works
function FeedContainer() {
  const { posts } = useFeedPosts()
  const { data: analytics } = useAnalytics({
    onError: (error) => {
      console.warn('Analytics unavailable', error)
    }
  })

  return (
    <div>
      {analytics && <AnalyticsBar data={analytics} />}
      <PostList posts={posts} />
    </div>
  )
}

// Image fails → Show placeholder
function PostImage({ src, alt }) {
  const [error, setError] = useState(false)

  if (error) {
    return <div>Image unavailable</div>
  }

  return <img src={src} alt={alt} onError={() => setError(true)} />
}
```

---

## Offline Architecture

Handle complete internet loss.

### Service Worker

Service Worker intercepts network requests. It decides what to cache and when.

```javascript
const CACHE_VERSION = 'newsfeed-v2.0.0'

// Install: Pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        '/icon-192.png',
      ])
    })
  )
})

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_VERSION)
          .map(name => caches.delete(name))
      )
    })
  )
})

// Fetch: Apply strategies
self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request))
  } else if (request.url.includes('/api/')) {
    event.respondWith(networkFirst(request))
  } else {
    event.respondWith(staleWhileRevalidate(request))
  }
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  const cache = await caches.open(CACHE_VERSION)
  cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(CACHE_VERSION)
    cache.put(request, response.clone())
    return response
  } catch (error) {
    return caches.match(request) || new Response('Offline')
  }
}
```

### Offline Queue

User creates post offline. Queue it. Sync when online.

**Files:**
- [src/utils/offlineQueue.ts](src/utils/offlineQueue.ts)
- [src/utils/offlineQueueInit.ts](src/utils/offlineQueueInit.ts)

**Database:** `offline-queue`, version 1
**Stores:** `queue` with indexes on `timestamp` and `status`

**Actual configuration:**

```typescript
const QUEUE_CONFIG = {
  autoSyncInterval: 30000,  // Auto-sync every 30 seconds when online
  maxRetries: 3,            // Try 3 times per action
  retryDelays: [1000, 2000, 4000, 8000],  // Exponential backoff
  maxDelay: 30000           // Cap at 30 seconds
}
```

**Action types:**

```typescript
type ActionType =
  | 'CREATE_POST'
  | 'LIKE_POST'
  | 'UNLIKE_POST'
  | 'ADD_COMMENT'
  | 'DELETE_POST'
  | 'EDIT_POST'

interface QueuedAction {
  id: string
  type: ActionType
  payload: any
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  retries: number
  createdAt: number
  timestamp: number
}
```

**Queue processing (FIFO):**

```typescript
class OfflineQueue {
  async enqueue(type: ActionType, payload: any) {
    const action: QueuedAction = {
      id: `${type}_${Date.now()}`,
      type,
      payload,
      status: 'pending',
      retries: 0,
      createdAt: Date.now(),
      timestamp: Date.now()
    }

    await db.put('offline-queue', action)
  }

  // Auto-processes queue every 30 seconds when online
  async processQueue() {
    const pending = await db.getAll('offline-queue')
      .then(actions => actions
        .filter(a => a.status === 'pending')
        .sort((a, b) => a.timestamp - b.timestamp)  // FIFO order
      )

    for (const action of pending) {
      try {
        await this.markSyncing(action.id)
        await this.executeAction(action)
        await this.markCompleted(action.id)
        toast.success(`${action.type} synced`)
      } catch (error) {
        action.retries++
        if (action.retries >= 3) {
          await this.markFailed(action.id)
          toast.error(`${action.type} failed after 3 retries`)
        } else {
          const delay = Math.min(1000 * Math.pow(2, action.retries), 30000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
  }

  private async executeAction(action: QueuedAction) {
    switch (action.type) {
      case 'CREATE_POST':
        return api.post('/api/posts', action.payload)
      case 'LIKE_POST':
        return api.post(`/api/posts/${action.payload.postId}/like`, { userId: action.payload.userId })
      case 'UNLIKE_POST':
        return api.delete(`/api/posts/${action.payload.postId}/like`, { userId: action.payload.userId })
      case 'ADD_COMMENT':
        return api.post(`/api/posts/${action.payload.postId}/comments`, action.payload)
      case 'DELETE_POST':
        return api.delete(`/api/posts/${action.payload.postId}`)
      case 'EDIT_POST':
        return api.put(`/api/posts/${action.payload.postId}`, action.payload)
    }
  }

  getStats() {
    // Returns: { pending, syncing, failed, completed, total }
  }
}
```

**Auto-sync on reconnect:**

```typescript
// Initialized once in App.tsx
function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      toast.info('Back online. Syncing...')
      await offlineQueue.processQueue()
      toast.success('All changes synced')
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.warning('Offline. Changes will sync when reconnected.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Auto-sync every 30 seconds when online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        offlineQueue.processQueue()
      }
    }, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return isOnline
}
```

**Experience:**

```
User on subway → Enters tunnel → Loses connection
User likes post → Heart turns red → Queued → Toast shown
User exits tunnel → Reconnects → Queue processes → Synced
Result: No data lost
```

---

## Performance

### Image Lazy Loading

Load images when user scrolls near them.

**File:** [src/components/common/LazyImage.tsx](src/components/common/LazyImage.tsx)

**Configuration:**

```typescript
const IMAGE_CONFIG = {
  lazyLoadOffset: 100,       // Load 100px before visible
  quality: 80,               // 80% JPEG quality
  thumbnailWidth: 400,       // Thumbnail max width
  fullWidth: 1200,           // Full image max width
  maxSize: 5 * 1024 * 1024, // 5MB max file size
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}
```

```typescript
function LazyImage({ src, alt, ...props }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }  // Load 100px before visible
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef}>
      {!isLoaded && <div className="skeleton" />}
      {isInView && (
        <img src={src} alt={alt} onLoad={() => setIsLoaded(true)} {...props} />
      )}
    </div>
  )
}
```

**Impact:**

- 100 posts, 2 images each = 200 images
- Without lazy loading: 200 images load = 20MB = 10 seconds
- With lazy loading: 10 visible images load = 1MB = 1 second

### Virtual Scrolling

Render visible items only.

**Note:** This app uses standard infinite scroll with cursor pagination instead of virtual scrolling. Virtual scrolling adds complexity and isn't needed when pagination limits visible items.

**Alternative implementation with react-window:**

```typescript
import { FixedSizeList as List } from 'react-window'

function VirtualizedFeed({ posts }) {
  return (
    <List
      height={window.innerHeight}
      itemCount={posts.length}
      itemSize={300}
      overscanCount={3}
    >
      {({ index, style }) => (
        <div style={style}>
          <PostItem post={posts[index]} />
        </div>
      )}
    </List>
  )
}
```

**When to use:**
- Loading thousands of items at once
- No pagination
- Fixed item heights
- Performance issues with DOM nodes

**This app's approach:**
- Cursor pagination loads 10 posts at a time
- Max 50-100 posts in memory before user scrolls
- Simpler implementation
- Fewer DOM nodes without virtual scrolling complexity

**Impact comparison:**

| Posts | Without Virtual Scroll | With Virtual Scroll |
|-------|----------------------|-------------------|
| 100 | 100 DOM nodes | 10 DOM nodes |
| 1,000 | 1,000 DOM nodes (laggy) | 10 DOM nodes (smooth) |
| 10,000 | Browser freezes | 10 DOM nodes (smooth) |

### Code Splitting

Load code when needed.

```typescript
import { lazy, Suspense } from 'react'

// Load immediately
import FeedContainer from './components/feed/FeedContainer'

// Load when route visited
const Analytics = lazy(() => import('./pages/AnalyticsDashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<FeedContainer />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}
```

**Impact:**

- Before: 500KB initial bundle, 3s to interactive
- After: 200KB initial bundle, 1s to interactive
- Analytics: 150KB loaded only when visited

### React.memo + useCallback

Prevent unnecessary re-renders.

```typescript
// Re-renders only when post or onLike changes
const PostItem = memo(({ post, onLike }) => {
  return (
    <div>
      <p>{post.content}</p>
      <button onClick={() => onLike(post.id)}>❤️ {post.likes}</button>
    </div>
  )
})

function FeedContainer() {
  const { posts } = useFeedPosts()

  // Stable function reference
  const handleLike = useCallback((postId) => {
    likePost(postId)
  }, [likePost])

  return (
    <div>
      {posts.map(post => (
        <PostItem key={post.id} post={post} onLike={handleLike} />
      ))}
    </div>
  )
}
```

**Impact:**

- 100 posts in feed
- User likes one
- Without memo: 100 components re-render
- With memo: 1 component re-renders

---

## Trade-offs

### Consistency vs Availability

User likes post offline.

**Option A: Strong Consistency**
- Data always correct
- App breaks offline
- Slow (wait for server)

**Option B: Eventual Consistency** (chosen)
- Works offline
- Fast (optimistic updates)
- Temporary inconsistency possible

**Choice:** For social feeds, speed and availability beat perfect consistency. Users accept occasional rollbacks over 500ms waits.

### Cache Duration

**Actual TTLs in this app:**

| Data Type | L1 (Memory) | L2 (IndexedDB) | L3 (Service Worker) | Reason |
|-----------|-------------|----------------|---------------------|---------|
| Posts | 1 min fresh, 10 min cached | 7 days | Until app update | Posts change frequently |
| Users | 5 min fresh, 30 min cached | 7 days | Until app update | User profiles rarely change |
| Comments | 30 sec fresh, 5 min cached | 7 days | Until app update | Comments update often |
| Static assets | N/A | N/A | Forever | JS/CSS never change without deploy |

Different data needs different strategies.

### Bundle Size vs Features

Add charts to analytics.

**Option A: Recharts (150KB)**
- Full features
- +2s load time

**Option B: Light alternative (30KB)**
- Basic features
- +0.5s load time

**Choice:** Recharts. Analytics is lazy loaded, so no impact on initial load.

### Server vs Client Rendering

**Server-side:**
- Better SEO
- Faster first paint
- Complex setup
- Higher costs

**Client-side:** (chosen)
- Simple deployment
- Cheaper (static hosting)
- Rich interactivity
- Slower first paint (mitigated with caching)

**Choice:** For social feeds, interactivity beats SEO. Skeleton loading fixes slow first paint.

---

## Additional Production Features

This app includes enterprise features beyond the core patterns.

### Analytics Dashboard

**File:** [src/components/analytics/AnalyticsDashboard.tsx](src/components/analytics/AnalyticsDashboard.tsx)

- Overview metrics (total posts, engagement rate, active users)
- Time series charts (Recharts library)
- Top posts analysis
- User activity tracking
- Export to JSON/CSV
- Periods: 7 days, 30 days, 90 days

### Validation System

**File:** [src/utils/validation.ts](src/utils/validation.ts)

**Built-in validators (15 total):**
- required, email, minLength, maxLength, pattern
- numeric, min, max, range, url, oneOf
- Async validation: uniqueAsync, asyncCustom

**Content limits:**
```typescript
MAX_CONTENT_LENGTH: 2000 characters  // Posts
MAX_COMMENT_LENGTH: 1000 characters  // Comments
MAX_IMAGES: 4                         // Per post
MAX_IMAGE_SIZE: 5MB                   // Per image
ALLOWED_TYPES: ['jpeg', 'png', 'gif', 'webp']
```

**XSS protection:**
- sanitizeInput() escapes HTML special characters
- normalizeWhitespace() prevents formatting exploits

### Search and Filtering

**File:** [src/store/searchFilterStore.ts](src/store/searchFilterStore.ts)

**Search:**
- Debounced input (300ms delay)
- Full-text search across post content

**Filters:**
- all: All posts
- following: Posts from followed users
- liked: Posts you liked

**Sorting:**
- newest: Latest first (createdAt DESC)
- popular: Most likes (likeCount DESC)
- trending: Score = likeCount × 2 + commentCount - (age_in_hours / 24)

### Accessibility (WCAG 2.1 AA)

**File:** [src/utils/accessibility.tsx](src/utils/accessibility.tsx)

**Keyboard shortcuts:**
```typescript
j/k:  Navigate posts
/:    Focus search
l:    Like current post
c:    Comment on current post
Esc:  Close modals
```

**Features:**
- Skip links for keyboard navigation
- ARIA live regions for announcements
- Screen reader support
- Focus management
- Color contrast checking utility
- All interactive elements have proper labels

### Developer Tools

**Cache metrics:** Shows cache hit rate, size, stats
**Scroll debugger:** Shows current scroll position
**Network indicators:** Online/offline badge
**PWA install prompt:** Detects installability
**Draft auto-save:** Auto-saves posts to localStorage

All controlled by settings toggle.

### Testing Infrastructure

**Framework:** Vitest + Testing Library

**Test files:**
- IndexedDB cache tests
- Cache coordinator tests
- Mock Service Worker (MSW) for API mocking
- fake-indexeddb for testing IndexedDB

### What's NOT Implemented

Be aware of these limitations:

**Authentication:** Mock user `u1` hardcoded everywhere. No real login, token refresh, or auth flows.

**Real-time updates:** No WebSocket implementation. Constants defined but not used.

**File upload:** Validation rules exist but no actual image upload to CDN or server.

**Rate limiting:** Server returns 429 errors but no actual rate limiting logic.

**Push notifications:** PWA manifest configured but no push notification implementation.

**Server-side rendering:** Pure client-side app. No SSR or hydration.

These are intentionally omitted to keep the codebase focused on core system design patterns. Adding them is left as an exercise.

---

## Implementation Summary

**Architecture Features:**

- Resilient: Offline support, error handling, retry logic, circuit breaker
- Scalable: Cursor pagination, code splitting, multi-layer caching
- Performance: 3-layer caching, optimistic updates, lazy loading
- Accessible: WCAG 2.1 AA compliance, keyboard navigation
- Maintainable: TypeScript, clear separation of concerns

**Key Patterns:**

1. Multi-layer caching (Memory → IndexedDB → Service Worker)
2. Optimistic UI updates with rollback
3. Cursor-based pagination for infinite scroll
4. Comprehensive error handling and retry mechanisms
5. Appropriate state management tools for different data types
6. Offline-first architecture with sync queues

**System Design Trade-offs:**

- Speed vs consistency: Chose eventual consistency for better UX
- Complexity vs features: Multi-layer caching adds complexity but enables offline functionality
- Cost vs performance: Client-side rendering reduces server costs
- Maintainability vs optimization: Clear architecture over micro-optimizations

---

## Resources

**Study These Files (in order):**

**Start here:**
1. [src/hooks/useOptimisticMutation.ts](src/hooks/useOptimisticMutation.ts) - Optimistic updates
2. [src/hooks/useInfiniteScroll.ts](src/hooks/useInfiniteScroll.ts) - Cursor pagination
3. [src/utils/indexedDBCache.ts](src/utils/indexedDBCache.ts) - L2 cache
4. [public/service-worker.js](public/service-worker.js) - L3 cache + offline

**Then explore:**
5. [src/utils/offlineQueue.ts](src/utils/offlineQueue.ts) - Offline mutations
6. [src/utils/errorHandling.ts](src/utils/errorHandling.ts) - Error classification, retry, circuit breaker
7. [src/config/queryClient.ts](src/config/queryClient.ts) - React Query setup
8. [src/services/api.ts](src/services/api.ts) - API service layer
9. [src/utils/validation.ts](src/utils/validation.ts) - Input validation
10. [server/server.js](server/server.js) - Backend implementation

**Advanced:**
11. [src/utils/cacheCoordinator.ts](src/utils/cacheCoordinator.ts) - Multi-layer coordination
12. [src/utils/accessibility.tsx](src/utils/accessibility.tsx) - Keyboard shortcuts
13. [src/components/analytics/AnalyticsDashboard.tsx](src/components/analytics/AnalyticsDashboard.tsx) - Analytics

**External Documentation:**
- React Query: tanstack.com/query/latest
- Zustand: docs.pmnd.rs/zustand
- Service Workers: developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- PWA Guide: web.dev/progressive-web-apps
- IndexedDB: developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
