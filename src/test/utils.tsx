/**
 * Test Utilities and Helpers
 * 
 * Reusable utilities for writing tests including:
 * - Custom render function with providers
 * - Mock data generators
 * - Common test helpers
 * - MSW request handlers
 */

import { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, afterEach, vi } from 'vitest';
import type { Post, User, Comment, FeedResponse } from '../types';

// ============================================================================
// Custom Render with Providers
// ============================================================================

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: 0, // Disable caching in tests
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// ============================================================================
// Mock Data Generators
// ============================================================================

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test User',
    username: 'testuser',
    avatar: 'https://i.pravatar.cc/150?img=1',
    bio: 'Test bio',
    ...overrides,
  };
}

export function createMockPost(overrides?: Partial<Post>): Post {
  const author = createMockUser();
  
  return {
    id: `post-${Math.random().toString(36).substr(2, 9)}`,
    content: 'This is a test post content',
    author,
    authorId: author.id,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    isLiked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockComment(overrides?: Partial<Comment>): Comment {
  const user = createMockUser();
  
  return {
    id: `comment-${Math.random().toString(36).substr(2, 9)}`,
    postId: 'post-1',
    text: 'This is a test comment',
    user,
    userId: user.id,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockFeedResponse(
  postCount = 10,
  hasMore = true
): FeedResponse {
  const posts = Array.from({ length: postCount }, (_, i) =>
    createMockPost({
      id: `post-${i + 1}`,
      content: `Test post ${i + 1}`,
    })
  );

  return {
    posts,
    pagination: {
      nextCursor: hasMore ? `cursor-${postCount}` : null,
      hasMore,
    },
  };
}

// ============================================================================
// Wait Helpers
// ============================================================================

export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForLoadingToFinish() {
  const { screen } = await import('@testing-library/react');
  const { waitForElementToBeRemoved } = await import('@testing-library/react');
  
  try {
    await waitForElementToBeRemoved(
      () => screen.queryByText(/loading/i),
      { timeout: 3000 }
    );
  } catch {
    // Loading element might not exist
  }
}

// ============================================================================
// Mock Handlers (for use with MSW)
// ============================================================================

export const mockHandlers = {
  getFeed: (posts: Post[] = [], hasMore = false) => ({
    posts,
    pagination: {
      nextCursor: hasMore ? 'next-cursor' : null,
      hasMore,
    },
  }),

  createPost: (post: Post) => post,

  likePost: () => ({ success: true }),

  unlikePost: () => ({ success: true }),

  addComment: (comment: Comment) => comment,

  getComments: (comments: Comment[] = []) => comments,
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock QueryClient for testing
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Flush all promises and timers
 */
export async function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mock console methods
 */
export function mockConsole() {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    (globalThis as any).console = {
      ...console,
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };
  });

  afterEach(() => {
    (globalThis as any).console = originalConsole;
  });
}

/**
 * Create a mock IntersectionObserver callback
 */
export function createMockIntersectionObserver() {
  const observers = new Map();

  return class MockIntersectionObserver {
    callback: IntersectionObserverCallback;
    elements: Set<Element>;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      this.elements = new Set();
    }

    observe(element: Element) {
      this.elements.add(element);
      observers.set(element, this);
    }

    unobserve(element: Element) {
      this.elements.delete(element);
      observers.delete(element);
    }

    disconnect() {
      this.elements.clear();
    }

    static triggerIntersection(
      element: Element,
      isIntersecting: boolean = true
    ) {
      const observer = observers.get(element);
      if (observer) {
        const entry: IntersectionObserverEntry = {
          isIntersecting,
          target: element,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRect: element.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        };
        observer.callback([entry], observer);
      }
    }
  };
}

/**
 * Suppress specific console warnings in tests
 */
export function suppressConsoleWarnings(patterns: RegExp[]) {
  const originalWarn = console.warn;
  
  beforeEach(() => {
    console.warn = (...args: any[]) => {
      const message = args[0];
      if (typeof message === 'string' && patterns.some((p) => p.test(message))) {
        return;
      }
      originalWarn(...args);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });
}
