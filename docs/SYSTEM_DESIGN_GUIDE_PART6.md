# System Design in Action: Building a Production-Ready News Feed

## Part 6: Offline-First Architecture

> **Building apps that work without internet: Offline queue, background sync, PWA**

---

## Table of Contents (Part 6)

22. [Offline Strategy Overview](#offline-strategy)
23. [Offline Queue Implementation](#offline-queue)
24. [Background Sync](#background-sync)
25. [Network Detection](#network-detection)

---

## Offline Strategy Overview {#offline-strategy}

### Why Offline-First?

**Traditional approach (Online-only):**
```
No internet → App breaks → User frustrated → Data lost
```

**Offline-first approach:**
```
No internet → App works → Changes queued → Sync when online → No data lost
```

**Real-world scenarios:**
- Subway/tunnel (5-10 minutes offline)
- Airplane (hours offline)
- Rural areas (spotty connection)
- Network congestion (slow/unstable)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User Action (e.g., Like Post)                           │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Check: navigator.onLine                                 │
└─────────────────────────────────────────────────────────┘
        ↓ Online                    ↓ Offline
┌─────────────────────┐    ┌─────────────────────────────┐
│ Optimistic Update   │    │ Optimistic Update           │
│ API Call            │    │ Enqueue to Offline Queue    │
│ Success → Done      │    │ Store in IndexedDB          │
│ Error → Retry/Queue │    │ Show "Will sync" toast      │
└─────────────────────┘    └─────────────────────────────┘
                                    ↓
                           ┌─────────────────────────────┐
                           │ Network Reconnects          │
                           └─────────────────────────────┘
                                    ↓
                           ┌─────────────────────────────┐
                           │ Process Queue (FIFO)        │
                           │ Retry with backoff          │
                           │ Update UI on sync           │
                           └─────────────────────────────┘
```

---

## Offline Queue Implementation {#offline-queue}

### Database Schema

**File:** [src/utils/offlineQueue.ts](src/utils/offlineQueue.ts) (380 lines)

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Supported action types
export type QueueActionType =
  | 'CREATE_POST'
  | 'LIKE_POST'
  | 'UNLIKE_POST'
  | 'ADD_COMMENT'
  | 'DELETE_POST'
  | 'EDIT_POST';

// Queue item structure
export interface QueuedAction {
  id: string;                // Unique ID: `${type}_${timestamp}`
  type: QueueActionType;     // Action type
  payload: any;              // Action data
  timestamp: number;         // When queued
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retries: number;           // Retry attempts
  error?: string;            // Error message if failed
}

// Database schema
interface OfflineQueueDB extends DBSchema {
  queue: {
    key: string;
    value: QueuedAction;
    indexes: {
      'by-timestamp': number;
      'by-status': string;
    };
  };
}

const DB_NAME = 'offline-queue';
const DB_VERSION = 1;

// Open database
let dbPromise: Promise<IDBPDatabase<OfflineQueueDB>> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineQueueDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-status', 'status');
      },
    });
  }
  return dbPromise;
}
```

### Queue Operations

```typescript
// ═══════════════════════════════════════════════════════════
// ENQUEUE: Add action to queue
// ═══════════════════════════════════════════════════════════
export async function enqueueAction(
  type: QueueActionType,
  payload: any
): Promise<string> {
  const db = await getDB();

  const action: QueuedAction = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    status: 'pending',
    retries: 0,
  };

  await db.add('queue', action);

  console.log('[Offline Queue] Enqueued:', type, action.id);

  return action.id;
}

// ═══════════════════════════════════════════════════════════
// GET PENDING: Get all pending actions (FIFO order)
// ═══════════════════════════════════════════════════════════
export async function getPendingActions(): Promise<QueuedAction[]> {
  const db = await getDB();
  const tx = db.transaction('queue', 'readonly');
  const index = tx.store.index('by-status');

  // Get all pending actions
  const actions = await index.getAll('pending');

  // Sort by timestamp (FIFO)
  return actions.sort((a, b) => a.timestamp - b.timestamp);
}

// ═══════════════════════════════════════════════════════════
// UPDATE STATUS: Update action status
// ═══════════════════════════════════════════════════════════
export async function updateActionStatus(
  id: string,
  status: QueuedAction['status'],
  error?: string
): Promise<void> {
  const db = await getDB();
  const action = await db.get('queue', id);

  if (!action) return;

  action.status = status;
  if (error) action.error = error;

  await db.put('queue', action);
}

// ═══════════════════════════════════════════════════════════
// INCREMENT RETRIES: Increment retry count
// ═══════════════════════════════════════════════════════════
export async function incrementRetries(id: string): Promise<number> {
  const db = await getDB();
  const action = await db.get('queue', id);

  if (!action) return 0;

  action.retries++;
  await db.put('queue', action);

  return action.retries;
}

// ═══════════════════════════════════════════════════════════
// DEQUEUE: Remove completed action
// ═══════════════════════════════════════════════════════════
export async function dequeueAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('queue', id);
  console.log('[Offline Queue] Dequeued:', id);
}

// ═══════════════════════════════════════════════════════════
// STATS: Get queue statistics
// ═══════════════════════════════════════════════════════════
export async function getQueueStats(): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  total: number;
}> {
  const db = await getDB();
  const all = await db.getAll('queue');

  return {
    pending: all.filter(a => a.status === 'pending').length,
    syncing: all.filter(a => a.status === 'syncing').length,
    failed: all.filter(a => a.status === 'failed').length,
    total: all.length,
  };
}
```

### Sync Manager

**File:** [src/utils/offlineQueueInit.ts](src/utils/offlineQueueInit.ts)

```typescript
import { QueryClient } from '@tanstack/react-query';
import { feedApi } from '@/services/api';

class OfflineSyncManager {
  private syncInterval: number | null = null;
  private isSyncing = false;
  private handlers = new Map<QueueActionType, (action: QueuedAction) => Promise<void>>();

  // ════════════════════════════════════════════════════════
  // REGISTER HANDLERS: Map action types to API calls
  // ════════════════════════════════════════════════════════
  registerHandler(type: QueueActionType, handler: (action: QueuedAction) => Promise<void>) {
    this.handlers.set(type, handler);
  }

  // ════════════════════════════════════════════════════════
  // SYNC QUEUE: Process all pending actions
  // ════════════════════════════════════════════════════════
  async syncQueue(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping...');
      return { success: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      console.log('[Sync] Offline, skipping...');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const pending = await getPendingActions();

      console.log(`[Sync] Processing ${pending.length} actions...`);

      for (const action of pending) {
        try {
          // Exponential backoff for retries
          if (action.retries > 0) {
            const delay = Math.min(1000 * Math.pow(2, action.retries), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          // Mark as syncing
          await updateActionStatus(action.id, 'syncing');

          // Execute action
          const handler = this.handlers.get(action.type);
          if (!handler) {
            throw new Error(`No handler for action type: ${action.type}`);
          }

          await handler(action);

          // Success: Remove from queue
          await dequeueAction(action.id);
          successCount++;

          console.log(`[Sync] ✓ ${action.type} succeeded`);

        } catch (error) {
          const retries = await incrementRetries(action.id);

          if (retries >= 3) {
            // Max retries: Mark as failed
            await updateActionStatus(action.id, 'failed', (error as Error).message);
            failedCount++;
            console.error(`[Sync] ✗ ${action.type} failed after 3 retries`);
          } else {
            // Will retry: Reset to pending
            await updateActionStatus(action.id, 'pending');
            console.warn(`[Sync] ⚠ ${action.type} failed, will retry (${retries}/3)`);
          }
        }
      }

      console.log(`[Sync] Complete: ${successCount} succeeded, ${failedCount} failed`);

    } finally {
      this.isSyncing = false;
    }

    return { success: successCount, failed: failedCount };
  }

  // ════════════════════════════════════════════════════════
  // AUTO SYNC: Sync every 30 seconds when online
  // ════════════════════════════════════════════════════════
  startAutoSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncQueue();
      }
    }, 30000); // 30 seconds

    console.log('[Sync] Auto-sync started (30s interval)');
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[Sync] Auto-sync stopped');
    }
  }
}

// Global instance
export const syncManager = new OfflineSyncManager();

// ════════════════════════════════════════════════════════
// INITIALIZE: Register handlers and start auto-sync
// ════════════════════════════════════════════════════════
export function initializeOfflineQueue(
  queryClient: QueryClient,
  onSyncComplete?: (result: { success: number; failed: number }) => void
) {
  // Register CREATE_POST handler
  syncManager.registerHandler('CREATE_POST', async (action) => {
    const post = await feedApi.createPost(action.payload);
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
    return post;
  });

  // Register LIKE_POST handler
  syncManager.registerHandler('LIKE_POST', async (action) => {
    await feedApi.likePost(action.payload.postId, action.payload.userId);
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Register UNLIKE_POST handler
  syncManager.registerHandler('UNLIKE_POST', async (action) => {
    await feedApi.unlikePost(action.payload.postId, action.payload.userId);
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Register ADD_COMMENT handler
  syncManager.registerHandler('ADD_COMMENT', async (action) => {
    await feedApi.addComment(action.payload.postId, action.payload);
    queryClient.invalidateQueries({ queryKey: ['comments', action.payload.postId] });
    queryClient.invalidateQueries({ queryKey: ['post', action.payload.postId] });
  });

  // Register DELETE_POST handler
  syncManager.registerHandler('DELETE_POST', async (action) => {
    await feedApi.deletePost(action.payload.postId);
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
  });

  // Register EDIT_POST handler
  syncManager.registerHandler('EDIT_POST', async (action) => {
    await feedApi.updatePost(action.payload.postId, action.payload);
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
    queryClient.invalidateQueries({ queryKey: ['post', action.payload.postId] });
  });

  // Listen for online event
  window.addEventListener('online', async () => {
    console.log('[Network] Online, syncing queue...');
    const result = await syncManager.syncQueue();
    onSyncComplete?.(result);
  });

  // Start auto-sync
  syncManager.startAutoSync();

  console.log('[Offline Queue] Initialized');
}
```

### Usage in Hooks

```typescript
// File: src/hooks/useLikePost.ts
export function useLikePost() {
  const { isOnline } = useNetworkStatus();
  const { addToast } = useToast();

  return useOptimisticMutation({
    mutationFn: async ({ postId, userId, isLiked }) => {
      // Check if offline
      if (!isOnline) {
        // Enqueue to offline queue
        await enqueueAction(isLiked ? 'UNLIKE_POST' : 'LIKE_POST', {
          postId,
          userId,
        });

        addToast({
          type: 'info',
          title: 'Offline',
          message: 'Your like will sync when you\'re back online',
          duration: 3000,
        });

        return; // Don't make API call
      }

      // Online: Make API call
      if (isLiked) {
        await feedApi.unlikePost(postId, userId);
      } else {
        await feedApi.likePost(postId, userId);
      }
    },
    // ... rest of mutation config
  });
}
```

---

## Background Sync {#background-sync}

### Service Worker Background Sync API

**File:** [public/service-worker.js](public/service-worker.js)

```javascript
// ═══════════════════════════════════════════════════════════
// BACKGROUND SYNC: Retry failed requests when online
// ═══════════════════════════════════════════════════════════

// Register sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

// Sync offline queue
async function syncOfflineQueue() {
  console.log('[SW] Syncing offline queue...');

  try {
    // Get pending actions from IndexedDB
    const db = await openIndexedDB('offline-queue', 1);
    const tx = db.transaction('queue', 'readonly');
    const pending = await tx.objectStore('queue')
      .index('by-status')
      .getAll('pending');

    // Process each action
    for (const action of pending) {
      try {
        await executeAction(action);
        await markActionComplete(action.id);
      } catch (error) {
        await incrementRetries(action.id);
      }
    }

    console.log('[SW] Sync complete');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error; // Will retry
  }
}

async function executeAction(action) {
  const { type, payload } = action;

  switch (type) {
    case 'CREATE_POST':
      return fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

    case 'LIKE_POST':
      return fetch(`/api/posts/${payload.postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: payload.userId }),
      });

    // ... other actions
  }
}

