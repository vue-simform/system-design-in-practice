/**
 * Optimistic Updates Utilities
 * 
 * Comprehensive system for optimistic UI updates with:
 * - Automatic rollback on error
 * - Conflict detection and resolution
 * - Temporary ID generation
 * - Cache update helpers
 * - Retry queue for failed mutations
 * - Optimistic state tracking
 * 
 * Part of Feature #7: Optimistic Updates
 */

import type { QueryClient } from '@tanstack/react-query';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OptimisticUpdate<T = any> {
  id: string;
  timestamp: number;
  type: 'create' | 'update' | 'delete';
  resource: string; // e.g., 'post', 'comment', 'like'
  data: T;
  previousData?: T;
  status: 'pending' | 'success' | 'error' | 'rolled-back';
  error?: Error;
  retryCount?: number;
}

export interface OptimisticContext<T = any> {
  previousData: T;
  optimisticData: T;
  timestamp: number;
  queryKey: unknown[];
}

export interface RollbackOptions {
  showToast?: boolean;
  retryable?: boolean;
  maxRetries?: number;
}

export interface ConflictResolution {
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'manual';
  resolver?: (serverData: any, clientData: any) => any;
}

// ============================================================================
// Temporary ID Generation
// ============================================================================

/**
 * Generate a temporary ID for optimistic creates
 * Format: temp-{timestamp}-{random}
 */
export function generateTempId(prefix: string = 'temp'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Check if an ID is temporary
 */
export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}

/**
 * Replace temporary ID with real ID in data structure
 */
export function replaceTempId<T extends { id: string }>(
  items: T[],
  tempId: string,
  realId: string
): T[] {
  return items.map((item) =>
    item.id === tempId ? { ...item, id: realId } : item
  );
}

// ============================================================================
// Cache Update Helpers
// ============================================================================

/**
 * Optimistically add an item to a list
 */
export function optimisticAdd<T extends { id: string }>(
  previousData: T[] | undefined,
  newItem: T,
  position: 'start' | 'end' = 'start'
): T[] {
  const existingItems = previousData || [];
  return position === 'start'
    ? [newItem, ...existingItems]
    : [...existingItems, newItem];
}

/**
 * Optimistically update an item in a list
 */
export function optimisticUpdate<T extends { id: string }>(
  previousData: T[] | undefined,
  itemId: string,
  updates: Partial<T>
): T[] {
  const existingItems = previousData || [];
  return existingItems.map((item) =>
    item.id === itemId ? { ...item, ...updates } : item
  );
}

/**
 * Optimistically remove an item from a list
 */
export function optimisticRemove<T extends { id: string }>(
  previousData: T[] | undefined,
  itemId: string
): T[] {
  const existingItems = previousData || [];
  return existingItems.filter((item) => item.id !== itemId);
}

/**
 * Optimistically increment a counter
 */
export function optimisticIncrement(
  previousValue: number | undefined,
  delta: number = 1
): number {
  return (previousValue || 0) + delta;
}

/**
 * Optimistically decrement a counter
 */
export function optimisticDecrement(
  previousValue: number | undefined,
  delta: number = 1
): number {
  return Math.max(0, (previousValue || 0) - delta);
}

// ============================================================================
// Query Cache Helpers
// ============================================================================

/**
 * Get data from query cache safely
 */
export function getQueryData<T>(
  queryClient: QueryClient,
  queryKey: unknown[]
): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Set query data with optimistic update
 */
export function setQueryData<T>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updater: (oldData: T | undefined) => T
): void {
  queryClient.setQueryData<T>(queryKey, updater);
}

/**
 * Cancel ongoing queries to prevent race conditions
 */
export async function cancelQueries(
  queryClient: QueryClient,
  queryKey: unknown[]
): Promise<void> {
  await queryClient.cancelQueries({ queryKey });
}

/**
 * Invalidate and refetch queries after mutation
 */
export async function invalidateQueries(
  queryClient: QueryClient,
  queryKeys: unknown[][]
): Promise<void> {
  await Promise.all(
    queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
  );
}

// ============================================================================
// Rollback Helpers
// ============================================================================

/**
 * Rollback query data to previous state
 */
export function rollbackQueryData<T>(
  queryClient: QueryClient,
  queryKey: unknown[],
  previousData: T | undefined
): void {
  if (previousData !== undefined) {
    queryClient.setQueryData<T>(queryKey, previousData);
  }
}

/**
 * Rollback multiple queries
 */
