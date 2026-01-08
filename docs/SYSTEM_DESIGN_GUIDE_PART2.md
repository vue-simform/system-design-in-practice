# System Design in Action: Building a Production-Ready News Feed

## Part 2: User Journey and State Management

> **Deep dive into request flow, state management architecture, and React Query patterns**

---

## Table of Contents (Part 2)

5. [User Journey: From Click to Response](#user-journey)
6. [State Management Strategy](#state-management-strategy)
7. [React Query Deep Dive](#react-query-deep-dive)
8. [Zustand for Client State](#zustand-client-state)

---

## User Journey: From Click to Response {#user-journey}

### The Complete Flow of a Like Action

Let's trace what happens when a user clicks the like button on a post, millisecond by millisecond.

**Timeline:**
```
T=0ms     → User clicks ❤️ button
T=1ms     → Event handler fires
T=2ms     → Optimistic update applied (UI updates)
T=3ms     → Cache layers updated (memory)
T=10ms    → IndexedDB write initiated
T=15ms    → Network request sent
T=500ms   → Server responds (success or error)
T=501ms   → Final state reconciled
```

### Step 1: User Interaction (Component Layer)

**File:** [src/components/feed/LikeButton.tsx](src/components/feed/LikeButton.tsx)

```typescript
interface LikeButtonProps {
  post: Post;
}

export function LikeButton({ post }: LikeButtonProps) {
  const { currentUserId } = useAuth();
  const { mutate: toggleLike, isPending } = useLikePost();

  const isLiked = post.likes?.some(like => like.userId === currentUserId);
  const likeCount = post.likeCount || 0;

  const handleClick = () => {
    toggleLike({
      postId: post.id,
      userId: currentUserId,
      isLiked: isLiked,
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={isLiked ? 'Unlike post' : 'Like post'}
      aria-pressed={isLiked}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg
        transition-all duration-200
        ${isLiked ? 'text-red-500' : 'text-gray-500'}
        ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}
      `}
    >
      {/* Heart icon with animation */}
      <svg
        className={`w-6 h-6 transition-transform ${isPending ? 'scale-110' : ''}`}
        fill={isLiked ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>

      {/* Like count */}
      <span className="font-medium">{likeCount}</span>

      {/* Screen reader only text */}
      <span className="sr-only">
        {isLiked ? 'Unlike' : 'Like'} this post
      </span>
    </button>
  );
}
```

**What's happening:**
1. Component receives `post` prop with current state
2. Checks if current user has already liked (`isLiked`)
3. On click, calls `toggleLike` mutation
4. Button shows pending state during network request
5. Accessibility: ARIA labels, keyboard support, screen reader text

### Step 2: Business Logic (Hook Layer)

**File:** [src/hooks/useLikePost.ts](src/hooks/useLikePost.ts) (296 lines)

```typescript
interface UseLikePostParams {
  postId: string;
  userId: string;
  isLiked: boolean;
}

export function useLikePost() {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { addToast } = useToast();

  return useOptimisticMutation<void, UseLikePostParams>({
    // Unique key for this mutation
    mutationKey: ['likePost'],

    // Optimistic update function (runs BEFORE API call)
    onOptimistic: (oldData: InfiniteData<FeedResponse>, variables) => {
      const { postId, userId, isLiked } = variables;

      return {
        ...oldData,
        pages: oldData.pages.map(page => ({
          ...page,
          posts: page.posts.map(post => {
            if (post.id !== postId) return post;

            // Toggle like state
            if (isLiked) {
              // Unlike: Remove current user's like
              return {
                ...post,
                likes: post.likes?.filter(like => like.userId !== userId) || [],
                likeCount: Math.max(0, post.likeCount - 1),
                isLiked: false,
              };
            } else {
              // Like: Add current user's like
              return {
                ...post,
                likes: [
                  ...(post.likes || []),
                  { id: `temp-${Date.now()}`, userId, postId, createdAt: new Date().toISOString() }
                ],
                likeCount: post.likeCount + 1,
                isLiked: true,
              };
            }
          }),
        })),
      };
    },

    // Actual API call
    mutationFn: async ({ postId, userId, isLiked }: UseLikePostParams) => {
      // Check if offline
      if (!isOnline) {
        // Enqueue to offline queue for later sync
        await enqueueAction(isLiked ? 'UNLIKE_POST' : 'LIKE_POST', {
          postId,
          userId,
        });

        addToast({
          type: 'info',
          title: 'Offline',
          message: 'Your like will sync when you\'re back online',
          duration: 3000,
        });

        return; // Don't make API call
      }

      // Online: Make API call
      if (isLiked) {
        // Unlike
        await feedApi.unlikePost(postId, userId);
      } else {
        // Like
        await feedApi.likePost(postId, userId);
      }
    },

    // Success callback
    onSuccess: () => {
      // Invalidate related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });

      addToast({
        type: 'success',
        title: 'Success',
        message: isLiked ? 'Post unliked' : 'Post liked',
        duration: 2000,
      });
    },

    // Error callback (rollback optimistic update)
    onError: (error, variables, context) => {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update like. Please try again.',
        duration: 4000,
        action: {
          label: 'Retry',
          onClick: () => toggleLike(variables),
        },
      });
    },

    // Query key to update optimistically
    queryKey: ['feed', 'infinite'],
  });
}
```

**What's happening:**
1. **Optimistic Update (onOptimistic):**
   - Immediately updates UI with expected result
   - Modifies cached data in React Query
   - User sees instant feedback (< 1ms)

2. **Offline Detection:**
   - Checks `navigator.onLine`
   - If offline, enqueue to offline queue
   - Show toast notification
   - Return early (no API call)

3. **API Call (mutationFn):**
   - If online, call appropriate endpoint
   - Handles both like and unlike
   - Respects network conditions

4. **Success Handling:**
   - Invalidate related queries
   - Trigger background refetch
   - Show success toast
   - Update global state

5. **Error Handling:**
   - Automatic rollback (React Query built-in)
   - Show error toast with retry option
   - Preserve user's intent

### Step 3: API Service Layer

**File:** [src/services/api.ts](src/services/api.ts)

```typescript
// API service with all network calls

