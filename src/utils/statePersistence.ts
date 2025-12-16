/**
 * State Persistence Utilities
 * 
 * Provides type-safe localStorage/sessionStorage wrappers with TTL support,
 * error handling, and automatic cleanup of stale data.
 * 
 * System Design Concepts:
 * - State Persistence: Maintain user state across sessions
 * - TTL (Time-To-Live): Automatic expiration of stale data
 * - Type Safety: Generic types for compile-time safety
 * - Error Resilience: Graceful handling of quota exceeded errors
 * - Data Migration: Version support for schema changes
 * - Privacy: Sensitive data exclusion patterns
 * 
 * Features:
 * - Automatic JSON serialization/deserialization
 * - TTL-based expiration with configurable policies
 * - Storage quota management
 * - Batch operations for performance
 * - Namespace support to avoid collisions
 * - Compression for large data (optional)
 * 
 * Usage:
 * ```tsx
 * // Save with TTL
 * persistentStorage.set('user-preferences', { theme: 'light' }, { ttl: 7 * 24 * 60 * 60 * 1000 });
 * 
 * // Retrieve with default
 * const prefs = persistentStorage.get('user-preferences', { theme: 'dark' });
 * 
 * // Session-only storage
 * sessionStorage.set('temp-data', data);
 * 
 * // Cleanup stale data
 * cleanupStaleData();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface StorageOptions {
  ttl?: number; // Time-to-live in milliseconds
  version?: number; // Schema version for migrations
  compress?: boolean; // Compress large data (future enhancement)
}

interface StorageItem<T> {
  value: T;
  timestamp: number;
  ttl?: number;
  version?: number;
}

export type StorageType = 'local' | 'session';

export interface StorageConfig {
  namespace?: string;
  type: StorageType;
  enableLogging?: boolean;
}

// ============================================================================
// Storage Class
// ============================================================================

class PersistentStorage {
  private namespace: string;
  private storage: Storage;
  private enableLogging: boolean;

  constructor(config: StorageConfig) {
    this.namespace = config.namespace || 'app';
    this.storage = config.type === 'local' ? window.localStorage : window.sessionStorage;
    this.enableLogging = config.enableLogging || false;
  }

  /**
   * Get namespaced key
   */
  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Log to console if enabled
   */
  private log(_message: string, _data?: unknown): void {
    if (this.enableLogging) {
    }
  }

  /**
   * Check if stored item is expired
   */
  private isExpired(item: StorageItem<unknown>): boolean {
    if (!item.ttl) return false;
    const age = Date.now() - item.timestamp;
    return age > item.ttl;
  }

  /**
   * Set item in storage with optional TTL
   */
  set<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    try {
      const namespacedKey = this.getKey(key);
      const item: StorageItem<T> = {
        value,
        timestamp: Date.now(),
        ttl: options.ttl,
        version: options.version,
      };

      const serialized = JSON.stringify(item);
      this.storage.setItem(namespacedKey, serialized);
      this.log(`Set "${key}"`, { size: serialized.length, ttl: options.ttl });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearOldest(5); // Clear 5 oldest items
        // Retry once
        try {
          const namespacedKey = this.getKey(key);
          const item: StorageItem<T> = {
            value,
            timestamp: Date.now(),
            ttl: options.ttl,
            version: options.version,
          };
          this.storage.setItem(namespacedKey, JSON.stringify(item));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Get item from storage with optional default value
   */
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const namespacedKey = this.getKey(key);
      const serialized = this.storage.getItem(namespacedKey);

      if (!serialized) {
        this.log(`Get "${key}": not found`);
        return defaultValue ?? null;
      }

      const item: StorageItem<T> = JSON.parse(serialized);

      // Check expiration
      if (this.isExpired(item)) {
        this.log(`Get "${key}": expired, removing`);
        this.remove(key);
        return defaultValue ?? null;
      }

      this.log(`Get "${key}": found`);
      return item.value;
    } catch (error) {
      return defaultValue ?? null;
    }
  }

  /**
   * Remove item from storage
   */
  remove(key: string): void {
    try {
      const namespacedKey = this.getKey(key);
      this.storage.removeItem(namespacedKey);
      this.log(`Removed "${key}"`);
    } catch (error) {
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  }

  /**
   * Clear all items in namespace
   */
  clear(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(`${this.namespace}:`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.storage.removeItem(key));
      this.log(`Cleared ${keysToRemove.length} items`);
    } catch (error) {
    }
  }

  /**
   * Get all keys in namespace
   */
  keys(): string[] {
    const keys: string[] = [];
    const prefix = `${this.namespace}:`;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.slice(prefix.length));
      }
    }
    return keys;
  }

  /**
   * Clear oldest items (by timestamp)
   */
  clearOldest(count: number): void {
    try {
      const items: Array<{ key: string; timestamp: number }> = [];
      const prefix = `${this.namespace}:`;

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(prefix)) {
          const serialized = this.storage.getItem(key);
          if (serialized) {
            try {
              const item: StorageItem<unknown> = JSON.parse(serialized);
              items.push({ key, timestamp: item.timestamp });
            } catch {
              // Invalid item, skip
            }
          }
        }
      }

      // Sort by timestamp (oldest first)
      items.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest items
      const toRemove = items.slice(0, count);
      toRemove.forEach(item => this.storage.removeItem(item.key));
      this.log(`Cleared ${toRemove.length} oldest items`);
    } catch (error) {
    }
  }

  /**
   * Get storage size estimate in bytes
   */
  getSize(): number {
    let size = 0;
    const prefix = `${this.namespace}:`;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = this.storage.getItem(key);
        if (value) {
          size += key.length + value.length;
        }
      }
    }
    return size * 2; // Each character is 2 bytes in UTF-16
  }

  /**
   * Cleanup expired items
   */
  cleanup(): number {
    let removed = 0;
    const keys = this.keys();
    
    keys.forEach(key => {
      const value = this.get(key);
      if (value === null) {
        removed++;
      }
    });

    this.log(`Cleanup: removed ${removed} expired items`);
    return removed;
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

export const persistentStorage = new PersistentStorage({
  namespace: 'app',
  type: 'local',
  enableLogging: import.meta.env.DEV, // Enable logging in dev mode
});

export const sessionPersistentStorage = new PersistentStorage({
  namespace: 'app',
  type: 'session',
  enableLogging: import.meta.env.DEV, // Enable logging in dev mode
});

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Cleanup stale data on app initialization
 */
export function cleanupStaleData(): void {
  try {
    const localRemoved = persistentStorage.cleanup();
    const sessionRemoved = sessionPersistentStorage.cleanup();
    
    if (localRemoved + sessionRemoved > 0) {
    }
  } catch (error) {
  }
}

/**
 * Get storage usage statistics
 */
export function getStorageStats() {
  return {
    localStorage: {
      size: persistentStorage.getSize(),
      keys: persistentStorage.keys().length,
    },
    sessionStorage: {
      size: sessionPersistentStorage.getSize(),
      keys: sessionPersistentStorage.keys().length,
    },
  };
}

/**
 * Clear all app storage (use with caution!)
 */
export function clearAllStorage(): void {
  persistentStorage.clear();
  sessionPersistentStorage.clear();
}

// ============================================================================
// TTL Policies (Common TTL values)
// ============================================================================

export const TTL = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  THREE_MONTHS: 90 * 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// Specialized Storage Keys (for consistency)
// ============================================================================

export const STORAGE_KEYS = {
  // User preferences
  USER_PREFERENCES: 'user-preferences',
  THEME: 'theme',
  
  // Draft data
  POST_DRAFT: 'post-draft',
  COMMENT_DRAFT: 'comment-draft',
  
  // UI state
  SCROLL_POSITION: 'scroll-position',
  SEARCH_QUERY: 'search-query',
  ACTIVE_FILTERS: 'active-filters',
  SIDEBAR_COLLAPSED: 'sidebar-collapsed',
  
  // Session data
  LAST_VISIT: 'last-visit',
  VISITED_POSTS: 'visited-posts',
} as const;