export function rollbackQueries(
  queryClient: QueryClient,
  contexts: Array<{ queryKey: unknown[]; previousData: any }>
): void {
  contexts.forEach(({ queryKey, previousData }) => {
    rollbackQueryData(queryClient, queryKey, previousData);
  });
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detect if server data conflicts with optimistic data
 */
export function detectConflict<T extends { updatedAt?: string | number }>(
  serverData: T,
  optimisticData: T,
  optimisticTimestamp: number
): boolean {
  // If server data has newer timestamp than our optimistic update
  if (serverData.updatedAt && optimisticData.updatedAt) {
    const serverTime = new Date(serverData.updatedAt).getTime();
    return serverTime > optimisticTimestamp;
  }
  return false;
}

/**
 * Resolve conflict between server and client data
 */
export function resolveConflict<T>(
  serverData: T,
  clientData: T,
  resolution: ConflictResolution
): T {
  switch (resolution.strategy) {
    case 'server-wins':
      return serverData;
    
    case 'client-wins':
      return clientData;
    
    case 'merge':
      return { ...serverData, ...clientData };
    
    case 'manual':
      if (resolution.resolver) {
        return resolution.resolver(serverData, clientData);
      }
      return serverData; // Default to server
    
    default:
      return serverData;
  }
}

// ============================================================================
// Optimistic Update Tracker
// ============================================================================

class OptimisticUpdateTracker {
  private updates: Map<string, OptimisticUpdate> = new Map();

  /**
   * Track a new optimistic update
   */
  track<T>(update: OptimisticUpdate<T>): void {
    this.updates.set(update.id, update);
  }

  /**
   * Mark update as successful
   */
  markSuccess(updateId: string): void {
    const update = this.updates.get(updateId);
    if (update) {
      update.status = 'success';
      // Remove successful updates after a delay
      setTimeout(() => this.updates.delete(updateId), 5000);
    }
  }

  /**
   * Mark update as failed
   */
  markError(updateId: string, error: Error): void {
    const update = this.updates.get(updateId);
    if (update) {
      update.status = 'error';
      update.error = error;
    }
  }

  /**
   * Mark update as rolled back
   */
  markRolledBack(updateId: string): void {
    const update = this.updates.get(updateId);
    if (update) {
      update.status = 'rolled-back';
      setTimeout(() => this.updates.delete(updateId), 3000);
    }
  }

  /**
   * Get update by ID
   */
  get(updateId: string): OptimisticUpdate | undefined {
    return this.updates.get(updateId);
  }

  /**
   * Get all pending updates
   */
  getPending(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(
      (update) => update.status === 'pending'
    );
  }

  /**
   * Get all failed updates
   */
  getFailed(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(
      (update) => update.status === 'error'
    );
  }

  /**
   * Get updates by resource type
   */
  getByResource(resource: string): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(
      (update) => update.resource === resource
    );
  }

  /**
   * Clear all updates
   */
  clear(): void {
    this.updates.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = Array.from(this.updates.values());
    return {
      total: all.length,
      pending: all.filter((u) => u.status === 'pending').length,
      success: all.filter((u) => u.status === 'success').length,
      error: all.filter((u) => u.status === 'error').length,
      rolledBack: all.filter((u) => u.status === 'rolled-back').length,
    };
  }
}

// Singleton instance
export const optimisticTracker = new OptimisticUpdateTracker();

// ============================================================================
// Optimistic Mutation Helpers
// ============================================================================

/**
 * Create optimistic context for mutation
 */
export function createOptimisticContext<T>(
  queryKey: unknown[],
  previousData: T,
  optimisticData: T
): OptimisticContext<T> {
  return {
    queryKey,
    previousData,
    optimisticData,
    timestamp: Date.now(),
  };
}

/**
 * Standard optimistic mutation pattern
 */
export async function optimisticMutation<TData, TVariables, TContext>({
  queryClient,
  queryKey,
  mutationFn,
  onMutate,
  onError,
  onSuccess,
  onSettled,
}: {
  queryClient: QueryClient;
  queryKey: unknown[];
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: () => void;
}) {
  return {
    mutationFn,
    onMutate: async (variables: TVariables) => {
      // Cancel outgoing queries
      await cancelQueries(queryClient, queryKey);
      
      // Get previous data
      const previousData = getQueryData(queryClient, queryKey);
      
      // Call custom onMutate
      const context = onMutate ? await onMutate(variables) : undefined;
      
      return { previousData, context } as TContext;
    },
    onError: (error: Error, variables: TVariables, context: TContext | undefined) => {
      // Rollback on error
      if (context && typeof context === 'object' && context !== null && 'previousData' in context) {
        rollbackQueryData(queryClient, queryKey, (context as any).previousData);
      }
      
      // Call custom onError
      if (onError) {
        onError(error, variables, context);
      }
    },
    onSuccess: (data: TData, variables: TVariables, context: TContext | undefined) => {
      // Call custom onSuccess
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onSettled: async () => {
      // Refetch to sync with server
      await invalidateQueries(queryClient, [queryKey]);
      
      // Call custom onSettled
      if (onSettled) {
        onSettled();
      }
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Debounce optimistic updates to prevent rapid mutations
 */
export function debounceOptimistic<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Batch multiple optimistic updates
 */
export function batchOptimisticUpdates(
  queryClient: QueryClient,
  updates: Array<{
    queryKey: unknown[];
    updater: (oldData: any) => any;
  }>
): void {
  // Apply all updates sequentially
  updates.forEach(({ queryKey, updater }) => {
    setQueryData(queryClient, queryKey, updater);
  });
}

/**
 * Check if mutation is in progress
 */
export function isMutationPending(
  queryClient: QueryClient,
  mutationKey: unknown[]
): boolean {
  const mutationCache = queryClient.getMutationCache();
  const mutations = mutationCache.findAll({ mutationKey });
  return mutations.some((mutation) => mutation.state.status === 'pending');
}

// ============================================================================
// Export All
// ============================================================================

export default {
  // ID helpers
  generateTempId,
  isTempId,
  replaceTempId,
  
  // List operations
  optimisticAdd,
  optimisticUpdate,
  optimisticRemove,
  optimisticIncrement,
  optimisticDecrement,
  
  // Query operations
  getQueryData,
  setQueryData,
  cancelQueries,
  invalidateQueries,
  
  // Rollback
  rollbackQueryData,
  rollbackQueries,
  
  // Conflict resolution
  detectConflict,
  resolveConflict,
  
  // Tracker
  optimisticTracker,
  
  // Mutation helpers
  createOptimisticContext,
  optimisticMutation,
  
  // Utilities
  debounceOptimistic,
  batchOptimisticUpdates,
  isMutationPending,
};
