# System Design in Action: Building a Production-Ready News Feed

## Part 5: Resilience and Error Handling

> **Building fault-tolerant systems: Error classification, retry logic, circuit breakers**

---

## Table of Contents (Part 5)

18. [Error Classification System](#error-classification)
19. [Retry Logic with Exponential Backoff](#retry-logic)
20. [Circuit Breaker Pattern](#circuit-breaker)
21. [Graceful Degradation](#graceful-degradation)

---

## Error Classification System {#error-classification}

### The Problem

**Naive error handling:**
```typescript
// ❌ BAD: All errors treated the same
try {
  await api.post('/api/posts', data);
} catch (error) {
  toast.error('Something went wrong');
  // Should we retry? User doesn't know!
}
```

**Problems:**
- No differentiation between error types
- User sees generic message
- No automatic recovery
- Retrying non-retryable errors wastes resources

### Error Types

**File:** [src/utils/errorHandling.ts](src/utils/errorHandling.ts) (762 lines)

```typescript
export const ErrorType = {
  NETWORK: 'NETWORK',              // No internet connection
  TIMEOUT: 'TIMEOUT',              // Request took too long
  SERVER: 'SERVER',                // 5xx server errors
  VALIDATION: 'VALIDATION',        // 400 Bad Request
  AUTHENTICATION: 'AUTHENTICATION', // 401 Unauthorized
  AUTHORIZATION: 'AUTHORIZATION',   // 403 Forbidden
  NOT_FOUND: 'NOT_FOUND',          // 404 Not Found
  RATE_LIMIT: 'RATE_LIMIT',        // 429 Too Many Requests
  UNKNOWN: 'UNKNOWN',              // Unclassified
} as const;

export const ErrorSeverity = {
  LOW: 'LOW',           // Informational, no user action needed
  MEDIUM: 'MEDIUM',     // User should be aware
  HIGH: 'HIGH',         // User action may be needed
  CRITICAL: 'CRITICAL', // System failure, immediate action
} as const;

export interface AppError {
  type: keyof typeof ErrorType;
  severity: keyof typeof ErrorSeverity;
  message: string;          // Technical message
  userMessage: string;      // User-friendly message
  statusCode?: number;      // HTTP status code
  originalError?: Error;    // Original error object
  timestamp: string;        // When error occurred
  retryable: boolean;       // Can be retried?
  metadata?: Record<string, any>; // Additional context
}
```

### Classification Logic

```typescript
export function classifyError(error: unknown): AppError {
  const timestamp = new Date().toISOString();

  // ══════════════════════════════════════════════════════
  // Network Errors (no response from server)
  // ══════════════════════════════════════════════════════
  if (isNetworkError(error)) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.HIGH,
      message: 'Network connection failed',
      userMessage: 'No internet connection. Please check your network and try again.',
      retryable: true,
      timestamp,
      originalError: error as Error,
    };
  }

  // ══════════════════════════════════════════════════════
  // Timeout Errors
  // ══════════════════════════════════════════════════════
  if (isTimeoutError(error)) {
    return {
      type: ErrorType.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      message: 'Request timeout',
      userMessage: 'Request took too long. Please try again.',
      retryable: true,
      timestamp,
      originalError: error as Error,
    };
  }

  // ══════════════════════════════════════════════════════
  // HTTP Errors (response received from server)
  // ══════════════════════════════════════════════════════
  if (isAxiosError(error)) {
    const statusCode = error.response?.status;
    const responseData = error.response?.data;

    switch (statusCode) {
      case 400:
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          message: 'Validation error',
          userMessage: responseData?.message || 'Invalid input. Please check your data.',
          statusCode,
          retryable: false,
          timestamp,
          metadata: responseData?.errors,
        };

      case 401:
        return {
          type: ErrorType.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
          message: 'Authentication failed',
          userMessage: 'Session expired. Please log in again.',
          statusCode,
          retryable: false,
          timestamp,
        };

      case 403:
        return {
          type: ErrorType.AUTHORIZATION,
          severity: ErrorSeverity.HIGH,
          message: 'Authorization failed',
          userMessage: 'You don\'t have permission to perform this action.',
          statusCode,
          retryable: false,
          timestamp,
        };

      case 404:
        return {
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.LOW,
          message: 'Resource not found',
          userMessage: 'The requested item could not be found.',
          statusCode,
          retryable: false,
          timestamp,
        };

      case 429:
        return {
          type: ErrorType.RATE_LIMIT,
          severity: ErrorSeverity.MEDIUM,
          message: 'Rate limit exceeded',
          userMessage: 'Too many requests. Please wait a moment and try again.',
          statusCode,
          retryable: true,
          timestamp,
          metadata: {
            retryAfter: error.response?.headers['retry-after'],
          },
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ErrorType.SERVER,
          severity: ErrorSeverity.CRITICAL,
          message: `Server error (${statusCode})`,
          userMessage: 'Server is having issues. We\'re working on it. Please try again later.',
          statusCode,
          retryable: true,
          timestamp,
        };

      default:
        return {
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          message: `HTTP error ${statusCode}`,
          userMessage: 'Something went wrong. Please try again.',
          statusCode,
          retryable: true,
          timestamp,
        };
    }
  }

  // ══════════════════════════════════════════════════════
  // Unknown Errors
  // ══════════════════════════════════════════════════════
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    message: error instanceof Error ? error.message : 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    timestamp,
    originalError: error as Error,
  };
}

// Helper functions
function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error as any)?.message?.includes('fetch') ||
    (error as any)?.message?.includes('network')
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    (error as any)?.code === 'ECONNABORTED' ||
    (error as any)?.name === 'AbortError'
  );
}

function isAxiosError(error: unknown): error is AxiosError {
  return (error as any)?.isAxiosError === true;
}
```

### Usage in Application

```typescript
// In API service
try {
  const response = await apiClient.post('/api/posts', data);
  return response.data;
} catch (error) {
  const appError = classifyError(error);

  // Log for debugging
  console.error('[API Error]', {
    type: appError.type,
    message: appError.message,
    statusCode: appError.statusCode,
  });

  // Show user-friendly message
  toast.error(appError.userMessage, {
    severity: appError.severity,
  });

  // Retry if retryable
  if (appError.retryable) {
    return retryWithBackoff(() => apiClient.post('/api/posts', data));
  }

  throw appError;
}
```

---

## Retry Logic with Exponential Backoff {#retry-logic}

### Why Exponential Backoff?

**Naive retry (constant delay):**
```
Attempt 1: Fail → Wait 1s
Attempt 2: Fail → Wait 1s
Attempt 3: Fail → Wait 1s

Problem: Hammers server with requests
If server is recovering, constant load prevents recovery
```

**Exponential backoff:**
```
Attempt 1: Fail → Wait 1s
Attempt 2: Fail → Wait 2s
Attempt 3: Fail → Wait 4s
Attempt 4: Fail → Wait 8s

Benefit: Gives server time to recover
Reduces load as failures continue
```

### Configuration

```typescript
export const RETRY_CONFIG = {
  maxAttempts: 3,           // Try maximum 3 times
  baseDelay: 1000,          // Start with 1 second
  maxDelay: 30000,          // Cap at 30 seconds
  backoffFactor: 2,         // Double each time
  jitter: true,             // Add randomness
} as const;
```

### Implementation

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<typeof RETRY_CONFIG> = {}
): Promise<T> {
  const finalConfig = { ...RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      // Try the operation
      const result = await fn();
      return result; // Success!
    } catch (error) {
      lastError = error as Error;

      // Classify error
      const appError = classifyError(error);

      // Don't retry if not retryable
      if (!appError.retryable) {
        throw appError;
      }

      // Last attempt: throw error
      if (attempt === finalConfig.maxAttempts) {
        throw appError;
      }

      // Calculate delay for next attempt
      const delay = calculateBackoff(attempt, finalConfig);

      console.log(`[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`);

      // Wait before next attempt
      await sleep(delay);
    }
  }

  throw lastError!;
}

export function calculateBackoff(
  attempt: number,
  config: typeof RETRY_CONFIG
): number {
  // Exponential: baseDelay * (backoffFactor ^ (attempt - 1))
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Add jitter to prevent thundering herd
  if (config.jitter) {
    const jitterAmount = cappedDelay * 0.25; // ±25%
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
    return Math.max(0, cappedDelay + jitter);
  }

  return cappedDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Delay Calculation Examples

```typescript
// Example: 5 attempts, base 1000ms, factor 2, max 30s

Attempt 1:
  Exponential = 1000 * 2^0 = 1000ms
  Capped = min(1000, 30000) = 1000ms
  With jitter = 1000 ± 250ms = 750-1250ms

Attempt 2:
  Exponential = 1000 * 2^1 = 2000ms
  Capped = min(2000, 30000) = 2000ms
  With jitter = 2000 ± 500ms = 1500-2500ms

Attempt 3:
  Exponential = 1000 * 2^2 = 4000ms
  Capped = min(4000, 30000) = 4000ms
  With jitter = 4000 ± 1000ms = 3000-5000ms

Attempt 4:
  Exponential = 1000 * 2^3 = 8000ms
  Capped = min(8000, 30000) = 8000ms
  With jitter = 8000 ± 2000ms = 6000-10000ms

Attempt 5:
  Exponential = 1000 * 2^4 = 16000ms
  Capped = min(16000, 30000) = 16000ms
  With jitter = 16000 ± 4000ms = 12000-20000ms
```

### Jitter Benefits

**Without jitter (thundering herd):**
```
100 users all hit same error at same time
All retry after exactly 1 second
All hit server simultaneously again
Server still overwhelmed
```

**With jitter:**
```
100 users all hit same error
User 1 retries after 872ms
User 2 retries after 1143ms
User 3 retries after 991ms
...
Load spread out over 750-1250ms window
Server has better chance to recover
```

---

## Circuit Breaker Pattern {#circuit-breaker}

### The Problem

**Without circuit breaker:**
```
Server is completely down
Every request takes 30s to timeout
100 requests/second = 100 * 30s waiting
Users experience 30s delays repeatedly
Server can't recover under load
```

**With circuit breaker:**
```
Detect server is down after 5 failures
Open circuit → Fail fast (no requests sent)
Users get instant error instead of 30s wait
Server has time to recover
After 60s, try one request (half-open)
If succeeds, close circuit (normal operation)
```

### States

```
┌─────────────────┐
│     CLOSED      │  Normal operation
│   All requests  │  Count failures
│     go through  │
└─────────────────┘
        ↓
  5 failures OR
  50% error rate
        ↓
┌─────────────────┐
│      OPEN       │  Block all requests
│   Fail fast     │  Wait timeout (60s)
│   immediately   │
└─────────────────┘
        ↓
  After 60 seconds
        ↓
┌─────────────────┐
│   HALF-OPEN     │  Allow 1 test request
│  Test if fixed  │
└─────────────────┘
        ↓           ↓
  Success (2x)   Failure
        ↓           ↓
     CLOSED      OPEN
```

### Implementation

```typescript
export interface CircuitBreakerConfig {
  failureThreshold: number;          // Open after N failures
  successThreshold: number;          // Close after N successes (half-open)
  timeout: number;                   // Time before trying half-open
  volumeThreshold: number;           // Minimum requests before opening
  errorThresholdPercentage: number;  // Open if error rate exceeds %
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,               // 1 minute
  volumeThreshold: 10,
  errorThresholdPercentage: 50,
};

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private nextAttemptTime = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker [${this.name}] is OPEN. Try again in ${
            Math.ceil((this.nextAttemptTime - Date.now()) / 1000)
          }s`
        );
      }
      // Timeout elapsed: Try half-open
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    this.requestCount++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;

    if (this.state === 'HALF_OPEN') {
      this.open(); // Immediately open if failure in half-open
      return;
    }

    if (this.state === 'CLOSED') {
      // Check if should open
      const errorRate = (this.failureCount / this.requestCount) * 100;

      if (
        this.requestCount >= this.config.volumeThreshold &&
        (this.failureCount >= this.config.failureThreshold ||
          errorRate >= this.config.errorThresholdPercentage)
      ) {
        this.open();
      }
    }
  }

  private open(): void {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.timeout;
    console.warn(`[Circuit Breaker] ${this.name} OPENED`);
  }

  private close(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.requestCount = 0;
    console.log(`[Circuit Breaker] ${this.name} CLOSED`);
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
    };
  }
}

