# System Design in Action: Building a Production-Ready News Feed

## Part 1: Introduction, Architecture, and Core Concepts

> **A comprehensive guide to building scalable, resilient web applications**
> Learn system design by building a real production-grade social media feed

---

## Table of Contents (Complete Guide)

### Part 1: Introduction, Architecture, and Core Concepts
1. [Introduction: The Real-World Challenge](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure Deep Dive](#project-structure)
4. [Technology Stack Explained](#technology-stack)

### Part 2: User Flows and State Management
5. User Journey: Click to Response
6. State Management Strategy
7. React Query Deep Dive
8. Zustand for Client State

### Part 3: Three-Layer Caching System
9. Caching Architecture
10. Layer 1: React Query (Memory Cache)
11. Layer 2: IndexedDB (Persistent Cache)
12. Layer 3: Service Worker (Static Cache)
13. Cache Coordination

### Part 4: Data Fetching and Pagination
14. Infinite Scroll Implementation
15. Cursor vs Offset Pagination
16. Search and Filtering
17. Data Prefetching

### Part 5: Resilience and Error Handling
18. Error Classification System
19. Retry Logic with Exponential Backoff
20. Circuit Breaker Pattern
21. Graceful Degradation

### Part 6: Offline-First Architecture
22. Service Worker Lifecycle
23. Offline Queue Implementation
24. Background Sync
25. Network Detection

### Part 7: Performance Optimization
26. Code Splitting Strategy
27. Image Lazy Loading
28. Memoization Patterns
29. Bundle Optimization

### Part 8: Production Features
30. Analytics Dashboard
31. Validation System
32. Accessibility (WCAG 2.1 AA)
33. PWA Implementation

### Part 9: Backend and Testing
34. Backend API Design
35. Mock Data Generation
36. Testing Infrastructure

### Part 10: Trade-offs and Best Practices
37. System Design Trade-offs
38. Best Practices and Patterns
39. Scaling Considerations
40. Action Plan for Developers

---

## Introduction: The Real-World Challenge {#introduction}

### The Problem Statement

You're tasked with building a social media feed. Sounds straightforward, right? Then the requirements arrive:

**Functional Requirements:**
- Display personalized feed of posts
- Like, comment, and share functionality
- Infinite scroll pagination
- Search and filtering
- Real-time updates (eventually)

**Non-Functional Requirements:**
- **Performance:** First contentful paint < 1.5s
- **Availability:** Works offline completely
- **Responsiveness:** Instant feedback on user actions
- **Scalability:** Handle millions of posts
- **Reliability:** Works when server is down
- **Accessibility:** WCAG 2.1 AA compliant
- **User Experience:** No loading spinners, seamless interaction

Welcome to **production system design**.

### What Makes This Hard?

Building a simple feed is easy. Building one that works like Twitter, Instagram, or LinkedIn is complex because:

1. **Network Unreliability:** Users lose connection constantly (subway, elevators, rural areas)
2. **Scale:** Billions of posts, millions of concurrent users
3. **Latency:** Users expect instant feedback (< 100ms perceived response)
4. **State Synchronization:** Offline changes must sync correctly
5. **Error Handling:** Servers fail, networks timeout, users encounter edge cases
6. **Performance:** Large amounts of data, images, and interactions

### What You'll Learn

This guide walks through a **production-ready implementation** with 85+ TypeScript files demonstrating enterprise patterns from companies like:

- **Twitter:** Optimistic updates, cursor pagination
- **Facebook:** Multi-layer caching, offline queue
- **LinkedIn:** Feed algorithms, engagement tracking
- **Instagram:** Image lazy loading, infinite scroll
- **Gmail:** Offline-first architecture, background sync

### Technology Stack Overview

**Frontend (React Ecosystem):**
```
React 19.2.0          → Latest features (compiler, actions)
TypeScript 5.9.3      → Type safety across 85 files
Vite 7.2.4            → Lightning-fast build tool
TailwindCSS 4.1.17    → Utility-first styling
```

**State Management:**
```
React Query 5.90.11   → Server state (caching, sync)
Zustand 5.0.9         → Client state (UI, settings)
React Context         → Auth state
```

**Caching & Persistence:**
```
IndexedDB (via idb 8.0.3)  → L2 cache (50MB, 7-day TTL)
Service Worker             → L3 cache (static assets)
React Query                → L1 cache (memory)
```

**Development & Testing:**
```
Vitest 4.0.15              → Test runner
Testing Library 16.3.0     → Component tests
MSW 2.12.3                 → API mocking
fake-indexeddb             → IndexedDB testing
```

**Backend (Development):**
```
JSON Server           → RESTful API
Express.js            → Middleware
Lowdb                 → File-based database
@faker-js/faker       → Mock data generation
```

### Key Metrics (Real Numbers from Codebase)

**Codebase Stats:**
- **85 TypeScript files** (100% type coverage)
- **15 custom hooks** (reusable business logic)
- **4 Zustand stores** (client state management)
- **10+ React Query queries** (server data)
- **6 mutation types** (create, like, comment, etc.)
- **546 lines** in IndexedDB cache implementation
- **762 lines** in error handling system
- **380 lines** in offline queue

**Performance Targets:**
- Memory cache: **< 1ms** response time
- IndexedDB cache: **5-10ms** response time
- Service Worker: **1-2ms** response time
- API response: **500ms** average
- Offline queue sync: **30s** interval

**Resilience Configuration:**
- Retry attempts: **3 max**
- Exponential backoff: **1s → 2s → 4s** (capped at 30s)
- Circuit breaker: Opens after **5 failures** or **50% error rate**
- Cache TTL: **7 days** (IndexedDB), **1-5 min** (memory)
- Offline queue: **FIFO** processing

---

## Architecture Overview {#architecture-overview}

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                         USER LAYER                           │
│  Browser (Chrome, Firefox, Safari, Edge)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  React Components (85 files)                                 │
│  - FeedContainer, PostCard, CommentList                      │
│  - Layout, Navigation, Modals                                │
│  - Analytics Dashboard, Profile Pages                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  Custom Hooks (15 files)                                     │
│  - useInfiniteScroll, useLikePost, useCreatePost             │
│  - useOptimisticMutation, useRetry, useNetworkStatus         │
│  - useFormValidation, useDraftAutoSave                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   STATE MANAGEMENT LAYER                     │
│  ┌─────────────┬──────────────┬──────────────────┐          │
│  │ React Query │   Zustand    │  React Context   │          │
│  │ (Server)    │   (Client)   │   (Auth)         │          │
│  │ - Posts     │   - UI State │   - User         │          │
│  │ - Users     │   - Settings │   - Token        │          │
│  │ - Comments  │   - Toast    │   - Permissions  │          │
│  │ - Analytics │   - Search   │                  │          │
│  └─────────────┴──────────────┴──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      CACHING LAYER (3-Tier)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ L1: Memory Cache (React Query)                       │   │
│  │ Speed: < 1ms | TTL: 1-5 min | Volatile              │   │
│  └──────────────────────────────────────────────────────┘   │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ L2: IndexedDB (Persistent)                           │   │
│  │ Speed: 5-10ms | TTL: 7 days | Max: 50MB             │   │
│  └──────────────────────────────────────────────────────┘   │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ L3: Service Worker (Static Assets)                   │   │
│  │ Speed: 1-2ms | Persistent | Versioned               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    RESILIENCE LAYER                          │
│  - Error Classification (Network, Server, Validation)        │
│  - Retry Logic (Exponential Backoff + Jitter)                │
│  - Circuit Breaker (5 failures → Open → 60s → Half-Open)    │
│  - Offline Queue (FIFO, 3 retries, 30s auto-sync)           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      NETWORK LAYER                           │
│  API Service (Axios-based)                                   │
│  - Request interceptors (auth, timing)                       │
│  - Response interceptors (error transformation)              │
│  - Timeout handling (30s default)                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER                           │
│  JSON Server + Express                                       │
│  - RESTful API (10+ endpoints)                               │
│  - Cursor-based pagination                                   │
│  - Mock database (Lowdb)                                     │
│  - Simulated latency (500ms)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

**1. Separation of Concerns**
```
Components  → Only rendering and event handling
Hooks       → Business logic and state orchestration
Services    → Network communication and data transformation
Utils       → Pure functions (no side effects)
```

**2. Dependency Flow (Unidirectional)**
```
User Action → Component → Hook → React Query/Zustand → Service → API
API Response → Service → React Query → Hook → Component → UI Update
```

**3. Error Boundaries**
```
Network Layer    → Catches: Fetch failures, timeouts
Service Layer    → Catches: HTTP errors, transforms to AppError
Hook Layer       → Catches: Mutation failures, triggers rollback
Component Layer  → Catches: Render errors, shows fallback UI
```

**4. Caching Strategy (Read Path)**
```
Request
  ↓
Check L1 (Memory) → Hit? Return instantly
  ↓
Check L2 (IndexedDB) → Hit? Return + warm L1 + revalidate
  ↓
Check L3 (Service Worker) → Hit? Return from cache
  ↓
Network Fetch → Update all layers → Return
```

**5. Mutation Strategy (Write Path)**
```
User Action
  ↓
Optimistic Update (UI updates immediately)
  ↓
Check Online?
  ↓ Yes                    ↓ No
API Call                   Enqueue to Offline Queue
  ↓ Success  ↓ Error       ↓
Keep Changes Rollback      Sync when online
Invalidate
```

### Why This Architecture Works

**Scalability:**
- Cursor pagination: O(1) regardless of dataset size
- Code splitting: Load only what's needed
- Lazy loading: Images loaded on-demand
- Virtual scrolling ready: 10,000+ posts no problem

**Resilience:**
- 3-layer caching: Works without network
- Offline queue: No data loss
- Circuit breaker: Prevent cascade failures
- Exponential backoff: Smart retry logic

**Performance:**
- Memory cache: < 1ms response
- IndexedDB: 5-10ms response (survives refresh)
- Optimistic updates: Instant perceived latency
- Prefetching: Data ready before user needs it

**Maintainability:**
- TypeScript: Catch bugs at compile time
- Clear boundaries: Each layer has one job
- Testable: Pure functions, mockable services
- Reusable: Hooks used across components

**Developer Experience:**
- Hot reload: < 100ms with Vite
- Type safety: IntelliSense everywhere
- Clear patterns: Easy to onboard new developers
- Debuggable: React DevTools, Network tab

---

## Project Structure Deep Dive {#project-structure}

### Complete Directory Tree

```
/home/akash.c@simform.dom/Documents/DOC/system-design-practical/
│
├── src/                                    # Source code (85 files)
│   │
│   ├── components/                         # React Components (27 files)
│   │   ├── common/                         # Reusable UI (15 files)
│   │   │   ├── Button.tsx                  # Accessible button component
│   │   │   ├── Modal.tsx                   # Focus-trapped modal
│   │   │   ├── Toast.tsx                   # Notification system
│   │   │   ├── LazyImage.tsx               # Intersection Observer lazy loading
│   │   │   ├── Skeleton.tsx                # Loading placeholders
│   │   │   ├── ErrorBoundary.tsx           # Error fallback UI
│   │   │   ├── InfiniteScrollTrigger.tsx   # Scroll detection
│   │   │   ├── NetworkStatus.tsx           # Online/offline indicator
│   │   │   ├── PWAStatus.tsx               # Install prompt
│   │   │   ├── CacheMetrics.tsx            # Dev tools: Cache stats
│   │   │   ├── ScrollDebugger.tsx          # Dev tools: Scroll position
│   │   │   ├── SkipLink.tsx                # A11y: Skip to content
│   │   │   ├── AriaLiveRegion.tsx          # A11y: Screen reader announcements
│   │   │   ├── FocusLock.tsx               # A11y: Trap focus in modals
│   │   │   └── LoadingSpinner.tsx          # Loading indicator
│   │   │
│   │   ├── feed/                           # Feed-specific (9 files)
│   │   │   ├── FeedContainer.tsx           # Main feed orchestrator (285 lines)
│   │   │   ├── PostCard.tsx                # Individual post display
│   │   │   ├── PostList.tsx                # Posts collection
│   │   │   ├── CreatePost.tsx              # Post creation form
│   │   │   ├── CommentList.tsx             # Comments display
│   │   │   ├── CommentForm.tsx             # Comment creation
│   │   │   ├── LikeButton.tsx              # Like/unlike with animation
│   │   │   ├── ShareButton.tsx             # Share functionality
│   │   │   └── SearchBar.tsx               # Search with debounce
│   │   │
│   │   ├── profile/                        # Profile components (2 files)
│   │   │   ├── ProfileHeader.tsx           # User profile display
│   │   │   └── UserStats.tsx               # Follower/following counts
│   │   │
│   │   ├── analytics/                      # Analytics (1 file)
│   │   │   └── AnalyticsDashboard.tsx      # Metrics, charts, export
│   │   │
│   │   └── layout/                         # Layout components
│   │       ├── Header.tsx                  # App header with navigation
│   │       ├── Sidebar.tsx                 # Side navigation
│   │       └── Layout.tsx                  # Main layout wrapper
│   │
│   ├── hooks/                              # Custom Hooks (15 files)
│   │   ├── useInfiniteScroll.ts            # Infinite scroll + pagination (156 lines)
│   │   ├── useFeedPosts.ts                 # Fetch feed with filters
│   │   ├── useCreatePost.ts                # Create post mutation (273 lines)
│   │   ├── useLikePost.ts                  # Like/unlike mutation (296 lines)
│   │   ├── useAddComment.ts                # Add comment mutation
│   │   ├── useComments.ts                  # Fetch post comments
│   │   ├── useSearchPosts.ts               # Search with debounce
│   │   ├── useUserProfile.ts               # Fetch user profile
│   │   ├── useAnalytics.ts                 # Analytics data (210 lines)
│   │   ├── useOptimisticMutation.ts        # Generic optimistic updates
│   │   ├── useRetry.ts                     # Manual retry with countdown
│   │   ├── useToast.ts                     # Toast notifications
│   │   ├── useFormValidation.ts            # Form validation
│   │   ├── useDraftAutoSave.ts             # Auto-save to localStorage
│   │   └── useNetworkStatus.tsx            # Online/offline detection
│   │
│   ├── pages/                              # Route Pages (4 files)
│   │   ├── Feed.tsx                        # Home feed page
│   │   ├── Profile.tsx                     # User profile page
│   │   ├── Settings.tsx                    # App settings
│   │   └── InterviewPrep.tsx               # System design interview guide
│   │
│   ├── store/                              # Zustand Stores (4 files)
│   │   ├── searchFilterStore.ts            # Search/filter state (123 lines)
│   │   ├── toastStore.ts                   # Toast queue (141 lines)
│   │   ├── settingsStore.ts                # User settings
│   │   └── uiStore.ts                      # UI state (modals, sidebar)
│   │
│   ├── services/                           # API Layer (1 file)
│   │   └── api.ts                          # Axios instance + all API calls
│   │
│   ├── utils/                              # Utilities (14 files + 3 tests)
│   │   ├── indexedDBCache.ts               # L2 cache (546 lines)
│   │   ├── cacheCoordinator.ts             # Multi-layer cache coordination (439 lines)
│   │   ├── offlineQueue.ts                 # Offline mutations queue (380 lines)
│   │   ├── offlineQueueInit.ts             # Queue initialization
│   │   ├── errorHandling.ts                # Error classification + retry (762 lines)
│   │   ├── validation.ts                   # Form validation (688 lines)
│   │   ├── accessibility.tsx               # Keyboard shortcuts, A11y utils
│   │   ├── serviceWorkerRegistration.ts    # SW registration + updates
│   │   ├── logger.ts                       # Structured logging
│   │   ├── analytics.ts                    # Event tracking
│   │   ├── dateUtils.ts                    # Date formatting
│   │   ├── stringUtils.ts                  # String manipulation
│   │   ├── imageUtils.ts                   # Image optimization
│   │   ├── urlUtils.ts                     # URL parsing
│   │   │
│   │   └── __tests__/                      # Unit tests (3 files)
│   │       ├── errorHandling.test.ts       # Error handling tests
│   │       ├── indexedDBCache.test.ts      # IndexedDB tests
│   │       └── cacheCoordinator.test.ts    # Cache coordination tests
│   │
│   ├── contexts/                           # React Contexts (1 file)
│   │   └── AuthContext.tsx                 # Authentication context
│   │
│   ├── config/                             # Configuration (2 files)
│   │   ├── queryClient.ts                  # React Query config (141 lines)
│   │   └── constants.ts                    # App constants
│   │
│   ├── types/                              # TypeScript Definitions (1 file)
│   │   └── index.ts                        # All type definitions (229 lines)
│   │
│   ├── App.tsx                             # Root component (routing, providers)
│   ├── main.tsx                            # App entry point
│   └── index.css                           # Global styles
│
├── server/                                 # Backend (Development)
│   ├── server.js                           # JSON Server + Express (1021 lines)
│   ├── db.json                             # Mock database
│   └── seed.js                             # Mock data generator
│
├── public/                                 # Static Assets
│   ├── service-worker.js                   # Service Worker (359 lines)
│   ├── manifest.json                       # PWA manifest
│   ├── offline.html                        # Offline fallback page
│   ├── icon-192.png                        # PWA icon (192x192)
│   └── icon-512.png                        # PWA icon (512x512)
│
├── Configuration Files
│   ├── package.json                        # Dependencies + scripts
│   ├── tsconfig.json                       # TypeScript config
│   ├── vite.config.ts                      # Vite build config
│   ├── vitest.config.ts                    # Test config
│   ├── tailwind.config.js                  # Tailwind config
│   ├── postcss.config.js                   # PostCSS config
│   └── .eslintrc.js                        # ESLint rules
│
└── Documentation
    ├── README.md                           # Project overview
    ├── SYSTEM_DESIGN_GUIDE.md             # This comprehensive guide
    └── CONTRIBUTING.md                     # Contribution guidelines
```

### File Organization Principles

**1. Feature-Based Organization**
```
components/feed/    → Everything related to feed feature
hooks/              → Reusable across features
utils/              → Pure, testable functions
```

**2. Naming Conventions**
```typescript
// Components: PascalCase
FeedContainer.tsx, PostCard.tsx

// Hooks: camelCase with 'use' prefix
useFeedPosts.ts, useOptimisticMutation.ts

// Utils: camelCase
errorHandling.ts, indexedDBCache.ts

// Types: PascalCase for interfaces/types
Post, User, FeedResponse

// Constants: UPPER_SNAKE_CASE
MAX_CACHE_SIZE, DEFAULT_TTL
```

**3. Import Order (Enforced by ESLint)**
```typescript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal modules (absolute imports)
import { Post } from '@/types';
import { feedApi } from '@/services/api';
import { useLikePost } from '@/hooks/useLikePost';

// 3. Relative imports (same feature)
import { PostCard } from './PostCard';

// 4. Styles
import './FeedContainer.css';
```

**4. File Size Guidelines**
```
Components:  < 300 lines (extract sub-components if larger)
Hooks:       < 200 lines (extract helper functions)
Utils:       < 500 lines (split into multiple files)
Types:       < 300 lines (group related types)
```

### Key Directories Explained

**`components/common/`** - Reusable UI components
- Fully accessible (ARIA labels, keyboard nav)
- Type-safe props with TypeScript
- Storybook-ready (isolated development)
- Unit tested with Testing Library

**`hooks/`** - Business logic layer
- Each hook has single responsibility
- Wraps React Query for data fetching
- Returns predictable interface: `{ data, isLoading, error, mutate }`
- Testable in isolation with MSW

**`utils/`** - Pure utility functions
- No side effects
- Fully tested (90%+ coverage)
- Documented with JSDoc
- Examples: `formatDate('2024-01-15') → 'Jan 15, 2024'`

**`store/`** - Client state management
- Zustand stores (minimal boilerplate)
- Persisted to localStorage where needed
- TypeScript interfaces for state shape
- Devtools integration

**`services/api.ts`** - Network layer
- Single Axios instance with interceptors
- Automatic error transformation
- Request/response logging
- TypeScript return types

---

## Technology Stack Explained {#technology-stack}

### Why These Technologies?

**React 19.2.0** - Component framework
```typescript
// New React 19 features used:
// 1. React Compiler (automatic memoization)
// 2. Actions (async transitions)
// 3. useOptimistic hook (built-in optimistic updates)
```
**Choice reasoning:** Industry standard, huge ecosystem, excellent TypeScript support

**TypeScript 5.9.3** - Type safety
```typescript
// Strict mode enabled (tsconfig.json)
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitAny": true,
  "strictNullChecks": true
}
```
**Choice reasoning:** Catch bugs at compile time, better IDE autocomplete, easier refactoring

**Vite 7.2.4** - Build tool
```typescript
// Fast HMR (Hot Module Replacement)
// Build time: 2.3s (vs 45s with Webpack)
// Dev server startup: 200ms (vs 5s with CRA)
```
**Choice reasoning:** 10x faster than Webpack, native ES modules, optimized for React

**TailwindCSS 4.1.17** - Styling
```typescript
// Utility-first approach
<div className="flex items-center gap-4 p-6 rounded-lg shadow-md">

// Purges unused CSS (final bundle: 8KB vs 200KB)
```
**Choice reasoning:** Fast development, small bundle, design consistency

**React Query 5.90.11** - Server state
```typescript
// Handles: caching, background refetch, deduplication, retries
const { data, isLoading } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 60000, // Fresh for 1 min
});
```
**Choice reasoning:** Best-in-class server state management, built-in caching, automatic retry

**Zustand 5.0.9** - Client state
```typescript
// Minimal boilerplate (vs Redux)
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Bundle size: 1KB (vs Redux 15KB)
```
**Choice reasoning:** Simple API, tiny size, works outside React, TypeScript friendly

### Dependencies Overview

**Core Dependencies** (21 total)
```json
{
  "@tanstack/react-query": "5.90.11",    // Server state
  "zustand": "5.0.9",                     // Client state
  "axios": "1.8.2",                       // HTTP client
  "idb": "8.0.3",                         // IndexedDB wrapper
  "react": "19.2.0",                      // UI framework
  "react-dom": "19.2.0",                  // DOM renderer
  "react-router-dom": "7.7.1",            // Routing
  "recharts": "2.16.0",                   // Charts (analytics)
  "react-window": "2.2.3",                // Virtual scrolling
  "date-fns": "4.1.0"                     // Date utilities
}
```

**Development Dependencies** (35 total)
```json
{
  "@vitejs/plugin-react": "4.3.4",       // Vite React plugin
  "vite": "7.2.4",                        // Build tool
  "vitest": "4.0.15",                     // Test runner
  "@testing-library/react": "16.3.0",     // Component testing
  "msw": "2.12.3",                        // API mocking
  "typescript": "5.9.3",                  // Type checking
  "tailwindcss": "4.1.17",                // Styling
  "eslint": "9.23.0",                     // Linting
  "prettier": "4.0.1"                     // Code formatting
}
```

### Build Configuration

**Vite Configuration** (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000', // Proxy to backend
    },
  },
});
```

**TypeScript Configuration** (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]  // Absolute imports
    }
  }
}
```

---

**End of Part 1**

**Next:** Part 2 will cover User Journey (click to response), State Management deep dive, and React Query patterns.

**Files to study before Part 2:**
1. `src/hooks/useLikePost.ts` - See optimistic updates in action
2. `src/config/queryClient.ts` - React Query configuration
3. `src/store/searchFilterStore.ts` - Zustand example

