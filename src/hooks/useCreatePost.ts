/**
 * Hook for creating new posts (Enhanced with Feature #7: Optimistic Updates)
 * 
 * Now using useOptimisticMutation for better state management and tracking.
 * 
 * System Design Concepts:
 * 1. Optimistic UI Updates - Show post instantly before server confirms
 * 2. Temporary ID Generation (NEW) - Consistent temp ID format with tracking
 * 3. Cache Invalidation - Refresh feed after successful creation
 * 4. Error Recovery - Rollback optimistic update on failure
 * 5. Form State Management - Track submission state
 * 6. Request Deduplication - Prevent duplicate submissions
 * 7. Global State Tracking (NEW) - Monitor all post creations centrally
 * 8. Visual Feedback (NEW) - Clear states for pending/success/error/rollback
 */

import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { Post, CreatePostData, FeedResponse } from '../types';
import { feedApi } from '../services/api';
import { useToast } from './useToast';
import { useOptimisticMutation } from './useOptimisticMutation';
import { generateTempId } from '../utils/optimisticUpdates';
import { useCurrentUserId, useCurrentUser } from '../contexts/AuthContext';
import { enqueueAction } from '../utils/offlineQueue';

interface UseCreatePostOptions {
  onSuccess?: (post: Post) => void;
  onError?: (error: Error) => void;
}

interface UseCreatePostReturn {
  createPost: (data: Omit<CreatePostData, 'authorId'>) => void;
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
  reset: () => void;
}

/**
 * Custom hook for creating posts with optimistic updates
 * 
 * Features:
 * - Instant UI feedback (optimistic update)
 * - Temporary ID generation with global tracking
 * - Automatic cache invalidation
 * - Error handling with rollback
 * - Toast notifications
 * - Loading state management
 * - Visual feedback states
 * 
 * @param options - Callback options for success/error
 * @returns Mutation object with createPost function and states
 */
export function useCreatePost(options?: UseCreatePostOptions): UseCreatePostReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUserId = useCurrentUserId();
  const currentUser = useCurrentUser();

  /**
   * Post Creation Mutation with useOptimisticMutation
   * 
   * Refactored to use the new useOptimisticMutation hook which provides:
   * - Automatic optimistic updates
   * - Temporary ID generation and tracking
   * - Rollback on error
   * - State tracking via global optimisticTracker
   * - Visual feedback states
   */
  const mutation = useOptimisticMutation<Post, Omit<CreatePostData, 'authorId'>, InfiniteData<FeedResponse>>({
    queryKey: ['feed', 'infinite'],
    
    mutationFn: async (data: Omit<CreatePostData, 'authorId'>) => {
      // Validate content
      if (!data.content || data.content.trim().length === 0) {
        throw new Error('Post content cannot be empty');
      }

      if (data.content.length > 5000) {
        throw new Error('Post is too long (max 5000 characters)');
      }

      // If offline, enqueue action and return a temporary post
      if (!navigator.onLine) {
        await enqueueAction('CREATE_POST', {
          content: data.content,
          mediaUrls: data.mediaUrls || [],
        });
        
        // Return temporary post for optimistic update
        const tempPost: Post = {
          id: generateTempId('post'),
          content: data.content,
          authorId: currentUserId,
          author: currentUser,
          mediaUrls: data.mediaUrls || [],
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          isLiked: false,
          likes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        toast.info('You\'re offline. Post will sync when back online.');
        return tempPost;
      }

      // Add authorId to the request
      const postData: CreatePostData = {
        ...data,
        authorId: currentUserId,
      };
      
      return feedApi.createPost(postData);
    },

    resource: 'post-create',

    /**
     * Optimistic update function
     * 
     * Creates temporary post with generated ID and adds to cache
     */
    onOptimistic: (
      oldFeed: InfiniteData<FeedResponse> | undefined,
      newPostData: Omit<CreatePostData, 'authorId'>
    ): InfiniteData<FeedResponse> => {
      // Generate temporary ID using utility function
      const tempId = generateTempId('post');

      // Create optimistic post
      const optimisticPost: Post = {
        id: tempId,
        content: newPostData.content,
        authorId: currentUserId,
        author: currentUser,
        mediaUrls: newPostData.mediaUrls || [],
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        isLiked: false,
        likes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add new post to top of first page
      if (!oldFeed) {
        return {
          pages: [{
            posts: [optimisticPost],
            pagination: {
              nextCursor: null,
              hasMore: false,
            },
          }],
          pageParams: [undefined],
        };
      }

      return {
        ...oldFeed,
        pages: oldFeed.pages.map((page, index) => {
          // Add to first page only
          if (index === 0) {
            return {
              ...page,
              posts: [optimisticPost, ...page.posts],
            };
          }
          return page;
        }),
      };
    },

    /**
     * Success callback
     */
    onSuccess: (newPost: Post, _variables) => {
      // Invalidate to sync server state (real ID, timestamps, etc.)
      queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
      toast.success('Post created successfully!');
      options?.onSuccess?.(newPost);
    },

    /**
     * Error callback with validation-aware messages
     */
    onError: (error: any, _variables) => {
      // Determine error message
      let errorMessage = 'Failed to create post';
      
      const message = error?.response?.data?.error || error?.message || '';
      
      if (message.includes('empty')) {
        errorMessage = 'Post content cannot be empty';
      } else if (message.includes('long') || message.includes('5000')) {
        errorMessage = 'Post is too long (max 5000 characters)';
      } else if (message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (message.includes('validation')) {
        errorMessage = 'Invalid post content. Please check your input.';
      } else if (message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (message) {
        errorMessage = message;
      }

      toast.error(errorMessage);
      options?.onError?.(error instanceof Error ? error : new Error(errorMessage));

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
    createPost: (data: Omit<CreatePostData, 'authorId'>) => mutation.mutate(data),
    isPending: mutation.state.isPending,
    isError: !!mutation.state.error,
    error: mutation.state.error as Error | null,
    optimisticState,
    reset: mutation.reset,
  };
}

/**
 * Usage example:
 * 
 * ```typescript
 * function CreatePostForm() {
 *   const { createPost, isPending, optimisticState } = useCreatePost({
 *     onSuccess: () => {
 *       setContent('');
 *       setImages([]);
 *     }
 *   });
 * 
 *   const handleSubmit = () => {
 *     createPost({
 *       content: 'Hello world!',
 *       mediaUrls: ['https://example.com/image.jpg']
 *     });
 *   };
 * 
 *   return (
 *     <>
 *       <button onClick={handleSubmit} disabled={isPending}>
 *         {isPending ? 'Posting...' : 'Post'}
 *       </button>
 *       <OptimisticIndicator {...optimisticState} />
 *     </>
 *   );
 * }
 * ```
 */