import axios, { AxiosInstance, AxiosError } from 'axios';
import { classifyError, AppError } from '@/utils/errorHandling';

// Create Axios instance with defaults
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (add auth token, timing)
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp for request timing
    config.metadata = { startTime: Date.now() };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (error transformation, logging)
apiClient.interceptors.response.use(
  (response) => {
    // Log request duration
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);

    return response;
  },
  (error: AxiosError) => {
    // Transform to AppError
    const appError = classifyError(error);

    // Log error
    console.error('[API Error]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: appError.message,
    });

    return Promise.reject(appError);
  }
);

// Feed API endpoints
export const feedApi = {
  // Get feed with pagination
  getFeed: async (
    cursor?: string | null,
    limit = 10,
    filter = 'all',
    sort = 'newest'
  ): Promise<FeedResponse> => {
    const response = await apiClient.get('/api/feed', {
      params: { cursor, limit, filter, sort },
    });
    return response.data;
  },

  // Like a post
  likePost: async (postId: string, userId: string): Promise<void> => {
    await apiClient.post(`/api/posts/${postId}/like`, { userId });
  },

  // Unlike a post
  unlikePost: async (postId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/api/posts/${postId}/like`, {
      data: { userId },
    });
  },

  // Create post
  createPost: async (data: CreatePostData): Promise<Post> => {
    const response = await apiClient.post('/api/posts', data);
    return response.data;
  },

  // Add comment
  addComment: async (postId: string, data: CreateCommentData): Promise<Comment> => {
    const response = await apiClient.post(`/api/posts/${postId}/comments`, data);
    return response.data;
  },

  // Get comments
  getComments: async (postId: string): Promise<Comment[]> => {
    const response = await apiClient.get(`/api/posts/${postId}/comments`);
    return response.data;
  },

  // Search posts
  searchPosts: async (query: string, filter = 'all', sort = 'newest'): Promise<Post[]> => {
    const response = await apiClient.get('/api/search', {
      params: { q: query, filter, sort },
    });
    return response.data;
  },
};

// User API endpoints
export const userApi = {
  getProfile: async (userId: string): Promise<User> => {
    const response = await apiClient.get(`/api/users/${userId}`);
    return response.data;
  },

  getUserPosts: async (userId: string): Promise<Post[]> => {
    const response = await apiClient.get(`/api/users/${userId}/posts`);
    return response.data;
  },
};

// Analytics API endpoints
export const analyticsApi = {
  getOverview: async (period: '7d' | '30d' | '90d'): Promise<AnalyticsOverview> => {
    const response = await apiClient.get('/api/analytics/overview', {
      params: { period },
    });
    return response.data;
  },

  getEngagement: async (period: '7d' | '30d' | '90d'): Promise<TimeSeriesData[]> => {
    const response = await apiClient.get('/api/analytics/engagement', {
      params: { period },
    });
    return response.data;
  },

  getTopPosts: async (period: '7d' | '30d' | '90d', limit = 10): Promise<Post[]> => {
    const response = await apiClient.get('/api/analytics/top-posts', {
      params: { period, limit },
    });
    return response.data;
  },
};

export default apiClient;
```

**What's happening:**
1. **Axios Instance:**
   - Configured with base URL, timeout
   - Shared across all requests
   - Type-safe with TypeScript

2. **Request Interceptor:**
   - Adds auth token automatically
   - Adds timestamp for duration tracking
   - Centralized request modification

3. **Response Interceptor:**
   - Logs request duration
   - Transforms errors to AppError
   - Centralized error handling

4. **Organized Endpoints:**
   - Grouped by domain (feed, user, analytics)
   - Type-safe parameters and returns
   - Clear naming convention

### Step 4: Backend Processing

**File:** [server/server.js](server/server.js) (lines 450-485)

```javascript
// Like a post endpoint
server.post('/api/posts/:postId/like', (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;

  // Validation
  if (!userId) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'userId is required',
    });
  }

  const db = getDB();
  const post = db.get('posts').find({ id: postId }).value();

  if (!post) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Post not found',
    });
  }

  // Check if already liked
  const existingLike = db
    .get('likes')
    .find({ postId, userId })
    .value();

  if (existingLike) {
    return res.status(400).json({
      error: 'ALREADY_LIKED',
      message: 'Post already liked by this user',
    });
  }

  // Create like
  const newLike = {
    id: `l${Date.now()}`,
    postId,
    userId,
    createdAt: new Date().toISOString(),
  };

  db.get('likes').push(newLike).write();

  // Update post like count
  const updatedLikeCount = post.likeCount + 1;
  db.get('posts')
    .find({ id: postId })
    .assign({ likeCount: updatedLikeCount })
    .write();

  // Simulated latency (500ms)
  setTimeout(() => {
    res.status(200).json({
      success: true,
      likeCount: updatedLikeCount,
    });
  }, 500);
});
```

**What's happening:**
1. **Validation:** Check userId provided
2. **Existence Check:** Verify post exists
3. **Duplicate Check:** Prevent double-liking
4. **Create Like:** Add to likes table
5. **Update Count:** Increment post's likeCount
6. **Simulated Latency:** 500ms delay (realistic)
7. **Return Response:** Success with new count

### Complete Timeline Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│ User Clicks Like Button                                         │
│ ❤️ (white) → ❤️ (red)                                            │
│ Count: 42 → 43                                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓ T=0ms
┌─────────────────────────────────────────────────────────────────┐
│ Component Event Handler                                          │
│ - Extract postId, userId, isLiked                                │
│ - Call toggleLike({ postId, userId, isLiked })                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓ T=1ms
┌─────────────────────────────────────────────────────────────────┐
│ useLikePost Hook                                                 │
│ - Check if online (navigator.onLine)                             │
│ - Apply optimistic update to React Query cache                   │
│ - UI re-renders with new state (INSTANT FEEDBACK)                │
└─────────────────────────────────────────────────────────────────┘
                             ↓ T=2ms
┌─────────────────────────────────────────────────────────────────┐
│ Cache Layer Updates                                              │
│ L1 (Memory):    Updated ✓                                        │
│ L2 (IndexedDB): Write initiated (async)                          │
└─────────────────────────────────────────────────────────────────┘
                             ↓ T=3ms
┌──────────────────┬──────────────────────────────────────────────┐
│  If Online       │  If Offline                                   │
├──────────────────┼──────────────────────────────────────────────┤
│ API call via     │ Enqueue to offline queue                      │
│ feedApi.likePost │ - Store in IndexedDB                          │
│                  │ - Show toast: "Will sync when online"         │
│                  │ - Return (no API call)                        │
└──────────────────┴──────────────────────────────────────────────┘
                             ↓ T=15ms
┌─────────────────────────────────────────────────────────────────┐
│ Network Request (if online)                                      │
│ POST /api/posts/:postId/like                                     │
│ Traveling to server...                                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓ T=500ms
┌──────────────────┬──────────────────────────────────────────────┐
│  Success Case    │  Error Case                                   │
├──────────────────┼──────────────────────────────────────────────┤
│ - Keep optimistic│ - Rollback optimistic update                  │
│   update         │ - Restore previous state                      │
│ - Invalidate     │ - Show error toast with retry                 │
│   queries        │ - If offline: Keep in queue                   │
│ - Background     │ - If retryable: Exponential backoff           │
│   refetch        │ - If not: Mark as failed                      │
│ - Show success   │                                               │
│   toast          │                                               │
└──────────────────┴──────────────────────────────────────────────┘
                             ↓ T=501ms
┌─────────────────────────────────────────────────────────────────┐
│ Final State                                                      │
│ - User sees updated count (was instant at T=2ms)                 │
│ - Cache synchronized (all layers)                                │
│ - Database updated (server)                                      │
│ - Analytics tracked                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Insights

**1. Perceived Latency: < 5ms**
- User sees update at T=2ms
- Server response at T=500ms doesn't block UI
- Feels instant compared to traditional approach (500ms wait)

**2. Offline Support**
- No API call if offline
- Action queued for later sync
- User can continue using app
- Zero data loss

**3. Error Recovery**
- Automatic rollback on failure
- User-friendly error messages
- Retry mechanism with backoff
- Graceful degradation

**4. Cache Consistency**
- All layers updated
- Background refetch ensures freshness
- Invalidation strategy prevents stale data

---

## State Management Strategy {#state-management-strategy}

### The Problem: Too Many State Tools

Common anti-pattern in React apps:
```typescript
// ❌ BAD: Everything in Redux
const state = {
  posts: [],              // Server data (should be React Query)
  users: [],              // Server data (should be React Query)
  theme: 'light',         // Client state (could be Zustand)
  isModalOpen: false,     // Component state (should be useState)
  currentUser: null,      // Auth state (could be Context)
  searchQuery: '',        // Temporary state (should be useState)
};
```

**Problems:**
1. Massive boilerplate (actions, reducers, types)
2. Server data mixed with UI state
3. No automatic caching or refetching
4. Hard to reason about data flow
5. Poor TypeScript support

### Our Solution: Right Tool for the Job

```
┌──────────────────────────────────────────────────────────────┐
│                      STATE CATEGORIZATION                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ SERVER STATE (async, cacheable, shared)                      │
│ Tool: React Query                                            │
│ Examples: posts, users, comments, analytics                  │
│                                                               │
│ ─────────────────────────────────────────────────────────── │
│                                                               │
│ CLIENT STATE - GLOBAL (synchronous, persisted, shared)       │
│ Tool: Zustand                                                │
│ Examples: theme, settings, toast queue, search filters       │
│                                                               │
│ ─────────────────────────────────────────────────────────── │
│                                                               │
│ CLIENT STATE - LOCAL (temporary, component-scoped)           │
│ Tool: useState / useReducer                                  │
│ Examples: form inputs, modals, toggles, hover states         │
│                                                               │
│ ─────────────────────────────────────────────────────────── │
│                                                               │
│ AUTH STATE (global, rarely changes, needs provider)          │
│ Tool: React Context                                          │
│ Examples: current user, token, permissions                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Decision Tree

```
Is the data from an API?
  ↓ YES
  ├─ Use React Query
  │  - Automatic caching
  │  - Background refetching
  │  - Retry logic
  │  - Loading/error states
  │
  ↓ NO
  Is it shared across multiple components?
    ↓ YES
    ├─ Does it need to persist across sessions?
    │  ↓ YES → Use Zustand with persist middleware
    │  ↓ NO  → Use Zustand (memory only)
    │
    ↓ NO
    ├─ Is it authentication-related?
    │  ↓ YES → Use React Context
    │  ↓ NO  → Use useState/useReducer
    │
```

### Real Examples from Codebase

**Example 1: Posts (Server State → React Query)**
```typescript
// ✅ GOOD: React Query for server data
export function useFeedPosts() {
  return useInfiniteQuery({
    queryKey: ['feed', 'infinite'],
    queryFn: ({ pageParam }) => feedApi.getFeed(pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    staleTime: 60000, // 1 minute
    gcTime: 600000,   // 10 minutes
  });
}

// Usage in component
function FeedContainer() {
  const { data, fetchNextPage, hasNextPage } = useFeedPosts();
  // React Query handles: caching, loading, errors, refetching
}
```

**Example 2: Theme (Client State → Zustand)**
```typescript
// ✅ GOOD: Zustand for global UI state
const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'light' ? 'dark' : 'light'
      })),
    }),
    {
      name: 'settings-storage', // localStorage key
    }
  )
);

