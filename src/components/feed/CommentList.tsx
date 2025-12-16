/**
 * CommentList Component
 * 
 * Container for displaying all comments on a post.
 * Handles loading states, empty states, and comment form.
 * 
 * System Design Concepts:
 * - Progressive Loading: Shows skeleton while loading
 * - Empty States: Friendly message when no comments
 * - Lazy Loading: Comments loaded on demand
 * - Optimistic Updates: New comments appear instantly
 * 
 * Features:
 * - Loading skeletons for better UX
 * - Empty state with encouragement to comment
 * - Comment form for new comments
 * - List of comments with nesting
 * - Error handling
 * 
 * Props:
 * - postId: ID of the post
 * - isExpanded: Whether comments section is visible
 * 
 * Usage:
 * ```tsx
 * <CommentList postId={post.id} isExpanded={showComments} />
 * ```
 */

import { useComments } from '../../hooks/useComments';
import { useAddComment } from '../../hooks/useAddComment';
import { CommentCard } from './CommentCard';
import { CommentForm } from './CommentForm';
import { OptimisticIndicator, RollbackToast } from '../common/OptimisticUI';

interface CommentListProps {
  postId: string;
  isExpanded: boolean;
}

export function CommentList({ postId, isExpanded }: CommentListProps) {
  // Fetch comments (lazy loading - only when expanded)
  const { comments, isLoading, isError } = useComments(postId, isExpanded);
  
  // Add comment mutation (Enhanced with Feature #7)
  const { addComment, isPending, optimisticState, error } = useAddComment(postId);

  // Don't render anything if not expanded
  if (!isExpanded) return null;

  // Handle reply to comment
  const handleReply = async (parentId: string, text: string) => {
    addComment({ text, parentId });
  };

  // Handle new top-level comment
  const handleNewComment = async (text: string) => {
    addComment({ text, parentId: null });
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      {/* Comment Form with Optimistic Feedback (Feature #7) */}
      <div className="mb-6 relative">
        <CommentForm
          onSubmit={handleNewComment}
          placeholder="Write a comment..."
          isSubmitting={isPending}
        />
        
        {/* Optimistic Update Indicator */}
        {(optimisticState.isOptimistic || optimisticState.isRollingBack) && (
          <OptimisticIndicator
            isOptimistic={optimisticState.isOptimistic}
            isPending={optimisticState.isPending}
            isRollingBack={optimisticState.isRollingBack}
            isSuccess={optimisticState.isSuccess}
            isError={optimisticState.isError}
            position="inline"
            showIcon={true}
            className="mt-2 text-xs"
            pendingMessage="Adding comment..."
            successMessage="Comment added!"
            rollbackMessage="Undoing..."
          />
        )}
        
        {/* Rollback Toast for errors */}
        <RollbackToast
          isActive={optimisticState.isRollingBack}
          resource="comment"
          error={error}
          onRetry={() => handleNewComment('')}
          showRetry={false}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="text-center py-8">
          <p className="text-sm text-red-600">Failed to load comments</p>
          <p className="text-xs text-gray-500 mt-1">Please try again later</p>
        </div>
      )}

      {/* Comments List */}
      {!isLoading && !isError && comments && (
        <>
          {comments.length === 0 ? (
            // Empty State
            <div className="text-center py-8">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 mb-3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm text-gray-600">No comments yet</p>
              <p className="text-xs text-gray-500 mt-1">Be the first to share your thoughts!</p>
            </div>
          ) : (
            // Comments
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  onReply={handleReply}
                  isReplying={isPending}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
