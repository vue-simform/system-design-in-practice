/**
 * User Profile Hooks
 * 
 * React Query hooks for user profile data management
 * 
 * System Design Concepts:
 * - Data prefetching for smooth UX
 * - Normalized state sharing
 * - Optimistic updates for follow/unfollow
 * - Query caching (5min stale time)
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import type { UserProfileResponse, FollowResponse } from '../types';

/**
 * Hook to fetch user profile data
 * @param userId - The user ID to fetch
 * @param options - React Query options (enabled, staleTime, etc.)
 */
export function useUserProfile(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery<UserProfileResponse>({
    queryKey: ['user', 'profile', userId],
    queryFn: () => feedApi.getUserProfile(userId!),
    enabled: !!userId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    
    // Smart retry logic
    retry: (failureCount, error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Don't retry 404 errors (user not found)
      if (errorMessage.includes('404')) {
        return false;
      }
      
      // Retry network/server errors
      const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch');
      const isServerError = errorMessage.includes('500') || errorMessage.includes('502');
      
      if (isNetworkError || isServerError) {
        return failureCount < 2;
      }
      
      return false;
    },
    
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000),
  });
}

/**
 * Hook to prefetch user profile data (for hover previews)
 * @returns Function to trigger prefetch
 */
export function usePrefetchUserProfile() {
  const queryClient = useQueryClient();
  
  return (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['user', 'profile', userId],
      queryFn: () => feedApi.getUserProfile(userId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
}

/**
 * Hook to fetch user's posts with infinite scroll
 * @param userId - The user ID whose posts to fetch
 */
export function useUserPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['user', 'posts', userId],
    queryFn: ({ pageParam }) => feedApi.getUserPosts(userId!, pageParam, 10),
    enabled: !!userId,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to follow a user with optimistic update
 */
export function useFollowUser() {
  const queryClient = useQueryClient();
  
  return useMutation<FollowResponse, Error, string, { previousProfile?: UserProfileResponse }>({
    mutationFn: (userId: string) => feedApi.followUser(userId),
    
    // Optimistic update
    onMutate: async (userId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user', 'profile', userId] });
      
      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<UserProfileResponse>(['user', 'profile', userId]);
      
      // Optimistically update
      if (previousProfile) {
        queryClient.setQueryData<UserProfileResponse>(['user', 'profile', userId], {
          user: {
            ...previousProfile.user,
            isFollowing: true,
            followerCount: previousProfile.user.followerCount + 1,
          },
        });
      }
      
      return { previousProfile };
    },
    
    // Rollback on error
    onError: (_err, userId, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['user', 'profile', userId], context.previousProfile);
      }
    },
    
    // Refetch on success or error
    onSettled: (_data, _error, userId) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile', userId] });
    },
  });
}

/**
 * Hook to unfollow a user with optimistic update
 */
export function useUnfollowUser() {
  const queryClient = useQueryClient();
  
  return useMutation<FollowResponse, Error, string, { previousProfile?: UserProfileResponse }>({
    mutationFn: (userId: string) => feedApi.unfollowUser(userId),
    
    // Optimistic update
    onMutate: async (userId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user', 'profile', userId] });
      
      // Snapshot previous value
      const previousProfile = queryClient.getQueryData<UserProfileResponse>(['user', 'profile', userId]);
      
      // Optimistically update
      if (previousProfile) {
        queryClient.setQueryData<UserProfileResponse>(['user', 'profile', userId], {
          user: {
            ...previousProfile.user,
            isFollowing: false,
            followerCount: Math.max(0, previousProfile.user.followerCount - 1),
          },
        });
      }
      
      return { previousProfile };
    },
    
    // Rollback on error
    onError: (_err, userId, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['user', 'profile', userId], context.previousProfile);
      }
    },
    
    // Refetch on success or error
    onSettled: (_data, _error, userId) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile', userId] });
    },
  });
}

/**
 * Combined hook for follow/unfollow toggle
 */
export function useToggleFollow() {
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  
  return {
    toggle: (userId: string, isCurrentlyFollowing: boolean) => {
      if (isCurrentlyFollowing) {
        unfollowUser.mutate(userId);
      } else {
        followUser.mutate(userId);
      }
    },
    isLoading: followUser.isPending || unfollowUser.isPending,
  };
}
