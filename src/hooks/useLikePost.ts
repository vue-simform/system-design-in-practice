/**
 * Custom Hook: useLikePost (Enhanced with Feature #7: Optimistic Updates)
 * 
 * Implements like/unlike functionality with optimistic updates and error handling.
 * Now using useOptimisticMutation hook for better state management and tracking.
 * 
 * System Design Concepts Demonstrated:
 * 
 * 1. OPTIMISTIC UPDATES:
 *    - Updates UI immediately before server confirmation
 *    - Provides instant feedback to user (perceived performance)
 *    - Improves UX by eliminating wait time
 * 
 * 2. ROLLBACK STRATEGY:
 *    - Saves previous state before mutation
 *    - Reverts to previous state if server request fails
 *    - Maintains data consistency
 * 
 * 3. RACE CONDITION HANDLING:
 *    - Cancels in-flight queries before mutation
 *    - Prevents stale data overwrites
 *    - Uses queryClient.cancelQueries()
 * 
 * 4. CACHE INVALIDATION:
 *    - Refetches data after mutation completes
 *    - Ensures UI reflects server state
 *    - Uses queryClient.invalidateQueries()
 * 
 * 5. DEBOUNCING:
 *    - Prevents multiple rapid requests
 *    - Tracks pending mutations
 *    - Ignores clicks while mutation is in progress
 * 
 * 6. OPTIMISTIC STATE TRACKING (NEW):
 *    - Global tracker monitors all optimistic updates
 *    - Visual feedback for pending/success/error states
 *    - Automatic rollback with user notification
 * 
 * 7. CONFLICT RESOLUTION:
 *    - Handles concurrent like/unlike operations
 *    - Uses mutation state to prevent conflicts
 *    - Ensures data integrity
 * 
 * How it works:
 * 1. User clicks like → UI updates immediately (optimistic)
 * 2. Request sent to server in background
 * 3. If success → UI stays updated, cache refreshed, tracker updated
 * 4. If error → UI reverts to previous state, shows error, rollback notification
 * 
 * Usage:
 * ```tsx
 * const { likePost, isLiked, isLoading, optimisticState } = useLikePost(postId);
 * 
 * <button onClick={likePost} disabled={isLoading}>
 *   {isLiked ? 'Unlike' : 'Like'}
 * </button>
 * 
 * <OptimisticIndicator {...optimisticState} />
 * ```
 */

import { useQueryClient } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import type { Post } from '../types';
import { useToast } from './useToast';
import { useOptimisticMutation } from './useOptimisticMutation';
import { useCurrentUserId } from '../contexts/AuthContext';
import { enqueueAction } from '../utils/offlineQueue';

interface UseLikePostReturn {
  likePost: () => void;
  unlikePost: () => void;
  toggleLike: () => void;
  isLiked: boolean;
  isLoading: boolean;
  error: Error | null;
  optimisticState: {
    isPending: boolean;
    isOptimistic: boolean;
    isRollingBack: boolean;
    isSuccess: boolean;
    isError: boolean;
  };
}

