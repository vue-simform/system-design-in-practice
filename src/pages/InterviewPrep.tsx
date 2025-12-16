/**
 * System Design Interview Preparation Page
 * 
 * Comprehensive Q&A resource covering all system design patterns, features,
 * and architectural decisions implemented in this project.
 * 
 * Features:
 * - 70+ real interview questions with detailed answers (17 main + 68 follow-ups)
 * - Search across all Q&A content
 * - Filter by category, difficulty, and topic
 * - Track reviewed questions
 * - Progress tracking
 * 
 * Categories:
 * 1. Resilient UX (Offline, Error Handling, Retry Logic)
 * 2. Performance (Caching, Loading, Optimization)
 * 3. Data Management (State, Mutations, Sync)
 * 4. Patterns (Circuit Breaker, Optimistic UI, Queue)
 * 5. Architecture (Scalability, PWA, Tradeoffs, Design Decisions)
 * 6. Accessibility & UX (WCAG, Keyboard Nav, Screen Readers)
 * 
 * All questions are based on actual implementation in this codebase,
 * providing real-world, production-tested answers with code examples.
 */

import React, { useState, useMemo } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type QuestionCategory = 
  | 'resilience' 
  | 'performance' 
  | 'data-management' 
  | 'patterns' 
  | 'architecture' 
  | 'accessibility';

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface InterviewQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  tags: string[];
  answer: {
    overview: string;
    keyPoints: string[];
    implementation?: string;
    codeExample?: string;
    followUpQuestions?: {
      question: string;
      answer: string;
    }[];
    relatedTopics?: string[];
  };
}

// ============================================================================
// INTERVIEW QUESTIONS DATA
// ============================================================================

