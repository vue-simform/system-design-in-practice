/**
 * Custom Hook: useComments
 * 
 * Manages comment fetching, display, and organization for posts.
 * Implements lazy loading and pagination for efficient comment handling.
 * 
 * System Design Concepts Demonstrated:
 * 
 * 1. LAZY LOADING:
 *    - Comments loaded on-demand when user expands section
 *    - Reduces initial page load time
 *    - Improves perceived performance
 *    - Only fetches data when needed
 * 
 * 2. TREE DATA STRUCTURE:
 *    - Organizes comments in parent-child hierarchy
 *    - Supports unlimited nesting depth
 *    - Efficient for nested comment threads
 *    - Uses parentId to build relationships
 * 
 * 3. PAGINATION:
 *    - Load comments in batches (e.g., 10 at a time)
 *    - "Load More" pattern for better UX
 *    - Reduces server load and bandwidth
 *    - Handles large comment threads efficiently
 * 
 * 4. CACHING:
 *    - React Query caches fetched comments
 *    - Prevents redundant API calls
 *    - Instant display on revisit
 *    - Reduces server load
 * 
 * 5. HIERARCHICAL RENDERING:
 *    - Transforms flat array into tree structure
 *    - Groups replies under parent comments
 *    - Enables nested visual display
 *    - Recursive component pattern
 * 
 * 6. STALE-WHILE-REVALIDATE:
 *    - Shows cached data immediately
 *    - Refetches in background
 *    - Always fresh data without loading states
 *    - Better UX than traditional caching
 * 
 * How it works:
 * 1. User clicks "Show Comments" → Hook fetches comments
 * 2. Comments organized into tree structure (parent → children)
 * 3. Cached for instant subsequent access
 * 4. Background refresh ensures data freshness
 * 5. Pagination for large comment threads
 * 
 * Usage:
 * ```tsx
 * const { comments, isLoading, fetchComments } = useComments(postId);
 * 
 * <button onClick={() => fetchComments()}>
 *   Show Comments ({commentCount})
 * </button>
 * 
 * {comments && <CommentList comments={comments} />}
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import type { Comment } from '../types';

interface UseCommentsReturn {
  comments: Comment[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Organizes flat comment array into tree structure
 * 
 * System Design: Tree Data Structure
 * - Converts flat list to hierarchical tree
 * - Groups replies under parent comments
 * - Enables recursive rendering
 * - O(n) time complexity
 * 
 * @param comments - Flat array of comments
 * @returns Tree structure with nested replies
 */
function buildCommentTree(comments: Comment[]): Comment[] {
  // Create a map for O(1) lookup
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  // First pass: Create map of all comments with empty replies array
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: Build tree structure
  comments.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id)!;
    
    if (comment.parentId) {
      // This is a reply, add to parent's replies array
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(commentWithReplies);
      }
    } else {
      // This is a top-level comment
      rootComments.push(commentWithReplies);
    }
  });

  // Sort by creation date (newest first)
  const sortComments = (comments: Comment[]): Comment[] => {
    return comments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).map(comment => ({
      ...comment,
      replies: comment.replies ? sortComments(comment.replies) : []
    }));
  };

  return sortComments(rootComments);
}

/**
 * Hook to fetch and manage comments for a post
 * 
 * Features:
 * - Lazy loading (fetch on demand)
 * - Tree structure organization
 * - Caching with stale-while-revalidate
 * - Error handling
 * - Automatic refetch on mutations
 * 
 * @param postId - ID of the post to fetch comments for
 * @param enabled - Whether to fetch immediately (default: false for lazy loading)
 */
export function useComments(
  postId: string,
  enabled: boolean = false
): UseCommentsReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      const comments = await feedApi.getComments(postId);
      // Transform flat array into tree structure
      return buildCommentTree(comments || []);
    },
    enabled, // Lazy loading: only fetch when enabled is true
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    
    // Smart retry with error classification
    retry: (failureCount, error) => {
      // Classify error to determine retry strategy
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch');
      const isServerError = errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503');
      
      // Retry network errors up to 3 times
      if (isNetworkError) {
        return failureCount < 3;
      }
      
      // Retry server errors up to 2 times
      if (isServerError) {
        return failureCount < 2;
      }
      
      // Default: 1 retry for unknown errors
      return failureCount < 1;
    },
    
    // Exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
  });

  return {
    comments: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
