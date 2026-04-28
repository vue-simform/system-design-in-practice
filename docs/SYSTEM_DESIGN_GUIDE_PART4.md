# System Design in Action: Building a Production-Ready News Feed

## Part 4: Data Fetching and Pagination

> **Infinite scroll, cursor pagination, search, and filtering strategies**

---

## Table of Contents (Part 4)

14. [Infinite Scroll Implementation](#infinite-scroll)
15. [Cursor vs Offset Pagination](#cursor-vs-offset)
16. [Search and Filtering](#search-filtering)
17. [Data Prefetching](#data-prefetching)

---

## Infinite Scroll Implementation {#infinite-scroll}

### The User Experience

**Traditional Pagination:**
```
Posts 1-10
[1] [2] [3] [4] [5] ... [Next]

Problems:
- User must click to see more
- Page refresh (jarring)
- Lose scroll position
- Mental model: "Which page was that post on?"
```

**Infinite Scroll:**
```
Posts 1-10
(scroll down)
Posts 11-20 load automatically
(scroll down)
Posts 21-30 load automatically
...

Benefits:
- Seamless experience
- No clicking
- Continuous flow
- Mobile-friendly
```

### Implementation Architecture

**File:** [src/hooks/useInfiniteScroll.ts](src/hooks/useInfiniteScroll.ts) (156 lines)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import { feedApi } from '@/services/api';
import type { FeedResponse, Post } from '@/types';

interface UseInfiniteScrollOptions {
  limit?: number;
  enabled?: boolean;
  filter?: 'all' | 'following' | 'liked';
  sort?: 'newest' | 'popular' | 'trending';
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions = {}) {
  const {
    limit = 10,
    enabled = true,
    filter = 'all',
    sort = 'newest',
  } = options;

  // ══════════════════════════════════════════════════════
  // React Query Infinite Query
  // ══════════════════════════════════════════════════════
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', 'infinite', { limit, filter, sort }],

    queryFn: async ({ pageParam }) => {
      const response = await feedApi.getFeed(pageParam, limit, filter, sort);
      return response;
    },

    getNextPageParam: (lastPage: FeedResponse) => {
      // Return cursor for next page, or undefined if no more pages
      return lastPage.pagination.hasMore
        ? lastPage.pagination.nextCursor
        : undefined;
    },

    initialPageParam: null,
    enabled,
    staleTime: 60000, // 1 minute
    gcTime: 600000,   // 10 minutes
  });

  // ══════════════════════════════════════════════════════
  // Intersection Observer for Auto-Load
  // ══════════════════════════════════════════════════════
  const observerRef = useRef<IntersectionObserver>();

  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Don't observe if already fetching or no more pages
      if (isFetchingNextPage || !hasNextPage) {
        return;
      }

      // Create new observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          // When sentinel element is visible, load more
          if (entries[0].isIntersecting) {
            fetchNextPage();
          }
        },
        {
          // Trigger 200px before element is visible (prefetch)
          rootMargin: '200px',
        }
      );

      // Start observing
      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // ══════════════════════════════════════════════════════
  // Flatten paginated data
  // ══════════════════════════════════════════════════════
  const posts: Post[] = data?.pages.flatMap((page) => page.posts) ?? [];

  // ══════════════════════════════════════════════════════
  // Return hook interface
  // ══════════════════════════════════════════════════════
  return {
    posts,                  // Flattened array of all posts
    lastPostRef,            // Ref to attach to last post (sentinel)
    hasNextPage,            // Boolean: more pages available?
    isFetchingNextPage,     // Boolean: currently loading next page?
    isLoading,              // Boolean: initial load?
    isError,                // Boolean: error occurred?
    error,                  // Error object
    fetchNextPage,          // Function: manually trigger next page
    refetch,                // Function: refetch from start
  };
}
```

### Usage in Components

**File:** [src/components/feed/FeedContainer.tsx](src/components/feed/FeedContainer.tsx)

```typescript
export function FeedContainer() {
  const {
    posts,
    lastPostRef,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteScroll({
    limit: 10,
    filter: 'all',
    sort: 'newest',
  });

  if (isLoading) {
    return <LoadingSkeleton count={5} />;
  }

  if (isError) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="feed-container">
      {/* Render posts */}
      {posts.map((post, index) => {
        // Attach ref to last post (sentinel element)
        if (index === posts.length - 1) {
          return (
            <div key={post.id} ref={lastPostRef}>
              <PostCard post={post} />
            </div>
          );
        }

        return <PostCard key={post.id} post={post} />;
      })}

      {/* Loading indicator */}
      {isFetchingNextPage && (
        <div className="loading-more">
          <LoadingSpinner />
          <span>Loading more posts...</span>
        </div>
      )}

      {/* End of feed */}
      {!hasNextPage && posts.length > 0 && (
        <div className="end-of-feed">
          <p>You've reached the end!</p>
        </div>
      )}
    </div>
  );
}
```

### How Intersection Observer Works

```
┌──────────────────────────────────────────────────────────┐
│ Viewport (What user sees)                                │
│                                                           │
│  ┌─────────────┐                                         │
│  │  Post 7     │                                         │
│  └─────────────┘                                         │
│  ┌─────────────┐                                         │
│  │  Post 8     │                                         │
│  └─────────────┘                                         │
│  ┌─────────────┐                                         │
│  │  Post 9     │                                         │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
                    ↓ User scrolls down