// Usage (works anywhere, even outside React)
function ThemeToggle() {
  const theme = useSettingsStore(state => state.theme);
  const toggleTheme = useSettingsStore(state => state.toggleTheme);
  // Zustand handles: persistence, reactivity, minimal re-renders
}
```

**Example 3: Modal State (Component State → useState)**
```typescript
// ✅ GOOD: useState for component-local state
function CreatePostForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');

  // Only this component cares about these values
  // No need for global state
}
```

**Example 4: Current User (Auth State → Context)**
```typescript
// ✅ GOOD: Context for auth (rarely changes, needs provider)
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Context provides user to entire app tree
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## React Query Deep Dive {#react-query-deep-dive}

### Configuration

**File:** [src/config/queryClient.ts](src/config/queryClient.ts) (141 lines)

```typescript
import { QueryClient } from '@tanstack/react-query';

// Different TTLs for different data types
export const CACHE_CONFIG = {
  posts: {
    staleTime: 1 * 60 * 1000,  // 1 minute (posts change frequently)
    gcTime: 10 * 60 * 1000,    // 10 minutes in memory
  },
  users: {
    staleTime: 5 * 60 * 1000,  // 5 minutes (profiles rarely change)
    gcTime: 30 * 60 * 1000,    // 30 minutes in memory
  },
  comments: {
    staleTime: 30 * 1000,       // 30 seconds (very dynamic)
    gcTime: 5 * 60 * 1000,      // 5 minutes in memory
  },
};

// Smart retry logic based on error type
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const appError = error as AppError;

  // Don't retry client errors (4xx)
  if (appError.type === 'VALIDATION' ||
      appError.type === 'AUTHENTICATION' ||
      appError.type === 'NOT_FOUND') {
    return false;
  }

  // Retry network errors up to 3 times
  if (appError.type === 'NETWORK') {
    return failureCount < 3;
  }

  // Retry server errors up to 2 times
  if (appError.type === 'SERVER') {
    return failureCount < 2;
  }

  // Default: 1 retry
  return failureCount < 1;
}

// Global Query Client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Caching
      staleTime: CACHE_CONFIG.posts.staleTime,
      gcTime: CACHE_CONFIG.posts.gcTime,

      // Retry
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => {
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
        const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
        return baseDelay + jitter;
      },

      // Refetching
      refetchOnWindowFocus: false, // Don't refetch on tab focus (annoying)
      refetchOnReconnect: true,    // Refetch when back online
      refetchOnMount: false,       // Use cache on mount

      // Offline
      networkMode: 'offlineFirst', // Works offline with cache
    },

    mutations: {
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
      networkMode: 'offlineFirst',
    },
  },
});

// Persist successful queries to IndexedDB
queryClient.getQueryCache().config.onSuccess = (data, query) => {
  if (query.queryKey[0] === 'feed' && query.queryKey[1] === 'infinite') {
    // Cache posts to IndexedDB
    const pages = (data as InfiniteData<FeedResponse>).pages;
    const allPosts = pages.flatMap(page => page.posts);
    cachePosts(allPosts).catch(() => {}); // Fire and forget
  }
};
```

