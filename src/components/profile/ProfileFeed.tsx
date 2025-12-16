/**
 * ProfileFeed Component
 * 
 * Displays user's posts with infinite scroll
 * Reuses existing PostCard component for consistency
 * 
 * System Design:
 * - Separate timeline implementation
 * - Infinite scroll with cursor pagination
 * - Shared PostCard component (DRY principle)
 */

import { useCallback, useRef } from 'react';
import { useUserPosts } from '../../hooks/useUserProfile';
import { PostCard } from '../feed/PostCard';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface ProfileFeedProps {
  userId: string;
}

export function ProfileFeed({ userId }: ProfileFeedProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useUserPosts(userId);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Infinite scroll trigger
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      }, {
        rootMargin: '200px',
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">
          Failed to load posts: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
        <p className="text-gray-500">This user hasn't posted anything yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Posts ({posts.length})
        </h2>
      </div>

      {/* Posts List */}
      {posts.map((post, index) => (
        <div
          key={post.id}
          ref={index === posts.length - 1 ? lastPostRef : undefined}
        >
          <PostCard post={post} />
        </div>
      ))}

      {/* Loading More */}
      {isFetchingNextPage && (
        <div className="py-4">
          <LoadingSkeleton count={2} />
        </div>
      )}

      {/* End of Feed */}
      {!hasNextPage && posts.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>You've reached the end!</p>
        </div>
      )}
    </div>
  );
}
