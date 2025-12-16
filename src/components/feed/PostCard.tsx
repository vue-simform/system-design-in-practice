/**
 * PostCard Component
 * 
 * Displays a single post in the feed with author info, content, and actions.
 * Optimized with React.memo to prevent unnecessary re-renders.
 * 
 * Features:
 * - Author avatar and name
 * - Post content with proper formatting
 * - Timestamp (relative time)
 * - Post statistics (likes, comments, shares)
 * - Action buttons (placeholder for now)
 * 
 * Props:
 * - post: Post object with all post data
 * 
 * Usage:
 * ```tsx
 * <PostCard post={postData} />
 * ```
 */

import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Post } from '../../types';
import { formatRelativeTime, formatNumber } from '../../utils/helpers';
import { useLikePost } from '../../hooks/useLikePost';
import { CommentList } from './CommentList';
import { usePrefetchUserProfile } from '../../hooks/useUserProfile';
import { sessionPersistentStorage } from '../../utils/statePersistence';
import { OptimisticIndicator, RollbackToast } from '../common/OptimisticUI';

interface PostCardProps {
  post: Post;
}

export const PostCard = memo(({ post }: PostCardProps) => {
  const { author, content, createdAt, likeCount, commentCount, shareCount } = post;
  
  // Like/Unlike functionality with optimistic updates (Enhanced with Feature #7)
  const { toggleLike, isLiked, isLoading: isLikeLoading, optimisticState, error } = useLikePost(post.id);
  
  // Comments visibility state
  const [showComments, setShowComments] = useState(false);
  
  // Prefetch profile on hover (system design optimization)
  const prefetchProfile = usePrefetchUserProfile();
  
  const handleAuthorHover = () => {
    if (author?.id) {
      prefetchProfile(author.id);
    }
  };

  // Save scroll position before navigating away
  const handleNavigateToProfile = () => {
    const scrollY = window.scrollY;
    sessionPersistentStorage.set('scroll-feed-page', {
      x: 0,
      y: scrollY,
      timestamp: Date.now(),
    });
  };

  return (
    <article 
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-blue-500"
      role="article"
      aria-label={`Post by ${author?.name || 'Unknown User'}`}
    >
      {/* Post Header */}
      <div className="flex items-center mb-4">
        {/* Avatar - Clickable */}
        <Link 
          to={`/profile/${author?.id}`}
          onMouseEnter={handleAuthorHover}
          onClick={handleNavigateToProfile}
          className="shrink-0"
        >
          <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all cursor-pointer">
            {author?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </Link>

        {/* Author Info - Clickable */}
        <div className="ml-3 flex-1">
          <Link 
            to={`/profile/${author?.id}`}
            onMouseEnter={handleAuthorHover}
            onClick={handleNavigateToProfile}
            className="hover:underline"
          >
            <h3 className="font-semibold text-gray-900">
              {author?.name || 'Unknown User'}
            </h3>
          </Link>
          <p className="text-sm text-gray-500">
            @{author?.username || 'user'} · {formatRelativeTime(createdAt)}
          </p>
        </div>

        {/* More Options Button */}
        <button
          className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="More options"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      </div>

      {/* Post Statistics */}
      <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4 pt-3 border-t border-gray-100">
        <span className="flex items-center">
          <span className="font-medium text-gray-700">{formatNumber(likeCount)}</span>
          <span className="ml-1">likes</span>
        </span>
        <span className="flex items-center">
          <span className="font-medium text-gray-700">{formatNumber(commentCount)}</span>
          <span className="ml-1">comments</span>
        </span>
        <span className="flex items-center">
          <span className="font-medium text-gray-700">{formatNumber(shareCount)}</span>
          <span className="ml-1">shares</span>
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-around pt-3 border-t border-gray-100">
        {/* Like Button with Optimistic Updates (Enhanced with Feature #7) */}
        <div className="relative">
          <button 
            onClick={toggleLike}
            disabled={isLikeLoading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              isLiked
                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                : 'text-gray-600 hover:text-red-600 hover:bg-gray-50'
            } ${isLikeLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={isLiked ? 'Unlike post' : 'Like post'}
            aria-pressed={isLiked}
          >
            <svg
              className={`w-5 h-5 transition-transform ${
                isLiked ? 'scale-110 animate-heart-pop' : 'scale-100'
              }`}
              fill={isLiked ? 'currentColor' : 'none'}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{isLiked ? 'Liked' : 'Like'}</span>
          </button>
          
          {/* Optimistic Update Indicator (Feature #7) */}
          {(optimisticState.isOptimistic || optimisticState.isRollingBack) && (
            <OptimisticIndicator
              isOptimistic={optimisticState.isOptimistic}
              isPending={optimisticState.isPending}
              isRollingBack={optimisticState.isRollingBack}
              isSuccess={optimisticState.isSuccess}
              isError={optimisticState.isError}
              position="inline"
              showIcon={true}
              className="absolute -top-8 left-0 text-xs"
              pendingMessage="Saving..."
              rollbackMessage="Undoing..."
            />
          )}
          
          {/* Rollback Toast (Feature #7) */}
          <RollbackToast
            isActive={optimisticState.isRollingBack}
            resource="like"
            error={error}
            onRetry={toggleLike}
            showRetry={true}
          />
        </div>

        {/* Comment Button */}
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-medium ${
            showComments
              ? 'text-green-600 bg-green-50 hover:bg-green-100'
              : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>{showComments ? 'Hide Comments' : 'Comment'}</span>
        </button>

        {/* Share Button */}
        <button className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 hover:text-purple-600 group">
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="font-medium">Share</span>
        </button>
      </div>

      {/* Comments Section */}
      <CommentList postId={post.id} isExpanded={showComments} />
    </article>
  );
});

PostCard.displayName = 'PostCard';