### All Queries in the App

**1. Feed Queries:**
```typescript
// Infinite scroll feed
['feed', 'infinite', { limit: 10, filter: 'all', sort: 'newest' }]

// Search results
['search', { query: 'react', filter: 'all', sort: 'newest' }]
```

**2. Post Queries:**
```typescript
// Single post
['post', postId]

// Post comments
['comments', postId]
```

**3. User Queries:**
```typescript
// User profile
['user', userId]

// User's posts
['userPosts', userId]
```

**4. Analytics Queries:**
```typescript
['analytics', 'overview', period]    // period: '7d' | '30d' | '90d'
['analytics', 'engagement', period]
['analytics', 'topPosts', period, limit]
['analytics', 'activity', period]
```

### Query Key Structure

```typescript
// Pattern: [domain, type, ...params]

// Examples:
['feed', 'infinite']                    // All posts (infinite scroll)
['feed', 'infinite', { filter: 'liked' }] // Filtered posts
['post', 'p123']                        // Single post
['user', 'u456']                        // User profile
['analytics', 'overview', '7d']         // Analytics (7 days)
```

**Why this structure?**
- Hierarchical invalidation: `['feed']` invalidates all feed queries
- Easy to reason about: Clear domain separation
- Type-safe: Can generate keys from types
- Debuggable: Shows in React Query DevTools