┌──────────────────────────────────────────────────────────┐
│  ┌─────────────┐                                         │
│  │  Post 9     │                                         │
│  └─────────────┘                                         │
│  ┌─────────────┐                                         │
│  │  Post 10    │ ← Last post (sentinel)                 │
│  └─────────────┘                                         │
│                                                           │
│  [rootMargin: 200px]  ← Trigger zone                    │
│                                                           │
└──────────────────────────────────────────────────────────┘
                    ↓ Sentinel enters trigger zone
┌──────────────────────────────────────────────────────────┐
│ IntersectionObserver fires callback                      │
│ → fetchNextPage()                                        │
│ → Load posts 11-20                                       │
│ → Append to posts array                                  │
│ → Re-render with new posts                               │
└──────────────────────────────────────────────────────────┘
```

**Key parameters:**
```typescript
{
  rootMargin: '200px',  // Trigger 200px before visible
                        // Feels instant to user (prefetch)

  threshold: 0,          // How much of element must be visible
                        // 0 = any pixel, 1 = entire element
}
```

### Performance Characteristics

**Memory usage:**
```
10 posts/page × 50 pages = 500 posts in memory
Average post size: 2KB
Total memory: 500 × 2KB = 1MB (acceptable)

If memory becomes issue:
- Virtualize list (render only visible items)
- Implement "Load More" button after N pages
- Clear old pages when scrolling up
```

**Network efficiency:**
```
Without prefetch (rootMargin: 0):
  User scrolls → Sees last post → Fetch starts → Wait 500ms → New posts

With prefetch (rootMargin: 200px):
  User scrolls → Fetch starts 200px early → Posts ready when needed → No wait
```

---

## Cursor vs Offset Pagination {#cursor-vs-offset}

### The Problem with Offset Pagination

**Offset-based (traditional):**
```sql
-- Page 1 (offset 0)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 0;

-- Page 2 (offset 10)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 10;

-- Page 100 (offset 1000)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10 OFFSET 1000;
```

**Performance:**
```
Page 1:     Scan 0 rows,     skip 0,     return 10     ⚡ Fast (10ms)
Page 10:    Scan 100 rows,   skip 90,    return 10     ⚡ Fast (50ms)
Page 100:   Scan 1000 rows,  skip 990,   return 10     🐌 Slow (500ms)
Page 10000: Scan 100000 rows, skip 99990, return 10    💥 Very slow (30s)
```

**Data consistency issues:**

**Scenario 1: New item inserted before current page**
```
User on page 2 (posts 11-20)
↓
New post inserted at position 1
↓
Database shifts all items down
↓
User goes to page 3 (offset 20)
↓
Sees post 20 again (duplicate!)
```

**Scenario 2: Item deleted before current page**
```
User on page 2 (posts 11-20)
↓
Post 5 deleted
↓
Database shifts all items up
↓
User goes to page 3 (offset 20)
↓
Misses post 20 (skipped!)
```

### Cursor-Based Pagination (Solution)

**Concept:**
```
Instead of: "Give me 10 posts starting at position 100"
Use:        "Give me 10 posts after post ID 'p99'"
```

**Cursor format:**
```typescript
// Cursor is base64-encoded JSON
const cursor = {
  lastId: 'p42',
  timestamp: '2024-01-15T10:30:00Z',
};

