/**
 * Service Worker for News Feed PWA
 * 
 * Provides offline support and caching for static assets.
 * This enables the app to work without network connection.
 * 
 * Cache Strategy:
 * - Static Assets (HTML/CSS/JS/Images): Cache-first with fallback to network
 * - API Requests: Network-first with fallback to IndexedDB (handled by app)
 * - Offline Page: Served when no network and no cache
 * 
 * Cache Layers:
 * - L1: React Query (Memory) - Managed by app
 * - L2: IndexedDB (Persistent) - Managed by app via indexedDBCache.ts
 * - L3: Service Worker (Static Assets) - This file
 * 
 * System Design Concepts:
 * - Progressive Web App (PWA)
 * - Offline-first architecture
 * - Cache-first for static, network-first for dynamic
 * - Stale-while-revalidate for optimal UX
 */

const CACHE_NAME = 'newsfeed-v1';
const STATIC_CACHE_NAME = 'newsfeed-static-v1';
const RUNTIME_CACHE_NAME = 'newsfeed-runtime-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/vite.svg',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
];

// API endpoints that should use network-first strategy
const API_ENDPOINTS = [
  '/api/feed',
  '/api/posts',
  '/api/users',
  '/api/comments',
];

// ============================================================================
// Service Worker Lifecycle Events
// ============================================================================

/**
 * Install Event
 * 
 * Fired when service worker is first installed.
 * Pre-caches critical static assets for offline use.
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Force activation immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

/**
 * Activate Event
 * 
 * Fired when service worker becomes active.
 * Cleans up old caches from previous versions.
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches
              return (
                cacheName !== STATIC_CACHE_NAME &&
                cacheName !== RUNTIME_CACHE_NAME &&
                cacheName !== CACHE_NAME
              );
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

/**
 * Fetch Event
 * 
 * Intercepts all network requests and applies caching strategies.
 * 
 * Strategy Selection:
 * 1. API Requests: Network-first (let app handle IndexedDB fallback)
 * 2. Static Assets: Cache-first with network fallback
 * 3. Navigation: Cache-first with offline page fallback
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // API Requests: Network-first
  // Let the app handle IndexedDB fallback via cacheCoordinator
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Navigation Requests: Cache-first with offline page
  if (request.mode === 'navigate') {
    event.respondWith(cacheFirstWithOfflineFallback(request));
    return;
  }

  // Static Assets: Cache-first with network fallback
  event.respondWith(cacheFirst(request));
});

// ============================================================================
// Caching Strategies
// ============================================================================

/**
 * Cache-First Strategy
 * 
 * Check cache first, fallback to network if not found.
 * Best for static assets that don't change often.
 * 
 * Flow:
 * 1. Check cache
 * 2. If found, return cached response
 * 3. If not found, fetch from network
 * 4. Cache network response for future use
 */
async function cacheFirst(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Cache hit:', request.url);
      return cachedResponse;
    }

    // Cache miss - fetch from network
    console.log('[SW] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);

    // Cache the response for future use
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first failed:', error);
    
    // Try one more time from cache as ultimate fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Cache-First with Offline Fallback
 * 
 * Similar to cache-first but returns offline page if everything fails.
 * Best for navigation requests.
 */
async function cacheFirstWithOfflineFallback(request) {
  try {
    return await cacheFirst(request);
  } catch (error) {
    console.log('[SW] Serving offline page');
    const offlinePage = await caches.match('/offline.html');
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

/**
 * Network-First Strategy
 * 
 * Try network first, fallback to cache if network fails.
 * Best for API requests where fresh data is preferred.
 * 
 * Note: This is a simplified version. The app handles more sophisticated
 * caching via IndexedDB (L2 cache) through cacheCoordinator.ts
 * 
 * Flow:
 * 1. Try network first
 * 2. If network succeeds, cache response
 * 3. If network fails, check cache
 * 4. If cache empty, let app handle IndexedDB fallback
 */
async function networkFirst(request) {
  try {
    // Try network first
    console.log('[SW] Network request:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful response
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, checking cache:', request.url);

    // Network failed - check cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache');
      return cachedResponse;
    }

    // No cache available - let the request fail
    // The app will handle IndexedDB fallback via cacheCoordinator
    console.log('[SW] No cache available, app will handle');
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if request is an API call
 */
function isApiRequest(url) {
  return API_ENDPOINTS.some((endpoint) => url.pathname.startsWith(endpoint));
}

/**
 * Message Handler
 * 
 * Handle messages from the app (e.g., cache invalidation requests)
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }

  if (event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(RUNTIME_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching URLs:', urls);
        return cache.addAll(urls);
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
