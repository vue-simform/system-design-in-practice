/**
 * useOptimisticMutation Hook
 * 
 * Generic React hook for optimistic updates with automatic rollback and state tracking.
 * 
 * Features:
 * - Automatic cache updates on mutation start
 * - Rollback on error
 * - Visual feedback states (pending, success, error)
 * - Integration with OptimisticUpdateTracker
 * - TypeScript generic support for type safety
 * 
 * @example
 * const likeMutation = useOptimisticMutation({
 *   mutationFn: (postId: string) => api.likePost(postId),
 *   queryKey: ['posts'],
 *   onOptimistic: (data, postId) => 
 *     data.map(post => post.id === postId ? {...post, likes: post.likes + 1} : post),
 *   resource: 'post-like'
 * });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  optimisticTracker,
  type OptimisticUpdate,
} from '../utils/optimisticUpdates';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Mutation context with previous and optimistic data */
interface MutationContext<TQueryData> {
  previousData?: TQueryData;
  optimisticData: TQueryData;
}

/**
 * Configuration for useOptimisticMutation hook
 */
export interface UseOptimisticMutationOptions<TData, TVariables, TQueryData> {
  /** React Query query key for cache updates */
  queryKey: string | string[];
  
  /** The actual mutation function (API call) */
  mutationFn: (variables: TVariables) => Promise<TData>;
  
  /** Function to update cache optimistically */
  onOptimistic: (currentData: TQueryData | undefined, variables: TVariables) => TQueryData;
  
  /** Resource identifier for tracking (e.g., 'post-like', 'comment-create') */
  resource?: string;
  
  /** Success callback after mutation succeeds */
  onSuccess?: (data: TData, variables: TVariables) => void;
  
  /** Error callback after mutation fails */
  onError?: (error: Error, variables: TVariables) => void;
  
  /** Settled callback (runs after success or error) */
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  
  /** Retry configuration */
  retry?: number | false;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Optimistic mutation state
 */
export interface OptimisticMutationState {
  /** Is mutation currently running? */
  isPending: boolean;
  
  /** Is optimistic update applied? */
  isOptimistic: boolean;
  
  /** Is rollback in progress? */
  isRollingBack: boolean;
  
  /** Mutation error (if any) */
  error: Error | null;
  
  /** Mutation success data (if completed) */
  data: unknown | null;
}

/**
 * Return type for useOptimisticMutation hook
 */
export interface UseOptimisticMutationResult<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => void;
  
  /** Execute the mutation (async) */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  
  /** Current mutation state */
  state: OptimisticMutationState;
  
  /** Manually rollback optimistic update */
  rollback: () => void;
  
  /** Reset mutation state */
  reset: () => void;
  