const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ========================================
  // RESILIENCE CATEGORY
  // ========================================
  {
    id: 'offline-1',
    question: 'How would you design an offline-first web application that allows users to create, update, and delete data while offline?',
    category: 'resilience',
    difficulty: 'hard',
    tags: ['offline', 'queue', 'sync', 'indexeddb'],
    answer: {
      overview: 'An offline-first architecture requires a mutation queue, persistent storage, automatic sync, and conflict resolution. The key is to provide seamless UX regardless of network status.',
      keyPoints: [
        '✅ Use a FIFO queue stored in IndexedDB to track all mutations (create, update, delete)',
        '✅ Implement optimistic updates so UI responds immediately',
        '✅ Store queue entries with: type, payload, timestamp, retryCount, status',
        '✅ Auto-sync when connection is restored using online/offline event listeners',
        '✅ Handle conflicts with strategies: server-wins, client-wins, merge, or manual resolution',
        '✅ Use exponential backoff for retries (1s → 2s → 4s → 8s)',
        '✅ Provide clear UI feedback: "Offline Mode", "X Pending Actions", "Syncing..."',
        '✅ Ensure idempotency with unique action IDs to prevent duplicate operations',
        '✅ Implement background sync with polling (e.g., every 30 seconds)',
        '✅ Persist queue across page reloads and browser restarts',
      ],
      implementation: 'We use IndexedDB as L2 cache, React Query as L1 cache, and Service Worker as L3 cache. The offlineQueueManager handles all queue operations.',
      codeExample: `// Offline Queue Manager
interface QueuedAction {
  id: string;
  type: 'CREATE_POST' | 'LIKE_POST' | 'ADD_COMMENT';
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
}

class OfflineQueueManager {
  async enqueue(action: QueuedAction) {
    await db.put('queue', action);
    this.notifyListeners();
  }

  async syncQueue() {
    const queue = await db.getAll('queue', 'pending');
    for (const action of queue) {
      try {
        await this.executeSyncHandler(action);
        await db.delete('queue', action.id);
      } catch (error) {
        action.retryCount++;
        if (action.retryCount > 3) {
          action.status = 'failed';
        }
        await db.put('queue', action);
      }
    }
  }
}

// Usage
await offlineQueueManager.enqueue({
  id: generateId(),
  type: 'CREATE_POST',
  payload: { content: 'Hello', authorId: '1' },
  timestamp: Date.now(),
  retryCount: 0,
  status: 'pending'
});`,
      followUpQuestions: [
        {
          question: 'How do you handle conflicts when the same data is modified offline on multiple devices?',
          answer: 'Use a conflict resolution strategy: 1) **Last-Write-Wins (LWW)**: Use timestamps to keep the most recent change. 2) **Version Vectors**: Track version per device to detect concurrent edits. 3) **Operational Transformation (OT)**: Transform operations to work together (like Google Docs). 4) **CRDTs (Conflict-free Replicated Data Types)**: Data structures that automatically merge without conflicts. For our social feed, LWW works well since posts are independent entities. Store `updatedAt` timestamp and `deviceId` with each mutation. When syncing, compare timestamps and keep the newer version.'
        },
        {
          question: 'What happens if the queue grows too large (memory/storage limits)?',
          answer: 'Implement queue management strategies: 1) **Size Limit**: Cap at 1000 actions, reject new ones with error message. 2) **Priority Queue**: Separate critical actions (post creation) from non-critical (analytics). Sync critical first. 3) **Compression**: Batch similar actions (10 likes → 1 batch request). 4) **Storage Monitoring**: Check IndexedDB quota (usually 50-100MB per origin). If >80% full, trigger cleanup. 5) **Merge Operations**: Combine redundant actions (like → unlike → like = no-op). 6) **User Prompt**: "You have 500 pending actions. Continue offline or sync now?" with visual indicator.'
        },
        {
          question: 'How do you ensure data consistency between L1, L2, and L3 caches?',
          answer: 'Use a **Cache Coordinator** pattern: 1) **Single Source of Truth**: L1 (React Query) is the authority for in-memory state. 2) **Cascade Updates**: When L1 updates, immediately sync to L2 (IndexedDB). L3 (Service Worker) only caches API responses. 3) **Hydration on Load**: On app start, load from L2 → L1, then revalidate with network. 4) **Invalidation Strategy**: When mutation succeeds, invalidate all 3 layers for affected entities. 5) **Version Tracking**: Store `cacheVersion` and `lastSyncTime` to detect stale data. 6) **Atomic Updates**: Use transactions in IndexedDB to ensure L2 consistency. Example: `await Promise.all([updateL1(), updateL2()])` ensures both update or both fail.'
        },
        {
          question: 'What if a sync fails permanently? How do you notify the user?',
          answer: 'Implement a **Dead Letter Queue** pattern: 1) **Max Retries**: After 3 exponential backoff attempts, mark action as "failed". 2) **Persistent Toast**: Show non-dismissible notification: "Failed to sync 3 actions. Retry?" 3) **Failed Actions List**: Provide UI to view failed actions with error details and manual retry button. 4) **Error Analysis**: Classify why it failed (auth expired, validation error, server down). 5) **Rollback Option**: Let user undo failed actions if data is important. 6) **Fallback**: For non-critical actions (analytics), silently drop after max retries. 7) **Admin Panel**: Track failed syncs in monitoring dashboard for debugging.'
        },
      ],
      relatedTopics: ['IndexedDB', 'Service Workers', 'Optimistic Updates', 'Conflict Resolution'],
    },
  },
  {
    id: 'error-handling-1',
    question: 'Design a comprehensive error handling strategy for a web application. How do you classify errors and decide which ones are retryable?',
    category: 'resilience',
    difficulty: 'medium',
    tags: ['error-handling', 'retry', 'classification'],
    answer: {
      overview: 'Error handling requires classification by type and severity, smart retry logic with exponential backoff, user-friendly messaging, and graceful degradation.',
      keyPoints: [
        '✅ Classify errors into 5 types: Network, Server, Timeout, Validation, Authentication',
        '✅ Assign severity levels: LOW, MEDIUM, HIGH, CRITICAL',
        '✅ Network errors (no connection) → Retry 3 times with exponential backoff',
        '✅ Server errors (5xx) → Retry 2 times (server might recover)',
        '✅ Client errors (4xx) → No retry (user action needed)',
        '✅ Timeout errors → Retry 2 times with longer delay',
        '✅ Use jitter (±25%) to prevent thundering herd problem',
        '✅ Provide context-aware error messages and recovery actions',
        '✅ Implement error boundaries to catch React rendering errors',
        '✅ Log errors to monitoring service (dev: console, prod: Sentry/DataDog)',
      ],
      implementation: 'Our classifyError() function determines error type and isRetryable flag. withRetry() wrapper handles exponential backoff.',
      codeExample: `// Error Classification
type ErrorType = 'NETWORK' | 'SERVER' | 'TIMEOUT' | 'VALIDATION' | 'AUTH' | 'UNKNOWN';
type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  isRetryable: boolean;
  message: string;
}

function classifyError(error: any): ErrorInfo {
  // Network error (no internet)
  if (!navigator.onLine || error.message === 'Network request failed') {
    return {
      type: 'NETWORK',
      severity: 'HIGH',
      isRetryable: true,
      message: 'No internet connection. Please check your network.'
    };
  }

  // Server error (5xx)
  if (error.response?.status >= 500) {
    return {
      type: 'SERVER',
      severity: 'HIGH',
      isRetryable: true,
      message: 'Server error. We\\'re working on it. Please try again.'
    };
  }

  // Client error (4xx)
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return {
      type: 'VALIDATION',
      severity: 'MEDIUM',
      isRetryable: false,
      message: 'Invalid request. Please check your input.'
    };
  }

  // Timeout
  if (error.code === 'ECONNABORTED') {
    return {
      type: 'TIMEOUT',
      severity: 'MEDIUM',
      isRetryable: true,
      message: 'Request timed out. Please try again.'
    };
  }

  return {
    type: 'UNKNOWN',
    severity: 'MEDIUM',
    isRetryable: false,
    message: 'Something went wrong. Please try again later.'
  };
}

// Retry with Exponential Backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number }
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorInfo = classifyError(error);
      
      if (!errorInfo.isRetryable || attempt === options.maxRetries) {
        throw error;
      }
      
      lastError = error;
      const delay = options.baseDelay * Math.pow(2, attempt);
      const jitter = delay * 0.25 * (Math.random() - 0.5);
      await sleep(delay + jitter);
    }
  }
  
  throw lastError;
}`,
      followUpQuestions: [
        {
          question: 'How do you prevent the "thundering herd" problem when many requests retry simultaneously?',
          answer: '**Thundering herd** occurs when many failed requests retry at the same time, overwhelming the server. Solutions: 1) **Jitter**: Add random delay (±25%) to retry intervals. Instead of all retrying at 2s, spread between 1.5s-2.5s. 2) **Exponential Backoff**: Double delay each retry (1s → 2s → 4s → 8s), naturally spreading retries. 3) **Client-Side Rate Limiting**: Limit concurrent retries to 3 per client. 4) **Server-Side**: Return `Retry-After` header with suggested delay. 5) **Circuit Breaker**: Stop retries entirely if server is down (open circuit). 6) **Queue with Workers**: Process retries through a worker pool with controlled concurrency. Code: `const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1); await sleep(baseDelay + jitter);`'
        },
        {
          question: 'What metrics would you track for error monitoring?',
          answer: 'Track these key metrics: 1) **Error Rate**: Errors per minute, grouped by type (network/server/client). Alert if >5%. 2) **Error Distribution**: Breakdown by HTTP status (401, 403, 500, 502, 503). 3) **Retry Success Rate**: % of requests that succeed after retry. Target >90%. 4) **Time to Recovery**: How long until retry succeeds. 5) **Circuit Breaker State**: Time spent in OPEN state. 6) **User Impact**: # of users affected, # of failed actions per user. 7) **Error Messages**: Most common error messages for debugging. 8) **Endpoint Reliability**: Error rate per API endpoint. 9) **Device/Browser**: Error rates by user agent. Use tools like Sentry, DataDog, or custom dashboards with these metrics.'
        },
        {
          question: 'How do you handle partial failures in a multi-step operation?',
          answer: 'Use the **Saga Pattern** for multi-step operations: 1) **Compensating Transactions**: For each step, define an undo operation. If step 3 fails, rollback steps 2 and 1. 2) **State Machine**: Track operation state (pending → step1_complete → step2_complete → completed/failed). 3) **Idempotency**: Make each step idempotent so retrying is safe. 4) **Atomic Operations**: If possible, combine steps into single atomic transaction. 5) **Two-Phase Commit**: Prepare all steps, then commit only if all succeed. Example: Creating post with image upload: Step 1: Upload image (get URL), Step 2: Create post with image URL. If step 2 fails, delete uploaded image (compensating transaction). Store intermediate state in IndexedDB for resume after crash.'
        },
        {
          question: 'Should you show technical error details to end users?',
          answer: '**Never show raw technical errors to users**. Instead: 1) **User-Friendly Messages**: "Network error" instead of "ECONNREFUSED". 2) **Actionable Guidance**: "Check your internet connection" or "Try again in a few minutes". 3) **Error IDs**: Show "Error ID: ABC123" so support can look up details. 4) **Dev Mode Toggle**: In development, show full error stack. In production, hide it. 5) **Support Contact**: For persistent errors, show "Contact support with error ID". 6) **Contextual Help**: Different messages based on error type. Auth error → "Please log in again". 7) **Log Detailed Errors**: Send full error to monitoring service (Sentry) but don\'t display to user. Security: Never expose API keys, internal URLs, or stack traces in production.'
        },
      ],
      relatedTopics: ['Circuit Breaker', 'Exponential Backoff', 'Error Boundaries', 'Monitoring'],
    },
  },
  {
    id: 'circuit-breaker-1',
    question: 'Explain the Circuit Breaker pattern and when you would use it. How would you implement it in a frontend application?',
    category: 'patterns',
    difficulty: 'hard',
    tags: ['circuit-breaker', 'resilience', 'patterns'],
    answer: {
      overview: 'Circuit Breaker prevents cascading failures by stopping requests to a failing service. It has three states: CLOSED (normal), OPEN (blocking requests), and HALF_OPEN (testing recovery).',
      keyPoints: [
        '✅ CLOSED state: Requests pass through, track failures',
        '✅ OPEN state: Requests fail immediately, no server calls',
        '✅ HALF_OPEN state: Allow one test request to check if service recovered',
        '✅ Open circuit after failure threshold (e.g., 5 failures or 50% error rate)',
        '✅ Auto-close circuit after recovery timeout (e.g., 60 seconds)',
        '✅ Track metrics per endpoint (not global)',
        '✅ Require minimum volume threshold (e.g., 10 requests) before opening',
        '✅ Provide clear user feedback when circuit is open',
        '✅ Log circuit state changes for monitoring',
        '✅ Allow manual circuit reset for debugging',
      ],
      implementation: 'Our circuit breaker tracks state per endpoint with failure counts, success counts, and timestamps.',
      codeExample: `// Circuit Breaker Implementation
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
}

class CircuitBreaker {
  private circuits = new Map<string, CircuitStats>();
  private readonly failureThreshold = 5;
  private readonly successThreshold = 2;
  private readonly timeout = 60000; // 60 seconds
  private readonly volumeThreshold = 10;

  async execute<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.getCircuit(endpoint);

    // If circuit is OPEN, check if timeout elapsed
    if (circuit.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      if (timeSinceFailure >= this.timeout) {
        circuit.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN. Service unavailable.');
      }
    }

    try {
      const result = await fn();
      this.recordSuccess(endpoint);
      return result;
    } catch (error) {
      this.recordFailure(endpoint);
      throw error;
    }
  }

  private recordSuccess(endpoint: string) {
    const circuit = this.getCircuit(endpoint);
    circuit.successes++;

    if (circuit.state === 'HALF_OPEN') {
      // If success in HALF_OPEN, close the circuit
      if (circuit.successes >= this.successThreshold) {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
      }
    }
  }

  private recordFailure(endpoint: string) {
    const circuit = this.getCircuit(endpoint);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    const totalRequests = circuit.failures + circuit.successes;

    // Open circuit if failure threshold reached
    if (
      totalRequests >= this.volumeThreshold &&
      (circuit.failures >= this.failureThreshold ||
       (totalRequests > 0 && circuit.failures / totalRequests >= 0.5))
    ) {
      circuit.state = 'OPEN';
      console.warn(\`Circuit breaker OPEN for \${endpoint}\`);
    }
  }

  private getCircuit(endpoint: string): CircuitStats {
    if (!this.circuits.has(endpoint)) {
      this.circuits.set(endpoint, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
    }
    return this.circuits.get(endpoint)!;
  }

  getState(endpoint: string): CircuitState {
    return this.getCircuit(endpoint).state;
  }
}

// Usage
const breaker = new CircuitBreaker();

try {
  const data = await breaker.execute('/api/posts', () => 
    fetch('/api/posts').then(r => r.json())
  );
} catch (error) {
  if (breaker.getState('/api/posts') === 'OPEN') {
    showErrorMessage('Service temporarily unavailable');
  }
}`,
      followUpQuestions: [
        {
          question: 'How do you determine the right failure threshold and timeout values?',
          answer: 'Use **data-driven tuning** based on your system: 1) **Baseline Metrics**: Measure normal error rate (e.g., 0.5%). Set threshold at 5-10x baseline (5%). 2) **Request Volume**: Use minimum volume threshold (e.g., 10 requests) before opening circuit to avoid false positives. 3) **Recovery Time**: Set timeout based on deployment/restart time. If server restarts take 60s, use 60s timeout. 4) **A/B Testing**: Test different thresholds (3 failures vs 5 vs 10) and measure user impact. 5) **Per-Endpoint Tuning**: Critical endpoints (auth) have lower threshold (3 failures). Non-critical (analytics) have higher (10 failures). 6) **Time Window**: Track failures in rolling 1-minute window, not all-time. 7) **Production Monitoring**: Start conservative (5 failures, 30s timeout), adjust based on real data.'
        },
        {
          question: 'Should circuit breaker state be shared across tabs/windows?',
          answer: '**Yes, share across tabs using SharedWorker or BroadcastChannel**: 1) **Problem**: Each tab has independent circuit state. Tab A opens circuit, but Tab B keeps failing. 2) **Solution 1 - BroadcastChannel**: Simple API, good browser support. Tab A broadcasts "circuit_open:/api/posts" to all tabs. 3) **Solution 2 - SharedWorker**: More complex, single shared state across tabs. 4) **Solution 3 - localStorage Events**: Listen to storage events for state changes. Slower but widely supported. 5) **Hybrid Approach**: Each tab tracks its own state but subscribes to broadcasts. If any tab opens circuit, all tabs respect it. 6) **State Sync**: Periodically sync state to avoid divergence. 7) **Recovery**: Any tab can attempt recovery in HALF_OPEN state. Success closes circuit for all tabs.'
        },
        {
          question: 'How do you handle different error rates for different endpoints?',
          answer: 'Use **per-endpoint circuit breakers**: 1) **Separate Circuits**: Create circuit instance per endpoint key (`/api/posts`, `/api/users`). 2) **Circuit Registry**: `Map<string, CircuitBreaker>` where key is endpoint. 3) **Different Thresholds**: Auth endpoints (critical) = 3 failures, Analytics (non-critical) = 10 failures. 4) **Timeout Variance**: Fast endpoints (GET /posts) = 5s timeout, Slow (POST /upload) = 30s timeout. 5) **Priority Levels**: High-priority circuits recover first. 6) **Cascading Failures**: If `/api/posts` fails, consider opening circuits for dependent endpoints like `/api/posts/:id/comments`. 7) **Monitoring Dashboard**: Show circuit state per endpoint with color coding (green=closed, yellow=half-open, red=open).'
        },
        {
          question: 'What metrics would you expose for monitoring circuit breakers?',
          answer: 'Expose these metrics for observability: 1) **State Transitions**: Count of CLOSED→OPEN, OPEN→HALF_OPEN, HALF_OPEN→CLOSED transitions. 2) **Time in State**: Duration spent in each state (e.g., open for 2 minutes). 3) **Success/Failure Rates**: Per-endpoint success rate in CLOSED state. 4) **Blocked Requests**: # of requests rejected while circuit is OPEN. 5) **Recovery Attempts**: # of test requests in HALF_OPEN state and their outcomes. 6) **Error Types**: What errors caused circuit to open (timeouts vs 500s). 7) **Circuit Health Score**: Aggregate metric (0-100) across all circuits. 8) **Alert Triggers**: Fire alerts when critical circuits open or stay open >5 minutes. 9) **Dashboard**: Real-time visualization of all circuits with state, error rates, and history. Export to Prometheus, Grafana, or DataDog.'
        },
      ],
      relatedTopics: ['Retry Logic', 'Rate Limiting', 'Bulkhead Pattern', 'Timeout Handling'],
    },
  },

  // ========================================
  // PERFORMANCE CATEGORY
  // ========================================
  {
    id: 'caching-1',
    question: 'Design a multi-layer caching strategy for a web application. Explain the tradeoffs between different cache layers.',
    category: 'performance',
    difficulty: 'hard',
    tags: ['caching', 'performance', 'architecture'],
    answer: {
      overview: 'A multi-layer cache balances speed, persistence, and storage capacity. L1 (memory) is fastest, L2 (IndexedDB) is persistent, L3 (Service Worker) handles static assets.',
      keyPoints: [
        '✅ L1 Cache: React Query (memory) - No size limit, <1ms access, lost on reload',
        '✅ L2 Cache: IndexedDB (disk) - 50-100MB quota, ~5-10ms access, persists across sessions',
        '✅ L3 Cache: Service Worker - unlimited (disk), handles static assets',
        '✅ Cache coordination: Check L1 → L2 → L3 → Network',
        '✅ TTL strategy: Posts (7 days), Users (30 days), Comments (3 days)',
        '✅ LRU eviction when storage is full (50MB limit)',
        '✅ Cache warming: Prefetch critical data on app load',
        '✅ Smart invalidation: Cascade updates (post → comments → author)',
        '✅ Stale-while-revalidate for best UX (show cached, fetch fresh)',
        '✅ Track metrics: hit rate, latency, storage usage',
      ],
      implementation: 'Our cacheCoordinator orchestrates all three layers with intelligent fallback and performance tracking.',
      codeExample: `// Cache Coordinator
type CacheStrategy = 
  | 'cache-first' 
  | 'network-first' 
  | 'cache-only' 
  | 'network-only' 
  | 'stale-while-revalidate';

class CacheCoordinator {
  async get<T>(
    key: string, 
    fetcher: () => Promise<T>,
    strategy: CacheStrategy = 'cache-first'
  ): Promise<T> {
    switch (strategy) {
      case 'cache-first':
        return this.cacheFirst(key, fetcher);
      case 'network-first':
        return this.networkFirst(key, fetcher);
      case 'stale-while-revalidate':
        return this.staleWhileRevalidate(key, fetcher);
      default:
        return fetcher();
    }
  }

  private async cacheFirst<T>(
    key: string, 
    fetcher: () => Promise<T>
  ): Promise<T> {
    // L1: React Query
    const l1Data = queryClient.getQueryData<T>([key]);
    if (l1Data) {
      this.recordHit('L1');
      return l1Data;
    }

    // L2: IndexedDB
    const l2Data = await loadFromIndexedDB<T>(key);
    if (l2Data) {
      this.recordHit('L2');
      // Populate L1
      queryClient.setQueryData([key], l2Data);
      return l2Data;
    }

    // L3/Network: Fetch fresh
    this.recordMiss();
    const freshData = await fetcher();
    
    // Populate all layers
    queryClient.setQueryData([key], freshData);
    await saveToIndexedDB(key, freshData, 7 * 24 * 60 * 60 * 1000); // 7 days
    
    return freshData;
  }

  private async staleWhileRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Return cached data immediately
    const cached = queryClient.getQueryData<T>([key]) || 
                   await loadFromIndexedDB<T>(key);
    
    if (cached) {
      // Revalidate in background
      fetcher().then(fresh => {
        queryClient.setQueryData([key], fresh);
        saveToIndexedDB(key, fresh, 7 * 24 * 60 * 60 * 1000);
      });
      return cached;
    }

    // No cache, fetch fresh
    return fetcher();
  }

  async invalidate(pattern: string) {
    // Cascade invalidation
    if (pattern.startsWith('posts/')) {
      const postId = pattern.split('/')[1];
      await queryClient.invalidateQueries({ queryKey: ['posts', postId] });
      await queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      await db.delete('posts', postId);
      await db.delete('comments', postId);
    }
  }

  getMetrics() {
    return {
      l1HitRate: this.hits.l1 / this.total,
      l2HitRate: this.hits.l2 / this.total,
      missRate: this.misses / this.total,
      totalRequests: this.total,
    };
  }
}`,
      followUpQuestions: [
        {
          question: 'When would you use cache-first vs network-first strategies?',
          answer: '**Cache-first**: Use for static/stable data that rarely changes. Examples: User profiles (change monthly), static assets (images, CSS), reference data (country list). Flow: Check cache → if hit, return immediately → background revalidate. **Network-first**: Use for dynamic/real-time data. Examples: Feed posts (new every minute), notifications (time-sensitive), live scores. Flow: Fetch from network → if success, update cache → if network fails, fallback to cache. **Hybrid - Stale-While-Revalidate (SWR)**: Best of both. Return cached data immediately (fast UX), then fetch fresh data in background (accurate data). Perfect for feeds, comments, analytics. Rule: Cache-first for >1hr stale time, Network-first for <1min stale time, SWR for everything in between.'
        },
        {
          question: 'How do you handle cache invalidation for related entities?',
          answer: 'Use **cascade invalidation** with entity relationships: 1) **Define Relationships**: Post → Comments, User → Posts, Post → Author. 2) **Invalidation Rules**: When post updates → invalidate post + comments + author\'s feed. When user updates → invalidate user + all their posts. 3) **Tag-Based**: Tag queries with entity IDs. Query `posts:user:123` tagged with `["posts", "user:123"]`. Invalidate all tags matching pattern. 4) **Smart Cascade**: Don\'t invalidate everything. If post content changes, invalidate post but keep comments cache. If comment added, invalidate comments but keep post. 5) **React Query**: Use `queryClient.invalidateQueries({ queryKey: ["posts"] })` to match all post-related queries. 6) **Version Stamps**: Increment `entityVersion` on update. Cache checks version before using data.'
        },
        {
          question: 'What are the storage quota limits for IndexedDB and how do you handle them?',
          answer: '**Quota Limits** vary by browser: **Chrome/Edge**: ~60% of free disk space (temp storage) or unlimited (persistent storage). **Firefox**: 50% of free disk per origin, max 2GB per group. **Safari**: 1GB per origin, prompts user after 200MB on mobile. **Mobile**: Typically 50-100MB on Android, more restrictive on iOS. **Handling Strategies**: 1) **Monitor Usage**: Use `navigator.storage.estimate()` to check `usage/quota`. Alert at 80% full. 2) **LRU Eviction**: Track `lastAccessTime` for each cached item. When full, delete oldest 10% of items. 3) **Priority Tiers**: Mark critical data (user auth, drafts) as "persistent". Delete non-critical first (analytics, old posts). 4) **Request Persistent Storage**: `await navigator.storage.persist()` asks user for unlimited storage (shows browser prompt). 5) **Compression**: JSON.stringify large objects, compress with pako library. 6) **User Control**: Provide "Clear Cache" button in settings. 7) **Graceful Degradation**: If storage full, fallback to memory-only cache (React Query only).'
        },
        {
          question: 'How do you measure cache effectiveness in production?',
          answer: 'Track these **cache performance metrics**: 1) **Hit Rate**: `hits / (hits + misses) * 100`. Target >70% for L1, >50% for L2. 2) **Latency Reduction**: Compare cache hit latency (<10ms) vs network fetch (>200ms). Calculate time saved. 3) **Server Load**: Measure API requests before/after caching. Target 60-80% reduction. 4) **Cache Size**: Track L1 (memory), L2 (IndexedDB), L3 (Service Worker) storage usage. 5) **Eviction Rate**: How often are items evicted due to TTL or space limits. 6) **Stale Serves**: # of times stale data was served (with revalidation). 7) **User-Perceived Performance**: Measure Time to Interactive (TTI), Largest Contentful Paint (LCP). 8) **A/B Test**: Compare users with cache vs no cache. 9) **Dashboard**: Real-time metrics in Grafana/DataDog with alerts for <50% hit rate.'
        },
      ],
      relatedTopics: ['React Query', 'IndexedDB', 'Service Workers', 'Stale-While-Revalidate'],
    },
  },
  {
    id: 'pagination-1',
    question: 'Compare offset-based vs cursor-based pagination. When would you choose one over the other?',
    category: 'performance',
    difficulty: 'medium',
    tags: ['pagination', 'performance', 'scalability'],
    answer: {
      overview: 'Cursor-based pagination is better for real-time feeds with frequent updates, while offset-based is simpler for static datasets.',
      keyPoints: [
        '✅ Offset-based: page=2&limit=20 → simple but has "drift" problem',
        '✅ Cursor-based: cursor=timestamp&limit=20 → consistent results',
        '✅ Drift problem: New items shift pages, users see duplicates/skip items',
        '✅ Cursor eliminates drift by using stable reference point (ID, timestamp)',
        '✅ Cursor is more efficient for databases (no OFFSET scan)',
        '✅ Offset is easier for random access (jump to page 5)',
        '✅ Use cursor for: feeds, timelines, infinite scroll',
        '✅ Use offset for: search results, static lists, paginated tables',
        '✅ Cursor encoding: Base64(timestamp) or opaque token',
        '✅ Backend query: WHERE created_at < cursor ORDER BY created_at DESC LIMIT 20',
      ],
      implementation: 'We use cursor-based pagination for the feed with timestamp cursors.',
      codeExample: `// Cursor-based Pagination
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

// Backend: Express.js
app.get('/api/posts', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor; // ISO timestamp or post ID

  let query = db.posts.orderBy('createdAt', 'desc');
  
  if (cursor) {
    // Only get posts older than cursor
    query = query.where('createdAt', '<', cursor);
  }

  const posts = await query.limit(limit + 1).get(); // +1 to check hasMore
  const hasMore = posts.length > limit;
  const data = posts.slice(0, limit);

  res.json({
    data,
    nextCursor: hasMore ? data[data.length - 1].createdAt : null,
    hasMore,
  });
});

// Frontend: React Query Infinite Query
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['posts', 'feed'],
  queryFn: ({ pageParam }) => 
    fetch(\`/api/posts?cursor=\${pageParam || ''}&limit=20\`)
      .then(r => r.json()),
  getNextPageParam: (lastPage) => 
    lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
  initialPageParam: undefined,
});

// All posts flattened
const posts = data?.pages.flatMap(page => page.data) ?? [];`,
      followUpQuestions: [
        {
          question: 'How do you implement "load previous" with cursor pagination?',
          answer: '**Bidirectional cursor pagination** requires both next and previous cursors: 1) **Response Format**: Return `{ data, nextCursor, prevCursor }`. 2) **Next**: `WHERE created_at < cursor ORDER BY created_at DESC LIMIT 20`. 3) **Previous**: `WHERE created_at > cursor ORDER BY created_at ASC LIMIT 20`, then reverse results. 4) **React Query**: Use `getNextPageParam` and `getPreviousPageParam`. 5) **UI**: Show "Load Newer" button at top, "Load Older" at bottom. 6) **State Management**: Track `pages` array with ability to prepend/append. 7) **Edge Cases**: Handle when user reaches beginning (no prevCursor) or end (no nextCursor). 8) **Scroll Position**: When prepending, calculate new scroll offset to prevent jumping: `newScrollTop = oldScrollTop + newContentHeight`.'
        },
        {
          question: 'What if your cursor field (timestamp) is not unique?',
          answer: '**Compound cursor** solves non-unique timestamp issues: 1) **Problem**: Multiple posts created at same millisecond have identical timestamps. Cursor skips or duplicates items. 2) **Solution**: Use `created_at + id` as cursor. Example: `2024-01-15T10:30:00Z_post123`. 3) **Query**: `WHERE (created_at < cursor_time) OR (created_at = cursor_time AND id < cursor_id) ORDER BY created_at DESC, id DESC LIMIT 20`. 4) **Encoding**: Base64 encode compound cursor to hide internals: `btoa(JSON.stringify({time, id}))`. 5) **Index**: Create composite index `(created_at DESC, id DESC)` for performance. 6) **Alternative**: Use auto-incrementing ID as cursor if creation order matters more than time. 7) **UUID Cursor**: For distributed systems, use UUID v7 (time-ordered) as natural cursor.'
        },
        {
          question: 'How do you encode cursors to prevent tampering?',
          answer: '**Signed cursors** prevent client manipulation: 1) **Base64 Encoding**: Hide internals but not secure. `btoa(timestamp)` → user can decode and modify. 2) **HMAC Signature**: Sign cursor with secret key. `cursor = base64(data) + "." + hmac(data, secret)`. Verify signature before use. 3) **JWT**: Use JWT for cursor (overkill but secure). Embed timestamp, user_id, direction in claims. 4) **Opaque Tokens**: Store cursor mapping server-side. Return random token, map to actual cursor in Redis. 5) **Validation**: Even with signature, validate cursor is reasonable (not future date, not >1 year old). 6) **Expiration**: Add expiry to cursor (valid for 1 hour). After expiry, user must start from beginning. 7) **Rate Limiting**: Limit pagination requests to prevent cursor brute-force attacks. Best Practice: HMAC signature for most cases, opaque tokens for sensitive data.'
        },
        {
          question: 'Can you jump to a specific page with cursor pagination?',
          answer: '**No direct page jump** with cursor pagination (tradeoff for consistency). **Workarounds**: 1) **Offset Hybrid**: Use offset for jumps, cursor for sequential. Jump to page 5 → `OFFSET 100`, then continue with cursor from there. 2) **Approximate Jump**: Calculate cursor based on time. "Go to posts from 3 days ago" → cursor = `now - 3days`. 3) **Bookmarks**: Let users bookmark cursors. "Page 5" → store cursor in URL param `?cursor=abc123`. 4) **Index Pages**: Pre-generate cursors for common jumps (pages 1, 10, 20, 50, 100). 5) **Search Instead**: For random access, use search/filter instead of pagination. 6) **Virtual Scrolling**: Load all IDs in memory (lightweight), fetch content on-demand. 7) **Accept Limitation**: For real-time feeds (Twitter, Instagram), sequential-only pagination is acceptable. Users rarely jump to page 50.'
        },
      ],
      relatedTopics: ['Infinite Scroll', 'Database Indexing', 'React Query', 'API Design'],
    },
  },
  {
    id: 'optimistic-ui-1',
    question: 'Explain optimistic UI updates. How do you handle rollback when a mutation fails?',
    category: 'data-management',
    difficulty: 'medium',
    tags: ['optimistic-ui', 'mutations', 'ux'],
    answer: {
      overview: 'Optimistic UI updates the UI immediately before the server responds, providing 0ms perceived latency. If the mutation fails, you roll back to the previous state.',
      keyPoints: [
        '✅ Show changes immediately in UI (0ms latency)',
        '✅ Store previous state snapshot before mutation',
        '✅ Use temp IDs for new entities (post-1234567890-abc)',
        '✅ Update React Query cache optimistically',
        '✅ If mutation succeeds: replace temp ID with real ID',
        '✅ If mutation fails: restore previous state, show toast',
        '✅ Handle conflicts: server-wins, client-wins, merge, manual',
        '✅ Track pending operations globally for debugging',
        '✅ Provide visual indicators (saving, saved, failed)',
        '✅ Allow user to retry or undo failed operations',
      ],
      implementation: 'Our useOptimisticMutation hook wraps React Query mutations with automatic rollback.',
      codeExample: `// Optimistic Mutation Hook
function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdate,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Apply optimistic update
      queryClient.setQueryData<TData>(queryKey, (old) => 
        optimisticUpdate(old, variables)
      );

      // Return context for rollback
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error('Failed to save changes', {
        action: { label: 'Retry', onClick: () => mutate(variables) }
      });
    },
    onSuccess: () => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Usage: Optimistic Like
const likeMutation = useOptimisticMutation({
  mutationFn: (postId: string) => api.likePost(postId),
  queryKey: ['posts'],
  optimisticUpdate: (posts, postId) => 
    posts.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1, isLiked: true }
        : post
    ),
});

// Usage: Optimistic Create Post
const createMutation = useOptimisticMutation({
  mutationFn: (data) => api.createPost(data),
  queryKey: ['posts'],
  optimisticUpdate: (posts, newPost) => [
    { ...newPost, id: generateTempId(), createdAt: new Date() },
    ...posts,
  ],
});`,
      followUpQuestions: [
        {
          question: 'What happens if the user navigates away before the mutation completes?',
          answer: '**Persist mutation state** to handle navigation: 1) **React Query Persistence**: Enable `persistQueryClient` plugin. Saves pending mutations to localStorage. 2) **Resume on Return**: When user returns, React Query automatically resumes pending mutations. 3) **Background Sync**: Use Service Worker Background Sync API. Register sync even if user closes tab. 4) **Offline Queue**: Store mutation in IndexedDB offline queue. Survives navigation/refresh. 5) **User Feedback**: Show toast on return: "Completing your action from earlier...". 6) **Cleanup**: Set mutation timeout (5 minutes). After timeout, mark as failed and notify user. 7) **State Recovery**: Store component state with mutation so UI can reconstruct after navigation. Example: User likes post → navigates away → mutation queued → returns → see liked state + "Syncing..." → completes.'
        },
        {
          question: 'How do you handle optimistic updates with complex relationships (post → comments)?',
          answer: '**Cascade optimistic updates** through entity graph: 1) **Update Graph**: When adding comment → update comment list + post comment count + user comment count. 2) **Snapshot Everything**: Save snapshots of all affected caches before mutation. 3) **Rollback Chain**: If mutation fails, rollback all caches in reverse order. 4) **Temp ID Propagation**: Generate temp IDs for comment + post update. Replace all refs when real IDs arrive. 5) **Optimistic Relationships**: Add temp comment to post.comments array immediately. Update post.commentCount++. 6) **Reconciliation**: When server responds, match temp entities to real entities by content/timestamp. Replace temp IDs. 7) **Partial Success**: If comment creates but count update fails, keep comment, retry count update. 8) **Conflict Detection**: Check server version matches client version before applying update.'
        },
        {
          question: 'Should you queue multiple optimistic updates or apply them immediately?',
          answer: '**Apply immediately, queue for server sync**: 1) **Immediate UI Update**: User sees instant feedback (0ms latency). No queueing delay. 2) **Server Queue**: Queue server requests for batching/offline handling. 3) **Why Not Queue UI**: Queuing UI updates creates artificial delays. Users expect instant response. 4) **Conflict Handling**: If 2 updates conflict (like → unlike rapidly), last update wins. Cancel pending request. 5) **Batch Server Requests**: If user likes 10 posts rapidly, batch into single request `POST /api/likes/batch {postIds: [...]}`. 6) **Debounce Mutations**: For text input (search, comment typing), debounce server requests but update UI immediately. 7) **Optimistic Pipeline**: UI updates → Local cache updates → IndexedDB updates → Server queue → Server sync. 8) **Race Conditions**: Use mutation IDs to ignore stale responses. Only apply response if request ID matches latest.'
        },
        {
          question: 'How do you handle partial failures in a batch operation?',
          answer: '**Granular success/failure tracking** for batch operations: 1) **Response Format**: Return per-item status: `[{id: "1", status: "success"}, {id: "2", status: "failed", error: "Not found"}]`. 2) **Partial Rollback**: Rollback only failed items, keep successful ones. If 8/10 likes succeed, update UI for 8, show error for 2. 3) **Retry Subset**: Queue only failed items for retry, not entire batch. 4) **UI Feedback**: Show mixed state: "8 posts liked, 2 failed". Provide retry button for failed items. 5) **Atomic Option**: Offer user choice: "All or Nothing" (transaction) vs "Best Effort" (partial). 6) **Server Support**: Backend must support partial batch processing and return detailed status. 7) **Optimistic Assumption**: Optimistically apply all, then selectively rollback failures. 8) **Consistency**: Update all caches (L1, L2, offline queue) with same partial state.'
        },
      ],
      relatedTopics: ['React Query', 'Mutations', 'Offline Queue', 'Conflict Resolution'],
    },
  },

  // ========================================
  // ARCHITECTURE CATEGORY
  // ========================================
  {
    id: 'architecture-1',
    question: 'You need to add real-time updates to your feed (new posts appear automatically). Compare polling, long-polling, SSE, and WebSockets. Which would you choose and why?',
    category: 'architecture',
    difficulty: 'hard',
    tags: ['real-time', 'websockets', 'polling', 'architecture'],
    answer: {
      overview: 'Each real-time strategy has tradeoffs in complexity, latency, server load, and browser compatibility. Choose based on your requirements.',
      keyPoints: [
        '✅ Polling: Simple, high latency (30s+), high server load, works everywhere',
        '✅ Long-polling: Lower latency (1-5s), moderate load, connection timeouts',
        '✅ SSE: Low latency (<1s), server-to-client only, simpler than WebSocket',
        '✅ WebSocket: Lowest latency (<100ms), bidirectional, complex to scale',
        '✅ Polling: GET /api/posts every 30s (simple, cacheable, but wasteful)',
        '✅ Long-polling: Hold connection until new data (battery drain on mobile)',
        '✅ SSE: EventSource API, automatic reconnect, HTTP/2 multiplexing',
        '✅ WebSocket: Full-duplex, requires load balancer with sticky sessions',
        '✅ For social feed: Use SSE (one-way updates, simpler than WebSocket)',
        '✅ For chat: Use WebSocket (bidirectional, low latency required)',
      ],
      implementation: 'For our feed, we use polling (30s) with manual refresh. SSE would be the next step.',
      codeExample: `// Option 1: Polling (Current Implementation)
const { data } = useQuery({
  queryKey: ['posts', 'feed'],
  queryFn: fetchPosts,
  refetchInterval: 30000, // Poll every 30 seconds
  refetchOnWindowFocus: true,
});

// Option 2: Server-Sent Events (SSE)
function useFeedSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource('/api/posts/stream');

    eventSource.addEventListener('new-post', (event) => {
      const newPost = JSON.parse(event.data);
      
      // Add to cache optimistically
      queryClient.setQueryData(['posts'], (old) => [newPost, ...old]);
      
      // Show notification
      toast.info('New posts available', {
        action: { label: 'Refresh', onClick: scrollToTop }
      });
    });

    eventSource.onerror = () => {
      // Fallback to polling
      console.warn('SSE connection failed, using polling');
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);
}

// Backend: SSE endpoint (Express)
app.get('/api/posts/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendPost = (post) => {
    res.write(\`event: new-post\\n\`);
    res.write(\`data: \${JSON.stringify(post)}\\n\\n\`);
  };

  // Subscribe to post creation events
  const subscription = postEmitter.on('created', sendPost);

  req.on('close', () => {
    postEmitter.off('created', sendPost);
  });
});

// Option 3: WebSocket (for comparison)
function useFeedWebSocket() {
  useEffect(() => {
    const ws = new WebSocket('wss://api.example.com/feed');

    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      
      if (type === 'NEW_POST') {
        queryClient.setQueryData(['posts'], (old) => [data, ...old]);
      }
    };

    ws.onerror = () => {
      // Fallback to polling
      ws.close();
    };

    return () => ws.close();
  }, []);
}`,
      followUpQuestions: [
        {
          question: 'How do you handle reconnection and missed messages with SSE/WebSocket?',
          answer: '**Implement reconnection with message recovery**: 1) **Last Event ID**: SSE supports `Last-Event-ID` header. On reconnect, server sends missed events since that ID. 2) **Client Watermark**: Store `lastReceivedMessageId` in localStorage. On reconnect, request `GET /messages?since=lastId`. 3) **Exponential Backoff**: Reconnect with delays: 1s → 2s → 4s → 8s → max 30s. Prevents server overload. 4) **Heartbeat/Ping**: Send ping every 30s. If no pong, assume connection dead, reconnect. 5) **Message Deduplication**: Use message IDs to ignore duplicates during overlap period. 6) **Catchup Batch**: On reconnect, fetch missed messages via REST, then switch to WebSocket/SSE. 7) **Connection State UI**: Show "Connected", "Reconnecting...", "Offline" badge. 8) **Fallback**: After 5 failed reconnects, fallback to polling.'
        },
        {
          question: 'What are the scaling challenges of WebSocket (sticky sessions, horizontal scaling)?',
          answer: '**WebSocket scaling requires special architecture**: 1) **Sticky Sessions**: Load balancer must route all requests from same client to same server. Use cookie-based or IP-based stickiness. 2) **Horizontal Scaling Problem**: If user connects to Server A, but event happens on Server B, user doesn\'t receive it. 3) **Solution 1 - Redis Pub/Sub**: All servers subscribe to Redis channels. Event on Server B → publish to Redis → Server A receives → push to client. 4) **Solution 2 - Message Queue**: Use RabbitMQ/Kafka. Servers consume from shared queue. 5) **Solution 3 - Dedicated WebSocket Servers**: Separate stateful WS servers from stateless API servers. Only scale WS layer. 6) **Connection Limits**: Each server typically handles 10K-65K concurrent WebSocket connections (depends on RAM). Modern servers with 64GB RAM can handle 100K+ connections. 7) **Health Checks**: Can\'t use standard HTTP health checks. Use WebSocket ping/pong or custom health endpoint.'
        },
        {
          question: 'How do you handle authentication with SSE/WebSocket?',
          answer: '**Secure real-time connections**: 1) **Initial Auth**: For WebSocket, send JWT in connection message after connect (avoid query params for security). For SSE, use Authorization header. 2) **Token Refresh**: Access token typically expires after 15-30 minutes. Implement refresh token mechanism or send new token via message: `{type: "AUTH_REFRESH", token: newJWT}`. 3) **Session Validation**: Validate token on connect. For added security, re-validate periodically (every 5 minutes). 4) **Secure Transport**: Always use WSS (WebSocket Secure) and HTTPS for SSE. Never WS or HTTP in production. 5) **CSRF Protection**: Verify Origin header matches allowed domains to prevent cross-site attacks. 6) **Rate Limiting**: Limit messages per connection (100/minute) to prevent abuse and DoS attacks. 7) **Revocation**: If user logs out, broadcast "AUTH_REVOKED" → disconnect all WebSocket connections for that user. 8) **Security Best Practice**: Avoid JWT in WebSocket URL query params (logs, proxies). Send in first message payload instead.'
        },
        {
          question: 'What about battery life on mobile devices?',
          answer: '**Optimize for mobile battery**: 1) **Long Polling**: More battery-friendly than WebSocket for infrequent updates. WS keeps connection alive constantly. 2) **SSE Efficiency**: SSE over HTTP/2 is efficient due to multiplexing. Single connection for multiple streams. 3) **Heartbeat Interval**: Reduce ping frequency on mobile. Every 60s instead of 30s. Detect mobile with User-Agent. 4) **Adaptive Polling**: Start with 30s polling, increase to 60s if battery low (Battery API). 5) **Background Tab**: Pause real-time updates when tab is hidden (Page Visibility API). Resume on focus. 6) **Native Push**: For critical updates (new message), use Web Push Notifications instead of keeping WS open. 7) **Battery API**: Check `navigator.getBattery()` → if battery <20%, fallback to polling. 8) **Metrics**: Track battery drain in analytics. If users complain, optimize further.'
        },
      ],
      relatedTopics: ['HTTP/2', 'Load Balancing', 'Pub/Sub', 'Event-Driven Architecture'],
    },
  },
  {
    id: 'architecture-2',
    question: 'Design a system to handle 10,000 concurrent users creating posts, liking, and commenting. What are your scalability considerations?',
    category: 'architecture',
    difficulty: 'hard',
    tags: ['scalability', 'performance', 'architecture'],
    answer: {
      overview: 'Scaling to 10K concurrent users requires horizontal scaling, caching, database optimization, CDN, and queue-based architecture.',
      keyPoints: [
        '✅ Horizontal scaling: Multiple app servers behind load balancer',
        '✅ Database: Read replicas for reads, primary for writes',
        '✅ Caching: Redis for hot data (user sessions, popular posts)',
        '✅ CDN: Serve static assets (images, JS, CSS) from edge',
        '✅ Queue: Background jobs for notifications, analytics (RabbitMQ/SQS)',
        '✅ Rate limiting: Prevent abuse (100 req/min per user)',
        '✅ Database indexing: Index on userId, postId, createdAt',
        '✅ Connection pooling: Reuse DB connections (pg-pool)',
        '✅ Pagination: Cursor-based to handle real-time updates',
        '✅ Monitoring: Track response times, error rates, DB queries',
      ],
      implementation: 'Our current setup handles ~100 concurrent users. Scaling to 10K requires infrastructure changes.',
      codeExample: `// Scalable Architecture

// 1. Load Balancer (Nginx)
upstream app_servers {
  server app1.example.com:3000;
  server app2.example.com:3000;
  server app3.example.com:3000;
  least_conn; // Route to server with fewest connections
}

// 2. Database Read Replicas (PostgreSQL)
const primaryDB = new Pool({
  host: 'primary.db.example.com',
  // For writes only
});

const replicaDB = new Pool({
  host: 'replica.db.example.com',
  // For reads only
});

// Smart query routing
async function query(sql, params, isWrite = false) {
  const pool = isWrite ? primaryDB : replicaDB;
  return pool.query(sql, params);
}

// 3. Redis Cache Layer
const redis = new Redis('redis.example.com:6379');

async function getPost(postId) {
  // Check cache first
  const cached = await redis.get(\`post:\${postId}\`);
  if (cached) return JSON.parse(cached);

  // Fetch from DB
  const post = await query('SELECT * FROM posts WHERE id = $1', [postId]);
  
  // Cache for 5 minutes
  await redis.setex(\`post:\${postId}\`, 300, JSON.stringify(post));
  
  return post;
}

// 4. Message Queue for Background Jobs
import { Queue } from 'bull';

const notificationQueue = new Queue('notifications', {
  redis: 'redis://queue.example.com:6379'
});

// Enqueue notification job (non-blocking)
await notificationQueue.add('send', {
  userId: '123',
  type: 'NEW_COMMENT',
  postId: '456'
});

// Worker processes jobs asynchronously
notificationQueue.process('send', async (job) => {
  await sendNotification(job.data);
});

// 5. Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please slow down'
});

app.use('/api/', limiter);

// 6. Database Indexing
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_likes_user_post ON likes(user_id, post_id);

// 7. Connection Pooling
const pool = new Pool({
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});`,
      followUpQuestions: [
        {
          question: 'How do you handle cache invalidation across multiple servers?',
          answer: '**Distributed cache invalidation strategies**: 1) **Redis Pub/Sub**: Server A writes to cache → publishes `INVALIDATE:posts:123` to Redis channel → all servers (including A) receive message → clear local cache. 2) **Database Triggers**: DB trigger on UPDATE → calls webhook → broadcasts to all servers. 3) **Cache Versioning**: Instead of invalidating, increment version number. `posts:123:v2` → old version automatically ignored. 4) **TTL-Only**: Use short TTL (1-5 minutes), no explicit invalidation. Accept eventual consistency. 5) **API Gateway**: Centralized invalidation service. All servers send invalidation requests to gateway. 6) **Sticky Sessions**: Route same user to same server, reduces need for cross-server invalidation. 7) **Message Queue**: Kafka/RabbitMQ for guaranteed delivery of invalidation events.'
        },
        {
          question: 'What database sharding strategy would you use?',
          answer: '**Horizontal sharding for scalability**: 1) **Shard by User ID**: Hash(userId) % numShards. User 123 always on Shard 2. Pros: Even distribution. Cons: Cross-shard queries hard. 2) **Shard by Geography**: US users on US shard, EU users on EU shard. Pros: Low latency, data residency compliance. Cons: Uneven distribution. 3) **Shard by Time**: Recent data (last 30 days) on hot shard, old data on cold shard. Pros: Hot shard is fast SSD. Cons: Moving data between shards. 4) **Composite Key**: Combine user + time for optimal distribution. 5) **Virtual Shards**: Use 1000 virtual shards mapped to 10 physical shards. Easy to rebalance. 6) **For Social Feed**: Shard by userId. Posts and comments stay with user. Feed aggregation requires scatter-gather across shards.'
        },
        {
          question: 'How do you ensure consistency between cache and database?',
          answer: '**Cache consistency patterns**: 1) **Write-Through**: Write to DB + cache simultaneously. Consistent but slow writes. 2) **Write-Behind**: Write to cache first, async write to DB. Fast but risk of data loss. 3) **Cache-Aside**: App writes to DB, invalidates cache. Next read populates cache. Simple but cache can be stale. 4) **Event Sourcing**: All writes are events. Cache subscribes to event stream, stays in sync. 5) **Two-Phase Commit**: Transaction across DB + cache. Both succeed or both fail. 6) **TTL Safety**: Even with bugs, cache expires and refreshes from DB. 7) **Comparison**: For our social feed, use Cache-Aside with short TTL (5 minutes). Consistency isn\'t critical for feeds. For payments, use Write-Through for strict consistency.'
        },
        {
          question: 'What metrics would you monitor in production?',
          answer: '**Comprehensive production monitoring**: 1) **Performance**: p50/p95/p99 response times per endpoint. Target <200ms p95. 2) **Error Rate**: Errors per minute, grouped by status code (4xx, 5xx). Alert if >1%. 3) **Throughput**: Requests per second (RPS). Track peak and average. 4) **Database**: Query latency, connection pool usage, slow queries. 5) **Cache Hit Rate**: L1/L2/L3 hit rates. Alert if <50%. 6) **Resource Usage**: CPU, memory, disk I/O per server. Alert at 80% utilization. 7) **User Metrics**: Active users, session duration, bounce rate. 8) **Business KPIs**: Posts created, likes, comments per day. 9) **Alerts**: PagerDuty for critical issues (service down, DB down). 10) **Dashboard**: Grafana with real-time metrics and 30-day trends.'
        },
      ],
      relatedTopics: ['Load Balancing', 'Database Replication', 'Message Queues', 'CDN'],
    },
  },

  // ========================================
  // ACCESSIBILITY CATEGORY
  // ========================================
  {
    id: 'accessibility-1',
    question: 'How would you make an infinite scroll feed accessible to screen reader users and keyboard-only users?',
    category: 'accessibility',
    difficulty: 'medium',
    tags: ['accessibility', 'wcag', 'a11y', 'keyboard'],
    answer: {
      overview: 'Accessible infinite scroll requires ARIA live regions, keyboard navigation, focus management, and alternative pagination options.',
      keyPoints: [
        '✅ Use ARIA live region to announce new items: aria-live="polite"',
        '✅ Keyboard navigation: j/k to navigate posts, Enter to open',
        '✅ Focus management: Restore focus after loading more items',
        '✅ Skip link: "Skip to main content" for screen readers',
        '✅ Alternative: Provide "Load More" button instead of auto-load',
        '✅ Semantic HTML: <article>, <nav>, <main> for structure',
        '✅ ARIA labels: aria-label="Post feed", aria-describedby for context',
        '✅ Keyboard shortcuts: Display shortcut help with "?"',
        '✅ Reduced motion: Disable animations if prefers-reduced-motion',
        '✅ Screen reader testing: Test with NVDA, JAWS, VoiceOver',
      ],
      implementation: 'We use semantic HTML, ARIA attributes, and keyboard shortcuts throughout.',
      codeExample: `// Accessible Infinite Scroll
function AccessibleFeed() {
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  const [announcement, setAnnouncement] = useState('');

  // Announce new posts to screen readers
  useEffect(() => {
    if (data?.pages.length > 1) {
      const newPostsCount = data.pages[data.pages.length - 1].data.length;
      setAnnouncement(\`Loaded \${newPostsCount} more posts\`);
    }
  }, [data?.pages.length]);

  // Keyboard navigation
  useKeyboardNavigation({
    'j': () => focusNext(),
    'k': () => focusPrevious(),
    'l': () => likeCurrentPost(),
    '/': () => focusSearch(),
  });

  return (
    <main role="main" aria-label="Post feed">
      {/* Screen reader announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Post list */}
      <div id="main-content" role="feed" aria-busy={isLoading}>
        {posts.map((post, index) => (
          <article
            key={post.id}
            role="article"
            aria-posinset={index + 1}
            aria-setsize={posts.length}
            tabIndex={0}
            aria-label={post.title}
          >
            <PostCard post={post} />
          </article>
        ))}
      </div>

      {/* Load More button (accessible alternative to auto-load) */}
      {hasNextPage && (
        <button
          onClick={fetchNextPage}
          aria-label="Load more posts"
          className="load-more-button"
        >
          Load More
        </button>
      )}

      {/* Keyboard shortcuts help */}
      <KeyboardShortcutsDialog />
    </main>
  );
}

// Keyboard navigation hook
function useKeyboardNavigation(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement) return;

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [shortcuts]);
}

// CSS for skip link
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}`,
      followUpQuestions: [
        {
          question: 'How do you test keyboard navigation with screen readers?',
          answer: '**Screen reader testing workflow**: 1) **Tools**: Use NVDA (Windows, free), JAWS (Windows, paid), VoiceOver (Mac, built-in), TalkBack (Android). 2) **Test Scenarios**: (a) Navigate feed with arrow keys. (b) Tab through interactive elements. (c) Activate buttons with Enter. (d) Hear post content read aloud. 3) **ARIA Announcements**: Verify live regions announce new posts: "Loaded 20 more posts". 4) **Focus Management**: After loading more, focus stays on current item, doesn\'t jump. 5) **Semantic HTML**: Screen reader announces "article" for posts, "navigation" for nav bar. 6) **Image Alt Text**: Every image has descriptive alt. Avatar = "Jane Smith\'s profile picture". 7) **Form Labels**: Every input has associated label. Screen reader reads label when focusing input. 8) **Automated Testing**: Use axe-core DevTools extension, Lighthouse accessibility audit (target 95+).'
        },
        {
          question: 'What WCAG 2.1 level are you targeting (A, AA, AAA)?',
          answer: '**WCAG compliance levels**: 1) **Level A (Minimum)**: Basic accessibility. Most critical issues fixed. Still has major gaps. Not acceptable for production. 2) **Level AA (Recommended)**: Industry standard. Required by ADA, Section 508. Covers 90% of accessibility needs. Target this for production. 3) **Level AAA (Gold Standard)**: Strictest requirements. Often impossible to achieve (e.g., sign language interpretation for all videos). Not required by law. 4) **Our Target**: AA compliance. Criteria: 4.5:1 text contrast, 3:1 UI contrast, keyboard accessible, screen reader compatible, no time limits. 5) **Audit**: Use axe DevTools to scan. Fix all Level A & AA violations. 6) **Manual Testing**: Automated tools catch 40% of issues. Need manual keyboard + screen reader testing. 7) **Continuous**: Check accessibility in every PR, not just once.'
        },
        {
          question: 'How do you handle focus for dynamically inserted content?',
          answer: '**Focus management for dynamic content**: 1) **Preserve Context**: When inserting content, don\'t move focus unless user triggered it. Unexpected focus changes are disorienting. 2) **Infinite Scroll**: After loading more posts, keep focus on current post. User can continue navigating downward. 3) **Modal/Dialog**: When opening modal, focus first interactive element (close button or input). Trap focus inside modal. On close, return focus to trigger button. 4) **Toast Notifications**: Don\'t steal focus. Use `aria-live="polite"` so screen reader announces, but user stays focused on current task. 5) **Form Errors**: After submit fails, focus first error field. Helps user fix issues quickly. 6) **Delete Action**: After deleting item, focus next item in list. If last item, focus previous item. 7) **Live Regions**: For updates (new message, new post), use `aria-live` instead of moving focus. 8) **Skip Links**: Provide "Skip to new content" link after dynamic insertion.'
        },
        {
          question: 'What color contrast ratio is required for WCAG AA compliance?',
          answer: '**WCAG AA contrast requirements**: 1) **Normal Text (18pt)**: 4.5:1 contrast ratio. Example: #555 text on #FFF background = 8.6:1 (passes). 2) **Large Text (18pt+ or 14pt+ bold)**: 3:1 contrast ratio. Example: #767676 on #FFF = 4.5:1 (passes). 3) **UI Components**: 3:1 for buttons, input borders, focus indicators. Example: Blue button #0066CC on white = 8.4:1 (passes). 4) **Testing Tools**: Use Stark plugin, Colour Contrast Analyser, Chrome DevTools (inspect element → contrast ratio shown). 5) **Common Failures**: Light gray text (#CCC) on white = 1.6:1 (fails). Pale yellow button = 1.2:1 (fails). 6) **AAA Standard**: 7:1 for normal text, 4.5:1 for large. Stricter but not required. 7) **Exemptions**: Logos, decorative elements, disabled buttons don\'t need to meet contrast. 8) **Fix**: Darken foreground or lighten background. #999 is safe gray for text on white (5.8:1).'
        },
      ],
      relatedTopics: ['WCAG 2.1', 'ARIA', 'Keyboard Navigation', 'Screen Readers'],
    },
  },

  // ========================================
  // DATA MANAGEMENT CATEGORY (continued)
  // ========================================
  {
    id: 'state-management-1',
    question: 'Compare different state management solutions (Redux, Zustand, React Query, Context). When would you use each?',
    category: 'data-management',
    difficulty: 'medium',
    tags: ['state-management', 'redux', 'zustand', 'react-query'],
    answer: {
      overview: 'Different state types need different solutions: Server state (React Query), Global UI state (Zustand), Form state (local useState), Theme/auth (Context).',
      keyPoints: [
        '✅ React Query: Server state (fetching, caching, syncing) - 80% of "state"',
        '✅ Zustand: Global UI state (modals, toasts, filters) - simple, no boilerplate',
        '✅ Redux: Complex client state with time-travel debugging - overkill for most apps',
        '✅ Context: Theme, auth, i18n - values that rarely change',
        '✅ Local useState: Component-specific state (toggle, input) - default choice',
        '✅ React Query eliminates need for Redux in 80% of cases',
        '✅ Zustand is 10x simpler than Redux (no actions, reducers, middleware)',
        '✅ Never put server state in Redux/Zustand - use React Query',
        '✅ Context causes re-renders for all consumers - split contexts or use Zustand',
        '✅ Bundle size: Zustand (~1KB gzipped) vs Redux (~8KB gzipped) vs React Query (~13KB gzipped)',
      ],
      implementation: 'We use React Query for server state, Zustand for UI state (toasts, search filters), local state for forms.',
      codeExample: `// React Query: Server State
const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Zustand: Global UI State
import { create } from 'zustand';

const useUIStore = create((set) => ({
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));

// Zustand with Persistence
const useFilterStore = create(
  persist(
    (set) => ({
      sortBy: 'newest',
      setSortBy: (sortBy) => set({ sortBy }),
    }),
    { name: 'filters' }
  )
);

// Local State: Component State
function PostForm() {
  const [content, setContent] = useState('');
  return <textarea value={content} onChange={(e) => setContent(e.target.value)} />;
}

// Context: Rarely Changing Global Values
const ThemeContext = createContext();

function App() {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <YourApp />
    </ThemeContext.Provider>
  );
}`,
      followUpQuestions: [
        {
          question: 'Why is separating server state from client state important?',
          answer: '**Separation of concerns improves maintainability**: 1) **Different Lifecycles**: Server state is fetched/cached/synced. Client state is local and ephemeral. 2) **Caching Strategy**: Server state needs smart caching (stale-while-revalidate). Client state doesn\'t need caching. 3) **Sync Complexity**: Server state requires sync logic, conflict resolution. Client state is single source of truth. 4) **Tools Optimization**: React Query is built for server state (auto-refetch, deduplication). Zustand is built for client state (simple, fast). 5) **Debugging**: Easier to debug when concerns are separate. Check React Query DevTools for server issues, Zustand DevTools for UI issues. 6) **Example**: Posts data (server state) in React Query. Modal open/closed (client state) in Zustand. Mixing them creates confusion.'
        },
        {
          question: 'When would you actually need Redux over Zustand?',
          answer: '**Redux is overkill 95% of the time**, but needed for: 1) **Time-Travel Debugging**: Redux DevTools with action replay is unmatched. Critical for complex flows (e-commerce checkout, multi-step forms). 2) **Strict Architecture**: Large teams need enforced patterns. Redux enforces actions/reducers discipline. Zustand is too flexible. 3) **Middleware Ecosystem**: Redux has mature middleware (redux-saga, redux-observable, redux-persist). 4) **Legacy Codebase**: Already using Redux, migration cost too high. 5) **Global Undo/Redo**: Redux\'s immutable updates make undo/redo trivial. 6) **Complex State Logic**: Deeply nested state with complex updates. Redux reducers are clearer than Zustand set functions. For new projects: Start with Zustand + React Query. Only add Redux if you hit these specific needs.'
        },
        {
          question: 'How do you prevent Context re-render issues?',
          answer: '**Context re-render optimization strategies**: 1) **Split Contexts**: Instead of one big context, create separate contexts for independent concerns. `ThemeContext` + `AuthContext` instead of `AppContext`. 2) **Memoization**: Wrap context value in `useMemo(() => ({user, setUser}), [user])`. Prevents new object on every render. 3) **Context Selectors**: Use external library like `use-context-selector` to subscribe to specific values. 4) **Composition**: Move expensive components outside context provider tree. 5) **Lazy State**: Use `useReducer` instead of `useState` for complex state. 6) **Bailout**: Return same reference if state didn\'t change. 7) **Just Use Zustand**: Zustand has built-in selectors, no re-render issues. `const user = useStore(state => state.user)` only re-renders if user changes.'
        },
        {
          question: 'What are the downsides of React Query?',
          answer: '**React Query tradeoffs**: 1) **Bundle Size**: 13KB gzipped. Significant for small apps. 2) **Learning Curve**: Concepts like staleTime, cacheTime, refetchOnWindowFocus take time to understand. 3) **Over-Fetching**: Default aggressive refetching (on window focus, mount, reconnect) can waste bandwidth. 4) **Server Dependency**: Requires backend that fits CRUD model. Complex GraphQL queries can be tricky. 5) **State Complexity**: Easy to create inconsistent state if not careful with invalidation. 6) **Debugging**: Query key mismatches cause subtle bugs. Hard to debug why data isn\'t updating. 7) **Not Offline-First**: Requires custom offline queue solution. 8) **When to Avoid**: Simple static sites, apps with <5 API calls, offline-first apps (use IndexedDB directly).'
        },
      ],
      relatedTopics: ['React Query', 'Zustand', 'Redux', 'Context API'],
    },
  },
  {
    id: 'infinite-scroll-1',
    question: 'How would you implement infinite scroll with performance optimization? What are the edge cases?',
    category: 'performance',
    difficulty: 'medium',
    tags: ['infinite-scroll', 'intersection-observer', 'performance'],
    answer: {
      overview: 'Infinite scroll uses Intersection Observer for efficient scroll detection, cursor pagination for data fetching, and virtualization for rendering large lists.',
      keyPoints: [
        '✅ Use Intersection Observer (native browser API) - more efficient than scroll listeners',
        '✅ Set rootMargin="200px" to pre-fetch before user reaches bottom',
        '✅ Cursor-based pagination to handle real-time updates without drift',
        '✅ Virtualization for large lists (react-window) - only render visible items',
        '✅ Debounce fetch calls to prevent multiple rapid requests',
        '✅ Handle edge cases: empty state, end of list, loading state, errors',
        '✅ Cleanup observer on unmount to prevent memory leaks',
        '✅ Disable observer while fetching to prevent duplicate requests',
        '✅ Restore scroll position on navigation back',
        '✅ Provide "Back to Top" button for long lists',
      ],
      implementation: 'We use useInfiniteScroll hook with Intersection Observer and React Query infinite queries.',
      codeExample: `// Infinite Scroll Hook
function useInfiniteScroll({ onIntersect, enabled = true, rootMargin = '200px' }) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin, threshold: 0.1 }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [onIntersect, enabled, rootMargin]);

  return targetRef;
}

// Usage with React Query
function FeedContainer() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts', 'feed'],
    queryFn: ({ pageParam }) => fetchPosts({ cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
    initialPageParam: undefined,
  });

  const targetRef = useInfiniteScroll({
    onIntersect: fetchNextPage,
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '200px', // Fetch 200px before reaching bottom
  });

  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      
      {hasNextPage && (
        <div ref={targetRef} className="loading-trigger">
          {isFetchingNextPage ? 'Loading more...' : 'Scroll for more'}
        </div>
      )}
      
      {!hasNextPage && <div>You've reached the end!</div>}
    </div>
  );
}

// With Virtualization (for 10K+ items)
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedFeed() {
  const parentRef = useRef();
  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated item height
    overscan: 5, // Render 5 extra items
  });

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: \`translateY(\${virtualItem.start}px)\`,
            }}
          >
            <PostCard post={posts[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}`,
      followUpQuestions: [
        {
          question: 'When would you use virtualization vs regular infinite scroll?',
          answer: '**Use virtualization for large lists**: 1) **Threshold**: >1000 items rendered = use virtualization. <1000 = regular infinite scroll is fine. 2) **Item Complexity**: Complex items (heavy images, videos) = virtualize at 100+ items. Simple text items = 1000+ items okay. 3) **Performance Symptoms**: If FPS drops below 30, scroll feels janky, or memory usage >200MB, virtualize. 4) **Mobile**: Virtualize earlier on mobile (500+ items) due to limited memory. 5) **Use Cases**: Virtualize: Long lists (10K+ contacts), tables, logs. Regular: Social feeds (user rarely scrolls past 500 posts), search results. 6) **Tradeoffs**: Virtualization adds complexity, breaks browser find (Ctrl+F), accessibility issues. Only use when necessary.'
        },
        {
          question: 'How do you handle variable item heights in virtualization?',
          answer: '**Dynamic height virtualization**: 1) **Estimate Then Measure**: Start with estimated height (200px). After render, measure actual height, update. 2) **TanStack Virtual**: Use `estimateSize` function. Library automatically measures and adjusts. 3) **Content-Based Estimation**: Estimate based on content length. Short post = 150px, long post = 400px. 4) **Cache Measurements**: Store measured heights in Map. Reuse on re-render. 5) **Overscan**: Render 5-10 extra items above/below viewport to hide measurement jumps. 6) **Scroll Anchoring**: Browser feature to prevent scroll jumping during measurement. 7) **SSR Heights**: If rendering server-side, calculate heights on server, send to client. 8) **Fallback**: If estimation is very wrong, recalculate entire virtual list (expensive but rare).'
        },
        {
          question: 'What happens if the user is offline and scrolls?',
          answer: '**Offline infinite scroll strategies**: 1) **Pre-Cached Pages**: If we cached pages 1-5, user can scroll through them offline. Show "Offline" badge but allow scrolling. 2) **End Marker**: When reaching uncached content, show "You\'re offline. Can\'t load more posts." with retry button. 3) **Optimistic Placeholder**: Show skeleton loaders as if loading, but with "Waiting for connection..." message. 4) **IndexedDB Pagination**: Cache more pages in IndexedDB. Fetch from L2 cache instead of network. 5) **Infinite Offline**: If entire feed is cached (unlikely unless small), infinite scroll works fully offline. 6) **Network Resume**: When connection restored, automatically fetch next page, hide offline message. 7) **User Control**: Provide manual "Load More" button offline to prevent surprise when network returns.'
        },
        {
          question: 'How do you test infinite scroll in Jest?',
          answer: '**Testing strategies for infinite scroll**: 1) **Mock IntersectionObserver**: Jest doesn\'t support it. Use `jest.mock` to create fake observer. 2) **Simulate Scroll**: Call observer callback manually: `mockObserver.callback([{isIntersecting: true}])`. 3) **Test Cases**: (a) Initial load renders first page. (b) Intersection triggers fetchNextPage. (c) hasNextPage=false shows "End of list". (d) Error shows error message. 4) **React Testing Library**: Use `waitFor(() => expect(screen.getByText("Post 20")).toBeInTheDocument())` to verify next page loaded. 5) **Mock React Query**: Mock `useInfiniteQuery` to return controlled data. 6) **Integration Test**: Use Playwright/Cypress to test real scrolling in browser. 7) **Snapshot Testing**: Snapshot initial state, loading state, error state, success state.'
        },
      ],
      relatedTopics: ['Intersection Observer', 'Virtualization', 'React Query', 'Performance'],
    },
  },

  // ========================================
  // PATTERNS CATEGORY (continued)
  // ========================================
  {
    id: 'validation-1',
    question: 'Design a client-side validation strategy. How do you balance UX with security?',
    category: 'patterns',
    difficulty: 'medium',
    tags: ['validation', 'forms', 'security', 'ux'],
    answer: {
      overview: 'Client-side validation improves UX by providing instant feedback, but must be duplicated on the server for security. Use debouncing, clear error messages, and accessible components.',
      keyPoints: [
        '✅ Client validation = UX, Server validation = Security - ALWAYS validate both',
        '✅ Validate on blur, not on every keystroke (reduces annoyance)',
        '✅ Debounce async validation (username uniqueness) by 300ms',
        '✅ Show inline errors with aria-describedby for accessibility',
        '✅ Use character counters with warning thresholds (80% = yellow, 100% = red)',
        '✅ Composable validators: required, minLength, maxLength, email, pattern',
        '✅ Field-level validation: Each field validates independently',
        '✅ Form-level validation: Cross-field rules (password confirmation)',
        '✅ Sanitize inputs to prevent XSS (strip HTML tags)',
        '✅ Never trust client validation - always re-validate on server',
      ],
      implementation: 'Our useFormValidation hook provides reusable validation logic with TypeScript generics.',
      codeExample: `// Composable Validators
type Validator<T> = (value: T) => string | null;

const required = <T,>(message = 'This field is required'): Validator<T> => 
  (value) => (!value ? message : null);

const minLength = (min: number): Validator<string> => 
  (value) => (value.length < min ? \`Must be at least \${min} characters\` : null);

const email: Validator<string> = (value) => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(value) ? null : 'Invalid email address';
};

// Composable validation
const composeValidators = <T,>(...validators: Validator<T>[]): Validator<T> => 
  (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };

// Form Validation Hook
function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: Partial<Record<keyof T, Validator<any>>>
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = (name: keyof T, value: any) => {
    const validator = rules[name];
    if (!validator) return null;
    return validator(value);
  };

  const handleChange = (name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    
    // Only validate if field was touched
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error || undefined }));
    }
  };

  const handleBlur = (name: keyof T) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors((prev) => ({ ...prev, [name]: error || undefined }));
  };

  const validate = () => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    for (const name in rules) {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    setTouched(Object.keys(rules).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    return isValid;
  };

  return { values, errors, touched, handleChange, handleBlur, validate };
}

// Usage
function PostForm() {
  const { values, errors, touched, handleChange, handleBlur, validate } = useFormValidation(
    { title: '', content: '' },
    {
      title: composeValidators(
        required('Title is required'),
        minLength(3),
        maxLength(100)
      ),
      content: composeValidators(
        required('Content is required'),
        minLength(10),
        maxLength(5000)
      ),
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await api.createPost(values);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={values.title}
          onChange={(e) => handleChange('title', e.target.value)}
          onBlur={() => handleBlur('title')}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        {touched.title && errors.title && (
          <span id="title-error" role="alert">
            {errors.title}
          </span>
        )}
      </div>
      <button type="submit">Create Post</button>
    </form>
  );
}`,
      followUpQuestions: [
        {
          question: 'How do you handle async validation (checking username uniqueness)?',
          answer: '**Debounced async validation**: 1) **Debounce Input**: Wait 300-500ms after user stops typing before checking. Prevents API spam. 2) **Loading State**: Show spinner/"Checking..." while validating. 3) **Cancel Previous**: If user types again, abort previous request using AbortController. 4) **Cache Results**: Store validated usernames in Map. Don\'t re-check "john123" if already validated. 5) **Optimistic Feedback**: Assume valid while checking. Show error only if fails. 6) **Partial Validation**: Validate format (length, characters) immediately client-side. Only check uniqueness async. 7) **Backend**: `GET /api/users/check-username?username=john123` returns `{available: true}`. Use fast index lookup. 8) **Rate Limiting**: Limit checks to 10/minute per user to prevent abuse.'
        },
        {
          question: 'Should you validate on every keystroke or only on blur?',
          answer: '**Hybrid approach is best UX**: 1) **On Blur (Recommended)**: Validate when user leaves field. Less annoying, user can finish typing. 2) **On Submit**: Always validate before submission. Last line of defense. 3) **Real-Time for Success**: Show green checkmark as user types valid input. Builds confidence. 4) **Delayed for Errors**: Wait for blur before showing errors. Don\'t scream "Too short!" after 1 character. 5) **Async = On Blur**: Expensive checks (API calls) only on blur. 6) **Critical Fields**: Validate password strength in real-time with visual indicator (weak/medium/strong). 7) **Debounced Real-Time**: For search/autocomplete, validate on keystroke but debounced 300ms. 8) **User Preference**: Some users prefer instant feedback. Consider accessibility setting.'
        },
        {
          question: 'How do you sanitize user input to prevent XSS attacks?',
          answer: '**Defense in depth against XSS**: 1) **Escape Output**: When rendering user input, use React\'s default escaping. JSX automatically escapes. NEVER use `dangerouslySetInnerHTML` for user content. 2) **Strip HTML Tags**: On input, remove `<script>`, `<iframe>`, `<object>` tags. Use library like DOMPurify. 3) **Content Security Policy**: Set CSP headers: `Content-Security-Policy: script-src \'self\'`. Blocks inline scripts. 4) **Validate Format**: Use strict regex. Email must match email pattern, can\'t contain `<script>`. 5) **Encode Special Chars**: Convert `<` to `&lt;`, `>` to `&gt;` before storing in DB. 6) **Sanitize URLs**: Check `href` attributes. Block `javascript:` URLs. Allow only `http:` and `https:`. 7) **Backend Validation**: NEVER trust client validation. Re-sanitize on server. 8) **Libraries**: Use DOMPurify for rich text, validator.js for simple fields.'
        },
        {
          question: 'What validation libraries would you consider (Zod, Yup, React Hook Form)?',
          answer: '**Library comparison for validation**: 1) **Zod** (Best): TypeScript-first, amazing DX. Define schema, get types automatically. 13KB. `z.object({email: z.string().email()})`. 2) **Yup**: Similar to Zod but older, JavaScript-first. Good for legacy projects. 11KB. 3) **React Hook Form**: Not validator, but form library with validation. Pairs well with Zod. Best performance (uncontrolled inputs). 4) **Joi**: Server-side validation. Node.js. Too heavy for browser (145KB). 5) **Valibot**: Lighter alternative to Zod. 1KB. Good for bundle size sensitive projects. 6) **Custom Validators**: For simple forms (<5 fields), custom functions are fine. 7) **Recommendation**: Use Zod + React Hook Form for complex forms. Custom validators for simple forms. 8) **Bundle Size**: Zod (13KB) + React Hook Form (25KB) = 38KB. Worth it for complex validation.'
        },
      ],
      relatedTopics: ['Forms', 'Accessibility', 'Security', 'UX'],
    },
  },
  {
    id: 'progressive-loading-1',
    question: 'Explain different loading strategies: skeleton loaders, spinners, progress bars. When would you use each?',
    category: 'performance',
    difficulty: 'easy',
    tags: ['loading', 'ux', 'perceived-performance'],
    answer: {
      overview: 'Different loading indicators communicate different types of progress. Skeleton loaders are best for content, spinners for actions, progress bars for file uploads.',
      keyPoints: [
        '✅ Skeleton loaders: Best for content (posts, profiles) - show layout structure',
        '✅ Spinners: Best for short actions (save, like) - indeterminate duration',
        '✅ Progress bars: Best for long operations (uploads) - determinate progress',
        '✅ Skeleton > Spinner - research shows skeletons reduce perceived load time by 25%',
        '✅ Use shimmer animation for skeletons (gradient sweep)',
        '✅ Match skeleton shape to actual content (post card → post skeleton)',
        '✅ Stagger appearance: Show items with 100ms delay for natural feel',
        '✅ Avoid spinners on page load - use skeletons instead',
        '✅ Show progress % for uploads: "Uploading... 45%"',
        '✅ Support prefers-reduced-motion for accessibility',
      ],
      implementation: 'We have 5 skeleton variants (post, comment, profile, list, grid) with shimmer animations.',
      codeExample: `// Skeleton Loader Component
function LoadingSkeleton({ variant = 'post', count = 1 }) {
  const skeletons = {
    post: (
      <div className="skeleton-post">
        <div className="skeleton-avatar" />
        <div className="skeleton-text-line short" />
        <div className="skeleton-text-line" />
        <div className="skeleton-text-line" />
        <div className="skeleton-image" />
      </div>
    ),
    comment: (
      <div className="skeleton-comment">
        <div className="skeleton-avatar small" />
        <div className="skeleton-text-line short" />
      </div>
    ),
    profile: (
      <div className="skeleton-profile">
        <div className="skeleton-avatar large" />
        <div className="skeleton-text-line medium" />
        <div className="skeleton-text-line short" />
      </div>
    ),
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animationDelay: \`\${i * 100}ms\` }}>
          {skeletons[variant]}
        </div>
      ))}
    </>
  );
}

// CSS for shimmer effect
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.skeleton-avatar,
.skeleton-text-line,
.skeleton-image {
  background: linear-gradient(
    90deg,
    #f0f0f0 0%,
    #e0e0e0 50%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .skeleton-avatar,
  .skeleton-text-line,
  .skeleton-image {
    animation: none;
  }
}

// Spinner for short actions
function Spinner({ size = 'md', label = 'Loading...' }) {
  return (
    <div role="status" aria-label={label}>
      <svg className={\`spinner-\${size}\`} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

// Progress bar for uploads
function ProgressBar({ progress, label }) {
  return (
    <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: \`\${progress}%\` }} />
      </div>
      <span>{label} {progress}%</span>
    </div>
  );
}

// Usage patterns
function FeedContainer() {
  const { data, isLoading } = useQuery(['posts'], fetchPosts);

  if (isLoading) {
    return <LoadingSkeleton variant="post" count={5} />;
  }

  return <PostList posts={data} />;
}

function LikeButton({ postId }) {
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    setIsLiking(true);
    await api.likePost(postId);
    setIsLiking(false);
  };

  return (
    <button onClick={handleLike}>
      {isLiking ? <Spinner size="sm" /> : 'Like'}
    </button>
  );
}

function FileUpload() {
  const [progress, setProgress] = useState(0);

  const handleUpload = (file) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      setProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.send(file);
  };

  return progress > 0 && progress < 100 ? (
    <ProgressBar progress={progress} label="Uploading image" />
  ) : null;
}`,
      followUpQuestions: [
        {
          question: 'Why are skeleton loaders better than spinners for initial page load?',
          answer: '**Skeletons improve perceived performance**: 1) **Research**: Meta (Facebook) found skeletons reduce perceived load time by 25-30% vs spinners. 2) **Context Preview**: Skeletons show layout/structure. User knows what\'s coming (post card vs comment vs profile). Spinner gives no context. 3) **Less Boring**: Moving shimmer animation is more engaging than rotating spinner. 4) **Professional Feel**: Skeletons look modern, polished. Spinners look dated. 5) **Cognitive Load**: Brain processes familiar shapes (rectangles, circles) faster than abstract spinner. 6) **No Surprise Layout Shift**: Skeleton matches actual content size. No CLS (Cumulative Layout Shift) when content loads. 7) **When to Use Spinner**: Short actions (<2s) like button clicks. Use skeleton for page loads (>2s).'
        },
        {
          question: 'How do you determine the right skeleton layout?',
          answer: '**Design skeletons to match content structure**: 1) **Analyze Actual Content**: Take screenshot of loaded state. Trace shapes (avatar circle, text lines, image rectangle). 2) **Multiple Variants**: Create skeleton per component type. PostCard has different skeleton than CommentCard. 3) **Dynamic Sizing**: Match skeleton size to expected content. Short post = 3 text lines, long post = 10 text lines. 4) **Placeholder Text**: Use varying line widths (70%, 90%, 60%) to mimic real text. All 100% looks unnatural. 5) **Maintain Spacing**: Exact padding/margins as real content to prevent layout shift. 6) **Accessibility**: Add `aria-label="Loading post"` so screen readers announce loading state. 7) **Tools**: Use Chrome DevTools to measure real content dimensions, replicate in skeleton.'
        },
        {
          question: 'What are the performance implications of shimmer animations?',
          answer: '**Optimize shimmer animations**: 1) **CSS Performance**: Shimmer uses `background-image: linear-gradient()` + `animation`. GPU-accelerated, efficient. 2) **Avoid JavaScript**: Don\'t animate with JS timers. Pure CSS is 10x more performant. 3) **Will-Change**: Use `will-change: transform` to hint browser to optimize. Creates new compositor layer. 4) **Reduce Motion**: Respect `@media (prefers-reduced-motion: reduce)`. Disable animation for accessibility. 5) **Throttle on Low-End Devices**: Detect device tier (navigator.hardwareConcurrency <4). Disable shimmer on potato phones. 6) **Measure FPS**: Use Performance API. If FPS <30 during shimmer, simplify animation. 7) **Memory**: Each skeleton is lightweight (<1KB DOM). Even 20 skeletons = <20KB overhead. Not a concern.'
        },
        {
          question: 'How do you handle loading states in a multi-step form?',
          answer: '**Progressive disclosure for multi-step forms**: 1) **Step Indicator**: Show "Step 2 of 4" with progress bar. User knows where they are. 2) **Skeleton for Next Step**: When submitting step, show skeleton of next step layout. 3) **Optimistic Navigation**: Immediately show next step, load data in background. Show spinner in specific fields if data pending. 4) **Save & Continue**: Auto-save each step. User can leave and resume. Show "Saved" checkmark. 5) **Error Handling**: If step fails, stay on current step, show error. Don\'t move to next step with broken state. 6) **Loading Button**: Submit button shows spinner: "Saving...". Don\'t disable entire form. 7) **Prefetch Next Step**: When user reaches 80% of current step, prefetch data for next step. 8) **Abandoned Form**: If user closes tab, persist to localStorage, restore on return.'
        },
      ],
      relatedTopics: ['UX', 'Perceived Performance', 'Accessibility', 'Animations'],
    },
  },

  // Add 15 more questions covering Analytics, Comments, Search, Notifications, etc.
  {
    id: 'analytics-1',
    question: 'Design an analytics dashboard for a social media app. What metrics would you track and how would you optimize performance?',
    category: 'architecture',
    difficulty: 'medium',
    tags: ['analytics', 'metrics', 'performance', 'charts'],
    answer: {
      overview: 'Analytics requires data aggregation on the backend, efficient charting libraries, and smart caching. Track engagement metrics, user behavior, and performance.',
      keyPoints: [
        '✅ Track engagement: Likes, comments, shares, views, time-on-post',
        '✅ Track user behavior: Active users, retention, session duration',
        '✅ Track performance: API response times, error rates, cache hit rates',
        '✅ Aggregate data on backend - don\'t compute metrics on frontend',
        '✅ Use Recharts for React (lightweight, responsive, accessible)',
        '✅ Code-split analytics route to reduce main bundle',
        '✅ Cache analytics data for 5 minutes (stale-while-revalidate)',
        '✅ Provide time period selector (7d, 30d, 90d)',
        '✅ Show trend indicators (↑ 12% vs last period)',
        '✅ Export data as CSV/JSON for external analysis',
      ],
      implementation: 'We use Recharts for visualization, React Query for data fetching, and Zustand for period selection.',
      codeExample: `// Analytics Dashboard
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function AnalyticsDashboard() {
  const [period, setPeriod] = useState('7d');

  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview', period],
    queryFn: () => api.getAnalyticsOverview(period),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: timeSeries } = useQuery({
    queryKey: ['analytics', 'timeseries', period],
    queryFn: () => api.getEngagementTimeSeries(period),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      {/* Period Selector */}
      <select value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
      </select>

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Likes"
          value={overview.totalLikes}
          change={overview.likesChange}
        />
        <MetricCard
          label="Total Comments"
          value={overview.totalComments}
          change={overview.commentsChange}
        />
        <MetricCard
          label="Total Shares"
          value={overview.totalShares}
          change={overview.sharesChange}
        />
        <MetricCard
          label="Avg. Engagement"
          value={overview.avgEngagement.toFixed(1)}
          change={overview.engagementChange}
        />
      </div>

      {/* Time Series Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={timeSeries}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="likes" stroke="#ef4444" />
          <Line type="monotone" dataKey="comments" stroke="#3b82f6" />
          <Line type="monotone" dataKey="shares" stroke="#10b981" />
        </LineChart>
      </ResponsiveContainer>

      {/* Top Posts Table */}
      <TopPostsTable posts={overview.topPosts} />

      {/* Export Button */}
      <button onClick={() => exportAnalytics(period)}>
        Export as CSV
      </button>
    </div>
  );
}

// Backend aggregation (Express.js)
app.get('/api/analytics/overview', async (req, res) => {
  const { period } = req.query;
  const days = parseInt(period);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Aggregate metrics
  const [likes, comments, shares, views] = await Promise.all([
    db.likes.count({ where: { createdAt: { gte: startDate } } }),
    db.comments.count({ where: { createdAt: { gte: startDate } } }),
    db.shares.count({ where: { createdAt: { gte: startDate } } }),
    db.views.count({ where: { createdAt: { gte: startDate } } }),
  ]);

  // Calculate trends
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);
  
  const prevLikes = await db.likes.count({
    where: { createdAt: { gte: prevStartDate, lt: startDate } }
  });

  const likesChange = ((likes - prevLikes) / prevLikes) * 100;

  res.json({
    totalLikes: likes,
    totalComments: comments,
    totalShares: shares,
    totalViews: views,
    likesChange: likesChange.toFixed(1),
    // ... more metrics
  });
});`,
      followUpQuestions: [
        {
          question: 'How would you handle real-time analytics updates?',
          answer: '**Real-time analytics architecture**: 1) **Event Streaming**: Use Kafka/Kinesis for real-time event ingestion. Posts, likes, comments flow through stream. 2) **Stream Processing**: Apache Flink/Spark Streaming processes events in real-time, computes aggregates (likes per minute). 3) **Time Windows**: Tumbling windows (1-minute buckets) or sliding windows (rolling 5-minute average). 4) **Materialized Views**: Pre-compute common queries (top posts today, engagement by hour). Store in fast DB (Redis). 5) **WebSocket Push**: Push updates to dashboard via WebSocket. Chart updates every 5 seconds. 6) **Batch + Real-Time**: Lambda architecture. Real-time for last 1 hour (approximate), batch for historical (accurate). 7) **Sampling**: For high-volume events (views), sample 10% for real-time, batch process 100% hourly. 8) **Cost**: Real-time is 10x more expensive than batch. Only use for dashboards that need it.'
        },
        {
          question: 'What database optimizations are needed for analytics queries?',
          answer: '**Optimize database for analytical workloads**: 1) **Separate DB**: Analytics queries are slow, resource-intensive. Use separate read replica or data warehouse (Snowflake, BigQuery). 2) **Columnar Storage**: Use Clickhouse or Redshift. Column-oriented storage is 10-100x faster for aggregations. 3) **Indexes**: Create indexes on common filter/group by columns (created_at, user_id, post_id). 4) **Partitioning**: Partition by date. Query for "last 7 days" only scans 7 partitions, not entire table. 5) **Materialized Views**: Pre-compute `daily_post_stats` table overnight. Queries read from this instead of raw events. 6) **Caching**: Cache dashboard queries for 5-10 minutes. Most users don\'t need real-time. 7) **Query Optimization**: Use EXPLAIN to find slow queries. Add missing indexes. 8) **Scheduled Jobs**: Run heavy analytics at night (3 AM) when traffic is low.'
        },
        {
          question: 'How do you prevent analytics from impacting main app performance?',
          answer: '**Isolate analytics from production**: 1) **Separate Read Replica**: Route analytics queries to read replica DB. Never touch primary DB. 2) **Rate Limiting**: Limit analytics queries to 10/minute per user. Prevent dashboard spam from overloading DB. 3) **Background Jobs**: Process analytics async in queue. Don\'t block user requests. 4) **Lazy Loading**: Load dashboard in chunks. Top metrics first, charts later. 5) **Code Splitting**: Lazy load analytics page. Don\'t include Recharts (~400KB unminified, ~90KB gzipped) in main bundle. 6) **CDN for Charts**: Pre-generate chart images server-side, serve via CDN. Faster than client-side rendering. 7) **Throttle Updates**: Update dashboard every 30s, not every second. Reduces server load. 8) **Monitoring**: Track analytics query latency. Alert if >5s. Optimize or add resources.'
        },
        {
          question: 'What privacy considerations are important for analytics?',
          answer: '**Privacy-first analytics**: 1) **GDPR Compliance**: Get user consent for analytics. Provide opt-out. Delete data on request. 2) **Anonymization**: Hash user IDs. Store `hash(userId)` instead of raw ID. Can\'t identify individual users. 3) **Aggregation Only**: Never store individual user behavior. Only aggregate metrics (total likes, average engagement). 4) **No PII**: Don\'t track emails, names, IP addresses in analytics. Only pseudonymous IDs. 5) **Retention Limits**: Delete raw events after 90 days. Keep aggregates only. 6) **Cookie Policy**: Disclose analytics cookies in banner. Comply with cookie laws. 7) **Alternative**: Use privacy-focused analytics (Plausible, Fathom) instead of Google Analytics. 8) **Data Minimization**: Only track what you need. Don\'t track everything "just in case".'
        },
      ],
      relatedTopics: ['Data Visualization', 'Performance', 'Backend Optimization', 'Privacy'],
    },
  },

  // ========================================
  // PWA & SERVICE WORKERS CATEGORY
  // ========================================
  {
    id: 'pwa-1',
    question: 'What makes an application a Progressive Web App (PWA)? How do you implement PWA functionality?',
    category: 'architecture',
    difficulty: 'hard',
    tags: ['pwa', 'service-worker', 'manifest', 'offline'],
    answer: {
      overview: 'A PWA is a web app that provides native app-like experience using service workers, web manifest, and modern APIs. It must be installable, work offline, and feel fast.',
      keyPoints: [
        '✅ Service Worker: Intercepts network requests, enables offline functionality',
        '✅ Web Manifest: JSON file defining app name, icons, display mode, theme color',
        '✅ HTTPS Required: Service workers only work over secure connections (except localhost)',
        '✅ Installable: Shows browser install prompt, adds icon to home screen/desktop',
        '✅ Offline-capable: App works without network using cached resources',
        '✅ Responsive: Works on any device size (mobile, tablet, desktop)',
        '✅ App-like: Standalone display mode removes browser UI',
        '✅ Fast: Loads quickly, smooth animations, immediate responses',
        '✅ Discoverable: Indexed by search engines like regular websites',
        '✅ Re-engageable: Push notifications, home screen presence',
      ],
      implementation: 'Our PWA includes service worker registration, manifest with proper icons, offline fallback, and install prompts.',
      codeExample: `// Service Worker Registration (main.tsx)
import { registerServiceWorker } from './utils/serviceWorkerRegistration';

registerServiceWorker().then(registration => {
  if (registration) {
    console.log('Service Worker registered');
  }
});

// Web Manifest (public/manifest.json)
{
  "name": "News Feed - Social Network",
  "short_name": "News Feed",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}

// Service Worker (public/service-worker.js)
const CACHE_VERSION = '2.0.0';
const STATIC_CACHE = \`static-v\${CACHE_VERSION}\`;
const RUNTIME_CACHE = \`runtime-v\${CACHE_VERSION}\`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for static, network-first for dynamic
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Static assets: cache-first
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }

  // API: network-first
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML: cache-first with offline fallback
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match('/offline.html'))
  );
});`,
      followUpQuestions: [
        {
          question: 'What are the different service worker caching strategies?',
          answer: '**5 main caching strategies**: 1) **Cache-First**: Check cache first, network if miss. Best for static assets (images, CSS, JS). Fast but may serve stale content. 2) **Network-First**: Try network first, cache fallback. Best for API calls. Always fresh but slower. 3) **Cache-Only**: Only serve from cache. Good for offline-first features. 4) **Network-Only**: Always fetch from network, no caching. Rare use case. 5) **Stale-While-Revalidate**: Serve cached immediately, fetch fresh in background. Best UX - fast + fresh. Use cache-first for assets >1hr old, network-first for real-time data, and SWR for feeds/content.'
        },
        {
          question: 'How do you handle service worker updates without breaking the user experience?',
          answer: '**Graceful service worker updates**: 1) **Version Control**: Increment cache version in SW file. Old caches auto-deleted on activate. 2) **Skip Waiting**: Call `self.skipWaiting()` in install to activate immediately. 3) **User Notification**: Show toast "Update available. Reload?" with action button. Don\'t force reload. 4) **Background Update**: SW updates in background. User sees update on next visit or manual reload. 5) **Registration.update()**: Call `registration.update()` periodically (every hour) to check for SW updates. 6) **Testing**: Always test SW updates in staging. Cache issues are hard to debug in production. 7) **Message Channel**: Use `postMessage` to communicate between SW and app for coordinated updates.'
        },
        {
          question: 'What are the PWA icon requirements for different platforms?',
          answer: '**PWA icon requirements vary by platform**: **Android Chrome**: Needs 192x192 and 512x512 PNG icons with \`purpose: "any"\`. Also 192x192 and 512x512 \`purpose: "maskable"\` (icon in safe zone, Android masks to circle/square/squircle). **iOS Safari**: Uses apple-touch-icon (180x180, 192x192). Add \`<link rel="apple-touch-icon" href="/icon-192.png">\`. No install prompt in Safari - users manually "Add to Home Screen". **Windows**: Uses browserconfig.xml and msapplication meta tags. **Best Practice**: Provide 4 icons: icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png. Use square images with 20% padding for maskable. Test maskable icons at maskable.app.'
        },
        {
          question: 'How do you make PWA installable on iOS which has limited service worker support?',
          answer: '**iOS PWA limitations and workarounds**: 1) **No Install Prompt**: iOS Safari doesn\'t show install banner. Users must manually tap Share → Add to Home Screen. 2) **Meta Tags Required**: Add \`<meta name="apple-mobile-web-app-capable" content="yes">\` and \`<meta name="apple-mobile-web-app-status-bar-style" content="default">\`. 3) **Splash Screen**: iOS generates splash screen from apple-touch-icon. No custom splash. 4) **Limited SW**: Service worker support is basic. No background sync, push notifications. 5) **Session Storage**: iOS may clear SW cache if not used for 7 days. 6) **Testing**: Test on real iOS device, not simulator. SW behaves differently. 7) **Graceful Degradation**: Design app to work without full SW support. Core features should work without offline mode on iOS.'
        },
      ],
      relatedTopics: ['Service Workers', 'Offline Support', 'Web Manifest', 'Installability'],
    },
  },
  {
    id: 'pwa-2',
    question: 'Explain the service worker lifecycle. What happens during install, activate, and fetch events?',
    category: 'architecture',
    difficulty: 'medium',
    tags: ['service-worker', 'lifecycle', 'events'],
    answer: {
      overview: 'Service worker lifecycle has distinct phases: installation, waiting, activation, and idle/fetch. Understanding this lifecycle is crucial for cache management and updates.',
      keyPoints: [
        '✅ Install: Triggered when SW is first registered or updated. Pre-cache critical assets here.',
        '✅ Waiting: New SW waits until old SW is no longer controlling clients',
        '✅ Activate: Old SW terminated, new SW takes control. Clean up old caches here.',
        '✅ Fetch: Intercept all network requests from the app. Implement caching strategies.',
        '✅ skipWaiting(): Force new SW to activate immediately without waiting',
        '✅ clients.claim(): Take control of all pages immediately without reload',
        '✅ Update Check: Browser checks for SW updates every 24 hours or on page load',
        '✅ Byte-diff: Even 1 byte change in SW file triggers update',
        '✅ Scope: SW only controls pages in its scope (default: same directory)',
        '✅ Message: Use postMessage for bidirectional communication with app',
      ],
      implementation: 'Our service worker uses skipWaiting() to activate immediately and clients.claim() to control all pages.',
      codeExample: `// Service Worker Lifecycle Events

// 1. INSTALL - Runs once when SW is first installed
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    // Pre-cache critical assets
    caches.open('static-v1')
      .then(cache => {
        return cache.addAll([
          '/',
          '/index.html',
          '/offline.html',
          '/manifest.json',
        ]);
      })
      .then(() => {
        console.log('[SW] Install complete');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// 2. ACTIVATE - Runs after install (or after old SW terminated)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== 'static-v1' && name !== 'runtime-v1')
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activate complete');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// 3. FETCH - Runs on every network request
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Cache hit:', event.request.url);
          return cachedResponse;
        }

        console.log('[SW] Cache miss, fetching:', event.request.url);
        return fetch(event.request).then(response => {
          // Cache the fetched response
          if (response.ok) {
            const responseClone = response.clone();
            caches.open('runtime-v1').then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(error => {
        console.error('[SW] Fetch failed:', error);
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        throw error;
      })
  );
});

// 4. MESSAGE - Communication with app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => 
        Promise.all(names.map(name => caches.delete(name)))
      )
    );
  }
});

// From app: trigger SW message
navigator.serviceWorker.getRegistration().then(reg => {
  if (reg?.waiting) {
    // Tell new SW to skip waiting
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
});`,
      followUpQuestions: [
        {
          question: 'What is the difference between skipWaiting() and clients.claim()?',
          answer: '**skipWaiting()** and **clients.claim()** serve different purposes: **skipWaiting()**: Called in `install` event. Forces new SW to move from "waiting" to "activating" state immediately, terminating old SW. Without it, new SW waits until all tabs with old SW are closed. **clients.claim()**: Called in `activate` event. Makes new SW take control of all open pages/tabs immediately without reload. Without it, pages with old SW continue using old SW until reload. **Use Both**: \`self.skipWaiting()\` in install + \`self.clients.claim()\` in activate = new SW activates and controls all pages immediately. **Warning**: This can cause issues if old and new SW have incompatible cache structures. Test thoroughly.'
        },
        {
          question: 'How does browser determine when to check for service worker updates?',
          answer: '**SW update triggers**: 1) **24 Hour Check**: Browser automatically checks for SW updates every 24 hours for active users. 2) **Page Load**: Check on every navigation (visiting site). Only byte-diff matters - even whitespace change triggers update. 3) **Manual Update**: \`registration.update()\` forces immediate check. Call this hourly in production. 4) **Hard Reload**: Ctrl+Shift+R bypasses SW and checks for updates. 5) **Force Update**: Add \`updateViaCache: "none"\` in registration to disable HTTP cache for SW file. 6) **Import Changes**: If SW imports another file that changes, it counts as SW update. **Best Practice**: Set SW cache-control header: \`Cache-Control: max-age=0\` to ensure fresh checks. Version your SW: \`const VERSION = "2.0.0"\` and increment on each deploy.'
        },
        {
          question: 'What happens if service worker installation fails?',
          answer: '**SW installation failure handling**: 1) **No SW Active**: If first install fails, app runs without SW (no offline mode). 2) **Old SW Continues**: If update fails, old SW remains active. Users keep using old version. 3) **Retry**: Browser auto-retries install on next page load. 4) **Error Types**: **Network error** (can\'t fetch SW file) - check HTTPS, CORS. **Parse error** (syntax error in SW) - check console. **Install event rejection** (cache.addAll fails) - check asset URLs, network. 5) **Debugging**: Open DevTools → Application → Service Workers. See "waiting to activate" or error details. 6) **Recovery**: Fix SW code, deploy, users will get update on next visit. 7) **Monitor**: Track SW registration success rate in analytics. Alert if <95%.'
        },
        {
          question: 'Can service workers access localStorage or sessionStorage?',
          answer: '**No, service workers cannot access localStorage/sessionStorage**. SW runs in separate thread (worker context) with limited APIs. **Why**: localStorage is synchronous, would block SW thread. SW needs to be non-blocking. **Alternatives**: 1) **IndexedDB**: Async key-value store accessible from SW. Best for persistent data. 2) **Cache API**: Store responses in SW cache. Use for HTTP responses. 3) **postMessage**: Send data between SW and main thread. Main thread reads localStorage, sends to SW. 4) **State Management**: Store app state in IndexedDB, accessible from both app and SW. **Available in SW**: fetch, caches, IndexedDB, postMessage, crypto, setTimeout, console. **Not Available**: DOM APIs, localStorage, sessionStorage, cookies, window object.'
        },
      ],
      relatedTopics: ['PWA', 'Caching', 'Offline Support', 'Update Strategies'],
    },
  },
  {
    id: 'pwa-3',
    question: 'How would you implement offline form submissions that sync when the user comes back online?',
    category: 'resilience',
    difficulty: 'hard',
    tags: ['offline', 'forms', 'sync', 'background-sync'],
    answer: {
      overview: 'Offline form submissions require a queue in IndexedDB, optimistic UI updates, and background sync when connection returns. Handle validation, conflict resolution, and user feedback.',
      keyPoints: [
        '✅ Store form submission in IndexedDB queue with status (pending/syncing/failed/completed)',
        '✅ Show optimistic UI immediately (form submitted, data appears)',
        '✅ Listen to online/offline events (navigator.onLine, "online" event)',
        '✅ Auto-sync queue when connection restored (with exponential backoff)',
        '✅ Use Background Sync API for reliable sync even after tab closed',
        '✅ Handle validation errors gracefully (show form with errors when online)',
        '✅ Implement conflict resolution (server-wins, client-wins, merge)',
        '✅ Provide clear feedback ("Saved locally", "Syncing...", "Synced")',
        '✅ Allow manual retry for failed submissions',
        '✅ Set timeouts (expire submissions after 7 days)',
      ],
      implementation: 'We use IndexedDB offline queue with auto-sync on reconnection. Background Sync API handles sync even when tab is closed.',
      codeExample: `// Offline Form Submission Handler

// 1. Store submission in IndexedDB
async function submitFormOffline(formData) {
  const submission = {
    id: generateId(),
    type: 'CREATE_POST',
    data: formData,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  // Save to IndexedDB queue
  await db.offlineQueue.add(submission);
  
  // Show optimistic UI
  showToast('Post saved. Will sync when online.', 'info');
  
  // Register background sync (if supported)
  if ('serviceWorker' in navigator && 'sync' in registration) {
    try {
      await registration.sync.register('sync-offline-queue');
      console.log('Background sync registered');
    } catch (error) {
      console.log('Background sync failed:', error);
      // Fallback to manual sync
      attemptSync();
    }
  } else {
    // Fallback: Listen for online event
    window.addEventListener('online', attemptSync);
  }
}

// 2. Background Sync (in service worker)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Get all pending submissions from IndexedDB
  const queue = await getAllPendingSubmissions();
  
  for (const submission of queue) {
    try {
      // Mark as syncing
      await updateSubmissionStatus(submission.id, 'syncing');
      
      // Send to server
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission.data),
      });

      if (response.ok) {
        // Success: mark as completed and delete from queue
        await deleteSubmission(submission.id);
        
        // Notify user
        await showNotification('Post published!', {
          body: 'Your post was successfully synced.',
          icon: '/icon-192.png',
        });
      } else {
        // Server error: increment retry count
        submission.retryCount++;
        if (submission.retryCount > 3) {
          await updateSubmissionStatus(submission.id, 'failed');
        } else {
          await updateSubmissionStatus(submission.id, 'pending');
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
      submission.retryCount++;
      await updateSubmissionStatus(submission.id, 'pending');
    }
  }
}

// 3. Manual sync (fallback)
window.addEventListener('online', async () => {
  console.log('Back online, syncing...');
  showToast('Syncing your changes...', 'info');
  
  try {
    await syncOfflineQueue();
    showToast('All changes synced!', 'success');
  } catch (error) {
    console.error('Sync error:', error);
    showToast('Sync failed. Will retry later.', 'error');
  }
});

// 4. UI for pending submissions
function PendingSubmissionsUI() {
  const [pending, setPending] = useState([]);

  useEffect(() => {
    // Load pending submissions
    db.offlineQueue.toArray().then(setPending);
  }, []);

  return (
    <div>
      {pending.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-sm text-yellow-700">
            You have {pending.length} pending {pending.length === 1 ? 'action' : 'actions'}.
            {navigator.onLine ? ' Syncing...' : ' Will sync when online.'}
          </p>
          {!navigator.onLine && (
            <button onClick={attemptSync} className="text-yellow-700 underline text-sm">
              Retry now
            </button>
          )}
        </div>
      )}
    </div>
  );
}`,
      followUpQuestions: [
        {
          question: 'What is the Background Sync API and when should you use it?',
          answer: '**Background Sync API** allows service worker to sync data even after user closes tab/browser. **How it works**: 1) Register sync tag: \`await registration.sync.register("sync-posts")\`. 2) Browser queues sync event. 3) When online, browser fires \`sync\` event in service worker. 4) SW processes queue, browser retries if it fails. **Benefits**: Reliable sync even if user leaves site. No need for "online" event listeners. Browser handles retries automatically. **Limitations**: Chrome/Edge only (no Firefox, Safari). Max 3 auto-retries. Requires SW scope. **When to use**: Critical data (form submissions, messages, purchases). Not for real-time (use SSE/WebSockets). **Fallback**: Always implement fallback with online event listeners for unsupported browsers.'
        },
        {
          question: 'How do you handle form validation for offline submissions?',
          answer: '**Two-stage validation**: **Client-side (Offline)**: 1) Validate format, length, required fields locally using Zod/Yup. 2) Show errors immediately without network. 3) If valid, add to queue with status "pending". **Server-side (Online)**: 1) When syncing, server validates again (business rules, uniqueness, auth). 2) If validation fails, mark submission as "failed" with error details. 3) Show error toast with action to "Edit and Retry". 4) Load form with saved data and server errors. **User Flow**: User submits offline → passes client validation → queued → comes online → server rejects (duplicate title) → toast shows "Post title already exists. Edit?" → user edits → resubmits. **Important**: Always validate on server. Never trust client-side only. Client validation is UX optimization, not security.'
        },
        {
          question: 'What if the user makes multiple edits to the same item while offline?',
          answer: '**Merge or replace strategy**: **Option 1 - Last Write Wins**: Store only latest version in queue. Each edit replaces previous. Simple but loses history. **Option 2 - Operation Log**: Store all operations (\`[{op: "update", field: "title", value: "New"}]\`). Replay operations in order when syncing. Complex but preserves intent. **Option 3 - Conflict Detection**: Store version number with each item. On sync, check if server version changed. If conflict, show merge UI. **Example**: User edits post title offline → edits again → edits body → comes online → sync sends all 3 operations in order. **Best Practice**: For simple updates (posts, comments), use last-write-wins. For collaborative documents, use operation log (Operational Transformation). Include \`lastModified\` timestamp for conflict detection.'
        },
        {
          question: 'How long should you keep failed submissions in the queue?',
          answer: '**Queue retention policy**: **Time-based**: Delete after 7-30 days. Old submissions likely no longer relevant. **Retry-based**: Delete after 3-5 failed retry attempts. Permanent failures won\'t resolve. **Storage-based**: Delete oldest when IndexedDB >80% full (usually 50MB limit). **User choice**: Provide "Failed Submissions" UI where user can: 1) Retry manually, 2) Edit and resubmit, 3) Delete permanently. **Example Policy**: Pending submissions: Keep for 30 days or until synced. Failed submissions: Keep for 7 days, show in UI for manual action. Completed: Delete immediately after sync. **Storage**: Track queue size. If >1000 items or >10MB, prompt user: "You have 1000 pending actions. Sync now or clear old ones?" Alert when quota is low.'
        },
      ],
      relatedTopics: ['Offline Queue', 'Background Sync', 'IndexedDB', 'Form Handling'],
    },
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function InterviewPrep() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [reviewedQuestions, setReviewedQuestions] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('reviewedQuestions') || '[]'))
  );

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return INTERVIEW_QUESTIONS.filter(q => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          q.question.toLowerCase().includes(query) ||
          q.answer.overview.toLowerCase().includes(query) ||
          q.tags.some(tag => tag.includes(query))
        );
      }
      
      return true;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const toggleQuestion = (id: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleReviewed = (id: string) => {
    setReviewedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem('reviewedQuestions', JSON.stringify([...next]));
      return next;
    });
  };

  const progress = (reviewedQuestions.size / INTERVIEW_QUESTIONS.length) * 100;

  /* Commented out for future use
  const _exportToMarkdown = () => {
    let markdown = '# System Design Interview Preparation\\n\\n';
    markdown += 'Generated from NewsFeed POC project\\n\\n';
    markdown += `Total Questions: ${INTERVIEW_QUESTIONS.length}\\n`;
    markdown += `Reviewed: ${reviewedQuestions.size}\\n\\n`;
    markdown += '---\\n\\n';

    filteredQuestions.forEach(q => {
      markdown += `## ${q.question}\\n\\n`;
      markdown += `**Category:** ${q.category} | **Difficulty:** ${q.difficulty}\\n\\n`;
      markdown += `**Tags:** ${q.tags.join(', ')}\\n\\n`;
      markdown += `### Answer\\n\\n${q.answer.overview}\\n\\n`;
      markdown += `### Key Points\\n\\n`;
      q.answer.keyPoints.forEach(point => {
        markdown += `${point}\\n`;
      });
      if (q.answer.codeExample) {
        markdown += `\\n### Code Example\\n\\n\`\`\`typescript\\n${q.answer.codeExample}\\n\`\`\`\\n\\n`;
      }
      if (q.answer.followUpQuestions) {
        markdown += `### Follow-up Questions\\n\\n`;
        q.answer.followUpQuestions.forEach(fq => {
          markdown += `- ${fq}\\n`;
        });
      }
      markdown += '\\n---\\n\\n';
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'system-design-interview-prep.md';
    a.click();
    URL.revokeObjectURL(url);
  };
  */

  /* Commented out for future use
  const _exportToJSON = () => {
    const data = {
      title: 'System Design Interview Preparation',
      totalQuestions: INTERVIEW_QUESTIONS.length,
      reviewed: reviewedQuestions.size,
      progress: `${progress.toFixed(1)}%`,
      questions: filteredQuestions.map(q => ({
        ...q,
        reviewed: reviewedQuestions.has(q.id),
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'system-design-interview-prep.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  */

  /* Commented out for future use
  const _resetProgress = () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      setReviewedQuestions(new Set());
      localStorage.removeItem('reviewedQuestions');
    }
  };
  */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            System Design Interview Prep
          </h1>
          <p className="text-gray-600">
            Master system design with {INTERVIEW_QUESTIONS.length}+ real interview questions from this project
          </p>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Your Progress</span>
              <span className="text-sm font-semibold text-gray-900">
                {reviewedQuestions.size}/{INTERVIEW_QUESTIONS.length} reviewed ({progress.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 rounded-full h-2 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-2xl px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Category Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
              {[
                { value: 'all', label: 'All' },
                { value: 'resilience', label: 'Resilience' },
                { value: 'performance', label: 'Performance' },
                { value: 'data-management', label: 'Data' },
                { value: 'patterns', label: 'Patterns' },
                { value: 'architecture', label: 'Architecture' },
                { value: 'accessibility', label: 'A11y' },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value as any)}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px ${
                    selectedCategory === cat.value
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Difficulty:</span>
              {['all', 'easy', 'medium', 'hard'].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    selectedDifficulty === diff
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {diff === 'all' ? 'All' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-4 mt-4">
            {/* Expand/Collapse */}
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setExpandedQuestions(new Set(filteredQuestions.map(q => q.id)))}
                className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:underline"
              >
                Expand All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setExpandedQuestions(new Set())}
                className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:underline"
              >
                Collapse All
              </button>
            </div>

            {/* Export & Reset */}
            <div className="flex gap-2">
              {/* <button
                onClick={exportToMarkdown}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title="Export as Markdown file"
              >
                📄 MD
              </button>
              <button
                onClick={exportToJSON}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="Export as JSON file"
              >
                💾 JSON
              </button>
              <button
                onClick={resetProgress}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="Reset all progress"
              >
                🔄 Reset
              </button> */}
            </div>
          </div>

          {/* Results count */}
          <div className="mt-3 text-sm text-gray-500">
            {filteredQuestions.length} {filteredQuestions.length === 1 ? 'question' : 'questions'} found
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No questions found matching your search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map(question => (
              <QuestionCard
                key={question.id}
                question={question}
                isExpanded={expandedQuestions.has(question.id)}
                isReviewed={reviewedQuestions.has(question.id)}
                onToggle={() => toggleQuestion(question.id)}
                onToggleReviewed={() => toggleReviewed(question.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// QUESTION CARD COMPONENT
// ============================================================================

interface QuestionCardProps {
  question: InterviewQuestion;
  isExpanded: boolean;
  isReviewed: boolean;
  onToggle: () => void;
  onToggleReviewed: () => void;
}

function QuestionCard({ question, isExpanded, isReviewed, onToggle, onToggleReviewed }: QuestionCardProps) {
  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
  };

  const categoryColors = {
    resilience: 'bg-purple-100 text-purple-800',
    performance: 'bg-blue-100 text-blue-800',
    'data-management': 'bg-cyan-100 text-cyan-800',
    patterns: 'bg-orange-100 text-orange-800',
    architecture: 'bg-pink-100 text-pink-800',
    accessibility: 'bg-green-100 text-green-800',
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-xl font-bold text-gray-900">
              {question.question}
            </h3>
          </div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[question.difficulty]}`}>
              {question.difficulty.toUpperCase()}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColors[question.category]}`}>
              {question.category.replace('-', ' ').toUpperCase()}
            </span>
            {isReviewed && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                ✓ REVIEWED
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {question.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="ml-4 text-gray-400">
          {isExpanded ? (
            <svg
              className="w-6 h-6 transform rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200">
          {/* Overview */}
          <div className="mt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Overview:</h4>
            <p className="text-gray-700 leading-relaxed">{question.answer.overview}</p>
          </div>

          {/* Key Points */}
          <div className="mt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">Key Points:</h4>
            <ul className="space-y-2">
              {question.answer.keyPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-gray-700 leading-relaxed">{point}</li>
              ))}
            </ul>
          </div>

          {/* Implementation */}
          {question.answer.implementation && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Implementation:</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{question.answer.implementation}</p>
            </div>
          )}

          {/* Code Example */}
          {question.answer.codeExample && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Code Example:</h4>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{question.answer.codeExample}</code>
              </pre>
            </div>
          )}

          {/* Follow-up Questions */}
          {question.answer.followUpQuestions && question.answer.followUpQuestions.length > 0 && (
            <div className="mt-6 pt-6 border-t-2 border-gray-200">
              <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">💡</span>
                Follow-up Questions
              </h4>
              <div className="space-y-5">
                {question.answer.followUpQuestions.map((fq, idx) => (
                  <div 
                    key={idx} 
                    className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-5 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                        Q{idx + 1}
                      </span>
                      <p className="font-semibold text-gray-900 text-sm leading-relaxed pt-0.5">
                        {fq.question}
                      </p>
                    </div>
                    <div className="ml-10 space-y-1">
                      {(() => {
                        // Simple markdown parser for answers
                        const renderText = (text: string) => {
                          const parts: (string | React.ReactNode)[] = [];
                          let lastIndex = 0;
                          
                          // Match **bold**, `code`, or numbers with closing paren
                          const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
                          let match;
                          
                          while ((match = regex.exec(text)) !== null) {
                            // Add text before match
                            if (match.index > lastIndex) {
                              parts.push(text.slice(lastIndex, match.index));
                            }
                            
                            const matched = match[0];
                            if (matched.startsWith('**') && matched.endsWith('**')) {
                              // Bold text
                              parts.push(
                                <strong key={match.index} className="text-gray-900 font-semibold">
                                  {matched.slice(2, -2)}
                                </strong>
                              );
                            } else if (matched.startsWith('`') && matched.endsWith('`')) {
                              // Inline code
                              parts.push(
                                <code key={match.index} className="bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded text-xs font-mono mx-0.5">
                                  {matched.slice(1, -1)}
                                </code>
                              );
                            }
                            
                            lastIndex = regex.lastIndex;
                          }
                          
                          // Add remaining text
                          if (lastIndex < text.length) {
                            parts.push(text.slice(lastIndex));
                          }
                          
                          return parts;
                        };
                        
                        // Split by numbered items
                        const items = fq.answer.split(/(?=\d+\))/);
                        
                        return items.map((item, idx) => {
                          const match = item.match(/^(\d+\))\s*(.+)/s);
                          if (match) {
                            const [, number, content] = match;
                            return (
                              <div key={idx} className="flex gap-2 text-sm leading-relaxed py-1">
                                <span className="font-bold text-blue-600 flex-shrink-0">{number}</span>
                                <span className="text-gray-700">{renderText(content.trim())}</span>
                              </div>
                            );
                          }
                          // Text before first number
                          return item.trim() ? (
                            <div key={idx} className="text-sm text-gray-700 leading-relaxed mb-2">
                              {renderText(item.trim())}
                            </div>
                          ) : null;
                        });
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Topics */}
          {question.answer.relatedTopics && question.answer.relatedTopics.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Related Topics:</h4>
              <div className="flex gap-2 flex-wrap">
                {question.answer.relatedTopics.map(topic => (
                  <span key={topic} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={onToggleReviewed}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isReviewed
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isReviewed ? '✓ Reviewed' : 'Mark as Reviewed'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
