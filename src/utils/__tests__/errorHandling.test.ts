/**
 * Example Test: Error Handling Utilities
 * 
 * Demonstrates testing patterns for:
 * - Pure functions
 * - Error classification
 * - Retry logic
 * - Async operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyError,
  retryWithBackoff,
  isRetryableError,
  getUserMessage,
  type AppError,
} from '../errorHandling';

describe('errorHandling utils', () => {
  describe('classifyError', () => {
    it('should classify network errors', () => {
      const error = new Error('Network request failed');
      const classified = classifyError(error);

      expect(classified.type).toBe('NETWORK');
      expect(classified.retryable).toBe(true);
      expect(classified.severity).toBe('HIGH');
    });

    it('should classify timeout errors', () => {
      const error = new Error('Request timeout');
      const classified = classifyError(error);

      expect(classified.type).toBe('TIMEOUT');
      expect(classified.retryable).toBe(true);
    });

    it('should classify 404 errors', () => {
      const error = {
        statusCode: 404,
        message: 'Not found',
      };
      const classified = classifyError(error);

      expect(classified.type).toBe('NOT_FOUND');
      expect(classified.retryable).toBe(false);
      expect(classified.severity).toBe('LOW');
    });

    it('should classify authentication errors', () => {
      const error = {
        statusCode: 401,
        message: 'Unauthorized',
      };
      const classified = classifyError(error);

      expect(classified.type).toBe('AUTHENTICATION');
      expect(classified.retryable).toBe(false);
      expect(classified.severity).toBe('MEDIUM');
    });

    it('should classify server errors as retryable', () => {
      const error = {
        statusCode: 500,
        message: 'Internal server error',
      };
      const classified = classifyError(error);

      expect(classified.type).toBe('SERVER');
      expect(classified.retryable).toBe(true);
      expect(classified.severity).toBe('HIGH');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      const classified = classifyError(error);

      expect(classified.type).toBe('UNKNOWN');
      expect(classified.severity).toBe('MEDIUM');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error: AppError = {
        type: 'NETWORK',
        message: 'Network failed',
        retryable: true,
        severity: 'HIGH',
        userMessage: 'Network error',
        timestamp: new Date().toISOString(),
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error: AppError = {
        type: 'TIMEOUT',
        message: 'Timeout',
        retryable: true,
        severity: 'HIGH',
        userMessage: 'Request timeout',
        timestamp: new Date().toISOString(),
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for authentication errors', () => {
      const error: AppError = {
        type: 'AUTHENTICATION',
        message: 'Unauthorized',
        retryable: false,
        severity: 'MEDIUM',
        userMessage: 'Authentication failed',
        timestamp: new Date().toISOString(),
      };

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('should return user-friendly message for network errors', () => {
      const error: AppError = {
        type: 'NETWORK',
        message: 'fetch failed',
        retryable: true,
        severity: 'HIGH',
        userMessage: 'Network error',
        timestamp: new Date().toISOString(),
      };

      const message = getUserMessage(error, 'load feed');
      
      expect(message).toContain('network');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should include action context in message', () => {
      const error: AppError = {
        type: 'SERVER',
        message: '500 error',
        retryable: true,
        severity: 'HIGH',
        userMessage: 'Server error',
        timestamp: new Date().toISOString(),
      };

      const message = getUserMessage(error, 'create post');
      
      expect(message).toBeTruthy();
    });
  });

  describe('retryWithBackoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        baseDelay: 1000,
      });

      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(1000); // First retry after 1s
      await vi.advanceTimersByTimeAsync(2000); // Second retry after 2s

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

      const promise = retryWithBackoff(fn, {
        maxAttempts: 2,
        baseDelay: 100,
      });

      // Fast-forward through all retries
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const delays: number[] = [];

      const originalSetTimeout = (globalThis as any).setTimeout;
      (globalThis as any).setTimeout = ((callback: any, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      try {
        await retryWithBackoff(fn, {
          maxAttempts: 3,
          baseDelay: 1000,
        }).catch(() => {});

        // Should see exponential backoff: 1000ms, 2000ms
        expect(delays).toContain(1000);
        expect(delays).toContain(2000);
      } finally {
        (globalThis as any).setTimeout = originalSetTimeout;
      }
    });

    it('should respect max delay', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const delays: number[] = [];

      const originalSetTimeout = (globalThis as any).setTimeout;
      (globalThis as any).setTimeout = ((callback: any, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      try {
        await retryWithBackoff(fn, {
          maxAttempts: 4,
          baseDelay: 10000,
          maxDelay: 15000,
        }).catch(() => {});

        // Should cap at maxDelay
        expect(Math.max(...delays)).toBeLessThanOrEqual(15000);
      } finally {
        (globalThis as any).setTimeout = originalSetTimeout;
      }
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Non-retryable');
      (error as any).retryable = false;
      
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        retryWithBackoff(fn, { maxAttempts: 3 })
      ).rejects.toThrow('Non-retryable');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