  /** Get current optimistic update info */
  getOptimisticUpdate: () => OptimisticUpdate | undefined;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useOptimisticMutation<TData = unknown, TVariables = unknown, TQueryData = unknown>(
  options: UseOptimisticMutationOptions<TData, TVariables, TQueryData>
): UseOptimisticMutationResult<TData, TVariables> {
  const {
    queryKey,
    mutationFn,
    onOptimistic,
    resource = 'unknown',
    onSuccess,
    onError,
    onSettled,
    retry = 3,
    retryDelay = 1000,
  } = options;

  const queryClient = useQueryClient();
  
  // Track current optimistic update ID
  const optimisticIdRef = useRef<string | null>(null);
  
  // Track mutation state
  const [state, setState] = useState<OptimisticMutationState>({
    isPending: false,
    isOptimistic: false,
    isRollingBack: false,
    error: null,
    data: null,
  });

  // ============================================================================
  // Core Mutation with Optimistic Updates
  // ============================================================================

  const mutation = useMutation<TData, Error, TVariables, MutationContext<TQueryData>>({
    mutationFn,
    retry,
    retryDelay,

    onMutate: async (variables: TVariables) => {
      // Start optimistic update
      setState(prev => ({ ...prev, isPending: true, isOptimistic: true }));

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });

      // Get previous data
      const previousData = queryClient.getQueryData<TQueryData>(Array.isArray(queryKey) ? queryKey : [queryKey]);

      // Apply optimistic update
      const optimisticData = onOptimistic(previousData, variables);
      queryClient.setQueryData(Array.isArray(queryKey) ? queryKey : [queryKey], optimisticData);

      // Track optimistic update
      const updateId = `${resource}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      optimisticIdRef.current = updateId;
      
      optimisticTracker.track({
        id: updateId,
        timestamp: Date.now(),
        type: 'update',
        resource,
        data: optimisticData,
        previousData,
        status: 'pending',
      });

      // Return context for rollback
      return { previousData, optimisticData };
    },

    onSuccess: (data: TData, variables: TVariables) => {
      // Mark optimistic update as successful
      if (optimisticIdRef.current) {
        optimisticTracker.markSuccess(optimisticIdRef.current);
      }

      setState(prev => ({
        ...prev,
        isPending: false,
        isOptimistic: false,
        data,
        error: null,
      }));

      // User success callback
      onSuccess?.(data, variables);
    },

    onError: (error: Error, variables: TVariables, context: MutationContext<TQueryData> | undefined) => {
      // Mark optimistic update as failed
      if (optimisticIdRef.current) {
        optimisticTracker.markError(optimisticIdRef.current, error);
      }

      setState(prev => ({
        ...prev,
        isPending: false,
        isOptimistic: false,
        isRollingBack: true,
        error,
      }));

      // Rollback to previous data
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(Array.isArray(queryKey) ? queryKey : [queryKey], context.previousData);
      }

      // Mark rollback complete
      if (optimisticIdRef.current) {
        optimisticTracker.markRolledBack(optimisticIdRef.current);
      }

      setState(prev => ({ ...prev, isRollingBack: false }));

      // User error callback
      onError?.(error, variables);
    },

    onSettled: (data: TData | undefined, error: Error | null, variables: TVariables) => {
      // Note: No automatic invalidation - optimistic updates already handle cache correctly
      // Only invalidate if explicitly needed via onSuccess/onError callbacks

      // Clear optimistic ID
      optimisticIdRef.current = null;

      // User settled callback
      onSettled?.(data, error, variables);
    },
  });

  // ============================================================================
  // Manual Rollback
  // ============================================================================

  const rollback = useCallback(() => {
    if (!optimisticIdRef.current) {
      return;
    }

    const update = optimisticTracker.get(optimisticIdRef.current);
    if (update?.previousData !== undefined) {
      setState(prev => ({ ...prev, isRollingBack: true }));
      
      queryClient.setQueryData(Array.isArray(queryKey) ? queryKey : [queryKey], update.previousData);
      optimisticTracker.markRolledBack(optimisticIdRef.current!);
      
      setState(prev => ({
        ...prev,
        isRollingBack: false,
        isOptimistic: false,
      }));
    }
  }, [queryClient, queryKey]);

  // ============================================================================
  // Reset State
  // ============================================================================

  const reset = useCallback(() => {
    setState({
      isPending: false,
      isOptimistic: false,
      isRollingBack: false,
      error: null,
      data: null,
    });
    optimisticIdRef.current = null;
    mutation.reset();
  }, [mutation]);

  // ============================================================================
  // Get Current Optimistic Update
  // ============================================================================

  const getOptimisticUpdate = useCallback(() => {
    if (!optimisticIdRef.current) {
      return undefined;
    }
    return optimisticTracker.get(optimisticIdRef.current);
  }, []);

  // ============================================================================
  // Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      // Clear optimistic update on unmount
      if (optimisticIdRef.current) {
        const update = optimisticTracker.get(optimisticIdRef.current);
        if (update?.status === 'pending') {
          optimisticTracker.markRolledBack(optimisticIdRef.current);
        }
      }
    };
  }, []);

  // ============================================================================
  // Return API
  // ============================================================================

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    state,
    rollback,
    reset,
    getOptimisticUpdate,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get all pending optimistic updates
 */
export function usePendingOptimisticUpdates() {
  const [updates, setUpdates] = useState<OptimisticUpdate[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setUpdates(optimisticTracker.getPending());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return updates;
}

/**
 * Hook to get failed optimistic updates
 */
export function useFailedOptimisticUpdates() {
  const [updates, setUpdates] = useState<OptimisticUpdate[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setUpdates(optimisticTracker.getFailed());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return updates;
}

/**
 * Hook to get optimistic update statistics
 */
export function useOptimisticStats() {
  const [stats, setStats] = useState(optimisticTracker.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(optimisticTracker.getStats());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return stats;
}

/**
 * Hook to get updates for specific resource
 */
export function useResourceOptimisticUpdates(resource: string) {
  const [updates, setUpdates] = useState<OptimisticUpdate[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setUpdates(optimisticTracker.getByResource(resource));
    }, 100);

    return () => clearInterval(interval);
  }, [resource]);

  return updates;
}

/**
 * Hook to clear all optimistic updates
 */
export function useClearOptimisticUpdates() {
  return useCallback(() => {
    optimisticTracker.clear();
  }, []);
}

// ============================================================================
// Exports
// ============================================================================

export { optimisticTracker };
export type { OptimisticUpdate };
