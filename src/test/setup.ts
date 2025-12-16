/**
 * Test Setup File
 * 
 * Global configuration for Vitest tests including:
 * - Testing Library matchers
 * - Mock Service Worker (MSW) setup
 * - Global mocks and utilities
 * - Browser API polyfills
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import fake-indexeddb for IndexedDB support in tests
import 'fake-indexeddb/auto';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver (used by infinite scroll)
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(),
})) as any;

// Mock ResizeObserver (used by react-window)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock matchMedia (used by responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo (used by navigation)
globalThis.scrollTo = vi.fn() as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock fetch (will be overridden by MSW in specific tests)
(globalThis as any).fetch = vi.fn();

// Mock WebSocket
globalThis.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN state
})) as any;

// Mock performance.now()
if (!globalThis.performance) {
  globalThis.performance = {} as any;
}
globalThis.performance.now = vi.fn(() => Date.now());

// Note: IndexedDB is provided by fake-indexeddb/auto imported above
// No need for manual mocking

// Suppress console errors in tests (optional)
// Uncomment if you want cleaner test output
// globalThis.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };
