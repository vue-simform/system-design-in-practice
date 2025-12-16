/**
 * FeedContainer Component
 * 
 * Main container for the news feed with infinite scroll.
 * Orchestrates data fetching, loading states, error handling, and rendering of posts.
 * 
 * Features:
 * - Infinite scroll with automatic pagination
 * - Cursor-based pagination for scalability
 * - Intersection Observer for efficient scroll detection
 * - Loading skeletons during initial and pagination fetch
 * - Error states with retry functionality
 * - Empty state when no posts available
 * - Keyboard navigation (j/k for navigation, l for like, c for comment)
 * - Screen reader announcements for updates
 * 
 * System Design Concepts:
 * - Cursor-based pagination: Scalable for large datasets
 * - Intersection Observer API: Efficient scroll detection
 * - React Query infinite queries: Automatic page management
 * - Memory optimization: Only fetches visible data
 * - Accessibility: WCAG 2.1 AA compliant
 * 
 * Usage:
 * ```tsx
 * <FeedContainer />
 * ```
 */

import { useRef, useCallback } from 'react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useSearchResults } from '../../hooks/useSearchPosts';
import { useSearchFilterStore, selectDebouncedQuery, selectActiveFilter, selectActiveSort } from '../../store/searchFilterStore';
import { PAGINATION } from '../../config/constants';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { NetworkError, ServerError, ErrorState as EnhancedErrorState, EmptyState } from '../common/ErrorStates';
import { classifyError } from '../../utils/errorHandling';
import { PostCard } from './PostCard';
import { CreatePostForm } from './CreatePostForm';
import { SearchBar } from './SearchBar';
import { FilterBar } from './FilterBar';
// import { ScrollDebugger } from '../common/ScrollDebugger';
import { useKeyboardNavigation, useAnnouncer, AriaLiveRegion } from '../../utils/accessibility';

export function FeedContainer() {
  // Get search/filter state
  const debouncedQuery = useSearchFilterStore(selectDebouncedQuery);
  const activeFilter = useSearchFilterStore(selectActiveFilter);
  const activeSort = useSearchFilterStore(selectActiveSort);
  const isSearchActive = debouncedQuery.trim().length > 0;

  // Fetch regular feed data with infinite scroll
  const feedQuery = useInfiniteScroll({ 
    limit: PAGINATION.DEFAULT_LIMIT,
    enabled: !isSearchActive, // Disable when searching
  });

  // Fetch search results when searching
  const searchQuery = useSearchResults(
    { query: debouncedQuery, filter: activeFilter, sort: activeSort },
    isSearchActive // Only enabled when actively searching
  );

  // Use search results or regular feed
  const {
    posts,
    lastPostRef,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = isSearchActive ? searchQuery : feedQuery;

  // Screen reader announcements
  const announce = useAnnouncer();
  const currentPostIndexRef = useRef(0);

  // Navigate to next post
  const navigateToNextPost = useCallback(() => {
    if (currentPostIndexRef.current < posts.length - 1) {
      currentPostIndexRef.current++;
      const postElement = document.querySelector(`[data-post-index="${currentPostIndexRef.current}"]`) as HTMLElement;
      postElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postElement?.focus();
      announce(`Post ${currentPostIndexRef.current + 1} of ${posts.length}`, 'polite');
    }
  }, [posts.length, announce]);

  // Navigate to previous post
  const navigateToPrevPost = useCallback(() => {
    if (currentPostIndexRef.current > 0) {
      currentPostIndexRef.current--;
      const postElement = document.querySelector(`[data-post-index="${currentPostIndexRef.current}"]`) as HTMLElement;
      postElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postElement?.focus();
      announce(`Post ${currentPostIndexRef.current + 1} of ${posts.length}`, 'polite');
    }
  }, [posts.length, announce]);

  // Focus search bar
  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput?.focus();
    announce('Search focused', 'polite');
  }, [announce]);

  // Keyboard navigation
  useKeyboardNavigation([
    { key: 'j', description: 'Next post', action: navigateToNextPost },
    { key: 'k', description: 'Previous post', action: navigateToPrevPost },
    { key: '/', description: 'Focus search', action: focusSearch },
  ]);

  // Loading State
  if (isLoading) {
    return (
      <div>
        <CreatePostForm />
        <SearchBar />
        <FilterBar />
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  // Error State with smart error type detection
  if (error) {
    const appError = classifyError(error);
    
    return (
      <div>
        <CreatePostForm />
        <SearchBar />
        <FilterBar />
        <div className="mt-4">
          {/* Use specific error components for better UX */}
          {appError.type === 'NETWORK' ? (
            <NetworkError onRetry={() => refetch()} />
          ) : appError.type === 'SERVER' ? (
            <ServerError onRetry={() => refetch()} />
          ) : (
            <EnhancedErrorState 
              error={appError} 
              onRetry={() => refetch()} 
              showDetails={import.meta.env.DEV}
            />
          )}
        </div>
      </div>
    );
  }

  // Empty State with EmptyState component
  if (!isLoading && posts.length === 0) {
    const emptyIcon = isSearchActive ? (
      <svg className="w-20 h-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ) : (
      <svg className="w-20 h-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    );
    
    return (
      <div>
        <CreatePostForm />
        <SearchBar />
        <FilterBar />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            title={isSearchActive ? `No results for "${debouncedQuery}"` : 'No posts yet'}
            description={isSearchActive 
              ? 'Try adjusting your search query or filters to find what you\'re looking for.' 
              : 'Be the first to share something with the community! Create a post above to get started.'}
            icon={emptyIcon}
          />
        </div>
      </div>
    );
  }

  // Success State - Render Posts with Infinite Scroll
  return (
    <div>
      {/* Screen reader announcements */}
      <AriaLiveRegion>
        {isFetchingNextPage && <span>Loading more posts...</span>}
        {!hasNextPage && posts.length > 0 && <span>All posts loaded. {posts.length} total posts.</span>}
      </AriaLiveRegion>

      {/* Create Post Form */}
      <CreatePostForm />

      {/* Search Bar */}
      <SearchBar />

      {/* Filter Bar */}
      <FilterBar />

      {/* Feed Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {isSearchActive ? `Search Results for "${debouncedQuery}"` : 'Your Feed'}
        </h2>
        <p className="text-gray-600 mt-1">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} loaded
        </p>
      </div>

      {/* Posts List with Infinite Scroll */}
      <div 
        className="space-y-4"
        role="feed"
        aria-label="News feed"
        aria-busy={isFetchingNextPage}
      >
        {posts.map((post, index) => {
          // Attach ref to last post for intersection observer
          const isLastPost = index === posts.length - 1;
          
          return (
            <div 
              key={post.id} 
              ref={isLastPost ? lastPostRef : null}
              data-post-index={index}
              tabIndex={0}
            >
              <PostCard post={post} />
            </div>
          );
        })}
      </div>

      {/* Loading More Indicator */}
      {isFetchingNextPage && (
        <div className="mt-6">
          <LoadingSkeleton count={2} />
        </div>
      )}

      {/* End of Feed Indicator */}
      {!hasNextPage && posts.length > 0 && (
        <div className="mt-8 text-center pb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
            <svg 
              className="w-5 h-5 text-gray-400" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-600 font-medium">
              You're all caught up!
            </span>
          </div>
        </div>
      )}

      {/* Scroll Position Debugger (dev mode only) */}
      {/* {import.meta.env.DEV && <ScrollDebugger storageKey="feed-page" />} */}
    </div>
  );
}