const encoded = btoa(JSON.stringify(cursor));
// "eyJsYXN0SWQiOiJwNDIiLCJ0aW1lc3RhbXAiOiIyMDI0LTAxLTE1VDEwOjMwOjAwWiJ9"
```

**Backend Implementation:**

**File:** [server/server.js](server/server.js) (lines 120-200)

```javascript
app.get('/api/feed', (req, res) => {
  const { cursor, limit = 10, filter = 'all', sort = 'newest' } = req.query;

  const db = getDB();
  let posts = db.get('posts').value();

  // Apply filter
  if (filter === 'following') {
    const following = getFollowing(currentUserId);
    posts = posts.filter(p => following.includes(p.authorId));
  } else if (filter === 'liked') {
    const likedPostIds = getLikedPostIds(currentUserId);
    posts = posts.filter(p => likedPostIds.includes(p.id));
  }

  // Apply sort
  posts = applySorting(posts, sort);

  // ══════════════════════════════════════════════════════
  // Cursor Pagination Logic
  // ══════════════════════════════════════════════════════

  let startIndex = 0;

  if (cursor) {
    // Decode cursor
    const decodedCursor = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf-8')
    );
    const { lastId, timestamp } = decodedCursor;

    // Find starting point
    // Use timestamp for efficient filtering, then ID for exact match
    posts = posts.filter(post => {
      const postTime = new Date(post.createdAt).getTime();
      const cursorTime = new Date(timestamp).getTime();

      // Post must be older than cursor
      if (postTime < cursorTime) return true;
      if (postTime === cursorTime && post.id < lastId) return true;
      return false;
    });
  }

  // Get page of posts
  const paginatedPosts = posts.slice(0, parseInt(limit));
  const hasMore = posts.length > parseInt(limit);

  // Generate next cursor
  let nextCursor = null;
  if (hasMore && paginatedPosts.length > 0) {
    const lastPost = paginatedPosts[paginatedPosts.length - 1];
    const cursorData = {
      lastId: lastPost.id,
      timestamp: lastPost.createdAt,
    };
    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  // Enrich with author data
  const enrichedPosts = paginatedPosts.map(post => ({
    ...post,
    author: db.get('users').find({ id: post.authorId }).value(),
  }));

  res.json({
    posts: enrichedPosts,
    pagination: {
      nextCursor,
      hasMore,
    },
  });
});
```

**SQL equivalent (for production databases):**
```sql
-- First page (no cursor)
SELECT * FROM posts
ORDER BY created_at DESC, id DESC
LIMIT 10;

-- Returns: p100, p99, p98, ..., p91
-- Next cursor: { lastId: 'p91', timestamp: '2024-01-15T10:00:00Z' }

-- Second page (with cursor)
SELECT * FROM posts
WHERE (created_at, id) < ('2024-01-15T10:00:00Z', 'p91')
ORDER BY created_at DESC, id DESC
LIMIT 10;

-- Returns: p90, p89, p88, ..., p81
-- Uses index on (created_at, id) → O(log n) lookup
```

**Performance comparison:**

| Approach | Page 1 | Page 100 | Page 10,000 | Duplicates | Skips |
|----------|--------|----------|-------------|------------|-------|
| Offset   | 10ms   | 500ms    | 30s         | Yes        | Yes   |
| Cursor   | 10ms   | 10ms     | 10ms        | No         | No    |

**Why cursor is faster:**
```
Offset: Must scan all rows before offset
  → O(n) where n = offset

Cursor: Indexed lookup on (timestamp, id)
  → O(log n) where n = total rows
  → Constant time regardless of page number
```

### Handling Sort Changes

**Problem:**
```typescript
User viewing page 5 with sort="newest"
Cursor points to post from "newest" sort

User changes to sort="popular"
Cursor no longer valid! (different ordering)
```

**Solution:**
```typescript
const queryKey = ['feed', 'infinite', { limit, filter, sort }];
//                                      ↑ Sort in key

