/**
 * Offline Queue Initialization
 * 
 * Initializes sync handlers and sets up auto-sync on reconnection.
 * This must be called once at app startup and handlers remain registered
 * for the entire app lifetime, preventing race conditions.
 */

import { syncManager } from './offlineQueue';
import { feedApi } from '../services/api';
import type { QueryClient } from '@tanstack/react-query';

const CURRENT_USER_ID = 'user-1'; // TODO: Replace with real auth

let initialized = false;
let onlineEventListener: (() => Promise<void>) | null = null;

/**
 * Initialize offline queue handlers and auto-sync
 * 
 * Call this once when the app starts. It will:
 * - Register all sync handlers
 * - Set up online event listener
 * - Start auto-sync polling
 * 
 * @param queryClient - React Query client for cache invalidation
 * @param onSyncComplete - Optional callback when sync completes
 */
export function initializeOfflineQueue(
  queryClient: QueryClient,
  onSyncComplete?: (result: { success: number; failed: number }) => void
) {
  if (initialized) {
    console.log('[OfflineQueue] Already initialized, skipping...');
    return;
  }

  console.log('[OfflineQueue] Initializing handlers and auto-sync...');

  // Register CREATE_POST handler
  syncManager.registerHandler('CREATE_POST', async (action) => {
    console.log('[OfflineQueue] Executing CREATE_POST handler', action);
    const { content, mediaUrls } = action.payload;
    await feedApi.createPost({
      content,
      authorId: CURRENT_USER_ID,
      mediaUrls: mediaUrls || [],
    });
    // Invalidate feed cache to show new post
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Register LIKE_POST handler
  syncManager.registerHandler('LIKE_POST', async (action) => {
    console.log('[OfflineQueue] Executing LIKE_POST handler', action);
    const { postId } = action.payload;
    await feedApi.likePost(postId, CURRENT_USER_ID);
    // Invalidate specific post and feed
    queryClient.invalidateQueries({ queryKey: ['post', postId] });
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Register UNLIKE_POST handler
  syncManager.registerHandler('UNLIKE_POST', async (action) => {
    console.log('[OfflineQueue] Executing UNLIKE_POST handler', action);
    const { postId } = action.payload;
    await feedApi.unlikePost(postId, CURRENT_USER_ID);
    // Invalidate specific post and feed
    queryClient.invalidateQueries({ queryKey: ['post', postId] });
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Register ADD_COMMENT handler
  syncManager.registerHandler('ADD_COMMENT', async (action) => {
    console.log('[OfflineQueue] Executing ADD_COMMENT handler', action);
    const { postId, text, parentId } = action.payload;
    await feedApi.addComment(postId, {
      text,
      userId: CURRENT_USER_ID,
      parentId,
    });
    // Invalidate comments and post
    queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    queryClient.invalidateQueries({ queryKey: ['post', postId] });
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Set up online event listener for immediate sync when reconnecting
  onlineEventListener = async () => {
    console.log('[OfflineQueue] Network reconnected, triggering sync...');
    const result = await syncManager.syncQueue();
    console.log('[OfflineQueue] Sync complete:', result);
    
    if (onSyncComplete) {
      onSyncComplete(result);
    }
  };

  window.addEventListener('online', onlineEventListener);

  // Start auto-sync polling (every 30 seconds)
  syncManager.startAutoSync();

  initialized = true;
  console.log('[OfflineQueue] Initialization complete');
}

/**
 * Clean up offline queue (call when app unmounts, if needed)
 */
export function cleanupOfflineQueue() {
  if (!initialized) return;

  console.log('[OfflineQueue] Cleaning up...');

  if (onlineEventListener) {
    window.removeEventListener('online', onlineEventListener);
    onlineEventListener = null;
  }

  syncManager.stopAutoSync();

  initialized = false;
}

/**
 * Check if offline queue is initialized
 */
export function isOfflineQueueInitialized(): boolean {
  return initialized;
}
