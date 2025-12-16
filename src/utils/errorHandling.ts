/**
 * Error Handling Utilities
 * Comprehensive error classification, retry logic, and user-friendly messages
 */

import { AxiosError } from 'axios';

// ============================================================================
// Error Types & Interfaces
// ============================================================================

export const ErrorType = {
  NETWORK: 'NETWORK',
  API: 'API',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  SERVER: 'SERVER',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  statusCode?: number;
  originalError?: Error | AxiosError;
  timestamp: string;
  retryable: boolean;
  metadata?: Record<string, any>;
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify error and return structured AppError
 */
export function classifyError(error: unknown): AppError {
  const timestamp = new Date().toISOString();

  // Network errors (no response received)
  if (isNetworkError(error)) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.HIGH,
      message: 'Network connection failed',
      userMessage: 'Unable to connect. Please check your internet connection.',
      retryable: true,
      timestamp,
      originalError: error as Error,
    };
  }

  // Axios errors (response received)
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status;

    switch (statusCode) {
      case 400:
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          message: 'Validation error',
          userMessage: 'Please check your input and try again.',
          statusCode,
          retryable: false,
          timestamp,
          originalError: error,
        };

      case 401:
        return {
          type: ErrorType.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
          message: 'Authentication required',
          userMessage: 'Please sign in to continue.',
          statusCode,
          retryable: false,
          timestamp,
          originalError: error,
        };

      case 403:
        return {
          type: ErrorType.AUTHORIZATION,
          severity: ErrorSeverity.MEDIUM,
          message: 'Access denied',
          userMessage: "You don't have permission to perform this action.",
          statusCode,
          retryable: false,
          timestamp,
          originalError: error,
        };

      case 404:
        return {
          type: ErrorType.NOT_FOUND,
          severity: ErrorSeverity.LOW,
          message: 'Resource not found',
          userMessage: 'The content you requested could not be found.',
          statusCode,
          retryable: false,
          timestamp,
          originalError: error,
        };

      case 408:
      case 504:
        return {
          type: ErrorType.TIMEOUT,
          severity: ErrorSeverity.MEDIUM,
          message: 'Request timeout',
          userMessage: 'The request took too long. Please try again.',
          statusCode,
          retryable: true,
          timestamp,
          originalError: error,
        };

      case 429:
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.MEDIUM,
          message: 'Rate limit exceeded',
          userMessage: 'Too many requests. Please wait a moment and try again.',
          statusCode,
          retryable: true,
          timestamp,
          originalError: error,
        };

      case 500:
      case 502:
      case 503:
        return {
          type: ErrorType.SERVER,
          severity: ErrorSeverity.HIGH,
          message: 'Server error',
          userMessage: 'Something went wrong on our end. Please try again later.',
          statusCode,
          retryable: true,
          timestamp,
          originalError: error,
        };

      default:
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.MEDIUM,
          message: `API error: ${statusCode}`,
          userMessage: 'Something went wrong. Please try again.',
          statusCode,
          retryable: true,
          timestamp,
          originalError: error,
        };
    }
  }

  // Generic JavaScript errors
  if (error instanceof Error) {
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: true,
      timestamp,
      originalError: error,
    };
  }

  // Unknown error type
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.LOW,
    message: 'Unknown error',
    userMessage: 'Something went wrong. Please try again.',
    retryable: true,
    timestamp,
  };
}

// ============================================================================
// Error Type Checking
// ============================================================================

function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const err = error as any;

  // Axios network errors
  if (err.isAxiosError && !err.response) return true;

  // Fetch network errors
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;

  // Offline detection
  if (!navigator.onLine) return true;

  return false;
}

function isAxiosError(error: unknown): error is AxiosError {
  return !!(error as any).isAxiosError;
}

