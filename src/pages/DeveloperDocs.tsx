/**
 * Developer Documentation Page
 * 
 * A comprehensive, searchable reference for all features, hooks, utilities,
 * and components in this project. Designed for developers to quickly find
 * implementation patterns and code examples.
 * 
 * Features:
 * - Search functionality across all documentation
 * - Filter by category (Features, Hooks, Components, Utils)
 * - Expandable sections with code examples
 * - Status indicators (Completed/In Progress)
 * - Quick navigation sidebar
 * - Responsive design
 */

import { useState, useMemo } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DocItem {
  id: string;
  title: string;
  category: 'feature' | 'hook' | 'component' | 'utility' | 'concept';
  status: 'completed' | 'in-progress' | 'planned';
  description: string;
  keyPoints: string[];
  codeExample?: string;
  location?: string;
  relatedItems?: string[];
  tags: string[];
}

// ============================================================================
// DOCUMENTATION DATA
// ============================================================================

const DOCUMENTATION: DocItem[] = [
  // ===== FEATURES =====
  {
    id: 'offline-first',
    title: 'Offline-First Architecture',
    category: 'feature',
    status: 'completed',
    description: 'Complete offline functionality with automatic sync when connection is restored',
    keyPoints: [
      '✅ FIFO queue for offline mutations in IndexedDB',
      '✅ Automatic sync on reconnection with exponential backoff',
      '✅ Status UI showing queue statistics and sync progress',
      '✅ Manual sync trigger and action history',
      '✅ Sync handlers for CREATE_POST, LIKE_POST, ADD_COMMENT',
    ],
    location: 'utils/offlineQueue.ts, components/common/OfflineSyncStatus.tsx',
    tags: ['offline', 'sync', 'indexeddb', 'queue', 'resilience'],
    codeExample: `// Enqueue offline action
import { offlineQueueManager } from '@/utils/offlineQueue';

await offlineQueueManager.enqueue({
  type: 'CREATE_POST',
  payload: { content: 'Hello', authorId: '1' },
  timestamp: Date.now()
});

// Auto-sync on reconnection
window.addEventListener('online', () => {
  syncManager.syncQueue();
});`,
  },
  {
    id: 'error-handling',
    title: 'Graceful Error Handling',
    category: 'feature',
    status: 'completed',
    description: 'Smart error classification with retry logic and user-friendly recovery actions',
    keyPoints: [
      '✅ Error classification: Network, Server, Timeout, Validation, Auth',
      '✅ Exponential backoff with jitter (1s → 2s → 4s → 8s)',
      '✅ Specific error components: NetworkError, ServerError, NotFound',
      '✅ Error boundaries for graceful degradation',
      '✅ Contextual recovery actions for each error type',
    ],
    location: 'utils/errorHandling.ts, components/common/ErrorStates.tsx',
    tags: ['error', 'retry', 'resilience', 'ux'],
    codeExample: `// Classify and handle errors
import { classifyError, withRetry } from '@/utils/errorHandling';

const result = await withRetry(
  async () => await api.fetchPosts(),
  { maxRetries: 3, delay: 1000 }
);

const errorInfo = classifyError(error);
// { type: 'NETWORK', severity: 'HIGH', isRetryable: true }`,
  },
  {
    id: 'progressive-loading',
    title: 'Progressive Loading',
    category: 'feature',
    status: 'completed',
    description: 'Skeleton loaders, lazy images, and staggered animations for optimal perceived performance',
    keyPoints: [
      '✅ 5 skeleton variants with shimmer animation',
      '✅ Lazy image loading with Intersection Observer',
      '✅ Blur placeholder → fade-in animation',
      '✅ Staggered delays for multiple items',
      '✅ Priority-based rendering (high → medium → low)',
    ],
    location: 'components/common/LoadingSkeleton.tsx, components/common/LazyImage.tsx',
    tags: ['performance', 'loading', 'ux', 'animation'],
    codeExample: `// Use skeleton loader
<LoadingSkeleton variant="post" count={3} />

// Lazy load image
<LazyImage 
  src="large-image.jpg"
  alt="Description"
  placeholderType="shimmer"
/>`,
  },
  {
    id: 'state-persistence',
    title: 'State Persistence',
    category: 'feature',
    status: 'completed',
    description: 'Auto-save drafts and restore state across sessions with TTL management',
    keyPoints: [
      '✅ Generic localStorage/sessionStorage wrappers',
      '✅ Auto-save form drafts with debouncing',
      '✅ TTL-based expiration for stale data',
      '✅ Scroll position restoration',
      '✅ Type-safe storage with TypeScript generics',
    ],
    location: 'utils/statePersistence.ts, hooks/useDraftAutoSave.ts',
    tags: ['persistence', 'storage', 'drafts', 'ux'],
    codeExample: `// Auto-save draft
const { saveDraft, loadDraft, clearDraft } = useDraftAutoSave('post-draft');

// Save with TTL
savePersistentState('key', data, 24 * 60 * 60 * 1000); // 24 hours

// Load with expiration check
const data = loadPersistentState<MyType>('key');`,
  },
  {
    id: 'smart-retry',
    title: 'Smart Retry Logic',
    category: 'feature',
    status: 'completed',
    description: 'Circuit breaker pattern with exponential backoff and visual feedback',
    keyPoints: [
      '✅ Circuit breaker states: CLOSED, OPEN, HALF_OPEN',
      '✅ Failure threshold detection (5 failures or 50% error rate)',
      '✅ 60-second recovery timeout',
      '✅ Retry UI components with progress indicators',
      '✅ Per-endpoint circuit management',
    ],
    location: 'hooks/useRetry.ts, components/common/RetryStatus.tsx',
    tags: ['retry', 'circuit-breaker', 'resilience', 'patterns'],
    codeExample: `// Use retry hook
const { execute, status, retryCount } = useRetry({
  maxRetries: 3,
  enableCircuitBreaker: true
});

await execute(async () => await api.fetchData());

// Circuit breaker badge
<CircuitBreakerBadge state={circuitState} />`,
  },
  {
    id: 'optimistic-updates',
    title: 'Optimistic Updates',
    category: 'feature',
    status: 'completed',
    description: 'Instant UI feedback with automatic rollback on failure',
    keyPoints: [
      '✅ 0ms perceived latency for all mutations',
      '✅ Temp ID system for new entities',
      '✅ 4 conflict resolution strategies',
      '✅ Global tracking of optimistic operations',
      '✅ ARIA support for screen readers',
    ],
    location: 'utils/optimisticUpdates.ts, hooks/useOptimisticMutation.ts',
    tags: ['optimistic', 'ux', 'mutations', 'performance'],
    codeExample: `// Optimistic mutation
const mutation = useOptimisticMutation({
  mutationFn: api.likePost,
  optimisticUpdate: (cache, { postId }) => {
    const post = cache.getPost(postId);
    return { ...post, likes: post.likes + 1, isLiked: true };
  },
  rollback: (cache, snapshot) => {
    cache.setPost(snapshot);
  }
});`,
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    category: 'feature',
    status: 'completed',
    description: 'Comprehensive analytics with charts, metrics, and data export',
    keyPoints: [
      '✅ Overview metrics with trend indicators',
      '✅ Time-series charts (Recharts library)',
      '✅ Top posts table sorted by engagement',
      '✅ Period selector (7d, 30d, 90d)',
      '✅ Export as JSON/CSV',
    ],
    location: 'components/analytics/AnalyticsDashboard.tsx, hooks/useAnalytics.ts',
    tags: ['analytics', 'charts', 'metrics', 'reporting'],
    codeExample: `// Fetch analytics
const { data: overview } = useAnalyticsOverview('7d');
const { data: engagement } = useEngagementTimeSeries('7d');

// Export data
await exportAnalyticsData('30d', 'csv');`,
  },

  // ===== HOOKS =====
  {
    id: 'use-feed-posts',
    title: 'useFeedPosts',
    category: 'hook',
    status: 'completed',
    description: 'Infinite scroll feed with cursor-based pagination',
    keyPoints: [
      '✅ React Query infinite query',
      '✅ Cursor-based pagination',
      '✅ Automatic cache invalidation',
      '✅ Error handling with retry',
      '✅ Optimistic updates support',
    ],
    location: 'hooks/useFeedPosts.ts',
    tags: ['query', 'pagination', 'infinite-scroll'],
    codeExample: `const { 
  data, 
  fetchNextPage, 
  hasNextPage, 
  isLoading 
} = useFeedPosts();

const posts = data?.pages.flatMap(page => page.posts) ?? [];`,
  },
  {
    id: 'use-optimistic-mutation',
    title: 'useOptimisticMutation',
    category: 'hook',
    status: 'completed',
    description: 'Generic hook for optimistic updates with rollback',
    keyPoints: [
      '✅ TypeScript generics for type safety',
      '✅ Automatic rollback on error',
      '✅ Conflict resolution strategies',
      '✅ Global operation tracking',
      '✅ Success/error callbacks',
    ],
    location: 'hooks/useOptimisticMutation.ts',
    tags: ['mutation', 'optimistic', 'generic'],
    codeExample: `const mutation = useOptimisticMutation<Post, LikeParams>({
  mutationFn: api.likePost,
  queryKey: ['posts'],
  optimisticUpdate: (cache, { postId }) => {
    // Update cache immediately
  },
});`,
  },
  {
    id: 'use-infinite-scroll',
    title: 'useInfiniteScroll',
    category: 'hook',
    status: 'completed',
    description: 'Intersection Observer-based infinite scroll',
    keyPoints: [
      '✅ Configurable root margin',
      '✅ Auto-fetch on intersection',
      '✅ Loading state management',
      '✅ Works with React Query',
      '✅ Cleanup on unmount',
    ],
    location: 'hooks/useInfiniteScroll.ts',
    tags: ['scroll', 'intersection-observer', 'pagination'],
    codeExample: `const targetRef = useInfiniteScroll({
  onIntersect: fetchNextPage,
  enabled: hasNextPage && !isFetching,
  rootMargin: '200px'
});

<div ref={targetRef}>Loading more...</div>`,
  },
  {
    id: 'use-network-status',
    title: 'useNetworkStatus',
    category: 'hook',
    status: 'completed',
    description: 'Monitor online/offline status with React',
    keyPoints: [
      '✅ Real-time online/offline detection',
      '✅ Event listener cleanup',
      '✅ Initial state handling',
      '✅ Triggers sync on reconnection',
      '✅ Used across the app',
    ],
    location: 'hooks/useNetworkStatus.tsx',
    tags: ['network', 'online', 'offline'],
    codeExample: `const isOnline = useNetworkStatus();

{!isOnline && (
  <div className="offline-banner">
    You are offline. Changes will sync when reconnected.
  </div>
)}`,
  },
  {
    id: 'use-retry',
    title: 'useRetry',
    category: 'hook',
    status: 'completed',
    description: 'Manual retry control with circuit breaker',
    keyPoints: [
      '✅ Exponential backoff',
      '✅ Circuit breaker integration',
      '✅ Retry count tracking',
      '✅ Status management',
      '✅ Error history',
    ],
    location: 'hooks/useRetry.ts',
    tags: ['retry', 'error-handling', 'circuit-breaker'],
    codeExample: `const { execute, status, retryCount, reset } = useRetry({
  maxRetries: 3,
  initialDelay: 1000,
  enableCircuitBreaker: true
});

const result = await execute(() => api.fetchData());`,
  },
  {
    id: 'use-form-validation',
    title: 'useFormValidation',
    category: 'hook',
    status: 'completed',
    description: 'Reusable form validation with custom rules',
    keyPoints: [
      '✅ Field-level validation',
      '✅ Custom validation rules',
      '✅ Error state management',
      '✅ Touch state tracking',
      '✅ Form-level validation',
    ],
    location: 'hooks/useFormValidation.ts',
    tags: ['validation', 'forms', 'input'],
    codeExample: `const { values, errors, handleChange, validate } = useFormValidation({
  initialValues: { email: '', password: '' },
  rules: {
    email: (val) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val),
    password: (val) => val.length >= 8
  }
});`,
  },

  // ===== COMPONENTS =====
  {
    id: 'loading-skeleton',
    title: 'LoadingSkeleton',
    category: 'component',
    status: 'completed',
    description: 'Animated skeleton loaders for various content types',
    keyPoints: [
      '✅ 5 variants: post, comment, profile, list, grid',
      '✅ Shimmer gradient animation',
      '✅ Staggered delays',
      '✅ Dark mode support',
      '✅ Accessibility labels',
    ],
    location: 'components/common/LoadingSkeleton.tsx',
    tags: ['loading', 'skeleton', 'ui'],
    codeExample: `<LoadingSkeleton variant="post" count={3} />
<LoadingSkeleton variant="comment" count={5} />
<LoadingSkeleton variant="profile" />`,
  },
  {
    id: 'error-boundary',
    title: 'ErrorBoundary',
    category: 'component',
    status: 'completed',
    description: 'React error boundary with fallback UI',
    keyPoints: [
      '✅ Catches React rendering errors',
      '✅ Custom fallback UI',
      '✅ Error logging',
      '✅ Reset functionality',
      '✅ Dev mode details',
    ],
    location: 'components/common/ErrorBoundary.tsx',
    tags: ['error', 'boundary', 'react'],
    codeExample: `<ErrorBoundary fallback={<ErrorFallback />}>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary 
  fallback={(error, reset) => (
    <CustomError error={error} onRetry={reset} />
  )}
>
  <YourComponent />
</ErrorBoundary>`,
  },
  {
    id: 'toast',
    title: 'Toast Notifications',
    category: 'component',
    status: 'completed',
    description: 'Global toast notification system',
    keyPoints: [
      '✅ 4 types: success, error, warning, info',
      '✅ Auto-dismiss with timer',
      '✅ Manual dismiss',
      '✅ Stacking multiple toasts',
      '✅ Zustand store integration',
    ],
    location: 'components/common/Toast.tsx, store/toastStore.ts',
    tags: ['toast', 'notification', 'ui'],
    codeExample: `import { useToast } from '@/hooks/useToast';

const toast = useToast();

toast.success('Post created!');
toast.error('Failed to save');
toast.info('Network restored', { duration: 5000 });`,
  },
  {
    id: 'cache-metrics',
    title: 'CacheMetrics',
    category: 'component',
    status: 'completed',
    description: 'Real-time cache performance dashboard',
    keyPoints: [
      '✅ Multi-layer cache visibility (L1, L2, L3)',
      '✅ Hit rate calculation',
      '✅ Storage usage tracking',
      '✅ Clear cache controls',
      '✅ Auto-refresh metrics',
    ],
    location: 'components/common/CacheMetrics.tsx',
    tags: ['cache', 'performance', 'monitoring'],
    codeExample: `// Add to your dashboard
<CacheMetrics />

// Shows:
// - L1: React Query (memory)
// - L2: IndexedDB (persistent)
// - L3: Service Worker (static assets)`,
  },
  {
    id: 'optimistic-ui',
    title: 'Optimistic UI Components',
    category: 'component',
    status: 'completed',
    description: 'Visual feedback for optimistic updates',
    keyPoints: [
      '✅ OptimisticIndicator: Shows pending state',
      '✅ RollbackToast: Undo failed operations',
      '✅ OptimisticStats: Global operation tracking',
      '✅ PendingUpdatesList: View queue',
      '✅ FailedUpdatesList: Retry failed ops',
    ],
    location: 'components/common/OptimisticUI.tsx',
    tags: ['optimistic', 'ui', 'feedback'],
    codeExample: `<OptimisticIndicator 
  isOptimistic={mutation.isPending}
  label="Saving..."
/>

<OptimisticStats />`,
  },

  // ===== UTILITIES =====
  {
    id: 'cache-coordinator',
    title: 'Cache Coordinator',
    category: 'utility',
    status: 'completed',
    description: 'Multi-layer cache coordination (L1, L2, L3)',
    keyPoints: [
      '✅ L1: React Query (memory)',
      '✅ L2: IndexedDB (persistent)',
      '✅ L3: Service Worker (static)',
      '✅ Hit rate tracking',
      '✅ Automatic cache coordination',
    ],
    location: 'utils/cacheCoordinator.ts',
    tags: ['cache', 'performance', 'coordination'],
    codeExample: `import { getCachePerformanceSummary } from '@/utils/cacheCoordinator';

const summary = await getCachePerformanceSummary();
// { totalRequests, hits, misses, hitRate, hitRatePercentage }`,
  },
  {
    id: 'indexeddb-cache',
    title: 'IndexedDB Cache',
    category: 'utility',
    status: 'completed',
    description: 'Persistent browser storage with TTL',
    keyPoints: [
      '✅ Store/retrieve from IndexedDB',
      '✅ TTL-based expiration',
      '✅ Stats tracking (hits/misses)',
      '✅ Automatic cleanup',
      '✅ Bulk operations',
    ],
    location: 'utils/indexedDBCache.ts',
    tags: ['indexeddb', 'cache', 'persistence'],
    codeExample: `import { saveToIndexedDB, loadFromIndexedDB } from '@/utils/indexedDBCache';

// Save with 1 hour TTL
await saveToIndexedDB('posts', data, 3600000);

// Load with expiration check
const cached = await loadFromIndexedDB('posts');`,
  },
  {
    id: 'validation',
    title: 'Validation Utilities',
    category: 'utility',
    status: 'completed',
    description: 'Common validation functions for forms and inputs',
    keyPoints: [
      '✅ Email validation',
      '✅ URL validation',
      '✅ Password strength',
      '✅ Length constraints',
      '✅ Custom validators',
    ],
    location: 'utils/validation.ts',
    tags: ['validation', 'forms', 'security'],
    codeExample: `import { isValidEmail, isValidURL, isStrongPassword } from '@/utils/validation';

if (!isValidEmail(email)) {
  setError('Invalid email format');
}

if (!isStrongPassword(password)) {
  setError('Password must be 8+ characters with numbers');
}`,
  },
  {
    id: 'performance',
    title: 'Performance Utilities',
    category: 'utility',
    status: 'completed',
    description: 'Performance optimization hooks and functions',
    keyPoints: [
      '✅ useDebounce: Delay state updates',
      '✅ useThrottle: Limit execution rate',
      '✅ useStableCallback: Memoized callbacks',
      '✅ measurePerformance: Timing wrapper',
      '✅ formatRelativeTime: "2m ago" formatting',
    ],
    location: 'utils/performance.tsx',
    tags: ['performance', 'optimization', 'hooks'],
    codeExample: `import { useDebounce, useThrottle, measurePerformance } from '@/utils/performance';

// Debounce search input
const debouncedSearch = useDebounce(searchTerm, 300);

// Throttle scroll handler
const throttledScroll = useThrottle(handleScroll, 100);

// Measure execution time
const result = measurePerformance('heavyCalc', () => {
  return complexCalculation();
});`,
  },
  {
    id: 'accessibility',
    title: 'Accessibility Utilities',
    category: 'utility',
    status: 'completed',
    description: 'A11y helpers for keyboard navigation and screen readers',
    keyPoints: [
      '✅ useFocusTrap: Trap focus in modals',
      '✅ useAriaAnnounce: Screen reader announcements',
      '✅ useKeyboardNavigation: Arrow key navigation',
      '✅ skipLinks: Skip to main content',
      '✅ ARIA attributes helpers',
    ],
    location: 'utils/accessibility.tsx',
    tags: ['accessibility', 'a11y', 'aria', 'keyboard'],
    codeExample: `import { useFocusTrap, useAriaAnnounce } from '@/utils/accessibility';

// Trap focus in modal
const modalRef = useFocusTrap<HTMLDivElement>(isOpen);

// Announce to screen readers
const announce = useAriaAnnounce();
announce('Post created successfully', 'polite');`,
  },

  // ===== SYSTEM DESIGN CONCEPTS =====
  {
    id: 'react-query',
    title: 'React Query Setup',
    category: 'concept',
    status: 'completed',
    description: 'Optimized React Query configuration for data fetching',
    keyPoints: [
      '✅ 5-minute stale time for most data',
      '✅ 30-minute garbage collection',
      '✅ Exponential backoff retry (1s, 2s, 4s)',
      '✅ Query key conventions',
      '✅ Devtools integration',
    ],
    location: 'config/queryClient.ts',
    tags: ['react-query', 'caching', 'config'],
    codeExample: `import { queryClient } from '@/config/queryClient';

// Query key convention
['posts', 'feed'] // All posts
['posts', postId] // Single post
['posts', 'search', query] // Search results
['analytics', 'overview', '7d'] // Analytics with period`,
  },
  {
    id: 'cursor-pagination',
    title: 'Cursor-Based Pagination',
    category: 'concept',
    status: 'completed',
    description: 'Scalable pagination using cursor instead of offset',
    keyPoints: [
      '✅ Avoids offset drift with new data',
      '✅ Consistent results during mutations',
      '✅ Better performance at scale',
      '✅ Used with infinite scroll',
      '✅ Cursor is encoded timestamp',
    ],
    location: 'hooks/useFeedPosts.ts, server/server.js',
    tags: ['pagination', 'performance', 'scalability'],
    codeExample: `// Response format
{
  posts: [...],
  pagination: {
    nextCursor: '2024-12-11T10:30:00Z',
    hasMore: true,
    total: 150
  }
}

// Use in infinite query
getNextPageParam: (lastPage) => 
  lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined`,
  },
  {
    id: 'code-splitting',
    title: 'Code Splitting Strategy',
    category: 'concept',
    status: 'completed',
    description: 'Lazy loading routes and heavy components',
    keyPoints: [
      '✅ Route-based splitting (Profile, Analytics)',
      '✅ Component-based splitting (heavy libs)',
      '✅ Suspense boundaries for loading states',
      '✅ Bundle size analysis with Rollup Visualizer',
      '✅ Reduced initial bundle size',
    ],
    location: 'App.tsx, vite.config.ts',
    tags: ['performance', 'lazy-loading', 'bundles'],
    codeExample: `// Route-based splitting
const Profile = lazy(() => import('./pages/Profile'));
const Analytics = lazy(() => import('./components/analytics/AnalyticsDashboard'));

<Suspense fallback={<LoadingSkeleton />}>
  <Routes>
    <Route path="/profile/:id" element={<Profile />} />
    <Route path="/analytics" element={<Analytics />} />
  </Routes>
</Suspense>`,
  },
  {
    id: 'zustand-stores',
    title: 'Zustand State Management',
    category: 'concept',
    status: 'completed',
    description: 'Lightweight global state with Zustand',
    keyPoints: [
      '✅ Toast store for notifications',
      '✅ UI store for modal/panel state',
      '✅ Search/filter store with persistence',
      '✅ No boilerplate, simple API',
      '✅ DevTools integration',
    ],
    location: 'store/toastStore.ts, store/uiStore.ts, store/searchFilterStore.ts',
    tags: ['state-management', 'zustand', 'global-state'],
    codeExample: `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }))
    }),
    { name: 'my-store' }
  )
);

// Usage
const { count, increment } = useStore();`,
  },
  {
    id: 'service-worker',
    title: 'Service Worker & PWA',
    category: 'concept',
    status: 'completed',
    description: 'Offline support with Service Worker caching',
    keyPoints: [
      '✅ Cache static assets (JS, CSS, images)',
      '✅ Offline fallback page',
      '✅ Network-first for API calls',
      '✅ Cache-first for static files',
      '✅ PWA manifest for install',
    ],
    location: 'public/service-worker.js, utils/serviceWorkerRegistration.ts',
    tags: ['pwa', 'service-worker', 'offline', 'caching'],
    codeExample: `// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}

// Service worker strategy
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Network first for API
    event.respondWith(networkFirst(event.request));
  } else {
    // Cache first for static assets
    event.respondWith(cacheFirst(event.request));
  }
});`,
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DeveloperDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Filter documentation based on search and category
  const filteredDocs = useMemo(() => {
    return DOCUMENTATION.filter((doc) => {
      // Category filter
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          doc.title.toLowerCase().includes(query) ||
          doc.description.toLowerCase().includes(query) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          doc.keyPoints.some((point) => point.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [searchQuery, selectedCategory]);

  // Group by category
  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocItem[]> = {
      feature: [],
      hook: [],
      component: [],
      utility: [],
      concept: [],
    };

    filteredDocs.forEach((doc) => {
      groups[doc.category].push(doc);
    });

    return groups;
  }, [filteredDocs]);

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const expandAll = () => {
    setExpandedItems(new Set(filteredDocs.map((doc) => doc.id)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Developer Documentation
          </h1>
          <p className="text-gray-600">
            Comprehensive reference for all features, hooks, components, and utilities
          </p>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-2xl px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 border-b border-gray-200">
              {[
                { value: 'all', label: 'All' },
                { value: 'feature', label: 'Features' },
                { value: 'hook', label: 'Hooks' },
                { value: 'component', label: 'Components' },
                { value: 'utility', label: 'Utils' },
                { value: 'concept', label: 'Concepts' },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px ${
                    selectedCategory === cat.value
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Expand/Collapse Controls */}
            <div className="flex gap-2 text-sm">
              <button
                onClick={expandAll}
                className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:underline"
              >
                Expand All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={collapseAll}
                className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-gray-500">
            {filteredDocs.length} {filteredDocs.length === 1 ? 'item' : 'items'} found
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {filteredDocs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No documentation found matching your search.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Features */}
            {groupedDocs.feature.length > 0 && (
              <CategorySection
                title="Features"
                icon=""
                items={groupedDocs.feature}
                expandedItems={expandedItems}
                onToggle={toggleItem}
              />
            )}

            {/* Hooks */}
            {groupedDocs.hook.length > 0 && (
              <CategorySection
                title="React Hooks"
                icon=""
                items={groupedDocs.hook}
                expandedItems={expandedItems}
                onToggle={toggleItem}
              />
            )}

            {/* Components */}
            {groupedDocs.component.length > 0 && (
              <CategorySection
                title="Components"
                icon=""
                items={groupedDocs.component}
                expandedItems={expandedItems}
                onToggle={toggleItem}
              />
            )}

            {/* Utilities */}
            {groupedDocs.utility.length > 0 && (
              <CategorySection
                title="Utilities"
                icon=""
                items={groupedDocs.utility}
                expandedItems={expandedItems}
                onToggle={toggleItem}
              />
            )}

            {/* Concepts */}
            {groupedDocs.concept.length > 0 && (
              <CategorySection
                title="System Design Concepts"
                icon=""
                items={groupedDocs.concept}
                expandedItems={expandedItems}
                onToggle={toggleItem}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface CategorySectionProps {
  title: string;
  icon: string;
  items: DocItem[];
  expandedItems: Set<string>;
  onToggle: (id: string) => void;
}

function CategorySection({
  title,
  items,
  expandedItems,
  onToggle,
}: CategorySectionProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <DocCard
            key={item.id}
            item={item}
            isExpanded={expandedItems.has(item.id)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

interface DocCardProps {
  item: DocItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function DocCard({ item, isExpanded, onToggle }: DocCardProps) {
  const statusColors = {
    completed: 'bg-green-100 text-green-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    planned: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    completed: 'Completed',
    'in-progress': 'In Progress',
    planned: 'Planned',
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusColors[item.status]
              }`}
            >
              {statusLabels[item.status]}
            </span>
          </div>
          <p className="text-gray-600 text-sm">{item.description}</p>
          {item.location && (
            <p className="text-gray-500 text-xs mt-2">Location: {item.location}</p>
          )}
        </div>
        <div className="ml-4 text-gray-400">
          {isExpanded ? (
            <svg
              className="w-6 h-6 transform rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200">
          {/* Key Points */}
          <div className="mt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Key Points:</h4>
            <ul className="space-y-1">
              {item.keyPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-gray-700">
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Code Example */}
          {item.codeExample && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Code Example:</h4>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{item.codeExample}</code>
              </pre>
            </div>
          )}

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Related Items */}
          {item.relatedItems && item.relatedItems.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Related:</h4>
              <div className="flex flex-wrap gap-2">
                {item.relatedItems.map((related) => (
                  <span
                    key={related}
                    className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                  >
                    {related}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