### Mutations in the App

**1. Post Mutations:**
```typescript
// Create post
useMutation({
  mutationFn: (data: CreatePostData) => feedApi.createPost(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  },
});

// Like/Unlike post
useMutation({
  mutationFn: ({ postId, isLiked }: LikeParams) =>
    isLiked ? feedApi.unlikePost(postId) : feedApi.likePost(postId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['post', postId] });
  },
});
```

**2. Comment Mutations:**
```typescript
// Add comment
useMutation({
  mutationFn: (data: CreateCommentData) =>
    feedApi.addComment(data.postId, data),
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
  },
});
```

---

## Zustand for Client State {#zustand-client-state}

### Why Zustand Over Redux?

**Bundle Size:**
```
Redux:        15KB (redux + react-redux + toolkit)
Zustand:      1KB  (15x smaller!)
```

**Boilerplate Comparison:**
```typescript
// Redux: ~50 lines for simple counter
// ❌ Actions
const INCREMENT = 'INCREMENT';
const increment = () => ({ type: INCREMENT });

// ❌ Reducer
const counterReducer = (state = { count: 0 }, action) => {
  switch (action.type) {
    case INCREMENT:
      return { ...state, count: state.count + 1 };
    default:
      return state;
  }
};

// ❌ Store
const store = createStore(counterReducer);

// ❌ Provider
<Provider store={store}>
  <App />
</Provider>

// ❌ Component
const count = useSelector(state => state.count);
const dispatch = useDispatch();
dispatch(increment());

//──────────────────────────────────────────────────

// Zustand: 5 lines for same counter
// ✅ Simple!
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// ✅ Component
const count = useStore(state => state.count);
const increment = useStore(state => state.increment);
```