// ============================================================================
// Retry Logic
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: ErrorType[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableErrors: [ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.SERVER],
};

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(
  error: AppError,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  return error.retryable && config.retryableErrors.includes(error.type);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = classifyError(error);

      // Don't retry if not retryable
      if (!isRetryableError(lastError, finalConfig)) {
        throw error;
      }

      // Don't delay on last attempt
      if (attempt < finalConfig.maxAttempts) {
        const delay = calculateBackoff(attempt, finalConfig);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError?.originalError || new Error('Max retry attempts reached');
}

/**
 * Retry function with jitter to prevent thundering herd
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = classifyError(error);

      // Don't retry if not retryable
      if (!isRetryableError(lastError, finalConfig)) {
        throw error;
      }

      // Don't delay on last attempt
      if (attempt < finalConfig.maxAttempts) {
        const baseDelay = calculateBackoff(attempt, finalConfig);
        // Add jitter: random value between 0 and baseDelay
        const jitter = Math.random() * baseDelay;
        const delay = baseDelay + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError?.originalError || new Error('Max retry attempts reached');
}

/**
 * Create a retry function wrapper with automatic retry
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return ((...args: Parameters<T>) => {
    return retryWithJitter(() => fn(...args), config);
  }) as T;
}

// ============================================================================
// Error Logging
// ============================================================================

export interface ErrorLog {
  error: AppError;
  context?: Record<string, any>;
  breadcrumbs?: string[];
  userAgent?: string;
  url?: string;
}

/**
 * Log error with context
 */
export function logError(
  error: AppError,
  context?: Record<string, any>,
  breadcrumbs?: string[]
): void {
  const errorLog: ErrorLog = {
    error,
    context,
    breadcrumbs,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  // Silent logging in dev environment
  // Error logging disabled for production builds

  // Send to error tracking service (production)
  if (import.meta.env.PROD) {
    sendToErrorTracking(errorLog);
  }
}

/**
 * Send error to tracking service (Sentry, LogRocket, etc.)
 */
function sendToErrorTracking(errorLog: ErrorLog): void {
  // Placeholder for error tracking integration
  // Example: Sentry.captureException(errorLog.error.originalError, { extra: errorLog.context });
  
  // For now, store in session for debugging
  try {
    const errors = JSON.parse(sessionStorage.getItem('errorLogs') || '[]');
    errors.push({
      ...errorLog,
      timestamp: new Date().toISOString(),
    });
    // Keep last 50 errors
    if (errors.length > 50) {
      errors.shift();
    }
    sessionStorage.setItem('errorLogs', JSON.stringify(errors));
  } catch (e) {
  }
}

// ============================================================================
// Error Recovery
// ============================================================================

/**
 * Attempt to recover from error
 */
export async function attemptRecovery(error: AppError): Promise<boolean> {
  switch (error.type) {
    case ErrorType.NETWORK:
      // Wait for network to come back online
      if (!navigator.onLine) {
        return new Promise((resolve) => {
          const handleOnline = () => {
            window.removeEventListener('online', handleOnline);
            resolve(true);
          };
          window.addEventListener('online', handleOnline);
          
          // Timeout after 30 seconds
          setTimeout(() => {
            window.removeEventListener('online', handleOnline);
            resolve(false);
          }, 30000);
        });
      }
      return true;

    case ErrorType.AUTHENTICATION:
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return false;

    case ErrorType.TIMEOUT:
    case ErrorType.SERVER:
      // Wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;

    default:
      return false;
  }
}

// ============================================================================
// User-Friendly Messages
// ============================================================================

/**
 * Get action-specific user message
 */
export function getUserMessage(error: AppError, action?: string): string {
  const actionContext = action ? ` while ${action}` : '';

  switch (error.type) {
    case ErrorType.NETWORK:
      return `Unable to connect${actionContext}. Please check your internet connection and try again.`;

    case ErrorType.TIMEOUT:
      return `Request timed out${actionContext}. Please try again.`;

    case ErrorType.AUTHENTICATION:
      return `You need to sign in${actionContext}.`;

    case ErrorType.AUTHORIZATION:
      return `You don't have permission${actionContext}.`;

    case ErrorType.NOT_FOUND:
      return `The content${actionContext} could not be found.`;

    case ErrorType.VALIDATION:
      return `Invalid input${actionContext}. Please check your data.`;

    case ErrorType.SERVER:
      return `Server error${actionContext}. We're working to fix this. Please try again later.`;

    default:
      return error.userMessage + (actionContext || '');
  }
}

// ============================================================================
// Error Recovery Actions
// ============================================================================

export interface ErrorAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/**
 * Get suggested recovery actions for error
 */
export function getRecoveryActions(
  error: AppError,
  onRetry?: () => void,
  onDismiss?: () => void
): ErrorAction[] {
  const actions: ErrorAction[] = [];

  // Retry action for retryable errors
  if (error.retryable && onRetry) {
    actions.push({
      label: 'Try Again',
      onClick: onRetry,
      primary: true,
    });
  }

  // Type-specific actions
  switch (error.type) {
    case ErrorType.AUTHENTICATION:
      actions.push({
        label: 'Sign In',
        onClick: () => (window.location.href = '/login'),
        primary: true,
      });
      break;

    case ErrorType.NETWORK:
      actions.push({
        label: 'Refresh',
        onClick: () => window.location.reload(),
        primary: !onRetry,
      });
      break;

    case ErrorType.NOT_FOUND:
      actions.push({
        label: 'Go Home',
        onClick: () => (window.location.href = '/'),
        primary: true,
      });
      break;
  }

  // Dismiss action
  if (onDismiss) {
    actions.push({
      label: 'Dismiss',
      onClick: onDismiss,
      primary: false,
    });
  }

  return actions;
}

// ============================================================================
// Circuit Breaker Pattern
// ============================================================================

/**
 * Circuit Breaker States
 */
export const CircuitState = {
  CLOSED: 'CLOSED',     // Normal operation, requests allowed
  OPEN: 'OPEN',         // Circuit open, requests blocked
  HALF_OPEN: 'HALF_OPEN', // Testing if service recovered
} as const;

export type CircuitState = typeof CircuitState[keyof typeof CircuitState];

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening circuit
  successThreshold: number;      // Successes to close circuit (from half-open)
  timeout: number;               // Time in ms before attempting half-open
  volumeThreshold: number;       // Minimum requests before opening circuit
  errorThresholdPercentage: number; // Failure rate threshold (0-100)
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  volumeThreshold: 10,
  errorThresholdPercentage: 50,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private nextAttemptTime = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker [${this.name}] is OPEN. Blocking request.`);
      }
      // Timeout elapsed, try half-open
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.requestCount++;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.requestCount++;
    this.failureCount++;
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
      return;
    }

    if (this.state === CircuitState.CLOSED) {
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

  /**
   * Open the circuit (block requests)
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.timeout;
  }

  /**
   * Close the circuit (allow requests)
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      errorRate: this.requestCount > 0 ? (this.failureCount / this.requestCount) * 100 : 0,
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttemptTime) : null,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.close();
  }
}

/**
 * Global circuit breakers for common endpoints
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create circuit breaker for endpoint
 */
export function getCircuitBreaker(
  endpoint: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(endpoint)) {
    circuitBreakers.set(endpoint, new CircuitBreaker(endpoint, config));
  }
  return circuitBreakers.get(endpoint)!;
}

/**
 * Execute function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  endpoint: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = getCircuitBreaker(endpoint, config);
  return breaker.execute(fn);
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitStats() {
  const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
  circuitBreakers.forEach((breaker, endpoint) => {
    stats[endpoint] = breaker.getStats();
  });
  return stats;
}

// ============================================================================
// Export All
// ============================================================================

export {
  isNetworkError as checkNetworkError,
  isAxiosError as checkAxiosError,
};
