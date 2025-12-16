/**
 * Cache Management Utilities
 * 
 * Comprehensive cache clearing functions for all storage types.
 * Clears IndexedDB, LocalStorage, SessionStorage, Cookies, Service Worker caches, and React Query cache.
 */

import { clearAllCaches as clearServiceWorkerCaches } from './serviceWorkerRegistration';

/**
 * Clear IndexedDB databases
 * Removes all IndexedDB databases including cache, offline queue, etc.
 */
export async function clearIndexedDB(): Promise<void> {
  try {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported');
      return;
    }

    // Get all database names
    const databases = await window.indexedDB.databases();
    
    // Delete each database
    const deletePromises = databases.map((db) => {
      return new Promise<void>((resolve, reject) => {
        if (!db.name) {
          resolve();
          return;
        }
        
        const request = window.indexedDB.deleteDatabase(db.name);
        
        request.onsuccess = () => {
          console.log(`✅ Deleted IndexedDB: ${db.name}`);
          resolve();
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to delete IndexedDB: ${db.name}`);
          reject(request.error);
        };
        
        request.onblocked = () => {
          console.warn(`⚠️ Blocked deleting IndexedDB: ${db.name}`);
          // Still resolve, as we tried
          resolve();
        };
      });
    });

    await Promise.allSettled(deletePromises);
    console.log('✅ All IndexedDB databases cleared');
  } catch (error) {
    console.error('❌ Error clearing IndexedDB:', error);
    throw error;
  }
}

/**
 * Clear LocalStorage
 * Removes all items from localStorage
 */
export function clearLocalStorage(): void {
  try {
    const itemCount = localStorage.length;
    localStorage.clear();
    console.log(`✅ LocalStorage cleared (${itemCount} items removed)`);
  } catch (error) {
    console.error('❌ Error clearing localStorage:', error);
    throw error;
  }
}

/**
 * Clear SessionStorage
 * Removes all items from sessionStorage
 */
export function clearSessionStorage(): void {
  try {
    const itemCount = sessionStorage.length;
    sessionStorage.clear();
    console.log(`✅ SessionStorage cleared (${itemCount} items removed)`);
  } catch (error) {
    console.error('❌ Error clearing sessionStorage:', error);
    throw error;
  }
}

/**
 * Clear all cookies
 * Removes all cookies for the current domain
 */
export function clearCookies(): void {
  try {
    const cookies = document.cookie.split(';');
    let clearedCount = 0;

    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      
      // Delete cookie for current path
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      
      // Delete cookie for root path
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      
      clearedCount++;
    }

    console.log(`✅ Cookies cleared (${clearedCount} cookies removed)`);
  } catch (error) {
    console.error('❌ Error clearing cookies:', error);
    throw error;
  }
}

/**
 * Clear React Query cache
 * Removes all cached queries from React Query
 */
export function clearReactQueryCache(): void {
  try {
    // This will be called from the component that has access to queryClient
    // We'll export a setter for it
    if (reactQueryClearFn) {
      reactQueryClearFn();
      console.log('✅ React Query cache cleared');
    } else {
      console.warn('⚠️ React Query cache clear function not registered');
    }
  } catch (error) {
    console.error('❌ Error clearing React Query cache:', error);
    throw error;
  }
}

// Store React Query clear function
let reactQueryClearFn: (() => void) | null = null;

export function registerReactQueryClearFn(clearFn: () => void): void {
  reactQueryClearFn = clearFn;
}

/**
 * Clear ALL caches and storage
 * 
 * Clears everything:
 * - Service Worker caches
 * - IndexedDB
 * - LocalStorage
 * - SessionStorage
 * - Cookies
 * - React Query cache
 * 
 * @returns Summary of what was cleared
 */
export async function clearAllStorage(): Promise<{
  success: boolean;
  cleared: string[];
  errors: string[];
}> {
  const cleared: string[] = [];
  const errors: string[] = [];

  console.log('🗑️ Starting complete cache clearing...');

  // 1. Clear Service Worker caches
  try {
    await clearServiceWorkerCaches();
    cleared.push('Service Worker caches');
  } catch (error) {
    errors.push('Service Worker caches');
    console.error('Error clearing SW caches:', error);
  }

  // 2. Clear IndexedDB
  try {
    await clearIndexedDB();
    cleared.push('IndexedDB databases');
  } catch (error) {
    errors.push('IndexedDB databases');
  }

  // 3. Clear LocalStorage
  try {
    clearLocalStorage();
    cleared.push('LocalStorage');
  } catch (error) {
    errors.push('LocalStorage');
  }

  // 4. Clear SessionStorage
  try {
    clearSessionStorage();
    cleared.push('SessionStorage');
  } catch (error) {
    errors.push('SessionStorage');
  }

  // 5. Clear Cookies
  try {
    clearCookies();
    cleared.push('Cookies');
  } catch (error) {
    errors.push('Cookies');
  }

  // 6. Clear React Query cache
  try {
    clearReactQueryCache();
    cleared.push('React Query cache');
  } catch (error) {
    errors.push('React Query cache');
  }

  const success = errors.length === 0;

  console.log(`${success ? '✅' : '⚠️'} Cache clearing complete!`);
  console.log(`  Cleared: ${cleared.join(', ')}`);
  if (errors.length > 0) {
    console.log(`  Errors: ${errors.join(', ')}`);
  }

  return { success, cleared, errors };
}

/**
 * Get storage usage statistics
 * Shows how much storage is being used
 */
export async function getStorageStats(): Promise<{
  quota: number;
  usage: number;
  percentage: number;
  available: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota || 0;
    const usage = estimate.usage || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;
    const available = quota - usage;

    return {
      quota: Math.round(quota / 1024 / 1024), // MB
      usage: Math.round(usage / 1024 / 1024), // MB
      percentage: Math.round(percentage * 10) / 10,
      available: Math.round(available / 1024 / 1024), // MB
    };
  }

  return {
    quota: 0,
    usage: 0,
    percentage: 0,
    available: 0,
  };
}