// When sort changes:
// - React Query sees different key
// - Starts fresh query (no cursor)
// - User gets correct first page
```

### Bi-directional Pagination

**Scrolling down (standard):**
```javascript
// Use "after" cursor
WHERE (created_at, id) < (cursor.timestamp, cursor.id)
ORDER BY created_at DESC
```

**Scrolling up (reverse):**
```javascript
// Use "before" cursor
WHERE (created_at, id) > (cursor.timestamp, cursor.id)
ORDER BY created_at ASC  // Note: Reversed!
```

---

## Search and Filtering {#search-filtering}

### Search Implementation

**File:** [src/components/feed/SearchBar.tsx](src/components/feed/SearchBar.tsx)

```typescript
import { useSearchFilterStore } from '@/store/searchFilterStore';
import { useEffect } from 'react';

export function SearchBar() {
  const searchQuery = useSearchFilterStore(state => state.searchQuery);
  const setSearchQuery = useSearchFilterStore(state => state.setSearchQuery);
  const setDebouncedQuery = useSearchFilterStore(state => state.setDebouncedQuery);
  const clearSearch = useSearchFilterStore(state => state.clearSearch);

  // ══════════════════════════════════════════════════════
  // Debounce search query (300ms)
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, setDebouncedQuery]);

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search posts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            clearSearch();
          }
        }}
        aria-label="Search posts"
      />

      {searchQuery && (
        <button
          onClick={clearSearch}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

**Why debounce?**
```
Without debounce:
  User types "react"
  → r (API call)
  → re (API call)
  → rea (API call)
  → reac (API call)
  → react (API call)
  Total: 5 API calls

With 300ms debounce:
  User types "react" (takes ~500ms)
  → Wait 300ms after last keystroke
  → react (API call)
  Total: 1 API call (saved 4 calls!)
```

### Search Hook

**File:** [src/hooks/useSearchPosts.ts](src/hooks/useSearchPosts.ts)

```typescript
import { useQuery } from '@tanstack/react-query';
import { feedApi } from '@/services/api';
import { useSearchFilterStore } from '@/store/searchFilterStore';

export function useSearchPosts() {
  const debouncedQuery = useSearchFilterStore(state => state.debouncedQuery);
  const activeFilter = useSearchFilterStore(state => state.activeFilter);
  const activeSort = useSearchFilterStore(state => state.activeSort);

  return useQuery({
    queryKey: ['search', { query: debouncedQuery, filter: activeFilter, sort: activeSort }],

    queryFn: async () => {
      if (!debouncedQuery) {
        return [];
      }

      const results = await feedApi.searchPosts(debouncedQuery, activeFilter, activeSort);
      return results;
    },

    enabled: debouncedQuery.length > 0, // Only search if query exists
    staleTime: 30000, // 30 seconds (search results change frequently)
  });
}
```

### Backend Search

**File:** [server/server.js](server/server.js)

```javascript
app.get('/api/search', (req, res) => {
  const { q: query, filter = 'all', sort = 'newest' } = req.query;

  if (!query || query.length < 2) {
    return res.status(400).json({
      error: 'Query must be at least 2 characters',
    });
  }

  const db = getDB();
  let posts = db.get('posts').value();

  // ══════════════════════════════════════════════════════
  // Full-Text Search (naive implementation)
  // Production: Use Elasticsearch, Algolia, or database FTS
  // ══════════════════════════════════════════════════════
  const searchTerms = query.toLowerCase().split(/\s+/);

  posts = posts.filter(post => {
    const searchableText = [
      post.content,
      post.author?.name,
      post.author?.username,
    ].join(' ').toLowerCase();

    // All search terms must match
    return searchTerms.every(term => searchableText.includes(term));
  });

  // Apply filter (all/following/liked)
  posts = applyFilter(posts, filter, currentUserId);

  // Apply sort
  posts = applySorting(posts, sort);

  // Enrich with author
  const enrichedPosts = posts.map(post => ({
    ...post,
    author: db.get('users').find({ id: post.authorId }).value(),
  }));

  res.json(enrichedPosts);
});
```

**For production search:**
```typescript
// Use dedicated search engine
import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: 'http://localhost:9200' });

// Index posts
await client.index({
  index: 'posts',
  document: {
    id: post.id,
    content: post.content,
    authorId: post.authorId,
    createdAt: post.createdAt,
  },
});

// Search with relevance scoring
const result = await client.search({
  index: 'posts',
  query: {
    multi_match: {
      query: searchQuery,
      fields: ['content^2', 'author.name'], // Boost content matches
    },
  },
  sort: [
    { _score: 'desc' },      // Relevance
    { createdAt: 'desc' },   // Recency
  ],
});
```

### Filter Implementation

**File:** [src/components/feed/FilterButtons.tsx](src/components/feed/FilterButtons.tsx)

```typescript
export function FilterButtons() {
  const activeFilter = useSearchFilterStore(state => state.activeFilter);
  const setActiveFilter = useSearchFilterStore(state => state.setActiveFilter);

  const filters = [
    { value: 'all', label: 'All Posts' },
    { value: 'following', label: 'Following' },
    { value: 'liked', label: 'Liked' },
  ] as const;

  return (
    <div className="filter-buttons">
      {filters.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setActiveFilter(value)}
          className={activeFilter === value ? 'active' : ''}
          aria-pressed={activeFilter === value}
        >
          {label}
          {activeFilter === value && <span>✓</span>}
        </button>
      ))}
    </div>
  );
}
```

### Sort Implementation

**Sorting algorithms:**

**1. Newest (Chronological):**
```javascript
posts.sort((a, b) => {
  const dateA = new Date(a.createdAt).getTime();
  const dateB = new Date(b.createdAt).getTime();
  return dateB - dateA; // Descending (newest first)
});
```

**2. Popular (Most Likes):**
```javascript
posts.sort((a, b) => b.likeCount - a.likeCount);
```

**3. Trending (Time-weighted Score):**
```javascript
function calculateTrendingScore(post) {
  const ageInHours = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
  const agePenalty = ageInHours / 24; // Lose 1 point per day

  return (
    post.likeCount * 2 +       // Likes worth 2 points
    post.commentCount * 1 +    // Comments worth 1 point
    post.shareCount * 3 -      // Shares worth 3 points
    agePenalty                 // Older posts penalized
  );
}

posts.sort((a, b) => {
  return calculateTrendingScore(b) - calculateTrendingScore(a);
});
```

**Example trending scores:**
```
Post A: 50 likes, 20 comments, 5 shares, 2 hours old
Score = 50*2 + 20*1 + 5*3 - (2/24) = 100 + 20 + 15 - 0.08 = 134.92

Post B: 100 likes, 10 comments, 2 shares, 48 hours old
Score = 100*2 + 10*1 + 2*3 - (48/24) = 200 + 10 + 6 - 2 = 214

Post C: 30 likes, 15 comments, 3 shares, 1 hour old
Score = 30*2 + 15*1 + 3*3 - (1/24) = 60 + 15 + 9 - 0.04 = 83.96

Ranking: B (214) > A (134.92) > C (83.96)
```

---

## Data Prefetching {#data-prefetching}

### Why Prefetch?

**Without prefetching:**
```
User hovers over post → Moves mouse → Clicks
                                      ↓
                                  Fetch data (500ms)
                                      ↓
                                  Show page

Wait time: 500ms (noticeable lag)
```

**With prefetching:**
```
User hovers over post → Start fetch (background)
                      ↓
                  Data ready (500ms)
                      ↓
User clicks       → Show page immediately

Wait time: 0ms (instant!)
```

### Prefetch Strategies

**1. Hover-based Prefetch:**
```typescript
<PostCard
  post={post}
  onMouseEnter={() => {
    // Prefetch on hover
    queryClient.prefetchQuery({
      queryKey: ['post', post.id],
      queryFn: () => feedApi.getPost(post.id),
    });

    // Prefetch author
    queryClient.prefetchQuery({
      queryKey: ['user', post.authorId],
      queryFn: () => userApi.getProfile(post.authorId),
    });

    // Prefetch comments (if any)
    if (post.commentCount > 0) {
      queryClient.prefetchQuery({
        queryKey: ['comments', post.id],
        queryFn: () => feedApi.getComments(post.id),
      });
    }
  }}
  onClick={() => navigate(`/post/${post.id}`)}
/>
```

**2. Viewport-based Prefetch:**
```typescript
// Prefetch posts in viewport
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const postId = entry.target.dataset.postId;
        queryClient.prefetchQuery({
          queryKey: ['post', postId],
          queryFn: () => feedApi.getPost(postId),
        });
      }
    });
  },
  { rootMargin: '100px' } // Prefetch 100px before visible
);
```

**3. Link-based Prefetch:**
```typescript
import { Link } from 'react-router-dom';

<Link
  to={`/post/${post.id}`}
  onMouseEnter={() => {
    // Prefetch route data
    queryClient.prefetchQuery({
      queryKey: ['post', post.id],
      queryFn: () => feedApi.getPost(post.id),
    });
  }}
>
  View Post
</Link>
```

**4. Predictive Prefetch:**
```typescript
// After user likes a post, prefetch related posts
async function onLikeSuccess(post: Post) {
  // Prefetch posts from same author
  queryClient.prefetchQuery({
    queryKey: ['userPosts', post.authorId],
    queryFn: () => feedApi.getUserPosts(post.authorId),
  });

  // Prefetch similar posts (by tags/category)
  if (post.tags) {
    queryClient.prefetchQuery({
      queryKey: ['relatedPosts', post.id],
      queryFn: () => feedApi.getRelatedPosts(post.id),
    });
  }
}
```

### Prefetch Best Practices

**1. Don't over-prefetch:**
```typescript
// ❌ BAD: Prefetch everything
posts.forEach(post => {
  queryClient.prefetchQuery(['post', post.id], ...);
  queryClient.prefetchQuery(['comments', post.id], ...);
  queryClient.prefetchQuery(['user', post.authorId], ...);
});
// Result: 100 posts × 3 requests = 300 requests!

// ✅ GOOD: Prefetch only visible posts
visiblePosts.slice(0, 5).forEach(post => {
  queryClient.prefetchQuery(['post', post.id], ...);
});
// Result: 5 posts × 1 request = 5 requests
```

**2. Use staleTime:**
```typescript
// Prefetch with short stale time
queryClient.prefetchQuery({
  queryKey: ['post', postId],
  queryFn: () => feedApi.getPost(postId),
  staleTime: 30000, // Only valid for 30 seconds
});

// User might not click within 30s
// Data will refetch if stale when actually needed
```

**3. Prioritize critical data:**
```typescript
// High priority: Data needed immediately
await queryClient.prefetchQuery(['post', postId], ...);

// Low priority: Nice to have (fire and forget)
queryClient.prefetchQuery(['relatedPosts', postId], ...).catch(() => {});
```

**4. Abort on navigation:**
```typescript
useEffect(() => {
  const abortController = new AbortController();

  queryClient.prefetchQuery({
    queryKey: ['post', postId],
    queryFn: ({ signal }) => feedApi.getPost(postId, { signal }),
    signal: abortController.signal,
  });

  return () => {
    abortController.abort(); // Cancel if user navigates away
  };
}, [postId]);
```

### Measuring Prefetch Impact

```typescript
// Track prefetch effectiveness
let prefetchHits = 0;
let prefetchMisses = 0;

queryClient.setQueryDefaults(['post'], {
  onSuccess: (data, query) => {
    if (query.state.dataUpdatedAt === query.state.fetchingAt) {
      prefetchMisses++; // Fresh fetch
    } else {
      prefetchHits++; // Used prefetched data
    }

    const hitRate = (prefetchHits / (prefetchHits + prefetchMisses)) * 100;
    console.log(`Prefetch hit rate: ${hitRate.toFixed(1)}%`);
  },
});

// Target: 70%+ hit rate
// If lower: Adjust prefetch triggers
```

---

**End of Part 4**

**Next:** Part 5 will cover Resilience & Error Handling (error classification, retry logic, circuit breaker, graceful degradation).

**Files to study before Part 5:**
1. `src/utils/errorHandling.ts` - Error handling system (762 lines)
2. `src/hooks/useRetry.ts` - Manual retry hook
3. `src/services/api.ts` - Axios interceptors