export function useLikePost(postId: string): UseLikePostReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUserId = useCurrentUserId();

  // Helper function to check if post is liked
  function checkIfLiked(postId: string): boolean {
    const data: any = queryClient.getQueryData(['feed', 'infinite']);
    if (!data?.pages) return false;

    for (const page of data.pages) {
      const post = page.posts.find((p: Post) => p.id === postId);
      if (post) {
        return post.likes?.some((like: any) => like.userId === currentUserId) || false;
      }
    }
    return false;
  }

  // Check if current user has liked this post
  const isLiked = checkIfLiked(postId);

  /**
   * Like Mutation with useOptimisticMutation
   * 
   * Refactored to use the new useOptimisticMutation hook which provides:
   * - Automatic optimistic updates
   * - Rollback on error
   * - State tracking via global optimisticTracker
   * - Visual feedback states
   */
  const likeMutation = useOptimisticMutation({
    queryKey: ['feed', 'infinite'],
    mutationFn: async () => {
      // If offline, enqueue action
      if (!navigator.onLine) {
        await enqueueAction('LIKE_POST', { postId });
        toast.info('You\'re offline. Like will sync when back online.');
        return; // Return early, optimistic update already applied
      }
      return feedApi.likePost(postId, currentUserId);
    },
    resource: 'post-like',
    
    // Optimistic update function
    onOptimistic: (old: any) => {
      if (!old?.pages) return old;

      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((post: Post) =>
            post.id === postId
              ? {
                  ...post,
                  likes: [...(post.likes || []), { userId: currentUserId }],
                  likeCount: post.likeCount + 1,
                  isLiked: true,
                }
              : post
          ),
        })),
      };
    },

    // Success callback
    onSuccess: () => {
      // Invalidate to ensure server state is reflected (e.g., final like count)
      queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
    },

    // Error callback with user-friendly messages
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to like post';
      
      if (errorMessage === 'Already liked' || errorMessage.includes('already')) {
        toast.info('You already liked this post');
      } else {
        toast.error(errorMessage);
      }

    },

    retry: 2, // Retry twice on failure
  });

  /**
   * Unlike Mutation with useOptimisticMutation
   * 
   * Same pattern as like, but removes like from cache
   */
  const unlikeMutation = useOptimisticMutation({
    queryKey: ['feed', 'infinite'],
    mutationFn: async () => {
      // If offline, enqueue action
      if (!navigator.onLine) {
        await enqueueAction('UNLIKE_POST', { postId });
        toast.info('You\'re offline. Unlike will sync when back online.');
        return; // Return early, optimistic update already applied
      }
      return feedApi.unlikePost(postId, currentUserId);
    },
    resource: 'post-unlike',
    
    // Optimistic update function
    onOptimistic: (old: any) => {
      if (!old?.pages) return old;

      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((post: Post) =>
            post.id === postId
              ? {
                  ...post,
                  likes: (post.likes || []).filter(
                    (like) => like.userId !== currentUserId
                  ),
                  likeCount: Math.max(0, post.likeCount - 1),
                  isLiked: false,
                }
              : post
          ),
        })),
      };
    },

    // Success callback
    onSuccess: () => {
      // Invalidate to ensure server state is reflected (e.g., final like count)
      queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
    },

    // Error callback with user-friendly messages
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to unlike post';
      
      if (errorMessage === 'Not liked yet' || errorMessage.includes('not liked')) {
        toast.info("You haven't liked this post yet");
      } else {
        toast.error(errorMessage);
      }

    },

    retry: 2,
  });

  /**
   * Toggle function - smart like/unlike
   * 
   * System Design: Debouncing
   * - Checks if mutation is in progress
   * - Prevents multiple rapid clicks
   * - Calls appropriate mutation based on current state
   */
  const toggleLike = () => {
    // Prevent multiple simultaneous mutations (debouncing)
    if (likeMutation.state.isPending || unlikeMutation.state.isPending) {
      return;
    }

    if (isLiked) {
      unlikeMutation.mutate({});
    } else {
      likeMutation.mutate({});
    }
  };

  // Determine optimistic state for visual feedback
  const activeState = likeMutation.state.isPending 
    ? likeMutation.state 
    : unlikeMutation.state;

  const optimisticState = {
    isPending: activeState.isPending,
    isOptimistic: activeState.isOptimistic,
    isRollingBack: activeState.isRollingBack,
    isSuccess: !activeState.isPending && !activeState.error && activeState.data !== null,
    isError: !!activeState.error,
  };

  return {
    likePost: () => !likeMutation.state.isPending && likeMutation.mutate({}),
    unlikePost: () => !unlikeMutation.state.isPending && unlikeMutation.mutate({}),
    toggleLike,
    isLiked,
    isLoading: likeMutation.state.isPending || unlikeMutation.state.isPending,
    error: (likeMutation.state.error || unlikeMutation.state.error) as Error | null,
    optimisticState,
  };
}