### Zustand Stores in Our App

**File:** [src/store/searchFilterStore.ts](src/store/searchFilterStore.ts) (123 lines)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SearchFilterState {
  // Search
  searchQuery: string;
  debouncedQuery: string;
  isSearchFocused: boolean;
  showSearchResults: boolean;

  // Filters
  activeFilter: 'all' | 'following' | 'liked';
  activeSort: 'newest' | 'popular' | 'trending';

  // Actions
  setSearchQuery: (query: string) => void;
  setDebouncedQuery: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;
  setShowSearchResults: (show: boolean) => void;
  setActiveFilter: (filter: 'all' | 'following' | 'liked') => void;
  setActiveSort: (sort: 'newest' | 'popular' | 'trending') => void;
  clearSearch: () => void;
}

export const useSearchFilterStore = create<SearchFilterState>()(
  persist(
    (set) => ({
      // Initial state
      searchQuery: '',
      debouncedQuery: '',
      isSearchFocused: false,
      showSearchResults: false,
      activeFilter: 'all',
      activeSort: 'newest',

      // Actions
      setSearchQuery: (query) => set({ searchQuery: query }),

      setDebouncedQuery: (query) => set({
        debouncedQuery: query,
        showSearchResults: query.length > 0,
      }),

      setSearchFocused: (focused) => set({ isSearchFocused: focused }),

      setShowSearchResults: (show) => set({ showSearchResults: show }),

      setActiveFilter: (filter) => set({ activeFilter: filter }),

      setActiveSort: (sort) => set({ activeSort: sort }),

      clearSearch: () => set({
        searchQuery: '',
        debouncedQuery: '',
        showSearchResults: false,
      }),
    }),
    {
      name: 'search-filter-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),

      // Only persist filter/sort (not temporary search state)
      partialize: (state) => ({
        activeFilter: state.activeFilter,
        activeSort: state.activeSort,
      }),
    }
  )
);

