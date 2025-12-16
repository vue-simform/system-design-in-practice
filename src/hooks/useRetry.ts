/**
 * useRetry Hook
 * 
 * Provides manual retry control with status tracking, countdown timers,
 * and configurable retry strategies.
 * 
 * System Design Concepts:
 * - Manual Retry Control: User-triggered retry with visual feedback
 * - Status Tracking: Loading, error, success states
 * - Countdown Timer: Show time until next retry attempt
 * - Retry History: Track all retry attempts for debugging
 * - Configurable Strategies: Exponential backoff, linear, fixed delay
 * - Circuit Breaker Integration: Prevent overwhelming failed services
 * 
 * Features:
 * - Automatic retry with configurable attempts
 * - Manual retry button
 * - Countdown timer between retries
 * - Retry history and analytics
 * - Circuit breaker protection
 * - TypeScript type safety
 * 
 * Usage:
 * ```tsx
 * const { retry, isRetrying, retryCount, nextRetryIn, canRetry } = useRetry({
 *   fn: fetchData,
 *   maxAttempts: 3,
 * });
 * 
 * <button onClick={retry} disabled={!canRetry}>
 *   {isRetrying ? 'Retrying...' : `Retry ${nextRetryIn ? `(${nextRetryIn}s)` : ''}`}
 * </button>
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  classifyError, 
  calculateBackoff, 
  type AppError,
  withCircuitBreaker,
} from '../utils/errorHandling';

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  error?: AppError;
  success: boolean;
  duration: number;
}

export interface UseRetryOptions<T> {
  /**
   * Function to execute and retry
   */
  fn: () => Promise<T>;

  /**
   * Maximum retry attempts (default: 3)
   */
  maxAttempts?: number;

  /**
   * Base delay in ms (default: 1000)
   */
  baseDelay?: number;

  /**
   * Auto retry on mount (default: false)
   */
  autoRetry?: boolean;

  /**
   * Enable circuit breaker (default: true)
   */
  useCircuitBreaker?: boolean;

  /**
   * Circuit breaker endpoint name
   */
  circuitBreakerKey?: string;

  /**
   * Success callback
   */
  onSuccess?: (data: T) => void;

  /**
   * Error callback
   */
  onError?: (error: AppError) => void;

  /**
   * Retry attempt callback
   */
  onRetry?: (attempt: number) => void;

  /**
   * Max retries reached callback
   */
  onMaxRetriesReached?: () => void;
}

export interface UseRetryReturn<T> {
  /**
   * Manually trigger retry
   */
  retry: () => Promise<void>;

  /**
   * Cancel ongoing retry
   */
  cancel: () => void;

  /**
   * Reset retry state
   */
  reset: () => void;

  /**
   * Whether currently retrying
   */
  isRetrying: boolean;

  /**
   * Current retry attempt number
   */
  retryCount: number;

  /**
   * Seconds until next retry
   */
  nextRetryIn: number | null;

  /**
   * Whether can retry (not at max attempts)
   */
  canRetry: boolean;

  /**
   * Latest data (if successful)
   */
  data: T | null;

  /**
   * Latest error
   */
  error: AppError | null;

  /**
   * Retry history
   */
  history: RetryAttempt[];

  /**
   * Success rate (0-100)
   */
  successRate: number;
}

export function useRetry<T>({
  fn,
  maxAttempts = 3,
  baseDelay = 1000,
  autoRetry = false,
  useCircuitBreaker = true,
  circuitBreakerKey = 'default',
  onSuccess,
  onError,
  onRetry,
  onMaxRetriesReached,
}: UseRetryOptions<T>): UseRetryReturn<T> {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [history, setHistory] = useState<RetryAttempt[]>([]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef(false);

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setNextRetryIn(null);
  }, []);

  /**
   * Start countdown timer
   */
  const startCountdown = useCallback((delayMs: number) => {
    const endTime = Date.now() + delayMs;
    
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setNextRetryIn(null);
      } else {
        setNextRetryIn(remaining);
      }
    }, 100);
  }, []);

  /**
   * Execute function with retry logic
   */
  const executeWithRetry = useCallback(async (attemptNumber: number): Promise<void> => {
    if (isCancelledRef.current) return;

    const startTime = Date.now();
    setIsRetrying(true);
    setRetryCount(attemptNumber);
    onRetry?.(attemptNumber);

    try {
      // Execute with or without circuit breaker
      const result = useCircuitBreaker
        ? await withCircuitBreaker(circuitBreakerKey, fn)
        : await fn();

      // Success!
      const duration = Date.now() - startTime;
      setData(result);
      setError(null);
      setHistory(prev => [
        ...prev,
        { attemptNumber, timestamp: Date.now(), success: true, duration },
      ]);
      onSuccess?.(result);
      setIsRetrying(false);
      clearTimers();
    } catch (err) {
      const duration = Date.now() - startTime;
      const appError = classifyError(err);
      setError(appError);
      setHistory(prev => [
        ...prev,
        { attemptNumber, timestamp: Date.now(), error: appError, success: false, duration },
      ]);
      onError?.(appError);

      // Check if should retry
      if (attemptNumber < maxAttempts && appError.retryable && !isCancelledRef.current) {
        // Calculate delay with exponential backoff
        const delay = calculateBackoff(attemptNumber, { 
          baseDelay, 
          maxDelay: 30000, 
          backoffFactor: 2,
          maxAttempts,
          retryableErrors: [],
        });

        // Start countdown
        startCountdown(delay);

        // Schedule next retry
        timeoutRef.current = setTimeout(() => {
          executeWithRetry(attemptNumber + 1);
        }, delay);
      } else {
        // Max retries reached
        setIsRetrying(false);
        clearTimers();
        if (attemptNumber >= maxAttempts) {
          onMaxRetriesReached?.();
        }
      }
    }
  }, [fn, maxAttempts, baseDelay, useCircuitBreaker, circuitBreakerKey, onSuccess, onError, onRetry, onMaxRetriesReached, startCountdown, clearTimers]);

  /**
   * Manually trigger retry
   */
  const retry = useCallback(async () => {
    isCancelledRef.current = false;
    clearTimers();
    await executeWithRetry(retryCount + 1);
  }, [executeWithRetry, retryCount, clearTimers]);

  /**
   * Cancel ongoing retry
   */
  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    setIsRetrying(false);
    clearTimers();
  }, [clearTimers]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    cancel();
    setRetryCount(0);
    setData(null);
    setError(null);
    setHistory([]);
  }, [cancel]);

  /**
   * Auto-retry on mount
   */
  useEffect(() => {
    if (autoRetry) {
      executeWithRetry(1);
    }

    return () => {
      isCancelledRef.current = true;
      clearTimers();
    };
  }, [autoRetry, executeWithRetry, clearTimers]);

  /**
   * Calculate success rate
   */
  const successRate = history.length > 0
    ? (history.filter(h => h.success).length / history.length) * 100
    : 0;

  return {
    retry,
    cancel,
    reset,
    isRetrying,
    retryCount,
    nextRetryIn,
    canRetry: retryCount < maxAttempts && !isRetrying,
    data,
    error,
    history,
    successRate,
  };
}
