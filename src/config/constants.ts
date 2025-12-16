/**
 * Application Constants
 * 
 * Centralized configuration for the application
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://system-design-practical-production.up.railway.app/api',
  TIMEOUT: 10000, // 10 seconds
} as const;

// Pagination Settings
export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  INFINITE_SCROLL_THRESHOLD: 200, // px from bottom to trigger load
  OVERSCAN_COUNT: 3, // number of items to render outside viewport
} as const;

// Performance Settings
export const PERFORMANCE = {
  IMAGE_QUALITY: 80,
  THUMBNAIL_WIDTH: 400,
  FULL_IMAGE_WIDTH: 1200,
  LAZY_LOAD_OFFSET: 100, // px
} as const;

// Cache Settings
export const CACHE = {
  QUERY_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  QUERY_GC_TIME: 30 * 60 * 1000, // 30 minutes
  INDEXEDDB_VERSION: 1,
  INDEXEDDB_NAME: 'newsfeed',
  POSTS_STORE_NAME: 'posts',
} as const;

// WebSocket Settings
export const WEBSOCKET = {
  URL: import.meta.env.VITE_WS_URL || 'wss://system-design-practical-production.up.railway.app',
  RECONNECT_INTERVAL: 1000,
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// Mock User ID (for POC purposes)
export const CURRENT_USER_ID = 'user-1';