// Selectors (memoized, prevent unnecessary re-renders)
export const selectSearchQuery = (state: SearchFilterState) => state.searchQuery;
export const selectDebouncedQuery = (state: SearchFilterState) => state.debouncedQuery;
export const selectActiveFilter = (state: SearchFilterState) => state.activeFilter;
export const selectActiveSort = (state: SearchFilterState) => state.activeSort;
```

**Features:**
1. **Persistence:** `activeFilter` and `activeSort` saved to localStorage
2. **Partial Persistence:** Temporary state (searchQuery) not persisted
3. **Selectors:** Memoized selectors for performance
4. **Type-Safe:** Full TypeScript support
5. **Minimal Re-renders:** Components only re-render when their selected state changes

**Usage:**
```typescript
function SearchBar() {
  // Only re-renders when searchQuery changes
  const searchQuery = useSearchFilterStore(selectSearchQuery);
  const setSearchQuery = useSearchFilterStore(state => state.setSearchQuery);

  return (
    <input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  );
}

function FilterButtons() {
  // Only re-renders when activeFilter changes
  const activeFilter = useSearchFilterStore(selectActiveFilter);
  const setActiveFilter = useSearchFilterStore(state => state.setActiveFilter);

  return (
    <div>
      <button onClick={() => setActiveFilter('all')}>
        All {activeFilter === 'all' && '✓'}
      </button>
      <button onClick={() => setActiveFilter('following')}>
        Following {activeFilter === 'following' && '✓'}
      </button>
    </div>
  );
}
```

---

**End of Part 2**

**Next:** Part 3 will cover the Three-Layer Caching System in depth (React Query, IndexedDB, Service Worker coordination).

**Files to study before Part 3:**
1. `src/utils/indexedDBCache.ts` - IndexedDB implementation (546 lines)
2. `src/utils/cacheCoordinator.ts` - Multi-layer coordination (439 lines)
3. `public/service-worker.js` - Service Worker strategies (359 lines)
