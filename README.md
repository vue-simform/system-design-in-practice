# System Design Practical: News Feed Application

A production-grade social media feed application demonstrating advanced system design patterns, resilient UX, and performance optimization techniques. Built as a comprehensive learning resource with 60+ interview questions and detailed developer documentation.

**Live Demo:** [https://system-design-practical.netlify.app/](https://system-design-in-practice.netlify.app/)

## Core Features

### Resilient UX
- Offline-first architecture with automatic sync
- FIFO queue for offline mutations
- Circuit breaker pattern with exponential backoff
- Optimistic UI updates with rollback
- Comprehensive error handling and retry logic

### Performance Optimization
- Multi-layer caching (Memory, IndexedDB, HTTP)
- Cache coordination and invalidation strategies
- Lazy loading and code splitting
- Virtual scrolling with react-window
- Image lazy loading with intersection observer
- Prefetching on hover

### Data Management
- React Query with optimistic mutations
- Zustand for global state
- State persistence across sessions
- Real-time cache synchronization
- Draft auto-save with debouncing

### Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader optimized
- Focus management
- Skip links and ARIA labels
- Color contrast validation

### Progressive Web App (PWA)
- Full offline functionality with service worker
- Installable on desktop and mobile
- App-like experience (standalone mode)
- Automatic updates with user notification
- Cacheable static assets
- Background sync for offline actions
- [Complete PWA Documentation](PWA.md)

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, TailwindCSS  
**State Management:** React Query, Zustand  
**Testing:** Vitest, Testing Library, MSW  
**Caching:** IndexedDB (idb), Service Worker  
**Backend:** JSON Server (development), REST API

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation
```bash
npm install
cd server && npm install && cd ..
```

### Development
```bash
# Run both frontend and backend
npm run dev:all

# Or run separately
npm run dev          # Frontend (http://localhost:5173)
npm run dev:server   # Backend (http://localhost:3001)
```

### Testing
```bash
npm run test              # Run tests
npm run test:ui           # Run with UI
npm run test:coverage     # Generate coverage report
npm run verify-pwa        # Verify PWA setup
```

### Build
```bash
npm run build             # Build for production
npm run preview           # Preview production build
```

### PWA Development
```bash
npm run generate-icons    # Generate PWA icons
npm run verify-pwa        # Verify PWA setup
# Open DevTools → Application to test PWA features
```

## Project Structure

```
src/
├── components/       # React components (feed, common, analytics, profile)
├── hooks/           # Custom hooks (useInfiniteScroll, useOptimisticMutation, etc.)
├── pages/           # Route pages (Profile, DeveloperDocs, InterviewPrep)
├── services/        # API layer with axios
├── store/           # Zustand stores (toast, search, UI state)
├── utils/           # Utilities (caching, offline queue, error handling, validation)
└── types/           # TypeScript type definitions

server/              # JSON Server backend with sample data
public/              # Static assets and service worker
```

## System Design Patterns Implemented

- **Circuit Breaker:** Automatic failure detection with exponential backoff
- **Optimistic UI:** Instant feedback with background sync and rollback
- **FIFO Queue:** Ordered offline mutation processing
- **Cache Coordination:** Multi-layer cache with smart invalidation
- **Virtual Scrolling:** Efficient rendering of large lists
- **Progressive Loading:** Skeleton screens and lazy loading
- **Retry Logic:** Configurable retry with jitter
- **Draft Persistence:** Auto-save with debouncing

## Documentation

### In-App Documentation
- **Developer Docs:** Detailed API reference, code examples, and implementation patterns
- **Interview Prep:** 60+ system design interview questions with answers
- **Analytics Dashboard:** Performance metrics and cache statistics

### Technical Documentation
- [PWA.md](PWA.md) - Complete Progressive Web App implementation guide
- [PWA-TESTING.md](PWA-TESTING.md) - PWA testing and verification procedures
- [PWA-FIXES.md](PWA-FIXES.md) - Summary of PWA fixes and improvements
- [server/README.md](server/README.md) - Backend server documentation

## Key Implementation Details

**Offline Support:** Service Worker with IndexedDB stores offline mutations, automatically syncing when connectivity returns.

**Caching Strategy:** Three-tier cache (memory → IndexedDB → network) with TTL-based invalidation and stale-while-revalidate pattern.

**Error Handling:** Centralized error boundary with retry capabilities, user-friendly error messages, and fallback UI states.

**Performance:** Route-based code splitting, virtual scrolling for large lists, image lazy loading, and aggressive prefetching reduce load times and improve UX.

**Testing:** Comprehensive test suite with unit tests, integration tests, and MSW for API mocking.

## Environment Variables

Create a `.env` file in the root directory:
```
VITE_API_URL=http://localhost:3001
```

## License

MIT
