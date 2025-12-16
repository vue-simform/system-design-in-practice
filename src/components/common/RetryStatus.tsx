/**
 * Retry Status UI Components
 * 
 * Visual indicators for retry attempts, countdown timers, and failure states.
 * 
 * Components:
 * - RetryButton: Button with retry countdown and state
 * - RetryBanner: Banner showing retry status with progress
 * - RetryIndicator: Small inline retry indicator
 * - CircuitBreakerBadge: Show circuit breaker status
 * 
 * Usage:
 * ```tsx
 * <RetryButton
 *   onRetry={retry}
 *   isRetrying={isRetrying}
 *   retryCount={retryCount}
 *   maxAttempts={3}
 *   nextRetryIn={nextRetryIn}
 * />
 * 
 * <RetryBanner
 *   error={error}
 *   retryCount={retryCount}
 *   maxAttempts={3}
 *   onRetry={retry}
 *   onDismiss={dismiss}
 * />
 * ```
 */

import { type AppError } from '../../utils/errorHandling';

// ============================================================================
// Retry Button
// ============================================================================

interface RetryButtonProps {
  onRetry: () => void;
  isRetrying: boolean;
  retryCount: number;
  maxAttempts: number;
  nextRetryIn: number | null;
  disabled?: boolean;
  className?: string;
}

export function RetryButton({
  onRetry,
  isRetrying,
  retryCount,
  maxAttempts,
  nextRetryIn,
  disabled = false,
  className = '',
}: RetryButtonProps) {
  const canRetry = retryCount < maxAttempts && !isRetrying && !disabled;

  return (
    <button
      onClick={onRetry}
      disabled={!canRetry}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all
        ${
          canRetry
            ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }
        ${className}
      `}
      aria-label={
        isRetrying
          ? 'Retrying...'
          : nextRetryIn
          ? `Retry in ${nextRetryIn} seconds`
          : 'Retry'
      }
    >
      {/* Icon */}
      {isRetrying ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}

      {/* Text */}
      <span>
        {isRetrying
          ? 'Retrying...'
          : nextRetryIn
          ? `Retry (${nextRetryIn}s)`
          : `Retry ${retryCount > 0 ? `(${retryCount}/${maxAttempts})` : ''}`}
      </span>
    </button>
  );
}

// ============================================================================
// Retry Banner
// ============================================================================

interface RetryBannerProps {
  error: AppError | null;
  retryCount: number;
  maxAttempts: number;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function RetryBanner({
  error,
  retryCount,
  maxAttempts,
  onRetry,
  onDismiss,
  className = '',
}: RetryBannerProps) {
  if (!error) return null;

  const isMaxRetries = retryCount >= maxAttempts;
  const bgColor = isMaxRetries ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = isMaxRetries ? 'border-red-200' : 'border-yellow-200';
  const textColor = isMaxRetries ? 'text-red-900' : 'text-yellow-900';
  const subtextColor = isMaxRetries ? 'text-red-700' : 'text-yellow-700';

  return (
    <div
      className={`
        ${bgColor} ${borderColor} border-l-4 p-4 ${className}
      `}
      role="alert"
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className="shrink-0">
          {isMaxRetries ? (
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${textColor}`}>
            {isMaxRetries ? 'Maximum retry attempts reached' : 'Request failed'}
          </h3>
          <p className={`mt-1 text-sm ${subtextColor}`}>
            {error.userMessage}
          </p>
          {retryCount > 0 && (
            <p className={`mt-1 text-xs ${subtextColor}`}>
              Attempted {retryCount} of {maxAttempts} times
            </p>
          )}

          {/* Actions */}
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex gap-2">
              {onRetry && !isMaxRetries && (
                <button
                  onClick={onRetry}
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  Try again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className={`text-sm font-medium ${
                    isMaxRetries ? 'text-red-800 hover:text-red-900' : 'text-yellow-800 hover:text-yellow-900'
                  } underline`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar for retries */}
      {!isMaxRetries && retryCount > 0 && (
        <div className="mt-3">
          <div className="w-full bg-yellow-200 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(retryCount / maxAttempts) * 100}%` }}
              role="progressbar"
              aria-valuenow={retryCount}
              aria-valuemin={0}
              aria-valuemax={maxAttempts}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Retry Indicator (Small inline)
// ============================================================================

interface RetryIndicatorProps {
  isRetrying: boolean;
  retryCount: number;
  nextRetryIn: number | null;
  className?: string;
}

export function RetryIndicator({
  isRetrying,
  retryCount,
  nextRetryIn,
  className = '',
}: RetryIndicatorProps) {
  if (!isRetrying && retryCount === 0 && !nextRetryIn) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 text-sm text-gray-600 ${className}`}>
      {isRetrying && (
        <>
          <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Retrying...</span>
        </>
      )}

      {!isRetrying && nextRetryIn && (
        <>
          <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Retry in {nextRetryIn}s</span>
        </>
      )}

      {retryCount > 0 && !isRetrying && !nextRetryIn && (
        <>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Retried {retryCount}x</span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Circuit Breaker Badge
// ============================================================================

interface CircuitBreakerBadgeProps {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  className?: string;
}

export function CircuitBreakerBadge({ state, className = '' }: CircuitBreakerBadgeProps) {
  const colors = {
    CLOSED: 'bg-green-100 text-green-800 border-green-200',
    OPEN: 'bg-red-100 text-red-800 border-red-200',
    HALF_OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  const icons = {
    CLOSED: '✓',
    OPEN: '⚠',
    HALF_OPEN: '⟳',
  };

  const labels = {
    CLOSED: 'Normal',
    OPEN: 'Circuit Open',
    HALF_OPEN: 'Testing',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
        text-xs font-medium border
        ${colors[state]}
        ${className}
      `}
      title={`Circuit breaker state: ${state}`}
    >
      <span>{icons[state]}</span>
      <span>{labels[state]}</span>
    </span>
  );
}
