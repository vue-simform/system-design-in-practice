/**
 * Error State Components
 * Comprehensive error UI with recovery actions
 */

import type { AppError } from '../../utils/errorHandling';
import { ErrorType, getRecoveryActions } from '../../utils/errorHandling';

// Simple SVG Icons
const AlertCircleIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const HomeIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const WifiOffIcon = () => (
  <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
  </svg>
);

const ServerIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ============================================================================
// Props Interfaces
// ============================================================================

interface BaseErrorProps {
  error?: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

interface ErrorStateProps extends BaseErrorProps {
  title?: string;
  description?: string;
  showDetails?: boolean;
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ============================================================================
// Generic Error State Component
// ============================================================================

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}: ErrorStateProps) {
  if (!error) return null;

  const errorTitle = title || getErrorTitle(error);
  const errorDescription = description || error.userMessage;
  const actions = getRecoveryActions(error, onRetry, onDismiss);
  const Icon = getErrorIcon(error.type);

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className={`mb-4 rounded-full p-3 ${getIconBgColor(error.severity)}`}
        aria-hidden="true"
      >
        <div className={getIconColor(error.severity)}>
          <Icon />
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {errorTitle}
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
        {errorDescription}
      </p>

      {/* Error Details (Collapsed by default) */}
      {showDetails && error.originalError && (
        <details className="mb-6 w-full max-w-md">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300">
            Technical Details
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {error.originalError.message}
            {error.statusCode && `\nStatus Code: ${error.statusCode}`}
            {error.timestamp && `\nTimestamp: ${new Date(error.timestamp).toLocaleString()}`}
          </pre>
        </details>
      )}

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`
                rounded-lg px-4 py-2 text-sm font-medium transition-colors
                ${
                  action.primary
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }
              `}
              aria-label={action.label}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Network Error Component
// ============================================================================

export function NetworkError({ onRetry, className = '' }: BaseErrorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      role="alert"
      aria-live="assertive"
    >
      {/* Animated WiFi Icon */}
      <div className="relative mb-4 text-red-500 dark:text-red-400 animate-pulse">
        <WifiOffIcon />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        No Internet Connection
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
        Please check your network settings and try again. Your changes will be synced when you're back online.
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
            aria-label="Try again"
          >
            <RefreshIcon />
            Try Again
          </button>
        )}
      </div>

      {/* Offline Indicator */}
      {!navigator.onLine && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Currently offline
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Server Error Component
// ============================================================================

export function ServerError({ onRetry, className = '' }: BaseErrorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className="mb-4 rounded-full bg-orange-100 p-3 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
        <ServerIcon />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Server Error
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
        Something went wrong on our end. Our team has been notified and we're working to fix this.
      </p>

      {/* Actions */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label="Try again"
        >
          <RefreshIcon />
          Try Again
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Not Found Component
// ============================================================================

export function NotFound({ className = '' }: BaseErrorProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      role="alert"
    >
      {/* 404 Text */}
      <h1 className="mb-4 text-6xl font-bold text-gray-300 dark:text-gray-700">
        404
      </h1>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Content Not Found
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
        The content you're looking for doesn't exist or has been removed.
      </p>

      {/* Actions */}
      <button
        onClick={() => (window.location.href = '/')}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
        aria-label="Go to home page"
      >
        <HomeIcon />
        Go Home
      </button>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-4 text-gray-400 dark:text-gray-600" aria-hidden="true">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>

      {/* Action */}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Inline Error Banner
// ============================================================================

interface ErrorBannerProps extends BaseErrorProps {
  variant?: 'error' | 'warning' | 'info';
}

export function ErrorBanner({
  error,
  variant = 'error',
  onRetry,
  onDismiss,
  className = '',
}: ErrorBannerProps) {
  if (!error) return null;

  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
  };

  return (
    <div
      className={`relative flex items-start gap-3 rounded-lg border p-4 ${styles[variant]} ${className}`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-sm font-medium">{error.userMessage}</p>
        {error.statusCode && (
          <p className="mt-1 text-xs opacity-75">Error code: {error.statusCode}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        {onRetry && error.retryable && (
          <button
            onClick={onRetry}
            className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Retry"
          >
            <RefreshIcon />
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Dismiss"
          >
            <XIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getErrorTitle(error: AppError): string {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Connection Problem';
    case ErrorType.TIMEOUT:
      return 'Request Timed Out';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Required';
    case ErrorType.AUTHORIZATION:
      return 'Access Denied';
    case ErrorType.NOT_FOUND:
      return 'Not Found';
    case ErrorType.VALIDATION:
      return 'Invalid Input';
    case ErrorType.SERVER:
      return 'Server Error';
    default:
      return 'Something Went Wrong';
  }
}

function getErrorIcon(errorType: ErrorType) {
  switch (errorType) {
    case ErrorType.NETWORK:
      return WifiOffIcon;
    case ErrorType.SERVER:
      return ServerIcon;
    case ErrorType.NOT_FOUND:
      return AlertCircleIcon;
    default:
      return AlertCircleIcon;
  }
}

function getIconBgColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'bg-red-100 dark:bg-red-900/30';
    case 'MEDIUM':
      return 'bg-orange-100 dark:bg-orange-900/30';
    case 'LOW':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-800';
  }
}

function getIconColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'text-red-600 dark:text-red-400';
    case 'MEDIUM':
      return 'text-orange-600 dark:text-orange-400';
    case 'LOW':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}