// Global circuit breakers (one per endpoint)
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(endpoint: string): CircuitBreaker {
  if (!circuitBreakers.has(endpoint)) {
    circuitBreakers.set(endpoint, new CircuitBreaker(endpoint));
  }
  return circuitBreakers.get(endpoint)!;
}
```

### Usage

```typescript
// Wrap API calls with circuit breaker
export async function likePost(postId: string): Promise<void> {
  const breaker = getCircuitBreaker('POST /api/posts/:id/like');

  try {
    await breaker.execute(async () => {
      return await apiClient.post(`/api/posts/${postId}/like`);
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      toast.warning('Service temporarily unavailable. Please try again later.');
      throw error;
    }
    throw error;
  }
}
```

---

## Graceful Degradation {#graceful-degradation}

### Core Principle

**Fail gracefully, not completely.**

```
❌ Bad: Analytics fails → Entire page crashes
✅ Good: Analytics fails → Show feed without analytics
```

### Strategies

**1. Optional Features:**
```typescript
function FeedContainer() {
  const { posts, isLoading: postsLoading } = useFeedPosts();

  // Analytics is optional (onError doesn't throw)
  const { data: analytics } = useAnalytics({
    onError: (error) => {
      console.warn('Analytics unavailable:', error);
      // Continue without analytics
    },
  });

  if (postsLoading) return <Skeleton />;

  return (
    <div>
      {/* Show analytics if available */}
      {analytics && <AnalyticsBar data={analytics} />}

      {/* Core feature: Always show */}
      <PostList posts={posts} />
    </div>
  );
}
```

**2. Fallback Content:**
```typescript
function PostImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);

  if (error) {
    // Image failed → Show placeholder
    return (
      <div className="image-placeholder">
        <ImageIcon />
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
    />
  );
}
```

**3. Cached Data:**
```typescript
function useFeedWithFallback() {
  const { data, error } = useFeedPosts();

  // If network fails, try IndexedDB cache
  const { data: cachedData } = useQuery({
    queryKey: ['feed', 'cached'],
    queryFn: getCachedPosts,
    enabled: !!error, // Only run if network fails
  });

  return {
    posts: data || cachedData || [],
    isStale: !!cachedData && !data,
  };
}
```

**4. Reduced Functionality:**
```typescript
function PostActions({ post }: { post: Post }) {
  const { isOnline } = useNetworkStatus();

  return (
    <div>
      {/* Core actions always available */}
      <LikeButton post={post} />
      <CommentButton post={post} />

      {/* Advanced actions only when online */}
      {isOnline ? (
        <>
          <ShareButton post={post} />
          <BookmarkButton post={post} />
        </>
      ) : (
        <OfflineBadge />
      )}
    </div>
  );
}
```

---

**End of Part 5**

**Next:** Part 6 - Offline Architecture (Service Worker lifecycle, Offline queue, Background sync)