// ═══════════════════════════════════════════════════════════
// TRIGGER SYNC: Request background sync from main thread
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data.type === 'SYNC_OFFLINE_QUEUE') {
    // Register sync (will run when online)
    self.registration.sync.register('sync-offline-queue');
  }
});
```

### Triggering from Main Thread

```typescript
// Request background sync when user goes offline
window.addEventListener('offline', () => {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('sync-offline-queue');
    });
  }
});
```

---

## Network Detection {#network-detection}

### Hook Implementation

**File:** [src/hooks/useNetworkStatus.tsx](src/hooks/useNetworkStatus.tsx)

```typescript
import { useState, useEffect } from 'react';
import { syncManager } from '@/utils/offlineQueueInit';
import { useToast } from './useToast';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    // ══════════════════════════════════════════════════════
    // ONLINE: Network connection restored
    // ══════════════════════════════════════════════════════
    const handleOnline = async () => {
      console.log('[Network] Online');
      setIsOnline(true);

      if (wasOffline) {
        addToast({
          type: 'success',
          title: 'Back Online',
          message: 'Syncing your changes...',
          duration: 3000,
        });

        // Sync offline queue
        try {
          const result = await syncManager.syncQueue();

          if (result.success > 0) {
            addToast({
              type: 'success',
              title: 'Synced',
              message: `${result.success} action(s) synced successfully`,
              duration: 3000,
            });
          }

          if (result.failed > 0) {
            addToast({
              type: 'error',
              title: 'Sync Failed',
              message: `${result.failed} action(s) failed to sync`,
              duration: 5000,
            });
          }
        } catch (error) {
          console.error('[Network] Sync error:', error);
        }
      }

      setWasOffline(false);
    };

    // ══════════════════════════════════════════════════════
    // OFFLINE: Network connection lost
    // ══════════════════════════════════════════════════════
    const handleOffline = () => {
      console.log('[Network] Offline');
      setIsOnline(false);
      setWasOffline(true);

      addToast({
        type: 'warning',
        title: 'Offline',
        message: 'You\'re offline. Changes will sync when reconnected.',
        duration: 5000,
      });
    };

    // Register listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline, addToast]);

  return {
    isOnline,
    wasOffline,
  };
}
```

### Network Status Indicator

```typescript
// File: src/components/common/NetworkStatus.tsx
export function NetworkStatus() {
  const { isOnline } = useNetworkStatus();
  const stats = useQuery({
    queryKey: ['offline-queue-stats'],
    queryFn: getQueueStats,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isOnline && (!stats.data || stats.data.total === 0)) {
    return null; // Hide when online and no pending actions
  }

  return (
    <div className={`network-status ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? (
        <div className="online-indicator">
          <WifiIcon /> Online
          {stats.data && stats.data.pending > 0 && (
            <span className="syncing">
              Syncing {stats.data.pending} action(s)...
            </span>
          )}
        </div>
      ) : (
        <div className="offline-indicator">
          <WifiOffIcon /> Offline
          {stats.data && stats.data.pending > 0 && (
            <span className="queued">
              {stats.data.pending} action(s) queued
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

### Advanced: Connection Quality Detection

```typescript
// Detect slow connections (beyond just online/offline)
export function useConnectionQuality() {
  const [quality, setQuality] = useState<'fast' | 'slow' | 'offline'>('fast');

  useEffect(() => {
    // Check if Network Information API is available
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (!connection) return;

    const updateQuality = () => {
      if (!navigator.onLine) {
        setQuality('offline');
        return;
      }

      const effectiveType = connection.effectiveType;

      // 4g, 3g, 2g, slow-2g
      if (effectiveType === '4g') {
        setQuality('fast');
      } else {
        setQuality('slow');
      }
    };

    updateQuality();
    connection.addEventListener('change', updateQuality);

    return () => {
      connection.removeEventListener('change', updateQuality);
    };
  }, []);

  return quality;
}

// Adapt behavior based on connection quality
function PostImage({ src }: { src: string }) {
  const quality = useConnectionQuality();

  // Load low-res image on slow connections
  const imageSrc = quality === 'slow'
    ? src.replace('/full/', '/thumbnail/')
    : src;

  return <img src={imageSrc} loading="lazy" />;
}
```

---

**End of Part 6**

**Next:** Part 7 - Performance Optimization (Code splitting, lazy loading, memoization, bundle optimization)

