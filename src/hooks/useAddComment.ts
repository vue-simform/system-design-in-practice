/**
 * Custom Hook: useAddComment (Enhanced with Feature #7: Optimistic Updates)
 * 
 * Handles adding new comments with optimistic updates, temp IDs, and error handling.
 * Supports both top-level comments and nested replies.
 * Now using useOptimisticMutation for better state management and tracking.
 * 
 * System Design Concepts Demonstrated:
 * 
 * 1. OPTIMISTIC UPDATES:
 *    - Comment appears immediately in UI
 *    - No waiting for server response
 *    - Instant feedback improves UX
 *    - Background sync with server
 * 
 * 2. TEMPORARY ID GENERATION (NEW):
 *    - Uses generateTempId() for consistent temp ID format
 *    - IDs follow pattern: comment-{timestamp}-{random}
 *    - Server replaces with real ID on success
 *    - Tracked by global optimisticTracker
 * 
 * 3. ROLLBACK STRATEGY:
 *    - Saves previous state before mutation
 *    - Reverts on error to maintain consistency
 *    - Shows error toast to user
 *    - Preserves data integrity
 * 
 * 4. CACHE INVALIDATION:
 *    - Refetches comments after success
 *    - Updates comment count on post
 *    - Ensures UI reflects server state
 *    - Prevents stale data
 * 
 * 5. ERROR HANDLING:
 *    - User-friendly error messages
 *    - Toast notifications for feedback
 *    - Graceful degradation
 *    - Retry capability
 * 
 * 6. NESTED COMMENT SUPPORT:
 *    - Handles replies to comments
 *    - Updates tree structure correctly
 *    - Maintains parent-child relationships
 *    - Unlimited nesting depth
 * 
 * 7. INPUT VALIDATION:
 *    - Client-side validation before API call
 *    - Prevents empty comments
 *    - Character limit enforcement
 *    - Better UX than server validation alone
 * 
 * 8. OPTIMISTIC STATE TRACKING (NEW):
 *    - Global tracker monitors all comment additions
 *    - Visual feedback for pending/success/error states
 *    - Automatic rollback with user notification
 * 
 * How it works:
 * 1. User submits comment → Validates input
 * 2. Generates temp ID → Adds to cache optimistically
 * 3. Sends request to server
 * 4. On success → Server returns real ID, invalidates cache
 * 5. On error → Rolls back, shows error toast with retry
 * 
 * Usage:
 * ```tsx
 * const { addComment, isPending, optimisticState } = useAddComment(postId);
 * 
 * const handleSubmit = () => {
 *   addComment({ text: 'Great post!', parentId: null });
 * };
 * 
 * <button onClick={handleSubmit} disabled={isPending}>
 *   {isPending ? 'Posting...' : 'Comment'}
 * </button>
 * 
 * <OptimisticIndicator {...optimisticState} />
 * ```
 */

import { useQueryClient } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import { CURRENT_USER_ID } from '../config/constants';
import { useToast } from './useToast';
import { useOptimisticMutation } from './useOptimisticMutation';
import { generateTempId } from '../utils/optimisticUpdates';
import type { Comment, Post } from '../types';

interface AddCommentParams {
  text: string;
  parentId?: string | null;
}

interface UseAddCommentReturn {
  addComment: (params: AddCommentParams) => void;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  optimisticState: {
    isPending: boolean;
    isOptimistic: boolean;
    isRollingBack: boolean;
    isSuccess: boolean;
    isError: boolean;
  };
}

/**
 * Hook to add comments with optimistic updates and temp IDs
 * 
 * @param postId - ID of the post to comment on
 */
export function useAddComment(postId: string): UseAddCommentReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Comment Creation Mutation with useOptimisticMutation
   * 
   * Refactored to use the new useOptimisticMutation hook which provides:
   * - Automatic optimistic updates
   * - Temporary ID generation and tracking
   * - Rollback on error
   * - State tracking via global optimisticTracker
   * - Visual feedback states
   */
  const mutation = useOptimisticMutation<any, AddCommentParams, any>({
    queryKey: ['comments', postId],
    
    mutationFn: async (params: AddCommentParams) => {
      // Client-side validation
      if (!params.text || params.text.trim().length === 0) {
        throw new Error('Comment cannot be empty');
      }

      if (params.text.length > 1000) {
        throw new Error('Comment is too long (max 1000 characters)');
      }

      // Send to API
      return feedApi.addComment(postId, {
        text: params.text.trim(),
        userId: CURRENT_USER_ID,
        parentId: params.parentId || undefined,
      });
    },

    resource: 'comment-create',

    /**
     * Optimistic update function
     * 
     * Creates temporary comment with generated ID and adds to cache
     */
    onOptimistic: (oldComments: Comment[] | undefined, params: AddCommentParams) => {
      // Generate temporary ID using utility function
      const tempId = generateTempId('comment');

      // Create optimistic comment
      const optimisticComment: Comment = {
        id: tempId,
        postId,
        userId: CURRENT_USER_ID,
        text: params.text.trim(),
        parentId: params.parentId || null,
        createdAt: new Date().toISOString(),
        replies: [],
        replyCount: 0,
        likeCount: 0,
      };

      // Add to beginning of comments list
      const updatedComments = oldComments ? [optimisticComment, ...oldComments] : [optimisticComment];

      // Also update comment count in feed cache
      queryClient.setQueryData(['feed', 'infinite'], (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: Post) =>
              post.id === postId
                ? { ...post, commentCount: post.commentCount + 1 }
                : post
            ),
          })),
        };
      });

      return updatedComments;
    },

    /**
     * Success callback
     */
    onSuccess: () => {
      // Invalidate to sync server state (real IDs, timestamps, etc.)
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
      // Optional: show toast for user feedback
      // toast.success('Comment added!', 2000);
    },

    /**
     * Error callback with validation-aware messages
     */
    onError: (error: any, _params: AddCommentParams) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to add comment';

      // Also rollback feed cache changes
      queryClient.setQueryData(['feed', 'infinite'], (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((post: Post) =>
              post.id === postId
                ? { ...post, commentCount: Math.max(0, post.commentCount - 1) }
                : post
            ),
          })),
        };
      });

      // User-friendly error messages
      if (errorMessage.includes('empty')) {
        toast.warning('Comment cannot be empty', 3000);
      } else if (errorMessage.includes('long')) {
        toast.warning('Comment is too long (max 1000 characters)', 3000);
      } else {
        toast.error(errorMessage);
      }

    },

    retry: 2, // Retry twice on failure
  });

  // Map optimistic state for visual feedback
  const optimisticState = {
    isPending: mutation.state.isPending,
    isOptimistic: mutation.state.isOptimistic,
    isRollingBack: mutation.state.isRollingBack,
    isSuccess: !mutation.state.isPending && !mutation.state.error && mutation.state.data !== null,
    isError: !!mutation.state.error,
  };

  return {
    addComment: (params: AddCommentParams) => mutation.mutate(params),
    isPending: mutation.state.isPending,
    isError: !!mutation.state.error,
    error: mutation.state.error as Error | null,
    optimisticState,
  };
}
